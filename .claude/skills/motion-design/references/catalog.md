# Экосистема: что ещё установить и когда

Этот скилл самодостаточен (рендерер, звук, QC, стили, методы). Но у некоторых источников есть полноценные kit'ы —
ставь их, когда задача упирается в их специализацию. Перед установкой стороннего скилла прочитай его SKILL.md и
скрипты: это код, который будет запускаться на машине.

## 1. Установка (команды из присланных пользователем ссылок)

| Скилл | Когда | Команда |
|---|---|---|
| **teardown** (Elvar) — 3D-симуляторы машин | маршрут E: «как работает механизм», разрез, автотур, фильм 60 fps | `npx skills add elvarofficial/teardown -g -a claude-code`, затем `cd ~/.claude/skills/teardown && npm install && npx playwright install chromium`, вызов `/teardown` |
| **claude-motion** (whaleyxbt) — основа teardown: Remotion + web-sims + звук | ролики на Remotion, симуляции агентов/частиц | `git clone https://github.com/whaleyxbt/claude-motion` (скиллы в `.claude/skills/`) |
| **design-taste-frontend** (taste-skill) — арт-дирекция сайтов | лендинги, редизайн, «чтобы не выглядело как AI» | `npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"` |
| **html-demo** (MengTo) — живое окно приложения на странице | маршрут F: демо продукта на лендинге без видео | `npx skills add MengTo/Skills --skill html-demo` |
| **product-film** (Rieranthony) — продуктовый фильм на Remotion | маршрут F: промо/лендинг-луп на дизайн-системе продукта | `/plugin marketplace add Rieranthony/product-film-skill`, затем `/plugin install product-film@product-film-skill` |
| **session-story** (HyperFrames) — сессия агента как акварельный фильм | фильм «как мы работали» по логам Claude Code (с согласованием приватности) | `npx skills add heygen-com/hyperframes-community-skills --skill session-story` |
| **buildfast-skills** — generative-film, motion-studio, talking-avatar, create-svg… | печатный эссе-фильм (стиль 25), 10 моушн-языков, липсинк, SVG-ассеты | `npx skills@latest add https://github.com/buildfastwithai/buildfast-skills` |
| **watch** (claude-video) — «посмотреть» видео | маршрут D, полная версия с Gemini/WhisperX | `/plugin marketplace add bradautomates/claude-video`, затем `/plugin install watch@claude-video` |
| **ai-design-skills** (elayadesign) | лендинги, Figma-дизайн | `npx skills add elayadesign/ai-design-skills` |

Ещё из MengTo (MIT, ~180 веб-скиллов): `cinematic-gsap-lenis-motion-system`, `cinematic-scroll-storytelling`,
`build-threejs-scroll-worlds`, `scroll-world-storytelling`, `paper-cinder-transition`, `build-wireframe-scan-reveal`,
`webgl-laser`, `dither-background`, `gooey-blob-system`, `progressive-blur`, `globe-particles` —
`npx skills add MengTo/Skills --skill <имя>`. Ключевые числа уже перенесены в `web-motion.md` §6–8.

Остальные скиллы HyperFrames community (Apache-2.0): `vox-explainer` (→ `explainer.md`, стиль 23), `day-in-my-life`
(→ стиль 24), `camera-3d-captions` (→ стиль 27), `p5-paint-animation` (→ стиль 28), `duo` (экраны в фото рук с
раскладушкой: маску экрана строить из измеренной геометрии, не из сегментации; свайп = drag 120 px 0,18 с `power1.in` →
бросок 0,42 с `power3.out`), `prod-by-claude` (трек Strudel → видео «код как картинка»; Strudel — AGPL), `x-posting-license`
(шаблон ID-карточки; выход «присед → прыжок»: scaleY 1 → 0,7 за 0,16 с → 1,08 за 0,13 с + y → −1750 за 0,215 с `power4.in`).
У части из них ассеты под брендом/фото людей — переносим техники и числа, не ассеты.

## 2. Каталог awesome-claude-video-skills (zhuyansen, CC0; 409 репозиториев на 2026-11-02)

**Вывод их сквозного теста** (одинаковый бриф: 15 с промо, 5 строк текста, 1920×1080@30, 16 скиллов + «без скилла»):
все прошли базовые проверки, Claude Code **без скилла** тоже справился за 4,4 мин. Разница — во времени (2–23,5 мин),
**звуке (только 9 из 16)** и **внешности: 6 из 16 сошлись к одному дефолту — «тёмно-бирюзовая вода, волны, белый
текст по центру»**. Вердикт: «скилл зарабатывает место внешностью, процессом или футажем для монтажа». Отсюда наше
правило: этот дефолт = автоматический штраф по `concept_wow` и `style_fidelity` (см. рубрику).

