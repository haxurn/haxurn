import { CALENDAR_STYLE, renderCalendarGrid, renderLegend } from './calendar.mjs';
import { iconMarkup } from './icons.mjs';
import { escapeHtml } from './readme.mjs';

const WIDTH = 880;
const CARD_WIDTH = WIDTH / 2;
const LINK_WIDTH = WIDTH / 4;
const LINK_HEIGHT = 64;
const STRIP_HEIGHT = 44;
const MARGIN = 28;
const CAPTION = { size: 10.5, tracking: 0.12 };

const AURORA_HEIGHT = 208;
const AURORA_PIXEL = 4;
const IDENTITY_HEIGHT = 204;
const DISCIPLINE_HEIGHT = 52;
const CALENDAR_TOP = 44;
const CALENDAR_BOTTOM = 56;
const STATS_X = 610;

const CARD_IMAGE_HEIGHT = 196;
const CARD_HEIGHT = 424;
const CARD_FOOTER_HEIGHT = 60;

const STACK_ROW_HEIGHT = 58;
const LEDGER_ROW_HEIGHT = 48;
const LEDGER_COLUMNS = { icon: MARGIN, name: 56, summary: 268, language: 680, stars: WIDTH - MARGIN };

const PENDING_SECONDS = 1.2;

export const AURORA_GRID = { cols: WIDTH / AURORA_PIXEL, rows: AURORA_HEIGHT / AURORA_PIXEL };

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

  /** Panel head: icon and label on the left, quiet metadata on the right. */
  const panelHead = (icon, label, right, width) => [
    `<rect width="${width}" height="${STRIP_HEIGHT}" fill="${theme.surface2}"/>`,
    iconMarkup(icon, MARGIN, 14, 16, theme.accentInk),
    caption(label, MARGIN + 26, 26, theme.fg),
    caption(right, width - MARGIN, 26, theme.fgSubtle, 'end'),
    hline(STRIP_HEIGHT, 0, width),
  ].join('');

  return { text, caption, hline, vline, panelHead };
}

function svg(width, height, label, theme, body, style = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(label)}">`
    + (style ? `<style>${style}</style>` : '')
    + `<rect width="${width}" height="${height}" fill="${theme.bg}"/>${body}`
    + `<rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" fill="none" stroke="${theme.border}"/></svg>`;
}

function heading(artwork, value, x, y, size, fill) {
  return `<path fill="${fill}" transform="translate(${x} ${y}) scale(${size / 100})" d="${artwork[value].d}"/>`;
}

function stamp(canvas, theme, label, x, y) {
  const width = 88;
  const height = 28;
  return `<g transform="rotate(-6 ${x + width / 2} ${y + height / 2})">`
    + `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="${theme.accentInk}"/>`
    + `<rect x="${x + 3}" y="${y + 3}" width="${width - 6}" height="${height - 6}" fill="none" stroke="${theme.accentInk}"/>`
    + canvas.caption(label, x + 17, y + 18, theme.accentInk)
    + '</g>';
}

/** Small 2x2 mark whose squares blink in turn, like work in progress. */
function pendingMark(theme, x, y) {
  const square = 4;
  const gap = 2;
  return [[0, 0], [1, 0], [1, 1], [0, 1]].map(([column, row], index) =>
    `<rect class="pending" style="animation-delay:${(index * PENDING_SECONDS) / 4}s" x="${x + column * (square + gap)}" y="${y + row * (square + gap)}" width="${square}" height="${square}" fill="${theme.accent}"/>`).join('');
}

function auroraHead(canvas, type, theme, person, username) {
  const handleWidth = type.width(username, 13);
  return [
    `<rect width="${WIDTH}" height="${STRIP_HEIGHT}" fill="${theme.surface2}"/>`,
    canvas.text(username, MARGIN, 27, 13, theme.fg),
    pendingMark(theme, MARGIN + handleWidth + 16, 17),
    canvas.caption(person.status, MARGIN + handleWidth + 38, 26, theme.fg),
    canvas.text(`github.com/${username}`, WIDTH - MARGIN, 27, 12, theme.fgSubtle, { anchor: 'end' }),
    canvas.hline(STRIP_HEIGHT),
  ].join('');
}

function auroraBanner(aurora) {
  const attributes = `width="${WIDTH}" height="${AURORA_HEIGHT}" preserveAspectRatio="none" style="image-rendering:pixelated"`;
  return `<g transform="translate(0 ${STRIP_HEIGHT})">`
    + `<image class="still" ${attributes} href="data:image/png;base64,${aurora.still}"/>`
    + `<image class="live" ${attributes} href="data:image/png;base64,${aurora.animated}"/></g>`;
}

