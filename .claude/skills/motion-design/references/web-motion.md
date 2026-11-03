# Web-motion: интерфейсы, лендинги, скролл, 3D-сайты

Маршрут C — анимация, которая живёт в браузере, а не рендерится в MP4. Правила движения берутся из
elayadesign/ai-design-skills (`landing-page-design` B7, `figma-designer` Motion) и библиотек «промпт-компонентов»
(prompt-motion и аналоги: motionprompts.dev — GSAP-скролл, WebGL-герои, текстовые reveal, меню, слайдеры,
прелоадеры, каждый с демо и проверенным промптом).

## 1. Базовые правила (elayadesign)

- Кривая `cubic-bezier(0.22,1,0.36,1)`; 500 мс — позиция/лейаут, 300 мс — цвет/прозрачность; не короче 200 мс.
  Никогда `ease`, `linear`, `ease-in-out` по умолчанию.
- Анимируются только `transform` и `opacity`.
- `@media (prefers-reduced-motion: reduce)` → без движения, только смена прозрачности.
- Scroll-reveal: `IntersectionObserver` / Framer Motion `whileInView` / GSAP ScrollTrigger; никогда «голый» `scroll`-listener.
- Мобильное меню — полноэкранная панель с сильным blur; иконка бургер ↔ крестик морфится.
- Все интерактивные состояния: hover, active `scale(0.98)`, видимый focus, skeleton-loading, пустое и ошибочное состояния.

## 1a. Бюджет движения страницы (taste-skill, измерено на 99 сайтах Awwwards)

Источник: [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) (MIT), скилл `design-taste-frontend` —
«анти-слоп» арт-дирекция: скрипт раздаёт 3 исследованных направления из 20 (по 247 сайтам), ты выбираешь то, что
несёт идею предмета, инспектор в браузере проверяет правила. Установка: `npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"`.

Моушн — **последний** проход, когда статичная страница уже хороша. Пять частей:
1. **2–3 скролл-сцены** (камера сквозь поле картинок, картинка растёт из окна на весь экран, текст пересекает удерживаемую сцену, карточки раздаются и складываются) — здесь страница смелая.
2. **Один фирменный момент** — то, что посетитель опишет через час; единственное «громкое» движение.
3. **Входы секций по порядку чтения:** заголовок → текст → картинка → детали, stagger 60–90 мс, подъём 16–32 px + opacity, один раз. Манера зависит от содержания (список — построчно, картинка — из маски, цифра — счётчиком).
4. **Отклик под рукой:** нажатие, hover, focus на всём интерактивном.
5. **Одна движущаяся картинка:** клип-луп без звука с постером, медленный дрейф/масштаб фото или scroll-linked движение героя.

Цифры: длительности hover-цвет 200–300 мс, мелкий UI 300–450, раскрытия 600–1000, открытия картинок и шторки
1100–1600 (медиана всего — 420 мс); stagger символы 20–40 мс, строки 75–120, пункты 50–100. Scroll-linked движение
**привязано к скроллбару без сглаживания** (14 из 18 сайтов); раскрытия срабатывают, когда верх элемента на 80–95 %
высоты окна, один раз. **Без прелоадера:** сообщение читается с первого кадра, загрузочная последовательность ≤ 1,2 с.
Пины: не больше двух удерживаемых сцен, ~1 экран на шаг, 3 экрана на сцену. Длительности по частоте показа:
нажатие 100–160 мс, hover 150–200, меню 150–250, диалоги 250–450, раскрытия 500–900; уход ≈ 70 % прихода.

**Токены:** `--ease-out: cubic-bezier(0.22,1,0.36,1)`, `--ease-expo: cubic-bezier(0.16,1,0.3,1)` (≥ 800 мс),
`--ease-in-out: cubic-bezier(0.76,0,0.24,1)` (шторки), `--ease-soft: cubic-bezier(0.33,1,0.68,1)` (дрейф фото),
`--ease-exit: cubic-bezier(0.55,0.055,0.675,0.19)`; `--t-press 140ms`, `--t-hover 180ms`, `--t-ui 240ms`,
`--t-reveal 800ms`, `--t-open 1200ms`, `--stagger-line 90ms`, `--stagger-item 70ms`.

