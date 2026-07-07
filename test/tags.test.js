import { describe, it, expect } from 'vitest';
import { tagName, TIFF_TAGS, GPS_TAGS, SENSITIVE_TAGS } from '../src/exif/tags.js';

describe('tagName', () => {
  it('resolves a known id to its human name', () => {
    expect(tagName(TIFF_TAGS, 0x010f)).toBe('Make');
    expect(tagName(GPS_TAGS, 0x0002)).toBe('GPSLatitude');
  });

  it('falls back to a zero-padded hex id for an unknown tag', () => {
    expect(tagName(TIFF_TAGS, 0x1234)).toBe('0x1234');
    expect(tagName(TIFF_TAGS, 0x0007)).toBe('0x0007'); // padded to four digits
  });
});

describe('SENSITIVE_TAGS', () => {
  it('flags location and identity fields, not benign camera settings', () => {
    expect(SENSITIVE_TAGS.has('GPSLatitude')).toBe(true);
    expect(SENSITIVE_TAGS.has('BodySerialNumber')).toBe(true);
    expect(SENSITIVE_TAGS.has('DateTimeOriginal')).toBe(true);
    expect(SENSITIVE_TAGS.has('FNumber')).toBe(false);
    expect(SENSITIVE_TAGS.has('Orientation')).toBe(false);
  });
});
