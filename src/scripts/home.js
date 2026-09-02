/* Homepage. Renders the data-driven blocks, then hands motion.js the hero
   timeline, the drifting stock strip and the reviews rail. */

import featuredData from '../data/featured.json';
import marqueeData from '../data/marquee.json';
import { money, normalise, carHTML } from './cards.js';
import { initCalculator } from './calculator.js';
import { renderHours } from './hours.js';
import { initNav, initNavState } from './nav.js';
import { initMotion } from './motion.js';

const FEATURED = featuredData.map(normalise);
const MARQUEE = marqueeData.map(normalise);

/* Verified BuyerScore reviews. */
const REVIEWS = [
  { t: "Excellent service, communication was A+, returned queries promptly and appreciated the follow-up after the sale.", n: "Joanne M", l: "Kumeū" },
  { t: "Very good experience with Sithari Cars. Very professional, courteous, listened, and very polite. Would happily buy from them again.", n: "Steven B", l: "Whanganui" },
  { t: "Mr Sam and Mrs Sithari personally attended to us and overall customer service was excellent. Keep it up.", n: "Dilky W", l: "Auckland" },
  { t: "I'm very happy with my recent car purchase from Sithari Cars. The service was friendly, honest and nothing was too much trouble.", n: "Aruna B", l: "Auckland" },
  { t: "Sal is so awesome and accommodated every request, which is what led us to purchase the vehicle. Thank you!", n: "Verified buyer", l: "Auckland" },
  { t: "Bought sight unseen from out of town. Car arrived exactly as described, on time, and the paperwork was sorted for me.", n: "Lisa C", l: "Taumarunui" },
];

/* Hero strip (duplicated for seamless loop) */
const strip = document.getElementById('strip');
strip.innerHTML = [...MARQUEE, ...MARQUEE].map(c =>
  `<a class="strip-card" href="${c.url}"><img src="${c.img}" alt="${c.title}" loading="eager"><div class="body"><div class="t">${c.title}</div><div class="m"><span>${c.kmLabel}</span><b>${c.price ? money(c.price) : 'Ask'}</b></div></div></a>`).join('');

/* Body types */
const TYPES = [
  ['Hatchback', 'Hatchback', 'M6 20h36M10 20l6-9h16l8 9M14 20a3 3 0 1 0 6 0M30 20a3 3 0 1 0 6 0'],
  ['Sedan', 'Sedan', 'M4 20h40M8 20l5-7h9l4-5h10l6 12M12 20a3 3 0 1 0 6 0M32 20a3 3 0 1 0 6 0'],
  ['Station wagon', 'Station wagon', 'M4 20h40M8 20l4-8h12l4-5h13l3 13M12 20a3 3 0 1 0 6 0M32 20a3 3 0 1 0 6 0'],
  ['SUV', 'SUV / 4x4', 'M4 21h40M7 21v-8l5-7h24l5 7v8M12 21a3 3 0 1 0 6 0M32 21a3 3 0 1 0 6 0'],
  ['Ute', 'Ute', 'M4 21h40M6 21v-9h10l4-6h10v6h14v9M11 21a3 3 0 1 0 6 0M33 21a3 3 0 1 0 6 0'],
  ['Van', 'Van', 'M4 21h40M6 21V9h28l10 8v4M11 21a3 3 0 1 0 6 0M33 21a3 3 0 1 0 6 0'],
  ['People mover', 'People mover', 'M4 21h40M6 21v-9l6-7h26l6 7v9M11 21a3 3 0 1 0 6 0M33 21a3 3 0 1 0 6 0'],
];
document.getElementById('types').innerHTML = TYPES.map(([n, v, d]) =>
  `<a class="type" href="/vehicles.html?body=${encodeURIComponent(v)}"><svg viewBox="0 0 48 28"><path d="${d}"/></svg><span>${n}</span></a>`).join('');

