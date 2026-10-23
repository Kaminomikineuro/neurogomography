// «Claude в студии»: чат внутри интерфейса. Студия запускает Claude Code (или Кодекс, если Claude не установлен)
// прямо в папке репозитория. Он видит CLAUDE.md, книгу, раскадровки и данные студии — и правит их сам,
// как в обычном чате с Claude. Разговор хранится в studio/data/chat.json.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const quoteWin = (a) => (/^[\w./:=@\\-]+$/.test(a) ? a : '"' + String(a).replace(/"/g, '\\"') + '"');
function spawnCmd(cmd, args, opts) {
  return process.platform === 'win32'
    ? spawn([cmd, ...args].map(quoteWin).join(' '), { ...opts, shell: true, windowsHide: true })
    : spawn(cmd, args, opts);
}

// Правила для Claude, когда его зовут из студии (добавляются к CLAUDE.md)
const RULES = `Тебя вызвали из интерфейса студии «Белая кровь» (чат «Claude в студии»). Автор пишет по-русски и не программист.
- Отвечай по-русски, коротко и по делу: что сделал, что проверить автору. Без кода и путей, если они не нужны автору.
- Работай как шоураннер и хранитель канона по CLAUDE.md. Подробные порядки работы лежат в studio/canon/howto/ — перед задачей открой нужный файл (new-episode.md, comic.md, studio-chat.md).
- Правь данные студии напрямую (studio/data/*.json, раскадровки .md, studio/canon/**). Студия сама перечитает их, когда ты закончишь.
- Не делай git commit / push / pull и не трогай .git — это делает автор в GitHub Desktop.
- Код студии (studio/server.mjs, studio/public/*) меняй, только если автор прямо об этом просит; после правки проверь: node --check.
- Если задача большая (целая серия) — сделай её целиком, не останавливайся на плане.`;

