// Карточки: пункт ленты, отрезок маршрута, город, документ. Используются на всех вкладках.
import { h, ddmm, dayMonth, weekday, fmtDuration, fmtLocal, timeOf, tripTs, now, fmtRelative, isTbd, plural, fmtBytes, shareOrDownload } from './util.js';
import { sheet, form, confirmBox, pick, toast, fullscreen } from './ui.js';
import * as M from './model.js';
import { navButtons } from './nav.js';
import { openDoc } from './viewer.js';

export const TYPES = {
  flight: { icon: '✈️', name: 'Перелёт' },
  train: { icon: '🚆', name: 'Поезд' },
  hotel: { icon: '🏨', name: 'Заселение / выезд' },
  event: { icon: '🎄', name: 'Событие' },
  luggage: { icon: '🧳', name: 'Багаж' },
  important: { icon: '⚠️', name: 'Важное' },
  food: { icon: '🍽️', name: 'Еда' },
  note: { icon: '📝', name: 'Заметка' },
};
export const MODES = {
  train: { icon: '🚆', name: 'Поезд' },
  nighttrain: { icon: '🌙', name: 'Ночной поезд' },
  flight: { icon: '✈️', name: 'Самолёт' },
  bus: { icon: '🚌', name: 'Автобус' },
  taxi: { icon: '🚕', name: 'Такси' },
};
export const HINTS = {
  'bag-drop': { icon: '🧳', text: 'Здесь сдать багаж' },
  'bag-pick': { icon: '🧳', text: 'Здесь забрать багаж' },
  transfer: { icon: '🔁', text: 'Пересадка' },
  checkin: { icon: '📲', text: 'Онлайн-регистрация' },
  reception: { icon: '🛎️', text: 'Вещи оставить на ресепшене' },
  warn: { icon: '⚠️', text: 'Внимание' },
};
const STATUS = {
  todo: ['Нужен билет', 'warn'], option: ['По настроению', 'soft'], decide: ['Решаем', 'warn'], booked: ['Куплено', 'ok'],
};

export const segIcon = (s) => (MODES[s.mode] || MODES.train).icon;

/** Подсказки пункта + «живые» (регистрация открыта, если до рейса < 24 ч). */
export function hintsFor(it) {
  const out = (it.hints || []).map((x) => ({ ...(HINTS[x.k] || HINTS.warn), text: x.t || (HINTS[x.k] || {}).text || '' }));
  if (it.seg) {
    const s = M.trip().segById[it.seg];
    if (s && s.mode === 'flight' && s.dep) {
      const dep = tripTs(s.dep);
      const n = now();
      if (n > dep - 24 * 3600e3 && n < dep - 3600e3 && !out.some((x) => x.icon === '📲' && /открыта/.test(x.text)))
        out.unshift({ icon: '📲', text: 'Онлайн-регистрация открыта', live: true });
    }
  }
  return out;
}
export const hintChips = (list) => list.length ? h('div.hints', list.map((x) => h('span.hint' + (x.live ? '.live' : ''), `${x.icon} ${x.text}`))) : null;

const val = (v) => (v == null || v === '' ? null : v);
const kv = (k, v, cls = '') => (val(v) ? h('div.kv' + cls, h('span.k', k), h('span.v' + (isTbd(String(v)) ? '.tbd' : ''), v)) : null);

function secretNotice(e) {
  const s = e.secret || {};
  return h('div.secret-box',
    h('div.secret-gift', '🎁'),
    h('p', s.stripped ? 'Подробности — сюрприз.' : `Откроется ${s.revealAt ? ddmm(s.revealAt.slice(0, 10)) : 'позже'} или по PIN-коду.`),
    !s.stripped && M.S.settings.pinHash && h('button.btn', { onclick: () => askPin() }, '🔑 Ввести PIN'));
}
export async function askPin() {
  const r = await form('PIN для секретов', [{ name: 'pin', label: 'PIN-код', type: 'password', inputmode: 'numeric', autofocus: true }], { ok: 'Открыть' });
  if (!r) return;
  if (await M.tryUnlock(r.pin)) toast('Секреты открыты на этом телефоне');
  else toast('Неверный PIN');
}

