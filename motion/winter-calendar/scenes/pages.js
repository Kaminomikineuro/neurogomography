// Page illustrations in risograph spot inks. World 1000×1000 per window, ground ≈ 820. Elements step at 12 fps.
import { E, clamp, lerp, invLerp, seg, rng, hash, TAU, spring } from '../lib/mg.js';
import { INK, plate, paperHole, light, htGradient, snowPaper, reg, q, screen } from '../lib/riso.js';
import { drawChibi, umbrella, blinkAt, setMode } from '../lib/chars.js';

const GY = 840, HH = 360;
const key = (t, ks, e = E.inOut) => { if (t <= ks[0][0]) return ks[0][1]; for (let i = 1; i < ks.length; i++) if (t <= ks[i][0]) return lerp(ks[i - 1][1], ks[i][1], (ks[i][2] || e)(invLerp(ks[i - 1][0], ks[i][0], t))); return ks[ks.length - 1][1]; };
const cue = (t, ks) => { let v = ks[0][1]; for (const [tt, vv] of ks) if (t >= tt) v = vv; return v; };
function walk(t, t0, t1, x0, x1, stride = 95) { const p = clamp((t - t0) / (t1 - t0), 0, 1), x = lerp(x0, x1, E.inOut(p)), a = t > t0 && t < t1 ? clamp(Math.min(t - t0, t1 - t) / 0.2, 0, 1) : 0; return { x, walk: a, phase: Math.abs(x - x0) / stride }; }

// a hero printed in two passes: a violet/red fill plate out of register + the key plate
function hero(ctx, t, P) {
  const tq = q(t), base = { y: GY, h: HH, t: tq, blink: blinkAt(tq, P.who === 'xc' ? 3 : 7) };
  setMode('fill'); ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.42; const [dx, dy] = reg(t, P.who === 'xc' ? 'r' : 'v', 4); ctx.translate(dx, dy); drawChibi(ctx, { ...base, ...P, noShadow: true }); ctx.restore();
  setMode('both'); return drawChibi(ctx, { ...base, ...P });
}
function pair(ctx, t, A, B) { const o = {}; for (const p of (A.depth ?? 0) <= (B.depth ?? 0) ? [A, B] : [B, A]) o[p.who] = hero(ctx, t, p); return o; }
function holdUmb(ctx, t, hx, cx, cy, r, tilt = 0) { const m = ctx.getTransform(); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); umbrella(ctx, hx.xc.handR, { x: m.a * cx + m.c * cy + m.e, y: m.b * cx + m.d * cy + m.f }, r * Math.hypot(m.a, m.b), q(t), tilt); ctx.restore(); }

// ---------- backdrops ----------
function sky(ctx, t, ink = 'b', a = 0.82) { plate(ctx, t, ink, () => ctx.fillRect(-200, -200, 1400, 1400), { alpha: a, amp: 1 }); htGradient(ctx, t, 'v', -100, -100, 1100, 520, 0.5, 14); }
function ground(ctx, t, y = 760) { paperHole(ctx, () => { ctx.beginPath(); ctx.moveTo(-200, 1200); ctx.lineTo(-200, y); for (let x = -200; x <= 1200; x += 50) ctx.lineTo(x, y + Math.sin(x * 0.01) * 10); ctx.lineTo(1200, 1200); ctx.fill(); }); htGradient(ctx, t, 'b', -200, y + 120, 1200, 1100, 0.26, 12); }
function moon(ctx, t, x, y, r) { paperHole(ctx, () => { ctx.beginPath(); ctx.arc(x, y, r * 1.08, 0, TAU); ctx.fill(); }); plate(ctx, t, 'y', () => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }); }
function block(ctx, t, x, base, w, h, ink, { roof = 'gable', winInk = 'y', lit = 0.6, seed = 1, rh = null } = {}) {
  const r = rng(seed); rh = rh ?? w * 0.45;
  plate(ctx, t, ink, () => { ctx.fillRect(x, base - h, w, h); ctx.beginPath(); if (roof === 'gable') { ctx.moveTo(x - 6, base - h); ctx.lineTo(x + w / 2, base - h - rh); ctx.lineTo(x + w + 6, base - h); } else if (roof === 'step') { const s = 4, sw = w / (2 * s - 1); ctx.moveTo(x, base - h); for (let i = 0; i < s; i++) { const yy = base - h - (i + 1) * rh / s; ctx.lineTo(x + i * sw, yy); ctx.lineTo(x + (i + 1) * sw, yy); } for (let i = s - 1; i >= 0; i--) { const yy = base - h - (i + 1) * rh / s; ctx.lineTo(x + w - (i + 1) * sw, yy); ctx.lineTo(x + w - i * sw, yy); } ctx.lineTo(x + w, base - h); } ctx.closePath(); ctx.fill(); });
  // snow on the roof (paper) and lit windows (paper + yellow)
  paperHole(ctx, () => { ctx.beginPath(); if (roof === 'gable') { ctx.moveTo(x - 8, base - h + 2); ctx.lineTo(x + w / 2, base - h - rh - 2); ctx.lineTo(x + w + 8, base - h + 2); ctx.lineTo(x + w / 2, base - h - rh + 12); } else ctx.rect(x - 4, base - h - rh - 4, w + 8, 9); ctx.closePath(); ctx.fill(); });
  const cols = Math.max(1, Math.round(w / 55)), rows = Math.max(1, Math.floor((h - 30) / 60));
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { if (r() > lit) continue; const ww = w / (cols * 2 + 1), wx = x + ww * (1 + 2 * i), wy = base - h + 20 + j * 60; if (wy + 30 > base) continue; paperHole(ctx, () => ctx.fillRect(wx, wy, ww, 30)); plate(ctx, t, winInk, () => ctx.fillRect(wx, wy, ww, 30)); }
}
function garland(ctx, t, x1, y1, x2, y2, sag, n, seed = 1) {
  plate(ctx, t, 'k', () => { ctx.lineWidth = 2.5; ctx.beginPath(); for (let i = 0; i <= 20; i++) { const u = i / 20; const x = lerp(x1, x2, u), y = lerp(y1, y2, u) + sag * 4 * u * (1 - u); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); });
  const tq = q(t); for (let i = 0; i < n; i++) { const u = (i + 0.5) / n, x = lerp(x1, x2, u), y = lerp(y1, y2, u) + sag * 4 * u * (1 - u) + 5, on = hash(i + Math.floor(tq * 3), seed) > 0.25; light(ctx, t, x, y, on ? 7 : 4.5, i % 3 === 1 ? 'r' : 'y'); }
}
function stall(ctx, t, x, base, w, h, roofInk = 'r', seed = 1) {
  plate(ctx, t, 'k', () => ctx.fillRect(x, base - h, w, h));
  paperHole(ctx, () => ctx.fillRect(x + w * 0.12, base - h * 0.74, w * 0.76, h * 0.36)); plate(ctx, t, 'y', () => ctx.fillRect(x + w * 0.12, base - h * 0.74, w * 0.76, h * 0.36));
  plate(ctx, t, roofInk, () => { ctx.beginPath(); ctx.moveTo(x - 14, base - h); ctx.lineTo(x + w / 2, base - h - w * 0.42); ctx.lineTo(x + w + 14, base - h); ctx.closePath(); ctx.fill(); });
  paperHole(ctx, () => { ctx.beginPath(); ctx.moveTo(x - 16, base - h + 2); ctx.lineTo(x + w / 2, base - h - w * 0.42 - 2); ctx.lineTo(x + w + 16, base - h + 2); ctx.lineTo(x + w / 2, base - h - w * 0.42 + 12); ctx.closePath(); ctx.fill(); });
  garland(ctx, t, x - 8, base - h + 6, x + w + 8, base - h + 6, 10, 6, seed);
}
function wheel(ctx, t, cx, cy, R, rot, cabInk = 'r', n = 12, base = 800, boxy = false) {
  plate(ctx, t, 'k', () => { ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(cx - R * 0.6, base); ctx.lineTo(cx, cy); ctx.lineTo(cx + R * 0.6, base); ctx.stroke(); ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke(); ctx.lineWidth = 3; for (let i = 0; i < n; i++) { const a = rot + i * TAU / n; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke(); } });
  for (let i = 0; i < n * 2; i++) { const a = rot + i * TAU / (n * 2); light(ctx, t, cx + Math.cos(a) * R, cy + Math.sin(a) * R, 5); }
  plate(ctx, t, cabInk, () => { for (let i = 0; i < n; i++) { const a = rot + i * TAU / n; ctx.beginPath(); boxy ? ctx.roundRect(cx + Math.cos(a) * R - 18, cy + Math.sin(a) * R + 8, 36, 30, 4) : ctx.roundRect(cx + Math.cos(a) * R - 15, cy + Math.sin(a) * R + 8, 30, 26, 10); ctx.fill(); } });
}
// red ink wipe between two vignettes inside one window: p 0..1, covers fully at 0.5
export function inkWipe(ctx, t, p, ink = 'r') {
  if (p <= 0 || p >= 1) return; const a = E.inOut(p);
  plate(ctx, t, ink, () => { ctx.beginPath(); const x0 = lerp(-900, 1100, a); ctx.moveTo(x0 - 400, -200); ctx.lineTo(x0 + 500, -200); ctx.lineTo(x0 + 200, 1200); ctx.lineTo(x0 - 700, 1200); ctx.closePath(); ctx.fill(); }, { amp: 2 });
}
const vt = (t) => q(t); // vignette time on twos

