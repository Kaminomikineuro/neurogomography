// Общие элементы интерфейса: нижние листы, всплывашки, подтверждения, формы.
import { h, $ } from './util.js';

const stack = [];

/** Нижний лист. content — Node или функция (close) => Node. Возвращает close(). */
export function sheet(content, { full = false, onClose, cls = '' } = {}) {
  const backdrop = h('div.sheet-backdrop');
  const body = h('div.sheet-body');
  const panel = h('div.sheet' + (full ? '.sheet-full' : '') + (cls ? '.' + cls : ''), { role: 'dialog', 'aria-modal': 'true' },
    h('div.sheet-grip', { onclick: () => close() }), body);
  const wrap = h('div.sheet-wrap', backdrop, panel);
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    wrap.classList.remove('open');
    const i = stack.indexOf(close);
    if (i >= 0) stack.splice(i, 1);
    setTimeout(() => wrap.remove(), 260);
    onClose && onClose();
  }
  backdrop.addEventListener('click', close);
  // свайп вниз по «ручке» и заголовку
  let y0 = null;
  panel.addEventListener('touchstart', (e) => {
    if (body.scrollTop > 0 || e.touches.length > 1) return (y0 = null);
    y0 = e.touches[0].clientY;
  }, { passive: true });
  panel.addEventListener('touchmove', (e) => {
    if (y0 == null) return;
    const dy = e.touches[0].clientY - y0;
    if (dy > 0) panel.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  panel.addEventListener('touchend', (e) => {
    if (y0 == null) return;
    const dy = e.changedTouches[0].clientY - y0;
    panel.style.transform = '';
    y0 = null;
    if (dy > 110) close();
  });
  body.append(typeof content === 'function' ? content(close) : content);
  document.body.append(wrap);
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
  stack.push(close);
  close.body = body;
  close.replace = (node) => {
    body.replaceChildren(typeof node === 'function' ? node(close) : node);
  };
  return close;
}
export const closeTopSheet = () => {
  const c = stack[stack.length - 1];
  if (c) {
    c();
    return true;
  }
  return false;
};
export const closeAllSheets = () => [...stack].reverse().forEach((c) => c());

let toastTimer;
export function toast(text, ms = 2600) {
  let t = $('#toast');
  if (!t) document.body.append((t = h('div.toast', { id: 'toast', role: 'status' })));
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

export function confirmBox(title, text, { ok = 'Да', cancel = 'Отмена', danger = false } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    const close = sheet((close) =>
      h('div.dialog',
        h('h2', title),
        text && h('p.muted', text),
        h('div.row-buttons',
          h('button.btn.ghost', { onclick: () => { answered = true; resolve(false); close(); } }, cancel),
          h('button.btn' + (danger ? '.danger' : '.primary'), { onclick: () => { answered = true; resolve(true); close(); } }, ok))),
    { onClose: () => !answered && resolve(false) });
    return close;
  });
}

/**
 * Простая форма. fields: [{name,label,type:'text'|'time'|'date'|'datetime-local'|'textarea'|'select'|'checkbox'|'number'|'password', value, options:[[v,l]], hint}]
 * Возвращает объект значений или null.
 */
export function form(title, fields, { ok = 'Сохранить', extra } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const inputs = {};
    const el = h('form.dialog.form', {
      onsubmit: (e) => {
        e.preventDefault();
        const out = {};
        for (const f of fields) {
          const i = inputs[f.name];
          out[f.name] = f.type === 'checkbox' ? i.checked : f.type === 'number' ? (i.value === '' ? null : +i.value) : i.value.trim();
        }
        done = true;
        resolve(out);
        close();
      },
    },
    h('h2', title),
    fields.map((f) => {
      let input;
      if (f.type === 'textarea') input = h('textarea', { name: f.name, rows: f.rows || 3, placeholder: f.placeholder || '' }, f.value || '');
      else if (f.type === 'select')
        input = h('select', { name: f.name }, f.options.map(([v, l]) => h('option', { value: v, selected: String(v) === String(f.value ?? '') }, l)));
      else if (f.type === 'checkbox') input = h('input', { type: 'checkbox', name: f.name, checked: !!f.value });
      else input = h('input', { type: f.type || 'text', name: f.name, value: f.value ?? '', placeholder: f.placeholder || '', inputmode: f.inputmode, autocomplete: 'off' });
      inputs[f.name] = input;
      if (f.type === 'checkbox') return h('label.check-row', input, h('span', f.label), f.hint && h('small.muted', f.hint));
      return h('label.field', h('span.field-label', f.label), input, f.hint && h('small.muted', f.hint));
    }),
    typeof extra === 'function' ? extra(() => close()) : extra,
    h('div.row-buttons',
      h('button.btn.ghost', { type: 'button', onclick: () => close() }, 'Отмена'),
      h('button.btn.primary', { type: 'submit' }, ok)));
    const close = sheet(el, { onClose: () => !done && resolve(null) });
    setTimeout(() => {
      const first = el.querySelector('input:not([type=checkbox]),textarea');
      if (first && fields[0] && fields[0].autofocus) first.focus();
    }, 300);
  });
}

/** Выбор из списка. items: [{value,label,sub,icon}] */
export function pick(title, items) {
  return new Promise((resolve) => {
    let done = false;
    const close = sheet(
      h('div.dialog',
        h('h2', title),
        h('div.pick-list',
          items.map((it) =>
            it.header
              ? h('div.pick-header', it.header)
              : h('button.pick-item', { onclick: () => { done = true; resolve(it.value); close(); } },
                  it.icon && h('span.pick-icon', it.icon),
                  h('span.pick-text', h('span', it.label), it.sub && h('small.muted', it.sub)))))),
      { onClose: () => !done && resolve(null) }
    );
  });
}

/** Полноэкранный слой (просмотр документа, «показать таксисту», QR). */
export function fullscreen(content, { cls = '', onClose } = {}) {
  const layer = h('div.fullscreen' + (cls ? '.' + cls : ''));
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    layer.classList.remove('open');
    const i = stack.indexOf(close);
    if (i >= 0) stack.splice(i, 1);
    setTimeout(() => layer.remove(), 200);
    onClose && onClose();
  };
  layer.append(typeof content === 'function' ? content(close) : content);
  document.body.append(layer);
  requestAnimationFrame(() => layer.classList.add('open'));
  stack.push(close);
  return close;
}

// Системная «назад» на Android закрывает верхний слой, а не приложение.
export function installBackHandler() {
  history.replaceState({ root: true }, '');
  history.pushState({ guard: true }, '');
  addEventListener('popstate', () => {
    if (closeTopSheet()) history.pushState({ guard: true }, '');
    else history.back();
  });
}
