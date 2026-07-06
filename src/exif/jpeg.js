// JPEG marker-segment walker.
//
// A JPEG is a sequence of segments, each introduced by 0xFF followed by a
// marker byte. Metadata lives in the APPn application segments: EXIF in APP1
// (with an "Exif\0\0" signature), XMP also in APP1 (an Adobe XML packet), and
// IPTC in APP13 (a Photoshop resource block). This scanner locates them
// without decoding the image itself, which is why stripping is lossless.

export const SOI = 0xffd8; // Start of image
export const EOI = 0xffd9; // End of image
export const SOS = 0xffda; // Start of scan (compressed data begins)

const EXIF_SIG = 'Exif\0\0';
const XMP_SIG = 'http://ns.adobe.com/xap/1.0/\0';
const IPTC_SIG = 'Photoshop 3.0\0';

function sigAt(view, offset, sig) {
  for (let i = 0; i < sig.length; i++) {
    if (view.getUint8(offset + i) !== sig.charCodeAt(i)) return false;
  }
  return true;
}

/** True if the first two bytes are the JPEG start-of-image marker. */
export function isJpeg(view) {
  return view.byteLength >= 2 && view.getUint16(0, false) === SOI;
}

/**
 * Walk every marker segment up to the start of scan.
 * @returns {Array<{ marker: number, start: number, headerEnd: number,
 *                    length: number, kind: string }>}
 *   `start` points at the 0xFF marker byte; `length` is the full segment
 *   length including its 2-byte size field (so start..start+2+length spans it).
 */
export function walkSegments(view) {
  const segments = [];
  if (!isJpeg(view)) return segments;

  let offset = 2; // past SOI
  const len = view.byteLength;

  while (offset + 4 <= len) {
    if (view.getUint8(offset) !== 0xff) break; // not a marker — malformed
    const marker = view.getUint8(offset + 1);

    // Standalone markers (RSTn, SOI, EOI, TEM) carry no length payload.
    if (marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    // Start of scan: compressed image data follows, stop scanning.
    if (marker === 0xda) break;

    const segLen = view.getUint16(offset + 2, false); // includes the 2 length bytes
    const dataStart = offset + 4;

    let kind = 'other';
    if (marker === 0xe1) {
      if (sigAt(view, dataStart, EXIF_SIG)) kind = 'exif';
      else if (sigAt(view, dataStart, XMP_SIG)) kind = 'xmp';
      else kind = 'app1';
    } else if (marker === 0xed && sigAt(view, dataStart, IPTC_SIG)) {
      kind = 'iptc';
    } else if (marker >= 0xe0 && marker <= 0xef) {
      kind = 'appn';
    }

    segments.push({ marker, start: offset, headerEnd: dataStart, length: segLen, kind });
    offset += 2 + segLen;
  }
  return segments;
}
