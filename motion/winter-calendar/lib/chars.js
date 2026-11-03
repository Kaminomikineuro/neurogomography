// Chibi rig for Lan Xichen ('xc') and Jiang Wanyin ('jc'), drawn in code (no character PNGs were provided).
// Local units: the character is 100 tall, feet at (0,0), y up = negative. drawChibi() returns world positions of the
// hands and head so scenes can attach props (the umbrella, mugs …).
import { TAU, clamp, lerp, hash } from './mg.js';
import { glow, C } from './draw.js';

const INK = '#1B1730';
export const PAL = {
  skin: '#FCE8DA', skinS: '#F1CDBD', blush: 'rgba(238,128,150,0.5)', hair: '#1D1830', hairHi: '#3B3460',
  xc: { robe: '#2E2A2C', robeS: '#1F1C1E', trim: '#E0362E', trimD: '#E0362E', sash: '#E0362E', shoe: '#1F1C1E', iris: '#3A2B2E', rib: '#E0362E' },
  jc: { robe: '#6A4FA6', robeS: '#56398E', inner: '#D9CBF0', trim: '#2A1B45', shoe: '#2A1D40', iris: '#3B2266' },
};

function ell(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU); }
let MODE = 'both';
export const setMode = (m) => { MODE = m; };
function fs(ctx, fill, lw = 1.15) { if (fill && MODE !== 'line') { ctx.fillStyle = fill; ctx.fill(); } if (MODE === 'fill') return; ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }

// deterministic blinking: a blink of ~0.13 s every 2.4–4.8 s (seeded per character)
export function blinkAt(t, seed) {
  let tt = hash(seed, 11) * 2.5;
  for (let i = 0; i < 60 && tt < t + 1; i++) { if (t >= tt && t < tt + 0.13) return 1 - Math.abs((t - tt) / 0.13 * 2 - 1); tt += 2.4 + hash(i, seed) * 2.4; }
  return 0;
}

