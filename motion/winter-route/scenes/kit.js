// Shared scene vocabulary: keyframes, walking, the hero pair, landmarks.
import { E, clamp, lerp, invLerp, seg, rng, hash, TAU, spring } from '../lib/mg.js';
import { C, glow, lights, house, hut, sky, stars, snowGround, moon, sparkle } from '../lib/draw.js';
import { drawChibi, umbrella, blinkAt } from '../lib/chars.js';

export const GY = 1310; // feet line in scene units
export const HH = 380;  // hero height in scene units

// piecewise keyframes [[t, v], …] with an ease per segment (default E.inOut)
export function key(t, ks, ease = E.inOut) {
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) if (t <= ks[i][0]) { const [t0, v0] = ks[i - 1], [t1, v1] = ks[i]; const e = ks[i][2] || ease; return lerp(v0, v1, e(invLerp(t0, t1, t))); }
  return ks[ks.length - 1][1];
}
export const cue = (t, ks) => { let v = ks[0][1]; for (const [tt, vv] of ks) if (t >= tt) v = vv; return v; };
// walk from x0 to x1 between t0 and t1: position with soft start/stop, stride-locked phase
export function walk(t, t0, t1, x0, x1, stride = 120) {
  const p = clamp((t - t0) / (t1 - t0), 0, 1), e = E.inOut(p), x = lerp(x0, x1, e);
  const amt = clamp(Math.min(t - t0, t1 - t) / 0.25, 0, 1) * (t > t0 && t < t1 ? 1 : 0);
  return { x, walk: amt, phase: Math.abs(x - x0) / stride, dir: Math.sign(x1 - x0) };
}

