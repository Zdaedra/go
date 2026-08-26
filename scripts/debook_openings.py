#!/usr/bin/env python3
"""Убрать последние видимые следы книги-источника из раздела дебютов.

Названия дебютов уже оригинальные (names.ts + блоклист в i18n_audit). Остались
два видимых остатка:
  1) caption у 258/259 веток = «<книжное имя> diagram N» → книжное имя + её
     нумерация диаграмм. Читает только OpeningScreen (дисплей). Обнуляем в
     данных (обе копии branches.json); строку в UI убираем отдельно.
  2) 6 описаний ссылаются на дебюты по КНИЖНЫМ именам в прозе → подменяем на
     НАШИ имена (Мельница→Лабиринт/Maze, Меч→Перешеек/Isthmus); orthodox/5 —
     «windmill» там го-форма (風車), переформулируем нейтрально.

Идемпотентно; после прогона книжных имён в caption/описаниях быть не должно.
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# ── 1. Обнулить caption во всех копиях branches.json ──────────────
CAPTION_FILES = [ROOT / "apps/mobile/src/data/branches.json",
                 ROOT / "data/openings/9x9/branches.json"]
for f in CAPTION_FILES:
    if not f.exists():
        continue
    db = json.loads(f.read_text(encoding="utf-8"))
    arr = db["branches"] if isinstance(db, dict) and "branches" in db else db
    n = 0
    for b in arr:
        if isinstance(b, dict) and b.get("caption"):
            b["caption"] = ""; n += 1
    f.write_text(json.dumps(db, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{f.relative_to(ROOT)}: обнулено {n} caption")

# ── 2. Переписать описания со ссылками на книжные имена ───────────
DESC = ROOT / "apps/mobile/src/data/descriptions.json"
d = json.loads(DESC.read_text(encoding="utf-8"))

PATCH = {
  "tengen/windmill/1": {  # self-reference → обезличиваем
    "ru": "Эта форма равна при точности; главная ловушка — защищать камни, которые выгоднее жертвовать.",
    "en": "This shape is even with accuracy; the main trap is defending stones that are better sacrificed.",
    "es": "Esta forma es pareja con precisión; la trampa principal es defender piedras que conviene sacrificar.",
    "fr": "Cette forme est égale avec précision ; le piège principal est de défendre des pierres qu'il vaut mieux sacrifier.",
    "de": "Diese Form ist bei Genauigkeit ausgeglichen; die Hauptfalle ist, Steine zu verteidigen, die man besser opfert.",
    "ko": "이 모양은 정확하면 호각이다; 가장 큰 함정은 버리는 게 나은 돌을 지키는 것이다.",
  },
  "tengen/hand-fan/1": {  # Мельница → Лабиринт / Maze
    "ru": "Белые уходят от «Лабиринта» и ставят живучий камень; чёрные могут позже вынудить прибыльную жертву.",
    "en": "White leaves the Maze and plays a resilient stone; Black can later force a profitable sacrifice.",
    "es": "Blanco abandona el Laberinto y coloca una piedra resistente; Negro puede forzar más tarde un sacrificio provechoso.",
    "fr": "Blanc quitte le Labyrinthe et pose une pierre résistante ; Noir peut plus tard forcer un sacrifice profitable.",
    "de": "Weiß verlässt das Labyrinth und setzt einen widerstandsfähigen Stein; Schwarz kann später ein einträgliches Opfer erzwingen.",
    "ko": "백은 미로를 벗어나 끈질긴 돌을 둔다; 흑은 나중에 이득이 되는 사석을 강요할 수 있다.",
  },
  "tengen/hand-fan/2": {  # Мельница → Лабиринт / Maze
    "ru": "Чёрные зовут к бою, похожему на «Лабиринт»; при точной игре ни одна сторона не опережает.",
    "en": "Black invites a fight like the Maze; with precise play neither side pulls ahead.",
    "es": "Negro invita a una lucha parecida al Laberinto; con juego preciso ninguno se adelanta.",
    "fr": "Noir invite à un combat proche du Labyrinthe ; en jouant avec précision, aucun camp ne prend l'avance.",
    "de": "Schwarz lädt zu einem Kampf wie im Labyrinth ein; bei genauem Spiel zieht keine Seite davon.",
    "ko": "흑은 미로와 비슷한 싸움을 부른다; 정확히 두면 어느 쪽도 앞서지 못한다.",
  },
  "tengen/curveball/1": {  # Мельница → Лабиринт / Maze
    "ru": "Белые избегают «Лабиринта», уходя вверх: больше помощи левому камню, но и больше драки.",
    "en": "White dodges the Maze by going up: more help for the left stone, but also more fighting.",
    "es": "Blanco esquiva el Laberinto subiendo: más ayuda para la piedra izquierda, pero también más pelea.",
    "fr": "Blanc esquive le Labyrinthe en montant : plus d'aide pour la pierre gauche, mais aussi plus de combat.",
    "de": "Weiß weicht dem Labyrinth nach oben aus: mehr Hilfe für den linken Stein, aber auch mehr Kampf.",
    "ko": "백은 위로 나가며 미로를 피한다: 좌변 돌에 도움이 더 되지만 싸움도 커진다.",
  },
  "tengen/soccer-juggling/1": {  # Меч → Перешеек / Isthmus
    "ru": "Обратная кейма сохраняет гибкость «Перешейка» без симметрии; у белых остаётся несколько надёжных ответов.",
    "en": "The reverse keima keeps the Isthmus's flexibility without symmetry; White still has several reliable replies.",
    "es": "El keima inverso conserva la flexibilidad del Istmo sin simetría; Blanco aún tiene varias respuestas fiables.",
    "fr": "Le keima inverse garde la souplesse de l'Isthme sans symétrie ; Blanc dispose encore de plusieurs réponses fiables.",
    "de": "Der umgekehrte Keima behält die Flexibilität der Landenge ohne Symmetrie; Weiß hat noch mehrere verlässliche Antworten.",
    "ko": "역날일자는 대칭 없이 '지협'의 유연함을 유지한다; 백에게는 여전히 든든한 응수가 여럿 있다.",
  },
  "tengen/orthodox/5": {  # «windmill» тут форма 風車 → нейтрально «вращающаяся»
    "ru": "Внутреннее ханэ ведёт к сложной вращающейся форме; интуитивные атари чёрных часто вредят.",
    "en": "The inside hane leads to a complex rotating fight; Black's intuitive ataris often do harm.",
    "es": "El hane interior lleva a una compleja forma giratoria; los ataris intuitivos de Negro suelen hacer daño.",
    "fr": "Le hane intérieur mène à une forme tournante complexe ; les ataris intuitifs de Noir font souvent du tort.",
    "de": "Der innere Hane führt zu einer komplexen kreisenden Form; Schwarz' intuitive Ataris schaden oft.",
    "ko": "안쪽 하네는 복잡한 회전형 싸움으로 이어진다; 흑의 직관적 아타리는 흔히 손해다.",
  },
  "tengen/jump-attack/5": {  # «форма типа Мельницы» = форма 風車 → нейтрально
    "ru": "Внутренний изгиб белых ведёт к сложной вращающейся форме; игра остаётся равной, но требует счёта жертв.",
    "en": "White's inside bend leads to a complex rotating shape; the game stays even but demands counting the sacrifices.",
    "es": "El giro interior de Blanco lleva a una compleja forma giratoria; la partida sigue pareja pero exige contar los sacrificios.",
    "fr": "Le pli intérieur de Blanc mène à une forme tournante complexe ; la partie reste égale mais exige de compter les sacrifices.",
    "de": "Weiß' innere Biegung führt zu einer komplexen kreisenden Form; das Spiel bleibt gleich, verlangt aber das Zählen der Opfer.",
    "ko": "백의 안쪽 젖힘은 복잡한 회전형 모양으로 이어진다; 형세는 호각이지만 사석 계산이 필요하다.",
  },
  "territorial/avoiding-transpositions/6": {  # «Новая ортодоксия» → наше имя «Горный зуб»
    "ru": "Прилипание к тэнгэну срывает переход в «Горный зуб»; территория делится просто, но белым нужно творческое вторжение.",
    "en": "Attaching at tengen thwarts the switch into the Mountain Tooth; the territory divides simply, but White needs a creative invasion.",
    "es": "Apoyarse en el tengen frustra el paso al Diente de Montaña; el territorio se reparte de forma simple, pero Blanco necesita una invasión creativa.",
    "fr": "Se coller au tengen contrarie le passage vers la Dent de Montagne ; le territoire se partage simplement, mais Blanc a besoin d'une invasion créative.",
    "de": "Am Tengen anzukleben vereitelt den Wechsel zum Bergzahn; das Gebiet teilt sich einfach, doch Weiß braucht eine kreative Invasion.",
    "ko": "천원에 붙이면 '산 이빨'로의 전환을 막는다; 집은 단순하게 갈리지만, 백에게는 창의적인 침입이 필요하다.",
  },
}

for k, tr in PATCH.items():
    if k in d:
        d[k].update(tr)
DESC.write_text(json.dumps(d, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print(f"descriptions.json: переписано {len(PATCH)} описаний")

# ── 3. Гейт: книжных имён не осталось ────────────────────────────
# Гейт ловит книжные имена дебютов в прозе. komoku/mokuhazushi/sansan НЕ
# включаем — это стандартные названия пунктов доски (PD), не имена из книги.
BOOK = ["Мельниц", "windmill", "molino", "moulin", "Windmühle", "풍차",
        "«Меч", "the sword", "espada", "épée", "Schwert",
        "New Orthodox", "ортодокси", "diagram", "Three in a Row"]
leaks = []
for k, v in d.items():
    for L, txt in v.items():
        for b in BOOK:
            if b in txt:
                leaks.append((k, L, b))
if leaks:
    print("!! ОСТАЛИСЬ книжные ссылки:", leaks[:20]); raise SystemExit(1)
print("гейт: книжных имён в описаниях не осталось")
