// Запуск приложения: данные, вкладки, тема, офлайн (service worker).
import { $, $$, h, setNowOverride, platform, tripParts, now } from './util.js';
import * as M from './model.js';
import { toast, installBackHandler, closeAllSheets } from './ui.js';
import { renderTimeline, scrollToNow } from './timeline.js';
import { renderMap, refreshMapLayout } from './map.js';
import { renderDocs } from './docs.js';
import { renderCities } from './cities.js';
import { openSettings } from './settings.js';
import { openReminders } from './reminders.js';

const TABS = {
  feed: { render: renderTimeline },
  map: { render: renderMap },
  docs: { render: renderDocs },
  cities: { render: renderCities },
};
let current = 'feed';
const dirty = new Set(Object.keys(TABS));

function applyTheme() {
  const t = M.S.settings.theme;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('meta[name=theme-color]').setAttribute('content', dark ? '#17142B' : '#F6F1E7');
}

function render(tab = current) {
  const el = $(`#view-${tab}`);
  TABS[tab].render(el);
  dirty.delete(tab);
}

function show(tab, { scroll = false } = {}) {
  if (!TABS[tab]) tab = 'feed';
  current = tab;
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + tab));
  $$('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  if (dirty.has(tab)) render(tab);
  if (tab === 'map') requestAnimationFrame(refreshMapLayout);
  if (tab === 'feed' && scroll) requestAnimationFrame(() => scrollToNow($('#view-feed')));
  history.replaceState(history.state, '', '#' + tab);
}

async function boot() {
  const params = new URLSearchParams(location.search);
  let info;
  try {
    info = await M.load();
  } catch (e) {
    $('#splash-msg').textContent = e.message;
    return;
  }
  setNowOverride(params.get('now') || M.S.settings.nowOverride || null);
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

  M.onChange((what) => {
    if (what === 'settings') {
      applyTheme();
      setNowOverride(params.get('now') || M.S.settings.nowOverride || null);
    }
    // карту перерисовываем, только если поменялся план (отметки и файлы на ней не видны)
    Object.keys(TABS).forEach((t) => (t !== 'map' || !['checks', 'docs'].includes(what)) && dirty.add(t));
    render(current);
  });

  $$('.tab').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.tab === current && current === 'feed') scrollToNow($('#view-feed'), true);
    show(b.dataset.tab, { scroll: false });
  }));
  $('#btn-settings').addEventListener('click', openSettings);
  $('#btn-reminders').addEventListener('click', openReminders);

  installBackHandler();
  const start = (location.hash || '#feed').slice(1);
  show(start, { scroll: true });
  if (start !== 'feed') render('feed');

  if (info.updated) toast(`План обновлён до версии ${info.revision}`);
  hideSplash();

  // Обновлять «Сегодня / Следующее / Скоро» раз в минуту и при возвращении в приложение.
  let lastDay = tripParts(now()).date;
  setInterval(() => {
    if (document.hidden) return;
    dirty.add('feed');
    if (current === 'feed' && !document.querySelector('.sheet-wrap')) render('feed');
  }, 60e3);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    const d = tripParts(now()).date;
    dirty.add('feed');
    if (current === 'feed') {
      render('feed');
      if (d !== lastDay) scrollToNow($('#view-feed'));
    }
    lastDay = d;
  });

  // Постоянное хранилище: просим, когда приложение установлено (так браузеры охотнее соглашаются).
  if (platform.standalone && navigator.storage?.persist) navigator.storage.persisted().then((p) => !p && navigator.storage.persist());

  registerSW();
}

function hideSplash() {
  const s = $('#splash');
  const minShow = 900 - (performance.now() - (window.__t0 || 0));
  setTimeout(() => {
    s.classList.add('hide');
    setTimeout(() => s.remove(), 700);
  }, Math.max(0, minShow));
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    // проверяем обновления при каждом открытии (если есть сеть)
    reg.update().catch(() => {});
  }).catch((e) => console.warn('SW', e));
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return; // первая установка — ничего не говорим
    const bar = h('button.update-bar', { onclick: () => { closeAllSheets(); location.reload(); } }, '✨ Есть новая версия приложения — нажмите, чтобы обновить');
    document.body.append(bar);
  });
}

boot();
