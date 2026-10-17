"""Движения из захвата движения (база CMU, свободная лицензия) для превиза.

Файлы BVH качаются сами в studio/media/mocap/ (в git не идут).
Кусок движения в плане героя:
  {"bvh": "02_07", "from": 2.3, "to": 3.7, "at": 0.0,   # секунды в записи → секунда в ролике
   "speed": 1.0, "reverse": false,                     # скорость, проиграть задом наперёд
   "lock": 1.0,                                        # 1 — стоит на месте (ходит по keys), 0 — идёт как в записи
   "amp": 1.0, "rest": 2.3,                            # <1 — движения мельче, вокруг позы на секунде rest (по умолчанию from)
   "turn": 0, "blend": 0.25,                           # доворот в градусах, плавный переход от прошлого куска
   "faceLock": 1.0,                                    # 1 — не даём актёру записи постепенно отвернуться
   "faceBy": "hips"}                                   # "hand" — «вперёд» там, куда в среднем смотрит рука с мечом (для боя)
Между кусками герой держит последнюю позу.
"""
import math, os, urllib.request
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CACHE = os.path.join(ROOT, 'studio', 'media', 'mocap')
URL = 'https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/{s:03d}/{n}.bvh'
_files = {}


def fetch(name):
    path = os.path.join(CACHE, name + '.bvh')
    if not os.path.exists(path):
        os.makedirs(CACHE, exist_ok=True)
        url = URL.format(s=int(name.split('_')[0]), n=name)
        print('качаю', url)
        urllib.request.urlretrieve(url, path)
    return path


