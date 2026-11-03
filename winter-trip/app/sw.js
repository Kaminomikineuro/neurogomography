// Сгенерировано tools/gen-sw.mjs — не редактировать вручную.
// Service worker: кэширует ВСЁ приложение при установке, дальше работает без сети.
const VERSION = '11d45e274989';
const CACHE = 'winter-trip-' + VERSION;
const ASSETS = ["./",
  "css/app.css",
  "css/fonts.css",
  "data/trip.json",
  "fonts/OFL.txt",
  "fonts/cormorant-garamond-cyrillic-500-italic.woff2",
  "fonts/cormorant-garamond-cyrillic-500-normal.woff2",
  "fonts/cormorant-garamond-cyrillic-600-normal.woff2",
  "fonts/cormorant-garamond-cyrillic-700-normal.woff2",
  "fonts/cormorant-garamond-latin-500-italic.woff2",
  "fonts/cormorant-garamond-latin-500-normal.woff2",
  "fonts/cormorant-garamond-latin-600-normal.woff2",
  "fonts/cormorant-garamond-latin-700-normal.woff2",
  "fonts/cormorant-garamond-latin-ext-500-normal.woff2",
  "fonts/cormorant-garamond-latin-ext-600-normal.woff2",
  "fonts/cormorant-garamond-latin-ext-700-normal.woff2",
  "fonts/rubik-cyrillic-400-normal.woff2",
  "fonts/rubik-cyrillic-500-normal.woff2",
  "fonts/rubik-cyrillic-600-normal.woff2",
  "fonts/rubik-latin-400-normal.woff2",
  "fonts/rubik-latin-500-normal.woff2",
  "fonts/rubik-latin-600-normal.woff2",
  "fonts/rubik-latin-ext-400-normal.woff2",
  "fonts/rubik-latin-ext-500-normal.woff2",
  "fonts/rubik-latin-ext-600-normal.woff2",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/icon.svg",
  "index.html",
  "js/app.js",
  "js/cities.js",
  "js/db.js",
  "js/details.js",
  "js/docs.js",
  "js/map-data.js",
  "js/map.js",
  "js/model.js",
  "js/nav.js",
  "js/reminders.js",
  "js/settings.js",
  "js/timeline.js",
  "js/ui.js",
  "js/util.js",
  "js/viewer.js",
  "manifest.webmanifest",
  "vendor/fflate/fflate.mjs",
  "vendor/pdfjs/pdf.min.mjs",
  "vendor/pdfjs/pdf.worker.min.mjs",
  "vendor/pdfjs/standard_fonts/FoxitDingbats.pfb",
  "vendor/pdfjs/standard_fonts/FoxitFixed.pfb",
  "vendor/pdfjs/standard_fonts/FoxitFixedBold.pfb",
  "vendor/pdfjs/standard_fonts/FoxitFixedBoldItalic.pfb",
  "vendor/pdfjs/standard_fonts/FoxitFixedItalic.pfb",
  "vendor/pdfjs/standard_fonts/FoxitSerif.pfb",
  "vendor/pdfjs/standard_fonts/FoxitSerifBold.pfb",
  "vendor/pdfjs/standard_fonts/FoxitSerifBoldItalic.pfb",
  "vendor/pdfjs/standard_fonts/FoxitSerifItalic.pfb",
  "vendor/pdfjs/standard_fonts/FoxitSymbol.pfb",
  "vendor/pdfjs/standard_fonts/LICENSE_FOXIT",
  "vendor/pdfjs/standard_fonts/LICENSE_LIBERATION",
  "vendor/pdfjs/standard_fonts/LiberationSans-Bold.ttf",
  "vendor/pdfjs/standard_fonts/LiberationSans-BoldItalic.ttf",
  "vendor/pdfjs/standard_fonts/LiberationSans-Italic.ttf",
  "vendor/pdfjs/standard_fonts/LiberationSans-Regular.ttf"];

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
