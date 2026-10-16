// Студия «Белая кровь» — комикс: автосклейка страниц из кадров серии,
// пузыри с репликами из книги, подписи, звуки, эффекты манги, большая фигура героя.
// Манга — страницы 1000×1414 (как B5). Вебтун — длинная лента шириной 800.
const CM = { data: null, hints: {}, page: 0, sel: null, dim: {}, cut: {}, timer: null, ep: null };
const MANGA = { w: 1000, h: 1414, m: 44, g: 16 };
const WEB = { w: 800, gap: 70, sceneGap: 260, pageH: 7000 };
const FONT = "'Arial Narrow','Roboto Condensed','Segoe UI',Arial,sans-serif";
const BUBBLES = {
  speak: 'Речь', think: 'Мысли', whisper: 'Шёпот', yell: 'Крик', scream: 'Вопль', burst: 'Удар / взрыв',
  spooky: 'Жуть', digital: 'Связь / магия', dreamy: 'Воспоминание', caption: 'Подпись', 'caption-dark': 'Подпись (тёмная)', sfx: 'Звук',
};
const FX = { '': 'без эффекта', speed: 'линии скорости →', speedv: 'линии скорости ↓', focus: 'фокус-линии (в центр)', flash: 'вспышка', dark: 'затемнение краёв' };

// ---------- данные ----------
const cid = () => Math.random().toString(36).slice(2, 8);
const shotImg = (s) => {
  if (!s) return null;
  const f = selFile(s);
  if (f) return f;
  if (s.imgFrom) return selFile(findShot(s.imgFrom)?.shot);
  return null;
};
const allShots = () => S.ep.scenes.flatMap((sc) => sc.shots.map((s) => ({ s, sc })));
const shotById = (id) => findShot(id)?.shot;
function cls(s) {
  const c = (s.camera || '').toLowerCase(), f = (s.frame || '').toLowerCase();
  const H = CM.hints;
  return {
    eyes: H.eyes?.includes(s.id) || (/глаз|взгляд|зрач/.test(f) && /сверхкрупн|деталь/.test(c)),
    impact: /удар|вспышк|импакт|смаз|пике|в полёте|рывок|тряск|бросок|замедлен/.test(c + ' ' + f),
    size: /сверхкрупн|крупн|детал|вставк/.test(c) ? 'close' : /общий|сверхобщ|небо|панорам|сверху|пролёт|воздух/.test(c) ? 'wide' : 'medium',
    splash: H.splash?.includes(s.id),
    hero: H.hero?.includes(s.id),
  };
}
const PRNG = (seed) => { let x = 0; for (const ch of String(seed)) x = (x * 31 + ch.charCodeAt(0)) | 0; return () => ((x = (x * 1103515245 + 12345) | 0) >>> 0) / 4294967296; };

// ---------- текст и пузыри ----------
const mctx = document.createElement('canvas').getContext('2d');
function wrap(text, fs, kind) {
  mctx.font = `${kind === 'sfx' ? 900 : 700} ${fs}px ${FONT}`;
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const len = String(text || '').length;
  const maxW = kind === 'sfx' ? 1e9 : Math.max(fs * 4.5, Math.min(fs * 13, Math.sqrt(len) * fs * 1.9));
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (cur && mctx.measureText(t).width > maxW) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  const w = Math.max(fs, ...lines.map((l) => mctx.measureText(l).width));
  return { lines: lines.length ? lines : [''], w, h: Math.max(1, lines.length) * fs * 1.12 };
}
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const P = (pts) => 'M' + pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join('L') + 'Z';
function ellipsePts(cx, cy, rx, ry, n, fn = () => 1) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const k = fn(i, a); out.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
  return out;
}
function tailPts(cx, cy, rx, ry, tail, width = 0.32) {
  const a = Math.atan2((tail[1] - cy) / ry, (tail[0] - cx) / rx);
  const p = (d) => [cx + Math.cos(a + d) * rx * 0.85, cy + Math.sin(a + d) * ry * 0.85];
  return [p(-width), tail, p(width)];
}
// Пузырь: контур рисуется дважды (обводка, потом заливка) — так хвост и тело сливаются в одну фигуру
function bubbleSVG(b, sel) {
  const fs = b.size || 22;
  const t = wrap(b.text, fs, b.kind);
  const cx = b.x, cy = b.y;
  const k = b.kind || 'speak';
  let rx = t.w / 2 * 1.28 + fs * 0.7, ry = t.h / 2 * 1.32 + fs * 0.55;
  const rnd = PRNG(b.id);
  const shapes = []; // [d, extra]
  let stroke = '#111', sw = 3, dash = '', fill = '#fff', color = '#111';
  const tail = b.tail && !/caption|sfx/.test(k) ? b.tail : null;
  if (k === 'speak' || k === 'whisper') {
    shapes.push(P(ellipsePts(cx, cy, rx, ry, 48)));
    if (tail) shapes.push(P(tailPts(cx, cy, rx, ry, tail)));
    if (k === 'whisper') { dash = '9 7'; sw = 2.5; }
  } else if (k === 'think' || k === 'dreamy') {
    rx *= 1.06; ry *= 1.1;
    const n = Math.max(8, Math.round((rx + ry) / 22));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, r = Math.min(rx, ry) * (0.42 + rnd() * 0.12);
      shapes.push(`M${cx + Math.cos(a) * rx * 0.82 - r},${cy + Math.sin(a) * ry * 0.82}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`);
    }
    shapes.push(P(ellipsePts(cx, cy, rx * 0.86, ry * 0.86, 40)));
    if (tail) {
      for (let i = 1; i <= 3; i++) {
        const q = 0.55 + i * 0.15, r = fs * (0.55 - i * 0.12);
        const px = cx + (tail[0] - cx) * q, py = cy + (tail[1] - cy) * q;
        shapes.push(`M${px - r},${py}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`);
      }
    }
    if (k === 'dreamy') { stroke = '#9a8f99'; sw = 2; }
  } else if (k === 'yell' || k === 'scream' || k === 'burst') {
    const n = k === 'yell' ? 34 : k === 'scream' ? 22 : 16, hi = k === 'yell' ? 1.12 : k === 'scream' ? 1.32 : 1.7;
    if (k === 'burst') { rx *= 1.15; ry *= 1.2; }
    shapes.push(P(ellipsePts(cx, cy, rx, ry, n * 2, (i) => (i % 2 ? hi + rnd() * (hi - 1) * 0.8 : 0.96))));
    if (tail) shapes.push(P(tailPts(cx, cy, rx, ry, tail, 0.22)));
    sw = 3.2;
  } else if (k === 'spooky') {
    shapes.push(P(ellipsePts(cx, cy, rx * 1.05, ry * 1.08, 72, (i) => 1 + Math.sin(i * 0.9) * 0.045 + Math.sin(i * 0.37) * 0.03)));
    if (tail) shapes.push(P(tailPts(cx, cy, rx, ry, tail, 0.18)));
    stroke = '#2b2236'; sw = 2.2;
    for (let i = 0; i < 5; i++) { const a = rnd() * Math.PI * 2, r = 3 + rnd() * 5; shapes.push(`M${cx + Math.cos(a) * rx * 1.12 - r},${cy + Math.sin(a) * ry * 1.14}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`); }
  } else if (k === 'digital') {
    const w = rx * 0.95, hh = ry * 0.8, s = fs * 0.5;
    shapes.push(P([[cx - w, cy - hh + s], [cx - w + s, cy - hh + s], [cx - w + s, cy - hh], [cx + w, cy - hh], [cx + w, cy + hh - s], [cx + w - s, cy + hh - s], [cx + w - s, cy + hh], [cx - w, cy + hh]]));
    if (tail) shapes.push(P(tailPts(cx, cy, rx, ry, tail, 0.18)));
    sw = 2.6;
  } else if (k === 'caption' || k === 'caption-dark') {
    const w = t.w / 2 + fs * 0.6, hh = t.h / 2 + fs * 0.45;
    shapes.push(`M${cx - w},${cy - hh}h${2 * w}v${2 * hh}h${-2 * w}Z`);
    sw = 2.2;
    if (k === 'caption-dark') { fill = '#141014'; stroke = '#141014'; color = '#f4ece8'; }
  }
  const d = shapes.join(' ');
  const rot = b.rot ? ` rotate(${b.rot} ${cx} ${cy})` : '';
  let body = '';
  if (k === 'sfx') {
    const ffs = fs * 2.1;
    body = t.lines.map((l, i) => `<text x="${cx}" y="${cy + (i - (t.lines.length - 1) / 2) * ffs}" font-family="${FONT}" font-weight="900" font-style="italic" font-size="${ffs}" text-anchor="middle" dominant-baseline="central" fill="${b.color || '#111'}" stroke="#fff" stroke-width="${ffs * 0.16}" paint-order="stroke" stroke-linejoin="round" letter-spacing="1">${esc(l)}</text>`).join('');
  } else {
    body = `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw * 2}" stroke-linejoin="round" ${dash ? `stroke-dasharray="${dash}"` : ''}/><path d="${d}" fill="${fill}" stroke="none"/>`
      + t.lines.map((l, i) => `<text x="${cx}" y="${cy + (i - (t.lines.length - 1) / 2) * fs * 1.12}" font-family="${FONT}" font-weight="700" font-size="${fs}" text-anchor="middle" dominant-baseline="central" fill="${color}">${esc(l)}</text>`).join('');
  }
  const hl = sel ? `<rect x="${cx - rx - 6}" y="${cy - ry - 6}" width="${2 * rx + 12}" height="${2 * ry + 12}" fill="none" stroke="#e8553d" stroke-width="2" stroke-dasharray="6 4"/>` : '';
  const th = sel && tail ? `<circle data-k="tail" data-id="${b.id}" cx="${tail[0]}" cy="${tail[1]}" r="9" fill="#e8553d" stroke="#fff" stroke-width="2" style="cursor:crosshair"/>` : '';
  return `<g data-k="bubble" data-id="${b.id}" style="cursor:move" transform="${rot.trim()}">${body}${hl}</g>${th}`;
}
// «Искра взглядов» между двумя героями и значок злости
function sparkSVG(m, sel) {
  const [a, b] = m.pts;
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const rnd = PRNG(m.id);
  const star = ellipsePts(mx, my, 34, 34, 26, (i) => (i % 2 ? 1 + rnd() * 0.9 : 0.35));
  const hd = sel ? m.pts.map((p, i) => `<circle data-k="spark" data-id="${m.id}" data-i="${i}" cx="${p[0]}" cy="${p[1]}" r="9" fill="#e8553d" stroke="#fff" stroke-width="2"/>`).join('') : '';
  return `<g data-k="mark" data-id="${m.id}"><line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#fff" stroke-width="10" stroke-linecap="round"/><line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#111" stroke-width="5" stroke-linecap="round"/><path d="${P(star)}" fill="#111" stroke="#fff" stroke-width="3"/></g>${hd}`;
}
function angerSVG(m, sel) {
  const [x, y] = m.pts[0], r = (m.size || 34);
  const arc = (rot) => `<path transform="rotate(${rot} ${x} ${y})" d="M${x - r * 0.15},${y - r} Q${x - r * 0.12},${y - r * 0.2} ${x - r},${y - r * 0.15}" fill="none" stroke="${m.color || '#d22'}" stroke-width="${r * 0.2}" stroke-linecap="round"/>`;
  return `<g data-k="mark" data-id="${m.id}" style="cursor:move">${[0, 90, 180, 270].map(arc).join('')}${sel ? `<circle cx="${x}" cy="${y}" r="${r * 1.2}" fill="none" stroke="#e8553d" stroke-dasharray="5 4"/>` : ''}</g>`;
}

