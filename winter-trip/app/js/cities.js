// Вкладка «Города»: карточки городов по порядку маршрута.
import { h, ddmm, plural, tripParts, now, isTbd } from './util.js';
import * as M from './model.js';
import { openCity } from './details.js';

export function renderCities(root) {
  const t = M.trip();
  const today = tripParts(now()).date;
  const order = ['berlin', 'rostock', 'hamburg', 'dresden', 'prague', 'vienna', 'bratislava', 'cologne', 'dusseldorf', 'phantasialand'];
  const cities = [...t.cities].sort((a, b) => (a.from + (order.indexOf(a.id) + 10)).localeCompare(b.from + (order.indexOf(b.id) + 10)));
  root.replaceChildren(
    h('header.page-head', h('h1', 'Города'), h('div.page-sub', `${t.cities.filter((c) => c.kind === 'stay').length} остановок · ${t.cities.filter((c) => c.kind === 'daytrip').length} поездки на день`)),
    h('div.city-list', cities.map((c0) => {
      const c = M.maskCity(c0);
      const here = today >= c.from && today <= c.to;
      const kind = { stay: plural(c.nights || 0, 'ночь', 'ночи', 'ночей'), daytrip: 'на день', transit: 'проездом' }[c.kind];
      return h('button.city-card.' + c.kind + (here ? '.here' : ''), { onclick: () => openCity(c.id) },
        h('div.cc-left', h('div.cc-flag', c.flag || '📍'), h('div.cc-dates', c.kind === 'transit' ? '18 · 21.12' : c.from === c.to ? ddmm(c.from) : `${ddmm(c.from)}–${ddmm(c.to)}`)),
        h('div.cc-body',
          h('div.cc-name', c.name, here && h('span.today-badge', 'Мы здесь')),
          h('div.cc-local', c.local),
          c.hotel && h('div.cc-hotel' + (isTbd(c.hotel.name) ? '.tbd' : ''), '🏨 ' + c.hotel.name),
          h('div.cc-meta', h('span.pill', kind), M.docsFor('city', c.id).length ? h('span.pill', `📎 ${M.docsFor('city', c.id).length}`) : null)),
        h('div.cc-arrow', '›'));
    })),
    h('div.section.emergency', h('a.btn.danger.wide', { href: 'tel:112' }, '🆘 112 — экстренная служба в ЕС')));
}
