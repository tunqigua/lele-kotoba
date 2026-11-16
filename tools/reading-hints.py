"""Build reading hints for the current word list from Unicode 17.0 Unihan.zip."""
import json
import re
import sys
import unicodedata
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from zipfile import ZipFile

DIST = Path(__file__).resolve().parents[1] / "dist"
KANA = re.compile(r"[ぁ-ゖァ-ヺー]+")
LONG = re.compile(r"([おこそとのほもよろごぞどぼぽょうくすつぬふむゆるぐずづぶぷゅ]う|"
                  r"[えけせてねへめれげぜでべぺぇ]い|[あかさたなはまやらわがざだばぱゃ]あ|"
                  r"おお|[いきしちにひみりぎじぢびぴ]い|[えけせてねへめれげぜでべぺ]え)$")
VOICE = dict(zip("かきくけこさしすせそたちつてとはひふへほ", "がぎぐげござじずぜぞだぢづでどばびぶべぼ"))
HALF_VOICE = dict(zip("はひふへほ", "ぱぴぷぺぽ"))
PHONETIC_GROUPS = ("交校郊効絞較", "官館管", "青清晴精請", "包抱泡砲", "方放訪防妨芳")
FEATURED_LINKS = {"説明": ("小説", "明確"), "郊外": ("交通", "外国"),
                  "競争": ("競技", "戦争"), "注文": ("注意", "作文")}
EXCEPTIONS = {("注", "ちゅう"): "单韵母例外，这里读长音",
              ("説", "せつ"): "复韵母例外，这里读せつ"}
# The lesson's examples explicitly choose these base readings for sound changes.
MANUAL = {
    "中国": (("中", "ちゅう", "ちゅう", True), ("国", "こく", "ごく", True)),
    "本棚": (("本", "ほん", "ほん", True), ("棚", "たな", "だな", False)),
    "先輩": (("先", "せん", "せん", True), ("輩", "はい", "ぱい", True)),
    "失敗": (("失", "しつ", "しっ", True), ("敗", "はい", "ぱい", True)),
    "学校": (("学", "がく", "がっ", True), ("校", "こう", "こう", True)),
    "設計": (("設", "せつ", "せっ", True), ("計", "けい", "けい", True)),
    "作家": (("作", "さく", "さっ", True), ("家", "か", "か", True)),
    "薬局": (("薬", "やく", "やっ", True), ("局", "きょく", "きょく", True)),
}


@dataclass(frozen=True)
class Part:
    char: str
    base: str
    spoken: str
    on: bool


def hiragana(text):
    return "".join(chr(ord(c) - 96) if "ァ" <= c <= "ヶ" else c for c in text)


def han(char):
    return len(char) == 1 and unicodedata.name(char, "").startswith("CJK UNIFIED IDEOGRAPH")


def unihan(path):
    readings, mandarin = {}, {}
    with ZipFile(path) as archive, archive.open("Unihan_Readings.txt") as stream:
        for line in stream:
            if line.startswith(b"#") or not line.strip():
                continue
            code, field, values = line.decode().strip().split("\t")
            char = chr(int(code[2:], 16))
            if field == "kJapanese":
                readings[char] = [(hiragana(value), value[0] >= "ァ") for value in values.split()
                                  if KANA.fullmatch(value) and not re.search(r"[ぁ-ゖ][ァ-ヺ]|[ァ-ヺ][ぁ-ゖ]", value)]
            elif field == "kMandarin" and len(values.split()) == 1:
                mandarin[char] = values
    return readings, mandarin


def radical_data(path, chars):
    radicals = {}
    with ZipFile(path) as archive, archive.open("Unihan_IRGSources.txt") as stream:
        for line in stream:
            if b"\tkRSUnicode\t" not in line:
                continue
            code, _, value = line.decode().strip().split("\t")
            char = chr(int(code[2:], 16))
            if char not in chars:
                continue
            radical = int(value.split()[0].split(".")[0].rstrip("'"))
            radicals[char] = unicodedata.normalize("NFKC", chr(0x2F00 + radical - 1))
    return radicals


def choices(char, next_char, readings):
    if not han(char):
        return [(hiragana(char), False)]
    choices = list(readings.get(char, ()))
    # A kun reading that includes written okurigana uses only the kanji stem.
    if KANA.fullmatch(next_char):
        tail = hiragana(next_char)
        choices += [(base[:-len(tail)], False) for base, on in choices if not on and len(base) > len(tail)
                    and base.endswith(tail)]
    return sorted(set(choices))