// ---------- Документы, привязанные к объекту ----------
function docRows(docs) {
  const hidden = docs.filter(M.docHidden).length;
  const visible = docs.filter((d) => !M.docHidden(d));
  return h('div.doc-rows',
    visible.map((d) => h('div.doc-row',
      h('button.doc-open', { onclick: () => openDoc(d.id) }, h('span.doc-ic', docIcon(d)), h('span.doc-name', d.name)),
      h('button.chip', { onclick: () => openDoc(d.id, { qr: true }), 'aria-label': 'Показать QR' }, '▣ QR'))),
    hidden ? h('div.muted.small', `🎁 Секретных файлов: ${hidden}`) : null);
}
export const docIcon = (d) => (/pdf/.test(d.type) || /\.pdf$/i.test(d.name) ? '📄' : (d.type || '').startsWith('image/') ? '🖼️' : '📎');

function primaryTicketButton(docs, label) {
  const d = docs.find((x) => !M.docHidden(x));
  if (!d) return null;
  return h('button.btn.primary.big', { onclick: () => openDoc(d.id) }, `🎫 ${label}`);
}

/** Прикрепить файл к объекту: выбрать из уже добавленных или загрузить новый. */
export async function attachTo(k, id, folderHint) {
  const choice = await pick('Прикрепить файл', [
    { value: 'new', icon: '➕', label: 'Добавить файл с телефона', sub: 'PDF, скриншот, фото QR' },
    ...M.S.docs.filter((d) => !M.docHidden(d)).map((d) => ({ value: d.id, icon: docIcon(d), label: d.name, sub: M.FOLDERS.find((f) => f.id === d.folder)?.name })),
  ]);
  if (!choice) return;
  if (choice === 'new') {
    const files = await chooseFiles();
    for (const f of files) await M.addDoc(f, folderHint, [{ k, id }]);
    if (files.length) toast(files.length > 1 ? `Добавлено файлов: ${files.length}` : 'Файл добавлен');
  } else {
    const d = M.S.docs.find((x) => x.id === choice);
    const links = [...(d.links || [])];
    if (!links.some((l) => l.k === k && l.id === id)) links.push({ k, id });
    await M.updateDoc(choice, { links });
    toast('Привязано');
  }
}
export function chooseFiles() {
  return new Promise((resolve) => {
    const input = h('input', { type: 'file', multiple: true, accept: 'application/pdf,image/*,.pdf,.pkpass', style: { display: 'none' } });
    input.addEventListener('change', () => {
      resolve([...input.files]);
      input.remove();
    });
    document.body.append(input);
    input.click();
  });
}
const folderForType = (t) => ({ flight: 'flights', train: 'trains', nighttrain: 'trains', hotel: 'hotels' }[t] || undefined);

// ---------- Пункт ленты ----------
/** Лист, который сам перерисовывается при изменении данных. */
export function liveSheet(render, opts = {}) {
  let unsub = null;
  const close = sheet((c) => render(c), { ...opts, onClose: () => unsub && unsub() });
  unsub = M.onChange(() => close.replace((c) => render(c)));
  return close;
}

export const openItem = (id) => liveSheet((c) => itemView(id, c));

function itemView(id, close) {
  const t = M.trip();
  const raw = t.itemById[id];
  if (!raw) return h('div.dialog', h('p', 'Пункт удалён'));
  const it = M.maskItem(raw);
  const date = raw._date;
  const type = TYPES[it.type] || TYPES.note;
  const seg = it.seg && M.maskSeg(t.segById[it.seg]);
  const city = it.city && t.cityById[it.city];
  const checked = !!M.S.checks[id];
  const docs = [...M.docsFor('item', id), ...(seg ? M.docsFor('seg', seg.id) : []), ...(it.type === 'hotel' && city ? M.docsFor('city', city.id) : [])]
    .filter((d, i, a) => a.findIndex((x) => x.id === d.id) === i);
  const ts = M.itemTs(raw, date);

  return h('div.detail',
    h('div.detail-head',
      h('div.detail-icon', type.icon),
      h('div',
        h('div.detail-when', `${weekday(date)}, ${dayMonth(date)}`, it.time ? ` · ${it.approx ? '≈ ' : ''}${it.time}` : ' · время уточнить',
          ts && !checked ? h('span.muted', ` · ${fmtRelative(ts)}`) : null),
        h('h2.detail-title' + (checked ? '.done' : ''), it.title))),
    it._masked ? secretNotice(raw) : [
      M.isOptOut(raw) && h('div.banner.soft', 'Этот вариант переезда не выбран'),
      it.details && h('p.detail-text' + (isTbd(it.details) ? '.has-tbd' : ''), it.details),
      hintChips(hintsFor(it)),
      seg && segSummary(seg, docs),
      !seg && docs.length ? h('div.section', h('h3', 'Документы'), primaryTicketButton(docs, it.type === 'hotel' ? 'Открыть бронь' : 'Открыть документ'), docRows(docs)) : null,
      it.place && h('div.section', h('h3', '📍 ' + (it.place.name || 'Место')), navButtons(it.place)),
      city && h('button.link-row', { onclick: () => { close(); openCity(city.id); } }, `${city.flag || '📍'} ${city.name} — карточка города ›`),
    ],
    h('div.detail-actions',
      h('button.btn' + (checked ? '' : '.primary'), { onclick: () => M.toggleCheck(id) }, checked ? '↺ Снять отметку' : '✓ Сделано'),
      !it._masked && h('button.btn', { onclick: () => attachTo('item', id, folderForType(it.type) || folderForType(seg?.mode)) }, '📎 Файл'),
      !it._masked && h('button.btn', { onclick: () => editItem(raw, date) }, '✎ Изменить')),
    M.hasLocal('item:' + id) && !raw._new && h('button.link-row.muted', { onclick: async () => {
      if (await confirmBox('Вернуть как в плане?', 'Ваши правки этого пункта будут удалены.')) M.resetLocal('item:' + id);
    } }, '↺ Вернуть как в исходном плане'));
}

