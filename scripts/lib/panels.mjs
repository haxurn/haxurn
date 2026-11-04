import { BANNER_STYLE, renderBanner } from './banner.mjs';
import { CALENDAR_STYLE, renderCalendarGrid, renderLegend } from './calendar.mjs';
import { iconMarkup } from './icons.mjs';
import { escapeHtml } from './readme.mjs';

const WIDTH = 880;
const CARD_WIDTH = WIDTH / 2;
const LINK_WIDTH = WIDTH / 4;
const LINK_HEIGHT = 48;
/** Every panel sits this far inside its image, so panels in one row get a gap. */
const INSET = 4;
const RADIUS = 10;
const MARGIN = 24;
const PROMPT_HEIGHT = 38;
const BODY_SIZE = 13;
const SMALL_SIZE = 12;

const BANNER_HEIGHT = 80;
const AVATAR_SIZE = 96;
const IDENTITY_HEIGHT = 136;
const DISCIPLINE_LINE = 20;
const STATEMENT_SIZE = 30;
const STATEMENT_LINE = 38;
const STATEMENT_WIDTH = 500;
const STATEMENT_MAX_LINES = 3;

const CALENDAR_TOP = 46;
const CALENDAR_BOTTOM = 54;

const CARD_IMAGE_HEIGHT = 190;
const CARD_HEIGHT = 346;

const CHIP_HEIGHT = 34;
const CHIP_GAP = 8;
const CHIP_PADDING = 12;
const CHIP_ICON = 15;

const LEDGER_ROW_HEIGHT = 44;
const LEDGER_COLUMNS = { name: MARGIN + INSET, summary: 248, language: 668, stars: WIDTH - MARGIN - INSET };

const formatCount = (value) => (value === null || value === undefined ? '—' : value.toLocaleString('en-US'));

function createCanvas(type, theme, width) {
  const left = INSET;
  const right = width - INSET;
  const text = (value, x, y, size, fill, { anchor = 'start' } = {}) => {
    const start = anchor === 'end' ? x - type.width(value, size) : x;
    return `<path fill="${fill}" d="${type.path(value, start, y, size)}"/>`;
  };
  const hline = (y) => `<rect x="${left}" y="${y}" width="${right - left}" height="1" fill="${theme.border}"/>`;

  /** Runs of differently colored text on one line. Returns the markup and where the line ended. */
  const spans = (parts, x, y, size) => {
    let cursor = x;
    const markup = parts.map(([value, fill]) => {
      const drawn = text(value, cursor, y, size, fill);
      cursor += type.width(value, size);
      return drawn;
    }).join('');
    return { markup, end: cursor };
  };

  /** The shell prompt across the top of a panel: `$ command`, with quiet metadata on the right. */
  const promptHead = (command, meta = '') => [
    spans([['$ ', theme.accentInk], [command, theme.fgMuted]], left + MARGIN, 24, SMALL_SIZE).markup,
    meta ? text(meta, right - MARGIN, 24, SMALL_SIZE, theme.fgSubtle, { anchor: 'end' }) : '',
    hline(PROMPT_HEIGHT),
  ].join('');

  return { left, right, text, hline, spans, promptHead };
}

function svg(width, height, label, theme, body, style = '') {
  const frameWidth = width - INSET * 2;
  const frameHeight = height - 1;
  const clip = `<clipPath id="panel"><rect x="${INSET}" y=".5" width="${frameWidth}" height="${frameHeight}" rx="${RADIUS}"/></clipPath>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(label)}">`
    + `<defs>${clip}</defs>`
    + (style ? `<style>${style}</style>` : '')
    + `<g clip-path="url(#panel)"><rect width="${width}" height="${height}" fill="${theme.surface}"/>${body}</g>`
    + `<rect x="${INSET}" y=".5" width="${frameWidth}" height="${frameHeight}" rx="${RADIUS}" fill="none" stroke="${theme.border}"/></svg>`;
}