function identityBlock(canvas, theme, artwork, person, top) {
  return [
    canvas.caption(`${person.alias} · ${person.location}`, MARGIN, top + 36, theme.accentInk),
    stamp(canvas, theme, 'On file', STATS_X - 112, top + 20),
    heading(artwork, person.name, MARGIN - 2, top + 102, 68, theme.fg),
    canvas.text(person.role, MARGIN, top + 138, 15, theme.fgMuted),
    `<circle class="pulse" cx="${MARGIN + 4}" cy="${top + 170}" r="4" fill="${theme.accent}"/>`,
    canvas.caption(person.focus, MARGIN + 18, top + 174, theme.fgMuted),
  ].join('');
}

function statsBlock(canvas, theme, stats, top) {
  const cellWidth = (WIDTH - STATS_X) / 2;
  const cellHeight = IDENTITY_HEIGHT / 2;
  const cells = stats.map(({ icon, label, value }, index) => {
    const x = STATS_X + (index % 2) * cellWidth + 18;
    const y = top + Math.floor(index / 2) * cellHeight;
    return iconMarkup(icon, x, y + 20, 15, theme.accentInk)
      + canvas.caption(label, x, y + 54)
      + canvas.text(value, x, y + 82, 19, theme.fg);
  });
  return [
    canvas.vline(STATS_X, top, top + IDENTITY_HEIGHT),
    canvas.vline(STATS_X + cellWidth, top, top + IDENTITY_HEIGHT),
    canvas.hline(top + cellHeight, STATS_X, WIDTH),
    ...cells,
  ].join('');
}

function disciplineStrip(canvas, theme, disciplines, top) {
  const cellWidth = WIDTH / disciplines.length;
  return disciplines.flatMap(({ label, icon }, index) => {
    const x = index * cellWidth;
    return [
      index ? canvas.vline(Math.round(x), top, top + DISCIPLINE_HEIGHT) : '',
      iconMarkup(icon, Math.round(x) + 16, top + 18, 16, theme.accentInk),
      canvas.caption(label, Math.round(x) + 40, top + 30, theme.fgMuted),
    ];
  }).join('');
}

export function renderHeader({ type, theme, artwork, person, username, data, aurora }) {
  const canvas = createCanvas(type, theme);
  const identityTop = STRIP_HEIGHT + AURORA_HEIGHT;
  const disciplineTop = identityTop + IDENTITY_HEIGHT;
  const calendarTop = disciplineTop + DISCIPLINE_HEIGHT;
  const { weeks, start, total } = data.contributions;
  const grid = renderCalendarGrid({
    weeks, start, theme, caption: canvas.caption, x: MARGIN, y: calendarTop + CALENDAR_TOP, width: WIDTH - MARGIN * 2,
  });
  const footerY = calendarTop + CALENDAR_TOP + grid.height + 30;
  const height = calendarTop + CALENDAR_TOP + grid.height + CALENDAR_BOTTOM;
  const stats = [
    { icon: 'lucide:folder-git-2', label: 'Repos', value: formatCount(data.user.publicRepos) },
    { icon: 'lucide:users', label: 'Followers', value: formatCount(data.user.followers) },
    { icon: 'lucide:activity', label: 'Contributions', value: formatCount(total) },
    { icon: 'lucide:badge-check', label: 'Status', value: 'Active' },
  ];

  const body = [
    auroraHead(canvas, type, theme, person, username),
    auroraBanner(aurora),
    canvas.hline(identityTop),
    identityBlock(canvas, theme, artwork, person, identityTop),
    statsBlock(canvas, theme, stats, identityTop),
    canvas.hline(disciplineTop),
    disciplineStrip(canvas, theme, person.disciplines, disciplineTop),
    canvas.hline(calendarTop),
    grid.markup,
    canvas.caption(person.fieldCaption, MARGIN, footerY, theme.fgMuted),
    renderLegend({ theme, caption: canvas.caption, right: WIDTH - MARGIN, y: footerY }),
  ].join('');

  const style = `${CALENDAR_STYLE}.pulse{animation:pulse 1.8s ease-in-out infinite}@keyframes pulse{50%{opacity:.3}}`
    + `.pending{animation:pending ${PENDING_SECONDS}s steps(1) infinite}@keyframes pending{0%{opacity:1}25%,100%{opacity:.3}}`
    + '@media (prefers-reduced-motion:reduce){.pulse,.pending{animation:none}.live{display:none}}';
  return svg(WIDTH, height, `${person.name}, ${person.role}`, theme, body, style);
}

