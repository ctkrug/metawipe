# Metawipe — Architecture

A concise map of the codebase so any later run can orient fast. Metawipe is a
zero-backend static web app: it parses and strips JPEG metadata entirely in the
browser. There is no server, no upload, no network call anywhere in `src/`.

## How to run / test

```bash
npm install
npm run dev            # local dev server (Vite)
npm run build          # -> dist/ (static, base-path-relative for a subpath)
npm test               # Vitest: byte-level logic + DOM render/flow tests
npm run test:coverage  # v8 line coverage over src/ (~99%)
```

Logic tests run in a Node environment against synthetic JPEGs built in code
(`test/fixtures.js`) — no binary assets, no network. UI/flow tests use happy-dom
(`@vitest-environment happy-dom` docblock) and drive real DOM nodes. `test/
property.test.js` uses fast-check for property-based coverage of the coordinate
math and the parse↔strip invariant.

## Data flow

```
File  ──▶ main.js (intake)
            │  file.arrayBuffer()
            ▼
        exif/parse.js  parseMetadata(buffer)
            │  walk once, decode each metadata kind
            ├── exif/jpeg.js   walkSegments()  — locate APPn segments
            ├── exif/tiff.js   readTiffHeader/readIFD — TIFF/EXIF/GPS IFDs
            ├── exif/reader.js endian-aware primitive reads
            ├── exif/tags.js   tag id -> name + sensitivity
            └── exif/gps.js    DMS rationals + ref -> signed decimal
            ▼
        { isJpeg, fields[], coordinates, hasMetadata, sensitiveCount }
            │
            ├──▶ ui/lighttable.js  renderPlate() — image + scan sweep + pins
            └──▶ ui/panel.js       renderPanel() — counter, grouped fields, map link, Wipe CTA
                                        │  onWipe
                                        ▼
                                 exif/strip.js  stripMetadata(buffer)
                                        │  copy bytes, drop APPn metadata segments
                                        ▼
                                 clean JPEG Blob -> download (*-clean.jpg)
```

## Modules

| File | Responsibility |
|------|----------------|
| `src/main.js` | `createApp(root)` factory: file intake (drag/drop + browse), orchestrates parse → render → wipe → download → reset. Owns the object-URL lifecycle and a monotonic load token so a stale async load can't clobber a newer one. Boots itself only when a real `#app` root exists. |
| `src/exif/jpeg.js` | JPEG marker-segment walker. Classifies APPn segments (`exif`/`xmp`/`iptc`/`appn`) without decoding pixels. |
| `src/exif/tiff.js` | TIFF container: 8-byte header, IFD walking, typed value resolution (ASCII/SHORT/LONG/RATIONAL/…). Guards malformed offsets. |
| `src/exif/reader.js` | Endian-aware primitive reads over a `DataView` (little "II" / big "MM"). |
| `src/exif/tags.js` | Curated TIFF/EXIF/GPS tag dictionaries + the sensitive-field set. |
| `src/exif/gps.js` | DMS-rational → signed decimal degrees + display/format helpers. |
| `src/exif/parse.js` | Orchestration: bytes in → labelled field list, coordinates, detected segments out. Pure (no DOM). Surfaces EXIF/GPS fields plus XMP/IPTC and any foreign APPn block, so the report matches exactly what `strip` removes. |
| `src/exif/strip.js` | Lossless rewrite: copy JPEG byte-for-byte, drop only metadata segments. Scan data stays bit-identical. |
| `src/util/filename.js` | Pure `cleanFilename` helper for the `*-clean.jpg` download name. |
| `src/ui/dom.js` | Tiny `el`/`mount` DOM builder — enough UI without a framework. |
| `src/ui/lighttable.js` | The hero light-table: dropzone, image plate, diagnostic scan sweep, metadata pins. |
| `src/ui/panel.js` | The leak panel: field counter, IFD-grouped rows, map link, Wipe/Download/Reset controls. |

## Key invariants

- **No network.** Nothing in `src/` may `fetch`, open a socket, or beacon.
  `test/network.test.js` audits the source tree to enforce this.
- **Parse ↔ strip consistency.** Every metadata kind `strip` removes, `parse`
  surfaces, so the counter never under-reports what wiping will delete.
- **Lossless.** `strip` never re-encodes; the Start-of-Scan onward is copied
  verbatim (asserted byte-for-byte in `test/strip.test.js`).
- **Endian-agnostic.** The TIFF reader honors the byte-order mark; both "II"
  and "MM" streams are covered by tests.
- **Never throws on hostile input.** The parser degrades on malformed/truncated
  JPEGs — signature matches and TIFF reads are bounds-checked, segment lengths
  are clamped to the buffer, and sub-IFD pointers must be scalar positive LONGs.
  `test/parse.test.js` and `test/property.test.js` pin this.
</content>
</invoke>
