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
      s.cut ? h('span', { class: 'badge warn' }, 'вырезан') : s.optional ? h('span', { class: 'badge warn' }, 'можно вырезать') : null,
      s.videos?.length ? h('span', { class: 'badge vid' + (s.videoStatus === 'approved' ? ' ok' : '') }, '▶ видео') : null,
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
      j.status === 'failed' ? h('div', { class: 'warns', style: { margin: '8px 0 0' } }, '⚠ ' + errorLine(j.logTail)) : null,
      j.status === 'failed' ? h('div', { class: 'actions', style: { margin: '8px 0 0' } },
        h('button', { class: 'primary', onclick: async () => { await POST('/api/job/retry', { id: j.id, generator: gen() }); pollJobs(true); } }, 'Повторить'),
        h('button', { onclick: async () => copy((await GET('/api/job?id=' + j.id)).log) }, 'Скопировать лог для Claude')) : null,
      j.status === 'failed' || j.status === 'running' ? h('details', {}, h('summary', {}, 'Лог'), h('pre', {}, j.logTail || '')) : null))));
}
// Самая понятная строка ошибки из лога Кодекса
function errorLine(log = '') {
  const lines = log.split('\n').map((l) => l.trim()).filter(Boolean);
  const hit = [...lines].reverse().find((l) => /error|ошибк|не найден|not found|unexpected|denied|failed|limit|unauthor/i.test(l));
  return hit || lines.pop() || 'Кодекс не вернул картинку — открой лог ниже.';
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
      h('img', { src: fileUrl(v.file), loading: 'lazy' }), h('span', {}, `v${i + 1} · ${v.by || ''}`),
      h('i', { class: 'del', title: 'Удалить эту версию', onclick: async (e) => {
        e.stopPropagation();
        if (!confirm(`Удалить версию v${i + 1}?` + (v.file.startsWith('studio/media/') ? ' Файл удалится с диска.' : ' Исходный файл в папке «Аниме» останется.'))) return;
        await POST('/api/version/delete', { ref, index: i });
        if (ref.kind === 'shot') await loadEp(); else await loadState();
        renderPanel(); render(true);
      } }, '✕')))) : null;

  const actions = h('div', { class: 'actions' },
    ref.kind === 'shot' && f ? h('button', { class: s.status === 'approved' ? 'ok' : '', onclick: async () => { await save(ref, { status: s.status === 'approved' ? 'review' : 'approved' }); renderPanel(); render(true); } },
      s.status === 'approved' ? '✓ Утверждено' : 'Утвердить') : null,
    h('button', { onclick: () => gen1(false), disabled: !!run }, f ? 'Нарисовать заново' : 'Нарисовать'),
    h('button', { onclick: () => fileInput.click() }, 'Загрузить файл'), fileInput,
    h('button', { class: 'ghost', onclick: () => copy(preview.prompt) }, 'Копировать промпт'),
    ref.kind === 'shot' ? h('button', { class: 'ghost', title: 'Вырезанный кадр не попадает в пакет для видео и монтаж', onclick: async () => { await save(ref, { cut: !s.cut }); renderPanel(); render(true); } }, s.cut ? 'Вернуть кадр' : 'Вырезать кадр') : null,
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
      ro('Кадр', s.frame), ro('Звук', s.sound), linesBox(ref, s), s.note ? ro('Примечание', s.note) : null,
      h('div', { class: 'field' }, h('label', {}, 'Локация'), locSel),
      h('div', { class: 'field' }, h('label', {}, 'В кадре'), chars),
      s.imgFrom ? ro('Картинка', `Берётся из кадра ${s.imgFrom}. Можно нарисовать отдельную — она заменит.`) : null,
      field('IMG — промпт картинки', s.img, async (v) => { await save(ref, { img: v }); renderPanel(); }, { code: true, rows: 4 }),
      field('VID — промпт движения для ' + (s.tool || 'видео'), s.vid, (v) => save(ref, { vid: v }), { code: true, rows: 3, copy: true }),
      field('Заметка для Claude (логика, канон, вопросы)', s.notes, (v) => save(ref, { notes: v }), { rows: 2 }));
  } else if (ref.kind === 'character') {
    fields.push(ro('Канон из книги', it.canon),
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
    viewer, versions, actions, editBox, ref.kind === 'shot' ? videoBox(ref, s, shotInfo.scene, preview) : null, warns, sent, ...fields].filter(Boolean));
}

