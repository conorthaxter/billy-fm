/* billy-nav.js — the shared top bar for the billy apps (PLAN.md G1, G7).
   Same file in every repo; keep the copies identical. Order: fm · book · reach · plan.
   Usage: <script src="billy-nav.js" data-app="reach" defer></script>
   It inserts a bar at the very top of <body>, outside any app root. It uses the
   page's --ink / --ink-quiet tokens when they exist (billy-fm system), else
   the inherited font colour. Links go to billy.conor.bio (one domain, one login). */
(function () {
  var HOME = 'https://billy.conor.bio';
  var APPS = [
    ['fm', 'https://billy-fm.pages.dev/app'], // fm keeps its own address for now (Google login, public client links)
    ['book', HOME + '/book/'],
    ['reach', HOME + '/reach/'],
    ['plan', HOME + '/plan/'],
  ];
  var me = (document.currentScript && document.currentScript.dataset.app) || '';
  function mount() {
    if (document.getElementById('billy-nav')) return;
    var css = document.createElement('style');
    css.textContent =
      '#billy-nav{display:flex;align-items:stretch;gap:0;height:36px;padding:0 16px;' +
      "font:400 11px/1 'Courier New',Courier,monospace;letter-spacing:.03em;text-transform:lowercase;" +
      'color:var(--ink,inherit);background:var(--ground,transparent);' +
      'border-bottom:1px solid var(--rule,currentColor);position:relative;z-index:50}' +
      '#billy-nav a{display:flex;align-items:center;color:var(--ink-quiet,inherit);text-decoration:none;' +
      'padding:0 12px;border-bottom:2px solid transparent;margin-bottom:-1px}' +
      '#billy-nav .bn-mark{font-weight:700;color:var(--ink,inherit);padding:0 16px 0 0}' +
      '#billy-nav a:hover{color:var(--ink,inherit)}' +
      '#billy-nav a[aria-current="page"]{color:var(--ink,inherit);border-bottom-color:var(--ink,currentColor)}' +
      '#billy-nav a:focus-visible{outline:2px solid var(--ink,currentColor);outline-offset:-2px}' +
      '@media (max-width:767px){#billy-nav{height:44px}}' +
      '@media print{#billy-nav{display:none}}';
    document.head.appendChild(css);
    var nav = document.createElement('nav');
    nav.id = 'billy-nav';
    nav.setAttribute('aria-label', 'billy apps');
    var mark = document.createElement('a');
    mark.className = 'bn-mark';
    mark.href = HOME + '/';
    mark.textContent = 'billy';
    if (me === 'home') mark.setAttribute('aria-current', 'page');
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
