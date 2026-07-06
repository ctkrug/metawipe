# Metawipe — Vision

## The problem

Every photo a phone or camera produces carries a hidden second file bolted onto
the pixels: EXIF, GPS, IPTC and XMP metadata. It records where the shot was
taken (to within a few meters), the exact device and lens, serial numbers, the
timestamp to the second, and sometimes the owner's name and copyright string.
People share these photos to forums, marketplaces, dating profiles and chat
apps every day with no idea they're also broadcasting their home address.

The "solutions" are worse than the problem. Search "remove EXIF online" and
you'll find dozens of sites that ask you to **upload** the photo — handing the
exact coordinates you're trying to hide to an anonymous server that may log,
cache, or resell it. A privacy tool that transmits your data isn't a privacy
tool. It's a data-collection funnel wearing a helpful mask.

## The core idea

Modern browsers can read and rewrite binary files directly. There is no reason a
server ever needs to touch the photo. **Metawipe does the entire job — parse and
strip — client-side in JavaScript.** You drop a photo on the page; it never
leaves the tab. You can literally pull your network cable and it still works.

Two things make it more than a checkbox:

1. **It shows you the leak first.** Before stripping, Metawipe overlays every
   field it found directly on the image, with location and identity fields
   flagged in a warning color and a live "N fields, M leaking" count. Seeing
   your GPS coordinates pinned on your own photo is the moment that makes the
   risk real. If there's a coordinate, we link straight to the map spot.

2. **The strip is honest and lossless.** We don't re-encode the image (which
   would degrade it and could be a vector for subtle corruption). We copy the
   JPEG byte-for-byte and remove only the metadata segments, leaving the
   compressed pixel data bit-identical. What you download is your photo, minus
   the dossier.

## Who it's for

- Anyone selling on Marketplace/Craigslist, posting to public forums, or sharing
  photos with strangers who shouldn't get their home coordinates.
- Journalists, activists and their sources who need to scrub location data before
  publishing images.
- Privacy-minded people who (rightly) won't upload a sensitive photo to a random
  website to "clean" it.
- Developers curious how EXIF/TIFF actually works — the parser is readable and
  from-scratch, not a wrapper.

## Key design decisions

- **No backend, ever.** The non-negotiable constraint that defines the product.
  Static site, hostable on any subpath, works offline.
- **From-scratch parser.** A real JPEG-segment / TIFF-IFD / GPS-IFD reader, not a
  dependency black box. It's the impressive core and keeps the bundle tiny.
- **Lossless rewrite, not re-encode.** Preserve the scan data exactly; only drop
  APPn metadata segments. Verifiable and trustworthy.
- **Show before wipe.** The overlay is the product's soul — education plus action,
  not a silent one-click.
- **Vanilla JS + Vite.** No framework tax; the parser is the substance. Vitest
  covers the byte-level logic against synthetic fixtures so CI needs no binaries.

## What "v1 done" looks like

- Drop or browse a JPEG and see its EXIF/GPS fields parsed and pinned on the
  image within a second, sensitive fields visibly flagged, with a live counter.
- A GPS-tagged photo surfaces a working map link to the coordinates.
- One click strips all metadata and downloads a clean JPEG whose pixels are
  byte-identical to the original and which re-parses to zero metadata fields.
- Everything works with no network (verifiable: zero requests in the network
  tab). A non-JPEG or a clean JPEG is handled gracefully, not with a crash.
- The page matches the forensic light-table design direction on phone and
  desktop, and a matching landing page explains and links to the tool.
- Parser, GPS math and strip round-trip are covered by a green test suite in CI.

## Beyond v1 (not now)

PNG/WebP/HEIC metadata, TIFF thumbnail preview, batch mode (strip a folder),
XMP/IPTC field decoding beyond detection, and a "what each field reveals"
explainer per tag.