// ---------- видео кадра ----------
// Ключевая картинка для оживления: своя, из кадра-источника или последняя нарисованная в сцене
function keyframeOf(s, scene) {
  let f = selFile(s);
  if (!f && s.imgFrom) f = selFile(findShot(s.imgFrom)?.shot);
  if (!f && scene) f = selFile(scene.shots.slice(0, scene.shots.indexOf(s)).reverse().find((x) => selFile(x)));
  return f;
}
const selVideo = (s) => (s && s.videoSelected != null && s.videos?.[s.videoSelected] ? s.videos[s.videoSelected].file : null);

function uploadVideo(ref, file) {
  return new Promise((resolve) => {
    const x = new XMLHttpRequest();
    x.open('POST', '/api/video/upload?ref=' + encodeURIComponent(JSON.stringify(ref)) + '&name=' + encodeURIComponent(file.name));
    x.setRequestHeader('Content-Type', file.type || 'video/mp4');
    x.upload.onprogress = (e) => e.lengthComputable && toast(`Загружаю видео… ${Math.round(e.loaded / e.total * 100)}%`, 60000);
    x.onload = async () => {
      if (x.status !== 200) toast('Не получилось: ' + (JSON.parse(x.responseText || '{}').error || x.status), 6000);
      else toast('Видео добавлено');
      await loadEp(); render(true); renderPanel(); resolve();
    };
    x.onerror = () => { toast('Не получилось загрузить видео', 6000); resolve(); };
    x.send(file);
  });
}

function videoBox(ref, s, scene, preview) {
  const v = selVideo(s);
  const key = keyframeOf(s, scene);
  const input = h('input', { type: 'file', accept: 'video/*', style: { display: 'none' }, onchange: (e) => e.target.files[0] && uploadVideo(ref, e.target.files[0]) });
  const box = h('div', { class: 'edit videobox' },
    h('label', {}, 'Видео', s.videoStatus === 'approved' ? h('span', { class: 'pill good', style: { marginLeft: '8px' } }, 'утверждено') : null),
    v ? h('video', { src: fileUrl(v), controls: true, loop: true, preload: 'metadata' }) : h('div', { class: 'muted', style: { marginBottom: '8px' } }, 'Видео ещё нет. Сделай его в Pixverse по подсказке ниже и перетащи файл сюда.'),
    s.videos?.length ? h('div', { class: 'versions' }, ...s.videos.map((x, i) => h('button', { class: (i === s.videoSelected ? 'on ' : '') + 'vthumb', title: x.name || '', onclick: async () => { await save(ref, { videoSelected: i, videoStatus: null }); renderPanel(); } },
      h('span', {}, `▶ видео ${i + 1}`),
      h('i', { class: 'del', title: 'Удалить это видео', onclick: async (e) => {
        e.stopPropagation();
        if (!confirm(`Удалить видео ${i + 1}? Файл удалится с диска.`)) return;
        await POST('/api/version/delete', { ref, index: i, slot: 'video' });
        await loadEp(); renderPanel(); render(true);
      } }, '✕')))) : null,
    h('div', { class: 'actions' },
      v ? h('button', { class: s.videoStatus === 'approved' ? 'ok' : '', onclick: async () => { await save(ref, { videoStatus: s.videoStatus === 'approved' ? null : 'approved' }); renderPanel(); render(true); } }, s.videoStatus === 'approved' ? '✓ Видео утверждено' : 'Утвердить видео') : null,
      h('button', { onclick: () => input.click() }, v ? 'Загрузить ещё вариант' : 'Загрузить видео'), input),
    toolHelp(s, key, preview));
  box.addEventListener('dragover', (e) => { e.preventDefault(); box.classList.add('drag'); });
  box.addEventListener('dragleave', () => box.classList.remove('drag'));
  box.addEventListener('drop', (e) => {
    e.preventDefault(); box.classList.remove('drag');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) uploadVideo(ref, file); else if (file) toast('Сюда — только видео. Картинку перетащи на картинку кадра выше.');
  });
  return box;
}

