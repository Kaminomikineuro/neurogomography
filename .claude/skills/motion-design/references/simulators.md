# 3D-симуляторы «разбери машину» (teardown)

Маршрут E. Источник — статья Elvar «How I Turn Any Machine Into a 3D Simulator You Can Take Apart» (X, 30.10.2026) и
скилл [elvarofficial/teardown](https://github.com/elvarofficial/teardown) (MIT), построенный на
[whaleyxbt/claude-motion](https://github.com/whaleyxbt/claude-motion) (MIT). Симулятор V8 собрал 3,79 млн просмотров:
люди смотрят, как машина работает, дольше, чем читают о ней.

**Что получается:** одна HTML-страница (~800 КБ, работает офлайн), где машина крутится в центре, вокруг —
живые панели с реальными числами, на каждую подсистему — кнопка (изолировать, разрезать, показать отдельно),
виды камеры, а без участия зрителя страница сама проводит тур курсором. Тот же код покадрово записывает фильм
60 fps со звуком на том же таймлайне.

Подходит для всего, где есть движущиеся части: двигатель, шасси, редуктор, часы, экскаватор, шагающий робот — и
для несуществующих машин (песчаный червь, робомедуза, механические существа). Для книги «Белая кровь» —
механизмы мира, оружие, доспехи, драконья анатомия как «study model».

## 1. Установка полного kit (рекомендуется для 3D)

```bash
npx skills add elvarofficial/teardown -g -a claude-code
```
```bash
cd ~/.claude/skills/teardown && npm install && npx playwright install chromium
```
Затем в Claude Code: `/teardown`. Нужны Node 20+, для видео — ffmpeg, для звука — Python 3 (только stdlib).
Внутри 3 готовые машины (V8, шасси Cessna 337, Strandbeest), каждая в трёх папках: `<name>-shared/` (машина),
`<name>-film/` (записанный тур), `<name>-live/` (страница, которой управляют). Копируй ближайшую.

Без установки — та же архитектура на нашем рендерере: Three.js-страница с `renderAt(t)` → `scripts/render.mjs`.

## 2. Шесть частей любого симулятора (на примере шагающего гексапода HX-7)

| Часть | Что это |
|---|---|
| **Машина** | Собрана кодом: шасси, 6 ног, 18 суставов, корпуса сервоприводов, бёдра с прорезями, голени с конусом |
| **Модель** | Один решатель для всех ног, планирует шаг на секунду вперёд. Ноги, панели и пол читают из него |
| **Панели** | Момент в суставах, высота каждой стопы, нагрузка на ноги, время решателя, температура сервоприводов |
| **Кнопки** | Походки (tripod / ripple / wave), крестовина направлений, WASD, слайдеры скорости, шага, высоты корпуса |
| **Окно** | Пол показывает работу решателя: линии к опорным стопам, метка следующего шага, следы переноса |
| **Тур** | Без зрителя курсор сам ведёт страницу. Любой клик — управление у зрителя. 25 с тишины — тур возвращается |

## 3. Структура файлов машины

| Файл | Работа |
|---|---|
| `kin.js` / `gear.js` / `jansen.js` | **Математика.** Реальные размеры в реальных единицах, **один вход** (угол коленвала, ход, ветер), каждая поза и показание — функция от него. Никакого three.js |
| `engine.js` / `beast.js` | **Геометрия кодом**: точёные детали (lathe), трубы, инстансы. `update(input)` ставит позу |
| `stage.js` | Студия, свет, тени, пост (GTAO, bloom). `frame(state, cam)` рисует кадр |
| `console.js` | Оверлей: фиксированная CSS-раскладка 1600×900, панели, графики, тумблеры, выноски. `update(state)` перерисовывает из состояния кадра |
| `film.js` | `SCRIPT` операторских действий (виды, изоляция, разрез, газ) и `render(t)` — чистая функция времени |
| `live.js` | Та же машина в реальном времени: кнопки, слайдеры, орбита, зум, клавиши + автотур с курсором |
| `score.py` | Звук на таймлайне фильма |
| `<name>-film/timeline.json` | Все биты в секундах; звук читает тот же файл |

## 4. Девять шагов (промпты из статьи)

Промпты оставлены на английском — так их точнее понимает модель; квадратные скобки заменяй своим.

**Шаг 2. Выбери машину и найди референс.** Это решает всё. Без референса панголин, броненосец и скорпион
вышли «генерик-игрушками»; с одним клипом реального V8 модель пересобрала двигатель панель за панелью.
Бери машину с **одним движущимся входом и реальными числами** + одну картинку: разрез из мануала, фото, клип.
Идеи: переключатель велосипеда по 11 звёздам; анкерный спуск часов на 4 Гц; дифференциал в повороте;
челночный стежок швейной машины; рука экскаватора, один ковш.

**Шаг 3. Машина.**
```text
/teardown Build [the Cessna 337 main landing gear] as an interactive 3D simulator. Reference attached: [a cutaway drawing of the gear].

Build it from code in real units: [the main plate, the hydraulic actuator, the rack, the pinion on its output shaft, the universal joints, the side tubes, the spring legs and the wheels].

Before you draw anything, write the model as pure functions of one input: [stroke from 0 to 1]. Use the real numbers: [the rack travels 201 mm, the pinion has 32 teeth at module 4 mm, so the legs turn exactly 180°]. Check them by hand and show me the check. If you are not sure a number is real, say so and tell me where it comes from.

Every part, every panel and every label reads from that one model. Nothing is animated by hand.
```
Почему держится: модель первична — шестерни, приборы и таймлайн читают одну функцию и не могут разойтись;
один вход — механизм, а 12 вручную анимированных деталей — 12 анимаций. Проверка Cessna: 32 зуба × модуль
4 мм = делительный диаметр 128 мм, половина окружности = 201 мм хода. Strandbeest — 11 длин звеньев Тео
Янсена (1990): крутишь кривошип, каждый шарнир следует по пересечению окружностей (решатель в 67 строк).

**Шаг 4. Консоль.**
```text
Lay out a console around the machine at 1600×900:
- the title and the main live number top left, big: [engine speed in rpm]
- live charts that move with the machine: [valve lift over 720° of crank, the pressure-volume loop of the tracked cylinder]
- a schematic panel that redraws the mechanism in 2D from the same model
- one button per subsystem: isolate it, cut it, show it alone
- camera views as buttons: [hero, front, side, top, inside the valley]
- callouts with thin leader lines into the parts they name
Every panel redraws from the frame's state. No number on screen is typed in.
```
График, который движется вместе с деталью, — причина, по которой люди остаются (PV-петля V8 замыкается раз в 720° коленвала).

**Шаг 5. Лук.**
```text
Style: a clean study model on a pale studio.
- light background, soft shadows on an invisible floor, one accent colour for the part that is working right now
- the machine fills 60 to 70% of its view
- dark parts glossy, liners glass, metal roughness at least 0.45 so it never streaks white
- if a part is near-white, give it a thin ink outline or a darker ground
- pick the camera for the mechanism: if it collapses into a lattice face-on, use a 3/4 view
```
Каждая строка — исправленная ошибка: белые трубы Strandbeest пропадали на кремовом фоне (решение — песок +
чернильный контур); анфас 20 ног превращался в забор (камера 3/4 вдоль хребта); тёмная версия теряла первую
секунду в ленте.

**Шаг 6. Проверка критиком.**
```text
Before you show me anything:
1. Render a still at every beat of the tour and read each one: a part passing through another, a part floating off its mount, a label covering what it names, a number that disagrees with the pose.
2. Scrub every transition at 0.2 s steps and look for a jump.
3. Fix collisions with a number in the parameter block. Never hide them with the camera.
Tell me what you checked and what you fixed. Show me the stills.
```
Стоп-кадры поймали 2 бага: морда кролика пролезала сквозь шляпу (починило одно число, 0.222 м); нога гексапода
улетала при смене походки (пока стопы не стали целиться в следующую реальную опору).

**Шаг 7. Страница, которой управляют.**
```text
Make the simulator a page people drive:
- the tour from the film plays by itself, with a cursor that walks to each button and presses it
- any click, drag, scroll or key hands control to the visitor; 25 seconds of quiet hands it back
- drag to orbit, scroll to zoom, a key to hide the panels
- warm every shader before the first frame so the page never freezes
- test it on an integrated GPU and add quality steps: no ambient occlusion, a lower pixel ratio, smaller shadows, panels redrawn every other frame
```
Интегрированная видеокарта — тест, который все пропускают: гексапод шёл 15 fps → после ступеней качества 75 fps.
На странице с дюнами тормозил один шейдер, считавший одно смещение 5 раз на вершину.

**Шаг 8. Видео.**
```text
Record the tour: render(t) has to be a pure function of time, so draw every frame at 60 fps at 1920×1080 in headless Chrome and pipe it into ffmpeg as H.264, yuv420p, faststart. Then show me a contact sheet of every beat.
```
```text
Score it in code on the same timeline: [Am9 chords at 92 bpm, a soft thump on every power stroke so the beat tightens when the throttle opens, a quiet click on every button press, rising air under the throttle drag]. Master to -14 LUFS with the true peak under -1 dB and mux it into the video.
```
Экранная запись теряет кадры, когда GPU нагружен; покадровый тур — нет. Фильм V8: 26 с, 189 звуков, каждый
«тук» — на рабочем ходе.

**Шаг 9. Публикация.**
```text
Publish the simulator as a page:
- keep the HTML under 1 MB; move any large model out as a file next to the page
- a 1200×630 preview card from the best frame, with absolute image URLs
- deploy it to Vercel
```
15,9 МБ со встроенными моделями — X не показал карточку ссылки; 967 КБ с моделями рядом — показал.

**Бонус. Дай сломать.**
```text
Add one slider for [the wind, 0 to 15 m/s] and run the model live when it moves: [a light breeze barely turns the crank, a gale makes the legs blur]. Show it on the same panels.
```
Кто может вывести машину за предел, тот понимает, что делает каждое число.

## 5. Правила, которые решают, сработает ли

1. **Референс, а не воображение.** Строй по фото/разрезу/клипу и сравнивай кадр за кадром.
2. **Реальные числа, один источник.** Сначала реальные размеры (диаметр, ход, число зубьев, длины звеньев). Каждый прибор читает ту же функцию, что ставит позу. Одну проверку — вручную.
3. **Один вход управляет всем.** Ничего не анимируется руками — фильм, живая страница и звук не расходятся.
4. **Работающая деталь раскрывается**: изолировать, разрезать, рентген. Камера внутри дороже десяти облётов.
5. **Светлая студия, один акцент.** Светлый фон читается в ленте; акцент — то, что меняется сейчас. Почти-белым деталям — чернильный контур или фон темнее.
6. **Камера под механизм.** Плоский механизм анфас схлопывается в решётку — ставь 3/4.
7. **Коллизии чинятся числом** в блоке параметров, а не ракурсом.

## 6. Контракт `render(t)` (совпадает с нашим `renderAt`)

- `render(t)` чистая: никакого `Math.random` (только `rng(seed)` при загрузке), `Date`, состояния между кадрами.
- Всё, что движется по своим правилам (агенты, частицы), симулируется один раз при загрузке в typed arrays; `render` только читает. Интегрируемые величины (кривошип под меняющимся ветром) — в замкнутой форме или таблицей.
- Все биты — в `timeline.json`; звук читает его же.
- **Кадр 0 — превью (thumbnail)**: на нём уже должна быть машина. Пустой/чёрный кадр 0 убивает автоплей в X.

Наш эквивалент: `window.renderAt(t)` + `cues.json` + `scripts/render.mjs --mb 2` (для 60 fps задай `fps: 60` в `window.DEMO`).

## 7. Живая страница

- **Тест на интегрированной видеокарте** + ступени качества (`TIERS`): без AO, ниже pixel ratio, меньше карты теней, панели раз в два кадра. Сначала найди самый дорогой шейдер.
- **Прогрев шейдеров** до первого кадра (`renderer.compileAsync` / `kit/warm.js`) — страница не замирает.
- **Страница < 1 МБ**; тяжёлые модели — файлами рядом (`build.json` → `{"external": {"heavy.glb": "light.glb"}}`).
- Автотур: курсор идёт к кнопке и нажимает; клик/drag/колесо/клавиша — управление зрителю; `IDLE = 25` с — тур возвращается; плашка «AUTO TOUR · CLICK TO TAKE OVER».

## 8. Ловушки three.js (уже наступали)

- `smoothstep(a, b, x)` при `a > b` возвращает 0 на Windows (ANGLE/D3D) — пиши `1.0 - smoothstep(b, a, x)`.
- `ShadowMaterial`/декаль в доле миллиметра над полом теряет depth test внутри post-processing → `polygonOffset`.
- Квад в земле с зеркальным маппингом отсекается как задняя грань → `DoubleSide`.
- Один NaN-пиксель через bloom чернит весь кадр → клампь основание каждого `pow()` в шейдере.
- GTAO на разрезанной модели: те же clipping planes на `gtao.normalMaterial`, иначе отрезанная половина возвращается бледным призраком.
- Bloom съедает детали: эмиссия < 1.0, выше — только в hero-момент.
- Глянцевый металл под низким светом даёт белые полосы: roughness ≥ 0.45, `envMapIntensity ≈ 0.5` на больших поверхностях.

## 9. Вкус в цифрах (teardown + claude-motion)

- Easing: входы `cubic-bezier(0.16,1,0.3,1)`, выходы `cubic-bezier(0.6,0,0.9,0.35)` вдвое короче входа, состояние→состояние `cubic-bezier(0.65,0,0.35,1)`. Linear — только непрерывное движение.
- Машина занимает 60–70 % своего окна. Подписи не меньше 34 px на кадре 1080.
- Один акцент, и он что-то значит: деталь, которая работает сейчас.
- Ничего мёртво-статичного: всегда живёт хотя бы один элемент.
- Удержание читаемого состояния: 1 с на короткую фразу + 0,25 с на каждое слово сверх трёх.
- Главы + одна строка подписи на шаг + выноски с реальными числами — симуляция читается как объяснение, а не «красивость».

## 10. Чек-лист ревью (смотри листы кадров каждого рендера)

`--stills` на каждом бите тура через 0,3 с после него, плитки с подписью `t=`. Проверь:
- **Механизм:** всё, что должно касаться, касается; ничто ни сквозь что не проходит; числа на панелях совпадают с позой.
- **Композиция:** одна точка фокуса; ничего важного ближе 60 px к краю; подписи не закрывают то, что называют.
- **Текст:** ничего не обрезано; главное показание читается на ширине телефона.
- **3D:** bloom, белые пересветы, полосы на металле (см. §8).
- **Тайминг:** каждое состояние держится достаточно (§9).
Переходы — шагом 0,2 с; финал — лист кадров из **закодированного** MP4 (видно то, что записал энкодер).