export function createAgent({ ROOT, STUDIO, DATA, config, logInbox = () => {} }) {
  const CHAT = path.join(DATA, 'chat.json');
  const read = () => { try { return JSON.parse(fs.readFileSync(CHAT, 'utf8')); } catch { return { current: null, threads: [] }; } };
  const write = (c) => { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(CHAT, JSON.stringify(c, null, 1)); };
  let run = null; // { thread, child, live: [], startedAt }

  function engines() {
    const cfg = config().agent || {};
    const has = (cmd) => {
      try {
        const r = process.platform === 'win32' ? spawnSync(cmd + ' --version', { shell: true, encoding: 'utf8', timeout: 20000, windowsHide: true }) : spawnSync(cmd, ['--version'], { encoding: 'utf8', timeout: 20000 });
        return r.status === 0 ? (r.stdout || '').trim() : null;
      } catch { return null; }
    };
    const claude = has(cfg.claude || 'claude');
    const codex = has(config().codex?.command || 'codex');
    const pick = cfg.engine && cfg.engine !== 'auto' ? cfg.engine : claude ? 'claude' : codex ? 'codex' : null;
    return { claude, codex, engine: pick };
  }
  let cachedEngines = null;
  const getEngines = (fresh) => (cachedEngines && !fresh ? cachedEngines : (cachedEngines = engines()));

  function thread(c, id) {
    let t = c.threads.find((x) => x.id === (id || c.current));
    if (!t) {
      t = { id: Date.now().toString(36), title: 'Разговор ' + now().slice(0, 16), createdAt: now(), messages: [] };
      c.threads.unshift(t);
      c.current = t.id;
    }
    return t;
  }

  function contextText(ctx = {}) {
    const out = [];
    if (ctx.view) out.push(`Автор сейчас во вкладке «${ctx.view}».`);
    if (ctx.ep) out.push(`Открыта серия ${ctx.ep}.`);
    if (ctx.sel) out.push(`Выбрано: ${ctx.sel}.`);
    if (ctx.extra) out.push(ctx.extra);
    return out.join(' ');
  }

  function start({ text, ctx, threadId, title }) {
    if (run) throw new Error('Claude уже работает над прошлой просьбой — подожди или нажми «Стоп».');
    const eng = getEngines();
    if (!eng.engine) throw new Error('Не нашла ни Claude Code, ни Кодекс. Запусти «Установить Claude.bat» (или Кодекс) и перезапусти студию.');
    const c = read();
    const t = thread(c, threadId);
    if (title && !t.messages.length) t.title = title;
    t.messages.push({ role: 'user', text, at: now(), ctx: contextText(ctx) || undefined });
    const msg = { role: 'claude', text: '', at: now(), tools: [], engine: eng.engine, status: 'running' };
    t.messages.push(msg);
    write(c);
    logInbox(`Claude в студии — просьба: «${text.slice(0, 200)}»`);

    const ctxLine = contextText(ctx);
    let cmd, args, input;
    const cfg = config().agent || {};
    if (eng.engine === 'claude') {
      cmd = cfg.claude || 'claude';
      args = ['-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'acceptEdits',
        '--allowedTools', 'Read,Edit,Write,Glob,Grep,TodoWrite,Bash(python:*),Bash(python3:*),Bash(py:*),Bash(node --check:*),Bash(ls:*)'];
      if (cfg.model) args.push('--model', cfg.model);
      if (t.sessionId) args.push('--resume', t.sessionId);
      // правила идут в тексте просьбы: многострочный аргумент командная строка Windows не пропускает
      input = `<правила_студии>\n${RULES}\n</правила_студии>\n\n` + (ctxLine ? `[${ctxLine}]\n\n` : '') + text;
    } else {
      cmd = config().codex?.command || 'codex';
      const last = path.join(os.tmpdir(), `studio-agent-${Date.now()}.txt`);
      msg.lastFile = last;
      args = ['exec', '-s', 'workspace-write', '--skip-git-repo-check', '-C', ROOT, '-o', last, '-'];
      const hist = t.messages.slice(-10, -2).map((m) => `${m.role === 'user' ? 'Автор' : 'Ты'}: ${m.text}`).join('\n\n');
      input = `${RULES}\n\nПрочитай CLAUDE.md и AGENTS.md — там правила проекта.\n\n${hist ? 'Начало разговора:\n' + hist + '\n\n' : ''}${ctxLine ? '[' + ctxLine + ']\n\n' : ''}Автор: ${text}`;
    }
    const child = spawnCmd(cmd, args, { cwd: ROOT, env: { ...process.env, CLAUDE_CODE_ENTRYPOINT: 'studio' } });
    run = { thread: t.id, child, live: [], startedAt: Date.now(), msg };
    const save = () => {
      const c2 = read();
      const t2 = c2.threads.find((x) => x.id === run?.thread || x.id === t.id);
      if (!t2) return;
      t2.messages[t2.messages.length - 1] = msg;
      if (msg.sessionId) t2.sessionId = msg.sessionId;
      write(c2);
    };
    let buf = '';
    const onLine = (line) => {
      if (!line.trim()) return;
      if (eng.engine !== 'claude') { run.live.push(line.slice(0, 300)); if (run.live.length > 60) run.live.shift(); return; }
      let ev;
      try { ev = JSON.parse(line); } catch { run.live.push(line.slice(0, 300)); return; }
      if (ev.session_id) msg.sessionId = ev.session_id;
      if (ev.type === 'assistant') {
        for (const b of ev.message?.content || []) {
          if (b.type === 'text' && b.text.trim()) msg.text += (msg.text ? '\n\n' : '') + b.text.trim();
          if (b.type === 'tool_use') msg.tools.push(toolLabel(b.name, b.input || {}));
        }
        save();
      } else if (ev.type === 'result') {
        if (ev.result && !msg.text.includes(ev.result.trim())) msg.text = ev.result.trim();
        if (ev.is_error) msg.error = true;
      }
    };
    child.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { onLine(buf.slice(0, i)); buf = buf.slice(i + 1); } });
    let err = '';
    child.stderr.on('data', (d) => { err += d; run && run.live.push(String(d).slice(0, 300)); });
    child.stdin.end(input);
    child.on('error', (e) => { err += e.message; });
    child.on('close', (code) => {
      onLine(buf);
      if (eng.engine === 'codex' && msg.lastFile) {
        try { msg.text = fs.readFileSync(msg.lastFile, 'utf8').trim() || msg.text; fs.rmSync(msg.lastFile, { force: true }); } catch {}
        delete msg.lastFile;
      }
      if (code !== 0 && !msg.text) { msg.text = 'Не получилось: ' + (err.trim().slice(-1500) || 'код ' + code); msg.error = true; }
      if (msg.stopped) msg.text = (msg.text ? msg.text + '\n\n' : '') + '(остановлено)';
      msg.status = msg.error ? 'failed' : 'done';
      msg.doneAt = now();
      save();
      logInbox(`Claude в студии — ответ: «${(msg.text || '').replace(/\s+/g, ' ').slice(0, 300)}»`);
      run = null;
    });
    return { thread: t.id };
  }

  function toolLabel(name, inp) {
    const f = inp.file_path || inp.path || inp.pattern || '';
    const short = String(f).replace(ROOT, '').replace(/^[\\/]/, '');
    if (name === 'Edit' || name === 'MultiEdit') return '✎ правит ' + short;
    if (name === 'Write') return '＋ пишет ' + short;
    if (name === 'Read') return '👁 читает ' + short;
    if (name === 'Bash') return '▶ ' + String(inp.command || '').slice(0, 120);
    if (name === 'Grep' || name === 'Glob') return '🔎 ищет ' + short;
    if (name === 'TodoWrite') return '☑ план работы';
    return name;
  }

  return {
    engines: getEngines,
    status() {
      const c = read();
      const t = c.threads.find((x) => x.id === c.current) || null;
      return {
        engine: getEngines(),
        running: run ? { thread: run.thread, secs: Math.round((Date.now() - run.startedAt) / 1000), live: run.live.slice(-8), text: run.msg.text, tools: run.msg.tools.slice(-12) } : null,
        current: t, threads: c.threads.map(({ id, title, createdAt, messages }) => ({ id, title, createdAt, n: messages.length })),
      };
    },
    send: start,
    stop() { if (run) { run.msg.stopped = true; run.child.kill(); if (process.platform === 'win32') spawn('taskkill', ['/pid', String(run.child.pid), '/T', '/F'], { windowsHide: true }); } return { ok: true }; },
    newThread() { const c = read(); c.current = null; thread(c); write(c); return { ok: true }; },
    switchThread(id) { const c = read(); if (c.threads.some((x) => x.id === id)) c.current = id; write(c); return { ok: true }; },
    busy: () => !!run,
  };
}
