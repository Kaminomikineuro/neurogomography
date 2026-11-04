// The eight paintings of the scroll. Each draws in local coords (0..1920 × 0..1080 when the camera is centred on
// it; it may spill ±140 px into the mist gutters). lt = seconds since the section's scene began (may be negative
// while the camera pans in). env.L(f, fn) draws a parallax layer (f < 1 far, f > 1 near); env.lines = start times
// (lt) of the letter lines on this section, so the pictures can react to the words.
import { clamp, lerp, invLerp, seg, E, TAU, rng } from '../lib/mg.js';
import { C, rgba, brush, line, wash, glow, ridge, mountain, mistBand, ripples, spline } from '../lib/ink.js';
import { figure, handPos, armPoint, cat, lotus, leaf, stem, plum, lantern, pumpkin, bat } from '../lib/figures.js';

const RID = {}; const R = (k, ...a) => RID[k] || (RID[k] = ridge(...a)); // cached ridges

// ---------- shared bits ----------
function pond(ctx, lt, items, seed) { // items: [x, y, r] leaves then flowers handled by caller
  const r = rng(seed);
  for (const [x, y, rr] of items) leaf(ctx, x, y, rr, { a: 0.35 + r() * 0.25, seed: Math.round(x + y), tilt: (r() - 0.5) * 0.2 });
}
function flower(ctx, lt, x, y, s, t0, seed, stemLen = 90, tint = C.purple) {
  stem(ctx, x, y + stemLen, x, y, (seed % 3 - 1) * 10, 0.55, 2.2 + s * 1.4);
  const open = 0.15 + 0.85 * seg(lt, t0, t0 + 2.6, E.out);
  lotus(ctx, x, y, s * (0.85 + 0.15 * open), open, { seed, tint, rotA: Math.sin(lt * 0.9 + seed) * 0.03 });
}
function cloudCurl(ctx, x, y, s, a = 0.9, seed = 1) { // Gusu Lan cloud motif: a chain of spirals
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  glow(ctx, 0, 0, 70, '#FFFFFF', 0.5 * a, { sx: 1.6, sy: 0.6 });
  const sp = (cx, cy, r, dir) => { const P = []; for (let i = 0; i <= 26; i++) { const k = i / 26, an = dir * (k * TAU * 1.15) + Math.PI, rr = r * (1 - k * 0.78); P.push([cx + Math.cos(an) * rr, cy + Math.sin(an) * rr]); } return P; };
  ctx.fillStyle = rgba('#FBF8F1', 0.85 * a); ctx.beginPath(); ctx.ellipse(0, 4, 62, 18, 0, 0, TAU); ctx.fill();
  for (const [cx, cy, r, d] of [[-34, -2, 18, 1], [0, -10, 24, -1], [36, -1, 17, 1]]) { ctx.fillStyle = rgba('#FBF8F1', 0.9 * a); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); brush(ctx, sp(cx, cy, r, d), 2.6, { color: C.blue, alpha: 0.8 * a, step: 1.2, dry: 0.3, seed: seed + cx }); }
  brush(ctx, [[-64, 8], [-20, 20], [30, 18], [66, 6]], 2.2, { color: C.blue, alpha: 0.6 * a, step: 1.5, seed: seed + 9 });
  ctx.restore();
}
function sealSpot() {}

// ================= Lotus Pier (Пристань Лотоса): «Дорогой муж…» =================
export function pier(ctx, lt, env) {
  const { L } = env;
  L(0.5, () => { mountain(ctx, R('1a', 1, -300, 2300, 610, 250, 4), 660, C.lav, 0.5, { lw: 5, la: 0.55, seed: 1, ridgeColor: C.purpleD }); });
  L(0.62, () => { mountain(ctx, R('1b', 2, -300, 2300, 640, 140, 5), 690, C.inkS, 0.28, { lw: 4, la: 0.45, seed: 2 }); mistBand(ctx, -300, 2300, 650, 130, 0.85, lt, 3); });
  L(0.85, () => { ripples(ctx, -300, 2300, 690, 1080, lt, 4, C.blueD, 0.2); });
  L(1, () => {
    // pavilion on the pier
    const px = 270, py = 712;
    for (const k of [-1, -0.35, 0.35, 1]) brush(ctx, [[px + k * 150, py], [px + k * 150, py - 190]], 7, { seed: 40 + k * 10, dry: 0.3 });
    ctx.fillStyle = rgba(C.inkS, 0.22); ctx.fillRect(px - 150, py - 190, 300, 26);
    const roof = (y0, w, hgt, s) => { // concave slopes, a flat ridge, eaves curling up at the tips
      ctx.fillStyle = rgba(C.ink, 0.85); ctx.beginPath(); ctx.moveTo(px - w, y0 - hgt * 0.32);
      ctx.quadraticCurveTo(px - w * 0.62, y0 - hgt * 0.12, px - w * 0.3, y0 - hgt); ctx.lineTo(px + w * 0.3, y0 - hgt); ctx.quadraticCurveTo(px + w * 0.62, y0 - hgt * 0.12, px + w, y0 - hgt * 0.32);
      ctx.quadraticCurveTo(px + w * 0.82, y0 + 2, px + w * 0.66, y0); ctx.lineTo(px - w * 0.66, y0); ctx.quadraticCurveTo(px - w * 0.82, y0 + 2, px - w, y0 - hgt * 0.32); ctx.fill();
      ctx.save(); ctx.clip(); for (let i = -8; i <= 8; i++) line(ctx, [[px + i * w * 0.075, y0 - hgt], [px + i * w * 0.11, y0]], 1.5, C.paper, 0.18); ctx.restore();
      brush(ctx, [[px - w - 8, y0 - hgt * 0.36], [px - w * 0.7, y0 - 2], [px, y0 + 2], [px + w * 0.7, y0 - 2], [px + w + 8, y0 - hgt * 0.36]], 6, { seed: s, dry: 0.5 });
      brush(ctx, [[px - w * 0.34, y0 - hgt - 4], [px + w * 0.34, y0 - hgt - 4]], 7, { seed: s + 1 });
      for (const k of [-1, 1]) brush(ctx, [[px + k * w * 0.3, y0 - hgt - 4], [px + k * w * 0.36, y0 - hgt - 18], [px + k * w * 0.4, y0 - hgt - 20]], 4, { seed: s + 2 + k }); };
    roof(py - 186, 240, 96, 5); roof(py - 300, 140, 64, 6); for (const k of [-1, 1]) brush(ctx, [[px + k * 90, py - 300], [px + k * 92, py - 196]], 5, { seed: 47 + k });
    line(ctx, [[px - 150, py - 60], [px + 150, py - 60]], 3, C.ink, 0.6);
    for (let i = 0; i < 9; i++) line(ctx, [[px - 150 + i * 37.5, py - 60], [px - 150 + i * 37.5, py]], 2, C.ink, 0.45);
    // pier deck + posts with reflections
    brush(ctx, [[-180, py], [600, py - 2], [1260, py + 2]], 10, { seed: 51, dry: 0.4 }); brush(ctx, [[-180, py + 18], [700, py + 17], [1240, py + 20]], 5, { seed: 52, dry: 0.7, alpha: 0.6 });
    for (let x = -120; x < 1240; x += 120) { brush(ctx, [[x, py + 16], [x + 2, py + 80]], 7, { seed: x, alpha: 0.8 }); line(ctx, [[x, py + 90], [x + 3, py + 130]], 4, C.ink, 0.12); }
    // purple banners of Yunmeng Jiang, rippling
    for (const [bx, k] of [[640, 0], [780, 1], [920, 2]]) {
      brush(ctx, [[bx, py], [bx, 380]], 5, { seed: 60 + k, dry: 0.2 }); line(ctx, [[bx - 6, 392], [bx + 70, 392]], 4, C.ink, 0.8);
      const wv = y => Math.sin(lt * 3.2 + k * 1.3 - y * 0.035) * 9 * (y - 392) / 190;
      ctx.beginPath(); for (let y = 392; y <= 582; y += 6) ctx.lineTo(bx + 4 + wv(y), y); for (let y = 582; y >= 392; y -= 6) ctx.lineTo(bx + 66 + wv(y) * 1.2, y); ctx.closePath();
      ctx.fillStyle = rgba(C.purple, 0.9); ctx.fill(); ctx.strokeStyle = rgba(C.purpleD, 0.8); ctx.lineWidth = 2; ctx.stroke();
      lotus(ctx, bx + 35 + wv(480), 500, 0.62, 1, { tint: C.lav, base: C.lav, seed: 70 + k, alpha: 0.95 });
      for (let i = 0; i < 6; i++) line(ctx, [[bx + 8 + i * 11 + wv(582), 584], [bx + 8 + i * 11 + wv(600) * 1.2, 600]], 2, C.purpleD, 0.8);
    }
    figure(ctx, { who: 'jc', x: 1060, y: py, h: 240, face: 1, t: lt, wind: 1.1, seed: 3 });
  });
  L(1.14, () => {
    pond(ctx, lt, [[1250, 905, 120], [1500, 860, 100], [1760, 930, 150], [1990, 860, 110], [1380, 1010, 160], [1700, 1050, 130], [2100, 1000, 140], [-80, 1010, 170], [180, 1060, 120]], 8);
    const F = [[1330, 800, 1.4, 0.2], [1560, 760, 1.1, 0.9], [1840, 820, 1.7, 0.5], [2020, 760, 1.0, 1.6], [1470, 930, 1.9, 1.2], [60, 900, 1.6, 2.2], [1960, 980, 1.3, 2.8]];
    F.forEach(([x, y, s, t0], i) => flower(ctx, lt, x, y, s, t0, 100 + i, 80 + s * 30));
    leaf(ctx, 140, 1110, 260, { a: 0.72, sy: 0.4, seed: 19, color: C.ink }); // dark ink accent in the corner
    for (let i = 0; i < 7; i++) brush(ctx, [[-60 + i * 36, 1090], [-50 + i * 40 + Math.sin(lt + i) * 6, 860 - i * 18]], 4, { seed: 500 + i, alpha: 0.7, dry: 0.6 });
  });
}

