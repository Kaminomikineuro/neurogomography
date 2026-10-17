// Студия «Белая кровь». Локальный сервер без зависимостей.
// Запуск: node studio/server.mjs  →  http://localhost:4545
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createGitSender } from './git-send.mjs';
import { createAgent } from './agent.mjs';

const STUDIO = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(STUDIO);
const DATA = path.join(STUDIO, 'data');
const MEDIA = path.join(STUDIO, 'media');
const QUEUE = path.join(STUDIO, 'queue');
const EXPORT = path.join(STUDIO, 'export');
const INBOX = path.join(STUDIO, 'inbox.md');
const LIBRARY = path.join(ROOT, 'Аниме', 'Иллюстрации книги');
const IMG_RX = /\.(png|jpe?g|webp)$/i;

// Версия кода: по ней студия узнаёт, что в фоне работает старая копия, и закрывает её
const VERSION = '2026-10-22.1';
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
  if (ref.kind === 'scene') {
    // сцена целиком: постановка, мастер-план, план сверху
    const p = epPath(ref.ep);
    const ep = readJSON(p);
    const item = ep?.scenes.find((sc) => String(sc.n) === String(ref.id));
    if (!item) throw new Error('Нет сцены ' + ref.id);
    return { item, scene: item, ep, save: () => writeJSON(p, ep), dir: path.join(MEDIA, safe(ref.ep), 'scene_' + safe(ref.id)) };
  }
  if (ref.kind === 'character' || ref.kind === 'location') {
    const p = path.join(DATA, 'project.json');
    const pr = readJSON(p);
    const list = ref.kind === 'character' ? pr.characters : pr.locations;
    const item = list.find((c) => c.id === ref.id);
    if (!item) throw new Error('Не найдено: ' + ref.id);
    return { item, project: pr, save: () => writeJSON(p, pr), dir: path.join(MEDIA, ref.kind === 'character' ? 'characters' : 'locations', safe(ref.id)) };
  }
  if (ref.kind === 'clip') {
    // связка: несколько кадров сцены одним роликом Seedance / Kling
    const p = epPath(ref.ep);
    const ep = readJSON(p);
    for (const sc of ep?.scenes || []) {
      const item = (sc.clips || []).find((c) => c.id === ref.id);
      if (item) return { item, scene: sc, ep, save: () => writeJSON(p, ep), dir: path.join(MEDIA, safe(ref.ep), 'clip_' + safe(ref.id)) };
    }
    throw new Error('Нет связки ' + ref.id);
  }
  if (ref.kind === 'comicart') {
    // фигура героя для страницы комикса: рисуется на белом фоне, студия вырезает её сама
    const p = comicPath(ref.ep);
    const comic = readJSON(p);
    const item = comic?.arts?.[ref.id];
    if (!item) throw new Error('Нет фигуры комикса ' + ref.id);
    return { item, save: () => writeJSON(p, comic), dir: path.join(MEDIA, safe(ref.ep), 'comic', safe(ref.id)) };
  }
  if (ref.kind === 'lab') {
    const lab = readJSON(labPath, { items: {} });
    const item = (lab.items[ref.id] ||= { versions: [], selected: null });
    const [style, ep, id] = ref.id.split('|');
    return { item, save: () => writeJSON(labPath, lab), dir: path.join(MEDIA, 'stylelab', safe(style), safe(ep + '_' + id)) };
  }
  throw new Error('Неизвестный тип ' + ref.kind);
}

const comicPath = (ep) => path.join(DATA, 'comics', safe(ep) + '.json');

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