**Домашние правила taste-skill** (проверяются инспектором): заголовки ≤ 2 строк на любой ширине; ясный заголовок
на первом экране и у каждой секции; равные внешние поля; без пустых участков выше полэкрана; без «бровей» (мелких
лейблов над заголовком), моноширинного вне кода, нумерации 01/02/03, тонких линеек, градиентов, теней в покое,
стекла, эмодзи, карточек с иконками в ряд; ≤ 2 гарнитур. Удалённый орнамент заполняется масштабом, полным
содержанием, картинкой этого предмета или полем цвета — не другим орнаментом. **Идея из предмета:** «На этой
странице **[то, что принадлежит только предмету]** становится **[приёмом направления]**» + «тест конкурента».
**Одна живая вещь** — то, что посетитель может сделать с реальным содержанием (выбрать дерево и увидеть стул в нём).

> Конфликт с elayadesign (§1) и нашими стилями: taste-skill запрещает градиенты, стекло и моноширинный — это
> правила для **сайтов** в его «домашнем стиле». В видео-стилях (aurora glass, HUD) эти приёмы — сигнатура стиля.
> Выбирай свод правил по задаче и не смешивай.

## 2. Стек и когда что

| Задача | Инструмент |
|---|---|
| React-компоненты, жесты, layout-анимации | Framer Motion (`motion`): `layout`, `AnimatePresence`, `useScroll`, `useSpring` |
| Таймлайны, скролл-сторителлинг, SVG, текст | GSAP 3 (бесплатен целиком, включая SplitText, MorphSVG, ScrollTrigger, DrawSVG) |
| Плавный скролл | Lenis (+ `ScrollTrigger.update` в его колбэке) |
| 3D-герой, частицы, шейдеры | Three.js / React Three Fiber + drei; post-processing |
| Векторные анимации от дизайнера | Lottie (`lottie-web`/`dotlottie`) — экспорт из AE через Bodymovin |
| Интерактивные state-машины | Rive |
| Нативные переходы страниц | View Transitions API (`document.startViewTransition`) + CSS scroll-driven animations (`animation-timeline: view()`) |

## 3. Рецепты

**Пословный reveal заголовка (GSAP):**
```js
gsap.registerPlugin(SplitText, ScrollTrigger);
const split = SplitText.create('.hero h1', { type: 'words,chars', mask: 'words' });
gsap.from(split.words, { yPercent: 110, duration: 0.9, ease: 'expo.out', stagger: 0.04,
  scrollTrigger: { trigger: '.hero', start: 'top 80%' } });
```

**Пин-сцена со скролл-таймлайном:**
```js
const tl = gsap.timeline({ scrollTrigger: { trigger: '.story', start: 'top top', end: '+=2000', scrub: 1, pin: true } });
tl.to('.phone', { rotateY: 25, scale: 1.1 }).to('.caption-1', { autoAlpha: 0 }, '<').from('.caption-2', { y: 40, autoAlpha: 0 });
```

**Framer Motion stagger:**
```jsx
const list = { show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } } };
<motion.ul variants={list} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }}>
  {items.map(i => <motion.li key={i.id} variants={item}>{i.label}</motion.li>)}
</motion.ul>
```

**Магнитная кнопка / курсор:** `useSpring` от позиции курсора, жёсткость 150, демпфирование 15, смещение ≤ 30 % от размера.

**Пословная подсветка «tagline reveal» (elayadesign B11):** текст стартует 25–35 % непрозрачности, каждое слово
переходит к 100 % по базовой кривой при пересечении линии-триггера, по порядку чтения; reduced-motion → сразу 100 %.

## 4. Промпт-компонент (формат библиотек prompt-motion)

