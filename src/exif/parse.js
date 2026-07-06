// Top-level metadata parse: bytes in, a flat list of labelled fields out.
//
// Orchestrates the pieces — walk JPEG segments, read the TIFF/EXIF/GPS IFDs,
// name the tags, flag the sensitive ones, and pull a coordinate fix if one is
// present. The UI consumes the returned shape directly; nothing here touches
// the DOM so it is all unit-testable against raw ArrayBuffers.

import { walkSegments, isJpeg } from './jpeg.js';
import { readTiffHeader, readIFD } from './tiff.js';
import { TIFF_TAGS, EXIF_TAGS, GPS_TAGS, SENSITIVE_TAGS, tagName } from './tags.js';
import { extractCoordinates } from './gps.js';

/** Render a stored value into a compact human string. */
export function formatValue(value) {
  if (value == null) return '';
  if (Array.isArray(value)) {
    // A rational is a [num, den] pair.
    if (value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'number'
        && Number.isInteger(value[0]) && Number.isInteger(value[1]) && value[1] !== 0
        && !Array.isArray(value[0])) {
      const dec = value[0] / value[1];
      return value[1] === 1 ? String(value[0]) : `${value[0]}/${value[1]} (${+dec.toFixed(4)})`;
    }
    return value.map(formatValue).join(', ');
  }
  return String(value);
}

/** Turn a raw IFD map into named { tag, name, value, display } entries. */
function nameEntries(ifd, dict) {
  const named = {};
  const list = [];
  for (const [id, entry] of Object.entries(ifd)) {
    const name = tagName(dict, Number(id));
    named[name] = entry.value;
    list.push({
      tag: Number(id),
      name,
      value: entry.value,
      display: formatValue(entry.value),
      sensitive: SENSITIVE_TAGS.has(name),
    });
  }
  return { named, list };
}

/**
 * Parse metadata from an image ArrayBuffer.
 * @param {ArrayBuffer} buffer
 * @returns {{
 *   isJpeg: boolean,
 *   fields: Array<{ ifd: string, name: string, display: string, sensitive: boolean }>,
 *   coordinates: { lat: number, lng: number, altitude: number|null } | null,
 *   hasMetadata: boolean,
 *   sensitiveCount: number
 * }}
 */
export function parseMetadata(buffer) {
  const view = new DataView(buffer);
  const result = { isJpeg: isJpeg(view), fields: [], coordinates: null, hasMetadata: false, sensitiveCount: 0 };
  if (!result.isJpeg) return result;

  const exifSeg = walkSegments(view).find((s) => s.kind === 'exif');
  if (!exifSeg) return result;

  // EXIF payload = "Exif\0\0" (6 bytes) then the TIFF stream.
  const tiffBase = exifSeg.headerEnd + 6;
  const header = readTiffHeader(view, tiffBase);
  if (!header) return result;

  const { reader, base, firstIFD } = header;
  const ifd0 = readIFD(reader, base, base + firstIFD);
  const ifd0Named = nameEntries(ifd0, TIFF_TAGS);

  const push = (ifdLabel, list) => {
    for (const e of list) result.fields.push({ ifd: ifdLabel, ...e });
  };
  push('IFD0', ifd0Named.list);

  // EXIF sub-IFD.
  const exifPtr = ifd0[0x8769];
  if (exifPtr) {
    const exif = readIFD(reader, base, base + exifPtr.value);
    push('EXIF', nameEntries(exif, EXIF_TAGS).list);
  }

  // GPS sub-IFD -> coordinate fix.
  const gpsPtr = ifd0[0x8825];
  if (gpsPtr) {
    const gpsIfd = readIFD(reader, base, base + gpsPtr.value);
    const gpsNamed = nameEntries(gpsIfd, GPS_TAGS);
    push('GPS', gpsNamed.list);
    result.coordinates = extractCoordinates(gpsNamed.named);
  }

  result.hasMetadata = result.fields.length > 0;
  result.sensitiveCount = result.fields.filter((f) => f.sensitive).length;
  return result;
}
