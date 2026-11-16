#!/usr/bin/env python3
"""Repoint imported product images at the mirror's own hosted copies.

The admin records imported from products/products.json first pointed their
`image_url` at https://flourishhealthcare.co.ke/images/... — that host serves
an invalid HTTPS certificate, so the images never render (in admin or on the
site).

The mirror already ships every one of those photos in products/images/, and
GitHub Pages serves them with a valid certificate, so this script switches the
broken records over to that host. Only records whose image is missing or sits
on the broken host are touched, so admin-uploaded images are never overwritten.

Usage:
    python scripts/fix_product_images.py --dry-run
    python scripts/fix_product_images.py
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

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, "products", "products.json")

# Where the mirror's product photos are served from.
IMAGE_BASE = os.environ.get(
    "PRODUCT_IMAGE_BASE",
    "https://kerryjoy12.github.io/FLOURISH-Healthcare-Clinic/products/images/",
).rstrip("/")

# Hosts whose product images are known not to render.
BROKEN_HOSTS = ("flourishhealthcare.co.ke",)


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


def name_key(value):
    return re.sub(r"\s+", " ", (value or "").strip().lower())


def local_images():
    """Map product name/slug -> the photo file shipped in products/images/."""
    with open(SOURCE, encoding="utf-8") as fh:
        products = json.load(fh)
    by_title, by_slug = {}, {}
    for product in products:
        path = (product.get("image") or "").strip()
        if not path:
            continue
        filename = path.split("/")[-1]
        if not os.path.exists(os.path.join(ROOT, "products", "images", filename)):
            continue
        by_title.setdefault(name_key(product.get("title")), filename)
        if product.get("slug"):
            by_slug.setdefault(product["slug"], filename)
    return by_title, by_slug


def is_broken(url):
    if not url:
        return True
    low = url.lower()
    return any(host in low for host in BROKEN_HOSTS)


def hosted_url(filename):
    return IMAGE_BASE + "/" + urllib.parse.quote(filename)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    by_title, by_slug = local_images()
    products = api("GET", ENTITY_URL + "?limit=500") or []

    updated = already = missing = failed = 0
    for product in products:
        current = product.get("image_url") or ""
        if not is_broken(current):
            already += 1
            continue
        filename = by_slug.get(product.get("slug")) or by_title.get(
            name_key(product.get("name"))
        )
        if not filename:
            missing += 1
            print("  no local photo for: %s" % product.get("name"))
            continue
        url = hosted_url(filename)
        if args.dry_run:
            print("  would set: %-44s -> %s" % (product.get("name"), filename))
            updated += 1
            continue
        try:
            api("PUT", ENTITY_URL + "/" + product["id"], {"image_url": url})
            updated += 1
            print("  updated: %s -> %s" % (product.get("name"), filename))
        except urllib.error.HTTPError as err:
            failed += 1
            print("  FAILED %s -> %s %s"
                  % (product.get("name"), err.code,
                     err.read().decode("utf-8", "replace")[:160]))

    print("\n%s: %d updated, %d already fine, %d without a local photo, %d failed"
          % ("dry run" if args.dry_run else "image fix", updated, already,
             missing, failed))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