export function renderCard({ type, theme, artwork, project, imageData }) {
  const canvas = createCanvas(type, theme);
  const footerY = CARD_HEIGHT - CARD_FOOTER_HEIGHT;
  const imageBottom = STRIP_HEIGHT + CARD_IMAGE_HEIGHT;
  const summary = type.wrap(project.summary, 12.5, CARD_WIDTH - MARGIN * 2, 2);
  const ctaLabel = project.cta.toUpperCase();
  const ctaWidth = type.width(ctaLabel, CAPTION.size, CAPTION.tracking) + 48;
  const ctaX = CARD_WIDTH - MARGIN - ctaWidth;

  const body = [
    canvas.panelHead(project.icon, project.title, project.meta, CARD_WIDTH),
    `<image x="0" y="${STRIP_HEIGHT}" width="${CARD_WIDTH}" height="${CARD_IMAGE_HEIGHT}" preserveAspectRatio="xMidYMin slice" href="data:image/jpeg;base64,${imageData}"/>`,
    canvas.hline(imageBottom, 0, CARD_WIDTH),
    heading(artwork, project.title, MARGIN - 1, imageBottom + 44, 28, theme.fg),
    ...summary.map((line, row) => canvas.text(line, MARGIN, imageBottom + 70 + row * 19, 12.5, theme.fgMuted)),
    canvas.hline(footerY, 0, CARD_WIDTH),
    iconMarkup('lucide:briefcase-business', MARGIN, footerY + 22, 15, theme.fgSubtle),
    canvas.caption(project.role, MARGIN + 24, footerY + 34),
    `<rect x="${ctaX}" y="${footerY + 14}" width="${ctaWidth}" height="32" rx="4" fill="${theme.accent}"/>`,
    canvas.caption(ctaLabel, ctaX + 14, footerY + 34, theme.accentFg),
    iconMarkup('lucide:arrow-up-right', ctaX + ctaWidth - 27, footerY + 23, 14, theme.accentFg),
  ].join('');
  return svg(CARD_WIDTH, CARD_HEIGHT, `${project.title}: ${project.summary}`, theme, body);
}

export function renderStack({ type, theme, stack }) {
  const canvas = createCanvas(type, theme);
  const perRow = stack.length / 2;
  const cellWidth = WIDTH / perRow;
  const height = STRIP_HEIGHT + STACK_ROW_HEIGHT * 2;
  const cells = stack.flatMap(({ label, icon }, index) => {
    const column = index % perRow;
    const x = Math.round(column * cellWidth);
    const y = STRIP_HEIGHT + Math.floor(index / perRow) * STACK_ROW_HEIGHT;
    return [
      iconMarkup(icon, x + 18, y + 20, 18, theme.fg),
      canvas.text(label, x + 46, y + 33, 12, theme.fgMuted),
      column && index < perRow ? canvas.vline(x, STRIP_HEIGHT, height) : '',
    ];
  });
  const body = [
    canvas.panelHead('lucide:layers', 'Stack', 'What I ship with', WIDTH),
    canvas.hline(STRIP_HEIGHT + STACK_ROW_HEIGHT),
    ...cells,
  ].join('');
  return svg(WIDTH, height, `Stack: ${stack.map(({ label }) => label).join(', ')}`, theme, body);
}

export function renderLedger({ type, theme, repos, data, languageIcons }) {
  const canvas = createCanvas(type, theme);
  const columns = LEDGER_COLUMNS;
  const height = STRIP_HEIGHT + repos.length * LEDGER_ROW_HEIGHT;
  const summaryWidth = columns.language - columns.summary - MARGIN;

  const rows = repos.flatMap(({ name, summary, icon }, row) => {
    const y = STRIP_HEIGHT + row * LEDGER_ROW_HEIGHT;
    const live = data.repos[name];
    const languageIcon = languageIcons[live.language];
    const starsWidth = type.width(String(live.stars), 12);
    return [
      row ? canvas.hline(y) : '',
      iconMarkup(icon, columns.icon, y + 16, 16, theme.accentInk),
      canvas.text(name, columns.name, y + 29, 12.5, theme.fg),
      canvas.text(type.wrap(summary, 12, summaryWidth, 1)[0], columns.summary, y + 29, 12, theme.fgMuted),
      languageIcon ? iconMarkup(languageIcon, columns.language, y + 17, 14, theme.fgSubtle) : '',
      canvas.text(live.language ?? '—', columns.language + 22, y + 29, 12, theme.fgSubtle),
      iconMarkup('lucide:star', columns.stars - starsWidth - 20, y + 17, 14, theme.accentInk),
      canvas.text(String(live.stars), columns.stars, y + 29, 12, theme.fg, { anchor: 'end' }),
    ];
  });

  const body = [
    canvas.panelHead('lucide:folder-git-2', 'Open source', `${repos.length} repositories`, WIDTH),
    ...rows,
  ].join('');
  return svg(WIDTH, height, 'Selected repositories', theme, body);
}

export function renderLink({ type, theme, label, icon }) {
  const canvas = createCanvas(type, theme);
  const middle = LINK_HEIGHT / 2;
  const body = iconMarkup(icon, 20, middle - 9, 18, theme.fg)
    + canvas.caption(label, 48, middle + 4, theme.fg)
    + iconMarkup('lucide:arrow-up-right', LINK_WIDTH - 34, middle - 7, 14, theme.accentInk);
  return svg(LINK_WIDTH, LINK_HEIGHT, label, theme, body);
}
