# Звук: музыка, SFX, синхронизация, мастеринг

Половина впечатления от моушена — звук. В mg-styles-15 весь звук тоже написан кодом (Python-синтез + CC0-сэмплы)
и привязан к тому же cue sheet, что и картинка. Рубрика оценивает его отдельной осью `sound_sync`.

## 1. Два инструмента

| | `scripts/audio_kit.py` (в скилле) | **mgaudio** (mg-styles-15, `lib/audio`) |
|---|---|---|
| Зависимости | numpy + ffmpeg | numpy, numba, pedalboard, pyloudnorm, librosa… + 103 CC0-сэмпла |
| Музыка | эмбиент-пэд, пульс (бочка/хэт), чиптюн | 15 жанровых рецептов с формой intro/build/drop/outro, аккордами, барабанами |
| SFX | ~20 базовых (whoosh, riser, impact, pop, shimmer, chime, pen, glitch, HUD…) | ~100 (жидкость, бумага, ретро-медиа, HUD, 8-bit, мультяшные, восточные инструменты) |
| Когда | быстрый старт, черновики, минималистичный звук | финальный продакшн, жанровая музыка |

```bash
# быстрый путь
python3 .claude/skills/motion-design/scripts/audio_kit.py motion/<slug>/cues.json motion/<slug>/out/audio.wav
# продакшн путь (один раз)
git clone --depth 1 https://github.com/Vincentwei1021/mg-styles-15 /tmp/mg && pip install -r /tmp/mg/requirements.txt
```
```python
import sys; sys.path.insert(0, '/tmp/mg/lib/audio')
import mgaudio as mg
from mgaudio import recipes, sfx
m = recipes.synthwave(drop=4.0, outro=8.0)          # музыка уже аранжирована; бар 0 начинается ровно на drop
m.sfx(sfx.impact('cinematic'), at=4.0, gain=2)      # sync-точка = время визуального события
m.sfx(sfx.whoosh(.7), at=3.6)                        # whoosh: синк на пике пролёта
m.sfx(sfx.riser(2.0), at=4.0)                        # riser: синк на КОНЦЕ (удар)
res = m.export('out/audio.wav', lufs=-14, tp=-1, spectrogram='out/spec.png')  # посмотри спектрограмму и warnings
```

## 2. Жанр под стиль (рецепты mgaudio → эквивалент в audio_kit)

| Стиль | Жанр, BPM | audio_kit `music.kind` |
|---|---|---|
| Flat vector, 3D | EDM-поп 110–130, supersaw-дроп | `pulse` |
| Line art, aurora glass, 3D-продукт | эмбиент 72–100, пэды, фортепиано | `ambient` |
| Cel/boil, collage, grain | lo-fi 70–96 (rhodes, винил, boom-bap) | `ambient` + SFX |
| Liquid, morph | future bass 130–165 | `pulse` |
| Bauhaus | минимал-техно 118–132, клики | `pulse` |
| Synthwave | synthwave 84–118, gated snare, арп-бас | `pulse` |
| HUD/FUI | darksynth 96–124, фригийский лад | `pulse` |
| Pixel | чиптюн 120–170 | `chiptune` |
| Sticker explainer, isometric | маримба-тех 100–124 | `ambient`/`pulse` |
| Variety captions | прыгучий варьете 112–128, пиццикато, укулеле | `pulse` |
| Kinetic type | trap 130–160, 808 на удары | `pulse` |
| Glitch | glitch-hop 95–115 | `pulse` + `glitch` |
| Ink wash, guofeng | пентатоника 76–110, гучжэн, флейта, тайко | `ambient` (лучше mgaudio `guofeng`) |
| Anime OP | J-rock/эпик 150–170 | свой трек пользователя или mgaudio `pop`/`trap` |

## 3. SFX-палитры по стилям

- **Flat/explainer:** pop, boing, whoosh, click, ding на каждое появление.
- **Line art:** перо по бумаге (громкость ~ скорости пера), мягкий колокольчик на заливке.
- **3D:** мягкие thud, squish, пузырьки, воздушный пэд.
- **Liquid:** gloop, drip, splash, bubbles, pour, басовый swell.
- **Collage:** бумага (rustle/flip), ножницы, шлепки, скотч, треск винила.
- **HUD:** бипы, свипы сканирования, `lock_on`, тревога, печатание данных.
- **Pixel:** coin, jump, powerup, 8-bit взрыв.
- **Synthwave/VHS:** VHS-шум, head switch, tape stop, большой аккорд + крэш на титре.
- **Kinetic/anime:** text slam, impact, whoosh на каждом кате, riser к названию, sub drop на hero.

## 3a. Событие на экране → звук (claude-motion, teardown)