// Чья рука в детали: герои кадра, а если их нет — по именам в описании кадра («пальцы Лиама»)
function inferOwners(pr, s) {
  const have = (s.characters || []).filter((id) => pr.characters.find((c) => c.id === id && c.group !== 'Предметы'));
  if (have.length) return have;
  const text = `${s.frame || ''} ${s.img || ''}`;
  const out = [];
  for (const c of pr.characters) {
    if (c.group === 'Предметы') continue;
    // имена собственные из имени героя («Генерал Бельфи» → Бельф…), без званий
    const words = (c.name || '').split(/[\s()«»]+/).filter((w) => /^[А-ЯЁ]/.test(w) && !/^(Капитан|Командир|Генерал|Повелитель|Птица|Чёрный|Меч)$/.test(w));
    const stems = words.map((w) => (w.length > 4 ? w.slice(0, -1) : w));
    if (c.id === 'LORD') stems.push('Повелител', 'Lord');
    if (stems.some((st) => new RegExp(st).test(text)) || text.includes('[' + c.id + ']')) out.push(c.id);
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
  let raw = '', lines = [], charIds = [], locId = null, shotCtx = null, sceneCtx = null;
  const ownRefs = [];

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
    shotCtx = { s, scene };
    for (const r of s.refs || []) ownRefs.push([r.file, `reference illustration for this shot${r.note ? ' (' + r.note + ')' : ''} — follow its composition and mood, redraw in the requested style`]);
  } else if (ref.kind === 'scene') {
    // мастер-план: вся сцена одним общим кадром, все герои на своих местах
    raw = (item.masterPrompt || `wide master shot of the scene "${item.title}", all characters in their places`) + ', STYLE';
    locId = item.location;
    const ids = new Set();
    for (const s of item.shots) if (!s.cut && (s.location || item.location) === item.location) (s.characters || []).forEach((c) => ids.add(c));
    charIds = [...ids].filter((id) => chars[id] && !['Предметы'].includes(chars[id].group));
    sceneCtx = item;
  } else if (ref.kind === 'comicart') {
    raw = (item.prompt || 'full-body figure') + ', STYLE';
    charIds = item.characters || [];
    const so = item.fromShot && findShot(ref.ep, item.fromShot);
    if (so && item.kind === 'panel') locId = so.item.location || so.scene?.location;
    if (so && selectedFile(so.item)) ownRefs.push([selectedFile(so.item), item.kind === 'panel'
      ? 'the same moment from the anime (key frame): keep the characters, outfit, place, light and mood, but recompose the picture for the comic panel format'
      : 'the same moment from the anime: copy the pose, outfit and expression, but draw ONLY the figure, full body, on a pure white background, no scenery']);
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

  // Порядок референсов = важность: листы героев, мастер-план сцены, предыдущий кадр, план сверху, фон
  const size = shotCtx ? shotSize(shotCtx.s, raw) : 'wide';
  // Крупный план руки, пальцев, рукава: чья это рука — иначе художник рисует «случайную» руку без перчаток и с чужими рукавами
  const partText = shotCtx ? `${raw} ${shotCtx.s.frame || ''}` : '';
  const bodyPart = shotCtx && size !== 'wide' && /\b(hands?|fingers?|fingertips?|palms?|fists?|wrists?|knuckles?|sleeves?|forearms?|gloves?)\b|рук|пальц|ладон|кист|запяст|кулак|костяш|рукав|перчат/i.test(partText);
  if (bodyPart) {
    const owners = inferOwners(pr, shotCtx.s);
    for (const id of owners) if (!charIds.includes(id)) charIds = [...charIds, id];
    if (!charIds.some((id) => chars[id] && chars[id].group !== 'Предметы')) warnings.push('Крупный план руки/пальцев, но не указано, чья это рука. Добавь героя в кадр (поле героев) — иначе рука будет «чужая».');
  }
  const cl = [];
  const parts = [];
  for (const id of charIds) {
    const c = chars[id];
    if (!c) continue;
    const f = selectedFile(c);
    addRef(f, bodyPart && c.group !== 'Предметы'
      ? `character sheet: ${charName(c)} — this close-up shows only PART of ${charName(c)} (hand / arm / sleeve): copy the exact gloves or bare hands, sleeves, bracers, cuffs and skin from this sheet`
      : `character sheet: ${charName(c)} — match face, hair, outfit and proportions exactly`);
    const ill = !f && c.refs?.[0]?.file;
    if (ill) addRef(ill, `book illustration of ${charName(c)} — match appearance`);
    cl.push(`- ${charName(c)}: ${c.token}${c.details ? '. Costume details: ' + c.details : ''}${f || ill ? ' (see reference)' : ''}`);
    if (bodyPart && c.group !== 'Предметы') parts.push(`${charName(c)} — ${c.details || 'exactly as on the character sheet'}`);
    if (ill) warnings.push(`У «${c.name}» нет листа персонажа — пока беру иллюстрацию книги. Лист даст результат стабильнее.`);
    else if (!f) warnings.push(`Нет листа персонажа «${c.name}» — внешность может «поплыть». Сначала сделай его во вкладке «Персонажи».`);
  }
  if (cl.length) lines.push('Characters:\n' + cl.join('\n'));
  if (parts.length) lines.push(`BODY-PART CLOSE-UP: the hand / arm / sleeve in this shot belongs to a known character, never a generic hand. It must match the character sheet exactly:\n${parts.map((x) => '- ' + x).join('\n')}`);
  for (const [f, role] of ownRefs) addRef(f, role);

  const sc = shotCtx?.scene || sceneCtx;
  const sameSet = sc && (!shotCtx || (shotCtx.s.location || sc.location) === sc.location);
  if (sc?.staging) lines.push(`Scene staging — keep it identical in every shot of this scene (positions of characters and objects, where the light comes from, screen direction):\n${sc.staging}`);
  if (shotCtx) {
    const { s } = shotCtx;
    const shots = sc.shots.filter((x) => !x.cut);
    const i = shots.indexOf(s);
    const prev = shots.slice(0, Math.max(0, i)).reverse().find((x) => selectedFile(x) && (x.location || sc.location) === (s.location || sc.location));
    if (sameSet && selectedFile(sc) && !opts.edit) addRef(selectedFile(sc), 'SCENE MASTER SHOT — the whole scene with everyone in place. This shot is the SAME place and the SAME moment seen from a different camera angle/framing: keep the layout, who stands where, the props and the light direction');
    if (prev && !opts.edit) addRef(selectedFile(prev), `PREVIOUS SHOT (${prev.id}: ${prev.frame || ''}) — this shot comes right after it: keep continuity of positions, poses, clothes, light and screen direction`);
    // план сверху годится для всего места (поле битвы, поле с курганом, поле под разломом), но не для неба
    const family = (id) => String(id || '').split('-')[0];
    if (sc.plan && family(s.location || sc.location) === family(sc.location)) addRef(sc.plan, 'top-down FLOOR PLAN of the scene (blocking diagram): who stands where and where the camera is. Use it only to understand the spatial arrangement — never draw the diagram itself');
    const ctx = [`This shot (${s.id}, ${s.camera || 'camera not set'}): ${s.frame || ''}`];
    if (s.continuity) ctx.push(`Continuity: ${s.continuity}`);
    if (i > 0) ctx.push(`Previous shot (${shots[i - 1].id}): ${shots[i - 1].frame || shots[i - 1].vid || ''}`);
    if (i >= 0 && i < shots.length - 1) ctx.push(`Next shot (${shots[i + 1].id}): ${shots[i + 1].frame || shots[i + 1].vid || ''}`);
    lines.push(ctx.join('\n'));
  } else if (sceneCtx?.plan) addRef(sceneCtx.plan, 'top-down FLOOR PLAN of the scene (blocking diagram): place everyone exactly as shown. Never draw the diagram itself');
  // «заново с опорой на текущую»: старый кадр — только черновик поз и лиц, место и расстановку строим по постановке
  const draftFile = opts.basis && !opts.edit && selectedFile(item);
  if (draftFile) {
    addRef(draftFile, 'EARLIER DRAFT of this same shot — reuse only what fits: character poses, expressions, framing idea. It may have the WRONG place, background or positions: rebuild those from the scene master, floor plan, staging and description');
    lines.push('This is a redraw of an earlier draft of the shot (attached). Keep its good parts (faces, poses, framing) only where they agree with the staging and the description; fix the location, background, positions and light to match the scene.');
  }
  if (loc) {
    const env = loc.prompt.replace(/,?\s*(no people|no characters|empty scene[^,]*)/gi, '');
    if (size === 'close') lines.push(`Background: only a soft, out-of-focus hint of the surroundings (${env.split(',')[0]}); this is a close shot, do not show the wide view of the location.`);
    else {
      addRef(selectedFile(loc), `location "${loc.name}" — reference for environment design, materials, palette and light ONLY. Do NOT copy its composition or camera angle: frame the shot as the prompt describes`);
      lines.push(`Location (environment only): ${env}.`);
    }
    if (loc.needsRedraw) warnings.push(`Фон локации «${loc.name}» устарел — Claude поменял её описание. Перерисуй фон во вкладке «Локации».`);
  }
  if (loc && !selectedFile(loc) && size !== 'close') warnings.push(`Нет референса локации «${loc.name}». Сначала сделай фон во вкладке «Локации».`);

  if (ref.kind === 'shot' || ref.kind === 'lab') lines.push('Format: ' + pr.format + '.');
  if (ref.kind === 'comicart' && item.kind === 'panel') lines.push(`Format: one comic panel illustration, ${item.aspect || '16:9 horizontal'} composition, full scene with background, no text, no speech bubbles, no panel borders, no frame.`);
  else if (ref.kind === 'comicart') lines.push('Format: vertical 2:3 portrait, the whole figure from head to toe fits inside the frame with a margin, pure flat white background (#FFFFFF) everywhere around the figure, no ground, no cast shadow, no frame, no text; a clean dark outline around the whole silhouette so it can be cut out.');
  lines.push('Avoid: ' + pr.negative + '.');
  if (opts.note) {
    lines.push(opts.edit
      ? `REVISION of the CURRENT VERSION image. Apply exactly this change: ${opts.note}. Everything the change does not mention stays as in the current version. If the change asks for a different style, rendering or level of detail, follow the change and the style line above.`
      : `Additional direction: ${opts.note}`);
  }
  warnings.unshift(...checkRules(pr, raw + ' ' + (opts.note || '')));
  const out = { prompt: lines.join('\n\n'), refs: refs.slice(0, 8), warnings, style: style.id };
  if (ref.kind === 'shot') {
    const v = videoPrompt(item, pr);
    out.video = v.text;
    warnings.push(...v.warnings);
  }
  return out;
}

// ---------- видео-промпт с липсинком ----------
// Видео делаем без звука, голос накладываем потом, поэтому модели нужно точно знать,
// кто в кадре говорит, какой текст и сколько секунд — иначе губы не совпадут.
const CPS = 13; // русская речь ≈ 13 знаков в секунду
function videoPrompt(s, pr) {
  const chars = Object.fromEntries(pr.characters.map((c) => [c.id, c]));
  const nameOf = (id) => (chars[id] ? charName(chars[id]) : id === 'NARRATOR' ? 'narrator' : id);
  const ruName = (id) => chars[id]?.name || (id === 'NARRATOR' ? 'Рассказчик' : id);
  const ls = s.lines || [];
  const warnings = [];
  const parts = [s.vid || ''];
  const lips = ls.filter((l) => l.mode === 'lips');
  if (lips.length) {
    parts.push('Dialogue — silent clip, the voice will be added later, so animate only lips, jaw and facial expression in sync with the words:\n' +
      lips.map((l) => `- ${nameOf(l.who)} says in Russian${l.manner ? ` (${l.manner})` : ''}: «${l.text}» — about ${Math.max(0.5, Math.round(l.text.length / CPS * 10) / 10)} s`).join('\n') +
      '\nCharacters who are not speaking keep their mouths closed.');
  } else if (ls.length) {
    parts.push('No one speaks on screen in this shot (the voice is off-screen or inner thoughts) — keep all mouths closed.');
  }
  const said = ls.filter((l) => !l.optional).reduce((a, l) => a + l.text.length / CPS, 0);
  if (s.dur && said > s.dur + 0.3 && ls.length > 1) warnings.push(`Все реплики кадра вместе звучат ~${said.toFixed(1)} с, а кадр ${s.dur} с. Удлини кадр или перенеси часть реплики в соседний кадр (голос за кадром).`);
  for (const l of lips) {
    const secs = l.text.length / CPS;
    if (s.dur && secs > s.dur + 0.3) warnings.push(`Реплика «${l.text.slice(0, 40)}…» звучит ~${secs.toFixed(1)} с, а кадр ${s.dur} с — губы не успеют. Удлини кадр или сократи реплику.`);
    if (!(s.characters || []).includes(l.who) && chars[l.who]) warnings.push(`Говорит ${ruName(l.who)}, но его нет в «В кадре». Отметь героя или поставь режим «за кадром».`);
  }
  return { text: parts.filter(Boolean).join('\n\n'), warnings };
}

// ---------- связки для Seedance / Kling ----------
// Сцены с героями идут в Seedance (или Kling) связками до 15 с: несколько кадров одним роликом, с референсами —
// так переходы логичные, а лица и костюмы стабильнее. Вставки без героев (пейзаж, предмет, деталь) — в Pixverse по одному.
const isProp = (pr, id) => pr.characters.find((c) => c.id === id)?.group === 'Предметы';
const peopleOf = (pr, s) => (s.characters || []).filter((id) => pr.characters.some((c) => c.id === id) && !isProp(pr, id));
// вставка без героев (пейзаж, небо, предмет) рвёт связку; деталь героя (рука, заколка) остаётся внутри
const isInsert = (pr, s) => !peopleOf(pr, s).length;
const isDetail = (s) => /деталь|вставк/i.test(s.camera || '') && !/глаз|взгляд|лиц/i.test(s.frame || '');
const GEN_DURS = [4, 5, 6, 8, 10, 12, 15, 20, 25, 30];
function genDur(total, n, max) {
  const need = Math.max(total, n > 1 ? 8 : 4);
  return GEN_DURS.find((d) => d >= need && d <= Math.max(max, 15)) || Math.max(max, 15);
}
function autoClips(epId, max = 15) {
  const p = epPath(epId);
  const ep = readJSON(p);
  const pr = project();
  let made = 0, inserts = 0;
  for (const sc of ep.scenes) {
    const shots = sc.shots.filter((s) => !s.cut);
    // связки с готовым видео не трогаем
    const keep = (sc.clips || []).filter((c) => c.videos?.length);
    const locked = new Set(keep.flatMap((c) => c.shots));
    const clips = [...keep];
    let cur = null;
    const flush = () => { if (cur?.shots.length) clips.push(cur); cur = null; };
    for (const s of shots) {
      if (locked.has(s.id)) { flush(); continue; }
      if (isInsert(pr, s)) { flush(); s.tool = 'Pixverse'; inserts++; continue; }
      const loc = s.location || sc.location;
      const total = cur ? cur.shots.reduce((a, id) => a + (sc.shots.find((x) => x.id === id)?.dur || 3), 0) : 0;
      if (!cur || cur.loc !== loc || total + (s.dur || 3) > max) { flush(); cur = { id: 'C' + s.id, shots: [], tool: 'Seedance', loc }; }
      cur.shots.push(s.id);
      s.tool = cur.tool;
    }
    flush();
    // связка из одной детали Seedance не нужна — такой кадр идёт в Pixverse
    for (let k = clips.length - 1; k >= 0; k--) {
      const c = clips[k];
      if (c.videos?.length || c.shots.length > 1) continue;
      const s = sc.shots.find((x) => x.id === c.shots[0]);
      if (s && isDetail(s)) { clips.splice(k, 1); s.tool = 'Pixverse'; inserts++; }
    }
    for (const c of clips) delete c.loc;
    const order = (c) => shots.findIndex((s) => s.id === c.shots[0]);
    sc.clips = clips.sort((a, b) => order(a) - order(b));
    made += clips.length - keep.length;
  }
  writeJSON(p, ep);
  logInbox(`${epId} — связки для Seedance: ${made} новых, вставок для Pixverse: ${inserts}`);
  return { made, inserts };
}
function editClips(b) {
  const p = epPath(b.ep);
  const ep = readJSON(p);
  const sc = ep.scenes.find((x) => (x.clips || []).some((c) => c.id === b.id));
  if (!sc) throw new Error('Нет связки ' + b.id);
  const i = sc.clips.findIndex((c) => c.id === b.id);
  const c = sc.clips[i];
  if (b.op === 'tool') { c.tool = b.tool; for (const id of c.shots) { const s = sc.shots.find((x) => x.id === id); if (s) s.tool = b.tool; } }
  else if (b.op === 'split') {
    const k = c.shots.indexOf(b.at);
    if (k <= 0) throw new Error('Разрезать можно только перед вторым и следующими кадрами');
    const rest = c.shots.splice(k);
    sc.clips.splice(i + 1, 0, { id: 'C' + rest[0], shots: rest, tool: c.tool });
  } else if (b.op === 'merge') {
    const n = sc.clips[i + 1];
    if (!n) throw new Error('Дальше в сцене связок нет');
    if (n.videos?.length && !c.videos?.length) c.videos = n.videos, c.videoSelected = n.videoSelected;
    c.shots.push(...n.shots);
    sc.clips.splice(i + 1, 1);
  } else if (b.op === 'remove') {
    sc.clips.splice(i, 1);
    for (const id of c.shots) { const s = sc.shots.find((x) => x.id === id); if (s) s.tool = 'Pixverse'; }
  } else if (b.op === 'gen') c.genDur = +b.value || undefined;
  writeJSON(p, ep);
  return { ok: true };
}
// Русская камера из раскадровки → английский для видеомодели
function camEn(cam = '') {
  const map = [[/сверхобщ/i, 'extreme wide shot'], [/сверхкрупн/i, 'extreme close-up'], [/общий/i, 'wide shot'], [/средний/i, 'medium shot'], [/крупн/i, 'close-up'], [/деталь|вставк/i, 'detail insert'],
    [/нижн|снизу/i, 'low angle'], [/сверху|с высоты/i, 'high angle / top-down'], [/статик/i, 'static camera'], [/наезд/i, 'slow push-in'], [/отъезд/i, 'pull-back'], [/панорам/i, 'pan'],
    [/сопровожд/i, 'tracking shot'], [/пролёт|пролет/i, 'flyover'], [/тряск/i, 'camera shake'], [/замедлен/i, 'slow motion'], [/завал/i, 'dutch angle'], [/восьм/i, 'shot / reverse shot'], [/удар|вспышк/i, 'impact frame'], [/пике/i, 'diving camera'], [/профил/i, 'profile']];
  const out = map.filter(([rx]) => rx.test(cam)).map(([, t]) => t);
  return [...new Set(out)].join(', ') || 'medium shot';
}
function clipPrompt(epId, sc, clip, pr) {
  const chars = Object.fromEntries(pr.characters.map((c) => [c.id, c]));
  const style = pr.styles.find((x) => x.id === pr.activeStyle) || pr.styles[0];
  const shots = clip.shots.map((id) => sc.shots.find((s) => s.id === id)).filter(Boolean);
  const total = shots.reduce((a, s) => a + (s.dur || 3), 0);
  const warnings = [];
  const keyOf = (s) => {
    let f = selectedFile(s);
    if (!f && s.imgFrom) f = selectedFile(findShot(epId, s.imgFrom)?.item);
    return f;
  };
  const refs = [];
  const add = (file, label) => { if (file && refs.length < 9 && !refs.some((r) => r.file === file) && fs.existsSync(abs(file))) { refs.push({ file, label }); return refs.length; } return refs.find((r) => r.file === file) ? refs.findIndex((r) => r.file === file) + 1 : null; };
  const first = keyOf(shots[0]);
  if (first) add(first, 'first frame — Shot 1 starts exactly from this picture');
  else warnings.push(`У первого кадра связки (${shots[0].id}) нет картинки — нарисуй его, это стартовый кадр ролика.`);
  const people = [...new Set(shots.flatMap((s) => peopleOf(pr, s)))];
  const props = [...new Set(shots.flatMap((s) => (s.characters || []).filter((id) => isProp(pr, id))))];
  const charRef = {};
  for (const id of people.slice(0, 4)) {
    const c = chars[id];
    const n = add(selectedFile(c), `${c.name} — character sheet: face, hair, costume — keep exactly`);
    if (n) charRef[id] = n; else warnings.push(`Нет листа персонажа «${c.name}» — лицо и костюм в ролике будут «плыть».`);
  }
  const shotRef = {};
  shots.slice(1).forEach((s, i) => { const n = add(keyOf(s), `key frame of Shot ${i + 2} — composition and poses`); if (n) shotRef[s.id] = n; });
  for (const id of props) add(selectedFile(chars[id]), `${chars[id].name} — prop reference`);
  const loc = pr.locations.find((l) => l.id === (shots[0].location || sc.location));
  if (selectedFile(sc) && (shots[0].location || sc.location) === sc.location) add(selectedFile(sc), 'scene master shot — place, positions of characters, light');
  else if (loc) add(selectedFile(loc), `location "${loc.name}" — environment and light only`);
  const nameOf = (id) => (chars[id] ? charName(chars[id]) : id);
  const clean = (t) => String(t || '').replace(/@Image\d \(([^)]+)\)/g, '$1').replace(/\[([A-Z ]+)\]/g, (m, id) => (chars[id] ? charName(chars[id]) : m)).replace(/,?\s*PAL-[A-Z]+/g, '').replace(/,?\s*STYLE\b/g, '').trim();
  let t = 0;
  const perShot = shots.map((s, i) => {
    const d = s.dur || 3;
    const tc = (x) => `0:${String(Math.round(x)).padStart(2, '0')}`;
    const lips = (s.lines || []).filter((l) => l.mode === 'lips');
    const other = (s.lines || []).filter((l) => l.mode !== 'lips' && !l.optional);
    const parts = [`Shot ${i + 1} (${tc(t)}–${tc(t + d)}, ${d} s, ${camEn(s.camera)})${shotRef[s.id] ? ` — like @Image${shotRef[s.id]}` : i === 0 && first ? ' — starts from @Image1' : ''}: ${clean(s.img) || clean(s.frame)}`];
    if (s.vid) parts.push(`Motion: ${clean(s.vid)}`);
    if (s.continuity) parts.push(`Continuity: ${s.continuity}`);
    if (lips.length) parts.push('Lip-sync (silent video, voice added later): ' + lips.map((l) => `${nameOf(l.who)} says in Russian${l.manner ? ` (${l.manner})` : ''} «${l.text}» (~${Math.max(0.5, Math.round(l.text.length / CPS * 10) / 10)} s)`).join('; '));
    else if (other.length) parts.push('Nobody speaks on screen — mouths closed.');
    for (const l of lips) if (l.text.length / CPS > d + 0.3) warnings.push(`${s.id}: реплика длиннее кадра — губы не успеют.`);
    t += d;
    return parts.join(' ');
  });
  const gen = clip.genDur || genDur(total, shots.length, 15);
  const cast = people.map((id) => `- ${nameOf(id)}${charRef[id] ? ` (@Image${charRef[id]})` : ''}: ${chars[id].token}${chars[id].details ? '. Costume: ' + chars[id].details : ''}`);
  const text = [
    `Multi-shot 2D anime sequence, ${shots.length} shot${shots.length > 1 ? 's' : ''}, total ${total} s${gen > total ? ` (generate ${gen} s, the extra tail will be trimmed)` : ''}, hard cuts between shots. The same characters, place and light in every shot; keep screen direction (180-degree rule). Silent: no music, no voices, no sound.`,
    `Style: ${style.text}.`,
    refs.length ? 'References:\n' + refs.map((r, i) => `@Image${i + 1} — ${r.label}`).join('\n') : '',
    cast.length ? 'Characters:\n' + cast.join('\n') : '',
    perShot.join('\n'),
    'Anyone who does not speak keeps the mouth closed. No text, no subtitles, no watermark.',
  ].filter(Boolean).join('\n\n');
  if (total > 15) warnings.push(`Связка длиннее 15 с (${total} с) — Seedance 2.0 столько не сделает за раз. Разрежь её или используй модель с 30 с.`);
  return { text, refs, perShot, total, gen, warnings, negative: pr.negative, shots: shots.map((s) => s.id) };
}

