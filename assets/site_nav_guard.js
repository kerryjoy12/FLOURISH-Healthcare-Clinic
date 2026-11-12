// Force full page loads for the product section of the local mirror.
// The mirrored Base44 SPA handles clicks client-side and renders its own
// products route, which has no backend data locally and shows the empty
// "No products found" state. The statically generated /products/ page has
// the real product grid, so every products link must bypass the SPA router.
(function () {
  function isProductsPath(pathname) {
    return pathname === '/products' || pathname === '/products/' || pathname === '/products.html';
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
    if (!isProductsPath(url.pathname)) return;

    event.preventDefault();
    event.stopPropagation();
    window.location.assign('/products/');
  }, true);
})();