// ================= pages =================
export const cover = (ctx, lt, env) => {
  const t = env.t; env.cam({ cx: 500, cy: 520, z: 1.02 });
  sky(ctx, t); moon(ctx, t, 760, 230, 70); ground(ctx, t, 720);
  plate(ctx, t, 'v', () => { ctx.beginPath(); ctx.moveTo(-100, 760); ctx.quadraticCurveTo(250, 600, 560, 740); ctx.quadraticCurveTo(800, 640, 1100, 760); ctx.lineTo(1100, 780); ctx.lineTo(-100, 780); ctx.fill(); }, { alpha: 0.55 });
  snowPaper(ctx, t, -100, -100, 1200, 1100);
  const hx = pair(ctx, t, { who: 'jc', x: 400, turn: cue(lt, [[0, 0.3], [1.6, -0.25]]), expr: { eyes: cue(lt, [[0, 'open'], [1.6, 'tsun']]), mouth: cue(lt, [[0, 'flat'], [1.6, 'pout']]) }, blush: cue(lt, [[0, 0.4], [1.6, 0.95]]), armL: { a: 0.2 } },
    { who: 'xc', x: 610, turn: -0.3, expr: { eyes: 'happy', mouth: 'smile' }, armR: { a: 2.7 } });
  holdUmb(ctx, t, hx, 505, GY - 410, 220, -0.05);
};

export const rostock = (ctx, lt, env) => {
  const t = env.t, l = vt(lt); env.cam({ cx: key(lt, [[0, 520], [8, 500]]), cy: 520, z: key(lt, [[0, 1.0], [8, 1.06]]) });
  sky(ctx, t); moon(ctx, t, 180, 170, 46);
  plate(ctx, t, 'b', () => ctx.fillRect(-200, 600, 1400, 160), { alpha: 0.9 }); for (let i = 0; i < 6; i++) paperHole(ctx, () => ctx.fillRect(560 + (hash(i, 2) - 0.5) * 300 + Math.sin(l * 3 + i) * 10, 620 + i * 22, 80 - i * 8, 4));
  wheel(ctx, t, 720, 380, 250, l * 0.25, 'r', 12, 760);
  ground(ctx, t, 750);
  stall(ctx, t, 60, 820, 200, 170, 'r', 1); stall(ctx, t, 800, 830, 200, 175, 'v', 2);
  snowPaper(ctx, t, -100, -100, 1200, 1100, { n: 50 });
  const wj = walk(l, 0.5, 2.3, 120, 400), wx = walk(l, 0.65, 2.5, 280, 600);
  const point = seg(l, 2.6, 2.9, E.back) * (1 - seg(l, 4.5, 4.9)), give = seg(l, 4.9, 5.3, E.out), taken = l > 5.6, sip = seg(l, 6.1, 6.5) * (1 - seg(l, 7.1, 7.4));
  pair(ctx, t,
    { who: 'jc', x: wj.x, walk: wj.walk, phase: wj.phase, turn: key(l, [[0, 0.5], [2.6, 0.2], [3.1, 0.45], [4.8, -0.45], [5.9, 0.15]]), expr: { eyes: cue(l, [[0, 'open'], [4.9, 'tsun'], [6.1, 'closed']]), mouth: cue(l, [[0, 'flat'], [4.9, 'pout'], [6.1, 'smile']]) }, blush: cue(l, [[0, 0.3], [4.8, 0.95]]), armR: { a: taken ? lerp(0.9, 1.35, sip) : lerp(0.9, 1.25, give), prop: taken ? 'mug' : 'mug2' } },
    { who: 'xc', x: wx.x, walk: wx.walk, phase: wx.phase, turn: key(l, [[0, 0.4], [2.6, 0.55], [4.7, -0.35], [6.1, 0.1]]), expr: { eyes: cue(l, [[0, 'open'], [2.6, 'sparkle'], [4.6, 'open'], [5.7, 'happy']]), mouth: cue(l, [[0, 'smile'], [2.6, 'grin'], [4.5, 'smile'], [5.7, 'grin']]) }, exclaim: seg(l, 2.6, 2.8) * (1 - seg(l, 3.8, 4.1)), armR: { a: lerp(0.15, 2.5, point), prop: point > 0.5 ? 'point' : null }, armL: { a: taken ? lerp(0.9, 1.35, sip) : lerp(0.15, 0.9, seg(l, 5.2, 5.6)), prop: taken ? 'mug' : null } });
};