// ---------------- face parts ----------------
function eye(ctx, x, y, kind, w, iris, look) {
  ctx.save(); ctx.lineCap = 'round';
  if (kind === 'happy') { ctx.strokeStyle = INK; ctx.lineWidth = 1.7; ctx.beginPath(); ctx.arc(x, y + 2, 3.8 * w, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke(); }
  else if (kind === 'closed' || kind === 'sleep') { ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y - 1.5, 3.8 * w, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke(); }
  else if (kind === 'squeeze') { ctx.strokeStyle = INK; ctx.lineWidth = 1.7; const d = x < 0 ? 1 : -1; ctx.beginPath(); ctx.moveTo(x - 3.4 * d * w, y - 3); ctx.lineTo(x + 2.6 * d * w, y); ctx.lineTo(x - 3.4 * d * w, y + 3); ctx.stroke(); }
  else if (kind === 'wide') { ell(ctx, x, y, 4.3 * w, 5.4); fs(ctx, '#FFFFFF', 1.1); ell(ctx, x + look[0], y + look[1], 1.7 * w, 2.0); ctx.fillStyle = INK; ctx.fill(); }
  else { // open / sparkle / tsun / look-up
    const big = kind === 'sparkle' ? 1.18 : 1, ry = kind === 'tsun' ? 3.9 : 4.9 * big, rx = 3.7 * w * big;
    ell(ctx, x + look[0] * 0.4, y + (kind === 'tsun' ? 0.8 : 0) + look[1] * 0.4, rx, ry); ctx.fillStyle = iris; ctx.fill();
    ell(ctx, x + look[0] * 0.4, y + 1.6 + look[1] * 0.4, rx * 0.72, ry * 0.42); ctx.fillStyle = 'rgba(160,140,230,0.55)'; ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ell(ctx, x - 1.1 * w + look[0] * 0.6, y - 1.9 + look[1] * 0.5, 1.4 * w, 1.6); ctx.fill(); ell(ctx, x + 1.4 * w, y + 1.6, 0.7 * w, 0.7); ctx.fill();
    if (kind === 'sparkle') { ctx.fillStyle = C.goldHi; const sx = x + 1.3 * w, sy = y - 2.2; ctx.beginPath(); ctx.moveTo(sx, sy - 2.4); ctx.quadraticCurveTo(sx, sy, sx + 2.4, sy); ctx.quadraticCurveTo(sx, sy, sx, sy + 2.4); ctx.quadraticCurveTo(sx, sy, sx - 2.4, sy); ctx.quadraticCurveTo(sx, sy, sx, sy - 2.4); ctx.fill(); }
    // upper lid line
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath();
    if (kind === 'tsun') { ctx.moveTo(x - rx - 0.6, y - 2.2); ctx.lineTo(x + rx + 0.6, y - 2.9); }
    else ctx.ellipse(x + look[0] * 0.4, y + look[1] * 0.4, rx + 0.3, ry + 0.3, 0, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
  }
  ctx.restore();
}
function brows(ctx, who, dx, kind) {
  ctx.save(); ctx.strokeStyle = PAL.hair; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    const x = s * 9 + dx, y = -77.5; ctx.beginPath();
    if (kind === 'worried') { ctx.moveTo(x - s * 3.5, y + 0.5); ctx.lineTo(x + s * 3.5, y + 2.2); }
    else if (who === 'jc' && kind !== 'soft') { ctx.moveTo(x - s * 3.8, y + 2.6); ctx.lineTo(x + s * 3.6, y - 0.6); }
    else { ctx.moveTo(x - 3.4, y + 0.6); ctx.quadraticCurveTo(x, y - 1.6, x + 3.4, y + 0.6); }
    ctx.stroke();
  }
  ctx.restore();
}
function mouth(ctx, x, y, kind) {
  ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 1.35; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
  switch (kind) {
    case 'grin': case 'laugh': { const w = kind === 'laugh' ? 4.6 : 3.6; ctx.moveTo(x - w, y - 1); ctx.quadraticCurveTo(x, y - 1.6, x + w, y - 1); ctx.quadraticCurveTo(x + w * 0.6, y + 4.6, x, y + 4.8); ctx.quadraticCurveTo(x - w * 0.6, y + 4.6, x - w, y - 1); ctx.closePath(); ctx.fillStyle = '#7A3348'; ctx.fill(); ctx.stroke(); ctx.beginPath(); ell(ctx, x, y + 3.2, w * 0.5, 1.2); ctx.fillStyle = '#E8828F'; ctx.fill(); break; }
    case 'o': ell(ctx, x, y + 1, 1.7, 2.1); ctx.fillStyle = '#7A3348'; ctx.fill(); ctx.stroke(); break;
    case 'flat': ctx.moveTo(x - 2.4, y + 0.6); ctx.lineTo(x + 2.4, y + 0.2); ctx.stroke(); break;
    case 'pout': ctx.moveTo(x - 2.6, y + 1.4); ctx.quadraticCurveTo(x, y - 1.2, x + 2.6, y + 1.4); ctx.stroke(); break;
    case 'wavy': ctx.moveTo(x - 3.6, y + 0.8); for (let i = 1; i <= 6; i++) ctx.lineTo(x - 3.6 + i * 1.2, y + 0.8 + (i % 2 ? -1.1 : 0.4)); ctx.stroke(); break;
    case 'chew': ctx.moveTo(x - 2, y + 0.5); ctx.lineTo(x - 0.6, y - 0.4); ctx.lineTo(x + 0.8, y + 0.6); ctx.lineTo(x + 2.2, y - 0.2); ctx.stroke(); break;
    case 'smirk': ctx.moveTo(x - 2.4, y + 0.8); ctx.quadraticCurveTo(x + 0.6, y + 1.6, x + 2.8, y - 0.6); ctx.stroke(); break;
    case 'sleep': ell(ctx, x, y + 1.2, 1.2, 0.9); ctx.fillStyle = '#7A3348'; ctx.fill(); break;
    default: ctx.moveTo(x - 2.8, y); ctx.quadraticCurveTo(x, y + 2.6, x + 2.8, y); ctx.stroke(); // smile
  }
  ctx.restore();
}

// ---------------- props (drawn in the hand frame, upright) ----------------
function mug(ctx, t, steam = 1) {
  ctx.save(); ctx.translate(0, -2);
  ctx.beginPath(); ctx.roundRect(-4.2, -6.5, 8.4, 9, 1.6); fs(ctx, '#B23A55', 1); ctx.fillStyle = C.cream; ctx.fillRect(-4.2, -3.6, 8.4, 2.2);
  ctx.beginPath(); ctx.arc(4.6, -2.2, 2.2, -1.3, 1.3); ctx.lineWidth = 1.2; ctx.strokeStyle = INK; ctx.stroke();
  if (steam > 0) { ctx.strokeStyle = 'rgba(246,241,231,0.7)'; ctx.lineWidth = 0.9; for (let i = 0; i < 2; i++) { ctx.beginPath(); const sx = -1.6 + i * 3; ctx.moveTo(sx, -8); ctx.bezierCurveTo(sx + 2 * Math.sin(t * 3 + i), -11, sx - 2 * Math.sin(t * 3 + i + 1), -13, sx + Math.sin(t * 2 + i), -16); ctx.globalAlpha = steam * 0.8; ctx.stroke(); } }
  ctx.restore();
}
function stollen(ctx, bite = 0) {
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, -3, 8, 4.4, -0.15, 0, TAU); fs(ctx, '#E9D6B4', 1);
  ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.ellipse(0, -5, 7, 2.6, -0.15, Math.PI, TAU); ctx.fill();
  ctx.fillStyle = '#9C3B4F'; for (const [x, y] of [[-3, -2], [2, -1.5], [4.5, -3]]) { ctx.beginPath(); ctx.arc(x, y, 0.8, 0, TAU); ctx.fill(); }
  if (bite > 0) { ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(7.4, -4, 2.8 * bite, 0, TAU); ctx.arc(8, -1.5, 2.2 * bite, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function chopsticks(ctx, angle = -0.5, roll = false) {
  ctx.save(); ctx.rotate(angle); ctx.strokeStyle = '#8A5A3A'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-1, 0); ctx.lineTo(-1.5, -20); ctx.moveTo(1, 0); ctx.lineTo(1.6, -20); ctx.stroke();
  if (roll) { ctx.translate(0, -20); ctx.beginPath(); ctx.arc(0, 0, 3.4, 0, TAU); fs(ctx, '#1F2A2A', 0.9); ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, TAU); ctx.fillStyle = '#FFF8EE'; ctx.fill(); ctx.beginPath(); ctx.arc(0, 0, 1.1, 0, TAU); ctx.fillStyle = '#F07A5A'; ctx.fill(); }
  ctx.restore();
}
function blaster(ctx, who) {
  ctx.save(); ctx.rotate(-0.25); ctx.beginPath(); ctx.roundRect(-3, -6, 14, 5, 2); fs(ctx, who === 'jc' ? '#7E4BC4' : '#8DB7E2', 1);
  ctx.beginPath(); ctx.roundRect(-2, -2, 4, 6, 1.2); fs(ctx, '#2A2245', 1); ctx.fillStyle = C.gold; ctx.fillRect(9, -5.2, 2.5, 3.4); ctx.restore();
}

// ---------------- the rig ----------------
// P: { who, x, y, h, turn(-1..1), back, walk(0..1), phase(cycles), lean, bob, t, blink, expr:{eyes,mouth,brows},
//      look:[x,y], armL/armR:{a, prop, bite, steam}, wind, windDir, headTilt, blush, zidian, hairUp, sit }
export function drawChibi(ctx, P) {
  const who = P.who, K = PAL[who], h = P.h ?? 330, s = h / 100, turn = P.turn ?? 0, back = !!P.back, walk = P.walk ?? 0, phase = P.phase ?? 0, t = P.t ?? 0;
  const out = {};
  ctx.save(); ctx.translate(P.x, P.y);
  if (!P.noShadow) { ctx.fillStyle = 'rgba(15,13,30,0.25)'; ell(ctx, 0, 0, 25 * s, 5.5 * s); ctx.fill(); }
  ctx.scale(s, s);
  const st = Math.sin(phase * TAU), cs = Math.cos(phase * TAU);
  const bob = -Math.abs(cs) * 2.4 * walk + (P.bob || 0);
  ctx.translate(0, bob); ctx.rotate((P.lean || 0) + st * 0.03 * walk);
  const dx = back ? 0 : turn * 6.5;
  const wind = P.wind ?? 0.15, wdir = P.windDir ?? (turn >= 0 ? -1 : 1);
  const sway = Math.sin(t * 1.7 + (who === 'xc' ? 0 : 2)) * 0.6 + st * walk * 1.6 + wind * wdir * 2.2;

  // ---- hair behind / ribbon tails behind ----
  ctx.save(); ctx.translate(0, 0);
  if (who === 'xc') {
    ctx.beginPath(); ctx.moveTo(-24, -82); ctx.bezierCurveTo(-29, -62, -24 + sway, -36, -16 + sway, -22); ctx.quadraticCurveTo(sway, -18, 16 + sway, -22); ctx.bezierCurveTo(24 + sway, -36, 29, -62, 24, -82); ctx.closePath(); fs(ctx, PAL.hair);
    ribbonTails(ctx, t, wind, wdir, back, turn);
  } else if (!back) ponytail(ctx, P, turn, t, st, walk, wind, wdir, false);
  ctx.restore();

  // ---- feet ----
  for (const side of [-1, 1]) {
    const ph = side < 0 ? st : -st, lift = Math.max(0, side < 0 ? cs : -cs) * 3.5 * walk;
    ell(ctx, side * 7.5 + ph * 5 * walk + turn * 2, -2.6 - lift, 6.2, 3.4); fs(ctx, K.shoe);
  }
  // ---- robe ----
  const hem = st * walk * 1.8 + sway * 0.4;
  ctx.beginPath(); ctx.moveTo(-14.5, -50); ctx.quadraticCurveTo(-17, -28, -24 - hem * 0.4, -5 + hem); ctx.quadraticCurveTo(0, -1.5, 24 - hem * 0.4, -5 - hem); ctx.quadraticCurveTo(17, -28, 14.5, -50); ctx.closePath();
  fs(ctx, K.robe);
  if (who === 'xc') { // blue hem band and front trims
    ctx.save(); ctx.clip(); ctx.fillStyle = K.trim; ctx.fillRect(-30, -9, 60, 9); ctx.fillStyle = K.robeS; ctx.fillRect(back ? -30 : 6 + turn * 3, -50, 30, 50); ctx.restore();
    if (!back) { ctx.strokeStyle = K.trimD; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-6 + dx * 0.5, -50); ctx.lineTo(1 + dx * 0.4, -36); ctx.lineTo(3 + dx * 0.3, -4); ctx.stroke(); }
  } else {
    ctx.save(); ctx.clip(); ctx.fillStyle = K.robeS; ctx.fillRect(back ? -30 : 4 + turn * 3, -50, 30, 50); ctx.fillStyle = '#7A4FC0'; ctx.fillRect(-30, -8, 60, 8); ctx.restore();
    if (!back) { ctx.fillStyle = K.inner; ctx.beginPath(); ctx.moveTo(-7 + dx * 0.5, -50); ctx.lineTo(dx * 0.45, -38); ctx.lineTo(7 + dx * 0.5, -50); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke(); }
  }
  // sash / belt
  ctx.beginPath(); ctx.moveTo(-16.2, -37); ctx.lineTo(16.2, -37); ctx.lineTo(16.8, -31.5); ctx.lineTo(-16.8, -31.5); ctx.closePath(); fs(ctx, who === 'xc' ? K.sash : K.trim, 1);
  if (who === 'jc') { // silver bell on a purple tassel, swinging
    ctx.save(); ctx.translate(back ? -9 : 10 + dx * 0.3, -31); ctx.rotate(Math.sin(t * 3 + st * 2) * 0.25 + walk * st * 0.3);
    ctx.strokeStyle = '#8D63D2'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 4); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 7.2, 3.3, 0, TAU); fs(ctx, '#EEF0F6', 1); ctx.fillStyle = '#9AA0B8'; ctx.fillRect(-2.2, 7.4, 4.4, 0.9);
    ctx.fillStyle = '#7E4BC4'; ctx.beginPath(); ctx.moveTo(-1.6, 10.2); ctx.lineTo(1.6, 10.2); ctx.lineTo(2.4, 17); ctx.lineTo(-2.4, 17); ctx.closePath(); ctx.fill();
    out.bell = local(ctx, 0, 7);
    ctx.restore();
  }

  // ---- arms ----
  for (const side of [-1, 1]) {
    const A = side < 0 ? (P.armL || {}) : (P.armR || {});
    const a = (A.a ?? 0.12) + st * walk * 0.18 * side;
    ctx.save(); ctx.translate(side * 13, -46.5); ctx.rotate(-side * a);
    ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.quadraticCurveTo(10, 12, 9, 21); ctx.quadraticCurveTo(0, 24.5, -9, 21); ctx.quadraticCurveTo(-10, 12, -5, 0); ctx.closePath();
    fs(ctx, side > 0 ? K.robeS : K.robe);
    ctx.fillStyle = who === 'xc' ? K.trim : '#7A4FC0'; ctx.beginPath(); ctx.moveTo(-9, 21); ctx.quadraticCurveTo(0, 24.5, 9, 21); ctx.lineTo(9.4, 18.2); ctx.quadraticCurveTo(0, 21.4, -9.4, 18.2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 24, 3.7, 0, TAU); fs(ctx, PAL.skin, 1);
    const hp = local(ctx, 0, 24); if (side < 0) out.handL = hp; else out.handR = hp;
    if (who === 'jc' && side > 0) { // Zidian ring
      ctx.beginPath(); ctx.ellipse(1.6, 24.6, 1.6, 1.1, 0.4, 0, TAU); ctx.fillStyle = '#B57BFF'; ctx.fill(); ctx.lineWidth = 0.7; ctx.strokeStyle = INK; ctx.stroke();
    }
    // props, kept upright
    if (A.prop) { ctx.save(); ctx.translate(0, 24); ctx.rotate(side * a + (P.lean || 0) * -1); drawProp(ctx, A, who, t); ctx.restore(); }
    ctx.restore();
  }
  if (who === 'jc' && (P.zidian || 0) > 0.01 && out.handR) zidianSparks(ctx, P, out.handR, t);

  // ---- head ----
  ctx.save(); ctx.translate(0, -50); ctx.rotate(P.headTilt || 0); ctx.translate(0, 50);
  const hx = back ? 0 : turn * 3;
  ell(ctx, hx, -71, 26, 24.5); fs(ctx, PAL.skin);
  out.head = local(ctx, hx, -71);
  if (back) {
    ell(ctx, hx, -73, 27.2, 26); fs(ctx, PAL.hair);
    if (who === 'xc') { ctx.strokeStyle = INK; ctx.lineWidth = 6.4; ctx.beginPath(); ctx.moveTo(-26, -78); ctx.quadraticCurveTo(0, -72, 26, -78); ctx.stroke(); ctx.strokeStyle = PAL.xc.rib; ctx.lineWidth = 4.2; ctx.stroke(); ctx.beginPath(); ctx.arc(0, -74.5, 2.6, 0, TAU); fs(ctx, '#F4EDE0', 0.9); }
    else { ponytail(ctx, P, 0, t, st, walk, wind, wdir, true); ctx.beginPath(); ctx.arc(0, -94, 4.2, 0, TAU); fs(ctx, '#7E4BC4', 1); }
  } else {
    const ex = (P.expr && P.expr.eyes) || 'open';
    const blink = P.blink ?? 0, eyeKind = blink > 0.5 && (ex === 'open' || ex === 'sparkle' || ex === 'tsun' || ex === 'wide') ? 'closed' : ex;
    const look = P.look || [turn * 1.6, 0];
    const wNear = 1, wFar = 1 - Math.abs(turn) * 0.28;
    const iris = K.iris;
    eye(ctx, -9 + dx, -67, eyeKind, turn > 0 ? wFar : wNear, iris, look);
    eye(ctx, 9 + dx, -67, eyeKind, turn < 0 ? wFar : wNear, iris, look);
    brows(ctx, who, dx, (P.expr && P.expr.brows) || 'default');
    const bl = P.blush ?? (who === 'xc' ? 0.6 : 0.25);
    if (bl > 0) { ctx.save(); ctx.globalAlpha = bl; ctx.fillStyle = PAL.blush; ell(ctx, -14 + dx, -60.5, 4.6, 2.4); ctx.fill(); ell(ctx, 14 + dx, -60.5, 4.6, 2.4); ctx.fill(); if (bl > 0.7) { ctx.strokeStyle = 'rgba(200,80,110,0.7)'; ctx.lineWidth = 0.8; for (const sx of [-14, 14]) for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(sx + dx - 2.5 + i * 2.2, -59.2); ctx.lineTo(sx + dx - 1.5 + i * 2.2, -62); ctx.stroke(); } } ctx.restore(); }
    mouth(ctx, dx * 1.1, -57.5, (P.expr && P.expr.mouth) || 'smile');
    if (P.expr && P.expr.cheek) { ell(ctx, (turn >= 0 ? 15 : -15) + dx, -58.5, 4.2, 3.6); fs(ctx, PAL.skin, 0.9); }
    // bangs
    hairFront(ctx, who, dx, t, P.hairUp || 0);
    if (who === 'xc') { // forehead ribbon + silver crown piece
      ctx.strokeStyle = INK; ctx.lineWidth = 5.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-25.4, -80.5); ctx.quadraticCurveTo(dx, -89, 25.4, -80.5); ctx.stroke();
      ctx.strokeStyle = PAL.xc.rib; ctx.lineWidth = 3.6; ctx.stroke();
      ctx.beginPath(); ctx.arc(dx, -85, 2.4, 0, TAU); ctx.arc(dx - 2.4, -84.2, 1.6, 0, TAU); ctx.arc(dx + 2.4, -84.2, 1.6, 0, TAU); ctx.fillStyle = '#F4EDE0'; ctx.fill();
    }
    ctx.beginPath(); // crown / hair tie at the top
    if (who === 'xc') { ctx.moveTo(dx - 4, -97); ctx.lineTo(dx - 2.5, -103); ctx.lineTo(dx, -99.5); ctx.lineTo(dx + 2.5, -103); ctx.lineTo(dx + 4, -97); ctx.closePath(); fs(ctx, '#E9EDF5', 0.9); }
    else { ctx.arc(dx - turn * 13, -95.5, 3.6, 0, TAU); fs(ctx, '#7E4BC4', 0.9); }
  }
  ctx.restore(); // head tilt

  // emotes
  if (P.zz > 0) zz(ctx, t, P.zz, turn);
  if (P.sweat > 0) { ctx.save(); ctx.globalAlpha = P.sweat; ctx.beginPath(); ctx.moveTo(24, -86); ctx.quadraticCurveTo(28, -78, 24.5, -76); ctx.quadraticCurveTo(21, -78, 24, -86); fs(ctx, '#CFE6FF', 0.9); ctx.restore(); }
  if (P.heart > 0) { ctx.save(); ctx.globalAlpha = P.heart; ctx.translate(22, -104 - P.heart * 6); ctx.scale(0.7, 0.7); heartShape(ctx); fs(ctx, '#E86A8E', 1); ctx.restore(); }
  if (P.exclaim > 0) { ctx.save(); ctx.globalAlpha = Math.min(1, P.exclaim * 2); ctx.translate(-26, -106); ctx.rotate(-0.25); ctx.fillStyle = C.gold; ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(-1.8, -9, 3.6, 8, 1.6); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 2.5, 1.9, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore(); }
  ctx.restore();
  return out;
}

