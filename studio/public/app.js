// Студия «Белая кровь» — интерфейс
const $ = (s, r = document) => r.querySelector(s);
const S = { state: null, ep: null, view: 'board', sel: null, jobs: [], filter: 'all', jobsSig: '' };
const STATUS = { todo: 'Нужно сделать', review: 'На проверке', approved: 'Утверждено' };

// ---------- утилиты ----------
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) el.append(k.nodeType ? k : String(k));
  return el;
}
const fileUrl = (p) => '/files/' + p.split('/').map(encodeURIComponent).join('/');
async function api(method, url, data) {
  const r = await fetch(url, { method, headers: data ? { 'Content-Type': 'application/json' } : {}, body: data ? JSON.stringify(data) : undefined });
  const j = await r.json();
  if (!r.ok || (j && j.error)) throw new Error(j.error || r.status);
  return j;
}
const GET = (u) => api('GET', u);
const POST = (u, d) => api('POST', u, d);
function toast(msg, ms = 3500) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.add('hidden'), ms);
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Скопировано'); } catch { prompt('Скопируй вручную:', text); }
}
const selFile = (it) => (it && it.selected != null && it.versions?.[it.selected] ? it.versions[it.selected].file : null);
const gen = () => $('#genSel').value;
const sameRef = (a, b) => a && b && JSON.stringify(a) === JSON.stringify(b);
const lsGet = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

// ---------- загрузка ----------
async function loadState() {
  S.state = await GET('/api/state');
  const sel = $('#epSel');
  sel.innerHTML = '';
  for (const e of S.state.episodes) sel.append(h('option', { value: e.id }, e.title));
  const want = lsGet('ep', S.state.episodes[0]?.id);
  sel.value = S.state.episodes.some((e) => e.id === want) ? want : S.state.episodes[0]?.id;
  await loadEp();
}
async function loadEp() {
  S.ep = await GET('/api/episode?id=' + encodeURIComponent($('#epSel').value));
}
function findShot(id) {
  for (const sc of S.ep.scenes) for (const s of sc.shots) if (s.id === id) return { shot: s, scene: sc };
  return null;
}
function itemOf(ref) {
  if (!ref) return null;
  if (ref.kind === 'shot') return ref.ep === S.ep.id ? findShot(ref.id)?.shot : null;
  if (ref.kind === 'character') return S.state.project.characters.find((c) => c.id === ref.id);
  if (ref.kind === 'location') return S.state.project.locations.find((c) => c.id === ref.id);
  if (ref.kind === 'lab') return S.state.lab.items[ref.id] || { versions: [], selected: null };
}
const runningFor = (ref) => S.jobs.find((j) => sameRef(j.ref, ref) && ['queued', 'running'].includes(j.status));

