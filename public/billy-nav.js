/* billy-nav.js — the shared top bar for the billy apps (PLAN.md G1).
   Same file in every repo; keep the copies identical. Order: fm · book · reach · plan.
   Usage: <script src="/billy-nav.js" data-app="reach" defer></script>
   It inserts a thin bar at the very top of <body>, outside any app root, and
   inherits the page's font colour, so it works on light and dark themes. */
(function () {
  var APPS = [
    ['fm', 'https://billy-fm.pages.dev/app'],
    ['book', 'https://billy-book.pages.dev'],
    ['reach', 'https://billy-reach.pages.dev'],
    ['plan', 'https://billy-plan.pages.dev'],
  ];
  var me = (document.currentScript && document.currentScript.dataset.app) || '';
  function mount() {
    if (document.getElementById('billy-nav')) return;
    var css = document.createElement('style');
    css.textContent =
      '#billy-nav{display:flex;align-items:center;gap:18px;height:28px;padding:0 16px;' +
      'font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:lowercase;' +
      'border-bottom:1px solid currentColor;position:relative;z-index:50}' +
      '#billy-nav .bn-mark{font-weight:800;letter-spacing:.14em;margin-right:6px}' +
      '#billy-nav a{color:inherit;text-decoration:none;opacity:.55;padding:6px 0}' +
      '#billy-nav a:hover{opacity:1}' +
      '#billy-nav a[aria-current="page"]{opacity:1;text-decoration:underline;text-underline-offset:4px;text-decoration-thickness:2px}' +
      '@media print{#billy-nav{display:none}}';
    document.head.appendChild(css);
    var nav = document.createElement('nav');
    nav.id = 'billy-nav';
    nav.setAttribute('aria-label', 'billy apps');
    var mark = document.createElement('span');
    mark.className = 'bn-mark';
    mark.textContent = 'billy';
    nav.appendChild(mark);
    APPS.forEach(function (a) {
      var link = document.createElement('a');
      link.href = a[1];
      link.textContent = a[0];
      if (a[0] === me) link.setAttribute('aria-current', 'page');
      nav.appendChild(link);
    });
    document.body.insertBefore(nav, document.body.firstChild);
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
