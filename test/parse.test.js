import { describe, it, expect } from 'vitest';
import { parseMetadata, formatValue } from '../src/exif/parse.js';
import { jpegWithExif, jpegBare, notJpeg } from './fixtures.js';

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