/** Короткая карточка отрезка (внутри пункта). */
function segSummary(s, docs) {
  const dur = s.dep && s.arr ? fmtDuration(tripTs(s.arr) - tripTs(s.dep)) : s.duration;
  return h('div.section.seg-card',
    h('div.seg-route', h('span', s.fromName || ''), h('span.seg-arrow', segIcon(s)), h('span', s.toName || '')),
    h('div.seg-times',
      h('div', h('div.big-time', s.dep ? timeOf(s.dep) : '—'), h('small.muted', s.dep ? ddmm(s.dep.slice(0, 10)) : 'отправление')),
      h('div.seg-dur', dur || ''),
      h('div', h('div.big-time', s.arr ? timeOf(s.arr) : '—'), h('small.muted', s.arr ? ddmm(s.arr.slice(0, 10)) : 'прибытие'))),
    s.approx && h('div.muted.small.center', '≈ время примерное, уточнить по билету'),
    h('div.kv-list', kv('Поезд / рейс', s.number), kv('Вагон', s.coach), kv('Место', s.seat), kv('Платформа', s.platform)),
    s.options && segOptions(s),
    docs && docs.length ? [primaryTicketButton(docs, 'Открыть билет'), docRows(docs)] : h('button.btn', { onclick: () => attachTo('seg', s.id, folderForType(s.mode)) }, '📎 Прикрепить билет'),
    h('button.link-row', { onclick: () => openSeg(s.id) }, 'Весь отрезок ›'));
}

function segOptions(s) {
  return h('div.options',
    s.options.map((o, i) => h('div.option' + (s.chosen === i ? '.chosen' : ''),
      h('div', h('b', o.label), h('div.small', [o.dep && fmtLocal(o.dep), o.arr && '→ ' + fmtLocal(o.arr)].filter(Boolean).join(' ')), h('div.small.muted', [o.price, o.note].filter(Boolean).join(' · '))),
      s.chosen === i
        ? h('button.chip', { onclick: () => M.patch('seg:' + s.id, { chosen: null, dep: null, arr: null, status: 'decide' }) }, '✓ Выбран')
        : h('button.chip', { onclick: () => M.patch('seg:' + s.id, { chosen: i, dep: o.dep || null, arr: o.arr || null, mode: o.mode || s.mode, status: 'todo' }).then(() => toast('Вариант выбран')) }, 'Выбрать'))));
}

