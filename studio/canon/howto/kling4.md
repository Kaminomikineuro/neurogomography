# Kling 4.0 — правила работы, промпты и лайфхаки
### Под аниме-адаптацию «Белой крови» · версия 1 · 19 октября 2026

Собрано из официального руководства Kling 4.0 (опубликовано 14.10.2026) и разборов fal, Atlas Cloud, each::labs, PixVerse. Где правило официальное — помечено **[офиц.]**, где это опыт сторонних тестеров — **[практика]**, где моя рекомендация под наш проект — **[для нас]**.

Интерфейс ещё раскатывается, параметры могут отличаться от описанного. Перед важной генерацией сверяйся с тем, что видишь на экране.

---

## 1. Что такое Kling 4.0 — коротко

| Параметр | Kling 4.0 | Kling 4.0 Flash |
|---|---|---|
| Длина одной генерации | 3–30 с, шаг 1 с, по умолчанию 10 с | 3–20 с |
| Разрешение | 720p / 1080p / 4K | 720p |
| Для чего | финальные кадры, длинные дубли, Omni Reference, редактирование | быстрые черновики и перебор вариантов |
| Звук | стерео, липсинк | нативный звук |

Остальное **[офиц.]**:
- форматы кадра: 21:9 / 16:9 / 1:1 / 9:16 / Auto;
- промпт до 8 000 токенов;
- до 10 ключевых кадров;
- до 15 референсов в одной задаче;
- мультикадр (несколько планов в одной генерации) включён по умолчанию — модель сама режет на планы.

**[для нас]** Flash — для проб, полная версия — для чистовых дублей. Может ли Flash работать с мультикейфреймами, не гарантировано: проверь в интерфейсе.

---

## 2. Два режима: Omni Reference и Keyframes

**Главное правило [офиц.]: возможности двух режимов нельзя совместить в одной задаче.**

| | **Omni Reference** | **Keyframes** |
|---|---|---|
| Когда | есть картинки/видео-референсы или только идея | ключевые моменты уже нарисованы и должны попасть в кадр точно |
| Что контролирует | внешность, стиль, действия, движение камеры | расположение ключевых моментов на таймлайне |
| Что можно загрузить | картинки, видео, голоса, элементы | **только картинки** |
| Точность | держит «тот же персонаж, тот же мир» | держит «вот этот кадр пиксель в пиксель» |

### Простыми словами

- **Референс** хранит то, что должно **сохраняться** весь клип: лицо, волосы, одежду, локацию, свет, палитру.
- **Ключевой кадр** задаёт, как кадр должен **выглядеть в конкретную секунду**: начало, поворот, финал.

### Omni Reference — режим по умолчанию [офиц.]
- Самый полный режим. Внутри него тоже доступны текст-в-видео и кейфрейм-в-видео (первый кадр).
- **Лимиты:**
  - картинки — до 10 шт., ≤ 30 МБ, соотношение сторон 2:5–5:2;
  - видео — до 5 шт., каждое 3–30 с, в сумме ≤ 30 с, ≤ 300 МБ;
  - голоса — до 3 профилей, запись 5–30 с;
  - элементы — до 7 (из них до 3 видео-элементов, исходник 3–8 с);
  - всего — не больше 15 референсов.
- Референс-видео, видео для редактирования и видео-элементы делят одну квоту: до 5 клипов и до 30 с в сумме.

### Keyframes [офиц.]
- Первый кадр, последний кадр, первый + последний, промежуточные кадры в любой точке таймлайна — всего до 10.
- Референсы загружать **нельзя**.
- Если картинки загружены, соотношение сторон берётся с первого кейфрейма.
- Подходит для: действие к определённой секунде, вход и выход персонажа, смена сцены (небо темнеет к 5-й секунде), переход от общего плана к крупному, превращение из состояния А в состояние Б.

### Как выбрать режим под кадр [для нас]