// small shared drawings
function leafShape(ctx, x, y, len, a, seed = 1, col = '#3F4A3C') { // pointed leaf with a pale midrib
  ctx.save(); ctx.translate(x, y); ctx.rotate(a); const g = ctx.createLinearGradient(0, -len * 0.3, 0, len * 0.3); g.addColorStop(0, rgba(col, 0.95)); g.addColorStop(1, rgba(col, 0.7));
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.45, -len * 0.32, len, 0); ctx.quadraticCurveTo(len * 0.45, len * 0.3, 0, 0); ctx.fill();
  line(ctx, [[len * 0.05, 0], [len * 0.92, 0]], Math.max(1, len * 0.03), '#F2EBDD', 0.4); ctx.restore();
}
function heart(ctx, x, y, s, color = C.red, a = 0.95) { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = rgba(color, a); ctx.beginPath(); ctx.moveTo(0, 14); ctx.bezierCurveTo(-34, -8, -18, -34, 0, -16); ctx.bezierCurveTo(18, -34, 34, -8, 0, 14); ctx.fill(); ctx.restore(); }
function nightSky(ctx, lt, seed, h = 880) {
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, rgba(C.nightD, 0.98)); g.addColorStop(0.75, rgba(C.night, 0.95)); g.addColorStop(0.9, rgba(C.night, 0.6)); g.addColorStop(1, rgba(C.night, 0));
  ctx.fillStyle = g; ctx.fillRect(-400, 0, 2800, h);
  for (let i = 0; i < 7; i++) wash(ctx, -200 + i * 380, 180 + (i % 3) * 140, 280, '#2E2840', 0.45, { seed: seed + i, sy: 0.55 });
  const r = rng(seed + 50);
  for (let i = 0; i < 240; i++) { const x = -300 + r() * 2600, y = r() * h * 0.85, s = r() < 0.08 ? 2.6 : 0.8 + r() * 1.4, tw = 0.55 + 0.45 * Math.sin(lt * (1 + r() * 3) + i);
    ctx.fillStyle = rgba(r() < 0.15 ? C.goldL : '#FFFFFF', 0.85 * tw); ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill(); if (s > 2) glow(ctx, x, y, 12, '#FFFFFF', 0.25 * tw); }
}
function sparkle(ctx, x, y, r, a, rotA = 0, color = '#FFFFFF') { // four-point star
  ctx.save(); ctx.translate(x, y); ctx.rotate(rotA); ctx.fillStyle = rgba(color, a); ctx.beginPath();
  for (let i = 0; i < 8; i++) { const an = i / 8 * TAU, rr = i % 2 ? r * 0.18 : r; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } ctx.closePath(); ctx.fill(); ctx.restore();
}

