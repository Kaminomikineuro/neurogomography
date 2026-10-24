// Рисует очередь jobs.json через Кодекс по одному заданию, строго по порядку.
// Запуск из корня репозитория:  node "Иллюстрации книга/Т2 гл37-39 и Эпилог/tools/run.mjs" [37|38|39|E|all] [--redo ID] [--dry]
// Уже нарисованные файлы пропускаются, поэтому скрипт можно останавливать и запускать снова.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.dirname(HERE);
const ROOT = path.resolve(PKG, '..', '..');
const jobs = JSON.parse(fs.readFileSync(path.join(PKG, 'jobs.json'), 'utf8'));
const args = process.argv.slice(2);
const only = args.find((a) => /^(37|38|39|E|all)$/i.test(a)) || 'all';
const redo = args.includes('--redo') ? args[args.indexOf('--redo') + 1] : null;
const dry = args.includes('--dry');
const CODEX = process.env.CODEX_CMD || 'codex';
const TIMEOUT_MIN = Number(process.env.CODEX_TIMEOUT_MIN || 15);
const GEN_DIR = (process.env.CODEX_IMAGES_DIR || '~/.codex/generated_images').replace(/^~/, os.homedir());
const abs = (p) => path.join(ROOT, ...p.split('/'));

function instruction(job, outAbs) {
  const refList = job.refs.map((r, i) => `  Image ${i + 1}: ${r.role}`).join('\n');
  const isHead = job.kind === 'head';
  return [
    'You are the illustrator of a printed fantasy novel. Use your built-in image generation tool to create exactly ONE image.',
    'Use the attached images strictly for the responsibility written next to each one; never copy a pose, background, crop or costume a reference is not responsible for.',
    job.refs.length ? `Attached references, in order:\n${refList}` : 'There are no reference images.',
    '',
    'Before saving, look at the result yourself and check: correct number of people; five fingers on every visible hand; eye colors and hair (white with black roots for Liam, black with three silver hairpins on the left for the Lord); the Lord wears black gloves; no text or letters; '
      + (isHead ? 'only ONE head on white, nothing cropped.' : job.kind === 'bw' ? 'an isolated object on white, not a scene.' : (job.kind === 'frame' || job.kind === 'band') ? 'black ink on pure white, the text area is empty.' : 'all four edges dissolve into white watercolor wash.'),
    'If something fails, regenerate once with a corrected prompt. Keep the better version.',
    `Save the final image as PNG to this exact path (create folders if needed):\n  ${outAbs}`,
    `If the tool saved it somewhere else (for example ${GEN_DIR}), copy it to that path.`,
    'Do not change any other files. Do not commit. Your final answer is just the saved path and one line on what you checked.',
    '',
    'IMAGE PROMPT:',
    job.prompt,
  ].join('\n');
}

function quoteWin(a) { return /[\s"&|<>^()]/.test(a) ? '"' + a.replace(/"/g, '\\"') + '"' : a; }
function spawnCmd(cmd, a, opts) {
  return process.platform === 'win32'
    ? spawn([cmd, ...a].map(quoteWin).join(' '), { ...opts, shell: true, windowsHide: true })
    : spawn(cmd, a, opts);
}
function newestIn(dir, since) {
  let best = null;
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(png|jpe?g|webp)$/i.test(e.name)) { const t = fs.statSync(p).mtimeMs; if (t > since && (!best || t > best.t)) best = { p, t }; }
    }
  };
  walk(dir);
  return best?.p;
}
function killTree(pid) {
  try { if (process.platform === 'win32') spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true }); else process.kill(pid); } catch {}
}