// Подсказка: как оживить кадр в инструменте из раскадровки. Промпт не меняем — он уже под этот инструмент.
const TOOL_URL = { Pixverse: 'https://app.pixverse.ai/', Kling: 'https://app.klingai.com/', Seedance: 'https://app.pixverse.ai/' };
const VID_ROLE = [[/lord|повелит/i, 'LORD'], [/liam|лиам/i, 'LIAM'], [/dragon/i, 'DRAGON'], [/commander/i, 'ARDAN'], [/captain/i, 'ROY'], [/black sword/i, 'LORD SWORD']];
function toolHelp(s, key, preview) {
  const tool = s.tool || 'Pixverse';
  const chars = S.state.project.characters;
  const refs = [...(s.vid || '').matchAll(/@Image(\d) \(([^)]+)\)/g)].map((m) => {
    const id = VID_ROLE.find(([rx]) => rx.test(m[2]))?.[1];
    const c = chars.find((x) => x.id === id);
    return { n: m[1], role: m[2], c, file: selFile(c) };
  });
  const full = preview?.video || s.vid || '';
  const dl = (file, name) => h('a', { href: fileUrl(file), download: name + (file.match(/\.\w+$/)?.[0] || '.png') }, 'скачать');
  return h('details', { open: !selVideo(s) }, h('summary', {}, `Как сделать в ${tool}`),
    h('ol', { class: 'steps' },
      h('li', {}, 'Открой ', h('a', { href: TOOL_URL[tool] || TOOL_URL.Pixverse, target: '_blank' }, tool),
        tool === 'Seedance' ? ' — в Pixverse выбери модель Seedance.' : tool === 'Kling' ? ' (если Kling есть в Pixverse — можно там).' : ' → Image to Video.'),
      h('li', {}, key ? h('span', {}, 'Стартовый кадр: ', dl(key, `кадр_${s.id}`), key !== selFile(s) ? h('span', { class: 'muted' }, ' — своей картинки нет, взят соседний кадр сцены') : null)
        : refs.length ? h('span', { class: 'muted' }, 'Стартовый кадр не нужен — модель строит сцену по референсам ниже.') : h('span', { class: 'muted' }, 'Сначала нарисуй картинку кадра.')),
      refs.length ? h('li', {}, 'Референсы — загружай в этом порядке:', ...refs.map((r) => h('div', { class: 'copyrow' }, h('code', {}, `@Image${r.n} — ${r.c ? r.c.name : r.role}`), r.file ? dl(r.file, `Image${r.n}_${r.c.id}`) : h('span', { class: 'muted' }, 'нет листа')))) : null,
      h('li', {}, 'Промпт целиком (с репликами для губ):', h('div', { class: 'copyrow' }, h('code', {}, full), h('button', { class: 'ghost', onclick: () => copy(full) }, 'копировать'))),
      h('li', {}, 'Negative prompt: ', h('button', { class: 'ghost', onclick: () => copy(S.state.project.negative) }, 'копировать')),
      h('li', {}, `Длительность по раскадровке: ${s.dur || '?'} с. Ролик длиннее — не страшно, «Монтаж» обрежет по кадру.`),
      h('li', {}, 'Звук в генерации выключай — голос наложим отдельно.'),
      h('li', {}, 'Готовое видео скачай и перетащи в этот блок.')));
}

// ---------- реплики кадра ----------
const MODES = { lips: 'губы в кадре', offscreen: 'голос за кадром', vo: 'мысли / рассказчик' };
function linesBox(ref, s) {
  const ls = s.lines || [];
  const set = async (next) => { await save(ref, { lines: next }); renderPanel(); };
  const who = S.state.project.characters.filter((c) => !['Звери', 'Предметы'].includes(c.group));
  const srcBadge = { book: ['✓ как в книге', 'ok'], changed: ['≈ отличается от книги', 'warn'], absent: ['нет в тексте главы', 'warn'], short: ['коротко', ''] };
  return h('div', { class: 'field' }, h('label', {}, `Реплики (${ls.length})`),
    h('div', { class: 'muted', style: { fontSize: '12.5px', marginBottom: '6px' } }, 'Видео без звука: реплики с режимом «губы в кадре» уходят в видео-промпт, чтобы губы двигались под текст. Голос наложим потом.'),
    ...ls.map((l, i) => {
      const upd = (patch) => set(ls.map((x, j) => (j === i ? { ...x, ...patch } : x)));
      const b = srcBadge[l.src];
      return h('div', { class: 'line' },
        h('div', { class: 'row' },
          h('select', { onchange: (e) => upd({ who: e.target.value }) }, ...who.map((c) => h('option', { value: c.id, selected: l.who === c.id }, c.name)), h('option', { value: 'NARRATOR', selected: l.who === 'NARRATOR' }, 'Рассказчик')),
          h('select', { onchange: (e) => upd({ mode: e.target.value }) }, ...Object.entries(MODES).map(([k, t]) => h('option', { value: k, selected: l.mode === k }, t))),
          b ? h('span', { class: 'badge ' + b[1] }, b[0]) : null,
          h('span', { class: 'muted' }, `~${(l.text.length / 13).toFixed(1)} с`),
          h('button', { class: 'ghost', title: 'Удалить реплику', onclick: () => set(ls.filter((_, j) => j !== i)) }, '✕')),
        h('textarea', { rows: 2, onchange: (e) => upd({ text: e.target.value.trim(), src: 'edited' }) }, l.text),
        l.book ? h('div', { class: 'bookline' }, h('span', { class: 'muted' }, 'В книге: '), l.book, ' ', h('button', { class: 'ghost', onclick: () => upd({ text: l.book.replace(/^Кхм,\s*/, ''), src: 'book' }) }, 'взять из книги')) : null);
    }),
    h('button', { onclick: () => set([...ls, { who: (s.characters || [])[0] || 'LIAM', mode: 'lips', text: '…' }]) }, '+ Реплика'));
}

