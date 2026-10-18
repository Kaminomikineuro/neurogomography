"""Превиз для Seedance: серые блоки + ОДНО непрерывное движение камеры с постоянной скоростью.

Запуск:  python studio/tools/previs.py studio/canon/previs/<связка>.json
Нужен модуль bpy (pip install bpy) или Blender:  blender -b -P studio/tools/previs.py -- <план.json>

План (JSON, метры; X — вправо от главной камеры, Y — вглубь, Z — вверх):
{
  "out": "studio/media/s01e01/previs/C5.1",   # без расширения: будет .mp4 и _first.png
  "seconds": 13, "fps": 24, "size": [1280, 720], "lens": 35,
  "props": [ {"type": "mound", "at": [-25, 40], "r": 14, "h": 9},
             {"type": "box", "at": [30, 45, 0], "size": [6, 4, 8]},
             {"type": "stick", "at": [3, 6], "h": 1.2, "tilt": 20} ],
  "actors": [ {"id": "LORD", "height": 1.9, "shade": 0.18, "face": "+x", "sword": true,
               "keys": [[0, -1.0, 0], [5, -1.0, 0], [8, -1.6, 0]],      # [секунда, x, y]
               "crouch": [[0, 0], [8, 0.1]],                             # [секунда, доля приседа]
               "arm": [[0, 70], [2, 20], [9, 40], [10, 15]] } ],         # [секунда, угол руки с мечом]
  "camera": [ [0, [0, -6, 1.2]], [4.5, [2.5, -6.5, 1.1]], [13, [1.8, -3.2, 1.0]] ],
  "look": "actors"            # или точки [[секунда, [x, y, z]], ...]
}
Камера идёт по сглаженному пути с ПОСТОЯННОЙ скоростью (секунды у точек пути — только для порядка),
смотрит на середину между героями.
"""
import json, math, os, subprocess, sys, shutil, tempfile

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
PLAN = json.load(open(argv[0], encoding='utf-8'))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FPS = PLAN.get('fps', 24)
FRAMES = int(round(PLAN.get('seconds', 13) * FPS))


def interp(keys, t):
    """Плавная интерполяция по ключам [[секунда, значение...], ...] (smoothstep между ключами)."""
    if t <= keys[0][0]:
        return keys[0][1:]
    for a, b in zip(keys, keys[1:]):
        if a[0] <= t <= b[0]:
            u = (t - a[0]) / max(1e-6, b[0] - a[0])
            u = u * u * (3 - 2 * u)
            return [x + (y - x) * u for x, y in zip(a[1:], b[1:])]
    return keys[-1][1:]


# ---------- сцена ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene
scn.render.fps = FPS
scn.frame_start, scn.frame_end = 1, FRAMES
scn.render.resolution_x, scn.render.resolution_y = PLAN.get('size', [1280, 720])
scn.render.resolution_percentage = 100


def mat(shade):
    m = bpy.data.materials.new(f'grey{shade}')
    m.diffuse_color = (shade, shade, shade, 1)
    return m


def add(obj, shade):
    obj.data.materials.append(mat(shade))
    return obj