// ---------- раскадровка ----------
function counts(shots) {
  const c = { todo: 0, review: 0, approved: 0, all: 0 };
  for (const s of shots) if (!s.cut) { c[s.status] = (c[s.status] || 0) + 1; c.all++; }
  return c;
}
function shotCard(s, ref) {
  const f = selFile(s);
  const run = runningFor(ref);
  const dot = run ? 'running' : s.status;
  return h('div', { class: 'card' + (s.cut ? ' cut' : '') + (sameRef(S.sel, ref) ? ' sel' : ''), onclick: () => select(ref) },
    h('div', { class: 'thumb', style: f ? { backgroundImage: `url("${fileUrl(f)}")` } : null }, f ? '' : (s.imgFrom ? `картинка = кадр ${s.imgFrom}` : !s.img ? 'только видео' : 'ещё не нарисован')),
    run ? h('span', { class: 'spin' }, run.status === 'queued' ? 'в очереди' : 'рисует…') : null,
    h('div', { class: 'meta' }, h('span', { class: 'dot st-' + dot, title: STATUS[s.status] || '' }), h('b', {}, s.id),
      h('span', { class: 't' }, `${s.dur || '?'} с`), s.tool ? h('span', { class: 'badge' }, s.tool) : null,
      s.cut ? h('span', { class: 'badge warn' }, 'можно вырезать') : null,
      s.versions?.length > 1 ? h('span', { class: 'badge' }, 'v' + s.versions.length) : null),
    h('div', { class: 'desc' }, s.frame || s.vid || ''));
}
function renderBoard() {
  const main = $('#main');
  const all = S.ep.scenes.flatMap((sc) => sc.shots);
  const c = counts(all);
  const total = all.filter((s) => !s.cut).reduce((a, s) => a + (s.dur || 0), 0);
  const pass = (s) => S.filter === 'all' || s.status === S.filter;
  const prog = h('div', { class: 'progress', title: `утверждено ${c.approved}, на проверке ${c.review}, осталось ${c.todo}` },
    h('i', { style: { width: (c.approved / c.all * 100) + '%', background: 'var(--ok)' } }),
    h('i', { style: { width: (c.review / c.all * 100) + '%', background: 'var(--review)' } }));
  const bar = h('div', { class: 'bar' },
    h('div', { class: 'chips' }, ...[['all', 'Все'], ['todo', 'Нужно сделать'], ['review', 'На проверке'], ['approved', 'Утверждено']].map(([k, t]) =>
      h('button', { class: 'chip' + (S.filter === k ? ' on' : ''), onclick: () => { S.filter = k; render(); } }, `${t} ${k === 'all' ? c.all : c[k] || 0}`))),
    prog, h('span', { class: 'muted' }, `≈ ${Math.round(total / 6) / 10} мин`), h('span', { class: 'grow' }),
    h('button', { onclick: drawMissing, title: 'Отправить в очередь все кадры без картинки (только видимые по фильтру сцены)' }, 'Нарисовать все недостающие'),
    h('button', { class: 'primary', onclick: doExport }, 'Пакет для видео'));
  const side = h('div', { class: 'scenes' }, ...S.ep.scenes.map((sc) => {
    const k = counts(sc.shots);
    return h('button', { onclick: () => document.getElementById('sc' + sc.n)?.scrollIntoView({ behavior: 'smooth' }) },
      h('span', {}, `${sc.n}. ${sc.title}`), h('span', { class: 'cnt' }, `${k.approved}/${k.all}`));
  }));
  const body = h('div', {}, bar, h('div', { class: 'sub muted', style: { marginBottom: '14px' } }, `${S.ep.source} · ${S.ep.note || ''}`),
    ...S.ep.scenes.map((sc) => {
      const shots = sc.shots.filter(pass);
      if (!shots.length) return null;
      const loc = S.state.project.locations.find((l) => l.id === sc.location);
      return h('section', { class: 'scene', id: 'sc' + sc.n },
        h('h2', {}, `Сцена ${sc.n}. ${sc.title}`),
        h('div', { class: 'sub' }, `~${sc.dur} с · ${sc.shots.length} кадров` + (loc ? ` · локация: ${loc.name}` : '') + (sc.note ? ' · ' + sc.note : '')),
        h('div', { class: 'grid' }, ...shots.map((s) => shotCard(s, { kind: 'shot', ep: S.ep.id, id: s.id }))));
    }));
  main.replaceChildren(h('div', { class: 'board' }, side, body));
}
async function drawMissing() {
  const refs = S.ep.scenes.flatMap((sc) => sc.shots).filter((s) => !s.cut && !s.versions?.length && s.img).map((s) => ({ kind: 'shot', ep: S.ep.id, id: s.id }));
  if (!refs.length) return toast('Все кадры с IMG уже нарисованы');
  if (!confirm(`Отправить в очередь ${refs.length} кадров? Кодекс будет рисовать их по одному. Совет: сначала сделай листы персонажей и фоны локаций — так кадры выйдут согласованными.`)) return;
  await POST('/api/generate', { refs, opts: { generator: gen() } });
  toast(`В очереди: ${refs.length}`);
  pollJobs(true);
}
async function doExport() {
  const r = await POST('/api/export', { ep: S.ep.id });
  toast(`Готово: ${r.shots} кадров в ${r.dir}` + (r.missing ? ` · без картинки: ${r.missing}` : ''), 7000);
  POST('/api/open', { path: r.dir }).catch(() => {});
}

