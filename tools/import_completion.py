"""Complete the uploaded indexes while preserving every existing vocabulary ID.

Rows retain printed spellings and page-local numbers. Canonicalization is a
reviewed mapping, never a same-reading merge (e.g. 掛ける != 欠ける).
"""
import pathlib
import re

ALIASES = {
    'いい／よい': 'いい・よい', '速い・早い': '早い・速い',
    'ごちそう': 'ご馳走', 'だれ': '誰', 'ほしい': '欲しい',
    '賑やか': 'にぎやか', 'ギョーザ': '餃子', 'うち': '内',
    'ここ': '此処', 'これ': '此れ', 'ころ': '頃', 'そば': '傍',
    'ところ': '所', 'みんな': '皆', '目覚しい': '目覚ましい',
}
ORIGINAL_PHOTOS = dict(zip(range(189, 199), [
    'IMG_4754.jpeg', 'IMG_4755.jpeg', 'IMG_4756.jpeg', 'IMG_4757.jpeg',
    'IMG_4758.jpeg', 'IMG_4759(1).jpeg', 'IMG_4760.jpeg',
    'IMG_4761.jpeg', 'IMG_4766.jpeg', 'IMG_4771.jpg',
]))


def import_completion(words):
    # Four early provenance annotations disagreed with the photographed rows.
    # Keep IDs/words/readings; repair only the source and lesson annotations.
    for w in words:
        if w['word'] == '交流':
            w['sources'] = [s for s in w['sources'] if not (s['collection'] == 'original' and s['page'] == 192)]
            if w['collection'] == 'original':
                source = w['sources'][0]
                w.update(collection=source['collection'], page=source['page'], lesson=source['lesson'])
        corrected_lesson = {'たくさん': '6-1', 'タクシー': '14-2', '冷たい': '13-2'}.get(w['word'])
        if corrected_lesson:
            for source in w['sources']:
                if source['collection'] == 'original':
                    source['lesson'] = corrected_lesson
            if w['collection'] == 'original':
                w['lesson'] = corrected_lesson
    lookup = {}
    names = {w['word'] for w in words}

    def index(w):
        for name in [w['word'], w.get('quizWritten', w['word']), *w.get('aliases', [])]:
            name = re.sub(r'（[ぁ-ゖァ-ヺー・]+）$', '', name)
            for reading in [w['kana'], *w.get('acceptedKana', [])]:
                lookup[(name, reading)] = w

    for w in words:
        index(w)
    start = len(words)
    reports = []
    for collection, filename in [('original', 'original-189-198.tsv'), ('index4', 'index-193-195.tsv')]:
        page = None
        counts, records = {}, []
        before = len(words)
        for line in pathlib.Path(__file__).with_name(filename).read_text().splitlines():
            if not line or line.startswith('#'):
                continue
            if line.startswith('@'):
                page = int(line[1:])
                counts[page] = 0
                continue
            entry, kana, meaning, pos, lesson = line.split('|')
            counts[page] += 1
            lesson = None if lesson == '?' else lesson
            photo = ORIGINAL_PHOTOS[page] if collection == 'original' else f'IMG_{page + 4831} 4.JPG'
            source = dict(collection=collection, page=page, lesson=lesson,
                          photo=photo, entry=entry, row=counts[page])
            targets = entry.split('・') if entry in ['暖かい・温かい', '暑い・熱い'] else [ALIASES.get(entry, entry)]
            reading = 'ぎょうざ' if entry == 'ギョーザ' else kana
            for canonical in targets:
                existing = lookup.get((canonical, reading))
                status = 'existing' if existing else 'added'
                if existing:
                    # Upgrade the old page/lesson-only provenance instead of duplicating it.
                    old_source = next((s for s in existing['sources'] if s.get('collection') == collection
                                       and s.get('page') == page and s.get('lesson') == lesson
                                       and not s.get('entry')), None)
                    if old_source is not None:
                        old_source.update(source)
                    elif source not in existing['sources']:
                        existing['sources'].append(source.copy())
                else:
                    display = canonical if canonical not in names else canonical + '（' + reading + '）'
                    assert display not in names, (display, source)
                    existing = dict(word=display, kana=reading, meaning=meaning, pos=pos,
                                    lesson=lesson, page=page, note='', source='book',
                                    collection=collection, sources=[source.copy()])
                    if display != canonical:
                        existing['quizWritten'] = canonical
                    if canonical == '目覚ましい':
                        existing['aliases'] = ['目覚しい']
                        existing['note'] = '照片写作「目覚しい」，词卡采用常用写法「目覚ましい」，读めざましい。'
                    words.append(existing)
                    names.add(display)
                    index(existing)
                records.append(dict(page=page, row=counts[page], entry=entry,
                                    word=existing['word'], status=status))
        reports.append(dict(collection=collection, sourceRows=sum(counts.values()),
                            added=len(words) - before,
                            pages=[dict(page=p, entries=n) for p, n in counts.items()], records=records))
    return dict(date='2026-10-23', previousTotal=start, sourceRows=sum(r['sourceRows'] for r in reports),
                added=len(words) - start, collections=reports)
