/* Opening hours table with today picked out. Takes the week's hours so a branch
   with its own times renders the same way. */

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function renderHours(el, hours) {
  if (!el) return;
  const today = (new Date().getDay() + 6) % 7;
  el.innerHTML = DAYS.map((d, i) =>
    `<div class="${i === today ? 'today' : ''}"><span>${d}${i === today ? ' (today)' : ''}</span><span>${hours[i]}</span></div>`).join('');
}
