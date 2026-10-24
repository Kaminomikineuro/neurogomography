"""Доводка готового монтажа автора (CapCut и т. п.): монтаж и звук не трогаются, сверху — название, затемнения,
громкость, 1080p и по желанию аниме-фильтр.

Запуск:  python studio/tools/polish.py "<видео>" [--title 3.15-6.0] [--glow] [--out <файл.mp4>]
  --title от-до   когда виден титр «Хроники рода Эльтар / Белая кровь / Серия 1 · Это Грань?» (секунды)
  --glow          аниме-фильтр: мягкое свечение светлых мест, чуть сочнее цвет, чётче линии
  --fadein 0.8 --fadeout 1.2   затемнения в начале и в конце
  --delogo x:y:w:h   затереть значок редактора (у CapCut в 720p: 30:32:50:42)
Звук: ровная громкость −16 LUFS без перегруза (пики не выше −1.5 dB), сам звук не меняется.
"""
import json, os, re, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
A = sys.argv[1:]
opt = lambda k, d=None: A[A.index(k) + 1] if k in A and A.index(k) + 1 < len(A) else d
FF = shutil.which('ffmpeg') or 'ffmpeg'
P = lambda r: os.path.join(ROOT, *r.split('/'))
W, H = 1920, 1080
LINES = ['Хроники рода Эльтар', 'Белая кровь', 'Серия 1 · Это Грань?']
FONTS = [P(f'studio/assets/fonts/CormorantSC-{w}.ttf') for w in ('SemiBold', 'Bold', 'SemiBold')]


def esc(t):
    return t.replace('\\', '\\\\').replace(':', '\\:').replace("'", "’").replace('%', '\\%')


def ffpath(f):
    return f.replace('\\', '/').replace(':', '\\:')


def titles(t0, t1):
    """Три строки: мелкая с разрядкой, крупное название, номер серии; тёмная обводка вместо затемнения кадра."""
    sizes = [int(H * 0.032), int(H * 0.110), int(H * 0.044)]
    ys = ['h*0.335', 'h*0.395', 'h*0.555']
    colors = ['0xD9B98A', '0xF6EBDD', '0xE8D6BC']
    spacing = (2, 1, 0)
    out = []
    for i, t in enumerate(LINES):
        text = (' ' * spacing[i]).join(t) if spacing[i] else t
        out.append(f"drawtext=fontfile='{ffpath(FONTS[i])}':text='{esc(text)}':fontcolor={colors[i]}:fontsize={sizes[i]}"
                   f":x=(w-text_w)/2:y={ys[i]}:borderw={(3, 4, 3)[i]}:bordercolor=0x1a0606@0.8:shadowcolor=0x000000@0.7:shadowx=3:shadowy=3"
                   f":alpha='min(1,max(0,(t-{t0 + 0.3 * i})/0.6))*min(1,max(0,({t1}-t)/0.6))'")
    return ','.join(out)


def duration(path):
    out = subprocess.run([shutil.which('ffprobe') or 'ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
                         capture_output=True, text=True).stdout
    return float(out)


def loudness(path):
    """Первый проход loudnorm: замер, чтобы второй выровнял громкость одним линейным сдвигом (без «качания»)."""
    err = subprocess.run([FF, '-hide_banner', '-nostats', '-i', path, '-vn', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json',
                          '-f', 'null', '-'], capture_output=True, text=True).stderr
    return json.loads(err[err.rindex('{'):err.rindex('}') + 1])


def main():
    src = A[0]
    d = duration(src)
    fin, fout = float(opt('--fadein', 0.8)), float(opt('--fadeout', 1.2))
    vf = ''
    if opt('--delogo'):  # значок редактора (CapCut и т. п.): x:y:w:h в пикселях исходника
        x, y, w, h = opt('--delogo').split(':')
        vf = f'delogo=x={x}:y={y}:w={w}:h={h},'
    vf += f'scale={W}:{H}:flags=lanczos:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,setsar=1'
    if '--glow' in A:
        # свечение как в аниме-композитинге: размытая копия кладётся «экраном» поверх, светлое мягко светится
        vf += (',format=gbrp,split[a][b];[b]gblur=sigma=14[g];[a][g]blend=all_mode=screen:all_opacity=0.16,'
               'format=yuv420p,eq=saturation=1.08:contrast=1.03,unsharp=5:5:0.35')
    if opt('--title'):
        t0, t1 = map(float, opt('--title').split('-'))
        vf += ',' + titles(t0, t1)
    vf += f',fade=t=in:d={fin},fade=t=out:st={d - fout:.3f}:d={fout}'
    m = loudness(src)
    af = (f"loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
          f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,aresample=48000,"
          f"afade=t=in:d={min(fin, 0.5)},afade=t=out:st={d - fout:.3f}:d={fout}")
    out = opt('--out') or os.path.splitext(src)[0] + ('_glow' if '--glow' in A else '') + '_1080p.mp4'
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    subprocess.run([FF, '-loglevel', 'error', '-y', '-i', src, '-vf', vf, '-af', af, '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
                    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out], check=True)
    print('готово:', os.path.relpath(out, ROOT), f'{os.path.getsize(out) / 1e6:.1f} МБ')


if __name__ == '__main__':
    main()