// ---------- персонажи и локации ----------
function assetGrid(kind) {
  const list = kind === 'character' ? S.state.project.characters : S.state.project.locations;
  const groups = {};
  for (const it of list) (groups[it.group || (kind === 'location' ? 'Локации' : 'Прочее')] ||= []).push(it);
  const usage = {};
  for (const sc of S.ep.scenes) for (const s of sc.shots) {
    if (kind === 'character') for (const c of s.characters || []) usage[c] = (usage[c] || 0) + 1;
    else { const l = s.location || sc.location; if (l) usage[l] = (usage[l] || 0) + 1; }
  }
  const missing = list.filter((x) => !selFile(x) && usage[x.id]);
  return h('div', {},
    h('div', { class: 'bar' },
      h('span', { class: 'muted' }, kind === 'character'
        ? 'Листы персонажей — главный способ держать внешность одинаковой. Они прикладываются к каждому кадру, где герой есть.'
        : 'Фон каждой локации прикладывается к кадрам этой локации — архитектура и свет не «плывут».'),
      h('span', { class: 'grow' }),
      missing.length ? h('button', { class: 'primary', onclick: async () => {
        await POST('/api/generate', { refs: missing.map((x) => ({ kind, id: x.id })), opts: { generator: gen() } });
        toast('В очереди: ' + missing.length); pollJobs(true);
      } }, `Нарисовать недостающие (${missing.length})`) : null,
      h('button', { onclick: () => addAsset(kind) }, kind === 'character' ? '+ Персонаж' : '+ Локация')),
    ...Object.entries(groups).map(([g, items]) => h('section', { class: 'scene' }, h('h2', {}, g),
      h('div', { class: 'grid' }, ...items.map((it) => {
        const ref = { kind, id: it.id };
        const f = selFile(it);
        const run = runningFor(ref);
        return h('div', { class: 'card' + (sameRef(S.sel, ref) ? ' sel' : ''), onclick: () => select(ref) },
          h('div', { class: 'thumb' + (kind === 'character' ? ' sheet' : ''), style: f ? { backgroundImage: `url("${fileUrl(f)}")` } : null }, f ? '' : 'нет референса'),
          run ? h('span', { class: 'spin' }, 'рисует…') : null,
          h('div', { class: 'meta' }, h('span', { class: 'dot st-' + (f ? 'approved' : 'todo') }), h('b', {}, it.name),
            usage[it.id] ? h('span', { class: 'badge' }, `в ${usage[it.id]} кадрах`) : null,
            !f && usage[it.id] ? h('span', { class: 'badge warn' }, 'нужен') : null),
          h('div', { class: 'desc' }, it.token || it.prompt || ''));
      })))));
}
async function addAsset(kind) {
  const id = prompt(kind === 'character' ? 'Код персонажа латиницей (например MIRA):' : 'Код локации латиницей (например east-outpost):');
  if (!id) return;
  const name = prompt('Название по-русски:') || id;
  const desc = prompt(kind === 'character' ? 'Описание внешности (лучше по-английски):' : 'Описание места (лучше по-английски):') || '';
  const item = kind === 'character' ? { id: id.toUpperCase(), name, group: 'Новые', token: desc } : { id, name, palette: 'PAL-DESERT', prompt: desc };
  await POST('/api/add', { kind, item });
  await loadState(); render(); select({ kind, id: item.id });
}

// ---------- стиль ----------
function renderStyle() {
  const pr = S.state.project;
  const shots = pr.styleLab.shots;
  const labRef = (st, s) => ({ kind: 'lab', id: `${st}|${s.ep}|${s.id}` });
  const table = h('table', {},
    h('tr', {}, h('th', {}, 'Стиль'), ...shots.map((s) => h('th', {}, `Кадр ${s.id}`))),
    ...pr.styles.map((st) => h('tr', {},
      h('td', { class: 'style-head' }, h('b', {}, st.name), pr.activeStyle === st.id ? h('div', { class: 'active' }, '● активный стиль серии') : null,
        h('p', {}, st.about),
        h('div', { class: 'actions' },
          h('button', { onclick: async () => {
            await POST('/api/generate', { refs: shots.map((s) => labRef(st.id, s)), opts: { generator: gen() } });
            toast('Пробы отправлены'); pollJobs(true);
          } }, 'Сделать пробы'),
          pr.activeStyle !== st.id ? h('button', { class: 'ok', onclick: async () => {
            await POST('/api/project', { activeStyle: st.id }); await loadState(); render(); toast('Стиль серии: ' + st.name);
          } }, 'Выбрать для серии') : null),
        h('details', {}, h('summary', {}, 'Текст стиля'),
          h('textarea', { class: 'code', onchange: async (e) => { await POST('/api/project', { style: { id: st.id, text: e.target.value } }); await loadState(); toast('Сохранено'); } }, st.text))),
      ...shots.map((s) => {
        const ref = labRef(st.id, s);
        const it = S.state.lab.items[ref.id];
        const f = selFile(it);
        const run = runningFor(ref);
        return h('td', { class: 'cell' }, h('div', { class: 'card' + (sameRef(S.sel, ref) ? ' sel' : ''), onclick: () => select(ref) },
          h('div', { class: 'thumb', style: f ? { backgroundImage: `url("${fileUrl(f)}")` } : null }, f ? '' : '—'),
          run ? h('span', { class: 'spin' }, 'рисует…') : null));
      }))));
  $('#main').replaceChildren(h('div', {},
    h('div', { class: 'bar' }, h('span', { class: 'muted' }, pr.styleLab.about), h('span', { class: 'grow' }),
      h('button', { class: 'primary', onclick: async () => {
        const refs = pr.styles.flatMap((st) => shots.map((s) => labRef(st.id, s))).filter((r) => !selFile(S.state.lab.items[r.id]));
        if (!refs.length) return toast('Все пробы уже есть');
        await POST('/api/generate', { refs, opts: { generator: gen() } }); toast(`Отправлено проб: ${refs.length}`); pollJobs(true);
      } }, 'Сделать все пробы'),
      h('button', { onclick: async () => {
        const name = prompt('Название нового стиля:'); if (!name) return;
        const text = prompt('Текст стиля (по-английски, как в промпте):'); if (!text) return;
        await POST('/api/project', { style: { id: 'st' + Date.now().toString(36), name, about: 'Свой стиль', text } }); await loadState(); render();
      } }, '+ Свой стиль')),
    h('div', { class: 'lab' }, table)));
}

