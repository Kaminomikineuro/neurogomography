// Студия «Белая кровь». Локальный сервер без зависимостей.
// Запуск: node studio/server.mjs  →  http://localhost:4545
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const STUDIO = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(STUDIO);
const DATA = path.join(STUDIO, 'data');
const MEDIA = path.join(STUDIO, 'media');
const QUEUE = path.join(STUDIO, 'queue');
const EXPORT = path.join(STUDIO, 'export');
const INBOX = path.join(STUDIO, 'inbox.md');
const LIBRARY = path.join(ROOT, 'Аниме', 'Иллюстрации книги');
const IMG_RX = /\.(png|jpe?g|webp)$/i;

const rel = (abs) => path.relative(ROOT, abs).split(path.sep).join('/');
const abs = (r) => path.join(ROOT, ...r.split('/'));
const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const readJSON = (p, def) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : def);
function writeJSON(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 1) + '\n');
  fs.renameSync(tmp, p);
}
const safe = (s) => String(s).replace(/[\\/:*?"<>|\s]+/g, '_');

const config = () => readJSON(path.join(STUDIO, 'config.json'), {});
const project = () => readJSON(path.join(DATA, 'project.json'), {});
const epPath = (id) => path.join(DATA, 'episodes', safe(id) + '.json');
const labPath = path.join(DATA, 'stylelab.json');

function listEpisodes() {
  const dir = path.join(DATA, 'episodes');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => {
    const e = readJSON(path.join(dir, f));
    return { id: e.id, title: e.title };
  });
}

// ---------- адресация объектов: кадр, персонаж, локация, проба стиля ----------
// ref = { kind: 'shot', ep, id } | { kind: 'character', id } | { kind: 'location', id } | { kind: 'lab', id: 'style|ep|shot' }
function open(ref) {
  if (ref.kind === 'shot') {
    const p = epPath(ref.ep);
    const ep = readJSON(p);
    if (!ep) throw new Error('Нет серии ' + ref.ep);
    for (const sc of ep.scenes) {
      const item = sc.shots.find((s) => s.id === ref.id);
      if (item) return { item, scene: sc, ep, save: () => writeJSON(p, ep), dir: path.join(MEDIA, safe(ref.ep), safe(ref.id)) };
    }
    throw new Error('Нет кадра ' + ref.id);
  }
  if (ref.kind === 'character' || ref.kind === 'location') {
    const p = path.join(DATA, 'project.json');
    const pr = readJSON(p);
    const list = ref.kind === 'character' ? pr.characters : pr.locations;
    const item = list.find((c) => c.id === ref.id);
    if (!item) throw new Error('Не найдено: ' + ref.id);
    return { item, project: pr, save: () => writeJSON(p, pr), dir: path.join(MEDIA, ref.kind === 'character' ? 'characters' : 'locations', safe(ref.id)) };
  }
  if (ref.kind === 'lab') {
    const lab = readJSON(labPath, { items: {} });
    const item = (lab.items[ref.id] ||= { versions: [], selected: null });
    const [style, ep, id] = ref.id.split('|');
    return { item, save: () => writeJSON(labPath, lab), dir: path.join(MEDIA, 'stylelab', safe(style), safe(ep + '_' + id)) };
  }
  throw new Error('Неизвестный тип ' + ref.kind);
}

function findShot(epId, shotId) {
  try { return open({ kind: 'shot', ep: epId, id: shotId }); } catch { return null; }
}
const selectedFile = (item) => (item && item.selected != null && item.versions?.[item.selected] ? item.versions[item.selected].file : null);

// ---------- сборка промпта ----------
function charName(c) { return c.token.split(',')[0].trim(); }

function checkRules(pr, text) {
  const out = [];
  for (const r of pr.rules || []) {
    const ok = r.when.every((w) => new RegExp(w, 'i').test(text));
    if (ok && !(r.unless && new RegExp(r.unless, 'i').test(text))) out.push(r.msg);
  }
  return out;
}

function buildPrompt(ref, opts = {}) {
  const pr = project();
  const chars = Object.fromEntries(pr.characters.map((c) => [c.id, c]));
  const locs = Object.fromEntries(pr.locations.map((l) => [l.id, l]));
  let styleId = opts.style || pr.activeStyle;
  const refs = [];
  const warnings = [];
  const addRef = (file, role) => { if (file && !refs.some((r) => r.file === file) && fs.existsSync(abs(file))) refs.push({ file, role }); };
  let raw = '', lines = [], charIds = [], locId = null;

  const o = open(ref);
  const item = o.item;
  if (opts.edit && selectedFile(item)) addRef(selectedFile(item), 'CURRENT VERSION — edit this image');

  if (ref.kind === 'shot' || ref.kind === 'lab') {
    let s = item, scene = o.scene, epId = ref.ep;
    if (ref.kind === 'lab') {
      const [st, ep, id] = ref.id.split('|');
      styleId = st; epId = ep;
      const so = findShot(ep, id);
      if (!so) throw new Error('Нет кадра для пробы ' + id);
      s = so.item; scene = so.scene;
    }
    raw = s.img;
    if (!raw && s.imgFrom) {
      const from = findShot(epId, s.imgFrom);
      raw = from?.item.img || '';
      if (from && !opts.edit) addRef(selectedFile(from.item), 'base frame of the same shot — keep composition, change only what the description asks');
    }
    if (!raw) {
      raw = `key animation frame. ${s.frame || ''} ${s.vid ? 'Moment: ' + s.vid : ''}`.trim();
      warnings.push('У кадра нет своего IMG-промпта — собран из описания. Лучше дописать IMG.');
    }
    charIds = s.characters || [];
    locId = s.location || scene?.location;
    for (const r of s.refs || []) addRef(r.file, `reference illustration for this shot${r.note ? ' (' + r.note + ')' : ''} — follow its composition and mood, redraw in the requested style`);
  } else if (ref.kind === 'character') {
    raw = item.sheetPrompt || `anime character model sheet of ${item.token}, front, side and back views, expressions, plain white background, labeled ${item.id}`;
    raw += ', STYLE';
    for (const r of item.refs || []) addRef(r.file, `book illustration of ${charName(item)}${r.note ? ' (' + r.note + ')' : ''} — follow this design: shape, face, hair, costume and colors. Do NOT copy its rendering or painting style — redraw it in the anime style described in the prompt, as a clean model sheet, not copying the composition`);
    if (item.refs?.length) raw += '. Base the character design on the attached book illustrations';
  } else if (ref.kind === 'location') {
    raw = `wide establishing background plate, ${item.prompt}, ${item.palette || ''}, empty scene without characters, STYLE`;
    for (const r of item.refs || []) addRef(r.file, `book illustration of this place${r.note ? ' (' + r.note + ')' : ''} — follow its architecture and mood`);
    if (item.id !== 'desert') addRef(selectedFile(locs.desert), 'world style reference — match its painting style, color and level of detail (not its content)');
  }

  const style = pr.styles.find((x) => x.id === styleId) || pr.styles[0];
  let text = raw.replace(/\[([A-Z ]+)\]/g, (m, id) => (chars[id] ? charName(chars[id]) : m));
  text = text.replace(/PAL-[A-Z]+/g, (m) => pr.palettes[m]?.text || m);
  if (/\bSTYLE\b/.test(text)) text = text.replace(/\bSTYLE\b/, style.text);
  else text += ', ' + style.text;
  const loc = locs[locId];
  if (loc && !/PAL-/.test(raw) && pr.palettes[loc.palette]) text += ', ' + pr.palettes[loc.palette].text;
  lines.push(text);

  if (loc) {
    addRef(selectedFile(loc), `location "${loc.name}" — keep its architecture, layout and palette`);
    lines.push(`Location: ${loc.prompt.replace(/,?\s*(no people|no characters|empty scene[^,]*)/gi, '')}.`);
  }
  const cl = [];
  for (const id of charIds) {
    const c = chars[id];
    if (!c) continue;
    const f = selectedFile(c);
    addRef(f, `character sheet: ${charName(c)} — match face, hair, outfit and proportions exactly`);
    const ill = !f && c.refs?.[0]?.file;
    if (ill) addRef(ill, `book illustration of ${charName(c)} — match appearance`);
    cl.push(`- ${charName(c)}: ${c.token}${f || ill ? ' (see reference)' : ''}`);
    if (ill) warnings.push(`У «${c.name}» нет листа персонажа — пока беру иллюстрацию книги. Лист даст результат стабильнее.`);
    else if (!f) warnings.push(`Нет листа персонажа «${c.name}» — внешность может «поплыть». Сначала сделай его во вкладке «Персонажи».`);
  }
  if (cl.length) lines.push('Characters:\n' + cl.join('\n'));
  if (loc && !selectedFile(loc)) warnings.push(`Нет референса локации «${loc.name}». Сначала сделай фон во вкладке «Локации».`);

  if (ref.kind === 'shot' || ref.kind === 'lab') lines.push('Format: ' + pr.format + '.');
  lines.push('Avoid: ' + pr.negative + '.');
  if (opts.note) {
    lines.push(opts.edit
      ? `REVISION of the CURRENT VERSION image. Apply exactly this change: ${opts.note}. Everything the change does not mention stays as in the current version. If the change asks for a different style, rendering or level of detail, follow the change and the style line above.`
      : `Additional direction: ${opts.note}`);
  }
  warnings.unshift(...checkRules(pr, raw + ' ' + (opts.note || '')));
  return { prompt: lines.join('\n\n'), refs: refs.slice(0, 6), warnings, style: style.id };
}

function codexInstruction(p, outAbs) {
  const refList = p.refs.map((r, i) => `  Image ${i + 1}: ${r.role}`).join('\n');
  return [
    'You are the image artist of an anime studio. Use your built-in image generation tool to create exactly ONE image.',
    p.refs.length ? `The attached images are references:\n${refList}` : 'There are no reference images.',
    `Save the final image as PNG to this exact path (create folders if needed):\n  ${outAbs}`,
    'If the tool saved it somewhere else (for example ~/.codex/generated_images), copy it to that path.',
    'Do not change any other files. Do not commit. Your final answer is just the saved path.',
    '',
    'IMAGE PROMPT:',
    p.prompt,
  ].join('\n');
}

// ---------- очередь заданий ----------
const jobs = [];
let running = 0;
const reserved = new Set();

function nextOut(dir, ext = '.png', prefix = 'v') {
  fs.mkdirSync(dir, { recursive: true });
  const rx = new RegExp(`^${prefix}(\\d+)\\.`);
  const used = fs.readdirSync(dir).map((f) => rx.exec(f)?.[1]).filter(Boolean).map(Number);
  let n = Math.max(0, ...used) + 1;
  while (reserved.has(path.join(dir, `${prefix}${String(n).padStart(3, '0')}`))) n++;
  const base = path.join(dir, `${prefix}${String(n).padStart(3, '0')}`);
  reserved.add(base);
  return base + ext;
}

function label(ref) {
  return ref.kind === 'shot' ? `${ref.ep} · кадр ${ref.id}` : ref.kind === 'lab' ? `проба ${ref.id.replace(/\|/g, ' · ')}` : `${ref.kind === 'character' ? 'персонаж' : 'локация'} ${ref.id}`;
}

function addVersion(ref, file, meta) {
  const o = open(ref);
  o.item.versions ||= [];
  o.item.versions.push({ file, at: now(), ...meta });
  o.item.selected = o.item.versions.length - 1;
  if (ref.kind === 'shot') o.item.status = 'review';
  o.save();
  logInbox(`${label(ref)} — новая версия ${path.basename(file)} (${meta.by})${meta.note ? ': «' + meta.note + '»' : ''}`);
}

function logInbox(line) {
  if (!fs.existsSync(INBOX)) fs.writeFileSync(INBOX, '# Журнал студии\n\nСюда студия пишет все правки и решения. Claude читает его, чтобы держать канон и логику.\n\n');
  fs.appendFileSync(INBOX, `- [${now()}] ${line}\n`);
}

function enqueue(ref, opts) {
  const cfg = config();
  const p = buildPrompt(ref, opts);
  const o = open(ref);
  const out = nextOut(o.dir);
  const job = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ref, label: label(ref), status: 'queued',
    generator: opts.generator || cfg.generator || 'manual', note: opts.note || '', edit: !!opts.edit, opts,
    prompt: p.prompt, refs: p.refs, warnings: p.warnings, style: p.style, out: rel(out), log: '', createdAt: now(),
  };
  jobs.unshift(job);
  if (jobs.length > 300) jobs.length = 300;
  if (opts.note) logInbox(`${label(ref)} — правка: «${opts.note}»`);
  pump();
  return job;
}

