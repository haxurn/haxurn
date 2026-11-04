const BLOCK = 4;
const RAIN_PITCH = 16;
const CODE_ROW_PITCH = 10;
const CODE_COLUMN_WIDTH = 240;
const FADE_SECONDS = 6;

/** Small seeded generator, so a rebuild only changes a panel when its content changes. */
function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

const block = (x, y, width, height, fill) => `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"/>`;

function fading(random, markup) {
  const delay = (random() * FADE_SECONDS).toFixed(2);
  return `<g class="fade" style="animation-delay:-${delay}s">${markup}</g>`;
}

/** Hacker mode: columns of falling code, as on the portfolio banner. */
function rain({ width, height, ink, muted, random }) {
  const columns = [];
  for (let x = RAIN_PITCH / 2; x < width; x += RAIN_PITCH) {
    if (random() < 0.3) continue;
    const length = Math.floor(3 + random() * 6);
    const top = Math.floor((random() * height) / BLOCK) * BLOCK;
    const cells = [];
    for (let index = 0; index < length && top + index * BLOCK < height; index++) {
      const isHead = index === length - 1;
      cells.push(block(x, top + index * BLOCK, BLOCK, BLOCK - 1, isHead ? ink : muted));
    }
    columns.push(fading(random, cells.join('')));
  }
  return columns.join('');
}

/** Dev mode: blocks of indented code lines, as on the portfolio banner. */
function code({ width, height, ink, muted, random }) {
  const lines = [];
  for (let column = 0; column < width; column += CODE_COLUMN_WIDTH) {
    for (let y = BLOCK; y < height; y += CODE_ROW_PITCH) {
      if (random() < 0.25) continue;
      const indent = Math.floor(random() * 4) * BLOCK * 3;
      const barWidth = Math.floor(4 + random() * 22) * BLOCK;
      const isAccent = random() < 0.25;
      lines.push(fading(random, block(column + BLOCK * 4 + indent, y, barWidth, BLOCK, isAccent ? ink : muted)));
    }
  }
  return lines.join('');
}

const PATTERNS = { rain, code };
const PATTERN_SEEDS = { rain: 1049, code: 2024 };

export const BANNER_STYLE = `.fade{animation:fade ${FADE_SECONDS}s ease-in-out infinite}`
  + '@keyframes fade{0%,100%{opacity:1}50%{opacity:.35}}'
  + '@media (prefers-reduced-motion:reduce){.fade{animation:none}}';

export function renderBanner({ pattern, width, height, ink, muted }) {
  const draw = PATTERNS[pattern];
  if (!draw) throw new Error(`Unknown banner pattern "${pattern}"`);
  return draw({ width, height, ink, muted, random: seededRandom(PATTERN_SEEDS[pattern]) });
}
