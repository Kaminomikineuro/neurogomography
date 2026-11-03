# Пайплайн: код → MP4

Модель из mg-styles-15: **каждый фильм — веб-страница, которая рисует кадр для любого момента времени**
(`window.renderAt(t)`). Headless-браузер снимает каждый кадр, ffmpeg склеивает кадры и звук. Так рендер
детерминирован, кадр можно перерисовать отдельно, а картинка и звук читают один cue sheet.

```
treatment → cues.json ─┬─→ index.html (renderAt) ─→ render.mjs (Chromium) ─┐
                       └─→ audio_kit.py / mgaudio ─→ audio.wav ─────────────┴─→ ffmpeg → video.mp4 → qc.sh
```

## 1. Контракт страницы

```js
window.DEMO = { width: 1920, height: 1080, fps: 30, duration: 10 };
window.renderAt = async (t) => { /* нарисовать кадр для t секунд — чистая функция t */ };
window.__ready = true;   // после загрузки шрифтов, картинок, шейдеров
```
CSS-анимации и WAAPI на странице рендерер ставит на паузу и перематывает на `t` сам, но надёжнее всё вести
через `renderAt`. Шаблон: `templates/film/` (`index.html` + `mg.js` + `cues.json`). Новый проект:

```bash
mkdir -p motion && cp -r .claude/skills/motion-design/templates/film motion/<slug>
```

### Детерминизм — правила
- Время только из аргумента `t`. Никаких `Date.now()`, `performance.now()`, `requestAnimationFrame`-счётчиков.
- Случайность только seeded: `rng(seed)`, `hash(n)`, `noise1(x)` из `mg.js`.
- Физика/частицы — замкнутая форма (`spring()`, параболы) или предрасчёт массива состояний при загрузке.
- GSAP: создай timeline с `paused: true` и в `renderAt` делай `tl.seek(t)` (или `tl.progress(t / D)`).
- Three.js: в `renderAt` выставь всё по `t` и вызови `renderer.render()`; `preserveDrawingBuffer: true`.
- Видео-слои (`<video>`): `video.currentTime = t` и дождись `seeked`; лучше заранее нарезать в PNG-секвенцию.
- Lottie: `anim.goToAndStop(t * 1000, false)`.
- Шрифты: `await document.fonts.load('600 64px "MyFont"', 'текст')` до `__ready`; положи woff2 в проект и
  подключи `@font-face` — внешние CDN в рендере могут быть недоступны.

## 2. Рендерер `scripts/render.mjs`

| Команда | Что |
|---|---|
| `node render.mjs <dir> --stills 0.5,2,5` | PNG-кадры в `out/stills/` — **смотри их через Read** |
| `node render.mjs <dir> --stills beats` | лист ревью: кадр 0 + плитка через 0,3 с после каждого бита `cues.json` → `out/beats.png` |
| `node render.mjs <dir> --sheet 0.5` | contact sheet всего ролика одним PNG |
| `bash wave.sh out/video.mp4 cues.json` | волна звука с линиями битов и метками SFX + LUFS/true peak |
| `node render.mjs <dir> --scale 0.5 --noaudio` | быстрое превью `out/preview.mp4` |
| `node render.mjs <dir> --from 5 --to 7` | перерендер отрезка |
| `node render.mjs <dir> --mb 4` | финал с motion blur (4 подкадра, затвор 180°) |
| `--workers 4` | параллельные браузеры (по умолчанию min(4, CPU)) |
| `--gif` | дополнительно оптимизированный GIF (≤720 px, палитра) |
| `--crf 16 --preset slow` | качество x264 |

Нужно: Node 18+, Playwright с Chromium (в облачных сессиях уже стоит; локально `npm i -D playwright &&
npx playwright install chromium`, или `MG_CHROME=/путь/к/chrome`), ffmpeg. Страница раздаётся с корня git-репо,
поэтому пути `/assets/...` работают. В контейнере без GPU — ~0.7–1 с на кадр 1080p; на машине с GPU — в разы быстрее.
Исходный рендерер mg-styles-15 (`harness/render.mjs`) умеет ещё tmap/ре-тайминг и lossless MKV — бери его для сложных монтажей.

## 3. Форматы под площадки