// ---------- очередь ----------
function renderQueue() {
  const list = S.jobs;
  $('#main').replaceChildren(h('div', { class: 'jobs' },
    h('div', { class: 'bar' }, h('span', { class: 'muted' }, 'Задания идут по одному. Можно закрыть вкладку — сервер продолжит работать, пока открыто окно студии.')),
    !list.length ? h('div', { class: 'muted' }, 'Пока пусто.') : null,
    ...list.map((j) => h('div', { class: 'job' },
      h('div', { class: 'row' }, h('b', {}, j.label), h('span', { class: 'st ' + j.status }, {
        queued: 'в очереди', running: 'рисует…', done: 'готово', failed: 'ошибка', manual: 'ждёт картинку', cancelled: 'отменено' }[j.status] || j.status),
      h('span', { class: 'muted' }, j.generator), h('span', { class: 'grow' }), h('span', { class: 'muted' }, j.createdAt),
      h('button', { class: 'ghost', onclick: () => select(j.ref) }, 'Открыть'),
      ['queued', 'running', 'manual'].includes(j.status) ? h('button', { class: 'ghost', onclick: async () => { await POST('/api/job/cancel', { id: j.id }); pollJobs(true); } }, 'Отменить') : null),
      j.note ? h('div', { class: 'muted' }, 'Правка: ' + j.note) : null,
      j.status === 'manual' ? h('div', {}, h('p', {}, 'Ручной режим: скопируй промпт, приложи референсы в чат Кодекса или ChatGPT, а готовую картинку перетащи на кадр. Файл задания: ', h('code', {}, j.queueFile)),
        h('button', { onclick: async () => copy((await GET('/api/job?id=' + j.id)).prompt) }, 'Скопировать промпт')) : null,
      j.status === 'failed' || j.status === 'running' ? h('details', {}, h('summary', {}, 'Лог'), h('pre', {}, j.logTail || '')) : null))));
}

