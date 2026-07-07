// Metawipe app entry: file intake -> parse -> render light-table + leak panel
// -> wipe -> download. Every byte stays on this page; there is no fetch/upload
// anywhere in this module by design.

import { parseMetadata } from './exif/parse.js';
import { stripMetadata } from './exif/strip.js';
import { renderDropzone, renderPlate } from './ui/lighttable.js';
import { renderPanel } from './ui/panel.js';
import { el, mount } from './ui/dom.js';
import { cleanFilename } from './util/filename.js';

/**
 * Wire the whole app into a root element and return handles for driving it.
 * Kept as a factory (rather than top-level side effects) so the flow — intake,
 * the async load race, wipe, reset — is unit-testable against a DOM root.
 * @param {HTMLElement} app
 */
export function createApp(app) {
  // Persistent containers so we don't rebuild the whole stage each render.
  const table = el('section', {
    class: 'lighttable',
    'aria-label': 'Photo inspection light-table',
  });
  const panelHost = el('div');
  mount(app, table, panelHost);

  // Track object URLs so we can revoke them and avoid leaking memory.
  let currentUrl = null;
  let cleanUrl = null;
  let currentName = 'photo.jpg';

  // Monotonic load token: reading a file is async, so a second drop can land
  // while the first is still decoding. Only the newest load may touch the UI —
  // a superseded one bails so a stale image/panel never clobbers a newer one.
  let loadSeq = 0;

  const revoke = (url) => {
    if (url) URL.revokeObjectURL(url);
  };
  const resetPanel = () => mount(panelHost);
  const readBuffer = (file) => file.arrayBuffer();

  async function handleFile(file) {
    if (!file) return;
    if (!/image\/jpe?g/i.test(file.type) && !/\.jpe?g$/i.test(file.name)) {
      showError('That doesn’t look like a JPEG. Metawipe reads JPEG metadata (EXIF/GPS/IPTC).');
      return;
    }

    const seq = ++loadSeq;

    // The parser is defensive, but reading the file or an unforeseen
    // malformation must never leave a blank screen or a bare console stack —
    // degrade to a designed error state instead.
    let buffer;
    let meta;
    try {
      buffer = await readBuffer(file);
      meta = parseMetadata(buffer);
    } catch {
      if (seq !== loadSeq) return; // superseded — let the newer load own the UI
      showError('That file couldn’t be read. It may be truncated or corrupt. Try another photo.');
      return;
    }
    if (seq !== loadSeq) return; // a newer drop landed while we were decoding

    currentName = file.name || 'photo.jpg';
    revoke(currentUrl);
    revoke(cleanUrl);
    cleanUrl = null;
    currentUrl = URL.createObjectURL(file);

    renderPlate(table, currentUrl, meta.fields, true);
    renderPanel(panelHost, meta, {
      onWipe: () => wipe(buffer, meta),
      onReset: reset,
    });
  }

  function wipe(buffer, meta) {
    const { buffer: clean, removed, bytesSaved } = stripMetadata(buffer);
    revoke(cleanUrl);
    cleanUrl = URL.createObjectURL(new Blob([clean], { type: 'image/jpeg' }));

    // Re-render the panel now showing zero fields + the download.
    const wiped = { ...meta, fields: [], sensitiveCount: 0, coordinates: null, hasMetadata: false };
    const kb = (bytesSaved / 1024).toFixed(bytesSaved > 1024 ? 1 : 2);
    renderPanel(panelHost, wiped, {
      result: `✓ Wiped ${removed} segment${removed === 1 ? '' : 's'} · ${kb} KB of hidden data removed.`,
      cleanUrl,
      cleanName: cleanFilename(currentName),
      onReset: reset,
    });
  }

  function showError(message) {
    const box = el('div', { class: 'dropzone' }, [
      el('h2', { text: 'Not a JPEG' }),
      el('p', { text: message }),
      el('button', { class: 'btn btn--primary dropzone__browse', onclick: reset }, 'Try another photo'),
    ]);
    mount(table, box);
    resetPanel();
  }

  function reset() {
    loadSeq++; // invalidate any in-flight load so it can't render over the dropzone
    revoke(currentUrl);
    revoke(cleanUrl);
    currentUrl = cleanUrl = null;
    renderDropzone(table, handleFile);
    resetPanel();
  }

  // --- drag & drop over the whole light-table ---
  function wireDragDrop() {
    const stop = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    ['dragenter', 'dragover'].forEach((ev) =>
      table.addEventListener(ev, (e) => {
        stop(e);
        table.classList.add('is-drag');
      }),
    );
    ['dragleave', 'drop'].forEach((ev) =>
      table.addEventListener(ev, (e) => {
        stop(e);
        if (ev === 'dragleave' && table.contains(e.relatedTarget)) return;
        table.classList.remove('is-drag');
      }),
    );
    table.addEventListener('drop', (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (file) handleFile(file);
    });
  }

  renderDropzone(table, handleFile);
  wireDragDrop();

  return { table, panelHost, handleFile, wipe, reset };
}

// Boot when loaded in a real page (skipped under the test runner, which has no
// #app root and drives createApp directly).
if (typeof document !== 'undefined') {
  const root = document.getElementById('app');
  if (root) createApp(root);
}