// ---------- панели ----------
const bbox = (poly) => {
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
};
function imgPlace(pn, file) {
  const b = bbox(pn.poly);
  const d = CM.dim[file] || { w: 1536, h: 1024 };
  const c = pn.crop || { s: 1, x: 0.5, y: 0.5 };
  const sc = Math.max(b.w / d.w, b.h / d.h) * (c.s || 1);
  const w = d.w * sc, h = d.h * sc;
  return { x: b.x + (b.w - w) * c.x, y: b.y + (b.h - h) * c.y, w, h, b };
}
function fxSVG(pn, b) {
  const rnd = PRNG(pn.id + pn.fx);
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  let out = '';
  if (pn.fx === 'speed' || pn.fx === 'speedv') {
    const vert = pn.fx === 'speedv';
    for (let i = 0; i < 46; i++) {
      const o = rnd(), len = (0.25 + rnd() * 0.6) * (vert ? b.h : b.w), st = rnd() * ((vert ? b.h : b.w) - len);
      const w = 0.8 + rnd() * 3.2, col = rnd() < 0.6 ? '#fff' : '#111';
      out += vert ? `<line x1="${b.x + o * b.w}" y1="${b.y + st}" x2="${b.x + o * b.w}" y2="${b.y + st + len}" stroke="${col}" stroke-opacity="0.75" stroke-width="${w}"/>`
        : `<line x1="${b.x + st}" y1="${b.y + o * b.h}" x2="${b.x + st + len}" y2="${b.y + o * b.h}" stroke="${col}" stroke-opacity="0.75" stroke-width="${w}"/>`;
    }
  } else if (pn.fx === 'focus' || pn.fx === 'flash') {
    const R = Math.hypot(b.w, b.h) / 2 + 20, n = pn.fx === 'flash' ? 70 : 90;
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, wd = 0.004 + rnd() * 0.012, r0 = R * (pn.fx === 'flash' ? 0.12 + rnd() * 0.25 : 0.42 + rnd() * 0.3);
      const pts = [[cx + Math.cos(a - wd) * R, cy + Math.sin(a - wd) * R], [cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a + wd) * R, cy + Math.sin(a + wd) * R]];
      out += `<path d="${P(pts)}" fill="${pn.fx === 'flash' ? '#fff' : '#111'}" fill-opacity="${pn.fx === 'flash' ? 0.85 : 0.8}"/>`;
    }
    if (pn.fx === 'flash') out = `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#fff" fill-opacity="0.25"/>` + out;
  } else if (pn.fx === 'dark') {
    out = `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="url(#vign)"/>`;
  }
  return out;
}
function figReady(pg) {
  const art = pg.figure && CM.data.arts?.[pg.figure.art];
  const file = art && art.selected != null && art.versions?.[art.selected]?.file;
  return !!(file && CM.cut[file + '|' + (pg.figure.thr ?? 28)]);
}
function panelSVG(pn, i, sel, opt) {
  // когда фигура героя готова, её панель-заглушка уступает место белому листу
  if (pn.heroSlot && opt.fig) return sel ? `<path d="${P(pn.poly)}" fill="none" stroke="#e8553d" stroke-width="3" stroke-dasharray="10 6" pointer-events="none"/>` : '';
  const s = shotById(pn.shot);
  const file = shotImg(s);
  const cp = `cp${opt.uid}_${i}`;
  const b = bbox(pn.poly);
  let inner;
  if (file) {
    const pl = imgPlace(pn, file);
    inner = `<image data-k="img" href="${opt.src(file)}" xlink:href="${opt.src(file)}" x="${pl.x}" y="${pl.y}" width="${pl.w}" height="${pl.h}" preserveAspectRatio="none"/>`;
  } else {
    inner = `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#ddd"/><text x="${b.x + b.w / 2}" y="${b.y + b.h / 2}" text-anchor="middle" font-family="${FONT}" font-size="22" fill="#777">кадр ${esc(pn.shot || '?')} — нет картинки</text>`;
  }
  return `<clipPath id="${cp}"><path d="${P(pn.poly)}"/></clipPath>`
    + `<g data-k="panel" data-i="${i}" clip-path="url(#${cp})" style="cursor:grab">${inner}${fxSVG(pn, b)}</g>`
    + (pn.border === false ? '' : `<path d="${P(pn.poly)}" fill="none" stroke="#111" stroke-width="4" stroke-linejoin="miter" pointer-events="none"/>`)
    + (sel ? `<path d="${P(pn.poly)}" fill="none" stroke="#e8553d" stroke-width="4" stroke-dasharray="10 6" pointer-events="none"/>` : '')
    + (opt.labels ? `<text x="${b.x + 8}" y="${b.y + 22}" font-family="${FONT}" font-size="16" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke" pointer-events="none">${esc(pn.shot)}</text>` : '');
}
function figureSVG(pg, sel, opt) {
  const f = pg.figure;
  if (!f) return '';
  const art = CM.data.arts?.[f.art];
  const file = art && art.selected != null && art.versions?.[art.selected]?.file;
  if (!file) return '';
  const src = opt.cutSrc(file, f.thr ?? 28);
  if (!src) return '';
  const d = CM.dim[file] || { w: 1024, h: 1536 };
  const h = f.h, w = h * d.w / d.h;
  return `<g data-k="fig" style="cursor:move" filter="url(#halo)"><image href="${src}" xlink:href="${src}" x="${f.x - w / 2}" y="${f.y}" width="${w}" height="${h}"/></g>`
    + (sel ? `<rect x="${f.x - w / 2}" y="${f.y}" width="${w}" height="${h}" fill="none" stroke="#e8553d" stroke-width="3" stroke-dasharray="10 6" pointer-events="none"/>` : '');
}
function pageSVG(pg, opt = {}) {
  opt = { uid: cid(), src: (f) => fileUrl(f), cutSrc: (f, t) => CM.cut[f + '|' + t] || null, labels: false, ...opt };
  const sel = opt.edit ? CM.sel : null;
  const isSel = (k, id) => sel && sel.k === k && sel.id === id;
  const defs = `<defs><radialGradient id="vign"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.75"/></radialGradient>`
    + `<filter id="halo" x="-10%" y="-10%" width="120%" height="120%"><feMorphology in="SourceAlpha" operator="dilate" radius="7" result="d"/><feFlood flood-color="#fff"/><feComposite in2="d" operator="in" result="w"/><feMorphology in="SourceAlpha" operator="dilate" radius="9" result="d2"/><feFlood flood-color="#111"/><feComposite in2="d2" operator="in" result="k"/><feMerge><feMergeNode in="k"/><feMergeNode in="w"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
  opt.fig = figReady(pg);
  const panels = pg.panels.map((pn, i) => panelSVG(pn, i, isSel('panel', i), opt)).join('');
  const fig = figureSVG(pg, isSel('fig', 0), opt);
  const marks = (pg.marks || []).map((m) => (m.kind === 'anger' ? angerSVG(m, isSel('mark', m.id)) : sparkSVG(m, isSel('mark', m.id)))).join('');
  const bubbles = (pg.bubbles || []).map((b) => bubbleSVG(b, isSel('bubble', b.id))).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${pg.w} ${pg.h}" width="${opt.width || pg.w}" height="${opt.width ? opt.width * pg.h / pg.w : pg.h}">${defs}<rect data-k="bg" width="${pg.w}" height="${pg.h}" fill="${pg.bg || '#fff'}"/>${panels}${fig}${marks}${bubbles}</svg>`;
}

