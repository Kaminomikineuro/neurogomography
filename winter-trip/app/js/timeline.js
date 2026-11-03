// Вкладка «Лента»: вся поездка по дням, «Сегодня», «Следующее», баннер «Скоро».
import { h, weekday, dayMonth, tripParts, now, fmtRelative, plural, tripTs, isTbd, isNowOverridden, fmtLocal, tripLocal } from './util.js';
import * as M from './model.js';
import { TYPES, openItem, hintsFor, hintChips, editItem, segIcon } from './details.js';
import { openReminders } from './reminders.js';

/** Ближайшие 24 часа: пункты ленты и напоминания. */
export function upcoming(hours = 24) {
  const t = M.trip();
  const n = now();
  const until = n + hours * 3600e3;
  const out = [];
  for (const d of t.days) for (const it of d.items) {
    const ts = M.itemTs(it, d.date);
    if (ts && ts >= n - 10 * 60e3 && ts <= until && !M.S.checks[it.id] && !M.isOptOut(it)) out.push({ ts, kind: 'item', it: M.maskItem(it), date: d.date });
  }
  for (const r of t.reminders) {
    const ts = M.reminderTs(r);
    if (ts && ts >= n - 30 * 60e3 && ts <= until && !M.S.checks['rem:' + r.id]) out.push({ ts, kind: 'rem', r: M.maskReminder(r) });
  }
  return out.sort((a, b) => a.ts - b.ts);
}

/** Если сутки пустые — подсказать ближайшее напоминание (важно до поездки). */
function nextReminderLine() {
  const n = now();
  const next = M.trip().reminders
    .map((r) => ({ r, ts: M.reminderTs(r) }))
    .filter((x) => x.ts && x.ts > n && !M.S.checks['rem:' + x.r.id])
    .sort((a, b) => a.ts - b.ts)[0];
  if (!next) return null;
  return h('button.soon-row.rem', { onclick: openReminders },
    h('span.soon-time', fmtRelative(next.ts)), h('span.soon-text', `🔔 ${M.maskReminder(next.r).title}`));
}

function nextItemId() {
  const t = M.trip();
  const n = now();
  for (const d of t.days) for (const it of d.items) {
    const ts = M.itemTs(it, d.date);
    if (ts && ts >= n - 5 * 60e3 && !M.S.checks[it.id] && !M.isOptOut(it)) return it.id;
  }
  return null;
}