// Крупность кадра: на крупных и деталях фон локации не нужен — иначе модель тащит его целиком
function shotSize(s, raw = '') {
  const c = (s.camera || '').toLowerCase();
  if (/сверхкрупн|крупн|детал|вставка/.test(c) || /^(extreme )?close-up/i.test(raw)) return 'close';
  if (/общий|сверхобщ|воздух|панорам|с высоты|сверху|пролёт|пролет/.test(c) || /wide|aerial|establishing/i.test(raw.slice(0, 60))) return 'wide';
  return 'medium';
}

function codexInstruction(p, outAbs) {
  const refList = p.refs.map((r, i) => `  Image ${i + 1}: ${r.role}`).join('\n');
  return [
    'You are the key-frame artist of an anime studio. Use your built-in image generation tool to create exactly ONE image.',
    'This frame is one shot of a continuous scene: keep continuity with the scene master shot, the previous shot and the floor plan — same layout, same positions of characters and props, same light direction, 180-degree rule. Location images are environment references, not compositions to copy.',
    p.refs.length ? `The attached images are references:\n${refList}` : 'There are no reference images.',
    `Save the final image as PNG to this exact path (create folders if needed):\n  ${outAbs}`,
    'If the tool saved it somewhere else (for example ~/.codex/generated_images), copy it to that path.',
    'Do not change any other files. Do not commit. Your final answer is just the saved path.',
    '',
    'IMAGE PROMPT:',
    p.prompt,
  ].join('\n');
}

