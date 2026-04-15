# Deck Refactor Plan

## Motivation

`deck/index.html` is currently ~2,000 lines — 65% CSS, 16% JS, 19% HTML.
Adding or removing a slide requires edits in three separate sections of one file.
Narration is keyed by array index (`slide-0.json`, `slide-11.json`), so reordering
any slide silently breaks audio for every slide after it.

Goals of this refactor:
- Each slide is a self-contained module (HTML + CSS + narration + JS)
- Adding a slide = create one folder, add one line to a manifest
- Removing or reordering slides never breaks narration
- Works with Vercel out of the box
- No unnecessary complexity — this is a pitch deck, not a SaaS product

---

## Build Tool: Vite

**Why Vite:**
- Near-zero config for a vanilla HTML/CSS/JS project
- Vercel auto-detects it (no `vercel.json` needed)
- Native ES module dev server with HMR — slide CSS/HTML changes are instant
- `?raw` and `?inline` import queries let slide modules import their own HTML
  and CSS files as strings without any extra plugins
- Output is a plain static `dist/` folder — same deployment model as today

```bash
npm create vite@latest  # choose "Vanilla"
```

`vite.config.js` will be minimal — just set the output directory if needed.

---

## Directory Structure

```
katechon-pitch/
├── index.html                  ← Vite entry: shell chrome only (nav, avatar, overlays)
├── vite.config.js
├── package.json
│
├── src/
│   ├── main.js                 ← imports slide manifest, calls initDeck()
│   ├── deck.js                 ← core engine (see below)
│   ├── shell.css               ← global styles only
│   │
│   └── slides/
│       ├── index.js            ← ordered manifest — the only file you touch to add/remove
│       │
│       ├── title/
│       │   ├── index.js
│       │   ├── title.html
│       │   └── title.css
│       │
│       ├── compare/
│       ├── question/
│       ├── genmedia/
│       ├── stack/
│       ├── video/
│       ├── vision/
│       ├── era/
│       ├── monetization/
│       ├── ask/
│       ├── moment/
│       ├── closing/
│       └── evolution/          ← carousel JS lives in its own init()
│
├── public/                     ← static assets, copied as-is to dist/
│   ├── assets/
│   │   ├── narration/          ← slug-keyed: title.json, compare.json, …
│   │   ├── evolution/          ← generated images
│   │   ├── demo.mp4
│   │   ├── simon_judd_*.mp4
│   │   ├── Cloud_Sync_*.mp3
│   │   └── qr-*.png
│   ├── live2d-models/
│   ├── libs/
│   └── avatar-pet.html         ← standalone page, unchanged
│
└── scripts/
    ├── generate-narration.sh       ← updated to iterate over slide slugs
    ├── precompute-narration.py
    └── generate-evolution-images.py
```

---

## Slide Module Interface

Every slide exports a single plain object:

```js
// src/slides/title/index.js
import html from './title.html?raw'      // Vite: import as string
import css  from './title.css?inline'    // Vite: import as string, not injected

export default {
  id:        'title',
  narration: `Katechon Technology is building the infrastructure
              for the next era of media.`,
  html,
  css,
  // init(el) {}   ← optional: slide-specific JS, receives the mounted DOM element
}
```

```html
<!-- src/slides/title/title.html — inner HTML only, no wrapping .slide div -->
<h1>KATECHON<br>TECHNOLOGY</h1>
<div class="subtitle">REAL-TIME CONTENT GENERATION</div>
```

```css
/* src/slides/title/title.css — scoped under .slide-title */
.slide-title {
  text-align: center;
  background: radial-gradient(ellipse at 50% 60%, var(--accent-soft) 0%, var(--bg) 70%);
}
.slide-title h1 { font-size: clamp(4rem, 9vw, 8rem); font-weight: 900; }
```

Slides with custom JavaScript (e.g. the evolution carousel) use `init()`:

```js
// src/slides/evolution/index.js
import html from './evolution.html?raw'
import css  from './evolution.css?inline'

export default {
  id:        'evolution',
  narration: `Every medium has followed the same arc…`,
  html,
  css,
  init(el) {
    // all carousel wheel/touch/dot logic here
    // el is the mounted .slide-evolution DOM element
    const carousel = el.querySelector('#evoCarousel')
    // …
  }
}
```

---

## Manifest: Adding and Removing Slides

```js
// src/slides/index.js  ← THE only file you edit to manage the slide order

import title        from './title/index.js'
import compare      from './compare/index.js'
import question     from './question/index.js'
import genmedia     from './genmedia/index.js'
import stack        from './stack/index.js'
import video        from './video/index.js'
import vision       from './vision/index.js'
import era          from './era/index.js'
import monetization from './monetization/index.js'
import ask          from './ask/index.js'
import moment       from './moment/index.js'
import closing      from './closing/index.js'
import evolution    from './evolution/index.js'

export default [
  title, compare, question, genmedia,
  stack, video, vision, era,
  monetization, ask, moment, closing,
  evolution,
]
```

