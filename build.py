#!/usr/bin/env python3
"""
SEO build script — generates one static HTML file per language.

Run from project root:
    python3 build.py

Output:
    /ro/index.html, /es/index.html, /fr/index.html, /it/index.html,
    /pt/index.html, /bg/index.html, /pl/index.html
    /index.html  (English, hreflang fixed, canonical stays at /)
    /sitemap.xml
"""

import subprocess
import json
import re
import html as html_lib
from pathlib import Path

BASE_URL = 'https://appointmentsapps.com'

# lang code → hreflang value + whether it lives at root
LANGS = {
    'en': {'hreflang': 'en',    'url': f'{BASE_URL}/'},
    'ro': {'hreflang': 'ro',    'url': f'{BASE_URL}/ro/'},
    'es': {'hreflang': 'es',    'url': f'{BASE_URL}/es/'},
    'fr': {'hreflang': 'fr',    'url': f'{BASE_URL}/fr/'},
    'it': {'hreflang': 'it',    'url': f'{BASE_URL}/it/'},
    'pt': {'hreflang': 'pt-BR', 'url': f'{BASE_URL}/pt/'},
    'bg': {'hreflang': 'bg',    'url': f'{BASE_URL}/bg/'},
    'pl': {'hreflang': 'pl',    'url': f'{BASE_URL}/pl/'},
}

# Human-readable button labels (main dropdown)
LANG_LABELS = {
    'en': '🇬🇧 English',
    'ro': '🇷🇴 Română',
    'es': '🇪🇸 Español',
    'fr': '🇫🇷 Français',
    'it': '🇮🇹 Italiano',
    'pt': '🇧🇷 Português',
    'bg': '🇧🇬 Български',
    'pl': '🇵🇱 Polski',
}

# Short chip labels (mobile nav)
LANG_CHIPS = {
    'en': 'EN', 'ro': 'RO', 'es': 'ES', 'fr': 'FR',
    'it': 'IT', 'pt': 'PT', 'bg': 'BG', 'pl': 'PL',
}


# ── Translation extraction ────────────────────────────────────────────────────

def extract_translations() -> dict:
    """Evaluate i18n.js inside Node.js with browser-API mocks, return TRANSLATIONS dict."""
    mock = r"""
const window = {};
const document = {
    documentElement: { lang: '', setAttribute() {} },
    querySelector() { return { setAttribute() {}, content: '' }; },
    querySelectorAll() { return { forEach() {} }; },
    getElementById() { return { textContent: '' }; },
    title: '',
    addEventListener() {},
};
const localStorage = { getItem() { return null; }, setItem() {} };
const navigator = { language: 'en', languages: ['en'] };
class URLSearchParams { constructor() {} get() { return null; } }
window.location = { search: '', pathname: '/' };
"""
    code = Path('i18n.js').read_text(encoding='utf-8')
    script = mock + code + "\nprocess.stdout.write(JSON.stringify(window.TRANSLATIONS));"
    r = subprocess.run(['node', '-e', script], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"Node.js failed:\n{r.stderr[:800]}")
    return json.loads(r.stdout)


# ── HTML helpers ──────────────────────────────────────────────────────────────

def make_paths_absolute(html: str) -> str:
    """Prefix relative src/href values with / so they work from any subdirectory."""
    skip = ('http', '#', '/', 'mailto:', 'data:', 'tel:')

    def fix(attr: str):
        def _r(m):
            v = m.group(1)
            return m.group(0) if any(v.startswith(p) for p in skip) else f'{attr}="/{v}"'
        return _r

    html = re.sub(r'src="([^"]*)"',  fix('src'),  html)
    html = re.sub(r'href="([^"]*)"', fix('href'), html)
    return html


