# Видеонейросети: polza.ai (Veo, Kling, Seedance, Sora, Wan…)

Маршрут B: когда нужна живая/фотореалистичная/кинематографичная картинка или «оживление» готового арта.
**Нейросеть — это футаж, не готовый ролик.** Текст, логотипы, точный тайминг и звук доделываются маршрутом A
(видео кладётся слоем в HTML-фильм или монтируется ffmpeg).

> Данные о polza.ai собраны из их документации через поиск (сам сайт из облачной сессии был недоступен). Имена
> полей в разных разделах их доков расходятся — **сверяйся с живой документацией**:
> https://polza.ai/docs/api-reference/media/create · каталог моделей https://polza.ai/models (или `GET /api/v1/models`).

## 1. Что такое polza.ai

Российский агрегатор 400+ моделей (LLM, изображения, видео, аудио) с OpenAI-совместимым API, оплатой в рублях и
доступом без VPN. Для видео — единый асинхронный медиа-эндпоинт:

```
POST https://polza.ai/api/v1/media        → объект задачи со статусом pending
GET  https://polza.ai/api/v1/media/{id}   → статус и результат (файл копируется в хранилище polza)
Authorization: Bearer $POLZA_API_KEY
```
Тело запроса: `{"model": "<id>", "input": { ...параметры модели... }}`.

## 2. Модели (параметры по докам polza на момент сборки)

| Модель | id | Длительность | Формат | Особенности |
|---|---|---|---|---|
| Kling 3.0 | `kling/v3` | 3–15 с (обяз.) | 16:9, 9:16, 1:1 (по умолч. 1:1) | промпт ≤ 2500 симв.; 0–2 картинки; `mode`: std / pro / 4K; `sound` (по умолч. false) |
| Seedance 1.5 Pro | `bytedance/seedance-1.5-pro` | 4, 8, 12 с | 1:1, 21:9, 4:3, 3:4, 16:9, 9:16 | `resolution` 480p/720p/1080p; 0–2 референс-картинки; `fixed_lens` (статичная камера); `generate_audio` |
| Veo 3 / 3.1 | `google/veo3` (пример из доков) | — | — | сильнейший кинематографичный реализм + звук; параметры смотри в доках |
| Sora, Wan и др. | см. каталог | | | Wan — дешёвый, хорош для стилизованного/аниме |

Клиент: `scripts/polza_video.py` (stdlib, без зависимостей):
```bash
export POLZA_API_KEY=...          # ключ не печатать и не коммитить
python3 .claude/skills/motion-design/scripts/polza_video.py --dry-run --model kling/v3 --prompt-file shot.txt \
  --param duration=5 --param aspect_ratio=16:9 --param mode=pro --image "Аниме/Карты персонажей книга/Диана Эльтар.png"
# без --dry-run: отправит, дождётся, скачает в out/gen/<id>.mp4
```
Если ключа нет — подготовь промпты и команду, попроси пользователя добавить ключ в окружение (в облачной сессии —
переменные окружения среды).

## 3. Структура видеопромпта

Пиши по-английски (модели лучше понимают), один шот = один промпт, 40–120 слов:

```
[SHOT] medium close-up, 35mm, shallow depth of field
[SUBJECT] <кто/что, внешность, одежда — те же формулировки во всех шотах для консистентности>
[ACTION] <одно главное действие, с глаголами движения и темпом: slowly turns her head toward camera>
[CAMERA] <одно движение: slow dolly-in / orbit 30° left / static locked-off / handheld drift>
[ENVIRONMENT] <место, время суток, погода, частицы>
[LIGHT] <ключ/контр, цвет: cold moonlight rim, warm candle key>
[STYLE] <anime cel-shaded, Makoto Shinkai-like sky / photoreal / 2.5D illustrated parallax>
[MOTION QUALITY] smooth, consistent, no morphing, stable face, no extra limbs
[AUDIO] (если модель генерирует звук) wind, distant bells, no music, no speech
```
Правила:
- **Одно действие + одно движение камеры** на шот. Сложное — режь на несколько шотов.
- Длина: 4–6 с на шот (длиннее — больше «плывёт»); монтаж собирает ритм.
- Консистентность персонажа: image-to-video с артом персонажа как первым кадром/референсом + одинаковое описание.
- Негатив (если поле есть): `text, watermark, logo, extra fingers, deformed face, flicker, morphing`.
- Текст и логотипы нейросети не доверяй — накладывай кодом.
- Каждую генерацию проверяй глазами (кадры через ffmpeg, см. reference-analysis.md): лицо, руки, «плывущие» детали.

## 4. Image-to-video по артам из этого репозитория

`Аниме/Карты персонажей книга/` — карты персонажей «Хроники рода Эльтар». Рецепт «оживить персонажа»:
1. Выбери арт, при необходимости обрежь под формат (16:9 или 9:16) без потери лица и уменьши до ≤ 1920 px по
   длинной стороне — арты в репозитории ~3000 px, а локальный файл уходит в запрос как base64
   (`ffmpeg -i in.png -vf "scale='min(1920,iw)':-2" ref.png`).
2. Промпт: минимальное, характерное движение (ветер в волосах, моргание, поворот головы, свечение магии),
   медленная камера (dolly-in 5–10 %), `consistent with the reference image, same character design`.
3. Kling (`mode=pro`, 5 с) или Seedance (`resolution=1080p`, 4–8 с); `fixed_lens=true`, если камера должна стоять.
4. Результат → слой в HTML-фильме (стиль 22 Anime OP): титр имени, speed lines, импакт-кадры, звук — кодом.

## 5. Гибридный монтаж (B → A)

```js
// в index.html: видео-слой, синхронный с renderAt
const v = document.querySelector('video');            // <video src="gen/shot1.mp4" muted preload="auto">
window.renderAt = async (t) => {
  const local = t - 2.0;                               // шот начинается на 2.0 с
  if (local >= 0 && local < v.duration) { v.currentTime = local; await new Promise(r => v.addEventListener('seeked', r, { once: true })); }
  // ...графика поверх
};
```
Надёжнее и быстрее: заранее разложить шот в PNG (`ffmpeg -i shot.mp4 -vf fps=30 shot/%04d.png`) и рисовать
`drawImage` нужного кадра.

## 6. Стоимость и этика

- Генерации платные; сначала покажи пользователю промпт и параметры, генерируй по одному шоту, затем масштабируй.
- Не генерируй реальных людей без согласия, чужие товарные знаки, чужих персонажей под видом оригинальных.