def cube(name, size, loc, shade, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = size
    if parent:
        o.parent = parent
    return add(o, shade)


def cyl(name, r, h, loc, shade, parent=None, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, location=loc, rotation=rot, vertices=16)
    o = bpy.context.object
    o.name = name
    if parent:
        o.parent = parent
    return add(o, shade)


def sphere(name, r, loc, shade, parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=16, ring_count=10)
    o = bpy.context.object
    o.name = name
    if parent:
        o.parent = parent
    return add(o, shade)


# земля
bpy.ops.mesh.primitive_plane_add(size=400, location=(0, 0, 0))
add(bpy.context.object, 0.55)

for p in PLAN.get('props', []):
    t = p['type']
    if t == 'mound':
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(p['at'][0], p['at'][1], 0), segments=24, ring_count=12)
        o = bpy.context.object
        o.scale = (p['r'], p['r'] * 0.8, p['h'])
        add(o, 0.38)
    elif t == 'box':
        cube('box', p['size'], (p['at'][0], p['at'][1], p['at'][2] + p['size'][2] / 2), p.get('shade', 0.45))
    elif t == 'stick':  # воткнутые мечи / древки
        a = math.radians(p.get('tilt', 15))
        cyl('stick', 0.03, p['h'], (p['at'][0], p['at'][1], p['h'] / 2 * math.cos(a)), 0.3, rot=(a, 0, p.get('turn', 0)))
    elif t == 'ridge':
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(p['at'][0], p['at'][1], 0), segments=24, ring_count=12)
        o = bpy.context.object
        o.scale = (p['len'], p.get('w', 8), p['h'])
        add(o, 0.48)


def face_of(a):
    """Куда смотрит герой: '+x', '-x', '+y', '-y' или угол в градусах (0 — вдоль +x, 90 — вдоль +y)."""
    f = a.get('face', '+x')
    if isinstance(f, (int, float)):
        return math.radians(f)
    return {'+x': 0, '-x': math.pi, '+y': math.pi / 2, '-y': -math.pi / 2}.get(f, 0)


# ---------- манекены из захвата движения (studio/tools/mocap.py) ----------
LIMBS = [('LeftUpLeg', 'LeftLeg', 0.07), ('LeftLeg', 'LeftFoot', 0.055), ('LeftFoot', 'LeftToeBase', 0.045),
         ('RightUpLeg', 'RightLeg', 0.07), ('RightLeg', 'RightFoot', 0.055), ('RightFoot', 'RightToeBase', 0.045),
         ('Hips', 'Spine1', 0.13), ('Spine1', 'Neck', 0.15), ('Neck', 'Head', 0.05),
         ('LeftArm', 'LeftForeArm', 0.045), ('LeftForeArm', 'LeftHand', 0.04),
         ('RightArm', 'RightForeArm', 0.045), ('RightForeArm', 'RightHand', 0.04),
         ('LeftArm', 'RightArm', 0.06), ('LeftUpLeg', 'RightUpLeg', 0.07)]
mocap_actors = []  # (план, имена, кадры×суставы×3, объекты)
if any('motion' in a for a in PLAN['actors']):
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import mocap


def stick(name, r, shade):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=1, vertices=12)
    o = bpy.context.object
    o.name = name
    o.rotation_mode = 'QUATERNION'
    return add(o, shade)


def place(o, p, q, f):
    d = Vector(q) - Vector(p)
    o.location = (Vector(p) + Vector(q)) / 2
    o.rotation_quaternion = d.to_track_quat('Z', 'Y')
    o.scale = (1, 1, max(1e-3, d.length))
    o.keyframe_insert('location', frame=f)
    o.keyframe_insert('rotation_quaternion', frame=f)
    o.keyframe_insert('scale', frame=f)


for a in [a for a in PLAN['actors'] if 'motion' in a]:
    H, sh = a.get('height', 1.8), a.get('shade', 0.5)
    face = face_of(a)
    names, parents, P = mocap.track(a['motion'], FRAMES, FPS, H, lambda t, a=a: interp(a['keys'], t), face)
    if a.get('lean'):  # ссутулиться вперёд, градусы
        mocap.lean(names, P, a['lean'])
    for r in a.get('reach', []):  # {"side": "Left", "at": 6.7, "to": 7.6, "target": "face"} — прикрыть глаза
        mocap.reach(names, P, FPS, r.get('side', 'Left'), r['at'], r['to'], r.get('target', 'face'))
    J = {n: i for i, n in enumerate(names)}
    objs = [(stick('limb', r * H / 1.8, sh), J[p], J[q]) for p, q, r in LIMBS]
    head = sphere('head', 0.115 * H / 1.8, (0, 0, 0), sh)
    blade = stick('sword', 0.022, min(1, sh + 0.25)) if a.get('sword') else None
    for f in range(FRAMES):
        p = P[f]
        for o, i, j in objs:
            place(o, p[i], p[j], f + 1)
        head.location = (p[J['Head']] + p[J['Head_end']]) / 2
        head.keyframe_insert('location', frame=f + 1)
        if blade:  # меч продолжает кисть
            grip = Vector(p[J['RightHandIndex1']])
            d = (grip - Vector(p[J['RightHand']])).normalized()
            place(blade, grip - d * 0.15, grip + d * a.get('blade', 0.95) * H / 1.8, f + 1)
    mocap_actors.append((a, names, P))


