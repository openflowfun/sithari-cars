/* Contact page. The two branches keep their own opening hours. */

import { renderHours } from './hours.js';
import { initNav, initNavState } from './nav.js';
import { initMotion } from './motion.js';

renderHours(document.getElementById('hours-henderson'), Array(7).fill('9.00am – 5.30pm'));
renderHours(document.getElementById('hours-greatnorth'),
  [...Array(6).fill('10.00am – 4.00pm'), 'Closed']);

initNav();
initMotion();

/* After initMotion, so it can use ScrollTrigger when the CDN delivered it. */
initNavState(() => document.querySelector('.page-head').offsetHeight);
