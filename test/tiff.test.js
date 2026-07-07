import { describe, it, expect } from 'vitest';
import { readTiffHeader, readIFD } from '../src/exif/tiff.js';

// --- big-endian TIFF builder -------------------------------------------------
//
// readIFD's typed-value resolution is the parser's core; the JPEG fixtures only
// exercise ASCII + RATIONAL, so we build a synthetic TIFF here that hits every
// field type and both storage modes (inline <=4 bytes, out-of-line pointer).

const be16 = (n) => [(n >> 8) & 0xff, n & 0xff];
const be32 = (n) => [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];

/**
 * @param {Array<{tag,type,count, inline?:number[], pool?:number[], rawOffset?:number}>} specs
 */
function buildTiff(specs) {
  const n = specs.length;
  const ifdStart = 8;
  const ifdSize = 2 + n * 12 + 4;
  let poolCursor = ifdStart + ifdSize;

  const header = [...[0x4d, 0x4d], ...be16(0x002a), ...be32(ifdStart)]; // "MM"
  const pool = [];
  const entries = [];
  for (const s of specs) {
    let valueField;
    if (s.rawOffset != null) {
      valueField = be32(s.rawOffset); // deliberately bogus pointer
    } else if (s.pool) {
      valueField = be32(poolCursor);
      pool.push(...s.pool);
      poolCursor += s.pool.length;
    } else {
      valueField = s.inline.slice(0, 4);
      while (valueField.length < 4) valueField.push(0);
    }
    entries.push(...be16(s.tag), ...be16(s.type), ...be32(s.count), ...valueField);
  }

  const bytes = [...header, ...be16(n), ...entries, ...be32(0), ...pool];
  return new Uint8Array(bytes).buffer;
}

describe('readTiffHeader', () => {
  it('rejects a bad byte-order mark', () => {
    const view = new DataView(new Uint8Array([0x00, 0x00, 0x00, 0x00, 0, 0, 0, 8]).buffer);
    expect(readTiffHeader(view, 0)).toBeNull();
  });

  it('rejects a valid order mark but wrong magic number', () => {
    const view = new DataView(new Uint8Array([0x4d, 0x4d, 0x00, 0x2b, 0, 0, 0, 8]).buffer);
    expect(readTiffHeader(view, 0)).toBeNull();
  });
});

describe('readIFD typed value resolution', () => {
  const buffer = buildTiff([
    { tag: 0x1000, type: 1, count: 1, inline: [0x2a, 0, 0, 0] }, // BYTE -> 42
    { tag: 0x1001, type: 7, count: 3, inline: [0x01, 0x02, 0x03, 0] }, // UNDEFINED -> [1,2,3]
    { tag: 0x1002, type: 3, count: 2, inline: [0x00, 0x05, 0x00, 0x09] }, // SHORT[2] -> [5,9]
    { tag: 0x1003, type: 4, count: 1, inline: be32(100000) }, // LONG -> 100000
    { tag: 0x1004, type: 9, count: 1, inline: be32(-2 >>> 0) }, // SLONG -> -2
    { tag: 0x1005, type: 5, count: 1, pool: [...be32(1), ...be32(4)] }, // RATIONAL -> [1,4]
    { tag: 0x1006, type: 10, count: 1, pool: [...be32(-1 >>> 0), ...be32(2)] }, // SRATIONAL -> [-1,2]
    { tag: 0x1007, type: 2, count: 6, pool: [0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00] }, // ASCII "Hello"
    { tag: 0x1008, type: 4, count: 2, pool: [...be32(10), ...be32(20)] }, // LONG[2] -> [10,20]
    { tag: 0x1009, type: 3, count: 3, pool: [...be16(1), ...be16(2), ...be16(3)] }, // SHORT[3]
    { tag: 0x100a, type: 99, count: 1, inline: [0, 0, 0, 0] }, // unknown type -> null
    { tag: 0x100b, type: 5, count: 1, rawOffset: 0xfffffff0 }, // bogus pointer -> skipped
  ]);
  const { reader, base, firstIFD } = readTiffHeader(new DataView(buffer), 0);
  const ifd = readIFD(reader, base, base + firstIFD);

  it('reads a single BYTE as a scalar', () => expect(ifd[0x1000].value).toBe(42));
  it('reads UNDEFINED as a byte array', () => expect(ifd[0x1001].value).toEqual([1, 2, 3]));
  it('reads a SHORT array inline', () => expect(ifd[0x1002].value).toEqual([5, 9]));
  it('reads a scalar LONG', () => expect(ifd[0x1003].value).toBe(100000));
  it('reads a signed SLONG', () => expect(ifd[0x1004].value).toBe(-2));
  it('reads an unsigned RATIONAL pair', () => expect(ifd[0x1005].value).toEqual([1, 4]));
  it('reads a signed SRATIONAL pair', () => expect(ifd[0x1006].value).toEqual([-1, 2]));
  it('reads an out-of-line ASCII string', () => expect(ifd[0x1007].value).toBe('Hello'));
  it('reads an out-of-line LONG array', () => expect(ifd[0x1008].value).toEqual([10, 20]));
  it('reads an out-of-line SHORT array', () => expect(ifd[0x1009].value).toEqual([1, 2, 3]));
  it('resolves an unknown field type to null', () => expect(ifd[0x100a].value).toBeNull());
  it('skips an entry whose pointer runs past the buffer', () =>
    expect(ifd[0x100b]).toBeUndefined());

  it('returns an empty map for an out-of-range IFD offset', () => {
    expect(readIFD(reader, base, base + 999999)).toEqual({});
    expect(readIFD(reader, base, 0)).toEqual({});
  });
});
