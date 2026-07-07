import { describe, it, expect } from 'vitest';
import { parseMetadata, formatValue } from '../src/exif/parse.js';
import {
  jpegWithExif,
  jpegBare,
  notJpeg,
  jpegWithXmp,
  jpegWithIptc,
  jpegTruncated,
  jpegWithForeignApp1,
  jpegAppMarkerAtEof,
  jpegExifNoTiff,
  jpegBadSubIfdPointer,
} from './fixtures.js';

describe('parseMetadata', () => {
  it('detects a JPEG and reads IFD0 camera fields', () => {
    const meta = parseMetadata(jpegWithExif());
    expect(meta.isJpeg).toBe(true);
    expect(meta.hasMetadata).toBe(true);

    const make = meta.fields.find((f) => f.name === 'Make');
    const model = meta.fields.find((f) => f.name === 'Model');
    expect(make.display).toBe('TestCam');
    expect(model.display).toBe('M1');
  });

  it('resolves the GPS block into signed decimal coordinates', () => {
    const meta = parseMetadata(jpegWithExif());
    expect(meta.coordinates).not.toBeNull();
    // 37°48'30" N -> 37.808333, 122°16'15" W -> -122.270833
    expect(meta.coordinates.lat).toBeCloseTo(37.8083, 3);
    expect(meta.coordinates.lng).toBeCloseTo(-122.2708, 3);
  });

  it('parses a little-endian ("II") TIFF stream identically to big-endian', () => {
    const be = parseMetadata(jpegWithExif({ little: false }));
    const le = parseMetadata(jpegWithExif({ little: true }));
    expect(le.fields.find((f) => f.name === 'Make').display).toBe('TestCam');
    expect(le.fields.find((f) => f.name === 'Model').display).toBe('M1');
    // Coordinates must come out the same regardless of byte order.
    expect(le.coordinates.lat).toBeCloseTo(be.coordinates.lat, 6);
    expect(le.coordinates.lng).toBeCloseTo(be.coordinates.lng, 6);
  });

  it('flags location and identity fields as sensitive', () => {
    const meta = parseMetadata(jpegWithExif());
    const lat = meta.fields.find((f) => f.name === 'GPSLatitude');
    expect(lat.sensitive).toBe(true);
    expect(meta.sensitiveCount).toBeGreaterThan(0);
  });

  it('returns no metadata for a bare JPEG', () => {
    const meta = parseMetadata(jpegBare());
    expect(meta.isJpeg).toBe(true);
    expect(meta.hasMetadata).toBe(false);
    expect(meta.coordinates).toBeNull();
  });

  it('reports non-JPEG input without throwing', () => {
    const meta = parseMetadata(notJpeg());
    expect(meta.isJpeg).toBe(false);
    expect(meta.fields).toEqual([]);
  });

  it('surfaces an XMP-only JPEG as flagged metadata, not "clean"', () => {
    const meta = parseMetadata(jpegWithXmp());
    expect(meta.hasMetadata).toBe(true);
    const xmp = meta.fields.find((f) => f.ifd === 'XMP');
    expect(xmp).toBeTruthy();
    expect(xmp.sensitive).toBe(true);
    expect(xmp.display).toMatch(/bytes/);
    expect(meta.sensitiveCount).toBeGreaterThan(0);
  });

  it('surfaces an IPTC-only JPEG as flagged metadata', () => {
    const meta = parseMetadata(jpegWithIptc());
    expect(meta.hasMetadata).toBe(true);
    expect(meta.fields.find((f) => f.ifd === 'IPTC')).toBeTruthy();
  });

  it('does not throw on a truncated JPEG and reports no coordinates', () => {
    let meta;
    expect(() => {
      meta = parseMetadata(jpegTruncated());
    }).not.toThrow();
    expect(meta.isJpeg).toBe(true);
    expect(meta.coordinates).toBeNull();
  });

  it('refuses a malformed sub-IFD pointer instead of following garbage', () => {
    const meta = parseMetadata(jpegBadSubIfdPointer());
    expect(meta.isJpeg).toBe(true);
    // Only the (well-formed) IFD0 pointer entry itself; no phantom sub-IFD fields.
    expect(meta.fields.every((f) => f.ifd === 'IFD0')).toBe(true);
    expect(meta.fields.some((f) => /^0x/.test(f.name))).toBe(false);
  });

  it('does not throw when an APP marker sits at the very end of the file', () => {
    let meta;
    expect(() => {
      meta = parseMetadata(jpegAppMarkerAtEof());
    }).not.toThrow();
    expect(meta.isJpeg).toBe(true);
    expect(meta.hasMetadata).toBe(false);
  });

  it('does not throw when EXIF is truncated before its TIFF header', () => {
    let meta;
    expect(() => {
      meta = parseMetadata(jpegExifNoTiff());
    }).not.toThrow();
    expect(meta.isJpeg).toBe(true);
    expect(meta.coordinates).toBeNull();
  });

  it('ignores a non-EXIF APP1 segment without surfacing bogus fields', () => {
    const meta = parseMetadata(jpegWithForeignApp1());
    expect(meta.isJpeg).toBe(true);
    expect(meta.hasMetadata).toBe(false);
  });
});

describe('formatValue', () => {
  it('renders a rational as fraction plus decimal', () => {
    expect(formatValue([1, 200])).toBe('1/200 (0.005)');
  });

  it('renders a whole-denominator rational as an integer', () => {
    expect(formatValue([37, 1])).toBe('37');
  });

  it('joins arrays of values', () => {
    expect(formatValue([1, 2, 3])).toContain(',');
  });
});