/** Both worlds in one strip: security's falling code on the left, software's code lines on the right. */
function bannerBlock(canvas, theme, width) {
  const half = width / 2;
  const options = { width: half, height: BANNER_HEIGHT - 12, ink: theme.accentInk, muted: theme.surface2 };
  const dashes = [];
  for (let x = canvas.left; x < canvas.right; x += 12) {
    dashes.push(`<rect x="${x}" y="${BANNER_HEIGHT - 3}" width="8" height="3" fill="${theme.accentInk}"/>`);
  }
  return `<rect width="${width}" height="${BANNER_HEIGHT}" fill="${theme.bg}"/>`
    + renderBanner({ ...options, pattern: 'rain' })
    + `<g transform="translate(${half} 0)">${renderBanner({ ...options, pattern: 'code' })}</g>`
    + dashes.join('');
}

function portrait(theme, avatar, x, y) {
  return `<defs><radialGradient id="glow" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="${theme.accentInk}" stop-opacity=".7"/><stop offset="1" stop-color="${theme.surface2}"/></radialGradient>`
    + `<clipPath id="face"><rect x="${x}" y="${y}" width="${AVATAR_SIZE}" height="${AVATAR_SIZE}" rx="14"/></clipPath></defs>`
    + `<g clip-path="url(#face)"><rect x="${x}" y="${y}" width="${AVATAR_SIZE}" height="${AVATAR_SIZE}" fill="url(#glow)"/>`
    + `<image x="${x}" y="${y}" width="${AVATAR_SIZE}" height="${AVATAR_SIZE}" href="data:image/png;base64,${avatar}"/></g>`
    + `<rect x="${x}" y="${y}" width="${AVATAR_SIZE}" height="${AVATAR_SIZE}" rx="14" fill="none" stroke="${theme.border}"/>`;
}

/** The mode's disciplines joined by accent slashes, flowed onto as many lines as they need. */
function disciplineLines(canvas, type, theme, disciplines, top) {
  const maxX = canvas.right - MARGIN;
  const separator = ' / ';
  let x = canvas.left + MARGIN;
  let y = top + 25;
  const parts = disciplines.map((label, index) => {
    const lower = label.toLowerCase();
    const hasNext = index < disciplines.length - 1;
    if (x + type.width(lower + (hasNext ? separator : ''), SMALL_SIZE) > maxX) {
      x = canvas.left + MARGIN;
      y += DISCIPLINE_LINE;
    }
    const line = canvas.spans([[lower, theme.fgSubtle], ...(hasNext ? [[separator, theme.accentInk]] : [])], x, y, SMALL_SIZE);
    x = line.end;
    return line.markup;
  });
  return { markup: parts.join(''), bottom: y + 16 };
}

function statementBlock(canvas, type, theme, { statement, focus }, top) {
  const contentX = canvas.left + MARGIN;
  const lines = type.wrap(statement, STATEMENT_SIZE, STATEMENT_WIDTH, STATEMENT_MAX_LINES);
  const firstY = top + 44;
  const focusY = firstY + (lines.length - 1) * STATEMENT_LINE + 36;
  const markup = [
    ...lines.map((line, row) => canvas.text(line, contentX, firstY + row * STATEMENT_LINE, STATEMENT_SIZE, theme.fg)),
    `<circle cx="${contentX + 4}" cy="${focusY - 4}" r="4" fill="${theme.accentInk}"/>`,
    canvas.text(focus, contentX + 18, focusY, BODY_SIZE, theme.fgMuted),
  ].join('');
  return { markup, bottom: focusY + 28 };
}

export function renderHeader({ type, theme, person, avatar }) {
  const canvas = createCanvas(type, theme, WIDTH);
  const contentX = canvas.left + MARGIN;
  const promptTop = BANNER_HEIGHT;
  const identityTop = promptTop + PROMPT_HEIGHT;
  const identityBottom = identityTop + IDENTITY_HEIGHT;
  const nameX = contentX + AVATAR_SIZE + 22;
  const statement = statementBlock(canvas, type, theme, person, identityBottom);

  const body = [
    bannerBlock(canvas, theme, WIDTH),
    canvas.spans([[person.prompt, theme.accentInk], [':~$ ', theme.fgSubtle], ['whoami', theme.fgMuted]], contentX, promptTop + 24, SMALL_SIZE).markup,
    `<circle class="pulse" cx="${canvas.right - MARGIN - type.width(person.label, SMALL_SIZE) - 12}" cy="${promptTop + 20}" r="3.5" fill="${theme.accentInk}"/>`,
    canvas.text(person.label, canvas.right - MARGIN, promptTop + 24, SMALL_SIZE, theme.fgMuted, { anchor: 'end' }),
    canvas.hline(identityTop),
    portrait(theme, avatar, contentX, identityTop + 20),
    canvas.text(person.name, nameX, identityTop + 54, 24, theme.fg),
    canvas.text(person.role, nameX, identityTop + 80, BODY_SIZE, theme.fgMuted),
    iconMarkup('lucide:map-pin', nameX, identityTop + 92, 13, theme.fgSubtle),
    canvas.text(person.location, nameX + 20, identityTop + 103, SMALL_SIZE, theme.fgSubtle),
    canvas.hline(identityBottom),
    statement.markup,
  ].join('');

  const style = `${BANNER_STYLE}.pulse{animation:pulse 1.8s ease-in-out infinite}@keyframes pulse{50%{opacity:.3}}`
    + '@media (prefers-reduced-motion:reduce){.pulse{animation:none}}';
  return svg(WIDTH, statement.bottom, `${person.name}, ${person.role}`, theme, body, style);
}

