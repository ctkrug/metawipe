# Metawipe

**See what your photos are leaking — then wipe it, without anything leaving your browser.**

Every photo you share carries an invisible dossier: the GPS coordinates where it
was taken, the exact camera and lens, the phone's serial number, the timestamp
down to the second, sometimes even the owner's name. Metawipe drags that hidden
layer into the light. Drop a photo in and every EXIF / GPS / IPTC / XMP field is
parsed and pinned over the image. One click strips it all and hands you back a
clean file.

It runs **100% in your browser**. No upload, no server, no telemetry — the bytes
never leave the tab. Parsing and the safe binary rewrite happen in JavaScript on
your own machine, which is exactly why you can trust it with a photo you'd never
upload to a random "metadata remover" website.

## Why it exists

The web is full of "remove EXIF online" tools that ask you to upload the very
photo whose location you're trying to hide. That's backwards. A privacy tool
that sees your data isn't a privacy tool. Metawipe proves you don't need a
server at all: modern browsers can read and rewrite image containers directly.

## Features (planned)

- **Leak overlay** — every metadata field pinned over the image, GPS and personal
  fields flagged in a warning color so the risk is obvious at a glance.
- **Real parser** — a from-scratch reader for JPEG APP segments, TIFF/EXIF IFDs,
  GPS IFD, and XMP packets. Not a wrapper around a black box.
- **Interactive map pin** — if the photo carries coordinates, see the actual spot
  it claims you were standing.
- **One-click strip** — a safe binary rewrite that removes metadata segments while
  leaving the image data byte-for-byte intact, then downloads the clean file.
- **Fully offline** — works with your network disconnected; nothing is ever sent.
- **Zero install** — a single static page, hostable anywhere.

## Stack

- Vanilla JavaScript (ES modules), no runtime framework — the parser is the product.
- [Vite](https://vitejs.dev/) for the dev server and static build.
- [Vitest](https://vitest.dev/) for the unit test suite over the parser and rewriter.

## Develop

```bash
npm install
npm run dev      # local dev server
npm test         # run the parser / strip / gps test suite
npm run build    # emit the static site into dist/
```

The build is a self-contained static bundle with relative asset paths, so it can
be hosted under any subpath.

## License

[MIT](./LICENSE) © Charlie Krug
