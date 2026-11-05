"""Import the reviewed 111-row checklist without replacing existing records."""
import pathlib

COLLECTION = 'supplement20261105'
DOCUMENT = '词汇补全最终清单.md'
FIELDS = 'word kana meaning pos note jp exampleKana zh transitivity companions rawKana rawWord rawMeaning section originalNumber suggestedPriority'.split()


def supplement_rows():
    rows = []
    for line in pathlib.Path(__file__).with_name('supplement-20261105.tsv').read_text().splitlines():
        if not line or line.startswith('#'):
            continue
        values = line.split('|')
        assert len(values) == len(FIELDS), line
        rows.append(dict(zip(FIELDS, values)))
    assert len(rows) == 111
    return rows


def import_supplement(words):
    lookup = {(w['word'], w['kana']): w for w in words}
    records = []
    for number, row in enumerate(supplement_rows(), 1):
        key = (row['word'], row['kana'])
        existing = lookup.get(key)
        status = 'existing' if existing else 'added'
        provenance = dict(collection=COLLECTION, document=DOCUMENT, number=number,
                          page=None, lesson=None, entry=row['rawWord'], reading=row['rawKana'],
                          section=row['section'], originalNumber=int(row['originalNumber']),
                          originalMeaning=row['rawMeaning'])
        if number <= 6:
            provenance['reportedBook'] = '提高1' if number <= 2 else '提高2'
        if existing:
            existing['sources'].append(provenance)
        else:
            assert row['word'] not in {w['word'] for w in words}, row['word']
            existing = dict(word=row['word'], kana=row['kana'], meaning=row['meaning'],
                            pos=row['pos'], note=row['note'], source='supplement',
                            collection=COLLECTION, number=number, page=None, lesson=None,
                            sources=[provenance])
            words.append(existing)
            lookup[key] = existing
        records.append(dict(number=number, word=existing['word'], kana=existing['kana'],
                            status=status,
                            suggestedPriority=row['suggestedPriority']))
    return dict(sourceRows=len(records), added=sum(r['status'] == 'added' for r in records),
                matched=sum(r['status'] == 'existing' for r in records), records=records)


def attach_supplement_details(words, meta, report):
    by_word = {w['word']: w for w in words}
    for row in supplement_rows():
        w = by_word[row['word']]
        # Original checklist spellings are accepted only after checking them.
        variant = row['rawWord']
        if variant != w['word'] and variant not in ['居ぐ', '直に']:
            w['acceptedWritten'] = sorted(set(w['acceptedWritten'] + [variant]))
        if w['word'] == '今更':
            w['acceptedWritten'] = sorted(set(w['acceptedWritten'] + ['今さら']))
        w.setdefault('example', dict(jp=row['jp'], kana=row['exampleKana'], zh=row['zh']))
        if w['source'] == 'supplement' and row['transitivity'] == '自动词' and w['forms']:
            w['forms']['potential'] = None
    meta['supplementImports'] = report
    meta['collections'][COLLECTION] = dict(label='词汇补全清单', document=DOCUMENT)
    meta['counts'][COLLECTION] = report['added']
    meta['sources'].append(dict(title=DOCUMENT, description='核对全部111项，新增104项、已有7项补充例句和用法。原小节与项号保留；“提高1/2”只为清单声称的教材出处，未据此虚构照片、页码或课次。清单星级只作学习建议，不作为经验证的考试频率。'))
    meta['bookRange'] += '；2026-11-05词汇补全清单'
    meta['scopeNote'] += '另核对补全清单111项，校正词形、读音、词性和常用义；保留既有记录。'
