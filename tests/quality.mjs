/* The rules from CLAUDE.md that are cheap to hold onto automatically:
   responsive to 360px, degrades without the CDN, respects reduced motion,
   semantic + labelled, and never drifts off the palette or type scale. */

import { settle } from './helpers.mjs';

const WIDTHS = [360, 390, 768, 1024, 1440];
const PAGES = ['/index.html', '/vehicles.html', '/finance.html', '/contact.html', '/out-of-town.html'];

/* Tokens from CLAUDE.md, plus black/transparent, the two .btn hover shades, and
   the two image placeholders the reviewed homepage already ships (#eee behind
   car photos, #0b1728 behind the strip cards on navy). */
const PALETTE = [
  'rgb(15, 30, 51)', 'rgb(22, 41, 74)', 'rgb(247, 246, 243)', 'rgb(255, 255, 255)',
  'rgb(27, 36, 48)', 'rgb(74, 85, 99)', 'rgb(138, 148, 166)', 'rgb(228, 226, 220)',
  'rgb(223, 84, 47)', 'rgb(199, 71, 42)', 'rgb(40, 106, 166)', 'rgb(31, 90, 143)',
  'rgb(234, 241, 248)', 'rgb(0, 0, 0)', 'rgba(0, 0, 0, 0)',
  'rgb(230, 228, 222)', 'rgb(242, 246, 250)', 'rgb(238, 238, 238)', 'rgb(11, 23, 40)',
  'rgb(101, 111, 128)', 'rgb(166, 54, 25)',
];
/* 12px is the .field select / .burger radius inherited from the reviewed homepage. */
const RADII = ['0px', '10px', '12px', '16px', '24px', '24px 24px 0px 0px', '50%', '999px'];

const blockCdn = async p => {
  await p.setRequestInterception(true);
  p.on('request', r => (/cdnjs|unpkg/.test(r.url()) ? r.abort() : r.continue()));
};

