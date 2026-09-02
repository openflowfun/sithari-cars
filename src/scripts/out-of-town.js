/* Out-of-town page. Nothing page-specific beyond the shared nav and motion. */

import { initNav, initNavState } from './nav.js';
import { initMotion } from './motion.js';

initNav();
initMotion();

/* After initMotion, so it can use ScrollTrigger when the CDN delivered it. */
initNavState(() => document.querySelector('.page-head').offsetHeight);
