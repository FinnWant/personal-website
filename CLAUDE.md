# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout — read this first

This repo (`github.com/FinnWant/finnwant.github.io`, branch `main`) is usually opened from its **parent directory** `personalWebsite/`, which is itself an unrelated empty git repo with no commits:

```
personalWebsite/            <- outer repo, empty, not the site
└── finnwant.github.io/     <- this repo — all site content and history
```

Run every git command from inside `finnwant.github.io/`. Committing from the outer directory will not touch the site.

## Build / test / deploy

There is no build step, package manager, test suite, or linter. It is hand-written static HTML + CSS.

- **Preview locally:** `python3 -m http.server 8000` from this directory, then open `http://localhost:8000`. Use a server rather than `file://` so relative paths and `fetch` behave like production.
- **Deploy:** the site is served from a self-hosted web server at home, reached through the Cloudflare-managed domain `https://finnwantland.dev`. It is **not** on GitHub Pages any more — GitHub is only the source repo, and pushing to `main` does not publish anything. The server must serve only the site files: never expose `.git/`, `worker/`, or `CLAUDE.md` from the web root.

## Architecture

Three top-level pages share `styles.css` and each carry a duplicated copy of the site chrome:

- `index.html` — hero, Highlights, "Recent Projects" cards (duplicated from `projects.html`), About Me, `#contact`
- `projects.html` — full project card list; cards are anchor targets (`#project-1`…`#project-5`; ids are stable, not display order — MoKnowledge is `#project-5` but listed first), linked from the index
- `blog.html` — index of posts under `posts/`
- `styles.css` / `site.js` / `icons.svg` / `favicon.svg` — shared by all three

The Figma design spec (tokens, icons, components, motion) lives at https://www.figma.com/design/Fk0N0YPCfUwsKfPUvNZdQ6 — its variables carry the CSS custom-property names as code syntax. Keep it in step when tokens change.

## The résumé

Every page links to **`Finnagin-Wantland-Resume.pdf` at the repo root** — nav item, hero button, and the contact section. The file is user-supplied and is intentionally not in the repo, so **the link 404s until it is added**. If the filename ever changes it must be updated in all three pages plus the `download` copy in the hero.

**The header/nav block is copy-pasted into all three pages.** Any nav change (new link, logo swap, `aria-current`) must be applied in `index.html`, `projects.html`, and `blog.html`. The same goes for project cards, which exist in both `index.html` and `projects.html`. This is the main maintenance cost of the site — there is no templating.

**All CSS lives in `styles.css`**, linked as `styles.css?v=N` on all three pages. Cloudflare and browsers cache CSS for hours, so **bump `N` on all three pages whenever `styles.css` changes** or visitors get the old stylesheet with the new markup. The same goes for `site.js?v=N`, `icons.svg?v=N#…` (every `<use>` reference) and `hero-relief.js?v=N`: a stale cached `site.js` once left the header stuck see-through. As a safety net, the see-through header styles also require `.header--live`, which `site.js` adds, so without the script the header is simply solid. There are deliberately **no inline `<style>` blocks and no hardcoded hex colors in the HTML** — the pages previously had `<style>` tags scattered mid-body (inside `<nav>`, inside `.hero-image`) whose specificity silently overrode the stylesheet. Keep it that way.

**Everything is themed through custom properties, and the site is light-only.** `:root` defines the tokens and sets `color-scheme: light`; there is no `prefers-color-scheme: dark` override (it was removed on purpose), and the Turnstile widget is pinned to `theme: "light"`. Any new rule must still use `var(--…)` for color, never a literal hex. The index hero band and the contact panel are intentionally dark blocks on the light page. The brand red `#b10202` appears exactly once in the stylesheet, as the `--brand` token (plus the favicon). Tokens come in two layers: **primitives** (`--white`, `--gray-*`, `--red-*`, …) are only referenced from inside `:root`; rules use the **semantic** tokens (`--text`, `--accent`, `--tag-bg`, `--radius-md`, …). Radii are tokenised too: buttons are always `--radius-md` (8px).

