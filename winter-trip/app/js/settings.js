// Настройки: тема, навигатор, секреты, обмен с Аней, trip.json, хранилище, проверка.
import { h, fmtBytes, platform, shareOrDownload, setNowOverride, download } from './util.js';
import { form, confirmBox, toast, pick } from './ui.js';
import * as M from './model.js';
import * as db from './db.js';
import { NAVS, availableNavs, openNav } from './nav.js';
import { liveSheet, askPin } from './details.js';
import { openReminders } from './reminders.js';

export const APP_VERSION = '1.0.0';

export const openSettings = () => liveSheet((close) => settingsView(close), { full: true });

const seg = (value, options, onPick) =>
  h('div.segmented', options.map(([v, l]) => h('button' + (v === value ? '.active' : ''), { onclick: () => onPick(v) }, l)));

function settingsView(close) {
  const st = M.S.settings;
  const storage = h('div.muted.small', 'Считаю…');
  const persistLine = h('div.small', '');
  fillStorage(storage, persistLine);
  const stamp = new Date(M.S.baseInfo.at || Date.now()).toLocaleDateString('ru-RU');

  return h('div.detail.settings',
    h('div.detail-head', h('div.detail-icon', '⚙️'), h('div', h('div.detail-when', `версия ${APP_VERSION} · план rev ${M.S.base.revision}`), h('h2.detail-title', 'Настройки'))),

    !platform.standalone && h('div.section.install',
      h('h3', '📲 Установить на телефон'),
      platform.ios
        ? h('p', 'Safari → кнопка «Поделиться» ', h('b', '⬆︎'), ' → ', h('b', '«На экран Домой»'), '. Открывайте приложение с иконки — так данные хранятся надёжнее, чем во вкладке браузера.')
        : platform.android
          ? h('p', 'Chrome → меню ⋮ → ', h('b', '«Установить приложение»'), ' (или «Добавить на гл. экран»).')
          : h('p', 'Откройте эту страницу на телефоне и добавьте на главный экран.')),

    h('div.section', h('h3', '🎨 Тема'),
      seg(st.theme, [['auto', 'Как в системе'], ['dark', 'Тёмная'], ['light', 'Светлая']], (v) => { st.theme = v; M.saveSettings(); })),

    h('div.section', h('h3', '🧭 Навигатор по умолчанию'),
      h('div.pick-list', [['auto', { name: 'Автоматически', icon: '✨' }], ...availableNavs()].map(([k, v]) =>
        h('button.pick-item' + (st.nav === k ? '.active' : ''), { onclick: () => { st.nav = k; M.saveSettings(); } },
          h('span.pick-icon', v.icon), h('span.pick-text', h('span', v.name), k === 'auto' && h('small.muted', platform.ios ? 'Apple Maps' : platform.android ? 'выбор приложения (geo:)' : 'Google Maps')),
          st.nav === k ? h('span', '✓') : null))),
      h('button.btn', { onclick: async () => {
        const k = await pick('Проверить ссылку (Кёльнский собор)', availableNavs().map(([k, v]) => ({ value: k, icon: v.icon, label: v.name })));
        if (k) openNav(k, { lat: 50.9413, lng: 6.9583, name: 'Kölner Dom' });
      } }, 'Проверить навигаторы'),
      h('p.muted.small', 'Без интернета навигатор работает, только если заранее скачаны карты: Google Maps — «Офлайн-карты» (области городов), Organic Maps — регионы Германии, Чехии, Австрии, Словакии. Apple Maps тоже умеет скачивать карты (iOS 17+).')),

    h('div.section', h('h3', '🎁 Секреты'),
      h('p.small', st.pinHash ? (st.unlocked ? '🔓 Секреты открыты на этом телефоне.' : '🔒 Секреты скрыты до даты раскрытия.') : 'PIN не задан. Секретные пункты откроются только в дату раскрытия.'),
      h('div.row-buttons',
        h('button.btn', { onclick: async () => {
          const r = await form(st.pinHash ? 'Сменить PIN' : 'Задать PIN', [{ name: 'pin', label: 'Новый PIN (4–8 цифр)', type: 'password', inputmode: 'numeric', autofocus: true }]);
          if (!r) return;
          if (!/^\d{4,8}$/.test(r.pin)) return toast('Нужно 4–8 цифр');
          await M.setPin(r.pin);
          toast('PIN сохранён');
        } }, st.pinHash ? 'Сменить PIN' : 'Задать PIN'),
        st.pinHash && !st.unlocked && h('button.btn', { onclick: askPin }, '🔑 Открыть'),
        st.unlocked && h('button.btn', { onclick: () => M.lock().then(() => toast('Секреты снова скрыты')) }, '🔒 Скрыть')),
      h('p.muted.small', 'Это «шторка», а не сейф: на телефоне, куда импортирован файл «с секретами», данные лежат внутри. Для Ани экспортируйте «без секретов» — тогда их на её телефоне просто нет.')),

    h('div.section', h('h3', '🔄 Обмен с Аней'),
      h('p.small', 'Весь план, отметки и файлы — в один .zip. Отправьте его в Telegram и импортируйте на втором телефоне.'),
      h('div.row-buttons',
        h('button.btn.primary', { onclick: () => exportFlow(false) }, '🎁 Для Ани (без секретов)'),
        h('button.btn', { onclick: () => exportFlow(true) }, 'Полный (с секретами)')),
      h('button.btn.wide', { onclick: importZipFlow }, '⬇︎ Импорт .zip')),

    h('div.section', h('h3', '🔔 Напоминания'), h('button.btn.wide', { onclick: openReminders }, 'Открыть напоминания и экспорт .ics')),

    h('div.section', h('h3', '🗂 План (trip.json)'),
      h('p.small', `Ревизия ${M.S.base.revision} · ${M.S.baseInfo.source === 'import' ? 'импортирован' : 'из приложения'} ${stamp}. Локальных правок: ${M.localCount()}.`),
      h('div.row-buttons',
        h('button.btn', { onclick: async () => {
          const withS = await pick('Экспорт trip.json', [
            { value: 'no', icon: '🎁', label: 'Без секретов', sub: 'Чтобы прислать Claude для правок — файл может попасть в публичный репозиторий' },
            { value: 'yes', icon: '🔐', label: 'С секретами', sub: 'Только для себя' }]);
          if (!withS) return;
          const text = M.exportTripJson(withS === 'yes');
          await shareOrDownload(new Blob([text], { type: 'application/json' }), 'trip.json', 'trip.json');
        } }, '⬆︎ Экспорт'),
        h('button.btn', { onclick: importJsonFlow }, '⬇︎ Импорт')),
      M.localCount() > 0 && h('button.link-row.muted', { onclick: async () => {
        if (await confirmBox('Сбросить все правки?', 'План вернётся к trip.json. Отметки и файлы останутся.', { ok: 'Сбросить', danger: true })) M.resetAllLocal();
      } }, '↺ Сбросить все локальные правки')),

    h('div.section', h('h3', '💾 Хранилище'), storage, persistLine,
      h('button.btn', { onclick: async () => {
        const ok = await navigator.storage?.persist?.();
        toast(ok ? 'Постоянное хранилище включено' : 'Браузер не дал гарантию — см. подсказку ниже');
        fillStorage(storage, persistLine);
      } }, 'Запросить постоянное хранилище'),
      h('p.muted.small', platform.ios
        ? 'iPhone: приложение с экрана «Домой» хранит данные отдельно от Safari и не очищается через 7 дней, как сайты. Но при нехватке памяти iOS может удалить данные — держите копию .zip в «Файлах» или Telegram.'
        : 'Android: после установки на главный экран Chrome обычно сразу даёт постоянное хранилище. Копия .zip в Telegram — страховка.')),

    h('div.section', h('h3', '💳 Wallet и «Файлы»'),
      h('p.small', '1) Посадочные талоны добавьте в Apple Wallet / Google Wallet прямо из приложения авиакомпании.'),
      h('p.small', '2) PDF билетов сохраните копией в «Файлы» (iPhone) или «Загрузки»/Google Drive офлайн (Android).'),
      h('p.small', '3) Перед вылетом сделайте свежий экспорт .zip — это резервная копия всего.')),

    h('div.section', h('h3', '🧪 Проверка'),
      h('label.field', h('span.field-label', 'Тестовое «сейчас» (чтобы проверить ленту и напоминания)'),
        h('input', { type: 'datetime-local', value: st.nowOverride || '', onchange: (e) => { st.nowOverride = e.target.value; setNowOverride(st.nowOverride); M.saveSettings(); } })),
      st.nowOverride && h('button.btn', { onclick: () => { st.nowOverride = ''; setNowOverride(null); M.saveSettings(); } }, 'Вернуть настоящее время'),
      h('button.btn', { onclick: checkOffline }, 'Проверить офлайн-готовность')),

    h('div.section', h('h3', 'Сброс'),
      h('button.btn.danger.wide', { onclick: async () => {
        if (!(await confirmBox('Стереть всё с этого телефона?', 'План, правки, отметки и все файлы будут удалены. Сначала сделайте экспорт .zip!', { ok: 'Стереть', danger: true }))) return;
        await db.docClearAll();
        for (const k of ['base', 'overlay', 'checks', 'settings', 'baseInfo']) await db.kvDel(k);
        location.reload();
      } }, 'Стереть все данные')),
    h('button.btn.ghost.wide', { onclick: close }, 'Закрыть'));
}