| Ситуация в нашей раскадровке | Режим |
|---|---|
| Диалог Лиама и Повелителя, нужны их лица | Omni (референсы героев) |
| Дуэль, бой спина к спине, хореография | Omni (герои + видео-референс движения) |
| Цепочка из нескольких планов одной сцены | Omni (мультикадр, до 30 с) |
| Кадр от GPT, композиция должна совпасть точно (удар меча в камень 3.11, дракончик на коленях 13.13) | Keyframes (первый кадр) |
| Превращение: тело → туман → дракон (10.3–10.4), дракон → человек (11.4) | Keyframes (первый + последний кадр) |
| Общие планы E1–E5, животные | любой; если кадр от GPT удачный — Keyframes |

---

## 3. Как писать промпт — официальные правила

### 3.1. Описывать, а не оценивать [офиц.]
Пиши конкретные визуальные детали, минимум абстракций и запретов. Чем меньше модели приходится угадывать, тем лучше.

| ❌ Не надо | ✅ Надо |
|---|---|
| «premium look» | боковой контровой свет обводит края, фон размыт |
| «эпичная битва» | пыль поднимается стеной, по камню бегут трещины |
| «не показывай лицо» | герой снят в профиль |

### 3.2. Негативы — почти не нужны [офиц.]
Негативные инструкции повышают шанс ошибки. Обязательны только две: **«no subtitles» и «no background music»** — модель может добавить их сама.

Исключение для стиля **[офиц.]**: если задан аниме-стиль, **явно исключай фотореализм**, иначе стили смешаются.

**[для нас]** Длинный негативный список, как в Pixverse, для Kling 4.0 не тащим. Вместо этого — позитивные ограничения (п. 3.6).

### 3.3. Каждому референсу — одна роль [офиц.]
Файлы нумеруются по порядку загрузки: @Image1, @Image2, @Video1. Если указать только номер без роли, модель сама додумает, что из него брать, — результат непредсказуем.

```
@Image1 defines the scene. Preserve its spatial layout and lighting.
@Image2 defines Liam. Preserve his face, long white hair, violet-green eyes and clothing.
Reference only the fight choreography and attack timing of @Video1, not its setting or style.
```

Если референсы несут разную информацию — указывай границы роли и что **не** переносить.

**[практика]** Порядок загрузки влияет на результат: смена порядка тех же картинок давала другой итог. Держи порядок стабильным во всех шотах: @Image1 всегда Лиам, @Image2 всегда Повелитель и т. д.

**[практика]** Одно и то же короткое описание персонажа вставляй в каждый шот без изменений.

### 3.4. Базовая структура Omni-промпта [офиц.]

```
[Asset Roles]
@Image1 defines ___; preserve its ___.
@Image2 defines ___; preserve its ___. Reference the ___ of @Video1.

[Overall Settings]
Scene and texture: ___; visual style: ___; camera tone: ___.

[Sequence of Events]
0–X s: ___ (visuals + action + emotion)
X–Y s: ___ (camera movement + details)
Y s–end: ___ (closing shot)

[Audio]
Dialogue/voiceover + ambience + music + SFX
```

Официальная формула для коротких клипов: **Subject + Action + Setting + Camera + Lighting + Pacing + Sound.**

**[практика]** Чаще всего забывают **Pacing** (темп). На длинном клипе без него действие размазывается равномерно, и 30 секунд выглядят как растянутые 10. Пиши прямо: «медленное нарастание, резкая склейка на раскрытие, держим финальный кадр».

### 3.5. Длинная сложная сцена — 15-блочный шаблон [офиц.]
Kling в своих примерах для 15–30 с использует такие блоки (можно не все):

