// TIFF container reader: header, IFD walking, and typed value resolution.
//
// EXIF is a TIFF stream tucked inside a JPEG APP1 segment. Everything —
// camera settings, the GPS block — hangs off IFDs (Image File Directories)
// described by this format. All offsets are relative to the TIFF header start
// (`base`), which is why that anchor is threaded through every call.

import { Reader } from './reader.js';

// TIFF field type -> byte size of a single component.
const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8 };

/**
 * Parse the 8-byte TIFF header.
 * @returns {{ reader: Reader, base: number, firstIFD: number } | null}
 */
export function readTiffHeader(view, base) {
  const order = view.getUint16(base, false);
  let little;
  if (order === 0x4949) little = true; // "II"
  else if (order === 0x4d4d) little = false; // "MM"
  else return null;

  const reader = new Reader(view, little);
  if (reader.u16(base + 2) !== 0x002a) return null; // TIFF magic

  const firstIFD = reader.u32(base + 4);
  return { reader, base, firstIFD };
}

/** Total on-disk byte size of an entry's value. */
function valueSize(type, count) {
  return (TYPE_SIZE[type] || 0) * count;
}

/** Resolve a single IFD entry into a JS value. */
function readEntryValue(reader, base, type, count, valueOffset) {
  const size = valueSize(type, count);
  // Values <= 4 bytes are stored inline in the entry's value field; larger
  // ones are stored elsewhere and the field holds an offset (from `base`).
  const dataOffset = size <= 4 ? valueOffset : base + reader.u32(valueOffset);

  switch (type) {
    case 2: // ASCII
      return reader.ascii(dataOffset, count).replace(/\0+$/, '');
    case 1: // BYTE
    case 7: { // UNDEFINED
      const bytes = [];
      for (let i = 0; i < count; i++) bytes.push(reader.u8(dataOffset + i));
      return count === 1 ? bytes[0] : bytes;
    }
    case 3: { // SHORT
      const out = [];
      for (let i = 0; i < count; i++) out.push(reader.u16(dataOffset + i * 2));
      return count === 1 ? out[0] : out;
    }
    case 4: { // LONG
      const out = [];
      for (let i = 0; i < count; i++) out.push(reader.u32(dataOffset + i * 4));
      return count === 1 ? out[0] : out;
    }
    case 5: { // RATIONAL (unsigned num/den pairs)
      const out = [];
      for (let i = 0; i < count; i++) {
        const num = reader.u32(dataOffset + i * 8);
        const den = reader.u32(dataOffset + i * 8 + 4);
        out.push([num, den]);
      }
      return count === 1 ? out[0] : out;
    }
    case 9: { // SLONG
      const out = [];
      for (let i = 0; i < count; i++) out.push(reader.i32(dataOffset + i * 4));
      return count === 1 ? out[0] : out;
    }
    case 10: { // SRATIONAL
      const out = [];
      for (let i = 0; i < count; i++) {
        const num = reader.i32(dataOffset + i * 8);
        const den = reader.i32(dataOffset + i * 8 + 4);
        out.push([num, den]);
      }
      return count === 1 ? out[0] : out;
    }
    default:
      return null;
  }
}

/**
 * Read one IFD, returning a map of tag id -> { type, count, value }.
 * @param {Reader} reader
 * @param {number} base   TIFF header start (offset anchor)
 * @param {number} ifdOffset  absolute offset of the IFD in the view
 */
export function readIFD(reader, base, ifdOffset) {
  const entries = {};
  if (ifdOffset <= 0 || ifdOffset + 2 > reader.byteLength) return entries;

  const count = reader.u16(ifdOffset);
  for (let i = 0; i < count; i++) {
    const entryOffset = ifdOffset + 2 + i * 12;
    if (entryOffset + 12 > reader.byteLength) break;

    const tag = reader.u16(entryOffset);
    const type = reader.u16(entryOffset + 2);
    const cnt = reader.u32(entryOffset + 4);
    const valueOffset = entryOffset + 8;

    // Guard against malformed offsets pointing past the buffer.
    const size = valueSize(type, cnt);
    if (size > 4) {
      const ptr = base + reader.u32(valueOffset);
      if (ptr + size > reader.byteLength) continue;
    }

    entries[tag] = { type, count: cnt, value: readEntryValue(reader, base, type, cnt, valueOffset) };
  }
  return entries;
}
