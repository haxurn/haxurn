const BAYER_4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const BAYER_LEVELS = 16;
const TAU = Math.PI * 2;

/**
 * Each layer is one ribbon of light. Haze is the wide grey glow, core is the bright
 * band, and echo is the broken streak under it. Spike sets how jagged the top edge is.
 */
const LAYERS = [
  { center: 0.42, wander: 0.05, spike: 0.09, rise: 6.5, fall: 15, gain: 0.72, contrast: 0.5, seed: 11, drift: 0.34 },
  { center: 0.46, wander: 0.07, spike: 0.05, rise: 15, fall: 24, gain: 2.5, contrast: 0.7, seed: 47, drift: 0.42 },
  { center: 0.62, wander: 0.05, spike: 0.03, rise: 24, fall: 30, gain: 0.8, contrast: 1, seed: 83, drift: 0.3 },
];
const RIDGE_FREQUENCY = 2.2;
const RAY_FREQUENCY = 36;
const PATCH_FREQUENCY = 2.1;
const TONE_GAIN = 1.5;
const NOISE_FLOOR = 0.035;

function hash(x, y, seed) {
  let value = Math.imul(x, 0x27d4eb2d) + Math.imul(y, 0x165667b1) + Math.imul(seed, 0x9e3779b1);
  value = Math.imul(value ^ (value >>> 15), 0x2c1b3c6d);
  value = Math.imul(value ^ (value >>> 12), 0x297a2d39);
  return ((value ^ (value >>> 15)) >>> 0) / 0xffffffff;
}

function smoothNoise(x, y, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = hash(x0, y0, seed) * (1 - sx) + hash(x0 + 1, y0, seed) * sx;
  const bottom = hash(x0, y0 + 1, seed) * (1 - sx) + hash(x0 + 1, y0 + 1, seed) * sx;
  return top * (1 - sy) + bottom * sy;
}

/** Samples noise along a circle in time, so the animation returns exactly to its first frame. */
function loopingNoise(x, angle, radius, seed) {
  return smoothNoise(x + Math.cos(angle) * radius + radius, Math.sin(angle) * radius + radius, seed);
}

function smoothstep(low, high, value) {
  const t = Math.min(1, Math.max(0, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
}

function layerLight(layer, u, v, angle) {
  const { center, wander, spike, rise, fall, gain, contrast, seed, drift } = layer;
  const broad = loopingNoise(u * RIDGE_FREQUENCY, angle, drift, seed) - 0.5;
  const fine = loopingNoise(u * RIDGE_FREQUENCY * 4, angle, drift * 1.6, seed + 1) - 0.5;
  const ray = loopingNoise(u * RAY_FREQUENCY, angle, drift * 2.4, seed + 2);
  const ridge = center + broad * wander * 2 + fine * wander - ray * spike;
  const distance = v - ridge;
  const falloff = distance < 0 ? Math.exp(distance * rise) : Math.exp(-distance * fall);
  const patchNoise = loopingNoise(u * PATCH_FREQUENCY, angle, drift, seed + 3);
  const patch = 1 - contrast + contrast * smoothstep(0.25, 0.65, patchNoise);
  return falloff * (0.35 + 0.65 * ray) * patch * gain;
}

function toneAt(u, v, angle) {
  const light = LAYERS.reduce((sum, layer) => sum + layerLight(layer, u, v, angle), 0);
  return 1 - Math.exp(-light * TONE_GAIN);
}

/**
 * Renders one frame of a dithered aurora as palette indices, row by row.
 * Index 0 is the night sky. `phase` runs from 0 to 1 and the loop is seamless.
 */
export function renderAurora({ cols, rows, paletteSize, phase }) {
  const pixels = new Uint8Array(cols * rows);
  const angle = (phase % 1) * TAU;
  const top = paletteSize - 1;
  for (let row = 0; row < rows; row++) {
    const v = (row + 0.5) / rows;
    for (let col = 0; col < cols; col++) {
      const tone = toneAt((col + 0.5) / cols, v, angle);
      if (tone < NOISE_FLOOR) continue;
      const scaled = tone * top;
      const base = Math.floor(scaled);
      const threshold = (BAYER_4[row % 4][col % 4] + 0.5) / BAYER_LEVELS;
      pixels[row * cols + col] = Math.min(top, base + (scaled - base > threshold ? 1 : 0));
    }
  }
  return pixels;
}