1. **SCENE CONTEXT** — что происходит, сколько персонажей: `EXACTLY 1 DRAGON — NO DUPLICATES`
2. **ACTIVE REFERENCES** — роль каждого @-файла
3. **LOCATION MAP** — где что стоит, направление движения, с какой стороны камера
4. **FIRST FRAME AND SPATIAL BLOCKING** — что в кадре на 0.0 с
5. **FORMAT MODE** — сколько планов, тайминги склеек, «no fades or dissolves»
6. **OPTICS** — объектив/угол обзора по планам
7. **CAMERA** — движение камеры по планам
8. **ACTION TIMING** — посекундно
9. **PHYSICS** — вес, инерция, как ведут себя ткань, волосы, пыль
10. **LIGHTING** — источник света и его направление
11. **AUDIO** — диалог, шумы, музыка
12. **CHARACTER ACTING** — эмоции, взгляд, мимика
13. **STYLE** — стиль и палитра (можно в процентах: 60 / 30 / 10)
14. **QUALITY** — что должно оставаться стабильным
15. **POSITIVE CONSTRAINTS** — что обязательно должно быть, и что считается провалом

Приёмы из официальных примеров:
- **Счёт объектов:** «exactly one dragon: one head, two wings, four legs, one tail». Это лечит дубли и лишние конечности.
- **Критерий провала:** «…an extra limb or changing hair color equals a failed shot».
- **Карта направлений:** «direction of travel always runs from the mountain toward the city». Камера не перепрыгивает ось.

### 3.6. Мультикадр внутри одной генерации [офиц.]
- В Omni мультикадр включён по умолчанию, модель сама режет на планы.
- **Нужен один непрерывный план** — пиши прямо: `one continuous shot, no cuts, no angle changes`.
- **Нужны склейки** — нумеруй планы с таймингом: `SHOT 1 — 0.0–4.0s: … SHOT 2 — 4.0–9.0s: …`, указывай тип склейки (`hard cuts`, `no fades or dissolves`).

### 3.7. Раскадровка как референс [офиц.]
Можно загрузить **лист раскадровки** — то, что рисует GPT, — и попросить снять по нему:

```
Reference the character design in @Image1 and use the storyboard in @Image2 as the director-approved sequence of shots, framing, camera paths, screen direction and emotional progression. Recreate the finished anime frames described in each panel. Do not render the storyboard itself. Avoid pencil-sketch textures, grids, panel borders, captions and director's notes.
```

**[для нас]** Это прямо наш конвейер: общий лист раскадровки от GPT + референсы героев → одна генерация на сцену.

### 3.8. Кейфреймы — как писать [офиц. + практика]
- Формат: `Use @Image1 as the first frame and @Image2 as the last frame, then describe the process in between.`
- **Кейфреймы показывают важные моменты, промпт объясняет, как видео движется между ними.** Не описывай заново то, что уже нарисовано на кадре.
- Пиши по тому же таймлайну, сегментами: `0–5s: …, 5–12s: …`.
- Официально названные ошибки:
  - слишком много кейфреймов;
  - слишком много изменений внутри одного кейфрейма;
  - несогласованные референсы;
  - промпт противоречит порядку кейфреймов (в тексте событие на 10-й секунде, а кадр стоит на 6-й).
- **[практика]** В примере Kling на 30-секундный ролик — 5 кейфреймов, не 10.
- **[практика]** Тест на удаление: убери кадр мысленно. Если без него не теряется важное видимое состояние — он не нужен. Почти одинаковые кадры только мешают.

### 3.9. Камера [офиц. + практика]
- Отдельного параметра камеры нет, камера управляется словами.
- Лучше всего держатся: push-in, pull-out, pan, tracking, orbit.
- Используй реальную операторскую лексику: `slow push in`, `orbit left around the subject`, `locked-off wide shot`.
- Описывай движения **в том порядке, в каком они происходят**, и привязывай к биту: «начинаем с крупного рук, наклон вверх к лицу, затем отъезд на общий, когда он встаёт».
- «Dynamic cinematic camera» — это не указание, а надежда.

### 3.10. Диалог и звук [офиц.]
- Реплику пиши **в кавычках на нужном языке** и указывай, кто говорит.
- Для голоса — возраст, тембр, скорость, эмоция, на каких словах ударение.
- Добавляй действие и мимику вокруг реплики: строчка без режиссуры просто прочитается, с режиссурой — сыграется.
- Звук модель генерирует в любом случае. Называй атмосферу, шумы и есть ли музыка.

