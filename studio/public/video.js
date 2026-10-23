// Вкладка «Видео»: ролик для Seedance или Kling из кадров сцены.
// Слева параметры (сцена, кадры, модель, секунды, пожелания), справа — готовый пакет:
// референсы по порядку (@Image / Elements), промпт по таймкодам, по-кадровые описания, negative.
const VS = { scene: null, shots: [], opts: { model: 'seedance', dur: 0, lips: true, lastFrame: false, wishes: '' }, clipId: '', plan: null, timer: null };
const VDURS = [0, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30];
const vMax = (o) => (o.model === 'kling4' ? (o.flash ? 20 : 30) : 15); // Seedance 2.0 и Kling 3.0 — 15 с, Kling 4.0 — 30 с (Flash — 20)
const MODEL_HELP = {
  seedance: ['Открой Pixverse → модель Seedance 2.0 → режим со всеми референсами (Reference / Omni).', 'Загрузи картинки строго по порядку — их номера в промпте (@Image1, @Image2…) должны совпасть.', 'Вставь промпт целиком, поставь длительность, звук выключи.'],
  'seedance-ff': ['Открой Pixverse → модель Seedance 2.0 → режим «первый и последний кадр» (First/Last frame).', 'Image1 — первый кадр, Image2 — последний.', 'Вставь промпт, поставь длительность, звук выключи.'],
  kling4: ['Kling 4.0 → Video Generation → режим Omni Reference.', 'Загрузи строго по порядку: картинки (@Image1…), листы героев как Elements (@Element1…), превиз как видео (@Video1). Порядок держи одинаковым во всех генерациях сцены.', 'Вставь промпт целиком, поставь длительность и 16:9. Звук оставь включённым: промпт просит только атмосферу, без голосов и музыки.', 'Черновик — на Flash в 720p. Хороший дубль с одной ошибкой — не перегенерировать, а «Edit @Video1 … Keep everything else unchanged».'],
  'kling4-kf': ['Kling 4.0 → Video Generation → режим Keyframes. Референсы и Elements тут нельзя — только картинки.', 'Каждая карточка ниже — отдельная генерация: первый кадр в First frame, у перехода — ещё последний в Last frame.', 'Вставь промпт карточки, поставь её длительность. Готовые клипы склеишь в монтаже.', 'Черновик — на Flash в 720p (проверь, что Flash берёт и последний кадр).'],
  kling: ['Открой Kling 3.0 → Image to Video. Стартовый кадр — в поле Start Frame.', 'Листы героев загрузи в Elements по порядку — в промпте они @Element1, @Element2…', 'Включи Multi-shot: общий промпт — в основное поле, каждый кадр — в своё поле со своей длительностью (до 6 кадров).', 'Native audio выключи.'],
};

