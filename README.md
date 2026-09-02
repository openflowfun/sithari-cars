# Sithari Cars website

Open in Claude Code from this folder. `CLAUDE.md` carries the brand, design system and rules.

Vite multi-page site. `npm install`, then `npm run dev` (dev server) or `npm run build && npm run preview` (production build). The pages need a server — opening the HTML from disk will not run the module scripts.

- `src/index.html` — homepage v1
- `src/vehicles.html` — vehicle listing, filters + sort in the URL query string
- `src/styles/` — `tokens.css`, `base.css`, `components.css` shared; `home.css`, `vehicles.css` per page
- `src/scripts/` — `motion.js`, `cards.js`, `nav.js` shared; `home.js`, `vehicles.js` per page
- `src/data/inventory.json` — 138 live vehicles scraped 1 Sept 2026 (`python3 scripts/scrape_inventory.py` to refresh)
- `src/assets/logo/` — original logo + white-wordmark variant for dark surfaces

## Deploying

`npm run build` writes a self-contained static site to `dist/` (~260 KB, five pages).
It needs no server runtime — any static host works.

    npm run build
    npx netlify deploy --dir=dist --prod      # or drag dist/ onto app.netlify.com/drop
    npx vercel deploy --prod dist             # or
    npx wrangler pages deploy dist            # Cloudflare Pages

**Serve it at a domain root.** Internal links and asset URLs are root-absolute
(`/vehicles.html`, `/assets/...`), so a subfolder deploy will 404. If you need a
subfolder, set `base` in `vite.config.js` and rebuild.

Netlify and Cloudflare Pages serve `/vehicles` for `vehicles.html` automatically,
which matches the routes named in CLAUDE.md. On a plain web server, either keep the
`.html` URLs or add rewrites.

## Tests

`npm test` builds, serves the build and drives it in headless Chrome (`tests/run.mjs`).
`npm run test:dev` runs the same suites against a dev server already on :5173.
Set `CHROME_PATH` if Chrome is not in the usual place.

- `tests/listing.mjs` — filters, sort, paging, URL state, the mobile bottom sheet
- `tests/quality.mjs` — the CLAUDE.md rules: no overflow down to 360px, degrades
  without the CDN, respects reduced motion, landmarks and labels, and no drift off
  the colour palette, type scale or radii