// ---------- Отрезок маршрута ----------
export const openSeg = (id) => liveSheet((c) => segView(id, c));
function segView(id, close) {
  const t = M.trip();
  const raw = t.segById[id];
  if (!raw) return h('div.dialog', 'Отрезок не найден');
  const s = M.maskSeg(raw);
  const from = t.cityById[s.from];
  const to = t.cityById[s.to];
  const docs = M.docsFor('seg', id);
  const dur = s.dep && s.arr ? fmtDuration(tripTs(s.arr) - tripTs(s.dep)) : s.duration;
  const st = STATUS[s.status];
  const fromPt = s.fromLat ? { lat: s.fromLat, lng: s.fromLng, name: s.fromName } : from?.station && { ...from.station };
  const toPt = s.toLat ? { lat: s.toLat, lng: s.toLng, name: s.toName } : to?.station && { ...to.station };
  return h('div.detail',
    h('div.detail-head',
      h('div.detail-icon', segIcon(s)),
      h('div',
        h('div.detail-when', (MODES[s.mode] || MODES.train).name, s.dep ? ` · ${weekday(s.dep.slice(0, 10))}, ${dayMonth(s.dep.slice(0, 10))}` : '', st ? h('span.status.' + st[1], st[0]) : null),
        h('h2.detail-title', `${s.fromName || from?.name || '?'} → ${s.toName || to?.name || '?'}`))),
    s._masked ? secretNotice(raw) : [
      h('div.seg-card',
        h('div.seg-times',
          h('div', h('small.muted', 'Отправление'), h('div.big-time', s.dep ? timeOf(s.dep) : '—'), h('small', s.dep ? ddmm(s.dep.slice(0, 10)) : '')),
          h('div.seg-dur', dur ? '⏱ ' + dur : ''),
          h('div', h('small.muted', 'Прибытие'), h('div.big-time', s.arr ? timeOf(s.arr) : '—'), h('small', s.arr ? ddmm(s.arr.slice(0, 10)) : ''))),
        s.approx && h('div.muted.small.center', '≈ время примерное')),
      h('div.kv-list', kv('Поезд / рейс', s.number), kv('Перевозчик', s.carrier), kv('Вагон', s.coach), kv('Место', s.seat), kv('Платформа', s.platform), kv('Цена', s.price)),
      s.options && h('div.section', h('h3', 'Варианты'), segOptions(s)),
      s.notes && h('p.detail-text' + (isTbd(s.notes) ? '.has-tbd' : ''), s.notes),
      h('div.section', h('h3', 'Билет'), primaryTicketButton(docs, 'Открыть билет'), docRows(docs),
        h('button.btn', { onclick: () => attachTo('seg', id, folderForType(s.mode)) }, '📎 Прикрепить билет')),
      fromPt && fromPt.lat && h('div.section', h('h3', '📍 Откуда: ' + (fromPt.name || '')), navButtons(fromPt, { compact: false })),
      toPt && toPt.lat && h('div.section', h('h3', '📍 Куда: ' + (toPt.name || '')), navButtons(toPt)),
    ],
    h('div.detail-actions', !s._masked && h('button.btn', { onclick: () => editSeg(raw) }, '✎ Изменить')),
    M.hasLocal('seg:' + id) && h('button.link-row.muted', { onclick: async () => {
      if (await confirmBox('Вернуть как в плане?', 'Ваши правки этого отрезка будут удалены.')) M.resetLocal('seg:' + id);
    } }, '↺ Вернуть как в исходном плане'));
}