// ---------- канон ----------
// ---------- иллюстрации книги ----------
// Иллюстрации на Диске весят 20–100+ МБ. Браузер уменьшает их до 2048 px,
// чтобы они влезли в GitHub и быстро уходили художнику.
async function shrink(file, max = 2048) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  if (k === 1 && file.size < 6e6) return file;
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
}
async function addToLibrary(files) {
  const out = [];
  const list = [...files].filter((f) => f.type.startsWith('image/'));
  for (let i = 0; i < list.length; i++) {
    toast(`Уменьшаю и сохраняю ${i + 1} из ${list.length}: ${list[i].name}`, 60000);
    try {
      const small = await shrink(list[i]);
      const r = await fetch('/api/library/upload?name=' + encodeURIComponent(small.name), { method: 'POST', headers: { 'Content-Type': small.type }, body: small });
      out.push((await r.json()).file);
    } catch (e) { toast('Не получилось: ' + list[i].name + ' — ' + e.message, 6000); }
  }
  S.library = null;
  toast(`Готово: ${out.length} в «Аниме/Иллюстрации книги». Не забудь Commit → Push в GitHub Desktop.`, 6000);
  return out;
}
async function library() {
  S.library ||= await GET('/api/library');
  return S.library;
}
function dropZone(text, onFiles) {
  const input = h('input', { type: 'file', accept: 'image/*', multiple: true, style: { display: 'none' }, onchange: (e) => onFiles(e.target.files) });
  const z = h('div', { class: 'dropzone', onclick: () => input.click() }, text, input);
  z.addEventListener('dragover', (e) => { e.preventDefault(); z.classList.add('drag'); });
  z.addEventListener('dragleave', () => z.classList.remove('drag'));
  z.addEventListener('drop', (e) => { e.preventDefault(); z.classList.remove('drag'); onFiles(e.dataTransfer.files); });
  return z;
}
function zoom(file) { $('#lightbox img').src = fileUrl(file); $('#lightbox').classList.remove('hidden'); }
async function renderLib() {
  const lib = await library();
  const groups = {};
  for (const x of lib) (groups[x.folder] ||= []).push(x);
  const order = Object.keys(groups).sort((a, b) => (b === 'Иллюстрации книги') - (a === 'Иллюстрации книги') || a.localeCompare(b));
  $('#main').replaceChildren(h('div', {},
    dropZone(h('div', {}, h('b', {}, 'Перетащи сюда иллюстрации из Google Диска'), h('div', { class: 'muted' }, 'Можно много сразу. Студия уменьшит их до 2048 px и положит в «Аниме/Иллюстрации книги». Потом привяжи нужные к персонажу или локации: открой карточку → «Референсы».')),
      async (files) => { await addToLibrary(files); renderLib(); }),
    ...order.map((g) => h('section', { class: 'scene' }, h('h2', {}, g),
      h('div', { class: 'grid' }, ...groups[g].map((x) => h('div', { class: 'card', onclick: () => zoom(x.file) },
        h('div', { class: 'thumb', style: { backgroundImage: `url("${fileUrl(x.file)}")` } }),
        h('div', { class: 'meta' }, h('span', { class: 't' }, x.file.split('/').pop())))))))));
}
async function pickFromLibrary() {
  const lib = await library();
  return new Promise((resolve) => {
    const close = (v) => { m.remove(); resolve(v); };
    const m = h('div', { class: 'modal', onclick: (e) => e.target === m && close(null) },
      h('div', { class: 'modal-box' },
        h('div', { class: 'head' }, h('h3', {}, 'Выбери иллюстрацию'), h('button', { class: 'x ghost', onclick: () => close(null) }, '✕')),
        h('div', { class: 'grid' }, ...lib.map((x) => h('div', { class: 'card', onclick: () => close(x.file) },
          h('div', { class: 'thumb', style: { backgroundImage: `url("${fileUrl(x.file)}")` } }),
          h('div', { class: 'meta' }, h('span', { class: 't' }, x.folder + ' / ' + x.file.split('/').pop())))))));
    document.body.append(m);
  });
}
function refsBox(ref, it) {
  const refs = it.refs || [];
  const setRefs = async (next) => { await save(ref, { refs: next }); renderPanel(); };
  const add = async (files) => { if (files.length) await setRefs([...refs, ...files.map((file) => ({ file }))]); };
  const hint = ref.kind === 'character' ? 'Иллюстрации книги с этим героем. Они уходят художнику, когда рисуется лист персонажа; пока листа нет — и в кадры.'
    : ref.kind === 'location' ? 'Иллюстрации этого места — художник повторит архитектуру и настроение.'
    : 'Картинка-подсказка для этого кадра: композиция, поза, настроение.';
  return h('div', { class: 'field' }, h('label', {}, `Референсы (${refs.length})`),
    h('div', { class: 'muted', style: { fontSize: '12.5px', marginBottom: '6px' } }, hint),
    refs.length ? h('div', { class: 'reflist' }, ...refs.map((r, i) => h('div', { class: 'refitem' },
      h('img', { src: fileUrl(r.file), onclick: () => zoom(r.file) }),
      h('input', { value: r.note || '', placeholder: 'пометка: «в бою», «в детстве»…', onchange: (e) => setRefs(refs.map((x, j) => (j === i ? { ...x, note: e.target.value } : x))) }),
      h('button', { class: 'ghost', title: 'Убрать (файл останется в библиотеке)', onclick: () => setRefs(refs.filter((_, j) => j !== i)) }, '✕')))) : null,
    h('div', { class: 'actions' },
      h('button', { onclick: async () => { const f = await pickFromLibrary(); if (f) add([f]); } }, '+ Из библиотеки'),
      dropZone('+ Перетащи файл сюда', async (files) => add(await addToLibrary(files)))));
}

function renderCanon() {
  const pr = S.state.project;
  $('#main').replaceChildren(h('div', { class: 'canon' },
    h('div', { class: 'box' }, h('h3', {}, 'Правила, которые проверяются в каждом промпте'), h('ul', {}, ...pr.rules.map((r) => h('li', {}, r.msg)))),
    h('div', { class: 'box' }, h('h3', {}, 'Открытые вопросы к автору'), h('ul', {}, ...pr.questions.map((q) => h('li', {}, q))),
      h('p', { class: 'muted' }, 'Ответы пиши Claude в чат — он внесёт их в канон.')),
    h('div', { class: 'box' }, h('h3', {}, 'Палитры'), h('ul', {}, ...Object.entries(pr.palettes).map(([k, v]) => h('li', {}, h('b', {}, k), ` — ${v.name}: `, h('span', { class: 'muted' }, v.text))))),
    h('div', { class: 'box' }, h('h3', {}, 'Источники серии'), h('ul', {},
      h('li', {}, h('a', { href: fileUrl(S.ep.storyboard), target: '_blank' }, 'Раскадровка')),
      h('li', {}, h('a', { href: fileUrl(S.ep.chapter), target: '_blank' }, 'Текст главы')),
      h('li', {}, h('a', { href: fileUrl('studio/inbox.md'), target: '_blank' }, 'Журнал студии (для Claude)')))),
    h('div', { class: 'box', style: { gridColumn: '1 / -1' } }, h('h3', {}, 'Книга'), h('div', { style: { columns: '3 260px' } },
      ...(S.state.book || []).map((b) => h('div', {}, h('a', { href: fileUrl('studio/canon/book/' + b), target: '_blank' }, b.replace(/\.txt$/, ''))))))));
}

