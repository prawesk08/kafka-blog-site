// kafka.blog Worker. Static files (every post, page, label page, sitemap) are served straight from the
// assets before this code runs; the Worker only sees requests that do not match a file:
//   /                         -> /index.html
//   /2025/04/ , /2025/        -> month / year archive
//   /search/label/<Label>     -> prerendered label page; with ?updated-max / ?start, a rendered older page
//   /search?q=... , /search?updated-max=...  -> rendered list
//   /feeds/...                -> Blogger-compatible feeds (JSON, Atom, RSS), used by the theme scripts and readers
//   old WordPress paths       -> 301 to the matching post (kafka-oldpaths.js still handles the rest in the page)
const SITE = 'https://www.kafka.blog';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // after the move: kafka.blog -> www.kafka.blog, like Blogger did
    if (url.hostname === 'kafka.blog') { url.hostname = 'www.kafka.blog'; return Response.redirect(url.toString(), 301); }
    let path;
    try { path = decodeURIComponent(url.pathname); } catch { path = url.pathname; }
    const q = url.searchParams;
    const asset = (p, status) => serve(env, url, p, status);

    if (path === '/' || path === '/index.html') return asset('/index.html');
    if (path === '/admin' ) return Response.redirect(url.origin + '/admin/', 301);
    if (path === '/admin/') return asset('/admin/index.html');
    if (path === '/api/auth') return oauthStart(env, url);
    if (path === '/api/callback') return oauthCallback(env, url, request);
    if (path.startsWith('/feeds/')) return feeds(env, url, path, q);

    let m;
    if ((m = path.match(/^\/(\d{4})\/(\d{2})\/?$/))) {
      if (!q.has('updated-max')) { const r = await asset(`/${m[1]}/${m[2]}/index.html`); if (r.status === 200) return r; }
    }
    if ((m = path.match(/^\/(\d{4})\/?$/))) {
      return list(env, url, { shell: '/_list.html', filter: (p) => p.d.startsWith(m[1] + '-'), per: 25, q });
    }
    if ((m = path.match(/^\/search\/label\/(.+?)\/?$/))) {
      const label = m[1];
      const plain = !q.has('updated-max') && !q.has('start') && !q.has('published-max');
      const shell = `/search/label/${label}.html`;
      if (plain) return asset(shell);
      return list(env, url, { shell, filter: (p) => p.l.includes(label), per: +(q.get('max-results') || 20), q, base: `${SITE}/search/label/${encodeURIComponent(label)}` });
    }
    if (path === '/search' || path === '/search/') {
      if (q.get('q')) {
        const words = q.get('q').toLowerCase().split(/\s+/).filter(Boolean);
        return list(env, url, { shell: '/_search.html', filter: (p) => words.every((w) => p.q.includes(w)), per: 20, q, query: q.get('q'), base: `${SITE}/search`, keep: { q: q.get('q') } });
      }
      return list(env, url, { shell: '/_list.html', filter: () => true, per: +(q.get('max-results') || 10), q, base: `${SITE}/search` });
    }
    // Blogger mobile/legacy variants of a real page, e.g. /p/books.html/ or /2025/05/manusi.html/
    if (path.endsWith('.html/')) return Response.redirect(SITE + path.slice(0, -1), 301);
    // old WordPress permalinks (/2023/02/15/slug/) -> the Blogger post with that slug, when we know it
    if ((m = path.match(/^\/\d{4}\/\d{2}\/\d{2}\/([^/]+)\/?$/))) {
      const idx = await index(env, url);
      const hit = idx.find((p) => p.u.endsWith('/' + m[1] + '.html'));
      if (hit) return Response.redirect(hit.u, 301);
    }
    return asset('/404.html', 404);
  },
};

async function serve(env, url, p, status) {
  const r = await env.ASSETS.fetch(new URL(encodeURI(p), url));
  if (status && r.status === 200) return new Response(r.body, { status, headers: r.headers });
  if (r.status === 404 && p !== '/404.html') return serve(env, url, '/404.html', 404);
  return r;
}

