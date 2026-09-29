// Interactive butcher's chart, drawn in the style of the charts Heavenly Meats posts.
const NS = 'http://www.w3.org/2000/svg';

const ANIMALS = {
  beef: {
    label: 'Beef',
    silhouette: `M92 96 C80 92 66 96 58 108 L40 150 C36 162 44 172 58 172 C72 174 86 170 96 164
      C112 180 132 196 150 214 C160 236 168 250 176 258 L180 336 L206 336 L210 270
      C280 280 400 280 468 270 L474 336 L500 336 L506 262 C530 250 546 226 552 196
      C556 170 558 140 556 118 C550 100 530 92 500 90 C400 84 280 84 200 88
      C170 90 140 88 120 84 C110 82 100 86 92 96 Z`,
    extras: [
      { d: 'M102 90 C106 70 120 60 136 60 C124 68 116 78 114 92 Z', cls: 'head' },
      { d: 'M116 100 C130 96 146 102 152 112 C138 116 124 112 116 100 Z', cls: 'head' },
      { d: 'M555 122 C572 150 576 210 568 258', cls: 'outline' },
      { d: 'M568 258 C562 266 574 272 574 262', cls: 'outline' },
      { circle: [72, 120, 3.4], cls: 'feature' },
    ],
    head: [[0, 0], [120, 0], [124, 205], [0, 205]],
    cuts: {
      neck:       { poly: [[120, 0], [190, 0], [180, 205], [124, 205]], at: [152, 150] },
      chuck:      { poly: [[190, 0], [270, 0], [270, 205], [180, 205]], at: [228, 146] },
      primerib:   { poly: [[270, 0], [335, 0], [335, 190], [270, 190]], at: [302, 140] },
      wingrib:    { poly: [[335, 0], [393, 0], [393, 190], [335, 190]], at: [364, 140] },
      sirloin:    { poly: [[393, 0], [455, 0], [455, 190], [393, 190]], at: [424, 140], label: 'Sirloin' },
      rump:       { poly: [[455, 0], [562, 0], [505, 128], [455, 158]], at: [494, 118] },
      silverside: { poly: [[562, 0], [640, 0], [640, 262], [468, 262], [455, 158], [505, 128]], at: [512, 208], label: 'Silverside' },
      brisket:    { poly: [[100, 205], [270, 205], [270, 266], [100, 266]], at: [212, 240] },
      flank:      { poly: [[270, 190], [455, 190], [468, 262], [270, 266]], at: [366, 236] },
      shin:       { poly: [[140, 266], [300, 266], [300, 400], [140, 400]], at: [193, 364] },
      shin2:      { poly: [[420, 266], [640, 262], [640, 400], [420, 400]], at: [487, 364], ref: 'shin' },
    },
    data: {
      neck:       { name: 'Neck', body: 'Full of flavour and connective tissue. It melts into a stew and makes excellent mince.', ask: 'Neck slices, stewing beef, mince', cook: 'Stew, potjie' },
      chuck:      { name: 'Chuck', body: 'Shoulder meat that rewards patience. The best mince and the richest stews start here.', ask: 'Chuck steak, stewing beef, mince', cook: 'Stew, braise, mince' },
      primerib:   { name: 'Prime rib', body: 'Big marbling and a fat cap made for the fire. Cut as a bone-in rib roast or ribeye steaks.', ask: 'Prime rib, ribeye, rib roast', cook: 'Braai, roast' },
      wingrib:    { name: 'Wing rib', body: 'The tender rib section next to the sirloin, cut into wing rib steaks or roasted whole.', ask: 'Wing rib steaks, wing rib roast', cook: 'Braai, roast' },
      sirloin:    { name: 'Sirloin & fillet', body: 'Sirloin sits on top and the fillet lies underneath. Cut across both and you get a T-bone.', ask: 'Sirloin, fillet, T-bone', cook: 'Braai, pan' },
      rump:       { name: 'Rump', body: "South Africa's favourite braai steak: big flavour, with a strip of fat that crisps on the coals.", ask: 'Rump steak, rump roast, picanha', cook: 'Braai, pan, roast' },
      silverside: { name: 'Topside & silverside', body: 'Lean leg cuts for Sunday roasts, stir-fry strips and, of course, biltong.', ask: 'Topside, silverside, biltong cuts', cook: 'Roast, biltong, stir-fry' },
      brisket:    { name: 'Brisket', body: 'Cook it low and slow until it pulls apart. Also the classic cut for corned beef.', ask: 'Brisket, corned beef', cook: 'Smoke, braise, pot roast' },
      flank:      { name: 'Flank', body: 'Thin and full of flavour. Cook it hot and fast, then slice across the grain.', ask: 'Flank steak, thin flank, mince', cook: 'Braai, stir-fry, mince' },
      shin:       { name: 'Shin', body: 'Rich in marrow and gelatine. Slow-cook it for osso buco, soup or a potjie.', ask: 'Beef shin, osso buco', cook: 'Braise, soup, potjie' },
    },
    initial: 'rump',
  },
  lamb: {
    label: 'Lamb',
    silhouette: `M96 92 C88 70 104 58 120 66 C130 60 146 66 150 80 C170 96 200 100 240 98
      C320 92 420 90 490 98 C530 102 556 116 566 140 C574 150 584 150 588 162 C590 176 578 182 570 176
      C572 204 560 232 540 246 L536 336 L514 338 L508 262 C470 272 360 276 262 270 L252 336 L230 338
      L222 262 C206 250 190 230 180 206 C168 186 150 172 128 166 C110 162 96 160 82 158
      C66 156 52 150 48 138 C44 126 52 116 62 110 C72 104 84 100 96 92 Z`,
    extras: [
      { d: 'M114 76 C126 62 146 60 160 70 C146 80 128 84 114 76 Z', cls: 'head' },
      { circle: [80, 116, 3.4], cls: 'feature' },
    ],
    head: [[0, 0], [132, 0], [130, 40], [118, 182], [0, 200]],
    cuts: {
      neck:      { poly: [[132, 0], [212, 0], [196, 212], [120, 212], [118, 182], [130, 40]], at: [166, 146] },
      shoulder:  { poly: [[212, 0], [300, 0], [300, 212], [196, 212]], at: [252, 158] },
      rib:       { poly: [[300, 0], [385, 0], [385, 212], [300, 212]], at: [342, 158] },
      loin:      { poly: [[385, 0], [452, 0], [455, 212], [385, 212]], at: [420, 158] },
      chump:     { poly: [[452, 0], [502, 0], [512, 240], [455, 212]], at: [482, 160] },
      leg:       { poly: [[502, 0], [640, 0], [640, 290], [505, 290], [512, 240]], at: [548, 205] },
      breast:    { poly: [[100, 212], [455, 212], [512, 240], [505, 276], [100, 276]], at: [340, 248] },
      shank:     { poly: [[140, 276], [320, 276], [320, 400], [140, 400]], at: [241, 364], alias: true },
      shank2:    { poly: [[400, 276], [505, 276], [505, 290], [640, 290], [640, 400], [400, 400]], at: [525, 364], ref: 'shank' },
    },
    data: {
      neck:     { name: 'Neck', body: 'Neck slices, with plenty of connective tissue that melts into a rich sauce. The heart of a good potjie.', ask: 'Neck slices, whole neck', cook: 'Potjie, stew, slow oven' },
      shoulder: { name: 'Shoulder', body: 'Hard-working and full of flavour. Roast it low on the bone or ask us to debone and roll it.', ask: 'Bone-in or rolled shoulder, curry cubes', cook: 'Slow roast, curry, potjie' },
      rib:      { name: 'Rib', body: 'Rib chops and the rack. Tender, with a fat cap that crisps up over hot coals.', ask: 'Rib chops, rack of lamb', cook: 'Braai, roast' },
      loin:     { name: 'Loin', body: 'Loin chops, the classic braai chop. Hot coals, a few minutes a side, salt at the end.', ask: 'Loin chops, saddle', cook: 'Braai, pan' },
      chump:    { name: 'Chump', body: 'Where the loin meets the leg. Meaty, lean chops that stay juicy on the grid.', ask: 'Chump chops', cook: 'Braai, pan, oven' },
      leg:      { name: 'Leg', body: 'The Sunday roast. Butterfly it and it braais evenly in under an hour.', ask: 'Whole leg, butterflied leg, leg steaks', cook: 'Roast, braai' },
      breast:   { name: 'Breast & flank', body: 'Ribbetjie: thin, fatty riblets that turn crisp and sticky over slow coals. A Karoo favourite.', ask: 'Ribbetjie, breast riblets', cook: 'Slow braai, oven' },
      shank:    { name: 'Shank', body: 'Braise it in a potjie with red wine and root veg until the meat falls from the bone.', ask: 'Fore or hind shank', cook: 'Braise, potjie' },
    },
    initial: 'loin',
  },
  pork: {
    label: 'Pork',
    silhouette: `M70 120 L44 118 C36 128 36 150 44 160 L72 162 C90 178 110 190 140 196
      C150 214 160 236 176 250 L180 332 L212 332 L214 264 C280 274 400 276 468 264 L472 332 L504 332
      L512 250 C540 240 566 214 574 184 C590 180 604 170 598 156 C594 146 584 150 588 158
      C580 160 574 158 572 150 C566 110 530 88 470 84 C380 76 260 78 200 84 C170 86 150 84 136 80
      L128 56 L108 84 C96 92 82 104 70 120 Z`,
    extras: [
      { circle: [94, 112, 3.4], cls: 'feature' },
      { ellipse: [41, 134, 2.2, 4], cls: 'feature' },
      { ellipse: [41, 146, 2.2, 4], cls: 'feature' },
    ],
    head: [[0, 0], [128, 0], [140, 200], [0, 200]],
    cuts: {
      neck:     { poly: [[128, 0], [200, 0], [196, 205], [140, 200]], at: [168, 142] },
      shoulder: { poly: [[200, 0], [290, 0], [290, 256], [150, 256], [140, 200], [196, 205]], at: [242, 170] },
      loin:     { poly: [[290, 0], [470, 0], [470, 168], [290, 168]], at: [380, 130] },
      belly:    { poly: [[290, 168], [470, 168], [470, 300], [290, 300]], at: [380, 226] },
      leg:      { poly: [[470, 0], [640, 0], [640, 290], [470, 290]], at: [530, 182] },
      hock:     { poly: [[130, 256], [290, 256], [290, 400], [130, 400]], at: [196, 364] },
      hock2:    { poly: [[440, 300], [470, 300], [470, 290], [640, 290], [640, 400], [440, 400]], at: [488, 364], ref: 'hock' },
    },
    data: {
      neck:     { name: 'Neck', body: 'Well-marbled neck steaks that stay juicy on the braai.', ask: 'Neck steaks, neck roast', cook: 'Braai, roast' },
      shoulder: { name: 'Shoulder', body: 'Low-and-slow territory: pulled pork, pot roasts and stews.', ask: 'Shoulder roast, pork cubes', cook: 'Slow roast, stew' },
      loin:     { name: 'Loin', body: 'Pork chops and back ribs come from here, along with the loin roast.', ask: 'Chops, loin ribs, loin roast', cook: 'Braai, pan, roast' },
      belly:    { name: 'Belly', body: 'Bacon, pork belly and spare ribs. The sticky, crispy stuff.', ask: 'Bacon, belly, spare ribs', cook: 'Roast, braai, smoke' },
      leg:      { name: 'Leg', body: 'Gammon and ham. Roast it fresh or glaze it for a festive table.', ask: 'Gammon, ham, leg roast', cook: 'Roast, boil, glaze' },
      hock:     { name: 'Hock & trotters', body: 'Eisbein and trotters, rich in gelatine. Slow cook for soups, stews or crackling.', ask: 'Eisbein, trotters', cook: 'Boil, slow roast' },
    },
    initial: 'belly',
  },
};

