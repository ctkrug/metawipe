---
title: "I built a photo metadata stripper that never uploads your photo"
published: false
tags: javascript, privacy, webdev, showdev
---

Search "remove EXIF online" and you get pages of tools that ask you to upload
the photo first. Think about what that means. The one piece of data you are
trying to delete is the GPS coordinate stamped into the file, and the tool's
whole workflow is to send that coordinate to a server you have never heard of.
A privacy tool that transmits your data is not a privacy tool.

So I built [Metawipe](https://apps.charliekrug.com/metawipe/): drop a JPEG on
the page, see every hidden field pinned over the image, and strip it with one
click. Nothing leaves the tab. You can pull your network cable and it still
works. Here are the two decisions that made it interesting to build.

## Parsing EXIF from raw bytes instead of reaching for a library

I wanted the parser to be the product, not a wrapper around a dependency I could
not inspect. A JPEG is a sequence of marker segments, each one introduced by
`0xFF` followed by a marker byte. Metadata lives in the `APPn` application
segments. EXIF sits in `APP1` behind an `Exif\0\0` signature, XMP is an Adobe XML
packet also in `APP1`, and IPTC hides in a Photoshop resource block in `APP13`.

The fun part is that EXIF is a full TIFF stream tucked inside that `APP1`
segment. TIFF can be little-endian or big-endian depending on a byte-order mark
in its header, so every multi-byte read has to route through an endian-aware
reader rather than assuming a platform default. Values are organized into IFDs
(Image File Directories), and the camera settings and GPS blocks hang off the
first IFD through pointer tags. Each entry is 12 bytes: a tag id, a type, a
count, and then either an inline value (if it fits in four bytes) or an offset to
where the value actually lives.

That offset handling is where a naive parser falls over. A malformed or truncated
file can declare a value that points past the end of the buffer, or an IFD entry
count larger than the bytes present. Every read is bounds-checked against the
buffer length, and a sub-IFD pointer is only followed if it is a single positive
integer offset. Feed the parser random bytes and it returns an empty result
instead of throwing. I wrote property-based tests with fast-check to hammer the
coordinate math and the parse-and-strip invariant with generated inputs.

## Stripping without re-encoding

The obvious way to remove metadata is to decode the image and re-save it. That
works, but it re-compresses the picture, which loses quality and can introduce
subtle artifacts. It also feels wrong for a tool whose whole pitch is "we do not
mess with your photo."

Metawipe never touches the pixels. Stripping is a byte copy: walk the segments,
build a list of the byte ranges that belong to metadata segments, and copy the
file into a new buffer while skipping exactly those ranges. Everything from the
start-of-scan marker onward, which is the actual compressed image, is copied
verbatim. The cleaned file is bit-identical to the original minus its metadata,
and it re-parses to zero fields. A test asserts the scan data and the end-of-image
marker survive the strip untouched.

One subtle bug the tests caught: the report has to surface every segment the
strip will remove, or the counter lies. An early version decoded EXIF fields but
did not list a bare XMP or IPTC block, so a photo carrying only XMP read as
"clean" even though the wipe would remove something. Now anything the stripper
touches is counted, including foreign vendor `APPn` segments.

## What I would do differently

The parser is JPEG-only right now. PNG, WebP and HEIC all carry their own
metadata containers, and HEIC in particular is where a lot of iPhone location
data lives. That is the next container format to learn. I would also decode XMP
and IPTC fields rather than just detecting the block, so the report can show the
actual author and copyright strings, not only that they are present.

Code and tests are on [GitHub](https://github.com/ctkrug/metawipe), and the live
tool is at [apps.charliekrug.com/metawipe](https://apps.charliekrug.com/metawipe/).
It is a single static page with no backend, which is the whole point.