def joint(ref, f):
    """"LIAM:LeftToeBase" → где этот сустав в кадре f; "LORD:Head" — середина головы."""
    aid, jn = ref.split(':')
    for a, names, P in mocap_actors:
        if a['id'] == aid:
            if jn == 'Head':
                return Vector((P[f][names.index('Head')] + P[f][names.index('Head_end')]) / 2)
            return Vector(P[f][names.index(jn)])
    raise KeyError(ref)


# ---------- эффекты: облако пыли из-под ноги в лицо ----------
import random
for fx in PLAN.get('fx', []):
    rnd = random.Random(7)
    f0, f1 = int(fx['at'] * FPS), int((fx['at'] + fx.get('dur', 0.7)) * FPS)
    for k in range(fx.get('n', 16)):
        o = sphere('dust', 1, (0, 0, 0), fx.get('shade', 0.72))
        delay = rnd.uniform(0, 0.35) * (f1 - f0)
        spread = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-0.6, 0.5))) * fx.get('spread', 0.35)
        for f in range(max(1, f0 - 1), min(FRAMES, f1 + int(0.6 * FPS)) + 1):
            u = (f - f0 - delay) / max(1, (f1 - f0 - delay))
            if u <= 0:
                o.scale = (0, 0, 0)
                o.location = joint(fx['from'], f0)
            else:
                start, end = joint(fx['from'], f0), joint(fx['to'], min(FRAMES - 1, f))
                v = min(1.0, u)
                o.location = start.lerp(end, 1 - (1 - v) ** 2) + spread * v
                r = (0.04 + 0.16 * v) * (1 - max(0.0, u - 1) * 1.6)
                o.scale = (max(0, r),) * 3
            o.keyframe_insert('location', frame=f)
            o.keyframe_insert('scale', frame=f)

# ---------- манекены: простые анатомические блоки ----------
actors = []
for a in [a for a in PLAN['actors'] if 'motion' not in a]:
    H, sh = a.get('height', 1.8), a.get('shade', 0.5)
    k = H / 1.8
    root = bpy.data.objects.new(a['id'], None)
    scn.collection.objects.link(root)
    hips = bpy.data.objects.new(a['id'] + '_hips', None)  # то, что приседает
    scn.collection.objects.link(hips)
    hips.parent = root
    legs = []  # ноги крутятся от бедра: чем ниже присед, тем шире стойка, ступни на земле
    for side in (-1, 1):
        hip = bpy.data.objects.new(a['id'] + '_hip', None)
        scn.collection.objects.link(hip)
        hip.parent = hips
        hip.location = (0, side * 0.11 * k, 0.86 * k)
        cyl('leg', 0.075 * k, 0.86 * k, (0, 0, -0.43 * k), sh, hip)
        legs.append(hip)
    cube('pelvis', (0.22 * k, 0.32 * k, 0.16 * k), (0, 0, 0.92 * k), sh, hips)
    cube('torso', (0.24 * k, 0.40 * k, 0.52 * k), (0, 0, 1.24 * k), sh, hips)
    sphere('head', 0.115 * k, (0, 0, 1.64 * k), sh, hips)
    cyl('arm_l', 0.05 * k, 0.6 * k, (0, -0.25 * k, 1.2 * k), sh, hips)
    # правая рука с мечом вращается от плеча
    shoulder = bpy.data.objects.new(a['id'] + '_shoulder', None)
    scn.collection.objects.link(shoulder)
    shoulder.parent = hips
    shoulder.location = (0, 0.25 * k, 1.45 * k)
    cyl('arm_r', 0.05 * k, 0.6 * k, (0.3 * k, 0, 0), sh, shoulder, rot=(0, math.radians(90), 0))
    if a.get('sword'):
        cube('sword', (0.95 * k, 0.025, 0.06), (0.6 * k + 0.5 * k, 0, 0), min(1, sh + 0.25), shoulder)
    face = face_of(a)
    root.rotation_euler = (0, 0, face)
    actors.append((a, root, hips, shoulder, k, legs))