export const berlin = (ctx, lt, env) => {
  const t = env.t, l = vt(lt); env.cam({ cx: key(lt, [[0, 420], [2.3, 600]], E.linear), cy: 520, z: 1.05 });
  sky(ctx, t, 'v', 0.7);
  plate(ctx, t, 'k', () => { ctx.fillRect(805, 160, 20, 640); ctx.beginPath(); ctx.arc(815, 300, 52, 0, TAU); ctx.fill(); ctx.fillRect(811, 40, 8, 140); });
  light(ctx, t, 815, 40, 8, 'r', 0.8 + 0.2 * Math.sin(l * 6));
  ground(ctx, t, 780);
  for (let i = 0; i < 6; i++) stall(ctx, t, -100 + i * 230, 830 + (i % 2) * 8, 180, 160 + (i % 3) * 10, i % 2 ? 'v' : 'r', 10 + i);
  snowPaper(ctx, t, -100, -100, 1300, 1100, { n: 50 });
  const x0 = key(lt, [[0, 300], [2.3, 640]], E.linear);
  pair(ctx, t, { who: 'jc', x: x0, walk: 1, phase: l * 1.8, turn: 0.5, expr: { eyes: 'open', mouth: 'flat' } }, { who: 'xc', x: x0 + 200, walk: 1, phase: l * 1.8 + 0.5, turn: 0.4, expr: { eyes: 'sparkle', mouth: 'grin' } });
};

