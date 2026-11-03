// Напоминания: список, редактирование и экспорт в календарь (.ics с будильниками).
import { h, fmtLocal, tripLocal, now, fmtRelative, isTbd, platform, shareOrDownload, tripTs } from './util.js';
import { form, confirmBox, toast, sheet } from './ui.js';
import * as M from './model.js';
import { liveSheet } from './details.js';

function relText(r) {
  if (!r.rel) return '';
  const s = M.trip().segById[r.rel.seg];
  const m = Math.abs(r.rel.min || 0);
  const amount = m >= 1440 && m % 1440 === 0 ? `${m / 1440 * 24} ч` : m >= 60 ? `${Math.floor(m / 60)} ч${m % 60 ? ' ' + (m % 60) + ' мин' : ''}` : `${m} мин`;
  return `за ${amount} до ${s ? `${s.fromName} → ${s.toName}` : 'отправления'}`;
}

export function openReminders() {
  const close = liveSheet((c) => remindersView(c), { full: true });
  // сразу к ближайшему будущему напоминанию
  setTimeout(() => {
    const el = close.body.querySelector('.rem.next');
    if (el) close.body.scrollTo({ top: el.offsetTop - 120, behavior: 'smooth' });
  }, 350);
}

function remindersView(close) {
  const t = M.trip();
  const n = now();
  const list = t.reminders.map((r) => ({ r, m: M.maskReminder(r), ts: M.reminderTs(r) }))
    .sort((a, b) => (a.ts ?? 9e15) - (b.ts ?? 9e15));
  const firstFuture = list.findIndex((x) => x.ts && x.ts > n);
  return h('div.detail',
    h('div.detail-head', h('div.detail-icon', '🔔'), h('div', h('div.detail-when', `${list.length} напоминаний`), h('h2.detail-title', 'Напоминания'))),
    h('div.banner',
      h('b', 'Как это работает. '),
      'В приложении напоминания видны в баннере «Скоро». Чтобы телефон напомнил сам, даже без интернета и с закрытым приложением, — экспортируйте их в календарь.'),
    h('button.btn.primary.wide', { onclick: exportIcsDialog }, '📅 Экспорт в календарь (.ics)'),
    h('button.btn.wide', { onclick: () => editReminder(null) }, '＋ Добавить напоминание'),
    h('div.rem-list',
      list.map(({ r, m, ts }, i) => {
        const done = !!M.S.checks['rem:' + r.id];
        const past = ts && ts < n;
        return h('div.rem' + (done ? '.checked' : '') + (past ? '.past' : '') + (i === firstFuture ? '.next' : ''),
          h('button.item-check', { onclick: () => M.toggleCheck('rem:' + r.id), 'aria-label': 'Отметить' }, done ? '✓' : ''),
          h('button.rem-main', { onclick: () => !m._masked && editReminder(r) },
            h('div.rem-when', ts ? `${fmtLocal(tripLocal(ts))} · ${fmtRelative(ts)}` : 'время появится, когда станет известно отправление'),
            h('div.rem-title', m.title),
            m.details && h('div.rem-details', m.details),
            h('div.item-meta', r.rel && h('span.tag', '⏱ ' + relText(r)), (r.tbd || isTbd(m.details || '')) && h('span.tag.tbd', 'вписать дату'), r._local && h('span.tag.local', 'изменено'))));
      })),
    h('button.btn.ghost.wide', { onclick: close }, 'Закрыть'));
}

async function editReminder(r) {
  const isNew = !r;
  r = r || {};
  const ts = isNew ? null : M.reminderTs(r);
  const res = await form(isNew ? 'Новое напоминание' : 'Напоминание', [
    { name: 'title', label: 'Текст', value: r.title || '', autofocus: isNew },
    { name: 'at', label: r.rel ? 'Время (сейчас считается от поезда/рейса; если задать — станет фиксированным)' : 'Когда напомнить', type: 'datetime-local', value: r.rel ? '' : r.at || (ts ? tripLocal(ts) : '') },
    { name: 'details', label: 'Подробности', type: 'textarea', value: r.details || '' },
    { name: 'secret', label: '🎁 Секрет', type: 'checkbox', value: !!r.secret, hint: 'Скрыто до 04.01 или PIN' },
  ], {
    extra: !isNew && ((cancel) => h('button.btn.danger.wide', { type: 'button', onclick: async () => {
      if (await confirmBox('Удалить напоминание?', r.title, { ok: 'Удалить', danger: true })) {
        await M.remove('rem:' + r.id);
        cancel();
      }
    } }, '🗑 Удалить')),
  });
  if (!res) return;
  if (!res.title) return toast('Нужен текст');
  if (!res.at && !r.rel) return toast('Укажите время');
  const fields = { title: res.title, details: res.details, tbd: false,
    secret: res.secret ? r.secret || { revealAt: '2027-01-04T00:00', placeholder: 'Секретное напоминание 🎁' } : null };
  if (res.at) Object.assign(fields, { at: res.at, rel: null });
  if (isNew) await M.addReminder(fields);
  else await M.patch('rem:' + r.id, fields);
  toast('Сохранено');
}