// ---------- пакеты изменений от Claude ----------
// Claude не правит файлы серий напрямую (чтобы не было конфликтов в Git с работой автора),
// а кладёт пакеты в studio/migrations/. Студия применяет каждый один раз — поверх данных автора.
const MIGRATIONS = path.join(STUDIO, 'migrations');
function runMigrations() {
  if (!fs.existsSync(MIGRATIONS)) return;
  const pp = path.join(DATA, 'project.json');
  const pr = readJSON(pp);
  pr.appliedMigrations ||= [];
  const eps = {};
  const ep = (id) => (eps[id] ||= readJSON(epPath(id)));
  const setAll = (obj, set) => { for (const [k, v] of Object.entries(set || {})) { if (v === null) delete obj[k]; else obj[k] = v; } };
  let changed = false;
  for (const f of fs.readdirSync(MIGRATIONS).filter((x) => x.endsWith('.json')).sort()) {
    const m = readJSON(path.join(MIGRATIONS, f));
    if (!m?.id || pr.appliedMigrations.includes(m.id)) continue;
    for (const op of m.ops || []) {
      try {
        if (op.op === 'scene') setAll(ep(op.ep).scenes.find((s) => s.n === op.n), op.set);
        else if (op.op === 'shot') setAll(ep(op.ep).scenes.flatMap((s) => s.shots).find((s) => s.id === op.id), op.set);
        else if (op.op === 'location' || op.op === 'character') {
          const list = op.op === 'location' ? pr.locations : pr.characters;
          let it = list.find((x) => x.id === op.id);
          if (!it) list.push((it = { id: op.id, versions: [], selected: null }));
          setAll(it, op.set);
        } else if (op.op === 'rule') {
          pr.rules ||= [];
          const i = pr.rules.findIndex((r) => r.id === op.set.id);
          if (i >= 0) pr.rules[i] = op.set; else pr.rules.push(op.set);
        } else if (op.op === 'question-remove') pr.questions = (pr.questions || []).filter((q) => !q.startsWith(op.startsWith));
      } catch (e) { console.log('  Пакет', m.id, 'шаг пропущен:', e.message); }
    }
    pr.appliedMigrations.push(m.id);
    changed = true;
    logInbox(`Применён пакет изменений от Claude: «${m.title || m.id}»`);
  }
  if (changed) {
    for (const [id, e] of Object.entries(eps)) writeJSON(epPath(id), e);
    writeJSON(pp, pr);
  }
}

