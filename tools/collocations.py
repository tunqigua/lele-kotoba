"""Attach word-specific, authored Japanese collocations and usage examples.

The source file records one reviewed entry per stable vocabulary ID. There is
deliberately no POS-based fallback: missing content fails the data build.
"""
import json
import pathlib
import re


def attach_collocations(words, meta):
    source = json.loads(pathlib.Path(__file__).with_name('collocations.json').read_text())
    entries = {entry['id']: entry for entry in source['entries']}
    assert len(entries) == len(source['entries']) == len(words)
    assert set(entries) == {w['id'] for w in words}
    by_id = {w['id']: w for w in words}
    replaced = 0
    for w in words:
        entry = entries[w['id']]
        assert entry['word'] == w['word'] and entry['kana'] == w['kana']
        assert 1 <= len(entry['items']) <= 3
        original = w['note']
        auto_form = f"{w['pos']}；て形「{w['forms']['te']}」、ない形「{w['forms']['nai']}」。" if w['forms'] else None
        generic = original in [w['pos'] + '。', w['pos'] + '.', auto_form]
        w['usageNote'] = '' if generic else original
        w['collocations'] = []
        for item in entry['items']:
            assert all(item.get(key) for key in ['jp', 'kana', 'meaning']), w['word']
            assert re.fullmatch(r'[ぁ-ゖァ-ヺー・、。！？!?「」『』（）\s]+', item['kana']), (w['word'], item['kana'])
            collocation = {k: item.get(k, '') for k in ['jp', 'kana', 'meaning', 'tip']}
            # Companion IDs are part of the authored source. Preparation checks
            # complete word boundaries, so なるべく cannot also link なる, and
            # 持ち帰る cannot accidentally link the embedded verb 帰る.
            linked = [w]
            assert len(item['companions']) <= 3
            for companion_id in item['companions']:
                companion = by_id[companion_id]
                assert companion_id not in {x['id'] for x in linked}
                names = {re.sub(r'（.*?）', '', x) for x in [companion['word'], companion.get('quizWritten', companion['word'])]}
                assert any(name in item['jp'] for name in names)
                assert companion['kana'] in item['kana']
                linked.append(companion)
            collocation['words'] = [dict(id=x['id'], word=re.sub(r'（.*?）', '', x.get('quizWritten', x['word'])),
                                        kana=x['kana'], meaning=x['meaning']) for x in linked]
            w['collocations'].append(collocation)
        if generic:
            c = w['collocations'][0]
            w['note'] = f"{c['jp']}（{c['kana']}）＝{c['meaning']}。" + c['tip']
            replaced += 1
    # Keep the established joint-memory content and add genuinely shared usage
    # phrases to both linked words. The learner's ID/progress state is untouched.
    known = {(p['jp'], p['kana']) for w in words for p in w['phrases']}
    for w in words:
        for c in w['collocations']:
            key = (c['jp'], c['kana'])
            if len(c['words']) < 2 or key in known:
                continue
            phrase = {k: c[k] for k in ['jp', 'kana', 'meaning', 'words']}
            for linked in c['words']:
                by_id[linked['id']]['phrases'].append(phrase)
            known.add(key)
    meta.update(version='2026.10.24.1', phraseCount=len(known),
                wordsWithPhrases=sum(bool(w['phrases']) for w in words))
    meta['collocations'] = dict(wordsCovered=len(words), total=sum(len(w['collocations']) for w in words),
                                replacedGenericNotes=replaced,
                                wordsWithUsageTips=sum(any(c['tip'] for c in w['collocations']) for w in words),
                                sources=source.get('sources', []))
    assert not any(w['note'] == w['pos'] + '。' for w in words)
