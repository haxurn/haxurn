import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DAYS_PER_WEEK = 7;
const MS_PER_DAY = 86_400_000;
const USER_AGENT = 'haxurn-profile-readme';

/**
 * Reads the public contribution calendar. It uses the signed-out HTML on purpose:
 * the README must show only what a visitor can already see, never counts that a
 * personal token would add from private repositories.
 */
export function parseContributions(html) {
  const days = [...html.matchAll(/<td\b[^>]*>/g)]
    .map(([tag]) => ({
      date: tag.match(/data-date="(\d{4}-\d{2}-\d{2})"/)?.[1],
      level: Number(tag.match(/data-level="(\d)"/)?.[1]),
    }))
    .filter((day) => day.date && Number.isInteger(day.level))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (days.length === 0) throw new Error('GitHub response has no contribution days');

  const firstTime = Date.parse(days[0].date);
  const start = firstTime - new Date(firstTime).getUTCDay() * MS_PER_DAY;
  const weeks = [];
  for (const { date, level } of days) {
    const offset = Math.round((Date.parse(date) - start) / MS_PER_DAY);
    const week = Math.floor(offset / DAYS_PER_WEEK);
    weeks[week] ??= new Array(DAYS_PER_WEEK).fill(0);
    weeks[week][offset % DAYS_PER_WEEK] = level;
  }

  const total = html.match(/([\d,]+)\s+contributions?\s+in the last year/)?.[1];
  return { total: total ? Number(total.replaceAll(',', '')) : null, weeks };
}

async function fetchOk(url, headers) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, ...headers } });
  if (!response.ok) throw new Error(`${response.status} from ${url}`);
  return response;
}

async function fetchLive(config) {
  const headers = { Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const api = (endpoint) => fetchOk(`https://api.github.com${endpoint}`, headers).then((r) => r.json());

  const [user, repoList, calendarHtml] = await Promise.all([
    api(`/users/${config.username}`),
    Promise.all(config.repos.map(({ name }) => api(`/repos/${config.username}/${name}`))),
    fetchOk(`https://github.com/users/${config.username}/contributions`).then((r) => r.text()),
  ]);

  return {
    user: { publicRepos: user.public_repos, followers: user.followers },
    repos: Object.fromEntries(repoList.map((repo) => [repo.name, {
      language: repo.language,
      stars: repo.stargazers_count,
      url: repo.html_url,
    }])),
    contributions: parseContributions(calendarHtml),
  };
}

/** Fetches live data and refreshes the cache. A failed fetch reuses the cache, and fails if none exists. */
export async function loadProfileData(config, cachePath) {
  try {
    const data = await fetchLive(config);
    await mkdir(path.dirname(cachePath), { recursive: true });
    await writeFile(cachePath, `${JSON.stringify(data)}\n`);
    return data;
  } catch (error) {
    console.warn(`GitHub fetch failed, using cache: ${error.message}`);
    return JSON.parse(await readFile(cachePath, 'utf8'));
  }
}
