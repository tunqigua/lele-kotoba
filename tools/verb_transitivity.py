"""Attach reviewed, reading-specific verb labels and bidirectional counterparts.

Derived classification data in verb-transitivity.json is CC BY-SA 4.0.
No guessing from endings or automatically constructed causative forms.
"""
import json
import pathlib


def attach_verb_transitivity(words, meta):
    source = json.loads(pathlib.Path(__file__).with_name('verb-transitivity.json').read_text())
    entries = {x['id']: x for x in source['entries']}
    verbs = {w['id']: w for w in words if '动词' in w['pos'] or 'サ变' in w['pos']}
    assert set(entries) == set(verbs), 'Every verb needs a reviewed classification'
    by_key = {(w['word'], w['kana']): w for w in words}
    for wid, w in verbs.items():
        entry = entries[wid]
        assert (entry['word'], entry['kana']) == (w['word'], w['kana'])
        assert entry['label'] in ['自动词', '他动词', '自他动词', '可能形']
        w.update(transitivity=entry['label'], transitivityNote=entry['note'], counterparts=[])
    for pair in source['pairs']:
        for own, other, label in [('automatic', 'transitive', '他动词'), ('transitive', 'automatic', '自动词')]:
            w = by_key.get((pair[own]['word'], pair[own]['kana']))
            if not w:
                continue
            companion = pair[other]
            target = by_key.get((companion['word'], companion['kana']))
            item = dict(companion, transitivity=label)
            if target:
                item['id'] = target['id']
            assert item not in w['counterparts']
            w['counterparts'].append(item)
    meta.update(version='2026.10.24.2', verbTransitivity=dict(total=len(verbs), withCounterparts=sum(bool(w['counterparts']) for w in verbs.values()), pairs=len(source['pairs'])))
    meta['sources'].append(dict(title='JMdict/EDICT 动词自他分类', url=source['documentationUrl'], description=source['copyright'] + '。分类数据按 CC BY-SA 4.0 使用；结合本词库的词形、读音和词义修正同音词及多义词，另编双向对应词。许可：' + source['licenseUrl']))