function pyramid(ctx, t, x, base, s) {
  const l = q(t); ctx.save(); ctx.translate(x, base); ctx.scale(s, s);
  const tiers = [[0, 200], [-200, 160], [-370, 120]];
  for (let k = 0; k < tiers.length; k++) { const [y, r] = tiers[k], rot = l * 0.6 * (k % 2 ? -1 : 1);
    plate(ctx, t, 'k', () => { ctx.lineWidth = 9; for (const sx of [-0.8, 0.8]) { ctx.beginPath(); ctx.moveTo(sx * r, y); ctx.lineTo(sx * r * 0.85, y - 200); ctx.stroke(); } ctx.beginPath(); ctx.ellipse(0, y, r, r * 0.14, 0, 0, TAU); ctx.fill(); });
    plate(ctx, t, 'r', () => { for (let i = 0; i < 5; i++) { const a = rot + i * TAU / 5; if (Math.sin(a) < 0) continue; const fx = Math.cos(a) * r * 0.75; ctx.beginPath(); ctx.ellipse(fx, y - 34, 13, 24, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(fx, y - 66, 11, 0, TAU); ctx.fill(); } });
  }
  for (let i = 0; i < 7; i++) { const a = i * TAU / 7; if (Math.sin(a) < -0.3) continue; const cx = Math.cos(a) * 180, cy = 10 + Math.sin(a) * 14; paperHole(ctx, () => ctx.fillRect(cx - 6, cy - 44, 12, 40)); light(ctx, t, cx, cy - 56, 8 + Math.sin(l * 9 + i) * 1.5); }
  plate(ctx, t, 'k', () => { ctx.fillRect(-5, -560, 10, 190); for (let i = 0; i < 6; i++) { const a = l * 2 + i * TAU / 6; ctx.beginPath(); ctx.ellipse(Math.sin(a) * 100, -560, 100 * Math.abs(Math.sin(a)) + 4, 12, 0, 0, TAU); ctx.fill(); } });
  light(ctx, t, 0, -580, 12, 'y');
  ctx.restore();
}
export const dresden = (ctx, lt, env) => {
  const t = env.t, l = vt(lt); env.cam({ cx: 500, cy: 520, z: key(lt, [[0, 1.0], [5, 1.08]]) });
  sky(ctx, t);
  plate(ctx, t, 'v', () => { ctx.fillRect(110, 470, 380, 330); ctx.beginPath(); ctx.moveTo(140, 470); ctx.bezierCurveTo(130, 260, 260, 200, 300, 160); ctx.bezierCurveTo(340, 200, 470, 260, 460, 470); ctx.fill(); ctx.fillRect(282, 60, 36, 110); ctx.fillRect(60, 400, 70, 400); ctx.fillRect(470, 400, 70, 400); });
  for (let i = 0; i < 5; i++) { paperHole(ctx, () => ctx.fillRect(150 + i * 64, 560, 22, 46)); plate(ctx, t, 'y', () => ctx.fillRect(150 + i * 64, 560, 22, 46)); }
  ground(ctx, t, 780);
  pyramid(ctx, t, 770, 840, 0.85);
  snowPaper(ctx, t, -100, -100, 1200, 1100, { n: 45 });
  const lift = seg(l, 1.4, 1.9, E.out) * (1 - seg(l, 2.5, 2.9)), bitten = l > 1.95;
  pair(ctx, t,
    { who: 'jc', x: 320, turn: cue(l, [[0, 0.2], [2.6, -0.35]]), expr: { eyes: cue(l, [[0, 'open'], [1.9, 'closed'], [2.6, 'tsun']]), mouth: cue(l, [[0, 'flat'], [1.95, 'chew'], [2.6, 'flat']]), cheek: l > 1.95 && l < 2.9 }, blush: cue(l, [[0, 0.3], [2.5, 1]]), armR: { a: lerp(1.0, 1.95, lift), prop: 'stollen', bite: bitten ? 1 : 0 } },
    { who: 'xc', x: 540, turn: -0.35, expr: { eyes: cue(l, [[0, 'open'], [2.7, 'happy']]), mouth: cue(l, [[0, 'smile'], [2.0, 'o'], [2.7, 'grin']]) } });
  if (l > 1.95 && l < 3.0) { const k = l - 1.95, r = rng(5); for (let i = 0; i < 10; i++) { const a = r() * TAU, d = 30 + 70 * E.out(Math.min(1, k / 0.8)); paperHole(ctx, () => { ctx.beginPath(); ctx.arc(350 + Math.cos(a) * d, GY - 240 + Math.sin(a) * d, 5, 0, TAU); ctx.fill(); }); } }
  if (l > 2.6 && l < 4.4) for (let i = 0; i < 4; i++) { const ph = (l * 1.4 + i / 4) % 1; light(ctx, t, 300 + Math.cos(i * 1.7) * 90, GY - 330 - ph * 50, 7 * Math.sin(ph * Math.PI), 'y'); }
};

function ghost(ctx, t, x, y, a) {
  if (a <= 0) return; const l = q(t);
  paperHole(ctx, () => { ctx.save(); ctx.globalAlpha = a; ctx.beginPath(); ctx.moveTo(x - 60, y + 10); ctx.bezierCurveTo(x - 62, y - 100, x + 62, y - 100, x + 60, y + 10); for (let i = 0; i <= 5; i++) ctx.lineTo(x + 60 - i * 24, y + 70 + (i % 2 ? -16 : 0) + Math.sin(l * 6 + i) * 6); ctx.closePath(); ctx.fill(); ctx.restore(); });
  plate(ctx, t, 'b', () => { ctx.fillStyle = screen(ctx, 'b', 8, 0.3); ctx.beginPath(); ctx.ellipse(x + 30, y + 20, 30, 50, 0, 0, TAU); ctx.fill(); }, { alpha: a });
  plate(ctx, t, 'k', () => { ctx.beginPath(); ctx.ellipse(x - 20, y - 18, 8, 12, 0, 0, TAU); ctx.ellipse(x + 20, y - 18, 8, 12, 0, 0, TAU); ctx.ellipse(x, y + 10, 9, 11, 0, 0, TAU); ctx.fill(); }, { alpha: a });
}
export const prague = (ctx, lt, env) => {
  const t = env.t, l = vt(lt), SPLIT = 5.0;
  if (lt < SPLIT + 0.0) {
    env.cam({ cx: 500, cy: 520, z: key(lt, [[0, 1.02], [2.4, 1.02], [2.9, 1.1, E.out], [5, 1.1]]) });
    sky(ctx, t, 'v', 0.75);
    block(ctx, t, -60, 820, 330, 760, 'k', { roof: 'step', seed: 3, lit: 0.6 }); block(ctx, t, 720, 820, 340, 720, 'v', { roof: 'gable', seed: 4, lit: 0.55 });
    block(ctx, t, 330, 800, 140, 380, 'v', { seed: 5, lit: 0.5 }); block(ctx, t, 480, 800, 160, 330, 'k', { seed: 6, lit: 0.5 });
    ground(ctx, t, 790);
    plate(ctx, t, 'k', () => { ctx.fillRect(282, 520, 9, 290); }); light(ctx, t, 286, 510, 16, 'y');
    const peek = seg(l, 2.3, 2.8, E.out) * (1 - seg(l, 3.9, 4.4, E.in));
    ctx.save(); ctx.beginPath(); ctx.rect(270, -100, 900, 1200); ctx.clip(); ghost(ctx, t, lerp(220, 360, peek), 600 + Math.sin(l * 3) * 8, peek); ctx.restore();
    snowPaper(ctx, t, -100, -100, 1200, 1100, { n: 40 });
    const w1 = walk(l, 0.3, 2.1, 760, 520), w2 = walk(l, 0.3, 2.1, 940, 700);
    const jump = l > 2.9 && l < 3.5 ? -Math.sin(invLerp(2.9, 3.5, l) * Math.PI) * 9 : 0, zid = seg(l, 2.95, 3.2) * (1 - seg(l, 4.2, 4.6)), cover = seg(l, 3.3, 3.75, E.out);
    const hx = pair(ctx, t,
      { who: 'jc', x: w1.x, walk: w1.walk, phase: w1.phase, bob: jump, turn: cue(l, [[0, -0.4], [2.9, -0.6], [4.2, 0.35]]), depth: 1, expr: { eyes: cue(l, [[0, 'open'], [2.9, 'wide'], [4.0, 'tsun']]), mouth: cue(l, [[0, 'flat'], [2.9, 'wavy'], [4.0, 'pout']]) }, sweat: seg(l, 2.95, 3.1) * (1 - seg(l, 4.0, 4.3)), blush: cue(l, [[0, 0.3], [4.0, 0.9]]), zidian: zid, armR: { a: lerp(0.15, 1.15, zid) }, armL: { a: lerp(0.15, 0.9, zid) } },
      { who: 'xc', x: w2.x, walk: w2.walk, phase: w2.phase, turn: -0.45, expr: { eyes: cue(l, [[0, 'open'], [3.25, 'happy']]), mouth: cue(l, [[0, 'smile'], [3.25, 'laugh'], [4.2, 'smile']]) }, armR: { a: lerp(2.55, 2.85, cover) } });
    holdUmb(ctx, t, hx, lerp(w2.x - 20, (w1.x + w2.x) / 2 - 30, cover), GY - 400, 210, lerp(0.05, -0.12, cover));
  } else {
    const m = lt - SPLIT; env.cam({ cx: 500, cy: 520, z: key(m, [[0, 1.0], [4.6, 1.08]]) });
    sky(ctx, t);
    plate(ctx, t, 'k', () => { for (const tx of [380, 620]) { ctx.fillRect(tx - 50, 200, 100, 600); ctx.beginPath(); ctx.moveTo(tx - 60, 200); ctx.lineTo(tx, -40); ctx.lineTo(tx + 60, 200); ctx.fill(); for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(tx + k * 60 - 14, 200); ctx.lineTo(tx + k * 60, 130); ctx.lineTo(tx + k * 60 + 14, 200); ctx.fill(); } } ctx.fillRect(250, 460, 500, 340); });
    for (const tx of [380, 620]) for (let j = 0; j < 4; j++) { paperHole(ctx, () => ctx.fillRect(tx - 10, 240 + j * 80, 20, 40)); plate(ctx, t, 'y', () => ctx.fillRect(tx - 10, 240 + j * 80, 20, 40)); }
    plate(ctx, t, 'v', () => { ctx.beginPath(); ctx.moveTo(800, 820); ctx.lineTo(880, 360); ctx.lineTo(960, 820); ctx.fill(); });
    for (let i = 0; i < 12; i++) light(ctx, t, 830 + hash(i, 3) * 100, 420 + hash(i, 4) * 380, 6, i % 3 ? 'y' : 'r');
    ground(ctx, t, 790);
    const toast = seg(m, 2.3, 2.7, E.back) * (1 - seg(m, 3.5, 3.9));
    pair(ctx, t, { who: 'xc', x: 360, turn: 0.35, expr: { eyes: cue(m, [[0, 'open'], [2.7, 'happy']]), mouth: 'smile' }, armR: { a: lerp(0.9, 2.0, toast), prop: 'cup' } },
      { who: 'jc', x: 640, turn: -0.35, expr: { eyes: cue(m, [[0, 'open'], [2.8, 'closed']]), mouth: cue(m, [[0, 'chew'], [2.0, 'smile']]) }, blush: 0.6, armL: { a: lerp(0.9, 2.0, toast), prop: 'cup' } });
    plate(ctx, t, 'r', () => { ctx.beginPath(); ctx.moveTo(170, 770); ctx.lineTo(830, 770); ctx.lineTo(850, 1000); ctx.lineTo(150, 1000); ctx.fill(); });
    paperHole(ctx, () => { for (const px of [330, 670]) { ctx.beginPath(); ctx.ellipse(px, 790, 60, 14, 0, 0, TAU); ctx.fill(); } ctx.fillRect(470, 700, 16, 80); ctx.fillRect(514, 680, 16, 100); });
    light(ctx, t, 478, 690, 9 + Math.sin(l * 11) * 1.5); light(ctx, t, 522, 670, 9 + Math.sin(l * 9 + 1) * 1.5);
    snowPaper(ctx, t, -100, -100, 1200, 1100, { n: 35 });
  }
  inkWipe(ctx, t, invLerp(SPLIT - 0.35, SPLIT + 0.35, lt));
};