function pump() {
  const max = config().maxParallel || 1;
  for (const job of [...jobs].reverse()) {
    if (running >= max) break;
    if (job.status !== 'queued') continue;
    running++;
    job.status = 'running';
    job.startedAt = now();
    run(job).catch((e) => { job.status = 'failed'; job.log += '\n' + (e.stack || e); })
      .finally(() => { running--; reserved.delete(abs(job.out).replace(/\.\w+$/, '')); job.finishedAt = now(); pump(); });
  }
}

async function run(job) {
  if (job.generator === 'codex') return runCodex(job);
  if (job.generator === 'openai') return runOpenAI(job);
  return runManual(job);
}

function runManual(job) {
  fs.mkdirSync(QUEUE, { recursive: true });
  const f = path.join(QUEUE, `${job.id}.md`);
  fs.writeFileSync(f, [
    `# Задание ${job.id}: ${job.label}`, '',
    `Сохрани результат сюда: \`${job.out}\``, '',
    '## Референсы (приложи в этом порядке)', ...job.refs.map((r, i) => `${i + 1}. \`${r.file}\` — ${r.role}`), '',
    '## Промпт', '```', job.prompt, '```', '',
  ].join('\n'));
  job.queueFile = rel(f);
  job.status = 'manual';
}

function newestIn(dir, since) {
  let best = null;
  const walk = (d) => {
    for (const e of fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(png|jpe?g|webp)$/i.test(e.name)) {
        const t = fs.statSync(p).mtimeMs;
        if (t > since && (!best || t > best.t)) best = { p, t };
      }
    }
  };
  walk(dir);
  return best?.p;
}

