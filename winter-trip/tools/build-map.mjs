// Генерирует app/js/map-data.js — стилизованную офлайн-карту Центральной Европы.
// Запуск (нужен только при изменении карты):
//   cd winter-trip/tools && npm install && node build-map.mjs
// Данные: Natural Earth через пакет world-atlas (public domain).
import { readFileSync, writeFileSync } from 'node:fs';
import { feature } from 'topojson-client';

const topo = JSON.parse(readFileSync(new URL('./node_modules/world-atlas/countries-10m.json', import.meta.url)));

// Та же проекция используется в приложении (app/js/map.js → project()).
const BBOX = { lngMin: 4.6, lngMax: 18.9, latMin: 46.9, latMax: 55.4 };
const LAT0 = 51.2;
const K = 100; // пикселей на градус широты
const COS = Math.cos((LAT0 * Math.PI) / 180);
const W = Math.round((BBOX.lngMax - BBOX.lngMin) * COS * K);
const H = Math.round((BBOX.latMax - BBOX.latMin) * K);
const project = (lng, lat) => [(lng - BBOX.lngMin) * COS * K, (BBOX.latMax - lat) * K];

const NAMES = {
  Germany: { ru: 'Германия', trip: true, label: [10.0, 51.75] },
  Czechia: { ru: 'Чехия', trip: true, label: [15.6, 49.75] },
  Austria: { ru: 'Австрия', trip: true, label: [14.2, 47.45] },
  Slovakia: { ru: 'Словакия', trip: true, label: [18.9, 48.75], hideLabel: true },
  Poland: { ru: 'Польша', label: [17.2, 52.6] },
  Denmark: { ru: 'Дания', label: [9.3, 55.25] },
  Netherlands: { ru: 'Нидерланды', label: [5.7, 52.75] },
  Belgium: { ru: 'Бельгия', label: [5.1, 50.35], hideLabel: true },
  Luxembourg: { ru: '' },
  France: { ru: 'Франция', label: [5.6, 48.1], hideLabel: true },
  Switzerland: { ru: 'Швейцария', label: [8.3, 47.15], hideLabel: true },
  Liechtenstein: { ru: '' },
  Italy: { ru: '' },
  Slovenia: { ru: '' },
  Hungary: { ru: 'Венгрия', label: [18.3, 47.35], hideLabel: true },
  Croatia: { ru: '' },
  Sweden: { ru: 'Швеция', label: [13.6, 55.6], hideLabel: true },
  Lithuania: { ru: '' },
  Russia: { ru: '' },
  Ukraine: { ru: '' },
  Belarus: { ru: '' },
};

const geo = feature(topo, topo.objects.countries);
const PAD = 1.5; // градусов запаса вокруг bbox
const inBox = ([lng, lat]) =>
  lng > BBOX.lngMin - PAD && lng < BBOX.lngMax + PAD && lat > BBOX.latMin - PAD && lat < BBOX.latMax + PAD;

function ringToPath(ring) {
  if (!ring.some(inBox)) return '';
  let out = '';
  let prev = null;
  let n = 0;
  for (const [lng0, lat0] of ring) {
    // зажимаем точки в рамку с запасом — за пределами всё равно не видно
    const lng = Math.min(Math.max(lng0, BBOX.lngMin - 0.5), BBOX.lngMax + 0.5);
    const lat = Math.min(Math.max(lat0, BBOX.latMin - 0.5), BBOX.latMax + 0.5);
    const [x, y] = project(lng, lat);
    const p = [Math.round(x * 2) / 2, Math.round(y * 2) / 2];
    if (prev && Math.abs(prev[0] - p[0]) < 1.8 && Math.abs(prev[1] - p[1]) < 1.8) continue;
    out += (n === 0 ? 'M' : 'L') + p[0] + ' ' + p[1];
    prev = p;
    n++;
  }
  return n > 3 ? out + 'Z' : '';
}

const countries = [];
for (const f of geo.features) {
  const meta = NAMES[f.properties.name];
  if (!meta) continue;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  let d = '';
  for (const poly of polys) for (const ring of poly) d += ringToPath(ring);
  if (!d) continue;
  const c = { id: f.properties.name, name: meta.ru, trip: !!meta.trip, d };
  if (meta.label && !meta.hideLabel) c.label = project(...meta.label).map((v) => Math.round(v));
  countries.push(c);
}

// Реки — упрощённые, по опорным точкам (для красоты, не для навигации).
const RIVERS = {
  Rhein: [[7.59, 47.56], [7.75, 48.58], [8.2, 48.98], [8.47, 49.49], [8.27, 50.0], [7.9, 50.08], [7.6, 50.36], [7.23, 50.6], [7.1, 50.73], [6.96, 50.94], [6.78, 51.23], [6.76, 51.43], [6.25, 51.83], [5.9, 51.9], [5.3, 51.95], [4.6, 51.9]],
  Donau: [[8.5, 47.95], [9.2, 48.08], [10.0, 48.4], [11.0, 48.75], [12.1, 49.02], [12.9, 48.83], [13.46, 48.57], [14.29, 48.3], [15.0, 48.2], [15.6, 48.4], [16.37, 48.22], [16.9, 48.13], [17.11, 48.14], [17.8, 47.75], [18.13, 47.76], [18.74, 47.79], [19.05, 47.6]],
  Elbe: [[15.6, 50.6], [15.1, 50.15], [14.47, 50.35], [14.1, 50.6], [13.74, 51.05], [13.47, 51.16], [13.0, 51.56], [12.65, 51.85], [11.64, 52.13], [11.9, 52.6], [11.75, 53.0], [10.8, 53.35], [9.99, 53.55], [9.2, 53.75], [8.7, 53.87]],
  Vltava: [[14.42, 49.3], [14.4, 49.75], [14.42, 50.08], [14.47, 50.35]],
};
function smooth(points) {
  const p = points.map(([lng, lat]) => project(lng, lat));
  let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
  for (let i = 1; i < p.length - 1; i++) {
    const mx = (p[i][0] + p[i + 1][0]) / 2;
    const my = (p[i][1] + p[i + 1][1]) / 2;
    d += `Q${p[i][0].toFixed(1)} ${p[i][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  const l = p[p.length - 1];
  return d + `L${l[0].toFixed(1)} ${l[1].toFixed(1)}`;
}
const rivers = Object.entries(RIVERS).map(([id, pts]) => ({ id, d: smooth(pts) }));

const seas = [
  { name: 'Балтийское море', at: project(13.2, 54.95) },
  { name: 'Северное море', at: project(6.6, 54.6) },
];

const out = `// Сгенерировано tools/build-map.mjs — не редактировать вручную.
// Контуры стран: Natural Earth (public domain) через world-atlas.
export const MAP = ${JSON.stringify({ bbox: BBOX, lat0: LAT0, k: K, width: W, height: H, countries, rivers, seas })};
`;
writeFileSync(new URL('../app/js/map-data.js', import.meta.url), out);
console.log('map-data.js', (out.length / 1024).toFixed(1), 'KB', W, 'x', H, countries.map((c) => c.id).join(','));