⚠️ **Русского нет в списке поддерживаемых языков.** Официально: китайский, английский, японский, корейский, испанский, португальский, немецкий, французский, хинди «и другие». Русский липсинк не гарантирован.

**[для нас]**
- Голоса пишем отдельно и накладываем при монтаже, как и планировали.
- В промпте: `SFX and ambience only, no music, no dialogue, no subtitles` или «персонаж говорит, губы двигаются» без текста реплики.
- Для 2–3 ключевых реплик можно протестировать русский в кавычках и сравнить.

### 3.11. Редактирование готового видео [офиц.]
Можно точечно поправить дубль: мимику, движение, ракурс, фон, стиль.
- Писать именно **`Edit @Video1`**. Если написать «Reference @Video1», модель сгенерирует новое видео по мотивам.
- Обязательно добавлять **`Keep everything else unchanged`**, иначе поплывёт и остальное.

```
Edit @Video1. Change the character's hair to long pure white hair as in @Image1. Keep everything else unchanged: camera, motion, timing, background, lighting.
```

**[для нас]** Спасает дубли, где всё хорошо, кроме одной детали: цвет волос, светится не тот глаз, лишняя заколка.

### 3.12. Creative Recreation [офиц.]
Берёт темп, композицию и подачу из видео-референса и подставляет твоих персонажей и сцены: `Replace the element in @Video1 with @Image1. Keep everything else unchanged.` Чем ближе референс по темпу и структуре планов, тем легче.

**[для нас]** Удобно, чтобы взять удачное движение камеры или хореографию из нашего же прошлого дубля.

### 3.13. Текст в кадре [офиц.]
Kling 4.0 стабильно рисует текст на нескольких языках. Для титров указывай размер, положение, время показа. **[для нас]** Титры и название серии делаем в монтаже — так надёжнее и правится без перегенерации.

---

## 4. Аниме: что важно именно нам [для нас]

1. **Стиль и запрет фотореализма в каждом промпте:**
   `2D anime TV series style, clean cel shading, crisp lineart, flat colors with soft limited gradients, hand-drawn animation look. Not photorealistic, not a 3D render, not live action.`
2. **Не копировать «киношные» хвосты из официальных примеров** (film grain, handheld shake, old-photograph texture, 35mm). Они тянут в живое кино. Для аниме — стабильная камера, плавные движения.
3. **Все референсы — в одном стиле.** Если лист Лиама от GPT в аниме-стиле, а фон фотореалистичный, модель смешает стили.
4. **Счёт объектов** в сложных кадрах: `exactly 2 characters: Liam and the Dragon Lord. Exactly one black dragon: one head, two wings, four legs, one tail.`
5. **Наши визуальные каноны — в блок POSITIVE CONSTRAINTS:**
   - светится только правый глаз Лиама;
   - кровь драйков серебристая;
   - у Повелителя тёмно-бордовая;
   - пламя дракона чёрное;
   - Лиам на полголовы ниже;
   - солнце красное, небо ржаво-красное с белыми облаками.
6. **Модерация.** Kling критикуют за жёсткий фильтр. Тела на кургане — силуэтами и в тени, кровь без деталей. Если генерация падает без причины — переформулируй невинно звучащие, но двусмысленные слова.
7. **Элементы.** Сделай элементы один раз и используй всю серию: Лиам, Повелитель, чёрный дракон, птица Рух, дракончик. Это 5 из 7 слотов.

---

## 5. Порядок работы над шотом [для нас]

1. Определи режим: нужна точная композиция → Keyframes; нужны лица и движение → Omni.
2. **Черновик на Flash**, 720p, короче чистовика. Проверь:
   - лица и волосы держатся;
   - порядок действий верный;
   - нет лишних конечностей и дублей;
   - финальная композиция та.
