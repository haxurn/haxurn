import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { loadProfileData } from './lib/github.mjs';
import { renderActivity, renderCard, renderHeader, renderLedger, renderLink, renderStack } from './lib/panels.mjs';
import { buildReadme } from './lib/readme.mjs';
import { createTypesetter } from './lib/text.mjs';

const VERSION_LENGTH = 10;

const root = new URL('../', import.meta.url);
const fromRoot = (relative) => new URL(relative, root);
const OUT_DIR = fromRoot('profile/generated/');
const numbered = (prefix, index) => `${prefix}-${String(index + 1).padStart(2, '0')}`;

function renderTheme(name, { config, data, type, avatar, images }) {
  const theme = config.themes[name];
  const mode = config.modes[name];
  return {
    header: renderHeader({ type, theme, mode, person: config.person, avatar }),
    ...Object.fromEntries(config.links.map(({ label, icon }, index) => [
      numbered('link', index),
      renderLink({ type, theme, label, icon }),
    ])),
    activity: renderActivity({ type, theme, data }),
    ...Object.fromEntries(config.featured.map((project, index) => [
      numbered('card', index),
      renderCard({ type, theme, project, imageData: images[index] }),
    ])),
    stack: renderStack({ type, theme, mode }),
    repos: renderLedger({ type, theme, repos: config.repos, data, languageIcons: config.languageIcons }),
  };
}

function readmePanels(config, version) {
  const { person, featured, username, links, modes, repos } = config;
  const { dark: hacker, light: dev } = modes;
  const stackLabels = (mode) => mode.stack.map(({ label }) => label).join(', ');
  return {
    version,
    header: { name: 'header', alt: `${person.name} (${person.alias}): ${dev.role}. ${hacker.role}. ${person.location}.` },
    links: links.map(({ label, url }, index) => ({ name: numbered('link', index), alt: label, url })),
    activity: { name: 'activity', alt: 'GitHub contributions over the last year', url: `https://github.com/${username}` },
    cards: featured.map((project, index) => ({
      name: numbered('card', index),
      alt: `${project.title}: ${project.summary}`,
      url: project.url,
    })),
    stack: {
      name: 'stack',
      alt: `${dev.stackLabel}: ${stackLabels(dev)}. ${hacker.stackLabel}: ${stackLabels(hacker)}.`,
      url: 'https://www.haxurn.space/skills',
    },
    ledger: {
      name: 'repos',
      alt: `Selected repositories: ${repos.map(({ name }) => name).join(', ')}`,
      url: `https://github.com/${username}?tab=repositories`,
    },
  };
}

async function main() {
  const config = JSON.parse(await readFile(fromRoot('profile.config.json'), 'utf8'));
  const type = createTypesetter(await readFile(fromRoot('fonts/JetBrainsMono-Medium.ttf')));
  const avatar = (await readFile(fromRoot('profile/assets/avatar.png'))).toString('base64');
  const images = await Promise.all(config.featured.map(async ({ image }) =>
    (await readFile(fromRoot(image))).toString('base64')));
  const data = await loadProfileData(config, fromRoot('profile/github-cache.json').pathname);

  const shared = { config, data, type, avatar, images };
  const files = Object.keys(config.themes).flatMap((name) =>
    Object.entries(renderTheme(name, shared)).map(([panel, svg]) => [`${panel}-${name}.svg`, svg]));

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
