/* Stats page in the /admin/ top bar: real page views, per day, top pages and where readers came from. */
(function () {
  var h = window.h || (window.CMS && window.CMS.h);
  try { localStorage.setItem('k_me', '1'); } catch (e) {} // your own visits are not counted
  var token = function () { try { return JSON.parse(localStorage.getItem('decap-cms-user') || localStorage.getItem('netlify-cms-user') || '{}').token || ''; } catch (e) { return ''; } };
  var esc = function (v) { return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
  var css = '.kst{max-width:980px;margin:0 auto;padding:28px 20px 60px;font:14px/1.5 Inter,sans-serif;color:#171b26}' +
    '.kst h2{font:700 30px Fraunces,Georgia,serif;margin:0 0 4px}.kst .sub{color:#667085;margin:0 0 20px}' +
    '.kst .row{display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap}.kst .tile{background:#fff;border:1px solid #e4e7ee;border-radius:14px;padding:14px 18px;flex:1;min-width:140px;box-shadow:0 1px 2px rgba(16,24,40,.05)}' +
    '.kst .tile b{display:block;font:700 28px Fraunces,Georgia,serif}.kst .tile span{color:#667085;font-size:12px}' +
    '.kst .card{background:#fff;border:1px solid #e4e7ee;border-radius:14px;padding:18px;margin-bottom:18px;box-shadow:0 1px 2px rgba(16,24,40,.05)}' +
    '.kst .card h3{margin:0 0 12px;font-size:14px;color:#667085;font-weight:600}' +
    '.kst .bars{display:flex;align-items:flex-end;gap:3px;height:140px}.kst .bars i{flex:1;background:#4361ee;border-radius:3px 3px 0 0;min-height:2px;opacity:.85}' +
    '.kst .list div{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-top:1px solid #f0f2f6}.kst .list div:first-child{border:0}.kst .list a{color:#171b26;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.kst .tabs{display:flex;gap:6px;margin-bottom:16px}.kst .tabs button{border:0;border-radius:999px;padding:7px 16px;font:600 13px Inter,sans-serif;background:#fff;color:#667085;cursor:pointer;border:1px solid #e4e7ee}.kst .tabs button.on{background:#eaf0ff;color:#4361ee;border-color:#eaf0ff}';
  function draw(el, days) {
    el.innerHTML = '<style>' + css + '</style><div class="kst"><h2>Visitors</h2><p class="sub">Loading…</p></div>';
    fetch('/api/stats?days=' + days, { headers: { Authorization: 'token ' + token() } }).then(function (r) { return r.json(); }).then(function (d) {
      var box = el.querySelector('.kst');
      if (d.error) { box.innerHTML = '<h2>Visitors</h2><p class="sub">Could not load: ' + esc(d.error) + '. Sign out and in again.</p>'; return; }
      var map = {}; d.daily.forEach(function (x) { map[x.day] = x.n; });
      var cols = [], t0 = Date.parse(d.from), total = 0, max = 1;
      for (var i = 0; i < days; i++) { var k = new Date(t0 + i * 86400000).toISOString().slice(0, 10); var n = map[k] || 0; cols.push([k, n]); total += n; if (n > max) max = n; }
      var today = cols[cols.length - 1][1];
      var tabs = [7, 30, 90].map(function (n) { return '<button data-d="' + n + '" class="' + (n === days ? 'on' : '') + '">' + n + ' days</button>'; }).join('');
      var bars = cols.map(function (c) { return '<i title="' + c[0] + ': ' + c[1] + '" style="height:' + Math.max(2, Math.round(c[1] / max * 100)) + '%"></i>'; }).join('');
      var tops = d.top.map(function (x) { return '<div><a href="' + esc(x.path) + '" target="_blank">' + esc(decodeURIComponent(x.path).replace(/\.html$/, '')) + '</a><b>' + x.n + '</b></div>'; }).join('') || '<div>No views yet.</div>';
      var refs = d.refs.map(function (x) { return '<div><span>' + esc(x.host) + '</span><b>' + x.n + '</b></div>'; }).join('') || '<div>No views yet.</div>';
      box.innerHTML = '<h2>Visitors</h2><p class="sub">Real page views, bots left out. Counting started ' + esc(d.since || 'today') + '; your own visits from this browser are not counted.</p>' +
        '<div class="tabs">' + tabs + '</div>' +
        '<div class="row"><div class="tile"><b>' + total + '</b><span>views, last ' + days + ' days</span></div><div class="tile"><b>' + today + '</b><span>views today</span></div><div class="tile"><b>' + Math.round(total / days) + '</b><span>average per day</span></div></div>' +
        '<div class="card"><h3>Views per day</h3><div class="bars">' + bars + '</div></div>' +
        '<div class="card"><h3>Top pages</h3><div class="list">' + tops + '</div></div>' +
        '<div class="card"><h3>Where readers came from</h3><div class="list">' + refs + '</div></div>';
      box.querySelectorAll('.tabs button').forEach(function (b) { b.onclick = function () { draw(el, +b.dataset.d); }; });
    }).catch(function () { var b = el.querySelector('.kst'); if (b) b.querySelector('.sub').textContent = 'Could not load the numbers.'; });
  }
  // this Decap build has no "extra page" hook, so Stats is a button added to the top bar that opens a panel over the page
  var panel = null;
  function close() { if (panel) { panel.remove(); panel = null; } var b = document.getElementById('k-stats-btn'); if (b) b.classList.remove('on'); }
  function open() {
    close();
    panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;left:0;right:0;bottom:0;top:' + (document.querySelector('[class*="AppHeaderContainer"],header') ? document.querySelector('[class*="AppHeaderContainer"],header').getBoundingClientRect().bottom : 56) + 'px;background:#f4f5f8;z-index:50;overflow:auto';
    document.body.appendChild(panel);
    draw(panel, 30);
    var b = document.getElementById('k-stats-btn'); if (b) b.classList.add('on');
  }
  function addButton() {
    if (document.getElementById('k-stats-btn')) return;
    var mb = Array.prototype.find.call(document.querySelectorAll('button[class*="AppHeaderButton"]'), function (x) { return /^\s*Media\s*$/.test(x.textContent); });
    if (!mb) return;
    var media = mb.closest('li') || mb;
    var b = media.cloneNode(true);
    var btn = b.querySelector('button') || b;
    b.id = 'k-stats-btn';
    btn.className = mb.className.replace(/buttonActive\S*/g, '');
    btn.innerHTML = '<span style="font-size:15px;margin-right:6px">&#128200;</span>Stats';
    btn.onclick = function (e) { e.preventDefault(); e.stopPropagation(); panel ? close() : open(); };
    media.parentNode.insertBefore(b, media.nextSibling);
    // a click on any other top-bar link returns to the normal page
    media.parentNode.addEventListener('click', function (e) { if (!e.target.closest('#k-stats-btn')) close(); }, true);
  }
  window.addEventListener('hashchange', close);
  new MutationObserver(addButton).observe(document.documentElement, { childList: true, subtree: true });
})();