def convert_lang_buttons(html: str) -> str:
    """Replace <button class="lang-option" …> with <a href="/{lang}/"> links."""
    for lang, info in LANGS.items():
        href = '/' if lang == 'en' else f'/{lang}/'
        hl   = info['hreflang']
        # Main dropdown  (emoji + name)
        html = re.sub(
            rf'<button class="lang-option" data-lang="{lang}">([^<]*)</button>',
            rf'<a href="{href}" class="lang-option" data-lang="{lang}" hreflang="{hl}">\1</a>',
            html,
        )
        # Mobile chip  (short code)
        html = re.sub(
            rf'<button class="lang-option nav-lang-chip" data-lang="{lang}">([^<]*)</button>',
            rf'<a href="{href}" class="lang-option nav-lang-chip" data-lang="{lang}" hreflang="{hl}">\1</a>',
            html,
        )
    return html


def build_hreflang_lines() -> str:
    lines = [f'    <link rel="alternate" hreflang="x-default" href="{BASE_URL}/">']
    for lang, info in LANGS.items():
        lines.append(f'    <link rel="alternate" hreflang="{info["hreflang"]}" href="{info["url"]}">')
    return '\n'.join(lines)


HREFLANG_BLOCK = build_hreflang_lines()


def update_hreflang_only(html: str) -> str:
    """Used for root index.html — only fix the hreflang block, keep everything else."""
    # Remove existing hreflang alternates
    html = re.sub(r'[ \t]*<link rel="alternate" hreflang="[^"]*" href="[^"]*">\n?', '', html)
    # Re-insert after canonical
    html = re.sub(
        r'(<link rel="canonical" href="[^"]*">)',
        r'\1\n' + HREFLANG_BLOCK,
        html,
    )
    return html


def update_head_full(html: str, lang: str, t: dict) -> str:
    """Full head update for a translated language subdirectory page."""
    info = LANGS[lang]

    # <html lang="…">
    html = re.sub(r'<html\s+lang="[^"]*">', f'<html lang="{info["hreflang"]}">', html)

    # <title>
    if 'page_title' in t:
        html = re.sub(r'<title>[^<]*</title>',
                      f'<title>{html_lib.escape(t["page_title"])}</title>', html)

    # meta description
    if 'meta_description' in t:
        html = re.sub(
            r'(<meta\s+name="description"\s+content=")[^"]*(")',
            r'\g<1>' + html_lib.escape(t['meta_description']) + r'\g<2>',
            html,
        )

    # canonical
    html = re.sub(
        r'<link rel="canonical" href="[^"]*">',
        f'<link rel="canonical" href="{info["url"]}">',
        html,
    )

    # hreflang block
    html = re.sub(r'[ \t]*<link rel="alternate" hreflang="[^"]*" href="[^"]*">\n?', '', html)
    html = re.sub(
        r'(<link rel="canonical" href="[^"]*">)',
        r'\1\n' + HREFLANG_BLOCK,
        html,
    )

    # og:url
    html = re.sub(
        r'(<meta property="og:url" content=")[^"]*(")',
        rf'\g<1>{info["url"]}\g<2>',
        html,
    )

    return html


def add_lang_boot_script(html: str, lang: str) -> str:
    """Inject a tiny script that sets localStorage so i18n.js picks up the right language."""
    script = f"<script>try{{localStorage.setItem('lang','{lang}');}}catch(_){{}}</script>\n"
    return html.replace('</head>', script + '</head>', 1)


# ── Translation application ───────────────────────────────────────────────────

def apply_text_i18n(html: str, t: dict) -> str:
    """Replace textContent of data-i18n elements."""
    def _r(m):
        open_tag, key, close_tag = m.group(1), m.group(2), m.group(4)
        if key in t:
            return open_tag + html_lib.escape(t[key]) + close_tag
        return m.group(0)
    # [^<]* matches text + newlines but stops at the first '<'
    return re.sub(
        r'(<[^>]+\sdata-i18n="([^"]+)"[^>]*>)([^<]*)(</[a-zA-Z][a-zA-Z0-9]*>)',
        _r, html,
    )


