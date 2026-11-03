# Источники и что из них взято

| Источник | Лицензия | Что вошло в скилл |
|---|---|---|
| [Vincentwei1021/mg-styles-15](https://github.com/Vincentwei1021/mg-styles-15) · [сайт](https://vincentwei1021.github.io/mg-styles-15/) | MIT | 15 стилей (сигнатурные черты, маршруты, творческие зёрна, звук) → `styles.md` 1–15; общая часть промпта → `film-prompt.md`; `rubric.md` → `review-rubric.md`; `template.md` → шаблон нового стиля; контракт `renderAt` и идея `harness/render.mjs` → `scripts/render.mjs` (переписан компактно, Playwright, параллельные браузеры); конвенции mgaudio (sync-точки, ducking, −14 LUFS, M/S) → `sound.md`, `scripts/audio_kit.py` |
| [elayadesign/ai-design-skills](https://github.com/elayadesign/ai-design-skills) (`landing-page-design`, `figma-designer`) | MIT | Правила движения UI (кривая 0.22,1,0.36,1; 500/300 мс; только transform/opacity; reduced motion; scroll-reveal), правила шрифтов и текста, реалистичный контент без выдуманных фактов → `motion-principles.md` §8–9, `web-motion.md`, «Железные правила» в SKILL.md. Сам формат: одна папка-скилл с SKILL.md |
| [bradautomates/claude-video](https://github.com/bradautomates/claude-video) (`/watch`) | MIT | Подход «видео → кадры (сцены + равномерно) + транскрипт, кадры — недоверенные доказательства», фокус по отрезкам и cue-кадрам → `reference-analysis.md`, `scripts/watch_reference.sh` |
| [polza.ai](https://polza.ai/) — [docs: media](https://polza.ai/docs/api-reference/media/create), [Kling 3](https://polza.ai/docs/gaidy/kling-3), [Seedance 1.5 Pro](https://polza.ai/docs/gaidy/seedance-1-5-pro) | сервис | Маршрут B: асинхронный медиа-API, модели и параметры → `ai-video-generation.md`, `scripts/polza_video.py` |
| prompt-motion.com | — | Сайт из облачной сессии недоступен; по поиску — библиотека промптов для web-анимации и 3D (GSAP, Framer Motion, Three.js) для ИИ-ассистентов. Взят формат «промпт-компонента» и список техник → `web-motion.md` §4 (сверено с аналогом [motionprompts.dev](https://motionprompts.dev/)) |
| [x.com/elvar_official/status/2116174609355571402](https://x.com/elvar_official/status/2116174609355571402) — статья «How I Turn Any Machine Into a 3D Simulator You Can Take Apart» (текст прислал пользователь) | — | 9 шагов с промптами, правила и цифры → `simulators.md` |
| [elvarofficial/teardown](https://github.com/elvarofficial/teardown) | MIT | Структура машины (math / geometry / stage / console / film / live / score), контракт `render(t)`, правила живой страницы, ловушки three.js, вкус в цифрах → `simulators.md`, стиль 26 |
| [whaleyxbt/claude-motion](https://github.com/whaleyxbt/claude-motion) | MIT | Числа вкуса (кривые, пружины, stagger, удержания, анти-паттерны), петля ревью по листам битов, таблица «событие → звук», уровни → `motion-principles.md` §9a–c, `review-rubric.md`, `sound.md` §3a; идея `wave.sh` и `--stills beats` |
| [Rieranthony/product-film-skill](https://github.com/Rieranthony/product-film-skill) | MIT | Интервью, форма истории, панчлайны, magic moves, музыка по тактам, ловушки цвета → `product-film.md` |
| [MengTo/Skills](https://github.com/MengTo/Skills) (`html-demo`, `cinematic-gsap-lenis-motion-system`, `cinematic-scroll-storytelling`, `build-threejs-scroll-worlds`, `scroll-world-storytelling`, эффекты) | MIT | Живое окно приложения → `product-film.md` §7; токены Lenis/GSAP, scroll-миры, эффекты → `web-motion.md` §6–8; консистентность серии → `ai-video-generation.md` §7 |
| [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) (`design-taste-frontend`) | MIT | Бюджет движения страницы, токены, домашние правила → `web-motion.md` §1a, кривые в `motion-principles.md` |
| [heygen-com/hyperframes-community-skills](https://github.com/heygen-com/hyperframes-community-skills) | Apache-2.0 (ассеты под брендом/фото людей не переносились; p5 — LGPL, Strudel — AGPL) | Метод vox-объяснялки → `explainer.md`, стиль 23; закон стыков и перекрытия 39 %, «без холостого покачивания» → `motion-principles.md` §9d–g; стили 24, 27, 28; партитура на часах фильма и гейт мёртвого эфира → `sound.md` §7, `qc.sh`; контракт HyperFrames → `pipeline.md` §6 |
| [buildfastwithai/buildfast-skills](https://github.com/buildfastwithai/buildfast-skills) | MIT | Печатный генеративный фильм → стиль 25; 10 моушн-языков → `motion-principles.md` §9h; раскадровка и скорость чтения → `explainer.md`; липсинк из 3 спрайтов рта → `ai-video-generation.md` §8; безопасные зоны и CDP-захват → `pipeline.md` §6, `render.mjs` |
| [zhuyansen/awesome-claude-video-skills](https://github.com/zhuyansen/awesome-claude-video-skills) | CC0 | Каталог ~50 лучших записей, итог сквозного теста 16 скиллов → `catalog.md`, штраф за «дефолтный вид» в рубрике |

## Что недоступно и как добавить

Облачная сессия не открывает prompt-motion.com, x.com, polza.ai и vincentwei1021.github.io (сетевые ограничения
среды); текст статьи из X пользователь прислал сам. GitHub-репозитории склонированы; ключевые скиллы прочитаны целиком, а большие каталоги (MengTo ~180 скиллов, awesome-list 409 репозиториев, buildfast, HyperFrames) — выборочно, через конспекты по профильным скиллам. Чтобы дополнить скилл:
- скопируй сюда содержимое недоступных страниц — или разреши эти домены в сетевых настройках среды;
- для polza.ai сверь параметры моделей с живой документацией и поправь таблицу в `ai-video-generation.md`.

## Лицензии

Использованные репозитории — MIT, кроме HyperFrames community skills (Apache-2.0) и каталога awesome-claude-video-skills (CC0). Тексты переведены и переработаны; код рендерера и звука написан заново.
Если используешь mgaudio/сэмплы/рендерер mg-styles-15 напрямую — сохрани их лицензии (сэмплы VCSL — CC0).
