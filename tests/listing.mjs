/* Vehicle listing behaviour: filters, sort, paging, URL state, mobile sheet.
   Assertions look at what is painted (computed display, geometry), not just at
   properties — an attribute like `hidden` can be silently overridden by CSS. */

import { settle } from './helpers.mjs';
import { N, PAGE, count, countCopy, EXTREMES, RARE_FUEL, noun } from './data.mjs';

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

  const SUV = count(c => c.body === 'SUV / 4x4');
  const showing = n => Math.min(n, PAGE);

  /* --- default view --- */
  await go('');
  let s = await snap();
  check(`default: ${PAGE} of ${N} shown`, [s.cards, s.more, s.url], [showing(N), N > PAGE, '']);
  check('default: count copy', s.count, countCopy(N));

  /* --- paging --- */
  await page.click('#more'); await settle(250);
  check('show more adds a page', (await snap()).cards, Math.min(N, PAGE * 2));
  for (let i = 0; i < Math.ceil(N / PAGE) + 1; i++) {
    if (!(await snap()).more) break;
    await page.click('#more'); await settle(200);
  }
  s = await snap();
  check(`paged to the end -> all ${N} cards, button gone`, [s.cards, s.more], [N, false]);

  /* --- ticking a facet --- */
  await go('');
  await page.click('input[data-facet="body"][value="SUV / 4x4"]');
  await settle(300);
  s = await snap();
  check('facet body=SUV: url is shareable', s.url, '?body=SUV+%2F+4x4');
  check(`facet body=SUV: ${SUV} matches`, [s.count, s.cards], [countCopy(SUV), showing(SUV)]);
  check('facet body=SUV: chip shown', s.chips, ['SUV / 4x4']);

  await go('?body=SUV+%2F+4x4');
  check('shared url restores state', (await snap()).count, countCopy(SUV));

  /* --- counts are cross-filtered --- */
  const sum = key => page.evaluate(k =>
    [...document.querySelectorAll(`input[data-facet="${k}"]`)]
      .reduce((t, i) => t + Number(i.closest('.opt').querySelector('b').textContent), 0), key);
  /* cars whose listing names no fuel are left out of the fuel facet, not guessed */
  check('fuel counts are cross-filtered to the SUVs', await sum('fuel'), count(c => c.body === 'SUV / 4x4' && c.fuel));
  check(`body counts ignore their own selection (still ${N})`, await sum('body'), N);

  /* --- combined filters --- */
  await go('?body=SUV+%2F+4x4&fuel=Hybrid&pmin=20000&pmax=30000');
  s = await snap();
  const combo = count(c => c.body === 'SUV / 4x4' && c.fuel === 'Hybrid' && c.price !== null && c.price >= 20000 && c.price <= 30000);
  check('combined filters', [s.count, s.chips],
    [countCopy(combo), ['SUV / 4x4', 'Hybrid', '$20,000 – $30,000']]);
  const inRange = await page.evaluate(() =>
    [...document.querySelectorAll('#grid .car .p')].every(p => {
      const n = Number(p.textContent.replace(/[^\d]/g, ''));
      return n >= 20000 && n <= 30000;
    }));
  check('all prices inside the range', inRange, true);

  /* --- sorts --- */
  await go('?sort=price-asc');
  s = await snap();
  check('price ascending: cheapest first', [s.firstPrice, s.url], [EXTREMES.cheapest, '?sort=price-asc']);
  await go('?sort=price-desc');
  check('price descending: dearest first', (await snap()).firstPrice, EXTREMES.dearest);
  await go('?sort=year-desc');
  check('year newest first', (await snap()).firstYear, EXTREMES.newest);
  await go('?sort=year-asc');
  check('year oldest first', (await snap()).firstYear, EXTREMES.oldest);
  await go('?sort=km-asc');
  check('kms lowest first', (await snap()).firstKm, EXTREMES.lowestKm);
  await go('?sort=km-desc');
  check('kms highest first', (await snap()).firstKm, EXTREMES.highestKm);

  await go('?sort=price-asc');
  const A = EXTREMES.unpriced;
  const tail = await page.evaluate(async () => {
    const more = document.getElementById('more');
    while (getComputedStyle(more).display !== 'none') { more.click(); await new Promise(r => setTimeout(r, 60)); }
    return [...document.querySelectorAll('#grid .car .p')].map(p => p.textContent.trim());
  });
  /* exactly the unpriced ones, and nothing priced among them */
  check(`price sort: all ${A} "Ask us" cars land last`,
    [tail.length, [...new Set(tail.slice(-A))], tail[tail.length - A - 1] !== 'Ask us'], [N, ['Ask us'], true]);

  /* --- values arriving from the homepage search --- */
  await go('?body=Station%20Wagon&make=toyota');
  check('legacy "Station Wagon" + lowercase make are mapped', (await snap()).chips, ['Station wagon', 'Toyota']);
  await go('?body=SUV');
  check('legacy "SUV" maps to SUV / 4x4', (await snap()).count, countCopy(SUV));
  await go('?body=RV-SUV');
  check('legacy "RV-SUV" maps to SUV / 4x4', (await snap()).count, countCopy(SUV));

  /* --- the homepage's Ute tile lands on a real result, or an honest empty state --- */
  const UTES = count(c => c.body === 'Ute');
  await go('?body=Ute');
  check(`Ute tile: ${UTES} in stock`, (await snap()).count, countCopy(UTES));

  /* --- empty state: a filter nothing can satisfy, whatever is in stock --- */
  await go('?ymin=2099');
  s = await snap();
  check('impossible filter -> empty state', [s.count, s.empty, s.cards], ['No cars match', true, 0]);
  check('empty state hides the show-more button', s.more, false);
  await page.click('.empty [data-clear]'); await settle(250);
  s = await snap();
  check('clear all from the empty state', [s.count, s.url, s.chips], [countCopy(N), '', []]);

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
  check('transmission filter works', (await snap()).count, countCopy(count(c => c.transmission === 'Automatic')));

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

  const { fuel, n: F } = RARE_FUEL;
  const closed = await page.evaluate(async fuel => {
    document.querySelector(`input[data-facet="fuel"][value="${fuel}"]`).click();
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
  }, fuel);
  check('mobile: apply button counts the matches', closed.applyLabel, `Show ${F} ${noun(F)}`);
  check('mobile: Escape closes and unlocks scroll', [closed.visibility, closed.locked], ['hidden', '']);
  check('mobile: bar count + badge track the filter',
    [closed.barCount, closed.badge, closed.cards, closed.url], [`${F} ${noun(F)}`, '1', showing(F), `?fuel=${fuel}`]);

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