def apply_html_i18n(html: str, t: dict) -> str:
    """Replace innerHTML of data-i18n-html elements."""
    result = html
    for key in re.findall(r'data-i18n-html="([^"]+)"', html):
        if key not in t:
            continue
        tm = re.search(r'<([a-zA-Z][a-zA-Z0-9]*)[^>]*\sdata-i18n-html="' + re.escape(key) + r'"', result)
        if not tm:
            continue
        tag = tm.group(1)
        pat = (
            r'(<' + tag + r'(?:\s[^>]*)?\sdata-i18n-html="' + re.escape(key) + r'"[^>]*>)'
            r'([\s\S]*?)'
            r'(</' + tag + r'>)'
        )
        val = t[key]
        result = re.sub(pat, lambda m, v=val: m.group(1) + v + m.group(3), result, count=1)
    return result


def apply_attr_i18n(html: str, t: dict, data_suffix: str, html_attr: str) -> str:
    """Replace attribute (placeholder/alt/aria-label) on data-i18n-* elements."""
    def _r(m):
        tag = m.group(0)
        km = re.search(r'data-' + data_suffix + r'="([^"]+)"', tag)
        if not km:
            return tag
        key = km.group(1)
        if key not in t:
            return tag
        val = html_lib.escape(t[key])
        if re.search(html_attr + r'="[^"]*"', tag):
            return re.sub(html_attr + r'="[^"]*"', f'{html_attr}="{val}"', tag)
        # Attribute not present yet — add it before the closing >
        return tag[:-1] + f' {html_attr}="{val}">'
    return re.sub(
        r'<[a-zA-Z][^>]*\sdata-' + data_suffix + r'="[^"]*"[^>]*>',
        _r, html,
    )


def apply_all_translations(html: str, t: dict) -> str:
    html = apply_text_i18n(html, t)
    html = apply_html_i18n(html, t)
    html = apply_attr_i18n(html, t, 'i18n-placeholder', 'placeholder')
    html = apply_attr_i18n(html, t, 'i18n-alt',         'alt')
    html = apply_attr_i18n(html, t, 'i18n-aria-label',  'aria-label')
    return html


# ── Sitemap ───────────────────────────────────────────────────────────────────

def write_sitemap():
    urls = [info['url'] for info in LANGS.values()]
    body = '\n'.join(f'  <url><loc>{u}</loc></url>' for u in urls)
    sitemap = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + body + '\n</urlset>\n'
    )
    Path('sitemap.xml').write_text(sitemap, encoding='utf-8')
    print('  ✓ sitemap.xml')


# ── Main ──────────────────────────────────────────────────────────────────────

def build():
    print('Extracting translations from i18n.js …')
    translations = extract_translations()
    print(f'  Found translations for: {", ".join(translations.keys())}')

    print('\nReading index.html …')
    original = Path('index.html').read_text(encoding='utf-8')

    # ── 1. Update root index.html (English, minimal changes) ──────────────────
    print('\nUpdating root index.html (English, hreflang fix) …')
    root_html = original
    root_html = update_hreflang_only(root_html)
    root_html = convert_lang_buttons(root_html)
    Path('index.html').write_text(root_html, encoding='utf-8')
    print('  ✓ index.html')

    # ── 2. Generate one page per non-English language ─────────────────────────
    print('\nGenerating language pages …')
    # Prepare a base template with absolute asset paths (needed for subdirs)
    base = make_paths_absolute(original)
    base = convert_lang_buttons(base)

    for lang in LANGS:
        if lang == 'en':
            continue  # English stays at root
        t = translations.get(lang, translations['en'])
        html = base
        html = update_head_full(html, lang, t)
        html = add_lang_boot_script(html, lang)
        html = apply_all_translations(html, t)

        out_dir = Path(lang)
        out_dir.mkdir(exist_ok=True)
        (out_dir / 'index.html').write_text(html, encoding='utf-8')
        print(f'  ✓ {lang}/index.html')

    # ── 3. Sitemap ────────────────────────────────────────────────────────────
    print('\nGenerating sitemap.xml …')
    write_sitemap()

    print('\nDone. URLs ready for Google:')
    for lang, info in LANGS.items():
        print(f'  {info["url"]}')
    print('\nNext steps:')
    print('  1. Commit & deploy the new files.')
    print('  2. In Search Console → Sitemaps → submit: sitemap.xml')
    print('  3. Request re-indexing for the new language URLs.')


if __name__ == '__main__':
    build()
