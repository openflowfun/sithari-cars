/* Vehicle data + the card renderer shared by the homepage and the listing page.
   Two record shapes feed this: data/inventory.json (title + specs strings, as
   scraped from Motorcentral) and data/featured.json / marquee.json (already
   split into year/make/model). normalise() flattens both to one shape. */

const OLD_SITE = 'https://www.sitharicars.co.nz';

export const money = n => '$' + Number(n).toLocaleString('en-NZ');

/* Body style is the one facet Motorcentral does not give us in the scrape, so we
   derive it from the model name. Ordered most-specific first: a Corolla Fielder
   is a wagon before it is a Corolla, and "Prius S Touring Selection" is a trim on
   the liftback, not a Corolla Touring wagon. Replace this with the real field as
   soon as the inventory comes from a Motorcentral feed. */
const BODY_RULES = [
  ['People mover',  /PRIUS ALPHA|ELGRAND|SERENA|VELLFIRE|ALPHARD|NOAH|VOXY|ESTIMA|ODYSSEY|STEPWGN|SIENTA|\bWISH\b|PREMACY|\bJADE\b/],
  ['Van',           /CARAVAN|NV200|VANETTE|PROBOX|HIACE|TOWNACE|REGIUS|BONGO|\bVAN\b/],
  ['Station wagon', /FIELDER|COROLLA TOURING|WAGON|WINGROAD|SHUTTLE|AVENSIS|LEVORG|\bAVANT\b/],
  /* HILUX SURF is Toyota's SUV, so it is caught here before the Ute rule sees HILUX */
  ['SUV / 4x4',     /RAV4|C-HR|VEZEL|CX-[3-9]|X-TRAIL|\bXV\b|JUKE|KICKS|TUCSON|IX35|RVR|TRAX|\bQ[3578]\b|\bX[1-7]\b|HARRIER|FORESTER|OUTLANDER|CR-V|ESCAPE|SPORTAGE|DUALIS|MACAN|CAYENNE|HILUX SURF/],
  ['Ute',           /HILUX|NAVARA|\bRANGER\b|TRITON|D-MAX|BT-50|AMAROK|COLORADO/],
  ['Coupe',         /COUPE|\bRC ?\d{3}/],
  ['Sedan',         /\bSEDAN\b|AXIO|ALLION|ALTEZZA|CELSIOR|SKYLINE|CAMRY|ATENZA|E200|HS250H|\bWRX\b|PREMIO|MARK[- ]X|CROWN|LEGACY B4|\bSAI\b/],
];

export function bodyStyle(title) {
  const t = title.toUpperCase();
  for (const [name, re] of BODY_RULES) if (re.test(t)) return name;
  return 'Hatchback';
}

const num = s => (s ? Number(String(s).replace(/[^\d]/g, '')) : null);

/* Motorcentral omits the fuel field for some cars, and the third spec slot then
   holds the engine size ("1500cc") — which must never surface as a fuel type.
   Where the listing's own title says hybrid, or the model has only ever been
   sold as a hybrid, that is extraction rather than guesswork. */
const FUELS = ['Hybrid', 'Petrol', 'Diesel', 'Electric'];
const HYBRID_ONLY = /\b(AQUA|PRIUS)\b/i;
const SAYS_HYBRID = /\b(HYBRID|HV|E-POWER)\b/i;
function fuelOf(given, slot, title) {
  if (FUELS.includes(given)) return given;
  if (FUELS.includes(slot)) return slot;
  if (SAYS_HYBRID.test(title) || HYBRID_ONLY.test(title)) return 'Hybrid';
  return '';
}

export function normalise(v) {
  const title = v.title || [v.year, v.make, v.model].filter(Boolean).join(' ');
  const [year, make = '', ...rest] = title.split(' ');
  const model = rest.join(' ');

  /* "86,916km, Automatic, Hybrid, 1800cc" — the cc group is absent on the EVs. */
  const spec = (v.specs || '').match(/^([\d,]+)km,\s*([^,]+?)\s*,\s*([^,]+?)(?:\s*,\s*(\d+)cc)?$/);
  const kmLabel = spec ? spec[1] + 'km' : (v.km || '');

  return {
    id: v.stock || v.id || title,
    title, year, make, model,
    modelHead: model.split(' ')[0] || '',
    modelTail: model.split(' ').slice(1).join(' '),
    price: num(v.price),
    km: num(kmLabel),
    kmLabel,
    fuel: fuelOf(v.fuel, spec ? spec[3] : '', title),
    transmission: spec ? (/tiptronic/i.test(spec[2]) ? 'Automatic' : spec[2]) : '',
    body: bodyStyle(title),
    tags: v.tags || [],
    img: v.img || '',
    url: (v.url || '').startsWith('http') ? v.url : OLD_SITE + v.url,
  };
}

/* The homepage "In the yard" chips. scripts/pick_featured.mjs uses these same
   tests when choosing the featured cars, so no chip can come up empty. */
export const CHIPS = {
  all: () => true,
  hybrid: c => c.fuel === 'Hybrid' || c.fuel === 'Electric',
  suv: c => c.body === 'SUV / 4x4' || c.tags.includes('4WD'),
  family: c => c.body === 'People mover' || c.tags.some(t => /seater/i.test(t)),
  under15: c => c.price !== null && c.price < 15000,
};

/* Prices show as $26,990* with the on-road-costs footnote; no price means "Ask us". */
const priceHTML = c => (c.price ? money(c.price) + '<sup>*</sup>' : 'Ask us');
const badge = c =>
  c.fuel === 'Hybrid' ? '<span class="tag hy">Hybrid</span>'
  : c.fuel === 'Electric' ? '<span class="tag hy">Electric</span>'
  : '';

export const carHTML = (c, cls = 'car') =>
  `<a class="${cls}" href="${c.url}"><figure><img loading="lazy" src="${c.img}" alt="${c.title}">${badge(c)}</figure>` +
  `<div class="body"><span class="y">${c.year}</span><span class="n">${c.make} ${c.modelHead}<small>${c.modelTail || '&nbsp;'}</small></span>` +
  `<div class="meta"><span class="p">${priceHTML(c)}</span><span class="k">${c.kmLabel}</span></div></div></a>`;
