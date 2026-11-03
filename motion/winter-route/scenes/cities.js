// City scenes. Each draw(ctx, lt, env): lt = seconds since the scene's iris began; env.cam(c) sets the world view
// (2400×1600 scene units, cover-fit to the frame), env.t = film time, env.screen() resets to screen space.
import {
  GY, HH, key, cue, walk, pair, holdUmbrella, ferris, water, lamp, candle, tree, puffs, sparkles,
  C, glow, lights, house, hut, sky, stars, snowGround, moon, sparkle, E, clamp, lerp, invLerp, seg, rng, hash, TAU, spring,
} from './kit.js';
import { SERIF, SANS, text } from '../lib/draw.js';

const nightSky = (ctx, top = C.night, bot = '#2C2552') => { sky(ctx, -400, -400, 2800, 1300, top, bot); };
// whip transition streaks (screen space), p 0..1 → 0 at the ends, peak in the middle
function whip(ctx, env, p, dir = -1) {
  const a = Math.sin(clamp(p, 0, 1) * Math.PI); if (a <= 0.02) return;
  env.screen(); const { W, H } = env, r = rng(Math.floor(env.t * 24));
  ctx.fillStyle = `rgba(246,241,231,${0.08 * a})`; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 26; i++) { const y = r() * H, w = (0.2 + r() * 0.6) * W * a, x = r() * W; ctx.fillStyle = `rgba(${i % 3 ? '230,184,92' : '246,241,231'},${0.25 * a})`; ctx.fillRect(x - w / 2, y, w, 2 + r() * 4); }
}

// ================= 1. Rostock: Ferris wheel and stalls by the water =================
export const rostock = {
  draw(ctx, lt, env) {
    const t = env.t;
    env.cam({ cx: key(lt, [[0, 1220], [7.9, 1180]]), cy: 820, z: key(lt, [[0, 1.0], [7.9, 1.07]], E.out) });
    nightSky(ctx); stars(ctx, -200, -300, 2800, 1100, t, 120, 11);
    moon(ctx, 560, 230, 52);
    // far shore
    for (let i = 0; i < 14; i++) house(ctx, -200 + i * 190, 1000, 150, 90 + hash(i, 4) * 120, { roof: i % 3 ? 'gable' : 'step', body: '#2A2350', roofC: '#231D45', lit: 0.5, seed: i + 40, t, win: 2 });
    water(ctx, -400, 2800, 1000, 1190, t, { glints: [[1500, '255,214,140', 260], [560, '246,241,231', 120], [900, '255,214,140', 90]] });
    ferris(ctx, 1520, 640, 320, t * 0.12, t, { base: 1180 });
    snowGround(ctx, -400, 2800, 1175, 500, { seed: 2 });
    // stalls
    hut(ctx, 560, 1240, 210, 190, t, { seed: 1 }); hut(ctx, 1700, 1250, 220, 200, t, { seed: 2, awning: '#B23A55' }); hut(ctx, 1950, 1235, 200, 180, t, { seed: 3 });
    lights(ctx, 500, 820, 1250, 860, 70, 18, t, { seed: 5 }); lights(ctx, 1250, 860, 2000, 800, 60, 18, t, { seed: 6 });
    // action
    const wj = walk(lt, 0.6, 2.4, 520, 1060), wx = walk(lt, 0.75, 2.6, 700, 1300);
    const point = seg(lt, 2.65, 3.0, E.back) * (1 - seg(lt, 4.6, 5.0));
    const give = seg(lt, 5.0, 5.45, E.out), taken = lt > 5.75;
    const sip = seg(lt, 6.3, 6.7) * (1 - seg(lt, 7.3, 7.7));
    const hx = pair(ctx, t,
      { who: 'jc', x: wj.x, walk: wj.walk, phase: wj.phase, turn: key(lt, [[0, 0.5], [2.6, 0.2], [3.2, 0.45], [4.9, -0.45], [6.0, 0.15]]),
        expr: { eyes: cue(lt, [[0, 'open'], [3.1, 'open'], [5.0, 'tsun'], [6.2, 'closed']]), mouth: cue(lt, [[0, 'flat'], [5.0, 'pout'], [6.2, 'smile']]) },
        blush: cue(lt, [[0, 0.3], [4.9, 0.95]]), look: lt > 4.9 && lt < 6 ? [-2.5, 0.6] : null,
        armR: { a: taken ? lerp(0.9, 1.35, sip) : lerp(0.9, 1.25, give), prop: taken ? 'mug' : 'mug2', steam: 1 }, armL: { a: 0.15 } },
      { who: 'xc', x: wx.x, walk: wx.walk, phase: wx.phase, turn: key(lt, [[0, 0.4], [2.7, 0.55], [4.8, -0.35], [6.2, 0.1]]),
        expr: { eyes: cue(lt, [[0, 'open'], [2.7, 'sparkle'], [4.7, 'open'], [5.8, 'happy']]), mouth: cue(lt, [[0, 'smile'], [2.7, 'grin'], [4.6, 'smile'], [5.8, 'grin'], [6.3, 'smile']]) },
        exclaim: seg(lt, 2.7, 2.9) * (1 - seg(lt, 3.9, 4.2)),
        armR: { a: lerp(0.15, 2.5, point), prop: point > 0.5 ? 'point' : null, ang: -0.2 },
        armL: { a: taken ? lerp(0.9, 1.35, sip) : lerp(0.15, 0.9, seg(lt, 5.3, 5.75)), prop: taken ? 'mug' : null } });
    if (lt > 5.75 && lt < 6.3) sparkles(ctx, t, (wj.x + wx.x) / 2, GY - 210, 40, 4, 1 - seg(lt, 6.0, 6.3), 3);
  },
};