### Код → моушн-графика
| Репозиторий | Что делает | Лиц. |
|---|---|---|
| heygen-com/hyperframes | HTML → видео рантайм/CLI для агентов (см. `pipeline.md` §6) | Apache-2.0 |
| remotion-dev/skills | официальные скиллы Remotion: надёжно, но дефолтный вид | — |
| vincentsch/explainroo | сценарий → MP4 с голосом: локальный Kokoro + тайминги Whisper + canvas; #1 в тесте (2 мин) | MIT |
| feitangyuan/onetake | «никогда не режет на следующий слайд»: каждый бит вырастает из предыдущего, одна камера | — |
| lemomo-ai/lemo-opuscar | 66 стилей «промпт + демо-фильм» — прямой аналог нашего `styles.md` | MIT |
| echris6/motion-video-kit | бизнес-ролики: независимый критик, принципы из 28 launch-фильмов, звук, Three.js | MIT |
| iart-ai/motion-skills | 50 скиллов / 14 пакетов: кинетик-тайп, дата-виз, explainer, Reels, WebGL, Manim | MIT |
| smwbev/framewright | каждый кадр — чистая функция (кадр, seed, ширина): адаптивный детерминизм | MIT |
| alexgreensh/anidoodle | арт и анимация кодом, десятки стилей, озвученные фильмы | Apache-2.0 |
| diffusionstudio/lottie | генерация продакшн-Lottie JSON | MIT |
| nolangz/pixel2motion | растровый логотип → SVG-анимация + превью + «доказательства QA движения» | MIT |
| adithya-s-k/manim_skill · AmitSubhash/3brown1blue | Manim в стиле 3Blue1Brown, объяснение научных статей | MIT |
| rock3r/cav · Arman-Luthra/aftr | Cavalry из терминала · After Effects через Puppeteer | MIT |
| calesthio/OpenMontage | «агентная продакшн-система», 12 пайплайнов (копилефт!) | AGPL-3.0 |

### ИИ-генерация видео
| Репозиторий | Что делает | Лиц. |
|---|---|---|
| gnipbao/minimax-h3-video-reverse-skill | «реверс» реального кадра в первый кадр + промпты движения | MIT |
| AgriciDaniel/claude-gif | 6 пайплайнов GIF (Remotion, Veo 3.1, SVG → прозрачный GIF, ffmpeg), идеальные лупы | MIT |
| heygen-com/skills | аватары HeyGen и Video Agent | MIT |
| cclank/lanshu-create-ai-presenter-video | ведущий из сценария + **разрешённого** фото, с проверкой | MIT |
| kangarooking/director-skills | «режиссёрские» скиллы: раскадровка и язык кадра для ИИ-видео | MIT |
| pyang5166/gbro-collage-broll | полутоновый бумажный коллаж-B-roll, 3 гейта согласования | MIT |

### Монтаж, субтитры, нарезки
| Репозиторий | Что делает | Лиц. |
|---|---|---|
| AgriciDaniel/claude-shorts | длинное → короткое: оценка сегментов, привязка границ к звуку, анимированные субтитры | MIT |
| louisedesadeleer/cut-video | убирает паузы и «эээ», но сохраняет смех и комические паузы | MIT |
| hassancs91/claude-faceless-shorts-creator | Shorts без лица: Remotion + голос с пословными субтитрами | MIT |
| bestagentkits/motion-video-skill | HyperFrames + GSAP в бит, караоке-субтитры, SFX, музыка | MIT |
| zenstory-ai/video-recap-skills | видео → пересказ: сцены, ASR, VLM, сценарий, TTS, экспорт в CapCut | MIT |
| ZiadAbdelkarim/beat-synced-edit | песня + футаж → анализ долей/энергии/сцен → монтаж | MIT |
| FireRedTeam/FireRed-OpenStoryline | монтаж по намерению, человек в цикле, переиспользуемые «стилевые скиллы» | Apache-2.0 |

### Понимание видео / разбор референсов
| Репозиторий | Что делает | Лиц. |
|---|---|---|
| sharon-laicc/viral-video-decomposer | покадровый разбор → механизм вирусности → чертёж продакшна → бриф для ИИ | MIT |
| edenfunf/reelmimic | референс → новое видео в том же стиле (план/сборка/ревью) | MIT |
| unclejobs-ai/motion-video-skill | 15–90 с MG: разбор референса + 7 гейтов, Remotion/HyperFrames | MIT |
| Fagan1024/smart-video-editor | модель зрения оценивает каждый кадр, выбрасывает плохие дубли | MIT |
| video-db/skills | серверная загрузка, понимание, поиск, монтаж | MIT |

**Повторяющиеся лучшие практики каталога:** детерминизм (кадр = функция времени и seed); локальный голос + тайминги
слов как часы; цикл критика и гейты согласования; стили как «промпт + демо-фильм»; непрерывность вместо слайдов;
сетка долей для музыкального монтажа; закреплённые версии зависимостей; проверка безопасности сторонних скиллов перед установкой.
