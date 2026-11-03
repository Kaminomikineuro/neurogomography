// The tear-off calendar: pad, spiral binding, pages with perforation, big dates, an illustration window, tearing.
import { E, clamp, lerp, invLerp, seg, rng, hash, TAU } from './mg.js';
import { INK, plate, paperHole, reg, q } from './riso.js';

export const SERIF = '"Cormorant Garamond", Georgia, serif', SANS = 'Rubik, sans-serif';

export function layout(W, H) {
  const portrait = H > W, PW = portrait ? 1000 : 1700, PH = portrait ? 1600 : 1000;
  const s = Math.min(W * (portrait ? 0.9 : 0.88) / PW, H * 0.86 / PH);
  return {
    portrait, PW, PH, s, ox: (W - PW * s) / 2, oy: (H - PH * s) / 2 + H * 0.015,
    win: portrait ? { x: 60, y: 420, w: 880, h: 880 } : { x: 660, y: 130, w: 980, h: 800 },
    month: portrait ? { x: 500, y: 205, size: 40 } : { x: 330, y: 245, size: 36 },
    num: portrait ? { x: 500, y: 385, size: 210 } : { x: 330, y: 470, size: 190 },
    city: portrait ? { x: 500, y: 1440, size: 112 } : { x: 330, y: 665, size: 96 },
    sub: portrait ? { x: 500, y: 1520, size: 33 } : { x: 330, y: 745, size: 29 },
    top: 62, perf: 104,
  };
}
export const padTransform = (ctx, L, extra = { dx: 0, dy: 0, sc: 1, rot: 0 }) => {
  const cx = L.ox + L.PW * L.s / 2, cy = L.oy + L.PH * L.s / 2;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.translate(cx + extra.dx, cy + extra.dy); ctx.rotate(extra.rot || 0); ctx.scale(L.s * extra.sc, L.s * extra.sc); ctx.translate(-L.PW / 2, -L.PH / 2);
};

export function drawPadBack(ctx, L, t, left) { // shadow + stack thickness (fewer pages left → thinner)
  const th = 6 + left * 2.2;
  ctx.save(); ctx.fillStyle = 'rgba(43,39,41,0.22)'; ctx.beginPath(); ctx.roundRect(18, 40, L.PW, L.PH + th - 20, 14); ctx.fill(); ctx.restore();
  for (let i = Math.ceil(th / 3); i > 0; i--) { ctx.fillStyle = i % 2 ? '#E7DECC' : '#EFE7D7'; ctx.beginPath(); ctx.roundRect(0, L.top + i * 3, L.PW, L.PH - L.top, 10); ctx.fill(); }
}
export function drawBinding(ctx, L, t) {
  plate(ctx, t, 'r', () => { ctx.beginPath(); ctx.roundRect(-8, 0, L.PW + 16, L.top + 22, 12); ctx.fill(); }, { amp: 1.2 });
  const n = L.portrait ? 11 : 17;
  for (let i = 0; i < n; i++) {
    const x = 70 + i * (L.PW - 140) / (n - 1);
    ctx.fillStyle = INK.paper; ctx.beginPath(); ctx.arc(x, L.top + 10, 9, 0, TAU); ctx.fill();
    ctx.strokeStyle = INK.k; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, L.top + 12); ctx.bezierCurveTo(x - 4, L.top - 30, x + 14, -22, x + 10, L.top - 4); ctx.stroke();
  }
  // torn stubs left behind on the perforation
  ctx.fillStyle = '#EDE4D2'; ctx.beginPath(); ctx.moveTo(0, L.top + 20); for (let x = 0; x <= L.PW; x += 14) ctx.lineTo(x, L.perf - 6 + ((x / 14) % 2 ? 5 : -3)); ctx.lineTo(L.PW, L.top + 20); ctx.closePath(); ctx.fill();
}

