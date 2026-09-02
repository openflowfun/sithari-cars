/* The fixed header: burger + drawer, and the transparent → solid → light states
   it moves through as the navy band at the top of the page scrolls away. */

export function initNav() {
  const nav = document.getElementById('nav');
  const burger = document.getElementById('burger');
  if (!nav || !burger) return null;

  burger.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });
  document.querySelectorAll('.drawer a').forEach(a =>
    a.addEventListener('click', () => {
      nav.classList.remove('is-open');
      document.body.style.overflow = '';
    }));

  return nav;
}

/* `dark` returns the height of the dark band the nav starts out sitting on: the
   hero on the homepage, the header band on the listing page. Driven by
   ScrollTrigger when it is available so it stays in step with Lenis, and by a
   passive scroll listener when the CDN did not load. Call this after initMotion,
   which is what registers the plugin. */
export function initNavState(dark = () => 0) {
  const nav = document.getElementById('nav');
  if (!nav) return;
  const ScrollTrigger = window.gsap && window.ScrollTrigger;

  const apply = y => {
    const end = dark() - 80;
    nav.classList.toggle('is-solid', y > 40 && y < end);
    nav.classList.toggle('is-light', y >= end);
  };

  if (ScrollTrigger) {
    ScrollTrigger.create({ start: 'top -40', onUpdate: s => apply(s.scroll()) });
  } else {
    addEventListener('scroll', () => apply(scrollY), { passive: true });
    apply(scrollY);
  }
}
