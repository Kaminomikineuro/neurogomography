// Risograph print vocabulary: spot inks that overprint (multiply), plates that drift out of register every 3 frames,
// halftone screens, knocked-out paper lights, grain. Everything is a pure function of time.
import { hash, rng, TAU, clamp, lerp, E } from './mg.js';

export const INK = { k: '#2B2729', r: '#E0362E', v: '#765BA7', b: '#2F6DB5', y: '#F7D33A', paper: '#F4EDE0', pink: '#F49BA0' };
const IDX = { k: 0, r: 1, v: 2, b: 3, y: 4 };
export const STEP = 12;                      // elements animate on twos (12 fps), the camera stays smooth
export const q = (t) => Math.floor(t * STEP + 1e-6) / STEP;

// misregistration offset of an ink plate (scene units), new every 1/8 s
export function reg(t, ink, amp = 2.6) {
  const k = Math.floor(t * 8), i = IDX[ink] ?? 0;
  return [(hash(k * 5 + i, 31) - 0.5) * 2 * amp + (i - 2) * 0.8, (hash(k * 7 + i, 37) - 0.5) * 2 * amp];
}
// print one ink plate: everything drawn in fn() is in that ink, multiplied onto what is below
export function plate(ctx, t, ink, fn, { alpha = 1, amp = 2.6 } = {}) {
  ctx.save(); const [dx, dy] = reg(t, ink, amp); ctx.translate(dx, dy);
  ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha *= alpha; ctx.fillStyle = ctx.strokeStyle = INK[ink] || ink;
  fn(); ctx.restore();
}
// knock out to bare paper (lights, snow, windows), then optionally print yellow into the hole
export function paperHole(ctx, fn) { ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = ctx.strokeStyle = INK.paper; fn(); ctx.restore(); }
export function light(ctx, t, x, y, r, ink = 'y', tw = 1) {
  paperHole(ctx, () => { ctx.beginPath(); ctx.arc(x, y, r * 1.25, 0, TAU); ctx.fill(); });
  plate(ctx, t, ink, () => { ctx.beginPath(); ctx.arc(x, y, r * tw, 0, TAU); ctx.fill(); });
}

// halftone dot screens as patterns (cached per ink/size)
const pats = new Map();
export function screen(ctx, ink, cell = 9, dot = 0.38, angle = 0.26) {
  const key = ink + cell + dot + angle; if (pats.has(key)) return pats.get(key);
  const c = document.createElement('canvas'); c.width = c.height = cell; const g = c.getContext('2d');
  g.fillStyle = INK[ink] || ink; g.beginPath(); g.arc(cell / 2, cell / 2, cell * dot, 0, TAU); g.fill();
  const p = ctx.createPattern(c, 'repeat'); p.setTransform(new DOMMatrix().rotate(angle * 57.3)); pats.set(key, p); return p;
}
// a halftone gradient band: dots that grow from 0 to max across [y0, y1]
export function htGradient(ctx, t, ink, x0, y0, x1, y1, max = 0.45, cell = 12) {
  plate(ctx, t, ink, () => {
    for (let y = y0; y < y1; y += cell) { const k = (y - y0) / (y1 - y0), r = cell * max * k; if (r < 0.4) continue;
      for (let x = x0 + ((y / cell) % 2) * cell / 2; x < x1; x += cell) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); } }
  });
}

// grain + ink speckle overlay (screen space)
let speck = null;
export function speckle(ctx, W, H, t, a = 1) {
  if (!speck) {
    speck = document.createElement('canvas'); speck.width = speck.height = 512; const g = speck.getContext('2d'), r = rng(91);
    for (let i = 0; i < 2600; i++) { g.fillStyle = r() < 0.75 ? 'rgba(43,39,41,0.35)' : r() < 0.5 ? 'rgba(224,54,46,0.3)' : 'rgba(47,109,181,0.3)'; g.fillRect(r() * 512, r() * 512, r() < 0.9 ? 1.4 : 2.6, r() < 0.9 ? 1.4 : 2.2); }
  }
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = a;
  const ox = -Math.floor(hash(Math.floor(t * 8), 5) * 512), oy = -Math.floor(hash(Math.floor(t * 8), 6) * 512);
  for (let x = ox; x < W; x += 512) for (let y = oy; y < H; y += 512) ctx.drawImage(speck, x, y);
  ctx.restore();
}

// stepped snow knocked out of the ink (inside illustrations)
const flk = (() => { const r = rng(17); return Array.from({ length: 70 }, () => ({ x: r(), y: r(), s: 2.5 + r() * 5, f: 0.5 + r(), p: r() * TAU })); })();
export function snowPaper(ctx, t, x0, y0, w, h, { wind = 0, a = 1, n = 70 } = {}) {
  const tq = q(t); ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = INK.paper;
  for (let i = 0; i < n; i++) { const f = flk[i % flk.length]; const y = y0 + ((f.y * h + tq * 60 * f.f) % h), x = x0 + ((((f.x * w + Math.sin(tq * f.f + f.p) * 18 + tq * wind * 120) % w) + w) % w);
    ctx.beginPath(); ctx.arc(x, y, f.s, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// a rubber stamp: ink ring + text, slams in with squash
export function stamp(ctx, t, t0, x, y, r, txt, { ink = 'r', font = 'Rubik', size = null, rot = -0.18 } = {}) {
  const k = t - t0; if (k < 0) return;
  const s = k < 0.08 ? lerp(1.6, 0.92, k / 0.08) : k < 0.16 ? lerp(0.92, 1, (k - 0.08) / 0.08) : 1;
  plate(ctx, t, ink, () => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    ctx.lineWidth = r * 0.07; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); ctx.lineWidth = r * 0.025; ctx.beginPath(); ctx.arc(0, 0, r * 0.84, 0, TAU); ctx.stroke();
    ctx.font = `600 ${size || r * 1.15}px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, 0, r * 0.06);
    ctx.restore();
  });
}
