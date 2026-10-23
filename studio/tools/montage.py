"""Чистовая склейка серии через ffmpeg — по той же раскладке, что вкладка «Монтаж».

Запуск:  python studio/tools/montage.py s01e01 [--scene 1] [--shots 1.4-1.9] [--size 1920x1080] [--preview]
Берёт: studio/data/episodes/<серия>.json (кадры и хронометраж), studio/data/montage/<серия>.json (дубли на кадрах,
переходы), studio/media/<серия>/voice/<кадр>_<герой>_<n>.mp3 (озвучка).
На кадре играет: свой дубль (идёт дальше по кадрам, пока не кончится) → видео связки → видео кадра → картинка
с медленным наездом → чёрный кадр. Переходы: cut, flash (белая вспышка), fade (из затемнения), dissolve, whip.
Звук: родной звук роликов (атмосфера) приглушается под голосом; реплики кадра идут подряд с начала кадра.
Результат: studio/export/<серия>/Монтаж_<время>.mp4; с --preview ещё 720p-копия в studio/media/<серия>/renders/ (для Git).
"""
import json, os, re, shutil, subprocess, sys, tempfile, time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
A = sys.argv[1:]
EP = A[0] if A and not A[0].startswith('--') else 's01e01'
opt = lambda k, d=None: A[A.index(k) + 1] if k in A and A.index(k) + 1 < len(A) else d
W, H = map(int, opt('--size', '1920x1080').split('x'))
FPS = 24
FF = shutil.which('ffmpeg') or 'ffmpeg'
P = lambda r: os.path.join(ROOT, *r.split('/'))


def probe(path):
    """Длительность и есть ли звук."""
    try:
        out = subprocess.run([shutil.which('ffprobe') or 'ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=codec_type',
                              '-of', 'json', path], capture_output=True, text=True).stdout
        j = json.loads(out)
        return float(j['format']['duration']), any(s.get('codec_type') == 'audio' for s in j.get('streams', []))
    except Exception:
        return 0.0, False


def selected(item, key='versions', sel='selected'):
    v = item.get(key) or []
    i = item.get(sel)
    return v[i]['file'] if v and i is not None and i < len(v) else None


def keyframe(s, sc):
    return selected(s) or selected(sc)


def items_of(ep, M):
    takes = {t['id']: t for t in M.get('takes', [])}
    out, run = [], None
    for sc in ep['scenes']:
        for s in sc['shots']:
            if s.get('cut'):
                continue
            dur = s.get('dur') or 3
            trans = M.get('trans', {}).get(s['id'], '')
            p = M.get('place', {}).get(s['id'])
            if p and p.get('take') in takes:
                run = {'take': takes[p['take']], 't': p.get('in', 0), 'from': s['id']}
            if run and (run['from'] == s['id'] or (run['take'].get('dur') and run['take']['dur'] - run['t'] > 0.4)):
                out.append(dict(s=s, sc=sc, video=run['take']['file'], off=run['t'], dur=dur, trans=trans, img=keyframe(s, sc)))
                run['t'] += dur
                if not run['take'].get('dur') or run['t'] >= run['take']['dur'] - 0.4:
                    run = None
                continue
            run = None
            clip = next((c for c in sc.get('clips') or [] if s['id'] in c['shots']), None)
            cv = clip and selected(clip, 'videos', 'videoSelected')
            if cv:
                off = 0
                for sid in clip['shots']:
                    if sid == s['id']:
                        break
                    off += next((x.get('dur') or 3 for x in sc['shots'] if x['id'] == sid), 3)
                out.append(dict(s=s, sc=sc, video=cv, off=off, dur=dur, trans=trans, img=keyframe(s, sc)))
            else:
                out.append(dict(s=s, sc=sc, video=selected(s, 'videos', 'videoSelected'), off=0, dur=dur, trans=trans, img=keyframe(s, sc)))
    return out


def shot_key(sid):
    return [int(x) if x.isdigit() else x for x in re.findall(r'\d+|[a-z]+', sid)]