// ---------- Город ----------
export const openCity = (id) => liveSheet((c) => cityView(id, c), { full: true });
export function cityView(id, close) {
  const t = M.trip();
  const raw = t.cityById[id];
  if (!raw) return h('div', 'Город не найден');
  const c = M.maskCity(raw);
  const hotel = c.hotel;
  const docs = M.docsFor('city', id);
  const days = t.days.filter((d) => d.city === id || d.items.some((i) => i.city === id));
  const kindLabel = { stay: plural(c.nights || 0, 'ночь', 'ночи', 'ночей'), daytrip: 'на день', transit: 'проездом' }[c.kind] || '';
  const hotelPt = hotel && hotel.lat ? { lat: hotel.lat, lng: hotel.lng, name: hotel.name } : null;
  return h('div.detail.city-detail',
    h('div.city-hero',
      h('div.city-flag', c.flag || '📍'),
      h('div',
        h('h2.city-name', c.name),
        h('div.city-local', c.local),
        h('div.city-dates', c.dates || `${ddmm(c.from)} — ${ddmm(c.to)}`, kindLabel && h('span.pill', kindLabel)))),
    hotel && h('div.section.hotel',
      h('h3', '🏨 Жильё'),
      c._masked ? [h('div.hotel-name', hotel.name), secretNotice(raw)] : [
        h('div.hotel-name' + (isTbd(hotel.name) ? '.tbd' : ''), hotel.name || '—'),
        hotel.addressLocal && h('button.address-big', { onclick: () => showTaxi(c) }, h('span', hotel.addressLocal), h('small', '🚕 Показать таксисту')),
        hotel.address && h('div.muted', hotel.address),
        h('div.kv-list', kv('Заселение', hotel.checkIn), kv('Выезд', hotel.checkOut)),
        hotel.phone && h('a.btn', { href: 'tel:' + hotel.phone.replace(/[^+\d]/g, '') }, '📞 ' + hotel.phone),
        primaryTicketButton(docs, 'Открыть бронь'), docRows(docs),
        h('div.row-buttons',
          h('button.btn', { onclick: () => attachTo('city', id, 'hotels') }, '📎 Бронь'),
          h('button.btn', { onclick: () => editCity(raw) }, '✎ Изменить')),
        hotelPt && navButtons(hotelPt),
      ]),
    !hotel && docs.length ? h('div.section', h('h3', 'Документы'), docRows(docs)) : null,
    c.station && h('div.section', h('h3', '🚉 Вокзал'), h('div', c.station.name), navButtons(c.station)),
    c.places && c.places.length ? h('div.section', h('h3', 'Ключевые места'),
      c.places.map((p) => h('div.place',
        h('div.place-head', h('span.place-ic', p.icon || '📍'), h('div', h('div', p.name), p.local && h('small.muted' + (isTbd(p.local) ? '.tbd' : ''), p.local), p.note && h('small.place-note', p.note))),
        p.lat != null && navButtons(p, { compact: true })))) : null,
    days.length ? h('div.section', h('h3', 'План по дням'),
      days.map((d) => h('div.city-day',
        h('div.city-day-head', `${weekday(d.date)}, ${dayMonth(d.date)}`, d.title && h('span.muted', ' · ' + d.title)),
        d.items.filter((i) => !M.isOptOut(i)).map((i0) => {
          const i = M.maskItem(i0);
          return h('button.city-item', { onclick: () => openItem(i.id) }, h('span.ci-time', i.time ? (i.approx ? '≈' : '') + i.time : '··'), h('span', (TYPES[i.type] || TYPES.note).icon + ' ' + i.title));
        })))) : null,
    c.notes && h('div.section', h('h3', 'Заметки'), h('p.detail-text', c.notes)),
    h('div.section.emergency', h('a.btn.danger', { href: 'tel:112' }, '🆘 112 — экстренная служба'), h('small.muted', 'Работает во всех странах ЕС, бесплатно, с любого телефона.')),
    close && h('button.btn.ghost.wide', { onclick: close }, 'Закрыть'));
}

export function showTaxi(c) {
  fullscreen((close) =>
    h('div.taxi', { onclick: close },
      h('div.taxi-name', c.hotel.name),
      h('div.taxi-address', c.hotel.addressLocal),
      c.hotel.phone && h('div.taxi-phone', c.hotel.phone),
      h('div.taxi-hint', 'Нажмите, чтобы закрыть')), { cls: 'white' });
}

// ---------- Редактирование ----------
const secretFields = (e) => [
  { name: 'secret', label: '🎁 Секрет', type: 'checkbox', value: !!e.secret, hint: 'Скрыто до даты раскрытия или PIN' },
  { name: 'revealAt', label: 'Раскрыть с даты', type: 'date', value: e.secret?.revealAt?.slice(0, 10) || '' },
  { name: 'placeholder', label: 'Что видно вместо секрета', value: e.secret?.placeholder || 'Сюрприз 🎁' },
];
const secretFrom = (r) => (r.secret ? { revealAt: r.revealAt ? r.revealAt + 'T00:00' : null, placeholder: r.placeholder || 'Сюрприз 🎁' } : null);

export async function editItem(it, date, isNew = false) {
  const r = await form(isNew ? 'Новый пункт' : 'Изменить пункт', [
    { name: 'time', label: 'Время', type: 'time', value: it.time || '' },
    { name: 'title', label: 'Заголовок', value: it.title || '', autofocus: isNew },
    { name: 'type', label: 'Тип', type: 'select', value: it.type || 'event', options: Object.entries(TYPES).map(([k, v]) => [k, `${v.icon} ${v.name}`]) },
    { name: 'details', label: 'Детали / заметка', type: 'textarea', value: it.details || '' },
    ...secretFields(it),
  ], {
    extra: !isNew && ((cancel) => h('button.btn.danger.wide', { type: 'button', onclick: async () => {
      if (await confirmBox('Удалить пункт?', it.title, { ok: 'Удалить', danger: true })) {
        await M.remove('item:' + it.id);
        cancel();
        toast('Удалено');
      }
    } }, '🗑 Удалить пункт')),
  });
  if (!r) return null;
  if (!r.title) return toast('Нужен заголовок');
  const fields = { time: r.time || null, title: r.title, type: r.type, details: r.details, secret: secretFrom(r) };
  if (it.time !== fields.time) fields.approx = false;
  if (isNew) return M.addItem(date, fields);
  await M.patch('item:' + it.id, fields);
  toast('Сохранено');
}