export const vienna = (ctx, lt, env) => {
  const t = env.t, l = vt(lt), SPLIT = 2.6;
  if (lt < SPLIT) {
    env.cam({ cx: 500, cy: 520, z: 1.02 });
    sky(ctx, t);
    wheel(ctx, t, 260, 360, 270, -l * 0.15, 'r', 12, 790, true);
    plate(ctx, t, 'k', () => { ctx.fillRect(560, 430, 420, 380); ctx.beginPath(); ctx.moveTo(540, 430); ctx.lineTo(620, 330); ctx.lineTo(700, 400); ctx.lineTo(770, 300); ctx.lineTo(840, 400); ctx.lineTo(920, 330); ctx.lineTo(1000, 430); ctx.fill(); });
    paperHole(ctx, () => { ctx.beginPath(); ctx.moveTo(700, 810); ctx.lineTo(700, 640); ctx.quadraticCurveTo(770, 560, 840, 640); ctx.lineTo(840, 810); ctx.fill(); });
    plate(ctx, t, 'v', () => { ctx.beginPath(); ctx.moveTo(700, 810); ctx.lineTo(700, 640); ctx.quadraticCurveTo(770, 560, 840, 640); ctx.lineTo(840, 810); ctx.fill(); });
    const bl = Math.floor(l * 3) % 2; for (const ex of [640, 900]) light(ctx, t, ex, 500, bl ? 18 : 12, 'y');
    ground(ctx, t, 790); snowPaper(ctx, t, -100, -100, 1200, 1100, { n: 40 });
    pair(ctx, t, { who: 'jc', x: 380, turn: cue(l, [[0, -0.35], [1.4, 0.45]]), expr: { eyes: cue(l, [[0, 'tsun'], [1.4, 'open']]), mouth: cue(l, [[0, 'flat'], [1.4, 'pout']]) }, blush: 0.4, sweat: seg(l, 1.5, 1.7), armR: { a: 0.6 }, armL: { a: 0.6 } },
      { who: 'xc', x: 560, turn: 0.4, expr: { eyes: 'sparkle', mouth: 'grin' }, armR: { a: key(l, [[0.3, 0.15], [0.7, 2.3, E.back], [2.4, 2.3]]), prop: l > 0.5 ? 'point' : null } });
  } else {
    const m = lt - SPLIT; env.cam({ cx: 500, cy: 520, z: 1.0 });
    sky(ctx, t, 'v', 0.7);
    plate(ctx, t, 'y', () => { ctx.fillRect(-100, 420, 1200, 380); ctx.fillRect(330, 340, 340, 80); });
    plate(ctx, t, 'r', () => { ctx.fillRect(-100, 408, 1200, 16); ctx.fillRect(320, 330, 360, 14); });
    plate(ctx, t, 'k', () => { for (let j = 0; j < 3; j++) for (let i = 0; i < 18; i++) ctx.fillRect(-80 + i * 64, 450 + j * 100, 22, 50); }, { alpha: 0.6 });
    ground(ctx, t, 790); snowPaper(ctx, t, -100, -100, 1200, 1100, { n: 45 });
    const w1 = walk(m, 0.1, 1.8, 260, 420), w2 = walk(m, 0.1, 1.8, 440, 600);
    const hx = pair(ctx, t, { who: 'jc', x: w1.x, walk: w1.walk, phase: w1.phase, turn: 0.5, expr: { eyes: 'open', mouth: 'smile' }, blush: 0.4 }, { who: 'xc', x: w2.x, walk: w2.walk, phase: w2.phase, turn: 0.4, expr: { eyes: 'happy', mouth: 'smile' }, armR: { a: 2.6 } });
    holdUmb(ctx, t, hx, (w1.x + w2.x) / 2 - 10, GY - 400, 210, -0.06);
  }
  inkWipe(ctx, t, invLerp(SPLIT - 0.35, SPLIT + 0.35, lt), 'v');
};

export const bratislava = (ctx, lt, env) => {
  const t = env.t, l = vt(lt); env.cam({ cx: 500, cy: 520, z: key(lt, [[0, 1.0], [5, 1.07]]) });
  sky(ctx, t); moon(ctx, t, 830, 160, 50);
  plate(ctx, t, 'v', () => { ctx.beginPath(); ctx.moveTo(-100, 640); ctx.quadraticCurveTo(250, 360, 620, 640); ctx.fill(); });
  paperHole(ctx, () => { ctx.fillRect(140, 260, 240, 170); ctx.fillRect(110, 220, 56, 210); ctx.fillRect(354, 220, 56, 210); });
  plate(ctx, t, 'r', () => { for (const x of [138, 382]) { ctx.beginPath(); ctx.moveTo(x - 34, 222); ctx.lineTo(x, 170); ctx.lineTo(x + 34, 222); ctx.fill(); } ctx.fillRect(134, 250, 252, 14); });
  for (let i = 0; i < 4; i++) { plate(ctx, t, 'y', () => ctx.fillRect(170 + i * 54, 300, 18, 34)); }
  plate(ctx, t, 'b', () => ctx.fillRect(-200, 640, 1400, 140), { alpha: 0.95 });
  for (let i = 0; i < 5; i++) paperHole(ctx, () => ctx.fillRect(220 + (hash(i, 9) - 0.5) * 200 + Math.sin(l * 2 + i) * 12, 660 + i * 22, 70 - i * 9, 4));
  paperHole(ctx, () => ctx.fillRect(-200, 780, 1400, 300));
  const gust = 0.8 + 0.2 * Math.sin(l * 2);
  snowPaper(ctx, t, -100, -100, 1200, 900, { n: 60, wind: 1.6 });
  pair(ctx, t, { who: 'jc', x: 390, turn: 0.25, wind: gust, windDir: 1, expr: { eyes: cue(l, [[0, 'open'], [2.6, 'tsun']]), mouth: cue(l, [[0, 'flat'], [2.6, 'pout']]) }, blush: cue(l, [[0, 0.4], [2.6, 0.95]]), armL: { a: 0.9 }, armR: { a: 0.7 } },
    { who: 'xc', x: 600, turn: 0.3, wind: 1.4 * gust, windDir: 1, expr: { eyes: cue(l, [[0, 'open'], [1.4, 'happy']]), mouth: cue(l, [[0, 'smile'], [2.4, 'grin'], [3.2, 'smile']]) }, heart: seg(l, 2.4, 2.8) * (1 - seg(l, 3.6, 4.0)) });
  plate(ctx, t, 'k', () => { ctx.fillRect(-200, 870, 1400, 14); ctx.fillRect(-200, 940, 1400, 10); for (let x = -180; x < 1200; x += 80) ctx.fillRect(x, 870, 10, 140); });
};

