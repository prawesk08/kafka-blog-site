/* WordPress-style layout for the /admin/ post form: title and subtitle on top, writing area on the left,
   collapsible settings on the right. The preview stays closed until you click the eye button. */
(function () {
  var done = false, lastHash = '';
  function tick() {
    var t = document.querySelector('input[id^="title-field"]');
    if (!t) { done = false; return; }
    var cc = t.closest('[class*="ControlContainer"]');
    var pane = cc && cc.parentElement;
    if (pane && !pane.classList.contains('kform')) pane.classList.add('kform');
    if (location.hash !== lastHash) { lastHash = location.hash; done = false; }
    if (!done) {
      var btn = document.querySelector('button[title="Toggle preview"]');
      if (btn && document.querySelector('.Pane2')) { btn.click(); done = true; }
      else if (btn) done = true;
    }
  }
  new MutationObserver(tick).observe(document.documentElement, { childList: true, subtree: true });
})();