// draw both heroes; P* are partial poses; returns hand positions in device space
export function pair(ctx, t, A, B) {
  const base = { y: GY, h: HH, t };
  const order = (A.depth ?? 0) <= (B.depth ?? 0) ? [A, B] : [B, A];
  const out = {};
  for (const p of order) out[p.who] = drawChibi(ctx, { ...base, blink: blinkAt(t, p.who === 'xc' ? 3 : 7), ...p });
  return out;
}
// umbrella held by XC over both (device space)
export function holdUmbrella(ctx, t, hands, cx, cy, r, tilt = 0) {
  ctx.save(); const m = ctx.getTransform(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  const top = { x: m.a * cx + m.e, y: m.d * cy + m.f };
  umbrella(ctx, hands.xc.handR, top, r * m.a, t, tilt); ctx.restore();
}

// ---------- landmarks ----------
export function ferris(ctx, cx, cy, R, rot, t, { n = 16, rim = '#3B2F6E', cab = [C.gold, C.purple, C.cream], boxy = false, base = GY - 100 } = {}) {
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = '#2A2350'; ctx.lineWidth = 16;
  ctx.beginPath(); ctx.moveTo(cx - R * 0.62, base); ctx.lineTo(cx, cy); ctx.lineTo(cx + R * 0.62, base); ctx.stroke();
  ctx.strokeStyle = rim; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
  ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, R * 0.86, 0, TAU); ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(59,47,110,0.9)';
  for (let i = 0; i < n; i++) { const a = rot + i * TAU / n; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke(); }
  for (let i = 0; i < n * 3; i++) { const a = rot + i * TAU / (n * 3), tw = 0.7 + 0.3 * Math.sin(t * 3 + i); glow(ctx, cx + Math.cos(a) * R, cy + Math.sin(a) * R, 18 * tw, '255,214,140', 0.8); }
  glow(ctx, cx, cy, 60, '255,214,140', 0.7); ctx.fillStyle = C.gold; ctx.beginPath(); ctx.arc(cx, cy, 16, 0, TAU); ctx.fill();
  for (let i = 0; i < n; i++) {
    const a = rot + i * TAU / n, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R, col = cab[i % cab.length], sw = Math.sin(t * 1.4 + i) * 0.05;
    ctx.save(); ctx.translate(x, y); ctx.rotate(sw);
    ctx.strokeStyle = '#2A2350'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 14); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); boxy ? ctx.roundRect(-20, 12, 40, 34, 5) : ctx.roundRect(-17, 12, 34, 30, 12); ctx.fill();
    ctx.fillStyle = 'rgba(255,226,163,0.9)'; ctx.fillRect(boxy ? -14 : -11, 18, boxy ? 28 : 22, 10); ctx.restore();
  }
  ctx.restore();
}
export function water(ctx, x0, x1, y0, y1, t, { c1 = '#231E45', c2 = '#15122B', glints = [] } = {}) {
  const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, c1); g.addColorStop(1, c2); ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  for (const [gx, rgb, w] of glints) for (let i = 0; i < 9; i++) {
    const yy = y0 + 12 + i * (y1 - y0 - 20) / 9, ww = w * (1 - i / 12) * (0.7 + 0.3 * Math.sin(t * 2 + i * 1.7 + gx)), xo = Math.sin(t * 1.3 + i * 2 + gx) * 10;
    ctx.fillStyle = `rgba(${rgb},${0.55 - i * 0.045})`; ctx.fillRect(gx - ww / 2 + xo, yy, ww, 4);
  }
}
export function lamp(ctx, x, base, h, t, seed = 1) {
  ctx.fillStyle = '#1E1938'; ctx.fillRect(x - 5, base - h, 10, h); ctx.fillRect(x - 14, base - 8, 28, 8);
  ctx.beginPath(); ctx.moveTo(x - 16, base - h - 34); ctx.lineTo(x + 16, base - h - 34); ctx.lineTo(x + 11, base - h); ctx.lineTo(x - 11, base - h); ctx.closePath(); ctx.fillStyle = C.warm; ctx.fill();
  ctx.fillStyle = '#1E1938'; ctx.beginPath(); ctx.moveTo(x - 20, base - h - 34); ctx.lineTo(x, base - h - 52); ctx.lineTo(x + 20, base - h - 34); ctx.closePath(); ctx.fill();
  const fl = 0.85 + 0.15 * Math.sin(t * 7 + seed * 3) * Math.sin(t * 3.1 + seed);
  glow(ctx, x, base - h - 17, 140 * fl, '255,210,127', 0.55);
}
export function candle(ctx, x, base, h, t, seed = 1, w = 14) {
  ctx.fillStyle = C.cream; ctx.fillRect(x - w / 2, base - h, w, h); ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x + w * 0.15, base - h, w * 0.35, h);
  const fl = Math.sin(t * 11 + seed * 5) * 0.12 + Math.sin(t * 7.3 + seed) * 0.08, fh = w * 1.4 * (1 + fl);
  glow(ctx, x, base - h - fh * 0.6, w * 9, '255,190,110', 0.6 + fl);
  ctx.fillStyle = C.goldHi; ctx.beginPath(); ctx.moveTo(x, base - h - fh * 1.3); ctx.quadraticCurveTo(x + w * 0.55, base - h - fh * 0.3, x, base - h); ctx.quadraticCurveTo(x - w * 0.55, base - h - fh * 0.3, x, base - h - fh * 1.3); ctx.fill();
}
export function tree(ctx, x, base, h, t, seed = 2) {
  const w = h * 0.55; ctx.fillStyle = '#2B2B52';
  for (let i = 0; i < 4; i++) { const y = base - h * (0.18 + i * 0.22), ww = w * (1 - i * 0.2); ctx.beginPath(); ctx.moveTo(x - ww / 2, y + h * 0.2); ctx.lineTo(x, y - h * 0.24); ctx.lineTo(x + ww / 2, y + h * 0.2); ctx.closePath(); ctx.fill(); ctx.fillStyle = C.cream; ctx.beginPath(); ctx.moveTo(x - ww * 0.18, y - h * 0.12); ctx.lineTo(x, y - h * 0.24); ctx.lineTo(x + ww * 0.18, y - h * 0.12); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#2B2B52'; }
  ctx.fillStyle = '#3B2A22'; ctx.fillRect(x - h * 0.04, base - h * 0.02, h * 0.08, h * 0.06);
  const r = rng(seed); for (let i = 0; i < 46; i++) { const u = r(), yy = base - h * 0.1 - u * h * 0.78, half = (w / 2) * (1 - u) * 0.85, xx = x + (r() * 2 - 1) * half, tw = 0.6 + 0.4 * Math.sin(t * 2.5 + i * 1.7); glow(ctx, xx, yy, 18 * tw, i % 3 ? '255,214,140' : '200,170,255', 0.9); }
  glow(ctx, x, base - h * 1.02, 70, '255,226,163', 0.9); sparkle(ctx, x, base - h * 1.02, 26 + 4 * Math.sin(t * 3), 1);
}
export function puffs(ctx, t, t0, x, y, n = 10, seed = 4, col = '246,241,231') { // small powder / snow puff
  const k = t - t0; if (k < 0 || k > 1.2) return; const r = rng(seed);
  for (let i = 0; i < n; i++) { const a = r() * TAU, v = 40 + r() * 70, d = v * E.out(Math.min(1, k / 0.9)); ctx.fillStyle = `rgba(${col},${(1 - k / 1.2) * 0.9})`; ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d - k * 20, 4 + r() * 5, 0, TAU); ctx.fill(); }
}
export function sparkles(ctx, t, x, y, R, n = 5, a = 1, seed = 1) {
  for (let i = 0; i < n; i++) { const ph = t * 1.6 + hash(i, seed) * 6, u = (ph % 1), ang = hash(i, seed + 2) * TAU; sparkle(ctx, x + Math.cos(ang) * R * (0.6 + u * 0.5), y + Math.sin(ang) * R * (0.6 + u * 0.5) - u * 30, 12 * Math.sin(u * Math.PI), a); }
}
export { C, glow, lights, house, hut, sky, stars, snowGround, moon, sparkle, E, clamp, lerp, invLerp, seg, rng, hash, TAU, spring };
