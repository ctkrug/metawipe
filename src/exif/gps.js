// GPS coordinate math.
//
// EXIF stores latitude/longitude as three RATIONALs — degrees, minutes,
// seconds — plus a separate N/S/E/W reference tag. This converts that pair
// into a signed decimal degree suitable for a map pin or a URL.

/** A rational is a [numerator, denominator] pair; 0-denominator -> 0. */
function ratio(r) {
  if (!Array.isArray(r)) return Number(r) || 0;
  const [num, den] = r;
  return den ? num / den : 0;
}

/**
 * Convert an EXIF DMS array + hemisphere ref into a signed decimal degree.
 * @param {Array} dms   [degrees, minutes, seconds] as rationals
 * @param {string} ref  'N' | 'S' | 'E' | 'W'
 * @returns {number|null}
 */
export function dmsToDecimal(dms, ref) {
  if (!Array.isArray(dms) || dms.length < 3) return null;
  const deg = ratio(dms[0]);
  const min = ratio(dms[1]);
  const sec = ratio(dms[2]);
  let dd = deg + min / 60 + sec / 3600;
  if (ref === 'S' || ref === 'W') dd = -dd;
  return dd;
}

/**
 * Pull a { lat, lng, altitude } fix out of a parsed GPS IFD field map.
 * Returns null when the block has no usable coordinate.
 */
export function extractCoordinates(gps) {
  if (!gps) return null;
  const lat = dmsToDecimal(gps.GPSLatitude, gps.GPSLatitudeRef);
  const lng = dmsToDecimal(gps.GPSLongitude, gps.GPSLongitudeRef);
  if (lat === null || lng === null) return null;

  let altitude = null;
  if (gps.GPSAltitude != null) {
    altitude = ratio(gps.GPSAltitude);
    if (gps.GPSAltitudeRef === 1) altitude = -altitude; // 1 = below sea level
  }
  return { lat, lng, altitude };
}

/** Round to a fixed precision for display without dragging in a formatter. */
export function formatCoord(value, digits = 6) {
  if (value == null) return '';
  return Number(value).toFixed(digits);
}
