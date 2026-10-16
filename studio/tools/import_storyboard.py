"""Импорт раскадровки (.md) в серию студии (data/episodes/<id>.json).

Повторный запуск не затирает работу: версии картинок, статусы и правки
из студии сохраняются, обновляются только тексты из раскадровки.
Запуск: python studio/tools/import_storyboard.py
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SB = os.path.join(ROOT, 'Аниме', '1 серия - демка', 'Серия_1-2_раскадровка_Т2_гл1.md')
ART = os.path.join(ROOT, 'Аниме', 'Карты и виды местности', 'Эльтарион', 'АРТ_Эльтарион_визуал_v1.md')
OUT = os.path.join(ROOT, 'studio', 'data', 'episodes')

# Локация по умолчанию для каждой сцены
SCENE_LOC = {0: None, 1: 'council', 2: 'hangar', 3: 'battlefield', 4: 'battlefield', 5: 'battlefield',
             6: 'battlefield-rift', 7: 'battlefield-rift', 8: 'battlefield-rift', 9: 'battlefield-rift',
             10: 'battlefield-rift', 11: 'battlefield', 12: 'battlefield', 13: 'forest-lake'}
COLD_OPEN_LOC = {'E1': 'desert', 'E2': 'east-coast', 'E3': 'desert-ridges', 'E4': 'capital', 'E5': 'castle',
                 'F1': 'desert-ridges', 'F2': 'desert', 'F3': 'akheop-fields'}
CHAR_TOKENS = ['LIAM', 'LORD', 'DRAGON', 'RUKH', 'LIAM SWORD', 'LORD SWORD']
TOOLS = ['Pixverse', 'Kling', 'Seedance']
# Персонажи без токена в раскадровке — узнаём по описанию
EXTRA_CHARS = [('ROY', r'young (drayk )?captain'), ('ARDAN', r'female (drayk )?commander'),
               ('BELFI', r'old (stooped )?(drayk )?general|old man'), ('KATNAR', r'boulder .*beast|tusks'),
               ('ZERR', r'horn-like ears'), ('AKHEOP', r'humanoid giants'), ('BASTIAN', r'commander seen from behind')]


def code(s):
    m = re.search(r'`([^`]*)`', s)
    return m.group(1).strip() if m else s.strip()


def parse_shot_block(sid, head, body):
    parts = [p.strip() for p in head.split('·')]
    shot = {'id': sid, 'dur': None, 'camera': '', 'tool': '', 'cut': '[можно вырезать]' in head or '[на усмотрение]' in head,
            'frame': '', 'sound': '', 'img': '', 'imgFrom': None, 'vid': ''}
    for p in parts[1:]:
        p2 = re.sub(r'\*\*\[.*?\]\*\*', '', p).strip()
        m = re.match(r'~?(\d+)\s*с', p2)
        if m:
            shot['dur'] = int(m.group(1))
        elif p2 in TOOLS:
            shot['tool'] = p2
        elif p2:
            shot['camera'] = (shot['camera'] + ' · ' + p2).strip(' ·')
    extra = []
    for line in body:
        s = line.strip()
        if not s or s == '---':
            continue
        if s.startswith('Кадр:'):
            shot['frame'] = s[5:].strip()
        elif s.startswith('Звук:'):
            shot['sound'] = s[5:].strip()
        elif s.startswith('IMG:'):
            v = s[4:].strip()
            m = re.match(r'=\s*кадр\s*([\d.]+)', v)
            if m:
                shot['imgFrom'] = m.group(1)
            else:
                shot['img'] = code(v)
        elif s.startswith('VID:'):
            shot['vid'] = code(s[4:])
        else:
            extra.append(s.strip('*'))
    if extra:
        shot['note'] = ' '.join(extra)
    txt = shot['img'] + ' ' + shot['vid']
    shot['characters'] = [t for t in CHAR_TOKENS if '[' + t + ']' in txt]
    for t, rx in EXTRA_CHARS:
        if re.search(rx, txt, re.I) and t not in shot['characters']:
            shot['characters'].append(t)
    if '@Image' in shot['vid']:
        for t, rx in (('LORD', r'Lord'), ('LIAM', r'Liam'), ('DRAGON', r'dragon')):
            if t not in shot['characters'] and re.search(r'@Image\d \(' + rx, shot['vid'], re.I):
                shot['characters'].append(t)
    return shot


def parse_storyboard():
    lines = open(SB, encoding='utf-8').read().split('\n')
    scenes, cur, sid, head, body = [], None, None, None, []

    def flush():
        nonlocal sid, head, body
        if sid and cur is not None:
            cur['shots'].append(parse_shot_block(sid, head, body))
        sid, head, body = None, None, []

    for line in lines:
        m = re.match(r'^## СЦЕНА (\d+)\. (.+?) · ~(\d+) с', line)
        if m:
            flush()
            n = int(m.group(1))
            cur = {'n': n, 'title': m.group(2).strip(), 'dur': int(m.group(3)), 'location': SCENE_LOC.get(n), 'shots': []}
            scenes.append(cur)
            continue
        if re.match(r'^## \d\. ', line) or line.startswith('# СЕРИЯ'):
            flush(); cur = None if not line.startswith('# СЕРИЯ') else cur
            continue
        m = re.match(r'^\*\*(\d+\.\d+)\*\*(.*)$', line)
        if m and cur is not None:
            flush()
            sid, head = m.group(1), m.group(1) + m.group(2)
            continue
        if sid:
            body.append(line)
    flush()
    return scenes


def parse_cold_open():
    text = open(ART, encoding='utf-8').read()
    shots = {}
    for m in re.finditer(r'^\*\*(?:\[по желанию\] )?([EF][\w-]*)(?:\. [^*]+)?\*\*(.*?)\n(.*?)(?=^\*\*|^## |\Z)', text, re.M | re.S):
        sid = m.group(1)
        if sid in ('E6', 'E-поля'):
            continue
        s = parse_shot_block(sid, sid + m.group(2), m.group(3).split('\n'))
        s['location'] = COLD_OPEN_LOC.get(sid)
        shots[sid] = s
    order = ['E1', 'F1', 'F2', 'E2', 'E3', 'F3', 'E4', 'E5']
    return {'n': 0, 'title': 'Холодное открытие', 'dur': 40, 'location': None,
            'note': 'Заменяет кадр 1.1. Источник: АРТ_Эльтарион_визуал_v1.md, разделы 6 и 8.',
            'shots': [shots[k] for k in order if k in shots]}


EXISTING = {  # уже нарисованные картинки → кадры
    'E1': 'Бескрайняя красная пустыня под алым солнцем.png',
    'E2': 'Алый утёс над чёрным морем.png',
    'E3': 'Дальний подлёт к краснокаменной столице.png',
    'E4': 'Столица, высеченная в багровой скале.png',
    'E5': 'Вершинный дворец в алой скале.png',
    'F1': 'Каменный зверь на красном хребте.png',
    'F2': 'Зерр выходит из красных песков.png',
    'F3': 'Тихая пахота акхеопов в красной долине.png',
}


def merge(old, new):
    """Тексты берём из раскадровки, а работу студии — из старого файла."""
    if not old:
        return new
    keep = {s['id']: s for sc in old['scenes'] for s in sc['shots']}
    for sc in new['scenes']:
        for s in sc['shots']:
            o = keep.get(s['id'])
            if not o:
                continue
            for k in ('versions', 'selected', 'status', 'history', 'location', 'characters', 'img', 'vid', 'locked'):
                if k in o:
                    s[k] = o[k]
    return new


def main():
    scenes = [parse_cold_open()] + parse_storyboard()
    ep1 = [s for s in scenes if s['n'] <= 7]
    ep2 = [s for s in scenes if s['n'] >= 8]
    for sc in scenes:
        for s in sc['shots']:
            s.setdefault('location', None)
            s.setdefault('status', 'todo')
            s.setdefault('versions', [])
            s.setdefault('selected', None)
            if s['id'] == '1.1':
                s['cut'] = True
                s['note'] = 'Заменён холодным открытием (сцена 0).'
    for sc in ep1:
        if sc['n'] == 0:
            for s in sc['shots']:
                if s['id'] in EXISTING:
                    s['versions'] = [{'file': 'Аниме/1 серия - демка/' + EXISTING[s['id']], 'by': 'импорт',
                                      'note': 'Нарисовано до студии', 'at': '2026-10-16'}]
                    s['selected'] = 0
                    s['status'] = 'review'
    for eid, title, sc, flag in (('s01e01', 'Серия 1 — «Это Грань?»', ep1, 'Финал на реплике «Это Грань?», затем чёрный экран.'),
                                 ('s01e02', 'Серия 2 — продолжение Т2 гл.1', ep2, 'Спина к спине → Приказ Лорда → дракон → лес у озера.')):
        path = os.path.join(OUT, eid + '.json')
        old = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else None
        ep = {'id': eid, 'title': title, 'source': 'Т2, гл. 1 «Это Грань?»', 'note': flag,
              'storyboard': 'Аниме/1 серия - демка/Серия_1-2_раскадровка_Т2_гл1.md',
              'chapter': 'studio/canon/book/Т2-01 Это Грань.txt', 'scenes': sc}
        ep = merge(old, ep)
        json.dump(ep, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        n = sum(len(s['shots']) for s in sc)
        print(eid, len(sc), 'сцен,', n, 'кадров')


if __name__ == '__main__':
    main()
