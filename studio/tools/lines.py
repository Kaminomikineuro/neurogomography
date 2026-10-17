"""Реплики кадров: разбор поля «Звук», режим губ и сверка с текстом главы.

Запуск: python studio/tools/lines.py  — дополняет кадры полем lines и пишет отчёт
studio/canon/Реплики_Т2-01.md. Уже отредактированные в студии реплики не трогает.
        python studio/tools/lines.py s01e03 s01e04 — любые серии: глава берётся из поля chapter серии,
отчёт — studio/canon/Реплики_<серия>.md.
"""
import json, os, re, sys, difflib

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CHAPTER = os.path.join(ROOT, 'studio', 'canon', 'book', 'Т2-01 Это Грань.txt')
NAMES = {'Лиам': 'LIAM', 'Повелитель': 'LORD', 'Рой': 'ROY', 'Ардан': 'ARDAN', 'Бельфи': 'BELFI', 'Бастиан': 'BASTIAN'}
# голос есть, губ в кадре нет: вставки-иллюстрации и реплики из-за кадра
OFFSCREEN = {('8.4', 'LIAM'), ('8.8', 'LIAM'), ('1.14', 'ROY')}
CPS = 13  # русская речь ≈ 13 знаков в секунду

norm = lambda s: re.sub(r'[^а-яa-z0-9 ]', '', s.lower().replace('ё', 'е')).strip()
book = nbook = ''
pieces, npieces = [], []


def load_book(chapter):
    global book, nbook, pieces, npieces
    book = re.sub(r'\s+', ' ', open(chapter, encoding='utf-8').read())
    nbook = norm(book)
    # книга, разбитая на фразы: реплики сверяем с отрезками из 1–4 соседних фраз
    pieces = [x.strip(' ,—') for x in re.split(r'(?<=[.!?…»])\s+|\s+—\s+|[«»]', book) if len(x.strip(' ,—')) > 1]
    npieces = [norm(x) for x in pieces]


def load_names():
    # «Лиам» → LIAM: имена героев из project.json, первое слово имени
    try:
        pr = json.load(open(os.path.join(ROOT, 'studio', 'data', 'project.json'), encoding='utf-8'))
        for c in pr.get('characters', []):
            first = re.split(r'[\s(«]', c.get('name', ''))[0]
            if first and first[0].isupper() and first not in NAMES:
                NAMES[first] = c['id']
    except Exception:
        pass


def book_match(text):
    n = norm(text)
    if len(n) < 10:
        return 'short', None  # «Да», «Ага», «Мало» — по книге не проверить, слишком коротко
    if n in nbook:
        return 'book', None
    # реплику в книге часто разрывают авторские слова («— …, — сказал он. — …»): сверяем по предложениям
    sents = [norm(x) for x in re.split(r'(?<=[.!?…])\s+', text) if len(norm(x)) > 2]
    if sents and all(x in nbook for x in sents):
        return 'book', None
    best, frag = 0, None
    for i in range(len(pieces)):
        for k in range(1, 5):
            cand = ' '.join(npieces[i:i + k])
            if abs(len(cand) - len(n)) > len(n) * 0.6 + 10:
                continue
            r = difflib.SequenceMatcher(None, n, cand).ratio()
            if r > best:
                best, frag = r, ' '.join(pieces[i:i + k])
    if best >= 0.62:
        return 'changed', frag
    return 'absent', None


