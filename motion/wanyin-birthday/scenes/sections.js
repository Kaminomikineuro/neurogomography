// The eight paintings of the scroll. Each draws in local coords (0..1920 × 0..1080 when the camera is centred on
// it; it may spill ±140 px into the mist gutters). lt = seconds since the section's scene began (may be negative
// while the camera pans in). env.L(f, fn) draws a parallax layer (f < 1 far, f > 1 near); env.lines = start times
// (lt) of the letter lines on this section, so the pictures can react to the words.
import { clamp, lerp, invLerp, seg, E, TAU, rng } from '../lib/mg.js';
import { C, rgba, brush, line, wash, glow, ridge, mountain, mistBand, ripples, spline } from '../lib/ink.js';
import { figure, handPos, cat, lotus, leaf, stem, plum, lantern, pumpkin, bat } from '../lib/figures.js';

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

// ================= 1. Lotus Pier (Пристань Лотоса) =================
export function s1(ctx, lt, env) {
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

// ================= 2. The bridge and the thorny branch =================
export function s2(ctx, lt, env) {
  const { L, lines } = env;
  L(0.5, () => { mountain(ctx, R('2a', 21, -300, 2300, 660, 300, 4), 712, C.blueL, 0.55, { lw: 5, la: 0.5, seed: 21, ridgeColor: C.blueD }); });
  L(0.62, () => { mountain(ctx, R('2b', 22, -300, 2300, 690, 160, 5), 712, C.blue, 0.3, { lw: 4, la: 0.4, seed: 22, ridgeColor: C.blueD }); mistBand(ctx, -300, 2300, 690, 90, 0.75, lt, 23); });
  L(0.85, () => { ripples(ctx, -300, 2300, 716, 1080, lt, 24, C.blueD, 0.24); for (let i = 0; i < 14; i++) brush(ctx, [[1500 + i * 34, 1100], [1505 + i * 36 + Math.sin(lt * 0.8 + i) * 8, 900 - (i % 4) * 40]], 4, { seed: 600 + i, alpha: 0.6, dry: 0.6 }); leaf(ctx, 1640, 1010, 140, { a: 0.55, seed: 61 }); leaf(ctx, 1860, 960, 110, { a: 0.45, seed: 62 }); });
  L(1, () => {
    const bx = 900, span = 470, WL = 712, deckY = x => WL - 175 * (1 - Math.pow((x - bx) / span, 2));
    ctx.fillStyle = rgba(C.inkS, 0.14); ctx.beginPath(); for (let x = bx - span; x <= bx + span; x += 10) ctx.lineTo(x, deckY(x) + 8); ctx.lineTo(bx + span, WL); ctx.arc(bx, WL, 150, 0, Math.PI, true); ctx.lineTo(bx - span, WL); ctx.closePath(); ctx.fill();
    const deck = []; for (let x = bx - span - 20; x <= bx + span + 20; x += 40) deck.push([x, deckY(x)]);
    brush(ctx, deck, 9, { seed: 31, dry: 0.3 }); brush(ctx, deck.map(([x, y]) => [x, y - 34]), 4, { seed: 32, dry: 0.5, alpha: 0.7 });
    for (let x = bx - span + 10; x < bx + span; x += 38) line(ctx, [[x, deckY(x) - 34], [x, deckY(x) - 2]], 2.6, C.ink, 0.7);
    const arc = []; for (let i = 0; i <= 18; i++) { const a = Math.PI + i / 18 * Math.PI; arc.push([bx + Math.cos(a) * 150, WL + Math.sin(a) * 150]); }
    brush(ctx, arc, 8, { seed: 33, dry: 0.4 });
    const refl = arc.map(([x, y]) => [x, 2 * WL - y]); brush(ctx, refl, 6, { seed: 34, alpha: 0.22, dry: 0.8 });
    // the two of them at the top; Wanyin looks away, then turns to him on «Я знаю»
    const tTurn = (lines[1] ?? 3) + 1.2, turn = lt < tTurn ? 1 : Math.cos(Math.PI * seg(lt, tTurn, tTurn + 0.45, E.inOut));
    figure(ctx, { who: 'xc', x: bx - 52, y: deckY(bx - 52) - 4, h: 230, face: 1, t: lt, seed: 2 });
    figure(ctx, { who: 'jc', x: bx + 56, y: deckY(bx + 56) - 4, h: 226, face: -1, turn: -turn, t: lt, seed: 4 });
  });
  L(1.16, () => { // thorny branch: under each thorn a plum blossom opens on «и под каждой нашёл тепло»
    const main = [[-200, 240], [40, 300], [260, 285], [470, 350], [640, 330]];
    brush(ctx, main, 22, { seed: 41, dry: 0.6, end: 0.55 });
    brush(ctx, [[150, 292], [230, 210], [300, 180]], 9, { seed: 42, dry: 0.7 }); brush(ctx, [[360, 312], [420, 410], [470, 450]], 8, { seed: 43, dry: 0.7 });
    const P = spline(main, 10), tb = (lines[3] ?? 8) + 0.2, r = rng(44);
    for (let i = 4; i < P.length - 2; i += 6) {
      const [x, y] = P[i], up = (i / 6) % 2 ? -1 : 1, sz = 14 + r() * 8;
      ctx.fillStyle = rgba(C.ink, 0.88); ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 3, y + up * sz); ctx.lineTo(x + 7, y); ctx.closePath(); ctx.fill();
      plum(ctx, x + 2, y + up * (sz + 6), 2.4 + r() * 0.8, seg(lt, tb + (i / P.length) * 2.2, tb + (i / P.length) * 2.2 + 0.7, E.linear), 50 + i);
    }
    for (let k = 0; k < 4; k++) { const t0 = tb + 3.2 + k * 0.9, p = clamp((lt - t0) / 6); if (p <= 0 || p >= 1) continue; plum(ctx, 300 + k * 120 + p * 260 + Math.sin(p * 9 + k) * 30, 330 + p * 520, 1.6, 1 - p * 0.2, 90 + k); }
  });
}

