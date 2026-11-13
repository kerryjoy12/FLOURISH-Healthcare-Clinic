// Force full page loads for the locally generated section of the mirror.
// The mirrored Base44 SPA handles clicks client-side and renders its own
// routes, which have no backend data locally (products shows the empty
// "No products found" state) or do not exist in the older page bundle at all
// (gigs, admin). The statically generated pages are the real thing, so every
// link into these sections must bypass the SPA router.
(function () {
  var STATIC_PATHS = ['/products', '/gigs', '/admin'];

  function staticBase(pathname) {
    var clean = pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/';
    for (var i = 0; i < STATIC_PATHS.length; i++) {
      var base = STATIC_PATHS[i];
      if (clean === base || clean.indexOf(base + '/') === 0) return true;
    }
    return false;
  }

  document.addEventListener('click', function (event) {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    var target = event.target;
    var anchor = target && target.closest ? target.closest('a[href]') : null;
    if (!anchor) return;

    var url;
    try {
      url = new URL(anchor.getAttribute('href'), window.location.href);
    } catch (err) {
      return;
    }

    if (url.origin !== window.location.origin) return;
    if (!staticBase(url.pathname)) return;

    event.preventDefault();
    event.stopPropagation();
    var destination = url.pathname.replace(/\.html$/, '');
    if (!/\/$/.test(destination)) destination += '/';
    window.location.assign(destination);
  }, true);
})();
