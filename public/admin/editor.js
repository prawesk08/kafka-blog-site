/* Extras for the /admin/ editor: content blocks, live preview, writing-focused look. */
(function () {
  var h = window.h || (window.CMS && window.CMS.h);
  var esc = function (v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); };
  var unesc = function (v) { return String(v || '').replace(/&lt;/g, '<').replace(/&quot;/g, '"').replace(/&amp;/g, '&'); };

  // ---- blocks the + button can add inside the post -------------------------------------------
  CMS.registerEditorComponent({
    id: 'figure', label: 'Image with caption', icon: 'image',
    fields: [
      { name: 'image', label: 'Image', widget: 'image' },
      { name: 'alt', label: 'Image description (alt text)', widget: 'string', required: false },
      { name: 'caption', label: 'Caption', widget: 'string', required: false },
      { name: 'credit', label: 'Credit / source', widget: 'string', required: false },
      { name: 'size', label: 'Size', widget: 'select', options: ['wide', 'normal', 'small'], default: 'normal' },
    ],
    pattern: /^<figure class="kfig kfig-(\w+)"><img src="([^"]*)" alt="([^"]*)"\/?><figcaption>([^]*?)<cite>([^]*?)<\/cite><\/figcaption><\/figure>$/,
    fromBlock: function (m) { return { size: m[1], image: unesc(m[2]), alt: unesc(m[3]), caption: unesc(m[4]), credit: unesc(m[5]) }; },
    toBlock: function (o) {
      return '<figure class="kfig kfig-' + (o.size || 'normal') + '"><img src="' + esc(o.image) + '" alt="' + esc(o.alt) + '"/><figcaption>' + esc(o.caption) + '<cite>' + esc(o.credit) + '</cite></figcaption></figure>';
    },
    toPreview: function (o, getAsset) {
      var src = o.image ? String(getAsset(o.image) || o.image) : '';
      return '<figure class="kfig kfig-' + (o.size || 'normal') + '"><img src="' + esc(src) + '" alt="' + esc(o.alt) + '"/><figcaption>' + esc(o.caption) + '<cite>' + esc(o.credit) + '</cite></figcaption></figure>';
    },
  });

  CMS.registerEditorComponent({
    id: 'pullquote', label: 'Pull quote', icon: 'quote',
    fields: [{ name: 'quote', label: 'Quote', widget: 'text' }, { name: 'by', label: 'Who said it', widget: 'string', required: false }],
    pattern: /^<blockquote class="kpull">([^]*?)<cite>([^]*?)<\/cite><\/blockquote>$/,
    fromBlock: function (m) { return { quote: unesc(m[1]), by: unesc(m[2]) }; },
    toBlock: function (o) { return '<blockquote class="kpull">' + esc(o.quote).replace(/\n/g, ' ') + '<cite>' + esc(o.by) + '</cite></blockquote>'; },
    toPreview: function (o) { return '<blockquote class="kpull">' + esc(o.quote) + '<cite>' + esc(o.by) + '</cite></blockquote>'; },
  });

  CMS.registerEditorComponent({
    id: 'highlight', label: 'Highlight box', icon: 'sticky_note_2',
    fields: [
      { name: 'text', label: 'Text', widget: 'text' },
      { name: 'tone', label: 'Colour', widget: 'select', options: ['gold', 'rose', 'sage'], default: 'gold' },
    ],
    pattern: /^<aside class="khl khl-(\w+)">([^]*?)<\/aside>$/,
    fromBlock: function (m) { return { tone: m[1], text: unesc(m[2]) }; },
    toBlock: function (o) { return '<aside class="khl khl-' + (o.tone || 'gold') + '">' + esc(o.text).replace(/\n/g, '<br/>') + '</aside>'; },
    toPreview: function (o) { return '<aside class="khl khl-' + (o.tone || 'gold') + '">' + esc(o.text) + '</aside>'; },
  });

  // ---- live preview that looks like the site ---------------------------------------------------
  CMS.registerPreviewStyle('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Martel:wght@300;400;600;700&family=Inter:wght@400;500;600&display=swap');
  CMS.registerPreviewStyle('/kafka-blocks.css');
  CMS.registerPreviewStyle('/admin/preview.css');

  var Post = function (props) {
    var e = props.entry, g = function (k) { return e.getIn(['data', k]); };
    var cover = g('cover'), asset = cover ? props.getAsset(cover) : null;
    var tags = (g('tags') && g('tags').toJS) ? g('tags').toJS() : [];
    var ne = g('language') === 'lang-ne';
    return h('article', { className: 'kp' + (ne ? ' kp-ne' : '') },
      h('div', { className: 'kp-cat' }, g('category') || ''),
      h('h1', { className: 'kp-title' }, g('title') || 'Untitled'),
      g('subtitle') ? h('p', { className: 'kp-sub' }, g('subtitle')) : null,
      h('div', { className: 'kp-meta' }, 'Basava · ' + (g('date') ? new Date(g('date')).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '')),
      asset ? h('div', { className: 'kafka-cover' }, h('img', { src: String(asset), alt: g('cover_alt') || '' })) : null,
      (g('cover_caption') || g('cover_credit')) ? h('p', { className: 'kcover-cap' }, g('cover_caption') || '', g('cover_credit') ? h('cite', null, g('cover_credit')) : null) : null,
      h('div', { className: 'kp-body' + (g('dropcap') ? ' kp-drop' : '') }, props.widgetFor('body')),
      tags.length ? h('div', { className: 'kp-tags' }, tags.map(function (t) { return h('span', { key: t }, t); })) : null,
      h('div', { className: 'kp-seo' },
        h('div', { className: 'kp-seo-h' }, 'How it looks on Google'),
        h('div', { className: 'kp-seo-t' }, g('seo_title') || ((g('title') || 'Untitled') + ' | Kafkaintherun')),
        h('div', { className: 'kp-seo-u' }, 'www.kafka.blog'),
        h('div', { className: 'kp-seo-d' }, g('description') || g('synopsis') || ''),
        h('div', { className: 'kp-seo-h', style: { marginTop: '14px' } }, 'When shared on social media'),
        h('div', { className: 'kp-seo-d' }, g('social') || g('description') || g('synopsis') || '')));
  };
  CMS.registerPreviewTemplate('posts', Post);
})();
