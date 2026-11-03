import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { encodeApng, encodePng } from './lib/apng.mjs';
import { renderField } from './lib/field.mjs';
import { loadProfileData } from './lib/github.mjs';
import { FIELD_PIXEL_SIZE, renderCard, renderHeader, renderLedger, renderLink } from './lib/panels.mjs';
import { buildReadme } from './lib/readme.mjs';
import { createTypesetter } from './lib/text.mjs';

const FIELD_FRAMES = 48;
const FIELD_FPS = 12;
const STILL_PHASE = 0.72;
const VERSION_LENGTH = 10;
const FIRST_CARD_INDEX = 1;

const root = new URL('../', import.meta.url);
const fromRoot = (relative) => new URL(relative, root);
const OUT_DIR = fromRoot('profile/generated/');

function renderFieldImages(weeks, palette) {
  const { cols, rows } = FIELD_PIXEL_SIZE;
  const frame = (phase) => renderField(weeks, { cols, rows, paletteSize: palette.length, phase });
  const frames = Array.from({ length: FIELD_FRAMES }, (_, index) => frame(index / FIELD_FRAMES));
  return {
    still: encodePng({ width: cols, height: rows, palette, pixels: frame(STILL_PHASE) }).toString('base64'),
    animated: encodeApng({ width: cols, height: rows, palette, frames, fps: FIELD_FPS }).toString('base64'),
  };
}

function renderTheme(theme, shared) {
  const { config, data, type, artwork, images } = shared;
  const context = { type, theme, artwork };
  const field = renderFieldImages(data.contributions.weeks, theme.field);
  return {
    header: renderHeader({ ...context, person: config.person, data, field }),
    ...Object.fromEntries(config.featured.map((project, index) => [
      `card-0${index + FIRST_CARD_INDEX}`,
      renderCard({ ...context, project, index: `0${index + FIRST_CARD_INDEX}`, imageData: images[index] }),
    ])),
    repos: renderLedger({ type, theme, repos: config.repos, data }),
    ...Object.fromEntries(config.links.map(({ label }, index) => [
      `link-0${index + FIRST_CARD_INDEX}`,
      renderLink({ type, theme, label }),
    ])),
  };
}

function readmePanels(config, version) {
  const { person, featured, username, links } = config;
  return {
    version,
    header: { name: 'header', alt: `${person.name} (${person.alias}): ${person.role}. ${person.focus}. ${person.location}.` },
    cards: featured.map((project, index) => ({
      name: `card-0${index + FIRST_CARD_INDEX}`,
      alt: `${project.title}: ${project.summary}`,
      url: project.url,
    })),
    ledger: {
      name: 'repos',
      alt: `Selected repositories: ${config.repos.map(({ name }) => name).join(', ')}`,
      url: `https://github.com/${username}?tab=repositories`,
    },
    links: links.map(({ label, url }, index) => ({ name: `link-0${index + FIRST_CARD_INDEX}`, alt: label, url })),
  };
}

async function main() {
  const config = JSON.parse(await readFile(fromRoot('profile.config.json'), 'utf8'));
  const artwork = JSON.parse(await readFile(fromRoot('profile/artwork.json'), 'utf8'));
  const type = createTypesetter(await readFile(fromRoot('fonts/JetBrainsMono-Medium.ttf')));
  const images = await Promise.all(config.featured.map(async ({ image }) =>
    (await readFile(fromRoot(image))).toString('base64')));
  const data = await loadProfileData(config, fromRoot('profile/github-cache.json').pathname);

  const shared = { config, data, type, artwork, images };
  const files = Object.entries(config.themes).flatMap(([name, theme]) =>
    Object.entries(renderTheme(theme, shared)).map(([panel, svg]) => [`${panel}-${name}.svg`, svg]));

  const hash = createHash('sha256');
  files.forEach(([, svg]) => hash.update(svg));
  const version = hash.digest('hex').slice(0, VERSION_LENGTH);

  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });
  await Promise.all(files.map(([name, svg]) => writeFile(new URL(name, OUT_DIR), svg)));
  await writeFile(fromRoot('README.md'), buildReadme(readmePanels(config, version)));
  console.log(`Wrote ${files.length} panels, version ${version}`);
}

await main();