Когда пользователь хочет «как на том сайте» или собрать набор эффектов, пиши компонент как самодостаточный промпт:
```text
Build <component> in <React+Tailwind | vanilla HTML>.
Behaviour: <что происходит, с триггером: on load / on scroll 0–100% of section / on hover>.
Motion spec: duration <ms>, ease <cubic-bezier>, stagger <ms>, distances <px>, pin <yes/no>, scrub <value>.
Libraries: <GSAP 3.x + ScrollTrigger | framer-motion | three r1xx>, imported from npm.
Accessibility: prefers-reduced-motion fallback = <...>; keyboard focus visible; no layout shift.
Performance: transform/opacity only; will-change only during animation; no unthrottled scroll listeners; 60 fps on mid phone.
Deliver: one file, props for content/colours, a demo with realistic copy (no lorem ipsum).
```

## 5. Экспорт web-анимации в видео

Любую web-анимацию можно отрендерить маршрутом A: оберни таймлайн в `renderAt(t)` (`tl.pause(); tl.seek(t)`),
для скролл-сцен — маппинг `t → scrollProgress`. Так получаются промо-ролики продукта из живого интерфейса.

## 6. Кинематографичный скролл: GSAP + Lenis (MengTo `cinematic-gsap-lenis-motion-system`, MIT)

Вкус: плавно, элегантно, с лёгкой задержкой; **без bounce/elastic/spring, больших скачков масштаба и «игровых» эффектов**.
Установка оригинала: `npx skills add MengTo/Skills --skill cinematic-gsap-lenis-motion-system`.

```js
const lenis = new Lenis({ lerp: 0.08, smoothWheel: true, wheelMultiplier: 0.9, anchors: true });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add(t => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0);
gsap.defaults({ ease: 'power3.out', duration: 0.85 });
// под prefers-reduced-motion Lenis не создаётся вовсе
```
**Токены:** кривые `power3.out` / `power4.out` / `expo.out`; scrub 0,8–1,4; раскрытия 0,75–1,1 с; hover 0,35–0,6 с;
лаг курсора 0,25–0,45 с; stagger слова 0,035–0,07, строки 0,08–0,14, карточки 0,06–0,1; триггер `start: 'top 82%'`
(84 % для одиночных), `once: true`; пины `anticipatePin: 1`.
**Рецепты:**
- Маска слов: слова в `overflow:hidden` inline-block; from `{yPercent: 110, autoAlpha: 0, filter: 'blur(8px)'}`, 0,9 с `power4.out`, stagger 0,055; строки — yPercent 100, 1 с, stagger 0,11. `aria-label` = полный текст, маски `aria-hidden`.
- Раскрытие картинки: `clipPath: inset(0 0 100% 0) → inset(0)` 1,1 с `power4.out` + img scale 1,08 → 1 (1,2 с).
- Параллакс: картинка 115 % высоты, `y: -innerHeight * 0.18`, `ease: 'none'`, scrub 1,2.
- Горизонтальная галерея: пин, `x: -(scrollWidth - innerWidth)`, scrub 1.
- Стопка карточек: `position: sticky; top: 12vh`; пока приходит следующая — `scale .92 + i*.015, autoAlpha .72, y -24` (scrub).
- Прелоадер (если он вообще нужен — см. taste-skill): полоса `scaleX 0→1` 1,1 с, затем `yPercent: -100` 0,9 с `power4.inOut`.
- Магнит: `gsap.quickTo(el, 'x', {duration: .45, ease: 'power3.out'})`, сила 0,18, scale < 1,03, наклон карточки < 4°.
- **Скролл-синхронное движение — линейное (`ease: 'none'`), а внутри сцены — свои eased-раскрытия.**
- Хореография: герой = медиа → строки заголовка → текст → CTA; секции = метка → заголовок → медиа → карточки. Одна идея на пин-экран.

## 7. Scroll-мир на Three.js (MengTo `build-threejs-scroll-worlds`, `scroll-world-storytelling`)