def parse(sound, chars):
    out = []
    pos = 0
    last = None
    for m in re.finditer(r'(?:(VO[^:«]*?|[А-ЯЁ][а-яё]+(?: \([^)]*\))?|Затем)\s*:\s*)?«([^»]+)»', sound):
        who_raw, text = (m.group(1) or '').strip(), m.group(2).strip()
        if not who_raw and last and last['mode'] == 'vo':
            who, mode = last['who'], 'vo'  # «…» сразу после мыслей — это тоже мысли
        elif who_raw.startswith('VO'):
            who = 'LIAM' if 'Лиам' in who_raw else 'NARRATOR'
            mode = 'vo'
        elif who_raw == 'Затем' and last:
            who, mode = last['who'], last['mode']
        elif who_raw:
            name = who_raw.split(' ')[0]
            who, mode = NAMES.get(name, name), 'lips'
        else:
            # безымянная реплика в перепалке: говорит «другой» из кадра
            prev = last['who'] if last else None
            others = [c for c in chars if c in NAMES.values() and c != prev]
            who, mode = (others[0] if others else prev), 'lips'
        manner = re.search(r'\(([^)]*)\)', who_raw)
        if manner and 'за кадром' in manner.group(1):
            mode = 'offscreen'
            manner = None
        line = {'who': who, 'text': text, 'mode': mode}
        if manner and not who_raw.startswith('VO'):
            line['manner'] = manner.group(1)
        if 'на усмотрение' in who_raw:
            line['optional'] = True
        out.append(line)
        last = line
    return out


def main():
    load_names()
    eps = sys.argv[1:] or ['s01e01', 's01e02']
    first = json.load(open(os.path.join(ROOT, 'studio', 'data', 'episodes', eps[0] + '.json'), encoding='utf-8'))
    chapter = os.path.join(ROOT, first['chapter']) if sys.argv[1:] and first.get('chapter') else CHAPTER
    load_book(chapter)
    rep = [f'# Реплики: {", ".join(eps)}', '',
           f'Сверка с `{os.path.relpath(chapter, ROOT)}`.', '',
           'Режим: **губы** — герой в кадре говорит (нужен липсинк), **за кадром** — голос без губ, **VO** — мысли/рассказчик.', '',
           '| Кадр | с | Кто | Режим | Реплика | Длит. речи | Книга |', '|---|---|---|---|---|---|---|']
    for ep in eps:
        p = os.path.join(ROOT, 'studio', 'data', 'episodes', ep + '.json')
        e = json.load(open(p, encoding='utf-8'))
        for sc in e['scenes']:
            for s in sc['shots']:
                # «Звук» в раскадровке поменялся, а руками реплики не правили — разбираем заново
                if 'lines' in s and s.get('linesFrom') != s.get('sound') and not any(l.get('src') == 'edited' for l in s['lines']):
                    del s['lines']
                if 'lines' not in s:
                    s['linesFrom'] = s.get('sound')
                    s['lines'] = parse(s.get('sound') or '', s.get('characters') or [])
                    for l in s['lines']:
                        if (s['id'], l['who']) in OFFSCREEN and l['mode'] == 'lips':
                            l['mode'] = 'offscreen'
                # сверку с книгой обновляем всегда, кроме реплик, исправленных вручную
                for l in s['lines']:
                    if l['who'] == 'NARRATOR' or l.get('src') == 'edited':
                        continue
                    src, frag = book_match(l['text'])
                    l['src'] = src
                    l.pop('book', None)
                    if frag:
                        l['book'] = frag
                for l in s['lines']:
                    secs = len(l['text']) / CPS
                    flag = ' ⚠' if l['mode'] == 'lips' and s.get('dur') and secs > s['dur'] else ''
                    src = {'book': '✓ дословно', 'changed': '≈ отличается', 'absent': '— нет в тексте', 'short': '· короткая'}.get(l.get('src'), 'рассказчик')
                    mode = {'lips': 'губы', 'offscreen': 'за кадром', 'vo': 'VO'}[l['mode']]
                    rep.append(f"| {s['id']} | {s.get('dur') or ''} | {l['who']} | {mode} | {l['text']} | {secs:.1f} с{flag} | {src} |")
                    if l.get('book'):
                        rep.append(f"| | | | | *в книге:* {l['book'][:300]} | | |")
        json.dump(e, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    out = os.path.join(ROOT, 'studio', 'canon', 'Реплики_Т2-01.md' if not sys.argv[1:] else f'Реплики_{"_".join(eps)}.md')
    open(out, 'w', encoding='utf-8').write('\n'.join(rep) + '\n')
    print('\n'.join(rep))


if __name__ == '__main__':
    main()