// ---------- очередь заданий ----------
const jobs = [];
let running = 0;

// Очередь переживает закрытие студии: пишем её на диск и при запуске продолжаем
const JOBS_FILE = path.join(STUDIO, '.jobs.json');
let jobsSaved = '';
function saveJobs() {
  const data = JSON.stringify(jobs.slice(0, 150).map(({ pid, ...j }) => ({ ...j, log: (j.log || '').slice(-4000) })));
  if (data === jobsSaved) return;
  jobsSaved = data;
  try { fs.writeFileSync(JOBS_FILE, data); } catch {}
}
setInterval(saveJobs, 2000).unref();
function restoreJobs() {
  for (const j of readJSON(JOBS_FILE, [])) {
    if (j.status === 'running' || j.status === 'queued') {
      // студию закрыли посреди работы: если картинка успела сохраниться — забираем, иначе рисуем заново
      if (j.status === 'running' && j.out && fs.existsSync(abs(j.out))) {
        try { addVersion(j.ref, j.out, { by: j.generator, note: j.note, style: j.style, prompt: j.prompt }); j.status = 'done'; } catch { j.status = 'failed'; }
      } else {
        j.status = 'queued';
        j.log = (j.log || '') + '\n↻ Студию перезапустили — задание продолжено.';
        reserved.add(abs(j.out).replace(/\.\w+$/, ''));
      }
    }
    jobs.push(j);
  }
}
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
  if (ref.kind === 'scene') return `${ref.ep} · сцена ${ref.id} (мастер-план)`;
  if (ref.kind === 'clip') return `${ref.ep} · связка ${ref.id}`;
  if (ref.kind === 'comicart') return `${ref.ep} · комикс, ${String(ref.id).startsWith('panel_') ? 'картинка панели' : 'фигура'} ${ref.id}`;
  return ref.kind === 'shot' ? `${ref.ep} · кадр ${ref.id}` : ref.kind === 'lab' ? `проба ${ref.id.replace(/\|/g, ' · ')}` : `${ref.kind === 'character' ? 'персонаж' : 'локация'} ${ref.id}`;
}

