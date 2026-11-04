import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { renderBanner } from '../lib/banner.mjs';
import { levelFills, monthMarkers, renderCalendarGrid } from '../lib/calendar.mjs';
import { parseContributions } from '../lib/github.mjs';
import { iconMarkup } from '../lib/icons.mjs';
import { buildReadme, escapeHtml } from '../lib/readme.mjs';
import { createTypesetter } from '../lib/text.mjs';

const FONT_URL = new URL('../../fonts/JetBrainsMono-Medium.ttf', import.meta.url);
const THEME = { contrib: ['#111111', '#404040', '#808080', '#bfbfbf', '#ffffff'] };

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

test('levelFills reads the theme contribution scale', () => {
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

test('renderBanner is deterministic and draws inside its box', () => {
  const options = { pattern: 'rain', width: 880, height: 88, ink: '#51e674', muted: '#2c322d' };

  const markup = renderBanner(options);

  assert.equal(markup, renderBanner(options));
  assert.match(markup, /fill="#51e674"/);
  const ys = [...markup.matchAll(/ y="([\d.]+)"/g)].map(([, y]) => Number(y));
  assert.ok(ys.length > 20);
  assert.ok(ys.every((y) => y >= 0 && y < 88));
});

test('renderBanner gives each mode its own pattern and rejects an unknown one', () => {
  const options = { width: 880, height: 88, ink: '#000000', muted: '#ffffff' };

  assert.notEqual(renderBanner({ ...options, pattern: 'rain' }), renderBanner({ ...options, pattern: 'code' }));
  assert.throws(() => renderBanner({ ...options, pattern: 'nope' }), /Unknown banner pattern/);
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
    activity: { name: 'activity', alt: 'Activity', url: 'https://github.com/haxurn' },
    stack: { name: 'stack', alt: 'Stack', url: 'https://www.haxurn.space/skills' },
    ledger: { name: 'repos', alt: 'Repos', url: 'https://github.com/haxurn?tab=repositories' },
    links: [{ name: 'link-01', alt: 'Website', url: 'https://www.haxurn.space' }],
  });

  assert.match(readme, /media="\(prefers-color-scheme: dark\)" srcset="\.\/profile\/generated\/header-dark\.svg\?v=abc"/);
  assert.match(readme, /media="\(prefers-color-scheme: light\)" srcset="\.\/profile\/generated\/header-light\.svg\?v=abc"/);
  assert.match(readme, /alt="Samson &lt;T&gt;"/);
  assert.match(readme, /<a href="https:\/\/www\.axova\.io"><picture>/);
  assert.match(readme, /activity-dark\.svg/);
  assert.match(readme, /stack-dark\.svg/);
  assert.match(readme, /<img src="\.\/profile\/generated\/header-light\.svg\?v=abc"/);
});