/** One side of the switcher: what this world is about, then its tools. */
export function renderMode({ type, theme, mode }) {
  const canvas = createCanvas(type, theme, WIDTH);
  const statement = statementBlock(canvas, type, theme, mode, PROMPT_HEIGHT);
  const disciplines = disciplineLines(canvas, type, theme, mode.disciplines, statement.bottom);
  const chips = chipRows(canvas, type, theme, mode.stack, disciplines.bottom + 20);
  const body = [
    canvas.promptHead(mode.stackCommand, mode.label.toLowerCase()),
    statement.markup,
    canvas.hline(statement.bottom),
    disciplines.markup,
    canvas.hline(disciplines.bottom),
    chips.markup,
  ].join('');
  const stackList = mode.stack.map(({ label }) => label).join(', ');
  return svg(WIDTH, chips.bottom + 22, `${mode.label}: ${mode.role}. ${mode.stackLabel}: ${stackList}`, theme, body);
}

export function renderActivity({ type, theme, data }) {
  const canvas = createCanvas(type, theme, WIDTH);
  const { weeks, start, total } = data.contributions;
  const contentX = canvas.left + MARGIN;
  const caption = (value, x, y, fill = theme.fgSubtle, anchor = 'start') => canvas.text(value, x, y, 10.5, fill, { anchor });
  const grid = renderCalendarGrid({
    weeks, start, theme, caption, x: contentX, y: PROMPT_HEIGHT + CALENDAR_TOP, width: canvas.right - canvas.left - MARGIN * 2,
  });
  const footerY = PROMPT_HEIGHT + CALENDAR_TOP + grid.height + 26;
  const height = PROMPT_HEIGHT + CALENDAR_TOP + grid.height + CALENDAR_BOTTOM;
  const counts = `${formatCount(data.user.publicRepos)} repos · ${formatCount(data.user.followers)} followers`;
  const body = [
    canvas.promptHead('git log --since="1 year ago"', `${formatCount(total)} contributions`),
    grid.markup,
    canvas.text(counts, contentX, footerY, SMALL_SIZE, theme.fgSubtle),
    renderLegend({ theme, caption, right: canvas.right - MARGIN, y: footerY }),
  ].join('');
  return svg(WIDTH, height, `${formatCount(total)} GitHub contributions in the last year`, theme, body, CALENDAR_STYLE);
}

export function renderCard({ type, theme, project, imageData }) {
  const canvas = createCanvas(type, theme, CARD_WIDTH);
  const contentX = canvas.left + MARGIN;
  const textWidth = canvas.right - canvas.left - MARGIN * 2;
  const imageBottom = CARD_IMAGE_HEIGHT;
  const summary = type.wrap(project.summary, BODY_SIZE, textWidth, 2);
  const footerY = CARD_HEIGHT - 26;
  const ctaEnd = canvas.right - MARGIN - 18;
  const ctaWidth = type.width(project.cta, SMALL_SIZE);

  const body = [
    `<image x="0" y="0" width="${CARD_WIDTH}" height="${CARD_IMAGE_HEIGHT}" preserveAspectRatio="xMidYMin slice" href="data:image/jpeg;base64,${imageData}"/>`,
    canvas.hline(imageBottom),
    canvas.text(project.title, contentX, imageBottom + 40, 20, theme.fg),
    ...summary.map((line, row) => canvas.text(line, contentX, imageBottom + 68 + row * 20, BODY_SIZE, theme.fgMuted)),
    canvas.text(project.role, contentX, footerY, SMALL_SIZE, theme.fgSubtle),
    canvas.text(project.cta, ctaEnd, footerY, SMALL_SIZE, theme.accentInk, { anchor: 'end' }),
    `<rect x="${ctaEnd - ctaWidth}" y="${footerY + 4}" width="${ctaWidth}" height="1" fill="${theme.accentInk}"/>`,
    iconMarkup('lucide:arrow-up-right', ctaEnd + 3, footerY - 11, 14, theme.accentInk),
  ].join('');
  return svg(CARD_WIDTH, CARD_HEIGHT, `${project.title}: ${project.summary}`, theme, body);
}

