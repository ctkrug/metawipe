# Metawipe — Design Direction

The art-direction brief. Every build/QA run follows this; the landing page
(`site/`) and the app share these exact tokens so they read as one brand.

## 1. Aesthetic direction

**Metawipe is a forensic light-table.** You drop a photo onto a dark inspection
surface and the tool shines a cold diagnostic light through it — the hidden
metadata surfaces as precise, monospaced annotations pinned over the image, the
way a technician marks up a negative on a lightbox. Deep ink-navy backdrop, a
single cold cyan diagnostic accent, hairline technical grid, mono data readouts.
Location and identity leaks glow in a warning amber so the risk is unmistakable.
It should feel like an instrument, not a web form — clinical, exact, a little
covert.

This is a **blueprint/technical + soft-depth glassy dark** hybrid, deliberately
*not* the generic "dark gray cards + one accent" default: the accent is cold
cyan, surfaces are ink-navy with a real neutral ramp, and the signature grid +
amber-flagged leaks give it a personality no generic dashboard has.

## 2. Tokens (actual values)

**Color**

| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#0a0f1a` | page base (ink-navy) |
| `--bg-grid` | `#0e1524` | hairline grid line color |
| `--surface-1` | `#111a2c` | panels, dropzone |
| `--surface-2` | `#18243b` | raised rows, hover |
| `--text` | `#e6edf6` | primary text |
| `--muted` | `#8296b3` | labels, secondary |
| `--accent` | `#38e1d6` | cyan diagnostic accent, primary CTA |
| `--accent-deep` | `#0fb8ac` | pressed/active accent |
| `--warn` | `#ffb347` | sensitive-field flag (GPS, serials, owner) |
| `--warn-deep` | `#e8912a` | warn hover/borders |
| `--danger` | `#ff5d6c` | destructive / error |
| `--ok` | `#5fe08a` | success (strip complete) |

Neutral ramp (navy-tinted, not flat gray): `#0a0f1a → #0e1524 → #111a2c →
#18243b → #24344f → #3a4d६f`. Surfaces layer with a subtle top highlight
(`inset 0 1px 0 rgba(255,255,255,.04)`) + a cast shadow for depth.

**Type**

- Display / wordmark + headings: **Space Grotesk** (Google Fonts), 500–700.
- UI / body: **Inter** (Google Fonts), 400–600.
- Data readouts / metadata values: **JetBrains Mono**, 400–500.
- System fallbacks: `ui-sans-serif, system-ui, sans-serif` and
  `ui-monospace, SFMono-Regular, Menlo, monospace`.
- Scale (~1.25): 12 · 14 · 16 · 20 · 25 · 31 · 39px.

**Space / shape / motion**

- Spacing on a 4/8px scale: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64.
- Radius: 6px controls, 12px panels, 999px pills/pins.
- Shadow: `0 1px 0 rgba(255,255,255,.04) inset, 0 8px 24px -12px rgba(0,0,0,.7)`;
  accent glow `0 0 0 1px rgba(56,225,214,.4), 0 0 24px -6px rgba(56,225,214,.5)`.
- Motion: UI transitions 140–220ms ease-out; pin drop-in 180ms; the diagnostic
  "scan line" sweep on analyze ~600ms. Respect `prefers-reduced-motion`.

## 3. Layout intent

The **hero is the light-table**: a large inspection stage holding the dropped
image with metadata pins overlaid, taking ~60%+ of the desktop viewport. To its
right (desktop) / below (phone) sits the **leak panel** — a monospaced,
scrollable list of every field grouped by IFD, sensitive rows badged amber, with
a live "N fields · M leaking" counter and the primary **Wipe metadata** CTA.

- **1440×900:** two-column — light-table left (~62%), leak panel right (~38%),
  full-bleed grid background, no dead margins.
- **390×844:** single column — light-table on top (image + pins), leak panel
  stacked below, sticky Wipe CTA at the bottom. No horizontal scroll.

Empty state (no image yet) is a designed dropzone: the grid, a crosshair
target, and copy — "Drop a photo. Nothing leaves this tab."

## 4. Signature detail

A **diagnostic scan sweep**: when a photo is analyzed, a thin cyan light line
sweeps top-to-bottom across the image once (like a scanner passing over it),
and the metadata pins drop in behind it in sequence. Paired with the hairline
blueprint grid that runs edge-to-edge under everything, it makes the tool feel
like an instrument reading the file. Reduced-motion users get the pins without
the sweep.

## 5. Not a game

Metawipe is a utility, so the juice budget goes to interaction feedback, not
celebration: the scan sweep, pins dropping in, the leak counter ticking, a
satisfying state change on Wipe (rows collapse, counter falls to 0, a brief
`ok`-green confirmation with the bytes-removed count and a Download button).
No SFX. Motion is precise and quiet, never bouncy.

## Brand assets

- **Favicon:** inline SVG data-URI — a cyan crosshair/target reticle over ink
  navy (the "inspection" glyph), never the default globe.
- **Wordmark:** `meta` in muted text + `wipe` in cyan, Space Grotesk, with a
  small crosshair glyph as the dot — set tight, not just the name in a heading.
