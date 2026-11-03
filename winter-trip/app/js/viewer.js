// Просмотр документов: PDF (локальный pdf.js), картинки, режим «Показать QR».
import { h, shareOrDownload, fmtBytes } from './util.js';
import { fullscreen, toast } from './ui.js';
import * as db from './db.js';
import { S, docHidden } from './model.js';

let pdfjsP;
function pdfjs() {
  if (!pdfjsP) {
    pdfjsP = import('../vendor/pdfjs/pdf.min.mjs').then((m) => {
      m.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
      return m;
    });
  }
  return pdfjsP;
}

let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch (e) { /* не поддерживается — не страшно */ }
}

const isPdf = (m) => m.type === 'application/pdf' || /\.pdf$/i.test(m.name);
const isImage = (m) => (m.type || '').startsWith('image/') || /\.(png|jpe?g|webp|gif|heic)$/i.test(m.name);
const MAX_PIXELS = 12e6; // ограничение памяти канваса на iPhone

async function renderPdfPages(data, container, zoom, onPage) {
  const lib = await pdfjs();
  const doc = await lib.getDocument({
    data: new Uint8Array(data.slice(0)),
    standardFontDataUrl: new URL('../vendor/pdfjs/standard_fonts/', import.meta.url).href,
    isEvalSupported: false,
  }).promise;
  const width = Math.min(container.clientWidth || innerWidth, 900) - 16;
  const dpr = Math.min(devicePixelRatio || 1, 3);
  const canvases = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const v1 = page.getViewport({ scale: 1 });
    const cssScale = (width / v1.width) * zoom;
    let scale = cssScale * dpr;
    if (v1.width * v1.height * scale * scale > MAX_PIXELS) scale = Math.sqrt(MAX_PIXELS / (v1.width * v1.height));
    const vp = page.getViewport({ scale });
    const canvas = h('canvas.pdf-page', { width: Math.floor(vp.width), height: Math.floor(vp.height) });
    canvas.style.width = Math.floor(v1.width * cssScale) + 'px';
    canvas.style.height = Math.floor(v1.height * cssScale) + 'px';
    container.append(canvas);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp, background: 'white' }).promise;
    canvases.push(canvas);
    onPage && onPage(n, doc.numPages);
  }
  return { canvases, pages: doc.numPages };
}

export async function openDoc(id, { qr = false } = {}) {
  const meta = S.docs.find((d) => d.id === id);
  if (!meta) return toast('Файл не найден на этом телефоне');
  if (docHidden(meta)) return toast('Это секрет 🎁');
  const data = await db.docData(id);
  if (!data) return toast('Файл повреждён или удалён');
  const blob = new Blob([data], { type: meta.type });
  if (qr) return showQr(meta, data, blob);

  let zoom = 1;
  let objectUrl = null;
  const scroller = h('div.viewer-scroll');
  const status = h('span.viewer-status', '');
  const render = async () => {
    scroller.replaceChildren();
    if (isPdf(meta)) {
      status.textContent = 'Открываю…';
      try {
        await renderPdfPages(data, scroller, zoom, (n, total) => (status.textContent = total > 1 ? `${n}/${total} стр.` : ''));
      } catch (e) {
        console.error(e);
        scroller.append(h('div.viewer-error', h('p', 'Не получилось показать PDF здесь.'), h('p.muted', String(e.message || e)),
          h('button.btn.primary', { onclick: () => shareOrDownload(blob, meta.name) }, 'Открыть в другом приложении')));
        status.textContent = '';
      }
    } else if (isImage(meta)) {
      objectUrl = objectUrl || URL.createObjectURL(blob);
      const img = h('img.viewer-img', { src: objectUrl, alt: meta.name });
      img.style.width = zoom * 100 + '%';
      img.addEventListener('dblclick', () => setZoom(zoom > 1 ? 1 : 2));
      img.addEventListener('error', () => scroller.replaceChildren(h('div.viewer-error',
        h('p', 'Этот формат картинки телефон не показывает (например, HEIC на Android).'),
        h('button.btn.primary', { onclick: () => shareOrDownload(blob, meta.name) }, 'Открыть в другом приложении'))));
      scroller.append(img);
    } else {
      scroller.append(h('div.viewer-error',
        h('p', `Файл «${meta.name}» (${fmtBytes(meta.size)}) здесь не открыть.`),
        h('p.muted', meta.name.endsWith('.pkpass') ? 'Это карта для Wallet — откройте её в Wallet.' : 'Откройте его в другом приложении.'),
        h('button.btn.primary', { onclick: () => shareOrDownload(blob, meta.name) }, 'Открыть в другом приложении')));
    }
  };
  const setZoom = (z) => {
    zoom = Math.max(1, Math.min(4, z));
    render();
  };

  fullscreen((close) =>
    h('div.viewer',
      h('div.viewer-bar',
        h('button.icon-btn', { onclick: close, 'aria-label': 'Закрыть' }, '✕'),
        h('div.viewer-title', h('div', meta.name), status),
        h('button.icon-btn', { onclick: () => setZoom(zoom - 0.5), 'aria-label': 'Мельче' }, '−'),
        h('button.icon-btn', { onclick: () => setZoom(zoom + 0.5), 'aria-label': 'Крупнее' }, '+')),
      scroller,
      h('div.viewer-actions',
        (isPdf(meta) || isImage(meta)) && h('button.btn.primary', { onclick: () => { close(); openDoc(id, { qr: true }); } }, '▣ Показать QR'),
        h('button.btn', { onclick: () => shareOrDownload(blob, meta.name, meta.name) }, '↗ Поделиться'))),
  { cls: 'dark', onClose: () => objectUrl && URL.revokeObjectURL(objectUrl) });
  setTimeout(render, 60);
}

