// Модель данных.
//   base     — план из trip.json (из приложения или импортированный)
//   overlay  — локальные правки поверх плана: { patches: { 'item:ID': {...} } }
//              Обновление trip.json не стирает правки: они накладываются заново.
//   effective = base + overlay — то, что видно на экране.
import * as db from './db.js';
import { clone, uid, tripTs, now, setTz, sha256 } from './util.js';

const listeners = new Set();
export const onChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));
const emit = (what) => listeners.forEach((fn) => fn(what));

export const S = {
  base: null,
  overlay: { patches: {} },
  checks: {},
  settings: {},
  docs: [],
  baseInfo: {},
};
let cache = null;

const DEFAULT_SETTINGS = { nav: 'auto', theme: 'auto', pinHash: null, unlocked: false, nowOverride: '' };

export async function load() {
  const [base, overlay, checks, settings, baseInfo, docs] = await Promise.all([
    db.kvGet('base'), db.kvGet('overlay'), db.kvGet('checks'), db.kvGet('settings'), db.kvGet('baseInfo'), db.docList(),
  ]);
  S.base = base || null;
  S.overlay = overlay || { patches: {} };
  S.checks = checks || {};
  S.settings = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  S.baseInfo = baseInfo || {};
  S.docs = docs || [];
  // Встроенный план: при первом запуске — берём его; при выходе новой ревизии — обновляем основу.
  let bundled = null;
  try {
    const r = await fetch('data/trip.json', { cache: 'no-cache' });
    if (r.ok) bundled = await r.json();
  } catch (e) {
    /* офлайн без кэша — работаем с тем, что сохранено */
  }
  let updated = false;
  if (bundled && (!S.base || (bundled.revision || 0) > (S.base.revision || 0))) {
    updated = !!S.base;
    S.base = bundled;
    S.baseInfo = { source: 'bundled', at: Date.now() };
    await Promise.all([db.kvSet('base', S.base), db.kvSet('baseInfo', S.baseInfo)]);
  }
  if (!S.base) throw new Error('План поездки не найден. Откройте приложение один раз с интернетом.');
  setTz(S.base.tz);
  cache = null;
  return { updated, revision: S.base.revision };
}

// ---------- Сборка effective ----------
function patched(key, obj) {
  const p = S.overlay.patches[key];
  if (!p) return obj;
  if (p._deleted) return null;
  const out = { ...obj, ...p };
  out._local = true;
  return out;
}
function sortItems(items) {
  let last = '00:00';
  return items
    .map((it, i) => {
      if (it.time) last = it.time;
      return { it, k: (it.time || last) + String(i).padStart(4, '0') };
    })
    .sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0))
    .map((x) => x.it);
}

