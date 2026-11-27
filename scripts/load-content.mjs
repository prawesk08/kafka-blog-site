// content/ -> src/data/posts.json + pages.json (run before every build).
// A post is content/posts/<year>/<month>/<slug>.html (HTML body) or .md (Markdown body), with YAML front matter.
// Its address is the file path: content/posts/2025/05/manusi.html -> https://www.kafka.blog/2025/05/manusi.html
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import yaml from 'js-yaml';
import { marked } from 'marked';

const walk = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])) : []);
const parse = (file) => {
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error('no front matter: ' + file);
  return { fm: yaml.load(m[1]) || {}, body: m[2] };
};
// stable numeric id for posts written after the move (Blogger ids are 19 digits too)
const numId = (s) => (BigInt('0x' + crypto.createHash('sha1').update(s).digest('hex').slice(0, 15)) % 9000000000000000000n + 1000000000000000000n).toString();
const iso = (v) => (v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString());
const comments = fs.existsSync('content/comments.json') ? JSON.parse(fs.readFileSync('content/comments.json', 'utf8')) : {};

const load = (dir, type) => walk(dir).filter((f) => /\.(html|md)$/.test(f)).map((f) => {
  const { fm, body } = parse(f);
  if (fm.draft) return null;
  const rel = path.relative(dir, f).replace(/\\/g, '/').replace(/\.(md|html)$/, '.html');
  const p = type === 'page' ? `/p/${rel}` : `/${rel}`;
  if (type === 'post' && !/^\/\d{4}\/\d{2}\/[^/]+\.html$/.test(p)) throw new Error(`post must live in content/posts/<year>/<month>/: ${f}`);
  const html = f.endsWith('.md') ? marked.parse(body) : body.replace(/\n$/, '');
  return {
    id: String(fm.blogger_id || numId(p)), type, status: 'LIVE', title: String(fm.title ?? ''), path: p,
    published: iso(fm.date), updated: iso(fm.updated || fm.date), description: fm.description || '',
    labels: fm.labels || [], location: fm.location || '', body: html, comments: comments[p] || undefined,
  };
}).filter(Boolean);

const now = Date.now();
const posts = load('content/posts', 'post').filter((p) => Date.parse(p.published) <= now + 60_000).sort((a, b) => b.published.localeCompare(a.published));
const pages = load('content/pages', 'page').sort((a, b) => a.path.localeCompare(b.path));
fs.mkdirSync('src/data', { recursive: true });
fs.writeFileSync('src/data/posts.json', JSON.stringify(posts));
fs.writeFileSync('src/data/pages.json', JSON.stringify(pages));
console.log(`content: ${posts.length} posts, ${pages.length} pages`);
