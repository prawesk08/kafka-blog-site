// Import a Google Takeout Blogger export (Takeout/Blogger/Blogs/<blog>/feed.atom) into src/data/*.json.
// Usage: node scripts/import-blogger.mjs path/to/feed.atom
// Only LIVE posts and pages are published; drafts and trashed items are kept in src/data/drafts.json
// so nothing is lost, but they never reach the site.
import fs from 'node:fs';

const src = process.argv[2];
if (!src) { console.error('usage: node scripts/import-blogger.mjs feed.atom'); process.exit(1); }
const xml = fs.readFileSync(src, 'utf8');

const ent = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  return ent[e] ?? m;
});
const tag = (e, name) => {
  const m = e.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]) : '';
};
const idOf = (s) => (s.match(/post-(\d+)/) || [])[1] || '';

const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) => m[1]);
const items = [], comments = [], drafts = [];
for (const e of entries) {
  const type = (e.match(/<blogger:type>(\w+)<\/blogger:type>/) || [])[1];
  const status = (e.match(/<blogger:status>(\w+)<\/blogger:status>/) || [])[1];
  const id = idOf(tag(e, 'id'));
  if (type === 'COMMENT') {
    if (status !== 'LIVE') continue;
    const author = e.match(/<author>([\s\S]*?)<\/author>/)[1];
    comments.push({
      id, postId: idOf(tag(e, 'blogger:parent')), inReplyTo: idOf(tag(e, 'blogger:inReplyTo')),
      author: tag(author, 'name'), authorUrl: tag(author, 'uri'),
      published: tag(e, 'published'), body: tag(e, 'content'),
    });
    continue;
  }
  const item = {
    id, type: type === 'PAGE' ? 'page' : 'post', status,
    title: tag(e, 'title'),
    path: tag(e, 'blogger:filename'),
    published: tag(e, 'published'),
    updated: tag(e, 'updated'),
    description: tag(e, 'blogger:metaDescription'),
    labels: [...e.matchAll(/<category [^>]*term='([^']*)'/g)].map((m) => decode(m[1])),
    location: tag(e, 'blogger:location'),
    body: tag(e, 'content'),
  };
  if (status === 'LIVE') items.push(item); else drafts.push(item);
}

const byId = Object.fromEntries(items.map((p) => [p.id, p]));
for (const c of comments) {
  const p = byId[c.postId];
  if (p) (p.comments ||= []).push(c);
}
for (const p of items) if (p.comments) p.comments.sort((a, b) => a.published.localeCompare(b.published));

const posts = items.filter((p) => p.type === 'post').sort((a, b) => b.published.localeCompare(a.published));
const pages = items.filter((p) => p.type === 'page').sort((a, b) => a.path.localeCompare(b.path));
fs.mkdirSync('src/data', { recursive: true });
fs.writeFileSync('src/data/posts.json', JSON.stringify(posts, null, 1));
fs.writeFileSync('src/data/pages.json', JSON.stringify(pages, null, 1));
fs.writeFileSync('src/data/drafts.json', JSON.stringify(drafts, null, 1));
console.log(`posts ${posts.length}, pages ${pages.length}, comments ${comments.length}, drafts/trashed ${drafts.length}`);