// ---------- панель кадра ----------
async function select(ref) {
  S.sel = ref;
  document.body.classList.add('with-panel');
  $('#panel').classList.remove('hidden');
  render(true);
  await renderPanel();
}
function closePanel() {
  S.sel = null;
  document.body.classList.remove('with-panel');
  $('#panel').classList.add('hidden');
  render(true);
}
async function save(ref, patch) {
  await POST('/api/update', { ref, patch });
  if (ref.kind === 'shot') await loadEp(); else await loadState();
}
function field(label, value, onsave, opts = {}) {
  const ta = h('textarea', { class: opts.code ? 'code' : '', rows: opts.rows || 3, onchange: (e) => onsave(e.target.value) }, value || '');
  return h('div', { class: 'field' }, h('label', {}, label, opts.copy ? h('button', { class: 'ghost', onclick: () => copy(ta.value) }, 'копировать') : null), ta);
}
function ro(label, value) {
  return value ? h('div', { class: 'field' }, h('label', {}, label), h('div', { class: 'ro' }, value)) : null;
}

async function renderPanel() {
  const ref = S.sel;
  const panel = $('#panel');
  if (!ref) return;
  if (ref.kind === 'shot' && ref.ep !== S.ep.id) { $('#epSel').value = ref.ep; await loadEp(); }
  const it = itemOf(ref) || { versions: [], selected: null };
  const shotInfo = ref.kind === 'shot' ? findShot(ref.id) : null;
  const s = shotInfo?.shot;
  const f = selFile(it);
  const run = runningFor(ref);
  let preview = null;
  try { preview = await POST('/api/preview', { ref, opts: {} }); } catch (e) { preview = { prompt: 'Ошибка: ' + e.message, refs: [], warnings: [] }; }
  if (!sameRef(S.sel, ref)) return;

  let title, sub;
  if (ref.kind === 'shot') { title = `Кадр ${s.id}`; sub = `Сцена ${shotInfo.scene.n}. ${shotInfo.scene.title} · ${s.dur || '?'} с · ${s.camera || ''} · ${s.tool || ''}`; }
  else if (ref.kind === 'lab') { const [st, , id] = ref.id.split('|'); title = `Проба: ${S.state.project.styles.find((x) => x.id === st)?.name}`; sub = `Кадр ${id}`; }
  else { title = it.name; sub = ref.kind === 'character' ? 'Лист персонажа' : 'Фон локации'; }

  const note = h('textarea', { rows: 3, placeholder: f ? 'Например: «волосы длиннее, взгляд ниже, убрать второго офицера». Остальное останется как есть.' : 'Пожелания к первой версии (необязательно)' });
  const gen1 = async (edit) => {
    const opts = { generator: gen(), note: note.value.trim(), edit: edit && !!f };
    if (edit && !opts.note) return toast('Напиши, что поменять');
    await POST('/api/generate', { ref, opts });
    note.value = '';
    toast(opts.generator === 'manual' ? 'Задание создано — смотри «Очередь»' : 'Отправлено художнику');
    pollJobs(true);
  };
  const fileInput = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' }, onchange: (e) => e.target.files[0] && upload(ref, e.target.files[0]) });

  const viewer = h('div', { class: 'viewer' },
    f ? h('img', { src: fileUrl(f), onclick: () => zoom(f) })
      : h('div', { class: 'empty' }, run ? 'Рисует… картинка появится здесь сама.' : 'Ещё нет картинки.', run ? null : h('button', { class: 'primary', onclick: () => gen1(false) }, 'Нарисовать'), h('span', { class: 'muted' }, 'или перетащи сюда готовый файл')));
  viewer.addEventListener('dragover', (e) => { e.preventDefault(); viewer.classList.add('drag'); });
  viewer.addEventListener('dragleave', () => viewer.classList.remove('drag'));
  viewer.addEventListener('drop', (e) => { e.preventDefault(); viewer.classList.remove('drag'); const file = e.dataTransfer.files[0]; if (file) upload(ref, file); });

  const versions = (it.versions || []).length ? h('div', { class: 'versions' }, ...it.versions.map((v, i) =>
    h('button', { class: i === it.selected ? 'on' : '', title: `${v.by || ''} ${v.at || ''}\n${v.note || ''}`, onclick: async () => { await save(ref, { selected: i }); renderPanel(); render(true); } },
      h('img', { src: fileUrl(v.file), loading: 'lazy' }), h('span', {}, `v${i + 1} · ${v.by || ''}`)))) : null;

  const actions = h('div', { class: 'actions' },
    ref.kind === 'shot' && f ? h('button', { class: s.status === 'approved' ? 'ok' : '', onclick: async () => { await save(ref, { status: s.status === 'approved' ? 'review' : 'approved' }); renderPanel(); render(true); } },
      s.status === 'approved' ? '✓ Утверждено' : 'Утвердить') : null,
    h('button', { onclick: () => gen1(false), disabled: !!run }, f ? 'Нарисовать заново' : 'Нарисовать'),
    h('button', { onclick: () => fileInput.click() }, 'Загрузить файл'), fileInput,
    h('button', { class: 'ghost', onclick: () => copy(preview.prompt) }, 'Копировать промпт'),
    run ? h('span', { class: 'pill bad' }, run.status === 'queued' ? 'в очереди' : 'рисует…') : null);

  const editBox = h('div', { class: 'edit' }, h('label', {}, f ? 'Что поменять?' : 'Пожелания'), note,
    h('div', { class: 'actions', style: { marginBottom: 0 } },
      f ? h('button', { class: 'primary', onclick: () => gen1(true), disabled: !!run }, 'Перерисовать с правкой') : h('button', { class: 'primary', onclick: () => gen1(false), disabled: !!run }, 'Нарисовать с пожеланием'),
      f ? h('span', { class: 'muted', style: { alignSelf: 'center' } }, 'текущая версия уйдёт как основа') : null));

  const warns = preview.warnings?.length ? h('div', { class: 'warns' }, ...preview.warnings.map((w) => h('div', {}, '⚠ ' + w))) : null;
  const sent = h('details', {}, h('summary', {}, `Что уйдёт художнику: ${preview.refs.length} референс(а) + промпт`),
    h('div', { class: 'refs' }, ...preview.refs.map((r, i) => h('div', {}, h('img', { src: fileUrl(r.file) }), h('span', {}, h('b', {}, `${i + 1}. `), r.role)))),
    h('pre', {}, preview.prompt));

  const fields = [ref.kind !== 'lab' ? refsBox(ref, it) : null];
  if (ref.kind === 'shot') {
    const pr = S.state.project;
    const locSel = h('select', { onchange: async (e) => { await save(ref, { location: e.target.value || null }); renderPanel(); } },
      h('option', { value: '' }, `— как у сцены (${pr.locations.find((l) => l.id === shotInfo.scene.location)?.name || 'нет'}) —`),
      ...pr.locations.map((l) => h('option', { value: l.id, selected: s.location === l.id }, l.name)));
    const chars = h('div', { class: 'togg' }, ...pr.characters.map((c) => {
      const on = (s.characters || []).includes(c.id);
      return h('button', { class: 'chip' + (on ? ' on' : ''), onclick: async () => {
        const next = on ? s.characters.filter((x) => x !== c.id) : [...(s.characters || []), c.id];
        await save(ref, { characters: next }); renderPanel();
      } }, c.name);
    }));
    fields.push(
      ro('Кадр', s.frame), ro('Звук', s.sound), s.note ? ro('Примечание', s.note) : null,
      h('div', { class: 'field' }, h('label', {}, 'Локация'), locSel),
      h('div', { class: 'field' }, h('label', {}, 'В кадре'), chars),
      s.imgFrom ? ro('Картинка', `Берётся из кадра ${s.imgFrom}. Можно нарисовать отдельную — она заменит.`) : null,
      field('IMG — промпт картинки', s.img, async (v) => { await save(ref, { img: v }); renderPanel(); }, { code: true, rows: 4 }),
      field('VID — промпт движения для ' + (s.tool || 'видео'), s.vid, (v) => save(ref, { vid: v }), { code: true, rows: 3, copy: true }),
      field('Заметка для Claude (логика, канон, вопросы)', s.notes, (v) => save(ref, { notes: v }), { rows: 2 }));
  } else if (ref.kind === 'character') {
    fields.push(
      field('Токен — как описывать героя в кадрах', it.token, async (v) => { await save(ref, { token: v }); renderPanel(); }, { code: true, rows: 3 }),
      field('Промпт листа персонажа', it.sheetPrompt, async (v) => { await save(ref, { sheetPrompt: v }); renderPanel(); }, { code: true, rows: 4 }));
  } else if (ref.kind === 'location') {
    const pals = Object.entries(S.state.project.palettes);
    fields.push(
      h('div', { class: 'field' }, h('label', {}, 'Палитра'), h('select', { onchange: async (e) => { await save(ref, { palette: e.target.value }); renderPanel(); } },
        ...pals.map(([k, v]) => h('option', { value: k, selected: it.palette === k }, `${k} — ${v.name}`)))),
      field('Описание места', it.prompt, async (v) => { await save(ref, { prompt: v }); renderPanel(); }, { code: true, rows: 4 }));
  }

  panel.replaceChildren(...[
    h('div', { class: 'head' }, h('div', {}, h('h3', {}, title), h('div', { class: 'sub' }, sub)), h('button', { class: 'x ghost', onclick: closePanel }, '✕')),
    viewer, versions, actions, editBox, warns, sent, ...fields].filter(Boolean));
}

