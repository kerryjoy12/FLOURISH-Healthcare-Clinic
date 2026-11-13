#!/usr/bin/env python3
"""Stage the mirror for GitHub Pages project-site hosting.

GitHub project pages are served from /<repo>/, but the mirrored site was
captured from a site hosted at the domain root: every page links to
root-absolute URLs like /assets/app.js, and the client router is built with
an empty base path. This script copies the site into _site/ and rewrites
those references so the copy works under a prefix.

Usage: python scripts/stage_pages_site.py [prefix]
The prefix defaults to $PAGES_BASE, then /$GITHUB_REPOSITORY (owner/repo),
then /FLOURISH-Healthcare-Clinic.
"""
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "_site")
REPO = os.path.basename(ROOT)


def base_prefix():
    if len(sys.argv) > 1:
        return sys.argv[1].rstrip("/")
    env = os.environ.get("PAGES_BASE")
    if env:
        return env.rstrip("/")
    repo = os.environ.get("GITHUB_REPOSITORY")
    if repo:
        return "/" + repo.split("/", 1)[1]
    return "/" + REPO


def rewrite_html(text, prefix):
    attr = re.compile(r'(\b(?:href|src|action|poster)=")/(?!/)')
    json_href = re.compile(r'("href":")(/(?!/))')
    text = attr.sub(lambda m: m.group(1) + prefix + "/", text)
    return json_href.sub(lambda m: m.group(1) + prefix + m.group(2), text)


def rewrite_js(text, prefix):
    # Client router base path (TanStack Router) is created with an empty
    # base path in the captured bundle; point it at the project subpath.
    text = text.replace(
        "{basepath:``,serializationAdapters:", "{basepath:`%s`,serializationAdapters:" % prefix
    )
    return text


def rewrite_nav_guard(text, prefix):
    # The mirror's nav guard forces full page loads for the static sections
    # (products, gigs, admin); its hard-coded root-absolute paths need the
    # prefix too.
    return re.sub(
        r"var STATIC_PATHS = \[[^\]]*\];",
        "var STATIC_PATHS = ['%s/products', '%s/gigs', '%s/admin'];" % (prefix, prefix, prefix),
        text,
    )


def main():
    prefix = base_prefix()
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    shutil.copytree(
        ROOT,
        OUT,
        ignore=lambda d, names: [n for n in names if n in (".git", ".github", "_site")],
    )

    counts = {"html": 0, "js": 0, "nav_guard": 0}
    for dirpath, _, filenames in os.walk(OUT):
        for name in filenames:
            path = os.path.join(dirpath, name)
            if name.endswith(".html"):
                with open(path, encoding="utf-8", errors="surrogateescape") as fh:
                    original = fh.read()
                updated = rewrite_html(original, prefix)
                if updated != original:
                    counts["html"] += 1
            elif name.endswith(".js"):
                with open(path, encoding="utf-8", errors="surrogateescape") as fh:
                    original = fh.read()
                if name == "site_nav_guard.js":
                    updated = rewrite_nav_guard(original, prefix)
                else:
                    updated = rewrite_js(original, prefix)
                if updated != original:
                    counts["nav_guard" if name == "site_nav_guard.js" else "js"] += 1
            else:
                continue
            with open(path, "w", encoding="utf-8", errors="surrogateescape", newline="") as fh:
                fh.write(updated)

    print("staged %s with base path %s: %s" % (OUT, prefix, counts))


if __name__ == "__main__":
    main()
