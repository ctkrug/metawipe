// Synthetic JPEG builders for the test suite.
//
// Rather than commit binary photo fixtures, we construct minimal but spec-valid
// JPEGs in code: a real TIFF/EXIF stream (big-endian) with IFD0, an EXIF
// sub-IFD, and a GPS sub-IFD, wrapped in an APP1 segment between SOI and a
// tiny scan. This exercises the parser and stripper against bytes it would see
// in the wild while keeping the repo asset-free.

// --- tiny endian writers -------------------------------------------------
//
// JPEG structural fields (segment lengths, markers) are ALWAYS big-endian, so
// the module-level u16/u32 stay big-endian. TIFF-internal fields follow the
// stream's byte-order mark, so buildExifTiff selects a writer set per `little`.

function u16(n) {
  return [(n >> 8) & 0xff, n & 0xff];
}
function u32(n) {
  return [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}
function le16(n) {
  return [n & 0xff, (n >> 8) & 0xff];
}
function le32(n) {
  return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];
}
function ascii(str) {
  return Array.from(str).map((c) => c.charCodeAt(0));
}

// --- TIFF/EXIF construction ---------------------------------------------

/**
 * Build a TIFF (EXIF) byte array with camera + GPS fields.
 * Offsets are computed relative to the TIFF header start (base 0).
 * @param {boolean} little  emit a little-endian ("II") stream when true.
 */
function buildExifTiff(little = false) {
  const w16 = little ? le16 : u16;
  const w32 = little ? le32 : u32;
  // A rational is two u32s in the stream's byte order.
  const rational = (num, den) => [...w32(num), ...w32(den)];
  const bom = little ? ascii('II') : ascii('MM');
  // We assemble three IFDs and a shared data pool, then patch pointer offsets.
  const header = [...bom, ...w16(0x002a), ...w32(8)]; // -> IFD0 at 8

  // Data pool holds >4-byte values (strings, rationals). We reserve space for
  // it after all three IFDs and record each blob's absolute offset.
  const pool = [];
  let poolBase = 0; // filled in once IFD sizes are known
  const blobs = [];
  const reserve = (bytes) => {
    const marker = { offset: 0, bytes };
    blobs.push(marker);
    return marker;
  };

  const makeBlob = reserve(ascii('TestCam\0')); // 8 bytes
  const gpsLatBlob = reserve([...rational(37, 1), ...rational(48, 1), ...rational(30, 1)]); // 37°48'30"
  const gpsLngBlob = reserve([...rational(122, 1), ...rational(16, 1), ...rational(15, 1)]); // 122°16'15"

  // IFD0: Make(ptr), Model(inline), ExifPointer, GPSPointer  -> 4 entries
  const ifd0Entries = 4;
  const ifd0Size = 2 + ifd0Entries * 12 + 4;
  const ifd0Start = 8;

  // EXIF IFD: DateTimeOriginal(inline-ish ascii), FNumber not needed; keep 1 entry
  const exifEntries = 1;
  const exifSize = 2 + exifEntries * 12 + 4;
  const exifStart = ifd0Start + ifd0Size;

  // GPS IFD: LatRef, Lat, LngRef, Lng -> 4 entries
  const gpsEntries = 4;
  const gpsSize = 2 + gpsEntries * 12 + 4;
  const gpsStart = exifStart + exifSize;

  poolBase = gpsStart + gpsSize;
  let cursor = poolBase;
  for (const b of blobs) {
    b.offset = cursor;
    cursor += b.bytes.length;
  }

  // Helper to emit a 12-byte IFD entry.
  const entry = (tag, type, count, valueBytes) => {
    const v = valueBytes.slice(0, 4);
    while (v.length < 4) v.push(0);
    return [...w16(tag), ...w16(type), ...w32(count), ...v];
  };

  // --- IFD0 ---
  const ifd0 = [
    ...w16(ifd0Entries),
    ...entry(0x010f, 2, makeBlob.bytes.length, w32(makeBlob.offset)), // Make -> ptr
    ...entry(0x0110, 2, 3, ascii('M1\0')), // Model inline
    ...entry(0x8769, 4, 1, w32(exifStart)), // ExifIFDPointer
    ...entry(0x8825, 4, 1, w32(gpsStart)), // GPSInfoIFDPointer
    ...w32(0), // next IFD
  ];

  // --- EXIF IFD ---
  const exif = [
    ...w16(exifEntries),
    ...entry(0x9003, 2, 4, ascii('X\0\0\0')), // DateTimeOriginal (short inline stub)
    ...w32(0),
  ];

  // --- GPS IFD ---
  const gps = [
    ...w16(gpsEntries),
    ...entry(0x0001, 2, 2, ascii('N\0')), // GPSLatitudeRef
    ...entry(0x0002, 5, 3, w32(gpsLatBlob.offset)), // GPSLatitude -> ptr
    ...entry(0x0003, 2, 2, ascii('W\0')), // GPSLongitudeRef
    ...entry(0x0004, 5, 3, w32(gpsLngBlob.offset)), // GPSLongitude -> ptr
    ...w32(0),
  ];

  for (const b of blobs) pool.push(...b.bytes);

  return [...header, ...ifd0, ...exif, ...gps, ...pool];
}

/**
 * A full JPEG (SOI + APP1/EXIF + a 1-segment scan + EOI) as an ArrayBuffer.
 * @param {{ little?: boolean }} [opts]  build a little-endian ("II") TIFF stream.
 */
