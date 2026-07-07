import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Metawipe's defining promise is that nothing leaves the tab. This is a static
// source audit: no module under src/ may open a network channel of any kind.
// If someone adds a fetch/beacon/socket, this test fails before it ships.

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

function collect(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...collect(path));
    else if (path.endsWith('.js')) out.push(path);
  }
  return out;
}

// Egress primitives that would send bytes off the device.
const BANNED = [
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bEventSource\b/,
  /navigator\.sendBeacon/,
  /\bimportScripts\s*\(/,
];

describe('no network egress', () => {
  const files = collect(srcDir);

  it('finds source files to audit', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(BANNED.map((re) => [re.source, re]))(
    'no src/ module uses %s',
    (_label, re) => {
      const offenders = files.filter((f) => re.test(readFileSync(f, 'utf8')));
      expect(offenders).toEqual([]);
    },
  );
});