// ---------- монтаж (аниматик серии) ----------
// Субтитры: только реплики (звуки не пишем), мысли — в скобках
function subText(s) {
  const nm = (id) => S.state.project.characters.find((c) => c.id === id)?.name.split(' ')[0] || (id === 'NARRATOR' ? '' : id);
  return (s.lines || []).filter((l) => !l.optional).map((l) => l.mode === 'vo' ? (l.who === 'NARRATOR' ? `(${l.text})` : `(${nm(l.who)}, мысленно) ${l.text}`) : `${nm(l.who)}: ${l.text}`).join('\n');
}
function montageItems() {
  const out = [];
  for (const sc of S.ep.scenes) for (const s of sc.shots) {
    if (s.cut) continue;
    out.push({ s, scene: sc, video: selVideo(s), img: keyframeOf(s, sc), dur: s.dur || 3 });
  }
  return out;
}
function fmt(t) { t = Math.max(0, Math.round(t)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; }

function renderMontage() {
  const items = montageItems();
  const total = items.reduce((a, x) => a + x.dur, 0);
  const starts = []; items.reduce((a, x, i) => (starts[i] = a, a + x.dur), 0);
  const cnt = { video: items.filter((x) => x.video).length, img: items.filter((x) => !x.video && x.img).length };
  const video = h('video', { playsinline: true, muted: false, preload: 'auto' });
  const img = h('img', { alt: '' });
  const blank = h('div', { class: 'blank' });
  const sub = h('div', { class: 'subs' });
  const tag = h('div', { class: 'tag' });
  const screen = h('div', { class: 'screen' }, blank, img, video, tag, sub);
  const playBtn = h('button', { class: 'primary' }, '▶ Смотреть');
  const time = h('span', { class: 'muted' }, `0:00 / ${fmt(total)}`);
  const subsOn = h('input', { type: 'checkbox', checked: lsGet('subs', '1') === '1', onchange: (e) => { lsSet('subs', e.target.checked ? '1' : '0'); show(cur); } });
  const segs = items.map((x, i) => h('div', { class: 'seg ' + (x.video ? 'v' : x.img ? 'i' : 'e') + (i && x.scene !== items[i - 1].scene ? ' scene' : ''), style: { flexGrow: x.dur }, title: `${x.s.id} · ${x.dur} с · ${x.video ? 'видео' : x.img ? 'картинка' : 'пусто'}`, onclick: () => { cur = i; show(i); } }));
  const line = h('div', { class: 'timeline' }, ...segs);
  const head = h('div', { class: 'playhead' });
  line.append(head);
  let cur = 0, playing = false, t0 = 0, timer = null, raf = null;

  function stopTimers() { clearTimeout(timer); cancelAnimationFrame(raf); }
  function show(i) {
    stopTimers();
    const x = items[i];
    if (!x) { playing = false; playBtn.textContent = '▶ Смотреть'; return; }
    segs.forEach((g, j) => g.classList.toggle('cur', j === i));
    tag.textContent = `Сцена ${x.scene.n} · кадр ${x.s.id} · ${x.dur} с`;
    sub.textContent = subsOn.checked ? subText(x.s) : '';
    sub.style.display = sub.textContent ? '' : 'none';
    video.style.display = x.video ? '' : 'none';
    img.style.display = !x.video && x.img ? '' : 'none';
    blank.textContent = !x.video && !x.img ? `${x.s.id}\n${x.s.frame || ''}` : '';
    video.pause();
    if (x.video) {
      if (video.dataset.file !== x.video) { video.dataset.file = x.video; video.src = fileUrl(x.video); }
      video.currentTime = 0;
      if (playing) video.play().catch(() => {});
    } else if (x.img) {
      img.src = fileUrl(x.img);
      img.classList.remove('kb'); void img.offsetWidth; img.classList.add('kb');
      img.style.animationDuration = x.dur + 's';
      img.style.animationPlayState = playing ? 'running' : 'paused';
    }
    t0 = performance.now();
    if (playing) tick();
    else head.style.left = (starts[i] / total * 100) + '%';
  }
  function tick() {
    const x = items[cur];
    const el = x.video ? video.currentTime : (performance.now() - t0) / 1000;
    head.style.left = Math.min(100, (starts[cur] + Math.min(el, x.dur)) / total * 100) + '%';
    time.textContent = `${fmt(starts[cur] + el)} / ${fmt(total)}`;
    // ролик Pixverse длиннее кадра — обрезаем по хронометражу раскадровки
    if (el >= x.dur || (x.video && video.ended)) { cur++; return show(cur); }
    raf = requestAnimationFrame(tick);
  }
  playBtn.onclick = () => {
    playing = !playing;
    playBtn.textContent = playing ? '⏸ Пауза' : '▶ Смотреть';
    if (playing && cur >= items.length) cur = 0;
    show(cur);
  };
  S.montage = { stop: () => { playing = false; stopTimers(); video.pause(); } };
  $('#main').replaceChildren(h('div', { class: 'montage' },
    h('div', { class: 'bar' },
      h('span', { class: 'muted' }, `Черновой монтаж: ${items.length} кадров, ${fmt(total)}. Видео — ${cnt.video}, картинки вместо видео — ${cnt.img}, пусто — ${items.length - cnt.video - cnt.img}.`)),
    screen,
    h('div', { class: 'bar', style: { marginTop: '10px' } },
      h('button', { onclick: () => { cur = Math.max(0, cur - 1); show(cur); } }, '⏮'), playBtn, h('button', { onclick: () => { cur = Math.min(items.length - 1, cur + 1); show(cur); } }, '⏭'),
      time, h('span', { class: 'grow' }), h('label', { class: 'muted' }, subsOn, ' реплики субтитрами'),
      h('button', { class: 'primary', title: 'Склеить всю серию в один видеофайл', onclick: () => { playing = false; stopTimers(); video.pause(); playBtn.textContent = '▶ Смотреть'; buildEpisodeVideo(items, subsOn.checked); } }, '⬇ Собрать видео серии'),
      h('button', { class: 'ghost', onclick: () => select({ kind: 'shot', ep: S.ep.id, id: items[cur].s.id }) }, 'Открыть кадр')),
    line,
    h('div', { class: 'legend muted' }, h('i', { class: 'seg v' }), ' видео ', h('i', { class: 'seg i' }), ' картинка ', h('i', { class: 'seg e' }), ' пусто · клик по полосе — перейти к кадру')));
  show(0);
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
  // автообновление не должно сбивать воспроизведение монтажа
  if (keepScroll && S.view === 'montage' && S.montage) return;
  if (S.montage) { S.montage.stop(); S.montage = null; }
  const y = window.scrollY;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.view === S.view));
  if (S.view === 'board') renderBoard();
  else if (S.view === 'chars') $('#main').replaceChildren(assetGrid('character'));
  else if (S.view === 'locs') $('#main').replaceChildren(assetGrid('location'));
  else if (S.view === 'style') renderStyle();
  else if (S.view === 'queue') renderQueue();
  else if (S.view === 'canon') renderCanon();
  else if (S.view === 'lib') renderLib();
  else if (S.view === 'montage') renderMontage();
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