def _rot(axis, deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    if axis == 'X':
        return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
    if axis == 'Y':
        return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def load(name):
    """BVH → имена суставов, родители, позиции суставов (кадры × суставы × 3) в метрах, Z вверх, рост ~1 м, fps."""
    if name in _files:
        return _files[name]
    lines = open(fetch(name)).read().split('\n')
    names, parents, offsets, chans = [], [], [], []
    stack, i = [], 0
    while not lines[i].strip().startswith('MOTION'):
        w = lines[i].split()
        if w and w[0] in ('ROOT', 'JOINT', 'End'):
            names.append(w[1] if w[0] != 'End' else names[stack[-1]] + '_end')
            parents.append(stack[-1] if stack else -1)
            offsets.append(None)
            chans.append([])
            cur = len(names) - 1
        elif w and w[0] == '{':
            stack.append(cur)
        elif w and w[0] == '}':
            stack.pop()
        elif w and w[0] == 'OFFSET':
            offsets[cur] = [float(x) for x in w[1:4]]
        elif w and w[0] == 'CHANNELS':
            chans[cur] = w[2:]
        i += 1
    dt = float(lines[i + 2].split()[-1])
    data = np.array([[float(x) for x in l.split()] for l in lines[i + 3:] if l.strip()])
    J, F = len(names), len(data)
    pos = np.zeros((F, J, 3))
    for f in range(F):
        row, k = data[f], 0
        world = [None] * J
        for j in range(J):
            R, t = np.eye(3), np.array(offsets[j])
            for c in chans[j]:
                if c.endswith('position'):
                    t = t + np.array([row[k] if c[0] == a else 0 for a in 'XYZ'])
                else:
                    R = R @ _rot(c[0], row[k])
                k += 1
            if parents[j] < 0:
                world[j] = (R, t)
            else:
                PR, Pt = world[parents[j]]
                world[j] = (PR @ R, Pt + PR @ t)
            pos[f, j] = world[j][1]
    pos = pos[:, :, [0, 2, 1]] * np.array([1, -1, 1])  # Y-вверх → Z-вверх
    t0 = pos[0]  # первый кадр CMU — стойка: по ней рост и земля
    feet = min(t0[names.index(n), 2] for n in ('LeftToeBase', 'RightToeBase'))
    pos = (pos - [0, 0, feet]) / (t0[names.index('Head_end'), 2] - feet)
    _files[name] = (names, parents, pos, 1.0 / dt)
    return _files[name]


def facing(names, p):
    """Куда смотрит грудь: перпендикуляр к линии бёдер (угол в плоскости XY)."""
    lat = p[names.index('LeftUpLeg')] - p[names.index('RightUpLeg')]
    return math.atan2(-lat[0], lat[1])  # вперёд = линия бёдер, повёрнутая на 90° по часовой


def _smooth_facing(name):
    names, parents, pos, fps = load(name)
    lat = pos[:, names.index('LeftUpLeg')] - pos[:, names.index('RightUpLeg')]
    a = np.unwrap(np.arctan2(-lat[:, 0], lat[:, 1]))
    k = max(1, int(fps))  # среднее за секунду: убираем только медленный разворот, не повороты корпуса в ударе
    pad = np.pad(a, k, mode='edge')
    return np.convolve(pad, np.ones(2 * k + 1) / (2 * k + 1), mode='same')[k:-k]


def _fix_lengths(p, parents, lengths):
    out = p.copy()
    for j, pa in enumerate(parents):
        if pa >= 0:
            d = p[j] - p[pa]
            n = np.linalg.norm(d)
            out[j] = out[pa] + (d / n * lengths[j] if n > 1e-6 else 0)
    return out


def track(segments, frames, fps, height, base_xy, face):
    """Позиции суставов героя на каждый кадр ролика. base_xy(t) — где стоит (keys), face — угол взгляда (рад)."""
    xy = base_xy
    base_xy = lambda t: np.array(xy(t), float)
    segments = sorted(segments, key=lambda s: s['at'])
    names, parents, pos0, _ = load(segments[0]['bvh'])
    lengths = [0 if q < 0 else np.linalg.norm(pos0[0, j] - pos0[0, q]) * height for j, q in enumerate(parents)]
    hip = names.index('Hips')

    def player(seg):
        """Поза куска на кадре ролика f; за концом куска запись идёт дальше — для плавного перехода."""
        _, _, pos, sfps = load(seg['bvh'])
        a, b, speed, rev = seg['from'], seg['to'], seg.get('speed', 1.0), seg.get('reverse')
        f_start = int(round(seg['at'] * fps))
        src0 = pos[int((b if rev else a) * sfps)]
        if seg.get('faceBy') == 'hand':
            i0, i1 = sorted((int(a * sfps), int(b * sfps)))
            v = (pos[i0:i1, names.index('RightHand'), :2] - pos[i0:i1, hip, :2]).mean(0)
            src_face = math.atan2(v[1], v[0])
        else:
            src_face = facing(names, src0)
        turn = face - src_face + math.radians(seg.get('turn', 0))
        Rz = np.array([[math.cos(turn), -math.sin(turn), 0], [math.sin(turn), math.cos(turn), 0], [0, 0, 1]])
        lock, amp = seg.get('lock', 1.0), seg.get('amp', 1.0)
        rest = pos[int(seg.get('rest', a) * sfps)]
        fs, flock = _smooth_facing(seg['bvh']), seg.get('faceLock', 1.0)
        i0 = int((b if rev else a) * sfps)

        def pose(f):
            u = (f - f_start) / fps * speed
            st = b - u if rev else a + u
            x = min(len(pos) - 1.001, max(0.0, st * sfps))
            i = int(x)
            p = pos[i] + (pos[i + 1] - pos[i]) * (x - i)  # между кадрами записи — плавно
            c = flock * (fs[i0] - fs[i])
            if c:
                h = p[hip, :2].copy()
                R2 = np.array([[math.cos(c), -math.sin(c)], [math.sin(c), math.cos(c)]])
                p[:, :2] = (p[:, :2] - h) @ R2.T + h
            if amp != 1:
                r = rest.copy()
                r[:, :2] += p[hip, :2] - r[hip, :2]
                p = r + amp * (p - r)
            root = p[hip].copy()
            p[:, :2] -= src0[hip, :2] + lock * (root[:2] - src0[hip, :2])
            p = p @ Rz.T * height
            p[:, :2] += base_xy(f / fps)
            return p
        return f_start, min(frames, f_start + int(round((b - a) / speed * fps))), pose

    out = np.zeros((frames, len(names), 3))
    prev = None  # (конец прошлого куска, его поза)
    for seg in segments:
        f_start, f_end, pose = player(seg)
        blend = max(1, seg.get('blend', 0.25) * fps)
        if prev and prev[0] >= f_start - 1:
            src = prev[1]  # куски стык в стык: прошлое движение продолжается и перетекает в новое
        elif prev:
            last, at = prev[1](prev[0] - 1), prev[0] - 1  # был перерыв — герой держал последнюю позу
            src = lambda f, last=last, at=at: last + np.r_[base_xy(f / fps) - base_xy(at / fps), 0]
        else:
            src = None
        for f in range(f_start, f_end):
            p = pose(f)
            w = min(1.0, (f - f_start) / blend) if src else 1.0
            if w < 1:
                q = src(f)
                p = q + (p - q) * (w * w * (3 - 2 * w))
            out[f] = _fix_lengths(p, parents, lengths)
        prev = (f_end, pose)
        last = out[f_end - 1].copy()
        for f in range(f_end, frames):  # держим последнюю позу до следующего куска
            out[f] = last
            out[f, :, :2] += base_xy(f / fps) - base_xy((f_end - 1) / fps)
    f0 = int(round(segments[0]['at'] * fps))
    out[:f0] = out[f0]  # до первого куска — его первая поза
    return names, parents, out


def reach(names, P, fps, side='Left', at=0.0, to=1.0, target='face', ramp=0.2):
    """Рука тянется к цели (прикрыть глаза): двухзвенный IK плечо–локоть–кисть, плавно входит и выходит."""
    J = {n: i for i, n in enumerate(names)}
    S, E, W = J[side + 'Arm'], J[side + 'ForeArm'], J[side + 'Hand']
    hand = [j for j, n in enumerate(names) if n.startswith(side + 'Hand') or n.startswith(side[0] + 'Thumb') or n.startswith(side + 'Finger')]
    for f in range(int(at * fps), min(len(P), int(to * fps) + 1)):
        t = f / fps
        w = min(1.0, (t - at) / ramp, (to - t) / ramp)
        w = w * w * (3 - 2 * w)
        p = P[f]
        lat = p[J['LeftUpLeg']] - p[J['RightUpLeg']]
        fwd = np.array([lat[1], -lat[0], 0.0]) / max(1e-6, np.hypot(lat[0], lat[1]))
        T = (p[J['Head']] + p[J['Head_end']]) / 2 + fwd * 0.12 if target == 'face' else np.array(target, float)
        L1, L2 = np.linalg.norm(p[E] - p[S]), np.linalg.norm(p[W] - p[E])
        d = T - p[S]
        dist = min(np.linalg.norm(d), L1 + L2 - 1e-3)
        n = d / max(1e-6, np.linalg.norm(d))
        a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist)
        h = math.sqrt(max(0.0, L1 * L1 - a * a))
        pole = np.array([0, 0, -1.0]) - n * n[2]  # локоть вниз
        pole /= max(1e-6, np.linalg.norm(pole))
        e2, w2 = p[S] + n * a + pole * h, p[S] + n * dist
        shift = w2 - p[W]
        p[E] = p[E] + (e2 - p[E]) * w
        for j in hand:
            p[j] = p[j] + shift * w
    return P
