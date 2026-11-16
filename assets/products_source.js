/**
 * products_source.js — the website's single source of truth for products.
 *
 * Products are read from the same Base44 `Product` records the clinic admin
 * edits, so whatever admin adds, edits, re-categorises or removes appears on
 * the website without re-publishing the static mirror.
 *
 * Prices are deliberately not carried into the website shape: the catalogue is
 * enquiry-only, so the site never renders a price.
 *
 * If the admin feed cannot be reached the bundled snapshot
 * (/products/products.json) is used so the page still renders.
 */

const APP_ID = '6af56fca9ccc8d90f1eccb17';
const UPSTREAM = 'https://feathered-flourish-health-hub.base44.app';
const ENTITY_URL =
  UPSTREAM + '/api/apps/' + APP_ID + '/entities/Product?limit=500';

// Admin category keys -> the wording the website shows.
const CATEGORY_LABELS = {
  women: "Women's Health",
  men: "Men's Health",
  joint: 'Joint, Bone & Mobility',
  digestive: 'Digestive Health',
  general: 'General Health & Wellness',
};

// The order categories appear in when browsing "all products".
const CATEGORY_LABEL_ORDER = [
  "Women's Health",
  "Men's Health",
  'Joint, Bone & Mobility',
  'Digestive Health',
  'General Health & Wellness',
];

// Older snapshot wording that means the same bucket as an admin category.
const LABEL_ALIASES = {
  'adult & senior care': 'Joint, Bone & Mobility',
  'adult and senior care': 'Joint, Bone & Mobility',
  'general healthcare': 'General Health & Wellness',
  'general health and wellness': 'General Health & Wellness',
  "women's health": "Women's Health",
  "men's health": "Men's Health",
  'digestive health': 'Digestive Health',
  'joint, bone & mobility': 'Joint, Bone & Mobility',
};

function titleCase(value) {
  return String(value)
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b[a-z]/g, function (c) {
      return c.toUpperCase();
    });
}

/** Turn an admin category key (or a label) into the label the site shows. */
export function categoryLabel(value) {
  if (!value) return 'General Health & Wellness';
  const key = String(value).trim().toLowerCase();
  if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key];
  if (LABEL_ALIASES[key]) return LABEL_ALIASES[key];
  return titleCase(value);
}

/** URL/hash-safe key for a category label, used by the filter pills. */
export function categoryKey(value) {
  return String(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function slugify(value) {
  if (!value) return '';
  let s = String(value).toLowerCase();
  if (typeof s.normalize === 'function') {
    try {
      s = s.normalize('NFKD');
    } catch (e) {}
  }
  return s
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Normalise either an admin Product record or a bundled snapshot entry into
 * the shape the website renders. `price` is intentionally dropped.
 */
export function normalizeProduct(record) {
  if (!record) return null;
  const title = record.name || record.title || '';
  if (!title) return null;
  return {
    title: title,
    slug: record.slug || slugify(title),
    image: record.image_url || record.image || '',
    description: record.summary || record.uses || record.description || '',
    category: categoryLabel(record.category),
    categoryKey: categoryKey(categoryLabel(record.category)),
    // The raw admin key, so links like ?category=women keep working.
    categoryAlias: record.category ? String(record.category).trim().toLowerCase() : '',
    brand: record.brand || '',
    availability: record.availability || '',
  };
}

async function loadFromAdmin() {
  const res = await fetch(ENTITY_URL, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('admin feed responded ' + res.status);
  const records = await res.json();
  if (!Array.isArray(records)) throw new Error('unexpected admin payload');
  return records.map(normalizeProduct).filter(Boolean);
}

async function loadBundled() {
  const res = await fetch('/products/products.json');
  if (!res.ok) throw new Error('bad response ' + res.status);
  const records = await res.json();
  return (records || []).map(normalizeProduct).filter(Boolean);
}

/**
 * Products for the website: the bundled catalogue the site already had, with
 * the admin-managed records layered on top. A product that exists in both
 * keeps its position but takes the admin version's content, and products that
 * only exist in admin are appended. Nothing disappears from the site when the
 * admin catalogue is smaller than the site catalogue.
 */
export async function loadProducts() {
  let admin = [];
  try {
    admin = await loadFromAdmin();
  } catch (err) {
    console.warn('Admin product feed unavailable, using bundled catalogue:', err);
  }

  let bundled = [];
  try {
    bundled = await loadBundled();
  } catch (err) {
    console.warn('Bundled catalogue unavailable:', err);
  }

  if (!admin.length && !bundled.length) throw new Error('Failed to load product data');
  if (!admin.length) return bundled;
  if (!bundled.length) return admin;

  // The snapshot has a few products listed twice under different slugs, so
  // merge on the product name as well as the slug and keep one card each.
  const nameKey = function (p) {
    return String(p.title || '').toLowerCase().replace(/\s+/g, ' ').trim();
  };
  const adminBySlug = new Map(
    admin.map(function (p) {
      return [p.slug, p];
    })
  );
  const adminByName = new Map(
    admin.map(function (p) {
      return [nameKey(p), p];
    })
  );

  const seen = new Set();
  const merged = [];
  bundled.forEach(function (p) {
    const key = nameKey(p);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(adminByName.get(key) || adminBySlug.get(p.slug) || p);
  });
  admin.forEach(function (p) {
    const key = nameKey(p);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(p);
  });
  return merged;
}

/**
 * Categories actually present in the catalogue, in the site's preferred order.
 * Because this is derived from admin data, adding a category in admin adds a
 * filter on the website automatically.
 */
export function categoriesOf(products) {
  const seen = new Map();
  (products || []).forEach(function (p) {
    if (!seen.has(p.category)) {
      seen.set(p.category, { label: p.category, key: p.categoryKey, count: 0 });
    }
    seen.get(p.category).count += 1;
  });
  const list = Array.from(seen.values());
  const rank = function (entry) {
    const idx = CATEGORY_LABEL_ORDER.indexOf(entry.label);
    return idx === -1 ? CATEGORY_LABEL_ORDER.length : idx;
  };
  return list.sort(function (a, b) {
    const diff = rank(a) - rank(b);
    return diff !== 0 ? diff : a.label.localeCompare(b.label);
  });
}

/** Find one product by slug or title, whichever the URL carries. */
export function findProduct(products, slug) {
  if (!slug) return null;
  const wanted = String(slug).toLowerCase();
  return (
    (products || []).find(function (p) {
      return String(p.slug).toLowerCase() === wanted;
    }) ||
    (products || []).find(function (p) {
      return slugify(p.title) === wanted;
    }) ||
    null
  );
}

/** The product slug a detail page should render, from ?slug= or the path. */
export function slugFromLocation() {
  const fromQuery = new URLSearchParams(window.location.search).get('slug');
  if (fromQuery) return fromQuery;
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts[0] !== 'products' || parts.length < 2) return null;
  return parts[1].replace(/\.html$/i, '');
}

/**
 * Resolve one product for a detail page. Admin products come first; the
 * bundled snapshot is checked too so older product URLs still resolve.
 */
export async function resolveProduct(slug) {
  const found = findProduct(await loadProducts(), slug);
  if (found) return found;
  try {
    return findProduct(await loadBundled(), slug);
  } catch (err) {
    return null;
  }
}

/** Does this product belong to the category named by the URL's ?category= value? */
export function matchesCategory(product, key) {
  if (!key) return true;
  const wanted = String(key).toLowerCase();
  return product.categoryKey === wanted || product.categoryAlias === wanted;
}

/** Public URL for a product's detail page. */
export function productUrl(slug) {
  return '/products/product.html?slug=' + encodeURIComponent(slug);
}
