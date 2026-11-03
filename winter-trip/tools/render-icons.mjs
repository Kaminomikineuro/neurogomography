// Рисует PNG-иконки из app/icons/icon.svg (нужен Playwright + Chromium).
//   node tools/render-icons.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../app/icons/icon.svg', import.meta.url), 'utf8');
const square = svg.replace('rx="112"', 'rx="0"'); // iOS и maskable скругляют сами
const out = (n) => new URL('../app/icons/' + n, import.meta.url).pathname;

const browser = await chromium.launch();
const page = await browser.newPage();
async function shot(markup, size, file, pad = 0, transparent = false) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:${transparent ? 'transparent' : '#17142B'}">
    <div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:${transparent ? 'transparent' : '#17142B'}">
      <div style="width:${size - pad * 2}px;height:${size - pad * 2}px">${markup.replace('<svg ', '<svg width="100%" height="100%" ')}</div></div></body></html>`);
  await page.screenshot({ path: out(file), omitBackground: transparent });
}
await shot(svg, 192, 'icon-192.png', 0, true);
await shot(svg, 512, 'icon-512.png', 0, true);
await shot(square, 180, 'apple-touch-icon.png');
await shot(square, 512, 'icon-maskable-512.png', 0);
await browser.close();
console.log('icons ok');
