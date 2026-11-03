import { escapeHtml } from './readme.mjs';

const WIDTH = 880;
const CARD_WIDTH = WIDTH / 2;
const LINK_WIDTH = WIDTH / 4;
const LINK_HEIGHT = 60;
const STRIP_HEIGHT = 40;
const MARGIN = 24;
const CAPTION = { size: 10.5, tracking: 0.12 };

const FIELD_HEIGHT = 196;
const HEADER_HEIGHT = 468;
const STATS_X = 610;

const CARD_IMAGE_HEIGHT = 196;
const CARD_HEIGHT = 440;
const CARD_FOOTER_HEIGHT = 56;

const LEDGER_HEAD_HEIGHT = 34;
const LEDGER_ROW_HEIGHT = 42;
const LEDGER_COLUMNS = { name: MARGIN, summary: 232, language: 668, stars: WIDTH - MARGIN };

const formatCount = (value) => (value === null || value === undefined ? '—' : value.toLocaleString('en-US'));

function createCanvas(type, theme) {
  const text = (value, x, y, size, fill, { tracking = 0, anchor = 'start' } = {}) => {
    const start = anchor === 'end' ? x - type.width(value, size, tracking) : x;
    return `<path fill="${fill}" d="${type.path(value, start, y, size, tracking)}"/>`;
  };
  const caption = (value, x, y, fill = theme.fgSubtle, anchor = 'start') =>
    text(value.toUpperCase(), x, y, CAPTION.size, fill, { tracking: CAPTION.tracking, anchor });
  const hline = (y, x1 = 0, x2 = WIDTH) => `<rect x="${x1}" y="${y}" width="${x2 - x1}" height="1" fill="${theme.border}"/>`;
  const vline = (x, y1, y2) => `<rect x="${x}" y="${y1}" width="1" height="${y2 - y1}" fill="${theme.border}"/>`;

  /** File tab from the site's section heads: green index, then the label. */
  const fileTab = (index, label, right, width) => {
    const indexWidth = type.width(`${index}  `, CAPTION.size, CAPTION.tracking);
    return [
      `<rect width="${width}" height="${STRIP_HEIGHT}" fill="${theme.surface2}"/>`,
      caption(index, MARGIN, 24, theme.accentInk),
      caption(label, MARGIN + indexWidth, 24, theme.fg),
      caption(right, width - MARGIN, 24, theme.fgSubtle, 'end'),
      hline(STRIP_HEIGHT, 0, width),
    ].join('');
  };

  return { text, caption, hline, vline, fileTab };
}

function svg(width, height, label, theme, body, style = '') {
  const safeStyle = style ? `<style>${style}</style>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(label)}">`
    + safeStyle
    + `<rect width="${width}" height="${height}" fill="${theme.bg}"/>${body}`
    + `<rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" fill="none" stroke="${theme.border}"/></svg>`;
}

function heading(artwork, value, x, y, size, fill) {
  const scale = size / 100;
  return `<path fill="${fill}" transform="translate(${x} ${y}) scale(${scale})" d="${artwork[value].d}"/>`;
}

function stamp(canvas, theme, label, x, y) {
  const width = 92;
  const height = 30;
  return `<g transform="rotate(-6 ${x + width / 2} ${y + height / 2})">`
    + `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${theme.bg}" stroke="${theme.accentInk}"/>`
    + `<rect x="${x + 3}" y="${y + 3}" width="${width - 6}" height="${height - 6}" fill="none" stroke="${theme.accentInk}"/>`
    + canvas.caption(label, x + 19, y + 19, theme.accentInk)
    + '</g>';
}

function statCell(canvas, theme, label, value, x, y) {
  return canvas.caption(label, x + 20, y + 32) + canvas.text(value, x + 20, y + 62, 20, theme.fg);
}

export function renderHeader({ type, theme, artwork, person, data, field }) {
  const canvas = createCanvas(type, theme);
  const bottom = STRIP_HEIGHT + FIELD_HEIGHT;
  const fieldImage = 'width="880" height="196" preserveAspectRatio="none" style="image-rendering:pixelated"';
  const captionText = person.fieldCaption.toUpperCase();
  const captionWidth = type.width(captionText, CAPTION.size, CAPTION.tracking) + 24;
  const statRows = [bottom, bottom + (HEADER_HEIGHT - bottom) / 2];
  const statColumns = [STATS_X, STATS_X + (WIDTH - STATS_X) / 2];

  const body = [
    canvas.fileTab('00', 'Personnel file', person.location, WIDTH),
    `<g transform="translate(0 ${STRIP_HEIGHT})"><image class="still" ${fieldImage} href="data:image/png;base64,${field.still}"/>`,
    `<image class="live" ${fieldImage} href="data:image/png;base64,${field.animated}"/></g>`,
    `<rect x="${MARGIN}" y="${bottom - 34}" width="${captionWidth}" height="22" fill="${theme.bg}"/>`,
    canvas.caption(person.fieldCaption, MARGIN + 12, bottom - 19, theme.fgMuted),
    stamp(canvas, theme, 'On file', WIDTH - 128, STRIP_HEIGHT + 22),
    canvas.hline(bottom),
    canvas.caption(person.alias, MARGIN, bottom + 34, theme.accentInk),
    heading(artwork, person.name, MARGIN - 2, bottom + 100, 72, theme.fg),
    canvas.text(person.role, MARGIN, bottom + 138, 15, theme.fgMuted),
    canvas.caption(person.disciplines.join(' / '), MARGIN, bottom + 170),
    `<circle class="pulse" cx="${MARGIN + 4}" cy="${bottom + 198}" r="4" fill="${theme.accent}"/>`,
    canvas.caption(person.focus, MARGIN + 18, bottom + 202, theme.fgMuted),
    canvas.vline(STATS_X, bottom, HEADER_HEIGHT),
    canvas.vline(statColumns[1], bottom, HEADER_HEIGHT),
    canvas.hline(statRows[1], STATS_X, WIDTH),
    statCell(canvas, theme, 'Repos', formatCount(data.user.publicRepos), statColumns[0], statRows[0]),
    statCell(canvas, theme, 'Followers', formatCount(data.user.followers), statColumns[1], statRows[0]),
    statCell(canvas, theme, 'Contributions', formatCount(data.contributions.total), statColumns[0], statRows[1]),
    statCell(canvas, theme, 'Status', 'Active', statColumns[1], statRows[1]),
  ].join('');

  const style = '.pulse{animation:pulse 1.6s ease-in-out infinite}@keyframes pulse{50%{opacity:.25}}'
    + '@media (prefers-reduced-motion:reduce){.live{display:none}.pulse{animation:none}}';
  return svg(WIDTH, HEADER_HEIGHT, `${person.name}, ${person.role}`, theme, body, style);
}

