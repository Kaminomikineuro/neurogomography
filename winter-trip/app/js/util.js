// Мелкие помощники: DOM, даты, время поездки.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** h('div.card', {onclick}, child, 'text', [children]) — простой конструктор DOM. */
export function h(tag, attrs, ...children) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
    children.unshift(attrs);
    attrs = null;
  }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && k !== 'list' && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}
function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export const uid = (p = 'u') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
export const isTbd = (s) => typeof s === 'string' && /\[(уточнить|выбрать|решаем)[^\]]*\]/i.test(s);

// ---------- Время ----------
// Все времена поездки — местное время (CET, +01:00; зимой у всех четырёх стран одно время).
let TZ = '+01:00';
export const setTz = (tz) => (TZ = tz || '+01:00');
const tzMinutes = () => {
  const m = /([+-])(\d\d):?(\d\d)/.exec(TZ);
  return m ? (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +m[3]) : 60;
};

/** "2026-12-23T17:00" (время поездки) → ms. Строки с явным смещением/Z тоже понимает. */
export function tripTs(local) {
  if (!local) return null;
  if (/[zZ]|[+-]\d\d:?\d\d$/.test(local)) return Date.parse(local);
  const s = local.length === 10 ? local + 'T00:00' : local;
  return Date.parse(s + ':00' + TZ);
}
/** ms → {date:'2026-12-23', time:'17:00'} во времени поездки. */
export function tripParts(ts) {
  const d = new Date(ts + tzMinutes() * 60000);
  const iso = d.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}
export const tripLocal = (ts) => {
  const p = tripParts(ts);
  return `${p.date}T${p.time}`;
};

// «Сейчас» можно подменить для проверки: ?now=2026-12-23T15:00 или в настройках.
let nowOverride = null;
export function setNowOverride(v) {
  nowOverride = v ? tripTs(v) : null;
}
export const now = () => nowOverride ?? Date.now();
export const isNowOverridden = () => nowOverride != null;

const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const WD_FULL = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

const dateObj = (date) => new Date(date + 'T12:00:00Z');
export const weekday = (date) => WD[dateObj(date).getUTCDay()];
export const weekdayFull = (date) => WD_FULL[dateObj(date).getUTCDay()];
export const dayMonth = (date) => {
  const d = dateObj(date);
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
};
export const ddmm = (date) => (date ? `${date.slice(8, 10)}.${date.slice(5, 7)}` : '');
export const timeOf = (local) => (local ? local.slice(11, 16) : '');
export function fmtLocal(local, withDate = true) {
  if (!local) return '';
  return withDate ? `${ddmm(local.slice(0, 10))}, ${timeOf(local)}` : timeOf(local);
}
export function fmtDuration(ms) {
  if (ms == null || ms < 0) return '';
  const m = Math.round(ms / 60000);
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return hh ? `${hh} ч${mm ? ' ' + mm + ' мин' : ''}` : `${mm} мин`;
}
export function fmtRelative(ts) {
  const diff = ts - now();
  const abs = Math.abs(diff);
  const m = Math.round(abs / 60000);
  let s;
  if (m < 1) return 'сейчас';
  if (m < 60) s = `${m} мин`;
  else if (m < 60 * 36) s = fmtDuration(Math.round(abs / 300000) * 300000);
  else s = plural(Math.round(abs / 86400000), 'день', 'дня', 'дней');
  return diff > 0 ? `через ${s}` : `${s} назад`;
}
export function plural(n, one, few, many) {
  const n10 = n % 10, n100 = n % 100;
  const w = n10 === 1 && n100 !== 11 ? one : n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14) ? few : many;
  return `${n} ${w}`;
}
export function addDays(date, n) {
  const d = dateObj(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const fmtBytes = (b) =>
  b < 1024 ? `${b} Б` : b < 1048576 ? `${(b / 1024).toFixed(0)} КБ` : b < 1073741824 ? `${(b / 1048576).toFixed(1)} МБ` : `${(b / 1073741824).toFixed(2)} ГБ`;

export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const platform = (() => {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  return { ios, android, standalone };
})();

export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name, style: { display: 'none' } });
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 4000);
}

/** Поделиться файлом через системное меню; если нельзя — скачать. Возвращает 'shared' | 'downloaded' | 'cancelled'. */
export async function shareOrDownload(blob, name, title) {
  const file = new File([blob], name, { type: blob.type || 'application/octet-stream' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: title || name });
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled';
    }
  }
  download(blob, name);
  return 'downloaded';
}
