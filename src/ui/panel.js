// The leak panel: the field counter, the grouped field list, an optional map
// link for a GPS fix, and the Wipe / Download controls.

import { el, mount } from './dom.js';
import { formatCoord } from '../exif/gps.js';

const IFD_ORDER = ['IFD0', 'EXIF', 'GPS', 'XMP', 'IPTC', 'APPn'];

/** Group parsed fields by their IFD, in a stable display order. */
function groupByIfd(fields) {
  const groups = new Map();
  for (const f of fields) {
    if (!groups.has(f.ifd)) groups.set(f.ifd, []);
    groups.get(f.ifd).push(f);
  }
  return [...groups.entries()].sort(
    (a, b) => IFD_ORDER.indexOf(a[0]) - IFD_ORDER.indexOf(b[0]),
  );
}

function fieldRow(f) {
  return el('div', { class: `field-row${f.sensitive ? ' is-sensitive' : ''}` }, [
    el('span', { class: 'field-row__name', text: f.name }),
    el('span', { class: 'field-row__value', text: f.display || '—' }),
    f.sensitive ? el('span', { class: 'field-row__flag', text: 'leak' }) : null,
  ]);
}

function geoBlock(coords) {
  const { lat, lng, altitude } = coords;
  const osm = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`;
  const alt =
    altitude != null && Number.isFinite(altitude)
      ? el('span', { class: 'geo__alt', text: `  ·  ${altitude.toFixed(1)} m` })
      : null;
  return el('div', { class: 'geo' }, [
    el('span', { class: 'geo__label', text: '⚑ This photo pins a location' }),
    el('span', { text: `${formatCoord(lat)}, ${formatCoord(lng)}` }),
    alt,
    el('br'),
    el('a', { href: osm, target: '_blank', rel: 'noopener', text: 'view on map ↗' }),
  ]);
}

/**
 * Render the leak panel.
 * @param {HTMLElement} host
 * @param {object} meta   parseMetadata result
 * @param {object} handlers  { onWipe, onReset, result, cleanUrl, cleanName }
 */
export function renderPanel(host, meta, handlers = {}) {
  const total = meta.fields.length;
  const leaks = meta.sensitiveCount;

  const head = el('div', { class: 'panel__head' }, [
    el('div', {
      class: 'panel__count',
      'aria-hidden': 'true',
      html: `${total} <span class="leaks">${leaks}</span>`,
    }),
    el('p', {
      class: 'panel__sub',
      // Announce the tally to screen readers when a photo is analyzed.
      role: 'status',
      'aria-live': 'polite',
      text: `${total} field${total === 1 ? '' : 's'} found · ${leaks} leaking identity or location`,
    }),
  ]);

  let body;
  if (total === 0) {
    body = el('div', { class: 'panel__body' }, [
      el('div', {
        class: 'panel__empty',
        text: 'Clean. This JPEG carries no EXIF, GPS or IPTC metadata.',
      }),
    ]);
  } else {
    const groups = groupByIfd(meta.fields).map(([ifd, fs]) =>
      el('div', { class: 'ifd-group' }, [
        el('div', { class: 'ifd-group__label', text: ifd }),
        ...fs.map(fieldRow),
      ]),
    );
    body = el('div', { class: 'panel__body' }, [
      meta.coordinates ? geoBlock(meta.coordinates) : null,
      ...groups,
    ]);
  }

  const foot = el('div', { class: 'panel__foot' });
  if (handlers.result) {
    foot.appendChild(
      el('div', { class: 'result', 'aria-live': 'polite', text: handlers.result }),
    );
    if (handlers.cleanUrl) {
      foot.appendChild(
        el('a', {
          class: 'btn btn--primary btn--full',
          href: handlers.cleanUrl,
          download: handlers.cleanName || 'clean.jpg',
          text: '↓ Download clean photo',
        }),
      );
    }
  } else {
    const wipe = el(
      'button',
      {
        class: 'btn btn--warn btn--full',
        onclick: handlers.onWipe,
        disabled: total === 0 ? '' : null,
      },
      total === 0 ? 'Nothing to wipe' : `Wipe ${total} metadata field${total === 1 ? '' : 's'}`,
    );
    foot.appendChild(wipe);
  }

  // A way back to the dropzone from any loaded state (loaded or wiped).
  if (handlers.onReset) {
    foot.appendChild(
      el(
        'button',
        { class: 'btn btn--ghost btn--full', onclick: handlers.onReset },
        '↺ Inspect another photo',
      ),
    );
  }

  const panel = el('aside', { class: 'panel', 'aria-label': 'Metadata leak report' }, [
    head,
    body,
    foot,
  ]);
  mount(host, panel);
}