**Icons come from one sprite, `icons.svg`.** Use `<svg class="icon icon--sm" aria-hidden="true" focusable="false"><use href="icons.svg#i-NAME"/></svg>` — never paste inline path data or text glyphs (`→`, `×`). All icons are 24×24, 2px round stroke, `currentColor`; sizes are only `.icon--sm` (16px) or `.icon--md` (20px). Leading icon = what the action is (mail, github, download); trailing icon = where it goes, with `class="... icon-trail"` and `data-dir="in"` (`i-arrow-right`, stays on site) or `data-dir="out"` (`i-arrow-up-right`, leaves the site or opens a new tab). Adding an icon means adding a `<symbol>` to `icons.svg` and a matching component in the Figma file. The sprite is fetched by `<use>`, so it needs the local server (not `file://`).

**Dark bands and the header.** Every page opens with a dark band: the index hero, or a `section.hero--dark.page-hero` (mono `.eyebrow` path, H1, `.page-lede`, `.page-facts`) on Projects and Blog. `body.has-hero` makes the header transparent over that band; `site.js` measures `--header-h` (the band is pulled up under the header by that much), adds `.header--glass` once the page scrolls and `.header--scrolled` once the band has passed. A new page without a dark band must omit `has-hero`. The header's red line is a scroll-progress bar (CSS scroll-driven animation), not a border.

