// Metawipe app entry: file intake -> parse -> render light-table + leak panel
// -> wipe -> download. Every byte stays on this page; there is no fetch/upload
// anywhere in this module by design.

import { parseMetadata } from './exif/parse.js';
import { stripMetadata } from './exif/strip.js';
import { renderDropzone, renderPlate } from './ui/lighttable.js';
import { renderPanel } from './ui/panel.js';
import { el, mount } from './ui/dom.js';

const app = document.getElementById('app');

// Persistent containers so we don't rebuild the whole stage each render.
const table = el('section', { class: 'lighttable', 'aria-label': 'Photo inspection light-table' });
const panelHost = el('div');
mount(app, table, panelHost);

// Track object URLs so we can revoke them and avoid leaking memory.
let currentUrl = null;
let cleanUrl = null;
let currentName = 'photo.jpg';

function revoke(url) {
  if (url) URL.revokeObjectURL(url);
}

function resetPanel() {
  mount(panelHost);
}

/** Read a File as an ArrayBuffer. */
function readBuffer(file) {
  return file.arrayBuffer();
}

async function handleFile(file) {
  if (!file) return;
  if (!/image\/jpe?g/i.test(file.type) && !/\.jpe?g$/i.test(file.name)) {
    showError('That doesn’t look like a JPEG. Metawipe reads JPEG metadata (EXIF/GPS/IPTC).');
    return;
  }

  currentName = file.name || 'photo.jpg';
  const buffer = await readBuffer(file);
  const meta = parseMetadata(buffer);

  revoke(currentUrl);
  revoke(cleanUrl);
  cleanUrl = null;
  currentUrl = URL.createObjectURL(file);

  renderPlate(table, currentUrl, meta.fields, true);
  renderPanel(panelHost, meta, {
    onWipe: () => wipe(buffer, meta),
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
  });
}

function cleanFilename(name) {
  return name.replace(/(\.jpe?g)$/i, '-clean$1').replace(/^([^.]+)$/, '$1-clean.jpg');
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

// Boot.
renderDropzone(table, handleFile);
wireDragDrop();