export const night = (ctx, lt, env) => {
  const t = env.t, l = vt(lt); env.cam({ cx: 500, cy: 520, z: 1.0 });
  plate(ctx, t, 'v', () => ctx.fillRect(-200, -200, 1400, 1400), { alpha: 0.9 });
  plate(ctx, t, 'b', () => { ctx.beginPath(); ctx.roundRect(120, 120, 760, 380, 60); ctx.fill(); });
  moon(ctx, t, 720, 230, 46);
  for (let i = 0; i < 7; i++) { const x = 120 + (((hash(i, 2) * 900 - l * 420 * (0.6 + hash(i, 3))) % 900) + 900) % 900 - 50; if (x > 140 && x < 860) light(ctx, t, x, 330 + hash(i, 4) * 120, 7, 'y'); }
  plate(ctx, t, 'k', () => { ctx.lineWidth = 26; ctx.beginPath(); ctx.roundRect(120, 120, 760, 380, 60); ctx.stroke(); ctx.fillRect(-200, 560, 1400, 30); });
  plate(ctx, t, 'r', () => ctx.fillRect(-200, 590, 1400, 500), { alpha: 0.85 });
  pair(ctx, t, { who: 'jc', x: 410, y: GY + 40, turn: 0.25, expr: { eyes: 'sleep', mouth: 'sleep' }, headTilt: 0.2, zz: 1, blush: 0.6, noShadow: true },
    { who: 'xc', x: 590, y: GY + 40, turn: -0.25, expr: { eyes: 'sleep', mouth: 'smile' }, headTilt: -0.24, noShadow: true });
};

function bursts(ctx, t, k, list) {
  for (const [bt, x, y, ink, sz] of list) { const u = k - bt; if (u < -0.5 || u > 2.0) continue;
    if (u < 0) { light(ctx, t, x, lerp(800, y, E.out(1 + u / 0.5)), 6, ink); continue; }
    const R = 230 * sz * E.out(Math.min(1, u / 1.0)), fade = 1 - clamp((u - 0.5) / 1.5, 0, 1), n = 26;
    for (let ring = 0; ring < 3; ring++) for (let i = 0; i < n; i++) { const a = i / n * TAU + ring * 0.12, rr = R * (1 - ring * 0.22); light(ctx, t, x + Math.cos(a) * rr, y + Math.sin(a) * rr + 70 * u * u, (8 - ring * 2) * sz * fade, ring === 1 ? 'y' : ink); }
  }
}
export const cologne = (ctx, lt, env) => {
  const t = env.t, l = vt(lt); env.cam({ cx: 500, cy: key(lt, [[0, 520], [2.2, 520], [3.2, 470]]), z: 1.04 });
  sky(ctx, t, 'b', 0.88);
  plate(ctx, t, 'k', () => { for (const tx of [180, 380]) { ctx.fillRect(tx - 70, 230, 140, 560); ctx.beginPath(); ctx.moveTo(tx - 74, 230); ctx.lineTo(tx, -60); ctx.lineTo(tx + 74, 230); ctx.fill(); } ctx.fillRect(100, 460, 360, 340); });
  for (const tx of [180, 380]) for (let j = 0; j < 4; j++) { paperHole(ctx, () => ctx.fillRect(tx - 12, 280 + j * 110, 24, 60)); plate(ctx, t, 'y', () => ctx.fillRect(tx - 12, 280 + j * 110, 24, 60)); }
  plate(ctx, t, 'r', () => { ctx.lineWidth = 12; for (let i = 0; i < 3; i++) { const x0 = 480 + i * 200; ctx.beginPath(); ctx.moveTo(x0, 640); ctx.quadraticCurveTo(x0 + 100, 470, x0 + 200, 640); ctx.stroke(); } ctx.fillRect(480, 640, 640, 16); });
  for (let i = 0; i < 12; i++) light(ctx, t, 490 + i * 50, 650, 5);
  plate(ctx, t, 'b', () => ctx.fillRect(-200, 660, 1400, 130));
  ground(ctx, t, 790);
  const look = seg(l, 2.0, 2.4);
  pair(ctx, t, { who: 'jc', x: 400, turn: 0.2, look: look > 0.5 ? [0.5, -2.8] : null, expr: { eyes: 'open', mouth: 'flat' }, blush: 0.5 },
    { who: 'xc', x: 600, turn: -0.2, look: look > 0.5 ? [-0.5, -2.8] : null, expr: { eyes: look > 0.5 ? 'sparkle' : 'open', mouth: 'smile' } });
};
export const newYear = (ctx, lt, env) => {
  const t = env.t, l = vt(lt); env.cam({ cx: 500, cy: 520, z: key(lt, [[0, 1.12], [3.8, 1.0]], E.out) });
  plate(ctx, t, 'k', () => ctx.fillRect(-200, -200, 1400, 1400), { alpha: 0.92 });
  plate(ctx, t, 'b', () => ctx.fillRect(-200, -200, 1400, 1400), { alpha: 0.5 });
  bursts(ctx, t, l, [[0.0, 500, 260, 'r', 1.15], [0.35, 230, 200, 'v', 0.9], [0.6, 780, 230, 'y', 1.0], [1.0, 380, 120, 'b', 0.9], [1.3, 680, 330, 'r', 0.85], [1.7, 520, 160, 'y', 1.1], [2.2, 260, 300, 'r', 0.8], [2.6, 760, 150, 'v', 0.9]]);
  plate(ctx, t, 'v', () => ctx.fillRect(-200, 650, 1400, 140), { alpha: 0.9 });
  ground(ctx, t, 790);
  pair(ctx, t, { who: 'jc', x: 400, turn: 0.1, look: [0.5, -2.8], headTilt: -0.06, expr: { eyes: 'sparkle', mouth: cue(l, [[0, 'o'], [1.8, 'smile']]) }, blush: 0.7 },
    { who: 'xc', x: 600, turn: -0.1, look: [-0.5, -2.8], headTilt: 0.06, expr: { eyes: 'sparkle', mouth: 'grin' }, armL: { a: lerp(0.15, 0.6, seg(l, 1.2, 1.6)) } });
};
export const rolls = (ctx, lt, env) => {
  const t = env.t, l = vt(lt); env.cam({ cx: 500, cy: 540, z: key(lt, [[0, 1.05], [3.6, 1.12]]) });
  plate(ctx, t, 'r', () => ctx.fillRect(-200, -200, 1400, 1400), { alpha: 0.75 });
  plate(ctx, t, 'b', () => { ctx.beginPath(); ctx.roundRect(260, 80, 480, 380, 20); ctx.fill(); });
  bursts(ctx, t, l + 1.0, [[0.2, 420, 220, 'y', 0.35], [0.9, 600, 180, 'v', 0.3], [1.6, 500, 260, 'y', 0.35]]);
  plate(ctx, t, 'k', () => { ctx.lineWidth = 18; ctx.beginPath(); ctx.roundRect(260, 80, 480, 380, 20); ctx.stroke(); ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(500, 80); ctx.lineTo(500, 460); ctx.stroke(); });
  const left = cue(l, [[0, 4], [0.6, 3], [1.2, 2], [1.6, 1], [2.1, 0]]), grab = seg(l, 1.8, 2.0, E.out), late = seg(l, 1.95, 2.3, E.out) * (1 - seg(l, 2.8, 3.1));
  pair(ctx, t, { who: 'xc', x: 360, turn: 0.35, expr: { eyes: cue(l, [[0, 'happy'], [2.3, 'open'], [2.6, 'happy']]), mouth: cue(l, [[0, 'chew'], [1.1, 'smile'], [2.3, 'o'], [2.6, 'smile']]) }, armR: { a: lerp(0.9, 1.5, late), prop: 'chop', ang: -1.2 } },
    { who: 'jc', x: 640, turn: -0.35, expr: { eyes: cue(l, [[0, 'open'], [2.0, 'closed'], [2.5, 'tsun']]), mouth: cue(l, [[0, 'flat'], [2.0, 'chew'], [2.8, 'smirk']]), cheek: l > 2.0 && l < 2.8 }, blush: cue(l, [[0, 0.4], [2.4, 0.9]]), armL: { a: lerp(0.9, 1.6, grab) * (1 - seg(l, 2.0, 2.25)) + 0.9 * seg(l, 2.0, 2.25), prop: 'chop', ang: 1.0, roll: l > 1.9 && l < 2.1 } });
  plate(ctx, t, 'k', () => ctx.fillRect(100, 760, 800, 400));
  paperHole(ctx, () => { ctx.beginPath(); ctx.roundRect(330, 730, 340, 40, 8); ctx.fill(); });
  for (let i = 0; i < left; i++) { const rx = 380 + i * 80; plate(ctx, t, 'k', () => { ctx.beginPath(); ctx.arc(rx, 730, 30, 0, TAU); ctx.fill(); }); paperHole(ctx, () => { ctx.beginPath(); ctx.arc(rx, 730, 21, 0, TAU); ctx.fill(); }); plate(ctx, t, 'r', () => { ctx.beginPath(); ctx.arc(rx, 730, 10, 0, TAU); ctx.fill(); }); }
};