function ponytail(ctx, P, turn, t, st, walk, wind, wdir, back) {
  // a high ponytail: base at the crown, hanging to one side behind the head (front) or down the back (back view)
  const hu = P.hairUp || 0, side = back ? 0 : (turn > 0.05 ? -1 : 1);
  const px = back ? 0 : side * 10 - turn * 8, py = -94;
  const swing = Math.sin(t * 2.1) * 2 + st * walk * 3 + wind * wdir * 6;
  const ex = px + side * 16 + swing * 1.2, ey = py + 50 - hu * 100;
  ctx.beginPath(); ctx.moveTo(px - 5, py);
  ctx.bezierCurveTo(px + side * 14 - 6, py + 6 - hu * 30, ex - 8 + swing * 0.5, ey - 22 + hu * 40, ex, ey);
  ctx.bezierCurveTo(ex + 6 + swing * 0.3, ey - 20 + hu * 40, px + side * 16 + 8, py + 4 - hu * 30, px + 6, py);
  ctx.closePath(); fs(ctx, PAL.hair);
  ctx.strokeStyle = PAL.hairHi; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(px + side * 4, py + 6); ctx.quadraticCurveTo(px + side * 12, py + 22 - hu * 40, ex - side * 2, ey - 10 + hu * 20); ctx.stroke();
}