async function upload(ref, file) {
  file = await shrink(file, 2560).catch(() => file);
  const r = await fetch('/api/upload?ref=' + encodeURIComponent(JSON.stringify(ref)), { method: 'POST', headers: { 'Content-Type': file.type || 'image/png' }, body: file });
  if (!r.ok) return toast('Не получилось загрузить');
  toast('Картинка добавлена как новая версия');
  if (ref.kind === 'shot') await loadEp(); else await loadState();
  render(true); renderPanel();
}

// ---------- опрос очереди ----------
async function pollJobs(force) {
  try {
    const jobs = await GET('/api/jobs');
    const sig = jobs.map((j) => j.id + j.status).join();
    const finished = S.jobs.filter((j) => ['queued', 'running'].includes(j.status) && jobs.find((x) => x.id === j.id && ['done', 'failed'].includes(x.status)));
    S.jobs = jobs;
    const active = jobs.filter((j) => ['queued', 'running', 'manual'].includes(j.status)).length;
    $('#qcount').textContent = active ? `(${active})` : '';
    if (sig !== S.jobsSig || force) {
      S.jobsSig = sig;
      if (finished.length) {
        await loadState();
        const fails = finished.filter((j) => jobs.find((x) => x.id === j.id).status === 'failed');
        toast(fails.length ? `Ошибка: ${fails.map((j) => j.label).join(', ')} — смотри «Очередь»` : `Готово: ${finished.map((j) => j.label).join(', ')}`, 5000);
      }
      render(true);
      if (finished.some((j) => sameRef(j.ref, S.sel)) || force) renderPanel();
    }
  } catch {}
}

