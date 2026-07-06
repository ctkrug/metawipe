// The light-table: the empty dropzone, the loaded image plate, the diagnostic
// scan sweep, and the metadata pins overlaid on the image.

import { el, mount } from './dom.js';

const RETICLE = `
  <svg viewBox="0 0 96 96" width="84" height="84" fill="none" aria-hidden="true">
    <circle cx="48" cy="48" r="26" stroke="currentColor" stroke-width="2" opacity="0.6"/>
    <circle cx="48" cy="48" r="40" stroke="currentColor" stroke-width="1" stroke-dasharray="4 6" opacity="0.4"/>
    <path d="M48 4v18M48 74v18M4 48h18M74 48h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <circle cx="48" cy="48" r="3" fill="currentColor"/>
  </svg>`;

/** Render the empty dropzone into the light-table container. */
export function renderDropzone(stage, onBrowse) {
  const input = el('input', {
    type: 'file',
    accept: 'image/jpeg,image/jpg',
    style: 'display:none',
    onchange: (e) => e.target.files[0] && onBrowse(e.target.files[0]),
  });
  const zone = el('div', { class: 'dropzone' }, [
    el('div', { class: 'dropzone__reticle', html: RETICLE }),
    el('h2', { text: 'Drop a photo. Nothing leaves this tab.' }),
    el('p', {
      text: 'Metawipe reads every EXIF, GPS and device field a JPEG is carrying, right here in your browser — then strips it on your command.',
    }),
    el(
      'button',
      { class: 'btn btn--primary dropzone__browse', onclick: () => input.click() },
      'Choose a photo',
    ),
    input,
  ]);
  mount(stage, zone);
}

// Pin anchor points around the image (percentage coords), so pins spread out
// instead of stacking. Cycles if there are more fields than anchors.
const ANCHORS = [
  [22, 16], [72, 12], [86, 34], [80, 62], [64, 84],
  [34, 88], [14, 66], [10, 38], [46, 20], [54, 74],
];

/**
 * Render the loaded image with pins for the most notable fields.
 * @param {HTMLElement} stage
 * @param {string} objectUrl  object URL for the image
 * @param {Array} fields      parsed field list (name/display/sensitive)
 * @param {boolean} animate   run the scan sweep + pin drop-in
 */
export function renderPlate(stage, objectUrl, fields, animate = true) {
  const frame = el('div', { class: 'plate__frame' });
  const img = el('img', { src: objectUrl, alt: 'The photo being inspected' });
  frame.appendChild(img);

  const scan = el('div', { class: 'scanline' });
  frame.appendChild(scan);

  // Pick up to 8 notable fields — sensitive first — to pin.
  const notable = [...fields]
    .sort((a, b) => Number(b.sensitive) - Number(a.sensitive))
    .slice(0, 8);

  notable.forEach((f, i) => {
    const [x, y] = ANCHORS[i % ANCHORS.length];
    const pin = el(
      'div',
      {
        class: `pin${f.sensitive ? ' is-sensitive' : ''}`,
        style: `left:${x}%; top:${y}%; animation-delay:${animate ? 120 + i * 70 : 0}ms`,
      },
      `${f.name}`,
    );
    if (!animate) pin.style.animation = 'none', (pin.style.opacity = '1');
    frame.appendChild(pin);
  });

  const plate = el('div', { class: 'plate' }, [frame]);
  mount(stage, plate);

  if (animate && !prefersReducedMotion()) {
    // Trigger the sweep on the next frame so the animation restarts cleanly.
    requestAnimationFrame(() => scan.classList.add('run'));
  } else {
    scan.remove();
  }
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