// ================= 3. The small things: sweatshirt, pins, socks =================
const PINS = [[180, 226, 760, 640, 0.6], [330, 246, 880, 668, -0.4], [470, 232, 1010, 636, 0.9]];
function pin(ctx, x, y, a, s = 1, head = C.pink) { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(s, s); line(ctx, [[0, 0], [52, 0]], 2.2, '#8A8794', 0.95); ctx.fillStyle = head; ctx.beginPath(); ctx.arc(-2, 0, 6.5, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(-4, -2, 2, 0, TAU); ctx.fill(); ctx.restore(); }
export function s3(ctx, lt, env) {
  const { L, lines } = env;
  L(1, () => {
    wash(ctx, 470, 900, 360, C.paperD, 0.6, { sy: 0.25, seed: 5 }); wash(ctx, 1500, 920, 320, C.paperD, 0.55, { sy: 0.22, seed: 6 }); wash(ctx, 980, 860, 200, C.paperD, 0.6, { sy: 0.25, seed: 7 });
    // his sleeve hanging into the picture, top left
    ctx.fillStyle = '#F7F3EA'; ctx.beginPath(); ctx.moveTo(-160, -20); ctx.lineTo(600, -20); ctx.quadraticCurveTo(560, 140, 520, 236); ctx.quadraticCurveTo(300, 270, 80, 238); ctx.quadraticCurveTo(-60, 230, -160, 260); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.clip(); wash(ctx, 300, 200, 260, C.blueL, 0.45, { sy: 0.4, seed: 8 }); ctx.restore();
    for (const [x0, x1] of [[120, 100], [260, 250], [400, 420]]) brush(ctx, [[x0, -20], [(x0 + x1) / 2 + 8, 110], [x1, 226]], 3, { seed: x0, alpha: 0.4, dry: 0.7 });
    brush(ctx, [[600, -20], [560, 140], [520, 236]], 6, { seed: 81 }); brush(ctx, [[520, 236], [300, 268], [80, 238], [-160, 260]], 5, { seed: 82, dry: 0.5 });
    for (let i = 0; i < 6; i++) { const cx = -60 + i * 100, cy = 222 + Math.sin(i) * 6; line(ctx, [[cx, cy], [cx + 14, cy - 14], [cx + 26, cy - 3], [cx + 17, cy + 5], [cx + 10, cy - 3]], 2.4, C.blue, 0.75); }
    // sweatshirt with a little heart
    const sx = 450, sy = 770, beat = 1 + 0.08 * Math.max(0, Math.sin(Math.max(0, lt - (lines[4] ?? 10)) * 6)) * (lt > (lines[4] ?? 10) ? 1 : 0);
    const SH = [[sx - 150, sy - 160], [sx - 60, sy - 182], [sx + 60, sy - 182], [sx + 150, sy - 160], [sx + 300, sy + 40], [sx + 240, sy + 84], [sx + 150, sy - 30], [sx + 150, sy + 170], [sx - 150, sy + 170], [sx - 150, sy - 30], [sx - 240, sy + 84], [sx - 300, sy + 40]];
    ctx.fillStyle = rgba(C.lav, 0.95); ctx.beginPath(); SH.forEach(p => ctx.lineTo(p[0], p[1])); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.clip(); wash(ctx, sx - 40, sy + 30, 280, C.purpleL, 0.5, { sy: 0.8, seed: 9 }); ctx.fillStyle = rgba(C.purple, 0.55); ctx.fillRect(sx - 150, sy + 140, 300, 30);
    ctx.save(); ctx.translate(sx - 270, sy + 62); ctx.rotate(-0.72); ctx.fillRect(-46, -14, 92, 26); ctx.restore(); ctx.save(); ctx.translate(sx + 270, sy + 62); ctx.rotate(0.72); ctx.fillRect(-46, -14, 92, 26); ctx.restore(); ctx.restore();
    brush(ctx, [...SH, SH[0]], 4.5, { seed: 91, dry: 0.35, step: 6, start: 0.02, end: 0.05 });
    for (const k of [-1, 1]) brush(ctx, [[sx + k * 150, sy - 30], [sx + k * 148, sy + 120]], 2.5, { seed: 92 + k, alpha: 0.5 });
    ctx.fillStyle = rgba(C.purple, 0.85); ctx.beginPath(); ctx.ellipse(sx, sy - 176, 66, 20, 0, 0, Math.PI); ctx.fill(); brush(ctx, [[sx - 66, sy - 178], [sx, sy - 150], [sx + 66, sy - 178]], 4, { seed: 94 });
    for (let i = 0; i < 9; i++) line(ctx, [[sx - 140 + i * 35, sy + 144], [sx - 140 + i * 35, sy + 166]], 2, C.purpleD, 0.5);
    ctx.save(); ctx.translate(sx + 62, sy - 92); ctx.scale(beat, beat); ctx.fillStyle = rgba(C.red, 0.9); ctx.beginPath(); ctx.moveTo(0, 14); ctx.bezierCurveTo(-34, -8, -18, -34, 0, -16); ctx.bezierCurveTo(18, -34, 34, -8, 0, 14); ctx.fill(); ctx.restore();
    // socks
    const sock = (x, y, a, seed) => { ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = rgba(C.pale, 0.95); ctx.beginPath(); ctx.moveTo(-40, -150); ctx.lineTo(40, -150); ctx.lineTo(42, 20); ctx.quadraticCurveTo(140, 22, 150, 60); ctx.quadraticCurveTo(150, 92, 100, 92); ctx.lineTo(-10, 92); ctx.quadraticCurveTo(-44, 90, -42, 40); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.clip(); wash(ctx, 40, 40, 110, C.blueL, 0.55, { seed }); ctx.fillStyle = rgba(C.purple, 0.75); ctx.fillRect(-45, -150, 90, 18); ctx.fillRect(-45, -120, 90, 9); ctx.restore();
      brush(ctx, [[-40, -150], [-42, 40], [-10, 92], [100, 92], [150, 60], [140, 22], [42, 20], [40, -150]], 3.5, { seed: seed + 1, dry: 0.4 });
      lotus(ctx, 0, -60, 0.55, 1, { tint: C.purple, seed: seed + 3 }); ctx.restore(); };
    sock(1420, 860, -0.25, 101); sock(1600, 900, 0.18, 111);
    // the lacquer box: opens before «Ты сам велел их снять», closes after «чтобы я не укололся»
    const bxX = 980, bxY = 820, tOpen = (lines[2] ?? 5) - 0.6, tClose = (lines[4] ?? 9.5) - 0.3;
    const lid = seg(lt, tOpen, tOpen + 0.5, E.out) * (1 - seg(lt, tClose, tClose + 0.25, E.in));
    ctx.fillStyle = rgba(C.purpleD, 0.92); ctx.beginPath(); ctx.moveTo(bxX - 110, bxY - 30); ctx.lineTo(bxX + 110, bxY - 30); ctx.lineTo(bxX + 104, bxY + 60); ctx.lineTo(bxX - 104, bxY + 60); ctx.closePath(); ctx.fill();
    brush(ctx, [[bxX - 110, bxY - 30], [bxX - 104, bxY + 60], [bxX + 104, bxY + 60], [bxX + 110, bxY - 30]], 3.5, { seed: 121 });
    lotus(ctx, bxX, bxY + 34, 0.7, 1, { tint: C.gold, base: C.goldL, seed: 122, alpha: 0.9 });
    ctx.fillStyle = rgba(C.ink, 0.85); ctx.beginPath(); ctx.ellipse(bxX, bxY - 30, 110, 22, 0, 0, TAU); ctx.fill(); // opening
    ctx.save(); ctx.translate(bxX, bxY - 52); ctx.scale(1, Math.cos(lid * 1.9)); ctx.fillStyle = rgba(C.purple, 0.95); ctx.beginPath(); ctx.ellipse(0, 22 * (1 - lid * 0.3) - (lid > 0.83 ? 0 : 0), 116, 26, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = rgba(C.ink, 0.7); ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
    // pins: fall from the sleeve, then hop into the box one by one
    PINS.forEach(([x0, y0, x1, y1, a1], i) => {
      const tf = 0.9 + i * 0.85, tg = (lines[2] ?? 5) + 0.1 + i * 0.5, head = [C.pink, C.lav, C.red][i];
      if (lt < tf) { pin(ctx, x0, y0, 1.25 + i * 0.2, 1, head); return; }
      if (lt < tg) { const p = invLerp(tf, tf + 0.7, lt), e = E.in(p), bounce = p >= 1 ? Math.exp(-(lt - tf - 0.7) * 9) * Math.abs(Math.sin((lt - tf - 0.7) * 22)) * 16 : 0;
        pin(ctx, lerp(x0, x1, p), lerp(y0, y1, e) - bounce, lerp(1.25 + i * 0.2, a1, Math.min(1, p * 1.2)) + p * 4 * (1 - p), 1, head); return; }
      const p = seg(lt, tg, tg + 0.55, E.inOut); if (p >= 1) return;
      pin(ctx, lerp(x1, bxX, p), lerp(y1, bxY - 40, p) - Math.sin(p * Math.PI) * 150, a1 + p * 3, 1 - p * 0.6, head);
    });
  });
}

// ================= 4. Halloween: the Mad Hatter and the Cheshire cat =================
export function s4(ctx, lt, env) {
  const { L } = env;
  L(0.55, () => {
    glow(ctx, 1520, 300, 360, C.inkS, 0.16); glow(ctx, 1520, 300, 250, '#FFF7DD', 0.9);
    ctx.fillStyle = rgba('#F8EFD3', 0.95); ctx.beginPath(); ctx.arc(1520, 300, 190, 0, TAU); ctx.fill();
    wash(ctx, 1460, 250, 50, C.paperD, 0.6, { seed: 3 }); wash(ctx, 1590, 350, 34, C.paperD, 0.5, { seed: 4 }); wash(ctx, 1560, 220, 22, C.paperD, 0.5, { seed: 5 });
    for (let i = 0; i < 3; i++) { const p = ((lt * 0.07 + i * 0.33) % 1); bat(ctx, lerp(1900, 1150, p), 160 + i * 50 + Math.sin(p * 12 + i) * 30, 2.2 - i * 0.4, lt, i + 1); }
  });
  L(0.8, () => { mountain(ctx, R('4a', 41, -300, 2300, 860, 120, 6), 900, C.inkS, 0.2, { lw: 3, la: 0.35, seed: 41 }); });
  L(1, () => {
    brush(ctx, [[-200, 905], [600, 896], [1300, 908], [2200, 900]], 6, { seed: 42, dry: 0.8, alpha: 0.55 });
    for (let i = 0; i < 18; i++) { const x = -100 + i * 130; brush(ctx, [[x, 905], [x - 6, 880]], 3, { seed: 60 + i, alpha: 0.5 }); brush(ctx, [[x + 8, 905], [x + 14, 884]], 3, { seed: 80 + i, alpha: 0.5 }); }
    pumpkin(ctx, 680, 875, 46, lt, 1); pumpkin(ctx, 1740, 885, 34, lt, 2); pumpkin(ctx, 760, 892, 24, lt, 3);
    // tea party on the grass: teapot, two cups, steam
    const tx = 960, ty = 896;
    ctx.fillStyle = '#FBF8F1'; ctx.beginPath(); ctx.ellipse(tx, ty - 34, 40, 34, 0, 0, TAU); ctx.fill(); brush(ctx, [[tx - 40, ty - 40], [tx - 30, ty - 6], [tx + 30, ty - 6], [tx + 40, ty - 40]], 3, { seed: 70 });
    line(ctx, [[tx + 38, ty - 40], [tx + 70, ty - 60], [tx + 78, ty - 72]], 4, C.blue, 0.85); line(ctx, [[tx - 38, ty - 50], [tx - 62, ty - 40], [tx - 40, ty - 22]], 3.5, C.blue, 0.8);
    ctx.fillStyle = rgba(C.blue, 0.85); ctx.beginPath(); ctx.ellipse(tx, ty - 68, 16, 6, 0, 0, TAU); ctx.fill();
    for (const cx of [tx - 100, tx + 112]) { ctx.fillStyle = '#FBF8F1'; ctx.beginPath(); ctx.moveTo(cx - 18, ty - 26); ctx.lineTo(cx + 18, ty - 26); ctx.quadraticCurveTo(cx + 16, ty - 4, cx, ty - 2); ctx.quadraticCurveTo(cx - 16, ty - 4, cx - 18, ty - 26); ctx.fill(); line(ctx, [[cx - 18, ty - 26], [cx, ty - 2], [cx + 18, ty - 26]], 2, C.blue, 0.85); line(ctx, [[cx - 26, ty], [cx + 26, ty]], 2.5, C.blue, 0.7); }
    for (let k = 0; k < 3; k++) { const ph = lt * 0.8 + k; line(ctx, [[tx + 78 + Math.sin(ph) * 4, ty - 80], [tx + 88 + Math.sin(ph + 1) * 8, ty - 110], [tx + 80 + Math.sin(ph + 2) * 10, ty - 140 - k * 6]], 2, C.grey, 0.35); }
    // branch from the right, the cat on it
    brush(ctx, [[2200, 470], [1900, 520], [1640, 590], [1430, 612], [1360, 606]], 30, { seed: 91, dry: 0.6, end: 0.35 });
    brush(ctx, [[1800, 545], [1760, 450], [1700, 400]], 10, { seed: 92, dry: 0.7 }); brush(ctx, [[1600, 600], [1560, 680], [1520, 720]], 8, { seed: 93, dry: 0.8 });
    const catX = 1520, catY = 600, s = 4.2;
    const grinA = seg(lt, 0.3, 1.1, E.out), vis = seg(lt, 1.5, 3.4, E.inOut);
    const tR = 6.6, scratch = lt > tR + 1 && lt < 11.4, shut = seg(lt, tR + 1.3, tR + 1.8, E.out) * (1 - seg(lt, 11.8, 12.2, E.out));
    cat(ctx, { x: catX, y: catY, s, t: lt, vis, grin: Math.max(grinA * (1 - vis), vis), shut, purr: shut });
    // the Hatter reaches up to scratch behind the ear
    const ear = [catX - 18 * s, catY - 22 * s], h = 330, a = lerp(0.12, -2.0, seg(lt, tR, tR + 1.0, E.inOut) * (1 - seg(lt, 11.6, 12.6, E.inOut))) + (scratch ? Math.sin(lt * 13) * 0.05 : 0);
    const probe = handPos({ x: 0, y: 820, h, face: 1, arm: -2.0 });
    figure(ctx, { who: 'xc', x: ear[0] - probe[0], y: 820, h, face: 1, t: lt, arm: a, hat: true, seed: 6 });
  });
}

// ================= 5. Night train, Christmas fairs, Prague in snow =================
export function s5(ctx, lt, env) {
  const { L } = env;
  L(0.4, () => {
    const g = ctx.createLinearGradient(0, 0, 0, 880); g.addColorStop(0, rgba(C.night, 0.97)); g.addColorStop(0.8, rgba(C.night, 0.92)); g.addColorStop(0.9, rgba(C.night, 0.6)); g.addColorStop(1, rgba(C.night, 0));
    ctx.fillStyle = g; ctx.fillRect(-400, 0, 2800, 880);
    for (let i = 0; i < 8; i++) wash(ctx, -200 + i * 330, 200 + (i % 3) * 130, 260, C.nightD, 0.35, { seed: 140 + i, sy: 0.6 });
    glow(ctx, 1690, 160, 180, C.paper, 0.18); ctx.fillStyle = rgba(C.paper, 0.95); ctx.beginPath(); ctx.arc(1690, 160, 46, 0, TAU); ctx.fill();
  });
  L(0.72, () => { // Prague: spires, a dome, warm windows, snow on the roofs
    ctx.fillStyle = rgba('#141119', 0.96); const base = 650;
    ctx.beginPath(); ctx.moveTo(1000, base);
    const sky = [[1000, 560], [1060, 540], [1100, 560], [1130, 520], [1180, 520], [1200, 470], [1260, 470], [1280, 520], [1330, 520], [1330, 330], [1350, 300], [1360, 230], [1372, 300], [1392, 330], [1392, 420], [1420, 420], [1420, 330], [1440, 300], [1452, 225], [1464, 300], [1484, 330], [1484, 520], [1560, 530], [1600, 500], [1640, 530], [1690, 530], [1700, 380], [1712, 260], [1724, 380], [1734, 530], [1800, 545], [1850, 515], [1900, 540], [2000, 530], [2300, 560], [2300, base]];
    sky.forEach(p => ctx.lineTo(p[0], p[1])); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(1230, 470, 30, Math.PI, 0); ctx.fill();
    for (const [x, y, h] of [[1340, 330, 30], [1384, 330, 30], [1430, 330, 30], [1476, 330, 30]]) { ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.lineTo(x, y - h); ctx.lineTo(x + 8, y); ctx.fill(); }
    const r = rng(150);
    for (let i = 0; i < 70; i++) { const x = 1010 + r() * 1250, y = 470 + r() * 160, tw = 0.6 + 0.4 * Math.sin(lt * (1 + r() * 2) + i); if (x > 1330 && x < 1484 && y < 520) continue; ctx.fillStyle = rgba(C.gold, 0.85 * tw); ctx.fillRect(x, y, 6, 8); }
    for (const [x0, y0, x1, y1] of [[1060, 540, 1100, 560], [1130, 520, 1180, 520], [1560, 530, 1600, 500], [1600, 500, 1640, 530], [1850, 515, 1900, 540]]) line(ctx, [[x0, y0 + 3], [x1, y1 + 3]], 4, C.paper, 0.9);
  });
  L(0.88, () => { // viaduct + the night train with the two of them in a window
    ctx.fillStyle = rgba('#100D15', 0.97); ctx.fillRect(-400, 618, 2800, 20);
    for (let x = -360; x < 2400; x += 150) { ctx.beginPath(); ctx.moveTo(x, 636); ctx.lineTo(x, 780); ctx.lineTo(x + 26, 780); ctx.lineTo(x + 26, 690); ctx.quadraticCurveTo(x + 75, 640, x + 124, 690); ctx.lineTo(x + 124, 780); ctx.lineTo(x + 150, 780); ctx.lineTo(x + 150, 636); ctx.closePath(); ctx.fill(); }
    const head = lerp(-700, 2700, clamp((lt + 1.2) / 16));
    glow(ctx, head + 60, 598, 140, C.gold, 0.35);
    for (let c = 0; c < 6; c++) {
      const x = head - c * 158 - 150; if (x > 2300 || x < -500) continue;
      ctx.fillStyle = '#0D0B11'; ctx.beginPath(); ctx.roundRect(x, 570, 150, 46, c ? 6 : [6, 22, 6, 6]); ctx.fill();
      for (let w = 0; w < (c ? 6 : 2); w++) { const wx = x + 14 + w * 22; ctx.fillStyle = rgba(C.gold, 0.9); ctx.fillRect(wx, 580, 14, 14); if (c === 3 && (w === 2 || w === 3)) { ctx.fillStyle = '#0D0B11'; ctx.beginPath(); ctx.arc(wx + 7, 591, 4.2, 0, TAU); ctx.fill(); if (w === 2) { ctx.fillStyle = C.paper; ctx.fillRect(wx + 2, 586, 10, 1.6); } } }
      glow(ctx, x + 75, 588, 70, C.gold, 0.12);
    }
  });
  L(1.06, () => { // snowy square: market stalls, string lights, a tree
    wash(ctx, 900, 820, 900, C.blueL, 0.18, { sy: 0.12, seed: 160 });
    const lights = (x0, x1, y0, sag, n, seed) => { const P = []; for (let i = 0; i <= n; i++) { const k = i / n; P.push([lerp(x0, x1, k), y0 + Math.sin(k * Math.PI) * sag]); } line(ctx, P, 1.5, C.ink, 0.6); P.forEach(([x, y], i) => { const tw = 0.55 + 0.45 * Math.sin(lt * 3 + i * 1.9 + seed); glow(ctx, x, y + 6, 16, C.gold, 0.5 * tw); ctx.fillStyle = rgba(C.goldL, tw); ctx.beginPath(); ctx.arc(x, y + 5, 3.6, 0, TAU); ctx.fill(); }); };
    for (let i = 0; i < 4; i++) {
      const x = 120 + i * 230, y = 930;
      glow(ctx, x + 85, y - 50, 110, C.gold, 0.3);
      ctx.fillStyle = rgba(C.goldL, 0.55); ctx.fillRect(x + 12, y - 92, 146, 70);
      brush(ctx, [[x, y], [x, y - 112]], 5, { seed: 170 + i }); brush(ctx, [[x + 170, y], [x + 170, y - 112]], 5, { seed: 180 + i }); brush(ctx, [[x - 6, y - 20], [x + 176, y - 20]], 6, { seed: 190 + i });
      ctx.fillStyle = rgba(C.ink, 0.9); ctx.beginPath(); ctx.moveTo(x - 24, y - 110); ctx.lineTo(x + 85, y - 176); ctx.lineTo(x + 194, y - 110); ctx.closePath(); ctx.fill();
      ctx.fillStyle = C.paper; ctx.beginPath(); ctx.moveTo(x - 18, y - 118); ctx.lineTo(x + 85, y - 180); ctx.lineTo(x + 188, y - 118); ctx.quadraticCurveTo(x + 85, y - 150, x - 18, y - 118); ctx.fill();
    }
    lights(60, 1080, 742, 40, 22, 1);
    const tx = 1180, ty = 960; // tree
    for (let k = 0; k < 4; k++) { const w = 130 - k * 26, yy = ty - k * 62; ctx.fillStyle = rgba(C.ink, 0.88); ctx.beginPath(); ctx.moveTo(tx - w, yy); ctx.lineTo(tx, yy - 110); ctx.lineTo(tx + w, yy); ctx.closePath(); ctx.fill(); line(ctx, [[tx - w + 10, yy - 4], [tx, yy - 30], [tx + w - 10, yy - 4]], 5, C.paper, 0.9); }
    const r = rng(200); for (let i = 0; i < 24; i++) { const k = r(), yy = ty - k * 280, xx = tx + (r() - 0.5) * (130 - k * 110) * 1.6, tw = 0.5 + 0.5 * Math.sin(lt * 4 + i); ctx.fillStyle = rgba(C.goldL, tw); ctx.beginPath(); ctx.arc(xx, yy, 3.4, 0, TAU); ctx.fill(); }
    glow(ctx, tx, ty - 330, 40, C.gold, 0.8); lotus(ctx, tx, ty - 318, 0.5, 1, { tint: C.gold, base: C.goldL, seed: 9 });
  });
  L(1.15, () => { const r = rng(210); for (let i = 0; i < 170; i++) { const sp = 35 + r() * 55, x = -300 + ((r() * 2600 + Math.sin(lt * 0.7 + i) * 20) % 2600), y = ((r() * 1180 + lt * sp) % 1180) - 50, s = 1.6 + r() * 3.4; ctx.fillStyle = rgba('#FFFFFF', 0.75); ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill(); } });
}

// ================= 6. He takes his hand; everything else goes into mist =================
export const S6 = { xc: 806, jc: 1114, y: 1060, h: 520, arm: -0.75 };
export function s6(ctx, lt, env) {
  const { L } = env, m = seg(lt, 5.0, 9.6, E.inOut);
  L(0.5, () => { mountain(ctx, R('6a', 61, -300, 2300, 720, 300, 3), 760, C.lav, 0.45, { lw: 5, la: 0.5, seed: 61, ridgeColor: C.purpleD }); mountain(ctx, R('6b', 62, -300, 2300, 740, 170, 4), 780, C.blueL, 0.4, { lw: 4, la: 0.4, seed: 62, ridgeColor: C.blueD }); mistBand(ctx, -300, 2300, 760, 110, 0.8, lt, 63); });
  L(0.85, () => ripples(ctx, -300, 2300, 790, 1080, lt, 64, C.blueD, 0.18));
  L(1.1, () => { // willow on the left, swaying
    brush(ctx, [[120, 1100], [150, 820], [110, 520], [180, 260], [130, 60]], 46, { seed: 65, dry: 0.7, end: 0.2 });
    brush(ctx, [[150, 380], [330, 250], [520, 220]], 16, { seed: 66, dry: 0.7 }); brush(ctx, [[160, 250], [60, 120], [-60, 80]], 14, { seed: 67, dry: 0.7 });
    const r = rng(68);
    for (let i = 0; i < 26; i++) { const x0 = lerp(-60, 540, r()), y0 = 90 + r() * 200, l = 260 + r() * 380, sw = Math.sin(lt * 0.9 + i * 0.7) * 22;
      brush(ctx, [[x0, y0], [x0 + 6 + sw * 0.3, y0 + l * 0.4], [x0 + 10 + sw, y0 + l]], 3.2, { seed: 300 + i, alpha: 0.55, dry: 0.5, end: 0.6 }); }
  });
  // the world fades into mist, only the two of them stay
  ctx.fillStyle = rgba(C.paper, m * 0.93); ctx.fillRect(-400, -10, 2800, 1100);
  glow(ctx, 960, 620, 620 * (0.6 + 0.4 * m), '#FFFFFF', 0.55 * m, { sy: 0.8 });
  L(1, () => {
    const tA = 2.0, tB = 2.8, aX = lerp(0.12, S6.arm, seg(lt, tA, tA + 2.2, E.inOut)), aJ = lerp(0.12, S6.arm, seg(lt, tB, tB + 1.6, E.inOut)), hp = handPos({ x: S6.xc, y: S6.y, h: S6.h, face: 1, arm: S6.arm });
    const tJoin = 4.4, j = seg(lt, tJoin, tJoin + 0.6, E.out);
    if (j > 0) glow(ctx, hp[0], hp[1], 170 * j * (1 + 0.08 * Math.sin(lt * 2.4)), C.goldL, 0.55 * j);
    figure(ctx, { who: 'xc', x: S6.xc, y: S6.y, h: S6.h, face: 1, t: lt, arm: aX, wind: 0.8, seed: 2 });
    figure(ctx, { who: 'jc', x: S6.jc, y: S6.y, h: S6.h, face: -1, t: lt, arm: aJ, wind: 0.8, seed: 4 });
    // the red thread of fate, tied between their hands
    const p = seg(lt, 5.0, 7.2, E.inOut);
    if (p > 0) brush(ctx, [[-12, 5], [-30, 40], [2, 80], [40, 60], [30, 20], [12, 5], [50, 110], [130, 220], [280, 300]].map(([a, b]) => [hp[0] + a, hp[1] + b]), 2.6, { color: C.red, alpha: 0.95, prog: p, dry: 0, start: 0.02, end: 0.15, bleed: 0.2, step: 3 });
    const r = rng(69); // drifting petals in the mist
    for (let i = 0; i < 12; i++) { const t0 = 9 + i * 0.4, q = clamp((lt - t0) / 7); if (q <= 0 || q >= 1) continue; const x = lerp(1500 + r() * 400, 300 + r() * 500, q), y = lerp(200 + r() * 200, 900, q) + Math.sin(q * 8 + i) * 30;
      ctx.save(); ctx.translate(x, y); ctx.rotate(q * 6 + i); wash(ctx, 0, 0, 9, i % 2 ? C.lav : C.pink, 0.8 * Math.sin(q * Math.PI), { sy: 0.55, lobes: 2, seed: i }); ctx.restore(); }
  });
}

// ================= 7. Yunmeng lotus and Gusu clouds become one landscape =================
export function s7(ctx, lt, env) {
  const { L, lines } = env;
  L(0.5, () => { mountain(ctx, R('7a', 71, 860, 2350, 700, 560, 3), 740, C.blueL, 0.6, { lw: 6, la: 0.55, seed: 71, ridgeColor: C.blueD }); mountain(ctx, R('7c', 73, -300, 900, 700, 160, 3), 740, C.lav, 0.4, { lw: 4, la: 0.45, seed: 73, ridgeColor: C.purpleD }); line(ctx, [[1560, 330], [1566, 520], [1562, 690]], 3, '#FFFFFF', 0.8); });
  L(0.62, () => { mountain(ctx, R('7b', 72, 700, 2350, 720, 320, 4), 760, C.blue, 0.32, { lw: 4, la: 0.4, seed: 72, ridgeColor: C.blueD }); mistBand(ctx, -300, 2300, 730, 120, 0.85, lt, 74); });
  L(0.85, () => { ripples(ctx, -300, 2300, 750, 1080, lt, 75, C.blueD, 0.2); ctx.save(); ctx.translate(0, 1480); ctx.scale(1, -1); ctx.globalAlpha = 0.1; mountain(ctx, R('7a', 71, 860, 2350, 700, 560, 3), 740, C.blue, 0.8, { lw: 0, cun: 0 }); ctx.restore(); });
  L(0.75, () => { // cloud curls drifting from Gusu over the lake
    for (const [x, y, s, k] of [[1900, 260, 1.3, 0], [1500, 380, 1.0, 1], [2150, 470, 1.2, 2], [1300, 200, 0.8, 3]]) cloudCurl(ctx, x - lt * (34 + k * 6), y + Math.sin(lt * 0.5 + k) * 8, s, 0.95, 400 + k * 10);
  });
  L(1, () => { // the boat with the two of them drifting towards the mountains
    const bx = lerp(260, 1220, clamp(lt / 15)), by = 838 + Math.sin(lt * 1.4) * 3;
    figure(ctx, { who: 'xc', x: bx - 18, y: by - 6, h: 92, face: 1, sit: true, t: lt, seed: 2 }); figure(ctx, { who: 'jc', x: bx + 30, y: by - 6, h: 90, face: 1, sit: true, t: lt, seed: 4 });
    ctx.fillStyle = rgba(C.ink, 0.88); ctx.beginPath(); ctx.moveTo(bx - 110, by - 14); ctx.quadraticCurveTo(bx, by + 26, bx + 120, by - 18); ctx.quadraticCurveTo(bx, by + 6, bx - 110, by - 14); ctx.fill();
    line(ctx, [[bx - 130, by + 18], [bx + 140, by + 18]], 2, C.blueD, 0.3);
    const cl = seg(lt, 3, 8, E.out), cx = lerp(1350, 1000, cl); // a cloud settles in the middle, a lotus opens on it
    cloudCurl(ctx, cx, 520, 1.6, cl, 480);
    const lo = seg(lt, (lines[3] ?? 8.5), (lines[3] ?? 8.5) + 2.6, E.out);
    if (lo > 0) lotus(ctx, cx, 492, 2.6 * (0.6 + 0.4 * lo), lo, { tint: C.purple, glowA: 0.6 * lo, seed: 77 });
  });
  L(1.14, () => {
    pond(ctx, lt, [[-60, 930, 150], [180, 880, 110], [420, 960, 170], [650, 900, 110], [120, 1050, 160], [520, 1070, 120], [1500, 960, 120], [1780, 900, 100], [2000, 1010, 140]], 78);
    const F = [[60, 820, 1.6, 0], [300, 780, 1.2, 0.6], [560, 850, 1.8, 1.2], [760, 800, 1.1, 1.8], [1450, 860, 1.4, 4], [1700, 800, 1.2, 5.2], [1960, 880, 1.6, 6.4]];
    F.forEach(([x, y, s, t0], i) => flower(ctx, lt, x, y, s, t0, 200 + i, 80 + s * 30, i > 3 ? C.purpleL : C.purple));
  });
}

// ================= 8. Moon over the pier, lanterns: the prize =================
export function s8(ctx, lt, env) {
  const { L } = env;
  L(0.5, () => {
    const g = ctx.createLinearGradient(0, 0, 0, 700); g.addColorStop(0, rgba(C.inkS, 0.42)); g.addColorStop(1, rgba(C.inkS, 0)); ctx.fillStyle = g; ctx.fillRect(-400, 0, 2800, 700);
    glow(ctx, 960, 290, 420, '#FFF7DD', 0.7); ctx.fillStyle = rgba('#F8EFD3', 0.97); ctx.beginPath(); ctx.arc(960, 290, 170, 0, TAU); ctx.fill();
    wash(ctx, 910, 250, 40, C.paperD, 0.55, { seed: 81 }); wash(ctx, 1020, 340, 28, C.paperD, 0.45, { seed: 82 });
    mountain(ctx, R('8a', 81, -300, 2300, 650, 200, 4), 690, C.inkS, 0.4, { lw: 4, la: 0.5, seed: 81 }); mistBand(ctx, -300, 2300, 660, 110, 0.6, lt, 83);
  });
  L(0.85, () => {
    ripples(ctx, -300, 2300, 690, 1080, lt, 84, C.blueD, 0.2);
    for (let i = 0; i < 16; i++) { const y = 710 + i * 22, w = 60 + i * 9 + Math.sin(lt * 2 + i) * 14; ctx.fillStyle = rgba(C.goldL, 0.55 - i * 0.025); ctx.fillRect(960 - w / 2 + Math.sin(lt * 1.5 + i * 2) * 10, y, w, 4); }
  });
  L(1, () => {
    for (let i = 0; i < 4; i++) { const t0 = 0.5 + i * 1.6, k = clamp((lt - t0) / 16); if (k <= 0) continue; lantern(ctx, 380 + i * 230 + Math.sin(lt * 0.6 + i) * 20, 700 - k * 600, 22 - i * 2, lt, { kind: 'sky', seed: i + 3 }); }
    for (let i = 0; i < 7; i++) { const x = ((1500 - i * 260 - lt * 18) % 2200 + 2200) % 2200 - 200, y = 770 + (i % 3) * 80 + Math.sin(lt + i) * 4; lantern(ctx, x, y, 16 + (i % 3) * 5, lt, { seed: i + 10 }); }
    brush(ctx, [[1180, 772], [1700, 770], [2300, 774]], 12, { seed: 85 }); for (let x = 1220; x < 2300; x += 120) brush(ctx, [[x, 780], [x + 2, 870]], 8, { seed: x });
    figure(ctx, { who: 'xc', x: 1330, y: 768, h: 150, face: -1, sit: true, t: lt, seed: 2 });
    figure(ctx, { who: 'jc', x: 1396, y: 768, h: 146, face: -1, sit: true, t: lt, seed: 4 });
  });
}
