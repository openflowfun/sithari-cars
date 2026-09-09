# Sithari Cars — website rebuild

Client: Sithari Cars Limited, used-car dealer, 24 Bruce McLaren Rd, Henderson, Auckland. Family-run (owners Sam & Sithari), imports Japanese cars direct, ~100+ in stock, 50–60 in transit monthly. Own workshop, MTA member, BuyerScore rated, AA appraised stock, VTNZ complied, 6-month/3,000 km free MBI, nationwide delivery in 5–7 working days. Phone 09 836 6301, email enquiries1@sitharicars.co.nz, open 7 days 9.00am–5.30pm.

Old site: https://www.sitharicars.co.nz (Motorcentral platform). Inventory currently comes from it — see `scripts/scrape_inventory.py`. Eventually replace with a Motorcentral feed or CMS.

## Status
- Live preview: https://openflowfun.github.io/sithari-cars/ (GitHub Pages, rebuilt on every push to `main`).
- Moving to the real domain: `og:url`, `og:image` and `<link rel=canonical>` in each `src/*.html`, plus `src/public/sitemap.xml` and `robots.txt`, carry that absolute URL. `grep -rn openflowfun.github.io src/` finds them all.
- Vite multi-page build. `npm run dev` / `npm run build`. Pages are plain `.html` files in `src/`, one Rollup input each in `vite.config.js`.
- Shared CSS in `src/styles/` (tokens → base → components), shared JS in `src/scripts/` (`motion.js`, `cards.js`, `nav.js`). Page-only CSS/JS sits alongside as `home.*` / `vehicles.*`.
- `src/index.html` — homepage v1, done and reviewed. Refactored onto the shared files; renders byte-identically to the original single-file version. Treat it as the reference for every other page.
- `src/vehicles.html` — listing page, built, **awaiting review**. Filters, sort, live count, URL params, mobile bottom sheet.
- Next: vehicle detail (`/vehicle/:id`), finance, out-of-town, contact.
- `npm test` drives both pages in headless Chrome and enforces the rules below (palette, type, radii, 360px, reduced motion, CDN-less fallback, a11y). Add new pages to `PAGES` in `tests/quality.mjs`.
- Homepage carries a 1m14 Sinhala explainer video in the `.why` sticky column. The 129 MB master lives in `src/public/video/` and is gitignored; only the 720p web encode ships. Re-encode with:
  `ffmpeg -i <master> -vf scale=1280:-2 -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart sithari-explainer.mp4`
- **Outstanding: English subtitles for that video** (WCAG 1.2.2 Level A). The `<track>` element is scaffolded and commented out in `src/index.html` — drop a `sithari-explainer.en.vtt` beside the mp4 and uncomment it. Needs a translation of the Sinhala narration.
- Body style is derived from the model name in `cards.js` (`BODY_RULES`) because the scrape has no such field. Delete it once the inventory comes from a Motorcentral feed.

## Design system (do not drift from this)
Colours
- navy `#0F1E33` (hero, footer, dark surfaces), navy-2 `#16294A` (cards on navy)
- paper `#F7F6F3` page background, white `#FFFFFF` content surfaces
- ink `#1B2430` text, ink-2 `#4A5563` secondary, mute `#656F80` tertiary, line `#E4E2DC`
- orange `#DF542F` — focus rings and large display marks only (3:1 non-text). Never for large fills or headings.
- orange-2 `#C7472A` — anything carrying small text: button fills, `.step .n`, the star rating. 4.81:1 on white. orange-3 `#A63619` is its hover.
- blue `#286AA6` — finance, trust, links, icons. tint `#EAF1F8`. White text on blue needs alpha ≥ .85.
- **Every text/background pair must clear WCAG AA** (4.5:1, or 3:1 at ≥24px / ≥18.66px bold). `npm test` enforces this on all pages — see section 6 of `tests/quality.mjs`. mute was `#8A94A6` and orange fills were `#DF542F` until they were measured at 2.83:1 and 3.86:1.
Type
- Sora 600 for all headings, tracking -0.02em to -0.035em. Figtree 400/500/600 for body/UI.
- Headings are plain sentences in sentence case. No all-caps eyebrows, no single-word colour accents.
Layout
- Max width 1240px, gutter clamp(20px,4vw,48px). Left aligned. Radii: 10/16/24px by hierarchy. Pill buttons 52px (44px in nav).
Motion
- Lenis smooth scroll + GSAP ScrollTrigger from CDN. One reveal per section (`.rv`), not per element. Respect `prefers-reduced-motion` and degrade if CDN fails.
- Signature effect: hero stock strip drifts and reacts to scroll velocity. Don't add more "signature" effects; keep everything else quiet.
Logo
- `src/assets/logo/sc-logo.png` (orange/blue, for light backgrounds) and `sc-logo-white.png` (white wordmark, for navy). Never recolour the monogram.

## Rules
- Real content only: use `src/data/inventory.json` for cars, real reviews from BuyerScore, real hours/address. No lorem ipsum.
- Prices display as `$26,990*` with the on-road-costs footnote. Missing price → "Ask us".
- Every page: responsive to 360px, visible focus states, semantic landmarks, lazy-loaded images.
- Don't use the class name `.foot` for anything (it clashed once).
- Keep external links to the old site (finance application, trade-in) until those pages are rebuilt.
