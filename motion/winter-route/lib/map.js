// The illustrated map: a cream paper sheet on the night sky, countries, rivers, the golden dashed route and the heart.
import { MAP } from './map-data.js';
import { rng, lerp, clamp, TAU, E, seg } from './mg.js';
import { C, SERIF, SANS, glow, stars, sparkle } from './draw.js';

const COS = Math.cos((MAP.lat0 * Math.PI) / 180);
export const proj = (lng, lat) => [(lng - MAP.bbox.lngMin) * COS * MAP.k, (MAP.bbox.latMax - lat) * MAP.k];
export const CITY = {
  rostock: { p: proj(12.10, 54.09), name: 'Росток' },
  berlin: { p: proj(13.40, 52.52), name: 'Берлин' },
  dresden: { p: proj(13.74, 51.05), name: 'Дрезден' },
  prague: { p: proj(14.42, 50.08), name: 'Прага' },
  vienna: { p: proj(16.37, 48.21), name: 'Вена' },
  bratislava: { p: proj(17.11, 48.15), name: 'Братислава' },
  cologne: { p: proj(6.96, 50.94), name: 'Кёльн' },
  phantasia: { p: proj(6.88, 50.80), name: 'Фантазиаленд' },
};
export const ORDER = ['rostock', 'berlin', 'dresden', 'prague', 'vienna', 'bratislava', 'cologne', 'phantasia'];
const BEND = [0.18, -0.16, 0.2, -0.14, 0.35, -0.32, 0.6]; // bow of each leg (fraction of its length); the night train arcs north

// ---- the route as one sampled polyline in map units ----
const ROUTE = (() => {
  const pts = [], cum = [0], at = { rostock: 0 };
  for (let i = 0; i < ORDER.length - 1; i++) {
    const a = CITY[ORDER[i]].p, b = CITY[ORDER[i + 1]].p, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, cx = mx - dy / L * L * BEND[i], cy = my + dx / L * L * BEND[i];
    const n = Math.max(12, Math.round(L / 4));
    for (let k = i === 0 ? 0 : 1; k <= n; k++) {
      const u = k / n, x = (1 - u) ** 2 * a[0] + 2 * u * (1 - u) * cx + u * u * b[0], y = (1 - u) ** 2 * a[1] + 2 * u * (1 - u) * cy + u * u * b[1];
      if (pts.length) cum.push(cum[cum.length - 1] + Math.hypot(x - pts[pts.length - 1][0], y - pts[pts.length - 1][1]));
      pts.push([x, y]);
    }
    at[ORDER[i + 1]] = cum[cum.length - 1];
  }
  return { pts, cum, at, total: cum[cum.length - 1] };
})();
export const routeAt = ROUTE.at; // map-unit distance of each city along the route

function pointAt(d) {
  const { pts, cum } = ROUTE; d = clamp(d, 0, ROUTE.total);
  let lo = 0, hi = cum.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] < d) lo = m; else hi = m; }
  const u = (d - cum[lo]) / Math.max(1e-6, cum[hi] - cum[lo]); return [lerp(pts[lo][0], pts[hi][0], u), lerp(pts[lo][1], pts[hi][1], u)];
}

// ---- heart (map units), starting at the point nearest the last stop ----
const HEART = (() => {
  const cx = 470, cy = 455, k = 21.5, raw = [];
  for (let i = 0; i <= 360; i++) { const a = (i / 360) * TAU; raw.push([cx + k * 16 * Math.sin(a) ** 3, cy - k * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a))]); }
  const end = CITY.phantasia.p; let best = 0, bd = 1e9; raw.forEach((p, i) => { const d = Math.hypot(p[0] - end[0], p[1] - end[1]); if (d < bd) { bd = d; best = i; } });
  const pts = [end, ...raw.slice(best), ...raw.slice(1, best + 1), end];
  return pts;
})();

// ---- deckle-edged sheet ----
const SHEET = (() => {
  const r = rng(21), x0 = -34, y0 = -34, x1 = MAP.width + 34, y1 = MAP.height + 34, pts = [];
  const edge = (ax, ay, bx, by, n) => { for (let i = 0; i < n; i++) { const u = i / n; pts.push([lerp(ax, bx, u) + (ay === by ? 0 : (r() - 0.5) * 7), lerp(ay, by, u) + (ax === bx ? 0 : (r() - 0.5) * 7)]); } };
  edge(x0, y0, x1, y0, 60); edge(x1, y0, x1, y1, 56); edge(x1, y1, x0, y1, 60); edge(x0, y1, x0, y0, 56);
  return pts;
})();
const COUNTRY_PATHS = MAP.countries.map(c => ({ ...c, path: new Path2D(c.d) }));
const RIVER_PATHS = MAP.rivers.map(r => ({ ...r, path: new Path2D(r.d) }));

