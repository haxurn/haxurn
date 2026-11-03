import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { encodeApng, encodePng } from '../lib/apng.mjs';
import { renderAurora } from '../lib/aurora.mjs';
import { levelFills, mixHex, monthMarkers, renderCalendarGrid } from '../lib/calendar.mjs';
import { parseContributions } from '../lib/github.mjs';
import { iconMarkup } from '../lib/icons.mjs';
import { buildReadme, escapeHtml } from '../lib/readme.mjs';
import { createTypesetter } from '../lib/text.mjs';

const FONT_URL = new URL('../../fonts/JetBrainsMono-Medium.ttf', import.meta.url);
const THEME = { bg: '#000000', accent: '#ffffff', surface2: '#111111' };

function chunkTypes(png) {
  const types = [];
  for (let offset = 8; offset < png.length;) {
    types.push(png.toString('latin1', offset + 4, offset + 8));
    offset += 12 + png.readUInt32BE(offset);
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
  assert.equal(result.start, '2026-11-01');
  assert.deepEqual(result.weeks, [[1, 3, 0, 0, 0, 0, 0], [4, 0, 0, 0, 0, 0, 0]]);
});

test('parseContributions throws when GitHub markup carries no calendar', () => {
  assert.throws(() => parseContributions('<html>rate limited</html>'), /no contribution days/);
});

test('mixHex blends channels and levelFills steps from empty to full accent', () => {
  assert.equal(mixHex('#000000', '#ffffff', 0.5), '#808080');
  assert.deepEqual(levelFills(THEME), ['#111111', '#404040', '#808080', '#bfbfbf', '#ffffff']);
});

test('monthMarkers labels each month once and skips a partial first month', () => {
  const markers = monthMarkers('2025-10-26', 53);

  assert.equal(markers[0].month, 'Nov');
  assert.equal(new Set(markers.map(({ month }) => month)).size, markers.length);
  assert.ok(markers.every((marker, index) => !index || marker.week - markers[index - 1].week >= 3));
});

test('monthMarkers rejects a missing start date instead of drawing "Invalid Date"', () => {
  assert.throws(() => monthMarkers(undefined, 53), /Invalid calendar start date/);
});

test('renderCalendarGrid draws one cell per day with the fill for its level', () => {
  const weeks = [[0, 1, 2, 3, 4, 0, 0], [4, 0, 0, 0, 0, 0, 0]];

  const { markup } = renderCalendarGrid({
    weeks, start: '2026-01-04', theme: THEME, caption: () => '', x: 0, y: 0, width: 100,
  });

  assert.equal(markup.match(/<rect /g).length, 14);
  assert.equal(markup.match(/fill="#ffffff"/g).length, 2);
  assert.equal(markup.match(/class="w"/g).length, 2);
});

test('iconMarkup draws stroked Lucide, filled Simple Icons, and local marks', () => {
  assert.match(iconMarkup('lucide:star', 0, 0, 24, '#123456'), /fill="none" stroke="#123456"/);
  assert.match(iconMarkup('si:x', 0, 0, 24, '#123456'), /^<g [^>]*fill="#123456"/);
  assert.match(iconMarkup('local:linkedin', 0, 0, 24, '#123456'), /color="#123456"/);
});

test('iconMarkup fails loudly for an unknown icon', () => {
  assert.throws(() => iconMarkup('lucide:not-a-real-icon', 0, 0, 24, '#000000'), /ENOENT/);
  assert.throws(() => iconMarkup('nope:star', 0, 0, 24, '#000000'), /Unknown icon set/);
});

test('renderAurora stays inside the palette and is deterministic', () => {
  const options = { cols: 110, rows: 26, paletteSize: 6, phase: 0.3 };

  const first = renderAurora(options);

  assert.equal(first.length, 110 * 26);
  assert.ok(first.every((index) => index < 6));
  assert.deepEqual(first, renderAurora(options));
});

test('renderAurora loops seamlessly and moves between frames', () => {
  const options = { cols: 60, rows: 14, paletteSize: 6 };
  const start = renderAurora({ ...options, phase: 0 });

  assert.deepEqual(start, renderAurora({ ...options, phase: 1 }));
  assert.notDeepEqual(start, renderAurora({ ...options, phase: 0.5 }));
});

test('renderAurora draws a band with dark sky above and below and a bright core', () => {
  const cols = 220;
  const rows = 52;
  const pixels = renderAurora({ cols, rows, paletteSize: 6, phase: 0 });
  const rowPeak = (row) => Math.max(...pixels.subarray(row * cols, (row + 1) * cols));

  assert.equal(rowPeak(rows - 1), 0);
  assert.ok(rowPeak(0) <= 1);
  assert.equal(Math.max(...pixels), 5);
});

test('renderAurora keeps a bright core in every frame of the loop', () => {
  const cols = 220;
  const rows = 52;
  const counts = Array.from({ length: 24 }, (_, index) =>
    renderAurora({ cols, rows, paletteSize: 6, phase: index / 24 }).filter((value) => value >= 4).length);

  assert.ok(Math.min(...counts) > 500, `dimmest frame has ${Math.min(...counts)} bright cells`);
});

test('encodePng writes a static indexed PNG', () => {
  const png = encodePng({ width: 2, height: 2, palette: ['#000000', '#ffffff'], pixels: new Uint8Array([0, 1, 1, 0]) });

  assert.deepEqual(chunkTypes(png), ['IHDR', 'PLTE', 'IDAT', 'IEND']);
});

test('encodeApng declares every frame and orders chunks for decoders', () => {
  const frames = [new Uint8Array([0, 1, 1, 0]), new Uint8Array([1, 0, 0, 1]), new Uint8Array([1, 1, 0, 0])];

  const png = encodeApng({ width: 2, height: 2, palette: ['#000000', '#ffffff'], frames, fps: 12 });

  assert.deepEqual(chunkTypes(png), [
    'IHDR', 'PLTE', 'acTL', 'fcTL', 'IDAT', 'fcTL', 'fdAT', 'fcTL', 'fdAT', 'IEND',
  ]);
  assert.equal(png.readUInt32BE(png.indexOf('acTL', 0, 'latin1') + 4), 3);
});

test('typesetter measures, outlines, and ellipsizes text to fit', async () => {
  const type = createTypesetter(await readFile(FONT_URL));
  const long = 'one two three four five six seven eight nine ten';

  const lines = type.wrap(long, 12, 100, 2);

  assert.equal(lines.length, 2);
  assert.ok(lines[1].endsWith('…'));
  assert.ok(lines.every((line) => type.width(line, 12) <= 100));
  assert.match(type.path('A', 0, 0, 12), /^M/);
});

test('typesetter rejects characters the font cannot draw instead of rendering tofu', async () => {
  const type = createTypesetter(await readFile(FONT_URL));

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
    stack: { name: 'stack', alt: 'Stack', url: 'https://www.haxurn.space/#stack' },
    ledger: { name: 'repos', alt: 'Repos', url: 'https://github.com/haxurn?tab=repositories' },
    links: [{ name: 'link-01', alt: 'Website', url: 'https://www.haxurn.space' }],
  });

  assert.match(readme, /media="\(prefers-color-scheme: dark\)" srcset="\.\/profile\/generated\/header-dark\.svg\?v=abc"/);
  assert.match(readme, /media="\(prefers-color-scheme: light\)" srcset="\.\/profile\/generated\/header-light\.svg\?v=abc"/);
  assert.match(readme, /alt="Samson &lt;T&gt;"/);
  assert.match(readme, /<a href="https:\/\/www\.axova\.io"><picture>/);
  assert.match(readme, /stack-dark\.svg/);
});