export default async function quality({ browser, base, check }) {
  /* --- 1. nothing overflows horizontally, down to 360px --- */
  for (const path of PAGES) {
    for (const w of WIDTHS) {
      const p = await browser.newPage();
      await p.setViewport({ width: w, height: 800 });
      await p.goto(base + path, { waitUntil: 'networkidle2' });
      await settle(800);
      const over = await p.evaluate(() => {
        const bad = new Set();
        document.querySelectorAll('body *').forEach(el => {
          if (el.closest('#strip, #revs, .strip-full, .rev-full')) return; // full-bleed rails, by design
          const r = el.getBoundingClientRect();
          if (r.width && (r.right > innerWidth + 1 || r.left < -1)) {
            bad.add(el.tagName + '.' + el.className.toString().slice(0, 30));
          }
        });
        return { fits: document.documentElement.scrollWidth <= innerWidth, bad: [...bad].slice(0, 4) };
      });
      check(`${path} @${w}px: no horizontal overflow`, [over.fits, over.bad], [true, []]);
      await p.close();
    }
  }

  /* --- 2. the CDN is blocked: the site must still read and work --- */
  {
    const p = await browser.newPage();
    await blockCdn(p);
    await p.setViewport({ width: 1440, height: 900 });
    await p.goto(base + '/vehicles.html', { waitUntil: 'networkidle2' });
    await settle(700);
    const out = await p.evaluate(async () => {
      const before = document.querySelectorAll('#grid .car').length;
      document.querySelector('input[data-facet="fuel"][value="Diesel"]').click();
      await new Promise(r => setTimeout(r, 250));
      window.scrollTo(0, 900); await new Promise(r => setTimeout(r, 200));
      return {
        gsap: typeof window.gsap,
        opacity: getComputedStyle(document.querySelector('.results')).opacity,
        before, after: document.querySelectorAll('#grid .car').length,
        nav: document.getElementById('nav').className,
      };
    });
    check('no CDN: gsap absent but content visible', [out.gsap, out.opacity], ['undefined', '1']);
    check('no CDN: filtering still works', [out.before, out.after], [24, 1]);
    check('no CDN: nav still goes light past the band', out.nav, 'nav is-light');
    await p.close();
  }
  {
    const p = await browser.newPage();
    await blockCdn(p);
    await p.setViewport({ width: 1440, height: 900 });
    await p.goto(base + '/index.html', { waitUntil: 'networkidle2' });
    await settle(700);
    const out = await p.evaluate(() => ({
      h1: getComputedStyle(document.querySelector('.hero h1')).opacity,
      allRevealed: [...document.querySelectorAll('.rv')].every(e => getComputedStyle(e).opacity === '1'),
      cars: document.querySelectorAll('#grid .car').length,
    }));
    check('no CDN: homepage hero + every reveal visible', [out.h1, out.allRevealed, out.cars], ['1', true, 8]);
    await p.close();
  }

  /* --- 3. prefers-reduced-motion --- */
  for (const path of PAGES) {
    const p = await browser.newPage();
    await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await p.setViewport({ width: 1440, height: 900 });
    await p.goto(base + path, { waitUntil: 'networkidle2' });
    await settle(700);
    const out = await p.evaluate(() => {
      const revealed = [...document.querySelectorAll('.rv')];
      return {
        rm: document.documentElement.classList.contains('rm'),
        lenis: document.documentElement.classList.contains('lenis'),
        visible: revealed.every(e => getComputedStyle(e).opacity === '1'),
        /* nothing animated them, so no leftover transform */
        untransformed: revealed.every(e => getComputedStyle(e).transform === 'none'),
      };
    });
    check(`${path}: reduced motion — no Lenis, visible, untouched`,
      [out.rm, out.lenis, out.visible, out.untransformed], [true, false, true, true]);
    await p.close();
  }

  /* --- 4. accessibility basics --- */
  {
    const p = await browser.newPage();
    await p.setViewport({ width: 1440, height: 900 });
    await p.goto(base + '/vehicles.html', { waitUntil: 'networkidle2' });
    await settle(600);
    const a11y = await p.evaluate(() => ({
      landmarks: ['header', 'nav', 'main', 'footer', 'aside'].map(t => document.querySelectorAll(t).length),
      h1: document.querySelectorAll('h1').length,
      imgsWithoutAlt: [...document.images].filter(i => !i.hasAttribute('alt')).length,
      lazy: [...document.querySelectorAll('#grid img')].every(i => i.loading === 'lazy'),
      live: document.getElementById('count').getAttribute('aria-live'),
      selectsLabelled: [...document.querySelectorAll('select')].every(s =>
        !!document.querySelector(`label[for="${s.id}"]`) || !!s.closest('label') || s.hasAttribute('aria-label')),
      boxesLabelled: [...document.querySelectorAll('input[type=checkbox]')].every(c => !!c.closest('label')),
      sheetControls: document.getElementById('sheet-open').getAttribute('aria-controls'),
    }));
    check('landmarks present (header/nav/main/footer/aside)', a11y.landmarks, [1, 1, 1, 1, 1]);
    check('exactly one h1', a11y.h1, 1);
    check('every image has alt text', a11y.imgsWithoutAlt, 0);
    check('result images lazy-loaded', a11y.lazy, true);
    check('result count is a live region', a11y.live, 'polite');
    check('every select is labelled', a11y.selectsLabelled, true);
    check('every checkbox sits inside its label', a11y.boxesLabelled, true);
    check('filter button points at the sheet', a11y.sheetControls, 'filters');

    const focus = await p.evaluate(() => {
      const el = document.querySelector('input[data-facet="body"]');
      el.focus();
      return { tag: document.activeElement.tagName, outlined: getComputedStyle(el).outlineStyle !== 'none' };
    });
    check('focused control keeps a visible ring', [focus.tag, focus.outlined], ['INPUT', true]);
    await p.close();
  }

  /* --- 6. WCAG AA contrast on real rendered text --- */
  for (const path of PAGES) {
    const p = await browser.newPage();
    await p.setViewport({ width: 1440, height: 900 });
    await p.goto(base + path, { waitUntil: 'networkidle2' });
    await settle(700);
    const failures = await p.evaluate(() => {
      const lum = c => {
        const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const parse = s => (s.match(/[\d.]+/g) || []).map(Number);
      /* walk up for the first ancestor that actually paints a background */
      const bgOf = el => {
        for (let e = el; e; e = e.parentElement) {
          const p = parse(getComputedStyle(e).backgroundColor);
          if (p.length >= 3 && (p[3] === undefined || p[3] > 0.5)) return p.slice(0, 3);
        }
        return [255, 255, 255];
      };
      const flatten = (fg, bg) => { const a = fg[3] === undefined ? 1 : fg[3]; return [0, 1, 2].map(i => fg[i] * a + bg[i] * (1 - a)); };

      const out = [];
      document.querySelectorAll('body *').forEach(el => {
        /* the fixed header is transparent over a dark band and opaque over paper;
           both states are designed, and neither is measurable from the DOM alone */
        if (el.closest('#nav, .drawer')) return;
        if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return;
        const bg = bgOf(el);
        const r = (() => {
          const L1 = lum(flatten(parse(cs.color), bg)), L2 = lum(bg);
          return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
        })();
        const size = parseFloat(cs.fontSize);
        const large = size >= 24 || (size >= 18.66 && +cs.fontWeight >= 700);
        const need = large ? 3 : 4.5;
        if (r < need - 0.01) {
          out.push(`${el.tagName}.${el.className.toString().slice(0, 22)} ${cs.fontSize} ${r.toFixed(2)}:1 <${need}`);
        }
      });
      return [...new Set(out)];
    });
    check(`${path}: text meets WCAG AA contrast`, failures, []);
    await p.close();
  }

  /* --- 5. design system: no drift off the tokens --- */
  for (const path of PAGES) {
    const p = await browser.newPage();
    await p.setViewport({ width: 1440, height: 900 });
    await p.goto(base + path, { waitUntil: 'networkidle2' });
    await settle(600);
    const design = await p.evaluate(({ palette, radii }) => {
      const ok = new Set(palette), okRadii = new Set(radii);
      const strays = new Set(), fonts = new Set(), oddRadii = new Set();
      document.querySelectorAll('main *, .nav *, .site-foot *, .filters *').forEach(el => {
        const cs = getComputedStyle(el);
        /* form controls carry UA-default colour and font that never paint — a
           range input renders through accent-color, an option through the OS */
        if (!/^(INPUT|OPTION)$/.test(el.tagName)) {
          [cs.color, cs.backgroundColor].forEach(c => { if (!ok.has(c) && !c.startsWith('rgba(')) strays.add(c); });
          fonts.add(cs.fontFamily.split(',')[0].replace(/["']/g, ''));
        }
        if (!okRadii.has(cs.borderRadius)) oddRadii.add(cs.borderRadius);
      });
      /* orange is for CTAs and focus rings only — never a large fill or a heading */
      const bigOrange = [...document.querySelectorAll('*')].filter(el => {
        const cs = getComputedStyle(el), r = el.getBoundingClientRect();
        return cs.backgroundColor === 'rgb(223, 84, 47)' && r.width * r.height > 40000;
      }).map(el => el.tagName + '.' + el.className);
      const orangeHeadings = [...document.querySelectorAll('h1,h2,h3,h4')]
        .filter(h => getComputedStyle(h).color === 'rgb(223, 84, 47)').map(h => h.textContent.slice(0, 30));
      return { strays: [...strays], fonts: [...fonts].sort(), oddRadii: [...oddRadii], bigOrange, orangeHeadings };
    }, { palette: PALETTE, radii: RADII });
    check(`${path}: no colours outside the tokens`, design.strays, []);
    check(`${path}: only Sora and Figtree`, design.fonts, ['Figtree', 'Sora']);
    check(`${path}: radii stay on the scale`, design.oddRadii, []);
    check(`${path}: orange is never a large fill`, design.bigOrange, []);
    check(`${path}: no orange headings`, design.orangeHeadings, []);
    await p.close();
  }
}