function local(ctx, x, y) { const m = ctx.getTransform(); return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f, s: Math.hypot(m.a, m.b) }; }

function hairFront(ctx, who, dx, t, up) {
  ctx.beginPath(); ctx.moveTo(-27.5, -64); ctx.bezierCurveTo(-29, -93, -10, -101.5, dx, -99.5); ctx.bezierCurveTo(10, -101.5, 29, -93, 27.5, -64);
  if (who === 'xc') {
    ctx.lineTo(23, -70); ctx.quadraticCurveTo(17, -83, 7 + dx, -84.5); ctx.lineTo(dx + 1.2, -92); ctx.lineTo(dx - 1.2, -92); ctx.lineTo(-7 + dx, -84.5); ctx.quadraticCurveTo(-17, -83, -23, -70);
  } else {
    const tips = [[22, -71], [17, -78], [13, -73], [8, -80], [3, -75], [-2, -82], [-7, -76], [-12, -80], [-16, -74], [-21, -79], [-23, -70]];
    for (const [x, y] of tips) ctx.lineTo(x + dx * (1 - Math.abs(x) / 30), y + Math.sin(t * 2 + x) * 0.3 - up * 4);
  }
  ctx.closePath(); fs(ctx, PAL.hair);
  ctx.strokeStyle = PAL.hairHi; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(dx * 0.4, -78, 21, Math.PI * 1.25, Math.PI * 1.45); ctx.stroke();
  // side locks framing the face
  for (const s of [-1, 1]) {
    const x0 = s * 25.5, sw = Math.sin(t * 1.6 + s) * 0.8;
    ctx.beginPath(); ctx.moveTo(x0, -78); ctx.quadraticCurveTo(x0 + s * 3.5, -60, x0 + s * 1 + sw, who === 'xc' ? -44 : -52); ctx.quadraticCurveTo(x0 - s * 3.5, -60, x0 - s * 4.5, -76); ctx.closePath(); fs(ctx, PAL.hair, 1);
  }
}