| На экране | Звук | Заметки |
|---|---|---|
| Набор текста | клик на каждый символ | джиттер ±4–6 мс, случайный gain |
| Раскрытие слова/строки | короткий воздушный whoosh + blip на приземлении | |
| Бейдж, чип, выноска | pop | высота растёт по ходу последовательности |
| Контрол щёлкает на шаг | click + blip в тональности | |
| Рисование/скетч | scratch / перо | |
| Нарастание | riser | кончается ровно на ударе; **один большой riser на ролик** |
| Успех/прибытие | chime (аккорд в тональности) | |
| Hero-переход | whoosh на входе + impact на ударе | **один impact на ролик** (в опенинге — 2–3 на главных ударах) |
| Под всем | pad с огибающей | «ныряет» ~65 % под hero-переходом |
| Механизм (teardown) | мягкий «тук» на каждом рабочем ходе | ритм уплотняется, когда открывается газ; воздух под перетаскиванием |

**Акцентируй, не озвучивай всё подряд:** непрерывное движение (дрейф, зерно, вращение) — тихо.
**Уровни:** hero-удары 0,25–0,35 (линейный gain), поддержка 0,08–0,2, pad ~0,03. **Панорама следует позиции на
экране** (−1 слева … +1 справа); последовательности проходят по стереополю. **Одна тональность** на все тональные
звуки; высота растёт с прогрессом и разрешается на развязке.
**Громкость:** микс, где только короткие удары и тишина, не дотянуть до −14 LUFS без «раздавливания» — добавь
длинный звук (pad, хвосты), а не форсируй лимитер. Перед AAC оставляй true peak ≤ −2 dBFS: энкодер добавляет
перелёт, а в MP4 должно остаться ≤ −1 dBTP.
**Готовые файлы SFX:** измерь время пика каждого файла один раз и ставь его на `cue − peak` (транзиент в кадр).
**Проверка синхрона глазами:** волна с линиями битов из `cues.json` (`scripts/wave.sh`): каждый транзиент — на
линии или чуть после. Удар между линиями = захардкоженное время или устаревший WAV.

## 4. Синхронизация

- **Один cue sheet.** Все времена событий — в `cues.json` (`beats` + список `sfx`). Картинка читает `beats`,
  звук — `sfx`. Сдвинул момент — поменял одно число.
- **Sync-точка, а не начало файла.** impact/pop — транзиент; whoosh — пик пролёта (~62 % длины); riser/swell/
  reverse cymbal/lock_on — **конец** (удар). В `at` всегда пишется время визуального события.
- Музыкальная форма: bar 0 = drop; hero-момент картинки = drop музыки (60–75 % ролика).
- Реактивные титры появляются на 2–3 кадра позже звука; удары/столкновения — кадр в кадр.
- Музыка «ныряет» на ~3 дБ вокруг каждого SFX (ducking), SFX на ~2 дБ громче бэда.
- Проверка: `qc.sh` + послушать; в mgaudio — спектрограмма и `analyze()['stereo_corr'] > 0.3` (моно-совместимость для телефонов).

## 5. Мастеринг и спецификация

- −14 LUFS integrated (±1), true peak ≤ −1 dBTP, 48 кГц стерео, AAC 320 кбит/с в MP4.
- Fade-in 4 мс, fade-out 250 мс; длительность звука = длительность видео до сэмпла.
- Расширение стерео только M/S, не Haas (на моно телефоне Haas «съедает» звук).

## 6. Своя музыка / голос пользователя

```bash
# найти доли в треке, чтобы поставить на них удары (librosa)
python3 -c "import librosa,sys; y,sr=librosa.load(sys.argv[1]); t,b=librosa.beat.beat_track(y=y,sr=sr,units='time'); print(round(float(t),1),'BPM'); print([round(x,3) for x in b])" track.mp3
# вырезать 10 с с нужного места, отмастерить
ffmpeg -ss 42.0 -t 10 -i track.mp3 -af "afade=t=in:d=0.05,afade=t=out:st=9.7:d=0.3,loudnorm=I=-14:TP=-1.5:LRA=11" -ar 48000 out/audio.wav
```
Доли трека вписывай в `cues.json` → картинка встаёт в ритм. Для голоса (диктор): сначала озвучка, затем
транскрипт с таймкодами (whisper, см. reference-analysis.md) → каждая фраза = новый визуальный элемент.

**Лицензии:** только своя музыка, CC0/PD, или трек с правом коммерческого использования. Записывай источник в `CREDITS.md`.

## 7. Партитура на часах фильма (HyperFrames `session-story`/`day-in-my-life`, buildfast `generative-film`)

- **Музыка пишется первой** (эссе-фильм) или на той же сетке, что картинка: все времена событий — на одной
  бит-сетке в `cues.json`, читают **и** сцены, **и** звук. «Никогда не перетаймливай одно без другого».