function quoteWin(a) { return /[\s"&|<>^()]/.test(a) ? '"' + a.replace(/"/g, '\\"') + '"' : a; }

function spawnCmd(cmd, args, opts = {}) {
  const win = process.platform === 'win32';
  return win ? spawn([cmd, ...args].map(quoteWin).join(' '), { ...opts, shell: true, windowsHide: true }) : spawn(cmd, args, opts);
}

const DEFAULT_CODEX_ARGS = ['exec', '-s', 'workspace-write', '--skip-git-repo-check', '--enable', 'image_generation'];

function killTree(pid) {
  try {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true });
    else process.kill(pid);
  } catch {}
}

function runCodex(job) {
  const cfg = config().codex || {};
  const outAbs = abs(job.out);
  const instruction = codexInstruction(job, outAbs);
  // --full-auto убран в новых версиях Codex CLI: подменяем на явную песочницу
  const base = (cfg.args || DEFAULT_CODEX_ARGS).flatMap((a) => (a === '--full-auto' ? ['-s', 'workspace-write'] : [a]));
  const args = [...base, '-C', ROOT];
  for (const r of job.refs) args.push(cfg.imageFlag || '-i', abs(r.file));
  const viaStdin = (cfg.promptVia || 'stdin') === 'stdin';
  args.push(viaStdin ? '-' : instruction);
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawnCmd(cfg.command || 'codex', args, { cwd: ROOT, env: process.env });
    job.pid = child.pid;
    const add = (b) => { job.log += b.toString(); if (job.log.length > 200000) job.log = job.log.slice(-150000); };
    child.stdout.on('data', add);
    child.stderr.on('data', add);
    child.on('error', (e) => add('\nОшибка запуска Кодекса: ' + e.message + '\nПроверь, что команда «' + (cfg.command || 'codex') + '» работает в терминале.'));
    if (viaStdin) { child.stdin.write(instruction); child.stdin.end(); }
    const timer = setTimeout(() => { add('\n⏱ Время вышло, задание остановлено.'); killTree(child.pid); }, (cfg.timeoutMin || 12) * 60000);
    child.on('close', (code) => {
      clearTimeout(timer);
      if (!fs.existsSync(outAbs)) {
        const dir = (cfg.generatedImagesDir || '~/.codex/generated_images').replace(/^~/, os.homedir());
        const found = newestIn(dir, started);
        if (found) { fs.mkdirSync(path.dirname(outAbs), { recursive: true }); fs.copyFileSync(found, outAbs); add('\nКартинка найдена в ' + found); }
      }
      fs.writeFileSync(outAbs.replace(/\.\w+$/, '.log'), instruction + '\n\n----- ВЫВОД КОДЕКСА -----\n' + job.log);
      if (fs.existsSync(outAbs)) {
        addVersion(job.ref, job.out, { by: 'codex', note: job.note, style: job.style, prompt: job.prompt });
        job.status = 'done';
      } else {
        job.status = 'failed';
        add(`\nКодекс завершился (код ${code}), но картинки нет.`);
      }
      resolve();
    });
  });
}

