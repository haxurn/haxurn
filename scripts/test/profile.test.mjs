import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { encodeApng, encodePng } from '../lib/apng.mjs';
import { renderField } from '../lib/field.mjs';
import { parseContributions } from '../lib/github.mjs';
import { buildReadme, escapeHtml } from '../lib/readme.mjs';
import { createTypesetter } from '../lib/text.mjs';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const FULL_YEAR_WEEKS = Array.from({ length: 53 }, (_, week) =>
  Array.from({ length: 7 }, (_, day) => (week + day) % 5));

function chunkTypes(png) {
  const types = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    types.push(png.toString('latin1', offset + 4, offset + 8));
    offset += 12 + length;
  }
  return types;
}

test('parseContributions groups days into Sunday-first weeks and reads the total', () => {
  const html = `
    <td data-date="2026-11-02" id="b" data-level="3" class="x"></td>
    <td data-date="2026-11-01" id="a" data-level="1" class="x"></td>
    <td id="c" data-level="4" data-date="2026-11-08" class="x"></td>
    <h2>\n  1,234 contributions\n  in the last year\n</h2>`;

  const result = parseContributions(html);

  assert.equal(result.total, 1234);
  assert.deepEqual(result.weeks, [[1, 3, 0, 0, 0, 0, 0], [4, 0, 0, 0, 0, 0, 0]]);
});

test('parseContributions throws when GitHub markup carries no calendar', () => {
  assert.throws(() => parseContributions('<html>rate limited</html>'), /no contribution days/);
});

test('renderField stays inside the palette and is deterministic', () => {
  const options = { cols: 110, rows: 25, paletteSize: 5, phase: 0.3 };

  const first = renderField(FULL_YEAR_WEEKS, options);
  const second = renderField(FULL_YEAR_WEEKS, options);

  assert.equal(first.length, 110 * 25);
  assert.ok(first.every((index) => index >= 0 && index < 5));
  assert.deepEqual(first, second);
});

test('renderField loops seamlessly between phase 0 and phase 1', () => {
  const options = { cols: 60, rows: 14, paletteSize: 5 };

  assert.deepEqual(
    renderField(FULL_YEAR_WEEKS, { ...options, phase: 0 }),
    renderField(FULL_YEAR_WEEKS, { ...options, phase: 1 }),
  );
});

test('encodePng writes a static indexed PNG', () => {
  const png = encodePng({ width: 2, height: 2, palette: ['#000000', '#ffffff'], pixels: new Uint8Array([0, 1, 1, 0]) });

  assert.deepEqual(png.subarray(0, 8), PNG_SIGNATURE);
  assert.deepEqual(chunkTypes(png), ['IHDR', 'PLTE', 'IDAT', 'IEND']);
});

test('encodeApng declares every frame and orders chunks for decoders', () => {
  const frames = [new Uint8Array([0, 1, 1, 0]), new Uint8Array([1, 0, 0, 1]), new Uint8Array([1, 1, 0, 0])];

  const png = encodeApng({ width: 2, height: 2, palette: ['#000000', '#ffffff'], frames, fps: 12 });

  assert.deepEqual(chunkTypes(png), [
    'IHDR', 'PLTE', 'acTL', 'fcTL', 'IDAT', 'fcTL', 'fdAT', 'fcTL', 'fdAT', 'IEND',
  ]);
  const actlOffset = png.indexOf('acTL', 0, 'latin1') + 4;
  assert.equal(png.readUInt32BE(actlOffset), 3);
});

test('typesetter measures, outlines, and ellipsizes text to fit', async () => {
  const type = createTypesetter(await readFile(new URL('../../fonts/JetBrainsMono-Medium.ttf', import.meta.url)));
  const long = 'one two three four five six seven eight nine ten';

  const lines = type.wrap(long, 12, 100, 2);

  assert.equal(lines.length, 2);
  assert.ok(lines[1].endsWith('…'));
  assert.ok(lines.every((line) => type.width(line, 12) <= 100));
  assert.match(type.path('A', 0, 0, 12), /^M/);
});

test('typesetter rejects characters the font cannot draw instead of rendering tofu', async () => {
  const type = createTypesetter(await readFile(new URL('../../fonts/JetBrainsMono-Medium.ttf', import.meta.url)));

  assert.throws(() => type.path('★ 2', 0, 0, 12), /no glyph for "★"/);
});

test('escapeHtml neutralizes markup in alt text', () => {
  assert.equal(escapeHtml(`a"<b>&'`), 'a&quot;&lt;b&gt;&amp;&#39;');
});

test('buildReadme emits themed pictures with a light and dark source per panel', () => {
  const readme = buildReadme({
    version: 'abc',
    header: { name: 'header', alt: 'Samson <T>' },
    cards: [{ name: 'card-01', alt: 'Axova', url: 'https://www.axova.io' }],
    ledger: { name: 'repos', alt: 'Repos', url: 'https://github.com/haxurn?tab=repositories' },
    links: [{ name: 'link-01', alt: 'Website', url: 'https://www.haxurn.space' }],
  });

  assert.match(readme, /media="\(prefers-color-scheme: dark\)" srcset="\.\/profile\/generated\/header-dark\.svg\?v=abc"/);
  assert.match(readme, /media="\(prefers-color-scheme: light\)" srcset="\.\/profile\/generated\/header-light\.svg\?v=abc"/);
  assert.match(readme, /alt="Samson &lt;T&gt;"/);
  assert.match(readme, /<a href="https:\/\/www\.axova\.io"><picture>/);
});