function videoInit() {
  if (VS.ep !== S.ep.id) { VS.ep = S.ep.id; VS.scene = null; VS.shots = []; VS.clipId = ''; VS.plan = null; }
  if (VS.scene == null) {
    const sc = S.ep.scenes.find((x) => x.clips?.length) || S.ep.scenes.find((x) => x.shots.some((s) => !s.cut));
    VS.scene = sc?.n ?? null;
  }
}
const vScene = () => S.ep.scenes.find((x) => x.n === VS.scene);
function loadClipToVideo(id) {
  const info = clipOf(id);
  if (!info) return;
  VS.clipId = id;
  VS.scene = info.scene.n;
  VS.shots = [...info.clip.shots];
  VS.opts = { model: info.clip.tool === 'Kling' ? 'kling' : 'seedance', dur: info.clip.genDur || 0, lips: true, lastFrame: false, wishes: '', mode: 'omni', links: [], ...(info.clip.opts || {}) };
}
function videoPlan() {
  clearTimeout(VS.timer);
  VS.timer = setTimeout(async () => {
    if (!VS.shots.length) { VS.plan = null; return renderVideoResult(); }
    try { VS.plan = await POST('/api/video/plan', { ep: S.ep.id, scene: VS.scene, shots: VS.shots, opts: VS.opts }); }
    catch (e) { VS.plan = { error: e.message }; }
    renderVideoResult();
  }, 250);
}
function renderVideo() {
  videoInit();
  const sc = vScene();
  const allClips = S.ep.scenes.flatMap((x) => (x.clips || []).map((c) => ({ c, sc: x })));
  const order = sc ? sc.shots.filter((s) => !s.cut).map((s) => s.id) : [];
  VS.shots = order.filter((id) => VS.shots.includes(id)); // порядок как в раскадровке
  const total = VS.shots.reduce((a, id) => a + (sc?.shots.find((x) => x.id === id)?.dur || 3), 0);
  const inOther = (id) => (sc?.clips || []).find((c) => c.id !== VS.clipId && c.shots.includes(id));
  const set = (patch) => { Object.assign(VS.opts, patch); videoPlan(); };
  const params = h('div', { class: 'vparams' },
    h('div', { class: 'field' }, h('label', {}, 'Связка'),
      h('select', { onchange: (e) => { if (e.target.value) loadClipToVideo(e.target.value); else { VS.clipId = ''; VS.shots = []; } renderVideo(); } },
        h('option', { value: '' }, '— новая (выбери кадры ниже) —'),
        ...allClips.map(({ c, sc: s }) => h('option', { value: c.id, selected: c.id === VS.clipId }, `${c.id} · сцена ${s.n} · ${c.shots[0]}–${c.shots.at(-1)} · ${c.tool || 'Seedance'}${selVideo(c) ? ' · ▶' : ''}`)))),
    h('div', { class: 'field' }, h('label', {}, 'Сцена'),
      h('select', { onchange: (e) => { VS.scene = +e.target.value; VS.shots = []; VS.clipId = ''; renderVideo(); } },
        ...S.ep.scenes.map((x) => h('option', { value: x.n, selected: x.n === VS.scene }, `${x.n}. ${x.title}`)))),
    h('div', { class: 'field' }, h('label', {}, `Кадры — выбрано ${VS.shots.length}, ${total} с`),
      h('div', { class: 'vshots' }, ...(sc ? sc.shots.filter((s) => !s.cut).map((s) => {
        const f = keyframeOf(s, sc);
        const on = VS.shots.includes(s.id);
        const other = inOther(s.id);
        return h('div', { class: 'vs' + (on ? ' on' : '') + (other ? ' busy' : ''), title: (s.frame || '') + (other ? `\nУже в связке ${other.id}` : ''),
          onclick: () => { VS.shots = on ? VS.shots.filter((x) => x !== s.id) : [...VS.shots, s.id]; renderVideo(); } },
          h('div', { class: 'thumb', style: f ? { backgroundImage: `url("${fileUrl(f)}")` } : null }, f ? '' : 'нет'),
          h('div', {}, h('b', {}, s.id), ` ${s.dur || '?'} с`, peopleOfShot(s).length ? '' : h('span', { class: 'muted' }, ' · вставка')));
      }) : [])),
      h('div', { class: 'actions' },
        h('button', { class: 'ghost', onclick: () => { VS.shots = sc.shots.filter((s) => !s.cut && peopleOfShot(s).length && !inOther(s.id)).map((s) => s.id); renderVideo(); } }, 'все с героями'),
        h('button', { class: 'ghost', onclick: () => { VS.shots = []; renderVideo(); } }, 'снять'))),
    h('div', { class: 'field' }, h('label', {}, 'Модель'),
      ...Object.entries({ seedance: 'Seedance 2.0 — все референсы (до 15 с)', 'seedance-ff': 'Seedance 2.0 — первый и последний кадр (до 15 с)', kling: 'Kling 3.0 — multi-shot + Elements (до 6 кадров, 15 с)', kling4: 'Kling 4.0 (до 30 с, Flash — до 20 с)' }).map(([k, t]) =>
        h('label', { class: 'radio' + (VS.opts.model === k ? ' on' : '') }, h('input', { type: 'radio', name: 'vmodel', checked: VS.opts.model === k, onchange: () => { set({ model: k, dur: Math.min(VS.opts.dur || 0, vMax({ ...VS.opts, model: k })) }); renderVideo(); } }), h('span', {}, t)))),
    VS.opts.model === 'kling4' ? h('div', { class: 'field' }, h('label', {}, 'Режим Kling 4.0 (вместе нельзя)'),
      h('div', { class: 'vseg' }, ...[['omni', 'Omni Reference'], ['keyframes', 'Keyframes']].map(([k, t]) =>
        h('button', { class: (VS.opts.mode || 'omni') === k ? 'on' : '', onclick: () => { set({ mode: k }); renderVideo(); } }, t))),
      h('div', { class: 'muted small' }, (VS.opts.mode || 'omni') === 'omni'
        ? 'Omni — когда важно движение между склейками и лица по референсам: дуэль, бой, мертвецы, шоты без ключевого кадра. Превиз идёт как @Video1.'
        : 'Keyframes — статичные сцены и диалоги, где ключевые кадры уже нарисованы: каждый шот отдельно с первым кадром, переходы — первый + последний кадр. Склейка — в монтаже.'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!VS.opts.flash, onchange: (e) => { set({ flash: e.target.checked, dur: Math.min(VS.opts.dur || 0, e.target.checked ? 20 : 30) }); renderVideo(); } }), ' Flash — быстрый черновик (720p, до 20 с)')) : null,
    VS.opts.model === 'kling4' && VS.opts.mode === 'keyframes' ? null : h('div', { class: 'field' }, h('label', {}, `Длительность ролика (максимум ${vMax(VS.opts)} с)`),
      h('select', { onchange: (e) => set({ dur: +e.target.value }) }, ...VDURS.filter((d) => d <= vMax(VS.opts)).map((d) => h('option', { value: d, selected: (VS.opts.dur || 0) === d }, d ? d + ' с' : `авто (под кадры: ${Math.min(total, vMax(VS.opts))} с)`))),
      total > vMax(VS.opts) ? h('div', { class: 'warn' }, `⚠ Кадры занимают ${total} с — больше, чем модель делает за раз. Разрежь связку: справа подскажу где.`) : null),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: VS.opts.lips !== false, onchange: (e) => set({ lips: e.target.checked }) }), ' говорящие двигают губами (голоса — в монтаже)'),
    VS.opts.lips !== false ? h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!VS.opts.lineText, onchange: (e) => set({ lineText: e.target.checked }) }), ' тест: вписать текст реплик по-русски (липсинк на русском не обещан, модель может написать текст в кадре)') : null,
    ['seedance', 'kling'].includes(VS.opts.model) ? h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!VS.opts.lastFrame, onchange: (e) => set({ lastFrame: e.target.checked }) }), ' закончить ровно на картинке последнего кадра') : null,
    h('div', { class: 'field' }, h('label', {}, 'Пожелания (можно по-русски)'),
      h('textarea', { rows: 3, placeholder: 'Например: «камера медленно облетает их по кругу», «ветер сильнее», «в конце пауза на взгляде»', oninput: (e) => set({ wishes: e.target.value }) }, VS.opts.wishes || '')),
    h('div', { class: 'actions' },
      h('button', { class: 'primary', disabled: !VS.shots.length, onclick: saveVideoClip }, VS.clipId ? 'Сохранить связку' : 'Сохранить как связку'),
      VS.clipId ? h('button', { onclick: () => select({ kind: 'clip', ep: S.ep.id, id: VS.clipId }) }, 'Видео связки') : null,
      h('button', { disabled: !VS.shots.length, title: 'Claude подстроит кадры, порядок и описания под выбранную модель', onclick: askClaudeVideo }, '✍ Claude: подстроить')));
  $('#main').replaceChildren(h('div', { class: 'video' },
    h('div', { class: 'bar' }, h('b', {}, 'Видео: Seedance / Kling'), h('span', { class: 'muted' }, ' — выбери кадры сцены и параметры, справа появится готовый пакет'), h('span', { class: 'grow' }),
      h('button', { onclick: makeClips, title: 'Нарезать все сцены на связки автоматически' }, '🎬 Нарезать все сцены')),
    h('div', { class: 'vbody' }, params, h('div', { class: 'vresult', id: 'vresult' }))));
  renderVideoResult();
  videoPlan();
}
const peopleOfShot = (s) => (s.characters || []).filter((id) => { const c = S.state.project.characters.find((x) => x.id === id); return c && c.group !== 'Предметы'; });