function runOne(job) {
  const outAbs = abs(job.out);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  const instr = instruction(job, outAbs);
  const a = ['exec', '-s', 'workspace-write', '--skip-git-repo-check', '--enable', 'image_generation', '-C', ROOT];
  for (const r of job.refs) a.push('-i', abs(r.file));
  a.push('-');
  const started = Date.now();
  let log = '';
  return new Promise((resolve) => {
    const child = spawnCmd(CODEX, a, { cwd: ROOT, env: process.env });
    const addLog = (b) => { log += b.toString(); process.stdout.write('.'); };
    child.stdout.on('data', addLog);
    child.stderr.on('data', addLog);
    child.on('error', (e) => { log += '\nОшибка запуска Кодекса: ' + e.message; });
    child.stdin.write(instr); child.stdin.end();
    const timer = setTimeout(() => { log += '\nВремя вышло, задание остановлено.'; killTree(child.pid); }, TIMEOUT_MIN * 60000);
    child.on('close', (code) => {
      clearTimeout(timer);
      if (!fs.existsSync(outAbs)) {
        const found = newestIn(GEN_DIR, started);
        if (found) { fs.copyFileSync(found, outAbs); log += '\nКартинка найдена в ' + found; }
      }
      fs.writeFileSync(outAbs.replace(/\.png$/, '.log'), instr + '\n\n----- ВЫВОД КОДЕКСА -----\n' + log);
      resolve(fs.existsSync(outAbs) ? 'ok' : `нет картинки (код ${code})`);
    });
  });
}

const todo = jobs.filter((j) => (only === 'all' || j.chapter.toUpperCase() === only.toUpperCase()));
// Правки: fixes.json = { "37_03": "что поменять" }. С --redo ID старая версия уходит Кодексу как основа.
const fixesPath = path.join(PKG, 'fixes.json');
const fixes = fs.existsSync(fixesPath) ? JSON.parse(fs.readFileSync(fixesPath, 'utf8')) : {};
if (redo) {
  const j = jobs.find((x) => x.id === redo);
  if (!j) { console.log('Нет задания ' + redo); process.exit(1); }
  if (fs.existsSync(abs(j.out))) {
    const oldAbs = abs(j.out).replace(/\.png$/, `.old${Date.now()}.png`);
    fs.renameSync(abs(j.out), oldAbs);
    if (fixes[redo]) {
      const oldRel = path.relative(ROOT, oldAbs).split(path.sep).join('/');
      j.refs = [{ file: oldRel, role: 'PREVIOUS VERSION — the approved base: keep its composition, faces, poses, costumes, palette and edges' }, ...j.refs];
      j.prompt += `\nCORRECTION BRIEF. Keep exactly everything in Image 1 except the following. Change only: ${fixes[redo]}. Do not introduce any other changes.`;
    }
  }
  // зависимые головы тоже перерисовать
  for (const h of jobs.filter((x) => x.parent === j.out)) if (fs.existsSync(abs(h.out))) fs.renameSync(abs(h.out), abs(h.out).replace(/\.png$/, `.old${Date.now()}.png`));
}
console.log(`Кодекс: ${CODEX}. Заданий в выборке: ${todo.length}. Корень: ${ROOT}`);
let done = 0, fail = 0;
for (const j of todo) {
  if (fs.existsSync(abs(j.out))) continue;
  if (j.parent && !fs.existsSync(abs(j.parent))) { console.log(`\n⏭  ${j.id}: сначала нужна родительская картинка ${j.parent.split('/').pop()}`); continue; }
  const missing = j.refs.filter((r) => !fs.existsSync(abs(r.file)));
  if (missing.length) { console.log(`\n⚠  ${j.id}: нет референсов: ${missing.map((r) => r.file).join(', ')}`); continue; }
  process.stdout.write(`\n▶  ${j.id} — ${j.title} `);
  if (dry) { console.log('(проверка, не рисую)'); continue; }
  const res = await runOne(j);
  if (res === 'ok') { done++; console.log(' ✓'); } else { fail++; console.log(' ✗ ' + res + ' — лог рядом с файлом'); }
}
console.log(`\nГотово: нарисовано ${done}, ошибок ${fail}. Картинки: ${path.join(PKG, 'out')}`);
