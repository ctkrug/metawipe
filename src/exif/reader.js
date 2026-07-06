// Endian-aware binary reader over a DataView slice.
//
// TIFF (and therefore EXIF) can be stored little- or big-endian depending on
// the byte-order mark in its header, so every multi-byte read routes through
// here with an explicit `little` flag rather than assuming a platform default.

export class Reader {
  /**
   * @param {DataView} view
   * @param {boolean} little  true = little-endian ("II"), false = big-endian ("MM")
   */
  constructor(view, little = false) {
    this.view = view;
    this.little = little;
  }

  u8(offset) {
    return this.view.getUint8(offset);
  }

  u16(offset) {
    return this.view.getUint16(offset, this.little);
  }

  u32(offset) {
    return this.view.getUint32(offset, this.little);
  }

  i32(offset) {
    return this.view.getInt32(offset, this.little);
  }

  /** ASCII string of `length` bytes, stopping at the first NUL. */
  ascii(offset, length) {
    let out = '';
    for (let i = 0; i < length; i++) {
      const c = this.view.getUint8(offset + i);
      if (c === 0) break;
      out += String.fromCharCode(c);
    }
    return out;
  }

  get byteLength() {
    return this.view.byteLength;
  }
}