// ================= The Taurids: winter rests, the brightest, rarest stars fall =================
const METEORS = (() => { const r = rng(777), M = []; let t = 0.3; while (t < 29.5) { const big = r() < 0.25; M.push({ t, x: 350 + r() * 1700, y: -30 + r() * 300, a: 0.45 + r() * 0.35, L: big ? 520 + r() * 260 : 260 + r() * 220, v: big ? 560 : 760 + r() * 320, life: big ? 1.9 : 1.1 + r() * 0.5, big }); t += 0.3 + r() * 0.55; } return M; })();
export const STAR = { t0: 22.0, t1: 26.4 };
export function taurids(ctx, lt, env) {
  const { L } = env;
  L(0.35, () => {
    nightSky(ctx, lt, 900);
    for (let i = 0; i < 40; i++) { const k = i / 40; glow(ctx, lerp(300, 2100, k), lerp(80, 520, k) + Math.sin(i) * 40, 110, C.lav, 0.06); } // milky way
    for (const m of METEORS) { // slow bright Taurid fireballs from the upper left
      const age = lt - m.t; if (age < 0 || age > m.life) continue; const p = age / m.life, f = Math.sin(p * Math.PI);
      const hx = m.x + Math.cos(m.a) * m.v * age, hy = m.y + Math.sin(m.a) * m.v * age, tx = hx - Math.cos(m.a) * m.L * Math.min(1, p * 2.2), ty = hy - Math.sin(m.a) * m.L * Math.min(1, p * 2.2);
      const g = ctx.createLinearGradient(tx, ty, hx, hy); g.addColorStop(0, 'rgba(255,240,200,0)'); g.addColorStop(1, `rgba(255,246,220,${0.9 * f})`);
      ctx.strokeStyle = g; ctx.lineWidth = m.big ? 7 : 3.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
      glow(ctx, hx, hy, m.big ? 46 : 22, C.goldL, 0.8 * f); ctx.fillStyle = rgba('#FFFFFF', f); ctx.beginPath(); ctx.arc(hx, hy, m.big ? 4.5 : 2.4, 0, TAU); ctx.fill();
    }
  });
  L(0.6, () => { // snowy peaks, white against the night
    const P = R('ta', 91, -300, 2300, 820, 330, 5); ctx.fillStyle = rgba(C.paper, 0.96); ctx.beginPath(); ctx.moveTo(-300, 900); P.forEach(p => ctx.lineTo(p[0], p[1])); ctx.lineTo(2300, 900); ctx.fill();
    mountain(ctx, P, 900, C.blueL, 0.28, { lw: 5, la: 0.7, seed: 91, ridgeColor: C.inkS, cun: 0.7 });
    mistBand(ctx, -300, 2300, 820, 90, 0.7, lt, 92);
  });
  L(0.85, () => { wash(ctx, 900, 880, 900, C.blueL, 0.35, { sy: 0.07, seed: 93 }); ripples(ctx, -300, 2300, 860, 920, lt, 94, C.blueD, 0.18); });
  L(1, () => {
    ctx.fillStyle = C.paper; ctx.beginPath(); ctx.moveTo(1100, 1100); ctx.quadraticCurveTo(1400, 820, 1700, 860); ctx.quadraticCurveTo(1950, 880, 2200, 840); ctx.lineTo(2200, 1100); ctx.fill();
    brush(ctx, [[1100, 1090], [1300, 900], [1500, 840], [1700, 858], [2100, 846]], 5, { seed: 95, alpha: 0.5, dry: 0.8 });
    for (const [x, y, s] of [[1820, 860, 1], [1950, 850, 0.8], [960, 1000, 0.9]]) { // bare winter trees with snow
      brush(ctx, [[x, y], [x + 6 * s, y - 160 * s], [x - 4 * s, y - 300 * s]], 14 * s, { seed: x, dry: 0.7, end: 0.4 });
      const r = rng(x); for (let i = 0; i < 6; i++) { const yy = y - (90 + i * 36) * s, d = i % 2 ? 1 : -1, l = (70 + r() * 60) * s; brush(ctx, [[x + 2, yy], [x + d * l * 0.6, yy - l * 0.4], [x + d * l, yy - l * 0.75]], 5 * s, { seed: x + i, dry: 0.7 }); line(ctx, [[x + d * l * 0.2, yy - 8], [x + d * l * 0.6, yy - l * 0.4 - 6]], 3 * s, C.paper, 0.9); }
    }
    // the two of them on the hill, looking up; he points at the sky, then a star comes down into Wanyin's hands
    const pt = seg(lt, 4.5, 5.5, E.inOut) * (1 - seg(lt, 9, 10, E.inOut)), recv = seg(lt, STAR.t1 - 1.6, STAR.t1 - 0.3, E.inOut);
    const XC = { who: 'xc', x: 1400, y: 884, h: 250, face: -1, sit: true, t: lt, seed: 2, arm: lerp(0.12, -2.5, pt) };
    const JC = { who: 'jc', x: 1505, y: 888, h: 244, face: -1, sit: true, t: lt, seed: 4, arm: lerp(0.12, -1.1, recv), lean: -0.06 * recv };
    figure(ctx, JC); figure(ctx, XC);
    const hp = armPoint(JC, [2.5, 33]), sp = seg(lt, STAR.t0, STAR.t1, E.inOut);
    if (lt > STAR.t0 - 1) {
      const a0 = seg(lt, STAR.t0 - 1, STAR.t0, E.out), x = lerp(780, hp[0], sp) + Math.sin(sp * Math.PI) * -160, y = lerp(150, hp[1] - 10, sp) - Math.sin(sp * Math.PI) * 40;
      const pulse = 1 + 0.15 * Math.sin(lt * 4);
      glow(ctx, x, y, (70 + 40 * (lt > STAR.t1 ? 1 : 0)) * pulse, C.lav, 0.55 * a0); glow(ctx, x, y, 28 * pulse, C.goldL, 0.9 * a0);
      sparkle(ctx, x, y, 34 * pulse, 0.95 * a0, lt * 0.6); sparkle(ctx, x, y, 18, 0.9 * a0, -lt * 0.9 + 0.4, C.lav);
      if (sp > 0 && sp < 1) for (let i = 1; i < 14; i++) { const q = Math.max(0, sp - i * 0.012), tx = lerp(780, hp[0], q) + Math.sin(q * Math.PI) * -160, ty = lerp(150, hp[1] - 10, q) - Math.sin(q * Math.PI) * 40; glow(ctx, tx, ty, 10 - i * 0.5, C.lav, 0.5 * (1 - i / 14)); }
    }
  });
  L(1.12, () => { const r = rng(96); for (let i = 0; i < 90; i++) { const sp = 22 + r() * 40, x = -300 + ((r() * 2600 + Math.sin(lt * 0.5 + i) * 18) % 2600), y = ((r() * 1180 + lt * sp) % 1180) - 50; ctx.fillStyle = rgba('#FFFFFF', 0.7); ctx.beginPath(); ctx.arc(x, y, 1.4 + r() * 2.4, 0, TAU); ctx.fill(); } });
}

