// mg.js — tiny deterministic motion toolkit for films rendered with scripts/render.mjs.
// Every function is pure: same input → same output. No Date.now(), no Math.random(), no rAF state.

// ---------- math ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, p) => a + (b - a) * p;
export const invLerp = (a, b, x) => clamp((x - a) / (b - a));
export const map = (x, a, b, c, d, ease = E.linear) => lerp(c, d, ease(invLerp(a, b, x)));
export const TAU = Math.PI * 2;

// ---------- cubic-bezier easing (same maths as CSS) ----------
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = t => ((ax * t + bx) * t + cx) * t, sy = t => ((ay * t + by) * t + cy) * t;
  const dx = t => (3 * ax * t + 2 * bx) * t + cx;
  return x => {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) { const e = sx(t) - x, d = dx(t); if (Math.abs(e) < 1e-6) return sy(t); if (Math.abs(d) < 1e-6) break; t -= e / d; }
    let lo = 0, hi = 1; t = x;
    for (let i = 0; i < 30; i++) { const v = sx(t); if (Math.abs(v - x) < 1e-6) break; if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    return sy(t);
  };
}

// Named curves used across the style catalogue (references/motion-principles.md)
export const E = {
  linear: x => x,
  out: bezier(0.22, 1, 0.36, 1),        // weighted deceleration — default for entrances / UI (elayadesign base curve)
  back: bezier(0.34, 1.56, 0.64, 1),     // elastic overshoot — flat vector entrances
  inOut: bezier(0.65, 0, 0.35, 1),       // line-art draw speed, camera moves
  morph: bezier(0.7, 0, 0.3, 1),         // shape morph: fastest in the middle
  quadInOut: bezier(0.45, 0, 0.55, 1),   // Bauhaus / mechanical
  sine: x => 0.5 - 0.5 * Math.cos(Math.PI * clamp(x)), // aurora breathing
  longTail: bezier(0.05, 0.8, 0.1, 1),   // 3D: ~80 % of travel in the first 20 % of time
  expoOut: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  in: bezier(0.55, 0, 1, 0.45),          // exits / falling under gravity
  steps: n => x => Math.floor(clamp(x) * n) / n, // pixel art / mechanical counters
};

// eased progress of t inside [a, b]
export const seg = (t, a, b, ease = E.out) => ease(invLerp(a, b, t));

// Damped spring step response, closed form (0 → 1). freq in Hz, damping ratio ζ (0.3 bouncy … 1 critical).
export function spring(t, freq = 2.2, zeta = 0.38) {
  if (t <= 0) return 0;
  const w = TAU * freq;
  if (zeta >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
  const wd = w * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + (zeta * w / wd) * Math.sin(wd * t));
}
// spring that starts at time a
export const springAt = (t, a, freq, zeta) => spring(t - a, freq, zeta);

// Anticipation → overshoot → settle in one curve (for "pop" entrances). Returns scale-like value 0 → 1.
export function pop(t, a, dur = 8 / 30, peak = 1.15) {
  const p = invLerp(a, a + dur, t);
  if (p <= 0) return 0;
  if (p < 0.6) return peak * E.out(p / 0.6);
  return lerp(peak, 1, E.inOut((p - 0.6) / 0.4));
}

// ---------- time helpers ----------
export const frameOf = (t, fps) => Math.floor(t * fps + 1e-6);
export const onN = (t, fps, n = 2) => Math.floor(t * fps / n + 1e-6) * n / fps; // animate "on twos/threes"
export const stagger = (i, step) => i * step;
export const pingpong = (x) => 1 - Math.abs(((x % 2) + 2) % 2 - 1);

// ---------- seeded randomness ----------
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const hash = (n, seed = 0) => { let x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return x - Math.floor(x); };
// smooth 1D value noise in [-1, 1]
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash(i, seed), hash(i + 1, seed), u) * 2 - 1;
}
// line-boil jitter: deterministic offset that changes every `n` frames
export const boil = (t, fps, i, amp = 1.5, n = 2, seed = 7) => {
  const k = Math.floor(t * fps / n);
  return [(hash(k * 13 + i, seed) - 0.5) * 2 * amp, (hash(k * 17 + i, seed + 1) - 0.5) * 2 * amp];
};

// ---------- cues ----------
// cues.json holds frame numbers (int) or seconds (float) under "beats"; this returns seconds.
export async function loadCues(url = './cues.json') {
  const c = await (await fetch(url)).json();
  const fps = c.fps || 30, s = {};
  for (const [k, v] of Object.entries(c.beats || {})) s[k] = Number.isInteger(v) && c.beatsIn === 'frames' ? v / fps : v;
  return { ...c, at: s };
}

// ---------- canvas helpers ----------
export function makeCanvas(W, H, host = document.body) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H; c.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px`;
  host.appendChild(c);
  return c.getContext('2d');
}

// Polyline with cumulative lengths, for draw-on (Trim Paths) effects.
export function polyline(points) {
  const L = [0];
  for (let i = 1; i < points.length; i++) L.push(L[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  const total = L[L.length - 1];
  const pointAt = (d) => {
    d = clamp(d, 0, total);
    let lo = 0, hi = L.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m] < d) lo = m; else hi = m; }
    const p = (d - L[lo]) / Math.max(1e-9, L[hi] - L[lo]);
    return [lerp(points[lo][0], points[hi][0], p), lerp(points[lo][1], points[hi][1], p)];
  };
  // stroke from length a to b
  const draw = (ctx, a, b) => {
    a = clamp(a, 0, total); b = clamp(b, 0, total); if (b <= a) return;
    ctx.beginPath(); const s = pointAt(a); ctx.moveTo(s[0], s[1]);
    for (let i = 0; i < points.length; i++) if (L[i] > a && L[i] < b) ctx.lineTo(points[i][0], points[i][1]);
    const e = pointAt(b); ctx.lineTo(e[0], e[1]); ctx.stroke();
  };
  return { points, L, total, pointAt, draw };
}

// Sample a cubic bezier into points (for building paths in code).
export function cubicPts(p0, p1, p2, p3, n = 48) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
  }
  return out;
}
export function arcPts(cx, cy, r, a0, a1, n = 96) {
  const out = [];
  for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return out;
}

// Film grain overlay drawn deterministically per frame (cheap: tiled noise patch with per-frame offset).
export function makeGrain(size = 256, seed = 3) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), img = g.createImageData(size, size), r = rng(seed);
  for (let i = 0; i < img.data.length; i += 4) { const v = r() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  return (ctx, t, fps, W, H, alpha = 0.06) => {
    const f = frameOf(t, fps), ox = Math.floor(hash(f, 1) * size), oy = Math.floor(hash(f, 2) * size);
    ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = 'overlay';
    for (let x = -ox; x < W; x += size) for (let y = -oy; y < H; y += size) ctx.drawImage(c, x, y);
    ctx.restore();
  };
}
