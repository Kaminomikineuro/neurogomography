// Ссылки «Открыть в навигаторе». Навигацию ведёт внешнее приложение — мы даём точку.
import { h, platform } from './util.js';
import { S } from './model.js';

export const NAVS = {
  google: { name: 'Google Maps', icon: '🗺️', url: (p) => `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}` },
  organic: { name: 'Organic Maps', icon: '🍃', url: (p) => `om://map?v=1&ll=${p.lat},${p.lng}&n=${encodeURIComponent(p.name || '')}` },
  apple: { name: 'Apple Maps', icon: '🍎', url: (p) => `maps://?ll=${p.lat},${p.lng}&q=${encodeURIComponent(p.name || 'Точка')}`, only: 'ios' },
  geo: { name: 'Выбрать приложение', icon: '📍', url: (p) => `geo:${p.lat},${p.lng}?q=${p.lat},${p.lng}(${encodeURIComponent(p.name || '')})`, only: 'android' },
};

export function defaultNav() {
  const n = S.settings.nav;
  if (n && n !== 'auto' && NAVS[n]) return n;
  return platform.ios ? 'apple' : platform.android ? 'geo' : 'google';
}
export const availableNavs = () =>
  Object.entries(NAVS).filter(([, v]) => !v.only || (v.only === 'ios' ? platform.ios : v.only === 'android' ? platform.android : true) || (!platform.ios && !platform.android));

export function openNav(key, p) {
  const url = NAVS[key].url(p);
  if (url.startsWith('http')) window.open(url, '_blank', 'noopener');
  else window.location.href = url;
}

/** Блок кнопок: большая — навигатор по умолчанию, маленькие — остальные. */
export function navButtons(p, { compact = false } = {}) {
  if (p == null || p.lat == null || p.lng == null) return null;
  const def = defaultNav();
  const others = availableNavs().filter(([k]) => k !== def);
  return h('div.nav-buttons' + (compact ? '.compact' : ''),
    h('button.btn.nav-main', { onclick: (e) => { e.stopPropagation(); openNav(def, p); } }, compact ? `${NAVS[def].icon} Навигатор` : `${NAVS[def].icon} Открыть в навигаторе · ${NAVS[def].name}`),
    !compact && h('div.nav-others', others.map(([k, v]) => h('button.chip', { onclick: (e) => { e.stopPropagation(); openNav(k, p); } }, `${v.icon} ${v.name}`))));
}