function mouse(ctx, t, x, y, hit) {
  const r = hit > 0 && hit < 1 ? Math.sin(hit * 20) * 0.5 * (1 - hit) : 0; ctx.save(); ctx.translate(x, y); ctx.rotate(r);
  plate(ctx, t, 'k', () => ctx.fillRect(-5, 30, 10, 90));
  paperHole(ctx, () => { ctx.beginPath(); ctx.arc(-30, -36, 24, 0, TAU); ctx.arc(30, -36, 24, 0, TAU); ctx.ellipse(0, 0, 40, 36, 0, 0, TAU); ctx.fill(); });
  plate(ctx, t, 'pink', () => { ctx.beginPath(); ctx.arc(-30, -36, 12, 0, TAU); ctx.arc(30, -36, 12, 0, TAU); ctx.fill(); });
  plate(ctx, t, 'k', () => { ctx.beginPath(); ctx.arc(-13, -5, 5, 0, TAU); ctx.arc(13, -5, 5, 0, TAU); ctx.fill(); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 40, 0, TAU); ctx.stroke(); });
  plate(ctx, t, 'r', () => { ctx.beginPath(); ctx.arc(0, 50, 14, 0, TAU); ctx.fill(); });
  if (hit > 0) plate(ctx, t, 'k', () => { ctx.beginPath(); ctx.arc(-6, -14, 14, 0, TAU); ctx.arc(10, -22, 9, 0, TAU); ctx.fill(); }, { alpha: 0.85 });
  ctx.restore();
}
const SHOTS = [[0.5, 'jc', 0, 1], [1.0, 'xc', 1, 0], [1.4, 'jc', 2, 1], [2.0, 'xc', 1, 0], [2.5, 'jc', 1, 1]];
export const park = (ctx, lt, env) => {
  const t = env.t, l = vt(lt), A = 3.4, B = 7.4;
  if (lt < A) { // rink
    env.cam({ cx: key(lt, [[0, 460], [A, 540]]), cy: 520, z: 1.02 });
    sky(ctx, t, 'v', 0.75);
    block(ctx, t, -60, 640, 250, 320, 'b', { seed: 41 });
    plate(ctx, t, 'r', () => { for (let k = 0; k < 3; k++) { const y = 360 - k * 70, w = 300 - k * 60; ctx.beginPath(); ctx.moveTo(500 - w / 2, y); ctx.quadraticCurveTo(500, y - 60, 500 + w / 2, y); ctx.quadraticCurveTo(500, y - 25, 500 - w / 2, y); ctx.fill(); } ctx.fillRect(400, 360, 200, 280); });
    block(ctx, t, 760, 640, 260, 380, 'k', { roof: 'step', seed: 42 });
    garland(ctx, t, -50, 150, 1050, 180, 80, 18, 3);
    paperHole(ctx, () => { ctx.beginPath(); ctx.ellipse(500, 820, 700, 200, 0, 0, TAU); ctx.fill(); });
    plate(ctx, t, 'b', () => { ctx.fillStyle = screen(ctx, 'b', 10, 0.22); ctx.beginPath(); ctx.ellipse(500, 820, 700, 200, 0, 0, TAU); ctx.fill(); }, { alpha: 0.8 });
    const gx = key(lt, [[0, 240], [A, 460]], E.linear), wob = Math.sin(l * 6) * 0.08 * (1 - seg(l, 1.8, 2.4));
    pair(ctx, t, { who: 'jc', x: gx, y: 850, lean: wob - 0.04, turn: 0.4, expr: { eyes: cue(l, [[0, 'wide'], [2.2, 'open']]), mouth: cue(l, [[0, 'wavy'], [2.2, 'grin']]), brows: 'worried' }, armL: { a: 1.4 }, armR: { a: 1.4 }, sweat: 1 - seg(l, 2.0, 2.4) },
      { who: 'xc', x: gx + 220, y: 860, lean: -0.08, turn: 0.45, expr: { eyes: 'happy', mouth: 'smile' }, armL: { a: 1.2 }, armR: { a: 1.6 } });
    snowPaper(ctx, t, -100, -100, 1200, 700, { n: 35 });
  } else if (lt < B) { // the chocolate cart
    const m = lt - A, mq = q(m); env.cam({ cx: 500, cy: 520, z: 1.04 });
    plate(ctx, t, 'v', () => ctx.fillRect(-200, -200, 1400, 1400), { alpha: 0.9 });
    plate(ctx, t, 'k', () => ctx.fillRect(-200, 520, 1400, 30), { alpha: 0.8 });
    const tx = [190, 500, 810];
    for (let i = 0; i < 3; i++) { const hits = SHOTS.filter(s => s[3] && s[2] === i && mq > s[0] + 0.35).map(s => s[0] + 0.35); const hk = hits.length ? clamp((mq - hits[hits.length - 1]) / 0.8, 0, 0.999) : 0; mouse(ctx, t, tx[i], 380 - (0.5 + 0.5 * Math.sin(mq * 2.2 + i * 2)) * 30, hits.length ? hk || 0.999 : 0); }
    for (const [st, w, ti, hit] of SHOTS) if (!hit && mq > st + 0.35) plate(ctx, t, 'k', () => { const sx = tx[ti] + 120, sy = 300; ctx.beginPath(); ctx.arc(sx, sy, 22, 0, TAU); for (let k = 0; k < 6; k++) ctx.arc(sx + Math.cos(k) * 28, sy + Math.sin(k) * 26, 8, 0, TAU); ctx.fill(); }, { alpha: 0.85 });
    for (const [st, w, ti, hit] of SHOTS) { const p = invLerp(st, st + 0.35, mq); if (p <= 0 || p >= 1) continue; const sx = w === 'jc' ? 450 : 560, ex = tx[ti] + (hit ? 0 : 120), ey = hit ? 380 : 300; plate(ctx, t, 'k', () => { ctx.beginPath(); ctx.arc(lerp(sx, ex, p), lerp(GY - 190, ey, p) - Math.sin(p * Math.PI) * 100, 14, 0, TAU); ctx.fill(); }); }
    pair(ctx, t, { who: 'jc', x: 400, turn: -0.15, expr: { eyes: cue(mq, [[0, 'open'], [0.9, 'sparkle']]), mouth: cue(mq, [[0, 'flat'], [0.9, 'grin']]) }, blush: 0.6, armR: { a: 1.25, prop: 'blaster' }, armL: { a: 1.0 } },
      { who: 'xc', x: 610, turn: -0.15, expr: { eyes: cue(mq, [[0, 'open'], [1.4, 'happy']]), mouth: cue(mq, [[0, 'o'], [1.4, 'smile']]) }, armL: { a: 1.25, prop: 'blaster' }, armR: { a: 1.0 } });
    plate(ctx, t, 'r', () => { ctx.beginPath(); ctx.roundRect(170, 730, 660, 260, 60); ctx.fill(); });
    for (let i = 0; i < 10; i++) light(ctx, t, 210 + i * 64, 740, 6);
  } else { // haunted castle + drop tower
    const m = lt - B, mq = q(m);
    const ringY = key(mq, [[0.2, 850], [1.8, 360], [2.5, 360], [2.85, 800, E.in], [3.3, 850, E.out]]);
    env.cam({ cx: 500, cy: key(m, [[0.2, 520], [1.8, 360], [2.5, 360], [2.85, 520, E.in]]), z: 1.0 });
    sky(ctx, t, 'b', 0.9);
    plate(ctx, t, 'v', () => { ctx.beginPath(); ctx.moveTo(-200, 820); ctx.quadraticCurveTo(250, 520, 600, 820); ctx.fill(); for (const [cx, h] of [[140, 330], [300, 400], [420, 300]]) { ctx.fillRect(cx - 40, 700 - h, 80, h); ctx.beginPath(); ctx.moveTo(cx - 48, 700 - h); ctx.lineTo(cx, 700 - h - 100); ctx.lineTo(cx + 48, 700 - h); ctx.fill(); } });
    for (let i = 0; i < 5; i++) light(ctx, t, 120 + i * 70, 520 + (i % 2) * 60, 9, Math.floor(mq * 4 + i) % 2 ? 'y' : 'pink');
    plate(ctx, t, 'k', () => ctx.fillRect(640, -600, 60, 1500));
    for (let y = -560; y < 820; y += 50) light(ctx, t, 670, y, 6, Math.floor(y / 50 + mq * 8) % 3 ? 'y' : 'r');
    ground(ctx, t, 820);
    const drop = mq > 2.5 && mq < 3.2, scared = mq > 2.3 && mq < 3.6, shake = drop ? Math.sin(mq * 60) * 3 : 0;
    pair(ctx, t, { who: 'jc', x: 560 + shake, y: ringY, turn: 0.2, hairUp: drop ? 1 : 0, expr: { eyes: scared ? 'squeeze' : mq > 1.0 ? 'wide' : 'open', mouth: scared ? 'wavy' : 'flat' }, blush: 0.5, armL: { a: 0.9 }, armR: { a: 0.9 }, noShadow: true },
      { who: 'xc', x: 770 + shake, y: ringY, turn: -0.2, hairUp: drop ? 1 : 0, expr: { eyes: scared ? 'squeeze' : 'happy', mouth: scared ? 'wavy' : 'smile' }, armL: { a: 0.9 }, armR: { a: 0.9 }, noShadow: true });
    plate(ctx, t, 'r', () => { ctx.beginPath(); ctx.roundRect(440, ringY - 130, 460, 54, 18); ctx.fill(); });
  }
  inkWipe(ctx, t, invLerp(A - 0.35, A + 0.35, lt)); inkWipe(ctx, t, invLerp(B - 0.35, B + 0.35, lt), 'v');
};

