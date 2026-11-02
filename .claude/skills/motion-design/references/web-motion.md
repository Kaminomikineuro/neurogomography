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