function ribbonTails(ctx, t, wind, wdir, back, turn) {
  const ox = back ? 0 : -turn * 18, oy = back ? -74 : -82;
  for (let i = 0; i < 2; i++) {
    const L = 34 + wind * 34, ph = t * (3 + wind * 5) + i * 1.3, amp = 3 + wind * 6;
    ctx.save(); ctx.translate(ox, oy);
    const pts = []; for (let k = 0; k <= 10; k++) { const u = k / 10; pts.push([wdir * u * L * (0.35 + Math.min(1, wind) * 0.8), u * L * (1 - Math.min(1, wind) * 0.8) + Math.sin(ph - u * 4) * amp * u + i * 3]); }
    for (const [w, col] of [[5.6, INK], [3.4, PAL.xc.rib]]) { ctx.strokeStyle = col; ctx.lineWidth = w * (1 - 0.0); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach(([x, y], k) => k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(244,237,224,0.7)'; ctx.lineWidth = 0.8; ctx.beginPath(); pts.forEach(([x, y], k) => k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
    ctx.restore();
  }
}
function drawProp(ctx, A, who, t) {
  switch (A.prop) {
    case 'mug': mug(ctx, t, A.steam ?? 1); break;
    case 'mug2': ctx.save(); ctx.translate(-4.5, 0); mug(ctx, t, A.steam ?? 1); ctx.translate(9.5, 1); mug(ctx, t + 1, A.steam ?? 1); ctx.restore(); break;
    case 'stollen': stollen(ctx, A.bite || 0); break;
    case 'chop': chopsticks(ctx, A.ang ?? -0.5, !!A.roll); break;
    case 'blaster': blaster(ctx, who); break;
    case 'point': ctx.save(); ctx.rotate(A.ang ?? -0.3); ctx.beginPath(); ctx.roundRect(-1.2, -9, 2.4, 7, 1.2); fs(ctx, PAL.skin, 0.9); ctx.restore(); break;
    case 'cup': ctx.save(); ctx.beginPath(); ctx.moveTo(-3.5, -7); ctx.lineTo(3.5, -7); ctx.lineTo(2.2, -1); ctx.lineTo(-2.2, -1); ctx.closePath(); fs(ctx, '#F6F1E7', 0.9); ctx.restore(); break;
  }
}
function zidianSparks(ctx, P, hand, t) {
  // sparks live in local units around the right hand; recomputed in the current (body) frame
  const k = P.zidian, f = Math.floor(t * 12);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  const s = hand.s; glow(ctx, hand.x, hand.y, 40 * s * k, '181,123,255', 0.9 * k);
  ctx.strokeStyle = `rgba(215,180,255,${0.95 * k})`; ctx.lineWidth = 1.2 * s; ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const a0 = hash(f * 7 + i, 3) * TAU, r0 = 4 * s, r1 = (10 + hash(f + i, 5) * 14) * s * k;
    ctx.beginPath(); ctx.moveTo(hand.x + Math.cos(a0) * r0, hand.y + Math.sin(a0) * r0);
    for (let j = 1; j <= 4; j++) { const rr = lerp(r0, r1, j / 4), aa = a0 + (hash(f * 13 + i * 5 + j, 9) - 0.5) * 0.9; ctx.lineTo(hand.x + Math.cos(aa) * rr, hand.y + Math.sin(aa) * rr); }
    ctx.stroke();
  }
  ctx.restore();
}
function zz(ctx, t, a, turn) {
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = C.cream; ctx.font = `600 10px Rubik, sans-serif`;
  for (let i = 0; i < 3; i++) { const u = ((t * 0.45 + i / 3) % 1); ctx.globalAlpha = a * Math.sin(u * Math.PI); ctx.font = `600 ${7 + u * 7}px Rubik, sans-serif`; ctx.fillText('z', 18 + u * 14 - turn * 6, -100 - u * 22); }
  ctx.restore();
}
export function heartShape(ctx) { ctx.beginPath(); ctx.moveTo(0, 6); ctx.bezierCurveTo(-10, -1, -7, -10, 0, -5); ctx.bezierCurveTo(7, -10, 10, -1, 0, 6); ctx.closePath(); }

// ---------------- umbrella (world space) ----------------
export function umbrella(ctx, hand, top, r, t, tilt = 0) {
  // pole from the hand to the canopy top
  ctx.save(); ctx.strokeStyle = '#4A3A2A'; ctx.lineWidth = r * 0.045; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.lineTo(top.x, top.y + r * 0.05); ctx.stroke();
  ctx.translate(top.x, top.y); ctx.rotate(tilt);
  const ribs = 8; ctx.lineWidth = r * 0.025; ctx.strokeStyle = INK;
  ctx.beginPath(); ctx.moveTo(-r, r * 0.42);
  for (let i = 0; i < ribs; i++) { const x0 = -r + (2 * r) * i / ribs, x1 = -r + (2 * r) * (i + 1) / ribs; ctx.quadraticCurveTo((x0 + x1) / 2, r * 0.3, x1, r * 0.42); }
  ctx.quadraticCurveTo(r * 0.9, -r * 0.1, 0, -r * 0.42); ctx.quadraticCurveTo(-r * 0.9, -r * 0.1, -r, r * 0.42); ctx.closePath();
  ctx.fillStyle = '#E0362E'; ctx.fill(); ctx.stroke();
  ctx.save(); ctx.clip(); ctx.fillStyle = '#2E2A2C'; ctx.fillRect(-r, r * 0.3, 2 * r, r * 0.2); ctx.fillStyle = 'rgba(120,20,20,0.25)'; ctx.fillRect(0, -r, r, 2 * r);
  ctx.strokeStyle = 'rgba(27,23,48,0.35)'; ctx.lineWidth = r * 0.012; for (let i = 1; i < ribs; i++) { const x = -r + 2 * r * i / ribs; ctx.beginPath(); ctx.moveTo(0, -r * 0.42); ctx.quadraticCurveTo(x * 0.7, -r * 0.05, x, r * 0.42); ctx.stroke(); }
  ctx.restore();
  // snow on the canopy
  ctx.fillStyle = C.cream; ctx.beginPath(); ctx.moveTo(-r * 0.55, -r * 0.18); ctx.quadraticCurveTo(0, -r * 0.5, r * 0.55, -r * 0.18); ctx.quadraticCurveTo(0, -r * 0.36, -r * 0.55, -r * 0.18); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -r * 0.44, r * 0.05, 0, TAU); ctx.fillStyle = '#4A3A2A'; ctx.fill();
  ctx.restore();
}
