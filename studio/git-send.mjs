// Отправка в GitHub порциями.
// Большой Push GitHub обрывает («Remote disconnected»), а файлы больше 100 МБ не принимает совсем.
// Студия сама раскладывает изменения на небольшие коммиты и отправляет их по одному.
// Git берём тот, что внутри GitHub Desktop, — отдельно ставить ничего не нужно.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const MB = 1024 * 1024;
const HUGE = 95 * MB; // GitHub не примет файл больше 100 МБ

export function createGitSender(ROOT, logInbox = () => {}) {
  let bin;
  const env = () => {
    const e = { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_LITERAL_PATHSPECS: '1', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' };
    // git из GitHub Desktop должен знать, где лежат его части
    const root = bin && path.dirname(path.dirname(bin));
    for (const p of [path.join(root || '', 'libexec', 'git-core'), path.join(root || '', 'mingw64', 'libexec', 'git-core')]) {
      if (root && fs.existsSync(p)) { e.GIT_EXEC_PATH = p; break; }
    }
    return e;
  };
  const works = (p) => {
    try { return spawnSync(p, ['--version'], { encoding: 'utf8', windowsHide: true, timeout: 15000, env: env() }).status === 0; } catch { return false; }
  };

  function findGit() {
    if (bin !== undefined) return bin;
    const c = [];
    if (process.env.STUDIO_GIT) c.push(process.env.STUDIO_GIT);
    if (process.platform === 'win32') {
      const base = path.join(process.env.LOCALAPPDATA || '', 'GitHubDesktop');
      try {
        const apps = fs.readdirSync(base).filter((d) => d.startsWith('app-')).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
        for (const d of apps) c.push(path.join(base, d, 'resources', 'app', 'git', 'cmd', 'git.exe'));
      } catch {}
      c.push('C:\\Program Files\\Git\\cmd\\git.exe');
    } else if (process.platform === 'darwin') {
      for (const app of ['/Applications', path.join(os.homedir(), 'Applications')]) c.push(path.join(app, 'GitHub Desktop.app/Contents/Resources/app/git/bin/git'));
      c.push('/opt/homebrew/bin/git', '/usr/local/bin/git', '/Library/Developer/CommandLineTools/usr/bin/git', '/Applications/Xcode.app/Contents/Developer/usr/bin/git');
    }
    // на Mac /usr/bin/git без Xcode открывает окно установки — его не трогаем
    if (process.platform !== 'darwin') c.push('git');
    for (const p of c) {
      bin = p;
      if ((p === 'git' || fs.existsSync(p)) && works(p)) return bin;
    }
    return (bin = null);
  }

  function git(args, { input, ok = false } = {}) {
    if (!findGit()) throw new Error('Не нашла Git. Установи GitHub Desktop (в нём есть Git) или Git для Windows.');
    const r = spawnSync(bin, ['-c', 'core.quotepath=off', ...args], { cwd: ROOT, encoding: 'utf8', input, maxBuffer: 512 * MB, windowsHide: true, env: env() });
    if (r.status !== 0 && !ok) throw new Error((r.stderr || r.stdout || r.error?.message || 'git ' + args[0]).trim());
    return r.status === 0 ? r.stdout : null;
  }

  // Большой Push чаще всего обрывается из-за маленького буфера. Чиним настройку репозитория один раз.
  function fixPostBuffer() {
    try {
      const cfg = path.join(ROOT, '.git', 'config');
      if (!fs.existsSync(cfg)) return false;
      const t = fs.readFileSync(cfg, 'utf8');
      if (/postBuffer/i.test(t)) return false;
      fs.appendFileSync(cfg, `${t.endsWith('\n') ? '' : '\n'}[http]\n\tpostBuffer = 524288000\n\tlowSpeedLimit = 1000\n\tlowSpeedTime = 600\n`);
      return true;
    } catch { return false; }
  }

  // Файлы больше 95 МБ прячем от Git (.git/info/exclude — только на этом компьютере, в репозиторий не попадает)
  function excludeHuge(paths) {
    if (!paths.length) return;
    const f = path.join(ROOT, '.git', 'info', 'exclude');
    fs.mkdirSync(path.dirname(f), { recursive: true });
    const have = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
    const add = paths.map((p) => '/' + p.replace(/([*?[\]!#\\])/g, '\\$1')).filter((l) => !have.split('\n').includes(l));
    if (add.length) fs.appendFileSync(f, `${have && !have.endsWith('\n') ? '\n' : ''}# больше 100 МБ — GitHub не примет (добавила студия)\n${add.join('\n')}\n`);
  }

  function changedFiles() {
    const out = git(['status', '--porcelain=v1', '-z', '-uall']);
    const parts = out.split('\0');
    const files = [];
    for (let i = 0; i < parts.length; i++) {
      const e = parts[i];
      if (!e) continue;
      const xy = e.slice(0, 2), p = e.slice(3);
      if (xy[0] === 'R' || xy[0] === 'C') i++; // у переименования следом идёт старое имя
      let size = 0;
      try { size = fs.statSync(path.join(ROOT, p)).size; } catch {}
      files.push({ path: p, size, untracked: xy === '??', deleted: xy.includes('D') });
    }
    return files;
  }

  function status() {
    if (!findGit()) return { git: null };
    const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
    const upstream = (git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { ok: true }) || '').trim() || null;
    const ahead = (git(['rev-list', '--reverse', 'HEAD', '--not', '--remotes']) || '').split('\n').filter(Boolean);
    const behind = upstream ? +(git(['rev-list', '--count', 'HEAD..@{u}'], { ok: true }) || 0) : 0;
    let unpushedBytes = 0;
    const bigUnpushed = [];
    if (ahead.length) {
      const objs = git(['rev-list', '--objects', 'HEAD', '--not', '--remotes']).split('\n').filter(Boolean);
      const names = Object.fromEntries(objs.map((l) => [l.slice(0, 40), l.slice(41)]));
      const sizes = git(['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'], { input: objs.map((l) => l.slice(0, 40)).join('\n') + '\n' });
      for (const l of sizes.split('\n')) {
        const [sha, type, size] = l.split(' ');
        if (type !== 'blob') continue;
        unpushedBytes += +size;
        if (+size > HUGE) bigUnpushed.push({ path: names[sha], size: +size });
      }
    }
    const changed = changedFiles();
    return {
      git: bin, branch, upstream, ahead: ahead.length, behind, unpushedBytes, bigUnpushed,
      changed: changed.length, changedBytes: changed.reduce((a, f) => a + f.size, 0),
      huge: changed.filter((f) => f.size > HUGE).map(({ path: p, size }) => ({ path: p, size })),
    };
  }

  function push(branch) {
    return new Promise((resolve) => {
      const c = spawn(bin, ['push', '-u', 'origin', `HEAD:refs/heads/${branch}`], { cwd: ROOT, env: env(), windowsHide: true });
      let err = '';
      c.stderr.on('data', (d) => (err += d));
      c.stdout.on('data', (d) => (err += d));
      const t = setTimeout(() => c.kill(), 20 * 60 * 1000);
      c.on('error', (e) => { clearTimeout(t); resolve({ ok: false, kind: 'other', err: e.message }); });
      c.on('close', (code) => {
        clearTimeout(t);
        if (code === 0) return resolve({ ok: true });
        const kind = /rejected|non-fast-forward|fetch first/i.test(err) ? 'behind'
          : /Authentication|could not read Username|terminal prompts disabled|403|Permission denied|credential/i.test(err) ? 'auth' : 'net';
        resolve({ ok: false, kind, err: err.trim().slice(-800) });
      });
    });
  }

  let job = { status: 'idle', log: [] };
  const say = (t) => { job.log.push(t); };

  async function pushWithRetry(branch) {
    for (let i = 0; i < 3; i++) {
      const r = await push(branch);
      if (r.ok || r.kind !== 'net') return r;
      say(`Связь оборвалась, пробую ещё раз (${i + 2} из 3)…`);
      await new Promise((ok) => setTimeout(ok, 4000 * (i + 1)));
    }
    return push(branch);
  }

  async function sendPortions(maxMB = 80) {
    const max = Math.max(10, +maxMB || 80) * MB;
    let st = status();
    if (!st.git) throw new Error('Не нашла Git. Установи GitHub Desktop.');
    if (st.behind) throw new Error('На GitHub есть новые изменения. Сначала нажми Fetch/Pull в GitHub Desktop, потом снова «Отправить порциями».');
    const { branch } = st;
    say(`Ветка ${branch}.`);

    // 1. Неотправленные коммиты слишком большие — разворачиваем их обратно в файлы (файлы остаются на месте)
    if (st.ahead && (st.unpushedBytes > max || st.bigUnpushed.length)) {
      const base = st.upstream || git(['rev-parse', `${git(['rev-list', '--reverse', 'HEAD', '--not', '--remotes']).split('\n')[0]}^1`]).trim();
      git(['reset', '--mixed', '-q', base]);
      say(`Неотправленные коммиты (${st.ahead}, ${Math.round(st.unpushedBytes / MB)} МБ) слишком большие для одного Push. Разложила их обратно на файлы — всё на месте, сейчас отправлю порциями.`);
      st = status();
    } else if (st.ahead) {
      say(`Отправляю ${st.ahead} готовых коммитов (${Math.round(st.unpushedBytes / MB)} МБ)…`);
      const r = await pushWithRetry(branch);
      if (!r.ok) return stop(r, 'уже готовые коммиты');
      say('Отправлено.');
    }

    // 2. Огромные файлы прячем от Git
    if (st.huge.length) {
      excludeHuge(st.huge.map((f) => f.path));
      say(`Файлы больше 100 МБ GitHub не примет — спрятала их от Git (они остались в папке): ${st.huge.map((f) => f.path).join(', ')}. Картинки уменьши через вкладку «Иллюстрации».`);
    }

    // 3. Порции: коммит → Push → следующий
    if (!(git(['config', 'user.email'], { ok: true }) || '').trim()) throw new Error('Git не знает твоё имя и почту. Открой GitHub Desktop → Settings → Git, впиши их и нажми Save — потом снова «Отправить порциями».');
    git(['reset', '-q']);
    const parts = [];
    for (const f of changedFiles().filter((x) => x.size <= HUGE)) {
      const last = parts[parts.length - 1];
      if (last && last.sum + f.size <= max) { last.files.push(f); last.sum += f.size; } else parts.push({ files: [f], sum: f.size });
    }
    let n = 0;
    for (const part of parts) {
      n++;
      git(['add', '-A', '--pathspec-from-file=-', '--pathspec-file-nul'], { input: part.files.map((f) => f.path).join('\0') });
      git(['commit', '-q', '-m', `Студия: порция ${n} из ${parts.length} (${part.files.length} файлов, ${Math.round(part.sum / MB)} МБ)`]);
      say(`Порция ${n} из ${parts.length}: ${part.files.length} файлов, ${Math.round(part.sum / MB)} МБ — отправляю…`);
      const r = await pushWithRetry(branch);
      if (!r.ok) return stop(r, `порцию ${n} из ${parts.length}`);
      say(`Порция ${n} отправлена.`);
    }
    say(n ? 'Готово: всё отправлено в GitHub.' : 'Нечего отправлять: всё уже в GitHub.');
    logInbox(`Отправка в GitHub порциями: ${n} порций`);
    job.status = 'done';
  }

  function stop(r, what) {
    if (r.kind === 'auth') {
      say(`Студии не хватает входа в GitHub, чтобы отправить ${what} самой. Ничего страшного: порция уже собрана и небольшая. Нажми Push в GitHub Desktop, а потом снова «Отправить порциями» здесь — студия соберёт следующую.`);
      job.status = 'desktop';
    } else if (r.kind === 'behind') {
      say('На GitHub есть новые изменения. Нажми Fetch/Pull в GitHub Desktop, потом снова «Отправить порциями».');
      job.status = 'failed';
    } else {
      say(`Не получилось отправить ${what}: ${r.err}\nПопробуй порции поменьше.`);
      job.status = 'failed';
    }
  }

  return {
    findGit, fixPostBuffer, status,
    job: () => job,
    start(maxMB) {
      if (job.status === 'running') throw new Error('Отправка уже идёт');
      job = { status: 'running', log: [], startedAt: new Date().toISOString() };
      sendPortions(maxMB).catch((e) => { say('Ошибка: ' + e.message); job.status = 'failed'; });
      return job;
    },
  };
}
