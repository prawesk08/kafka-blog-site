// After `astro build`: write the Blogger-compatible feed data, Atom/RSS feeds, sitemaps, robots.txt and ads.txt into dist/.
// The Worker (worker/index.js) serves /feeds/... from these files, so the theme's scripts keep working unchanged.
import fs from 'node:fs';
import path from 'node:path';
import { posts, pages, SITE, BLOG, allLabels, plainText } from '../src/lib/site.js';

const OUT = 'dist';
const w = (p, s) => { const f = path.join(OUT, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };
const TAG = `tag:blogger.com,1999:blog-${BLOG.id}`;
const AUTHOR = [{ name: { $t: 'Unknown' }, email: { $t: 'noreply@blogger.com' }, gd$image: { rel: 'http://schemas.google.com/g/2005#thumbnail', width: '16', height: '16', src: 'https://img1.blogblog.com/img/b16-rounded.gif' } }];

// ISO with milliseconds in the blog's zone: 2026-11-22T09:59:14.348-05:00
const isoMs = (iso) => {
  const d = new Date(iso);
  const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'longOffset' });
  const o = Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]));
  return `${o.year}-${o.month}-${o.day}T${o.hour}:${o.minute}:${o.second}.${String(d.getUTCMilliseconds()).padStart(3, '0')}${o.timeZoneName.replace('GMT', '') || '+00:00'}`;
};
const thumb = (u) => {
  if (!u) return null;
  let m;
  if ((m = u.match(/^(https:\/\/lh\d\.googleusercontent\.com\/d\/[^=?#]+)(?:=([^?#]*))?/))) return m[1] + '=s72' + (m[2] ? '-' + m[2] : '') + '-c';
  if ((m = u.match(/^(https:\/\/blogger\.googleusercontent\.com\/img\/.+?)\/(s\d+|w\d+-h\d+[^/]*|[^/]*-rw)\/([^/]+)$/))) return `${m[1]}/s72-${/^s\d+$/.test(m[2]) ? 'c' : m[2] + '-c'}/${m[3]}`;
  if ((m = u.match(/^(https:\/\/blogger\.googleusercontent\.com\/img\/[^=]+?)(=[^/]*)?$/))) return m[1] + '=s72-c';
  return null;
};
const summary = (html) => plainText(html.replace(/<\/p>/gi, '')).replace(/\s+/g, ' ').trim().slice(0, 400);

const entry = (p, full) => {
  const e = {
    id: { $t: `${TAG}.post-${p.id}` },
    published: { $t: isoMs(p.published) },
    updated: { $t: isoMs(p.updated) },
    category: p.labelNames.map((term) => ({ scheme: 'http://www.blogger.com/atom/ns#', term })),
    title: { type: 'text', $t: p.title },
  };
  if (full) e.content = { type: 'html', $t: p.body }; else e.summary = { type: 'text', $t: summary(p.body) };
  const n = (p.comments || []).length;
  e.link = [
    { rel: 'replies', type: 'application/atom+xml', href: `${SITE}/feeds/${p.id}/comments/default`, title: 'Post Comments' },
    { rel: 'replies', type: 'text/html', href: `${p.href}#comment-form`, title: `${n} Comments` },
    { rel: 'edit', type: 'application/atom+xml', href: `https://www.blogger.com/feeds/${BLOG.id}/posts/default/${p.id}` },
    { rel: 'self', type: 'application/atom+xml', href: `https://www.blogger.com/feeds/${BLOG.id}/posts/default/${p.id}` },
    { rel: 'alternate', type: 'text/html', href: p.href, title: p.title },
  ];
  e.author = AUTHOR;
  const t = thumb(p.featuredImage);
  if (t) e.media$thumbnail = { xmlns$media: 'http://search.yahoo.com/mrss/', url: t, height: '72', width: '72' };
  e.thr$total = { $t: String(n) };
  return e;
};

const labels = allLabels();
const feedHead = (kind, n) => ({
  xmlns: 'http://www.w3.org/2005/Atom', xmlns$openSearch: 'http://a9.com/-/spec/opensearchrss/1.0/', xmlns$blogger: 'http://schemas.google.com/blogger/2008',
  xmlns$georss: 'http://www.georss.org/georss', xmlns$gd: 'http://schemas.google.com/g/2005', xmlns$thr: 'http://purl.org/syndication/thread/1.0',
  id: { $t: TAG }, updated: { $t: isoMs(posts[0].updated) },
  category: labels.map((l) => ({ term: l.name })),
  title: { type: 'text', $t: BLOG.title }, subtitle: { type: 'html', $t: '' },
  link: [
    { rel: 'http://schemas.google.com/g/2005#feed', type: 'application/atom+xml', href: `${SITE}/feeds/posts/${kind}` },
    { rel: 'alternate', type: 'text/html', href: `${SITE}/` },
  ],
  author: AUTHOR, generator: { version: '7.00', uri: 'http://www.blogger.com', $t: 'Blogger' },
  openSearch$totalResults: { $t: String(n) }, openSearch$startIndex: { $t: '1' }, openSearch$itemsPerPage: { $t: '25' },
});

// Feeds as NDJSON chunks the Worker can slice without parsing: line 1 = feed head (no entries), then one entry
// per line as "<published ms>\t<entry JSON>". Chunks hold 50 entries: <name>.0.ndjson, <name>.1.ndjson ...
// plus <name>.meta.json {total, chunks}. Paths: feeds/_data/summary, feeds/_data/default/-/<Label> ...
const CH = 50;
const write = (kind, list, label, name) => {
  const base = name || (label ? `feeds/_data/${kind}/-/${encodeURIComponent(label)}` : `feeds/_data/${kind}`);
  const head = feedHead(label ? `${kind}/-/${encodeURIComponent(label)}` : kind, list.length);
  const lines = list.map((p) => `${Date.parse(p.published)}\t${JSON.stringify(entry(p, kind !== 'summary'))}`);
  const chunks = Math.max(1, Math.ceil(lines.length / CH));
  for (let c = 0; c < chunks; c++) w(`${base}.${c}.ndjson`, [JSON.stringify(head), ...lines.slice(c * CH, c * CH + CH)].join('\n'));
  w(`${base}.meta.json`, JSON.stringify({ total: list.length, chunks, per: CH }));
};
for (const kind of ['summary', 'default']) {
  write(kind, posts);
  for (const l of labels) write(kind, posts.filter((p) => p.labelNames.includes(l.name)), l.name);
}
write('default', pages, null, 'feeds/_data/pages');
// comments per post (Blogger: /feeds/<postId>/comments/default)
for (const p of posts) {
  const feed = feedHead('comments', (p.comments || []).length);
  feed.entry = (p.comments || []).map((c) => ({ id: { $t: `${TAG}.post-${c.id}` }, published: { $t: isoMs(c.published) }, updated: { $t: isoMs(c.published) }, title: { type: 'text', $t: plainText(c.body).slice(0, 60) }, content: { type: 'html', $t: c.body }, link: [{ rel: 'alternate', type: 'text/html', href: `${p.href}?showComment=${Date.parse(c.published)}#c${c.id}` }], author: [{ name: { $t: c.author } }] }));
  w(`feeds/_data/comments/${p.id}.json`, JSON.stringify({ version: '1.0', encoding: 'UTF-8', feed }));
}

// ---------- Atom + RSS (readers, follow.it emails) ----------
const x = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const atom = (list, self) => `<?xml version='1.0' encoding='UTF-8'?><feed xmlns='http://www.w3.org/2005/Atom' xmlns:openSearch='http://a9.com/-/spec/opensearchrss/1.0/' xmlns:media='http://search.yahoo.com/mrss/' xmlns:thr='http://purl.org/syndication/thread/1.0'><id>${TAG}</id><updated>${isoMs(posts[0].updated)}</updated>${labels.map((l) => `<category term="${x(l.name)}"/>`).join('')}<title type='text'>${x(BLOG.title)}</title><subtitle type='html'></subtitle><link rel='http://schemas.google.com/g/2005#feed' type='application/atom+xml' href='${SITE}/feeds/posts/default'/><link rel='self' type='application/atom+xml' href='${self}'/><link rel='alternate' type='text/html' href='${SITE}/'/><author><name>बासभ</name></author><generator version='7.00' uri='https://www.kafka.blog'>Kafkaintherun</generator><openSearch:totalResults>${posts.length}</openSearch:totalResults><openSearch:startIndex>1</openSearch:startIndex><openSearch:itemsPerPage>25</openSearch:itemsPerPage>${list.map((p) => `<entry><id>${TAG}.post-${p.id}</id><published>${isoMs(p.published)}</published><updated>${isoMs(p.updated)}</updated>${p.labelNames.map((l) => `<category scheme='http://www.blogger.com/atom/ns#' term='${x(l)}'/>`).join('')}<title type='text'>${x(p.title)}</title><content type='html'>${x(p.body)}</content><link rel='alternate' type='text/html' href='${p.href}' title='${x(p.title)}'/><author><name>बासभ</name></author>${thumb(p.featuredImage) ? `<media:thumbnail url='${x(thumb(p.featuredImage))}' height='72' width='72'/>` : ''}<thr:total>${(p.comments || []).length}</thr:total></entry>`).join('')}</feed>`;
const rss = (list) => `<?xml version='1.0' encoding='UTF-8'?><rss xmlns:atom='http://www.w3.org/2005/Atom' xmlns:media='http://search.yahoo.com/mrss/' version='2.0'><channel><atom:id>${TAG}</atom:id><lastBuildDate>${new Date(posts[0].updated).toUTCString()}</lastBuildDate>${labels.map((l) => `<category>${x(l.name)}</category>`).join('')}<title>${x(BLOG.title)}</title><description></description><link>${SITE}/</link><managingEditor>noreply@blogger.com (बासभ)</managingEditor><generator>Kafkaintherun</generator>${list.map((p) => `<item><guid isPermaLink='false'>${TAG}.post-${p.id}</guid><pubDate>${new Date(p.published).toUTCString()}</pubDate><atom:updated>${isoMs(p.updated)}</atom:updated>${p.labelNames.map((l) => `<category domain='http://www.blogger.com/atom/ns#'>${x(l)}</category>`).join('')}<title>${x(p.title)}</title><description>${x(p.body)}</description><link>${p.href}</link><author>noreply@blogger.com (बासभ)</author>${thumb(p.featuredImage) ? `<media:thumbnail url='${x(thumb(p.featuredImage))}' height='72' width='72'/>` : ''}</item>`).join('')}</channel></rss>`;
w('feeds/_data/atom.xml', atom(posts.slice(0, 25), `${SITE}/feeds/posts/default`));
w('feeds/_data/rss.xml', rss(posts.slice(0, 25)));

// ---------- sitemaps (same shape as Blogger's) ----------
w('sitemap.xml', `<?xml version='1.0' encoding='UTF-8'?><urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'>${posts.map((p) => `<url><loc>${p.href}</loc><lastmod>${new Date(p.updated).toISOString()}</lastmod></url>`).join('')}</urlset>`);
w('sitemap-pages.xml', `<?xml version='1.0' encoding='UTF-8'?><urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'><url><loc>${SITE}/</loc></url>${pages.map((p) => `<url><loc>${p.href}</loc><lastmod>${new Date(p.updated).toISOString()}</lastmod></url>`).join('')}</urlset>`);
w('robots.txt', `User-agent: Mediapartners-Google\nDisallow: \n\nUser-agent: *\nDisallow: /search\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\nSitemap: ${SITE}/sitemap-pages.xml\nSitemap: https://assets.kafka.blog/video-sitemap.xml\n`);
w('ads.txt', 'google.com, pub-9227280103943233, DIRECT, f08c47fec0942fa0\n');

// ---------- list index for the Worker (search, paging) ----------
w('_kidx.json', JSON.stringify(posts.map((p) => ({ i: p.id, u: p.href, t: p.title, d: p.date.iso8601, ds: String(p.date), l: p.labelNames, f: p.featuredImage, s: p.snippets.short, q: (p.title + ' ' + plainText(p.body).slice(0, 4000) + ' ' + p.labelNames.join(' ')).toLowerCase() }))));
console.log('postbuild: feeds, sitemaps, robots.txt, ads.txt written');
