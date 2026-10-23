"""Режиссёрская склейка серии по монтажному листу: куски дублей, переходы, титры, звук.

Запуск:  python studio/tools/cut.py s01e01 [--sheet v1] [--size 1920x1080] [--preview] [--only 1.4-1.9]
Монтажный лист: studio/data/montage/<серия>.cut.json (с --sheet v1 — <серия>.v1.cut.json)
  "video": [{"id": "1.4", "take": "T012", "in": 0, "out": 4.17, "trans": "cut", "td": 0.4, "zoom": 1.08}, …,
            {"id": "title", "card": ["ХРОНИКИ РОДА ЭЛЬТАР", "БЕЛАЯ КРОВЬ", "Серия 1 · Это Грань?"], "dur": 4.5}]
    trans — переход В этот кусок: cut, dissolve, fadeblack, fadewhite (вспышка), whip (смазанная панорама), zoomin; td — его длина.
    speed — скорость (0.8 — замедление), hold — секунд стоп-кадра в начале (с медленным наездом, если есть zoom), hold_end — в конце,
    "title": {"lines": [3 строки], "at": [от, до]} на весь лист — титр поверх склейки по общему времени (идёт через переходы);
    text + text_at — титр поверх кадра (3 строки, как у card) и когда он виден: [от, до] в секундах куска.
  "audio": [{"src": "wind_soft", "from": "E1", "to": "E5", "gain": 0.4, "fin": 2, "fout": 2, "at": 0.5}, …]
    src — звук из SFX ниже (синтез ffmpeg, файлы не нужны) или путь к mp3/wav (музыка, озвучка);
    from/to — id кусков (от начала from до конца to), at — сдвиг от начала from, dur — длина вместо to, ss — с какой секунды файла.
    src "take" — родной звук дубля из куска from (Kling кладёт ветер, крылья, шаги); ss — сдвиг от его in.
    voice: true — реплика: все голоса выводятся на одну громкость (без эффектов), музыка и шумы под ней приглушаются.
Свои звуки и музыка: файл studio/media/<серия>/sfx/<имя>.mp3|wav заменяет синтез с тем же именем (список — studio/canon/voice/<серия>_звуки.md).
Водяной знак Kling в правом нижнем углу затирается (delogo), кроме дублей с "clean": true. Звука в дублях нет — вся звуковая дорожка из листа.
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
FONT = next((f for f in ['/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
                         'C:/Windows/Fonts/georgia.ttf', 'C:/Windows/Fonts/arial.ttf'] if os.path.exists(f)), '')
# титр: Cormorant SC (кириллица, OFL) из studio/assets/fonts; ffmpeg на Windows понимает путь только с / и экранированным «:»
TFONT = [P(f'studio/assets/fonts/CormorantSC-{w}.ttf') for w in ('SemiBold', 'Bold', 'SemiBold')]
TFONT = [f.replace('\\', '/').replace(':', '\\:') if os.path.exists(f) else FONT for f in TFONT]
run = lambda cmd: subprocess.run(cmd, check=True)

# ---- звуки: синтез ffmpeg (lavfi), {d} — длительность ----
SR = 48000
SFX = {
    'wind_soft': 'anoisesrc=c=brown:a=0.6:r={sr}:d={d},lowpass=f=520,highpass=f=50,tremolo=f=0.13:d=0.55',
    'wind_strong': 'anoisesrc=c=pink:a=0.5:r={sr}:d={d},bandpass=f=650:width_type=h:w=900,tremolo=f=0.31:d=0.65,volume=2.2',
    'room': 'anoisesrc=c=brown:a=0.25:r={sr}:d={d},lowpass=f=170',
    'surf': 'anoisesrc=c=brown:a=0.8:r={sr}:d={d},lowpass=f=950,tremolo=f=0.11:d=0.95',
    'sand_glass': 'anoisesrc=c=white:a=0.25:r={sr}:d={d},highpass=f=3200,tremolo=f=6.5:d=0.9',
    'whoosh': 'anoisesrc=c=pink:a=0.9:r={sr}:d={d},bandpass=f=1300:width_type=h:w=1800,afade=t=in:d={h},afade=t=out:st={h}:d={h}',
    'wing': 'anoisesrc=c=brown:a=1:r={sr}:d={d},lowpass=f=420,afade=t=in:d=0.07,afade=t=out:st=0.08:d={h2},volume=2.5',
    'boom': "aevalsrc='0.95*sin(2*PI*(42+38*exp(-3*t))*t)*exp(-1.4*t)':s={sr}:d={d},aecho=0.8:0.6:180|420:0.35|0.2",
    'hit': "aevalsrc='0.5*(sin(2*PI*660*t)+0.6*sin(2*PI*990*t)+0.4*sin(2*PI*1485*t))*exp(-2.2*t)':s={sr}:d={d},aecho=0.8:0.8:250|500:0.4|0.25",
    'door': "aevalsrc='0.9*sin(2*PI*62*t)*exp(-6*t)+0.25*sin(2*PI*180*t)*exp(-14*t)':s={sr}:d={d},aecho=0.7:0.5:90:0.3",
    'heart': "aevalsrc='0.8*(sin(2*PI*55*t)*exp(-14*mod(t,1.05))+0.6*sin(2*PI*50*t)*exp(-14*mod(t-0.32,1.05))*gte(mod(t,1.05),0.32))':s={sr}:d={d}",
    'taps': "aevalsrc='0.55*sin(2*PI*820*t)*exp(-70*mod(t,0.17))*lt(mod(t,0.85),0.68)+0.25*sin(2*PI*260*t)*exp(-50*mod(t,0.17))*lt(mod(t,0.85),0.68)':s={sr}:d={d},lowpass=f=2600,aecho=0.6:0.4:35:0.25",
    'scrape': 'anoisesrc=c=brown:a=0.9:r={sr}:d={d},bandpass=f=260:width_type=h:w=300,tremolo=f=23:d=0.5,afade=t=in:d=0.08,afade=t=out:st={h}:d={h},volume=2',
    'window': "aevalsrc='0.7*sin(2*PI*95*t)*exp(-9*t)+0.3*sin(2*PI*420*t)*exp(-25*t)':s={sr}:d={d},aecho=0.6:0.4:60:0.25",
    'bird_cry': "aevalsrc='0.45*sin(2*PI*(2100-1100*t+60*sin(2*PI*28*t))*t)*exp(-2.6*t)*gte(t,0)':s={sr}:d={d},highpass=f=900,aecho=0.6:0.5:300:0.25",
    # тёмный фон: ре минор, медленно дышит; epic — с квинтой сверху, tense — ниже и тише
    'drone_epic': "aevalsrc='0.10*sin(2*PI*73.42*t)*(0.7+0.3*sin(2*PI*0.06*t))+0.08*sin(2*PI*110*t)*(0.6+0.4*sin(2*PI*0.09*t+1))"
                  "+0.06*sin(2*PI*146.83*t)*(0.5+0.5*sin(2*PI*0.04*t+2))+0.05*sin(2*PI*220*t)*(0.4+0.6*sin(2*PI*0.05*t+3))"
                  "+0.03*sin(2*PI*293.66*t)*(0.3+0.7*sin(2*PI*0.07*t))':s={sr}:d={d},lowpass=f=1400,aecho=0.8:0.85:400|800:0.35|0.2",
    'drone_tense': "aevalsrc='0.10*sin(2*PI*55*t)*(0.7+0.3*sin(2*PI*0.05*t))+0.07*sin(2*PI*65.41*t)*(0.6+0.4*sin(2*PI*0.08*t+1))"
                   "+0.04*sin(2*PI*110*t+0.3*sin(2*PI*0.2*t))*(0.5+0.5*sin(2*PI*0.03*t))':s={sr}:d={d},lowpass=f=700,aecho=0.8:0.8:300:0.3",
    'drone_dark': "aevalsrc='0.11*sin(2*PI*36.71*t)*(0.7+0.3*sin(2*PI*0.04*t))+0.08*sin(2*PI*73.42*t)*(0.6+0.4*sin(2*PI*0.06*t+2))"
                  "+0.05*sin(2*PI*77.78*t)*(0.4+0.6*sin(2*PI*0.03*t+1))':s={sr}:d={d},lowpass=f=600,aecho=0.8:0.85:500:0.35",
}


# музыка: пока нет файлов автора, играет синтезированный фон
ALIAS = {'music_open': 'drone_epic', 'music_council': 'drone_tense', 'music_decision': 'drone_dark', 'music_end': 'drone_epic'}


def sfx_file(name):
    d = P(f'studio/media/{EP}/sfx')
    for ext in ('.wav', '.mp3', '.ogg', '.m4a'):
        if os.path.exists(os.path.join(d, name + ext)):
            return os.path.join(d, name + ext)


def loudness(path):
    """Средняя громкость файла (LUFS) — по ней голоса выводятся на один уровень без компрессии и эха."""
    err = subprocess.run([FF, '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    m = re.findall(r'I:\s+(-?[\d.]+) LUFS', err)
    return float(m[-1]) if m else -20.0


def take_of(M, tid):
    t = next((x for x in M.get('takes', []) if x['id'] == tid), None)
    if not t:
        sys.exit(f'Нет дубля {tid}')
    return t


def probe_size(path):
    out = subprocess.run([shutil.which('ffprobe') or 'ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height',
                          '-of', 'csv=p=0', path], capture_output=True, text=True).stdout.strip()
    w, h = map(int, out.split(',')[:2])
    return w, h


def esc(t):
    return t.replace('\\', '\\\\').replace(':', '\\:').replace("'", "\u2019").replace('%', '\\%')


def titles(lines, t0, t1):
    """Три строки титра (мелкая, крупная, мелкая): разрядка, тёплый цвет, тёмная обводка; проявляются по очереди, гаснут к t1."""
    sizes = [int(H * 0.032), int(H * 0.110), int(H * 0.044)]
    ys = ['h*0.335', 'h*0.395', 'h*0.555']
    colors = ['0xD9B98A', '0xF6EBDD', '0xE8D6BC']
    spaced = lambda t, k: ('\u2009' * k).join(t) if k else t  # разрядка тонкими пробелами
    return ','.join(f"drawtext=fontfile='{TFONT[i % 3]}':text='{esc(spaced(t, (2, 1, 0)[i % 3]))}':fontcolor={colors[i % 3]}:fontsize={sizes[i % 3]}"
                    f":x=(w-text_w)/2:y={ys[i % 3]}:borderw={(2, 3, 2)[i % 3]}:bordercolor=0x1a0606@0.55:shadowcolor=0x000000@0.7:shadowx=3:shadowy=3"
                    f":alpha='min(1,max(0,(t-{t0 + 0.45 * i})/0.9))*min(1,max(0,({t1}-t)/0.7))'" for i, t in enumerate(lines))


def render_piece(M, v, out):
    d = v['out'] - v['in'] if 'take' in v else v['dur']
    grade = 'eq=contrast=1.04:saturation=1.06,vignette=angle=PI/5'
    if 'card' in v:
        run([FF, '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', f'color=c=0x0b0708:s={W}x{H}:r={FPS}:d={d}', '-vf',
             f'{titles(v["card"], 0, d)},vignette=angle=PI/4', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', out])
        return d
    t = take_of(M, v['take'])
    src = P(t['file'])
    sw, sh = probe_size(src)
    clean = t.get('clean') or v.get('clean')
    logo = '' if clean else f'delogo=x={sw - 160}:y={sh - 50}:w={136}:h={30},'
    fit = f'scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1,fps={FPS}'
    hold = v.get('hold', 0)
    if hold:  # стоп-кадр в начале
        fit += f',tpad=start_mode=clone:start_duration={hold}'
        d += hold
    if v.get('hold_end'):  # стоп-кадр в конце (последний кадр серии держится под затемнение)
        fit += f",tpad=stop_mode=clone:stop_duration={v['hold_end']}"
        d += v['hold_end']
    z = v.get('zoom')
    if z:  # медленный наезд внутри куска
        n = int(d * FPS)
        fit += f",zoompan=z='1+({z}-1)*on/{n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS}"
    if v.get('speed'):
        fit += f",setpts=PTS/{v['speed']},fps={FPS}"
        d = d / v['speed']
    text = ''
    if v.get('text'):  # под титром кадр плавно темнеет, чтобы надпись не терялась
        t0, t1 = v.get('text_at', [0, d])
        k = f'min(1,max(0,(T-{t0 - 0.3})/0.9))*min(1,max(0,({t1 + 0.4}-T)/0.9))'
        text = (f",split[a][b];[b]eq=brightness=-0.13:saturation=0.85:contrast=0.92[dk];[a][dk]blend=all_expr='A+(B-A)*{k}',"
                f"{titles(v['text'], t0, t1)}")
    run([FF, '-loglevel', 'error', '-y', '-ss', f"{v['in']:.3f}", '-t', f"{v['out'] - v['in']:.3f}", '-i', src, '-an',
         '-vf', f'{logo}{fit},{grade}{text}', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', out])
    return real_dur(out) or d


def real_dur(path):
    """Настоящая длина куска (замедление и стоп-кадр округляются до кадров) — по ней ставится звук."""
    out = subprocess.run([shutil.which('ffprobe') or 'ffprobe', '-v', 'error', '-select_streams', 'v:0', '-count_frames',
                          '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', path], capture_output=True, text=True).stdout.strip()
    try:
        return int(out.split(',')[0]) / FPS
    except ValueError:
        return 0


XF = {'dissolve': 'dissolve', 'fadeblack': 'fadeblack', 'fadewhite': 'fadewhite', 'whip': 'smoothleft', 'zoomin': 'zoomin', 'fade': 'fade'}


def main():
    M = json.load(open(P(f'studio/data/montage/{EP}.json'), encoding='utf-8'))
    sheet = f'{EP}.{opt("--sheet")}.cut.json' if opt('--sheet') else f'{EP}.cut.json'
    C = json.load(open(P(f'studio/data/montage/{sheet}'), encoding='utf-8'))
    V = C['video']
    if opt('--only'):
        a, b = (opt('--only').split('-') + [None])[:2]
        ids = [v['id'] for v in V]
        V = V[ids.index(a):ids.index(b or a) + 1]
    tmp = tempfile.mkdtemp()
    files, durs = [], []
    for n, v in enumerate(V):
        f = os.path.join(tmp, f'{n:03d}.mp4')
        print(f"{v['id']:>8}  {v.get('take', 'титр')} {v.get('in', '')}–{v.get('out', '')}  {v.get('trans', 'cut')}")
        durs.append(render_piece(M, v, f))
        files.append(f)
    # склейка: cut — встык, остальное — xfade с перекрытием; считаем, где начинается каждый кусок
    fc = [f'[{n}:v]fps={FPS},settb=1/{FPS},format=yuv420p[s{n}]' for n in range(len(V))]
    starts, t, last = [], 0.0, '[s0]'
    for n in range(len(V)):
        tr = V[n].get('trans', 'cut') if n else 'cut'
        td = min(V[n].get('td', 0.5), durs[n] / 2, (durs[n - 1] / 2) if n else 0)
        if n == 0:
            starts.append(0.0)
            t = durs[0]
            continue
        if tr in XF:
            starts.append(t - td)
            fc.append(f'{last}[s{n}]xfade=transition={XF[tr]}:duration={td:.3f}:offset={t - td:.3f}[x{n}]')
            t = t - td + durs[n]
        else:
            starts.append(t)
            fc.append(f'{last}[s{n}]concat=n=2:v=1:a=0,settb=1/{FPS}[x{n}]')
            t += durs[n]
        last = f'[x{n}]'
    total = t
    first_tr = V[0].get('trans')
    fade_in = f",fade=t=in:d={V[0].get('td', 1)}" if first_tr in ('fadeblack', 'fade') else ''
    if C.get('title') and not opt('--only'):  # общий титр: под ним кадр темнеет, надпись идёт через переходы
        t0, t1 = C['title']['at']
        k = f'min(1,max(0,(T-{t0 - 0.3})/0.9))*min(1,max(0,({t1 + 0.4}-T)/0.9))'
        fc.append(f"{last}split[ta][tb];[tb]eq=brightness=-0.13:saturation=0.85:contrast=0.92[tdk];"
                  f"[ta][tdk]blend=all_expr='A+(B-A)*{k}',{titles(C['title']['lines'], t0, t1)}[titled]")
        last = '[titled]'
    fc.append(f"{last}fade=t=out:st={total - C.get('tail', 1.2):.3f}:d={C.get('tail', 1.2)}{fade_in}[vout]")
    video = os.path.join(tmp, 'video.mp4')
    ins = sum([['-i', f] for f in files], [])
    run([FF, '-loglevel', 'error', '-y', *ins, '-filter_complex', ';'.join(fc), '-map', '[vout]', '-c:v', 'libx264', '-preset', 'medium',
         '-crf', '17', '-pix_fmt', 'yuv420p', '-r', str(FPS), video])
    # звук по листу
    pos = {v['id']: (starts[i], starts[i] + durs[i]) for i, v in enumerate(V)}
    ains, chains, voices = [], [], []
    for a in C.get('audio', []):
        if a['from'] not in pos:
            continue
        st = pos[a['from']][0] + a.get('at', 0)
        to = a.get('to', a['from'])
        en = st + a['dur'] if 'dur' in a else (pos[to][1] if to in pos else total) + a.get('tail', 0)
        d = max(0.2, min(en, total) - st)
        src = a['src']
        k = len(chains)
        ss = a.get('ss', 0)
        if src == 'take':  # родной звук дубля этого куска
            piece = next(v for v in V if v['id'] == a['from'])
            ains += ['-i', P(take_of(M, piece['take'])['file'])]
            ss += piece.get('in', 0)
        elif sfx_file(src):
            ains += ['-stream_loop', '-1', '-i', sfx_file(src)]
        elif src in SFX or src in ALIAS:
            ains += ['-f', 'lavfi', '-i', SFX[ALIAS.get(src, src)].format(d=f'{d:.3f}', sr=SR, h=f'{d / 2:.3f}', h2=f'{max(0.1, d - 0.15):.3f}')]
        elif os.path.exists(P(src)):
            ains += ['-i', P(src)]
        else:
            print('  нет звука', src, '— пропускаю')
            continue
        fi, fo = a.get('fin', 0.05), a.get('fout', 0.3)
        # голос: как записан, только громкость к общему уровню и чистка самого низа
        vfx = f'highpass=f=70,volume={max(-12, min(12, -17 - loudness(P(src)))):.1f}dB,' if a.get('voice') else ''
        chains.append(f"[{k + 1}:a]aformat=sample_rates={SR}:channel_layouts=stereo,{vfx}atrim={ss:.3f}:{ss + d:.3f},asetpts=PTS-STARTPTS,"
                      f"afade=t=in:d={fi},afade=t=out:st={max(0, d - fo):.3f}:d={fo},volume={a.get('gain', 1.0 if a.get('voice') else 0.5)},"
                      f"adelay={int(st * 1000)}|{int(st * 1000)}[a{k}]")
        voices.append(bool(a.get('voice')))
    os.makedirs(P(f'studio/export/{EP}'), exist_ok=True)
    out = P(f'studio/export/{EP}/Склейка_{time.strftime("%Y-%m-%d_%H-%M")}.mp4')
    if chains:
        vo = [k for k in range(len(chains)) if voices[k]]
        bed = [k for k in range(len(chains)) if not voices[k]]
        # loudnorm съедает хвост — добиваем тишиной до полной длины, иначе обрежется и видео
        tail = (f'atrim=0:{total:.3f},loudnorm=I=-19:TP=-1.5:LRA=14,aresample={SR},apad=whole_dur={total:.3f},atrim=0:{total:.3f},'
                f'afade=t=out:st={total - 1.5:.3f}:d=1.5,alimiter=limit=0.9[aout]')
        if vo and bed:  # музыка и шумы уходят вниз, пока говорят
            fca = ';'.join(chains) + (f";{''.join(f'[a{k}]' for k in vo)}amix=inputs={len(vo)}:normalize=0,asplit[vo][key]"
                                      f";{''.join(f'[a{k}]' for k in bed)}amix=inputs={len(bed)}:normalize=0[bed]"
                                      f";[bed][key]sidechaincompress=threshold=0.04:ratio=5:attack=30:release=500[duck]"
                                      f";[duck][vo]amix=inputs=2:normalize=0,{tail}")
        else:
            fca = ';'.join(chains) + f";{''.join(f'[a{k}]' for k in range(len(chains)))}amix=inputs={len(chains)}:normalize=0,{tail}"
        run([FF, '-loglevel', 'error', '-y', '-i', video, *ains, '-filter_complex', fca, '-map', '0:v', '-map', '[aout]',
             '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', f'{total:.3f}', out])
    else:
        shutil.copy(video, out)
    print('склейка:', os.path.relpath(out, ROOT), f'{total:.1f} с')
    json.dump({v['id']: round(starts[i], 2) for i, v in enumerate(V)}, open(os.path.join(tmp, '..', f'{EP}_starts.json'), 'w'))
    if '--preview' in A:
        pv = P(f'studio/media/{EP}/renders/{os.path.basename(out)}')
        os.makedirs(os.path.dirname(pv), exist_ok=True)
        run([FF, '-loglevel', 'error', '-y', '-i', out, '-vf', 'scale=1280:-2', '-c:v', 'libx264', '-crf', '23', '-preset', 'medium',
             '-c:a', 'aac', '-b:a', '160k', pv])
        print('превью:', os.path.relpath(pv, ROOT), f'{os.path.getsize(pv) / 1e6:.1f} МБ')
    shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