async function runOpenAI(job) {
  const cfg = config().openai || {};
  const key = process.env[cfg.apiKeyEnv || 'OPENAI_API_KEY'];
  if (!key) throw new Error('Нет ключа OpenAI в переменной ' + (cfg.apiKeyEnv || 'OPENAI_API_KEY'));
  let res;
  const common = { model: cfg.model || 'gpt-image-1', size: cfg.size || '1536x1024', quality: cfg.quality || 'high', n: '1' };
  if (job.refs.length) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(common)) fd.append(k, v);
    fd.append('prompt', job.refs.map((r, i) => `Image ${i + 1}: ${r.role}`).join('\n') + '\n\n' + job.prompt);
    for (const r of job.refs) {
      const ext = path.extname(r.file).slice(1).toLowerCase().replace('jpg', 'jpeg');
      fd.append('image[]', new Blob([fs.readFileSync(abs(r.file))], { type: 'image/' + ext }), path.basename(r.file));
    }
    res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: 'Bearer ' + key }, body: fd });
  } else {
    res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...common, n: 1, prompt: job.prompt }),
    });
  }
  const body = await res.json();
  if (!res.ok) throw new Error('OpenAI: ' + (body.error?.message || res.status));
  fs.mkdirSync(path.dirname(abs(job.out)), { recursive: true });
  fs.writeFileSync(abs(job.out), Buffer.from(body.data[0].b64_json, 'base64'));
  addVersion(job.ref, job.out, { by: 'openai', note: job.note, style: job.style, prompt: job.prompt });
  job.status = 'done';
}

