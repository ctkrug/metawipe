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

  const push = (ifdLabel, list) => {
    for (const e of list) result.fields.push({ ifd: ifdLabel, ...e });
  };

  // Walk the marker segments once; every metadata kind is decoded from here so
  // the report never under-counts what `strip` will later remove.
  const segments = walkSegments(view);

  const exifSeg = segments.find((s) => s.kind === 'exif');
  if (exifSeg) parseExif(view, exifSeg, push, result);

  // XMP / IPTC aren't field-decoded (that's beyond v1), but their presence is
  // real leaked metadata — surface each as a flagged block so the counter and
  // the panel stay honest and consistent with the stripper.
  for (const seg of segments) {
    if (seg.kind === 'xmp') {
      push('XMP', [xmpField(seg)]);
    } else if (seg.kind === 'iptc') {
      push('IPTC', [iptcField(seg)]);
    }
  }

  result.hasMetadata = result.fields.length > 0;
  result.sensitiveCount = result.fields.filter((f) => f.sensitive).length;
  return result;
}

/** Decode the EXIF TIFF stream in an APP1 segment into named fields. */
function parseExif(view, exifSeg, push, result) {
  // EXIF payload = "Exif\0\0" (6 bytes) then the TIFF stream.
  const tiffBase = exifSeg.headerEnd + 6;
  const header = readTiffHeader(view, tiffBase);
  if (!header) return;

  const { reader, base, firstIFD } = header;
  const ifd0 = readIFD(reader, base, base + firstIFD);
  push('IFD0', nameEntries(ifd0, TIFF_TAGS).list);

  // EXIF sub-IFD.
  const exifPtr = subIfdOffset(ifd0[0x8769]);
  if (exifPtr != null) {
    const exif = readIFD(reader, base, base + exifPtr);
    push('EXIF', nameEntries(exif, EXIF_TAGS).list);
  }

  // GPS sub-IFD -> coordinate fix.
  const gpsPtr = subIfdOffset(ifd0[0x8825]);
  if (gpsPtr != null) {
    const gpsIfd = readIFD(reader, base, base + gpsPtr);
    const gpsNamed = nameEntries(gpsIfd, GPS_TAGS);
    push('GPS', gpsNamed.list);
    result.coordinates = extractCoordinates(gpsNamed.named);
  }
}

/**
 * A sub-IFD pointer is a single LONG offset. Reject anything else (a malformed
 * count>1 pointer resolves to an array; a negative would read backwards) so we
 * never chase a garbage location and surface phantom fields.
 */
function subIfdOffset(entry) {
  if (!entry) return null;
  const v = entry.value;
  return typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null;
}

/** A synthetic field describing a detected metadata block by its size. */
function blockField(name, seg) {
  const bytes = Math.max(0, seg.length - 2); // segment length minus its size field
  return {
    tag: null,
    name,
    value: bytes,
    display: `present · ${bytes} bytes`,
    sensitive: true, // XMP/IPTC routinely carry author, location and rights
  };
}

const xmpField = (seg) => blockField('XMP packet', seg);
const iptcField = (seg) => blockField('IPTC record', seg);