export function jpegWithExif({ little = false } = {}) {
  const tiff = buildExifTiff(little);
  const payload = [...ascii('Exif\0\0'), ...tiff];
  const segLen = payload.length + 2; // + the 2 length bytes

  const bytes = [
    ...u16(0xffd8), // SOI
    0xff, 0xe1, ...u16(segLen), ...payload, // APP1 EXIF
    0xff, 0xda, ...u16(4), 0x00, 0x00, // SOS with tiny (empty) payload
    0x11, 0x22, 0x33, // pretend compressed data
    ...u16(0xffd9), // EOI
  ];
  return new Uint8Array(bytes).buffer;
}

/** Wrap a payload (with its own signature) in an APPn segment. */
function appSegment(marker, payload) {
  const segLen = payload.length + 2;
  return [0xff, marker, ...u16(segLen), ...payload];
}

/** A JPEG whose only metadata is an XMP packet (APP1, Adobe signature). */
export function jpegWithXmp() {
  const xmp = ascii(
    'http://ns.adobe.com/xap/1.0/\0<x:xmpmeta><rdf:Description ' +
      'photoshop:City="Portland"/></x:xmpmeta>',
  );
  const bytes = [
    ...u16(0xffd8),
    ...appSegment(0xe1, xmp),
    0xff, 0xda, ...u16(4), 0x00, 0x00,
    0x11, 0x22, 0x33,
    ...u16(0xffd9),
  ];
  return new Uint8Array(bytes).buffer;
}

/** A JPEG whose only metadata is an IPTC block (APP13, Photoshop signature). */
export function jpegWithIptc() {
  const iptc = ascii('Photoshop 3.0\x008BIM\x04\x04creator: J. Doe');
  const bytes = [
    ...u16(0xffd8),
    ...appSegment(0xed, iptc),
    0xff, 0xda, ...u16(4), 0x00, 0x00,
    0x11, 0x22, 0x33,
    ...u16(0xffd9),
  ];
  return new Uint8Array(bytes).buffer;
}

/**
 * A JPEG truncated mid-EXIF-segment: the APP1 length says the segment runs
 * past the end of the file. A robust walker must not read out of bounds.
 */
export function jpegTruncated() {
  const full = new Uint8Array(jpegWithExif());
  // Keep SOI + the APP1 header/length but drop the tail of the buffer.
  return full.slice(0, full.length - 20).buffer;
}

/** A non-EXIF APP1 segment (unknown signature) followed by a normal scan. */
export function jpegWithForeignApp1() {
  const junk = ascii('SomethingElse\0not exif at all');
  const bytes = [
    ...u16(0xffd8),
    ...appSegment(0xe1, junk),
    0xff, 0xda, ...u16(4), 0x00, 0x00,
    0x11, 0x22, 0x33,
    ...u16(0xffd9),
  ];
  return new Uint8Array(bytes).buffer;
}

/** A JPEG with no metadata segments at all. */
export function jpegBare() {
  const bytes = [
    ...u16(0xffd8),
    0xff, 0xda, ...u16(4), 0x00, 0x00,
    0x11, 0x22, 0x33,
    ...u16(0xffd9),
  ];
  return new Uint8Array(bytes).buffer;
}

/** Non-JPEG bytes (a fake PNG header). */
export function notJpeg() {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer;
}

/**
 * A JPEG whose EXIF IFD0 declares an ExifIFDPointer with count 2 — a malformed
 * pointer (a real sub-IFD pointer is a single LONG). Following it as an offset
 * would read a garbage location; the parser should refuse and surface nothing.
 */
export function jpegBadSubIfdPointer() {
  const tiff = [
    ...ascii('MM'), ...u16(0x002a), ...u32(8), // big-endian, IFD0 at 8
    ...u16(1), // one entry
    ...u16(0x8769), ...u16(4), ...u32(2), ...u32(8), // ExifIFDPointer, count=2 (bad)
    ...u32(0), // next IFD
  ];
  const payload = [...ascii('Exif\0\0'), ...tiff];
  const bytes = [
    ...u16(0xffd8),
    0xff, 0xe1, ...u16(payload.length + 2), ...payload,
    0xff, 0xda, ...u16(4), 0x00, 0x00, 0x11, 0x22, 0x33,
    ...u16(0xffd9),
  ];
  return new Uint8Array(bytes).buffer;
}

/**
 * A JPEG whose APP1 segment header (marker + length) sits right at the end of
 * the buffer, with no room for the signature bytes the walker tries to match.
 * A naive matcher reads past the buffer end and throws.
 */
export function jpegAppMarkerAtEof() {
  // SOI, then APP1 marker with a declared length but the file ends immediately.
  const bytes = [...u16(0xffd8), 0xff, 0xe1, ...u16(0x0040)];
  return new Uint8Array(bytes).buffer;
}

/**
 * A JPEG carrying a valid "Exif\0\0" signature but truncated before the TIFF
 * header that must follow it — the EXIF parser must not read past the end.
 */
export function jpegExifNoTiff() {
  const payload = ascii('Exif\0\0'); // signature, then nothing
  const segLen = payload.length + 2;
  const bytes = [...u16(0xffd8), 0xff, 0xe1, ...u16(segLen), ...payload];
  return new Uint8Array(bytes).buffer;
}