- **Один постоянный мир + одно нормированное обратимое состояние скролла**, никогда не рендерер на главу.
- **Реестр сцен как данные** (4–8 глав): `{id, scrollWeight, copy, camera{position, target, fov, mobile}, world{fog, particles, grade}, focus[]}`. Отвергай главу, которая отличается только текстом.
- **Два значения прогресса:** `exact` (UI, навигация, доступность взаимодействий) и `smooth = damp(smooth, exact, λ=5.2, dt)` где `damp = cur + (tgt − cur)·(1 − e^(−λ·dt))` — только для камеры/визуала. Никогда не интегрируй дельту колеса: та же позиция скролла = то же состояние вперёд/назад/после перезагрузки.
- **Камера как операторская работа:** сначала скомпонуй каждую конечную точку на десктопе и телефоне; две центростремительные Catmull-Rom кривые (позиции, цели) + lerp FOV по сегменту; `lookAt`; «шесть наездов в один центр — не шесть сцен».
- Бюджеты моб./десктоп: DPR 1,25–1,5 / 1,5–2; треугольники 150–300k / 0,5–1,2M; draw calls 50–90 / 90–160; тени 1–2 / 2–4 света. Губернатор качества: понижение после 120 кадров > 22 мс, без осцилляций.
- **Сюжет из статьи (5–7 битов):** Крючок → Старый способ → Новое правило → Механизм → Доказательство → Выигрыш → Действие; вес скролла бита 0,7–1,8 высоты окна; CTA только в последнем.
- **Режим «видео-скраб»** (ИИ-видео → сайт): одно непрерывное движение камеры 6–15 с без склеек; кодирование под скраб:
  `ffmpeg -i src.mp4 -an -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -g 8 -keyint_min 8 -sc_threshold 0 -movflags +faststart out.mp4`;
  поиски `currentTime` объединяй в rAF; постер до первой отрисовки. Наш отрендеренный MP4 можно так же превратить в скролл-героя.

## 8. Эффекты-рецепты (MengTo; переносимы в `renderAt` — время бери из `t`, не из rAF)

| Эффект | Техника | Ключевые параметры | Где |
|---|---|---|---|
| Бумага горит (переход) | полноэкранный проход: подписанное расстояние до шумного фронта выбирает старый кадр / горящую полосу / новый | 3 с (1,5–5); полоса ±0,215 высоты; угли 12–66 px; ramp тёмно-красный → оранжевый → золото, **никогда белый**; фронт со стороны, где появится текст | смена главы «огнём» вместо dissolve (стили 21, 22, 25) |
| Сканирование каркаса | твёрдая модель + временная клетка `LineSegments` с общими `uScanOrigin/uScanRadius` | 3,4 с; радиус `1−(1−t)^1.35`; лаг 520, обод 135, хвост 950 u; начало вне силуэта (низ-лево) | HUD, голограмма, 3D-раскрытие продукта (стили 8, 26) |
| Лазерный клинок | гауссово ядро + ореол + рассеяние × fbm-дым вверх | ядро .0045, ореол .035 (exp 1.45), рассеяние ×5,5; пульс .9+.1·sin(1.15t) | sci-fi титры, фон |
| Bayer-дизеринг | сетка ячеек, value-noise порогом 4×4 Bayer, 3–5 ступеней моно | ячейка 7 px; `(v+.5)/16`; дрейф .018·t | 1-bit, ретро, альтернатива зерну |
| Слипающиеся капли | SVG `feGaussianBlur` + порог альфы `feColorMatrix` | blur, контраст альфы, расстояние | стиль 14 жидкость, загрузчики |
| Прогрессивный blur | ~8 слоёв `backdrop-filter` 0,5→32 px с перекрывающимися масками | удвоение blur на слой | ГРИП-полоса, tilt-shift |
| Меш-градиент | 4 радиальных точки screen-blend на #030712, дрейф sin/cos ±24/±18 px + сканлинии 1 px каждые 28 px | кобальт #1D4ED8, индиго #312E81, сталь #385A7C | дешёвый детерминированный фон (стиль 10) |
| Глобус частиц | Three.js Points: ядро (2600 т.) + кольцо (1300) additive | радиус 1,35, кольцо 2,05; наклон x −.42; rotY .12·t | «инфраструктура», данные |