function addVersion(ref, file, meta) {
  const o = open(ref);
  o.item.versions ||= [];
  o.item.versions.push({ file, at: now(), ...meta });
  o.item.selected = o.item.versions.length - 1;
  delete o.item.needsRedraw;
  if (ref.kind === 'shot') o.item.status = 'review';
  o.save();
  logInbox(`${label(ref)} — новая версия ${path.basename(file)} (${meta.by})${meta.note ? ': «' + meta.note + '»' : ''}`);
}

let lastInboxKey = null;
function logInbox(line, key = null) {
  if (!fs.existsSync(INBOX)) fs.writeFileSync(INBOX, '# Журнал студии\n\nСюда студия пишет все правки и решения. Claude читает его, чтобы держать канон и логику.\n\n');
  const entry = `- [${now()}] ${line}\n`;
  if (key && key === lastInboxKey) {
    // заметка сохраняется на ходу — переписываем последнюю строку, а не плодим десяток
    const t = fs.readFileSync(INBOX, 'utf8').replace(/- \[[^\n]*\n$/, '');
    fs.writeFileSync(INBOX, t + entry);
  } else fs.appendFileSync(INBOX, entry);
  lastInboxKey = key;
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
  // папку целиком не удаляем: на Windows она может быть открыта в Проводнике и заблокирована
  fs.mkdirSync(outDir, { recursive: true });
  for (const e of fs.readdirSync(outDir, { withFileTypes: true })) {
    if (e.isDirectory() && /^\d{3}_/.test(e.name)) {
      try { fs.rmSync(path.join(outDir, e.name), { recursive: true, force: true }); } catch {}
    }
  }
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
        'VIDEO PROMPT:', videoPrompt(s, pr).text, '',
        'NEGATIVE:', pr.negative, '',
        `Кадр: ${s.frame || ''}`, `Звук: ${s.sound || ''}`,
      ].join('\n'));
      t += s.dur || 0;
      rows.push(`| ${n} | ${s.id} | ${s.dur || ''} | ${s.tool || ''} | ${key ? '✓' : '—'} | ${video ? '✓' : '—'} | ${(s.sound || '').replace(/\|/g, '/')} |`);
    }
  }
  // связки для Seedance / Kling — отдельные папки
  for (const e of fs.readdirSync(outDir, { withFileTypes: true })) if (e.isDirectory() && /^Связка_/.test(e.name)) { try { fs.rmSync(path.join(outDir, e.name), { recursive: true, force: true }); } catch {} }
  const clipRows = [];
  for (const sc of ep.scenes) for (const c of sc.clips || []) {
    const cp = clipPrompt(epId, sc, c, pr);
    const dir = path.join(outDir, `Связка_${safe(c.id)}`);
    fs.mkdirSync(dir, { recursive: true });
    cp.refs.forEach((r, i) => fs.copyFileSync(abs(r.file), path.join(dir, `Image${i + 1}${path.extname(r.file)}`)));
    const v = selectedVideo(c);
    if (v) fs.copyFileSync(abs(v), path.join(dir, 'video' + path.extname(v)));
    fs.writeFileSync(path.join(dir, 'prompt.txt'), [
      `Связка ${c.id} · кадры ${cp.shots.join(', ')} · ${cp.total} с (генерировать ${cp.gen} с) · ${c.tool || 'Seedance'}`, `Сцена ${sc.n}: ${sc.title}`, '',
      'Референсы (загружай по порядку):', ...cp.refs.map((r, i) => `Image${i + 1} — ${r.label}`), '',
      'PROMPT:', cp.text, '', 'NEGATIVE:', cp.negative, '',
      'Для Kling (multi-shot — по кадру в каждое поле):', ...cp.perShot,
    ].join('\n'));
    clipRows.push(`| ${c.id} | ${cp.shots.join(', ')} | ${cp.total} | ${c.tool || 'Seedance'} | ${v ? '✓' : '—'} |`);
  }
  if (clipRows.length) rows.push('', '## Связки (Seedance / Kling)', '', '| Связка | Кадры | с | Инструмент | Видео |', '|---|---|---|---|---|', ...clipRows);
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