// layout of the map in a frame of W×H; cam = { x, y, z } (map units, zoom)
export function mapView(W, H, cam) {
  const portrait = H > W;
  const B = portrait ? (W * 0.94) / MAP.width : (H * 0.84) / MAP.height;
  const cx = portrait ? W / 2 : W * 0.645, cy = portrait ? H * 0.47 : H * 0.5;
  const S = B * cam.z;
  return { S, toScreen: (x, y) => [(x - cam.x) * S + cx, (y - cam.y) * S + cy], apply: (ctx) => ctx.setTransform(S, 0, 0, S, cx - cam.x * S, cy - cam.y * S) };
}
export const MAP_CENTER = { x: MAP.width / 2, y: MAP.height / 2 };

export function drawMap(ctx, W, H, t, cam, o = {}) {
  const v = mapView(W, H, cam), dark = o.dark || 0;
  // night sky behind the sheet
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, C.night); g.addColorStop(1, C.night2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  stars(ctx, 0, 0, W, H, t, 160, 4, 0.9);
  // sheet
  v.apply(ctx);
  ctx.save(); ctx.translate(10, 14); ctx.fillStyle = 'rgba(6,5,15,0.45)'; sheetPath(ctx); ctx.fill(); ctx.restore();
  sheetPath(ctx); ctx.fillStyle = '#DCD5E9'; ctx.fill();
  ctx.save(); sheetPath(ctx); ctx.clip();
  const lw = 1 / v.S;
  // graticule
  ctx.strokeStyle = 'rgba(107,63,160,0.13)'; ctx.lineWidth = 1.2 * lw; ctx.setLineDash([5 * lw, 6 * lw]);
  for (let lng = 5; lng <= 19; lng++) { const [x] = proj(lng, 50); ctx.beginPath(); ctx.moveTo(x, -40); ctx.lineTo(x, MAP.height + 40); ctx.stroke(); }
  for (let lat = 47; lat <= 55; lat++) { const [, y] = proj(10, lat); ctx.beginPath(); ctx.moveTo(-40, y); ctx.lineTo(MAP.width + 40, y); ctx.stroke(); }
  ctx.setLineDash([]);
  for (const c of COUNTRY_PATHS) { ctx.fillStyle = c.trip ? C.cream : '#E8DFCF'; ctx.fill(c.path); }
  ctx.strokeStyle = 'rgba(107,63,160,0.42)'; ctx.lineWidth = 1.5 * lw; for (const c of COUNTRY_PATHS) ctx.stroke(c.path);
  ctx.strokeStyle = 'rgba(120,104,190,0.75)'; ctx.lineWidth = 2.1 * lw; ctx.lineCap = 'round'; for (const r of RIVER_PATHS) ctx.stroke(r.path);
  // country & sea labels (map units, they scale with the map)
  ctx.textAlign = 'center';
  for (const c of COUNTRY_PATHS) if (c.label && c.name && !c.hideLabel) { ctx.fillStyle = c.trip ? 'rgba(107,63,160,0.55)' : 'rgba(107,63,160,0.32)'; ctx.font = `600 18px ${SERIF}`; ctx.letterSpacing = '4px'; ctx.fillText(c.name.toUpperCase(), c.label[0], c.label[1]); }
  ctx.letterSpacing = '1px'; ctx.font = `italic 500 17px ${SERIF}`; ctx.fillStyle = 'rgba(80,60,140,0.55)';
  for (const s of MAP.seas) ctx.fillText(s.name, s.at[0], s.at[1]);
  compass(ctx, 820, 120, 34);
  // night
  if (dark > 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(23,20,43,${0.8 * dark})`; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // the route
  const d = o.routeD ?? 0;
  if (d > 0) drawRoute(ctx, v, d, t, o.routeGlow || 0, dark);
  // city markers & labels (screen space, constant size)
  const portrait = H > W, fs = portrait ? 30 : 24;
  for (const id of ORDER) {
    const reached = d >= routeAt[id] - 0.5 || id === 'rostock' && (o.showStart || d > 0);
    if (!reached) continue;
    const [x, y] = v.toScreen(...CITY[id].p), pop = clamp((d - routeAt[id]) / 25 + (id === 'rostock' && o.showStart ? 1 : 0), 0, 1), pr = E.back(pop);
    glow(ctx, x, y, 34 * pr, '230,184,92', 0.8);
    ctx.fillStyle = C.gold; ctx.beginPath(); ctx.arc(x, y, 7 * pr, 0, TAU); ctx.fill();
    ctx.strokeStyle = C.night; ctx.lineWidth = 2.5; ctx.stroke();
    if ((o.labels ?? 1) > 0 && cam.z < 3.2 && id !== 'phantasia') {
      const la = (o.labels ?? 1) * clamp(1 - (cam.z - 2.4) / 0.8, 0, 1) * pop;
      const right = !['cologne'].includes(id), dy = id === 'bratislava' ? 26 : id === 'vienna' ? -12 : 8;
      ctx.save(); ctx.globalAlpha = la; ctx.font = `600 ${fs}px ${SERIF}`; ctx.textAlign = right ? 'left' : 'right';
      ctx.lineWidth = 6; ctx.strokeStyle = dark > 0.3 ? 'rgba(23,20,43,0.9)' : 'rgba(246,241,231,0.9)'; ctx.strokeText(CITY[id].name, x + (right ? 14 : -14), y + dy);
      ctx.fillStyle = dark > 0.3 ? C.cream : C.night; ctx.fillText(CITY[id].name, x + (right ? 14 : -14), y + dy); ctx.restore();
    }
  }
  // the heart
  if (o.heart > 0) drawHeart(ctx, v, o.heart, t);
  return v;
}

function sheetPath(ctx) { ctx.beginPath(); SHEET.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); }

function compass(ctx, x, y, r) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = 'rgba(107,63,160,0.5)'; ctx.strokeStyle = 'rgba(107,63,160,0.5)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, TAU); ctx.stroke();
  for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.14, 0); ctx.lineTo(-r * 0.14, 0); ctx.closePath(); ctx.fillStyle = i === 3 ? 'rgba(230,184,92,0.85)' : 'rgba(107,63,160,0.45)'; ctx.fill(); }
  ctx.font = `600 13px ${SERIF}`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(107,63,160,0.7)'; ctx.fillText('N', 0, -r - 5);
  ctx.restore();
}

export function drawRoute(ctx, v, d, t, glowAmt = 0, dark = 0) {
  const { pts, cum } = ROUTE; const sp = []; let i = 0;
  for (; i < pts.length && cum[i] <= d; i++) sp.push(v.toScreen(pts[i][0], pts[i][1]));
  const head = v.toScreen(...pointAt(d)); sp.push(head);
  const scale = Math.max(ctx.canvas.width, ctx.canvas.height) / 1920;
  const path = () => { ctx.beginPath(); sp.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); };
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (glowAmt > 0) { for (const [w, a] of [[26, 0.12], [14, 0.22], [7, 0.45]]) { path(); ctx.strokeStyle = `rgba(255,214,140,${a * glowAmt})`; ctx.lineWidth = w * scale; ctx.stroke(); } }
  path(); ctx.strokeStyle = dark > 0.3 ? 'rgba(15,13,30,0.6)' : 'rgba(23,20,43,0.35)'; ctx.lineWidth = 7 * scale; ctx.setLineDash([16 * scale, 11 * scale]); ctx.lineDashOffset = -t * 22 * scale; ctx.stroke();
  path(); ctx.strokeStyle = C.gold; ctx.lineWidth = 4.2 * scale; ctx.stroke();
  ctx.setLineDash([]);
  glow(ctx, head[0], head[1], 28 * scale, '255,226,163', 0.95); ctx.fillStyle = C.goldHi; ctx.beginPath(); ctx.arc(head[0], head[1], 5 * scale, 0, TAU); ctx.fill();
  ctx.restore();
  return head;
}

function drawHeart(ctx, v, p, t) {
  const n = HEART.length, upto = Math.max(1, Math.floor(p * (n - 1))), scale = Math.max(ctx.canvas.width, ctx.canvas.height) / 1920;
  const sp = HEART.slice(0, upto + 1).map(q => v.toScreen(q[0], q[1]));
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [w, a] of [[22, 0.1], [11, 0.2]]) { ctx.beginPath(); sp.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.strokeStyle = `rgba(255,214,140,${a})`; ctx.lineWidth = w * scale; ctx.stroke(); }
  ctx.beginPath(); sp.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.setLineDash([16 * scale, 11 * scale]); ctx.lineDashOffset = -t * 22 * scale; ctx.strokeStyle = C.gold; ctx.lineWidth = 4.6 * scale; ctx.stroke(); ctx.setLineDash([]);
  const h = sp[sp.length - 1]; if (p < 1) { glow(ctx, h[0], h[1], 30 * scale, '255,226,163', 1); } else { const k = Math.min(1, (p - 1)); }
  ctx.restore();
  if (p >= 0.999) { // closing sparkles along the heart
    for (let i = 0; i < 14; i++) { const q = HEART[Math.floor(i / 14 * (n - 1))], [x, y] = v.toScreen(q[0], q[1]); sparkle(ctx, x, y, (8 + 6 * Math.sin(t * 3 + i)) * scale, 0.6 + 0.4 * Math.sin(t * 2 + i * 1.7)); }
  }
}
