// figures.js — ink-painted figures and motifs: Lan Xichen (black with red accents, red forehead ribbon), Jiang Wanyin
// (Yunmeng purple, topknot, silver bell), the Cheshire cat, lotus, leaves, plum blossom, lanterns, pumpkins, bats.
// Figures are faceless, as in classical ink painting. Local units: height 100, feet at (0,0), facing +x.
import { clamp, lerp, E, TAU, rng } from './mg.js';
import { C, rgba, brush, wash, glow, line } from './ink.js';

const SHOULDER = [4, -78];
const rot = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
// a point on the front arm (sleeve frame: [2.5, 35] = the hand, [5, 62] = chopstick tips), in parent coordinates
export function armPoint(o, pt = [2.5, 35]) {
  const u = o.h / 100, a = o.arm ?? 0.12, hp = rot(pt, a), sit = o.sit ? 30 : 0;
  return [o.x + (o.face ?? 1) * u * (SHOULDER[0] + hp[0]), o.y + u * (SHOULDER[1] + sit + hp[1])];
}
export const handPos = o => armPoint(o);

// Lan Xichen now wears black with red accents (red forehead ribbon, sash, trim, clouds on the hem).
const XC = { robe: '#2F2B33', fold: '#5A5462', sleeve: '#4A4552', accent: C.red, ribbon: C.red };
export function figure(ctx, o) {
  const { who = 'xc', x, y, h, face = 1, t = 0, arm = 0.12, wind = 1, hat = false, alpha = 1, seed = 1, sit = false, turn = 1, cup = false,
    horns = false, wings = 0, tail = false, blush = 0, lean = 0, chop = false } = o;
  if (alpha <= 0) return;
  const u = h / 100, xc = who === 'xc';
  ctx.save(); ctx.translate(x, y); ctx.scale(face * u * turn, u); ctx.rotate(lean); ctx.globalAlpha *= alpha;
  const sw = Math.sin(t * 1.6 + seed) * wind, sw2 = Math.sin(t * 2.2 + seed * 1.7) * wind;
  const B = (pts, w, a = 0.85, extra = {}) => brush(ctx, pts, w, { alpha: a, seed: seed * 13 + pts.length + Math.round(pts[0][0] * 7), step: 0.8, dry: 0.4, ...extra });
  const robeC = xc ? XC.robe : C.purple, robeA = xc ? 0.97 : 0.9, wash2 = xc ? XC.sleeve : C.purpleD;
  const dy = sit ? 30 : 0; // seated: the upper body sinks, the robe pools
  // --- incubus wings (behind everything)
  if (wings > 0) {
    const fl = Math.sin(t * 3.2) * 0.18;
    for (const k of [1, 0.8]) { ctx.save(); ctx.translate(-3, -74 + dy); ctx.rotate(-0.35 - fl * k); ctx.scale(k, k);
      ctx.fillStyle = rgba(C.ink, 0.85 * wings); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-14, -30, -40, -34); ctx.quadraticCurveTo(-36, -22, -42, -14); ctx.quadraticCurveTo(-32, -12, -34, -2); ctx.quadraticCurveTo(-22, -4, -22, 8); ctx.quadraticCurveTo(-12, 2, 0, 8); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.clip(); wash(ctx, -24, -14, 18, C.purple, 0.6 * wings, { seed: 3 }); ctx.restore();
      for (const e of [[-40, -34], [-42, -14], [-34, -2]]) line(ctx, [[0, 0], [e[0] * 0.6, e[1] * 0.7], e], 0.7, C.ink, 0.9 * wings);
      ctx.restore(); }
  }
  // --- ribbon tails / ponytail behind
  if (xc) { for (const [k, len] of [[0, 1], [1, 0.85]]) { const P = []; for (let i = 0; i <= 6; i++) { const s = i / 6; P.push([-5.5 - s * 22 * len - k * 2, -93 + dy + s * 16 * len + Math.sin(t * 2.4 + s * 3 + k) * 3 * wind * s + sw * 4 * s]); } brush(ctx, P, 2.2, { color: XC.ribbon, alpha: 0.95, step: 0.8, dry: 0.2, seed: 5 + k }); } }
  // --- long hair down the back (xc) / ponytail (jc)
  ctx.fillStyle = rgba(C.ink, 0.95);
  if (xc) { ctx.beginPath(); ctx.moveTo(-3.5, -96 + dy); ctx.bezierCurveTo(-9, -90 + dy, -9 + sw, -70 + dy, -9 + sw * 2.4, -50 + dy * 0.6); ctx.lineTo(-3 + sw * 2, -52 + dy * 0.6); ctx.bezierCurveTo(-2, -68 + dy, 0, -84 + dy, 2.5, -96 + dy); ctx.closePath(); ctx.fill(); }
  else B([[-1, -99 + dy], [-6, -96 + dy], [-10 - sw, -87 + dy], [-11.5 - sw * 2, -75 + dy], [-10 - sw * 3, -63 + dy * 0.7]], 3.8, 0.92, { end: 0.75, dry: 0.3 });
  if (tail) { const tw = Math.sin(t * 2.6) * 4; B([[-8, -40], [-20, -30], [-26 + tw, -16], [-22 + tw, -6]], 1.4, 0.95, { dry: 0, end: 0.2 }); ctx.save(); ctx.translate(-22 + tw, -5); ctx.rotate(0.4); ctx.fillStyle = rgba(C.red, 0.95); ctx.beginPath(); ctx.moveTo(0, 3); ctx.bezierCurveTo(-4.5, 0, -2.5, -3.5, 0, -1.5); ctx.bezierCurveTo(2.5, -3.5, 4.5, 0, 0, 3); ctx.fill(); ctx.restore(); }
  // --- back sleeve
  ctx.save(); ctx.translate(-4, -78 + dy); ctx.rotate(0.18 + sw2 * 0.03);
  ctx.fillStyle = rgba(robeC, robeA); ctx.beginPath(); ctx.moveTo(-3, 0); ctx.quadraticCurveTo(-9, 18, -10, 34); ctx.quadraticCurveTo(-3, 38, 4, 33); ctx.quadraticCurveTo(3, 15, 3, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = rgba(xc ? XC.fold : C.purpleD, 0.35); ctx.fill();
  B([[-3, 0], [-9, 18], [-10, 34]], 1.2, 0.7); if (xc) line(ctx, [[-10, 33], [-3, 37], [4, 33]], 0.9, XC.accent, 0.9); ctx.restore();
  // --- robe
  ctx.beginPath();
  if (!sit) { ctx.moveTo(-5, -82); ctx.quadraticCurveTo(-9.5, -70, -10, -56); ctx.quadraticCurveTo(-14, -24, -19 - sw * 3, -1); ctx.quadraticCurveTo(-4, 2.5, 12 + sw, 0); ctx.quadraticCurveTo(9.5, -28, 8.5, -56); ctx.quadraticCurveTo(8.5, -74, 5, -82); }
  else { ctx.moveTo(-5, -82 + dy); ctx.quadraticCurveTo(-11, -66 + dy, -16, -38 + dy); ctx.quadraticCurveTo(-20, -1, -22 - sw * 2, 0); ctx.quadraticCurveTo(0, 3, 22, 0); ctx.quadraticCurveTo(16, -18, 8.5, -46 + dy); ctx.quadraticCurveTo(8.5, -74 + dy, 5, -82 + dy); }
  ctx.closePath(); ctx.fillStyle = rgba(robeC, robeA); ctx.fill();
  ctx.save(); ctx.clip();
  if (xc) { wash(ctx, -6, -20, 26, XC.fold, 0.55, { sy: 1.4, seed: 3 }); wash(ctx, 8, -60, 12, XC.fold, 0.35, { seed: 4 }); for (const fx of [-6, 0, 5]) line(ctx, [[fx, -54 + dy], [fx - 3 + (sit ? 0 : sw), -2]], 0.6, '#77707F', 0.5); }
  else { wash(ctx, -4, -30, 30, C.purpleD, 0.55, { sy: 1.5, seed: 6 }); ctx.fillStyle = rgba(C.lav, 0.5); ctx.fillRect(4, -56 + dy * 0.5, 8, 56); }
  ctx.restore();
  if (!sit) { B([[5, -82], [8.5, -70], [8.7, -56], [9.5, -28], [12 + sw, 0]], 1.7); B([[-5, -82], [-9.5, -70], [-10, -56], [-14, -24], [-19 - sw * 3, -1]], 1.9); B([[-19 - sw * 3, -1], [-4, 2], [12 + sw, 0]], 1.1, 0.7); }
  else { B([[5, -82 + dy], [8.5, -66 + dy], [14, -22], [22, 0]], 1.6); B([[-5, -82 + dy], [-12, -62 + dy], [-18, -20], [-22, 0]], 1.8); B([[-22, 0], [0, 2.5], [22, 0]], 1.1, 0.7); }
  if (xc) { // red trim on the front edge and hem, red Gusu clouds
    if (!sit) { line(ctx, [[5.5, -80], [8.4, -60], [9.2, -30], [11.5 + sw, -1.5]], 0.9, XC.accent, 0.95); line(ctx, [[-18.5 - sw * 3, -2.2], [-4, 0.8], [11.5 + sw, -1.2]], 1.0, XC.accent, 0.95); }
    else line(ctx, [[-21, -1.5], [0, 1.2], [21, -1.5]], 1.0, XC.accent, 0.95);
    for (let i = 0; i < 3; i++) { const cx = -12 + i * 8 + (sit ? -2 : 0), cy = -6; line(ctx, [[cx, cy], [cx + 2.5, cy - 2.5], [cx + 4.5, cy - 0.5], [cx + 3, cy + 1], [cx + 1.8, cy - 0.6]], 0.6, XC.accent, 0.9); }
  }
  // collar + sash
  B([[-3, -82 + dy], [2, -72 + dy], [7, -78 + dy]], 1.0, 0.8, { dry: 0 }); if (xc) line(ctx, [[-3, -81 + dy], [2, -72 + dy], [7, -77 + dy]], 0.8, XC.accent, 0.95);
  ctx.fillStyle = rgba(xc ? XC.accent : C.ink, xc ? 0.95 : 0.85); ctx.beginPath(); ctx.moveTo(-9.6, -58 + dy); ctx.lineTo(8.6, -58 + dy); ctx.lineTo(8.8, -54.5 + dy); ctx.lineTo(-10, -54.5 + dy); ctx.closePath(); ctx.fill();
  if (!xc && !sit) { line(ctx, [[6, -55], [6.5, -49]], 0.5, C.inkS, 0.8); ctx.fillStyle = C.silver; ctx.beginPath(); ctx.arc(6.6, -47.5, 1.9, 0, TAU); ctx.fill(); line(ctx, [[6.6, -45.6], [6.3 + sw * 0.5, -40]], 1.1, C.purple, 0.9); } // Qingxin bell
  if (xc && !sit) { line(ctx, [[-8, -55], [-11 + sw * 0.5, -40]], 1.2, '#D9D2C5', 0.8); line(ctx, [[-11 + sw * 0.5, -40], [-11.5 + sw * 0.7, -35]], 0.8, XC.accent, 0.9); } // jade xiao with a red tassel
  // --- front sleeve + hand
  ctx.save(); ctx.translate(SHOULDER[0], SHOULDER[1] + dy); ctx.rotate(arm + sw2 * 0.02);
  ctx.fillStyle = rgba(robeC, robeA); ctx.beginPath(); ctx.moveTo(-4, -1); ctx.quadraticCurveTo(-7, 18, -6, 31); ctx.quadraticCurveTo(3, 37.5, 9, 30); ctx.quadraticCurveTo(6, 14, 4, -2); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.clip(); wash(ctx, 0, 26, 9, wash2, xc ? 0.5 : 0.5, { seed: 9 }); ctx.restore();
  B([[4, -2], [6, 14], [9, 30]], 1.4); B([[-4, -1], [-7, 18], [-6, 31], [2, 36], [9, 30]], 1.3, 0.8);
  if (xc) line(ctx, [[-6, 31], [2, 35.5], [9, 30]], 1.0, XC.accent, 0.95);
  if (chop) { line(ctx, [[1.4, 33], [3.6, 63]], 0.9, '#7A5A43', 0.95); line(ctx, [[3.4, 33], [7, 62]], 0.9, '#7A5A43', 0.95); }
  ctx.fillStyle = C.skin; ctx.beginPath(); ctx.ellipse(2.5, 35, 2.4, 2.9, 0, 0, TAU); ctx.fill(); line(ctx, [[0.6, 34], [1.5, 37.4], [4, 37.2]], 0.45, C.inkS, 0.7);
  if (!xc) { ctx.strokeStyle = rgba(C.purpleL, 0.9); ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(2.2, 34.3, 1.3, 0, TAU); ctx.stroke(); } // Zidian ring
  if (cup) { ctx.fillStyle = '#FBF8F1'; ctx.beginPath(); ctx.moveTo(-0.5, 31.5); ctx.lineTo(6, 31.5); ctx.quadraticCurveTo(5.5, 36, 2.8, 36.5); ctx.quadraticCurveTo(0, 36, -0.5, 31.5); ctx.fill(); line(ctx, [[-0.5, 31.5], [2.8, 36.5], [6, 31.5]], 0.5, C.red, 0.8); }
  ctx.restore();
  // --- head
  const hx = 1.5, hy = -90 + dy;
  ctx.fillStyle = C.skin; ctx.beginPath(); ctx.ellipse(hx, hy, 6, 6.6, 0, 0, TAU); ctx.fill();
  if (blush > 0) glow(ctx, hx + 3.5, hy + 1.5, 4.5, C.red, 0.55 * blush);
  B([[hx + 5.8, hy - 2], [hx + 5.4, hy + 3], [hx + 2, hy + 6.5]], 0.6, 0.7, { dry: 0 });
  ctx.fillStyle = rgba(C.ink, 0.93); ctx.beginPath(); // hair cap, swept back, ear-side lock
  ctx.moveTo(hx + 6, hy - 1.5); ctx.bezierCurveTo(hx + 6, hy - 9, hx - 6, hy - 9.5, hx - 6.5, hy - 1); ctx.lineTo(hx - 6.5, hy + 6); ctx.quadraticCurveTo(hx - 2, hy + 3, hx - 1.5, hy - 2.5); ctx.quadraticCurveTo(hx + 3, hy - 4.2, hx + 6, hy - 1.5); ctx.fill();
  if (xc) { ctx.fillStyle = rgba(XC.ribbon, 0.97); ctx.beginPath(); ctx.moveTo(hx - 6.6, hy - 3.2); ctx.quadraticCurveTo(hx, hy - 6.6, hx + 6.3, hy - 3.8); ctx.lineTo(hx + 6.3, hy - 2.2); ctx.quadraticCurveTo(hx, hy - 5, hx - 6.6, hy - 1.6); ctx.closePath(); ctx.fill(); }
  else { ctx.beginPath(); ctx.arc(hx - 1, hy - 8.4, 3, 0, TAU); ctx.fill(); ctx.fillStyle = C.silver; ctx.fillRect(hx - 2.6, hy - 12.6, 3.2, 2.2); }
  if (horns) for (const k of [-1, 1]) { const bx = hx + k * 3.6; ctx.fillStyle = rgba(C.ink, 0.95); ctx.beginPath(); ctx.moveTo(bx - 1.3, hy - 6.5); ctx.quadraticCurveTo(bx + k * 1.5, hy - 12, bx + k * 4.2, hy - 13.5); ctx.quadraticCurveTo(bx + k * 1.4, hy - 10, bx + 1.3, hy - 6.2); ctx.closePath(); ctx.fill(); }
  if (hat) { // Mad Hatter top hat with a band in his accent colour
    ctx.fillStyle = rgba(C.ink, 0.94); ctx.beginPath(); ctx.ellipse(hx, hy - 6.2, 10, 2.1, -0.05, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(hx - 6, hy - 6.5); ctx.lineTo(hx - 7.5, hy - 25); ctx.quadraticCurveTo(hx, hy - 27.5, hx + 7.5, hy - 25); ctx.lineTo(hx + 6, hy - 6.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = rgba(xc ? C.red : C.purple, 0.95); ctx.beginPath(); ctx.moveTo(hx - 6.2, hy - 9); ctx.lineTo(hx + 6.2, hy - 9); ctx.lineTo(hx + 6.5, hy - 12.5); ctx.lineTo(hx - 6.5, hy - 12.5); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// Cheshire cat lying on a branch; vis = body opacity, grin = grin opacity, shut = eyes closing 0..1
export function cat(ctx, o) {
  const { x, y, s, t = 0, vis = 1, grin = 1, shut = 0, face = -1, purr = 0 } = o;
  ctx.save(); ctx.translate(x, y); ctx.scale(face * s, s);
  const br = 1 + Math.sin(t * 2.2) * 0.02 + purr * Math.sin(t * 40) * 0.006;
  if (vis > 0) {
    ctx.save(); ctx.globalAlpha *= vis;
    const tw = Math.sin(t * 1.3) * 6; // tail hangs and swishes
    brush(ctx, [[-20, -6], [-28, 2], [-30 + tw * 0.3, 16], [-26 + tw, 28], [-20 + tw * 1.2, 30]], 6, { color: C.purpleL, alpha: 0.9, step: 1, dry: 0.2, end: 0.3, seed: 2 });
    for (let i = 0; i < 4; i++) { const s_ = i / 4; line(ctx, [[-27 + tw * s_ * 0.6 - 3, 6 + s_ * 22], [-27 + tw * s_ * 0.6 + 3, 7 + s_ * 22]], 1.4, C.purpleD, 0.9); }
    ctx.save(); ctx.scale(1, br);
    wash(ctx, 0, -8, 23, C.lav, 0.95, { sy: 0.42, seed: 3, rim: 0.2 }); wash(ctx, 0, -8, 21, C.purpleL, 0.45, { sy: 0.38, seed: 4 });
    for (let i = 0; i < 6; i++) { const sx = -16 + i * 6.5; brush(ctx, [[sx, -16], [sx + 1.5, -10], [sx + 0.5, -3]], 2.2, { color: C.purpleD, alpha: 0.85, step: 0.6, dry: 0.5, seed: 10 + i }); }
    brush(ctx, [[-22, -8], [-14, -16.5], [6, -17], [20, -12]], 1.3, { alpha: 0.75, step: 0.8, seed: 21 }); brush(ctx, [[-21, -3], [0, 0.5], [18, -3]], 1.1, { alpha: 0.6, step: 0.8, seed: 22 });
    ctx.restore();
    for (const px of [-12, 10]) { wash(ctx, px, -1, 3.2, C.lav, 0.9, { seed: px + 50 }); line(ctx, [[px - 2.5, 0.5], [px + 2.5, 0.5]], 0.7, C.ink, 0.6); } // paws
    // head
    wash(ctx, 22, -15, 10, C.lav, 0.95, { seed: 5, rim: 0.2 });
    ctx.fillStyle = rgba(C.lav, 0.95); for (const ex of [17, 27]) { ctx.beginPath(); ctx.moveTo(ex - 4, -21); ctx.lineTo(ex + (ex < 22 ? -1.5 : 1.5), -30); ctx.lineTo(ex + 4, -21.5); ctx.closePath(); ctx.fill(); brush(ctx, [[ex - 4, -21], [ex + (ex < 22 ? -1.5 : 1.5), -30], [ex + 4, -21.5]], 1, { alpha: 0.8, step: 0.5, dry: 0, seed: ex }); }
    for (let i = 0; i < 3; i++) line(ctx, [[17 + i * 3, -24], [17.5 + i * 3, -20]], 1.2, C.purpleD, 0.85);
    brush(ctx, [[13, -18], [14, -10], [22, -5.5], [31, -9], [32, -17]], 1.1, { alpha: 0.75, step: 0.6, dry: 0.2, seed: 31 });
    // eyes (gold, slit) or content arcs
    for (const ex of [19, 26.5]) {
      if (shut < 0.5) { ctx.fillStyle = rgba(C.gold, 0.95); ctx.beginPath(); ctx.ellipse(ex, -16, 2.4, 1.8 * (1 - shut * 1.6), 0.1, 0, TAU); ctx.fill(); ctx.fillStyle = C.ink; ctx.fillRect(ex - 0.35, -17.6 * (1 - shut * 0.2), 0.7, 3.2 * (1 - shut * 1.6)); }
      else line(ctx, [[ex - 2.4, -16.4], [ex, -15], [ex + 2.4, -16.4]], 0.8, C.ink, 0.9);
    }
    // whiskers + collar with a tiny silver bell (the Qingxin bell, of course)
    for (const k of [-1, 1]) line(ctx, [[31, -11 + k], [38, -12 + k * 2.5]], 0.35, C.ink, 0.6);
    ctx.fillStyle = rgba(C.purple, 0.95); ctx.fillRect(13.5, -8.5, 6, 2); ctx.fillStyle = C.silver; ctx.beginPath(); ctx.arc(16.5, -5.6, 1.6, 0, TAU); ctx.fill();
    ctx.restore();
  }
  if (grin > 0) { // the grin outlives the cat
    ctx.save(); ctx.globalAlpha *= grin;
    ctx.fillStyle = rgba(C.ink, 0.92); ctx.beginPath(); ctx.moveTo(15.5, -12.5); ctx.quadraticCurveTo(23, -4.5, 31, -12); ctx.quadraticCurveTo(23, -8.5, 15.5, -12.5); ctx.fill();
    ctx.fillStyle = '#FBF8F1'; ctx.beginPath(); ctx.moveTo(16.8, -12); ctx.quadraticCurveTo(23, -6.5, 29.8, -11.6); ctx.quadraticCurveTo(23, -8.6, 16.8, -12); ctx.fill();
    for (let i = 1; i < 7; i++) line(ctx, [[16.8 + i * 1.86, -11.8 + Math.sin(i / 7 * Math.PI) * 2.6], [16.8 + i * 1.86, -10.2 + Math.sin(i / 7 * Math.PI) * 3.6]], 0.25, C.ink, 0.7);
    ctx.restore();
  }
  ctx.restore();
}

// lotus flower: open 0 (bud) .. 1 (full bloom); tint = petal tip colour
export function lotus(ctx, x, y, s, open = 1, o = {}) {
  const { tint = C.purple, rotA = 0, glowA = 0, alpha = 1, seed = 1, base = '#FBF8F1' } = o;
  if (alpha <= 0 || s <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rotA); ctx.scale(s, s); ctx.globalAlpha *= alpha;
  if (glowA > 0) glow(ctx, 0, -18, 60, C.goldL, glowA);
  const r = rng(seed), op = clamp(open);
  const petal = (ang, len, wid, depth) => {
    ctx.save(); ctx.rotate(ang); const g = ctx.createLinearGradient(0, 0, 0, -len);
    g.addColorStop(0, rgba(base, 0.96)); g.addColorStop(0.55, rgba(base, 0.9)); g.addColorStop(0.85, rgba(tint, 0.55 + depth * 0.2)); g.addColorStop(1, rgba(tint, 0.9));
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(wid, -len * 0.3, wid * 0.9, -len * 0.8, 0, -len); ctx.bezierCurveTo(-wid * 0.9, -len * 0.8, -wid, -len * 0.3, 0, 0); ctx.fill();
    ctx.strokeStyle = rgba(tint, 0.55); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0, -len * 0.15); ctx.quadraticCurveTo(wid * 0.15, -len * 0.6, 0, -len * 0.95); ctx.stroke();
    ctx.strokeStyle = rgba(tint, 0.3); ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(wid, -len * 0.3, wid * 0.9, -len * 0.8, 0, -len); ctx.stroke();
    ctx.restore();
  };
  const spread = lerp(0.12, 1, op);
  for (const k of [-3, 3, -2, 2]) petal(k * 0.36 * spread + (r() - 0.5) * 0.08, 30 + r() * 4, 11, 0); // back
  if (op > 0.4) { ctx.fillStyle = rgba('#E9D27A', (op - 0.4) * 1.6); ctx.beginPath(); ctx.ellipse(0, -10, 6.5, 3, 0, 0, TAU); ctx.fill(); for (let i = -2; i <= 2; i++) { ctx.fillStyle = rgba(C.gold, (op - 0.4) * 1.4); ctx.beginPath(); ctx.arc(i * 2.2, -11, 0.9, 0, TAU); ctx.fill(); } }
  for (const k of [-1, 1, 0]) petal(k * 0.42 * spread + (r() - 0.5) * 0.06, 33 + r() * 3, 12.5, 1); // front
  ctx.restore();
}
// lotus leaf seen in perspective (ink wash disc with veins)
export function leaf(ctx, x, y, r, o = {}) { // boneless ink leaf: ragged rim, a notch towards us, pale veins
  const { a = 0.5, sy = 0.42, seed = 1, color = C.inkS, tilt = 0 } = o;
  const R = rng(seed * 977 + 3), ph = R() * 6, notch = Math.PI / 2 + (R() - 0.5) * 0.6;
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(1, sy);
  const rad = an => { let d = Math.abs(((an - notch + Math.PI) % TAU + TAU) % TAU - Math.PI); return r * (0.9 + 0.07 * Math.sin(an * 5 + ph) + 0.04 * Math.sin(an * 11 + ph * 2)) * (d < 0.16 ? 0.25 + d / 0.16 * 0.75 : 1); };
  ctx.beginPath(); for (let i = 0; i <= 64; i++) { const an = i / 64 * TAU; ctx.lineTo(Math.cos(an) * rad(an), Math.sin(an) * rad(an)); } ctx.closePath();
  const g = ctx.createLinearGradient(0, -r, 0, r); g.addColorStop(0, rgba(color, a * 1.1)); g.addColorStop(0.6, rgba(color, a * 0.6)); g.addColorStop(1, rgba(color, a * 0.85));
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip(); wash(ctx, -r * 0.3, -r * 0.2, r * 0.7, color, a * 0.5, { seed: seed + 1, lobes: 2 }); ctx.restore();
  for (let i = 0; i < 9; i++) { const an = notch + 0.3 + i / 9 * (TAU - 0.6); line(ctx, [[0, 0], [Math.cos(an) * rad(an) * 0.88, Math.sin(an) * rad(an) * 0.88]], 1.6 / sy * 0.55, '#F7F1E4', 0.35); }
  const P = []; for (let i = 0; i <= 20; i++) { const an = Math.PI * 1.05 + i / 20 * Math.PI * 0.9; P.push([Math.cos(an) * rad(an), Math.sin(an) * rad(an)]); }
  brush(ctx, P, r * 0.07 / Math.sqrt(sy), { color, alpha: Math.min(1, a * 1.6), dry: 0.8, seed: seed + 2, step: 3 });
  ctx.restore();
}
export function stem(ctx, x0, y0, x1, y1, bend = 0, a = 0.6, w = 3) { brush(ctx, [[x0, y0], [lerp(x0, x1, 0.5) + bend, lerp(y0, y1, 0.5)], [x1, y1]], w, { alpha: a, color: C.inkS, dry: 0.6, seed: Math.round(x0 + y0) }); }

export function plum(ctx, x, y, s, p, seed = 1) { // five-petal plum blossom opening (p 0..1)
  if (p <= 0) return; const e = E.back(clamp(p)), r = rng(seed);
  ctx.save(); ctx.translate(x, y); ctx.rotate(r() * TAU); ctx.scale(s * e, s * e);
  for (let i = 0; i < 5; i++) { const an = i / 5 * TAU; wash(ctx, Math.cos(an) * 6, Math.sin(an) * 6, 6.2, C.pink, 0.95, { seed: seed * 5 + i, lobes: 2, rim: 0.35 }); }
  ctx.fillStyle = rgba(C.red, 0.9); ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, TAU); ctx.fill();
  for (let i = 0; i < 7; i++) { const an = i / 7 * TAU + 0.3; line(ctx, [[0, 0], [Math.cos(an) * 5, Math.sin(an) * 5]], 0.5, C.red, 0.8); ctx.fillStyle = rgba(C.gold, 0.95); ctx.beginPath(); ctx.arc(Math.cos(an) * 5.3, Math.sin(an) * 5.3, 0.8, 0, TAU); ctx.fill(); }
  ctx.restore();
}
export function lantern(ctx, x, y, s, t, o = {}) { // floating lotus lantern / sky lantern
  const { kind = 'water', seed = 1 } = o; const fl = 0.85 + 0.15 * Math.sin(t * 7 + seed * 3) * Math.sin(t * 3.1 + seed);
  glow(ctx, x, y - s * 0.4, s * 3.2, C.gold, 0.32 * fl);
  if (kind === 'water') { lotus(ctx, x, y, s / 34, 0.8, { tint: C.pink, seed, base: '#FFF6DE' }); glow(ctx, x, y - s * 0.5, s * 0.9, C.goldL, 0.8 * fl); }
  else { ctx.fillStyle = rgba(C.goldL, 0.95); ctx.beginPath(); ctx.moveTo(x - s * 0.45, y - s); ctx.lineTo(x + s * 0.45, y - s); ctx.lineTo(x + s * 0.35, y); ctx.lineTo(x - s * 0.35, y); ctx.closePath(); ctx.fill(); glow(ctx, x, y - s * 0.3, s * 0.8, '#FFF3C9', 0.9 * fl); }
}
export function pumpkin(ctx, x, y, r, t, seed = 1) {
  wash(ctx, x, y, r, C.orange, 0.85, { sx: 1.2, sy: 0.85, seed, rim: 0.35 });
  for (const k of [-0.5, 0, 0.5]) line(ctx, [[x + k * r * 0.9, y - r * 0.78], [x + k * r * 1.3, y], [x + k * r * 0.9, y + r * 0.75]], 1.6, C.ink, 0.35);
  brush(ctx, [[x, y - r * 0.75], [x + 3, y - r * 1.05], [x + 9, y - r * 1.2]], 4, { color: C.inkS, alpha: 0.8, seed });
  const fl = 0.8 + 0.2 * Math.sin(t * 9 + seed); ctx.fillStyle = rgba(C.goldL, 0.95 * fl);
  for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + k * r * 0.42, y - r * 0.32); ctx.lineTo(x + k * r * 0.25, y - r * 0.05); ctx.lineTo(x + k * r * 0.6, y - r * 0.05); ctx.closePath(); ctx.fill(); }
  ctx.beginPath(); ctx.moveTo(x - r * 0.5, y + r * 0.2); ctx.quadraticCurveTo(x, y + r * 0.62, x + r * 0.5, y + r * 0.2); ctx.quadraticCurveTo(x, y + r * 0.38, x - r * 0.5, y + r * 0.2); ctx.fill();
  glow(ctx, x, y, r * 2, C.gold, 0.18 * fl);
}
export function bat(ctx, x, y, s, t, seed = 1) {
  const f = Math.sin(t * 14 + seed * 2); ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = rgba(C.ink, 0.88);
  for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(k * 8, -8 * f - 2, k * 16, -4 * f); ctx.quadraticCurveTo(k * 12, 1, k * 10, 0); ctx.quadraticCurveTo(k * 7, 3, k * 4, 1); ctx.closePath(); ctx.fill(); }
  ctx.beginPath(); ctx.ellipse(0, 0, 2.6, 3.4, 0, 0, TAU); ctx.fill(); ctx.restore();
}