3. **Меняй одну вещь за раз.** Не попало — найди, какой слой промпта сломан (персонаж, действие, камера, свет), и правь только его.
4. Чистовик на полной версии.
5. Хороший дубль с одной ошибкой — **Edit @Video1**, а не новая генерация.
6. Удачный промпт сохраняй в библиотеку — он станет шаблоном для похожих шотов.

---

## 6. Готовые промпты под нашу раскадровку

### 6.1. Omni: дуэль (шоты 5.1–5.13) одной генерацией

Загрузка:
- @Image1 — лист Лиама;
- @Image2 — лист Повелителя;
- @Image3 — фон: площадь восточного поста;
- @Video1 — референс хореографии (если есть).

Длительность 20 с, 16:9.

```
SCENE CONTEXT: EXACTLY 2 CHARACTERS — NO DUPLICATES. A sword duel between a young white-haired drayk lord and the black-haired Dragon Lord on an empty red stone battlefield. 20 seconds, 6 shots, real time.

ACTIVE REFERENCES:
@Image1 defines Liam. Preserve his face, long white hair, violet-green eyes, clothing and the sword with a red ruby on the hilt.
@Image2 defines the Dragon Lord in human form. Preserve his face, long black hair with a pair of silver hairpins, black fitted suit and black steel sword.
@Image3 defines the location: red rocky battlefield, rust-red sky with white clouds, blazing red sun. Preserve its layout and light.
Reference only the fight choreography and attack timing of @Video1. Do not take its setting, characters or style.

LOCATION MAP: The red sun stays low on frame-left in every shot. Liam attacks from frame-left toward frame-right; the Dragon Lord holds his ground on frame-right. The camera never crosses the axis between them.

FORMAT MODE: 6 shots, hard cuts, no fades or dissolves.
SHOT 1 — 0.0–2.5s: first clash.
SHOT 2 — 2.5–6.0s: Liam slides back across the sand, the Lord steps back half a step.
SHOT 3 — 6.0–9.0s: slow motion, the black blade passes over Liam's face, a few white hairs are cut.
SHOT 4 — 9.0–13.0s: Liam turns his blade to reflect the red sun into the Lord's eyes, spins and kicks up rust-red dust.
SHOT 5 — 13.0–17.0s: three fast strikes, two parried, the third dodged; the Lord catches the next thrust with his sword guard.
SHOT 6 — 17.0–20.0s: a grazing counter-blow, Liam's sword spins away into the sand.

CAMERA: Shot 1 medium two-shot, static. Shot 2 lateral tracking with Liam. Shot 3 close-up, slow motion. Shot 4 medium, slight push-in. Shot 5 three quick medium cuts. Shot 6 wide, static, the sword falls into frame.

PHYSICS: The Dragon Lord moves minimally and precisely, almost lazily, barely shifting his feet. Liam's strikes are sharp and angular and grow shorter and slower as he tires. Each impact jolts Liam's arms. Sand sprays from sliding boots. Hair and coat react to wind and motion with slight delay.

LIGHTING: Harsh red sunlight from frame-left, long hard shadows, red dust glowing in the air.

CHARACTER ACTING: The Lord stays calm with faint curiosity, never angry. Liam is focused and exhausted, breathing hard, but never afraid.

AUDIO: Steel clashes synchronized with every impact, sliding sand, wind, Liam's ragged breathing. No dialogue, no music, no subtitles.

STYLE: 2D anime TV series style, clean cel shading, crisp lineart, flat colors with soft limited gradients, speed lines and impact frames on clashes. Palette: 60% red and rust, 30% black, 10% white hair and steel highlights. Not photorealistic, not a 3D render, not live action.

POSITIVE CONSTRAINTS: Exactly two characters in every shot. Liam is half a head shorter than the Dragon Lord. Liam's hair stays pure white, the Lord's stays black with two silver hairpins. Only swords, no magic effects. A third person, changing hair color, an extra limb or a sword passing through a body equals a failed shot.
```

### 6.2. Keyframes: превращение в дракона (шоты 10.3–10.4)

Загрузка:
- @Image1 — Повелитель у края разлома (кадр GPT);
- @Image2 — чёрный дракон в той же композиции (кадр GPT).