export function trip() {
  if (cache) return cache;
  const b = clone(S.base);
  const P = S.overlay.patches;
  const t = { ...b };
  t.cities = b.cities.map((c) => patched('city:' + c.id, c)).filter(Boolean);
  t.segments = b.segments.map((s) => patched('seg:' + s.id, s)).filter(Boolean);
  const days = new Map();
  for (const d of b.days) {
    const dd = patched('day:' + d.date, d) || d;
    dd.items = d.items.map((it) => patched('item:' + it.id, it)).filter(Boolean);
    days.set(d.date, dd);
  }
  t.reminders = (b.reminders || []).map((r) => patched('rem:' + r.id, r)).filter(Boolean);
  // Если новый пункт уже «впечатан» в trip.json (после экспорта/обновления) — второй раз не добавляем.
  const baseIds = new Set([...b.days.flatMap((d) => d.items.map((i) => 'item:' + i.id)), ...(b.reminders || []).map((r) => 'rem:' + r.id)]);
  for (const [key, p] of Object.entries(P)) {
    if (!p._new || p._deleted || baseIds.has(key)) continue;
    const [kind, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
    const obj = { ...p, id, _local: true };
    if (kind === 'item') {
      if (!days.has(p._day)) days.set(p._day, { date: p._day, title: '', items: [] });
      days.get(p._day).items.push(obj);
    } else if (kind === 'rem') t.reminders.push(obj);
  }
  t.days = [...days.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const d of t.days) d.items = sortItems(d.items);
  // индексы
  t.cityById = Object.fromEntries(t.cities.map((c) => [c.id, c]));
  t.segById = Object.fromEntries(t.segments.map((s) => [s.id, s]));
  t.itemById = {};
  for (const d of t.days) for (const it of d.items) t.itemById[it.id] = { ...it, _date: d.date };
  cache = t;
  return t;
}
const invalidate = () => (cache = null);

// ---------- Время пунктов ----------
export const itemTs = (it, date) => (it.time ? tripTs(`${date || it._date}T${it.time}`) : null);
export function reminderTs(r) {
  if (r.at) return tripTs(r.at);
  if (r.rel) {
    const s = trip().segById[r.rel.seg];
    const v = s && s[r.rel.field || 'dep'];
    if (!v) return null;
    return tripTs(v) + (r.rel.min || 0) * 60000;
  }
  return null;
}
/** Пункт относится к невыбранному варианту переезда? */
export function isOptOut(it) {
  if (it.opt == null || !it.seg) return false;
  const s = trip().segById[it.seg];
  return s && s.chosen != null && s.chosen !== it.opt;
}

// ---------- Секреты ----------
export function isRevealed(secret) {
  if (!secret) return true;
  if (secret.stripped) return false;
  if (S.settings.unlocked) return true;
  return secret.revealAt ? now() >= tripTs(secret.revealAt) : false;
}
export const isHidden = (e) => !!(e && e.secret && !isRevealed(e.secret));
const ph = (e, def = 'Сюрприз 🎁') => (e.secret && e.secret.placeholder) || def;

export function maskItem(it) {
  if (!isHidden(it)) return it;
  return { ...it, title: ph(it), details: '', hints: [], place: null, seg: null, tbd: false, _masked: true };
}
export function maskReminder(r) {
  if (!isHidden(r)) return r;
  return { ...r, title: ph(r, 'Секретное напоминание 🎁'), details: '', _masked: true };
}
export function maskCity(c) {
  if (!isHidden(c)) return c;
  return { ...c, hotel: { name: ph(c) }, notes: '', _masked: true };
}
export function maskSeg(s) {
  if (!isHidden(s)) return s;
  return { ...s, toName: ph(s), number: '', coach: '', seat: '', notes: '', _masked: true };
}
/** Документ секретный, если помечен сам или привязан к секретному. */
export function docSecret(d) {
  if (d.secret) return d.secret === true ? { placeholder: 'Секретный документ 🎁' } : d.secret;
  const t = trip();
  for (const l of d.links || []) {
    const e = l.k === 'item' ? t.itemById[l.id] : l.k === 'city' ? t.cityById[l.id] : l.k === 'seg' ? t.segById[l.id] : null;
    if (e && e.secret) return e.secret;
  }
  return null;
}
export const docHidden = (d) => {
  const s = docSecret(d);
  return !!s && !isRevealed(s);
};

export async function setPin(pin) {
  S.settings.pinHash = pin ? await sha256('wt:' + pin) : null;
  await saveSettings();
}
export async function tryUnlock(pin) {
  if (!S.settings.pinHash) return false;
  const ok = (await sha256('wt:' + pin)) === S.settings.pinHash;
  if (ok) {
    S.settings.unlocked = true;
    await saveSettings();
  }
  return ok;
}
export async function lock() {
  S.settings.unlocked = false;
  await saveSettings();
}

// ---------- Изменения ----------
async function saveOverlay(what = 'plan') {
  invalidate();
  await db.kvSet('overlay', S.overlay);
  emit(what);
}
export async function saveSettings() {
  invalidate();
  await db.kvSet('settings', S.settings);
  emit('settings');
}
export async function patch(key, fields) {
  const P = S.overlay.patches;
  P[key] = { ...(P[key] || {}), ...fields };
  await saveOverlay();
}
export async function addItem(date, item) {
  const id = uid('u');
  S.overlay.patches['item:' + id] = { ...item, _new: true, _day: date };
  await saveOverlay();
  return id;
}
export async function addReminder(r) {
  const id = uid('r');
  S.overlay.patches['rem:' + id] = { ...r, _new: true };
  await saveOverlay();
  return id;
}
export async function remove(key) {
  const P = S.overlay.patches;
  if (P[key] && P[key]._new) delete P[key];
  else P[key] = { _deleted: true };
  await saveOverlay();
}
export async function resetLocal(key) {
  delete S.overlay.patches[key];
  await saveOverlay();
}
export const hasLocal = (key) => !!S.overlay.patches[key];
export const localCount = () => Object.keys(S.overlay.patches).length;
export async function resetAllLocal() {
  S.overlay = { patches: {} };
  await saveOverlay();
}

export async function toggleCheck(id) {
  if (S.checks[id]) delete S.checks[id];
  else S.checks[id] = Date.now();
  await db.kvSet('checks', S.checks);
  emit('checks');
}

// ---------- Документы ----------
export async function refreshDocs() {
  S.docs = await db.docList();
  emit('docs');
}
export async function addDoc(file, folder, links = []) {
  const buf = await file.arrayBuffer();
  const meta = {
    id: uid('d'), name: file.name || 'файл', type: file.type || guessType(file.name), size: buf.byteLength,
    folder: folder || guessFolder(file.name), added: Date.now(), links,
  };
  await db.docPut(meta, buf);
  await refreshDocs();
  return meta;
}
export async function updateDoc(id, fields) {
  const m = S.docs.find((d) => d.id === id);
  if (!m) return;
  Object.assign(m, fields);
  await db.docMetaPut(m);
  await refreshDocs();
}
export async function deleteDoc(id) {
  await db.docDelete(id);
  await refreshDocs();
}
export const docsFor = (k, id) => S.docs.filter((d) => (d.links || []).some((l) => l.k === k && l.id === id));

function guessType(name = '') {
  const ext = name.toLowerCase().split('.').pop();
  return { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', heic: 'image/heic', webp: 'image/webp', gif: 'image/gif', pkpass: 'application/vnd.apple.pkpass' }[ext] || 'application/octet-stream';
}
function guessFolder(name = '') {
  const n = name.toLowerCase();
  if (/board|boarding|flight|рейс|посадоч|ryanair|turkish|pegasus|eticket/.test(n)) return 'flights';
  if (/bahn|öbb|obb|regiojet|train|поезд|ticket|db_|nightjet|ice/.test(n)) return 'trains';
  if (/hotel|booking|отель|бронь|reservation|airbnb/.test(n)) return 'hotels';
  if (/phantasia|park|парк/.test(n)) return 'park';
  if (/visa|виза|insurance|страхов|passport|паспорт/.test(n)) return 'visa';
  return 'other';
}

export const FOLDERS = [
  { id: 'flights', icon: '✈️', name: 'Перелёты' },
  { id: 'trains', icon: '🚆', name: 'Поезда' },
  { id: 'hotels', icon: '🏨', name: 'Отели' },
  { id: 'park', icon: '🎢', name: 'Парк' },
  { id: 'visa', icon: '🛂', name: 'Визы и страховки' },
  { id: 'other', icon: '📎', name: 'Прочее' },
];

// ---------- Экспорт / импорт ----------
/** Копия для Ани: всё секретное заменено заглушками, секретных файлов нет. */
function strippedPlan() {
  const t = trip();
  const base = clone(S.base);
  const overlay = clone(S.overlay);
  const P = overlay.patches;
  const strip = (secret) => ({ placeholder: secret.placeholder, revealAt: secret.revealAt, stripped: true });
  const maskFields = {
    item: (it) => ({ title: ph(it), details: '', hints: [], place: null, seg: null, tbd: false, secret: strip(it.secret) }),
    rem: (r) => ({ title: ph(r, 'Секретное напоминание 🎁'), details: '', secret: strip(r.secret) }),
    city: (c) => ({ hotel: { name: ph(c) }, notes: '', secret: strip(c.secret) }),
    seg: (s) => ({ toName: ph(s), number: '', coach: '', seat: '', notes: '', secret: strip(s.secret) }),
  };
  const apply = (kind, id, eff) => {
    if (!eff || !eff.secret) return;
    const key = `${kind}:${id}`;
    const m = maskFields[kind](eff);
    if (P[key] && P[key]._new) P[key] = { _new: true, _day: P[key]._day, time: P[key].time, type: P[key].type, at: P[key].at, rel: P[key].rel, ...m };
    else P[key] = { ...(P[key] || {}), ...m };
    // и в основе тоже, чтобы ничего не утекло через base
    const list = kind === 'item' ? base.days.flatMap((d) => d.items) : kind === 'rem' ? base.reminders : kind === 'city' ? base.cities : base.segments;
    const orig = list.find((x) => x.id === id);
    if (orig) Object.assign(orig, m);
  };
  for (const d of t.days) for (const it of d.items) apply('item', it.id, it);
  for (const r of t.reminders) apply('rem', r.id, r);
  for (const c of t.cities) apply('city', c.id, c);
  for (const s of t.segments) apply('seg', s.id, s);
  return { base, overlay };
}

export async function exportZip({ withSecrets, withDocs = true }) {
  const { zipSync, strToU8 } = await import('../vendor/fflate/fflate.mjs');
  const plan = withSecrets ? { base: S.base, overlay: S.overlay } : strippedPlan();
  const docs = withDocs ? S.docs.filter((d) => withSecrets || !docSecret(d)) : [];
  const files = {
    'manifest.json': strToU8(JSON.stringify({ app: 'winter-trip', format: 1, created: new Date().toISOString(), withSecrets, revision: S.base.revision, docs: docs.length }, null, 1)),
    'trip-base.json': strToU8(JSON.stringify(plan.base)),
    'overlay.json': strToU8(JSON.stringify(plan.overlay)),
    'checks.json': strToU8(JSON.stringify(S.checks)),
    'docs/index.json': strToU8(JSON.stringify(docs)),
  };
  if (withSecrets) files['secret-settings.json'] = strToU8(JSON.stringify({ pinHash: S.settings.pinHash }));
  for (const d of docs) {
    const data = await db.docData(d.id);
    if (data) files['docs/' + d.id] = [new Uint8Array(data), { level: 0 }];
  }
  const zipped = zipSync(files, { level: 6 });
  return new Blob([zipped], { type: 'application/zip' });
}

export async function readZip(file) {
  const { unzipSync, strFromU8 } = await import('../vendor/fflate/fflate.mjs');
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const j = (n) => (files[n] ? JSON.parse(strFromU8(files[n])) : null);
  const manifest = j('manifest.json');
  if (!manifest || manifest.app !== 'winter-trip') throw new Error('Это не файл экспорта поездки');
  return { manifest, base: j('trip-base.json'), overlay: j('overlay.json'), checks: j('checks.json'), docs: j('docs/index.json') || [], secret: j('secret-settings.json'), files };
}

/** Пакет от Claude: только добавляет файлы и правки, ничего на телефоне не заменяет. */
async function applyPack(z) {
  const P = S.overlay.patches;
  for (const [key, patch] of Object.entries((z.overlay && z.overlay.patches) || {})) P[key] = { ...(P[key] || {}), ...patch };
  await db.kvSet('overlay', S.overlay);
  for (const d of z.docs) {
    const bytes = z.files['docs/' + d.id];
    if (!bytes) continue;
    await db.docPut({ ...d, added: d.added || Date.now() }, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  }
  invalidate();
  S.docs = await db.docList();
  emit('all');
}

export async function applyZip(z, { replaceDocs = false } = {}) {
  if (z.manifest && z.manifest.kind === 'pack') return applyPack(z);
  if (z.base) {
    S.base = z.base;
    S.baseInfo = { source: 'import', at: Date.now() };
    await db.kvSet('base', S.base);
    await db.kvSet('baseInfo', S.baseInfo);
  }
  S.overlay = z.overlay || { patches: {} };
  S.checks = { ...(z.checks || {}) };
  await db.kvSet('overlay', S.overlay);
  await db.kvSet('checks', S.checks);
  if (z.secret && z.secret.pinHash) {
    S.settings.pinHash = z.secret.pinHash;
    await db.kvSet('settings', S.settings);
  }
  if (replaceDocs) await db.docClearAll();
  for (const d of z.docs) {
    const bytes = z.files['docs/' + d.id];
    if (!bytes) continue;
    await db.docPut(d, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  }
  setTz(S.base.tz);
  invalidate();
  S.docs = await db.docList();
  emit('all');
}

/** Текущий план одним trip.json (для пересылки и правки). Секретное — по выбору. */
export function exportTripJson(withSecrets) {
  const src = withSecrets ? { base: S.base, overlay: S.overlay } : strippedPlan();
  const save = { base: S.base, overlay: S.overlay };
  S.base = src.base;
  S.overlay = src.overlay;
  invalidate();
  const t = trip();
  S.base = save.base;
  S.overlay = save.overlay;
  invalidate();
  const clean = (o) => {
    const c = { ...o };
    for (const k of Object.keys(c)) if (k.startsWith('_')) delete c[k];
    return c;
  };
  const out = {
    ...Object.fromEntries(Object.entries(S.base).filter(([k]) => !['cities', 'segments', 'days', 'reminders'].includes(k))),
    revision: (S.base.revision || 0) + 1,
    cities: t.cities.map(clean),
    segments: t.segments.map(clean),
    days: t.days.map((d) => ({ ...clean(d), items: d.items.map(clean) })),
    reminders: t.reminders.map(clean),
  };
  return JSON.stringify(out, null, 2);
}

export async function importTripJson(text, keepLocal) {
  const t = JSON.parse(text);
  if (!t.days || !t.cities || !t.segments) throw new Error('В файле нет days / cities / segments');
  S.base = t;
  S.baseInfo = { source: 'import', at: Date.now() };
  await db.kvSet('base', S.base);
  await db.kvSet('baseInfo', S.baseInfo);
  if (!keepLocal) S.overlay = { patches: {} };
  await db.kvSet('overlay', S.overlay);
  setTz(t.tz);
  invalidate();
  emit('all');
}

export const nowTs = now;
