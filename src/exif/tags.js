// Human-readable names for the TIFF/EXIF/GPS tags Metawipe surfaces.
//
// This is intentionally a curated set, not the full ~250-tag spec: it covers
// the fields that actually matter for privacy (who/where/when/which device)
// plus the common descriptive ones. Unknown tags still render, keyed by their
// numeric id, so nothing a photo carries is silently hidden.

// Baseline TIFF + EXIF-in-IFD0 tags.
export const TIFF_TAGS = {
  0x010f: 'Make',
  0x0110: 'Model',
  0x0112: 'Orientation',
  0x011a: 'XResolution',
  0x011b: 'YResolution',
  0x0128: 'ResolutionUnit',
  0x0131: 'Software',
  0x0132: 'DateTime',
  0x013b: 'Artist',
  0x8298: 'Copyright',
  0x8769: 'ExifIFDPointer',
  0x8825: 'GPSInfoIFDPointer',
};

// EXIF sub-IFD tags — the camera-settings and identity block.
export const EXIF_TAGS = {
  0x829a: 'ExposureTime',
  0x829d: 'FNumber',
  0x8827: 'ISOSpeedRatings',
  0x9003: 'DateTimeOriginal',
  0x9004: 'DateTimeDigitized',
  0x920a: 'FocalLength',
  0xa002: 'PixelXDimension',
  0xa003: 'PixelYDimension',
  0xa430: 'CameraOwnerName',
  0xa431: 'BodySerialNumber',
  0xa432: 'LensSpecification',
  0xa433: 'LensMake',
  0xa434: 'LensModel',
  0xa435: 'LensSerialNumber',
};

// GPS sub-IFD tags — the location block.
export const GPS_TAGS = {
  0x0000: 'GPSVersionID',
  0x0001: 'GPSLatitudeRef',
  0x0002: 'GPSLatitude',
  0x0003: 'GPSLongitudeRef',
  0x0004: 'GPSLongitude',
  0x0005: 'GPSAltitudeRef',
  0x0006: 'GPSAltitude',
  0x0007: 'GPSTimeStamp',
  0x0012: 'GPSMapDatum',
  0x001d: 'GPSDateStamp',
};

// Fields that expose personal identity or precise location. The UI flags these
// so a user sees the actual privacy risk, not just an undifferentiated dump.
export const SENSITIVE_TAGS = new Set([
  'GPSLatitude',
  'GPSLongitude',
  'GPSAltitude',
  'GPSTimeStamp',
  'GPSDateStamp',
  'GPSMapDatum',
  'Artist',
  'Copyright',
  'CameraOwnerName',
  'BodySerialNumber',
  'LensSerialNumber',
  'DateTimeOriginal',
  'DateTimeDigitized',
  'DateTime',
]);

/** Look up a tag name for a given IFD context, falling back to a hex id. */
export function tagName(dict, id) {
  return dict[id] || `0x${id.toString(16).padStart(4, '0')}`;
}