/* Featured grid + filters */
const grid = document.getElementById('grid');
const filt = {
  all: () => true,
  hybrid: c => c.fuel === 'Hybrid' || c.fuel === 'Electric',
  suv: c => /RAV4|Q7|X4|CX-5|C-HR|VEZEL|X-trail|XV|Kicks/i.test(c.model + c.make) || c.tags.includes('4WD'),
  family: c => c.tags.some(t => /seater/i.test(t)) || /Serena|Odyssey|Alpha|Noah|VELLFIRE|Elgrand/i.test(c.model),
  under15: c => c.price && c.price < 15000,
};
function render(f) {
  const list = FEATURED.filter(filt[f]).slice(0, 8);
  grid.innerHTML = list.length
    ? list.map(c => carHTML(c, 'car')).join('')
    : '<p style="grid-column:1/-1;color:var(--ink-2)">Nothing in this picks list right now. See the full stock list for more.</p>';
}
render('all');
document.getElementById('chips').addEventListener('click', e => {
  const b = e.target.closest('.chip');
  if (!b) return;
  document.querySelectorAll('.chip').forEach(x => x.classList.toggle('is-on', x === b));
  render(b.dataset.f);
});

/* Reviews */
document.getElementById('revs').innerHTML = REVIEWS.map(r =>
  `<article class="rev-card"><p>“${r.t}”</p><footer><span><b>${r.n}</b>, ${r.l}</span><span>Aug 2026</span></footer></article>`).join('');

/* Hours */
renderHours(document.getElementById('hours'), Array(7).fill('9.00am – 5.30pm'));

/* Finance estimate */
initCalculator();

/* Search: only send fields with values */
document.getElementById('search').addEventListener('submit', e => {
  e.preventDefault();
  const p = new URLSearchParams();
  [...e.target.elements].forEach(el => { if (el.name && el.value) p.set(el.name, el.value); });
  location.href = e.target.action + (p.toString() ? '?' + p : '');
});

/* Mobile nav */
initNav();

const hero = document.querySelector('.hero');

initMotion(ctx => {
  const { gsap, ScrollTrigger, reduced } = ctx;

  /* One orchestrated hero load */
  if (!reduced) {
    gsap.set('.h-line', { opacity: 0, y: 28 });
    gsap.timeline({ defaults: { ease: 'power3.out' } })
      .to('.h-line', { opacity: 1, y: 0, duration: 1, stagger: 0.1 }, 0.15)
      .from('.strip-card', { opacity: 0, y: 20, duration: .8, stagger: 0.05 }, 0.6);
  } else {
    gsap.set('.h-line', { opacity: 1, y: 0 });
  }

  /* Hero strip: constant drift + scroll velocity — the one signature effect */
  const track = document.getElementById('strip');
  let x = 0, vel = 0;
  const half = () => track.scrollWidth / 2;
  const drift = reduced ? 0 : 0.4;
  ScrollTrigger.create({ onUpdate: s => { vel += s.getVelocity() / 220; } });
  if (!reduced) {
    gsap.ticker.add(() => {
      vel *= 0.9;
      x -= drift + vel;
      const h = half();
      if (x <= -h) x += h;
      if (x > 0) x -= h;
      track.style.transform = `translate3d(${x}px,0,0)`;
    });
  }

  /* Reviews rail moves with scroll */
  const revs = document.getElementById('revs');
  if (!reduced) {
    gsap.to(revs, { x: () => -(revs.scrollWidth - innerWidth + 80), ease: 'none', scrollTrigger: { trigger: '#reviews', start: 'top 80%', end: 'bottom 10%', scrub: 1.2 } });
  }

  if (!reduced) {
    gsap.from('.why-item', { opacity: 0, y: 20, duration: .8, stagger: .15, ease: 'power3.out', scrollTrigger: { trigger: '.why-list', start: 'top 70%', once: true } });
    gsap.from('.type', { opacity: 0, y: 16, duration: .7, stagger: .05, ease: 'power3.out', scrollTrigger: { trigger: '#types', start: 'top 80%', once: true } });
    /* Subtle parallax on hero glow */
    gsap.to('.search', { y: -30, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  }
});

/* After initMotion, so it can use ScrollTrigger when the CDN delivered it. */
initNavState(() => hero.offsetHeight);