export async function editSeg(s) {
  const r = await form('Изменить отрезок', [
    { name: 'dep', label: 'Отправление', type: 'datetime-local', value: s.dep || '' },
    { name: 'arr', label: 'Прибытие', type: 'datetime-local', value: s.arr || '' },
    { name: 'number', label: 'Номер поезда / рейса', value: s.number || '' },
    { name: 'carrier', label: 'Перевозчик', value: s.carrier || '' },
    { name: 'coach', label: 'Вагон', value: s.coach || '' },
    { name: 'seat', label: 'Место', value: s.seat || '' },
    { name: 'platform', label: 'Платформа', value: s.platform || '' },
    { name: 'status', label: 'Статус', type: 'select', value: s.status || 'todo', options: [['booked', '✓ Куплено'], ['todo', 'Нужен билет'], ['decide', 'Решаем'], ['option', 'По настроению']] },
    { name: 'notes', label: 'Заметки', type: 'textarea', value: s.notes || '' },
    ...secretFields(s),
  ]);
  if (!r) return;
  await M.patch('seg:' + s.id, { dep: r.dep || null, arr: r.arr || null, approx: false, number: r.number, carrier: r.carrier, coach: r.coach, seat: r.seat, platform: r.platform, status: r.status, notes: r.notes, secret: secretFrom(r) });
  toast('Сохранено');
}

function parseLatLng(s) {
  const m = /(-?\d+(?:[.,]\d+)?)\s*[,; ]\s*(-?\d+(?:[.,]\d+)?)/.exec(s || '');
  return m ? { lat: +m[1].replace(',', '.'), lng: +m[2].replace(',', '.') } : null;
}
export async function editCity(c) {
  const hotel = c.hotel || {};
  const r = await form('Жильё: ' + c.name, [
    { name: 'name', label: 'Название отеля', value: isTbd(hotel.name) ? '' : hotel.name || '' },
    { name: 'addressLocal', label: 'Адрес на местном языке (для таксиста)', type: 'textarea', rows: 2, value: hotel.addressLocal || '' },
    { name: 'address', label: 'Адрес / как добраться (по-русски)', value: hotel.address || '' },
    { name: 'phone', label: 'Телефон отеля', type: 'tel', value: hotel.phone || '' },
    { name: 'checkIn', label: 'Заселение', value: hotel.checkIn || '', placeholder: 'с 15:00' },
    { name: 'checkOut', label: 'Выезд', value: hotel.checkOut || '', placeholder: 'до 11:00' },
    { name: 'coords', label: 'Координаты отеля', value: hotel.lat ? `${hotel.lat}, ${hotel.lng}` : '', placeholder: '50.9375, 6.9603', hint: 'Скопируйте из Google Maps (долгое нажатие на точку)' },
    { name: 'notes', label: 'Заметки о городе', type: 'textarea', value: c.notes || '' },
    ...secretFields(c),
  ]);
  if (!r) return;
  const ll = parseLatLng(r.coords);
  await M.patch('city:' + c.id, {
    hotel: { name: r.name || '[уточнить]', addressLocal: r.addressLocal, address: r.address, phone: r.phone, checkIn: r.checkIn, checkOut: r.checkOut, lat: ll?.lat ?? null, lng: ll?.lng ?? null },
    notes: r.notes, secret: secretFrom(r),
  });
  toast('Сохранено');
}