def split_reading(word, kana, readings):
    if word in MANUAL:
        parts = tuple(Part(*part) for part in MANUAL[word])
        if "".join(part.spoken for part in parts) == kana:
            return parts
    if not any(map(han, word)) or not all(han(c) or KANA.fullmatch(c) for c in word):
        return ()
    # Group literal kana to match the full okurigana following its kanji.
    tokens = []
    for char in word:
        if tokens and KANA.fullmatch(tokens[-1]) and KANA.fullmatch(char):
            tokens[-1] += char
        else:
            tokens.append(char)
    options = [choices(char, tokens[i + 1] if i + 1 < len(tokens) else "", readings)
               for i, char in enumerate(tokens)]
    matches = []

    def visit(i, remainder, parts, pending):
        if i == len(tokens):
            if not remainder and not pending:
                matches.append(parts)
            return
        for base, on in options[i]:
            if not base:
                continue
            spoken = base
            first = base[0]
            if pending:
                if first in HALF_VOICE and on and pending in "つち":
                    spoken = HALF_VOICE[first] + base[1:]
                elif not on or (first not in "かきくけこ" and
                                (pending not in "つち" or first not in "さしすせそたちつてと")):
                    continue
            alternatives = [(spoken, "")]
            if parts and not pending and han(tokens[i - 1]) and han(tokens[i]) and parts[-1].spoken.endswith(("う", "ん")):
                for changes in (VOICE, HALF_VOICE):
                    if first in changes:
                        alternatives.append((changes[first] + base[1:], ""))
            if on and han(tokens[i]) and i + 1 < len(tokens) and han(tokens[i + 1]) and base[-1] in "つちくき" and len(base) > 1:
                alternatives.append((spoken[:-1] + "っ", base[-1]))
            for actual, following in alternatives:
                if remainder.startswith(actual):
                    visit(i + 1, remainder[len(actual):], parts + (Part(tokens[i], base, actual, on),), following)

    visit(0, kana, (), "")
    if not matches:
        return ()
    # Prefer an attested unchanged reading. If the best analyses still disagree,
    # leave the word unannotated instead of presenting a guessed decomposition.
    def changes(parts):
        return sum(p.base != p.spoken for p in parts)

    minimum = min(map(changes, matches))
    best = {parts for parts in matches if changes(parts) == minimum}
    return next(iter(best)) if len(best) == 1 else ()


def plain_pinyin(pinyin):
    return unicodedata.normalize("NFC", "".join(
        c for c in unicodedata.normalize("NFD", pinyin) if c not in "\u0300\u0301\u0304\u030c"))


def nasal_or_length(part, pinyin):
    if not part.on or not pinyin:
        return None
    jp = part.base
    py = plain_pinyin(pinyin)
    if (part.char, jp) in EXCEPTIONS:
        rule = EXCEPTIONS[part.char, jp]
    elif py.endswith("ng") and LONG.search(jp):
        rule = "后鼻音 → 长音"
    elif py.endswith("n") and jp.endswith("ん"):
        rule = "前鼻音 → 拨音「ん」"
    elif py.endswith(("ao", "ou")) and LONG.search(jp):
        rule = "ao / ou 类复韵母 → 长音"
    elif re.fullmatch(r"(?:[bpmfdtnlgkhjqxrzcs]|zh|ch|sh)?[aoeiuü]", py) and re.fullmatch(r"[ぁ-ゖ][ゃゅょ]?", jp):
        rule = "单韵母 → 短音"
    else:
        return None
    return f"「{part.char}」{pinyin} → {jp}，{rule}。"


def explanations(parts, pinyin):
    notes = []
    for i, part in enumerate(parts):
        if part.spoken != part.base and part.spoken.endswith("っ"):
            after = parts[i + 1]
            row = next(row[0] for row in ("かきくけこ", "さしすせそ", "たちつてと", "はひふへほ")
                       if after.base[0] in row)
            suffix = f"，{after.base[0]} 也变成 {after.spoken[0]}" if after.base != after.spoken else ""
            notes.append(f"促音｜{part.char}＋{after.char}，{part.base}＋{after.base} → "
                         f"{part.spoken}{after.spoken}。「{part.base[-1]}」遇到 {row} 行，在这里变成小「っ」{suffix}。")
        elif part.spoken != part.base and not parts[i - 1].spoken.endswith("っ"):
            before = parts[i - 1]
            label = "半浊音" if part.spoken[0] in HALF_VOICE.values() else "连浊"
            notes.append(f"{label}｜{before.char}＋{part.char}，{before.spoken}＋{part.base} → "
                         f"{before.spoken}{part.spoken}。前一字以「{before.spoken[-1]}」收尾，后一字开头的 "
                         f"{part.base[0]} 在这里变成 {part.spoken[0]}。")
        if part.base == part.spoken:
            note = nasal_or_length(part, pinyin.get(part.char))
            if note and note not in notes:
                notes.append(note)
    return notes


