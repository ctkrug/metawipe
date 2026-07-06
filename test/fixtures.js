// Synthetic JPEG builders for the test suite.
//
// Rather than commit binary photo fixtures, we construct minimal but spec-valid
// JPEGs in code: a real TIFF/EXIF stream (big-endian) with IFD0, an EXIF
// sub-IFD, and a GPS sub-IFD, wrapped in an APP1 segment between SOI and a
// tiny scan. This exercises the parser and stripper against bytes it would see
// in the wild while keeping the repo asset-free.

// --- tiny endian writers -------------------------------------------------

function u16(n) {
  return [(n >> 8) & 0xff, n & 0xff];
}
function u32(n) {
  return [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}
function ascii(str) {
  return Array.from(str).map((c) => c.charCodeAt(0));
}

// A rational as two u32s (big-endian).
function rational(num, den) {
  return [...u32(num), ...u32(den)];
}

// --- TIFF/EXIF construction ---------------------------------------------

/**
 * Build a TIFF (EXIF) byte array with camera + GPS fields.
 * Offsets are computed relative to the TIFF header start (base 0).
 */
function buildExifTiff() {
  // We assemble three IFDs and a shared data pool, then patch pointer offsets.
  const header = [...ascii('MM'), ...u16(0x002a), ...u32(8)]; // -> IFD0 at 8

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
    return [...u16(tag), ...u16(type), ...u32(count), ...v];
  };

  // --- IFD0 ---
  const ifd0 = [
    ...u16(ifd0Entries),
    ...entry(0x010f, 2, makeBlob.bytes.length, u32(makeBlob.offset)), // Make -> ptr
    ...entry(0x0110, 2, 3, ascii('M1\0')), // Model inline
    ...entry(0x8769, 4, 1, u32(exifStart)), // ExifIFDPointer
    ...entry(0x8825, 4, 1, u32(gpsStart)), // GPSInfoIFDPointer
    ...u32(0), // next IFD
  ];

  // --- EXIF IFD ---
  const exif = [
    ...u16(exifEntries),
    ...entry(0x9003, 2, 4, ascii('X\0\0\0')), // DateTimeOriginal (short inline stub)
    ...u32(0),
  ];

  // --- GPS IFD ---
  const gps = [
    ...u16(gpsEntries),
    ...entry(0x0001, 2, 2, ascii('N\0')), // GPSLatitudeRef
    ...entry(0x0002, 5, 3, u32(gpsLatBlob.offset)), // GPSLatitude -> ptr
    ...entry(0x0003, 2, 2, ascii('W\0')), // GPSLongitudeRef
    ...entry(0x0004, 5, 3, u32(gpsLngBlob.offset)), // GPSLongitude -> ptr
    ...u32(0),
  ];

  for (const b of blobs) pool.push(...b.bytes);

  return [...header, ...ifd0, ...exif, ...gps, ...pool];
}

/** A full JPEG (SOI + APP1/EXIF + a 1-segment scan + EOI) as an ArrayBuffer. */
export function jpegWithExif() {
  const tiff = buildExifTiff();
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
