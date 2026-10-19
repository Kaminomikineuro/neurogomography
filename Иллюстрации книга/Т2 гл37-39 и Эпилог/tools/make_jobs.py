# -*- coding: utf-8 -*-
"""Очередь для Кодекса: Т2, главы 37–39 и Эпилог.
Построено по навыку book-illustration-director: разные сцены в цветных слотах, ЧБ — только предметы,
у каждого референса одна задача, книга целиком по периметру уходит в белую акварель,
после каждой цветной иллюстрации — отдельные «головы» ключевых героев для печати.
Запуск: python make_jobs.py -> ../jobs.json и ../ПРОМПТЫ.md"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__)); PKG = os.path.dirname(HERE)
BASE = 'Иллюстрации книга/Т2 гл37-39 и Эпилог/'
R = BASE + 'refs/'

# ---------------- стиль и формат ----------------
STYLE_COLOR = ("STYLE: semi-realistic anime book illustration for a dark-fantasy danmei novel; painterly digital watercolor over fine ink linework, soft cinematic light, "
 "rich but restrained palette, detailed fabric and individual hair strands, elegant adult proportions. Rendering and edge treatment follow the STYLE reference only. "
 "EDGES: all four sides — top, bottom, left and right — dissolve organically into page-white watercolor wash; not corner-only fading, no hard rectangle. ")
STYLE_BW = ("STYLE: monochrome book insert — black ink and grey wash on pure white paper, fine pen hatching, a restrained smoky ink-bleed halo around the subject that fades to clean white. "
 "This is an ISOLATED OBJECT or compact object group, NOT a miniature scene: no room, no landscape, no staged characters. ")
STYLE_FRAME = ("STYLE: print ornament in black ink only on pure white (#FFFFFF): crisp pen work, fine hatching, a few grey-wash smoke accents. No faces, no figures in the text area. ")
FMT = {
 'cover': "FORMAT: landscape 3:2 (1536x1024), chapter-opening spread. Characters and focal action occupy the LEFT 55%; the RIGHT 40% melts smoothly into soft near-white haze with almost no detail (text-safe for the chapter title and first lines). Left, top and bottom edges dissolve into white watercolor wash. ",
 'v':     "FORMAT: portrait 2:3 (1024x1536), full A5 page. ",
 'h':     "FORMAT: landscape 3:2 (1536x1024), full two-page spread; keep faces, hands and key action away from the vertical center line (book gutter). ",
 'frame': "FORMAT: landscape 3:2 (1536x1024) = one two-page spread. Ornament only in the outer margins (~10-12% of each page) and lightly along the central gutter; the inner rectangle of EACH page stays completely empty white for text (at least 70% of the area). Left and right pages mirror each other. ",
 'band':  "FORMAT: landscape 3:2 (1536x1024) = one two-page spread. A single horizontal decorative band across the {pos} ~22% of the canvas, running across both pages; everything else completely empty white. ",
 'bw':    "FORMAT: square 1:1 (1024x1024), small insert inside the text column. ",
 'head':  "FORMAT: portrait 2:3 (1024x1536). ",
}
EXCLUDE = ("EXCLUDE: text, letters, captions, signatures, watermarks, panel borders, extra people, extra fingers or merged hands, duplicated limbs, "
 "wrong eye colors, modern objects, heavy gore. ")

# ---------------- канон (Т2 — события восемь лет назад) ----------------
LIAM_C = ("LIAM: 17-18-year-old male drayk, slender, not fully grown, HALF A HEAD SHORTER than the Dragon Lord; long straight white hair that turns black at the roots, usually a high ponytail "
 "(loose only where stated); heterochromatic eyes, one violet and one green — copy which eye is which from his sheet; pale skin; NARROW close-fitting sleeves with leather bracers, never wide sleeves. ")
LORD_C = ("THE DRAGON LORD (Liar): looks 22-23, tall and composed; very long straight jet-black hair to the waist with three flat stacked silver hairpins on the LEFT side of the head; paper-white skin; "
 "huge black obsidian eyes without highlights, faint shadows under them; thin pale lips; long black high-collared coat with leather straps, tight sleeves; black leather gloves on BOTH hands always; "
 "his blood in human form is dark bordeaux. ")
MRAK_C = "MRAK: the Lord's beast form — a colossal black dragon on FOUR legs plus two wings, scales absorbing light and fraying into black mist at the edges, yellow eyes with vertical pupils, smooth neck spikes, BLACK flame. "
MIRA_C = "MIRA: dragoness in human form, adult, strong athletic build (not frail), tanned skin, long dark hair, a clean WHITE EYE PATCH over her LEFT eye (injured), proud military bearing. "
TWINS_C = "LALI (girl) and LU (boy): dragon twins about 12 years old, light-brown hair with a reddish sheen, grey eyes, thick bangs over one eye, clothes thrown on carelessly. Their dragon forms (Rain and Rayna) are ASH-GREY, half Mrak's size. "
NOX_C = "NOX: deathly pale young man, short black hair, cold green eyes, dark navy uniform of the Crown Prince's order, katana. "
DANTE_C = "DANTE: ordinary human swordsman, ash-blond wavy hair, hawk-like eyes, white mantle, energetic. "
AKARI_C = "AKARI: the Goddess of Death in a young woman's form — beautiful brunette with long curly black hair and large eyes, black dress. "
BAST_C = "BASTIAN ELTAR: Lord of the drayks, Liam's uncle; tall, rather large build, sharp features, black hair tied back below the shoulders, thick brows, stern; long black coat with burgundy inner panels; no visible tattoo. Drayk blood is silvery. "
DATASH_C = "KING DATASH KRAM: heavy-set older king in gold-and-crimson robes with ermine and a tall gold crown. "
ALLAN_C = "CROWN PRINCE ALLANTIY KRAM: young blond man with clear blue eyes, dark navy coat with gold embroidery and an eight-pointed star. "
ALAST_C = "ALASTOR LAX: ageless mentor, long wheat-gold hair, honey-colored eyes, porcelain skin, white robes with wide sleeves, hands hidden in the sleeves, serene half-smile. "
SOLO_C = "EMPEROR SOLOMON: elegant elf-like man, pale green-gold hair, light green eyes, long silk hanfu in greens and cream. "
ZHANNA_C = "ZHANNA (Mira's dragon form): bigger than the twins' dragons, rough CRIMSON scales, almost no spikes, three white bone ridges by each eye, massive neck. "

def ref(f, role): return {'file': R + f, 'role': role}
NOT = " Do NOT copy its pose, layout, background or white sheet backdrop."
LIAM = ref('char_liam_t2.jpg', "IDENTITY of Liam (Tome 2, age 17-18): face, hair with black roots, eye colors, build, narrow sleeves and bracers." + NOT)
LORD = ref('char_lord_t2.jpg', "IDENTITY of the Dragon Lord: face, hair, three silver hairpins on the left, long black coat, gloves." + NOT)
MIRA = ref('char_mira.jpg', "IDENTITY of Mira: face, hair, build only. Do NOT copy the low-cut dress — in this chapter her clothes are buttoned to the throat; add the white eye patch over her LEFT eye." + NOT)
TWINS = ref('char_twins.jpg', "IDENTITY of the twins Lali and Lu (children): faces, hair, berets and red hoodies." + NOT)
NOX = ref('char_nox.jpg', "IDENTITY of Nox: face, short black hair, pallor." + NOT)
DANTE = ref('char_dante.jpg', "IDENTITY of Dante: face and hair; use a white mantle instead of the black outfit." + NOT)
AKARI = ref('char_akari.jpg', "IDENTITY of Akari: face, curly black hair, black dress." + NOT)
BAST = ref('char_bastian.jpg', "IDENTITY of Bastian Eltar: face, hair, coat." + NOT)
DATASH = ref('char_datash.jpg', "IDENTITY of King Datash: face, body, robes, crown." + NOT)
ALLAN = ref('char_allantiy.jpg', "IDENTITY of Crown Prince Allantiy: face, hair, navy-and-gold coat." + NOT)
ALAST = ref('char_alastor.jpg', "IDENTITY of Alastor: face, wheat-gold hair, white robes." + NOT)
SOLO = ref('char_solomon.jpg', "IDENTITY of Emperor Solomon: face, hair, robes." + NOT)
MRAK = ref('char_mrak.jpg', "BODY SHAPE of Mrak: head, horns, spikes, wings, four legs. Flame must be BLACK, not blue." + NOT)
GREYDR = ref('char_twin_dragons_shape.jpg', "BODY SHAPE ONLY of the twins' dragons Rain and Rayna. Their scales must be ASH-GREY (they are young), not red.")
ZHANNA = ref('char_zhanna_shape.jpg', "BODY SHAPE ONLY of Zhanna. Her scales must be rough CRIMSON, not green.")
SWORD = ref('prop_liam_sword.jpg', "PROP: Liam's black blade and its sheath — shape and silver ornament.")
PORTAL = ref('loc_mistrix_portal.jpg', "ARCHITECTURE of the main portal on the central square of Mistrix: white stone arch, columns, energy-holder pillars, steps, cobblestones. Do NOT copy its camera angle, crowd or market stalls.")
ISLAND = ref('loc_island.jpg', "LOCATION: the crescent-shaped Island of Forgetting, a red-lantern city in the sea. Do NOT copy the daylight or the aerial angle unless stated.")
CAPITAL = ref('loc_eltarion_capital.jpg', "LOCATION: the capital of Eltarion carved into a giant red rock, staircase streets, castle on top.")
DESERT = ref('loc_eltarion_desert.jpg', "LOCATION: the red desert of Eltarion under a crimson sun — palette and terrain only.")
SC = ref('style_cover.jpg', "STYLE ONLY for a chapter opener: how the right side dissolves into pale haze. Do NOT copy its characters, room or red palette.")
SV = ref('style_color_v.jpg', "STYLE ONLY: rendering, brushwork, watercolor edge. Do NOT copy characters, pose or setting.")
SV2 = ref('style_color_v2.jpg', "STYLE ONLY: rendering and dark watercolor vignette. Do NOT copy characters, pose or setting.")
SH = ref('style_color_h.jpg', "STYLE ONLY: rendering and light. Do NOT copy characters, pose or bed.")
SBW = ref('style_bw.jpg', "STYLE ONLY for monochrome inserts: ink line, grey wash, smoky halo, isolated object on white. Do NOT copy the book object.")
SBW2 = ref('style_bw2.jpg', "STYLE ONLY for monochrome inserts. Do NOT copy the candle or hands.")

J = []
def P(*a): return ''.join(a)
def add(ch, n, kind, title, where, why, refs, scene, canon='', heads=(), pos='TOP'):
    style = STYLE_FRAME if kind in ('frame', 'band') else (STYLE_BW if kind == 'bw' else STYLE_COLOR)
    prompt = P(style, FMT[kind].replace('{pos}', pos), 'SCENE: ', scene, ' ', ('CONTINUITY: ' + canon if canon else ''), EXCLUDE)
    out = f'{BASE}out/{ch}/{ch}_{n:02d}_{kind}.png'
    J.append({'chapter': ch, 'id': f'{ch}_{n:02d}', 'kind': kind, 'title': title, 'where': where, 'why': why, 'out': out, 'refs': refs, 'prompt': prompt})
    # головы для печати — сразу после родительской цветной картинки
    for who, sheet, desc in heads:
        hout = f'{BASE}out/{ch}/{ch}_{n:02d}_head_{who}.png'
        hp = P("PRINT-DETAIL HEAD PLATE (production asset, not a new illustration). ", FMT['head'],
               f"Show ONLY {desc}: the entire head from the very top of the hair and hairpins down through the shoulders, nothing cropped, on a clean pure-white background. ",
               "Match EXACTLY the head angle, gaze direction, expression, hair arrangement (loose strands, ties, wet or dusty state), accessories, the scene's lighting and the visible collar/shoulder clothing "
               "of this character in Image 1 (the finished parent illustration — SCENE-STATE anchor). Take facial identity, eye colors and hair roots from Image 2 (the character sheet — IDENTITY anchor). "
               "Same painterly watercolor anime rendering as Image 1, sharper and more detailed. One head only — no collage, no sheet, no second person. ", EXCLUDE)
        J.append({'chapter': ch, 'id': f'{ch}_{n:02d}_head_{who}', 'kind': 'head', 'parent': out, 'title': f'Голова для печати: {who} (к {ch}_{n:02d})',
                  'where': 'Не в книгу — для подмены мягких лиц при вёрстке', 'why': '', 'out': hout,
                  'refs': [{'file': out, 'role': 'SCENE-STATE anchor — the finished parent illustration'}, sheet], 'prompt': hp})

# =================== ГЛАВА 37 «Слишком красивое» ===================
# Континуити: Лиам до душа — в чёрной одежде, задубевшей от засохшей КРАСНОЙ крови жителей (не своей); после душа — чистая рубашка чуть велика, волосы распущены.
# На следующий день — одежда, принесённая Форром (тёмная, по росту чуть свободная). Повелитель — чёрный многослойный плащ с высоким воротом и шёлковыми кисточками, перчатки.
# Мира — повязка на ЛЕВОМ глазу. Близнецы спят на диване, Лу кладёт руку под щёку сестры.
C = '37'
add(C,0,'cover','Обложка: уходят из сожжённой деревни','Разворот с названием главы',
 'Первая сцена: дракон вычисляет, где Мира; они покидают выжженную низину, над ней чёрный столб дыма, к деревне скачет стража.',
 [SC, LIAM, LORD],
 "Camera: medium-long shot from slightly below, figures in the left half. The Dragon Lord walks a half step ahead, untouched and calm, gloved hand loose at his side, coat moving; "
 "Liam follows, half a head shorter, exhausted and hollow-eyed, his black clothes and the ends of his white ponytail stiff with dried dark-red human blood (not his own), hands stained. "
 "Behind them, down in a lowland among pale chalky Allarian hills, a burnt village: charred roofs and scorched black earth eating into green grass; a gigantic column of thick black smoke rises "
 "into a milky overcast sky and bends to the right, where it thins into the pale haze of the text area. Far away on a road, a tiny mounted squad of town guards gallops toward the smoke. "
 "Light: flat overcast afternoon, desaturated greens, ash grey, rust. No bodies visible.",
 LIAM_C+LORD_C, heads=[('Liam', LIAM, 'Liam (the blood-stained young man with the white ponytail)'), ('Lord', LORD, 'the Dragon Lord')])
add(C,1,'v','Подслушанный разговор','После «Драйк уже собирался пройти мимо, когда услышал собственное имя.»',
 'Ключевая сцена: Мира упрекает Повелителя за доверие к Лиаму; Лиам в нише слышит «Да» и «Разве я не с детства такой?».',
 [SV2, LIAM, MIRA, LORD],
 "Camera: eye-level in a dark upstairs corridor, vertical. Liam, fresh from the shower, in a clean white shirt slightly too big for him, damp white hair LOOSE over his shoulders (black at the roots), "
 "barefoot, stands pressed into a dark wall niche, shoulder to the wall, holding his breath, face half in shadow. A door on the right stands ajar: a narrow strip of warm candle-light falls across the "
 "wooden floor and touches his toes. Through the gap: the edge of a table, a neat stack of papers, a cup; Mira seated very straight with arms crossed, hair gathered, white patch over her LEFT eye, "
 "jaw tight; the Dragon Lord only as a tall dark silhouette by the window, face hidden. Light: cold blue night vs warm amber slit. Mood: held breath, jealousy, quiet hurt.",
 LIAM_C+LORD_C+MIRA_C, heads=[('Liam', LIAM, 'Liam (loose damp white hair, white shirt)'), ('Mira', MIRA, 'Mira (white eye patch on her left eye)')])
add(C,2,'v','Утро: «Лиа́р»','После «Лиам немного приподнял голову.»',
 'Другая сцена и другое время: утро после ночи, когда дракон назвал истинное имя. Тихая нежность.',
 [SV, LIAM, LORD],
 "Camera: high three-quarter view over a small bed, vertical. Late morning, milky daylight between loosely drawn curtains. The Dragon Lord sleeps on his side, cheek in the pillow, hairpins removed, "
 "a long black strand across his face; his gloved hand still rests on Liam's back. Liam lies pressed close under a heavy blanket, propped on one elbow, and gently tucks the black strand behind the "
 "Lord's ear with two fingers, smiling to himself; his own white hair loose and tousled. Both in shirts. On the table by the window: Mira's papers. Warm creams and whites, the black of the Lord's "
 "hair as the strongest dark. Soft, tender, intimate, not explicit.",
 LIAM_C+LORD_C, heads=[('Liam', LIAM, 'Liam (tousled loose white hair, smiling)'), ('Lord', LORD, 'the Dragon Lord (asleep, hair loose, no hairpins)')])
add(C,3,'h','Поцелуй в седле','После «— Что ты делаешь? — ошарашенно спросил Повелитель»',
 'Ключевая романтическая сцена, отсюда название главы. Другая локация: дорога в сумерках.',
 [SH, LIAM, LORD],
 "Camera: side view from the roadside, slightly low, the horse walking left to right on the left page. Dusk on a road winding between hills toward a provincial town wall with lit gate torches. A tall "
 "black stallion, one front hoof mid-stumble. The Dragon Lord rides in front: his long black hair is woven by Liam into an intricate braid laid over his far shoulder, the high collar of his black "
 "cloak folded down, silk tassels swinging; he holds the reins tight, eyes wide, body rigid but not leaning away. Liam sits behind him, arms around his waist, chin over his shoulder, lips pressed to the "
 "pale side of the Lord's neck. Far behind on the road (right page): tiny riders — two children on one mare, a woman alone with an eye patch, a couple on another horse. Light: violet-amber twilight, first "
 "torches. Playful, tender, not explicit.",
 LIAM_C+LORD_C, heads=[('Liam', LIAM, 'Liam (lips at the Lord\'s neck, white ponytail)'), ('Lord', LORD, 'the Dragon Lord (startled, black braid over the shoulder)')])
add(C,4,'h','Ночной полёт к Острову Забвения','В конец главы, после «из темноты проступил изогнутый серпом Остров Забвения»',
 'Финальный образ главы и разговор с Мраком о Свитке Единства. Другая локация: море Мистрикса.',
 [SH, MRAK, LIAM, ISLAND],
 "Camera: three-quarter rear view, slightly above the dragon. Night over the dark sea of Mistrix. Liam sits on the neck of the colossal black dragon Mrak, both hands on a smooth neck spike, white ponytail "
 "streaming; Mrak's huge yellow eye glances back at him, amused. Ahead (right page) the crescent-shaped Island of Forgetting glitters with red lanterns, red lights at its gates. Far ahead, small grey "
 "dragons and one crimson dragon carry tiny figures; one tiny blue flame-light among them. Salty spray, low clouds, moonlight on waves.",
 LIAM_C+MRAK_C+TWINS_C+ZHANNA_C, heads=[('Liam', LIAM, 'Liam (on the dragon, wind in his hair)')])
add(C,5,'frame','Рамка: дым и пепел','Развороты первой половины главы: дом у городской стены, таз с водой, чайник',
 '', [SBW],
 "Theme: aftermath of a burnt village. Curling ribbons of black smoke and drifting flakes of ash rise along the left and right outer margins; at the bottom corners a few burnt grass stalks and a "
 "cracked ember stone; a thin double ink rule ties the ornament around each page.")
add(C,6,'frame','Рамка: свеча и чёрный шёлк','Развороты ночной сцены: «Я знаю один маленький секрет», «Я умею стирать воспоминания», имя «Лиар»',
 '', [SBW],
 "Theme: a night of confession. Long flowing strands of black silk hair and tassel cords weave along the outer margins; a single slim candle with a thin rising smoke thread in the bottom outer "
 "corner of each page; a few tiny stars along the top edge.")
add(C,7,'band','Полоса: дорога через холмы','Низ разворотов с поездкой верхом',
 '', [SBW],
 "A continuous low landscape band: rolling hills, a winding road, one horse carrying two riders on a single saddle, a distant town wall with a gate and small torches, a few birds.", pos='BOTTOM')
add(C,8,'bw','ЧБ: таз и тряпка','После «Вода быстро порозовела»', '', [SBW2],
 "A simple metal basin of slightly clouded water on a wooden tabletop, a folded clean rag laid over its rim, a few dark drops on the wood.")
add(C,9,'bw','ЧБ: нетронутый чайник','После «Чайник так и остался стоять нетронутым.»', '', [SBW],
 "A pot-bellied ceramic teapot with several clean, untouched cups around it, one thin wisp of cooling steam.")
add(C,10,'bw','ЧБ: застёжка с чёрным волосом','После «распутывал застежку, в которую попал длинный черный волос»', '', [SBW],
 "An ornate cloak clasp on a fold of dark layered fabric, a single very long black hair caught and tangled in it.")
add(C,11,'bw','ЧБ: письмо с печатью','После «Драконна вытащила из-за пояса туго свернутую полоску бумаги, скрепленную печатью.»', '', [SBW],
 "A tightly rolled narrow strip of paper sealed with a small wax seal, lying on a wooden tabletop.")

# =================== ГЛАВА 38 «Печать тысячи клинков» ===================
# Континуити: Лиам — тёмная одежда, кожа (на чёрной коже оседает красная пыль), волосы в хвосте; к концу главы весь в пыли, сломаны рёбра, кровь из прикушенной щеки.
# Мира — волосы убраны, одежда застёгнута до горла, белая повязка на ЛЕВОМ глазу. Близнецы — серые драконы Рэйн и Рэйна. Жанна — багряная.
C = '38'
add(C,0,'cover','Обложка: ночью на Острове','Разворот с названием главы',
 'Первая сцена: возвращение глубокой ночью, чёрный туман собирается в фигуру Повелителя.',
 [SC, LORD, LIAM, DANTE, NOX, ISLAND],
 "Camera: medium-wide, eye-level, group on the left. Deep night on a landing ground of the Island of Forgetting, red paper lanterns glowing on poles. In the foreground a swirl of black fog condenses "
 "into the tall human figure of the Dragon Lord, glancing sideways as if at his own neck; Liam walks toward him. Behind: Dante yawning hugely while steadying his brother Nox by the shoulder; Akari "
 "smoothing wind-tousled curly black hair. The lanterns and sea mist dissolve into pale haze on the right.",
 LIAM_C+LORD_C+DANTE_C+NOX_C+AKARI_C, heads=[('Lord', LORD, 'the Dragon Lord'), ('Liam', LIAM, 'Liam')])
add(C,1,'v','Тайный ход и Мира у подножия','После «Хотите нравиться мне еще больше?»',
 'Другая локация и отношения: шёпот на винтовой лестнице, Мира видит, как близко Лиам.',
 [SV2, LIAM, LORD, MIRA],
 "Camera: looking down a cool stone spiral staircase lit by small crystals, vertical. On the last steps Liam leans forward, lips almost at the Dragon Lord's ear, whispering; the Lord turns his head, "
 "black eyes unreadable, a faint ripple of black mist around him. At the foot of the stairs, in a stone grotto with glowing formation crystals set into the wall, Mira stands looking up at them: hair "
 "gathered, clothes buttoned to the throat, white patch on her LEFT eye, very still. Cold blue-violet crystal light.",
 LIAM_C+LORD_C+MIRA_C, heads=[('Liam', LIAM, 'Liam (whispering)'), ('Lord', LORD, 'the Dragon Lord'), ('Mira', MIRA, 'Mira (white eye patch on her left eye)')])
add(C,2,'h','Печать тысячи клинков','После «Помолчи и держи массив.»',
 'Ключевая сцена главы: Бастиан держит разлом, Лиам вливает в него силу, Мрак держит края лапами.',
 [SH, BAST, LIAM, MRAK, DESERT],
 "Camera: wide, low, from the side of the plateau. Red desert of Eltarion under a heavy crimson sun; the plateau's red sand is white with FROST and breath turns to steam. Hovering just above the ground, "
 "a colossal black rift tears space, its edges rippling; thin black streaks of smaller rifts slide over the sand and pour into it. Around it floats a vast array of hundreds of glowing blades in rings and "
 "tiers — the Seal of a Thousand Blades — light jumping from blade to blade. The colossal black dragon Mrak grips the rift's edges with bare foreclaws, head low, straining. In the foreground (left page) "
 "Bastian stands with arms stretched forward, fingers shaping the array, trembling; Liam stands behind him, both palms on his uncle's shoulders, a visible silver-white stream of energy flowing from his "
 "hands into Bastian. Crimson, black, frost-blue.",
 LIAM_C+BAST_C+MRAK_C, heads=[('Bastian', BAST, 'Bastian Eltar (straining, wind in his hair)'), ('Liam', LIAM, 'Liam (pouring energy, dusty)')])
add(C,3,'h','Эвакуация столицы','После «Поток не редел. "И откуда столько…"»',
 'Другая локация: город глазами Лиама — люди уходят к сияющим проходам, над крышами драконы.',
 [SH, CAPITAL, GREYDR, ZHANNA],
 "Camera: high, drifting view as seen by a wandering spirit-sense, slightly dreamy. The capital of Eltarion carved into a giant red rock: staircase streets cut into the cliff, a castle on top. Rivers of "
 "people flow down the streets — bundles, children in arms, old people led by the elbow — toward several glowing white passages opening in the rock walls. Above the roofs circle dragons: ash-grey "
 "young ones and a large crimson one. Red dust haze, crimson sun, warm light against the cold white glow of the passages. No visible faces needed; crowd as readable silhouettes.",
 TWINS_C+ZHANNA_C)
add(C,4,'v','Сквозь портал на площадь Мистрикса','В конец главы, после «Вы обвиняетесь в многократных преступлениях против союза измерений!»',
 'Финал главы: выпали из портала, а их ждёт оцепление. Другая локация: Мистрикс.',
 [SV, PORTAL, LIAM, BAST, LORD],
 "Camera: low, from the cobblestones looking up, vertical. Liam, battered and covered in red dust, has just risen from the stones, a trickle of silver-tinged blood at the corner of his mouth; Bastian "
 "holds him under the elbow. Behind them the white stone portal arch of Mistrix hums, cracks running up its stone, the veil darkening; black fog dissolves where the Dragon Lord steps out last, one gloved "
 "hand on a pillar. In the background, out of focus: a ring of knights with lowered spears and monks with open glowing tomes. Flat grey sky, wet cobblestones, cold light.",
 LIAM_C+BAST_C+LORD_C, heads=[('Liam', LIAM, 'Liam (dust-covered, blood at the corner of the mouth)'), ('Bastian', BAST, 'Bastian Eltar')])
add(C,5,'frame','Рамка: кольцо клинков','Развороты со сценой на плато', '', [SBW],
 "Theme: the Seal of a Thousand Blades. Rows of slender floating swords, points inward, run around the outer margins of both pages like a fence; thin lines of light link them; small swirls of wind-blown sand at the corners.")
add(C,6,'frame','Рамка: море и фонари','Развороты на Острове: кабинет, тайный ход', '', [SBW],
 "Theme: the Island of Forgetting at night. Stylized waves along the bottom margin, hanging paper lanterns on cords along the top margin, ropes and curling mist strands on the sides.")
add(C,7,'band','Полоса: три дракона над пустыней','Верх разворотов с поиском разлома с воздуха', '', [SBW, MRAK],
 "A continuous band: a long ridge of desert rocks and dunes; above it one big black dragon flanked slightly lower by two smaller dragons in formation; tiny dust whirlwinds below.", pos='TOP')
add(C,8,'bw','ЧБ: письмо Бастиана','После «Сероватая угольная бумага была родом из Эльтариона.»', '', [SBW],
 "An opened letter on rough greyish paper with a broken wax seal, resting on a small cloth bundle tied with twine.")
add(C,9,'bw','ЧБ: прототип радара','После «Стрелка дрожала, но упрямо держала направление»', '', [SBW],
 "A small angular artifact with a dull crystal window and a thin trembling needle inside, lying on the corner of a hand-drawn map held down by a flat stone, a trickle of sand over the paper.")
add(C,10,'bw','ЧБ: смерч-дух','После «Ты звал, дэо, — прошелестел песок.»', '', [SBW2],
 "A small isolated whirlwind of sand, inside it faint blurred human features of a desert spirit, grains spiralling up into white emptiness.")
add(C,11,'bw','ЧБ: брошенная корзина','После «Из открытого окна выбивался край занавески.»', '', [SBW],
 "An overturned woven basket on a worn stone step, a few spilled bread loaves and a child's cloth doll beside it.")

# =================== ГЛАВА 39 «Прощай» ===================
# Вся глава — одна непрерывная сцена на площади (решение автора: 2+2 цветных), поэтому разнесены разные моменты и разные пары героев.
# Континуити: Лиам — в пыли Эльтариона, рёбра сломаны, сил нет; Повелитель — чёрное пальто, перчатки, туман держит портал; Мира — повязка на левом глазу.
C = '39'
add(C,0,'cover','Обложка: Повелитель напротив Короля','Разворот с названием главы',
 'Первая сцена: Повелитель встаёт напротив Короля, между ними тридцать шагов пустой брусчатки.',
 [SC, LORD, DATASH, PORTAL],
 "Camera: over the Dragon Lord's shoulder, three-quarter back view, he stands on the left straight as a released arrow: long black hair, black coat, black gloves. Thirty steps of empty wet "
 "cobblestones lead to King Datash holding a scroll at the edge of a dense ring of knights and monks with spears and glowing tomes. Behind the Lord the white portal arch hums, its veil darkening from the "
 "edges. Grey sky and the portal's white light melt into pale haze on the right.",
 LORD_C+DATASH_C, heads=[('Lord', LORD, 'the Dragon Lord (three-quarter back view as in the parent)')])
add(C,1,'h','Обвинение','После «И самое главное преступление против всего Мира Живых!»',
 'Ключевая сцена: оглашение обвинений; Аластор подтверждает показания.',
 [SH, DATASH, ALLAN, ALAST, LORD, LIAM],
 "Camera: wide, eye-level tableau across the spread. LEFT PAGE: King Datash reading from a long parchment with heavy seals, voice magically amplified; Crown Prince Allantiy at his right staring at the "
 "stones; behind them Alastor, serene, hands in his wide white sleeves, slightly inclining his head; an old mage in a pale blue robe with the right sleeve folded and pinned at the elbow steps forward. "
 "RIGHT PAGE: the Dragon Lord, calm, a faint loser's-but-not-defeated smile, looking past the King straight at Alastor; Liam beside him, pale, dusty, frozen. Knights' spears lowered all around. Behind the "
 "Lord, threads of black fog hold the darkening portal veil open. Cold grey light.",
 LORD_C+LIAM_C+DATASH_C+ALLAN_C+ALAST_C, heads=[('Alastor', ALAST, 'Alastor'), ('Lord', LORD, 'the Dragon Lord (faint smile)'), ('Allantiy', ALLAN, 'Crown Prince Allantiy (eyes down)')])
add(C,2,'h','Щит трещит','После «По щиту прошла трещина.»',
 'Ключевая сцена: драконы держат щит, Мира впереди; это другой момент и другие герои, чем в «Обвинении».',
 [SH, MIRA, TWINS, LORD, LIAM],
 "Camera: low and wide, inside a translucent magical dome. Dragons in human form stand in a ring with raised arms holding it; Mira in front, feet planted wide, one hand raised, white patch on her LEFT "
 "eye, shouting; two 12-year-old children wedged shoulder to shoulder between adults; one man down on one knee, arms still raised. Outside, hundreds of spells from knights and battle monks burst against "
 "the dome; bright cracks race across its surface, fragments of light rain onto the cobblestones. Centered under the dome, small in the frame: the Dragon Lord, calm, and Liam facing him. Behind them the portal "
 "is almost fully black.",
 MIRA_C+TWINS_C+LORD_C+LIAM_C, heads=[('Mira', MIRA, 'Mira (shouting, white eye patch on her left eye)')])
add(C,3,'v','Поцелуй и клинок','После «Холодная сталь глубоко вошла ему в живот.»',
 'Главная сцена тома. Обязательно в цвете.',
 [SV2, LIAM, LORD, SWORD],
 "Camera: tight two-shot at chest height, vertical; tasteful, no gore. Liam (half a head shorter) kisses the Dragon Lord on the lips, eyes closed, lashes trembling; his left hand grips the Lord's waist; "
 "his right hand drives his slender black blade into the Lord's abdomen — only the hilt and Liam's fist are visible, a thin line of dark-bordeaux blood. The Lord's huge black eyes are wide open, lost, "
 "almost human; his gloved hand clutches Liam's shoulder. Long white and long black hair tangle together. Behind them, out of focus, a cracking shield of light. Cold light, deep shadow.",
 LIAM_C+LORD_C, heads=[('Liam', LIAM, 'Liam (eyes closed, kissing)'), ('Lord', LORD, 'the Dragon Lord (eyes wide open)')])
add(C,4,'v','Падение','После «Повелитель падал в проход спиной.»',
 'Ключевая сцена: «Прощай, Лиар». Обязательно в цвете.',
 [SV, LORD, LIAM, PORTAL],
 "Camera: over Liam's shoulder, vertical. The Dragon Lord falls backward into the portal arch, long black hair lifting above his shoulders, face unreadable, one gloved hand reaching toward Liam with fingers "
 "spread, closing on emptiness. Inside the arch is a wall of blackness with only a thin ragged rim of white light outlining the falling figure; tendrils of black fog tear away from the stone pillars and "
 "rush after him. Foreground: Liam's back and shoulder, his empty left hand, a black blade in his right. Palette nearly monochrome — black, white, grey — with a single dark-bordeaux accent on the blade.",
 LIAM_C+LORD_C, heads=[('Lord', LORD, 'the Dragon Lord (falling, hair lifting)')])
add(C,5,'frame','Рамка: трещины щита','Развороты с обстрелом щита', '', [SBW],
 "Theme: a shattering magical shield. A web of fine cracks radiating from the outer corners like broken glass, small sharp fragments and sparks along the margins, cracks thinning out toward the empty text area.")
add(C,6,'frame','Рамка: чёрный туман','Последние развороты главы', '', [SBW],
 "Theme: the Lord's black fog. Dense curling tendrils of black mist creep in from the outer edges of both pages; one long tendril reaches along the bottom toward the gutter.")
add(C,7,'band','Полоса: оцепление','Низ разворотов со сценой суда', '', [SBW],
 "A continuous band of silhouettes seen from behind: a tight row of knights' helmets, raised spears and shields, battle monks holding open faintly glowing books.", pos='BOTTOM')
add(C,8,'bw','ЧБ: свиток с печатями','После «Даташ поднял выше длинный пергамент, скрепленный тяжелыми печатями.»', '', [SBW],
 "A long parchment partly unrolled, three heavy wax seals hanging from it on ribbons, illegible scribbles instead of writing.")
add(C,9,'bw','ЧБ: извлечённый кристалл','После «другой держал извлеченный кристалл»', '', [SBW],
 "A faceted energy crystal pulled from a socket, its glow dying, a few loose metal fittings beside it.")
add(C,10,'bw','ЧБ: раскрытый фолиант','После «Монахи синхронно раскрыли фолианты.»', '', [SBW],
 "One heavy open spell-tome with clasps, pages flaring with light, small glyph-like sparks rising.")
add(C,11,'bw','ЧБ: чёрный клинок','После «Черный клинок вышел из ножен»', '', [SBW, SWORD],
 "Liam's slender black blade half drawn from its ornate sheath.")

# =================== ЭПИЛОГ (короче) ===================
C = 'E'
add(C,0,'cover','Обложка: его уводят','Разворот с началом эпилога',
 'Первая сцена: «Где-то далеко кричали», Лиама уводят под локоть, над головой улетают крылья.',
 [SC, LIAM],
 "Camera: medium shot, Liam on the left, blurred and dreamlike. He stands on cobblestones with unfocused eyes, white hair loose and wind-tossed; a hand in a wide sleeve holds his elbow and leads him "
 "away (the other person cropped out of frame); his fingers are wet with the Lord's dark-bordeaux blood, a black blade lies on the stones at his feet. Overhead, shadows of departing dragon wings. "
 "Everything dissolves into thick white-grey fog to the right.",
 LIAM_C, heads=[('Liam', LIAM, 'Liam (unfocused eyes, loose hair)')])
add(C,1,'v','Золотой океан','После «огромный, безмятежный золотистый океан»',
 'Месяцы забытья: золотой океан поёт колыбельную (голос Аластора).',
 [SV, LIAM],
 "Camera: from above, vertical. Liam floats on his back, eyes closed, in a vast calm golden ocean of light; warm glowing waves cradle him, white hair spread like seaweed, faint rings on the surface where "
 "distant voices fall. Serene, luminous gold and white.",
 LIAM_C, heads=[('Liam', LIAM, 'Liam (eyes closed, floating)')])
add(C,2,'v','Пробуждение','После «Потом понял, что голова у него лежит на чужих коленях.»',
 'Другая сцена: Лиам приходит в себя на коленях Аластора.',
 [SV2, LIAM, ALAST],
 "Camera: eye-level beside a sofa, vertical. An unfamiliar bright room: light upholstery, carved table legs, patterned fabric on the walls. Liam, thinner and paler, in unfamiliar clothes, lies with his head "
 "on Alastor's lap, eyes open and clear for the first time, looking at his own hands. Alastor has just set down an old book with yellowed pages and leans over him, one hand on his shoulder, concerned.",
 LIAM_C+ALAST_C, heads=[('Liam', LIAM, 'Liam (pale, clear eyes)'), ('Alastor', ALAST, 'Alastor (concerned)')])
add(C,3,'h','«Мне нужна помощь, дядя…»','В самый конец эпилога',
 'Финальная сцена тома. Обязательно в цвете.',
 [SH, LIAM, BAST, SOLO],
 "Camera: wide, from inside the room toward the door. A temporary study of the drayk Lord in Alfia: warm wood, green leaf-light through the window, papers, an ink pot nearly tipping. LEFT PAGE: Emperor "
 "Solomon rises smoothly from Bastian's lap, straightening his long silk hanfu as if nothing happened; Bastian jumps up from his chair, startled. RIGHT PAGE: in the open doorway stands Liam — pale, "
 "composed, with a completely clear, icy gaze; the last sparks of a dissolved locking spell fade around the door frame.",
 LIAM_C+BAST_C+SOLO_C, heads=[('Liam', LIAM, 'Liam (icy clear gaze)'), ('Bastian', BAST, 'Bastian (startled)'), ('Solomon', SOLO, 'Emperor Solomon')])
add(C,4,'frame','Рамка: золотые волны','Развороты эпилога', '', [SBW],
 "Theme: a calm ocean that sings. Soft stylized waves and foam curls along the bottom and the outer margins, gentle light rays from the top corners.")
add(C,5,'bw','ЧБ: клинок на камне','После «клинок с лязгом упал на камень»', '', [SBW, SWORD],
 "A slender black blade lying on two cobblestones, a few dark drops beside the hilt.")
add(C,6,'bw','ЧБ: раскрытая книга','После «Перед лицом лежала раскрытая книга.»', '', [SBW],
 "An old open book with a yellowed page and tiny illegible notes in the margins, a long elegant finger holding down the corner of the page.")

json.dump(J, open(os.path.join(PKG, 'jobs.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

KR = {'cover':'Обложка главы (разворот, справа дымка)','v':'Вертикальный цветной арт','h':'Горизонтальный цветной арт (разворот)','frame':'Рамка на полный разворот, ЧБ','band':'Рамка-полоса на разворот, ЧБ','bw':'ЧБ-вставка (предмет)','head':'Голова для печати'}
NAMES = {'37':'Глава 37. Слишком красивое','38':'Глава 38. Печать тысячи клинков','39':'Глава 39. Прощай','E':'Эпилог'}
L = ['# Иллюстрации: Том 2, главы 37–39 и Эпилог', '',
 'Собрано по навыку «book-illustration-director». Кодекс получает английский промпт целиком и референсы по порядку. Здесь — что рисуем, куда ставим и какие референсы.', '',
 'Цветных на главу: обложка + 2 вертикальных + 2 горизонтальных. ЧБ: 2 рамки на разворот, 1 полоса, 4 вставки-предмета. Эпилог короче. После каждой цветной — отдельные «головы» ключевых героев для печати.', '',
 'Результаты: `out/<глава>/`. Очередь: `jobs.json`. Пересобрать: `python tools/make_jobs.py`.', '']
for ch in ['37','38','39','E']:
    L += [f'## {NAMES[ch]}', '']
    for j in [x for x in J if x['chapter']==ch]:
        if j['kind']=='head':
            L.append(f"- ↳ {j['title']} — `{j['out'].split('/')[-1]}`"); continue
        L += ['', f"### {j['id']}. {j['title']} — {KR[j['kind']]}", f"- **Куда:** {j['where']}"]
        if j['why']: L.append(f"- **Зачем:** {j['why']}")
        L.append('- **Референсы:** ' + ', '.join('`'+r['file'].split('/')[-1]+'`' for r in j['refs']))
        L += ['', '```', j['prompt'], '```']
    L.append('')
open(os.path.join(PKG, 'ПРОМПТЫ.md'), 'w', encoding='utf-8').write('\n'.join(L))
import collections
print(len(J), 'заданий:', dict(collections.Counter(j['kind'] for j in J)))
