/* Lenis smooth scroll + GSAP ScrollTrigger, loaded from CDN in the page.
   Everything here degrades to a plain, fully visible page if the CDN is blocked
   or the visitor prefers reduced motion. Pages add their own timelines through
   the setup callback; the one-reveal-per-section pass is shared. */

export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

function showEverything() {
  document.querySelectorAll('.rv, .h-line').forEach(el => {
    el.style.opacity = 1;
    el.style.transform = 'none';
  });
}

/* One reveal per section, not per element — see CLAUDE.md. */
function revealSections({ gsap, ScrollTrigger }) {
  document.querySelectorAll('.sec').forEach(sec => {
    const items = sec.querySelectorAll('.rv');
    if (!items.length) return;
    gsap.to(items, {
      opacity: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.12,
      scrollTrigger: { trigger: sec, start: 'top 72%', once: true },
    });
  });
}

export function initMotion(setup) {
  if (reduced) document.documentElement.classList.add('rm');

  const gsap = window.gsap;
  if (typeof gsap === 'undefined') { showEverything(); return null; }

  const ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);

  let lenis = null;
  if (!reduced && typeof window.Lenis !== 'undefined') {
    lenis = new window.Lenis({ lerp: 0.09, wheelMultiplier: 1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    document.querySelectorAll('a[href^="#"]').forEach(a =>
      a.addEventListener('click', e => {
        const id = a.getAttribute('href');
        if (id.length > 1 && document.querySelector(id)) {
          e.preventDefault();
          lenis.scrollTo(id, { offset: -70, duration: 1.2 });
        }
      }));
  }

  const ctx = { gsap, ScrollTrigger, lenis, reduced };
  if (typeof setup === 'function') setup(ctx);
  if (!reduced) revealSections(ctx);
  window.addEventListener('load', () => ScrollTrigger.refresh());
  return ctx;
}
