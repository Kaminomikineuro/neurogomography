// ink.js — Chinese ink-wash toolkit on Canvas2D: rice paper, brush strokes with dry-brush bristles, washes that
// bleed with a darker rim, mountains fading into mist, mist bands, cinnabar seals, handwritten text write-on.
// Everything is a pure function of its arguments (seeded randomness only).
import { clamp, lerp, invLerp, seg, E, TAU, rng } from './mg.js';

export const C = {
  paper: '#F2EBDD', paperD: '#E4D9C3', ink: '#1C1A21', inkS: '#3B3742', grey: '#6E6A73',
  purple: '#6B3FA0', purpleD: '#46286E', purpleL: '#9A7BC8', lav: '#C8B6E2',
  blue: '#5E7FA8', blueD: '#3C5A80', blueL: '#A7BDD7', pale: '#DDE6EF',
  red: '#B8322A', pink: '#E59DA6', gold: '#E2B04B', goldL: '#F4D894', orange: '#D9822B',
  night: '#241F2E', nightD: '#17141E', skin: '#F2E8DB', silver: '#B9B7C4',
};
const _rgb = {};
export function rgba(hex, a = 1) {
  let v = _rgb[hex]; if (!v) { const n = parseInt(hex.slice(1), 16); v = _rgb[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  return `rgba(${v[0]},${v[1]},${v[2]},${clamp(a)})`;
}

// ---------- paper ----------
let _paper = null;
export function paperTexture(W = 1920, H = 1080) { // wraps horizontally so it can tile along the scroll
  if (_paper) return _paper;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
  const r = rng(11);
  for (let i = 0; i < 26; i++) { // large tonal clouds
    const x = r() * W, y = r() * H, rr = 200 + r() * 500, dark = r() < 0.5;
    for (const ox of [0, -W, W]) { const gr = g.createRadialGradient(x + ox, y, 0, x + ox, y, rr); gr.addColorStop(0, dark ? 'rgba(170,150,120,0.035)' : 'rgba(255,252,244,0.08)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x + ox - rr, y - rr, rr * 2, rr * 2); }
  }
  g.lineCap = 'round';
  for (let i = 0; i < 2600; i++) { // fibres
    const x = r() * W, y = r() * H, l = 6 + r() * 34, a = r() * TAU, bend = (r() - 0.5) * 10, dark = r() < 0.55;
    g.strokeStyle = dark ? `rgba(120,100,75,${0.05 + r() * 0.08})` : `rgba(255,255,250,${0.12 + r() * 0.2})`; g.lineWidth = 0.5 + r() * 1.1;
    for (const ox of [0, x < 60 ? W : x > W - 60 ? -W : 0]) { if (ox === 0 && x < 0) continue; g.beginPath(); g.moveTo(x + ox, y); g.quadraticCurveTo(x + ox + Math.cos(a) * l / 2 + bend, y + Math.sin(a) * l / 2 - bend, x + ox + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  }
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(90,75,60,${0.05 + r() * 0.12})`; g.fillRect(r() * W, r() * H, 1 + r() * 1.5, 1 + r() * 1.5); }
  return (_paper = c);
}

// ---------- geometry ----------
export function spline(pts, step = 4) { // Catmull-Rom through the control points
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// ---------- brush stroke ----------
// pts: control points; w: max width. o.prog 0..1 draws the stroke on; o.dry 0..1 frays the tail into bristles.
export function brush(ctx, pts, w, o = {}) {
  const { color = C.ink, alpha = 0.92, prog = 1, start = 0.12, end = 0.42, dry = 0.45, seed = 1, minW = 0.1, bleed = 0.16, step } = o;
  if (prog <= 0 || pts.length < 2) return;
  const P = spline(pts, step ?? Math.max(1, w * 0.6)), n = P.length; if (n < 2) return;
  const m = Math.max(2, Math.ceil(n * clamp(prog)));
  const N = P.map((p, i) => { const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; });
  const r = rng(seed * 7919 + 13), ph1 = r() * 6, ph2 = r() * 6;
  const prof = s => { const a = s < start ? 0.35 + 0.65 * E.out(s / start) : 1, b = s > 1 - end ? Math.pow(Math.max(0, (1 - s) / end), 0.75) : 1; return Math.max(minW, a * b) * (1 + 0.09 * Math.sin(s * 9 + ph1) + 0.05 * Math.sin(s * 25 + ph2)); };
  const poly = (off, wf, endS) => {
    const i1 = Math.min(m, Math.ceil(n * endS)); if (i1 < 2) return;
    const tp = s => Math.pow(clamp((endS - s) / 0.14), 0.7);
    ctx.beginPath();
    for (let i = 0; i < i1; i++) { const s = i / (n - 1), pw = w * prof(s), hw = pw * wf * tp(s) / 2, c = off * pw / 2; ctx.lineTo(P[i][0] + N[i][0] * (c + hw), P[i][1] + N[i][1] * (c + hw)); }
    for (let i = i1 - 1; i >= 0; i--) { const s = i / (n - 1), pw = w * prof(s), hw = pw * wf * tp(s) / 2, c = off * pw / 2; ctx.lineTo(P[i][0] + N[i][0] * (c - hw), P[i][1] + N[i][1] * (c - hw)); }
    ctx.closePath(); ctx.fill();
  };
  if (bleed > 0) { ctx.fillStyle = rgba(color, alpha * bleed); poly(0, 1.3, 1); }
  ctx.fillStyle = rgba(color, alpha * 0.85); poly(0, 0.74, 1 - dry * 0.22);
  const K = 6;
  for (let k = 0; k < K; k++) { const off = -0.78 + 1.56 * k / (K - 1), e = 1 - dry * r() * 0.5; ctx.fillStyle = rgba(color, alpha * (0.5 + 0.4 * r())); poly(off, 0.3, e); }
}
// a quick single-width line (for fine detail: windows, rigging, veins)
export function line(ctx, pts, w, color = C.ink, alpha = 0.85) {
  ctx.strokeStyle = rgba(color, alpha); ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); const P = pts.length > 2 ? spline(pts, 6) : pts; P.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
}

// ---------- washes ----------
export function wash(ctx, x, y, r, color, a, o = {}) { // bleeding wash with darker rim
  const { sx = 1, sy = 1, seed = 1, lobes = 4, rim = 0.3, rot = 0 } = o; if (a <= 0 || r <= 0) return;
  const R = rng(seed * 104729 + 7);
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sx, sy);
  for (let i = 0; i < lobes; i++) {
    const ox = (R() - 0.5) * r * 0.45, oy = (R() - 0.5) * r * 0.45, rr = r * (0.62 + 0.38 * R()), aa = a / Math.sqrt(lobes) * 1.15;
    const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, rr);
    g.addColorStop(0, rgba(color, aa * 0.55)); g.addColorStop(0.72, rgba(color, aa * 0.62)); g.addColorStop(0.92, rgba(color, aa * (0.62 + rim))); g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ox, oy, rr, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
export function glow(ctx, x, y, r, color, a, o = {}) { // soft radial light / mist puff
  if (a <= 0 || r <= 0) return; const { sx = 1, sy = 1 } = o;
  ctx.save(); ctx.translate(x, y); ctx.scale(sx, sy);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, rgba(color, a)); g.addColorStop(0.45, rgba(color, a * 0.55)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.restore();
}

// ---------- landscape ----------
export function ridge(seed, x0, x1, base, hgt, peaks = 4, step = 14) {
  const r = rng(seed * 31 + 5), P = [];
  const pk = Array.from({ length: peaks }, () => [lerp(x0, x1, r()), 0.45 + r() * 0.55, (x1 - x0) / peaks * (0.35 + r() * 0.5)]);
  for (let x = x0; x <= x1 + 1; x += step) {
    let h = 0; for (const [px, ph, pw] of pk) h = Math.max(h, ph * Math.exp(-Math.pow((x - px) / pw, 2)));
    h += 0.05 * Math.sin(x * 0.031 + seed) + 0.035 * Math.sin(x * 0.087 + seed * 3) + 0.02 * Math.sin(x * 0.21 + seed);
    P.push([x, base - hgt * Math.max(0, h)]);
  }
  return P;
}
export function mountain(ctx, P, base, color, a, o = {}) {
  const { lw = 6, la = 0.75, cun = 0.5, seed = 3, ridgeColor = color } = o;
  let top = Infinity; for (const p of P) top = Math.min(top, p[1]);
  const g = ctx.createLinearGradient(0, top, 0, base);
  g.addColorStop(0, rgba(color, a)); g.addColorStop(0.45, rgba(color, a * 0.7)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(P[0][0], base); P.forEach(p => ctx.lineTo(p[0], p[1])); ctx.lineTo(P[P.length - 1][0], base); ctx.closePath(); ctx.fill();
  if (lw > 0) { // ridge line broken into a few strokes
    const r = rng(seed); let i = 0;
    while (i < P.length - 3) { const len = 6 + Math.floor(r() * 14), seg_ = P.slice(i, Math.min(P.length, i + len)).filter((_, k) => k % 2 === 0); if (seg_.length > 1) brush(ctx, seg_, lw * (0.6 + r() * 0.6), { color: ridgeColor, alpha: la * (0.6 + 0.4 * r()), seed: seed + i, dry: 0.7, bleed: 0.1 }); i += len + Math.floor(r() * 4); }
  }
  if (cun > 0) { // texture strokes down the slopes
    const r = rng(seed + 99);
    for (let i = 2; i < P.length - 2; i += 3) { if (r() > cun) continue; const [x, y] = P[i], d = P[i + 1][1] - P[i - 1][1], l = 30 + r() * 70;
      brush(ctx, [[x, y + 4], [x + Math.sign(d || 1) * l * 0.25, y + l * 0.55], [x + Math.sign(d || 1) * l * 0.35, y + l]], lw * 0.5, { color: ridgeColor, alpha: la * 0.35, seed: seed + i * 3, dry: 0.9, bleed: 0 }); }
  }
}
export function mistBand(ctx, x0, x1, y, h, a, t = 0, seed = 1, color = C.paper) { // horizontal mist
  if (a <= 0) return;
  const g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
  g.addColorStop(0, rgba(color, 0)); g.addColorStop(0.5, rgba(color, a)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.fillRect(x0, y - h / 2, x1 - x0, h);
  const r = rng(seed); const n = Math.ceil((x1 - x0) / 220);
  for (let i = 0; i < n; i++) { const px = x0 + ((r() * (x1 - x0) + t * (8 + r() * 14)) % (x1 - x0)), py = y + (r() - 0.5) * h * 0.5; glow(ctx, px, py, h * (0.5 + r() * 0.5), color, a * 0.7, { sx: 2.4, sy: 0.6 }); }
}
export function ripples(ctx, x0, x1, y0, y1, t, seed = 2, color = C.blueD, a = 0.22) { // water: short horizontal strokes
  const r = rng(seed); ctx.lineCap = 'round';
  const n = Math.round((x1 - x0) * (y1 - y0) / 9000);
  for (let i = 0; i < n; i++) {
    const y = lerp(y0, y1, Math.pow(r(), 0.8)), depth = (y - y0) / (y1 - y0), x = x0 + r() * (x1 - x0) + Math.sin(t * 0.8 + i) * 6, l = 16 + depth * 60 * r();
    ctx.strokeStyle = rgba(color, a * (0.35 + 0.65 * depth) * (0.6 + 0.4 * Math.sin(t * 1.3 + i * 1.7))); ctx.lineWidth = 1 + depth * 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + l / 2, y - 2, x + l, y); ctx.stroke();
  }
}

// ---------- seal ----------
export function seal(ctx, x, y, s, txt, dt, o = {}) { // dt = seconds since it was stamped
  if (dt < 0) return;
  const { rot = -0.06, color = C.red, font = '"Cormorant Garamond", serif', weight = 700, fs = 0.62, alpha = 1 } = o;
  const sc = dt < 1 / 24 ? 1.22 : dt < 2 / 24 ? 0.93 : 1; // one-frame squash
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc); ctx.globalAlpha *= alpha;
  const r = rng(txt.length * 17 + Math.round(s));
  ctx.fillStyle = rgba(color, 0.92); ctx.beginPath();
  const h = s / 2, jit = () => (r() - 0.5) * s * 0.025;
  ctx.moveTo(-h + jit(), -h + jit()); for (let i = 1; i <= 4; i++) ctx.lineTo(h * (i / 4 * 2 - 1) + jit(), -h + jit());
  for (let i = 1; i <= 4; i++) ctx.lineTo(h + jit(), h * (i / 4 * 2 - 1) + jit());
  for (let i = 1; i <= 4; i++) ctx.lineTo(h * (1 - i / 4 * 2) + jit(), h + jit());
  for (let i = 1; i <= 4; i++) ctx.lineTo(-h + jit(), h * (1 - i / 4 * 2) + jit());
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = rgba(C.paper, 0.85); ctx.lineWidth = s * 0.035; ctx.strokeRect(-h * 0.84, -h * 0.84, h * 1.68, h * 1.68);
  ctx.fillStyle = rgba(C.paper, 0.95); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let size = s * fs; ctx.font = `${weight} ${size}px ${font}`; const tw = ctx.measureText(txt).width; if (tw > s * 0.78) { size *= s * 0.78 / tw; ctx.font = `${weight} ${size}px ${font}`; }
  ctx.fillText(txt, 0, s * 0.03);
  for (let i = 0; i < 40; i++) { ctx.fillStyle = rgba(C.paper, 0.25 + r() * 0.5); ctx.fillRect((r() - 0.5) * s * 0.95, (r() - 0.5) * s * 0.95, 1 + r() * s * 0.03, 1 + r() * s * 0.02); } // ink skips
  ctx.restore();
}

// ---------- handwritten text ----------
const _w = new Map();
export function textWidth(ctx, str, font) { const k = font + '|' + str; let v = _w.get(k); if (v === undefined) { ctx.font = font; v = ctx.measureText(str).width; _w.set(k, v); } return v; }
// write a line on from left to right with a soft wet edge; p 0..1
export function writeLine(ctx, str, x, y, size, font, color, p, alpha = 1, align = 'left') {
  if (p <= 0 || alpha <= 0) return;
  const w = textWidth(ctx, str, font), x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.save(); ctx.font = font; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = rgba(color, 0.35 * alpha); ctx.shadowBlur = size * 0.05;
  const head = x0 + (w + size * 0.6) * clamp(p) - size * 0.3, edge = size * 0.9;
  const band = (xa, xb, a) => { ctx.save(); ctx.beginPath(); ctx.rect(xa, y - size * 1.4, xb - xa, size * 2.2); ctx.clip(); ctx.fillStyle = rgba(color, a); ctx.fillText(str, x0, y); ctx.restore(); };
  if (p >= 1) band(x0 - size, x0 + w + size, alpha);
  else { band(x0 - size, head - edge, alpha); const K = 6; for (let k = 0; k < K; k++) band(head - edge + edge * k / K, head - edge + edge * (k + 1) / K + 0.5, alpha * (1 - (k + 0.5) / K)); }
  ctx.restore();
}
