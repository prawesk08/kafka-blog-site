// Page signature used to compare the new build with the live Blogger page (same function runs in both places).
function SIG(doc) {
  const out = [];
  const walk = (el, d) => {
    for (const c of el.children) {
      const t = c.tagName.toLowerCase();
      if (['svg', 'path'].includes(t)) { out.push('  '.repeat(d) + 'svg'); continue; }
      if (t === 'script') { out.push('  '.repeat(d) + 'script' + (c.getAttribute('src') ? ' src=' + c.getAttribute('src').replace(/^https?:\/\/[^/]+/, '') : ' type=' + (c.getAttribute('type') || '') + ' len~' + Math.round(c.textContent.trim().length / 50) * 50)); continue; }
      if (t === 'style') { out.push('  '.repeat(d) + 'style len~' + Math.round(c.textContent.trim().length / 50) * 50); continue; }
      const a = [...c.attributes].filter((x) => !['style'].includes(x.name)).map((x) => x.name + '=' + x.value.replace(/https:\/\/www\.kafka\.blog/g, '').slice(0, 90)).sort().join(' ');
      out.push('  '.repeat(d) + t + (a ? ' ' + a : ''));
      if (c.matches('.prose, .comments, #comments, .post-body')) { out.push('  '.repeat(d + 1) + '[text ' + c.textContent.replace(/\s+/g, ' ').trim().length + ']'); continue; }
      walk(c, d + 1);
    }
  };
  walk(doc.head, 0); out.push('=== BODY'); walk(doc.body, 0);
  return out.join('\n');
}
if (typeof module !== 'undefined') module.exports = SIG;
