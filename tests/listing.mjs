/* Vehicle listing behaviour: filters, sort, paging, URL state, mobile sheet.
   Assertions look at what is painted (computed display, geometry), not just at
   properties — an attribute like `hidden` can be silently overridden by CSS. */

import { settle } from './helpers.mjs';

export default async function listing({ browser, base, check }) {
  const URL_ = base + '/vehicles.html';
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errs.push(m.text()); });

  const snap = () => page.evaluate(() => ({
    count: document.getElementById('count').innerText.replace(/\s+/g, ' ').trim(),
    cards: document.querySelectorAll('#grid .car').length,
    chips: [...document.querySelectorAll('#active [data-remove]')].map(c => c.textContent.trim()),
    url: location.search,
    more: getComputedStyle(document.getElementById('more')).display !== 'none',
    firstPrice: document.querySelector('#grid .car .p')?.textContent.trim(),
    firstYear: document.querySelector('#grid .car .y')?.textContent.trim(),
    firstKm: document.querySelector('#grid .car .k')?.textContent.trim(),
    empty: !!document.querySelector('.empty'),
  }));
  const go = async q => { await page.goto(URL_ + q, { waitUntil: 'networkidle2' }); await settle(400); };

  /* --- default view --- */
  await go('');
  let s = await snap();
  check('default: 24 of 138 shown', [s.cards, s.more, s.url], [24, true, '']);
  check('default: count copy', s.count, '138 cars in stock showing 24');

  /* --- paging --- */
  await page.click('#more'); await settle(250);
  check('show more -> 48', (await snap()).cards, 48);
  for (let i = 0; i < 4; i++) { await page.click('#more').catch(() => {}); await settle(200); }
  s = await snap();
  check('paged to the end -> 138 cards, button gone', [s.cards, s.more], [138, false]);

  /* --- ticking a facet --- */
  await go('');
  await page.click('input[data-facet="body"][value="SUV / 4x4"]');
  await settle(300);
  s = await snap();
  check('facet body=SUV: url is shareable', s.url, '?body=SUV+%2F+4x4');
  check('facet body=SUV: 28 matches', [s.count, s.cards], ['28 cars match of 138 in stock, showing 24', 24]);
  check('facet body=SUV: chip shown', s.chips, ['SUV / 4x4']);

  await go('?body=SUV+%2F+4x4');
  check('shared url restores state', (await snap()).count, '28 cars match of 138 in stock, showing 24');

  /* --- counts are cross-filtered --- */
  const sum = key => page.evaluate(k =>
    [...document.querySelectorAll(`input[data-facet="${k}"]`)]
      .reduce((t, i) => t + Number(i.closest('.opt').querySelector('b').textContent), 0), key);
  check('fuel counts within SUV sum to 28', await sum('fuel'), 28);
  check('body counts ignore their own selection (still 138)', await sum('body'), 138);

  /* --- combined filters --- */
  await go('?body=SUV+%2F+4x4&fuel=Hybrid&pmin=20000&pmax=30000');
  s = await snap();
  check('combined filters', [s.count, s.chips],
    ['5 cars match of 138 in stock', ['SUV / 4x4', 'Hybrid', '$20,000 – $30,000']]);
  const inRange = await page.evaluate(() =>
    [...document.querySelectorAll('#grid .car .p')].every(p => {
      const n = Number(p.textContent.replace(/[^\d]/g, ''));
      return n >= 20000 && n <= 30000;
    }));
  check('all prices inside the range', inRange, true);

  /* --- sorts --- */
  await go('?sort=price-asc');
  s = await snap();
  check('price ascending: cheapest first', [s.firstPrice, s.url], ['$4,980*', '?sort=price-asc']);
  await go('?sort=price-desc');
  check('price descending: dearest first', (await snap()).firstPrice, '$36,890*');
  await go('?sort=year-desc');
  check('year newest first', (await snap()).firstYear, '2023');
  await go('?sort=year-asc');
  check('year oldest first', (await snap()).firstYear, '2002');
  await go('?sort=km-asc');
  check('kms lowest first', (await snap()).firstKm, '7,283km');
  await go('?sort=km-desc');
  check('kms highest first', (await snap()).firstKm, '196,449km');

  await go('?sort=price-asc');
  const tail = await page.evaluate(async () => {
    for (let i = 0; i < 6; i++) { document.getElementById('more').click(); await new Promise(r => setTimeout(r, 60)); }
    const all = [...document.querySelectorAll('#grid .car .p')].map(p => p.textContent.trim());
    return { total: all.length, last12: all.slice(-12) };
  });
  check('price sort: the 12 "Ask us" cars land last',
    [tail.total, new Set(tail.last12).size, tail.last12[0]], [138, 1, 'Ask us']);

  /* --- values arriving from the homepage search --- */
  await go('?body=Station%20Wagon&make=toyota');
  check('legacy "Station Wagon" + lowercase make are mapped', (await snap()).chips, ['Station wagon', 'Toyota']);
  await go('?body=SUV');
  check('legacy "SUV" maps to SUV / 4x4', (await snap()).count, '28 cars match of 138 in stock, showing 24');
  await go('?body=RV-SUV');
  check('legacy "RV-SUV" maps to SUV / 4x4', (await snap()).count, '28 cars match of 138 in stock, showing 24');

  /* --- empty state --- */
  await go('?body=Ute');
  s = await snap();
  check('no utes in stock -> empty state', [s.count, s.empty, s.cards], ['No cars match', true, 0]);
  check('empty state hides the show-more button', s.more, false);
  await page.click('.empty [data-clear]'); await settle(250);
  s = await snap();
  check('clear all from the empty state', [s.count, s.url, s.chips], ['138 cars in stock showing 24', '', []]);

  /* --- chips --- */
  await go('?body=Sedan&make=Toyota&fuel=Hybrid');
  await page.click('[data-remove="make:Toyota"]'); await settle(250);
  s = await snap();
  check('chip removal drops only that filter', [s.chips, s.url], [['Sedan', 'Hybrid'], '?body=Sedan&fuel=Hybrid']);

  /* --- year range + transmission --- */
  await go('?ymin=2020&ymax=2023');
  const years = await page.evaluate(() => [...document.querySelectorAll('#grid .car .y')].map(y => +y.textContent));
  check('year range respected', [years.every(y => y >= 2020 && y <= 2023), (await snap()).chips], [true, ['2020 – 2023']]);
  await go('?trans=Automatic');
  check('transmission filter works', (await snap()).count, '138 cars in stock showing 24');

  /* --- mobile bottom sheet --- */
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await go('');
  const sheet = await page.evaluate(async () => {
    const f = document.getElementById('filters');
    const before = { vis: getComputedStyle(f).visibility, bar: getComputedStyle(document.getElementById('fbar')).display };
    document.getElementById('sheet-open').click();
    await new Promise(r => setTimeout(r, 600));
    const cs = getComputedStyle(f), r = f.getBoundingClientRect();
    return {
      ...before,
      position: cs.position, visibility: cs.visibility,
      /* the sheet must be pinned to the viewport: a transformed ancestor would
         quietly make itself the containing block and float it up the page */
      pinnedToBottom: Math.round(r.bottom) === innerHeight && r.width === innerWidth,
      scrim: getComputedStyle(document.getElementById('scrim')).opacity,
      locked: document.body.style.overflow,
      focused: document.activeElement.id,
    };
  });
  check('mobile: filter bar shown, rail parked off-screen', [sheet.bar, sheet.vis], ['flex', 'hidden']);
  check('mobile: rail becomes a fixed sheet', [sheet.position, sheet.visibility], ['fixed', 'visible']);
  check('mobile: sheet is pinned to the viewport bottom', sheet.pinnedToBottom, true);
  check('mobile: scrim up, scroll locked, focus moved into the sheet',
    [sheet.scrim, sheet.locked, sheet.focused], ['1', 'hidden', 'sheet-close']);

  const closed = await page.evaluate(async () => {
    document.querySelector('input[data-facet="fuel"][value="Electric"]').click();
    await new Promise(r => setTimeout(r, 300));
    const applyLabel = document.getElementById('sheet-apply').textContent;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise(r => setTimeout(r, 600));
    return {
      applyLabel,
      visibility: getComputedStyle(document.getElementById('filters')).visibility,
      locked: document.body.style.overflow,
      barCount: document.getElementById('fbar-count').textContent,
      badge: document.getElementById('fbadge').textContent,
      cards: document.querySelectorAll('#grid .car').length,
      url: location.search,
    };
  });
  check('mobile: apply button counts the matches', closed.applyLabel, 'Show 2 cars');
  check('mobile: Escape closes and unlocks scroll', [closed.visibility, closed.locked], ['hidden', '']);
  check('mobile: bar count + badge track the filter',
    [closed.barCount, closed.badge, closed.cards, closed.url], ['2 cars', '1', 2, '?fuel=Electric']);

  const lockedOnOpen = await page.evaluate(() => { document.getElementById('sheet-open').click(); return document.body.style.overflow; });
  await page.setViewport({ width: 1440, height: 900 });
  await settle(500);
  const afterResize = await page.evaluate(() => ({
    locked: document.body.style.overflow,
    position: getComputedStyle(document.getElementById('filters')).position,
  }));
  check('sheet open then resized to desktop: unlocked, back to a sidebar',
    [lockedOnOpen, afterResize.locked, afterResize.position], ['hidden', '', 'sticky']);

  check('no javascript errors', [...new Set(errs)], []);
  await page.close();
}