// ---------- автосклейка ----------
function linesToBubbles(s, sc, b, out, side0) {
  const H = CM.hints;
  const sides = H.sides?.[sc.n] || {};
  let n = 0;
  const cap = H.captions?.[s.id];
  if (cap) out.push({ id: cid(), kind: 'caption', text: cap, x: b.x + Math.min(b.w * 0.3, 190), y: b.y + 40, size: 19 });
  for (const l of s.lines || []) {
    if (!l.text) continue;
    const kind = l.who === 'NARRATOR' ? 'caption' : H.kind?.[s.id] || (l.mode === 'vo' ? 'think' : /крич/.test(l.manner || '') ? 'yell' : /сипло|шёпот|шепот|тихо/.test(l.manner || '') ? 'whisper' : /!\s*$/.test(l.text) ? 'yell' : 'speak');
    const side = sides[l.who] || (n % 2 ? (side0 === 'l' ? 'r' : 'l') : side0);
    const x = side === 'l' ? b.x + b.w * 0.27 : b.x + b.w * 0.73;
    const y = b.y + b.h * (0.2 + (n + (cap ? 1 : 0)) * 0.26);
    const off = l.mode === 'offscreen';
    const tail = kind === 'caption' ? null : off ? [side === 'l' ? b.x + 6 : b.x + b.w - 6, y + b.h * 0.15] : [x + (side === 'l' ? 1 : -1) * b.w * 0.06, Math.min(b.y + b.h - 20, y + b.h * 0.3)];
    out.push({ id: cid(), kind, text: l.text, x, y, tail, size: 21 });
    n++;
  }
  const fx = H.sfx?.[s.id];
  if (fx) out.push({ id: cid(), kind: 'sfx', text: fx, x: b.x + b.w * (n ? 0.7 : 0.5), y: b.y + b.h * 0.78, size: 24, rot: -8 });
  const st = H.stickers?.[s.id];
  return st === 'anger' ? [{ id: cid(), kind: 'anger', pts: [[b.x + b.w * 0.78, b.y + b.h * 0.22]], size: 30 }] : [];
}
function sparkFor(s, b) {
  return CM.hints.spark?.includes(s.id) ? [{ id: cid(), kind: 'spark', pts: [[b.x + b.w * 0.32, b.y + b.h * 0.38], [b.x + b.w * 0.68, b.y + b.h * 0.34]] }] : [];
}
// строка панелей: вертикальные разрезы, у динамичных кадров — наискосок
function rowPolys(x0, x1, y0, y1, n, slant, g) {
  const out = [];
  const W = x1 - x0;
  const cuts = [];
  for (let i = 1; i < n; i++) cuts.push(x0 + (W * i) / n);
  const sl = slant ? Math.min(60, (y1 - y0) * 0.14) : 0;
  for (let i = 0; i < n; i++) {
    const L = i === 0 ? null : cuts[i - 1], R = i === n - 1 ? null : cuts[i];
    const lt = L == null ? x0 : L + sl * (i % 2 ? 1 : -1) + g / 2, lb = L == null ? x0 : L - sl * (i % 2 ? 1 : -1) + g / 2;
    const rt = R == null ? x1 : R + sl * (i % 2 ? -1 : 1) - g / 2, rb = R == null ? x1 : R - sl * (i % 2 ? -1 : 1) - g / 2;
    out.push([[lt, y0], [rt, y0], [rb, y1], [lb, y1]]);
  }
  return out;
}
// кадры для комикса: без вырезанных; кадры с той же картинкой («картинка = кадр N») сливаются в одну панель,
// их реплики переходят в неё
function comicItems() {
  const out = [], byFile = {};
  for (const it of allShots()) {
    const { s, sc } = it;
    if (s.cut || !(shotImg(s) || s.img || s.imgFrom || s.lines?.length || s.frame)) continue;
    const f = shotImg(s);
    const prev = f && byFile[f];
    if (prev && prev.sc.n === sc.n) { prev.s = { ...prev.s, lines: [...(prev.s.lines || []), ...(s.lines || [])] }; continue; }
    const item = { s, sc };
    out.push(item);
    if (f) byFile[f] = item;
  }
  return out;
}
function autoManga() {
  const pages = [];
  const items = comicItems();
  const { w: PW, h: PH, m, g } = MANGA;
  const H = PH - 2 * m;
  let rows = [];
  const flush = () => {
    if (!rows.length) return;
    const need = rows.reduce((a, r) => a + r.h, 0) + g * (rows.length - 1);
    const k = (H - g * (rows.length - 1)) / (need - g * (rows.length - 1));
    const pg = { id: cid(), w: PW, h: PH, panels: [], bubbles: [], marks: [] };
    let y = m;
    rows.forEach((r, ri) => {
      const h = r.h * k;
      const polys = rowPolys(m, PW - m, y, y + h, r.items.length, r.slant, g);
      r.items.forEach(({ s, sc }, i) => {
        const c = cls(s);
        const pn = { id: cid(), shot: s.id, poly: polys[i], crop: { s: c.eyes ? 1.05 : 1, x: 0.5, y: c.eyes ? 0.42 : 0.5 }, fx: c.impact ? (/пике|падает/.test(s.frame || '') ? 'speedv' : c.size === 'close' ? 'focus' : 'speed') : '' };
        pg.panels.push(pn);
        const b = bbox(pn.poly);
        pg.marks.push(...linesToBubbles(s, sc, b, pg.bubbles, i % 2 ? 'r' : 'l'), ...sparkFor(s, b));
      });
      y += h + g;
    });
    pages.push(pg);
    rows = [];
  };
  const used = () => rows.reduce((a, r) => a + r.h + g, 0);
  let i = 0, lastScene = null;
  while (i < items.length) {
    const { s, sc } = items[i];
    const c = cls(s);
    if (lastScene !== null && sc.n !== lastScene && used() > H * 0.55) flush();
    lastScene = sc.n;
    if (c.splash) {
      flush();
      const pg = { id: cid(), w: PW, h: PH, panels: [{ id: cid(), shot: s.id, poly: [[0, 0], [PW, 0], [PW, PH], [0, PH]], crop: { s: 1, x: 0.5, y: 0.5 }, border: false, fx: '' }], bubbles: [], marks: [] };
      pg.marks.push(...linesToBubbles(s, sc, { x: m, y: m, w: PW - 2 * m, h: PH - 2 * m }, pg.bubbles, 'l'));
      pages.push(pg); i++; continue;
    }
    if (c.hero) {
      flush();
      pages.push(heroPage(s, sc, items.slice(i + 1, i + 4).filter((x) => x.sc.n === sc.n)));
      i += 1 + Math.min(3, items.slice(i + 1, i + 4).filter((x) => x.sc.n === sc.n).length);
      continue;
    }
    // собираем строку
    let row;
    if (c.eyes) {
      const grp = [items[i]];
      if (items[i + 1] && cls(items[i + 1].s).eyes && items[i + 1].sc.n === sc.n) grp.push(items[i + 1]);
      row = { items: grp, h: 175, slant: false };
    } else if (c.size === 'wide') row = { items: [items[i]], h: 430, slant: false };
    else {
      const grp = [items[i]];
      const nx = items[i + 1];
      if (nx && nx.sc.n === sc.n) {
        const cn = cls(nx.s);
        if (!cn.splash && !cn.hero && !cn.eyes && cn.size !== 'wide') grp.push(nx);
      }
      row = { items: grp, h: c.size === 'close' ? 330 : 370, slant: grp.some((x) => cls(x.s).impact) };
    }
    if (used() + row.h > H * 1.12) flush();
    rows.push(row);
    i += row.items.length;
  }
  flush();
  return pages;
}
// страница с большой фигурой героя: фигура слева во весь рост, справа обычная раскадровка
function heroPage(s, sc, rest) {
  const { w: PW, h: PH, m, g } = MANGA;
  const pg = { id: cid(), w: PW, h: PH, panels: [], bubbles: [], marks: [], hero: s.id };
  const split = PW * 0.42;
  pg.panels.push({ id: cid(), shot: s.id, poly: [[m, m], [split - g / 2 + 40, m], [split - g / 2 - 40, PH - m], [m, PH - m]], crop: { s: 1, x: 0.5, y: 0.5 }, fx: '', heroSlot: true });
  // правая колонка: левый край идёт наискосок, вдоль края большой панели
  const xAt = (y) => split + g / 2 + 40 - 80 * ((y - m) / (PH - 2 * m));
  const n = Math.max(1, rest.length);
  const hh = (PH - 2 * m - g * (n - 1)) / n;
  rest.forEach((it, i) => {
    const y0 = m + i * (hh + g), y1 = y0 + hh;
    const pn = { id: cid(), shot: it.s.id, poly: [[xAt(y0), y0], [PW - m, y0], [PW - m, y1], [xAt(y1), y1]], crop: { s: 1, x: 0.5, y: 0.5 }, fx: cls(it.s).impact ? 'speed' : '' };
    pg.panels.push(pn);
    pg.marks.push(...linesToBubbles(it.s, it.sc, bbox(pn.poly), pg.bubbles, 'r'), ...sparkFor(it.s, bbox(pn.poly)));
  });
  pg.marks.push(...linesToBubbles(s, sc, bbox(pg.panels[0].poly), pg.bubbles, 'l'));
  const art = 'hero_' + s.id;
  pg.figure = { art, x: split * 0.62, y: m * 0.4, h: PH * 0.96, thr: 28 };
  CM.data.arts ||= {};
  CM.data.arts[art] ||= { versions: [], selected: null, fromShot: s.id, characters: (s.characters || []).filter((c) => !/SWORD|RUKH|Предмет/i.test(c)), prompt: heroPrompt(s) };
  return pg;
}
function heroPrompt(s) {
  const who = (s.characters || []).filter((c) => !/SWORD|RUKH/i.test(c)).map((c) => `[${c}]`).join(' and ') || 'the hero';
  return `full-body figure of ${who} — the same moment as shot ${s.id}: ${s.frame || ''}. Dramatic manga hero pose, full body from head to toe, slight low angle, wind in hair and cloak, isolated on a pure flat white background, no scenery, no ground, no shadow`;
}
function autoWebtoon() {
  const pages = [];
  const items = comicItems();
  const W = WEB.w;
  let pg = null, y = 0, lastScene = null;
  const newPage = () => { if (pg) { pg.h = Math.max(y + 80, 400); pages.push(pg); } pg = { id: cid(), w: W, h: WEB.pageH, panels: [], bubbles: [], marks: [], webtoon: true }; y = 80; };
  newPage();
  for (const { s, sc } of items) {
    const c = cls(s);
    if (lastScene !== null && sc.n !== lastScene) y += WEB.sceneGap - WEB.gap;
    lastScene = sc.n;
    const h = c.eyes ? 260 : c.splash ? 1100 : c.size === 'close' ? 900 : c.size === 'wide' ? 520 : 640;
    if (y + h > WEB.pageH - 100) newPage();
    const capSpace = CM.hints.captions?.[s.id] ? 90 : 0;
    y += capSpace;
    const sl = c.impact ? 50 : 0;
    const poly = [[0, y + sl], [W, y], [W, y + h], [0, y + h - sl]];
    const pn = { id: cid(), shot: s.id, poly, crop: { s: 1, x: 0.5, y: c.eyes ? 0.42 : 0.5 }, border: false, fx: c.impact ? (c.size === 'close' ? 'focus' : 'speed') : '' };
    pg.panels.push(pn);
    const b = bbox(poly);
    // в вебтуне подпись — в белом поле над кадром, реплики — по краю кадра
    pg.marks.push(...linesToBubbles(s, sc, { x: b.x + 40, y: b.y - capSpace + 10, w: b.w - 80, h: b.h * 0.9 + capSpace }, pg.bubbles, 'l'), ...sparkFor(s, b));
    y += h + WEB.gap;
  }
  if (pg.panels.length) { pg.h = y + 80; pages.push(pg); }
  // лента читается с телефона — буквы крупнее
  for (const p of pages) for (const b of p.bubbles) b.size = Math.round((b.size || 21) * 1.25);
  return pages;
}