// ---------- экспорт пакета для видео ----------
const VID_ROLE = [[/lord|повелит/i, 'LORD'], [/liam|лиам/i, 'LIAM'], [/dragon/i, 'DRAGON'], [/commander/i, 'ARDAN'], [/captain/i, 'ROY'], [/black sword/i, 'LORD SWORD']];

function exportEpisode(epId) {
  const ep = readJSON(epPath(epId));
  const pr = project();
  const chars = Object.fromEntries(pr.characters.map((c) => [c.id, c]));
  const outDir = path.join(EXPORT, safe(epId));
  fs.rmSync(outDir, { recursive: true, force: true });
  const rows = [];
  let n = 0, t = 0, missing = 0, videos = 0;
  for (const sc of ep.scenes) {
    for (const s of sc.shots) {
      if (s.cut) continue;
      n++;
      const dir = path.join(outDir, `${String(n).padStart(3, '0')}_${safe(s.id)}`);
      fs.mkdirSync(dir, { recursive: true });
      let key = selectedFile(s), keyFrom = s.id;
      if (!key && s.imgFrom) { key = selectedFile(findShot(epId, s.imgFrom)?.item); keyFrom = s.imgFrom; }
      if (!key && !/@Image/.test(s.vid || '')) {
        // кадр «только видео»: продолжаем с последнего нарисованного кадра сцены
        const prev = sc.shots.slice(0, sc.shots.indexOf(s)).reverse().find((x) => selectedFile(x));
        if (prev) { key = selectedFile(prev); keyFrom = prev.id; }
      }
      if (key) fs.copyFileSync(abs(key), path.join(dir, 'keyframe' + path.extname(key)));
      else missing++;
      const video = selectedVideo(s);
      if (video) { fs.copyFileSync(abs(video), path.join(dir, 'video' + path.extname(video))); videos++; }
      const imgs = [];
      for (const m of (s.vid || '').matchAll(/@Image(\d) \(([^)]+)\)/g)) {
        const id = VID_ROLE.find(([rx]) => rx.test(m[2]))?.[1];
        const f = id && selectedFile(chars[id]);
        if (f) { fs.copyFileSync(abs(f), path.join(dir, `Image${m[1]}_${safe(id)}${path.extname(f)}`)); imgs.push(`@Image${m[1]} = ${chars[id].name} (файл Image${m[1]}_${safe(id)})`); }
      }
      fs.writeFileSync(path.join(dir, 'prompt.txt'), [
        `Кадр ${s.id} · ${s.dur || '?'} с · ${s.camera} · ${s.tool || 'инструмент не выбран'}`,
        `Сцена ${sc.n}: ${sc.title}`, '',
        `Стартовый кадр: ${key ? 'keyframe' + path.extname(key) + (keyFrom !== s.id ? ` (взят из кадра ${keyFrom})` : '') : 'НЕТ — сначала нарисуй ключевой кадр'}`,
        imgs.length ? 'Референсы:\n' + imgs.join('\n') : '', '',
        'VIDEO PROMPT:', s.vid || '', '',
        'NEGATIVE:', pr.negative, '',
        `Кадр: ${s.frame || ''}`, `Звук: ${s.sound || ''}`,
      ].join('\n'));
      t += s.dur || 0;
      rows.push(`| ${n} | ${s.id} | ${s.dur || ''} | ${s.tool || ''} | ${key ? '✓' : '—'} | ${video ? '✓' : '—'} | ${(s.sound || '').replace(/\|/g, '/')} |`);
    }
  }
  fs.writeFileSync(path.join(outDir, 'Монтажный лист.md'), [
    `# ${ep.title}`, '', `Кадров: ${n} · хронометраж ≈ ${Math.round(t / 60 * 10) / 10} мин · без ключевого кадра: ${missing} · с видео: ${videos}`, '',
    '| № | Кадр | с | Инструмент | Картинка | Видео | Звук |', '|---|---|---|---|---|---|---|', ...rows, '',
  ].join('\n'));
  return { dir: rel(outDir), shots: n, missing, videos };
}

