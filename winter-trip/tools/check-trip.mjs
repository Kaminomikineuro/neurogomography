// Проверка trip.json: JSON читается, id уникальны, ссылки на города/отрезки существуют, даты в порядке.
//   node tools/check-trip.mjs
import { readFileSync } from 'node:fs';
const t = JSON.parse(readFileSync(new URL('../app/data/trip.json', import.meta.url), 'utf8'));
const errors = [];
const cities = new Set(t.cities.map((c) => c.id));
const segs = new Set(t.segments.map((s) => s.id));
const ids = new Set();
const dup = (id, what) => (ids.has(id) ? errors.push(`Повтор id «${id}» (${what})`) : ids.add(id));
const dt = /^\d{4}-\d\d-\d\dT\d\d:\d\d$/;
for (const c of t.cities) {
  dup('city:' + c.id, 'город');
  if (typeof c.lat !== 'number' || typeof c.lng !== 'number') errors.push(`Город ${c.id}: нет координат`);
}
for (const s of t.segments) {
  dup('seg:' + s.id, 'отрезок');
  for (const k of ['from', 'to']) if (s[k] && !cities.has(s[k])) errors.push(`Отрезок ${s.id}: нет города «${s[k]}»`);
  for (const k of ['dep', 'arr']) if (s[k] && !dt.test(s[k])) errors.push(`Отрезок ${s.id}: ${k} должно быть вида 2026-12-23T17:00`);
}
let prev = '';
for (const d of t.days) {
  if (d.date <= prev) errors.push(`День ${d.date} не по порядку`);
  prev = d.date;
  if (d.city && !cities.has(d.city)) errors.push(`День ${d.date}: нет города «${d.city}»`);
  for (const it of d.items) {
    dup('item:' + it.id, 'пункт');
    if (it.seg && !segs.has(it.seg)) errors.push(`Пункт ${it.id}: нет отрезка «${it.seg}»`);
    if (it.city && !cities.has(it.city)) errors.push(`Пункт ${it.id}: нет города «${it.city}»`);
    if (it.time && !/^\d\d:\d\d$/.test(it.time)) errors.push(`Пункт ${it.id}: время должно быть вида 09:30`);
  }
}
for (const r of t.reminders || []) {
  dup('rem:' + r.id, 'напоминание');
  if (r.at && !dt.test(r.at)) errors.push(`Напоминание ${r.id}: at должно быть вида 2026-12-23T17:00`);
  if (r.rel && !segs.has(r.rel.seg)) errors.push(`Напоминание ${r.id}: нет отрезка «${r.rel.seg}»`);
}
if (errors.length) {
  console.error('trip.json — ошибки:\n  ' + errors.join('\n  '));
  process.exit(1);
}
console.log(`trip.json в порядке: ревизия ${t.revision}, городов ${t.cities.length}, отрезков ${t.segments.length}, дней ${t.days.length}, пунктов ${t.days.reduce((a, d) => a + d.items.length, 0)}, напоминаний ${t.reminders.length}`);
