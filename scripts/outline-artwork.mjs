// Run locally with your own licensed copy of Clash Grotesk. The ITF license does not
// allow the font in a public repository, so only the finished heading outlines
// are committed. Rerun this script when a name or a featured title changes:
//   CLASH_FONT=/path/to/ClashGrotesk-Semibold.woff pnpm outline
import { readFile, writeFile } from 'node:fs/promises';
import { outlineString } from './lib/text.mjs';

const DISPLAY_TRACKING = -0.025;

const fontPath = process.env.CLASH_FONT;
if (!fontPath) throw new Error('Set CLASH_FONT to the path of ClashGrotesk-Semibold.woff');

const root = new URL('../', import.meta.url);
const config = JSON.parse(await readFile(new URL('profile.config.json', root), 'utf8'));
const font = await readFile(fontPath);

const headings = [config.person.name, ...config.featured.map(({ title }) => title)];
const artwork = Object.fromEntries(headings.map((text) => [text, outlineString(font, text, DISPLAY_TRACKING)]));

await writeFile(new URL('profile/artwork.json', root), `${JSON.stringify(artwork, null, 2)}\n`);
console.log(`Outlined ${headings.length} headings`);
