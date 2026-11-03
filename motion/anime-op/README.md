# «Хроники рода Эльтар — Белая кровь» · аниме-опенинг

20 с · 1920×1080 · 30 fps · 150 BPM · стиль «Аниме-опенинг / манга-панели» (стиль 22 скилла `motion-design`).
Собран кодом из карт персонажей книги: каждый кадр — функция времени `renderAt(t)` в `index.html`.

Готовый ролик: `release/belaya-krov-opening.mp4`, постер: `release/poster.png`.

## Раскадровка (каждая склейка — на такт музыки)

| Время | Сцена | Персонажи / ассеты |
|---|---|---|
| 0.0–0.8 | Капля белой крови падает, всплеск, раскрывается символ рода Эльтар | `emblem` |
| 0.8–2.4 | Ирис-переход в красную пустыню, титр «ЭЛЬТАРИОН · Красные пески» | `bg_desert` |
| 2.4–4.0 | Лиам со спины, камера ускоряется, ветер, белая вспышка | `liam_back` |
| **4.0** | **Drop.** Лиам Эльтар — диагональная манга-панель, линии фокуса, имя | `liam_profile` |
| 5.6–7.2 | Чернильный вайп → Повелитель драконов, удар-наезд на 6.4 | `lord_face` |
| 7.2–8.8 | Триптих по долям: Диана Эльтар, Меф, Циан | `diana`, `meph`, `cyan` |
| 8.8–10.4 | Карты персонажей «шлёпаются» по долям: Себастьян, Крис, Нокс, Аластор | `sebastian`, `kris`, `nox`, `alastor` |
| 10.4–12.0 | Мир: Зерр в красных песках → Рух над столицей | `bg_zerr`, `bg_capital`, `rukh_fly` |
| 12.0–13.6 | Буря гасит красное солнце, молнии, проходит Мрак, голова дракона с синим пламенем | `bg_cliff`, `dragon_fly`, `dragon_head` |
| **13.6** | **Hero (68 %).** Клэш Лиам × Повелитель: раскол кадра, инверсия, искры | `liam_back` (зеркально), `lord_face` |
| 14.4–15.2 | Белая кровь стекает по мечу Лиама и срывается каплей | `sword` |
| 15.2–20.0 | Логотип «Белая Кровь», световой проход, «ХРОНИКИ РОДА ЭЛЬТАР», угли | `logo`, `emblem` |

## Пересборка

```bash
# 1. ассеты из карт (кропы + вырезки с альфой)
python3 motion/anime-op/tools/prep_assets.py
# 2. звук (mgaudio из mg-styles-15; без него — упрощённый звук из скилла)
git clone --depth 1 https://github.com/Vincentwei1021/mg-styles-15 ../mg-styles-15
pip install numpy scipy soundfile numba pedalboard pyloudnorm matplotlib
MGAUDIO=../mg-styles-15/lib/audio python3 motion/anime-op/audio.py
# 3. картинка + сведение, проверка
node .claude/skills/motion-design/scripts/render.mjs motion/anime-op --stills 4.3,7.9,13.75,17.5
node .claude/skills/motion-design/scripts/render.mjs motion/anime-op --mb 2 --workers 4 --crf 17
bash .claude/skills/motion-design/scripts/qc.sh motion/anime-op/out/video.mp4 20 1920x1080 30
```
Тайминг всех сцен и звуков — в `cues.json`: сдвинул число — сдвинулись и картинка, и звук.