export function renderCard({ type, theme, artwork, project, index, imageData }) {
  const canvas = createCanvas(type, theme);
  const footerY = CARD_HEIGHT - CARD_FOOTER_HEIGHT;
  const imageBottom = STRIP_HEIGHT + CARD_IMAGE_HEIGHT;
  const summary = type.wrap(project.summary, 12.5, CARD_WIDTH - MARGIN * 2, 3);
  const cta = `${project.cta.toUpperCase()} ↗`;
  const ctaWidth = type.width(cta, CAPTION.size, CAPTION.tracking) + 28;
  const ctaX = CARD_WIDTH - MARGIN - ctaWidth;

  const body = [
    canvas.fileTab(index, project.title, project.meta, CARD_WIDTH),
    `<image x="0" y="${STRIP_HEIGHT}" width="${CARD_WIDTH}" height="${CARD_IMAGE_HEIGHT}" preserveAspectRatio="xMidYMin slice" href="data:image/jpeg;base64,${imageData}"/>`,
    canvas.hline(imageBottom, 0, CARD_WIDTH),
    heading(artwork, project.title, MARGIN - 1, imageBottom + 46, 32, theme.fg),
    ...summary.map((line, row) => canvas.text(line, MARGIN, imageBottom + 76 + row * 19, 12.5, theme.fgMuted)),
    canvas.hline(footerY, 0, CARD_WIDTH),
    canvas.caption(project.role, MARGIN, footerY + 32),
    `<rect x="${ctaX}" y="${footerY + 13}" width="${ctaWidth}" height="30" rx="4" fill="${theme.accent}"/>`,
    canvas.caption(cta, ctaX + 14, footerY + 32, theme.accentFg),
  ].join('');
  return svg(CARD_WIDTH, CARD_HEIGHT, `${project.title}: ${project.summary}`, theme, body);
}

export function renderLedger({ type, theme, repos, data }) {
  const canvas = createCanvas(type, theme);
  const columns = LEDGER_COLUMNS;
  const headY = STRIP_HEIGHT + LEDGER_HEAD_HEIGHT;
  const height = headY + repos.length * LEDGER_ROW_HEIGHT;
  const summaryWidth = columns.language - columns.summary - MARGIN;

  const rows = repos.flatMap(({ name, summary }, row) => {
    const y = headY + row * LEDGER_ROW_HEIGHT;
    const live = data.repos[name];
    return [
      canvas.hline(y),
      canvas.text(name, columns.name, y + 26, 12.5, theme.fg),
      canvas.text(type.wrap(summary, 12, summaryWidth, 1)[0], columns.summary, y + 26, 12, theme.fgMuted),
      canvas.text(live.language ?? '—', columns.language, y + 26, 12, theme.fgSubtle),
      canvas.text(String(live.stars), columns.stars, y + 26, 12, theme.accentInk, { anchor: 'end' }),
    ];
  });

  const body = [
    canvas.fileTab('03', 'Also on file', `${repos.length} records`, WIDTH),
    canvas.caption('Repository', columns.name, STRIP_HEIGHT + 22),
    canvas.caption('Summary', columns.summary, STRIP_HEIGHT + 22),
    canvas.caption('Language', columns.language, STRIP_HEIGHT + 22),
    canvas.caption('Stars', columns.stars, STRIP_HEIGHT + 22, theme.fgSubtle, 'end'),
    ...rows,
  ].join('');
  return svg(WIDTH, height, 'Selected repositories', theme, body);
}

export function renderLink({ type, theme, label }) {
  const canvas = createCanvas(type, theme);
  const body = canvas.caption(label, 20, LINK_HEIGHT / 2 + 4, theme.fg)
    + canvas.caption('↗', LINK_WIDTH - 20, LINK_HEIGHT / 2 + 4, theme.accentInk, 'end');
  return svg(LINK_WIDTH, LINK_HEIGHT, label, theme, body);
}

export const FIELD_PIXEL_SIZE = { cols: WIDTH / 4, rows: FIELD_HEIGHT / 4 };
