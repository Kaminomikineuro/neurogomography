#!/usr/bin/env node
// Deterministic HTML → MP4 renderer for the motion-design skill.
// Idea and contract follow mg-styles-15/harness/render.mjs (MIT, Vincentwei1021); this is a compact rewrite.
//
// The film page (<dir>/index.html) must, before setting `window.__ready = true`, define:
//   window.DEMO = { width, height, fps, duration }   // optional; CLI flags override
//   window.renderAt = async (t) => { ... }            // draw the frame for time t (seconds); pure function of t
// CSS animations / WAAPI on the page are paused and seeked to t automatically as well.
//
// Usage:
//   node render.mjs <dir>                          full render → <dir>/out/video.mp4 (muxes <dir>/out/audio.wav if present)
//   node render.mjs <dir> --stills 0.5,2,5         PNG stills → <dir>/out/stills/t_0.500.png
//   node render.mjs <dir> --sheet 0.5              contact sheet PNG (one frame every 0.5 s) → <dir>/out/sheet.png
// Options:
//   --out FILE  --audio FILE  --noaudio  --page index.html
//   --w 1920 --h 1080 --fps 30 --duration 10       override window.DEMO
//   --scale 0.5                                    preview at reduced resolution (output size scales too)
//   --from 0 --to 10                               render a time range only
//   --mb 4 --shutter 0.5                           motion blur: N sub-frames over a 180° shutter, averaged
//   --workers 4                                    parallel browser pages (default: min(4, CPUs))
//   --crf 16  --preset slow                        x264 quality
//   --gif                                          also write <out>.gif (palette-optimised, max 720 px wide)
// Env: MG_CHROME=/path/to/chrome (else Playwright's bundled Chromium; /opt/pw-browsers/chromium is tried too)

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// ---------- args ----------
const argv = process.argv.slice(2);
if (!argv.length || argv[0] === '-h' || argv[0] === '--help') {
  console.log(fs.readFileSync(new URL(import.meta.url)).toString().split('\n').filter(l => l.startsWith('//')).join('\n'));
  process.exit(0);
}
const dir = path.resolve(argv[0]);
const args = {};
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) continue;
  const k = a.slice(2);
  const v = argv[i + 1];
  if (v === undefined || v.startsWith('--')) args[k] = true; else { args[k] = v; i++; }
}
const pageName = args.page || 'index.html';
if (!fs.existsSync(path.join(dir, pageName))) { console.error(`no ${pageName} in ${dir}`); process.exit(1); }
const outDir = path.join(dir, 'out');
fs.mkdirSync(outDir, { recursive: true });

// ---------- browser ----------
function loadChromium() {
  const tries = ['playwright', 'playwright-core', '@playwright/test'];
  for (const m of tries) { try { return require(m).chromium; } catch {} }
  // global installs
  try {
    const root = require('child_process').execSync('npm root -g').toString().trim();
    for (const m of tries) { try { return require(path.join(root, m)).chromium; } catch {} }
  } catch {}
  console.error('Playwright not found. Install it: npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}

// ---------- static server (serve from repo root so /assets and /node_modules resolve) ----------
function findRoot(start) {
  let d = start;
  while (d !== path.dirname(d)) { if (fs.existsSync(path.join(d, '.git'))) return d; d = path.dirname(d); }
  return start;
}
const ROOT = findRoot(dir);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.hdr': 'application/octet-stream' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/${path.relative(ROOT, path.join(dir, pageName)).split(path.sep).map(encodeURIComponent).join('/')}`;

function ffmpeg(a, opts = {}) {
  const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...a], { stdio: ['pipe', 'inherit', 'inherit'], ...opts });
  p.done = new Promise((res, rej) => p.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));
  return p;
}

const chromium = loadChromium();
const launchOpts = { args: ['--force-color-profile=srgb', '--hide-scrollbars', '--font-render-hinting=none', '--disable-lcd-text', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] };
if (process.env.MG_CHROME) launchOpts.executablePath = process.env.MG_CHROME;
async function launch() {
  try { return await chromium.launch(launchOpts); }
  catch (e) {
    const exe = ['/opt/pw-browsers/chromium/chrome', '/opt/pw-browsers/chromium'].find(f => fs.existsSync(f) && fs.statSync(f).isFile());
    if (exe) return chromium.launch({ ...launchOpts, executablePath: exe });
    throw e;
  }
}
const browsers = [];
const browser = await launch(); browsers.push(browser);

