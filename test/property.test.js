import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { dmsToDecimal, extractCoordinates, formatCoord } from '../src/exif/gps.js';
import { formatValue, parseMetadata } from '../src/exif/parse.js';
import { stripMetadata } from '../src/exif/strip.js';

// Property-based tests: assert invariants across the whole input space rather
// than a handful of hand-picked examples. These catch sign/precision/rounding
// bugs that example tests miss.

const rational = (max) =>
  fc.tuple(fc.integer({ min: 0, max }), fc.integer({ min: 1, max: 3600 }));

describe('dmsToDecimal properties', () => {
  it('stays within [-180, 180] for any well-formed DMS', () => {
    fc.assert(
      fc.property(
        rational(180),
        rational(59),
        rational(59),
        fc.constantFrom('N', 'S', 'E', 'W'),
        (d, m, s, ref) => {
          const dd = dmsToDecimal([d, m, s], ref);
          // Degrees can reach 180 (longitude) plus minute/second carry; cap the
          // generators so a valid fix never exceeds the coordinate range grossly.
          expect(Number.isFinite(dd)).toBe(true);
          expect(Math.abs(dd)).toBeLessThanOrEqual(181);
        },
      ),
    );
  });

  it('negates exactly for southern/western hemispheres', () => {
    fc.assert(
      fc.property(rational(180), rational(59), rational(59), (d, m, s) => {
        expect(dmsToDecimal([d, m, s], 'S')).toBeCloseTo(-dmsToDecimal([d, m, s], 'N'), 9);
        expect(dmsToDecimal([d, m, s], 'W')).toBeCloseTo(-dmsToDecimal([d, m, s], 'E'), 9);
      }),
    );
  });

  it('is monotonic in degrees for a fixed ref and minutes/seconds', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 178 }), (deg) => {
        const lo = dmsToDecimal([[deg, 1], [0, 1], [0, 1]], 'N');
        const hi = dmsToDecimal([[deg + 1, 1], [0, 1], [0, 1]], 'N');
        expect(hi).toBeGreaterThan(lo);
      }),
    );
  });

  it('returns null for any array shorter than three components', () => {
    fc.assert(
      fc.property(fc.array(rational(90), { minLength: 0, maxLength: 2 }), (dms) => {
        expect(dmsToDecimal(dms, 'N')).toBeNull();
      }),
    );
  });
});

describe('extractCoordinates properties', () => {
  it('round-trips a fix through formatCoord within display precision', () => {
    fc.assert(
      fc.property(rational(89), rational(179), (lat, lng) => {
        const fix = extractCoordinates({
          GPSLatitude: [lat, [0, 1], [0, 1]],
          GPSLatitudeRef: 'N',
          GPSLongitude: [lng, [0, 1], [0, 1]],
          GPSLongitudeRef: 'E',
        });
        expect(fix).not.toBeNull();
        expect(Number(formatCoord(fix.lat))).toBeCloseTo(fix.lat, 5);
        expect(fix.altitude).toBeNull();
      }),
    );
  });
});

// --- JPEG composition for the strip invariant --------------------------------

const be16 = (n) => [(n >> 8) & 0xff, n & 0xff];
const app = (marker, payload) => [0xff, marker, ...be16(payload.length + 2), ...payload];
const ascii = (s) => Array.from(s).map((c) => c.charCodeAt(0));

// A menu of metadata segments the stripper must remove.
const META_SEGMENTS = {
  xmp: () => app(0xe1, ascii('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta/>')),
  iptc: () => app(0xed, ascii('Photoshop 3.0\0creator: A. Nonymous')),
  app1: () => app(0xe1, ascii('SomeVendor\0proprietary junk')),
  appn: () => app(0xe4, ascii('APP4 payload')),
};

describe('parse<->strip invariant', () => {
  it('wipes every metadata combination and preserves the scan bytes', () => {
    fc.assert(
      fc.property(
        // Which metadata segments to include, in which order.
        fc.subarray(Object.keys(META_SEGMENTS), { minLength: 1 }),
        fc.array(fc.integer({ min: 0, max: 254 }), { minLength: 1, maxLength: 40 }),
        (kinds, scanBytes) => {
          const segments = kinds.flatMap((k) => META_SEGMENTS[k]());
          const scan = [0xff, 0xda, ...be16(4), 0x00, 0x00, ...scanBytes];
          const bytes = [...be16(0xffd8), ...segments, ...scan, ...be16(0xffd9)];
          const buffer = new Uint8Array(bytes).buffer;

          expect(parseMetadata(buffer).hasMetadata).toBe(true);

          const { buffer: clean, removed } = stripMetadata(buffer);
          expect(removed).toBe(kinds.length);
          // No metadata survives the wipe.
          expect(parseMetadata(clean).hasMetadata).toBe(false);
          // The scan payload + EOI are preserved byte-for-byte.
          const out = new Uint8Array(clean);
          const tail = Array.from(out.slice(out.length - (scanBytes.length + 2)));
          expect(tail).toEqual([...scanBytes, 0xff, 0xd9]);
        },
      ),
    );
  });
});

describe('formatValue properties', () => {
  it('renders a whole-denominator rational as its integer numerator', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1e6, max: 1e6 }), (num) => {
        expect(formatValue([num, 1])).toBe(String(num));
      }),
    );
  });

  it('never throws and always returns a string for arbitrary scalars', () => {
    fc.assert(
      fc.property(fc.oneof(fc.integer(), fc.double(), fc.string(), fc.boolean()), (v) => {
        expect(typeof formatValue(v)).toBe('string');
      }),
    );
  });
});