def related_indexes(words, splits, pinyin):
    exact, similar = defaultdict(list), defaultdict(list)
    family = {char: group for group in PHONETIC_GROUPS for char in group}
    for word in words:
        for part in splits[word["id"]]:
            if not han(part.char) or part.base != part.spoken:
                continue
            exact[part.char, part.spoken].append((word, part))
            if part.on and part.char in family:
                similar["声旁线索", family[part.char], part.spoken].append((word, part))
            if part.on and part.char in pinyin:
                similar["拼音声韵相同", plain_pinyin(pinyin[part.char]), part.spoken].append((word, part))
    return exact, similar, family


def related(word, parts, pinyin, exact, similar, family):
    links = {}
    ranks = {}
    for part in parts:
        if not han(part.char):
            continue
        pools = [("同字同读", exact[part.char, part.base])]
        if part.on and part.base == part.spoken:
            if part.char in family:
                pools.append(("声旁线索", similar["声旁线索", family[part.char], part.spoken]))
            if part.char in pinyin:
                pools.append(("拼音声韵相同", similar["拼音声韵相同", plain_pinyin(pinyin[part.char]), part.spoken]))
        for order, (label, pool) in enumerate(pools):
            for other, match in pool:
                oid = other["id"]
                if oid == word["id"] or other["word"] == word["word"]:
                    continue
                if label != "同字同读" and match.char == part.char:
                    continue
                highlighted = FEATURED_LINKS.get(word["word"], ())
                special = highlighted.index(other["word"]) if other["word"] in highlighted else len(highlighted)
                rank = (special, order, other["priority"], len(other["word"]), other["word"], oid)
                if oid not in ranks or rank < ranks[oid]:
                    ranks[oid] = rank
                    if part.base != part.spoken:
                        reason = f"对照「{part.char}」变音前的 {part.base}"
                    elif part.char == match.char:
                        reason = f"「{part.char}」同读 {part.spoken}"
                    else:
                        reason = f"{label}，「{part.char}」和「{match.char}」同读 {part.spoken}"
                    links[oid] = (oid, reason, part.char, match.char)
    result, used = [], set()
    for oid in sorted(links, key=ranks.get):
        _, reason, char, match = links[oid]
        key = (char, match)
        if key in used:
            continue
        used.add(key)
        result.append((oid, reason))
        if len(result) == 3:
            break
    return result


def main():
    source = (DIST / "data.js").read_text()
    words = json.loads(source.removeprefix("window.KOTOBA_DATA = ").strip().removesuffix(";"))["words"]
    readings, pinyin = unihan(sys.argv[1])
    splits = {w["id"]: split_reading(re.sub(r"（.*?）", "", w.get("quizWritten") or w["word"]),
                                    hiragana(w["kana"]), readings) for w in words}
    indexes = related_indexes(words, splits, pinyin)
    hints = {}
    for word in words:
        parts = splits[word["id"]]
        notes = explanations(parts, pinyin)
        links = related(word, parts, pinyin, *indexes)
        if notes or links:
            hints[word["id"]] = [notes, links]
    body = ",\n".join(json.dumps(key) + ":" + json.dumps(value, ensure_ascii=False, separators=(",", ":"))
                      for key, value in hints.items())
    radicals = radical_data(sys.argv[1], {c for w in words for c in (w.get("quizWritten") or w["word"]) if han(c)})
    (DIST / "reading-hints.js").write_text("// Generated by tools/reading-hints.py from Unicode 17.0 Unihan. See unicode-license.txt.\n"
                                         "window.KOTOBA_READING_HINTS = {\n" + body + "\n};\n"
                                         "window.KOTOBA_RADICALS = " + json.dumps(radicals, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print(f"{len(words)} scanned; {sum(bool(v[0]) for v in hints.values())} with rules; "
          f"{sum(bool(v[1]) for v in hints.values())} with links; {len(hints)} with either")


if __name__ == "__main__":
    main()