/** Режим для сканера: белый фон, крупно, экран не гаснет. */
async function showQr(meta, data, blob) {
  let page = 0;
  let zoom = 1;
  let canvases = [];
  let objectUrl = null;
  const stage = h('div.qr-stage');
  const counter = h('span.qr-counter');
  const show = () => {
    const el = canvases[page];
    if (!el) return;
    // Крупнее: QR на билете часто занимает угол страницы — увеличиваем и двигаем пальцем.
    el.style.maxWidth = zoom > 1 ? 'none' : '';
    el.style.maxHeight = zoom > 1 ? 'none' : '';
    el.style.width = zoom > 1 ? zoom * 100 + '%' : '';
    stage.classList.toggle('zoomed', zoom > 1);
    stage.replaceChildren(el);
    counter.textContent = canvases.length > 1 ? `стр. ${page + 1} из ${canvases.length}` : '';
    const pg = stage.parentNode && stage.parentNode.querySelector('.qr-pager');
    if (pg) pg.style.display = canvases.length > 1 ? '' : 'none';
  };
  const setZoom = (z) => { zoom = Math.max(1, Math.min(4, z)); show(); };
  const close = fullscreen((close) =>
    h('div.qr-mode', { onclick: (e) => e.target === e.currentTarget && close() },
      stage,
      h('div.qr-bar',
        h('button.qr-btn', { onclick: () => setZoom(zoom - 1), 'aria-label': 'Мельче' }, '−'),
        h('button.qr-btn', { onclick: () => setZoom(zoom + 1), 'aria-label': 'Крупнее' }, '+'),
        h('span.qr-pager',
          h('button.qr-btn', { onclick: () => { page = Math.max(0, page - 1); show(); } }, '‹'),
          counter,
          h('button.qr-btn', { onclick: () => { page = Math.min(canvases.length - 1, page + 1); show(); } }, '›')),
        h('button.qr-btn.qr-close', { onclick: close }, 'Готово')),
      h('div.qr-hint', 'Яркость — на максимум. «+» — увеличить QR, двигать пальцем.')),
  { cls: 'white', onClose: () => { keepAwake(false); objectUrl && URL.revokeObjectURL(objectUrl); } });
  keepAwake(true);
  if (isImage(meta)) {
    objectUrl = URL.createObjectURL(blob);
    canvases = [h('img.qr-img', { src: objectUrl, alt: meta.name })];
    show();
  } else {
    stage.append(h('p', 'Готовлю…'));
    const holder = h('div', { style: { position: 'absolute', left: '-99999px', width: Math.min(innerWidth, 900) + 'px' } });
    document.body.append(holder);
    try {
      const r = await renderPdfPages(data, holder, 1.6);
      canvases = r.canvases.map((c) => {
        c.style.width = '';
        c.style.height = '';
        c.className = 'qr-img';
        return c;
      });
      show();
    } catch (e) {
      stage.replaceChildren(h('p', 'Не удалось показать PDF: ' + (e.message || e)));
    } finally {
      holder.remove();
    }
  }
  return close;
}