/** Logo chips like the portfolio's, flowed left to right. Returns the bottom edge of the last row. */
function chipRows(canvas, type, theme, items, top) {
  const maxX = canvas.right - MARGIN;
  let x = canvas.left + MARGIN;
  let y = top;
  const chips = items.map(({ label, icon }) => {
    const chipWidth = CHIP_PADDING * 2 + CHIP_ICON + 8 + type.width(label, SMALL_SIZE);
    if (x + chipWidth > maxX) {
      x = canvas.left + MARGIN;
      y += CHIP_HEIGHT + CHIP_GAP;
    }
    const chip = `<rect x="${x}" y="${y}" width="${chipWidth}" height="${CHIP_HEIGHT}" rx="6" fill="${theme.bg}" stroke="${theme.border}"/>`
      + iconMarkup(icon, x + CHIP_PADDING, y + (CHIP_HEIGHT - CHIP_ICON) / 2, CHIP_ICON, theme.fg)
      + canvas.text(label, x + CHIP_PADDING + CHIP_ICON + 8, y + 21, SMALL_SIZE, theme.fgMuted);
    x += chipWidth + CHIP_GAP;
    return chip;
  });
  return { markup: chips.join(''), bottom: y + CHIP_HEIGHT };
}

export function renderLedger({ type, theme, repos, data, languageIcons }) {
  const canvas = createCanvas(type, theme, WIDTH);
  const columns = LEDGER_COLUMNS;
  const height = PROMPT_HEIGHT + repos.length * LEDGER_ROW_HEIGHT;
  const summaryWidth = columns.language - columns.summary - MARGIN;

  const rows = repos.flatMap(({ name, summary }, row) => {
    const y = PROMPT_HEIGHT + row * LEDGER_ROW_HEIGHT;
    const live = data.repos[name];
    const languageIcon = languageIcons[live.language];
    const starsWidth = type.width(String(live.stars), SMALL_SIZE);
    return [
      row ? canvas.hline(y) : '',
      canvas.text(name, columns.name, y + 27, BODY_SIZE, theme.fg),
      canvas.text(type.wrap(summary, SMALL_SIZE, summaryWidth, 1)[0], columns.summary, y + 27, SMALL_SIZE, theme.fgMuted),
      languageIcon ? iconMarkup(languageIcon, columns.language, y + 15, 14, theme.fgSubtle) : '',
      canvas.text(live.language ?? '—', columns.language + 22, y + 27, SMALL_SIZE, theme.fgSubtle),
      iconMarkup('lucide:star', columns.stars - starsWidth - 20, y + 15, 14, theme.accentInk),
      canvas.text(String(live.stars), columns.stars, y + 27, SMALL_SIZE, theme.fg, { anchor: 'end' }),
    ];
  });

  const body = canvas.promptHead('ls ~/open-source', `${repos.length} repositories`) + rows.join('');
  return svg(WIDTH, height, 'Selected repositories', theme, body);
}

export function renderLink({ type, theme, label, icon }) {
  const canvas = createCanvas(type, theme, LINK_WIDTH);
  const middle = LINK_HEIGHT / 2;
  const body = iconMarkup(icon, canvas.left + 16, middle - 8, 16, theme.fg)
    + canvas.text(label, canvas.left + 42, middle + 4.5, SMALL_SIZE, theme.fg)
    + iconMarkup('lucide:arrow-up-right', canvas.right - 28, middle - 7, 14, theme.accentInk);
  return svg(LINK_WIDTH, LINK_HEIGHT, label, theme, body);
}