8 с.

```
Use @Image1 as the first frame and @Image2 as the last frame. One continuous shot, no cuts, locked-off low-angle camera.
0–3s: the man's body dissolves outward into thick black mist, starting from his hands and coat edges.
3–6s: the black mist expands rapidly and covers the horizon, swirling.
6–8s: the mist condenses into the colossal four-legged winged dragon; the wings unfold last; edges of the scales keep dissolving into mist. Hold on the final frame.
Exactly one figure, then exactly one dragon: one head, two wings, four legs, one tail.
2D anime TV series style, clean cel shading, not photorealistic, not a 3D render.
Audio: low rumble rising to a deep exhale. No music, no subtitles.
```

### 6.3. Omni по раскадровке GPT: холодное открытие E1–E5

Загрузка:
- @Image1 — лист раскадровки открытия;
- @Image2 — референс-кадр города в скале.

25 с.

```
Use the storyboard in @Image1 as the director-approved sequence of shots, framing and camera paths. Recreate the finished anime frames described in each panel. Do not render the storyboard itself; no sketch textures, grids, panel borders or captions.
@Image2 defines the capital: a city carved into a red rock massif with white stone inserts and a faint shimmering protective dome. Preserve its architecture.
5 shots, hard cuts:
SHOT 1 — 0–5s: endless red rocky desert, rust-red sky with white clouds, red sun, very slow pan right.
SHOT 2 — 5–10s: red coastal ridge above almost black sea water, a small outpost on the far crest, slow forward glide.
SHOT 3 — 10–15s: aerial flight over ridges toward the rock massif.
SHOT 4 — 15–21s: the carved city, red sand blowing between the tiers, slow push-in.
SHOT 5 — 21–25s: low angle on the castle, banners with a winged sword emblem whipping in the wind, slow tilt up.
No people in focus.
2D anime TV series style, painted backgrounds, not photorealistic.
Audio: wind, distant surf in shot 2, distant city hum in shot 4. No music, no subtitles.
```

---

## 7. Короткая шпаргалка

- [ ] Режим выбран: Omni (лица, движение, мультикадр) или Keyframes (точная композиция). Вместе нельзя.
- [ ] У каждого @-файла названа роль и что из него не брать.
- [ ] Порядок загрузки одинаковый во всех шотах.
- [ ] Описание героя вставлено одно и то же, без вариаций.
- [ ] Таймлайн по секундам, одно действие на бит.
- [ ] Темп назван.
- [ ] Камера — реальными терминами, в порядке событий.
- [ ] Один план → «one continuous shot, no cuts». Несколько → SHOT 1/2/3 с таймингом.
- [ ] Аниме-стиль + «not photorealistic, not a 3D render».
- [ ] Счёт персонажей и объектов.
- [ ] `no subtitles, no music`, если не нужны.
- [ ] Русские реплики не полагаемся на липсинк — голос отдельно.
- [ ] Черновик на Flash → чистовик → точечная правка через `Edit @Video1`.

---

## Источники

- [Kling 4.0 User Guide (официально)](https://kling.ai/quickstart/kling-4-model-user-guide)
- [Kling 4.0 Model Release (официально)](https://kling.ai/dev/model-release/kling-4)
- [Kling 4.0 vs 3.0 (блог Kling)](https://kling.ai/blog/kling-4-vs-3)
- [fal — Kling 4.0](https://fal.ai/kling-4)
- [Atlas Cloud — референсы и кейфреймы Kling 4](https://www.atlascloud.ai/blog/tips/kling-4-reference-images-and-keyframes)
- [each::labs — Kling 4.0 Prompting Guide](https://www.eachlabs.ai/blog/kling-4-0-prompting-guide)
- [PixVerse — Kling 4.0 vs 3.0](https://pixverse.ai/en/blog/kling-4-vs-kling-3)
- [Screenweaver — Prompting Kling](https://www.screenweaver.ai/blog/prompting-kling-guide)
