import { readFileSync } from 'node:fs';

const VIEWBOX = 24;
const LUCIDE_STROKE = 1.75;
const PACKAGES = {
  lucide: new URL('../../node_modules/lucide-static/icons/', import.meta.url),
  si: new URL('../../node_modules/simple-icons/icons/', import.meta.url),
};

/** The LinkedIn mark left Simple Icons, so its 24-unit path is kept here. */
const LOCAL_ICONS = {
  'local:linkedin': '<path fill="currentColor" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>',
};

function innerMarkup(name) {
  if (LOCAL_ICONS[name]) return LOCAL_ICONS[name];
  const [set, slug] = name.split(':');
  if (!PACKAGES[set]) throw new Error(`Unknown icon set in "${name}"`);
  const source = readFileSync(new URL(`${slug}.svg`, PACKAGES[set]), 'utf8');
  const inner = source.replace(/<!--[\s\S]*?-->/g, '').match(/<svg\b[^>]*>([\s\S]*)<\/svg>/)?.[1];
  if (!inner) throw new Error(`No drawable content in icon "${name}"`);
  return inner.replace(/\s+/g, ' ').trim();
}

const paint = {
  lucide: (color) => `fill="none" stroke="${color}" stroke-width="${LUCIDE_STROKE}" stroke-linecap="round" stroke-linejoin="round"`,
  si: (color) => `fill="${color}"`,
  local: (color) => `color="${color}"`,
};

/** Draws `lucide:<name>`, `si:<slug>`, or `local:<name>` with its top-left corner at x, y. */
export function iconMarkup(name, x, y, size, color) {
  const inner = innerMarkup(name);
  const scale = size / VIEWBOX;
  return `<g transform="translate(${x} ${y}) scale(${scale})" ${paint[name.split(':')[0]](color)}>${inner}</g>`;
}