// ---------- загрузка, сохранение ----------
async function loadComic() {
  const r = await GET('/api/comic?ep=' + encodeURIComponent(S.ep.id));
  CM.ep = S.ep.id;
  CM.hints = r.hints || {};
  CM.data = r.comic || { format: 'manga', pages: [], arts: {} };
  CM.data.arts ||= {};
  CM.page = Math.min(CM.page, Math.max(0, CM.data.pages.length - 1));
}
function saveComic(now) {
  clearTimeout(CM.timer);
  const go = async () => {
    const r = await POST('/api/comic/save', { ep: CM.ep, comic: CM.data }).catch((e) => toast('Комикс не сохранился: ' + e.message, 8000));
    if (r?.arts) for (const [id, a] of Object.entries(r.arts)) if (CM.data.arts[id]) Object.assign(CM.data.arts[id], { versions: a.versions, selected: a.selected });
  };
  if (now) return go();
  CM.timer = setTimeout(go, 700);
}
async function preload(pages) {
  const files = new Set();
  for (const pg of pages) {
    for (const pn of pg.panels) { const f = shotImg(shotById(pn.shot)); if (f) files.add(f); }
    const art = pg.figure && CM.data.arts?.[pg.figure.art];
    const ff = art && art.selected != null && art.versions?.[art.selected]?.file;
    if (ff) { files.add(ff); await cutout(ff, pg.figure.thr ?? 28); }
  }
  await Promise.all([...files].filter((f) => !CM.dim[f]).map((f) => new Promise((ok) => {
    const im = new Image();
    im.onload = () => { CM.dim[f] = { w: im.naturalWidth, h: im.naturalHeight }; ok(); };
    im.onerror = ok;
    im.src = fileUrl(f);
  })));
}
// Вырезаем фигуру с белого фона: заливка от краёв по светлым пикселям (контур героя её останавливает)
function cutout(file, thr) {
  const key = file + '|' + thr;
  if (CM.cut[key]) return Promise.resolve(CM.cut[key]);
  return new Promise((ok) => {
    const im = new Image();
    im.onload = () => {
      CM.dim[file] = { w: im.naturalWidth, h: im.naturalHeight };
      const c = document.createElement('canvas');
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      const x = c.getContext('2d');
      x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height), a = d.data, W = c.width, Hh = c.height;
      const bg = new Uint8Array(W * Hh);
      const light = (p) => { const r = a[p * 4], g = a[p * 4 + 1], b = a[p * 4 + 2]; return r > 255 - thr && g > 255 - thr && b > 255 - thr && Math.max(r, g, b) - Math.min(r, g, b) < 26; };
      const st = [];
      for (let i = 0; i < W; i++) st.push(i, (Hh - 1) * W + i);
      for (let j = 0; j < Hh; j++) st.push(j * W, j * W + W - 1);
      while (st.length) {
        const p = st.pop();
        if (bg[p] || !light(p)) continue;
        bg[p] = 1;
        const px = p % W;
        if (px > 0) st.push(p - 1);
        if (px < W - 1) st.push(p + 1);
        if (p >= W) st.push(p - W);
        if (p < W * (Hh - 1)) st.push(p + W);
      }
      for (let p = 0; p < W * Hh; p++) {
        if (bg[p]) { a[p * 4 + 3] = 0; continue; }
        // мягкий край: светлые пиксели рядом с фоном — полупрозрачные
        const px = p % W;
        if ((px > 0 && bg[p - 1]) || (px < W - 1 && bg[p + 1]) || (p >= W && bg[p - W]) || (p < W * (Hh - 1) && bg[p + W])) {
          const br = (a[p * 4] + a[p * 4 + 1] + a[p * 4 + 2]) / 3;
          if (br > 200) a[p * 4 + 3] = Math.max(0, Math.min(255, (255 - br) * 4));
        }
      }
      x.putImageData(d, 0, 0);
      CM.cut[key] = c.toDataURL('image/png');
      ok(CM.cut[key]);
    };
    im.onerror = () => ok(null);
    im.src = fileUrl(file);
  });
}

