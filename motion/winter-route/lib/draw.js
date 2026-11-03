// Shared drawing helpers for «Зимний маршрут». Everything is a pure function of its arguments (seeded randomness only).
import { rng, hash, clamp, lerp, TAU } from './mg.js';

export const C = {
  night: '#17142B', night2: '#221D3F', night3: '#2E2756', deep: '#0F0D1E',
  cream: '#F6F1E7', cream2: '#E9E0CF', gold: '#E6B85C', goldHi: '#FFE2A3', purple: '#6B3FA0',
  lav: '#B9A6E0', ice: '#BFD6EE', ink: '#1B1730', warm: '#FFD27F',
};
export const SERIF = '"Cormorant Garamond", Georgia, serif';
export const SANS = 'Rubik, "DejaVu Sans", sans-serif';

// ---------- glow sprites (cached per colour) ----------
const sprites = new Map();
export function glowSprite(rgb, size = 128) {
  const key = rgb + size;
  if (sprites.has(key)) return sprites.get(key);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), r = size / 2, gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.18, `rgba(${rgb},0.75)`); gr.addColorStop(0.45, `rgba(${rgb},0.22)`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  sprites.set(key, c); return c;
}
export function glow(ctx, x, y, r, rgb = '230,184,92', a = 1) {
  if (a <= 0.003 || r <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= a;
  ctx.drawImage(glowSprite(rgb), x - r, y - r, 2 * r, 2 * r); ctx.restore();
}

// ---------- paper texture (multiplied over everything) ----------
let paperTile = null;
export function paper(size = 512) {
  if (paperTile) return paperTile;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), img = g.createImageData(size, size), r = rng(77);
  for (let i = 0; i < img.data.length; i += 4) { const v = 225 + r() * 30; img.data[i] = v; img.data[i + 1] = v - 3; img.data[i + 2] = v - 8; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  g.globalAlpha = 0.08; g.strokeStyle = '#6b5a40';
  for (let i = 0; i < 260; i++) { // fibres
    const x = r() * size, y = r() * size, a = r() * TAU, l = 6 + r() * 26;
    g.lineWidth = 0.4 + r() * 0.8; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  paperTile = c; return c;
}
export function paperOverlay(ctx, W, H, a = 0.13, t = 0) {
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = a;
  const p = paper(), ox = -Math.floor(hash(Math.floor(t * 12), 3) * 6), oy = -Math.floor(hash(Math.floor(t * 12), 4) * 6); // tiny gate weave
  for (let x = ox; x < W; x += p.width) for (let y = oy; y < H; y += p.height) ctx.drawImage(p, x, y);
  ctx.restore();
}
export function vignette(ctx, W, H, a = 0.45) {
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(15,13,30,0)'); v.addColorStop(1, `rgba(15,13,30,${a})`);
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

// ---------- snow (screen space, closed form) ----------
const flakeSets = new Map();
function flakes(n, seed) {
  const k = n + ':' + seed; if (flakeSets.has(k)) return flakeSets.get(k);
  const r = rng(seed), arr = [];
  for (let i = 0; i < n; i++) { const layer = r() < 0.55 ? 0 : r() < 0.7 ? 1 : 2; arr.push({ x: r(), y: r(), layer, ph: r() * TAU, f: 0.4 + r() * 0.8, s: r() }); }
  flakeSets.set(k, arr); return arr;
}
export function snow(ctx, W, H, t, { n = 240, seed = 5, a = 1, wind = 0, speed = 1, scale = 1 } = {}) {
  if (a <= 0) return;
  const sz = [2.0, 3.6, 6.4].map(v => v * scale * Math.max(W, H) / 1920), vy = [38, 70, 120].map(v => v * speed * Math.max(W, H) / 1920);
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = C.cream;
  for (const f of flakes(n, seed)) {
    const L = f.layer, s = sz[L] * (0.7 + f.s * 0.6);
    const y = ((f.y * (H + 40) + t * vy[L]) % (H + 40)) - 20;
    const x = (((f.x * (W + 80) + Math.sin(t * f.f + f.ph) * 22 * (L + 1) + t * wind * (60 + 60 * L)) % (W + 80)) + W + 80) % (W + 80) - 40;
    ctx.globalAlpha = a * (0.45 + 0.25 * L);
    if (L === 2) { ctx.drawImage(glowSprite('246,241,231', 64), x - s * 1.6, y - s * 1.6, s * 3.2, s * 3.2); }
    else { ctx.beginPath(); ctx.arc(x, y, s * 0.5, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

// ---------- string lights ----------
export function lights(ctx, x1, y1, x2, y2, sag, n, t, { seed = 1, r = 5, rgb = '230,184,92', wire = 'rgba(15,13,30,0.8)', a = 1, glowR = 26 } = {}) {
  const px = (u) => lerp(x1, x2, u), py = (u) => lerp(y1, y2, u) + sag * 4 * u * (1 - u);
  ctx.save(); ctx.globalAlpha *= a;
  ctx.strokeStyle = wire; ctx.lineWidth = 2; ctx.beginPath();
  for (let i = 0; i <= 24; i++) { const u = i / 24; i ? ctx.lineTo(px(u), py(u)) : ctx.moveTo(px(u), py(u)); }
  ctx.stroke();
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n, x = px(u), y = py(u) + 4, tw = 0.72 + 0.28 * Math.sin(t * (1.3 + hash(i, seed) * 2) + hash(i, seed + 1) * 9);
    glow(ctx, x, y, glowR * tw, rgb, 0.9 * tw);
    ctx.fillStyle = `rgba(${rgb},1)`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,248,225,0.95)'; ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.4, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---------- buildings ----------
// house with a roof, snow cap and lit windows. roof: 'gable' | 'step' | 'hip' | 'flat' | 'onion'
export function house(ctx, x, base, w, h, { roof = 'gable', body = C.night3, roofC = '#3A2F66', lit = 0.6, seed = 1, t = 0, win = 3, rows = 0, door = false, roofH = null } = {}) {
  const r = rng(seed); const rh = roofH ?? w * 0.42;
  ctx.fillStyle = body; ctx.fillRect(x, base - h, w, h);
  // roof
  ctx.fillStyle = roofC; ctx.beginPath();
  if (roof === 'gable') { ctx.moveTo(x - 6, base - h); ctx.lineTo(x + w / 2, base - h - rh); ctx.lineTo(x + w + 6, base - h); }
  else if (roof === 'step') { const s = 5, sw = w / (2 * s - 1); ctx.moveTo(x, base - h); for (let i = 0; i < s; i++) { const yy = base - h - (i + 1) * rh / s; ctx.lineTo(x + i * sw, yy); ctx.lineTo(x + (i + 1) * sw, yy); } for (let i = s - 1; i >= 0; i--) { const yy = base - h - (i + 1) * rh / s; ctx.lineTo(x + w - (i + 1) * sw, yy); ctx.lineTo(x + w - i * sw, yy); } ctx.lineTo(x + w, base - h); }
  else if (roof === 'hip') { ctx.moveTo(x - 6, base - h); ctx.lineTo(x + w * 0.22, base - h - rh * 0.6); ctx.lineTo(x + w * 0.78, base - h - rh * 0.6); ctx.lineTo(x + w + 6, base - h); }
  else { ctx.rect(x - 4, base - h - 10, w + 8, 10); }
  ctx.closePath(); ctx.fill();
  // snow cap
  ctx.fillStyle = C.cream; ctx.beginPath();
  if (roof === 'gable') { ctx.moveTo(x - 7, base - h + 1); ctx.lineTo(x + w / 2, base - h - rh - 2); ctx.lineTo(x + w + 7, base - h + 1); ctx.lineTo(x + w + 1, base - h + 6); ctx.lineTo(x + w / 2, base - h - rh + 12); ctx.lineTo(x - 1, base - h + 6); }
  else { ctx.moveTo(x - 6, base - h - (roof === 'flat' ? 10 : rh * 0.6) - 2); ctx.lineTo(x + w + 6, base - h - (roof === 'flat' ? 10 : rh * 0.6) - 2); ctx.lineTo(x + w + 6, base - h - (roof === 'flat' ? 10 : rh * 0.6) + 7); ctx.lineTo(x - 6, base - h - (roof === 'flat' ? 10 : rh * 0.6) + 7); }
  ctx.closePath(); ctx.fill();
  // windows
  const cols = win, rws = rows || Math.max(1, Math.floor((h - 40) / 70)), ww = w / (cols * 2 + 1), wh = Math.min(42, (h - 30) / (rws * 1.8));
  for (let j = 0; j < rws; j++) for (let i = 0; i < cols; i++) {
    const wx = x + ww * (1 + 2 * i), wy = base - h + 22 + j * wh * 1.8; if (wy + wh > base - (door ? 70 : 12)) continue;
    const on = r() < lit;
    if (on) { const fl = 0.85 + 0.15 * Math.sin(t * 2 + i * 3 + j); ctx.fillStyle = C.warm; ctx.globalAlpha = fl; ctx.fillRect(wx, wy, ww, wh); ctx.globalAlpha = 1; glow(ctx, wx + ww / 2, wy + wh / 2, ww * 2.2, '255,210,127', 0.35 * fl); }
    else { ctx.fillStyle = 'rgba(15,13,30,0.55)'; ctx.fillRect(wx, wy, ww, wh); }
  }
  if (door) { ctx.fillStyle = 'rgba(15,13,30,0.8)'; ctx.fillRect(x + w / 2 - 16, base - 58, 32, 58); }
}

// market hut (wooden stall) with lit counter and a garland
export function hut(ctx, x, base, w, h, t, { seed = 1, body = '#5A3B2E', roofC = '#3A2F66', awning = C.purple } = {}) {
  ctx.fillStyle = body; ctx.fillRect(x, base - h, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; for (let i = 1; i < 6; i++) ctx.fillRect(x, base - h + i * h / 6, w, 2);
  // counter opening
  ctx.fillStyle = C.warm; ctx.fillRect(x + w * 0.12, base - h * 0.78, w * 0.76, h * 0.42);
  glow(ctx, x + w / 2, base - h * 0.57, w * 0.9, '255,210,127', 0.55);
  ctx.fillStyle = 'rgba(90,40,20,0.55)'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(x + w * (0.22 + i * 0.14), base - h * 0.42, w * 0.045, 0, TAU); ctx.fill(); }
  ctx.fillStyle = body; ctx.fillRect(x + w * 0.08, base - h * 0.38, w * 0.84, h * 0.08);
  // awning stripes
  const aw = w * 1.08, ax = x - w * 0.04;
  for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? C.cream : awning; ctx.beginPath(); ctx.moveTo(ax + i * aw / 6, base - h * 0.82); ctx.lineTo(ax + (i + 1) * aw / 6, base - h * 0.82); ctx.lineTo(ax + (i + 0.5) * aw / 6 + aw / 12, base - h * 0.7); ctx.lineTo(ax + i * aw / 6, base - h * 0.7); ctx.fill(); }
  // roof
  ctx.fillStyle = roofC; ctx.beginPath(); ctx.moveTo(x - 14, base - h); ctx.lineTo(x + w / 2, base - h - w * 0.45); ctx.lineTo(x + w + 14, base - h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.cream; ctx.beginPath(); ctx.moveTo(x - 15, base - h + 1); ctx.lineTo(x + w / 2, base - h - w * 0.45 - 2); ctx.lineTo(x + w + 15, base - h + 1); ctx.lineTo(x + w + 6, base - h + 8); ctx.lineTo(x + w / 2, base - h - w * 0.45 + 13); ctx.lineTo(x - 6, base - h + 8); ctx.closePath(); ctx.fill();
  lights(ctx, x - 10, base - h + 4, x + w + 10, base - h + 4, 10, 7, t, { seed, r: 3.2, glowR: 15 });
}

// ---------- sky / ground ----------
export function sky(ctx, x0, y0, x1, y1, top = C.night, bottom = C.night3) {
  const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
}
const starSets = new Map();
export function stars(ctx, x0, y0, w, h, t, n = 120, seed = 9, a = 1) {
  const k = n + ':' + seed; if (!starSets.has(k)) { const r = rng(seed); starSets.set(k, Array.from({ length: n }, () => ({ x: r(), y: r(), s: 0.6 + r() * 1.8, p: r() * TAU }))); }
  ctx.save(); ctx.fillStyle = C.cream;
  for (const s of starSets.get(k)) { ctx.globalAlpha = a * (0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.3 + s.p))); ctx.beginPath(); ctx.arc(x0 + s.x * w, y0 + s.y * h, s.s, 0, TAU); ctx.fill(); }
  ctx.restore();
}
export function snowGround(ctx, x0, x1, y, h, { c1 = C.cream, c2 = '#D9D2EA', wave = 14, seed = 3 } = {}) {
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x0, y + h);
  for (let x = x0; x <= x1; x += 40) ctx.lineTo(x, y + Math.sin(x * 0.006 + seed) * wave + Math.sin(x * 0.017 + seed * 2) * wave * 0.4);
  ctx.lineTo(x1, y + h); ctx.closePath(); ctx.fill();
}
export function moon(ctx, x, y, r) {
  glow(ctx, x, y, r * 4.5, '246,241,231', 0.35);
  ctx.fillStyle = C.cream; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(185,166,224,0.35)'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.2, r * 0.22, 0, TAU); ctx.arc(x + r * 0.25, y + r * 0.3, r * 0.14, 0, TAU); ctx.fill();
}
// little 4-point sparkle
export function sparkle(ctx, x, y, r, a = 1, color = C.goldHi) {
  if (a <= 0) return; ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r); ctx.fill(); ctx.restore();
}

// ---------- text ----------
export function text(ctx, s, x, y, { font = SERIF, size = 80, weight = 600, style = 'normal', color = C.cream, align = 'center', track = 0, alpha = 1, shadow = true } = {}) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.font = `${style} ${weight} ${size}px ${font}`; ctx.letterSpacing = `${track}px`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  const xx = align === 'center' ? x + track / 2 : x;
  if (shadow) { ctx.shadowColor = 'rgba(15,13,30,0.55)'; ctx.shadowBlur = size * 0.25; ctx.shadowOffsetY = size * 0.04; }
  ctx.fillStyle = color; ctx.fillText(s, xx, y); ctx.restore();
}
export function measure(ctx, s, size, weight = 600, font = SERIF, track = 0) { ctx.save(); ctx.font = `${weight} ${size}px ${font}`; ctx.letterSpacing = `${track}px`; const w = ctx.measureText(s).width; ctx.restore(); return w; }
