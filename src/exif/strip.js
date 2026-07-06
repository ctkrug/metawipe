// Safe metadata rewrite.
//
// Stripping is *not* re-encoding: we never decode pixels. We copy the JPEG
// byte-for-byte, dropping only the APPn metadata segments (EXIF, XMP, IPTC and
// friends). The Start-of-Scan onward — the actual compressed image — is left
// completely untouched, so the visual result is bit-identical to the original
// minus its hidden data.

import { walkSegments, isJpeg, SOI } from './jpeg.js';

// Segment kinds that carry metadata and should be removed.
const STRIP_KINDS = new Set(['exif', 'xmp', 'iptc', 'app1', 'appn']);

/**
 * Produce a new JPEG with all metadata application segments removed.
 * @param {ArrayBuffer} buffer
 * @returns {{ buffer: ArrayBuffer, removed: number, bytesSaved: number }}
 *   `removed` = count of stripped segments; the original is returned unchanged
 *   for non-JPEG input.
 */
export function stripMetadata(buffer) {
  const view = new DataView(buffer);
  if (!isJpeg(view)) {
    return { buffer, removed: 0, bytesSaved: 0 };
  }

  const segments = walkSegments(view);
  const toRemove = segments.filter((s) => STRIP_KINDS.has(s.kind));
  if (toRemove.length === 0) {
    return { buffer, removed: 0, bytesSaved: 0 };
  }

  // Build a list of [start, end) byte ranges to drop (each spans the 0xFF
  // marker through the end of its payload).
  const cuts = toRemove
    .map((s) => [s.start, s.start + 2 + s.length])
    .sort((a, b) => a[0] - b[0]);

  const src = new Uint8Array(buffer);
  const out = new Uint8Array(src.length); // upper bound; we slice to fit
  let write = 0;
  let read = 0;
  let bytesSaved = 0;

  // Always keep the SOI marker (offset 0..2) — cuts start after it.
  for (const [start, end] of cuts) {
    // Copy everything up to this cut.
    out.set(src.subarray(read, start), write);
    write += start - read;
    bytesSaved += end - start;
    read = end;
  }
  // Copy the remainder (image data + EOI).
  out.set(src.subarray(read), write);
  write += src.length - read;

  const clean = out.slice(0, write).buffer;
  // Sanity: the output must still be a valid JPEG.
  const cleanView = new DataView(clean);
  if (cleanView.getUint16(0, false) !== SOI) {
    return { buffer, removed: 0, bytesSaved: 0 };
  }

  return { buffer: clean, removed: toRemove.length, bytesSaved };
}
