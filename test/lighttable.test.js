// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderDropzone, renderPlate } from '../src/ui/lighttable.js';

describe('renderDropzone', () => {
  let stage;
  beforeEach(() => {
    stage = document.createElement('div');
  });

  it('renders the crosshair dropzone with a browse control', () => {
    renderDropzone(stage, () => {});
    expect(stage.querySelector('.dropzone')).toBeTruthy();
    expect(stage.querySelector('.dropzone__reticle svg')).toBeTruthy();
    expect(stage.querySelector('button')).toBeTruthy();
    expect(stage.querySelector('input[type="file"]')).toBeTruthy();
  });

  it('invokes the callback when a file is chosen', () => {
    let picked = null;
    renderDropzone(stage, (f) => (picked = f));
    const input = stage.querySelector('input[type="file"]');
    const file = { name: 'x.jpg' };
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    expect(picked).toBe(file);
  });
});

describe('renderPlate', () => {
  let stage;
  beforeEach(() => {
    stage = document.createElement('div');
  });

  const fields = [
    { name: 'GPSLatitude', sensitive: true },
    { name: 'Make', sensitive: false },
  ];

  it('renders the image and one decorative pin per notable field', () => {
    renderPlate(stage, 'blob:fake', fields, false);
    expect(stage.querySelector('.plate img').getAttribute('src')).toBe('blob:fake');
    const pins = stage.querySelectorAll('.pin');
    expect(pins.length).toBe(fields.length);
    // Pins are hidden from the a11y tree (the panel is the source of truth).
    expect([...pins].every((p) => p.getAttribute('aria-hidden') === 'true')).toBe(true);
  });

  it('orders sensitive fields first and flags them', () => {
    renderPlate(stage, 'blob:fake', fields, false);
    const first = stage.querySelector('.pin');
    expect(first.classList.contains('is-sensitive')).toBe(true);
  });

  it('caps pins at eight even with many fields', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ name: `T${i}`, sensitive: false }));
    renderPlate(stage, 'blob:fake', many, false);
    expect(stage.querySelectorAll('.pin').length).toBe(8);
  });
});
