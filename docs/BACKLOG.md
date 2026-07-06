# Metawipe — Backlog

Epics and stories for the build. Every story has verifiable acceptance criteria
a later QA run can confirm true or false. `[ ]` = todo, `[x]` = done.

Legend: **AC** = acceptance criteria.

---

## Epic A — See the leak (the wow moment)

The demo that has to land first: drop a photo, watch its hidden metadata surface
pinned on the image.

- [ ] **A1 — Drop/browse a JPEG onto the light-table** *(the wow moment)*
  - AC1: Dragging a JPEG onto the stage, or using "Choose a photo", loads it and
    shows the image on the light-table.
  - AC2: On load, a diagnostic scan sweep runs once and metadata field pins drop
    in over the image (sensitive fields in amber, others in cyan).
  - AC3: A non-JPEG file shows an inline "not a JPEG" message, never a crash.

- [ ] **A2 — Parse EXIF/TIFF/GPS from raw bytes**
  - AC1: `parseMetadata` returns named IFD0 fields (e.g. Make, Model) with
    correct string values for a fixture JPEG.
  - AC2: The EXIF sub-IFD and GPS sub-IFD are followed via their pointer tags.
  - AC3: Malformed/out-of-bounds offsets are skipped without throwing.

- [ ] **A3 — Convert GPS to a decimal coordinate + map link**
  - AC1: A DMS + N/S/E/W reference converts to a correctly-signed decimal degree
    (S/W negative), verified against known values in tests.
  - AC2: A GPS-tagged photo shows a coordinate readout and an external map link
    that opens the right spot.
  - AC3: A photo with no GPS shows no map block (no empty/placeholder box).

- [ ] **A4 — Leak panel with live counter and sensitive flags**
  - AC1: The panel shows "N fields · M leaking" matching the parsed counts.
  - AC2: Fields are grouped by IFD (IFD0 / EXIF / GPS) with labels.
  - AC3: Sensitive fields (GPS, serials, owner, timestamps) are visually badged
    distinctly from ordinary fields.

- [ ] **A5 — Design polish: light-table hero**
  - AC1: On desktop the light-table occupies ≥60% of the viewport width and the
    layout has no dead empty seas at 1440px.
  - AC2: The scan sweep and pins respect `prefers-reduced-motion` (no animation
    when set).

## Epic B — Wipe it (lossless)

- [ ] **B1 — Lossless strip of metadata segments**
  - AC1: `stripMetadata` removes APPn metadata segments and the result re-parses
    to zero metadata fields.
  - AC2: The compressed scan data and EOI are byte-identical to the original
    (verified in tests).
  - AC3: Stripping a JPEG with no metadata is a no-op (removed = 0).

- [ ] **B2 — Wipe action + download clean file**
  - AC1: Clicking Wipe replaces the panel with a success result showing the
    number of segments and KB removed.
  - AC2: A "Download clean photo" button downloads a JPEG named `*-clean.jpg`.
  - AC3: Re-loading the downloaded file into Metawipe shows zero metadata.

- [ ] **B3 — Verify no network egress**
  - AC1: Loading, parsing, and wiping a photo issues zero network requests
    (confirmed via the network panel / a no-fetch code audit).
  - AC2: The app functions with the network disconnected.

## Epic C — Trust, polish & ship

- [ ] **C1 — Graceful edge cases**
  - AC1: A clean JPEG shows a "Clean — no metadata" empty state, not a broken
    panel.
  - AC2: A truncated/corrupt JPEG is handled without an uncaught exception.
  - AC3: Reset ("try another photo") returns to the dropzone and revokes object
    URLs.

- [ ] **C2 — Responsive + a11y pass**
  - AC1: No horizontal scroll or overlap at 390px, 768px, 1440px.
  - AC2: All controls have visible focus states; icon-only controls have
    `aria-label`; the result uses a live region.
  - AC3: Text contrast ≥ 4.5:1 for body copy.

- [ ] **C3 — Landing page (`site/`) matching the brand**
  - AC1: A static landing page uses the same tokens/direction as the app and
    links to it.
  - AC2: The page explains the "nothing uploads" promise and the show-then-wipe
    flow, with no placeholder copy.
  - AC3: Relative asset paths only; builds/serves correctly under a subpath.

- [ ] **C4 — Design polish: final QA sweep**
  - AC1: Favicon is the code-generated reticle (no default globe).
  - AC2: Wordmark is the designed `meta`+`wipe` treatment, not plain heading text.
  - AC3: The D3 self-review checklist passes at all three breakpoints.

---

**Remaining stories:** 12 open (`[ ]`). The scaffold already lands A1–A3 and B1
end-to-end (with tests); the open stories harden, polish, and ship them.