// ---------- общий рендер ----------
function fitPanel() {
  document.documentElement.style.setProperty('--top', $('.top').offsetHeight + 'px');
}

function render(keepScroll) {
  const y = window.scrollY;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.view === S.view));
  if (S.view === 'board') renderBoard();
  else if (S.view === 'chars') $('#main').replaceChildren(assetGrid('character'));
  else if (S.view === 'locs') $('#main').replaceChildren(assetGrid('location'));
  else if (S.view === 'style') renderStyle();
  else if (S.view === 'queue') renderQueue();
  else if (S.view === 'canon') renderCanon();
  else if (S.view === 'lib') renderLib();
  if (keepScroll) window.scrollTo(0, y);
}

async function checkGen() {
  const el = $('#genStatus');
  if (gen() === 'manual') { el.textContent = 'ручной режим'; el.className = 'pill'; return; }
  if (gen() === 'openai') { el.textContent = 'нужен OPENAI_API_KEY'; el.className = 'pill'; return; }
  el.textContent = 'проверяю Кодекс…';
  const r = await GET('/api/check').catch((e) => ({ ok: false, text: e.message }));
  el.textContent = r.ok ? 'Кодекс на связи' : 'Кодекс не найден';
  el.title = r.text;
  el.className = 'pill ' + (r.ok ? 'good' : 'bad');
}

document.addEventListener('DOMContentLoaded', async () => {
  $('#tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { S.view = b.dataset.view; render(); window.scrollTo(0, 0); } });
  $('#epSel').addEventListener('change', async (e) => { lsSet('ep', e.target.value); await loadEp(); closePanel(); });
  $('#lightbox').addEventListener('click', () => $('#lightbox').classList.add('hidden'));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (!$('#lightbox').classList.contains('hidden')) $('#lightbox').classList.add('hidden'); else if (S.sel) closePanel(); } });
  fitPanel();
  window.addEventListener('resize', fitPanel);
  await loadState();
  $('#genSel').value = lsGet('gen', S.state.generator || 'codex');
  $('#genSel').addEventListener('change', () => { lsSet('gen', gen()); checkGen(); });
  render();
  checkGen();
  pollJobs();
  setInterval(pollJobs, 2500);
});
