// Вкладка «Карта»: стилизованная офлайн-карта (SVG), маршрут, тапы по городам и отрезкам.
import { h, ddmm, timeOf } from './util.js';
import { MAP } from './map-data.js';
import * as M from './model.js';
import { openCity, openSeg, segIcon } from './details.js';

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const c of kids) if (c != null) el.append(c);
  return el;
};
const COS = Math.cos((MAP.lat0 * Math.PI) / 180);
export const project = (lng, lat) => [(lng - MAP.bbox.lngMin) * COS * MAP.k, (MAP.bbox.latMax - lat) * MAP.k];

// Куда ставить подпись города: [dx, dy, anchor] в экранных пикселях
const LABEL = {
  rostock: [0, -16, 'middle'], hamburg: [-12, 4, 'end'], berlin: [12, 5, 'start'], dresden: [12, 6, 'start'],
  prague: [12, 6, 'start'], vienna: [-12, -8, 'end'], bratislava: [12, 12, 'start'], cologne: [12, 4, 'start'],
  dusseldorf: [-12, -2, 'end'], phantasialand: [-12, 12, 'end'],
};

let view = null; // {x,y,w,h}
let svgEl = null;
let rootEl = null;

function fitView(points, pad = 60) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  // слева и справа — место под подписи, сверху — под заголовок карты
  const x0 = Math.min(...xs) - pad * 1.6, x1 = Math.max(...xs) + pad * 1.4;
  const y0 = Math.min(...ys) - pad * 1.8, y1 = Math.max(...ys) + pad;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function curve(a, b, bend = 0.12) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const cx = mx - dy * bend, cy = my + dx * bend;
  // середина квадратичной кривой — место для значка
  const mid = [0.25 * a[0] + 0.5 * cx + 0.25 * b[0], 0.25 * a[1] + 0.5 * cy + 0.25 * b[1]];
  return { d: `M${a[0].toFixed(1)} ${a[1].toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`, mid };
}

function segEnds(sg, t) {
  const from = sg.fromLat != null ? project(sg.fromLng, sg.fromLat) : sg.from && t.cityById[sg.from] ? project(t.cityById[sg.from].lng, t.cityById[sg.from].lat) : null;
  const to = sg.toLat != null ? project(sg.toLng, sg.toLat) : sg.to && t.cityById[sg.to] ? project(t.cityById[sg.to].lng, t.cityById[sg.to].lat) : null;
  if (sg.stub) {
    const rad = (sg.stub.bearing * Math.PI) / 180;
    const dir = [Math.sin(rad), -Math.cos(rad)];
    const len = 130;
    if (from && !to) return [from, [from[0] + dir[0] * len, from[1] + dir[1] * len]];
    if (to && !from) return [[to[0] + dir[0] * len, to[1] + dir[1] * len], to];
  }
  return from && to ? [from, to] : null;
}

