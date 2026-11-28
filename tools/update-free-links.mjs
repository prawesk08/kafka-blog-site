#!/usr/bin/env node
// Finds legitimately free copies of the books on content/pages/books.html and keeps
// <p class="kafka-item-free" data-auto> in sync:
//   Read   -> Open Library / Internet Archive (public-domain scans only)
//   Listen -> LibriVox recordings on the Internet Archive
// A link is added only when the API lists the book AND the URL answers 200.
// Links you wrote by hand (kafka-item-free without data-auto) are never touched.
// Auto links that stop working are removed on the next run. If a lookup fails
// (network trouble) the existing auto link is left alone.
import { readFileSync, writeFileSync } from 'node:fs';

const PAGE = process.argv[2] || 'content/pages/books.html';
const UA = { 'user-agent': 'kafka-blog-free-links/1.0 (+https://www.kafka.blog)' };

const norm = s => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&amp;/g, 'and').replace(/[^a-z0-9 ]+/g, ' ').replace(/\b(the|a|an)\b/g, ' ').replace(/\s+/g, ' ').trim();
const unesc = s => s.replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

export function parseItems(html) {
  const out = []; const re = /<div class="kafka-item[ "][^>]*>/g; let m;
  while ((m = re.exec(html))) {
    let depth = 1, i = m.index + m[0].length; const tag = /<div\b|<\/div>/g; tag.lastIndex = i; let t;
    while (depth && (t = tag.exec(html))) { depth += t[0] === '</div>' ? -1 : 1; i = t.index; }
    const end = i; // index of the item's closing </div>
    const block = html.slice(m.index, end);
    const h3 = block.match(/<h3>([\s\S]*?)<\/h3>/); if (!h3) continue;
    const by = (block.match(/class="kafka-item-by">([\s\S]*?)<\/p>/) || [, ''])[1].replace(/<[^>]+>/g, '');
    out.push({ start: m.index, end, block, title: unesc(h3[1].replace(/<[^>]+>/g, '')), by: unesc(by) });
  }
  return out;
}

export function query(item) {
  if (/[^\u0000-ɏ‘-‟]/.test(item.title)) return null;        // Nepali/Japanese titles: skip
  const title = item.title.replace(/\s*\(.*?\)\s*/g, ' ').replace(/:.*$/, '').trim();
  const first = item.by.split(/\s·\s|,\s*\d/)[0].replace(/\(.*?\)/g, '').trim();
  const last = first.split(/\s+/).pop().replace(/[^\p{L}-]/gu, '');
  if (!title || !last) return null;
  return { title, last };
}

async function get(f, url, json) {
  const r = await f(url, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(8000) });
  if (r.status === 404) return { ok: false, status: 404 };
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return { ok: true, status: r.status, data: json ? await r.json() : undefined };
}
const alive = async (f, url) => { try { const r = await f(url, { method: 'GET', headers: UA, redirect: 'follow', signal: AbortSignal.timeout(8000) }); return r.status === 200; } catch { return false; } };
const matches = (got, want) => { const a = norm(got), b = norm(want); return a === b || a.startsWith(b + ' ') || b.startsWith(a + ' '); };

// Read -> Open Library, public-domain scans only (ebook_access=public), linked on archive.org
export async function findRead(f, q) {
  const url = `https://openlibrary.org/search.json?has_fulltext=true&limit=8&fields=title,author_name,ebook_access,ia&title=${encodeURIComponent(q.title)}&author=${encodeURIComponent(q.last)}`;
  const r = await get(f, url, true); if (!r.ok) return null;
  const hit = (r.data.docs || []).find(d => d.ebook_access === 'public' && d.ia && d.ia.length && matches(d.title, q.title) && (d.author_name || []).some(a => norm(a).includes(norm(q.last))));
  if (!hit) return null;
  const link = `https://archive.org/details/${hit.ia[0]}`;
  return (await alive(f, link)) ? link : null;
}
// Listen -> LibriVox recordings, which the Internet Archive mirrors in the librivoxaudio collection
export async function findListen(f, q) {
  const esc = s => s.replace(/["\\]/g, ' ');
  const query = `collection:librivoxaudio AND title:("${esc(q.title)}") AND creator:(${esc(q.last)})`;
  const url = `https://archive.org/advancedsearch.php?output=json&rows=8&fl[]=identifier&fl[]=title&q=${encodeURIComponent(query)}`;
  const r = await get(f, url, true); if (!r.ok) return null;
  const hit = ((r.data.response || {}).docs || []).find(d => matches(String(d.title).replace(/\s*\(.*?\)\s*/g, ' '), q.title));
  if (!hit) return null;
  const link = `https://archive.org/details/${hit.identifier}`;
  return (await alive(f, link)) ? link : null;
}

const AUTO = /\n?[ \t]*<p class="kafka-item-free" data-auto>[\s\S]*?<\/p>/;
export async function run(html, f = fetch, log = console.log) {
  const items = parseItems(html); let out = html, shift = 0, added = 0, removed = 0, kept = 0;
  const todo = items.filter(it => !/class="kafka-item-free"(?! data-auto)/.test(it.block) && query(it));
  log(`checking ${todo.length} books`);
  const found = new Map(); let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => { while (next < todo.length) { const it = todo[next++]; const q = query(it); try { found.set(it, { read: await findRead(f, q), listen: await findListen(f, q) }); } catch (e) { found.set(it, { err: e.message }); } } }));
  for (const it of todo) {
    const q = query(it);
    const had = AUTO.exec(it.block);
    let read, listen;
    const r = found.get(it); if (r.err) { log(`  ! ${it.title}: ${r.err} (leaving as is)`); kept++; continue; }
    read = r.read; listen = r.listen;
    if (!had && !read && !listen) continue;
    let block = it.block.replace(AUTO, '').replace(/\s+$/, '');
    if (read || listen) {
      const a = [];
      if (read) a.push(`<a href="${read}" target="_blank" rel="noopener">📖 Read</a>`);
      if (listen) a.push(`<a href="${listen}" target="_blank" rel="noopener">🎧 Listen</a>`);
      block += `\n  <p class="kafka-item-free" data-auto>${a.join(' ')}</p>`;
    }
    if (block !== it.block) {
      out = out.slice(0, it.start + shift) + block + out.slice(it.end + shift);
      shift += block.length - it.block.length;
      if (had && !(read || listen)) { removed++; log(`  - ${it.title}`); } else { added++; log(`  + ${it.title}: ${read ? 'read ' : ''}${listen ? 'listen' : ''}`); }
    }
  }
  return { html: out, added, removed, kept };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const before = readFileSync(PAGE, 'utf8');
  const res = await run(before);
  if (res.html !== before) writeFileSync(PAGE, res.html);
  console.log(`free links: ${res.added} added/updated, ${res.removed} removed, ${res.kept} unchanged because a lookup failed`);
}
