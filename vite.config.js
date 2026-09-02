import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/* Static multi-page site. Every page is a plain .html file in src/ and gets its
   own entry here; shared CSS and JS live in src/styles and src/scripts.
   GSAP and Lenis stay on the CDN (see CLAUDE.md) so they are not bundled. */
const root = resolve(import.meta.dirname, 'src');

export default defineConfig({
  root,
  /* favicons, og-image, robots and sitemap are copied verbatim to the dist root */
  publicDir: resolve(root, 'public'),
  /* relative, so the build runs from a domain root or a subfolder alike */
  base: './',
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        index: resolve(root, 'index.html'),
        vehicles: resolve(root, 'vehicles.html'),
        finance: resolve(root, 'finance.html'),
        contact: resolve(root, 'contact.html'),
        outOfTown: resolve(root, 'out-of-town.html'),
      },
    },
  },
  /* PORT lets the harness assign a free port; 5173 is just the local default. */
  server: { port: Number(process.env.PORT) || 5173, open: false },
  preview: { port: 4173 },
});
