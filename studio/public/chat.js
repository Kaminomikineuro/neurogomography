// «Claude в студии» — чат внутри интерфейса. Просьба уходит Claude Code (или Кодексу), он правит файлы
// студии сам, а интерфейс перечитывает данные, когда он закончит.
const CH = { open: false, st: null, timer: null, wasRunning: false, after: null, withCtx: true };

const mdLite = (t) => {
  const e = String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return e.split(/\n{2,}/).map((p) => {
    if (/^\s*([-*•]|\d+\.)\s/m.test(p)) {
      const items = p.split('\n').filter((l) => l.trim()).map((l) => `<li>${l.replace(/^\s*([-*•]|\d+\.)\s*/, '')}</li>`).join('');
      return /^\s*\d+\./.test(p) ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
    }
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
};

// где сейчас автор — это уходит Claude вместе с просьбой
function chatCtx() {
  const views = { board: 'Раскадровка', chars: 'Персонажи', locs: 'Локации', lib: 'Иллюстрации и GitHub', montage: 'Монтаж', comic: 'Комикс', queue: 'Очередь', canon: 'Канон', git: 'Отправка в GitHub' };
  const ctx = { view: views[S.view] || S.view, ep: S.ep?.id };
  const r = S.sel;
  if (r?.kind === 'shot') ctx.sel = `кадр ${r.id} серии ${r.ep}`;
  else if (r?.kind === 'scene') ctx.sel = `сцена ${r.id} (постановка)`;
  else if (r?.kind === 'character') ctx.sel = `персонаж ${r.id}`;
  else if (r?.kind === 'location') ctx.sel = `локация ${r.id}`;
  if (S.view === 'comic' && CM.data?.pages?.length) {
    const pg = CM.data.pages[CM.page];
    ctx.extra = `Комикс серии ${CM.ep}: формат ${CM.data.format || 'manga'}, открыта страница ${CM.page + 1} из ${CM.data.pages.length} (pages[${CM.page}] в studio/data/comics/${CM.ep}.json), в ней кадры: ${pg.panels.map((p) => p.shot).join(', ')}.`;
    if (CM.sel?.k === 'panel') ctx.extra += ` Выбрана панель с кадром ${pg.panels[CM.sel.id]?.shot}.`;
    if (CM.sel?.k === 'bubble') { const b = pg.bubbles.find((x) => x.id === CM.sel.id); if (b) ctx.extra += ` Выбран пузырь «${b.text}».`; }
  }
  return ctx;
}
function chatPresets() {
  const out = [];
  if (S.view === 'board' || S.view === 'canon') out.push(['🎬 Новая серия из главы…', newEpisodeDialog]);
  if (S.sel?.kind === 'shot') {
    out.push(['Сверь кадр с книгой', () => chatSend(`Сверь кадр ${S.sel.id} с книгой и каноном: реплики, кто в кадре, место, детали. Если что-то не так — поправь и скажи что.`)]);
    out.push(['Улучши промпт кадра', () => chatSend(`Улучши IMG-промпт кадра ${S.sel.id}: точнее поза, ракурс, свет и непрерывность с соседними кадрами. Не меняй смысл.`)]);
  }
  if (S.view === 'comic') {
    out.push(['✍ Подписи и подсказки из книги', comicHintsAsk]);
    if (CM.data?.pages?.length) {
      out.push(['Ч/б + красный для этой страницы', () => chatSend(`Сделай страницу ${CM.page + 1} комикса в стиле «ч/б + красный» (color: "ink-red").`, { reload: 'comic' })]);
      out.push(['Предложи раскладку получше', () => chatSend(`Посмотри страницу ${CM.page + 1} комикса и сделай раскладку выразительнее: размеры панелей, где крупно, где взгляд, где тишина. Поправь страницу сама.`, { reload: 'comic' })]);
    }
  }
  out.push(['Что делать дальше?', () => chatSend('Посмотри журнал студии и состояние серии. Что мне сделать дальше, по шагам?')]);
  return out;
}

function chatToggle(force) {
  CH.open = force ?? !CH.open;
  $('#chat').classList.toggle('hidden', !CH.open);
  if (CH.open) { chatPoll(true); setTimeout(() => $('#chatInput')?.focus(), 50); }
}
async function chatPoll(now) {
  clearTimeout(CH.timer);
  try {
    CH.st = await GET('/api/agent');
  } catch { CH.st = null; }
  const running = !!CH.st?.running;
  if (CH.wasRunning && !running) await chatFinished();
  CH.wasRunning = running;
  $('#chatBtn').classList.toggle('busy', running);
  if (CH.open) chatRender();
  CH.timer = setTimeout(chatPoll, running ? 1500 : CH.open ? 6000 : 15000);
}
async function chatFinished() {
  // Claude закончил — перечитываем всё, что он мог поменять
  await loadState().catch(() => {});
  await loadEp().catch(() => {});
  const after = CH.after; CH.after = null;
  if (S.view === 'comic' || after?.reload === 'comic') {
    CM.data = null;
    if (after?.rebuild && confirm('Claude обновил подсказки комикса. Собрать комикс заново по ним? (Нарисованные фигуры останутся.)')) { await loadComic(); await autoBuild(); }
  }
  if (after?.selectEp && S.state.episodes.some((e) => e.id === after.selectEp)) { $('#epSel').value = after.selectEp; lsSet('ep', after.selectEp); await loadEp(); }
  render(true);
  if (S.sel) renderPanel();
  const last = CH.st?.current?.messages?.at(-1);
  toast(last?.status === 'failed' ? 'Claude: не получилось — смотри чат' : 'Claude закончил — студия обновлена', 6000);
}
function chatRender() {
  const st = CH.st;
  const box = $('#chat');
  // поле ввода строим один раз — чтобы обновления чата не сбивали то, что печатаешь
  if (!box.querySelector('.chat-input')) {
    const input = h('textarea', { id: 'chatInput', rows: 3, placeholder: 'Напиши просьбу… (Ctrl+Enter — отправить)',
      onkeydown: (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); chatSendInput(); } } });
    box.replaceChildren(h('div', { class: 'chat-head' }), h('div', { class: 'chat-warn-slot' }), h('div', { class: 'chat-msgs' }), h('div', { class: 'chat-presets' }),
      h('div', { class: 'chat-input' }, input, h('div', { class: 'chat-row' })));
  }
  const head = box.querySelector('.chat-head');
  if (!st) { head.replaceChildren(h('b', {}, 'Claude в студии'), h('span', { class: 'grow' }), h('button', { class: 'ghost x', onclick: () => chatToggle(false) }, '✕')); return; }
  const eng = st.engine || {};
  const msgs = st.current?.messages || [];
  head.replaceChildren(...[
    h('b', {}, 'Claude в студии'),
    h('span', { class: 'pill ' + (eng.engine ? 'good' : 'bad'), title: eng.engine === 'claude' ? eng.claude : eng.engine === 'codex' ? 'Claude Code не найден — отвечает Кодекс. ' + eng.codex : 'Не найдено' },
      eng.engine === 'claude' ? 'Claude Code' : eng.engine === 'codex' ? 'Кодекс вместо Claude' : 'не установлен'),
    h('span', { class: 'grow' }),
    st.threads.length > 1 ? h('select', { onchange: async (e) => { await POST('/api/agent/thread', { id: e.target.value }); chatPoll(true); } },
      ...st.threads.map((t) => h('option', { value: t.id, selected: t.id === st.current?.id }, `${t.title} (${t.n})`))) : null,
    h('button', { class: 'ghost', title: 'Начать новый разговор (старый сохранится)', onclick: async () => { await POST('/api/agent/new'); chatPoll(true); } }, '＋'),
    h('button', { class: 'ghost x', onclick: () => chatToggle(false) }, '✕')].filter(Boolean));
  box.querySelector('.chat-warn-slot').replaceChildren(!eng.engine ? h('div', { class: 'warn chat-warn' }, 'Claude Code не установлен. Дважды щёлкни «Установить Claude.bat» в папке репозитория (на Mac — команды из README), войди своим аккаунтом Claude и перезапусти студию.') : '');
  const old = box.querySelector('.chat-msgs');
  const atBottom = old.scrollTop + old.clientHeight > old.scrollHeight - 40;
  const sig = JSON.stringify([st.current?.id, msgs.length, st.running?.text, st.running?.tools?.length, st.running?.secs, msgs.at(-1)?.status]);
  if (sig !== CH.sig) {
    CH.sig = sig;
    old.replaceChildren(
      !msgs.length ? h('div', { class: 'chat-hello' },
        h('p', {}, 'Пиши сюда всё, о чём просила бы меня в обычном чате: «сделай серию по главе 2», «перепиши промпт 3.9 — он прыгает ногами вперёд», «подписи для комикса из книги», «на странице 5 убери подпись».'),
        h('p', { class: 'muted' }, 'Я вижу, где ты сейчас в студии (вкладка, кадр, страница), правлю файлы сама, и студия обновится, когда закончу. Картинки потом рисует Кодекс по кнопкам.')) : '',
      ...msgs.map((m, i) => {
        const live = m.status === 'running' && st.running && i === msgs.length - 1;
        const tools = live ? st.running.tools : m.tools || [];
        const text = live ? st.running.text : m.text;
        return h('div', { class: 'cmsg ' + m.role + (m.error ? ' err' : '') },
          m.role === 'user' && m.ctx ? h('div', { class: 'cctx' }, m.ctx) : null,
          text || !live ? h('div', { class: 'ctext', html: mdLite(text || '…') }) : null,
          tools.length ? h('details', { class: 'ctools', open: live }, h('summary', {}, `действия: ${tools.length}`), ...tools.map((t) => h('div', {}, t))) : null,
          live ? h('div', { class: 'clive' }, h('span', { class: 'spin' }, `работаю… ${st.running.secs} с`), st.running.live?.length && !tools.length ? h('div', { class: 'muted' }, st.running.live.at(-1)) : null) : null);
      }));
    if (atBottom) old.scrollTop = old.scrollHeight;
  }
  box.querySelector('.chat-presets').replaceChildren(...chatPresets().map(([t, fn]) => h('button', { class: 'chip', disabled: !!st.running, onclick: fn }, t)));
  const ctx = chatCtx();
  const ctxLine = [ctx.view, ctx.sel, S.view === 'comic' && CM.data?.pages?.length ? `стр. ${CM.page + 1}` : null].filter(Boolean).join(' · ');
  const input = $('#chatInput');
  input.placeholder = st.running ? 'Claude работает… дождись ответа или нажми «Стоп»' : 'Напиши просьбу… (Ctrl+Enter — отправить)';
  box.querySelector('.chat-row').replaceChildren(...[
    h('label', { class: 'muted', title: 'Студия подскажет Claude, где ты сейчас' }, h('input', { type: 'checkbox', checked: CH.withCtx, onchange: (e) => (CH.withCtx = e.target.checked) }), ' контекст: ' + (ctxLine || '—')),
    h('span', { class: 'grow' }),
    st.running ? h('button', { onclick: async () => { await POST('/api/agent/stop'); chatPoll(true); } }, 'Стоп') : null,
    h('button', { class: 'primary', disabled: !!st.running, onclick: chatSendInput }, 'Отправить')].filter(Boolean));
}
function chatSendInput() {
  const input = $('#chatInput');
  const t = input.value.trim();
  if (!t || CH.st?.running) return;
  input.value = '';
  chatSend(t);
}
async function chatSend(text, after = null) {
  await flushDrafts();
  if (S.view === 'comic' && CM.data) await saveComic(true);
  CH.after = after;
  chatToggle(true);
  try {
    await POST('/api/agent/send', { text, ctx: CH.withCtx ? chatCtx() : {}, title: after?.title });
  } catch (e) { toast(e.message, 9000); }
  chatPoll(true);
}
function newEpisodeDialog() {
  const book = (S.state.book || []).filter((b) => /^Т\d/.test(b));
  const used = S.state.episodes.map((e) => e.id);
  let next = 's01e01';
  for (let n = 1; n < 99; n++) { const id = 's01e' + String(n).padStart(2, '0'); if (!used.includes(id)) { next = id; break; } }
  const m = h('div', { class: 'modal', onclick: (e) => e.target === m && m.remove() });
  const sel = h('select', {}, ...book.map((b) => h('option', { value: b }, b.replace(/\.txt$/, ''))));
  const epIn = h('input', { value: next });
  const wish = h('textarea', { rows: 4, placeholder: 'Пожелания (необязательно): «одна серия, не две», «больше крупных планов глаз», «сцену в лесу сократить»…' });
  m.append(h('div', { class: 'modal-box small' },
    h('h3', {}, '🎬 Новая серия из главы'),
    h('p', { class: 'muted' }, 'Claude прочитает главу и сделает всё, как для серии 1: раскадровку с репликами из книги, промпты, хронометраж под губы, постановку сцен, подписи для комикса. Займёт 10–30 минут. Потом нарисуй новых героев и локации, общие планы сцен и кадры.'),
    h('div', { class: 'field' }, h('label', {}, 'Глава'), sel),
    h('div', { class: 'field' }, h('label', {}, 'Номер первой серии'), epIn),
    h('div', { class: 'field' }, h('label', {}, 'Пожелания'), wish),
    h('div', { class: 'actions' },
      h('button', { class: 'primary', onclick: () => {
        m.remove();
        chatSend(`Сделай серии по главе «${sel.value}». Первая серия — ${epIn.value.trim()}, дальше по порядку. Выполни целиком studio/canon/howto/new-episode.md.${wish.value.trim() ? ' Пожелания автора: ' + wish.value.trim() : ''}`,
          { selectEp: epIn.value.trim(), title: 'Серия по главе ' + sel.value.replace(/\.txt$/, '') });
      } }, 'Начать'),
      h('button', { class: 'ghost', onclick: () => m.remove() }, 'Отмена'))));
  document.body.append(m);
}
function comicHintsAsk() {
  const ep = S.ep.id;
  chatSend(`Сделай (или обнови) подсказки комикса для серии ${ep} по studio/canon/howto/comic.md: подписи — короткие цитаты из главы серии, звуки, страницы на весь лист, фигуры героев, взгляды, стороны говорящих.`, { reload: 'comic', rebuild: true, title: 'Подсказки комикса ' + ep });
}
document.addEventListener('DOMContentLoaded', () => {
  document.body.append(h('button', { id: 'chatBtn', onclick: () => chatToggle(), title: 'Claude в студии: попроси сделать серию, поправить кадр, подписи для комикса…' }, '💬 Claude'),
    h('div', { id: 'chat', class: 'hidden' }));
  chatPoll();
});
