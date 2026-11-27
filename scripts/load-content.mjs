// content/ -> src/data/posts.json + pages.json (run before every build).
// A post is content/posts/<year>/<month>/<slug>.html (HTML body) or .md (Markdown body), with YAML front matter.
// Its address is the file path: content/posts/2025/05/manusi.html -> https://www.kafka.blog/2025/05/manusi.html
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import yaml from 'js-yaml';
import { marked } from 'marked';

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const BLOCKS_CSS = fs.existsSync('public/kafka-blocks.css') ? fs.readFileSync('public/kafka-blocks.css', 'utf8') : '';
// Posts written in the /admin/ editor: subtitle, cover photo and synopsis from the form become the same markup the Blogger posts have.
const compose = (fm, html) => {
  let pre = '';
  if (fm.subtitle) pre += `<p class="kafka-subtitle">${esc(fm.subtitle)}</p>\n`;
  if (fm.cover) {
    pre += `<div class="kafka-cover"><img src="${esc(fm.cover)}" alt="${esc(fm.cover_alt)}"/></div>\n`;
    if (fm.cover_caption || fm.cover_credit) pre += `<p class="kcover-cap">${esc(fm.cover_caption)}${fm.cover_credit ? ` <cite>${esc(fm.cover_credit)}</cite>` : ''}</p>\n`;
  }
  if (fm.synopsis) pre += `<p class="kafka-excerpt" style="display:none">${esc(fm.synopsis)}</p>\n`;
  if (fm.dropcap) html = html.replace(/<p>/, '<p class="kdrop">');
  const out = pre + html;
  return /class="k(fig|pull|hl|drop)/.test(out) && BLOCKS_CSS ? `<style>${BLOCKS_CSS}</style>\n` + out : out;
};
const uniq = (a) => [...new Set(a.filter(Boolean).map(String))];

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
  const isMd = f.endsWith('.md');
  const html = isMd ? compose(fm, marked.parse(body)) : body.replace(/\n$/, '');
  // Editor posts: category + tags + language become the labels the theme already uses
  const labels = fm.category || fm.tags || fm.language ? uniq([fm.category, ...(fm.tags || []), ...(fm.labels || []), fm.language, { 'lang-ne': 'Nepali', 'lang-en': 'English' }[fm.language]]) : (fm.labels || []);
  return {
    id: String(fm.blogger_id || numId(p)), type, status: 'LIVE', title: String(fm.title ?? ''), path: p,
    published: iso(fm.date), updated: iso(fm.updated || fm.date), description: fm.description || fm.synopsis || '',
    seoTitle: fm.seo_title || '', keywords: [].concat(fm.keywords || []).join(', '), social: fm.social || '',
    labels, location: fm.location || '', body: html, comments: comments[p] || undefined,
  };
}).filter(Boolean);

const now = Date.now();
const posts = load('content/posts', 'post').filter((p) => Date.parse(p.published) <= now + 60_000).sort((a, b) => b.published.localeCompare(a.published));
const pages = load('content/pages', 'page').sort((a, b) => a.path.localeCompare(b.path));
fs.mkdirSync('src/data', { recursive: true });
fs.writeFileSync('src/data/posts.json', JSON.stringify(posts));
fs.writeFileSync('src/data/pages.json', JSON.stringify(pages));
console.log(`content: ${posts.length} posts, ${pages.length} pages`);
