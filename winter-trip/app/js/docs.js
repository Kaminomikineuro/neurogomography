// Вкладка «Документы»: папки, загрузка с телефона, просмотр, QR.
import { h, fmtBytes, ddmm } from './util.js';
import { pick, toast, confirmBox } from './ui.js';
import * as M from './model.js';
import { openDoc } from './viewer.js';
import { docActions, chooseFiles, docIcon, linkDoc, TYPES, segIcon } from './details.js';

let folder = 'all';

export async function addFilesFlow() {
  const files = await chooseFiles();
  if (!files.length) return;
  let target = folder !== 'all' ? folder : null;
  if (!target) {
    target = await pick('В какую папку?', [{ value: 'auto', icon: '✨', label: 'Определить по имени файла' }, ...M.FOLDERS.map((f) => ({ value: f.id, icon: f.icon, label: f.name }))]);
    if (!target) return;
  }
  const added = [];
  for (const f of files) {
    if (f.size > 60 * 1048576 && !(await confirmBox('Большой файл', `${f.name} — ${fmtBytes(f.size)}. Точно добавить?`))) continue;
    added.push(await M.addDoc(f, target === 'auto' ? null : target));
  }
  if (!added.length) return;
  toast(added.length > 1 ? `Добавлено файлов: ${added.length}` : 'Файл добавлен');
  if (added.length === 1 && (await confirmBox('Привязать файл?', 'К пункту ленты, поезду или городу — тогда он откроется одним тапом оттуда.', { ok: 'Привязать', cancel: 'Позже' })))
    await linkDoc(added[0]);
}

function linkSummary(d) {
  const t = M.trip();
  return (d.links || []).map((l) => {
    if (l.k === 'city') return t.cityById[l.id] ? `${t.cityById[l.id].flag || ''} ${t.cityById[l.id].name}` : null;
    if (l.k === 'seg') { const s = t.segById[l.id]; return s ? `${segIcon(s)} ${s.fromName} → ${M.maskSeg(s).toName}` : null; }
    const it = t.itemById[l.id];
    return it ? `${(TYPES[it.type] || TYPES.note).icon} ${ddmm(it._date)} ${M.maskItem(it).title}` : null;
  }).filter(Boolean).join(' · ');
}

export async function renderDocs(root) {
  const all = M.S.docs;
  const visible = all.filter((d) => !M.docHidden(d));
  const hiddenN = all.length - visible.length;
  const list = (folder === 'all' ? visible : visible.filter((d) => d.folder === folder)).sort((a, b) => b.added - a.added);
  const count = (id) => visible.filter((d) => d.folder === id).length;
  const usage = h('span.muted', '…');

  root.replaceChildren(
    h('header.page-head', h('h1', 'Документы'), h('div.page-sub', 'Хранятся только на этом телефоне · ', usage)),
    h('button.btn.primary.big.wide', { onclick: addFilesFlow }, '＋ Добавить файл'),
    h('div.folder-grid',
      h('button.folder' + (folder === 'all' ? '.active' : ''), { onclick: () => { folder = 'all'; renderDocs(root); } }, h('span.folder-ic', '🗂️'), h('span.folder-name', 'Все'), h('span.folder-n', visible.length)),
      M.FOLDERS.map((f) => h('button.folder' + (folder === f.id ? '.active' : ''), { onclick: () => { folder = f.id; renderDocs(root); } },
        h('span.folder-ic', f.icon), h('span.folder-name', f.name), h('span.folder-n', count(f.id))))),
    list.length
      ? h('div.doc-list', list.map((d) => h('div.doc-card',
          h('button.doc-card-main', { onclick: () => openDoc(d.id) },
            h('span.doc-card-ic', docIcon(d)),
            h('span.doc-card-text', h('span.doc-card-name', d.name), h('small.muted', [fmtBytes(d.size), linkSummary(d) || 'не привязан'].join(' · ')))),
          h('button.icon-btn', { onclick: () => openDoc(d.id, { qr: true }), 'aria-label': 'Показать QR' }, '▣'),
          h('button.icon-btn', { onclick: () => docActions(d.id), 'aria-label': 'Действия' }, '⋯'))))
      : h('div.empty',
          h('div.empty-ic', '📭'),
          h('p', folder === 'all' ? 'Пока ни одного файла.' : 'В этой папке пусто.'),
          h('p.muted.small', 'Добавьте PDF билетов, брони и скриншоты QR-кодов. В интернет они не попадают — только в память этого телефона. Чтобы перенести на второй телефон — «Настройки → Обмен».')),
    hiddenN ? h('div.secret-row', `🎁 Секретных файлов: ${hiddenN}`) : null,
    h('div.tip', '💡 Посадочные талоны продублируйте в Apple Wallet / Google Wallet, а PDF — копией в «Файлы». Подробнее — в настройках.'));

  try {
    const est = await navigator.storage?.estimate?.();
    const docsSize = all.reduce((a, d) => a + (d.size || 0), 0);
    usage.textContent = `файлы ${fmtBytes(docsSize)}` + (est && est.quota ? ` · свободно ~${fmtBytes(Math.max(0, est.quota - est.usage))}` : '');
  } catch (e) {
    usage.textContent = '';
  }
}