- **Библиотека реплик по событиям:** каждому типу события (`land`, `unfold`, `hit`, `release`, `pop`) — реплика по
  умолчанию; время — из события таймлайна. **Хиты — на кадре, который показывает событие, не после.**
- **Лейтмотив из содержания:** 6–10 нот, ~4–5 долей (взлёт, поворот, долгая последняя нота + фраза-ответ); можно
  вывести из букв названия (у `day-in-my-life`: «c l a u d e» → D E F♯ A B A). Дуга оркестровки — включая **одну настоящую тишину**.
- **Лады под культуру** (generative-film): рага бхайрави/ямaн, мажорная/минорная пентатоника, хиджаз, in-sen, пелог,
  дорийский, фригийский доминантовый, целотонный. Индия — танпура + ситарный щипок с глиссандо; Япония — in-sen +
  чистый щипок + колокола; Ближний Восток — хиджаз + рамочный барабан. **Тихаи** — фраза ×3, приземляющаяся точно на склейку.
- **«Каждое визуальное событие получает звук»** (эссе-фильм): вайпы → райзеры, дроп → бум + вспышка, склейки → тихаи
  или бочка, появление букв → колокольчики. Статтер звука = глитч картинки на стыке.
- **Энергия по сценам 0..1** (motion-studio): низкая — без барабанов и баса, высокая — арпеджио/хэты/стабы,
  **≤ 0,1 = тишина перед ударом титра**. Перкуссионные реплики не ближе ~0,3 с друг к другу (маскируют).
- **QC без ушей:** таблица уровней в каждый ключевой момент; **FAIL, если > 1,2 с тише −45 dBFS («мёртвый эфир»)**
  или длина ≠ длине фильма (`qc.sh` проверяет); удары −10…−14 дБ, «бумажные» звуки −22…−32 дБ; «момент намного тише
  соседей — на нём нет реплики». Спектрограмма: `ffmpeg -i a.wav -lavfi showspectrumpic=s=1600x500:scale=log:fscale=log spec.png` → Read.

## 8. Аудиореактивная картинка из собственного микса

Осциллограф/пульсация от **настоящего** саундтрека (как «вдох» в стиле 25): посчитай один раз огибающую по кадрам и
положи рядом с фильмом, `renderAt` только читает:
```bash
ffmpeg -i out/audio.wav -af "aresample=48000,asetnsamples=1600,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=out/env.txt" -f null -
```
(1600 сэмплов = 1 кадр при 30 fps / 48 кГц) → разбери `env.txt` в `env.json` (дБ по кадрам). Для полос (20–150 / 150–800 /
800–4k / 4k–16k Гц) и онсетов (спектральный поток, медиана + 2σ) — `librosa` или анализатор buildfast `motion-studio`.

## 9. Готовые музыка, SFX и голос: HyperFrames `media-use` (обновление v0.9.15)

Синтез (mgaudio/audio_kit) хорош для точных хитов и временных дорожек, но живая музыка и «настоящие» звуки
(огонь, бумага, мурчание, толпа) звучат лучше из библиотеки. В HyperFrames v0.9 появился навык `media-use`:
каталог HeyGen — 10 000+ музыкальных треков и SFX, 75 000+ изображений, озвучка (Voice Turbo, 3 мин/мес бесплатно).

```bash
npx hyperframes skills update          # ставит навыки hyperframes, hyperframes-cli, hyperframes-registry, media-use
npx hyperframes auth status            # сначала проверить вход
npx hyperframes auth login --device    # вход в HeyGen по коду (для облака/headless): человек подтверждает код в браузере
npx hyperframes media-use resolve --type bgm --intent "tender chinese xiao flute, guzheng, cinematic, 72 bpm" --candidates --project <dir>
npx hyperframes media-use resolve --type sfx --intent "cozy fireplace crackle" --project <dir>
npx hyperframes media-use resolve --type voice ...   # озвучка; локально без аккаунта — npx hyperframes tts (Kokoro)
```

Файл ложится в `<dir>/assets/` с записью в реестре (`resolved <id> → <path>`), рендер ничего не скачивает.
SFX без аккаунта — Openverse (CC BY, нужна атрибуция в CREDITS.md). Как подключить в наш пайплайн: положить трек
как `music.*`, звук — как `sfx/<имя>.*` рядом с `audio.py` (см. `motion/wanyin-birthday/audio.py` — подстановка
файлов вместо синтеза уже встроена; громкость/ducking под голос — там же).

**Облачная среда Claude Code:** нужны хосты `hyperframes.heygen.com`, `api.heygen.com`, `api2.heygen.com`,
`app.heygen.com` (и `api.openverse.org` для бесплатных SFX) в Allowed domains сетевой политики окружения;
без них `auth login` падает с «could not reach the authorization server».