def segment(x, out):
    """Один кадр → одинаковый по формату кусок (видео + стерео звук)."""
    d = x['dur']
    vf_fit = f'scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps={FPS}'
    tr = {'flash': f',fade=t=in:st=0:d=0.25:color=white', 'fade': ',fade=t=in:st=0:d=0.6', 'dissolve': ',fade=t=in:st=0:d=0.35',
          'whip': ",gblur=sigma=40:enable='lt(t,0.12)'"}.get(x['trans'], '')
    src = P(x['video']) if x['video'] and os.path.exists(P(x['video'])) else None
    cmd = [FF, '-loglevel', 'error', '-y']
    if src:
        sdur, has_audio = probe(src)
        off = min(x['off'], max(0, sdur - 0.1))
        cmd += ['-ss', f'{off:.3f}', '-i', src]
        if not has_audio:
            cmd += ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo']
        # ролик короче кадра — держим последний кадр
        vf = f'{vf_fit},tpad=stop_mode=clone:stop_duration={d}{tr}'
        cmd += ['-t', f'{d:.3f}', '-vf', vf, '-map', '0:v:0', '-map', '0:a:0' if has_audio else '1:a:0', '-af', 'apad', '-ar', '48000', '-ac', '2']
    elif x['img'] and os.path.exists(P(x['img'])):
        frames = int(d * FPS)
        vf = (f'scale={W * 2}:{H * 2}:force_original_aspect_ratio=increase,crop={W * 2}:{H * 2},'
              f"zoompan=z='1+0.06*on/{frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={W}x{H}:fps={FPS},setsar=1{tr}")
        cmd += ['-loop', '1', '-i', P(x['img']), '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', f'{d:.3f}', '-vf', vf, '-map', '0:v', '-map', '1:a']
    else:
        cmd += ['-f', 'lavfi', '-i', f'color=c=black:s={W}x{H}:r={FPS}', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', f'{d:.3f}', '-map', '0:v', '-map', '1:a']
    cmd += ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', out]
    subprocess.run(cmd, check=True)


def main():
    ep = json.load(open(P(f'studio/data/episodes/{EP}.json'), encoding='utf-8'))
    M = json.load(open(P(f'studio/data/montage/{EP}.json'), encoding='utf-8')) if os.path.exists(P(f'studio/data/montage/{EP}.json')) else {}
    items = items_of(ep, M)
    if opt('--scene') is not None:
        items = [x for x in items if str(x['sc'].get('n')) == opt('--scene')]
    if opt('--shots'):
        a, b = (opt('--shots').split('-') + [None])[:2]
        b = b or a
        items = [x for x in items if shot_key(a) <= shot_key(x['s']['id']) <= shot_key(b)]
    if not items:
        sys.exit('Нет кадров для склейки')
    tmp = tempfile.mkdtemp()
    t, voices = 0.0, []
    vdir = P(f'studio/media/{EP}/voice')
    have = os.listdir(vdir) if os.path.isdir(vdir) else []
    for n, x in enumerate(items):
        print(f'кадр {x["s"]["id"]} ({x["dur"]} с) ← {x["video"] or x["img"] or "чёрный"}')
        segment(x, os.path.join(tmp, f'{n:04d}.mp4'))
        # реплики кадра подряд, первая — чуть после начала кадра
        at = t + 0.15
        for i, l in enumerate(x['s'].get('lines') or []):
            if l.get('optional'):
                continue
            base = f'{x["s"]["id"]}_{l["who"]}_{i + 1}'
            f = next((h for h in have if os.path.splitext(h)[0] == base), None)
            if f:
                vd, _ = probe(os.path.join(vdir, f))
                voices.append((os.path.join(vdir, f), at))
                at += vd + 0.2
        t += x['dur']
    lst = os.path.join(tmp, 'list.txt')
    open(lst, 'w').write(''.join(f"file '{os.path.join(tmp, f'{n:04d}.mp4')}'\n" for n in range(len(items))))
    joined = os.path.join(tmp, 'joined.mp4')
    subprocess.run([FF, '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', joined], check=True)
    os.makedirs(P(f'studio/export/{EP}'), exist_ok=True)
    out = P(f'studio/export/{EP}/Монтаж_{time.strftime("%Y-%m-%d_%H-%M")}.mp4')
    if voices:
        # голоса поверх; родной звук роликов уходит вниз, пока кто-то говорит
        ins = sum([['-i', f] for f, _ in voices], [])
        dl = ''.join(f'[{k + 1}:a]adelay={int(at * 1000)}|{int(at * 1000)},volume=1.6[v{k}];' for k, (_, at) in enumerate(voices))
        mix = ''.join(f'[v{k}]' for k in range(len(voices)))
        fc = (f'{dl}{mix}amix=inputs={len(voices)}:normalize=0[voice];[voice]asplit[vo][sc];'
              f'[0:a]volume=0.8[amb];[amb][sc]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[duck];'
              f'[duck][vo]amix=inputs=2:normalize=0,alimiter=limit=0.95[a]')
        subprocess.run([FF, '-loglevel', 'error', '-y', '-i', joined, *ins, '-filter_complex', fc, '-map', '0:v', '-map', '[a]',
                        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', out], check=True)
    else:
        shutil.copy(joined, out)
    print('монтаж:', os.path.relpath(out, ROOT), f'({t:.0f} с, озвучка: {len(voices)})')
    if '--preview' in A:
        pv = P(f'studio/media/{EP}/renders/{os.path.basename(out)}')
        os.makedirs(os.path.dirname(pv), exist_ok=True)
        subprocess.run([FF, '-loglevel', 'error', '-y', '-i', out, '-vf', 'scale=1280:-2', '-c:v', 'libx264', '-crf', '24', '-preset', 'medium',
                        '-c:a', 'aac', '-b:a', '128k', pv], check=True)
        print('превью для Git:', os.path.relpath(pv, ROOT), f'{os.path.getsize(pv) / 1e6:.1f} МБ')
    shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
