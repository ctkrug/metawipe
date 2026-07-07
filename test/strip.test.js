import { describe, it, expect } from 'vitest';
import { stripMetadata } from '../src/exif/strip.js';
import { parseMetadata } from '../src/exif/parse.js';
import { walkSegments, isJpeg } from '../src/exif/jpeg.js';
import {
  jpegWithExif,
  jpegBare,
  notJpeg,
  jpegWithXmp,
  jpegWithIptc,
} from './fixtures.js';

describe('stripMetadata', () => {
  it('removes the EXIF segment and leaves a valid, metadata-free JPEG', () => {
    const original = jpegWithExif();
    expect(parseMetadata(original).hasMetadata).toBe(true);

    const { buffer, removed, bytesSaved } = stripMetadata(original);
    expect(removed).toBe(1);
    expect(bytesSaved).toBeGreaterThan(0);

    const cleanView = new DataView(buffer);
    expect(isJpeg(cleanView)).toBe(true);
    expect(walkSegments(cleanView).some((s) => s.kind === 'exif')).toBe(false);
    expect(parseMetadata(buffer).hasMetadata).toBe(false);
  });

  it('preserves the compressed image data byte-for-byte', () => {
    const original = jpegWithExif();
    const { buffer } = stripMetadata(original);

    // The scan payload (0x11 0x22 0x33) and EOI must survive intact.
    const bytes = new Uint8Array(buffer);
    const tail = Array.from(bytes.slice(bytes.length - 5));
    expect(tail).toEqual([0x11, 0x22, 0x33, 0xff, 0xd9]);
  });

  it('is a no-op on a JPEG that carries no metadata', () => {
    const { removed, bytesSaved } = stripMetadata(jpegBare());
    expect(removed).toBe(0);
    expect(bytesSaved).toBe(0);
  });

  it('returns the input unchanged for non-JPEG bytes', () => {
    const input = notJpeg();
    const { buffer, removed } = stripMetadata(input);
    expect(removed).toBe(0);
    expect(buffer).toBe(input);
  });

  it.each([
    ['XMP', jpegWithXmp],
    ['IPTC', jpegWithIptc],
  ])('removes the %s block and re-parses to clean', (_kind, build) => {
    const original = build();
    expect(parseMetadata(original).hasMetadata).toBe(true);

    const { buffer, removed } = stripMetadata(original);
    expect(removed).toBe(1);
    expect(parseMetadata(buffer).hasMetadata).toBe(false);
  });

  it('everything parse reports as metadata is what strip removes', () => {
    // Parse↔strip consistency: after wiping, the field count must be zero.
    const original = jpegWithExif();
    const { buffer } = stripMetadata(original);
    expect(parseMetadata(buffer).fields.length).toBe(0);
  });
});
