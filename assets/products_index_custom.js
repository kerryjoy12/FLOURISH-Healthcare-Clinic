/**
 * products_index_custom.js
 * Lightweight, vanilla JS renderer for the products page fallback.
 * Expects product data shape: { title, image?, description }
 *
 * Image path fix: source data uses "images/<name>.jpg" but the files live
 * under products/images/. Prepend "/products/" when the path starts with
 * "images/" so the browser requests /products/images/<name>.jpg.
 */
export function renderProducts(gridEl, products){
  if (!products || products.length === 0){
    gridEl.innerHTML = '<p class="col-span-full text-center text-[15px] text-muted-foreground">No products available right now.</p>';
    return;
  }

  // Replace whatever is already in the grid (server-rendered fallback cards or a
  // previous render) so products are never duplicated.
  gridEl.textContent = '';

  const frag = document.createDocumentFragment();

  for (const p of products){
    const card = document.createElement('div');
    card.className = 'group rounded-[6px] border border-primary/15 bg-white p-5 transition-all duration-300 hover:border-primary/40 hover:shadow-sm flex flex-col gap-4';

    const imgWrap = document.createElement('div');
    imgWrap.className = 'overflow-hidden rounded-[4px] bg-[#F4F2E9]';

    const img = document.createElement('img');
    img.className = 'h-48 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]';
    img.setAttribute('loading', 'lazy');
    img.alt = p.title || 'Product image';

    let imgSrc = (p.image && typeof p.image === 'string') ? p.image : '';
    if (imgSrc){
      // Source data stores images as "images/<name>.jpg"; served from /products/images/.
      if (imgSrc.startsWith('images/')) {
        imgSrc = '/products/' + imgSrc;
      } else if (!imgSrc.startsWith('/')) {
        imgSrc = '/products/' + imgSrc;
      }
      img.src = imgSrc;
      img.src = img.src;
      img.onerror = function(){
        this.style.display = 'none';
        imgWrap.classList.add('flex', 'items-center', 'justify-center');
        imgWrap.style.minHeight = '12rem';
      };
    } else {
      img.style.display = 'none';
      imgWrap.classList.add('flex', 'items-center', 'justify-center');
      imgWrap.style.minHeight = '12rem';
      const placeholder = document.createElement('span');
      placeholder.className = 'text-[13px] text-muted-foreground';
      placeholder.textContent = 'No image';
      imgWrap.appendChild(placeholder);
    }
    imgWrap.appendChild(img);
    card.appendChild(imgWrap);

    const title = document.createElement('h3');
    title.className = 'text-[16px] font-semibold leading-snug text-foreground';
    title.textContent = p.title || 'Untitled product';

    const desc = document.createElement('p');
    desc.className = 'text-[13.5px] leading-relaxed text-muted-foreground';
    desc.textContent = p.description || 'No description available.';

    card.appendChild(title);
    card.appendChild(desc);
    frag.appendChild(card);
  }

  gridEl.appendChild(frag);
}
