/* Finance page. Everything on it is shared — the calculator, the nav and the
   standard one-reveal-per-section pass. */

import { initCalculator } from './calculator.js';
import { initNav, initNavState } from './nav.js';
import { initMotion } from './motion.js';

initCalculator();
initNav();
initMotion();

/* After initMotion, so it can use ScrollTrigger when the CDN delivered it. */
initNavState(() => document.querySelector('.page-head').offsetHeight);