for f in range(1, FRAMES + 1):
    t = (f - 1) / FPS
    for a, root, hips, shoulder, k, legs in actors:
        x, y = interp(a['keys'], t)
        root.location = (x, y, 0)
        root.keyframe_insert('location', frame=f)
        c = interp(a.get('crouch', [[0, 0]]), t)[0]
        hips.location = (0, 0, -0.35 * k * c)
        hips.keyframe_insert('location', frame=f)
        spread = math.acos(min(1.0, (0.86 - 0.35 * c) / 0.86))
        for hip, sgn in zip(legs, (1, -1)):  # передняя нога вперёд, задняя назад
            hip.rotation_euler = (0, sgn * spread, 0)
            hip.keyframe_insert('rotation_euler', frame=f)
        ang = interp(a.get('arm', [[0, 30]]), t)[0]
        shoulder.rotation_euler = (0, -math.radians(ang), 0)
        shoulder.keyframe_insert('rotation_euler', frame=f)


# ---------- камера ----------
# "camera": один непрерывный путь с постоянной скоростью (для Seedance: одно движение без склеек);
# "cameraShots": кадры со склейками — у каждого своя камера: [{"from": 0, "to": 4, "pos": [x, y, z], "look": "LIAM:Head",
#   "pos2": [...], "look2": [...], "lens": 50}] — pos2/look2 — куда камера приходит к концу кадра (наезд, наклон).
def catmull(pts, n=400):
    P = [Vector(p) for p in pts]
    P = [P[0]] + P + [P[-1]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for s in range(n):
            u = s / n
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3))
    out.append(P[-2])
    return out


def point(v, f):
    """Точка взгляда: [x, y, z] или "ГЕРОЙ:сустав" (следит за суставом героя)."""
    return joint(v, min(FRAMES - 1, f)) if isinstance(v, str) else Vector(v)


cam_data = bpy.data.cameras.new('cam')
cam_data.lens = PLAN.get('lens', 35)
cam = bpy.data.objects.new('cam', cam_data)
scn.collection.objects.link(cam)
scn.camera = cam
if 'cameraShots' in PLAN:
    shots = sorted(PLAN['cameraShots'], key=lambda c: c['from'])
    prev, cur = None, None
    for f in range(1, FRAMES + 1):
        t = (f - 1) / FPS
        c = next((c for c in shots if c['from'] <= t < c['to']), shots[-1])
        u = min(1.0, max(0.0, (t - c['from']) / max(1e-6, c['to'] - c['from'])))
        u = u * u * (3 - 2 * u)
        pos = Vector(c['pos']).lerp(Vector(c.get('pos2', c['pos'])), u)
        tgt = point(c['look'], f - 1).lerp(point(c.get('look2', c['look']), f - 1), u)
        tgt = tgt if prev is None or c is not cur else prev.lerp(tgt, 0.2)  # внутри кадра — мягко; на склейке — сразу
        prev, cur = tgt, c
        cam.location = pos
        cam.rotation_euler = (tgt - pos).to_track_quat('-Z', 'Y').to_euler()
        cam_data.lens = c.get('lens', PLAN.get('lens', 35))
        cam.keyframe_insert('location', frame=f)
        cam.keyframe_insert('rotation_euler', frame=f)
        cam_data.keyframe_insert('lens', frame=f)