| Площадка | Размер | fps | Длина | Примечания |
|---|---|---|---|---|
| YouTube / презентация | 1920×1080 (или 3840×2160) | 24/25/30/60 | любая | −14 LUFS |
| Reels / TikTok / Shorts | 1080×1920 | 30 | 6–60 с | safe-зона: верх 14 %, низ 20 %, правый край 12 % |
| Instagram лента | 1080×1350 (4:5) или 1080×1080 | 30 | ≤ 60 с | |
| Telegram кружок / стикер | 512×512 (стикер: WEBM VP9, ≤ 3 с, ≤ 256 КБ) | 30 | | |
| Баннер/лендинг | MP4 H.264 без звука + WebM VP9, или Lottie | 30 | цикл | `-an`, `muted autoplay loop playsinline` |
| Анимированный GIF | ≤ 720 px | 12–20 | ≤ 6 с | `--gif` |

## 4. ffmpeg-рецепты

```bash
# Сменить формат кадра (вертикальная версия из горизонтальной — лучше пересобрать сцену в 1080×1920!)
ffmpeg -i video.mp4 -vf "crop=ih*9/16:ih,scale=1080:1920" -c:a copy vertical.mp4
# Наложить свою музыку и отмастерить (обрезка по длине видео)
ffmpeg -i video.mp4 -i music.mp3 -map 0:v -map 1:a -c:v copy -af "loudnorm=I=-14:TP=-1.5:LRA=11" -c:a aac -b:a 320k -shortest out.mp4
# Видео для веба без звука + WebM
ffmpeg -i video.mp4 -an -c:v libx264 -crf 22 -preset slow -pix_fmt yuv420p -movflags +faststart web.mp4
ffmpeg -i video.mp4 -an -c:v libvpx-vp9 -b:v 0 -crf 32 web.webm
# Prores 4444 с альфой (для монтажа в Premiere/DaVinci; страница с прозрачным фоном)
ffmpeg -framerate 30 -i frames/%05d.png -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le alpha.mov
# Стоп-кадр-постер
ffmpeg -ss 9.5 -i video.mp4 -frames:v 1 poster.png
# Склейка нескольких роликов одного формата
printf "file '%s'\n" a.mp4 b.mp4 > list.txt && ffmpeg -f concat -safe 0 -i list.txt -c copy joined.mp4
```

## 5. 3D

- **Three.js** (быстро, в том же пайплайне): `OrthographicCamera` для изометрии, `MeshPhysicalMaterial`
  (`transmission`, `clearcoat`, `sheen`) + HDRI (`RGBELoader`/`PMREMGenerator`), пост-эффекты через
  `EffectComposer` (`SAOPass`/`GTAOPass`, `BokehPass`, `UnrealBloomPass`). Тени `PCFSoftShadowMap`.
- **Blender** (максимум качества, стиль 5): `blender -b -P scene.py -- --out frames/` → Cycles + OIDN или EEVEE →
  PNG-секвенция → типографика отдельным HTML-проходом с прозрачным фоном → композит ffmpeg (`overlay`). Камеру,
  клонеры (Geometry Nodes) и ключи задавай из `bpy`-скрипта по тому же `cues.json`.

## 6. Отладка

| Симптом | Причина / решение |
|---|---|
| Кадры отличаются между рендерами | Где-то `Math.random()`/`Date.now()`/rAF-состояние |
| «Тофу» □□□ или не тот шрифт | Шрифт не загружен до `__ready` или нет кириллицы — `document.fonts.load` + локальный woff2 |
| Мерцают тонкие линии | Линии < 1.5 px, нецелые координаты у горизонталей — толще, `Math.round(x)+0.5`, или motion blur |
| Бандинг градиентов | Добавь 3–5 % шума/зерна поверх; избегай длинных тёмных градиентов без дизеринга |
| Чёрный кадр WebGL | `preserveDrawingBuffer: true`, рендер внутри `renderAt`, дождись компиляции шейдеров до `__ready` |
| Звук не совпадает | Все времена — из `cues.json`; SFX-синк на «событии», не на начале файла (см. sound.md) |
| Рендер медленный | `--scale 0.5` для превью, `--from/--to` для кусков, кэшируй тяжёлое (оффскрин-канвасы, предрасчёт) |
