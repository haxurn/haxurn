const BAYER_4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const BAYER_LEVELS = 16;
const MAX_LEVEL = 4;
const DAYS_PER_WEEK = 7;

/** Share of tone that always comes from the calendar, so quiet weeks stay quiet. */
const HEAT_FLOOR = 0.62;
const SWEEP_WIDTH = 0.045;
const SWEEP_HEAT_GAIN = 0.55;
const SWEEP_BASE_GAIN = 0.16;

function sampleHeat(weeks, u, v) {
  const x = u * (weeks.length - 1);
  const y = v * (DAYS_PER_WEEK - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, weeks.length - 1);
  const y1 = Math.min(y0 + 1, DAYS_PER_WEEK - 1);
  const tx = x - x0;
  const ty = y - y0;
  const top = weeks[x0][y0] * (1 - tx) + weeks[x1][y0] * tx;
  const bottom = weeks[x0][y1] * (1 - tx) + weeks[x1][y1] * tx;
  return (top * (1 - ty) + bottom * ty) / MAX_LEVEL;
}

/** Gaussian band that wraps across the width, so phase 0 and phase 1 match exactly. */
function sweepAt(u, phase) {
  const wrapped = Math.abs(u - (phase % 1));
  const distance = Math.min(wrapped, 1 - wrapped);
  return Math.exp(-(distance * distance) / (2 * SWEEP_WIDTH * SWEEP_WIDTH));
}

/**
 * Renders the contribution calendar as an ordered-dither field with a scan line
 * passing through it. Returns one palette index per cell, row by row.
 */
export function renderField(weeks, { cols, rows, paletteSize, phase }) {
  const pixels = new Uint8Array(cols * rows);
  const top = paletteSize - 1;
  for (let row = 0; row < rows; row++) {
    const v = (row + 0.5) / rows;
    for (let col = 0; col < cols; col++) {
      const u = (col + 0.5) / cols;
      const heat = sampleHeat(weeks, u, v);
      const sweep = sweepAt(u, phase);
      const tone = Math.min(1, heat * HEAT_FLOOR + sweep * (SWEEP_BASE_GAIN + heat * SWEEP_HEAT_GAIN));
      const scaled = tone * top;
      const base = Math.floor(scaled);
      const threshold = (BAYER_4[row % 4][col % 4] + 0.5) / BAYER_LEVELS;
      pixels[row * cols + col] = Math.min(top, base + (scaled - base > threshold ? 1 : 0));
    }
  }
  return pixels;
}