// ---------- HTTP ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.log': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime' };
const VIDEO_EXT = { 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov' };
const selectedVideo = (s) => (s && s.videoSelected != null && s.videos?.[s.videoSelected] ? s.videos[s.videoSelected].file : null);

// видео пишем на диск потоком, чтобы не держать сотни мегабайт в памяти
async function saveStream(req, out, limit = 600e6) {
  const tmp = out + '.part';
  const ws = fs.createWriteStream(tmp);
  let size = 0;
  try {
    for await (const c of req) {
      size += c.length;
      if (size > limit) throw new Error('Видео больше 600 МБ — сожми его перед загрузкой');
      if (!ws.write(c)) await new Promise((r) => ws.once('drain', r));
    }
    await new Promise((r, j) => ws.end((e) => (e ? j(e) : r())));
    fs.renameSync(tmp, out);
  } catch (e) {
    ws.destroy();
    fs.rmSync(tmp, { force: true });
    throw e;
  }
}

function send(res, code, data, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data));
}

async function body(req, limit = 60e6) {
  const chunks = [];
  let size = 0;
  for await (const c of req) { size += c.length; if (size > limit) throw new Error('Файл слишком большой'); chunks.push(c); }
  return Buffer.concat(chunks);
}

function serveFile(res, file, req) {
  if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, 'Нет файла', 'text/plain; charset=utf-8');
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const size = fs.statSync(file).size;
  // видео в браузере перематывается кусками (Range), без этого плеер не даёт крутить ролик
  const m = /bytes=(\d*)-(\d*)/.exec(req?.headers.range || '');
  if (m) {
    const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    if (start >= size || start > end) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); return res.end(); }
    res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Cache-Control': 'no-cache' });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}

function openInOS(p) {
  const cmd = process.platform === 'win32' ? 'explorer' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const c = spawn(cmd, [p], { detached: true, stdio: 'ignore' });
  c.on('error', () => console.log('  Открой в браузере: ' + p));
  c.unref();
}