async function fillStorage(el, persistEl) {
  try {
    const est = await navigator.storage?.estimate?.();
    const docs = M.S.docs.reduce((a, d) => a + (d.size || 0), 0);
    el.textContent = `Файлов: ${M.S.docs.length}, ${fmtBytes(docs)}` + (est ? ` · всего занято ${fmtBytes(est.usage || 0)} из ~${fmtBytes(est.quota || 0)}` : '');
    const p = await navigator.storage?.persisted?.();
    persistEl.textContent = p ? '✅ Постоянное хранилище: да' : '⚠️ Постоянное хранилище: не подтверждено';
  } catch (e) {
    el.textContent = 'Браузер не сообщает размер хранилища';
  }
}

async function exportFlow(withSecrets) {
  const docs = M.S.docs.filter((d) => withSecrets || !M.docSecret(d));
  const size = docs.reduce((a, d) => a + d.size, 0);
  const withDocs = docs.length
    ? await pick(withSecrets ? 'Полный экспорт' : 'Экспорт для Ани', [
        { value: 'yes', icon: '📎', label: `План + файлы (${docs.length}, ${fmtBytes(size)})`, sub: 'Чтобы не загружать всё дважды' },
        { value: 'no', icon: '🗒', label: 'Только план и отметки', sub: 'Маленький файл' }])
    : 'no';
  if (!withDocs) return;
  toast('Упаковываю…');
  try {
    const blob = await M.exportZip({ withSecrets, withDocs: withDocs === 'yes' });
    const date = new Date().toISOString().slice(0, 10);
    const name = `zimniy-marshrut-${withSecrets ? 'polnyi' : 'dlya-ani'}-${date}.zip`;
    const r = await shareOrDownload(blob, name, 'Зимний маршрут');
    if (r === 'downloaded') toast(platform.android ? 'Сохранено в «Загрузки» — отправьте файл в Telegram' : 'Файл сохранён');
  } catch (e) {
    toast('Не получилось: ' + e.message, 5000);
  }
}

