// Генерирует app/sw.js: список всех файлов приложения для офлайн-кэша + версия (хэш содержимого).
// Запускается автоматически в GitHub Actions перед публикацией; локально: node tools/gen-sw.mjs
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = fileURLToPath(new URL('../app/', import.meta.url));
const SKIP = new Set(['sw.js', '.DS_Store']);
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (!SKIP.has(name) && !name.endsWith('.map') && name !== 'LICENSE') files.push(relative(APP, p).split(sep).join('/'));
  }
})(APP);

const hash = createHash('sha256');
for (const f of files) hash.update(f).update(readFileSync(join(APP, f)));
const version = hash.digest('hex').slice(0, 12);

const sw = `// Сгенерировано tools/gen-sw.mjs — не редактировать вручную.
// Service worker: кэширует ВСЁ приложение при установке, дальше работает без сети.
const VERSION = '${version}';
const CACHE = 'winter-trip-' + VERSION;
const ASSETS = ${JSON.stringify(['./', ...files], null, 0).replace(/","/g, '",\n  "')};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // cache: 'reload' — мимо HTTP-кэша, чтобы не сохранить старые файлы
      .then((cache) => cache.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('winter-trip-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(caches.match('index.html', { ignoreSearch: true }).then((r) => r || fetch(req)));
    return;
  }
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
`;
writeFileSync(join(APP, 'sw.js'), sw);
console.log(`sw.js: версия ${version}, файлов в кэше: ${files.length + 1}`);