const routes = {
  'GET /api/state': () => {
    const cfg = config();
    const bookDir = path.join(STUDIO, 'canon', 'book');
    const book = fs.existsSync(bookDir) ? fs.readdirSync(bookDir).filter((f) => f.endsWith('.txt')).sort() : [];
    return { project: project(), episodes: listEpisodes(), generator: cfg.generator, lab: readJSON(labPath, { items: {} }), book };
  },
  'GET /api/episode': (q) => readJSON(epPath(q.get('id'))),
  'POST /api/preview': (q, b) => buildPrompt(b.ref, b.opts || {}),
  'POST /api/generate': (q, b) => {
    const refs = b.refs || [b.ref];
    return refs.map((ref) => enqueue(ref, b.opts || {}));
  },
  'GET /api/jobs': () => jobs.map(({ log, prompt, ...j }) => ({ ...j, logTail: log.slice(-1500) })),
  'GET /api/job': (q) => jobs.find((j) => j.id === q.get('id')) || null,
  'POST /api/version/delete': (q, b) => {
    const o = open(b.ref);
    const video = b.slot === 'video';
    const listKey = video ? 'videos' : 'versions', selKey = video ? 'videoSelected' : 'selected';
    const vs = o.item[listKey] || [];
    const v = vs[b.index];
    if (!v) throw new Error('Нет такой версии');
    vs.splice(b.index, 1);
    if (o.item[selKey] === b.index) o.item[selKey] = vs.length ? vs.length - 1 : null;
    else if (o.item[selKey] > b.index) o.item[selKey]--;
    if (video && !vs.length) delete o.item.videoStatus;
    if (!video && b.ref.kind === 'shot' && !vs.length) o.item.status = 'todo';
    o.save();
    // файл удаляем, только если его нарисовала студия; исходники в «Аниме/» не трогаем
    if (v.file.startsWith('studio/media/')) {
      for (const f of [abs(v.file), abs(v.file).replace(/\.\w+$/, '.log')]) fs.rmSync(f, { force: true });
    }
    logInbox(`${label(b.ref)} — удалена версия ${path.basename(v.file)}`);
    return o.item;
  },
  'POST /api/job/retry': (q, b) => {
    const j = jobs.find((x) => x.id === b.id);
    if (!j) throw new Error('Задание не найдено — нажми «Нарисовать» в карточке ещё раз');
    return enqueue(j.ref, { ...(j.opts || {}), generator: b.generator || j.generator });
  },
  'POST /api/job/cancel': (q, b) => {
    const j = jobs.find((x) => x.id === b.id);
    if (j && j.status === 'queued') { j.status = 'cancelled'; reserved.delete(abs(j.out).replace(/\.\w+$/, '')); }
    if (j && j.status === 'running' && j.pid) killTree(j.pid);
    if (j && j.status === 'manual') j.status = 'cancelled';
    return j;
  },
  'POST /api/update': (q, b) => {
    const o = open(b.ref);
    const allowed = ['img', 'vid', 'frame', 'sound', 'location', 'characters', 'status', 'selected', 'notes', 'cut', 'tool', 'dur', 'camera', 'token', 'sheetPrompt', 'prompt', 'palette', 'name', 'refs', 'canon', 'group', 'videoSelected', 'videoStatus'];
    for (const [k, v] of Object.entries(b.patch || {})) if (allowed.includes(k)) o.item[k] = v;
    o.save();
    if (b.patch?.status === 'approved') logInbox(`${label(b.ref)} — утверждён (${path.basename(selectedFile(o.item) || '')})`);
    if (b.patch?.videoStatus === 'approved') logInbox(`${label(b.ref)} — видео утверждено (${path.basename(selectedVideo(o.item) || '')})`);
    if (b.patch?.notes) logInbox(`${label(b.ref)} — заметка для Claude: «${b.patch.notes}»`);
    return o.item;
  },
  'POST /api/project': (q, b) => {
    const p = path.join(DATA, 'project.json');
    const pr = readJSON(p);
    if (b.activeStyle) { pr.activeStyle = b.activeStyle; logInbox(`Активный стиль: ${b.activeStyle}`); }
    if (b.style) { const s = pr.styles.find((x) => x.id === b.style.id); if (s) Object.assign(s, b.style); else pr.styles.push(b.style); }
    if (b.palette) pr.palettes[b.palette.id] = { name: b.palette.name, text: b.palette.text };
    writeJSON(p, pr);
    return pr;
  },
  'POST /api/add': (q, b) => {
    const p = path.join(DATA, 'project.json');
    const pr = readJSON(p);
    const list = b.kind === 'character' ? pr.characters : pr.locations;
    if (list.some((x) => x.id === b.item.id)) throw new Error('Такой id уже есть');
    list.push({ versions: [], selected: null, ...b.item });
    writeJSON(p, pr);
    logInbox(`Добавлен(а) ${b.kind === 'character' ? 'персонаж' : 'локация'} ${b.item.id}`);
    return b.item;
  },
  'POST /api/export': (q, b) => exportEpisode(b.ep),
  'GET /api/library': () => {
    // все картинки, которые можно взять референсом: иллюстрации книги + материалы аниме
    const out = [];
    const walk = (d) => {
      for (const e of fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (IMG_RX.test(e.name)) out.push({ file: rel(p), folder: rel(d).replace(/^Аниме\//, ''), size: fs.statSync(p).size });
      }
    };
    walk(path.join(ROOT, 'Аниме'));
    return out;
  },
  'POST /api/open': (q, b) => { const p = abs(b.path); if (!p.startsWith(ROOT)) throw new Error('Нельзя'); openInOS(p); return { ok: true }; },
  'GET /api/check': () => new Promise((resolve) => {
    const cfg = config();
    if (cfg.generator !== 'codex') return resolve({ ok: true, text: 'Генератор: ' + cfg.generator });
    let out = '';
    const c = spawnCmd(cfg.codex?.command || 'codex', ['--version'], {});
    c.stdout.on('data', (d) => (out += d)); c.stderr.on('data', (d) => (out += d));
    c.on('error', (e) => resolve({ ok: false, text: 'Кодекс не найден: ' + e.message }));
    c.on('close', (code) => resolve({ ok: code === 0, text: out.trim() || 'код ' + code }));
  }),
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const key = `${req.method} ${url.pathname}`;
    if (key === 'POST /api/library/upload') {
      // иллюстрация из книги: браузер уже уменьшил её, сервер только сохраняет
      const name = path.basename(url.searchParams.get('name') || 'illustration.jpg').replace(/[\\/:*?"<>|]/g, '_');
      const buf = await body(req);
      fs.mkdirSync(LIBRARY, { recursive: true });
      let out = path.join(LIBRARY, name);
      for (let i = 2; fs.existsSync(out); i++) out = path.join(LIBRARY, name.replace(/(\.\w+)$/, ` (${i})$1`));
      fs.writeFileSync(out, buf);
      logInbox(`Иллюстрация добавлена в библиотеку: ${rel(out)}`);
      return send(res, 200, { file: rel(out) });
    }
    if (key === 'POST /api/video/upload') {
      const ref = JSON.parse(url.searchParams.get('ref'));
      if (ref.kind !== 'shot') throw new Error('Видео бывает только у кадра');
      const ext = VIDEO_EXT[(req.headers['content-type'] || '').split(';')[0]] || '.mp4';
      const o = open(ref);
      const out = nextOut(o.dir, ext, 'video');
      try { await saveStream(req, out); } finally { reserved.delete(out.replace(/\.\w+$/, '')); }
      const o2 = open(ref);
      o2.item.videos ||= [];
      o2.item.videos.push({ file: rel(out), at: now(), by: url.searchParams.get('by') || 'загружено вручную', name: url.searchParams.get('name') || '' });
      o2.item.videoSelected = o2.item.videos.length - 1;
      delete o2.item.videoStatus;
      o2.save();
      logInbox(`${label(ref)} — новое видео ${path.basename(out)} (${(fs.statSync(out).size / 1e6).toFixed(1)} МБ)`);
      return send(res, 200, o2.item);
    }
    if (key === 'POST /api/upload') {
      const ref = JSON.parse(url.searchParams.get('ref'));
      const type = req.headers['content-type'] || '';
      const ext = type.includes('jpeg') ? '.jpg' : type.includes('webp') ? '.webp' : '.png';
      const buf = await body(req);
      const out = nextOut(open(ref).dir, ext);
      fs.writeFileSync(out, buf);
      reserved.delete(out.replace(/\.\w+$/, ''));
      addVersion(ref, rel(out), { by: 'загружено вручную', note: url.searchParams.get('note') || '' });
      for (const j of jobs) if (j.status === 'manual' && JSON.stringify(j.ref) === JSON.stringify(ref)) j.status = 'done';
      return send(res, 200, open(ref).item);
    }
    if (routes[key]) {
      const b = req.method === 'POST' ? JSON.parse((await body(req, 5e6)).toString() || '{}') : null;
      return send(res, 200, await routes[key](url.searchParams, b));
    }
    if (url.pathname.startsWith('/files/')) return serveFile(res, path.resolve(ROOT, decodeURIComponent(url.pathname.slice(7))), req);
    const f = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    return serveFile(res, path.resolve(STUDIO, 'public', decodeURIComponent(f)));
  } catch (e) {
    send(res, 400, { error: e.message });
  }
});

const port = Number(process.env.PORT) || config().port || 4545;
server.on('error', (e) => {
  if (e.code !== 'EADDRINUSE') throw e;
  console.log(`\n  Студия уже запущена: http://localhost:${port}\n`);
  openInOS(`http://localhost:${port}`);
  setTimeout(() => process.exit(0), 500);
});
server.listen(port, '127.0.0.1', () => {
  console.log(`\n  Студия «Белая кровь» работает: http://localhost:${port}\n  Генератор: ${config().generator}. Закрой это окно, чтобы остановить.\n`);
  if (process.argv.includes('--open')) openInOS(`http://localhost:${port}`);
});
