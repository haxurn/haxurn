import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { loadProfileData } from './lib/github.mjs';
import { renderCard, renderHeader, renderLedger, renderLink, renderStack } from './lib/panels.mjs';
import { buildReadme } from './lib/readme.mjs';
import { createTypesetter } from './lib/text.mjs';

const VERSION_LENGTH = 10;

const root = new URL('../', import.meta.url);
const fromRoot = (relative) => new URL(relative, root);
const OUT_DIR = fromRoot('profile/generated/');
const numbered = (prefix, index) => `${prefix}-${String(index + 1).padStart(2, '0')}`;

function renderTheme(theme, { config, data, type, artwork, images }) {
  const context = { type, theme, artwork };
  return {
    header: renderHeader({ ...context, person: config.person, data }),
    ...Object.fromEntries(config.featured.map((project, index) => [
      numbered('card', index),
      renderCard({ ...context, project, imageData: images[index] }),
    ])),
    stack: renderStack({ type, theme, stack: config.stack }),
    repos: renderLedger({ type, theme, repos: config.repos, data, languageIcons: config.languageIcons }),
    ...Object.fromEntries(config.links.map(({ label, icon }, index) => [
      numbered('link', index),
      renderLink({ type, theme, label, icon }),
    ])),
  };
}

function readmePanels(config, version) {
  const { person, featured, username, links, stack, repos } = config;
  const disciplines = person.disciplines.map(({ label }) => label).join(', ');
  return {
    version,
    header: { name: 'header', alt: `${person.name} (${person.alias}): ${person.role}. ${person.focus}. ${person.location}. ${disciplines}.` },
    cards: featured.map((project, index) => ({
      name: numbered('card', index),
      alt: `${project.title}: ${project.summary}`,
      url: project.url,
    })),
    stack: {
      name: 'stack',
      alt: `Stack: ${stack.map(({ label }) => label).join(', ')}`,
      url: 'https://www.haxurn.space/#stack',
    },
    ledger: {
      name: 'repos',
      alt: `Selected repositories: ${repos.map(({ name }) => name).join(', ')}`,
      url: `https://github.com/${username}?tab=repositories`,
    },
    links: links.map(({ label, url }, index) => ({ name: numbered('link', index), alt: label, url })),
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
