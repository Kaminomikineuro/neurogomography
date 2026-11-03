// Собирает «пакет» для импорта в приложение: PDF/картинки + привязки + данные броней.
// Пакет НЕ кладётся в репозиторий — он передаётся владельцу файлом и импортируется на телефоне
// (⚙️ → «Импорт .zip»). Импорт пакета ничего не заменяет, только добавляет.
//
//   node tools/make-pack.mjs <папка с pack.json и файлами> [выходной.zip]
//
// pack.json:
// {
//   "title": "Билеты и брони",
//   "withSecrets": true,
//   "files": [
//     { "file": "DB_EC179.pdf", "name": "Поезд Дрезден → Прага.pdf", "folder": "trains",
//       "links": [{ "k": "seg", "id": "dre-pra" }], "secret": null }
//   ],
//   "patches": { "seg:dre-pra": { "number": "EC 179", "coach": "254", "seat": "61", "status": "booked" } }
// }
// folder: flights | trains | hotels | park | visa | other;  links.k: item | seg | city
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, extname, basename } from 'node:path';
import { zipSync, strToU8 } from '../app/vendor/fflate/fflate.mjs';

const dir = process.argv[2];
if (!dir) {
  console.error('Укажите папку: node tools/make-pack.mjs <папка> [out.zip]');
  process.exit(1);
}
const out = process.argv[3] || join(dir, 'paket-dlya-prilozheniya.zip');
const pack = JSON.parse(readFileSync(join(dir, 'pack.json'), 'utf8'));
const trip = JSON.parse(readFileSync(new URL('../app/data/trip.json', import.meta.url), 'utf8'));

// проверяем, что привязки и правки указывают на существующие объекты
const known = new Set([
  ...trip.cities.map((c) => 'city:' + c.id), ...trip.segments.map((s) => 'seg:' + s.id),
  ...trip.days.flatMap((d) => d.items.map((i) => 'item:' + i.id)), ...trip.reminders.map((r) => 'rem:' + r.id),
  ...trip.days.map((d) => 'day:' + d.date),
]);
const errors = [];
for (const key of Object.keys(pack.patches || {})) if (!known.has(key) && !(pack.patches[key] || {})._new) errors.push('Нет объекта для правки: ' + key);

const TYPES = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.heic': 'image/heic', '.pkpass': 'application/vnd.apple.pkpass' };
const FOLDERS = new Set(['flights', 'trains', 'hotels', 'park', 'visa', 'other']);
const files = {};
const docs = [];
for (const f of pack.files || []) {
  const bytes = readFileSync(join(dir, f.file));
  for (const l of f.links || []) if (!known.has(`${l.k}:${l.id}`)) errors.push(`${f.file}: нет объекта ${l.k}:${l.id}`);
  if (!FOLDERS.has(f.folder)) errors.push(`${f.file}: неизвестная папка «${f.folder}»`);
  // id от содержимого — повторный импорт того же файла заменит его, а не задублирует
  const id = 'p' + createHash('sha256').update(bytes).digest('hex').slice(0, 14);
  docs.push({ id, name: f.name || basename(f.file), type: TYPES[extname(f.file).toLowerCase()] || 'application/octet-stream', size: bytes.length, folder: f.folder, added: Date.now(), links: f.links || [], ...(f.secret ? { secret: f.secret } : {}) });
  files['docs/' + id] = [new Uint8Array(bytes), { level: 0 }];
}
if (errors.length) {
  console.error('Ошибки:\n  ' + errors.join('\n  '));
  process.exit(1);
}
files['manifest.json'] = strToU8(JSON.stringify({ app: 'winter-trip', format: 1, kind: 'pack', title: pack.title || 'Пакет документов', created: new Date().toISOString(), withSecrets: !!pack.withSecrets, docs: docs.length }));
files['overlay.json'] = strToU8(JSON.stringify({ patches: pack.patches || {} }));
files['docs/index.json'] = strToU8(JSON.stringify(docs));
writeFileSync(out, zipSync(files, { level: 6 }));
console.log(`Пакет: ${out}\n  файлов ${docs.length}, правок ${Object.keys(pack.patches || {}).length}`);