const el = (tag, attrs = {}) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};
const pts = (poly) => poly.map((p) => p.join(',')).join(' ');

export function buildChart(section) {
  const svg = section.querySelector('[data-chart]');
  const card = {
    animal: section.querySelector('[data-cut-animal]'),
    name: section.querySelector('[data-cut-name]'),
    body: section.querySelector('[data-cut-body]'),
    ask: section.querySelector('[data-cut-ask]'),
    cook: section.querySelector('[data-cut-cook]'),
  };
  const tabs = [...section.querySelectorAll('[data-animal]')];
  const groups = {};

  for (const [key, a] of Object.entries(ANIMALS)) {
    svg.querySelector(`[data-silhouette="${key}"]`).setAttribute('d', a.silhouette);
    const g = svg.querySelector(`[data-animal-group="${key}"]`);
    groups[key] = g;
    const clipped = el('g', { 'clip-path': `url(#clip-${key})` });
    clipped.appendChild(el('polygon', { points: pts(a.head), class: 'head' }));
    const labels = el('g');
    for (const [id, c] of Object.entries(a.cuts)) {
      const ref = c.ref || id;
      const info = a.data[ref];
      const cut = el('g', { class: 'cut', tabindex: c.ref ? '-1' : '0', role: 'button', 'aria-label': `${a.label} ${info.name}`, 'data-cut': ref });
      cut.appendChild(el('polygon', { points: pts(c.poly), class: 'fill' }));
      cut.appendChild(el('polygon', { points: pts(c.poly), class: 'tint' }));
      cut.appendChild(el('polygon', { points: pts(c.poly), class: 'seam' }));
      clipped.appendChild(cut);
      const t = el('text', { x: c.at[0], y: c.at[1], class: 'cut-label', 'data-label': ref });
      t.textContent = c.label || info.name;
      labels.appendChild(t);
    }
    g.appendChild(clipped);
    for (const x of a.extras) {
      if (x.d) g.appendChild(el('path', { d: x.d, class: x.cls }));
      if (x.circle) g.appendChild(el('circle', { cx: x.circle[0], cy: x.circle[1], r: x.circle[2], class: x.cls }));
      if (x.ellipse) g.appendChild(el('ellipse', { cx: x.ellipse[0], cy: x.ellipse[1], rx: x.ellipse[2], ry: x.ellipse[3], class: x.cls }));
    }
    g.appendChild(el('path', { d: a.silhouette, class: 'outline' }));
    g.appendChild(labels);
  }

  let current = 'beef';
  let selected = '';
  function select(animal, ref) {
    if (selected === animal + ref) return;
    selected = animal + ref;
    const a = ANIMALS[animal];
    const info = a.data[ref];
    const g = groups[animal];
    g.querySelectorAll('.cut').forEach((c) => c.classList.toggle('is-active', c.dataset.cut === ref));
    g.querySelectorAll('.cut-label').forEach((c) => c.classList.toggle('is-active', c.dataset.label === ref));
    card.animal.textContent = a.label;
    card.name.textContent = info.name;
    card.body.textContent = info.body;
    card.ask.textContent = info.ask;
    card.cook.textContent = info.cook;
    if (window.gsap && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.gsap.fromTo([card.name, card.body], { y: 10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.45, stagger: 0.05, ease: 'power3.out' });
    }
  }
  function show(animal) {
    current = animal;
    for (const [k, g] of Object.entries(groups)) g.style.display = k === animal ? '' : 'none';
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.animal === animal)));
    select(animal, ANIMALS[animal].initial);
  }

  svg.addEventListener('click', (e) => {
    const c = e.target.closest('.cut');
    if (c) select(current, c.dataset.cut);
  });
  svg.addEventListener('pointerover', (e) => {
    const c = e.target.closest('.cut');
    if (c && e.pointerType === 'mouse') select(current, c.dataset.cut);
  });
  svg.addEventListener('keydown', (e) => {
    const c = e.target.closest('.cut');
    if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(current, c.dataset.cut); }
  });
  tabs.forEach((t) => t.addEventListener('click', () => show(t.dataset.animal)));
  show('beef');
}
