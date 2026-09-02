/* Indicative weekly repayment, used by the homepage finance card and /finance.
   Both pages carry the same control ids, so this binds to either unchanged.
   The rate is the indicative one already shown on the homepage — it is not a
   quote, and the page says so. */

import { money } from './cards.js';

export const RATE = 0.1295;

export function initCalculator() {
  const price = document.getElementById('r-price');
  const deposit = document.getElementById('r-dep');
  const term = document.getElementById('r-term');
  if (!price || !deposit || !term) return;

  function calc() {
    const owing = Math.max(+price.value - +deposit.value, 0);
    const weekly = RATE / 52;
    const payments = +term.value * 52;
    const pay = owing > 0 ? owing * weekly / (1 - Math.pow(1 + weekly, -payments)) : 0;

    document.getElementById('o-price').textContent = money(price.value);
    document.getElementById('o-dep').textContent = money(deposit.value);
    document.getElementById('o-term').textContent = term.value + (term.value == 1 ? ' year' : ' years');
    document.getElementById('o-pay').textContent = money(Math.round(pay));
  }

  [price, deposit, term].forEach(el => el.addEventListener('input', calc));
  calc();
}
