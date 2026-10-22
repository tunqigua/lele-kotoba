"""Add reviewed Word-table vocabulary; retain IDs and skip existing entries."""
import json
import pathlib
import re

VARIANTS = {'入口': '入り口', '石鹸': '石けん', '茶碗': '茶わん',
            '子供': '子ども', '週間': '〜週間'}


def import_documents(words):
    source = json.loads(pathlib.Path(__file__).with_name('document-vocabulary.json').read_text())
    lookup = {}
    for w in words:
        for name in [w['word'], w.get('quizWritten', w['word']), *w.get('aliases', [])]:
            name = re.sub(r'（[ぁ-ゖァ-ヺー・]+）$', '', name)
            lookup[(name, w['kana'])] = w
    names = {w['word'] for w in words}
    start = len(words)
    imports = []
    for doc in source['documents']:
        added = 0
        records = []
        for row in doc['rows']:
            canonical = VARIANTS.get(row['word'], row['word'])
            readings = row['kana'].split('・')
            for reading in readings:
                # A second ordinary reading of 毎年 does not need a second card.
                key = (canonical, 'まいとし' if canonical == '毎年' else reading)
                existing = lookup.get(key)
                if existing:
                    records.append(dict(number=row['number'], reading=reading,
                                        word=existing['word'], status='existing'))
                    continue
                name = canonical if canonical not in names else canonical + '（' + reading + '）'
                assert name not in names, name
                note = row['note']
                meaning = row['meaning']
                if canonical == '紅葉':
                    meaning = '树叶变红；红叶' if reading == 'こうよう' else '红叶；枫树；枫叶'
                    note = 'こうよう侧重树叶变红的现象；もみじ可指红叶、枫树或枫叶。两种读法都正确。'
                if canonical == '生物' and reading == 'いきもの':
                    meaning = '生物；有生命的东西'
                    note = '本条读いきもの，侧重有生命的东西；另列生物（せいぶつ）的学术表达。'
                provenance = dict(collection=doc['collection'], document=doc['document'],
                                  number=row['number'], table=row.get('table', 1),
                                  page=None, lesson=None, entry=row['raw']['word'])
                word = dict(word=name, kana=reading, meaning=meaning, pos=row['pos'],
                            lesson=None, page=None, note=note, source='document',
                            collection=doc['collection'], number=row['number'], sources=[provenance])
                if name != canonical:
                    word['quizWritten'] = canonical
                words.append(word)
                names.add(name)
                lookup[(canonical, reading)] = word
                records.append(dict(number=row['number'], reading=reading, word=name, status='added'))
                added += 1
        imports.append(dict(collection=doc['collection'], label=doc['label'], document=doc['document'],
                            sourceRows=len(doc['rows']), added=added,
                            matched=sum(r['status'] == 'existing' for r in records), records=records))
    return dict(added=len(words) - start, sourceRows=sum(d['sourceRows'] for d in imports),
                collections=imports, unresolved=source['unresolved'])
