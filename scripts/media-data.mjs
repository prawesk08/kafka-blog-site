// Build-time audio and video data. Reads the live film list (R2 manifest + captions) and the audio manifest, then
//  - writes dist/video-sitemap.xml with every film (new films appear on the next build, no list to edit),
//  - writes VideoObject and AudioObject JSON-LD (and og:video / keywords metas) into each post's HTML, so search
//    engines see them without running the page scripts. The page scripts skip their runtime copy when these exist
//    (ids kvid-schema and kaudio-schema).
// If a feed cannot be fetched the build carries on without that part and says so; it never fails the build.
import fs from 'node:fs';
import path from 'node:path';

const AUDIO = 'https://audio.kafka.blog/';
const URLS = {
  films: AUDIO + 'video-manifest.json',
  captions: 'https://assets.kafka.blog/video-captions.json',
  audio: AUDIO + 'manifest.json',
};
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const attr = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const cut = (s, n) => { s = String(s || '').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
const ldText = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
const iso = (sec) => { sec = Math.round(sec); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return 'PT' + (h ? h + 'H' : '') + (m ? m + 'M' : '') + (s || !(h || m) ? s + 'S' : ''); };

async function getJson(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } catch (e) {
    console.warn(`media-data: could not read ${url} (${e.message})`);
    return null;
  }
}

// Same rules as the film player in kafka-post.js (fromFlat)
function typeOf(cat) { cat = String(cat || ''); return cat === 'documentaries' ? 'documentary' : /^letters/.test(cat) ? 'story' : 'poem'; }

export async function buildMediaData({ posts, out, site }) {
  const [films, caps, audio] = await Promise.all([getJson(URLS.films), getJson(URLS.captions), getJson(URLS.audio)]);
  const byPath = Object.fromEntries(posts.map((p) => [p.path, p]));
  const read = (p) => { const f = path.join(out, p.replace(/^\//, '')); return fs.existsSync(f) ? [f, fs.readFileSync(f, 'utf8')] : [null, null]; };
  const stats = { films: 0, noThumb: 0, noPost: 0, audio: 0 };
  const sitemap = [];

  {
    const cmap = (caps && caps.videos) || {};
    const films0 = films && typeof films === 'object' ? films : {};
    // Films come from two places: the R2 list, and the older captions entries that carry their own src (e.g. Manusi).
    const all = { ...films0 };
    for (const [p, c] of Object.entries(cmap)) if (!all[p] && c && c.src) all[p] = { slug: c.slug, l: c.lang, v16: '' };
    for (const [p, e] of Object.entries(all)) {
      if (!e || (!e.v16 && !(cmap[p] && cmap[p].src))) continue;
      const post = byPath[p];
      if (!post) { stats.noPost++; console.warn('media-data: film has no post on the site: ' + p); continue; }
      const [f, html] = read(p);
      if (!html) continue;
      const c = cmap[p] || {};
      const ogImg = (html.match(/<meta content="([^"]+)" property="og:image"/) || [])[1] || post.featuredImage || '';
      const poster = c.poster || ogImg;
      const src = c.src || AUDIO + e.v16;
      const lang = c.lang || e.l || 'en';
      const title = c.title || e.title || post.title;
      // Same text as the page's meta description: short and specific. The long YouTube-style text stays on YouTube.
      const description = post.description || post.snippets?.short || c.description || post.title;
      const keywords = c.keywords || [];
      const uploaded = c.uploadDate || '2026-11-27';
      const url = post.href;
      const ld = {
        '@context': 'https://schema.org', '@type': 'VideoObject', name: title, description,
        thumbnailUrl: poster ? [poster] : undefined, uploadDate: uploaded + 'T00:00:00Z',
        duration: c.durationIso || (c.duration ? iso(c.duration) : undefined), contentUrl: src, url, inLanguage: lang,
        keywords: keywords.join(', ') || undefined,
        author: { '@type': 'Person', name: 'बासभ (Basava)', alternateName: '@naharchowck' },
        publisher: { '@type': 'Organization', name: 'Kafkaintherun', url: site + '/' },
      };
      if (c.heading_alt) ld.alternateName = c.heading_alt;
      if (c.caption) ld.abstract = c.caption;
      if (c.series) ld.isPartOf = { '@type': 'CreativeWorkSeries', name: c.series.name };
      let h = html;
      if (!h.includes('id="kvid-schema"')) {
        let add = `<script id="kvid-schema" type="application/ld+json">${ldText(ld)}</script>`;
        if (keywords.length) { h = h.replace(/<meta name="keywords"[^>]*>/i, '').replace(/<meta content="[^"]*" name="keywords"[^>]*>/i, ''); add += `<meta name="keywords" content="${attr(keywords.join(', '))}">`; }
        add += `<meta property="og:video" content="${attr(src)}"><meta property="og:video:secure_url" content="${attr(src)}"><meta property="og:video:type" content="video/mp4">`;
        h = h.replace('</head>', add + '</head>');
      }
      if (h !== html) fs.writeFileSync(f, h);
      stats.films++;
      if (!poster) { stats.noThumb++; console.warn('media-data: no thumbnail for ' + p + ', left out of the video sitemap'); continue; }
      const tags = keywords.slice(0, 32).map((k) => `      <video:tag>${esc(k)}</video:tag>`).join('\n');
      sitemap.push(`  <url>
    <loc>${esc(url)}</loc>
    <video:video>
      <video:thumbnail_loc>${esc(poster)}</video:thumbnail_loc>
      <video:title>${esc(cut(title, 100))}</video:title>
      <video:description>${esc(cut(description, 2048))}</video:description>
      <video:content_loc>${esc(src)}</video:content_loc>
${c.duration ? `      <video:duration>${Math.round(c.duration)}</video:duration>\n` : ''}      <video:publication_date>${uploaded}T00:00:00+00:00</video:publication_date>
      <video:family_friendly>yes</video:family_friendly>
      <video:uploader info="${site}/">Basava (बासभ)</video:uploader>
${tags}
    </video:video>
  </url>`);
    }
  }

  if (audio && typeof audio === 'object') {
    for (const [p, e] of Object.entries(audio)) {
      const post = byPath[p];
      if (!post || !e) continue;
      const [f, html] = read(p);
      if (!html || html.includes('id="kaudio-schema"')) continue;
      const lang = e.l === 'ne' ? 'ne' : 'en';
      const g = [];
      for (const [k, sk, voice] of [['f', 'sf', 'female'], ['m', 'sm', 'male']]) {
        if (!e[k] || !e[sk]) continue;
        g.push({ '@type': 'AudioObject', name: `${post.title} (audio, ${voice} voice)`, contentUrl: AUDIO + e[k], encodingFormat: 'audio/mpeg', duration: iso(e[sk]), inLanguage: lang, isPartOf: { '@type': 'BlogPosting', '@id': post.href + '#post', url: post.href } });
      }
      if (!g.length) continue;
      fs.writeFileSync(f, html.replace('</head>', `<script id="kaudio-schema" type="application/ld+json">${ldText({ '@context': 'https://schema.org', '@graph': g })}</script></head>`));
      stats.audio++;
    }
  }

  let sitemapWritten = false;
  if (sitemap.length) {
    fs.writeFileSync(path.join(out, 'video-sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n${sitemap.join('\n')}\n</urlset>\n`);
    sitemapWritten = true;
  }
  console.log(`media-data: ${stats.films} films (${sitemap.length} in video sitemap, ${stats.noThumb} without thumbnail, ${stats.noPost} without a post), ${stats.audio} audio pages`);
  return { sitemapWritten, films: sitemap.length };
}