function renderVideoResult() {
  const box = $('#vresult');
  if (!box) return;
  const p = VS.plan;
  if (!VS.shots.length) return box.replaceChildren(h('div', { class: 'muted' }, 'Выбери кадры слева — или существующую связку.'));
  if (!p) return box.replaceChildren(h('div', { class: 'muted' }, 'Собираю…'));
  if (p.error) return box.replaceChildren(h('div', { class: 'warn' }, 'Ошибка: ' + p.error));
  const dl = (file, name) => h('a', { href: fileUrl(file), download: name + (file.match(/\.\w+$/)?.[0] || '.png') }, 'скачать');
  const refRow = (r, tag, name) => h('div', { class: 'copyrow' }, h('img', { class: 'refmini', src: fileUrl(r.file), onclick: () => zoom(r.file) }), h('code', {}, `${tag} — ${r.label}`), dl(r.file, name));
  if (p.gens) return box.replaceChildren(...[
    h('h3', {}, `${p.modelName} · ${p.gens.length} генераций · ${p.total} с`),
    h('ol', { class: 'steps' }, ...(MODEL_HELP[p.model] || []).map((t) => h('li', {}, t))),
    p.warnings.length ? h('div', { class: 'warns' }, ...p.warnings.map((w) => h('div', { class: 'warn' }, '⚠ ' + w))) : null,
    ...p.gens.map((g, n) => {
      const firstId = g.shots[0];
      const linked = (VS.opts.links || []).includes(firstId);
      const nextShot = VS.shots[VS.shots.indexOf(g.shots.at(-1)) + 1];
      const toggle = (on) => { const L = new Set(VS.opts.links || []); on ? L.add(firstId) : L.delete(firstId); VS.opts.links = [...L]; videoPlan(); };
      return h('div', { class: 'vgen' },
        h('div', { class: 'vgen-head' }, h('b', {}, `Генерация ${n + 1} · ${g.id} · ${g.dur} с`), h('span', { class: 'grow' }),
          linked ? h('button', { class: 'ghost', onclick: () => toggle(false) }, 'разъединить переход')
            : nextShot && g.shots.length === 1 ? h('button', { class: 'ghost', title: 'Одна генерация: первый кадр этого шота, последний — следующего. Камера сама «доедет».', onclick: () => toggle(true) }, `↪ переход в ${nextShot}`) : null),
        ...g.refs.map((r) => refRow(r, r.tag, `Gen${n + 1}_${r.tag === 'Last frame' ? 'last' : 'first'}_${g.shots.join('-')}`)),
        h('div', { class: 'field' }, h('label', {}, 'Промпт', h('button', { class: 'ghost', onclick: () => copy(g.text) }, 'копировать')), h('pre', { class: 'vprompt' }, g.text)));
    }),
  ].filter(Boolean));
  box.replaceChildren(...[
    h('h3', {}, `${p.modelName} · ${p.gen} с`),
    h('ol', { class: 'steps' }, ...(MODEL_HELP[p.model] || []).map((t) => h('li', {}, t))),
    p.warnings.length ? h('div', { class: 'warns' }, ...p.warnings.map((w) => h('div', { class: 'warn' }, '⚠ ' + w))) : null,
    p.refs.length ? h('div', { class: 'field' }, h('label', {}, p.model === 'kling' ? 'Кадры' : 'Картинки — строго по порядку'),
      ...p.refs.map((r, i) => refRow(r, r.tag || `@Image${i + 1}`, `${r.tag ? r.tag.replace(/\s/g, '_') : 'Image' + (i + 1)}_${VS.clipId || VS.shots[0]}`))) : null,
    p.elements?.length ? h('div', { class: 'field' }, h('label', {}, 'Elements — листы героев по порядку'),
      ...p.elements.map((e, i) => refRow(e, `@Element${i + 1}`, `Element${i + 1}_${e.id}`))) : null,
    p.videos?.length ? h('div', { class: 'field' }, h('label', {}, 'Видео — превиз'),
      ...p.videos.map((e, i) => h('div', { class: 'copyrow' }, h('code', {}, `@Video${i + 1} — ${e.label}`), h('a', { href: fileUrl(e.file), download: `Video${i + 1}_previs.mp4` }, 'скачать')))) : null,
    h('div', { class: 'field' }, h('label', {}, p.model === 'kling' ? 'Общий промпт' : 'Промпт целиком', h('button', { class: 'ghost', onclick: () => copy(p.text) }, 'копировать')), h('pre', { class: 'vprompt' }, p.text)),
    p.model === 'kling4' || !p.perShot.length ? null : h('div', { class: 'field' }, h('label', {}, p.model === 'kling' ? 'Multi-shot — по кадру в поле' : 'По кадрам (если удобнее частями)'),
      ...p.perShot.map((t) => h('div', { class: 'copyrow' }, h('code', {}, t), h('button', { class: 'ghost', onclick: () => copy(t) }, 'копировать')))),
    h('div', { class: 'field' }, h('label', {}, 'Negative prompt', h('button', { class: 'ghost', onclick: () => copy(p.negative) }, 'копировать')), h('div', { class: 'muted' }, p.negative)),
  ].filter(Boolean));
}
async function saveVideoClip() {
  try {
    const c = await POST('/api/video/save', { ep: S.ep.id, scene: VS.scene, shots: VS.shots, opts: VS.opts, id: VS.clipId || undefined });
    VS.clipId = c.id;
    await loadEp();
    toast(`Связка ${c.id} сохранена. Готовое видео перетащи в «Видео связки».`, 6000);
    renderVideo();
  } catch (e) { toast(e.message, 8000); }
}
function askClaudeVideo() {
  const model = { seedance: 'Seedance 2.0 (все референсы)', 'seedance-ff': 'Seedance 2.0 (первый и последний кадр)', kling: 'Kling 3.0 multi-shot', kling4: VS.opts.mode === 'keyframes' ? 'Kling 4.0 Keyframes (каждый шот отдельно, переходы — первый + последний кадр)' : 'Kling 4.0 Omni Reference' }[VS.opts.model];
  chatSend(`Подстрой ролик для ${model}: серия ${S.ep.id}, сцена ${VS.scene}, кадры ${VS.shots.join(', ')}${VS.opts.dur ? `, ${VS.opts.dur} с` : ''}${VS.opts.wishes ? `, пожелания: «${VS.opts.wishes}»` : ''}. Проверь порядок и состав кадров, допиши VID и continuity кадров так, чтобы действие шло непрерывно и было понятно модели, по studio/canon/howto/video.md${VS.opts.model === 'kling4' ? ' и studio/canon/howto/kling4.md' : ''}. Если стоит убрать или добавить кадр — скажи.`, { title: 'Видео: сцена ' + VS.scene });
}
