# Музыка (Suno) и звуки — как заменить синтез

Сейчас в ролике временная музыка и звуки, синтезированные кодом. Чтобы поставить свои, положите файлы рядом
с `audio.py` и пересоберите (или просто пришлите файлы Claude):

```
motion/wanyin-birthday/music.mp3          ← трек из Suno (wav/mp3/m4a/flac)
motion/wanyin-birthday/sfx/<имя>.wav       ← любой звук из таблицы ниже (по одному файлу на звук)
motion/wanyin-birthday/voice.wav           ← голос, если будет (VOICE.md)
```

```bash
MGAUDIO=<mg-styles-15>/lib/audio python3 motion/wanyin-birthday/audio.py
node .claude/skills/motion-design/scripts/render.mjs motion/wanyin-birthday --workers 4 --crf 18 --out motion/wanyin-birthday/out/wanyin-birthday.mp4
```

Трек обрезается до 2:08 и затухает в конце. Если нужно начать не с начала файла — `"music_offset": <секунды>`
в `cues.json`; громкость относительно звуков — `"music_level"` (по умолчанию −4 dB).

## 1. Промпт для Suno

Режим **Custom**, переключатель **Instrumental** включён, длительность лучше 2:10–2:30 (лишнее обрежется).

**Style of Music** (вставить целиком):

```
cinematic chinese xianxia love theme, instrumental, solo xiao bamboo flute lead, guzheng, pipa, soft strings, warm felt piano, celesta and music box sparkles, gentle pads, D major pentatonic, 72 bpm, tender, intimate, magical winter night, playful middle section with pizzicato and pipa, warm swelling climax, soft hopeful ending, no vocals, no drums kit, wuxia ost, studio quality
```

**Lyrics** (только структурные теги — так Suno держит форму ролика):

```
[Intro: lone xiao flute over a soft drone, a single water drop, mysterious and warm]

[Verse 1: guzheng arpeggios join, gentle and loving, slow]

[Verse 2: winter night, shimmering celesta like falling stars, strings swell slowly, wonder]

[Bridge: flute melody rises, one bright magical moment, then a warm sunrise]

[Interlude: playful, light, pizzicato and pipa, music box, cheeky and sweet, a little faster]

[Interlude: playful continues, teasing, cute]

[Verse 3: cozy fireplace warmth, piano and xiao, very intimate, slower]

[Chorus: full warm swell, strings and flute together, emotional peak, heartfelt]

[Outro: everything falls away to xiao and guzheng, soft and tender, final bell, fade]
```

**Карта ролика** — к чему подстраивается трек (если Suno попал не идеально, Claude подрежет/сдвинет):

| Время | Что в кадре | Характер музыки |
|---|---|---|
| 0:00–0:08 | капля туши → лотос, «Цзян Ваньиню» | одинокая флейта, загадочно |
| 0:08–0:19 | Пристань Лотоса, «Дорогой муж…» | вступает гучжэн, нежно |
| 0:19–0:49 | зимняя ночь, Тауриды, звезда падает в ладони | мерцание, медленный рост, чудо (0:41–0:45) |
| 0:49–0:56 | красное солнце, журавли | тёплый рассвет |
| 0:56–1:39 | колючка, кот, инкубчик, апельсинка, черничка, ролл | игриво, легко, пиццикато/пипа, чуть быстрее |
| 1:39–1:47 | дом у камина | уютно, тише |
| 1:47–1:54 | наезд в камин, голубое сердце | нарастание |
| 1:54–2:00 | «Ты — моё всё», весь свиток | **кульминация** |
| 2:00–2:08 | свиток сворачивается, последние слова, печать 02:08 | флейта и гучжэн, тихо, финальный колокол на 2:06.85 |

Сделайте 2–4 варианта и выберите тот, где кульминация ближе всего к 1:54. Можно также попросить у Suno
**Extend**/**Replace section**, если кусок не тот.

## 2. Звуки (sfx)

Suno делает музыку, а не отдельные звуки. Звуки удобнее генерировать в **ElevenLabs → Sound Effects**
(или взять с freesound.org под CC0). Имя файла = имя в таблице, например `sfx/meteor.wav`. Любой звук, для
которого файла нет, останется синтезированным.

| Имя | Когда | Промпт для генератора звуков |
|---|---|---|
| `drop` | 0:00.8 | single drop of ink falling into still water, close, intimate, soft reverb |
| `unroll` | 0:06.5 | old silk scroll being unrolled on a wooden table, soft paper rustle |
| `page` | каждая смена картины | soft airy whoosh of paper scroll turning, gentle |
| `seal` | после «рождения!», «звёздочка.», «Мой дом» | wooden chinese seal stamp pressed into paper, soft thud |
| `meteor` | 0:19–0:49, много раз | slow bright meteor streaking across a quiet winter night sky, soft shimmering whoosh |
| `star_fall` | 0:41 | magical falling star descending, sparkling twinkle, slow |
| `star_land` | 0:45.4 | tiny magical chime as a star lands in someone's palm, warm |
| `sunrise` | 0:49.5 | warm swelling bell tone at sunrise, peaceful |
| `cranes` | 0:51 | distant red-crowned crane call, soft, far away |
| `pin` | 0:58.8 | small metal sewing pin dropping on wooden floor, tiny bounce |
| `blossom` | 0:58.6–1:00.3 | tiny glockenspiel ping as a flower blossoms, delicate |
| `cheshire` | 1:04.1 | mischievous magical shimmer, cat appearing out of thin air |
| `purr` | 1:07.9 | contented cat purring loudly, close up |
| `wings` | 1:12.4 | small bat wings unfolding, leathery flap, playful |
| `heart_pop` | 1:13.2–1:15.4 | cute soft pop, little floating heart |
| `blush` | 1:13.8 | fast nervous heartbeat, comedic, flustered |
| `slice` | 1:20.6 | juicy mandarin orange segment pulled apart, fresh |
| `berry` | 1:26.6 / 1:27.4 / 1:28.2 | blueberry dropping into a porcelain bowl, tiny plink |
| `berry_up` | 1:27.3 | cute bright blip, playful |
| `chopsticks` | 1:34.4 | wooden chopsticks clicking together |
| `lift` | 1:35.3 | quick comedic swish |
| `protest` | 1:35.7 | small indignant squeak, cartoonish |
| `fire` | 1:38.4–1:54 | cozy fireplace crackling, wood logs burning, warm room, 16 seconds |
| `heart` | 1:48 | magical shimmering whoosh, blue flame igniting into a heart |
| `heart_beat` | 1:48.3 | slow warm heartbeat, two beats |
| `everything` | 1:54.2 | gentle tonal riser, emotional swell, 3.5 seconds |
| `roll_up` | 2:00 | silk scroll being rolled up quickly, paper slide |
| `final_seal` | 2:06.85 | heavy chinese seal stamp pressed firmly into paper |
| `final_hit` | 2:06.86 | soft deep timpani hit, cinematic |
| `final_bell` | 2:06.9 | single temple bell, warm, long decay |
