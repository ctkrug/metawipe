// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderPanel } from '../src/ui/panel.js';
import { parseMetadata } from '../src/exif/parse.js';
import { jpegWithExif, jpegBare } from './fixtures.js';

describe('renderPanel', () => {
  let host;
  beforeEach(() => {
    host = document.createElement('div');
  });

  it('shows the field tally and a grouped, flagged field list', () => {
    const meta = parseMetadata(jpegWithExif());
    renderPanel(host, meta, { onWipe: () => {}, onReset: () => {} });

    expect(host.querySelector('.panel__count').textContent).toContain(String(meta.fields.length));
    // GPS is grouped and flagged.
    expect(host.textContent).toContain('GPS');
    expect(host.querySelector('.field-row.is-sensitive')).toBeTruthy();
    // Live region announces the tally.
    expect(host.querySelector('[role="status"]')).toBeTruthy();
  });

  it('renders a map link for a GPS-tagged photo', () => {
    const meta = parseMetadata(jpegWithExif());
    renderPanel(host, meta, {});
    const link = host.querySelector('.geo a');
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toMatch(/openstreetmap\.org/);
  });

  it('shows an altitude readout when the fix carries one', () => {
    const meta = {
      fields: [{ ifd: 'GPS', name: 'GPSLatitude', display: '…', sensitive: true }],
      sensitiveCount: 1,
      coordinates: { lat: 37.8, lng: -122.2, altitude: 84.3 },
    };
    renderPanel(host, meta, {});
    expect(host.querySelector('.geo__alt').textContent).toMatch(/84\.3 m/);
  });

  it('omits the altitude readout when there is none', () => {
    const meta = {
      fields: [{ ifd: 'GPS', name: 'GPSLatitude', display: '…', sensitive: true }],
      sensitiveCount: 1,
      coordinates: { lat: 37.8, lng: -122.2, altitude: null },
    };
    renderPanel(host, meta, {});
    expect(host.querySelector('.geo__alt')).toBeNull();
  });

  it('renders a designed empty state and disabled wipe for a clean JPEG', () => {
    const meta = parseMetadata(jpegBare());
    renderPanel(host, meta, { onWipe: () => {}, onReset: () => {} });
    expect(host.querySelector('.panel__empty')).toBeTruthy();
    expect(host.querySelector('.btn--warn').disabled).toBe(true);
    // No empty/placeholder map box when there are no coordinates.
    expect(host.querySelector('.geo')).toBeNull();
  });

  it('fires onWipe when the wipe button is clicked', () => {
    const meta = parseMetadata(jpegWithExif());
    let wiped = false;
    renderPanel(host, meta, { onWipe: () => (wiped = true), onReset: () => {} });
    host.querySelector('.btn--warn').click();
    expect(wiped).toBe(true);
  });

  it('shows the result and a download link after a wipe', () => {
    const meta = parseMetadata(jpegBare());
    renderPanel(host, meta, {
      result: '✓ Wiped 1 segment · 1.20 KB of hidden data removed.',
      cleanUrl: 'blob:fake',
      cleanName: 'photo-clean.jpg',
      onReset: () => {},
    });
    expect(host.querySelector('.result').textContent).toMatch(/Wiped/);
    const dl = host.querySelector('a[download]');
    expect(dl.getAttribute('download')).toBe('photo-clean.jpg');
  });

  it('renders an em-dash for a field with no display value', () => {
    const meta = {
      fields: [{ ifd: 'IFD0', name: 'Make', display: '', sensitive: false }],
      sensitiveCount: 0,
      coordinates: null,
    };
    renderPanel(host, meta, {});
    expect(host.querySelector('.field-row__value').textContent).toBe('—');
  });

  it('falls back to a default download name when none is given', () => {
    renderPanel(host, parseMetadata(jpegBare()), {
      result: '✓ Wiped 1 segment.',
      cleanUrl: 'blob:fake',
      onReset: () => {},
    });
    expect(host.querySelector('a[download]').getAttribute('download')).toBe('clean.jpg');
  });

  it('offers a reset control whenever onReset is provided', () => {
    const meta = parseMetadata(jpegWithExif());
    let reset = false;
    renderPanel(host, meta, { onWipe: () => {}, onReset: () => (reset = true) });
    const btn = [...host.querySelectorAll('button')].find((b) => /another photo/i.test(b.textContent));
    expect(btn).toBeTruthy();
    btn.click();
    expect(reset).toBe(true);
  });
});
