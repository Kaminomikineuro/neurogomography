// Вкладка «Видео»: ролик для Seedance или Kling из кадров сцены.
// Слева параметры (сцена, кадры, модель, секунды, пожелания), справа — готовый пакет:
// референсы по порядку (@Image / Elements), промпт по таймкодам, по-кадровые описания, negative.
const VS = { scene: null, shots: [], opts: { model: 'seedance', dur: 0, lips: true, lastFrame: false, wishes: '' }, clipId: '', plan: null, timer: null };
const VDURS = [0, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30];
const MODEL_HELP = {
  seedance: ['Открой Pixverse → модель Seedance 2.0 → режим со всеми референсами (Reference / Omni).', 'Загрузи картинки строго по порядку — их номера в промпте (@Image1, @Image2…) должны совпасть.', 'Вставь промпт целиком, поставь длительность, звук выключи.'],
  'seedance-ff': ['Открой Pixverse → модель Seedance 2.0 → режим «первый и последний кадр» (First/Last frame).', 'Image1 — первый кадр, Image2 — последний.', 'Вставь промпт, поставь длительность, звук выключи.'],
  kling4: ['Открой Kling 4.0 → Video Generation → режим Omni Reference (не Keyframes).', 'Загрузи картинки по порядку (@Image1 — стартовый кадр), листы героев — как Elements (@Element1, @Element2…), превиз — как видео (@Video1), если он есть.', 'Вставь промпт целиком в одно поле, поставь длительность. Native audio выключи — голоса потом.', 'Сначала пробуй в 720p: дешевле. 1080p — когда понравится.'],
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
  VS.opts = { model: info.clip.tool === 'Kling' ? 'kling' : 'seedance', dur: info.clip.genDur || 0, lips: true, lastFrame: false, wishes: '', ...(info.clip.opts || {}) };
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
      ...Object.entries({ seedance: 'Seedance 2.0 — все референсы (лучше всего для сцен с героями)', 'seedance-ff': 'Seedance 2.0 — первый и последний кадр (один плавный переход)', kling: 'Kling 3.0 — multi-shot + Elements (до 6 кадров)', kling4: 'Kling 4.0 — Omni Reference (до 30 с, одно поле, превиз как видео)' }).map(([k, t]) =>
        h('label', { class: 'radio' + (VS.opts.model === k ? ' on' : '') }, h('input', { type: 'radio', name: 'vmodel', checked: VS.opts.model === k, onchange: () => { set({ model: k }); renderVideo(); } }), h('span', {}, t)))),
    h('div', { class: 'field' }, h('label', {}, 'Длительность ролика'),
      h('select', { onchange: (e) => set({ dur: +e.target.value }) }, ...VDURS.map((d) => h('option', { value: d, selected: (VS.opts.dur || 0) === d }, d ? d + ' с' : `авто (под кадры: ${total} с)`)))),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: VS.opts.lips !== false, onchange: (e) => set({ lips: e.target.checked }) }), ' реплики для губ (видео без звука, голос потом)'),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!VS.opts.lastFrame, onchange: (e) => set({ lastFrame: e.target.checked }) }), ' закончить ровно на картинке последнего кадра'),
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
    p.model === 'kling4' ? null : h('div', { class: 'field' }, h('label', {}, p.model === 'kling' ? 'Multi-shot — по кадру в поле' : 'По кадрам (если удобнее частями)'),
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
  const model = { seedance: 'Seedance 2.0 (все референсы)', 'seedance-ff': 'Seedance 2.0 (первый и последний кадр)', kling: 'Kling 3.0 multi-shot', kling4: 'Kling 4.0 Omni Reference' }[VS.opts.model];
  chatSend(`Подстрой ролик для ${model}: серия ${S.ep.id}, сцена ${VS.scene}, кадры ${VS.shots.join(', ')}${VS.opts.dur ? `, ${VS.opts.dur} с` : ''}${VS.opts.wishes ? `, пожелания: «${VS.opts.wishes}»` : ''}. Проверь порядок и состав кадров, допиши VID и continuity кадров так, чтобы действие шло непрерывно и было понятно модели, по studio/canon/howto/video.md. Если стоит убрать или добавить кадр — скажи.`, { title: 'Видео: сцена ' + VS.scene });
}