try {
  // probe config
  const probe = await browser.newPage();
  probe.on('pageerror', e => console.error('[page error]', e.message));
  probe.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text()); });
  await probe.goto(url, { waitUntil: 'load' });
  await probe.waitForFunction('window.__ready === true', null, { timeout: 120000 });
  const cfg = await probe.evaluate(() => window.DEMO || {});
  await probe.close();

  const W0 = +(args.w || cfg.width || 1920), H0 = +(args.h || cfg.height || 1080);
  const FPS = +(args.fps || cfg.fps || 30), DUR = +(args.duration || cfg.duration || 10);
  const SCALE = +(args.scale || 1);
  const MB = Math.max(1, Math.round(+(args.mb || 1)));
  const SHUTTER = +(args.shutter ?? 0.5);
  const W = Math.round(W0 * SCALE / 2) * 2, H = Math.round(H0 * SCALE / 2) * 2;

  async function openPage(b = browser) {
    const page = await b.newPage({ viewport: { width: W0, height: H0 }, deviceScaleFactor: SCALE });
    page.on('pageerror', e => console.error('[page error]', e.message));
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
    await page.evaluate(async () => { if (document.fonts) await document.fonts.ready; });
    const seek = (t) => page.evaluate(async (t) => {
      for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = t * 1000; } catch {} }
      if (typeof window.renderAt === 'function') await window.renderAt(t);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    }, t);
    const shot = () => page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: W0, height: H0 }, animations: 'allow', caret: 'initial' });
    return { page, seek, shot };
  }

  // ----- stills -----
  if (args.stills) {
    const { seek, shot } = await openPage();
    const sdir = path.join(outDir, 'stills'); fs.mkdirSync(sdir, { recursive: true });
    for (const s of String(args.stills).split(',').map(Number)) {
      await seek(s);
      const f = path.join(sdir, `t_${s.toFixed(3)}.png`);
      fs.writeFileSync(f, await shot());
      console.log('still', path.relative(process.cwd(), f));
    }
  }
  // ----- contact sheet -----
  else if (args.sheet) {
    const { seek, shot } = await openPage();
    const step = args.sheet === true ? 0.5 : (+args.sheet || 0.5);
    const tmp = fs.mkdtempSync(path.join(outDir, 'sheet-'));
    let n = 0;
    for (let t = 0; t < DUR - 1e-6; t += step) { await seek(t); fs.writeFileSync(path.join(tmp, `f${String(n++).padStart(4, '0')}.png`), await shot()); }
    const cols = Math.min(5, n), rows = Math.ceil(n / cols);
    const f = path.join(outDir, 'sheet.png');
    await ffmpeg(['-framerate', '1', '-i', path.join(tmp, 'f%04d.png'), '-vf', `scale=384:-2,tile=${cols}x${rows}:padding=4:color=black`, '-frames:v', '1', f]).done;
    fs.rmSync(tmp, { recursive: true });
    console.log('sheet', path.relative(process.cwd(), f), `(${n} frames, every ${step}s)`);
  }
  // ----- video -----
  else {
    const f0 = Math.round(+(args.from || 0) * FPS), f1 = Math.round(+(args.to || DUR) * FPS);
    const out = path.resolve(args.out || path.join(outDir, SCALE !== 1 ? 'preview.mp4' : 'video.mp4'));
    const audio = args.noaudio ? null : (args.audio ? path.resolve(args.audio) : path.join(outDir, 'audio.wav'));
    const useAudio = audio && fs.existsSync(audio);
    const WORKERS = Math.max(1, Math.min(+(args.workers || Math.min(4, os.cpus().length)), f1 - f0));
    console.log(`render ${path.relative(process.cwd(), dir) || '.'} ${W}x${H} @${FPS}fps frames ${f0}-${f1} mb=${MB} workers=${WORKERS} audio=${useAudio ? path.basename(audio) : 'none'}`);

    // Each worker renders a contiguous chunk into a lossless FFV1 segment (motion blur applied per segment),
    // then one final pass concatenates, encodes H.264 and muxes the soundtrack.
    const blur = MB > 1 ? [`tmix=frames=${MB}:weights='${Array(MB).fill(1).join(' ')}'`, `framestep=${MB}`] : [];
    const segDir = fs.mkdtempSync(path.join(outDir, 'seg-'));
    const per = Math.ceil((f1 - f0) / WORKERS);
    let done = 0; const t0 = Date.now();
    const tick = () => { done++; if (done % 10 === 0 || done === f1 - f0) process.stdout.write(`\r  ${done}/${f1 - f0} frames  ${((Date.now() - t0) / 1000).toFixed(0)}s  `); };
    const segs = await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
      const a = f0 + w * per, b = Math.min(f1, a + per);
      if (a >= b) return null;
      const seg = path.join(segDir, `seg${String(w).padStart(3, '0')}.mkv`);
      const ff = ffmpeg(['-f', 'image2pipe', '-framerate', String(FPS * MB), '-c:v', 'png', '-i', '-',
        ...(blur.length ? ['-vf', blur.join(',')] : []), '-r', String(FPS), '-c:v', 'ffv1', '-level', '3', '-pix_fmt', 'rgb24', seg]);
      // a separate browser per worker: pages of one browser share a GPU process and serialise captures
      const own = w === 0 ? browser : await launch(); if (w) browsers.push(own);
      const { page, seek, shot } = await openPage(own);
      for (let i = a; i < b; i++) {
        for (let k = 0; k < MB; k++) {
          const t = MB > 1 ? Math.max(0, (i + ((k + 0.5) / MB - 0.5) * SHUTTER) / FPS) : i / FPS;
          await seek(t);
          const buf = await shot();
          if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
        }
        tick();
      }
      ff.stdin.end(); await ff.done; await page.close();
      return seg;
    }));
    const list = path.join(segDir, 'list.txt');
    fs.writeFileSync(list, segs.filter(Boolean).map(s => `file '${s.replace(/'/g, "'\\''")}'`).join('\n'));
    const enc = ['-f', 'concat', '-safe', '0', '-i', list];
    if (useAudio) enc.push('-ss', String(f0 / FPS), '-i', audio);
    enc.push('-vf', `scale=${W}:${H}:flags=lanczos,format=yuv420p`, '-r', String(FPS), '-c:v', 'libx264', '-preset', args.preset || 'slow',
      '-crf', String(args.crf || 16), '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart');
    if (useAudio) enc.push('-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000');
    enc.push('-t', String((f1 - f0) / FPS), out);
    await ffmpeg(enc).done;
    fs.rmSync(segDir, { recursive: true });
    console.log(`\n→ ${path.relative(process.cwd(), out)}`);
    if (args.gif) {
      const gif = out.replace(/\.mp4$/, '.gif');
      const gw = Math.min(720, W);
      await ffmpeg(['-i', out, '-vf', `fps=${Math.min(FPS, 20)},scale=${gw}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a`, gif]).done;
      console.log(`→ ${path.relative(process.cwd(), gif)}`);
    }
  }
} finally {
  for (const b of browsers) await b.close().catch(() => {});
  server.close();
}