export const finale = (ctx, lt, env) => {
  const t = env.t, l = vt(lt); env.cam({ cx: 500, cy: 520, z: key(lt, [[0, 1.08], [5, 1.0]]) });
  sky(ctx, t); moon(ctx, t, 500, 200, 80); ground(ctx, t, 720);
  snowPaper(ctx, t, -100, -100, 1200, 1100);
  const bell = 4.4, ring = seg(lt, bell, bell + 0.15) * (1 - seg(lt, bell + 1.4, bell + 2.2)), wave = Math.sin(l * 7) * 0.25 * seg(l, 0.6, 0.9);
  const hx = pair(ctx, t, { who: 'jc', x: 400, turn: 0.3, expr: { eyes: lt > bell ? 'happy' : 'open', mouth: lt > bell ? 'smile' : 'pout' }, blush: 0.8, armR: { a: lerp(0.15, 1.5, ring) } },
    { who: 'xc', x: 610, turn: -0.3, expr: { eyes: 'happy', mouth: 'grin' }, armR: { a: 2.7 }, armL: { a: 2.3 + wave } });
  holdUmb(ctx, t, hx, 505, GY - 410, 220, -0.05);
  if (ring > 0 && hx.jc.bell) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); for (let i = 0; i < 3; i++) { const u = ((lt - bell) * 0.9 + i / 3) % 1; ctx.strokeStyle = `rgba(247,211,58,${(1 - u) * ring})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(hx.jc.bell.x, hx.jc.bell.y, 16 + u * 70, -2.2, -0.9); ctx.stroke(); } ctx.restore(); }
};