else:
    path = catmull([c[1] for c in PLAN['camera']])
    acc = [0.0]
    for a_, b_ in zip(path, path[1:]):
        acc.append(acc[-1] + (b_ - a_).length)
    L = acc[-1]

    def at_dist(d):
        lo, hi = 0, len(acc) - 1
        while lo < hi - 1:
            mid = (lo + hi) // 2
            if acc[mid] < d:
                lo = mid
            else:
                hi = mid
        seg = max(1e-9, acc[hi] - acc[lo])
        return path[lo].lerp(path[hi], (d - acc[lo]) / seg)

    look = PLAN.get('look', 'actors')
    look_z = PLAN.get('lookZ', 1.25)  # на какой высоте точка взгляда: ниже — горизонт выше в кадре
    prev = None
    for f in range(1, FRAMES + 1):
        t = (f - 1) / FPS
        cam.location = at_dist(L * (f - 1) / max(1, FRAMES - 1))
        if look == 'actors':
            pts = [Vector((*interp(a['keys'], t), look_z)) for a, *_ in actors]
            # камера смотрит туда, где герои стоят (keys), а не на каждое движение корпуса — иначе дрожит
            pts += [Vector((*interp(a['keys'], t), look_z)) for a, names, P in mocap_actors]
            tgt = sum(pts, Vector()) / len(pts)
        else:
            tgt = Vector(interp(look, t))
        tgt = tgt if prev is None else prev.lerp(tgt, 0.08)  # мягко, без рывков
        prev = tgt
        d = tgt - cam.location
        cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        cam.keyframe_insert('location', frame=f)
        cam.keyframe_insert('rotation_euler', frame=f)
for fc in (cam.animation_data.action.fcurves if hasattr(cam.animation_data.action, 'fcurves') else []):
    for kp in fc.keyframe_points:
        kp.interpolation = 'LINEAR'

# ---------- рендер: серый «solid», без текстур ----------
scn.render.engine = 'BLENDER_WORKBENCH'
sh = scn.display.shading
sh.light = 'STUDIO'
sh.color_type = 'MATERIAL'
sh.show_cavity = True
sh.show_object_outline = True
scn.world = bpy.data.worlds.new('w')
scn.world.color = (0.82, 0.82, 0.84)
sh.background_type = 'WORLD'

out = os.path.join(ROOT, PLAN['out'])
os.makedirs(os.path.dirname(out), exist_ok=True)
if '--still' in argv:  # быстрая проверка: только кадры на этих секундах, например --still 0 4 8 12.9
    scn.render.image_settings.file_format = 'PNG'
    for s in argv[argv.index('--still') + 1:]:
        scn.frame_set(min(FRAMES, int(float(s) * FPS) + 1))
        scn.render.filepath = f'{out}_t{s}.png'
        bpy.ops.render.render(write_still=True)
        print('кадр:', scn.render.filepath)
    sys.exit(0)
tmp = tempfile.mkdtemp()
scn.render.image_settings.file_format = 'PNG'
scn.render.filepath = os.path.join(tmp, 'f_')
bpy.ops.render.render(animation=True)
shutil.copy(os.path.join(tmp, 'f_0001.png'), out + '_first.png')
ff = shutil.which('ffmpeg')
if ff:
    subprocess.run([ff, '-loglevel', 'error', '-y', '-framerate', str(FPS), '-i', os.path.join(tmp, 'f_%04d.png'),
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', out + '.mp4'], check=True)
    print('превиз:', out + '.mp4')
else:
    print('ffmpeg не найден — кадры лежат в', tmp)