let IDX = null;
async function index(env, url) {
  if (!IDX) IDX = await (await env.ASSETS.fetch(new URL('/_kidx.json', url))).json();
  return IDX;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const card = (p) => `<article class="kcard" data-id="${p.i}"><span class="lbls" hidden="hidden">${p.l.map((l) => `<i>${esc(l)}</i>`).join('')}</span>
<a aria-hidden="true" class="pic" href="${esc(p.u)}" tabindex="-1"><img alt=""${p.f ? ` src="${esc(p.f)}"` : ''} loading="lazy"></a>
<div><span class="chip-slot"></span>
<h3><a href="${esc(p.u)}">${esc(p.t)}</a></h3>
<p class="exc">${esc(p.s)}</p>
<p class="by" data-date="${p.d}">${esc(p.ds)}</p>
</div>
</article>`;

// Blogger-style paging over the index (newest first): ?updated-max=<iso> (posts older than it),
// &reverse-paginate=true (the page just newer than it), &start=N, &max-results=N
async function list(env, url, { shell, filter, per, q, query, base = SITE + '/search', keep = {} }) {
  per = Math.min(Math.max(per || 10, 1), 50);
  const all = (await index(env, url)).filter(filter);
  const t = (iso) => Date.parse(iso);
  let start = 0;
  const um = q.get('updated-max') || q.get('published-max');
  if (um && !isNaN(t(um))) {
    const cut = t(um);
    if (q.get('reverse-paginate') === 'true') {
      const firstOlder = all.findIndex((p) => t(p.d) <= cut);
      const end = firstOlder < 0 ? all.length : firstOlder;
      start = Math.max(0, end - per);
    } else {
      start = all.findIndex((p) => t(p.d) < cut);
      if (start < 0) start = all.length;
    }
  } else if (q.get('start')) start = Math.max(0, +q.get('start') || 0);
  const page = all.slice(start, start + per);
  const qs = (o) => '?' + Object.entries({ ...keep, ...o }).map(([k, v]) => `${k}=${k === 'q' ? encodeURIComponent(v) : v}`).join('&');
  const older = all[start + per] && page.length ? `${base}${qs({ 'updated-max': page[page.length - 1].d, 'max-results': per })}` : null;
  const newer = start > 0 && page.length ? `${base}${qs({ 'updated-max': page[0].d, 'max-results': per, 'reverse-paginate': 'true' })}` : null;
  const pager = `<div class="pager">${newer ? `<a href="${esc(newer)}">&#8249; Newer posts <span class="ne" lang="ne">नयाँ</span></a>` : '<span></span>'}${older ? `<a href="${esc(older)}">Older posts <span class="ne" lang="ne">पुराना</span> &#8250;</a>` : ''}</div>`;
  const body = (page.length ? page.map(card).join('\n') : '<p class="k-empty">Nothing here yet.</p>') + '\n' + pager;
  const res = await serve(env, url, shell);
  if (res.status !== 200) return res;
  let rw = new HTMLRewriter()
    .on('article.kcard', { element(e) { e.remove(); } })
    .on('div.pager', { element(e) { e.replace(body, { html: true }); } });
  if (query != null) rw = rw.on('h1', { text(t) { if (t.text.includes('__KQ__')) t.replace(esc(query), { html: true }); } });
  const out = rw.transform(res);
  const h = new Headers(out.headers);
  h.set('X-Robots-Tag', 'noindex');
  return new Response(out.body, { status: 200, headers: h });
}

// ---------------- feeds ----------------
async function feeds(env, url, path, q) {
  let m, base, label = null;
  if ((m = path.match(/^\/feeds\/posts\/(default|summary)(?:\/-\/(.+?))?\/?$/))) {
    label = m[2] || null;
    base = label ? `/feeds/_data/${m[1]}/-/${encodeURIComponent(label.split('/')[0])}` : `/feeds/_data/${m[1]}`;
  } else if ((m = path.match(/^\/feeds\/posts\/(?:default|summary)\/(\d+)\/?$/))) {
    return single(env, url, m[1], q);
  } else if ((m = path.match(/^\/feeds\/pages\/(default|summary)\/?$/))) {
    base = '/feeds/_data/pages';
  } else if ((m = path.match(/^\/feeds\/(\d+)\/comments\/(?:default|summary)\/?$/))) {
    return jsonOut(await (await env.ASSETS.fetch(new URL(`/feeds/_data/comments/${m[1]}.json`, url))).text(), q);
  } else if (/^\/feeds\/comments\//.test(path)) {
    return jsonOut(JSON.stringify({ version: '1.0', encoding: 'UTF-8', feed: { entry: [], openSearch$totalResults: { $t: '0' } } }), q);
  } else {
    return new Response('Not found', { status: 404 });
  }
  const alt = q.get('alt') || 'atom';
  if (alt === 'rss' || (alt === 'atom' && !label && base === '/feeds/_data/default' && !q.has('start-index') && !q.has('max-results'))) {
    const f = alt === 'rss' ? '/feeds/_data/rss.xml' : '/feeds/_data/atom.xml';
    const r = await env.ASSETS.fetch(new URL(f, url));
    return new Response(r.body, { headers: { 'Content-Type': alt === 'rss' ? 'application/rss+xml; charset=UTF-8' : 'application/atom+xml; charset=UTF-8', 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' } });
  }
  const metaR = await env.ASSETS.fetch(new URL(base + '.meta.json', url));
  if (metaR.status !== 200) return jsonOut(JSON.stringify({ version: '1.0', encoding: 'UTF-8', feed: { entry: [], openSearch$totalResults: { $t: '0' } } }), q);
  const meta = await metaR.json();
  const startIndex = Math.max(1, +(q.get('start-index') || 1));
  const max = Math.min(Math.max(0, q.has('max-results') ? +q.get('max-results') : 25), 500);
  const pmax = q.get('published-max') || q.get('updated-max');
  const pmin = q.get('published-min') || q.get('updated-min');
  const cutMax = pmax ? Date.parse(pmax) : null, cutMin = pmin ? Date.parse(pmin) : null;
  // which chunks do we need?
  let head = null, lines = [];
  const filtered = cutMax || cutMin;
  const from = filtered ? 0 : Math.floor((startIndex - 1) / meta.per);
  const to = filtered ? meta.chunks - 1 : Math.min(meta.chunks - 1, Math.floor((startIndex - 1 + Math.max(max, 1) - 1) / meta.per));
  for (let c = from; c <= to; c++) {
    const t = await (await env.ASSETS.fetch(new URL(`${base}.${c}.ndjson`, url))).text();
    const ls = t.split('\n');
    if (!head) head = ls[0];
    lines.push(...ls.slice(1));
  }
  let total = meta.total;
  let offset = filtered ? 0 : from * meta.per;
  if (filtered) {
    lines = lines.filter((l) => { const ms = +l.slice(0, l.indexOf('\t')); return (cutMax == null || ms <= cutMax) && (cutMin == null || ms >= cutMin); });
    total = lines.length;
  }
  const pick = lines.slice(startIndex - 1 - offset, startIndex - 1 - offset + max).filter(Boolean).map((l) => l.slice(l.indexOf('\t') + 1));
  if (alt !== 'json' && alt !== 'json-in-script') {
    return new Response(atomFrom(head, pick), { headers: { 'Content-Type': 'application/atom+xml; charset=UTF-8', 'Cache-Control': 'public, max-age=300' } });
  }
  let h = head
    .replace(/"openSearch\$totalResults":\{"\$t":"\d+"\}/, `"openSearch$totalResults":{"$t":"${total}"}`)
    .replace(/"openSearch\$startIndex":\{"\$t":"\d+"\}/, `"openSearch$startIndex":{"$t":"${startIndex}"}`)
    .replace(/"openSearch\$itemsPerPage":\{"\$t":"\d+"\}/, `"openSearch$itemsPerPage":{"$t":"${max}"}`);
  const body = `{"version":"1.0","encoding":"UTF-8","feed":${h.slice(0, -1)}${pick.length ? `,"entry":[${pick.join(',')}]` : ''}}}`;
  return jsonOut(body, q);
}

async function single(env, url, id, q) {
  const idx = await index(env, url);
  const i = idx.findIndex((p) => p.i === id);
  if (i < 0) return new Response('Not found', { status: 404 });
  const c = Math.floor(i / 50);
  const t = await (await env.ASSETS.fetch(new URL(`/feeds/_data/default.${c}.ndjson`, url))).text();
  const l = t.split('\n')[1 + (i % 50)];
  const body = `{"version":"1.0","encoding":"UTF-8","entry":${l.slice(l.indexOf('\t') + 1)}}`;
  return jsonOut(body, q);
}

function jsonOut(body, q) {
  const cb = q.get('callback');
  if (q.get('alt') === 'json-in-script' || cb) {
    const fn = (cb || 'callback').replace(/[^\w.$]/g, '');
    return new Response(`// API callback\n${fn}(${body});`, { headers: { 'Content-Type': 'text/javascript; charset=UTF-8', 'Cache-Control': 'public, max-age=300' } });
  }
  return new Response(body, { headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' } });
}

// Minimal Atom for non-JSON requests that are not the main feed (e.g. /feeds/posts/default/-/History)
function atomFrom(head, entries) {
  const x = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const h = JSON.parse(head);
  const es = entries.map((s) => JSON.parse(s)).map((e) => `<entry><id>${x(e.id.$t)}</id><published>${e.published.$t}</published><updated>${e.updated.$t}</updated>${(e.category || []).map((c) => `<category scheme="http://www.blogger.com/atom/ns#" term="${x(c.term)}"/>`).join('')}<title type="text">${x(e.title.$t)}</title>${e.content ? `<content type="html">${x(e.content.$t)}</content>` : `<summary type="text">${x(e.summary.$t)}</summary>`}${e.link.map((l) => `<link rel="${l.rel}" type="${l.type || ''}" href="${x(l.href)}"${l.title ? ` title="${x(l.title)}"` : ''}/>`).join('')}<author><name>बासभ</name></author>${e.media$thumbnail ? `<media:thumbnail xmlns:media="http://search.yahoo.com/mrss/" url="${x(e.media$thumbnail.url)}" height="72" width="72"/>` : ''}</entry>`).join('');
  return `<?xml version='1.0' encoding='UTF-8'?><feed xmlns="http://www.w3.org/2005/Atom"><id>${x(h.id.$t)}</id><updated>${h.updated.$t}</updated><title type="text">${x(h.title.$t)}</title><link rel="alternate" type="text/html" href="${SITE}/"/>${es}</feed>`;
}

// ---------------- GitHub sign-in for the post editor (/admin/) ----------------
// Needs a GitHub OAuth App whose callback URL is https://<site>/api/callback, with its id and secret stored
// as the Worker secrets GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.
function oauthStart(env, url) {
  if (!env.GITHUB_CLIENT_ID) return new Response('Editor sign-in is not set up yet (GITHUB_CLIENT_ID missing).', { status: 500 });
  const state = crypto.randomUUID();
  const gh = new URL('https://github.com/login/oauth/authorize');
  gh.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  gh.searchParams.set('redirect_uri', url.origin + '/api/callback');
  gh.searchParams.set('scope', url.searchParams.get('scope') || 'public_repo');
  gh.searchParams.set('state', state);
  return new Response(null, { status: 302, headers: { Location: gh.toString(), 'Set-Cookie': `k_oauth=${state}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=600` } });
}

async function oauthCallback(env, url, request) {
  const code = url.searchParams.get('code'), state = url.searchParams.get('state');
  const saved = (/(?:^|;\s*)k_oauth=([^;]+)/.exec(request.headers.get('Cookie') || '') || [])[1];
  let msg, status = 'success';
  try {
    if (!code) throw new Error('missing code');
    if (!state || state !== saved) throw new Error('sign-in expired, please try again');
    const r = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'kafka-blog-site' },
      body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: url.origin + '/api/callback', state }),
    });
    const j = await r.json();
    if (!j.access_token) throw new Error(j.error_description || j.error || 'no token');
    msg = { token: j.access_token, provider: 'github' };
  } catch (e) { status = 'error'; msg = { message: String(e.message || e) }; }
  const payload = JSON.stringify(`authorization:github:${status}:${JSON.stringify(msg)}`);
  const html = `<!doctype html><meta charset="utf-8"><title>Signing in</title><script>
(function(){
  function done(e){ if(!window.opener) return; window.opener.postMessage(${payload}, e.origin); window.removeEventListener('message', done); setTimeout(function(){ window.close(); }, 300); }
  window.addEventListener('message', done, false);
  if (window.opener) window.opener.postMessage('authorizing:github', '*'); else document.body.textContent = 'Signed in. You can close this window.';
})();
</script>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Set-Cookie': 'k_oauth=; Path=/api; Max-Age=0' } });
}