// ---------- .ics ----------
const icsDate = (ts) => new Date(ts).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
function fold(line) {
  // строки .ics — не длиннее 75 байт
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = '';
  for (const ch of line) {
    if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
    }
    cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}
function vevent({ uid, start, end, summary, description, alarmMin = 0 }) {
  return [
    'BEGIN:VEVENT', `UID:${uid}@winter-trip`, `DTSTAMP:${icsDate(Date.now())}`, `DTSTART:${icsDate(start)}`, `DTEND:${icsDate(end)}`,
    `SUMMARY:${esc(summary)}`, description ? `DESCRIPTION:${esc(description)}` : null,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(summary)}`, `TRIGGER:-PT${alarmMin}M`, 'END:VALARM',
    'END:VEVENT',
  ].filter(Boolean).map(fold).join('\r\n');
}

export function buildIcs({ withTransport = true, onlyFuture = true } = {}) {
  const t = M.trip();
  const n = now();
  const ev = [];
  for (const r0 of t.reminders) {
    const ts = M.reminderTs(r0);
    if (!ts || (onlyFuture && ts < n)) continue;
    const r = M.maskReminder(r0);
    // Событие стоит ровно в момент напоминания, будильник — «в момент события».
    // Так напоминание сработает даже там, где календарь игнорирует будильники из файла (Google).
    ev.push(vevent({ uid: 'rem-' + r0.id, start: ts, end: ts + 15 * 60e3, summary: '🔔 ' + r.title, description: r.details }));
  }
  if (withTransport) {
    for (const s0 of t.segments) {
      if (!s0.dep) continue;
      const start = tripTs(s0.dep);
      if (onlyFuture && start < n) continue;
      const s = M.maskSeg(s0);
      const end = s.arr ? tripTs(s.arr) : start + 60 * 60e3;
      const icon = { flight: '✈️', nighttrain: '🌙', taxi: '🚕', bus: '🚌' }[s.mode] || '🚆';
      const desc = [s.number && `№ ${s.number}`, s.coach && `вагон ${s.coach}`, s.seat && `место ${s.seat}`, s.approx && 'время примерное', s.notes].filter(Boolean).join('\n');
      ev.push(vevent({ uid: 'seg-' + s0.id, start, end, summary: `${icon} ${s.fromName} → ${s.toName}`, description: desc, alarmMin: 30 }));
    }
  }
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kami & Anya//Winter Trip//RU', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Зимний маршрут', 'X-WR-TIMEZONE:Europe/Berlin', ...ev, 'END:VCALENDAR'].join('\r\n') + '\r\n';
}

function exportIcsDialog() {
  sheet((close) => {
    const chkT = h('input', { type: 'checkbox', checked: true });
    return h('div.dialog',
      h('h2', '📅 Экспорт в календарь'),
      h('label.check-row', chkT, h('span', 'Добавить поезда и рейсы как события (будильник за 30 мин)')),
      h('div.banner.soft',
        platform.ios
          ? ['iPhone: нажмите «Сохранить», в меню выберите ', h('b', '«Календарь»'), ' (если есть) или ', h('b', '«Сохранить в Файлы»'), ' → откройте файл в «Файлах» → «Добавить все». Лучше в отдельный календарь «Поездка».']
          : platform.android
            ? ['Android: файл скачается. Откройте его из «Загрузок» — Samsung Calendar и многие другие добавят события сами. ', h('b', 'Google Календарь'), ' на телефоне .ics не открывает: импортируйте на компьютере (calendar.google.com → Настройки → Импорт) до поездки, а в календаре поставьте уведомление «в момент события».']
            : 'Скачайте файл и откройте его в календаре.'),
      h('p.muted.small', 'Повторный импорт создаст дубли — перед новым импортом удалите старые события (или весь календарь «Поездка»).'),
      h('div.row-buttons',
        h('button.btn.ghost', { onclick: close }, 'Отмена'),
        h('button.btn.primary', { onclick: async () => {
          const ics = buildIcs({ withTransport: chkT.checked });
          const n = (ics.match(/BEGIN:VEVENT/g) || []).length;
          const r = await shareOrDownload(new Blob([ics], { type: 'text/calendar' }), 'zimniy-marshrut.ics', 'Зимний маршрут — календарь');
          if (r !== 'cancelled') toast(`Событий в файле: ${n}`);
          close();
        } }, 'Сохранить .ics')));
  });
}
