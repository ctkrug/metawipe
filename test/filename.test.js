import { describe, it, expect } from 'vitest';
import { cleanFilename } from '../src/util/filename.js';

describe('cleanFilename', () => {
  it('inserts -clean before a lowercase .jpg extension', () => {
    expect(cleanFilename('photo.jpg')).toBe('photo-clean.jpg');
  });

  it('preserves original case and the .jpeg extension', () => {
    expect(cleanFilename('IMG_1234.JPEG')).toBe('IMG_1234-clean.JPEG');
  });

  it('keeps dots inside the base name', () => {
    expect(cleanFilename('my.vacation.jpg')).toBe('my.vacation-clean.jpg');
  });

  it('appends a jpg extension when the name has none', () => {
    expect(cleanFilename('snapshot')).toBe('snapshot-clean.jpg');
  });

  it('falls back to a default for empty or blank input', () => {
    expect(cleanFilename('')).toBe('photo-clean.jpg');
    expect(cleanFilename('   ')).toBe('photo-clean.jpg');
  });
});