// ================= «Солнце всей моей жизни»: a red sun rises, two cranes =================
function crane(ctx, x, y, s, t, seed) {
  const f = Math.sin(t * 5 + seed); ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  brush(ctx, [[-40, 2], [0, 0], [34, -4], [52, -10]], 4, { seed, alpha: 0.9, end: 0.2, dry: 0 }); // body + neck
  ctx.fillStyle = rgba(C.red, 0.95); ctx.beginPath(); ctx.arc(53, -11, 2.4, 0, TAU); ctx.fill();
  line(ctx, [[-30, 2], [-70, 8]], 1.4, C.ink, 0.8); // legs
  for (const k of [1, -0.7]) { ctx.fillStyle = rgba(k > 0 ? '#FBF8F1' : C.paperD, 0.95); ctx.beginPath(); ctx.moveTo(-8, 0); ctx.quadraticCurveTo(-4, -30 * f * k, 18, -46 * f * k); ctx.quadraticCurveTo(14, -16 * f * k, 14, 0); ctx.closePath(); ctx.fill(); line(ctx, [[-8, 0], [-4, -30 * f * k], [18, -46 * f * k]], 1.2, C.ink, 0.8); ctx.fillStyle = rgba(C.ink, 0.85); ctx.beginPath(); ctx.moveTo(10, -38 * f * k); ctx.lineTo(18, -46 * f * k); ctx.lineTo(15, -30 * f * k); ctx.fill(); }
  ctx.restore();
}
export function sun(ctx, lt, env) {
  const { L } = env, rise = seg(lt, -0.5, 5.5, E.out), sy = lerp(800, 420, rise);
  L(0.4, () => { glow(ctx, 1250, sy, 620, C.gold, 0.32 * rise + 0.08); glow(ctx, 1250, sy, 260, C.goldL, 0.5 * rise);
    const g = ctx.createRadialGradient(1250, sy, 100, 1250, sy, 152); g.addColorStop(0, rgba('#C8402E', 0.96)); g.addColorStop(0.9, rgba('#C8402E', 0.92)); g.addColorStop(1, rgba('#C8402E', 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(1250, sy, 152, 0, TAU); ctx.fill(); });
  L(0.55, () => { mountain(ctx, R('su1', 102, -300, 2300, 760, 300, 4), 820, C.lav, 0.55, { lw: 5, la: 0.6, seed: 102, ridgeColor: C.purpleD }); mistBand(ctx, -300, 2300, 770, 120, 0.85, lt, 103); });
  L(0.75, () => { mountain(ctx, R('su2', 104, -300, 2300, 880, 260, 5), 940, C.inkS, 0.45, { lw: 6, la: 0.75, seed: 104 }); mistBand(ctx, -300, 2300, 900, 120, 0.9, lt, 105); });
  L(1, () => { for (const [k, dx, dy] of [[0, 0, 0], [1, 120, 40]]) crane(ctx, lerp(150, 1800, clamp((lt + 0.5) / 8)) + dx * 1.4, 470 + dy + Math.sin(lt * 1.2 + k) * 12, 1.8 - k * 0.12, lt, 110 + k); });
  L(1.15, () => { brush(ctx, [[1650, 1100], [1700, 900], [1820, 760], [2000, 700]], 20, { seed: 106, dry: 0.7, end: 0.4 }); for (let i = 0; i < 6; i++) brush(ctx, [[1700 + i * 50, 880 - i * 30], [1680 + i * 50, 820 - i * 30]], 7, { seed: 107 + i, color: C.inkS, alpha: 0.7, dry: 0.5 }); });
}

// ================= «Моя колючка»: thorny branch blooming, sweatshirt, a fallen pin, socks =================
function pin(ctx, x, y, a, s = 1, head = C.pink) { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(s, s); line(ctx, [[0, 0], [52, 0]], 2.2, '#8A8794', 0.95); ctx.fillStyle = head; ctx.beginPath(); ctx.arc(-2, 0, 6.5, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(-4, -2, 2, 0, TAU); ctx.fill(); ctx.restore(); }
export function thorn(ctx, lt, env) {
  const { L } = env;
  L(1, () => {
    wash(ctx, 470, 900, 360, C.paperD, 0.6, { sy: 0.25, seed: 5 }); wash(ctx, 1500, 920, 320, C.paperD, 0.55, { sy: 0.22, seed: 6 });
    const sx = 450, sy = 770, beat = lt > 4 ? 1 + 0.1 * Math.max(0, Math.sin((lt - 4) * 6)) : 1;
    const SH = [[sx - 150, sy - 160], [sx - 60, sy - 182], [sx + 60, sy - 182], [sx + 150, sy - 160], [sx + 300, sy + 40], [sx + 240, sy + 84], [sx + 150, sy - 30], [sx + 150, sy + 170], [sx - 150, sy + 170], [sx - 150, sy - 30], [sx - 240, sy + 84], [sx - 300, sy + 40]];
    ctx.fillStyle = rgba(C.lav, 0.95); ctx.beginPath(); SH.forEach(p => ctx.lineTo(p[0], p[1])); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.clip(); wash(ctx, sx - 40, sy + 30, 280, C.purpleL, 0.5, { sy: 0.8, seed: 9 }); ctx.fillStyle = rgba(C.purple, 0.55); ctx.fillRect(sx - 150, sy + 140, 300, 30);
    ctx.save(); ctx.translate(sx - 270, sy + 62); ctx.rotate(-0.72); ctx.fillRect(-46, -14, 92, 26); ctx.restore(); ctx.save(); ctx.translate(sx + 270, sy + 62); ctx.rotate(0.72); ctx.fillRect(-46, -14, 92, 26); ctx.restore(); ctx.restore();
    brush(ctx, [...SH, SH[0]], 4.5, { seed: 91, dry: 0.35, step: 6, start: 0.02, end: 0.05 });
    ctx.fillStyle = rgba(C.purple, 0.85); ctx.beginPath(); ctx.ellipse(sx, sy - 176, 66, 20, 0, 0, Math.PI); ctx.fill(); brush(ctx, [[sx - 66, sy - 178], [sx, sy - 150], [sx + 66, sy - 178]], 4, { seed: 94 });
    for (let i = 0; i < 9; i++) line(ctx, [[sx - 140 + i * 35, sy + 144], [sx - 140 + i * 35, sy + 166]], 2, C.purpleD, 0.5);
    heart(ctx, sx + 62, sy - 92, beat);
    const sock = (x, y, a, seed) => { ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = rgba(C.pale, 0.95); ctx.beginPath(); ctx.moveTo(-40, -150); ctx.lineTo(40, -150); ctx.lineTo(42, 20); ctx.quadraticCurveTo(140, 22, 150, 60); ctx.quadraticCurveTo(150, 92, 100, 92); ctx.lineTo(-10, 92); ctx.quadraticCurveTo(-44, 90, -42, 40); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.clip(); wash(ctx, 40, 40, 110, C.blueL, 0.55, { seed }); ctx.fillStyle = rgba(C.purple, 0.75); ctx.fillRect(-45, -150, 90, 18); ctx.fillRect(-45, -120, 90, 9); ctx.restore();
      brush(ctx, [[-40, -150], [-42, 40], [-10, 92], [100, 92], [150, 60], [140, 22], [42, 20], [40, -150]], 3.5, { seed: seed + 1, dry: 0.4 });
      lotus(ctx, 0, -60, 0.55, 1, { tint: C.purple, seed: seed + 3 }); ctx.restore(); };
    sock(1420, 860, -0.25, 101); sock(1600, 900, 0.18, 111);
    pin(ctx, 1030, 940, 0.3, 1, C.lav); // one already lies here
    const tf = 2.0, p = invLerp(tf, tf + 0.75, lt), bounce = p >= 1 ? Math.exp(-(lt - tf - 0.75) * 9) * Math.abs(Math.sin((lt - tf - 0.75) * 22)) * 18 : 0;
    pin(ctx, lerp(940, 880, p), lerp(-60, 880, E.in(p)) - bounce, lt < tf ? 1.3 : lerp(1.3, -0.4, Math.min(1, p * 1.2)) + p * 5 * (1 - p), 1, C.pink);
  });
  L(1.16, () => { // the thorny branch: thorns first, then a plum blossom opens under each
    const main = [[-200, 210], [40, 270], [260, 255], [470, 320], [700, 300]];
    brush(ctx, main, 22, { seed: 41, dry: 0.6, end: 0.55 });
    brush(ctx, [[150, 262], [230, 180], [300, 150]], 9, { seed: 42, dry: 0.7 }); brush(ctx, [[360, 282], [420, 380], [470, 420]], 8, { seed: 43, dry: 0.7 });
    const P = spline(main, 10), r = rng(44);
    for (let i = 4; i < P.length - 2; i += 6) { const [x, y] = P[i], up = (i / 6) % 2 ? -1 : 1, sz = 14 + r() * 8;
      ctx.fillStyle = rgba(C.ink, 0.88); ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 3, y + up * sz); ctx.lineTo(x + 7, y); ctx.closePath(); ctx.fill();
      plum(ctx, x + 2, y + up * (sz + 6), 2.4 + r() * 0.8, seg(lt, 2.6 + (i / P.length) * 2.0, 3.3 + (i / P.length) * 2.0, E.linear), 50 + i); }
  });
}

// ================= «Мой чеширский кот, которого надо чесать за ушком» =================
export function cheshire(ctx, lt, env) {
  const { L } = env;
  L(0.55, () => {
    glow(ctx, 1520, 300, 360, C.inkS, 0.16); glow(ctx, 1520, 300, 250, '#FFF7DD', 0.9);
    ctx.fillStyle = rgba('#F8EFD3', 0.95); ctx.beginPath(); ctx.arc(1520, 300, 190, 0, TAU); ctx.fill();
    wash(ctx, 1460, 250, 50, C.paperD, 0.6, { seed: 3 }); wash(ctx, 1590, 350, 34, C.paperD, 0.5, { seed: 4 }); wash(ctx, 1560, 220, 22, C.paperD, 0.5, { seed: 5 });
    for (let i = 0; i < 3; i++) { const p = ((lt * 0.1 + i * 0.33) % 1); bat(ctx, lerp(1900, 1150, p), 160 + i * 50 + Math.sin(p * 12 + i) * 30, 2.2 - i * 0.4, lt, i + 1); }
  });
  L(0.8, () => { mountain(ctx, R('4a', 41, -300, 2300, 860, 120, 6), 900, C.inkS, 0.2, { lw: 3, la: 0.35, seed: 41 }); });
  L(1, () => {
    brush(ctx, [[-200, 905], [600, 896], [1300, 908], [2200, 900]], 6, { seed: 42, dry: 0.8, alpha: 0.55 });
    for (let i = 0; i < 18; i++) { const x = -100 + i * 130; brush(ctx, [[x, 905], [x - 6, 880]], 3, { seed: 60 + i, alpha: 0.5 }); brush(ctx, [[x + 8, 905], [x + 14, 884]], 3, { seed: 80 + i, alpha: 0.5 }); }
    pumpkin(ctx, 680, 875, 46, lt, 1); pumpkin(ctx, 1740, 885, 34, lt, 2); pumpkin(ctx, 760, 892, 24, lt, 3);
    const tx = 960, ty = 896;
    ctx.fillStyle = '#FBF8F1'; ctx.beginPath(); ctx.ellipse(tx, ty - 34, 40, 34, 0, 0, TAU); ctx.fill(); brush(ctx, [[tx - 40, ty - 40], [tx - 30, ty - 6], [tx + 30, ty - 6], [tx + 40, ty - 40]], 3, { seed: 70 });
    line(ctx, [[tx + 38, ty - 40], [tx + 70, ty - 60], [tx + 78, ty - 72]], 4, C.red, 0.85); line(ctx, [[tx - 38, ty - 50], [tx - 62, ty - 40], [tx - 40, ty - 22]], 3.5, C.red, 0.8);
    ctx.fillStyle = rgba(C.red, 0.85); ctx.beginPath(); ctx.ellipse(tx, ty - 68, 16, 6, 0, 0, TAU); ctx.fill();
    for (const cx of [tx - 100, tx + 112]) { ctx.fillStyle = '#FBF8F1'; ctx.beginPath(); ctx.moveTo(cx - 18, ty - 26); ctx.lineTo(cx + 18, ty - 26); ctx.quadraticCurveTo(cx + 16, ty - 4, cx, ty - 2); ctx.quadraticCurveTo(cx - 16, ty - 4, cx - 18, ty - 26); ctx.fill(); line(ctx, [[cx - 18, ty - 26], [cx, ty - 2], [cx + 18, ty - 26]], 2, C.red, 0.85); line(ctx, [[cx - 26, ty], [cx + 26, ty]], 2.5, C.red, 0.7); }
    for (let k = 0; k < 3; k++) { const ph = lt * 0.8 + k; line(ctx, [[tx + 78 + Math.sin(ph) * 4, ty - 80], [tx + 88 + Math.sin(ph + 1) * 8, ty - 110], [tx + 80 + Math.sin(ph + 2) * 10, ty - 140 - k * 6]], 2, C.grey, 0.35); }
    brush(ctx, [[2200, 470], [1900, 520], [1640, 590], [1430, 612], [1360, 606]], 30, { seed: 91, dry: 0.6, end: 0.35 });
    brush(ctx, [[1800, 545], [1760, 450], [1700, 400]], 10, { seed: 92, dry: 0.7 }); brush(ctx, [[1600, 600], [1560, 680], [1520, 720]], 8, { seed: 93, dry: 0.8 });
    const catX = 1520, catY = 600, s = 4.2;
    const grinA = seg(lt, 0.1, 0.7, E.out), vis = seg(lt, 0.8, 2.2, E.inOut);
    const tR = 3.0, scratch = lt > tR + 0.9 && lt < 7.4, shut = seg(lt, tR + 1.1, tR + 1.6, E.out);
    cat(ctx, { x: catX, y: catY, s, t: lt, vis, grin: Math.max(grinA * (1 - vis), vis), shut, purr: shut });
    const ear = [catX - 18 * s, catY - 22 * s], h = 330, a = lerp(0.12, -2.0, seg(lt, tR, tR + 0.9, E.inOut)) + (scratch ? Math.sin(lt * 13) * 0.05 : 0);
    const probe = handPos({ x: 0, y: 820, h, face: 1, arm: -2.0 });
    figure(ctx, { who: 'xc', x: ear[0] - probe[0], y: 820, h, face: 1, t: lt, arm: a, hat: true, seed: 6 });
  });
}

// ================= «Мой инкубчик»: horns, wings, a beckoning hand; Xichen blushes =================
export function incubus(ctx, lt, env) {
  const { L } = env;
  L(0.6, () => { const g = ctx.createLinearGradient(400, 0, 2000, 0); g.addColorStop(0, rgba(C.pink, 0)); g.addColorStop(0.6, rgba(C.pink, 0.22)); g.addColorStop(1, rgba(C.purpleL, 0.35)); ctx.fillStyle = g; ctx.fillRect(-400, 0, 2800, 1010);
    ctx.fillStyle = rgba('#F8EFD3', 0.95); ctx.beginPath(); ctx.arc(1600, 230, 80, 0, TAU); ctx.fill(); ctx.fillStyle = rgba(C.paper, 1); ctx.beginPath(); ctx.arc(1635, 205, 70, 0, TAU); ctx.fill(); });
  L(1, () => {
    brush(ctx, [[-200, 1005], [900, 998], [2200, 1004]], 6, { seed: 122, dry: 0.8, alpha: 0.5 });
    const w = seg(lt, 0.4, 1.3, E.back), beck = lt > 1.4 && lt < 6.2;
    const JC = { who: 'jc', x: 1190, y: 1000, h: 430, face: -1, t: lt, seed: 4, horns: true, wings: clamp(w), tail: true, lean: -0.05, arm: beck ? -1.95 + 0.3 * Math.sin((lt - 1.4) * 6) : lerp(0.12, -1.95, seg(lt, 0.9, 1.4, E.out)) };
    const step = seg(lt, 3.6, 5.0, E.inOut), bl = seg(lt, 1.8, 3.0, E.out);
    const XC = { who: 'xc', x: 700 + 90 * step, y: 1000, h: 440, face: 1, t: lt, seed: 2, wind: 1 + 2 * bl, blush: bl, arm: lerp(0.12, -0.5, step) };
    figure(ctx, XC); figure(ctx, JC);
    for (let k = 0; k < 3; k++) { const q = ((lt - 2.2) * 0.6 + k * 0.33) % 1; if (lt < 2.2) continue; glow(ctx, XC.x + 10 + Math.sin(q * 6 + k) * 16, 600 - q * 140, 18 + q * 20, C.grey, 0.35 * Math.sin(q * Math.PI)); } // steam over his head
    for (let i = 0; i < 9; i++) { const t0 = 1.2 + i * 0.55, q = clamp((lt - t0) / 2.4); if (q <= 0 || q >= 1) continue; const hx = lerp(1080, 820 + 90 * step, q), hy = lerp(560, 520, q) - Math.sin(q * Math.PI) * 120 + Math.sin(q * 9 + i) * 10; heart(ctx, hx, hy, 0.6 + 0.3 * Math.sin(q * Math.PI), i % 2 ? C.red : C.pink, Math.sin(q * Math.PI)); }
  });
}

// ================= «Моя апельсинка»: Wanyin on top of a giant mandarin =================
function mandarin(ctx, x, y, r, seed, leafA = 1) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r); g.addColorStop(0, '#F7B865'); g.addColorStop(0.6, '#E58A2E'); g.addColorStop(1, '#C26A1F');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.9, 0, 0, TAU); ctx.fill();
  const R0 = rng(seed); for (let i = 0; i < r * 0.6; i++) { const an = R0() * TAU, d = Math.sqrt(R0()) * r * 0.85; ctx.fillStyle = rgba('#A9561A', 0.25); ctx.beginPath(); ctx.arc(x + Math.cos(an) * d, y + Math.sin(an) * d * 0.9, 1 + r * 0.01, 0, TAU); ctx.fill(); }
  glow(ctx, x - r * 0.4, y - r * 0.42, r * 0.28, '#FFF0D0', 0.6);
  ctx.strokeStyle = rgba('#7A3E12', 0.55); ctx.lineWidth = Math.max(1.5, r * 0.02); ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.9, 0, 0, TAU); ctx.stroke();
  ctx.fillStyle = rgba('#3F4A3C', 0.9); ctx.beginPath(); ctx.arc(x, y - r * 0.88, r * 0.07, 0, TAU); ctx.fill();
  if (leafA) leafShape(ctx, x + r * 0.02, y - r * 0.9, r * 0.55, -0.45, seed);
}
function wedge(ctx, x, y, s, a) { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(s, s); ctx.fillStyle = '#E58A2E'; ctx.beginPath(); ctx.moveTo(-34, 0); ctx.quadraticCurveTo(0, -38, 34, 0); ctx.quadraticCurveTo(0, -8, -34, 0); ctx.fill(); ctx.fillStyle = 'rgba(255,226,176,0.85)'; ctx.beginPath(); ctx.moveTo(-28, -2); ctx.quadraticCurveTo(0, -31, 28, -2); ctx.quadraticCurveTo(0, -10, -28, -2); ctx.fill(); ctx.restore(); }
export function orange(ctx, lt, env) {
  const { L } = env;
  L(0.6, () => { glow(ctx, 900, 600, 700, C.gold, 0.18); });
  L(0.85, () => { brush(ctx, [[2150, 60], [1900, 160], [1650, 210], [1420, 200]], 16, { seed: 130, dry: 0.6 });
    for (const [x, y, rr] of [[1700, 270, 54], [1520, 280, 46], [1880, 230, 50]]) { line(ctx, [[x, y - rr], [x + 4, y - rr - 30]], 3, C.ink, 0.7); mandarin(ctx, x, y + Math.sin(lt * 1.3 + x) * 3, rr, x, 0); }
    for (const [x, y, a] of [[1600, 200, -2.4], [1780, 170, -0.5], [1960, 150, -2.2], [1450, 190, -0.9], [1700, 180, -1.6]]) leafShape(ctx, x, y, 90, a, x); });
  L(1, () => {
    const cx = 900, cy = 790, r = 230; wash(ctx, cx, cy + r * 0.95, r * 1.2, C.paperD, 0.6, { sy: 0.18, seed: 131 });
    mandarin(ctx, cx, cy, r, 132);
    brush(ctx, [[cx + r * 0.85, cy + r * 0.55], [cx + r * 1.15, cy + r * 0.72], [cx + r * 1.25, cy + r * 0.92], [cx + r * 1.55, cy + r * 0.98]], 22, { color: '#E58A2E', alpha: 0.95, seed: 133, dry: 0, bleed: 0 }); // peel
    const hold = seg(lt, 1.6, 2.4, E.back);
    const JC = { who: 'jc', x: cx - 10, y: cy - r * 0.93, h: 180, face: 1, sit: true, t: lt, seed: 4, arm: lerp(0.12, -2.7, hold) };
    figure(ctx, JC);
    const hp = armPoint(JC); if (hold > 0) { ctx.save(); ctx.translate(hp[0], hp[1] - 18); ctx.rotate(Math.sin(lt * 2) * 0.1); ctx.fillStyle = rgba(C.orange, 0.95); ctx.beginPath(); ctx.arc(0, 0, 26, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.fillStyle = rgba('#FFE2B0', 0.9); ctx.beginPath(); ctx.arc(0, 0, 20, Math.PI, 0); ctx.closePath(); ctx.fill(); for (let i = 1; i < 6; i++) line(ctx, [[0, 0], [Math.cos(Math.PI + i / 6 * Math.PI) * 20, Math.sin(Math.PI + i / 6 * Math.PI) * 20]], 1.5, C.orange, 0.8); ctx.restore(); }
    for (let k = 0; k < 4; k++) wedge(ctx, [420, 1350, 560, 1460][k], [520, 560, 960, 980][k] + Math.sin(lt * 1.6 + k) * 14, 1.3, Math.sin(lt + k) * 0.3 + k);
  });
}

// ================= «Моя черничка»: blueberry sprig, berries drop into a bowl =================
function berry(ctx, x, y, r, seed) {
  wash(ctx, x, y, r, '#3A4378', 0.95, { seed, lobes: 2, rim: 0.35 }); wash(ctx, x - r * 0.1, y - r * 0.1, r * 0.8, C.purpleD, 0.4, { seed: seed + 1, lobes: 2 });
  glow(ctx, x - r * 0.35, y - r * 0.4, r * 0.4, C.pale, 0.55);
  ctx.strokeStyle = rgba(C.nightD, 0.85); ctx.lineWidth = Math.max(1, r * 0.08); ctx.beginPath(); for (let i = 0; i < 5; i++) { const an = i / 5 * TAU - Math.PI / 2; ctx.moveTo(x + r * 0.3 * Math.cos(an) * 0.2, y - r * 0.55 + r * 0.3 * Math.sin(an) * 0.2); ctx.lineTo(x + r * 0.22 * Math.cos(an), y - r * 0.55 + r * 0.22 * Math.sin(an)); } ctx.stroke();
}
export function berryScene(ctx, lt, env) {
  const { L } = env;
  L(0.9, () => { brush(ctx, [[-200, 120], [120, 220], [380, 260], [640, 330]], 12, { seed: 140, dry: 0.6 }); brush(ctx, [[250, 240], [330, 330], [360, 420]], 6, { seed: 141, dry: 0.7 });
    for (const [x, y, a] of [[120, 180, -2.6], [300, 300, 0.5], [520, 280, -0.6], [600, 360, 1.0], [80, 210, 0.4]]) leafShape(ctx, x, y, 80, a, x);
    for (const [x, y, r] of [[200, 270, 30], [240, 300, 26], [360, 440, 32], [400, 420, 24], [640, 390, 28], [610, 420, 22]]) { line(ctx, [[x, y - r], [x - 4, y - r - 18]], 2, C.ink, 0.7); berry(ctx, x, y, r, x + y); } });
  L(1, () => {
    const bx = 960, by = 860; wash(ctx, bx, by + 70, 320, C.paperD, 0.6, { sy: 0.15, seed: 142 });
    for (let i = 0; i < 16; i++) { const an = i / 16 * Math.PI, x = bx + Math.cos(an) * 170 * (0.3 + 0.7 * ((i * 7) % 5) / 5), y = by - 26 - Math.sin(an) * 30 - (i % 3) * 16; berry(ctx, x, y, 26, 150 + i); }
    for (let k = 0; k < 3; k++) { const t0 = 1.0 + k * 0.8, p = invLerp(t0, t0 + 0.6, lt), b = p >= 1 ? Math.exp(-(lt - t0 - 0.6) * 10) * Math.abs(Math.sin((lt - t0 - 0.6) * 20)) * 20 : 0;
      berry(ctx, lerp([360, 640, 400][k], bx - 60 + k * 60, p), lerp([440, 390, 420][k], by - 70 - (k % 2) * 14, E.in(p)) - b, 26, 170 + k); }
    ctx.fillStyle = '#FBF8F1'; ctx.beginPath(); ctx.moveTo(bx - 210, by - 20); ctx.quadraticCurveTo(bx, by + 190, bx + 210, by - 20); ctx.closePath(); ctx.fill();
    brush(ctx, [[bx - 212, by - 22], [bx - 120, by + 110], [bx, by + 140], [bx + 120, by + 110], [bx + 212, by - 22]], 4, { seed: 143, step: 4 }); line(ctx, [[bx - 210, by - 20], [bx + 210, by - 20]], 3, C.ink, 0.6);
    for (let i = 0; i < 5; i++) { const x = bx - 150 + i * 75; line(ctx, [[x, by + 30], [x + 12, by + 18], [x + 24, by + 30], [x + 12, by + 42], [x, by + 30]], 2.4, C.blue, 0.8); }
    const lift = seg(lt, 1.8, 2.6, E.back);
    const JC = { who: 'jc', x: 1380, y: 960, h: 300, face: -1, t: lt, seed: 4, arm: lerp(0.12, -2.7, lift) };
    figure(ctx, JC); const hp = armPoint(JC); if (lift > 0) berry(ctx, hp[0], hp[1] - 34, 36, 199);
  });
}

// ================= «Мой ролл»: Wanyin rolled into rice and nori, Xichen picks him up with chopsticks =================
export const ROLL = { x: 560, y: 1060, h: 520, grab: -1.0, lift: -1.85 };
export function roll(ctx, lt, env) {
  const { L } = env;
  L(0.7, () => { wash(ctx, 1200, 540, 700, C.paperD, 0.5, { sy: 0.5, seed: 160 }); });
  L(1, () => {
    const reach = seg(lt, 2.4, 3.4, E.inOut), up = seg(lt, 4.3, 5.9, E.inOut);
    const arm = lerp(0.12, ROLL.grab, reach) + (ROLL.lift - ROLL.grab) * up;
    const XC = { who: 'xc', x: ROLL.x, y: ROLL.y, h: ROLL.h, face: 1, t: lt, seed: 2, arm, chop: true, lean: 0.04 * up };
    const T1 = armPoint({ ...XC, arm: ROLL.grab, lean: 0 }, [5, 62]), tip = armPoint(XC, [5, 62]);
    // board, soy dish, ginger
    ctx.fillStyle = rgba('#C9A27A', 0.85); ctx.beginPath(); ctx.roundRect(T1[0] - 300, T1[1] + 62, 760, 70, 10); ctx.fill(); ctx.strokeStyle = rgba(C.ink, 0.75); ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(T1[0] - 300, T1[1] + 62, 760, 70, 10); ctx.stroke();
    for (let i = 0; i < 6; i++) line(ctx, [[T1[0] - 280 + i * 120, T1[1] + 80], [T1[0] - 200 + i * 120, T1[1] + 84]], 1.4, '#7A5A43', 0.5);
    ctx.fillStyle = '#FBF8F1'; ctx.beginPath(); ctx.ellipse(T1[0] + 360, T1[1] + 50, 60, 18, 0, 0, TAU); ctx.fill(); ctx.fillStyle = rgba('#3A2418', 0.9); ctx.beginPath(); ctx.ellipse(T1[0] + 360, T1[1] + 48, 46, 12, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 3; i++) wash(ctx, T1[0] + 250 + i * 14, T1[1] + 50 - i * 6, 18, C.pink, 0.8, { sx: 1.4, sy: 0.5, seed: 163 + i, lobes: 2 });
    // the roll follows the chopstick tips once they have it
    const at = lt < 3.4 ? T1 : tip, tilt = up * -0.35, flail = up > 0 && up < 1 ? Math.sin(lt * 22) * 0.12 : Math.sin(lt * 9) * 0.05 * (lt > 3.4 ? 1 : 0);
    figure(ctx, XC);
    ctx.save(); ctx.translate(at[0] + 4, at[1] + 2); ctx.rotate(tilt);
    ctx.fillStyle = rgba('#1E2A22', 0.95); ctx.beginPath(); ctx.roundRect(-170, -58, 300, 116, 50); ctx.fill(); // nori
    ctx.fillStyle = '#FBF8F1'; ctx.beginPath(); ctx.ellipse(-170, 0, 22, 58, 0, 0, TAU); ctx.fill(); const r = rng(164); for (let i = 0; i < 30; i++) { ctx.fillStyle = rgba(C.paperD, 0.9); ctx.beginPath(); ctx.ellipse(-170 + (r() - 0.5) * 30, (r() - 0.5) * 100, 4, 2, r() * 3, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#FBF8F1'; ctx.beginPath(); ctx.ellipse(130, 0, 26, 58, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 4; i++) line(ctx, [[-120 + i * 70, -56], [-120 + i * 70, 56]], 1.5, '#3B4A3F', 0.6);
    // Wanyin's head and ponytail out of the end, cross and flailing
    ctx.save(); ctx.translate(150, -10); ctx.rotate(flail);
    ctx.fillStyle = C.skin; ctx.beginPath(); ctx.ellipse(20, 0, 30, 33, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = rgba(C.ink, 0.95); ctx.beginPath(); ctx.moveTo(50, -6); ctx.bezierCurveTo(50, -46, -10, -48, -12, -6); ctx.quadraticCurveTo(8, -14, 22, -22); ctx.quadraticCurveTo(36, -14, 50, -6); ctx.fill();
    ctx.beginPath(); ctx.arc(16, -40, 13, 0, TAU); ctx.fill(); ctx.fillStyle = C.silver; ctx.fillRect(8, -58, 16, 9);
    brush(ctx, [[10, -46], [-14, -60], [-40, -54 + Math.sin(lt * 9) * 8], [-60, -40 + Math.sin(lt * 9 + 1) * 10]], 9, { seed: 165, end: 0.7, dry: 0.3 });
    line(ctx, [[6, -6], [18, -2]], 2.6, C.ink, 0.9); line(ctx, [[30, -2], [42, -6]], 2.6, C.ink, 0.9); line(ctx, [[14, 16], [22, 13], [30, 16]], 2.2, C.ink, 0.85); // frown
    ctx.strokeStyle = rgba(C.purple, 0.95); ctx.lineWidth = 4; ctx.beginPath(); for (const [a, b] of [[[54, -40], [64, -30]], [[64, -40], [54, -30]]]) { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); } ctx.stroke(); // anger mark
    ctx.restore();
    ctx.restore();
    if (lt > 3.4) for (let k = 0; k < 4; k++) { const q = ((lt - 3.4) * 0.9 + k * 0.25) % 1; glow(ctx, at[0] + 190 + q * 60, at[1] - 60 - q * 90, 14 + q * 18, C.grey, 0.4 * Math.sin(q * Math.PI)); }
  });
}

// ================= «Мой дом» → «Моё сердце»: by the fire; a blue Lan heart burns in it =================
export const FIRE = { x: 1250, y: 760 };
function flame(ctx, x, y, w, h, t, seed, cols) {
  const r = rng(seed), n = 7;
  for (let layer = 0; layer < cols.length; layer++) { const k = 1 - layer * 0.28; ctx.fillStyle = cols[layer];
    for (let i = 0; i < n; i++) { const fx = x + (i - (n - 1) / 2) / n * w * k, fh = h * k * (0.55 + 0.45 * r()) * (0.85 + 0.15 * Math.sin(t * (8 + i) + seed + i)), sway = Math.sin(t * 6 + i * 1.7) * w * 0.05;
      ctx.beginPath(); ctx.moveTo(fx - w / n * 0.9 * k, y); ctx.quadraticCurveTo(fx - w / n * 0.7 * k + sway, y - fh * 0.55, fx + sway * 2, y - fh); ctx.quadraticCurveTo(fx + w / n * 0.7 * k + sway, y - fh * 0.5, fx + w / n * 0.9 * k, y); ctx.fill(); } }
}
export function home(ctx, lt, env) {
  const { L } = env;
  L(0.8, () => {
    wash(ctx, 960, 500, 900, C.paperD, 0.55, { sy: 0.6, seed: 170 }); glow(ctx, FIRE.x, FIRE.y, 820, C.gold, 0.28 + 0.04 * Math.sin(lt * 7));
    // window with snowy night
    ctx.fillStyle = rgba(C.night, 0.95); ctx.fillRect(170, 200, 300, 360); const r = rng(171); for (let i = 0; i < 40; i++) { const y = 200 + ((r() * 360 + lt * (20 + r() * 30)) % 360), x = 175 + r() * 290; ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(x, y, 1.5 + r() * 2, 0, TAU); ctx.fill(); }
    ctx.fillStyle = rgba(C.paper, 0.95); ctx.fillRect(170, 520, 300, 40); ctx.strokeStyle = rgba(C.ink, 0.85); ctx.lineWidth = 7; ctx.strokeRect(165, 195, 310, 370); ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(320, 195); ctx.lineTo(320, 565); ctx.moveTo(165, 380); ctx.lineTo(475, 380); ctx.stroke();
  });
  L(1, () => {
    brush(ctx, [[-200, 905], [2200, 905]], 6, { seed: 173, alpha: 0.6, dry: 0.6 }); for (let i = 0; i < 10; i++) line(ctx, [[-100 + i * 240, 910], [-160 + i * 260, 1080]], 2, '#7A5A43', 0.3);
    // fireplace: stone frame, dark opening, logs, fire
    const fx = FIRE.x, fy = 900;
    ctx.fillStyle = rgba(C.paperD, 0.95); ctx.fillRect(fx - 320, fy - 560, 640, 560); ctx.fillStyle = rgba(C.inkS, 0.9); ctx.fillRect(fx - 360, fy - 590, 720, 40);
    const r = rng(174); for (let row = 0; row < 7; row++) for (let c = 0; c < 6; c++) { const x = fx - 320 + c * 107 + (row % 2) * 50, y = fy - 550 + row * 78; ctx.strokeStyle = rgba(C.inkS, 0.45); ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x + r() * 6, y + r() * 6, 96, 68, 12); ctx.stroke(); }
    ctx.fillStyle = rgba('#1A1418', 0.97); ctx.beginPath(); ctx.moveTo(fx - 200, fy); ctx.lineTo(fx - 200, fy - 260); ctx.quadraticCurveTo(fx, fy - 380, fx + 200, fy - 260); ctx.lineTo(fx + 200, fy); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = rgba(C.ink, 0.85); ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(fx - 200, fy); ctx.lineTo(fx - 200, fy - 260); ctx.quadraticCurveTo(fx, fy - 380, fx + 200, fy - 260); ctx.lineTo(fx + 200, fy); ctx.stroke();
    glow(ctx, fx, fy - 90, 260, C.orange, 0.5 + 0.06 * Math.sin(lt * 9));
    flame(ctx, fx, fy - 40, 300, 230, lt, 176, [rgba(C.orange, 0.9), rgba(C.gold, 0.9), rgba('#FFF3C9', 0.9)]);
    brush(ctx, [[fx - 140, fy - 30], [fx + 140, fy - 50]], 26, { color: '#4A3326', alpha: 0.95, seed: 177 }); brush(ctx, [[fx - 150, fy - 52], [fx + 130, fy - 26]], 24, { color: '#3A271D', alpha: 0.95, seed: 178 });
    // the blue Lan heart in the flames
    const hp = seg(lt, 9.0, 10.2, E.back), fl = 1 + 0.05 * Math.sin(lt * 10);
    if (hp > 0) { glow(ctx, FIRE.x, FIRE.y, 170 * hp, C.blueL, 0.7); ctx.save(); ctx.translate(FIRE.x, FIRE.y); ctx.scale(2.6 * hp * fl, 2.6 * hp / fl);
      const g = ctx.createRadialGradient(0, -4, 1, 0, -4, 32); g.addColorStop(0, 'rgba(255,255,255,0.98)'); g.addColorStop(0.45, rgba(C.blueL, 0.95)); g.addColorStop(1, rgba(C.blue, 0.95));
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 22); ctx.bezierCurveTo(-46, -6, -26, -44, 0, -20); ctx.bezierCurveTo(26, -44, 46, -6, 0, 22); ctx.fill(); ctx.restore();
      flame(ctx, FIRE.x, FIRE.y - 40 * hp, 70 * hp, 60 * hp, lt, 179, [rgba(C.blueL, 0.35)]); }
    for (let i = 0; i < 10; i++) { const q = ((lt * 0.5 + i * 0.1) % 1); ctx.fillStyle = rgba(hp > 0 && i % 2 ? C.blueL : C.goldL, 0.9 * (1 - q)); ctx.beginPath(); ctx.arc(fx + Math.sin(i * 3 + q * 6) * 80, fy - 120 - q * 320, 2.5, 0, TAU); ctx.fill(); }
    // mantel: a vase with a lotus, a candle
    lotus(ctx, fx - 220, fy - 600, 1.0, 1, { seed: 180 }); ctx.fillStyle = rgba(C.blue, 0.9); ctx.beginPath(); ctx.ellipse(fx - 220, fy - 610, 24, 30, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#FBF8F1'; ctx.fillRect(fx + 230, fy - 660, 22, 70); glow(ctx, fx + 241, fy - 672, 40, C.gold, 0.6); flame(ctx, fx + 241, fy - 660, 14, 26, lt, 181, [rgba(C.gold, 0.95)]);
    // rug + the two of them, warm side-light from the fire, Wanyin leaning on his shoulder
    wash(ctx, 820, 960, 420, C.purple, 0.55, { sy: 0.16, seed: 182 }); for (let i = 0; i < 8; i++) line(ctx, [[460 + i * 100, 1000], [470 + i * 100, 1014]], 3, C.purpleD, 0.6);
    figure(ctx, { who: 'xc', x: 760, y: 960, h: 300, face: 1, sit: true, t: lt, seed: 2, wind: 0.4 });
    figure(ctx, { who: 'jc', x: 860, y: 962, h: 292, face: 1, sit: true, t: lt, seed: 4, wind: 0.4, lean: -0.1 });
    glow(ctx, 900, 760, 260, C.gold, 0.18);
  });
}
