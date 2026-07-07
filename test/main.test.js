// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp } from '../src/main.js';
import { jpegWithExif, jpegBare } from './fixtures.js';

// A minimal File stand-in: the app only needs name, type and arrayBuffer().
function jpegFile(name, buffer) {
  return { name, type: 'image/jpeg', arrayBuffer: () => Promise.resolve(buffer) };
}
function deferredJpeg(name, buffer) {
  let release;
  const promise = new Promise((r) => {
    release = () => r(buffer);
  });
  return { file: { name, type: 'image/jpeg', arrayBuffer: () => promise }, release };
}

describe('createApp flow', () => {
  let root;
  beforeEach(() => {
    root = document.createElement('div');
    let n = 0;
    globalThis.URL.createObjectURL = vi.fn(() => `blob:mock/${++n}`);
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it('loads a JPEG into the plate and a populated leak panel', async () => {
    const app = createApp(root);
    await app.handleFile(jpegFile('vacation.jpg', jpegWithExif()));

    expect(root.querySelector('.plate img')).toBeTruthy();
    expect(root.querySelector('.panel')).toBeTruthy();
    expect(root.textContent).toContain('GPS');
    expect(root.querySelector('.field-row.is-sensitive')).toBeTruthy();
  });

  it('shows a designed error for a non-JPEG instead of a blank screen', async () => {
    const app = createApp(root);
    await app.handleFile({ name: 'diagram.png', type: 'image/png', arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)) });

    expect(root.textContent).toContain('Not a JPEG');
    expect(root.querySelector('.plate')).toBeNull();
  });

  it('degrades to an error state when the file cannot be read', async () => {
    const app = createApp(root);
    await app.handleFile({ name: 'broken.jpg', type: 'image/jpeg', arrayBuffer: () => Promise.reject(new Error('io')) });

    expect(root.textContent).toContain('couldn’t be read');
    expect(root.querySelector('.plate')).toBeNull();
  });

  it('wipes on demand and offers the clean download', async () => {
    const app = createApp(root);
    await app.handleFile(jpegFile('geo.jpg', jpegWithExif()));

    const wipeBtn = [...root.querySelectorAll('button')].find((b) => /Wipe/.test(b.textContent));
    expect(wipeBtn).toBeTruthy();
    wipeBtn.click();

    const dl = root.querySelector('a[download]');
    expect(dl).toBeTruthy();
    expect(dl.getAttribute('download')).toBe('geo-clean.jpg');
    expect(root.textContent).toContain('Wiped');
    // Nothing left flagged after the wipe.
    expect(root.querySelector('.field-row.is-sensitive')).toBeNull();
  });

  it('resets back to the dropzone from a loaded state', async () => {
    const app = createApp(root);
    await app.handleFile(jpegFile('geo.jpg', jpegWithExif()));
    app.reset();

    expect(root.querySelector('.dropzone')).toBeTruthy();
    expect(root.querySelector('.plate')).toBeNull();
    expect(root.querySelector('.panel')).toBeNull();
  });

  it('ignores a superseded load so a stale drop cannot clobber a newer one', async () => {
    const app = createApp(root);
    const first = deferredJpeg('bare.jpg', jpegBare()); // older, no metadata
    const second = deferredJpeg('rich.jpg', jpegWithExif()); // newer, has GPS

    const p1 = app.handleFile(first.file);
    const p2 = app.handleFile(second.file);

    // Newer load resolves first and owns the UI.
    second.release();
    await p2;
    // Older load resolves late and must be discarded.
    first.release();
    await p1;

    expect(root.textContent).toContain('GPS'); // the rich photo, not the bare one
    expect(root.querySelector('.field-row.is-sensitive')).toBeTruthy();
  });

  it('discards an in-flight load that resolves after a reset', async () => {
    const app = createApp(root);
    const pending = deferredJpeg('slow.jpg', jpegWithExif());
    const p = app.handleFile(pending.file);

    app.reset(); // user bailed back to the dropzone before decode finished
    pending.release();
    await p;

    expect(root.querySelector('.dropzone')).toBeTruthy();
    expect(root.querySelector('.plate')).toBeNull();
  });
});