// ---------- Документ: действия ----------
export const docActions = (id) => liveSheet((c) => docActionsView(id, c));
function linkLabel(l) {
  const t = M.trip();
  if (l.k === 'item') {
    const it = t.itemById[l.id];
    return it ? `${(TYPES[it.type] || TYPES.note).icon} ${ddmm(it._date)} · ${M.maskItem(it).title}` : '— удалённый пункт';
  }
  if (l.k === 'seg') {
    const s = t.segById[l.id];
    return s ? `${segIcon(s)} ${s.fromName} → ${M.maskSeg(s).toName}` : '— удалённый отрезок';
  }
  const c = t.cityById[l.id];
  return c ? `${c.flag || '📍'} ${c.name}` : '— город';
}
function docActionsView(id, close) {
  const d = M.S.docs.find((x) => x.id === id);
  if (!d) return h('div.dialog', 'Файл удалён');
  const sec = M.docSecret(d);
  return h('div.detail',
    h('div.detail-head', h('div.detail-icon', docIcon(d)), h('div', h('div.detail-when', `${fmtBytes(d.size)} · ${M.FOLDERS.find((f) => f.id === d.folder)?.name || ''}`), h('h2.detail-title', d.name))),
    h('div.row-buttons',
      h('button.btn.primary', { onclick: () => openDoc(id) }, 'Открыть'),
      h('button.btn', { onclick: () => openDoc(id, { qr: true }) }, '▣ QR'),
      h('button.btn', { onclick: async () => { const b = await (await import('./db.js')).docBlob(id); shareOrDownload(b, d.name, d.name); } }, '↗ Поделиться')),
    h('div.section', h('h3', 'Привязан к'),
      (d.links || []).length ? d.links.map((l, i) => h('div.link-item', h('span', linkLabel(l)),
        h('button.chip', { onclick: () => M.updateDoc(id, { links: d.links.filter((_, j) => j !== i) }) }, '✕'))) : h('p.muted', 'Ни к чему не привязан'),
      h('button.btn', { onclick: () => linkDoc(d) }, '🔗 Привязать к пункту / поезду / городу')),
    h('div.section', h('h3', 'Настройки'),
      h('button.link-row', { onclick: async () => {
        const r = await form('Переименовать', [{ name: 'name', label: 'Имя файла', value: d.name }]);
        if (r && r.name) M.updateDoc(id, { name: r.name });
      } }, '✎ Переименовать'),
      h('button.link-row', { onclick: async () => {
        const f = await pick('Папка', M.FOLDERS.map((f) => ({ value: f.id, icon: f.icon, label: f.name })));
        if (f) M.updateDoc(id, { folder: f });
      } }, '📁 Переложить в другую папку'),
      h('button.link-row', { onclick: async () => {
        if (d.secret) return M.updateDoc(id, { secret: null });
        const r = await form('Секретный файл', [
          { name: 'revealAt', label: 'Раскрыть с даты', type: 'date', value: '2027-01-04' },
          { name: 'placeholder', label: 'Что видно вместо файла', value: 'Секретный документ 🎁' }]);
        if (r) M.updateDoc(id, { secret: { revealAt: r.revealAt ? r.revealAt + 'T00:00' : null, placeholder: r.placeholder } });
      } }, d.secret ? '🎁 Снять пометку «секрет»' : sec ? '🎁 Секрет (через привязку) — сделать отдельным секретом' : '🎁 Пометить как секрет'),
      h('button.link-row.danger-text', { onclick: async () => {
        if (await confirmBox('Удалить файл с телефона?', d.name, { ok: 'Удалить', danger: true })) {
          await M.deleteDoc(id);
          close();
        }
      } }, '🗑 Удалить файл')));
}

export async function linkDoc(d) {
  const t = M.trip();
  const items = [{ header: 'Города' }, ...t.cities.map((c) => ({ value: { k: 'city', id: c.id }, icon: c.flag, label: c.name, sub: `${ddmm(c.from)}–${ddmm(c.to)}` })),
    { header: 'Переезды' }, ...t.segments.filter((s) => !s.hideOnMap || true).map((s) => ({ value: { k: 'seg', id: s.id }, icon: segIcon(s), label: `${s.fromName} → ${M.maskSeg(s).toName}`, sub: s.dep ? fmtLocal(s.dep) : '' })),
    { header: 'Пункты ленты' }];
  for (const day of t.days) for (const it of day.items) items.push({ value: { k: 'item', id: it.id }, icon: (TYPES[it.type] || TYPES.note).icon, label: M.maskItem(it).title, sub: `${ddmm(day.date)} ${it.time || ''}` });
  const v = await pick('Привязать к…', items);
  if (!v) return;
  const links = [...(d.links || [])];
  if (!links.some((l) => l.k === v.k && l.id === v.id)) links.push(v);
  await M.updateDoc(d.id, { links });
  toast('Привязано');
}