function fileInput(accept) {
  return new Promise((resolve) => {
    const i = h('input', { type: 'file', accept, style: { display: 'none' } });
    i.addEventListener('change', () => { resolve(i.files[0] || null); i.remove(); });
    document.body.append(i);
    i.click();
  });
}

async function importZipFlow() {
  const f = await fileInput('.zip,application/zip,application/x-zip-compressed');
  if (!f) return;
  let z;
  try {
    z = await M.readZip(f);
  } catch (e) {
    return toast(e.message || 'Не удалось прочитать файл', 4000);
  }
  if (z.manifest.kind === 'pack') {
    const ok = await confirmBox('Пакет документов',
      `${z.manifest.title || 'Файлы и данные броней'}: файлов ${z.docs.length}, правок плана ${Object.keys(z.overlay?.patches || {}).length}. ` +
      'Всё добавится к тому, что уже есть на телефоне: ваши правки и отметки останутся. Повторный импорт того же пакета не создаст дублей.',
      { ok: 'Добавить' });
    if (!ok) return;
    await M.applyZip(z);
    return toast(`Добавлено файлов: ${z.docs.length}`);
  }
  const mine = M.S.settings.pinHash && !z.manifest.withSecrets;
  const ok = await confirmBox('Импортировать?',
    `План rev ${z.manifest.revision}, файлов: ${z.docs.length}, создан ${new Date(z.manifest.created).toLocaleString('ru-RU')}. ${z.manifest.withSecrets ? 'С секретами.' : 'Без секретов.'} ` +
    'План, правки и отметки на этом телефоне заменятся. Файлы добавятся к уже имеющимся.' +
    (mine ? ' ⚠️ На этом телефоне задан PIN — похоже, это телефон с секретами. Импорт «без секретов» заменит их заглушками!' : ''),
    { ok: 'Импортировать', danger: mine });
  if (!ok) return;
  await M.applyZip(z);
  toast('Готово! Импортировано');
}

