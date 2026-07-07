import { describe, it, expect } from 'vitest';
import { dmsToDecimal, extractCoordinates, formatCoord } from '../src/exif/gps.js';

describe('dmsToDecimal', () => {
  it('converts a northern/eastern fix to a positive degree', () => {
    const dd = dmsToDecimal([[40, 1], [26, 1], [46, 1]], 'N');
    expect(dd).toBeCloseTo(40.4461, 3);
  });

  it('negates southern and western hemispheres', () => {
    expect(dmsToDecimal([[33, 1], [52, 1], [0, 1]], 'S')).toBeLessThan(0);
    expect(dmsToDecimal([[122, 1], [0, 1], [0, 1]], 'W')).toBeCloseTo(-122, 5);
  });

  it('handles rational minutes and seconds with denominators', () => {
    const dd = dmsToDecimal([[51, 1], [30, 1], [2999, 100]], 'N');
    expect(dd).toBeCloseTo(51.5083, 3);
  });

  it('returns null for a malformed DMS array', () => {
    expect(dmsToDecimal([[1, 1]], 'N')).toBeNull();
    expect(dmsToDecimal(null, 'N')).toBeNull();
  });

  it('treats a zero-denominator rational as zero instead of NaN', () => {
    // A [n, 0] rational would divide by zero; ratio() must coerce it to 0.
    const dd = dmsToDecimal([[10, 1], [30, 0], [0, 1]], 'N');
    expect(dd).toBe(10);
  });

  it('accepts bare numbers as degree/minute/second components', () => {
    expect(dmsToDecimal([1, 30, 0], 'N')).toBeCloseTo(1.5, 6);
  });
});

describe('extractCoordinates', () => {
  it('pulls lat/lng/altitude from a named GPS map', () => {
    const fix = extractCoordinates({
      GPSLatitude: [[10, 1], [0, 1], [0, 1]],
      GPSLatitudeRef: 'N',
      GPSLongitude: [[20, 1], [0, 1], [0, 1]],
      GPSLongitudeRef: 'E',
      GPSAltitude: [100, 1],
      GPSAltitudeRef: 0,
    });
    expect(fix.lat).toBeCloseTo(10, 5);
    expect(fix.lng).toBeCloseTo(20, 5);
    expect(fix.altitude).toBeCloseTo(100, 5);
  });

  it('treats altitude ref 1 as below sea level', () => {
    const fix = extractCoordinates({
      GPSLatitude: [[1, 1], [0, 1], [0, 1]],
      GPSLatitudeRef: 'N',
      GPSLongitude: [[1, 1], [0, 1], [0, 1]],
      GPSLongitudeRef: 'E',
      GPSAltitude: [5, 1],
      GPSAltitudeRef: 1,
    });
    expect(fix.altitude).toBe(-5);
  });

  it('returns null when no coordinate is present', () => {
    expect(extractCoordinates({})).toBeNull();
    expect(extractCoordinates(null)).toBeNull();
  });
});

describe('formatCoord', () => {
  it('fixes to six decimals by default', () => {
    expect(formatCoord(37.80833333)).toBe('37.808333');
  });

  it('returns an empty string for a null value', () => {
    expect(formatCoord(null)).toBe('');
    expect(formatCoord(undefined)).toBe('');
  });
});