// one page; pg = { month, num, city, sub, dark, scene, t0 } ; tearP 0..1 when it is being torn
export function drawPage(ctx, L, pg, t, env, tearP = 0) {
  ctx.save();
  if (tearP > 0) {
    const e = E.in(tearP), w = Math.sin(tearP * Math.PI);
    ctx.translate(L.PW * 0.15, L.perf);
    ctx.rotate(-0.04 * w + e * 0.55);
    ctx.translate(e * L.PW * 0.95 - L.PW * 0.15, -L.perf - w * 60 + e * e * L.PH * 0.35);
    ctx.scale(1 + 0.02 * w, 1 - 0.06 * w);
  }
  // paper with a jagged top when it comes off
  const path = () => { ctx.beginPath(); if (tearP > 0) { ctx.moveTo(0, L.perf); for (let x = 0; x <= L.PW; x += 14) ctx.lineTo(x, L.perf + ((x / 14) % 2 ? 4 : -3)); } else { ctx.moveTo(0, L.perf - 8); ctx.lineTo(L.PW, L.perf - 8); }
    ctx.lineTo(L.PW, L.PH - 10); ctx.quadraticCurveTo(L.PW, L.PH, L.PW - 10, L.PH); ctx.lineTo(10, L.PH); ctx.quadraticCurveTo(0, L.PH, 0, L.PH - 10); ctx.closePath(); };
  if (tearP > 0) { ctx.save(); ctx.translate(14, 22); ctx.fillStyle = `rgba(43,39,41,${0.25 * (1 - tearP)})`; path(); ctx.fill(); ctx.restore(); }
  path(); ctx.fillStyle = INK.paper; ctx.fill();
  ctx.save(); path(); ctx.clip();
  if (pg.dark) plate(ctx, t, 'k', () => ctx.fillRect(-20, 0, L.PW + 40, L.PH + 20), { amp: 1 });
  // perforation
  ctx.fillStyle = pg.dark ? INK.paper : 'rgba(43,39,41,0.5)'; for (let x = 20; x < L.PW; x += 18) { ctx.beginPath(); ctx.arc(x, L.perf + 8, 2.6, 0, TAU); ctx.fill(); }
  const fg = pg.dark ? INK.paper : INK.k;
  // month
  ctx.font = `600 ${L.month.size}px ${SANS}`; ctx.textAlign = 'center'; ctx.letterSpacing = `${L.month.size * 0.32}px`;
  const mfill = () => ctx.fillText(pg.month, L.month.x + L.month.size * 0.16, L.month.y);
  if (pg.dark) { paperHole(ctx, mfill); plate(ctx, t, 'y', mfill, { amp: 1.5 }); } else plate(ctx, t, 'r', mfill, { amp: 1.5 });
  // big dates: red plate under black plate, out of register
  ctx.letterSpacing = '0px'; ctx.font = `600 ${L.num.size}px ${SANS}`;
  if (pg.numFn) pg.numFn(ctx, L, t, fg); else {
    plate(ctx, t, pg.dark ? 'y' : 'r', () => ctx.fillText(pg.num, L.num.x + 7, L.num.y + 6), { amp: 3 });
    if (pg.dark) paperHole(ctx, () => ctx.fillText(pg.num, L.num.x, L.num.y)); else plate(ctx, t, 'k', () => ctx.fillText(pg.num, L.num.x, L.num.y), { amp: 1.6 });
  }
  // illustration window
  const wn = L.win;
  ctx.save(); ctx.beginPath(); ctx.roundRect(wn.x, wn.y, wn.w, wn.h, 26); ctx.clip();
  const M0 = ctx.getTransform();
  const sceneEnv = { ...env, cam: (c) => { ctx.setTransform(M0); ctx.translate(wn.x + wn.w / 2, wn.y + wn.h / 2); const f = Math.max(wn.w, wn.h) / 1000 * (c.z ?? 1); ctx.scale(f, f); ctx.translate(-(c.cx ?? 500), -(c.cy ?? 500)); }, win: wn, M0 };
  if (pg.scene) { ctx.save(); pg.scene(ctx, t - pg.t0, sceneEnv); ctx.restore(); }
  ctx.restore();
  ctx.setTransform(M0);
  ctx.lineWidth = 5; ctx.strokeStyle = fg; ctx.beginPath(); ctx.roundRect(wn.x, wn.y, wn.w, wn.h, 26); ctx.stroke();
  // city + subtitle
  ctx.textAlign = 'center'; ctx.font = `700 ${L.city.size}px ${SERIF}`;
  if (pg.dark) paperHole(ctx, () => ctx.fillText(pg.city, L.city.x, L.city.y)); else plate(ctx, t, 'k', () => ctx.fillText(pg.city, L.city.x, L.city.y), { amp: 1.4 });
  if (pg.sub) { const big = pg.subBig; ctx.font = big ? `italic 500 ${L.city.size * 0.62}px ${SERIF}` : `400 ${L.sub.size}px ${SANS}`; ctx.letterSpacing = big ? '0px' : '2px'; const sy = big ? L.sub.y + L.city.size * 0.12 : L.sub.y; const sf = () => ctx.fillText(pg.sub, L.sub.x, sy);
    if (pg.dark) { paperHole(ctx, sf); plate(ctx, t, 'y', sf, { amp: 1.4 }); } else plate(ctx, t, big ? 'r' : 'v', sf, { amp: 1.4 }); ctx.letterSpacing = '0px'; }
  if (pg.over) pg.over(ctx, L, t, t - pg.t0);
  // curl shading while tearing
  if (tearP > 0) { const g = ctx.createLinearGradient(0, L.perf, L.PW, L.PH); g.addColorStop(0, 'rgba(43,39,41,0)'); g.addColorStop(1, `rgba(43,39,41,${0.35 * Math.sin(tearP * Math.PI)})`); ctx.fillStyle = g; ctx.fillRect(0, 0, L.PW, L.PH); }
  ctx.restore();
  ctx.restore();
}