export function renderMap(root) {
  rootEl = root;
  const t = M.trip();
  const W = MAP.width, H = MAP.height;

  const svg = s('svg', { class: 'map-svg', xmlns: NS, preserveAspectRatio: 'xMidYMid meet', role: 'img', 'aria-label': 'Карта маршрута' });
  svgEl = svg;
  const defs = s('defs',
    s('radialGradient', { id: 'glow' }, s('stop', { offset: '0', 'stop-color': 'var(--gold)', 'stop-opacity': '.55' }), s('stop', { offset: '1', 'stop-color': 'var(--gold)', 'stop-opacity': '0' })),
    s('pattern', { id: 'snowdots', width: 22, height: 22, patternUnits: 'userSpaceOnUse' }, s('circle', { cx: 3, cy: 4, r: 0.9, class: 'snowdot' }), s('circle', { cx: 14, cy: 15, r: 0.7, class: 'snowdot' })));
  svg.append(defs);
  svg.append(s('rect', { x: -2000, y: -2000, width: W + 4000, height: H + 4000, class: 'sea' }));
  svg.append(s('rect', { x: -2000, y: -2000, width: W + 4000, height: H + 4000, fill: 'url(#snowdots)' }));

  const land = s('g', { class: 'land' });
  for (const c of MAP.countries) land.append(s('path', { d: c.d, class: 'country' + (c.trip ? ' trip' : '') }));
  svg.append(land);
  const rivers = s('g', { class: 'rivers' });
  for (const r of MAP.rivers) rivers.append(s('path', { d: r.d, class: 'river' }));
  svg.append(rivers);

  const labels = s('g', { class: 'geo-labels' });
  for (const c of MAP.countries) if (c.label && c.name) labels.append(s('text', { x: c.label[0], y: c.label[1], class: 'country-label' + (c.trip ? ' trip' : '') }, c.name.toUpperCase()));
  for (const sea of MAP.seas) labels.append(s('text', { x: sea.at[0], y: sea.at[1], class: 'sea-label' }, sea.name));
  svg.append(labels);

  // маршрут
  const routes = s('g', { class: 'routes' });
  const markers = s('g', { class: 'markers' });
  const pairs = new Set();
  for (const sg0 of t.segments) {
    if (sg0.hideOnMap) continue;
    const sg = M.maskSeg(sg0);
    const ends = segEnds(sg, t);
    if (!ends) continue;
    const mode = sg.chosen != null && sg.options ? sg.options[sg.chosen].mode || sg.mode : sg.mode;
    const pair = [sg.from, sg.to].sort().join('|');
    let bend = mode === 'flight' ? 0.22 : sg.daytrip ? 0.18 : 0.1;
    if (pairs.has(pair)) bend *= 2.8; // туда и обратно по одной линии — разводим дуги
    pairs.add(pair);
    const { d, mid } = curve(ends[0], ends[1], bend);
    const cls = ['route', mode, sg.daytrip && 'daytrip', sg.status === 'decide' && 'decide', sg.status === 'option' && 'option', sg.stub && 'stub'].filter(Boolean).join(' ');
    const g = s('g', { class: 'route-g', 'data-seg': sg.id });
    g.append(s('path', { d, class: 'route-hit' }));
    g.append(s('path', { d, class: cls }));
    g.addEventListener('click', () => openSeg(sg.id));
    routes.append(g);
    {
      const icon = sg.status === 'decide' && !sg.chosen && sg.options ? '❔' : segIcon({ mode });
      const len = Math.hypot(ends[1][0] - ends[0][0], ends[1][1] - ends[0][1]);
      const mk = s('g', { class: 'seg-marker' + (sg.status === 'decide' ? ' decide' : '') + (sg.stub ? ' stub' : ''), 'data-x': mid[0], 'data-y': mid[1], 'data-len': len },
        s('circle', { r: 13, class: 'seg-bubble' }), s('text', { class: 'seg-emoji', y: 5 }, icon));
      if (sg.stub) mk.append(s('text', { class: 'stub-label', y: 28 }, sg.stub.label));
      mk.addEventListener('click', () => openSeg(sg.id));
      markers.append(mk);
    }
  }
  svg.append(routes);

  const cities = s('g', { class: 'cities' });
  for (const c0 of t.cities) {
    const c = M.maskCity(c0);
    const [x, y] = project(c.lng, c.lat);
    const [dx, dy, anchor] = LABEL[c.id] || [12, 4, 'start'];
    const prio = c.kind === 'stay' ? 3 : c.kind === 'transit' ? 2 : 1;
    const g = s('g', { class: 'city ' + c.kind, 'data-x': x, 'data-y': y, 'data-city': c.id, 'data-prio': prio },
      c.kind === 'stay' ? s('circle', { r: 22, fill: 'url(#glow)', class: 'city-glow' }) : null,
      s('circle', { r: 20, class: 'city-hit' }),
      s('circle', { r: c.kind === 'stay' ? 7 : 5, class: 'city-dot' }),
      s('text', { x: dx, y: dy, 'text-anchor': anchor, class: 'city-label' }, c.name),
      c.kind === 'stay' ? s('text', { x: dx, y: dy + 14, 'text-anchor': anchor, class: 'city-sub' }, `${ddmm(c.from)}–${ddmm(c.to)}`) : s('text', { x: dx, y: dy + 13, 'text-anchor': anchor, class: 'city-sub' }, c.kind === 'daytrip' ? 'на день' : ''));
    g.addEventListener('click', () => {
      // если рядом спрятаны другие города — сначала приблизить скопление
      const hidden = (g.dataset.cluster || '').split(',').filter(Boolean);
      if (hidden.length) focus([c.id, ...hidden], 45);
      else openCity(c.id);
    });
    cities.append(g);
  }
  svg.append(markers);
  svg.append(cities);

  const routePts = t.cities.map((c) => project(c.lng, c.lat));
  const home = fitView(routePts, 60);
  if (!view) view = { ...home };

  const zoomBy = (f, cx, cy) => {
    const nw = Math.min(W * 1.3, Math.max(W / 14, view.w * f));
    const k = nw / view.w;
    const r = svg.getBoundingClientRect();
    const px = cx == null ? 0.5 : (cx - r.left) / r.width;
    const py = cy == null ? 0.5 : (cy - r.top) / r.height;
    const vb = viewBoxRect(r);
    const ux = vb.x + vb.w * px, uy = vb.y + vb.h * py;
    view = { x: ux - (ux - view.x) * k, y: uy - (uy - view.y) * k, w: view.w * k, h: view.h * k };
    apply();
  };
  function focus(ids, pad) {
    view = fitView(ids.map((id) => t.cityById[id]).filter(Boolean).map((c) => project(c.lng, c.lat)), pad);
    apply();
  }

  const controls = h('div.map-controls',
    h('button.map-btn', { onclick: () => zoomBy(0.66), 'aria-label': 'Приблизить' }, '+'),
    h('button.map-btn', { onclick: () => zoomBy(1.5), 'aria-label': 'Отдалить' }, '−'),
    h('button.map-btn', { onclick: () => { view = { ...home }; apply(); }, 'aria-label': 'Весь маршрут' }, '⤢'));
  const legend = h('div.map-legend',
    h('span', h('i.lg.train'), 'поезд'), h('span', h('i.lg.nighttrain'), 'ночной'), h('span', h('i.lg.flight'), 'самолёт'), h('span', h('i.lg.daytrip'), 'на день / решаем'));
  const chips = h('div.map-chips',
    t.cities.filter((c) => c.kind === 'stay').map((c) => h('button.map-chip', { onclick: () => openCity(c.id) }, h('b', c.name), h('small', `${ddmm(c.from)}–${ddmm(c.to)}`))),
    h('button.map-chip.ghost', { onclick: () => focus(['cologne', 'dusseldorf', 'phantasialand'], 40) }, h('b', '🔍 Рейнланд'), h('small', 'Кёльн · Брюль')),
    h('button.map-chip.ghost', { onclick: () => focus(['vienna', 'bratislava'], 50) }, h('b', '🔍 Дунай'), h('small', 'Вена · Братислава')));

  const box = h('div.map-box', svg, controls, h('div.map-cartouche', h('div.carto-title', 'Наш зимний маршрут'), h('div.carto-sub', '18.12.2026 — 06.01.2027')), legend);
  root.replaceChildren(box, chips);

  // --- жесты: перетаскивание и щипок ---
  const pts = new Map();
  let start = null;
  let moved = false;
  svg.addEventListener('pointerdown', (e) => {
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    start = { view: { ...view }, pts: new Map(pts) };
    if (pts.size === 1) moved = false;
  });
  svg.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    const r = svg.getBoundingClientRect();
    const vb = viewBoxRect(r);
    const upp = vb.w / r.width; // единиц на пиксель
    if (pts.size === 1 && start.pts.size === 1) {
      const [x0, y0] = [...start.pts.values()][0];
      const dx = e.clientX - x0, dy = e.clientY - y0;
      if (!moved && Math.abs(dx) + Math.abs(dy) > 6) {
        moved = true;
        // захват — только когда начали тянуть, иначе тап не дойдёт до города/отрезка
        try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ок */ }
      }
      if (moved) {
        view = { ...start.view, x: start.view.x - dx * upp, y: start.view.y - dy * upp };
        apply();
      }
    } else if (pts.size === 2 && start.pts.size === 2) {
      moved = true;
      const [a0, b0] = [...start.pts.values()];
      const [a1, b1] = [...pts.values()];
      const d0 = Math.hypot(a0[0] - b0[0], a0[1] - b0[1]);
      const d1 = Math.hypot(a1[0] - b1[0], a1[1] - b1[1]);
      const k = Math.min(Math.max(d0 / d1, 0.05), 20);
      const nw = Math.min(W * 1.3, Math.max(W / 14, start.view.w * k));
      const kk = nw / start.view.w;
      const m0 = [(a0[0] + b0[0]) / 2, (a0[1] + b0[1]) / 2];
      const m1 = [(a1[0] + b1[0]) / 2, (a1[1] + b1[1]) / 2];
      const vb0 = viewBoxRect(r, start.view);
      const upp0 = vb0.w / r.width;
      const ux = vb0.x + (m0[0] - r.left) * upp0, uy = vb0.y + (m0[1] - r.top) * upp0;
      const sx = start.view.x + (ux - start.view.x) * (1 - kk), sy = start.view.y + (uy - start.view.y) * (1 - kk);
      view = { x: sx - (m1[0] - m0[0]) * upp0 * kk, y: sy - (m1[1] - m0[1]) * upp0 * kk, w: start.view.w * kk, h: start.view.h * kk };
      apply();
    }
  });
  const end = (e) => {
    pts.delete(e.pointerId);
    start = { view: { ...view }, pts: new Map(pts) };
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('click', (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
  svg.addEventListener('wheel', (e) => { e.preventDefault(); zoomBy(e.deltaY > 0 ? 1.15 : 0.87, e.clientX, e.clientY); }, { passive: false });
  svg.addEventListener('dblclick', (e) => zoomBy(0.5, e.clientX, e.clientY));

  requestAnimationFrame(apply);
  addEventListener('resize', apply);
}

/** Фактический прямоугольник в единицах карты (с учётом xMidYMid meet). */
function viewBoxRect(r, v = view) {
  const ar = r.width / r.height;
  const var_ = v.w / v.h;
  if (ar > var_) {
    const w = v.h * ar;
    return { x: v.x - (w - v.w) / 2, y: v.y, w, h: v.h };
  }
  const hh = v.w / ar;
  return { x: v.x, y: v.y - (hh - v.h) / 2, w: v.w, h: hh };
}

function apply() {
  if (!svgEl || !view) return;
  svgEl.setAttribute('viewBox', `${view.x.toFixed(1)} ${view.y.toFixed(1)} ${view.w.toFixed(1)} ${view.h.toFixed(1)}`);
  const r = svgEl.getBoundingClientRect();
  if (!r.width) return;
  const upp = viewBoxRect(r).w / r.width;
  // значки и подписи — постоянного экранного размера
  for (const g of svgEl.querySelectorAll('[data-x]')) g.setAttribute('transform', `translate(${g.dataset.x} ${g.dataset.y}) scale(${upp.toFixed(4)})`);
  declutter(upp);
  svgEl.querySelector('.geo-labels').style.fontSize = (12 * upp).toFixed(2) + 'px';
  const zoomedIn = upp < 0.45;
  svgEl.classList.toggle('zoomed', zoomedIn);
}
export const refreshMapLayout = apply;

/** Прячем то, что на текущем масштабе слипается: мелкие города у крупных, значки коротких отрезков. */
function declutter(upp) {
  const shown = [];
  const cities = [...svgEl.querySelectorAll('.city')].sort((a, b) => b.dataset.prio - a.dataset.prio);
  for (const g of cities) {
    const x = g.dataset.x / upp, y = g.dataset.y / upp;
    const near = shown.find((o) => Math.hypot(o.x - x, o.y - y) < 34);
    g.style.display = near ? 'none' : '';
    if (near) near.hidden.push(g.dataset.city);
    else shown.push({ x, y, g, hidden: [] });
  }
  for (const o of shown) {
    o.g.dataset.cluster = o.hidden.join(',');
    const sub = o.g.querySelector('.city-more');
    if (sub) sub.remove();
    if (o.hidden.length) {
      const label = o.g.querySelector('.city-label');
      const more = document.createElementNS(NS, 'text');
      more.setAttribute('class', 'city-more');
      more.setAttribute('x', label.getAttribute('x'));
      more.setAttribute('y', +label.getAttribute('y') + 28);
      more.setAttribute('text-anchor', label.getAttribute('text-anchor'));
      more.textContent = `＋ ещё ${o.hidden.length} · приблизить`;
      o.g.append(more);
    }
  }
  const placed = [];
  for (const m of svgEl.querySelectorAll('.seg-marker')) {
    const x = m.dataset.x / upp, y = m.dataset.y / upp;
    const short = !m.classList.contains('stub') && m.dataset.len / upp < 70;
    const clash = shown.some((o) => Math.hypot(o.x - x, o.y - y) < 24) || placed.some((p) => Math.hypot(p.x - x, p.y - y) < 28);
    const hide = short || clash;
    m.style.display = hide ? 'none' : '';
    if (!hide) placed.push({ x, y });
  }
}
