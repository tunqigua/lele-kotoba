"""Import the two photographed indexes without changing existing vocabulary IDs."""
import pathlib
import re

SPECS = [
    ('index3', '扩展词表一', 'index-225-237.tsv', range(225, 238), 4779),
    ('index4', '扩展词表二', 'index-186-192.tsv', range(186, 193), 4831),
]


def import_indexes(words):
    lookup = {}
    for word in words:
        names = [word['word'], word.get('quizWritten', word['word']), *word.get('aliases', [])]
        for name in names:
            lookup.setdefault((name, word['kana']), word)
            lookup.setdefault((re.sub(r'（[ぁ-ゖァ-ヺー・]+）$', '', name), word['kana']), word)
    used_names = {w['word'] for w in words}
    before = len(words)
    imports = []
    for collection, label, filename, pages, photo_offset in SPECS:
        page = None
        page_counts = {}
        start_count = len(words)
        for line in pathlib.Path(__file__).with_name(filename).read_text().splitlines():
            if not line or line.startswith('#'):
                continue
            if line.startswith('@'):
                page = int(line[1:])
                assert page in pages
                page_counts[page] = 0
                continue
            name, kana, meaning, pos, lesson = line.split('|')
            page_counts[page] += 1
            source = dict(collection=collection, page=page, lesson=lesson,
                          photo=f'IMG_{page + photo_offset} {4 if page + photo_offset == 5009 else 3}.JPG', entry=name)
            rows = [(name, kana, meaning)]
            note = ''
            if name == 'バトミントン':
                rows = [('バドミントン', 'バドミントン', '羽毛球')]
                note = '照片原印「バトミントン」缺少浊点，规范写法为「バドミントン」；训练按规范出题。'
            elif name == '訪ねる・尋ねる':
                rows = [('訪ねる', kana, '拜访；访问'), ('尋ねる', kana, '询问；寻找')]
            elif name == '直す・治す':
                rows = [('直す', kana, '修理；改正'), ('治す', kana, '治疗；治好')]
            elif name == 'すくなくとも':
                rows = [('少なくとも', kana, meaning)]
            elif name == '以上':
                rows = [('〜以上', kana, meaning)]
            for canonical, reading, chinese in rows:
                existing = lookup.get((canonical, reading))
                if existing:
                    existing['sources'].append(source.copy())
                    if existing['source'] == 'exam':
                        existing.update(source='book', collection=collection, page=page, lesson=lesson)
                    if note:
                        existing['note'] = (existing.get('note', '') + ' ' + note).strip()
                    continue
                display_name = canonical if canonical not in used_names else canonical + '（' + reading + '）'
                assert display_name not in used_names, (display_name, source)
                word = dict(word=display_name, kana=reading, meaning=chinese, pos=pos, lesson=lesson,
                            page=page, note=note, source='book', collection=collection, sources=[source.copy()])
                if canonical != display_name:
                    word['quizWritten'] = canonical
                if note:
                    word['aliases'] = [name]
                words.append(word)
                used_names.add(display_name)
                lookup[(canonical, reading)] = word
        assert set(page_counts) == set(pages)
        imports.append(dict(collection=collection, label=label, sourceRows=sum(page_counts.values()),
                            added=len(words) - start_count,
                            pages=[dict(page=p, entries=n, photo=f'IMG_{p + photo_offset} {4 if p + photo_offset == 5009 else 3}.JPG')
                                   for p, n in page_counts.items()]))
    return dict(date='2026-10-22', sourceRows=sum(x['sourceRows'] for x in imports), added=len(words) - before, collections=imports)