const gitSend = createGitSender(ROOT, (t) => logInbox(t));
const agent = createAgent({ ROOT, STUDIO, DATA, config, logInbox: (t) => logInbox(t) });
const routes = {
  // ---- Claude в студии ----
  'GET /api/agent': () => agent.status(),
  'GET /api/agent/engines': () => agent.engines(true),
  'POST /api/agent/send': (q, b) => agent.send({ text: String(b.text || '').trim(), ctx: b.ctx, threadId: b.thread, title: b.title }),
  'POST /api/agent/stop': () => agent.stop(),
  'POST /api/agent/new': () => agent.newThread(),
  'POST /api/agent/thread': (q, b) => agent.switchThread(b.id),
  'GET /api/git/status': () => ({ ...gitSend.status(), job: gitSend.job() }),
  'GET /api/git/job': () => gitSend.job(),
  'POST /api/git/send': (q, b) => gitSend.start(b.maxMB),
  'GET /api/state': () => {
    runMigrations();
    const cfg = config();
    const bookDir = path.join(STUDIO, 'canon', 'book');
    const book = fs.existsSync(bookDir) ? fs.readdirSync(bookDir).filter((f) => f.endsWith('.txt')).sort() : [];
    return { version: VERSION, project: project(), episodes: listEpisodes(), generator: cfg.generator, lab: readJSON(labPath, { items: {} }), book };
  },
  'POST /api/shutdown': () => { setTimeout(() => { saveJobs(); process.exit(0); }, 200); return { ok: true }; },
  'GET /api/episode': (q) => readJSON(epPath(q.get('id'))),
  // ---- комикс ----
  'GET /api/comic': (q) => ({
    comic: readJSON(comicPath(q.get('ep'))),
    hints: readJSON(path.join(STUDIO, 'canon', 'comic', safe(q.get('ep')) + '.json'), {}),
  }),
  'POST /api/comic/save': (q, b) => {
    // фигуры (их версии пишет художник) берём с диска, чтобы сохранение страниц их не затёрло
    const p = comicPath(b.ep);
    const old = readJSON(p, {});
    const comic = b.comic;
    comic.arts ||= {};
    for (const [id, a] of Object.entries(old.arts || {})) if (comic.arts[id]) Object.assign(comic.arts[id], { versions: a.versions || [], selected: a.selected ?? null });
    fs.mkdirSync(path.dirname(p), { recursive: true });
    writeJSON(p, comic);
    if (!old.pages && comic.pages?.length) logInbox(`${b.ep} — собран комикс: ${comic.pages.length} стр.`);
    return { ok: true, arts: comic.arts };
  },
  'POST /api/comic/art': (q, b) => {
    const p = comicPath(b.ep);
    const comic = readJSON(p, { pages: [], arts: {} });
    comic.arts ||= {};
    const a = (comic.arts[b.id] ||= { versions: [], selected: null });
    Object.assign(a, { prompt: b.prompt, characters: b.characters || [], fromShot: b.fromShot || null });
    if (b.kind) a.kind = b.kind;
    if (b.aspect) a.aspect = b.aspect;
    fs.mkdirSync(path.dirname(p), { recursive: true });
    writeJSON(p, comic);
    return a;
  },
  'POST /api/preview': (q, b) => buildPrompt(b.ref, b.opts || {}),
  'POST /api/generate': (q, b) => {
    // refs: [ref] или [{ ref, opts }] — у каждого кадра может быть своя правка (перерисовка скопом)
    const refs = b.refs || [b.ref];
    return refs.map((r) => (r.ref ? enqueue(r.ref, { ...(b.opts || {}), ...(r.opts || {}) }) : enqueue(r, b.opts || {})));
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
    const allowed = ['img', 'vid', 'frame', 'sound', 'location', 'characters', 'status', 'selected', 'notes', 'cut', 'tool', 'dur', 'camera', 'token', 'sheetPrompt', 'prompt', 'palette', 'name', 'refs', 'canon', 'group', 'videoSelected', 'videoStatus', 'lines', 'staging', 'masterPrompt', 'continuity', 'details'];
    for (const [k, v] of Object.entries(b.patch || {})) if (allowed.includes(k)) o.item[k] = v;
    o.save();
    if (b.patch?.status === 'approved') logInbox(`${label(b.ref)} — утверждён (${path.basename(selectedFile(o.item) || '')})`);
    if (b.patch?.videoStatus === 'approved') logInbox(`${label(b.ref)} — видео утверждено (${path.basename(selectedVideo(o.item) || '')})`);
    if (b.patch?.notes) logInbox(`${label(b.ref)} — заметка для Claude: «${b.patch.notes}»`, 'note:' + JSON.stringify(b.ref));
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
  'POST /api/clips/auto': (q, b) => autoClips(b.ep, +b.max || 15),
  'POST /api/clips/edit': (q, b) => editClips(b),
  'POST /api/clip/preview': (q, b) => { const o = open({ kind: 'clip', ep: b.ep, id: b.id }); return clipPrompt(b.ep, o.scene, o.item, project()); },
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
    if (key === 'POST /api/shrink') {
      // уменьшенная браузером копия большой картинки: оригинал уезжает в «<репозиторий> — оригиналы» рядом с репозиторием
      const relPath = url.searchParams.get('path') || '';
      const src = abs(relPath);
      if (!src.startsWith(ROOT + path.sep) || !fs.existsSync(src) || src.startsWith(STUDIO + path.sep)) throw new Error('Нельзя уменьшить этот файл');
      const buf = await body(req);
      const origRoot = path.join(path.dirname(ROOT), path.basename(ROOT) + ' — оригиналы');
      const orig = path.join(origRoot, path.relative(ROOT, src));
      fs.mkdirSync(path.dirname(orig), { recursive: true });
      fs.copyFileSync(src, orig);
      let out = src.replace(/\.\w+$/, '.jpg');
      if (out !== src) for (let i = 2; fs.existsSync(out); i++) out = src.replace(/\.\w+$/, ` (${i}).jpg`);
      fs.writeFileSync(out, buf);
      if (out !== src) fs.rmSync(src);
      // если картинка уже стоит референсом, переписываем ссылку
      const from = rel(src), to = rel(out);
      if (from !== to) for (const f of [path.join(DATA, 'project.json'), labPath, ...listEpisodes().map((e) => epPath(e.id))]) {
        if (!fs.existsSync(f)) continue;
        const t = fs.readFileSync(f, 'utf8');
        if (t.includes(JSON.stringify(from).slice(1, -1))) fs.writeFileSync(f, t.split(JSON.stringify(from).slice(1, -1)).join(JSON.stringify(to).slice(1, -1)));
      }
      return send(res, 200, { file: to, orig });
    }
    if (key === 'POST /api/comic/export') {
      // страница комикса, собранная в браузере; лежит в export/ и в Git не попадает
      const ep = safe(url.searchParams.get('ep') || 'episode');
      const name = safe(url.searchParams.get('name') || 'page');
      const dir = path.join(EXPORT, ep, 'комикс');
      fs.mkdirSync(dir, { recursive: true });
      const out = path.join(dir, name + '.png');
      await saveStream(req, out, 200e6);
      return send(res, 200, { file: rel(out), dir: rel(dir) });
    }
    if (key === 'POST /api/montage/save') {
      // черновой монтаж серии, собранный в браузере; лежит в export/ и в Git не попадает
      const ep = safe(url.searchParams.get('ep') || 'episode');
      const ext = url.searchParams.get('ext') === '.mp4' ? '.mp4' : '.webm';
      const dir = path.join(EXPORT, ep);
      fs.mkdirSync(dir, { recursive: true });
      const out = path.join(dir, `Черновой монтаж ${now().replace(/:/g, '-')}${ext}`);
      await saveStream(req, out, 4e9);
      logInbox(`${ep} — собран черновой монтаж ${path.basename(out)}`);
      return send(res, 200, { file: rel(out) });
    }
    if (key === 'POST /api/video/upload') {
      const ref = JSON.parse(url.searchParams.get('ref'));
      if (ref.kind !== 'shot' && ref.kind !== 'clip') throw new Error('Видео бывает только у кадра или связки');
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
// Найти и завершить процесс, который держит порт (старую копию студии)
function killPortOwner(p) {
  try {
    if (process.platform === 'win32') {
      const out = execSync('netstat -ano -p tcp', { encoding: 'utf8' });
      const pids = new Set(out.split(/\r?\n/).filter((l) => l.includes(`:${p} `) && /LISTENING/i.test(l)).map((l) => l.trim().split(/\s+/).pop()));
      for (const pid of pids) if (pid && pid !== String(process.pid)) execSync(`taskkill /PID ${pid} /T /F`);
    } else {
      const out = execSync(`lsof -ti tcp:${p} -sTCP:LISTEN`, { encoding: 'utf8' });
      for (const pid of out.split(/\s+/).filter(Boolean)) if (pid !== String(process.pid)) process.kill(Number(pid));
    }
  } catch {}
}
let retried = false;
server.on('error', async (e) => {
  if (e.code !== 'EADDRINUSE') throw e;
  const base = `http://127.0.0.1:${port}`;
  const old = await fetch(base + '/api/state').then((r) => r.json()).catch(() => null);
  if (old?.version === VERSION) {
    console.log(`\n  Студия уже запущена: http://localhost:${port}\n`);
    openInOS(`http://localhost:${port}`);
    return setTimeout(() => process.exit(0), 500);
  }
  if (!retried) {
    // в фоне работает старая копия студии — просим её закрыться и занимаем порт сами
    retried = true;
    console.log('\n  Нашлась старая копия студии — закрываю её…');
    const asked = await fetch(base + '/api/shutdown', { method: 'POST' }).then((r) => r.ok).catch(() => false);
    if (!asked) killPortOwner(port); // совсем старая копия не знает команды «закройся»
    return setTimeout(() => server.listen(port, '127.0.0.1'), 2000);
  }
  console.log(`\n  ⚠ Порт ${port} занят старой копией студии, и она не закрылась сама.`);
  console.log('  Закрой все чёрные окна студии (или перезагрузи компьютер) и запусти Студия.bat снова.\n');
  setTimeout(() => process.exit(1), 15000);
});
server.listen(port, '127.0.0.1', () => {
  if (gitSend.fixPostBuffer()) console.log('Настроила Git для больших отправок (http.postBuffer).');
  runMigrations();
  restoreJobs();
  pump();
  process.on('SIGINT', () => { saveJobs(); process.exit(0); });
  console.log(`\n  Студия «Белая кровь» работает: http://localhost:${port}  (версия ${VERSION})\n  Генератор: ${config().generator}. Закрой это окно, чтобы остановить.\n`);
  if (process.argv.includes('--open')) openInOS(`http://localhost:${port}`);
});
