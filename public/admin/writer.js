/* "kwrite": the rich writing area for new posts (Quill). Stores clean HTML.
   Toolbar: block style, font, size, line spacing, space after, bold/italic/underline/strike, colour, highlight,
   alignment, lists, indent, quote, pull quote, highlight box, link, photo, photo with caption, video, HTML view. */
(function () {
  var Quill = window.Quill, h = window.h;
  if (!Quill || !h) return;
  var Parchment = Quill.import('parchment');
  var Block = Quill.import('blots/block');
  var BlockEmbed = Quill.import('blots/block/embed');

  var FONTS = [['Default', ''], ['Lora', 'Lora, serif'], ['Fraunces', 'Fraunces, serif'], ['Martel (Nepali)', 'Martel, serif'], ['Spectral', 'Spectral, serif'], ['Inter', 'Inter, sans-serif'], ['Georgia', 'Georgia, serif'], ['Mono', 'monospace']];
  var SIZES = [['Size', ''], ['14', '14px'], ['16', '16px'], ['18', '18px'], ['20', '20px'], ['24', '24px'], ['28', '28px'], ['32', '32px'], ['40', '40px']];
  var LH = [['Line', ''], ['Tight 1.2', '1.2'], ['Normal 1.5', '1.5'], ['Relaxed 1.75', '1.75'], ['Loose 2', '2'], ['Airy 2.4', '2.4']];
  var SP = [['Space after', ''], ['None', '0'], ['Small', '0.5em'], ['Normal', '1em'], ['Large', '1.6em'], ['Extra', '2.4em']];

  var Font = Quill.import('attributors/style/font'); Font.whitelist = FONTS.map(function (f) { return f[1]; }).filter(Boolean); Quill.register(Font, true);
  var Size = Quill.import('attributors/style/size'); Size.whitelist = SIZES.map(function (f) { return f[1]; }).filter(Boolean); Quill.register(Size, true);
  Quill.register(Quill.import('attributors/style/align'), true);
  Quill.register(Quill.import('attributors/style/color'), true);
  Quill.register(Quill.import('attributors/style/background'), true);
  var LineHeight = new Parchment.Attributor.Style('lineheight', 'line-height', { scope: Parchment.Scope.BLOCK, whitelist: LH.map(function (f) { return f[1]; }).filter(Boolean) });
  var SpaceAfter = new Parchment.Attributor.Style('spaceafter', 'margin-bottom', { scope: Parchment.Scope.BLOCK, whitelist: SP.map(function (f) { return f[1]; }).filter(Boolean) });
  Quill.register(LineHeight, true); Quill.register(SpaceAfter, true);

  class PullQuote extends Block {}
  PullQuote.blotName = 'kpull'; PullQuote.tagName = 'DIV'; PullQuote.className = 'kpull';
  Quill.register(PullQuote, true);

  class Highlight extends Block {}
  Highlight.blotName = 'khl'; Highlight.tagName = 'DIV'; Highlight.className = 'khl';
  Quill.register(Highlight, true);

  class Fig extends BlockEmbed {}
  Fig.blotName = 'kfig'; Fig.tagName = 'FIGURE'; Fig.className = 'kfig';
  Fig.create = function (v) {
    var n = document.createElement('figure'); n.setAttribute('class', 'kfig kfig-' + (v.size || 'normal'));
    var img = document.createElement('img'); img.setAttribute('src', v.src); img.setAttribute('alt', v.alt || ''); if (v.path) img.setAttribute('data-path', v.path);
    var cap = document.createElement('figcaption'); cap.textContent = v.caption || '';
    var cite = document.createElement('cite'); cite.textContent = v.credit || ''; cap.appendChild(cite);
    n.setAttribute('contenteditable', 'false'); n.appendChild(img); n.appendChild(cap); return n;
  };
  Fig.value = function (n) {
    var img = n.querySelector('img'), cite = n.querySelector('cite');
    return { src: img.getAttribute('src'), alt: img.getAttribute('alt'), path: img.getAttribute('data-path'), size: (n.className.match(/kfig-(\w+)/) || [])[1] || 'normal', caption: (n.querySelector('figcaption').firstChild || {}).textContent || '', credit: cite ? cite.textContent : '' };
  };
  Quill.register(Fig, true);

  function embedUrl(u) {
    var m;
    if ((m = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/))) return 'https://www.youtube.com/embed/' + m[1];
    if ((m = u.match(/vimeo\.com\/(\d+)/))) return 'https://player.vimeo.com/video/' + m[1];
    return u;
  }
  class Vid extends BlockEmbed {}
  Vid.blotName = 'kvideo'; Vid.tagName = 'DIV'; Vid.className = 'kvideo';
  Vid.create = function (url) {
    var n = document.createElement('div'); n.setAttribute('class', 'kvideo'); n.setAttribute('contenteditable', 'false');
    if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) { var v = document.createElement('video'); v.setAttribute('src', url); v.setAttribute('controls', ''); v.setAttribute('playsinline', ''); n.appendChild(v); }
    else { var f = document.createElement('iframe'); f.setAttribute('src', embedUrl(url)); f.setAttribute('allowfullscreen', 'true'); f.setAttribute('loading', 'lazy'); n.appendChild(f); }
    return n;
  };
  Vid.value = function (n) { var e = n.querySelector('video,iframe'); return e ? e.getAttribute('src') : ''; };
  Quill.register(Vid, true);

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { e.appendChild(c); });
    return e;
  }
  function select(opts, title) {
    var s = el('select', { title: title, class: 'kw-sel' });
    opts.forEach(function (o) { s.appendChild(el('option', { value: o[1], text: o[0] })); });
    return s;
  }

  var Control = window.createClass({
    controlID: 'kw' + Math.random().toString(36).slice(2),
    getInitialState: function () { return {}; },
    componentDidMount: function () { this.build(); },
    componentWillUnmount: function () { this.quill = null; },
    componentDidUpdate: function () {
      var mp = this.props.mediaPaths && this.props.mediaPaths.get && this.props.mediaPaths.get(this.controlID);
      if (mp && this.pending) {
        var path = Array.isArray(mp) ? mp[0] : (mp.toJS ? mp.toJS()[0] : mp), cb = this.pending; this.pending = null;
        if (this.props.onRemoveInsertedMedia) this.props.onRemoveInsertedMedia(this.controlID);
        var shown = this.props.getAsset ? String(this.props.getAsset(path) || path) : path;
        this.assets[shown] = path; cb(shown, path);
      }
    },
    openMedia: function (cb) {
      this.pending = cb;
      this.props.onOpenMediaLibrary({ controlID: this.controlID, forImage: true, privateUpload: false, allowMultiple: false, config: this.props.field.get('media_library') });
    },
    html: function () {
      var h2 = this.quill.root.innerHTML, self = this;
      var d = document.createElement('div'); d.innerHTML = h2;
      Array.prototype.forEach.call(d.querySelectorAll('img'), function (i) { var p = i.getAttribute('data-path') || self.assets[i.getAttribute('src')]; if (p) { i.setAttribute('src', p); i.removeAttribute('data-path'); } });
      Array.prototype.forEach.call(d.querySelectorAll('[contenteditable]'), function (e) { e.removeAttribute('contenteditable'); });
      Array.prototype.forEach.call(d.querySelectorAll('.ql-cursor'), function (e) { e.remove(); });
      var out = d.innerHTML; return out === '<p><br></p>' ? '' : out;
    },
    emit: function () { var v = this.html(); this.last = v; this.props.onChange(v); },
    build: function () {
      var self = this, host = this.mount; this.assets = {};
      var q, range = null;
      var bar = el('div', { class: 'kw-bar' });
      var editorEl = el('div', { class: 'kw-editor' }), src = el('textarea', { class: 'kw-src', spellcheck: 'false' });
      src.style.display = 'none';
      host.appendChild(bar); host.appendChild(editorEl); host.appendChild(src);
      q = this.quill = new Quill(editorEl, { modules: { history: { userOnly: true } }, formats: ['bold', 'italic', 'underline', 'strike', 'link', 'header', 'list', 'indent', 'blockquote', 'align', 'color', 'background', 'font', 'size', 'lineheight', 'spaceafter', 'kpull', 'khl', 'kfig', 'kvideo', 'image', 'script'] });
      editorEl.classList.add('kw-body');
      if (this.props.value) q.clipboard.dangerouslyPasteHTML(this.props.value, 'silent');
      this.last = this.props.value || '';
      q.on('text-change', function (d, o, source) { if (source !== 'silent') self.emit(); });
      q.on('selection-change', function (r) { if (r) range = r; sync(); });
      function cur() { return q.getSelection() || range || { index: q.getLength() - 1, length: 0 }; }
      function fmt(name, val) { var r = cur(); q.focus(); q.setSelection(r.index, r.length); q.format(name, val || false, 'user'); sync(); }
      function line(name, val) { var r = cur(); q.formatLine(r.index, r.length || 1, name, val || false, 'user'); q.focus(); sync(); }
      var btns = [];
      function btn(label, title, fn, active) { var b = el('button', { type: 'button', class: 'kw-b', title: title, text: label }); b.addEventListener('mousedown', function (e) { e.preventDefault(); }); b.addEventListener('click', function () { fn(); }); b._active = active; bar.appendChild(b); btns.push(b); return b; }
      function sep() { bar.appendChild(el('span', { class: 'kw-sep' })); }
      function sel(opts, title, apply, get) { var s = select(opts, title); s.addEventListener('change', function () { apply(s.value); s.blur(); }); s._get = get; bar.appendChild(s); btns.push(s); return s; }
      function fm(name) { return function () { return (q.getFormat(cur()) || {})[name] || ''; }; }

      sel([['Paragraph', ''], ['Heading 1', '1'], ['Heading 2', '2'], ['Heading 3', '3']], 'Block style', function (v) { line('header', v ? +v : false); }, function () { return String((q.getFormat(cur()) || {}).header || ''); });
      sel(FONTS, 'Font', function (v) { fmt('font', v); }, fm('font'));
      sel(SIZES, 'Font size', function (v) { fmt('size', v); }, fm('size'));
      sel(LH, 'Line spacing', function (v) { line('lineheight', v); }, fm('lineheight'));
      sel(SP, 'Space after paragraph', function (v) { line('spaceafter', v); }, fm('spaceafter'));
      sep();
      btn('B', 'Bold', function () { fmt('bold', !(q.getFormat(cur()).bold)); }, function () { return q.getFormat(cur()).bold; }).style.fontWeight = '700';
      btn('I', 'Italic', function () { fmt('italic', !(q.getFormat(cur()).italic)); }, function () { return q.getFormat(cur()).italic; }).style.fontStyle = 'italic';
      btn('U', 'Underline', function () { fmt('underline', !(q.getFormat(cur()).underline)); }, function () { return q.getFormat(cur()).underline; }).style.textDecoration = 'underline';
      btn('S', 'Strikethrough', function () { fmt('strike', !(q.getFormat(cur()).strike)); }, function () { return q.getFormat(cur()).strike; }).style.textDecoration = 'line-through';
      var col = el('input', { type: 'color', value: '#222222', title: 'Text colour', class: 'kw-col' }); col.addEventListener('input', function () { fmt('color', col.value); }); bar.appendChild(el('label', { class: 'kw-cl', title: 'Text colour' }, [el('span', { text: 'A' }), col]));
      var hi = el('input', { type: 'color', value: '#fff3a3', title: 'Highlight', class: 'kw-col' }); hi.addEventListener('input', function () { fmt('background', hi.value); }); bar.appendChild(el('label', { class: 'kw-cl kw-hl', title: 'Highlight' }, [el('span', { text: 'ab' }), hi]));
      sep();
      btn('⇤', 'Align left', function () { line('align', false); });
      btn('↔', 'Centre', function () { line('align', 'center'); });
      btn('⇥', 'Align right', function () { line('align', 'right'); });
      btn('☰', 'Justify', function () { line('align', 'justify'); });
      sep();
      btn('• List', 'Bullet list', function () { line('list', (q.getFormat(cur()).list === 'bullet') ? false : 'bullet'); }, function () { return q.getFormat(cur()).list === 'bullet'; });
      btn('1. List', 'Numbered list', function () { line('list', (q.getFormat(cur()).list === 'ordered') ? false : 'ordered'); }, function () { return q.getFormat(cur()).list === 'ordered'; });
      btn('← ', 'Outdent', function () { var r = cur(); q.format('indent', '-1', 'user'); });
      btn('→', 'Indent', function () { q.format('indent', '+1', 'user'); });
      sep();
      btn('❝ Quote', 'Block quote', function () { line('blockquote', !(q.getFormat(cur()).blockquote)); }, function () { return q.getFormat(cur()).blockquote; });
      btn('Pull quote', 'Large pull quote', function () { line('kpull', !(q.getFormat(cur()).kpull)); }, function () { return q.getFormat(cur()).kpull; });
      btn('Highlight box', 'Highlighted box', function () { line('khl', !(q.getFormat(cur()).khl)); }, function () { return q.getFormat(cur()).khl; });
      btn('Link', 'Link', function () { var u = window.prompt('Link address (https://...)', 'https://'); if (u) fmt('link', u); else if (u === '') fmt('link', false); });
      sep();
      function insert(name, val) { var r = cur(); q.insertEmbed(r.index, name, val, 'user'); q.setSelection(r.index + 1, 0, 'silent'); }
      btn('Photo', 'Photo from your media library or upload', function () { self.openMedia(function (shown, path) { var r = cur(); q.insertEmbed(r.index, 'image', shown, 'user'); setTimeout(function () { var i = q.root.querySelectorAll('img'); Array.prototype.forEach.call(i, function (x) { if (x.getAttribute('src') === shown) x.setAttribute('data-path', path); }); self.emit(); }, 0); }); });
      btn('Photo + caption', 'Photo with caption, description and credit', function () { self.openMedia(function (shown, path) { var alt = window.prompt('Describe the photo (alt text)', '') || '', cap = window.prompt('Caption', '') || '', cr = window.prompt('Credit / source (optional)', '') || ''; insert('kfig', { src: shown, path: path, alt: alt, caption: cap, credit: cr, size: 'normal' }); self.emit(); }); });
      btn('Photo by URL', 'Photo from a web address', function () { var u = window.prompt('Photo address (https://...)'); if (!u) return; var alt = window.prompt('Describe the photo (alt text)', '') || '', cap = window.prompt('Caption', '') || '', cr = window.prompt('Credit / source (optional)', '') || ''; insert('kfig', { src: u, alt: alt, caption: cap, credit: cr, size: 'normal' }); self.emit(); });
      btn('Video', 'YouTube, Vimeo or .mp4 address', function () { var u = window.prompt('Video address (YouTube, Vimeo or a .mp4 link)'); if (u) { insert('kvideo', u); self.emit(); } });
      sep();
      btn('Clear', 'Remove formatting', function () { var r = cur(); q.removeFormat(r.index, r.length || 1, 'user'); });
      btn('Undo', 'Undo', function () { q.history.undo(); });
      btn('Redo', 'Redo', function () { q.history.redo(); });
      var htmlBtn = btn('HTML', 'Switch between the writing view and the HTML source', function () {
        var on = src.style.display === 'none';
        if (on) { src.value = self.html(); src.style.display = 'block'; editorEl.style.display = 'none'; htmlBtn.classList.add('kw-on'); }
        else { q.setContents([], 'silent'); q.clipboard.dangerouslyPasteHTML(src.value, 'silent'); src.style.display = 'none'; editorEl.style.display = 'block'; htmlBtn.classList.remove('kw-on'); self.emit(); }
      });
      src.addEventListener('input', function () { self.last = src.value; self.props.onChange(src.value); });
      function sync() {
        btns.forEach(function (b) {
          if (b.tagName === 'SELECT') { if (b._get) { var v = b._get(); b.value = v; if (b.value !== v) b.value = ''; } }
          else if (b._active) b.classList.toggle('kw-on', !!b._active());
        });
      }
      this.sync = sync;
    },
    render: function () {
      var self = this;
      return h('div', { className: 'kw', ref: function (e) { if (e) self.mount = e; } });
    },
  });
  var Preview = function (props) { return h('div', { className: 'kp-body-html', dangerouslySetInnerHTML: { __html: props.value || '' } }); };
  window.CMS.registerWidget('kwrite', Control, Preview);
})();
