// Site data and the Blogger-shaped `D` object the compiled theme expects.
import postsRaw from '../data/posts.json';
import pagesRaw from '../data/pages.json';
import popular from '../data/popular.json';

export const SITE = 'https://www.kafka.blog';
export const HOME = SITE + '/';
export const TZ = 'America/New_York';
export const BLOG = {
  homepageUrl: HOME,
  title: 'kafkaintherun',
  metaDescription: 'Essays, poems, letters and photographs in Nepali and English by बासभ: history, cancer biology, immunology and the in-between.',
  id: '8657703664257880060',
};

// ---------- dates (Blogger shows everything in the blog's time zone, America/New_York) ----------
const parts = (iso) => {
  const d = new Date(iso);
  const f = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'longOffset' });
  const o = Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]));
  const off = (o.timeZoneName.replace('GMT', '') || '+00:00');
  return { ...o, off };
};
/** 2025-12-01T05:44:00-05:00 (published: seconds dropped, like Blogger) */
export const isoMinute = (iso) => { const p = parts(iso); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00${p.off}`; };
/** 2026-11-21T06:30:35-05:00 */
export const isoSecond = (iso) => { const p = parts(iso); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${p.off}`; };
/** "November 22, 2026" */
export const longDate = (iso) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'long', day: '2-digit', year: 'numeric' }).format(new Date(iso));
export const ym = (iso) => { const p = parts(iso); return { y: p.year, m: p.month }; };

// ---------- text helpers ----------
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export const decodeEntities = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(/^#x/i.test(e) ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  return ENT[e] ?? m;
});
/** Plain text the way Blogger builds post snippets: </p> becomes a space, newlines become spaces, other tags vanish. */
export const plainText = (html) => decodeEntities(
  html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(/<\/p>/gi, ' ').replace(/<[^>]*>/g, '')
).replace(/\r?\n/g, ' ');
const cut = (s, n) => (s.length > n ? s.slice(0, n) + '...' : s);
export const snippetShort = (html) => cut(plainText(html).trim(), 140);
export const snippetLong = (html) => cut(plainText(html).trim(), 1000);
export const firstImage = (html) => { const m = html.match(/<img[^>]+src=["']([^"']+)["']/i); return m ? decodeEntities(m[1]) : ''; };

// ---------- labels ----------
export const sortLabels = (ls) => [...ls].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
export const labelUrl = (name) => `${SITE}/search/label/${encodeURIComponent(name).replace(/%2F/g, '/')}`;
const label = (name) => ({ name, url: labelUrl(name) });

// ---------- posts ----------
const mk = (p) => {
  const url = SITE + p.path;
  const labels = sortLabels(p.labels || []).map(label);
  const shortSnip = snippetShort(p.body);
  return {
    id: p.id, type: p.type, path: p.path, title: p.title, body: p.body,
    url: Object.assign(new String(url), { canonical: url }),
    href: url,
    labels, labelNames: labels.map((l) => l.name),
    date: Object.assign(new String(longDate(p.published)), { iso8601: isoMinute(p.published) }),
    lastUpdated: { iso8601: isoSecond(p.updated) },
    published: p.published, updated: p.updated,
    snippets: { short: shortSnip, long: snippetLong(p.body) },
    featuredImage: firstImage(p.body),
    description: p.description || '',
    comments: p.comments || [],
    lang: (p.labels || []).includes('lang-ne') ? 'ne' : 'en',
  };
};
export const posts = postsRaw.map(mk); // newest first
export const pages = pagesRaw.map(mk);
const byPath = Object.fromEntries([...posts, ...pages].map((p) => [p.path, p]));
export const findByPath = (path) => byPath[path];

export const popularPosts = popular.map((path) => byPath[path]).filter(Boolean);

export const allLabels = () => {
  const c = {};
  for (const p of posts) for (const l of p.labelNames) c[l] = (c[l] || 0) + 1;
  return sortLabels(Object.keys(c)).map((name) => ({ ...label(name), count: c[name] }));
};

export const archiveMonths = () => {
  const m = new Map();
  for (const p of posts) {
    const { y, m: mo } = ym(p.published);
    const k = `${y}/${mo}`;
    if (!m.has(k)) m.set(k, { y, m: mo, posts: [] });
    m.get(k).posts.push(p);
  }
  return [...m.values()].map((x) => ({
    ...x,
    url: `${SITE}/${x.y}/${x.m}/`,
    name: new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(+x.y, +x.m - 1, 15))),
    count: x.posts.length,
  }));
};

// ---------- the Blogger `data:` object for one page view ----------
export function makeD({ kind, item = null, list = [], label = null, query = null, title = null, url, newerPageUrl = null, olderPageUrl = null, error = false }) {
  const canonical = url;
  const isPost = kind === 'post', isPage = kind === 'page';
  const view = {
    isHomepage: kind === 'home',
    isPost, isPage,
    isSingleItem: isPost || isPage,
    isMultipleItems: !(isPost || isPage),
    isLabelSearch: kind === 'label',
    isSearch: kind === 'label' || kind === 'search',
    isArchive: kind === 'archive',
    isError: error,
    isPreview: false,
    title: item ? item.title : (title || BLOG.title),
    description: item ? (item.description || item.snippets.short) : BLOG.metaDescription,
    featuredImage: item ? item.featuredImage : '',
    url: Object.assign(new String(canonical), { canonical }),
    search: { label, query },
  };
  return { blog: BLOG, view, posts: item ? [item] : list, newerPageUrl, olderPageUrl };
}
