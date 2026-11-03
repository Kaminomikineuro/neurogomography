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