export function renderTimeline(root) {
  const t = M.trip();
  const n = now();
  const today = tripParts(n).date;
  const nextId = nextItemId();
  const soon = upcoming(24);
  const start = tripTs(t.start);
  const end = tripTs(t.end + 'T23:59');

  const header = h('header.tl-header',
    h('div.tl-title-wrap',
      h('h1.tl-title', t.title),
      h('div.tl-sub', t.subtitle),
      n < start ? h('div.countdown', `До поездки ${plural(Math.ceil((start - n) / 86400e3), 'день', 'дня', 'дней')} ❄️`)
        : n > end ? h('div.countdown', 'Поездка завершена. Спасибо, что были вместе 💛')
        : h('div.countdown', `День ${Math.floor((n - start) / 86400e3) + 1} из ${Math.round((end - start) / 86400e3) + 1}`),
      isNowOverridden() && h('div.test-time', `🧪 Тестовое время: ${fmtLocal(tripLocal(n))}`)));

  const soonBox = h('section.soon',
    h('div.soon-head', h('span', '⏰ Скоро · 24 часа'), h('button.chip', { onclick: openReminders }, 'Напоминания')),
    soon.length
      ? soon.slice(0, 6).map((x) => x.kind === 'item'
          ? h('button.soon-row', { onclick: () => openItem(x.it.id) },
              h('span.soon-time', fmtRelative(x.ts)), h('span.soon-text', `${(TYPES[x.it.type] || TYPES.note).icon} ${x.it.title}`))
          : h('button.soon-row.rem', { onclick: openReminders },
              h('span.soon-time', fmtRelative(x.ts)), h('span.soon-text', `🔔 ${x.r.title}`)))
      : h('div.soon-empty', 'В ближайшие сутки ничего срочного', nextReminderLine()));

  const days = t.days.map((d) => {
    const isToday = d.date === today;
    const isPast = d.date < today;
    const city = t.cityById[d.city];
    const items = d.items.map((raw) => {
      const it = M.maskItem(raw);
      const type = TYPES[it.type] || TYPES.note;
      const checked = !!M.S.checks[raw.id];
      const optOut = M.isOptOut(raw);
      const seg = it.seg && t.segById[it.seg];
      const docsN = M.docsFor('item', raw.id).length + (seg ? M.docsFor('seg', seg.id).length : 0);
      const tbd = it.tbd || isTbd(it.title) || isTbd(it.details);
      const el = h('div.item' + (checked ? '.checked' : '') + (raw.id === nextId ? '.next' : '') + (optOut ? '.optout' : '') + (it._masked ? '.masked' : '') + (it.type === 'important' ? '.important' : ''),
        { 'data-id': raw.id },
        h('button.item-check', { 'aria-label': checked ? 'Снять отметку' : 'Отметить', onclick: (e) => { e.stopPropagation(); M.toggleCheck(raw.id); } }, checked ? '✓' : ''),
        h('button.item-main', { onclick: () => openItem(raw.id) },
          h('div.item-time', it.time ? [it.approx ? h('span.approx', '≈') : null, it.time] : h('span.tbd-time', '—:—')),
          h('div.item-icon', seg ? segIcon(seg) : type.icon),
          h('div.item-body',
            raw.id === nextId && h('span.next-badge', 'Следующее'),
            h('div.item-title', it.title),
            it.details && !it._masked && h('div.item-details', it.details),
            seg && !it._masked && seg.dep && h('div.item-details', `${seg.fromName} → ${seg.toName}`),
            hintChips(hintsFor(it)),
            h('div.item-meta',
              tbd && h('span.tag.tbd', 'уточнить'),
              optOut && h('span.tag', 'не выбран'),
              docsN ? h('span.tag.doc', `📎 ${docsN}`) : null,
              raw._local && h('span.tag.local', 'изменено')))));
      return el;
    });
    return h('section.day' + (isToday ? '.today' : '') + (isPast ? '.past' : ''), { 'data-date': d.date },
      h('div.day-head',
        h('div.day-date', h('span.day-num', d.date.slice(8, 10)), h('span.day-wd', weekday(d.date))),
        h('div.day-info',
          h('div.day-title', dayMonth(d.date), isToday && h('span.today-badge', 'Сегодня')),
          h('div.day-sub', [city && `${city.flag || ''} ${city.name}`, d.title].filter(Boolean).join(' · '))),
        h('button.day-add', { 'aria-label': 'Добавить пункт', onclick: () => editItem({}, d.date, true) }, '+')),
      h('div.day-items', items));
  });

  root.replaceChildren(header, soonBox, h('div.days', days), h('div.tl-end', '❄️  С Новым годом!  ❄️'));
}

/** Прокрутка к «сейчас»: к следующему пункту, иначе к сегодняшнему дню. */
export function scrollToNow(root, smooth = false) {
  const today = tripParts(now()).date;
  const dayEl = root.querySelector(`.day[data-date="${today}"]`);
  if (!dayEl) return; // до или после поездки — остаёмся наверху
  const id = nextItemId();
  let target = id && root.querySelector(`.item[data-id="${id}"]`);
  if (!target) target = dayEl;
  const y = target.getBoundingClientRect().top + root.scrollTop - root.getBoundingClientRect().top - 90;
  root.scrollTo({ top: Math.max(0, y), behavior: smooth ? 'smooth' : 'auto' });
}
