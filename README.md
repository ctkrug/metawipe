# Metawipe

**See what your photo leaks, then wipe it.**

**▶ Live demo: [apps.charliekrug.com/metawipe](https://apps.charliekrug.com/metawipe/)**

[![CI](https://github.com/ctkrug/metawipe/actions/workflows/ci.yml/badge.svg)](https://github.com/ctkrug/metawipe/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

Every photo you share carries an invisible dossier: the GPS coordinates where it
was taken, the exact camera and lens, the phone's serial number, the timestamp
down to the second, sometimes the owner's name. Metawipe drags that hidden layer
into the light. Drop a JPEG in and every EXIF, GPS, IPTC and XMP field is parsed
and pinned over the image. One click strips it all and hands back a clean file.

It runs entirely in your browser. No upload, no server, no telemetry: the bytes
never leave the tab. Parsing and the binary rewrite both happen in JavaScript on
your own machine, which is exactly why you can trust it with a photo you would
never hand to a random "metadata remover" site. Pull your network cable and it
still works.

## Who it's for

Anyone about to hand a photo to strangers and not the whole internet:

- Selling on Marketplace or Craigslist, where a listing photo can pin your home.
- Posting to public forums, Reddit or a dating profile.
- Journalists, activists and their sources scrubbing location before publishing.
- Developers curious how EXIF and TIFF actually decode, in readable code.

## What it shows you

Drop a photo and Metawipe reports every field it finds, grouped by IFD, with
location and identity fields flagged as leaks:

```
14 fields · 5 leaking identity or location

⚑ This photo pins a location
   37.774930, -122.419420   ·   view on map

IFD0
  Make              Apple
  Model             iPhone 13 Pro
  Software          16.5
  DateTime          2023:07:04 14:22:31       leak
EXIF
  DateTimeOriginal  2023:07:04 14:22:31       leak
  LensModel         iPhone 13 Pro back camera
  BodySerialNumber  F2L…                      leak
GPS
  GPSLatitude       37 deg 46' 29.7"          leak
  GPSLongitude      122 deg 25' 9.9"          leak
```

Click **Wipe** and it downloads `yourphoto-clean.jpg`, which re-parses to zero
metadata fields while the pixels stay byte-for-byte identical.

## Features

- **Leak overlay.** Every metadata field is pinned over the image, with GPS and
  personal fields flagged amber so the risk is obvious at a glance.
- **A real parser.** A from-scratch, endian-aware reader for JPEG APP segments,
  TIFF and EXIF IFDs and the GPS IFD, plus XMP and IPTC block detection. Not a
  wrapper around a dependency you can't inspect.
- **Map pin.** If the photo carries coordinates, a link opens the exact spot it
  claims you were standing, with altitude when present.
- **Lossless strip.** The wipe copies the compressed image data byte-for-byte
  and drops only the metadata segments. No re-encode, no quality loss.
- **Honest counter.** What the report shows is exactly what the wipe removes. A
  photo carrying only XMP or IPTC still reads as leaking, never "clean".
- **Works offline.** Disconnect the network and it runs the same. A test audits
  the source so no egress call can slip in.
- **Zero install.** One static page, hostable under any subpath.

## How the strip stays lossless

Metawipe never decodes pixels. A JPEG is a sequence of marker segments; the
metadata lives in the `APPn` application segments while the compressed image
lives after the start-of-scan marker. The wipe copies the file byte-for-byte and
skips only the metadata segments, so the visible result is identical to the
original minus its hidden data. That is why it cannot degrade the image or
introduce re-encode artifacts.

## Stack

- Vanilla JavaScript (ES modules), no runtime framework. The parser is the product.
- [Vite](https://vitejs.dev/) for the dev server and the static build.
- [Vitest](https://vitest.dev/) for the test suite over the parser and rewriter,
  with property-based checks via [fast-check](https://github.com/dubzzz/fast-check).

## Develop

```bash
npm install
npm run dev            # local dev server
npm test               # run the parser / strip / gps suite
npm run test:coverage  # v8 line coverage over src/
npm run build          # emit the static site into dist/
```

The build is a self-contained static bundle with relative asset paths, so it can
be hosted under any subpath.

## License

[MIT](./LICENSE) © Charlie Krug

More of Charlie's projects → [apps.charliekrug.com](https://apps.charliekrug.com)
