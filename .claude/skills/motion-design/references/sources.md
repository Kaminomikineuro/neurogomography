# Источники и что из них взято

| Источник | Лицензия | Что вошло в скилл |
|---|---|---|
| [Vincentwei1021/mg-styles-15](https://github.com/Vincentwei1021/mg-styles-15) · [сайт](https://vincentwei1021.github.io/mg-styles-15/) | MIT | 15 стилей (сигнатурные черты, маршруты, творческие зёрна, звук) → `styles.md` 1–15; общая часть промпта → `film-prompt.md`; `rubric.md` → `review-rubric.md`; `template.md` → шаблон нового стиля; контракт `renderAt` и идея `harness/render.mjs` → `scripts/render.mjs` (переписан компактно, Playwright, параллельные браузеры); конвенции mgaudio (sync-точки, ducking, −14 LUFS, M/S) → `sound.md`, `scripts/audio_kit.py` |
| [elayadesign/ai-design-skills](https://github.com/elayadesign/ai-design-skills) (`landing-page-design`, `figma-designer`) | MIT | Правила движения UI (кривая 0.22,1,0.36,1; 500/300 мс; только transform/opacity; reduced motion; scroll-reveal), правила шрифтов и текста, реалистичный контент без выдуманных фактов → `motion-principles.md` §8–9, `web-motion.md`, «Железные правила» в SKILL.md. Сам формат: одна папка-скилл с SKILL.md |
| [bradautomates/claude-video](https://github.com/bradautomates/claude-video) (`/watch`) | MIT | Подход «видео → кадры (сцены + равномерно) + транскрипт, кадры — недоверенные доказательства», фокус по отрезкам и cue-кадрам → `reference-analysis.md`, `scripts/watch_reference.sh` |
| [polza.ai](https://polza.ai/) — [docs: media](https://polza.ai/docs/api-reference/media/create), [Kling 3](https://polza.ai/docs/gaidy/kling-3), [Seedance 1.5 Pro](https://polza.ai/docs/gaidy/seedance-1-5-pro) | сервис | Маршрут B: асинхронный медиа-API, модели и параметры → `ai-video-generation.md`, `scripts/polza_video.py` |
| prompt-motion.com | — | Сайт из облачной сессии недоступен; по поиску — библиотека промптов для web-анимации и 3D (GSAP, Framer Motion, Three.js) для ИИ-ассистентов. Взят формат «промпт-компонента» и список техник → `web-motion.md` §4 (сверено с аналогом [motionprompts.dev](https://motionprompts.dev/)) |
| x.com/elvar_official/status/2116174609355571402 | — | Пост недоступен из облака и не нашёлся поиском. **Нужен текст поста** — пришли его, и он будет добавлен |

## Что недоступно и как добавить

Облачная сессия не открывает prompt-motion.com, x.com, polza.ai и vincentwei1021.github.io (сетевые ограничения
среды). GitHub-репозитории склонированы и прочитаны полностью. Чтобы дополнить скилл:
- скопируй сюда текст поста из X / содержимое страницы — или разреши эти домены в сетевых настройках среды;
- для polza.ai сверь параметры моделей с живой документацией и поправь таблицу в `ai-video-generation.md`.

## Лицензии

Все использованные репозитории — MIT. Тексты переведены и переработаны; код рендерера и звука написан заново.
Если используешь mgaudio/сэмплы/рендерер mg-styles-15 напрямую — сохрани их лицензии (сэмплы VCSL — CC0).