// ---------- сборка серии в один видеофайл ----------
// Рисуем кадры на холст и записываем его прямо в браузере — без ffmpeg и установки программ.
// Запись идёт в реальном времени: серия 5 минут собирается ~5 минут.
async function buildEpisodeVideo(items, withSubs) {
  const W = 1280, H = 720, FPS = 30;
  const mime = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m));
  if (!mime) return toast('Этот браузер не умеет записывать видео. Открой студию в Chrome.', 6000);
  const total = items.reduce((a, x) => a + x.dur, 0);
  const canvas = h('canvas', { width: W, height: H });
  const ctx = canvas.getContext('2d');
  const info = h('div', {}, 'Готовлю картинки…');
  const bar = h('i', {});
  let cancelled = false;
  const overlay = h('div', { class: 'modal' }, h('div', { class: 'modal-box render' },
    h('h3', {}, 'Собираю видео серии'), canvas, h('div', { class: 'rbar' }, bar), info,
    h('p', { class: 'muted' }, 'Не сворачивай и не переключай вкладку — браузер тогда ставит запись на паузу.'),
    h('button', { onclick: () => { cancelled = true; } }, 'Отменить')));
  document.body.append(overlay);

  const load = (f) => new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = fileUrl(f); });
  const imgs = {};
  for (const x of items) if (!x.video && x.img && !imgs[x.img]) imgs[x.img] = await load(x.img);
  const fit = (w, h0, k = 1) => { const s = Math.min(W / w, H / h0) * k; return [(W - w * s) / 2, (H - h0 * s) / 2, w * s, h0 * s]; };
  const drawSubs = (text) => {
    if (!withSubs || !text) return;
    ctx.font = '600 30px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    text.split('\n').slice(-2).reverse().forEach((t, i) => {
      const y = H - 50 - i * 40;
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(t, W / 2, y, W - 120);
      ctx.fillStyle = '#fff'; ctx.fillText(t, W / 2, y, W - 120);
    });
  };
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  const rec = new MediaRecorder(canvas.captureStream(FPS), { mimeType: mime, videoBitsPerSecond: 8e6 });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise((r) => (rec.onstop = r));
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  rec.start(1000);
  let elapsed = 0;
  for (const x of items) {
    if (cancelled) break;
    const sub = subText(x.s);
    info.textContent = `Кадр ${x.s.id} · ${fmt(elapsed)} / ${fmt(total)}`;
    let v = null;
    if (x.video) {
      v = h('video', { muted: true, playsinline: true, preload: 'auto' });
      v.muted = true; v.src = fileUrl(x.video);
      await new Promise((r) => { v.oncanplay = r; v.onerror = r; });
      await v.play().catch(() => {});
    }
    const t0 = performance.now();
    for (;;) {
      const t = (performance.now() - t0) / 1000;
      if (t >= x.dur || cancelled || (v && v.ended)) break;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      if (v && v.videoWidth) ctx.drawImage(v, ...fit(v.videoWidth, v.videoHeight));
      else if (imgs[x.img]) { const im = imgs[x.img]; ctx.drawImage(im, ...fit(im.naturalWidth, im.naturalHeight, 1 + 0.08 * t / x.dur)); }
      else if (!v) {
        ctx.fillStyle = '#120f10'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#a8999a'; ctx.font = '600 40px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(`Кадр ${x.s.id}`, W / 2, H / 2 - 20);
        ctx.font = '24px system-ui, sans-serif'; ctx.fillText((x.s.frame || '').slice(0, 90), W / 2, H / 2 + 30, W - 160);
      }
      drawSubs(sub);
      bar.style.width = ((elapsed + t) / total * 100) + '%';
      await frame();
    }
    if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
    elapsed += x.dur;
  }
  rec.stop();
  await done;
  if (cancelled) { overlay.remove(); return toast('Сборка отменена'); }
  const ext = mime.startsWith('video/mp4') ? '.mp4' : '.webm';
  const blob = new Blob(chunks, { type: mime.split(';')[0] });
  info.textContent = `Сохраняю (${(blob.size / 1e6).toFixed(1)} МБ)…`;
  const r = await fetch(`/api/montage/save?ep=${encodeURIComponent(S.ep.id)}&ext=${ext}`, { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob }).then((x) => x.json()).catch(() => ({}));
  overlay.remove();
  if (r.file) { toast('Готово: ' + r.file, 8000); POST('/api/open', { path: r.file.replace(/\/[^/]+$/, '') }).catch(() => {}); }
  else { const a = h('a', { href: URL.createObjectURL(blob), download: `${S.ep.id}_монтаж${ext}` }); a.click(); toast('Видео скачано в «Загрузки»', 6000); }
}