// ---------- интерфейс ----------
async function renderComic() {
  const main = $('#main');
  if (!CM.data || CM.ep !== S.ep.id) {
    main.replaceChildren(h('div', { class: 'muted' }, 'Загружаю комикс…'));
    await loadComic();
    if (S.view !== 'comic') return;
  }
  const D = CM.data;
  const pg = D.pages[CM.page];
  await preload(pg ? [pg] : []);
  if (S.view !== 'comic') return;
  const tools = h('div', { class: 'bar' },
    h('div', { class: 'chips' }, ...[['manga', 'Манга (страницы)'], ['webtoon', 'Вебтун (лента)']].map(([k, t]) =>
      h('button', { class: 'chip' + ((D.format || 'manga') === k ? ' on' : ''), onclick: () => { if (D.format !== k) { D.format = k; if (!D.pages.length || confirm('Пересобрать комикс в этом формате? Текущая раскладка заменится.')) autoBuild(); else renderComic(); } } }, t))),
    h('button', { class: D.pages.length ? '' : 'primary', onclick: () => { if (!D.pages.length || confirm('Собрать комикс заново? Все страницы разложатся автоматически, ручные правки страниц пропадут (фигуры героев останутся).')) autoBuild(); } }, D.pages.length ? '↻ Собрать заново' : '✨ Собрать комикс автоматически'),
    h('span', { class: 'grow' }),
    pg ? h('span', { class: 'muted' }, 'Добавить:') : null,
    pg ? h('button', { onclick: () => addBubble('speak') }, '💬 реплику') : null,
    pg ? h('button', { onclick: () => addBubble('caption') }, '▭ подпись') : null,
    pg ? h('button', { onclick: () => addBubble('sfx') }, '💥 звук') : null,
    pg ? h('button', { onclick: () => addMark('spark') }, '⚡ искру взглядов') : null,
    pg ? h('button', { onclick: () => addMark('anger') }, '💢') : null,
    D.pages.length ? h('button', { class: 'primary', onclick: exportComic }, '⬇ Сохранить страницы PNG') : null);
  if (!D.pages.length) {
    main.replaceChildren(h('div', { class: 'comic' }, tools, h('div', { class: 'comic-empty' },
      h('h2', {}, 'Комикс из кадров серии'),
      h('p', {}, 'Студия разложит нарисованные кадры по страницам, как в манге: общие планы — широкими панелями, крупные — парами, «взгляды» — узкими полосами, удары — наискосок и с линиями скорости. Реплики из книги встанут пузырями, пояснения — подписями, звуки — крупными буквами.'),
      h('p', {}, 'Ключевые моменты получают отдельную страницу на весь лист или страницу с большой фигурой героя во весь рост, а рядом обычная раскадровка. Фигуру Кодекс рисует на белом фоне, студия вырезает её сама.'),
      h('p', { class: 'muted' }, 'Потом всё можно двигать мышкой: пузыри, хвосты, кадр внутри панели (колёсико — приблизить). Формат «Вебтун» — длинная вертикальная лента для телефона.'))));
    return;
  }
  const thumbs = h('div', { class: 'comic-pages' }, ...D.pages.map((p, i) => {
    const t = h('div', { class: 'cthumb' + (i === CM.page ? ' on' : ''), onclick: () => { CM.page = i; CM.sel = null; renderComic(); } });
    t.innerHTML = pageSVG(p, { width: 120 });
    t.append(h('span', {}, String(i + 1)));
    return t;
  }));
  const stage = h('div', { class: 'comic-stage' + (pg.webtoon ? ' web' : '') });
  stage.innerHTML = pageSVG(pg, { edit: true, labels: true });
  bindStage(stage, pg);
  const side = h('div', { class: 'comic-side' }, inspector(pg));
  main.replaceChildren(h('div', { class: 'comic' }, tools, h('div', { class: 'comic-body' }, thumbs, stage, side)));
  const cur = thumbs.querySelector('.on');
  if (cur) cur.scrollIntoView({ block: 'nearest' });
}
// художник дорисовал фигуру — подтягиваем её версии, не трогая страницы
async function refreshArts() {
  const r = await GET('/api/comic?ep=' + encodeURIComponent(CM.ep)).catch(() => null);
  for (const [id, a] of Object.entries(r?.comic?.arts || {})) if (CM.data?.arts?.[id]) Object.assign(CM.data.arts[id], { versions: a.versions, selected: a.selected });
  const pg = CM.data?.pages[CM.page];
  if (pg && S.view === 'comic') { await preload([pg]); refresh(pg); }
}
async function autoBuild() {
  const format = CM.data?.format || 'manga';
  await loadComic();
  const arts = CM.data.arts || {};
  CM.data = { format, arts, pages: [] };
  CM.data.pages = CM.data.format === 'webtoon' ? autoWebtoon() : autoManga();
  CM.page = 0; CM.sel = null;
  await saveComic(true);
  toast(`Готово: ${CM.data.pages.length} стр. Всё можно поправить мышкой.`, 6000);
  renderComic();
}
function svgPoint(svg, e) {
  const p = svg.createSVGPoint();
  p.x = e.clientX; p.y = e.clientY;
  return p.matrixTransform(svg.getScreenCTM().inverse());
}
function bindStage(stage, pg) {
  const svg = stage.querySelector('svg');
  let drag = null;
  svg.addEventListener('pointerdown', (e) => {
    const t = e.target.closest('[data-k]');
    if (!t) return;
    const k = t.dataset.k, p = svgPoint(svg, e);
    e.preventDefault();
    svg.setPointerCapture(e.pointerId);
    if (k === 'bubble') { CM.sel = { k: 'bubble', id: t.dataset.id }; const b = pg.bubbles.find((x) => x.id === t.dataset.id); drag = { k, b, p, x: b.x, y: b.y, el: t, tail: b.tail && [...b.tail] }; }
    else if (k === 'tail') { const b = pg.bubbles.find((x) => x.id === t.dataset.id); drag = { k, b, p }; }
    else if (k === 'spark') { const m = pg.marks.find((x) => x.id === t.dataset.id); drag = { k, m, i: +t.dataset.i, p }; }
    else if (k === 'mark') { const m = pg.marks.find((x) => x.id === t.dataset.id); CM.sel = { k: 'mark', id: m.id }; drag = { k, m, p, pts: m.pts.map((q) => [...q]) }; }
    else if (k === 'fig') { CM.sel = { k: 'fig', id: 0 }; drag = { k, p, x: pg.figure.x, y: pg.figure.y }; }
    else if (k === 'panel' || k === 'img') {
      const g = t.closest('[data-k="panel"]');
      const i = +g.dataset.i;
      const pn = pg.panels[i];
      CM.sel = { k: 'panel', id: i };
      const file = shotImg(shotById(pn.shot));
      drag = { k: 'panel', pn, p, crop: { ...(pn.crop || { s: 1, x: 0.5, y: 0.5 }) }, pl: file && imgPlace(pn, file), img: g.querySelector('image') };
    } else if (k === 'bg') { CM.sel = null; }
    drag && (drag.moved = false);
    if (!drag) refresh(pg);
  });
  svg.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = svgPoint(svg, e), dx = p.x - drag.p.x, dy = p.y - drag.p.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
    if (drag.k === 'bubble') { drag.b.x = drag.x + dx; drag.b.y = drag.y + dy; if (drag.tail) drag.b.tail = [drag.tail[0] + dx, drag.tail[1] + dy]; drag.el.setAttribute('transform', `translate(${dx} ${dy})` + (drag.b.rot ? ` rotate(${drag.b.rot} ${drag.x} ${drag.y})` : '')); }
    else if (drag.k === 'tail') { drag.b.tail = [p.x, p.y]; throttle(() => refresh(pg, true)); }
    else if (drag.k === 'spark') { drag.m.pts[drag.i] = [p.x, p.y]; throttle(() => refresh(pg, true)); }
    else if (drag.k === 'mark') { drag.m.pts = drag.pts.map((q) => [q[0] + dx, q[1] + dy]); throttle(() => refresh(pg, true)); }
    else if (drag.k === 'fig') { pg.figure.x = drag.x + dx; pg.figure.y = drag.y + dy; throttle(() => refresh(pg, true)); }
    else if (drag.k === 'panel' && drag.pl && drag.img) {
      const { pl } = drag;
      const c = drag.pn.crop = { ...drag.crop };
      if (pl.b.w - pl.w) c.x = Math.min(1, Math.max(0, drag.crop.x + dx / (pl.b.w - pl.w)));
      if (pl.b.h - pl.h) c.y = Math.min(1, Math.max(0, drag.crop.y + dy / (pl.b.h - pl.h)));
      const np = imgPlace(drag.pn, shotImg(shotById(drag.pn.shot)));
      drag.img.setAttribute('x', np.x); drag.img.setAttribute('y', np.y);
    }
  });
  const end = () => { if (!drag) return; const moved = drag.moved; drag = null; if (moved) saveComic(); refresh(pg); };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('dblclick', (e) => {
    const t = e.target.closest('[data-k="bubble"]');
    if (t) setTimeout(() => $('.comic-side textarea')?.focus(), 50);
  });
  svg.addEventListener('wheel', (e) => {
    const g = e.target.closest('[data-k="panel"]');
    if (!g) return;
    e.preventDefault();
    const pn = pg.panels[+g.dataset.i];
    pn.crop = { s: 1, x: 0.5, y: 0.5, ...pn.crop };
    pn.crop.s = Math.min(4, Math.max(1, pn.crop.s * (e.deltaY < 0 ? 1.08 : 1 / 1.08)));
    CM.sel = { k: 'panel', id: +g.dataset.i };
    throttle(() => refresh(pg, true));
    saveComic();
  }, { passive: false });
}
const throttle = (fn) => { if (throttle.q) return; throttle.q = true; requestAnimationFrame(() => { throttle.q = false; fn(); }); };
function refresh(pg, stageOnly) {
  const stage = $('.comic-stage');
  if (!stage) return;
  stage.innerHTML = pageSVG(pg, { edit: true, labels: true });
  bindStage(stage, pg);
  if (!stageOnly) { $('.comic-side').replaceChildren(inspector(pg)); const t = $$('.cthumb')[CM.page]; if (t) { t.innerHTML = pageSVG(pg, { width: 120 }); t.append(h('span', {}, String(CM.page + 1))); } }
}
const $$ = (s) => [...document.querySelectorAll(s)];
function addBubble(kind) {
  const pg = CM.data.pages[CM.page];
  const b = { id: cid(), kind, text: kind === 'sfx' ? 'БАХ!' : kind === 'caption' ? 'Подпись' : 'Реплика', x: pg.w / 2, y: Math.min(pg.h / 2, 300), size: kind === 'sfx' ? 26 : 21, tail: kind === 'speak' ? [pg.w / 2 + 40, Math.min(pg.h / 2, 300) + 110] : null, rot: kind === 'sfx' ? -8 : 0 };
  pg.bubbles.push(b);
  CM.sel = { k: 'bubble', id: b.id };
  saveComic(); refresh(pg);
  setTimeout(() => { const ta = $('.comic-side textarea'); ta?.focus(); ta?.select(); }, 50);
}
function addMark(kind) {
  const pg = CM.data.pages[CM.page];
  const m = kind === 'anger' ? { id: cid(), kind, pts: [[pg.w * 0.7, 200]], size: 32 } : { id: cid(), kind: 'spark', pts: [[pg.w * 0.35, 260], [pg.w * 0.65, 240]] };
  (pg.marks ||= []).push(m);
  CM.sel = { k: 'mark', id: m.id };
  saveComic(); refresh(pg);
}
function inspector(pg) {
  const D = CM.data;
  const sel = CM.sel;
  const box = [];
  const pageOps = h('div', { class: 'actions' },
    h('button', { disabled: CM.page === 0, onclick: () => movePage(-1), title: 'Страницу раньше' }, '↑'),
    h('button', { disabled: CM.page === D.pages.length - 1, onclick: () => movePage(1), title: 'Страницу позже' }, '↓'),
    h('button', { onclick: () => { if (confirm('Удалить эту страницу?')) { D.pages.splice(CM.page, 1); CM.page = Math.max(0, CM.page - 1); CM.sel = null; saveComic(); renderComic(); } } }, 'Удалить стр.'));
  box.push(h('h3', {}, `Страница ${CM.page + 1} из ${D.pages.length}`), pageOps);
  if (!sel) {
    box.push(h('p', { class: 'muted' }, 'Нажми на панель, пузырь или фигуру, чтобы поправить. Тяни мышкой: пузыри — двигать, кадр внутри панели — сдвинуть, колёсико над панелью — приблизить. Красная точка у пузыря — хвост.'));
    if (pg.figure) box.push(figureBox(pg));
  } else if (sel.k === 'panel') {
    const pn = pg.panels[sel.id];
    const opts = allShots().filter(({ s }) => shotImg(s) || s.id === pn.shot).map(({ s }) => h('option', { value: s.id, selected: s.id === pn.shot }, `${s.id} — ${(s.frame || '').slice(0, 40)}`));
    box.push(h('h3', {}, `Панель · кадр ${pn.shot}`),
      h('div', { class: 'field' }, h('label', {}, 'Какой кадр в панели'), h('select', { onchange: (e) => { pn.shot = e.target.value; pn.crop = { s: 1, x: 0.5, y: 0.5 }; saveComic(); preload([pg]).then(() => refresh(pg)); } }, ...opts)),
      h('div', { class: 'field' }, h('label', {}, 'Эффект'), h('select', { onchange: (e) => { pn.fx = e.target.value; saveComic(); refresh(pg); } }, ...Object.entries(FX).map(([k, t]) => h('option', { value: k, selected: (pn.fx || '') === k }, t)))),
      h('div', { class: 'field' }, h('label', {}, 'Приближение'), h('input', { type: 'range', min: 1, max: 4, step: 0.05, value: pn.crop?.s || 1, oninput: (e) => { pn.crop = { s: 1, x: 0.5, y: 0.5, ...pn.crop, s: +e.target.value }; throttle(() => refresh(pg, true)); saveComic(); } })),
      h('div', { class: 'actions' },
        h('button', { onclick: () => { pn.crop = { s: 1, x: 0.5, y: 0.5 }; saveComic(); refresh(pg); } }, 'Кадр по центру'),
        h('button', { onclick: () => { pn.border = pn.border === false; saveComic(); refresh(pg); } }, pn.border === false ? 'Вернуть рамку' : 'Без рамки'),
        h('button', { onclick: () => select({ kind: 'shot', ep: S.ep.id, id: pn.shot }) }, 'Открыть кадр'),
        !pg.figure ? h('button', { onclick: () => makeHero(pg, sel.id) }, '🧍 Сделать героем страницы') : null));
    if (pg.figure) box.push(figureBox(pg));
  } else if (sel.k === 'bubble') {
    const b = pg.bubbles.find((x) => x.id === sel.id);
    if (!b) { CM.sel = null; return inspector(pg); }
    box.push(h('h3', {}, BUBBLES[b.kind] || 'Пузырь'),
      h('div', { class: 'field' }, h('label', {}, 'Текст'), h('textarea', { rows: 3, oninput: (e) => { b.text = e.target.value; throttle(() => refresh(pg, true)); saveComic(); } }, b.text)),
      h('div', { class: 'field' }, h('label', {}, 'Вид'), h('div', { class: 'bkinds' }, ...Object.entries(BUBBLES).map(([k, t]) => h('button', { class: b.kind === k ? 'on' : '', onclick: () => {
        b.kind = k;
        if (!/caption|sfx/.test(k) && !b.tail) b.tail = [b.x + 30, b.y + 100];
        saveComic(); refresh(pg);
      } }, t)))),
      h('div', { class: 'field' }, h('label', {}, 'Размер шрифта'), h('input', { type: 'range', min: 12, max: 48, value: b.size || 21, oninput: (e) => { b.size = +e.target.value; throttle(() => refresh(pg, true)); saveComic(); } })),
      b.kind === 'sfx' ? h('div', { class: 'field' }, h('label', {}, 'Наклон'), h('input', { type: 'range', min: -40, max: 40, value: b.rot || 0, oninput: (e) => { b.rot = +e.target.value; throttle(() => refresh(pg, true)); saveComic(); } })) : null,
      h('div', { class: 'actions' },
        !/caption|sfx/.test(b.kind) ? h('button', { onclick: () => { b.tail = b.tail ? null : [b.x + 30, b.y + 100]; saveComic(); refresh(pg); } }, b.tail ? 'Убрать хвост' : 'Добавить хвост') : null,
        h('button', { onclick: () => { pg.bubbles = pg.bubbles.filter((x) => x !== b); CM.sel = null; saveComic(); refresh(pg); } }, 'Удалить')));
  } else if (sel.k === 'mark') {
    const m = pg.marks.find((x) => x.id === sel.id);
    box.push(h('h3', {}, m?.kind === 'anger' ? 'Значок злости' : 'Искра взглядов'),
      h('p', { class: 'muted' }, m?.kind === 'anger' ? 'Тяни мышкой, чтобы переставить.' : 'Две красные точки — глаза героев. Поставь их на взгляды, искра встанет посередине.'),
      h('button', { onclick: () => { pg.marks = pg.marks.filter((x) => x !== m); CM.sel = null; saveComic(); refresh(pg); } }, 'Удалить'));
  } else if (sel.k === 'fig') box.push(figureBox(pg));
  return h('div', {}, ...box);
}
function figureBox(pg) {
  const f = pg.figure;
  const art = CM.data.arts[f.art] || {};
  const run = S.jobs.find((j) => j.ref?.kind === 'comicart' && j.ref.id === f.art && ['queued', 'running'].includes(j.status));
  const promptTa = h('textarea', { rows: 4, oninput: (e) => { art.prompt = e.target.value; saveComic(); } }, art.prompt || '');
  return h('div', { class: 'figbox' },
    h('h3', {}, '🧍 Фигура героя'),
    h('p', { class: 'muted' }, 'Большая фигура во весь рост поверх страницы. Кодекс рисует её на белом фоне, студия вырезает и обводит белым контуром.'),
    h('div', { class: 'field' }, h('label', {}, 'Что нарисовать'), promptTa),
    h('div', { class: 'actions' },
      h('button', { class: 'primary', disabled: !!run, onclick: async () => {
        await POST('/api/comic/art', { ep: CM.ep, id: f.art, prompt: promptTa.value, characters: art.characters, fromShot: art.fromShot });
        await POST('/api/generate', { ref: { kind: 'comicart', ep: CM.ep, id: f.art }, opts: { generator: gen() } });
        toast('Фигура отправлена художнику'); pollJobs(true);
        setTimeout(() => refresh(pg), 300);
      } }, run ? 'Рисует…' : art.versions?.length ? 'Нарисовать ещё вариант' : 'Нарисовать фигуру'),
      h('button', { onclick: () => { delete pg.figure; pg.panels.forEach((p) => delete p.heroSlot); CM.sel = null; saveComic(); refresh(pg); } }, 'Убрать фигуру')),
    art.versions?.length ? h('div', { class: 'versions' }, ...art.versions.map((v, i) => h('button', { class: i === art.selected ? 'on' : '', onclick: async () => {
      await POST('/api/update', { ref: { kind: 'comicart', ep: CM.ep, id: f.art }, patch: { selected: i } }).catch(() => {});
      art.selected = i; await preload([pg]); refresh(pg);
    } }, h('img', { src: fileUrl(v.file) }), h('span', {}, 'v' + (i + 1))))) : null,
    h('div', { class: 'field' }, h('label', {}, 'Высота фигуры'), h('input', { type: 'range', min: 300, max: pg.h * 1.1, value: f.h, oninput: (e) => { f.h = +e.target.value; throttle(() => refresh(pg, true)); saveComic(); } })),
    h('div', { class: 'field' }, h('label', {}, 'Сколько белого убирать'), h('input', { type: 'range', min: 8, max: 60, value: f.thr ?? 28, onchange: async (e) => { f.thr = +e.target.value; await preload([pg]); refresh(pg); saveComic(); } })),
    h('p', { class: 'muted' }, 'Фигуру можно тянуть мышкой. Пока её нет, на её месте стоит кадр — нарисуй фигуру, и она встанет поверх.'));
}
function makeHero(pg, i) {
  const pn = pg.panels[i];
  const s = shotById(pn.shot);
  const art = 'hero_' + s.id;
  CM.data.arts[art] ||= { versions: [], selected: null, fromShot: s.id, characters: (s.characters || []).filter((c) => !/SWORD|RUKH/i.test(c)), prompt: heroPrompt(s) };
  const b = bbox(pn.poly);
  pg.figure = { art, x: b.x + b.w / 2, y: Math.max(0, b.y - 60), h: Math.min(pg.h * 0.96, Math.max(700, b.h * 1.4)), thr: 28 };
  pn.heroSlot = true;
  CM.sel = { k: 'fig', id: 0 };
  saveComic(); refresh(pg);
}
function movePage(d) {
  const P2 = CM.data.pages, i = CM.page, j = i + d;
  [P2[i], P2[j]] = [P2[j], P2[i]];
  CM.page = j; saveComic(); renderComic();
}
// ---------- экспорт ----------
async function toDataURL(file) {
  CM.data64 ||= {};
  if (CM.data64[file]) return CM.data64[file];
  const blob = await (await fetch(fileUrl(file))).blob();
  return (CM.data64[file] = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); }));
}
async function exportComic() {
  const D = CM.data;
  toast('Собираю страницы…', 60000);
  await preload(D.pages);
  const files = new Set();
  for (const pg of D.pages) for (const pn of pg.panels) { const f = shotImg(shotById(pn.shot)); if (f) files.add(f); }
  const urls = {};
  for (const f of files) urls[f] = await toDataURL(f);
  const scale = D.format === 'webtoon' ? 1.35 : 2.4;
  let dir = '';
  for (let i = 0; i < D.pages.length; i++) {
    const pg = D.pages[i];
    const svg = pageSVG(pg, { src: (f) => urls[f], width: pg.w * scale });
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    await new Promise((ok, no) => { img.onload = ok; img.onerror = () => no(new Error('страница ' + (i + 1) + ' не отрисовалась')); img.src = url; });
    const c = document.createElement('canvas');
    c.width = Math.round(pg.w * scale); c.height = Math.round(pg.h * scale);
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/png'));
    const name = (D.format === 'webtoon' ? 'вебтун_' : 'страница_') + String(i + 1).padStart(2, '0');
    const r = await fetch(`/api/comic/export?ep=${encodeURIComponent(CM.ep)}&name=${encodeURIComponent(name)}`, { method: 'POST', body: blob }).then((r) => r.json());
    if (r.error) throw new Error(r.error);
    dir = r.dir;
    toast(`Сохраняю: ${i + 1} из ${D.pages.length}`, 60000);
  }
  toast(`Готово: ${D.pages.length} стр. в ${dir}`, 8000);
  POST('/api/open', { path: dir }).catch(() => {});
}