// ================= 2. Berlin flash → Dresden: Frauenkirche, the candle pyramid, stollen =================
function pyramid(ctx, x, base, t, s = 1) {
  ctx.save(); ctx.translate(x, base); ctx.scale(s, s);
  const tiers = [[0, 230], [-230, 190], [-420, 150], [-580, 110]];
  for (let k = 0; k < tiers.length; k++) {
    const [y, r] = tiers[k], rot = t * 0.35 * (k % 2 ? -1 : 1);
    ctx.strokeStyle = '#3B2A22'; ctx.lineWidth = 8; for (const sx of [-0.8, 0, 0.8]) { ctx.beginPath(); ctx.moveTo(sx * r, y); ctx.lineTo(sx * r * 0.9, y - (k < 3 ? 230 - 40 * k : 160)); ctx.stroke(); }
    // figures riding the tier
    for (let i = 0; i < 6; i++) { const a = rot + i * TAU / 6, fx = Math.cos(a) * r * 0.78, front = Math.sin(a) > 0; if (!front) continue; ctx.fillStyle = i % 2 ? C.cream : C.gold; ctx.beginPath(); ctx.ellipse(fx, y - 40, 14, 26, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(fx, y - 74, 11, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#5A3B2E'; ctx.beginPath(); ctx.ellipse(0, y, r, r * 0.16, 0, 0, TAU); ctx.fill(); ctx.fillStyle = C.gold; ctx.fillRect(-r, y - 3, 2 * r, 6);
  }
  for (let i = 0; i < 9; i++) { const a = i * TAU / 9, cxp = Math.cos(a) * 205; if (Math.sin(a) < -0.2) continue; candle(ctx, cxp, 8 + Math.sin(a) * 18, 46, t, i, 13); }
  // propeller
  ctx.fillStyle = '#5A3B2E'; ctx.fillRect(-6, -760, 12, 190);
  for (let i = 0; i < 8; i++) { const a = t * 1.4 + i * TAU / 8, w = Math.abs(Math.cos(a)); ctx.save(); ctx.translate(0, -760); ctx.fillStyle = Math.cos(a) > 0 ? C.gold : '#A88A4E'; ctx.beginPath(); ctx.ellipse(Math.sin(a) * 120, 0, 120 * Math.abs(Math.sin(a)) + 4, 14 * w + 3, 0, 0, TAU); ctx.fill(); ctx.restore(); }
  glow(ctx, 0, -775, 50, '255,226,163', 0.8); sparkle(ctx, 0, -790, 26, 1);
  ctx.restore();
}
function frauenkirche(ctx, x, base, t) {
  ctx.fillStyle = '#5E5584';
  ctx.fillRect(x - 250, base - 360, 500, 360);
  ctx.beginPath(); ctx.moveTo(x - 210, base - 360); ctx.bezierCurveTo(x - 220, base - 640, x - 60, base - 700, x, base - 760); ctx.bezierCurveTo(x + 60, base - 700, x + 220, base - 640, x + 210, base - 360); ctx.closePath(); ctx.fill();
  ctx.fillRect(x - 34, base - 860, 68, 110); ctx.beginPath(); ctx.moveTo(x - 44, base - 860); ctx.lineTo(x, base - 930); ctx.lineTo(x + 44, base - 860); ctx.fill();
  for (const sx of [-1, 1]) { ctx.fillRect(x + sx * 290 - 40, base - 470, 80, 470); ctx.beginPath(); ctx.moveTo(x + sx * 290 - 46, base - 470); ctx.lineTo(x + sx * 290, base - 560); ctx.lineTo(x + sx * 290 + 46, base - 470); ctx.fill(); }
  glow(ctx, x, base - 450, 520, '230,184,92', 0.22);
  ctx.fillStyle = C.cream; ctx.beginPath(); ctx.moveTo(x - 120, base - 640); ctx.quadraticCurveTo(x, base - 760, x + 120, base - 640); ctx.quadraticCurveTo(x, base - 700, x - 120, base - 640); ctx.fill();
  const r = rng(8); for (let j = 0; j < 3; j++) for (let i = -3; i <= 3; i++) { if (r() < 0.25) continue; ctx.fillStyle = C.warm; ctx.fillRect(x + i * 64 - 12, base - 320 + j * 100, 24, 52); glow(ctx, x + i * 64, base - 294 + j * 100, 50, '255,210,127', 0.3); }
}
export const berlinDresden = {
  draw(ctx, lt, env) {
    const t = env.t, SPLIT = 2.15;
    if (lt < SPLIT) { // Berlin: a quick lateral sweep past the markets
      const pan = key(lt, [[0, 1500], [SPLIT, 650]], E.quartInOut);
      env.cam({ cx: pan, cy: 820, z: 1.05 });
      nightSky(ctx); stars(ctx, -400, -300, 3200, 1000, t, 90, 12);
      ctx.fillStyle = '#2A2350'; ctx.fillRect(1640, 330, 22, 820); ctx.beginPath(); ctx.arc(1651, 470, 62, 0, TAU); ctx.fill(); ctx.fillRect(1646, 120, 10, 230); glow(ctx, 1651, 120, 40, '230,120,140', 0.9);
      for (const gx of [420]) { ctx.fillStyle = '#2E2756'; ctx.fillRect(gx - 230, 820, 460, 60); for (let i = 0; i < 6; i++) ctx.fillRect(gx - 220 + i * 82, 880, 40, 300); ctx.fillRect(gx - 60, 760, 120, 60); }
      snowGround(ctx, -600, 3200, 1180, 500, { seed: 5 });
      for (let i = 0; i < 10; i++) hut(ctx, -300 + i * 300, 1235 + (i % 2) * 15, 220, 190 + (i % 3) * 14, t, { seed: i + 20, awning: i % 2 ? C.purple : '#B23A55' });
      for (let i = 0; i < 5; i++) lights(ctx, -300 + i * 600, 820, 300 + i * 600, 840, 60, 16, t, { seed: i + 30 });
      const wx = pan - 90, wy = pan + 110;
      pair(ctx, t, { who: 'jc', x: wx, walk: 1, phase: t * 1.9, turn: -0.5, expr: { eyes: 'open', mouth: 'flat' }, armR: { a: 0.2 } },
        { who: 'xc', x: wy, walk: 1, phase: t * 1.9 + 0.5, turn: -0.5, expr: { eyes: 'sparkle', mouth: 'grin' }, armL: { a: 0.2 } });
      whip(ctx, env, invLerp(SPLIT - 0.3, SPLIT + 0.25, lt));
      return;
    }
    const l = lt - SPLIT;
    env.cam({ cx: key(l, [[0, 1500], [0.45, 1200, E.out], [4.5, 1160]]), cy: 760, z: key(l, [[0, 1.02], [4.4, 1.1]]) });
    nightSky(ctx, C.night, '#30285A'); stars(ctx, -200, -300, 2800, 1000, t, 90, 13);
    for (let i = 0; i < 9; i++) house(ctx, -100 + i * 300, 1180, 230, 300 + hash(i, 6) * 160, { roof: i % 2 ? 'hip' : 'gable', body: '#2A2350', roofC: '#231D45', lit: 0.5, seed: i + 60, t, win: 3 });
    frauenkirche(ctx, 900, 1180, t);
    snowGround(ctx, -400, 2800, 1175, 500, { seed: 7 });
    pyramid(ctx, 1500, 1230, t, 0.85);
    lights(ctx, 300, 780, 1300, 820, 60, 16, t, { seed: 41 });
    // stollen: lift to mouth, bite, chew, pretend not to care (but sparkle)
    const lift = seg(l, 1.25, 1.75, E.out) * (1 - seg(l, 2.4, 2.8));
    const bitten = l > 1.8;
    const hx = pair(ctx, t,
      { who: 'jc', x: 1010, turn: cue(l, [[0, 0.2], [2.5, -0.35]]), expr: { eyes: cue(l, [[0, 'open'], [1.75, 'closed'], [2.5, 'tsun']]), mouth: cue(l, [[0, 'flat'], [1.8, 'chew'], [2.5, 'flat']]), cheek: l > 1.8 && l < 2.8 },
        blush: cue(l, [[0, 0.3], [2.4, 1]]), armR: { a: lerp(1.0, 1.95, lift), prop: 'stollen', bite: bitten ? 1 : 0 }, armL: { a: 0.2 } },
      { who: 'xc', x: 1250, turn: -0.35, expr: { eyes: cue(l, [[0, 'open'], [2.6, 'happy']]), mouth: cue(l, [[0, 'smile'], [1.85, 'o'], [2.6, 'grin']]) }, armL: { a: 0.25 }, armR: { a: 0.2 } });
    puffs(ctx, l, 1.8, 1045, GY - 280, 12, 9);
    if (l > 2.5) sparkles(ctx, t, 1000, GY - 300, 80, 4, seg(l, 2.5, 2.8) * (1 - seg(l, 4.0, 4.4)), 6);
    whip(ctx, env, invLerp(-0.25, 0.3, l));
  },
};

// ================= 3. Prague: the ghost in the lane → Old Town Square dinner =================
function pragueHouse(ctx, x, base, w, h, col, t, seed) {
  house(ctx, x, base, w, h, { roof: 'flat', body: col, lit: 0.55, seed, t, win: 2, roofH: 0 });
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, base - h); ctx.bezierCurveTo(x + w * 0.1, base - h - 60, x + w * 0.3, base - h - 40, x + w * 0.35, base - h - 90); ctx.lineTo(x + w * 0.65, base - h - 90); ctx.bezierCurveTo(x + w * 0.7, base - h - 40, x + w * 0.9, base - h - 60, x + w, base - h); ctx.fill();
  ctx.fillStyle = C.cream; ctx.fillRect(x + w * 0.33, base - h - 96, w * 0.34, 10);
}
function ghost(ctx, x, y, s, t, a) {
  if (a <= 0) return; ctx.save(); ctx.globalAlpha = a * 0.78; ctx.translate(x, y); ctx.scale(s, s);
  glow(ctx, 0, 0, 120, '200,215,255', 0.5 * a);
  ctx.fillStyle = '#F2F4FF'; ctx.beginPath(); ctx.moveTo(-55, 10); ctx.bezierCurveTo(-58, -90, 58, -90, 55, 10);
  for (let i = 0; i <= 5; i++) { const xx = 55 - i * 22, yy = 70 + Math.sin(t * 5 + i) * 8 + (i % 2 ? -14 : 0); ctx.lineTo(xx, yy); }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2A2140'; ctx.beginPath(); ctx.ellipse(-18, -18, 7, 11, 0, 0, TAU); ctx.ellipse(18, -18, 7, 11, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 8, 8, 10, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(238,128,150,0.45)'; ctx.beginPath(); ctx.ellipse(-30, 2, 8, 4, 0, 0, TAU); ctx.ellipse(30, 2, 8, 4, 0, 0, TAU); ctx.fill();
  ctx.restore();
}
function tyn(ctx, x, base, t) {
  ctx.fillStyle = '#2A2350';
  ctx.fillRect(x - 330, base - 380, 660, 380);
  for (const sx of [-1, 1]) {
    const tx = x + sx * 150; ctx.fillRect(tx - 70, base - 760, 140, 760);
    ctx.beginPath(); ctx.moveTo(tx - 80, base - 760); ctx.lineTo(tx, base - 1080); ctx.lineTo(tx + 80, base - 760); ctx.fill();
    for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(tx + k * 80 - 18, base - 760); ctx.lineTo(tx + k * 80, base - 860); ctx.lineTo(tx + k * 80 + 18, base - 760); ctx.fill(); ctx.beginPath(); ctx.moveTo(tx + k * 40 - 14, base - 840); ctx.lineTo(tx + k * 40, base - 920); ctx.lineTo(tx + k * 40 + 14, base - 840); ctx.fill(); }
    glow(ctx, tx, base - 1080, 30, '255,226,163', 0.9);
    for (let j = 0; j < 4; j++) { ctx.fillStyle = C.warm; ctx.fillRect(tx - 14, base - 700 + j * 110, 28, 60); ctx.fillStyle = '#2A2350'; }
  }
  ctx.beginPath(); ctx.moveTo(x - 330, base - 380); ctx.lineTo(x, base - 560); ctx.lineTo(x + 330, base - 380); ctx.fill();
  glow(ctx, x, base - 500, 600, '230,184,92', 0.16);
}
export const prague = {
  draw(ctx, lt, env) {
    const t = env.t, SPLIT = 5.0;
    if (lt < SPLIT) {
      env.cam({ cx: key(lt, [[0, 1230], [5, 1180]]), cy: 800, z: key(lt, [[0, 1.05], [2.4, 1.05], [3.0, 1.12, E.out], [5, 1.1]]) });
      nightSky(ctx, C.night, '#2A2350'); stars(ctx, 700, -300, 1000, 900, t, 40, 14);
      const cols = ['#3A2F66', '#4A3A6E', '#5A3F6A', '#433870'];
      // far houses down the lane
      for (let i = 0; i < 4; i++) pragueHouse(ctx, 1020 + i * 90, 1180, 110, 420 - i * 40, '#2E2756', t, 70 + i);
      // left & right facades framing the lane
      pragueHouse(ctx, 420, 1210, 560, 900, cols[0], t, 81); pragueHouse(ctx, 1440, 1210, 600, 860, cols[2], t, 82);
      ctx.fillStyle = 'rgba(15,13,30,0.35)'; ctx.fillRect(950, 300, 30, 910);
      // cobbles + snow
      ctx.fillStyle = '#3A3160'; ctx.fillRect(-400, 1190, 3200, 500);
      ctx.strokeStyle = 'rgba(246,241,231,0.18)'; ctx.lineWidth = 3; for (let j = 0; j < 8; j++) for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.ellipse(-300 + i * 80 + (j % 2) * 40, 1220 + j * 34, 34, 13, 0, 0, TAU); ctx.stroke(); }
      snowGround(ctx, -400, 2800, 1370, 300, { seed: 9, wave: 6 });
      lamp(ctx, 900, 1215, 330, t, 1); lamp(ctx, 1480, 1215, 330, t, 2);
      lights(ctx, 980, 560, 1440, 600, 70, 12, t, { seed: 51 });
      // the ghost peeks from behind the left corner
      const peek = seg(lt, 2.35, 2.85, E.out) * (1 - seg(lt, 3.9, 4.5, E.in));
      ctx.save(); ctx.beginPath(); ctx.rect(980, 0, 2000, 2000); ctx.clip();
      ghost(ctx, lerp(900, 1060, peek), 980 + Math.sin(t * 3) * 10, 1.0, t, peek); ctx.restore();
      // heroes
      const w1 = walk(lt, 0.3, 2.2, 1420, 1260), w2 = walk(lt, 0.3, 2.2, 1600, 1440);
      const jump = lt > 2.9 && lt < 3.5 ? -Math.sin(invLerp(2.9, 3.5, lt) * Math.PI) * 9 : 0;
      const zid = seg(lt, 2.95, 3.2) * (1 - seg(lt, 4.2, 4.6));
      const cover = seg(lt, 3.3, 3.75, E.out);
      const hx = pair(ctx, t,
        { who: 'jc', x: w1.x, walk: w1.walk, phase: w1.phase, bob: jump, turn: cue(lt, [[0, -0.4], [2.9, -0.6], [4.2, 0.35]]), depth: 1,
          expr: { eyes: cue(lt, [[0, 'open'], [2.9, 'wide'], [4.0, 'tsun']]), mouth: cue(lt, [[0, 'flat'], [2.9, 'wavy'], [4.0, 'pout']]), brows: lt > 2.9 && lt < 4 ? 'default' : 'default' },
          sweat: seg(lt, 2.95, 3.1) * (1 - seg(lt, 4.0, 4.3)), blush: cue(lt, [[0, 0.3], [4.0, 0.9]]), zidian: zid,
          armR: { a: lerp(0.15, 1.15, zid) }, armL: { a: lerp(0.15, 0.9, zid) } },
        { who: 'xc', x: w2.x, walk: w2.walk, phase: w2.phase, turn: cue(lt, [[0, -0.4], [3.2, -0.5]]),
          expr: { eyes: cue(lt, [[0, 'open'], [2.6, 'open'], [3.25, 'happy']]), mouth: cue(lt, [[0, 'smile'], [3.25, 'laugh'], [4.2, 'smile']]) },
          armR: { a: lerp(2.55, 2.85, cover) }, armL: { a: 0.15 } });
      holdUmbrella(ctx, t, hx, lerp(w2.x - 20, (w1.x + w2.x) / 2 - 30, cover), GY - 470, 250, lerp(0.05, -0.12, cover));
      whip(ctx, env, invLerp(SPLIT - 0.3, SPLIT + 0.25, lt));
      return;
    }
    const l = lt - SPLIT;
    env.cam({ cx: key(l, [[0, 1500], [0.45, 1200, E.out], [4.5, 1200]]), cy: key(l, [[0, 760], [4.5, 800]]), z: key(l, [[0, 1.0], [4.5, 1.1]]) });
    nightSky(ctx); stars(ctx, -200, -300, 2800, 900, t, 100, 15);
    for (let i = 0; i < 10; i++) house(ctx, -300 + i * 300, 1150, 260, 360 + hash(i, 9) * 150, { roof: 'step', body: '#2E2756', roofC: '#26204A', lit: 0.55, seed: i + 90, t, win: 3 });
    tyn(ctx, 1000, 1150, t);
    snowGround(ctx, -400, 2800, 1150, 500, { seed: 11 });
    tree(ctx, 1650, 1200, 760, t, 7);
    hut(ctx, 300, 1215, 200, 180, t, { seed: 91 });
    // the dinner table (foreground), heroes sit behind it
    const toast = seg(l, 2.4, 2.8, E.back) * (1 - seg(l, 3.6, 4.0));
    const hx = pair(ctx, t,
      { who: 'xc', x: 1040, turn: 0.35, expr: { eyes: cue(l, [[0, 'open'], [2.8, 'happy']]), mouth: 'smile' }, armR: { a: lerp(0.9, 2.0, toast), prop: 'cup' }, armL: { a: 0.3 } },
      { who: 'jc', x: 1360, turn: -0.35, expr: { eyes: cue(l, [[0, 'open'], [2.9, 'closed']]), mouth: cue(l, [[0, 'chew'], [2.0, 'smile']]) }, blush: 0.6, armL: { a: lerp(0.9, 2.0, toast), prop: 'cup' }, armR: { a: 0.3 } });
    ctx.fillStyle = '#3B2A44'; ctx.fillRect(900, 1300, 600, 240);
    ctx.fillStyle = C.cream; ctx.beginPath(); ctx.moveTo(880, 1268); ctx.lineTo(1520, 1268); ctx.lineTo(1532, 1340); ctx.quadraticCurveTo(1200, 1356, 868, 1340); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.gold; ctx.fillRect(868, 1334, 664, 8);
    for (const px of [1030, 1370]) { ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.ellipse(px, 1282, 62, 15, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#B9774A'; ctx.beginPath(); ctx.ellipse(px, 1277, 34, 10, 0, 0, TAU); ctx.fill(); }
    candle(ctx, 1160, 1282, 80, t, 1, 16); candle(ctx, 1240, 1282, 104, t, 2, 16);
    glow(ctx, 1200, 1120, 520, '255,190,110', 0.28);
    if (l > 2.75 && l < 3.3) sparkles(ctx, t, 1200, GY - 330, 30, 4, 1 - seg(l, 3.0, 3.3), 9);
    whip(ctx, env, invLerp(-0.25, 0.3, l));
  },
};

// ================= 4. Vienna (Prater wheel, ghost-train gate, Schönbrunn) → Bratislava (castle, bridge, wind) =================
function ghostTrain(ctx, x, base, t) {
  ctx.fillStyle = '#2A1F48'; ctx.fillRect(x - 260, base - 440, 520, 440);
  ctx.beginPath(); ctx.moveTo(x - 280, base - 440); ctx.lineTo(x - 200, base - 560); ctx.lineTo(x - 120, base - 470); ctx.lineTo(x, base - 600); ctx.lineTo(x + 120, base - 470); ctx.lineTo(x + 200, base - 560); ctx.lineTo(x + 280, base - 440); ctx.fill();
  ctx.fillStyle = '#0D0B18'; ctx.beginPath(); ctx.moveTo(x - 110, base); ctx.lineTo(x - 110, base - 200); ctx.quadraticCurveTo(x, base - 320, x + 110, base - 200); ctx.lineTo(x + 110, base); ctx.fill();
  const blink = 0.6 + 0.4 * Math.sin(t * 4);
  for (const sx of [-1, 1]) { glow(ctx, x + sx * 150, base - 330, 60, '180,255,200', 0.5 * blink); ctx.fillStyle = `rgba(200,255,210,${blink})`; ctx.beginPath(); ctx.ellipse(x + sx * 150, base - 330, 34, 22, sx * 0.2, 0, TAU); ctx.fill(); ctx.fillStyle = '#0D0B18'; ctx.beginPath(); ctx.ellipse(x + sx * 150, base - 330, 10, 18, 0, 0, TAU); ctx.fill(); }
  for (let i = 0; i < 9; i++) { const xx = x - 240 + i * 60; ctx.fillStyle = '#E8E1F2'; ctx.beginPath(); ctx.moveTo(xx, base - 440); ctx.lineTo(xx + 30, base - 440); ctx.lineTo(xx + 15, base - 410 + Math.sin(t * 3 + i) * 4); ctx.fill(); }
  lights(ctx, x - 280, base - 440, x + 280, base - 440, 30, 12, t, { seed: 61, rgb: '200,170,255' });
  for (let i = 0; i < 3; i++) { const bx = x - 150 + i * 150 + Math.sin(t * 2 + i) * 30, by = base - 680 + Math.sin(t * 5 + i * 2) * 20, f = Math.sin(t * 14 + i) * 0.6; ctx.fillStyle = '#120F22'; ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx - 22, by - 16 * f - 6, bx - 40, by + 4); ctx.quadraticCurveTo(bx - 20, by + 2, bx, by + 8); ctx.quadraticCurveTo(bx + 20, by + 2, bx + 40, by + 4); ctx.quadraticCurveTo(bx + 22, by - 16 * f - 6, bx, by); ctx.fill(); }
}
function schonbrunn(ctx, x, base, t) {
  const w = 1500, h = 360; ctx.fillStyle = '#C99A4A'; ctx.fillRect(x - w / 2, base - h, w, h);
  ctx.fillRect(x - 220, base - h - 90, 440, 90); ctx.fillStyle = '#5E3A2E'; ctx.fillRect(x - w / 2 - 10, base - h - 18, w + 20, 18); ctx.fillRect(x - 230, base - h - 104, 460, 16);
  ctx.fillStyle = C.cream; ctx.fillRect(x - w / 2 - 10, base - h - 26, w + 20, 10); ctx.fillRect(x - 230, base - h - 112, 460, 9);
  const r = rng(12); for (let j = 0; j < 3; j++) for (let i = 0; i < 24; i++) { const wx = x - w / 2 + 30 + i * 61, wy = base - h + 40 + j * 105; const on = r() < 0.6; ctx.fillStyle = on ? C.warm : '#7D5A2E'; ctx.fillRect(wx, wy, 26, 56); if (on) glow(ctx, wx + 13, wy + 28, 40, '255,210,127', 0.25); }
  for (let i = 0; i < 6; i++) { ctx.fillStyle = '#E6CFA0'; ctx.fillRect(x - 170 + i * 66, base - h - 80, 14, h + 80); }
}
function bratislavaCastle(ctx, x, base, t) {
  ctx.fillStyle = '#2B2550'; ctx.beginPath(); ctx.moveTo(x - 700, base + 40); ctx.quadraticCurveTo(x - 250, base - 230, x, base - 240); ctx.quadraticCurveTo(x + 260, base - 230, x + 700, base + 40); ctx.closePath(); ctx.fill();
  const b = base - 230; ctx.fillStyle = '#E9E2D2'; ctx.fillRect(x - 230, b - 260, 460, 260);
  for (const sx of [-1, 1]) { ctx.fillRect(x + sx * 230 - 50, b - 330, 100, 330); ctx.fillStyle = '#8E3B3B'; ctx.beginPath(); ctx.moveTo(x + sx * 230 - 58, b - 330); ctx.lineTo(x + sx * 230, b - 410); ctx.lineTo(x + sx * 230 + 58, b - 330); ctx.fill(); ctx.fillStyle = '#E9E2D2'; }
  ctx.fillStyle = '#8E3B3B'; ctx.fillRect(x - 240, b - 280, 480, 26);
  for (let j = 0; j < 2; j++) for (let i = 0; i < 7; i++) { ctx.fillStyle = C.warm; ctx.fillRect(x - 200 + i * 62, b - 220 + j * 90, 22, 40); }
  glow(ctx, x, b - 150, 420, '230,184,92', 0.2);
}
export const viennaBratislava = {
  draw(ctx, lt, env) {
    const t = env.t, S1 = 2.95, S2 = 5.05;
    if (lt < S1) { // Prater
      env.cam({ cx: key(lt, [[0, 1240], [S1, 1180]]), cy: 790, z: key(lt, [[0, 1.0], [S1, 1.06]]) });
      nightSky(ctx); stars(ctx, -200, -300, 2800, 900, t, 100, 16);
      ferris(ctx, 1560, 560, 380, -t * 0.08, t, { n: 15, boxy: true, cab: ['#B23A48', '#B23A48', '#C9485A'], rim: '#3B2F6E', base: 1180 });
      ghostTrain(ctx, 760, 1210, t);
      snowGround(ctx, -400, 2800, 1190, 500, { seed: 13 });
      lights(ctx, 300, 760, 1400, 800, 70, 18, t, { seed: 62 });
      const hx = pair(ctx, t,
        { who: 'jc', x: 1120, turn: cue(lt, [[0, -0.35], [1.6, 0.45]]), expr: { eyes: cue(lt, [[0, 'tsun'], [1.6, 'open']]), mouth: cue(lt, [[0, 'flat'], [1.6, 'pout']]) }, blush: 0.4, sweat: seg(lt, 1.7, 1.9) * (1 - seg(lt, 2.6, 2.9)), armR: { a: 0.6 }, armL: { a: 0.6 } },
        { who: 'xc', x: 1330, turn: -0.4, expr: { eyes: 'sparkle', mouth: 'grin' }, armL: { a: key(lt, [[0.4, 0.15], [0.8, 2.3, E.back], [2.4, 2.3], [2.7, 0.2]]), prop: lt > 0.6 && lt < 2.5 ? 'point' : null }, armR: { a: 0.2 } });
      whip(ctx, env, invLerp(S1 - 0.3, S1 + 0.25, lt));
      return;
    }
    if (lt < S2) { // Schönbrunn
      const l = lt - S1;
      env.cam({ cx: key(l, [[0, 1500], [0.45, 1200, E.out], [2.1, 1180]]), cy: 780, z: 1.0 });
      nightSky(ctx, C.night, '#2E2756'); stars(ctx, -200, -300, 2800, 800, t, 90, 17);
      schonbrunn(ctx, 1200, 1150, t);
      snowGround(ctx, -400, 2800, 1150, 500, { seed: 15, wave: 6 });
      for (const lx of [420, 900, 1500, 1980]) lamp(ctx, lx, 1180, 260, t, lx);
      const w1 = walk(l, 0.1, 2.1, 960, 1120), w2 = walk(l, 0.1, 2.1, 1170, 1330);
      const hx = pair(ctx, t, { who: 'jc', x: w1.x, walk: w1.walk, phase: w1.phase, turn: 0.5, expr: { eyes: 'open', mouth: 'smile' }, blush: 0.4 },
        { who: 'xc', x: w2.x, walk: w2.walk, phase: w2.phase, turn: 0.4, expr: { eyes: 'happy', mouth: 'smile' }, armR: { a: 2.6 } });
      holdUmbrella(ctx, t, hx, (w1.x + w2.x) / 2 - 10, GY - 470, 250, -0.06);
      whip(ctx, env, invLerp(-0.25, 0.3, l)); whip(ctx, env, invLerp(S2 - S1 - 0.3, S2 - S1 + 0.25, l));
      return;
    }
    // Bratislava: castle over the Danube, heroes on the bridge, wind in the ribbon
    const l = lt - S2;
    env.cam({ cx: key(l, [[0, 1500], [0.45, 1220, E.out], [4.4, 1180]]), cy: 790, z: key(l, [[0, 1.0], [4.4, 1.08]]) });
    nightSky(ctx, '#15122A', '#2C2552'); stars(ctx, -200, -300, 2800, 900, t, 120, 18); moon(ctx, 1750, 260, 60);
    bratislavaCastle(ctx, 820, 1000, t);
    water(ctx, -400, 2800, 1000, 1190, t, { glints: [[820, '255,214,140', 200], [1750, '246,241,231', 140]] });
    // bridge deck & railing
    ctx.fillStyle = '#2A2350'; ctx.fillRect(-400, 1190, 3200, 70); ctx.fillStyle = '#3A3266'; ctx.fillRect(-400, 1258, 3200, 400);
    snowGround(ctx, -400, 2800, 1265, 400, { seed: 19, wave: 4 });
    const gust = 0.75 + 0.25 * Math.sin(t * 1.3);
    const hx = pair(ctx, t,
      { who: 'jc', x: 1110, turn: 0.25, wind: gust, windDir: -1, expr: { eyes: cue(l, [[0, 'open'], [2.6, 'tsun']]), mouth: cue(l, [[0, 'flat'], [2.6, 'pout']]) }, blush: cue(l, [[0, 0.4], [2.6, 0.95]]), armL: { a: 0.9 }, armR: { a: 0.7 } },
      { who: 'xc', x: 1320, turn: 0.3, wind: 1.4 * gust, windDir: 1, look: [-1, -1], expr: { eyes: cue(l, [[0, 'open'], [1.4, 'happy']]), mouth: cue(l, [[0, 'smile'], [2.4, 'grin'], [3.2, 'smile']]) }, heart: seg(l, 2.4, 2.8) * (1 - seg(l, 3.6, 4.0)), armL: { a: 0.3 }, armR: { a: 0.2 } });
    // railing in front
    ctx.fillStyle = '#1E1938'; ctx.fillRect(-400, 1330, 3200, 16); ctx.fillRect(-400, 1420, 3200, 12); for (let x = -380; x < 2800; x += 90) ctx.fillRect(x, 1330, 12, 160);
    lights(ctx, -300, 1322, 2700, 1322, 0, 40, t, { seed: 71, r: 4, glowR: 18 });
    whip(ctx, env, invLerp(-0.25, 0.3, l));
  },
};

// ================= 6. Cologne: cathedral, bridge, countdown, fireworks → rolls =================
function cathedral(ctx, x, base, t, lit = 1) {
  ctx.fillStyle = '#3A3164';
  ctx.fillRect(x - 330, base - 520, 660, 520);
  for (const sx of [-1, 1]) {
    const tx = x + sx * 210; ctx.fillRect(tx - 110, base - 1050, 220, 1050);
    ctx.beginPath(); ctx.moveTo(tx - 110, base - 1050); ctx.lineTo(tx, base - 1500); ctx.lineTo(tx + 110, base - 1050); ctx.fill();
    for (let k = 0; k < 7; k++) { const yy = base - 1080 - k * 60, ww = 110 - k * 15; ctx.beginPath(); ctx.moveTo(tx - ww - 8, yy); ctx.lineTo(tx - ww, yy - 30); ctx.lineTo(tx - ww + 8, yy); ctx.moveTo(tx + ww - 8, yy); ctx.lineTo(tx + ww, yy - 30); ctx.lineTo(tx + ww + 8, yy); ctx.fill(); }
    for (let k = 0; k < 6; k++) { ctx.fillStyle = 'rgba(15,13,30,0.5)'; ctx.fillRect(tx - 60, base - 980 + k * 150, 26, 110); ctx.fillRect(tx + 34, base - 980 + k * 150, 26, 110); ctx.fillStyle = '#3A3164'; }
  }
  ctx.beginPath(); ctx.moveTo(x - 100, base - 520); ctx.lineTo(x, base - 700); ctx.lineTo(x + 100, base - 520); ctx.fill();
  ctx.fillStyle = C.warm; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(x, base - 380, 70, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  const g = ctx.createLinearGradient(0, base, 0, base - 1400); g.addColorStop(0, `rgba(230,184,92,${0.55 * lit})`); g.addColorStop(1, 'rgba(230,184,92,0)');
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(x - 340, base - 1500, 680, 1500); ctx.restore();
}
function bridge(ctx, x0, x1, deckY, t) {
  ctx.strokeStyle = '#2E2756'; ctx.lineWidth = 10; const n = 3, w = (x1 - x0) / n;
  for (let i = 0; i < n; i++) { const ax = x0 + i * w; ctx.beginPath(); ctx.moveTo(ax, deckY); ctx.quadraticCurveTo(ax + w / 2, deckY - 260, ax + w, deckY); ctx.stroke(); ctx.lineWidth = 3; for (let k = 1; k < 8; k++) { const u = k / 8, yy = deckY - 260 * 4 * u * (1 - u) * 0.5; ctx.beginPath(); ctx.moveTo(ax + u * w, deckY); ctx.lineTo(ax + u * w, yy); ctx.stroke(); } ctx.lineWidth = 10; }
  ctx.fillStyle = '#2E2756'; ctx.fillRect(x0, deckY, x1 - x0, 22); for (let i = 0; i <= n; i++) ctx.fillRect(x0 + i * w - 20, deckY, 40, 1000 - deckY + 200);
  lights(ctx, x0, deckY + 4, x1, deckY + 4, 0, 34, t, { seed: 81, r: 3.5, glowR: 16, wire: 'rgba(0,0,0,0)' });
}
const BURSTS = [ // film-local seconds since 'boom' (lt 6.05), x, y, colour, size
  [0.0, 1250, 380, '255,214,140', 1.2], [0.35, 820, 300, '200,170,255', 1.0], [0.6, 1650, 330, '246,241,231', 1.05], [1.0, 1080, 230, '230,184,92', 1.1],
  [1.35, 1450, 420, '180,210,255', 0.9], [1.7, 950, 420, '255,150,180', 0.9], [2.0, 1300, 260, '255,214,140', 1.25],
];
function fireworks(ctx, k, t, mirrorY = null) {
  for (const [bt, x, y, rgb, sz] of BURSTS) {
    const u = k - bt;
    if (u < -0.55 || u > 2.2) continue;
    if (u < 0) { const p = 1 + u / 0.55, yy = lerp(1050, y, E.out(p)); glow(ctx, x, yy, 22, rgb, 0.9); continue; } // rising shell
    const r = rng(Math.round(bt * 100 + x)), n = 64, R = 300 * sz * E.out(Math.min(1, u / 1.1)), fade = 1 - clamp((u - 0.4) / 1.8, 0, 1);
    if (u < 0.12) glow(ctx, x, y, 420 * sz, rgb, 0.7 * (1 - u / 0.12));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + r() * 0.1, rr = R * (0.75 + r() * 0.3), px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr + 90 * u * u;
      glow(ctx, px, py, 16 * sz * fade, rgb, fade);
      for (let k = 1; k <= 3; k++) { const uu = Math.max(0, u - k * 0.06), RR = 300 * sz * E.out(Math.min(1, uu / 1.1)) * (0.75 + 0.3 * ((i * 7919) % 100) / 100); glow(ctx, x + Math.cos(a) * RR, y + Math.sin(a) * RR + 90 * uu * uu, (10 - k * 2) * sz * fade, rgb, fade * (0.5 - k * 0.12)); }
      if (mirrorY) glow(ctx, px, 2 * mirrorY - py + 40, 12 * sz * fade, rgb, fade * 0.25);
    }
  }
}
function countdownNum(ctx, env, s, p) {
  if (p <= 0 || p >= 1) return; env.screen(); const { W, H, portrait } = env;
  const a = Math.sin(p * Math.PI) ** 0.5, sc = lerp(1.35, 0.92, E.out(p));
  ctx.save(); ctx.translate(W / 2, H * (portrait ? 0.34 : 0.38)); ctx.scale(sc, sc);
  text(ctx, s, 0, 0, { size: portrait ? 300 : 260, weight: 700, color: C.goldHi, alpha: a }); ctx.restore();
}
export const cologne = {
  draw(ctx, lt, env) {
    const t = env.t, S = 8.25, BOOM = 6.05;
    if (lt < S) {
      const look = seg(lt, 2.7, 3.2);
      env.cam({ cx: 1200, cy: key(lt, [[0, 820], [2.8, 820], [3.6, 700], [6.0, 640], [S, 660]]), z: key(lt, [[0, 1.12], [2.8, 1.12], [5.8, 1.0], [S, 1.02]]) });
      nightSky(ctx, '#120F24', '#2A2350'); stars(ctx, -200, -400, 2800, 1100, t, 140, 19);
      const k = lt - BOOM; fireworks(ctx, k, t, 1090);
      bridge(ctx, 1200, 2900, 960, t);
      cathedral(ctx, 760, 1080, t);
      water(ctx, -400, 2800, 1080, 1210, t, { glints: [[760, '255,214,140', 240], [1700, '255,214,140', 160]] });
      if (k > -0.2) fireworks(ctx, k, t); // second pass for brightness on top of water
      snowGround(ctx, -400, 2800, 1205, 500, { seed: 21, wave: 5 });
      const flash = k > 0 ? Math.max(0, 1 - ((k % 0.35) / 0.35)) * (k < 2.2 ? 1 : 0) : 0;
      const hx = pair(ctx, t,
        { who: 'jc', x: 1110, turn: key(lt, [[0, 0.3], [2.7, 0.1]]), look: look > 0.5 ? [0.5, -2.8] : null, headTilt: -0.06 * look,
          expr: { eyes: cue(lt, [[0, 'open'], [BOOM, 'sparkle'], [BOOM + 1.6, 'open']]), mouth: cue(lt, [[0, 'flat'], [BOOM, 'o'], [BOOM + 1.6, 'smile']]) }, blush: 0.5, armR: { a: 0.2 }, armL: { a: 0.2 } },
        { who: 'xc', x: 1300, turn: key(lt, [[0, -0.3], [2.7, -0.1]]), look: look > 0.5 ? [-0.5, -2.8] : null, headTilt: 0.06 * look,
          expr: { eyes: cue(lt, [[0, 'open'], [BOOM, 'sparkle']]), mouth: cue(lt, [[0, 'smile'], [BOOM, 'grin']]) }, armL: { a: lerp(0.15, 0.5, seg(lt, BOOM + 0.6, BOOM + 1.0)) }, armR: { a: 0.2 } });
      if (flash > 0) { env.screen(); ctx.fillStyle = `rgba(255,226,163,${0.12 * flash})`; ctx.fillRect(0, 0, env.W, env.H); }
      countdownNum(ctx, env, '3', invLerp(3.05, 4.0, lt)); countdownNum(ctx, env, '2', invLerp(4.05, 5.0, lt)); countdownNum(ctx, env, '1', invLerp(5.05, 6.0, lt));
      whip(ctx, env, invLerp(S - 0.3, S + 0.25, lt));
      return;
    }
    // cosy: rolls, chopsticks, the last one stolen
    const l = lt - S;
    env.cam({ cx: key(l, [[0, 1500], [0.45, 1200, E.out], [3.3, 1200]]), cy: 840, z: key(l, [[0, 1.12], [3.3, 1.2]]) });
    sky(ctx, -400, -400, 2800, 2000, '#3A2742', '#2A1D33');
    ctx.fillStyle = '#17142B'; ctx.beginPath(); ctx.roundRect(820, 300, 760, 560, 30); ctx.fill(); stars(ctx, 820, 300, 760, 560, t, 40, 22);
    fireworks(ctx, l + 0.6, t); fireworks(ctx, l - 1.2, t);
    ctx.strokeStyle = '#5A3B2E'; ctx.lineWidth = 24; ctx.strokeRect(820, 300, 760, 560); ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(1200, 300); ctx.lineTo(1200, 860); ctx.moveTo(820, 580); ctx.lineTo(1580, 580); ctx.stroke();
    for (const lx of [560, 1840]) { ctx.strokeStyle = '#3B2A22'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, 380); ctx.stroke(); glow(ctx, lx, 450, 220, '255,190,110', 0.45); ctx.fillStyle = '#E2563C'; ctx.beginPath(); ctx.ellipse(lx, 450, 70, 85, 0, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,214,140,0.55)'; ctx.beginPath(); ctx.ellipse(lx, 450, 40, 70, 0, 0, TAU); ctx.fill(); }
    // rolls left on the board: 6 → … → 1 → 0 (stolen)
    const left = cue(l, [[0, 4], [0.7, 3], [1.4, 2], [1.75, 1], [2.25, 0]]);
    const grab = seg(l, 1.95, 2.15, E.out), late = seg(l, 2.1, 2.45, E.out) * (1 - seg(l, 2.9, 3.2));
    const hx = pair(ctx, t,
      { who: 'xc', x: 1060, turn: 0.35, expr: { eyes: cue(l, [[0, 'happy'], [2.45, 'open'], [2.75, 'happy']]), mouth: cue(l, [[0, 'chew'], [1.2, 'smile'], [2.45, 'o'], [2.75, 'smile']]) }, armR: { a: lerp(0.9, 1.5, late), prop: 'chop', ang: -1.2 }, armL: { a: 0.3 } },
      { who: 'jc', x: 1340, turn: -0.35, expr: { eyes: cue(l, [[0, 'open'], [2.15, 'closed'], [2.6, 'tsun']]), mouth: cue(l, [[0, 'flat'], [2.15, 'chew'], [2.9, 'smirk']]), cheek: l > 2.15 && l < 2.9 }, blush: cue(l, [[0, 0.4], [2.5, 0.9]]), armL: { a: lerp(0.9, 1.6, grab) * (1 - seg(l, 2.15, 2.4)) + 0.9 * seg(l, 2.15, 2.4), prop: 'chop', ang: 1.0, roll: l > 2.05 && l < 2.25 } });
    ctx.fillStyle = '#5A3B2E'; ctx.fillRect(820, 1225, 760, 280); ctx.fillStyle = '#7A5238'; ctx.fillRect(800, 1205, 800, 34);
    ctx.fillStyle = '#C69A6A'; ctx.beginPath(); ctx.roundRect(1030, 1180, 340, 46, 8); ctx.fill();
    for (let i = 0; i < left; i++) { const rx = 1080 + i * 80; ctx.fillStyle = '#1F2A2A'; ctx.beginPath(); ctx.arc(rx, 1182, 30, 0, TAU); ctx.fill(); ctx.fillStyle = '#FFF8EE'; ctx.beginPath(); ctx.arc(rx, 1182, 22, 0, TAU); ctx.fill(); ctx.fillStyle = '#F07A5A'; ctx.beginPath(); ctx.arc(rx, 1182, 10, 0, TAU); ctx.fill(); }
    glow(ctx, 1200, 1000, 600, '255,190,110', 0.22);
    whip(ctx, env, invLerp(-0.25, 0.3, l));
  },
};

// ================= 7. The theme park: rink → chocolate cart → haunted castle & drop tower =================
function parkFacades(ctx, t) {
  const r = rng(31);
  for (let i = 0; i < 8; i++) {
    const x = -200 + i * 360, h = 380 + r() * 260, w = 260;
    if (i === 3) { // a pagoda roofline
      ctx.fillStyle = '#4A2E5A'; ctx.fillRect(x, 1150 - h, w, h);
      for (let k = 0; k < 3; k++) { const yy = 1150 - h - k * 90, ww = w + 120 - k * 50; ctx.fillStyle = '#8E3B3B'; ctx.beginPath(); ctx.moveTo(x + w / 2 - ww / 2, yy); ctx.quadraticCurveTo(x + w / 2, yy - 70, x + w / 2 + ww / 2, yy); ctx.quadraticCurveTo(x + w / 2, yy - 30, x + w / 2 - ww / 2, yy); ctx.fill(); }
      glow(ctx, x + w / 2, 1150 - h / 2, 200, '255,120,90', 0.25);
      continue;
    }
    house(ctx, x, 1150, w, h, { roof: i % 2 ? 'gable' : 'step', body: ['#3A2F66', '#4A3570', '#35406A'][i % 3], roofC: '#2A2350', lit: 0.65, seed: 300 + i, t, win: 3 });
    if (i % 2 === 0) { ctx.fillStyle = '#2A2350'; ctx.fillRect(x + w - 40, 1150 - h - 160, 70, 160); ctx.beginPath(); ctx.moveTo(x + w - 52, 1150 - h - 160); ctx.lineTo(x + w - 5, 1150 - h - 280); ctx.lineTo(x + w + 42, 1150 - h - 160); ctx.fill(); }
  }
  for (let i = 0; i < 6; i++) lights(ctx, -300 + i * 500, 640 + (i % 2) * 40, 200 + i * 500, 660, 80, 16, t, { seed: 330 + i, rgb: ['230,184,92', '200,170,255', '246,241,231'][i % 3] });
}
function mouse(ctx, x, y, s, hit, t) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(hit > 0 ? Math.sin(hit * 20) * 0.5 * (1 - hit) : 0);
  ctx.fillStyle = '#5A3B2E'; ctx.fillRect(-6, 30, 12, 90);
  ctx.fillStyle = '#C9C2D8'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * 34, -40, 26, 0, TAU); ctx.fill(); ctx.fillStyle = '#F2A7B8'; ctx.beginPath(); ctx.arc(sx * 34, -40, 14, 0, TAU); ctx.fill(); ctx.fillStyle = '#C9C2D8'; }
  ctx.beginPath(); ctx.ellipse(0, 0, 44, 40, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2A2140'; ctx.beginPath(); ctx.arc(-14, -6, 5, 0, TAU); ctx.arc(14, -6, 5, 0, TAU); ctx.fill(); ctx.fillStyle = '#F07A8A'; ctx.beginPath(); ctx.arc(0, 8, 5, 0, TAU); ctx.fill();
  ctx.strokeStyle = C.gold; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 52, 18, 0, TAU); ctx.stroke(); ctx.fillStyle = '#B23A48'; ctx.beginPath(); ctx.arc(0, 52, 7, 0, TAU); ctx.fill();
  if (hit > 0) { ctx.fillStyle = '#5B3420'; ctx.beginPath(); ctx.arc(-8, -16, 16, 0, TAU); ctx.arc(10, -24, 10, 0, TAU); ctx.fill(); }
  ctx.restore();
}
const SHOTS = [ // [t, who, target index, hit]
  [0.5, 'jc', 0, true], [1.0, 'xc', 1, false], [1.4, 'jc', 2, true], [2.0, 'xc', 1, false], [2.5, 'jc', 1, true],
];
export const phantasia = {
  draw(ctx, lt, env) {
    const t = env.t, S1 = 2.8, S2 = 6.8;
    if (lt < S1) { // the rink under garlands
      env.cam({ cx: key(lt, [[0, 1180], [S1, 1240]]), cy: 800, z: 1.04 });
      nightSky(ctx, C.night, '#30285A'); stars(ctx, -200, -300, 2800, 800, t, 100, 23);
      parkFacades(ctx, t);
      ctx.fillStyle = '#D6E4F2'; ctx.beginPath(); ctx.ellipse(1200, 1330, 1200, 210, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,214,140,0.18)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(700 + i * 220, 1300, 60, 10, 0, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = 'rgba(160,180,210,0.6)'; ctx.lineWidth = 3; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(1200 + Math.sin(i) * 200, 1330, 300 + i * 120, 40 + i * 20, 0, 0.2, 2.5); ctx.stroke(); }
      const glideX = key(lt, [[0, 960], [S1, 1180]], E.linear), wob = Math.sin(t * 6) * 0.08 * (1 - seg(lt, 1.6, 2.2));
      const hx = pair(ctx, t,
        { who: 'jc', x: glideX, y: 1340, lean: wob - 0.04, turn: 0.4, expr: { eyes: cue(lt, [[0, 'wide'], [2.0, 'open']]), mouth: cue(lt, [[0, 'wavy'], [2.0, 'grin']]), brows: 'worried' }, armL: { a: 1.4 }, armR: { a: 1.4 }, sweat: 1 - seg(lt, 1.8, 2.2) },
        { who: 'xc', x: glideX + 230, y: 1350, lean: -0.08, turn: 0.45, expr: { eyes: 'happy', mouth: 'smile' }, armL: { a: 1.2 }, armR: { a: 1.6 } });
      whip(ctx, env, invLerp(S1 - 0.3, S1 + 0.25, lt));
      return;
    }
    if (lt < S2) { // the chocolate cart vs. the mice
      const l = lt - S1;
      env.cam({ cx: key(l, [[0, 1500], [0.45, 1200, E.out], [4, 1210]]), cy: 820, z: 1.06 });
      sky(ctx, -400, -400, 2800, 2000, '#1E1636', '#2E2150');
      for (let i = 0; i < 5; i++) glow(ctx, 600 + i * 300, 300, 260, i % 2 ? '200,170,255' : '255,214,140', 0.25 + 0.1 * Math.sin(t * 2 + i));
      ctx.fillStyle = '#3B2A55'; ctx.fillRect(-400, 1010, 3200, 900); ctx.fillStyle = '#5A3B2E'; for (let i = 0; i < 9; i++) ctx.fillRect(-200 + i * 330, 1010, 180, 30);
      const tx = [880, 1220, 1560];
      for (let i = 0; i < 3; i++) {
        const hits = SHOTS.filter(([st, w, ti, hit]) => hit && ti === i && l > st + 0.35).map(([st]) => st + 0.35);
        const hk = hits.length ? clamp((l - hits[hits.length - 1]) / 0.8, 0, 1) : 0;
        const up = 0.5 + 0.5 * Math.sin(t * 2.2 + i * 2);
        mouse(ctx, tx[i], 860 - up * 40, 1.0, hits.length ? (hk < 1 ? hk : 0.999) : 0, t);
        for (const hst of hits) sparkles(ctx, t, tx[i], 820, 70, 4, 1 - clamp((l - hst) / 0.8, 0, 1), i + 5);
      }
      // splats on the wall for misses
      for (const [st, w, ti, hit] of SHOTS) if (!hit && l > st + 0.35) { ctx.fillStyle = '#5B3420'; const sx = tx[ti] + 140, sy = 760; ctx.beginPath(); ctx.arc(sx, sy, 26, 0, TAU); for (let k = 0; k < 6; k++) ctx.arc(sx + Math.cos(k) * 34, sy + Math.sin(k) * 30, 9, 0, TAU); ctx.fill(); }
      // flying chocolate
      for (const [st, w, ti, hit] of SHOTS) { const p = invLerp(st, st + 0.35, l); if (p <= 0 || p >= 1) continue; const sx = w === 'jc' ? 1180 : 1250, sy = GY - 190, ex = tx[ti] + (hit ? 0 : 140), ey = hit ? 860 : 760; ctx.fillStyle = '#5B3420'; ctx.beginPath(); ctx.arc(lerp(sx, ex, p), lerp(sy, ey, p) - Math.sin(p * Math.PI) * 120, 16, 0, TAU); ctx.fill(); }
      const recoil = (who) => Math.max(0, ...SHOTS.filter(s => s[1] === who).map(([st]) => 1 - clamp((l - st) / 0.2, 0, 1) * (l >= st ? 1 : 0) - (l < st ? 1 : 0)));
      const hx = pair(ctx, t,
        { who: 'jc', x: 1120, turn: -0.15, expr: { eyes: cue(l, [[0, 'open'], [0.9, 'sparkle']]), mouth: cue(l, [[0, 'flat'], [0.9, 'grin']]) }, blush: 0.6, armR: { a: 1.25 - recoil('jc') * 0.15, prop: 'blaster' }, armL: { a: 1.0 } },
        { who: 'xc', x: 1320, turn: -0.15, expr: { eyes: cue(l, [[0, 'open'], [1.4, 'happy']]), mouth: cue(l, [[0, 'o'], [1.4, 'smile']]) }, armL: { a: 1.25 - recoil('xc') * 0.15, prop: 'blaster' }, armR: { a: 1.0 } });
      // the cart
      ctx.fillStyle = C.purple; ctx.beginPath(); ctx.roundRect(860, 1235, 680, 240, 60); ctx.fill(); ctx.fillStyle = C.gold; ctx.fillRect(860, 1262, 680, 16); ctx.fillStyle = '#2A1D40'; ctx.beginPath(); ctx.arc(970, 1480, 40, 0, TAU); ctx.arc(1430, 1480, 40, 0, TAU); ctx.fill();
      lights(ctx, 860, 1235, 1540, 1235, 0, 12, t, { seed: 351, r: 4, glowR: 16, wire: 'rgba(0,0,0,0)' });
      whip(ctx, env, invLerp(-0.25, 0.3, l));
      return;
    }
    // haunted castle & the drop tower
    const l = lt - S2;
    const ringY = key(l, [[0.2, 1150], [2.0, 420], [2.8, 420], [3.15, 1080, E.in], [3.7, 1150, E.out]]);
    env.cam({ cx: key(l, [[0, 1500], [0.45, 1220, E.out], [4.7, 1220]]), cy: key(l, [[0, 820], [0.4, 820], [2.0, 560], [2.8, 560], [3.15, 800, E.in], [3.8, 820]]), z: key(l, [[0, 1.0], [2.8, 1.05], [3.15, 1.12, E.in], [4.0, 1.0]]) });
    nightSky(ctx, '#120F24', '#2A2350'); stars(ctx, -200, -400, 2800, 1200, t, 140, 24);
    // haunted castle on the hill
    ctx.fillStyle = '#211B3E'; ctx.beginPath(); ctx.moveTo(-200, 1150); ctx.quadraticCurveTo(500, 760, 1000, 1150); ctx.fill();
    ctx.fillStyle = '#1A1533'; ctx.fillRect(330, 560, 300, 330); for (const [cx, h] of [[330, 470], [630, 420], [480, 560]]) { ctx.fillRect(cx - 45, 890 - h, 90, h); ctx.beginPath(); ctx.moveTo(cx - 55, 890 - h); ctx.lineTo(cx, 890 - h - 120); ctx.lineTo(cx + 55, 890 - h); ctx.fill(); }
    for (let i = 0; i < 6; i++) { const fl = 0.5 + 0.5 * Math.sin(t * 5 + i * 2); ctx.fillStyle = `rgba(180,255,200,${0.6 * fl})`; ctx.fillRect(360 + (i % 3) * 90, 620 + Math.floor(i / 3) * 110, 26, 44); }
    // tower
    ctx.fillStyle = '#2E2756'; ctx.fillRect(1180, -400, 80, 1560); ctx.strokeStyle = 'rgba(185,166,224,0.25)'; ctx.lineWidth = 3; for (let y = -380; y < 1150; y += 60) { ctx.beginPath(); ctx.moveTo(1180, y); ctx.lineTo(1260, y + 60); ctx.moveTo(1260, y); ctx.lineTo(1180, y + 60); ctx.stroke(); }
    for (let y = -380; y < 1150; y += 45) glow(ctx, 1220, y, 16, (Math.floor(y / 45 + t * 8) % 4) ? '230,184,92' : '200,170,255', 0.9);
    snowGround(ctx, -400, 2800, 1150, 500, { seed: 27 });
    const dropping = l > 2.8 && l < 3.5, scared = l > 2.6 && l < 3.9;
    const shake = dropping ? Math.sin(t * 60) * 3 : 0;
    const hx = pair(ctx, t,
      { who: 'jc', x: 1110 + shake, y: ringY, turn: 0.2, hairUp: dropping ? 1 : 0, expr: { eyes: scared ? 'squeeze' : l > 1.2 ? 'wide' : 'open', mouth: scared ? 'wavy' : 'flat' }, blush: 0.5, armL: { a: 0.9 }, armR: { a: 0.9 }, sweat: l > 1.4 && l < 2.8 ? 1 : 0, noShadow: true },
      { who: 'xc', x: 1330 + shake, y: ringY, turn: -0.2, hairUp: dropping ? 1 : 0, expr: { eyes: scared ? 'squeeze' : 'happy', mouth: scared ? 'wavy' : 'smile' }, armL: { a: 0.9 }, armR: { a: 0.9 }, noShadow: true });
    // seats & shoulder bars
    ctx.fillStyle = '#4A3A7A'; ctx.beginPath(); ctx.roundRect(980, ringY - 150, 480, 60, 20); ctx.fill(); ctx.fillStyle = C.gold; ctx.fillRect(980, ringY - 130, 480, 10);
    lights(ctx, 980, ringY - 150, 1460, ringY - 150, 0, 10, t, { seed: 361, r: 4, glowR: 14, wire: 'rgba(0,0,0,0)' });
    if (dropping) { env.screen(); const { W, H } = env; ctx.strokeStyle = 'rgba(246,241,231,0.35)'; ctx.lineWidth = 3; const r = rng(Math.floor(t * 24)); for (let i = 0; i < 24; i++) { const x = r() * W, y = r() * H; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 120 - r() * 160); ctx.stroke(); } }
    whip(ctx, env, invLerp(-0.25, 0.3, l));
  },
};