async function importJsonFlow() {
  const f = await fileInput('.json,application/json');
  if (!f) return;
  try {
    const text = await f.text();
    const keep = await pick('Мои правки в приложении', [
      { value: 'keep', icon: '🧷', label: 'Оставить поверх нового плана', sub: 'Например, адреса и секреты, добавленные на телефоне' },
      { value: 'drop', icon: '🧹', label: 'Сбросить', sub: 'Будет ровно как в файле' }]);
    if (!keep) return;
    await M.importTripJson(text, keep === 'keep');
    toast('План обновлён');
  } catch (e) {
    toast('Ошибка в trip.json: ' + e.message, 5000);
  }
}

async function checkOffline() {
  const lines = [];
  lines.push(navigator.serviceWorker?.controller ? '✅ Офлайн-режим активен (service worker)' : '❌ Service worker ещё не управляет страницей — перезапустите приложение');
  try {
    const keys = await caches.keys();
    let n = 0;
    for (const k of keys) n += (await (await caches.open(k)).keys()).length;
    lines.push(n > 30 ? `✅ В кэше файлов приложения: ${n}` : `⚠️ В кэше мало файлов: ${n}`);
    const pdf = await caches.match('vendor/pdfjs/pdf.worker.min.mjs', { ignoreSearch: true });
    lines.push(pdf ? '✅ Просмотрщик PDF сохранён офлайн' : '❌ Просмотрщик PDF не в кэше');
  } catch (e) {
    lines.push('⚠️ Кэш недоступен: ' + e.message);
  }
  lines.push((await navigator.storage?.persisted?.()) ? '✅ Постоянное хранилище' : '⚠️ Постоянное хранилище не подтверждено');
  lines.push(platform.standalone ? '✅ Запущено с главного экрана' : '⚠️ Открыто во вкладке браузера — установите на главный экран');
  await confirmBox('Офлайн-готовность', lines.join('\n'), { ok: 'Понятно', cancel: 'Закрыть' });
}

export { download };
