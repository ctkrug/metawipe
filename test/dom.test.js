// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { el, mount } from '../src/ui/dom.js';

describe('el', () => {
  it('sets class, text and arbitrary attributes', () => {
    const node = el('div', { class: 'box', text: 'hi', 'aria-label': 'greeting' });
    expect(node.className).toBe('box');
    expect(node.textContent).toBe('hi');
    expect(node.getAttribute('aria-label')).toBe('greeting');
  });

  it('wires on* props as event listeners', () => {
    let clicked = false;
    const btn = el('button', { onclick: () => (clicked = true) });
    btn.dispatchEvent(new Event('click'));
    expect(clicked).toBe(true);
  });

  it('applies a dataset object', () => {
    const node = el('div', { dataset: { tag: '42', kind: 'exif' } });
    expect(node.dataset.tag).toBe('42');
    expect(node.dataset.kind).toBe('exif');
  });

  it('skips null/undefined props and children', () => {
    const node = el('div', { class: null, title: undefined }, ['a', null, 'b']);
    expect(node.hasAttribute('title')).toBe(false);
    expect(node.textContent).toBe('ab');
  });

  it('accepts a single child that is not an array', () => {
    const node = el('span', {}, 'solo');
    expect(node.textContent).toBe('solo');
  });
});

describe('mount', () => {
  it('replaces existing children and filters falsy nodes', () => {
    const host = el('div', {}, [el('span', { text: 'old' })]);
    mount(host, el('p', { text: 'new' }), null, el('p', { text: 'also' }));
    expect(host.querySelectorAll('p').length).toBe(2);
    expect(host.querySelector('span')).toBeNull();
  });

  it('clears all children when called with none', () => {
    const host = el('div', {}, [el('span', {})]);
    mount(host);
    expect(host.children.length).toBe(0);
  });
});