To **add** a slide: create `src/slides/my-slide/`, add its import and push it
into the array at the right position. Nothing else changes.

To **remove** a slide: delete the line from the array. Narration for every
other slide is unaffected because it's keyed by slug, not index.

---

## Core Engine: `src/deck.js`

Responsibilities extracted from the current monolithic `<script>`:

| Function | Description |
|---|---|
| `initDeck(slides)` | Entry point: injects CSS, mounts HTML, wires everything |
| `mountSlides(slides)` | Creates `.slide` divs, sets `data-slide`, calls each `init(el)` |
| `injectStyles(slides)` | Appends each slide's CSS string to `<head>` once |
| `goTo(n)` | Slide transition: opacity, narration, video, progress, counter |
| `loadPayload(slug)` | Fetch + cache `public/assets/narration/{slug}.json` |
| `playNarration(slug)` | Load payload → postMessage to avatar iframe |
| `stopNarration()` | postMessage `{type: 'stop'}` to avatar iframe |
| `ensureBgMusic()` | Start background audio loop after user gesture |
| `initControls()` | Keyboard, touch, prev/next buttons, avatar/music toggles |
| `initOverlay()` | Start overlay dismiss logic |

The `VIDEO_SLIDE` special case becomes a property on the slide object:

```js
// src/slides/moment/index.js
export default {
  id: 'moment',
  isVideoSlide: true,   // ← deck.js checks this instead of a hardcoded index
  // …
}
```

---

## CSS Architecture

| File | Contains |
|---|---|
| `src/shell.css` | `.slide` base, `.label`, `.val-*`, nav, progress bar, counter, avatar, mobile gate, start overlay, stream arc |
| `src/slides/*/slide.css` | Everything scoped to `.slide-{id}` — zero global selectors |

No CSS Modules — conventional `.slide-{id}` namespacing is sufficient at this scale
and keeps the CSS readable without a build-time transform.

Vite bundles all imported CSS into a single `style.css` in production.
In dev, each file hot-reloads independently.

---

## Narration System Changes

### File naming
```
BEFORE:  public/assets/narration/slide-0.json   (fragile — index-based)
AFTER:   public/assets/narration/title.json      (stable — slug-based)
```

### Runtime loading
```js
// BEFORE
const resp = await fetch(`../assets/narration/slide-${slideIndex}.json`)

// AFTER
const resp = await fetch(`/assets/narration/${slide.id}.json`)
```

### Source of truth
Narration **text** lives in each slide's `index.js` (`narration` field).
The JSON file in `public/assets/narration/` is the pre-computed audio payload
generated from that text. They're linked by slug.

### Generation script update
`scripts/generate-narration.sh` will be updated to read the ordered list of
slide IDs from `src/slides/index.js` and output `{slug}.json` files instead
of `slide-N.json`. Re-running the script is safe — it only regenerates slides
whose narration text has changed (hash-check or explicit flag).

---

## Vercel Deployment

Vite projects are auto-detected by Vercel. No `vercel.json` required.

```json
// package.json scripts
{
  "dev":   "vite",
  "build": "vite build",
  "preview": "vite preview"
}
```

Vercel sees `vite build`, sets output dir to `dist/`, done.
The `public/` folder is copied verbatim into `dist/` by Vite — narration JSONs,
videos, images, Live2D models all served as static files exactly as today.

---

## Adding a New Slide: End State Workflow

```bash
# 1. Scaffold the slide folder
mkdir src/slides/my-slide
touch src/slides/my-slide/index.js
touch src/slides/my-slide/my-slide.html
touch src/slides/my-slide/my-slide.css

# 2. Write the slide (html, css, narration text, optional init())

# 3. Register it
# → edit src/slides/index.js: add import + push into array

# 4. Generate audio
npm run gen:narration -- --slide my-slide

# 5. Dev server hot-reloads, slide appears immediately
```

Total files touched: 4 new files + 1 line in the manifest.

---

## Migration Notes

Not implementing now, but the migration sequence will be:

1. `npm init` + `npm install vite`
2. Strip `deck/index.html` down to shell chrome (nav, avatar, overlays) → `index.html`
3. Extract global CSS → `src/shell.css`
4. For each slide: create folder, migrate HTML fragment + scoped CSS + narration text
5. Rename narration files: `slide-N.json` → `{slug}.json`
6. Write `src/deck.js` with extracted JS functions
7. Write `src/main.js` + `src/slides/index.js`
8. Verify Vercel build (`npm run build`)
9. Delete `deck/` directory

The old `deck/index.html` stays untouched until step 9 — easy to diff and
verify nothing was lost.
