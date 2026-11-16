// Point the mirrored app's backend calls at the live Base44 app.
//
// The clone is served from GitHub Pages, so the SPA's root-relative calls to
// /api/... would hit the static host and fail. The live app is the source of
// truth for products, articles, gigs and enquiries (and for the admin panel
// that edits them), so every same-origin /api/ request is forwarded there.
(function () {
  var UPSTREAM = 'https://feathered-flourish-health-hub.base44.app';

  function toUpstream(url) {
    try {
      var parsed = new URL(url, window.location.href);
      if (parsed.origin !== window.location.origin) return url;
      if (parsed.pathname !== '/api' && parsed.pathname.indexOf('/api/') !== 0) return url;
      return UPSTREAM + parsed.pathname + parsed.search + parsed.hash;
    } catch (err) {
      return url;
    }
  }

  var nativeFetch = window.fetch;
  if (nativeFetch) {
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : input && input.url;
      var forwarded = url ? toUpstream(url) : url;
      if (forwarded && forwarded !== url) input = forwarded;
      return nativeFetch.call(this, input, init);
    };
  }

  var nativeOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    var args = Array.prototype.slice.call(arguments);
    args[1] = toUpstream(url);
    return nativeOpen.apply(this, args);
  };

  // Relative asset/API helpers built with navigator.sendBeacon.
  var nativeBeacon = navigator.sendBeacon;
  if (nativeBeacon) {
    navigator.sendBeacon = function (url, data) {
      return nativeBeacon.call(navigator, toUpstream(url), data);
    };
  }
})();
