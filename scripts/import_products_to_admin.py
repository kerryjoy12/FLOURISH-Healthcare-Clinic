#!/usr/bin/env python3
"""Import the website's bundled catalogue into the Base44 Product entity.

The clinic admin edits products through the Base44 `Product` entity, but the
mirror's original 62 products only existed in products/products.json. This
script creates an admin record for each one so the whole catalogue is managed
from admin.

It is safe to re-run: products already present in admin (matched by slug) are
skipped. Prices are never sent, because the catalogue is enquiry-only.

Usage:
    python scripts/import_products_to_admin.py --dry-run
    python scripts/import_products_to_admin.py
"""
import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

APP_ID = "6af56fca9ccc8d90f1eccb17"
UPSTREAM = os.environ.get(
    "BASE44_UPSTREAM", "https://feathered-flourish-health-hub.base44.app"
)
ENTITY_URL = "%s/api/apps/%s/entities/Product" % (UPSTREAM, APP_ID)
IMAGE_BASE = os.environ.get("CATALOGUE_IMAGE_BASE", "https://flourishhealthcare.co.ke/")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, "products", "products.json")

# Website wording -> the category key admin uses.
CATEGORY_KEYS = {
    "women's health": "women",
    "men's health": "men",
    "adult & senior care": "joint",
    "adult and senior care": "joint",
    "joint, bone & mobility": "joint",
    "digestive health": "digestive",
    "general healthcare": "general",
    "general health & wellness": "general",
    "general health and wellness": "general",
}


def api(method, url, payload=None):
    data = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=60) as res:
        body = res.read().decode("utf-8", "replace")
    return json.loads(body) if body.strip() else None


def clean(text):
    return re.sub(r"\s+", " ", (text or "")).strip()


def summary_of(description):
    text = clean(description)
    if len(text) <= 240:
        return text
    cut = text[:240]
    stop = cut.rfind(". ")
    return cut[: stop + 1] if stop > 80 else cut.rstrip() + "…"


def image_url(image):
    path = clean(image)
    if not path:
        return ""
    if path.startswith("http"):
        return path
    if path.startswith("/"):
        return IMAGE_BASE.rstrip("/") + path
    return IMAGE_BASE.rstrip("/") + "/" + urllib.parse.quote(path)


def record_for(product):
    title = clean(product.get("title"))
    if not title:
        return None
    slug = clean(product.get("slug")) or re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    category = CATEGORY_KEYS.get(clean(product.get("category")).lower(), "general")
    payload = {
        "name": title,
        "slug": slug,
        "category": category,
        "summary": summary_of(product.get("description")) or title,
        "brand": "Flourish Healthcare Clinic",
        "availability": "in_stock",
        "featured": False,
    }
    image = image_url(product.get("image"))
    if image:
        payload["image_url"] = image
    return payload


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    with open(SOURCE, encoding="utf-8") as fh:
        products = json.load(fh)

    existing = api("GET", ENTITY_URL + "?limit=500") or []
    taken = {
        clean(p.get("slug")).lower() for p in existing if p.get("slug")
    }
    print("admin currently has %d product(s); %d site product(s) to import"
          % (len(existing), len(products)))

    created = skipped = failed = 0
    for product in products:
        payload = record_for(product)
        if not payload:
            continue
        if payload["slug"].lower() in taken:
            skipped += 1
            continue
        if args.dry_run:
            print("  would create: %-42s %s" % (payload["name"], payload["category"]))
            created += 1
            continue
        try:
            api("POST", ENTITY_URL, payload)
            taken.add(payload["slug"].lower())
            created += 1
            print("  created: %s" % payload["name"])
        except urllib.error.HTTPError as err:
            failed += 1
            detail = err.read().decode("utf-8", "replace")[:200]
            print("  FAILED %s -> %s %s" % (payload["name"], err.code, detail))

    print("\n%s: %d created, %d already in admin, %d failed"
          % ("dry run" if args.dry_run else "import", created, skipped, failed))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
