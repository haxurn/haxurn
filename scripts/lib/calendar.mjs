const MS_PER_WEEK = 7 * 86_400_000;
const DAYS_PER_WEEK = 7;
const MIN_WEEKS_FOR_LABEL = 3;
const CELL_RATIO = 0.8;
const CELL_RADIUS = 2.5;
const WAVE_SECONDS = 8;
const LEGEND_CELL = 11;
const LEGEND_GAP = 3;

/** The portfolio draws this grid in GitHub's own greens, one scale per theme. */
export function levelFills(theme) {
  return theme.contrib;
}

/** One label per month, at the first week starting in it, skipping months too narrow to label. */
export function monthMarkers(start, weekCount) {
  if (Number.isNaN(Date.parse(start))) throw new Error(`Invalid calendar start date: ${start}`);
  const markers = [];
  for (let week = 0; week < weekCount - MIN_WEEKS_FOR_LABEL + 1; week++) {
    const date = new Date(Date.parse(start) + week * MS_PER_WEEK);
    const month = date.toLocaleString('en', { month: 'short', timeZone: 'UTC' });
    const previous = markers.at(-1);
    if (previous?.month === month) continue;
    if (week === 0 && date.getUTCDate() > DAYS_PER_WEEK * 2) continue;
    if (previous && week - previous.week < MIN_WEEKS_FOR_LABEL) continue;
    markers.push({ month, week });
  }
  return markers;
}

export const CALENDAR_STYLE = `.w{animation:wave ${WAVE_SECONDS}s linear infinite}`
  + '@keyframes wave{0%,16%,100%{opacity:.85}8%{opacity:1}}'
  + '@media (prefers-reduced-motion:reduce){.w{animation:none}}';

export function renderCalendarGrid({ weeks, start, theme, caption, x, y, width }) {
  const pitch = width / weeks.length;
  const cell = +(pitch * CELL_RATIO).toFixed(2);
  const fills = levelFills(theme);
  const columns = weeks.map((days, week) => {
    const delay = ((week / weeks.length - 1) * WAVE_SECONDS).toFixed(2);
    const rects = days.map((level, day) =>
      `<rect x="${(x + week * pitch).toFixed(2)}" y="${(y + day * pitch).toFixed(2)}" width="${cell}" height="${cell}" rx="${CELL_RADIUS}" fill="${fills[level]}"/>`);
    return `<g class="w" style="animation-delay:${delay}s">${rects.join('')}</g>`;
  });
  const labels = monthMarkers(start, weeks.length)
    .map(({ month, week }) => caption(month, x + week * pitch, y - 10));
  return { markup: labels.join('') + columns.join(''), height: pitch * DAYS_PER_WEEK };
}

export function renderLegend({ theme, caption, right, y }) {
  const fills = levelFills(theme);
  const swatchesWidth = fills.length * (LEGEND_CELL + LEGEND_GAP);
  const moreX = right - 30;
  const start = moreX - 10 - swatchesWidth;
  const swatches = fills.map((fill, index) =>
    `<rect x="${start + index * (LEGEND_CELL + LEGEND_GAP)}" y="${y - 9.5}" width="${LEGEND_CELL}" height="${LEGEND_CELL}" rx="2" fill="${fill}"/>`);
  return caption('Less', start - 8, y, theme.fgSubtle, 'end') + swatches.join('') + caption('More', right, y, theme.fgSubtle, 'end');
}