**Logo.** The header mark is the FW git graph (stem and two branches form the F; the top branch commits and continues as the W; red HEAD is the W's tip). It is an inline `<svg class="brand-mark">` copied into all three headers (not an `<img>`), so `styles.css` can animate it: a git-log draw-on at page load, then HEAD's pulse as an idle heartbeat, all off under reduced motion. Colours come from `--logo-*` tokens. `favicon.svg` is the same geometry, static. The master is the "I1 · Handoff commit" component on the Figma Logo page; change all three together. The old `Images/university-of-nevada-las-vegas-logo.png` is no longer referenced.

**3D hero relief (`hero-relief.js`, index only).** The one page-specific script kept as its own file, because it's large: hand-written WebGL (no library) that redraws the hero's dot field in perspective. The dots swell, the camera drifts and leans toward the pointer, the pointer makes a ripple, and every 2.6s (the header logo's heartbeat) a red ripple rolls out from the point of the field under the header logo. It only starts on desktop (>720px), with motion allowed and WebGL available, after page load; it pauses off-screen. Otherwise the CSS motion field stays. It's linked as `hero-relief.js?v=N` — bump `N` when it changes, like the stylesheet.

**Type layers.** Inter Tight (display), Inter (body) and JetBrains Mono (`--font-mono`) for labels, tags, dates, stats and the footer only — never headings or paragraphs.

**Motion field.** The hero band, page heroes and contact panel share an animated backdrop: `.motion-field` (drifting dot grid, orbiting glows, pointer spotlight). Its markup is a `div.motion-field` as the first child of a positioned dark block; `site.js` drives the spotlight and pauses it off-screen, and all of it is off under `prefers-reduced-motion`.

**`site.js` is shared by all pages** and handles the footer year (any `.js-year` element — no per-page IDs), the scroll fade-in and card tilt, the card/post-row cursor spotlight (`.spot`), the motion-field spotlight/pause, the dark-band header states, and the mobile nav toggle. Page-specific scripts stay inline on their own page (the hero fact graph, visit counter and contact form, all on `index.html`).

**Responsive breakpoint is 760px**, defined in both `styles.css` and the `matchMedia` reset in `site.js`. Changing one requires changing the other.

**Heading rule: exactly one `<h1>` per page**, and it is the page's own subject — not the site title, which is a `<span class="brand-name">` inside the header link. Project card headings are `<h3>` on the index (subordinate to the "Recent Projects" `<h2>`) and `<h2>` on the projects page where each card is a top-level entry; `styles.css` styles both identically.

**Visit counter** (`index.html` only) calls the public CounterAPI v2 service — no key or account needed, and it sends `Access-Control-Allow-Origin: *` so browser `fetch` works. `WORKSPACE`/`COUNTER` constants and the `visited_v1` localStorage key control it. A browser's first visit calls `/up`; later visits only read. Both endpoints return the same `{data:{up_count}}` shape, so `/up` doubles as the read — never pair an `/up` with a separate `GET`, since a `GET` issued before the increment returns a stale count.

When testing the counter by hand, use the plain read URL. Hitting `/up` from curl or a script permanently inflates the real public count.

**Contact form** (`index.html` only): clicking the email link opens a `<dialog>` form (the `mailto:` href is the no-JS fallback). It posts JSON to a Cloudflare Worker in `worker/`, which verifies the Turnstile token with `TURNSTILE_SECRET` (a Wrangler secret, never committed) and emails `TO_ADDRESS` via the `send_email` binding. The Worker runs on Cloudflare, not the home server, and is deployed separately with `npx wrangler deploy` from `worker/`. The page-side `CONTACT_ENDPOINT` and Turnstile `data-sitekey` must match the deployed Worker and widget; if the site's origin changes, update `ALLOWED_ORIGINS` in `worker/wrangler.toml` and the widget's hostname list in Cloudflare.

## Blog posts

`posts/*.html` are **generated files, not hand-written pages**:

- `Py_Learning_Notebook.html` — `jupyter nbconvert` output from a Python notebook
- `Blog_Post_2.html` — `pdf2htmlEX` output from a PDF

They are fully self-contained (own CSS, own `<head>`) and deliberately do not use `styles.css` or the site header. Do not hand-edit them to fix content — regenerate from the source notebook/PDF and replace the file. They are safe to reformat only if you are prepared to lose the change on the next regeneration.

Adding a post means appending an `<li>` to `.post-list` in `blog.html` with the title, date, and a one-line italic summary.

## Mistakes previously fixed here — don't reintroduce

- **Backslash paths.** `blog.html` once linked posts as `posts\Py_Learning_Notebook.html`. Backslashes are not path separators in URLs and 404 on a real web server. Always forward slashes.
- **Cross-page anchors without targets.** `index.html` project cards link to `projects.html#project-N`; those `id`s must exist on the `<article>` elements in `projects.html`.
- **`<div>` inside `<p>`.** The browser auto-closes the paragraph, silently restructuring the hero.
- **Unclosed `<main>`** in `index.html`, which pulled the footer and scripts inside the content column.
- **Hardcoded colors and inline `<style>` blocks**, which bypassed the theme tokens and overrode the stylesheet.
- **Stale-read visit counter** — see the CounterAPI note above.

After editing markup, re-check structure and links — there is no linter or CI to catch this:

```bash
python3 -c "
from html.parser import HTMLParser
VOID={'area','base','br','col','embed','hr','img','input','link','meta','source','track','wbr'}
class P(HTMLParser):
    st=[]
    def handle_starttag(s,t,a):
        if t not in VOID: s.st.append((t,s.getpos()[0]))
    def handle_endtag(s,t):
        if t not in VOID and s.st: s.st.pop()
for f in ['index.html','projects.html','blog.html']:
    p=P(); p.st=[]; p.feed(open(f).read()); print(f, p.st or 'ok')"
```

## Content conventions

The site is a personal portfolio; content is first-person as Finnagin Wantland. Project cards follow a fixed shape: 16:9 screenshot in `Images/` (compressed JPEG, ~960px wide) wrapped in `<div class="card-media">` (the dark window frame) with `width="960" height="540"` and `loading="lazy"` below the fold, heading (see heading rule above), `.tags` list, one-sentence description paragraph, then (projects page) a `.card-points` list of 2–4 short facts, then a `<div class="card-actions">` holding an `a.btn-secondary` with the `i-github` icon ("View on GitHub" on the projects page, "GitHub" on the index). Projects with a live demo put an `a.btn` ("Try the live demo" / "Live demo" plus a trailing `i-arrow-up-right`) first in that row. The top project on the projects page carries `card--featured` (full-width, screenshot left) plus a mono `.card-kicker` line. In-progress projects add a `<span class="wip">` line plus a `<progress>` element on the projects page and a `tag-status` pill on the index. The MoKnowledge demo is a separate Next.js app self-hosted on the same server and served at `/moknowledge/` (Caddy proxies that path to the Next.js process; the app is built with `NEXT_PUBLIC_BASE_PATH=/moknowledge`). It is not part of this repo, so the demo link 404s under the local `python3 -m http.server` preview.
