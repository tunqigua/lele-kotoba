const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const E = require("../dist/engine.js");
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(__dirname + "/../dist/data.js", "utf8"), sandbox);
const { words } = sandbox.window.KOTOBA_DATA;
const ids = new Set(words.map(w => w.id));
const now = Date.parse("2026-10-20T08:00:00Z");

test("migrated records keep the day of their first log instead of today", () => {
  const id = words[0].id;
  const firstDay = E.today(E.dayStart(Date.now()) - 40 * E.DAY);
  const raw = {
    schema: 1,
    words: { [id]: { stage: 1, due: E.dayStart(now) + E.DAY, seen: 3, lapses: 0, star: false } },
    logs: [
      { id, day: firstDay, grade: "good" },
      { id, day: E.today(E.dayStart(Date.now()) - 10 * E.DAY), grade: "quizRight" }
    ],
    savedAt: new Date(Date.now() - 5 * E.DAY).toISOString()
  };
  const migrated = E.validate(raw, ids);
  assert.equal(migrated.words[id].learnedOn, firstDay);
});

test("records without logs are never treated as learned today", () => {
  const id = words[1].id;
  const raw = {
    schema: 1,
    words: { [id]: { stage: 1, due: 0, seen: 2, lapses: 0, star: false } },
    logs: [],
    savedAt: new Date(Date.now() - 5 * E.DAY).toISOString()
  };
  const migrated = E.validate(raw, ids);
  const yesterday = E.today(E.dayStart(Date.now()) - E.DAY);
  assert.ok(migrated.words[id].learnedOn < yesterday, `learnedOn=${migrated.words[id].learnedOn}`);
  assert.notEqual(migrated.words[id].learnedOn, E.today());
});

test("records with neither logs nor savedAt fall back to an older day, never today", () => {
  const id = words[2].id;
  const raw = { schema: 1, words: { [id]: { stage: 0, due: 0, seen: 1, lapses: 0, star: false } }, logs: [] };
  const migrated = E.validate(raw, ids);
  const yesterday = E.today(E.dayStart(Date.now()) - E.DAY);
  assert.ok(migrated.words[id].learnedOn < yesterday, `learnedOn=${migrated.words[id].learnedOn}`);
});

test("a valid learnedOn is preserved, including the day the word was first learned", () => {
  const id = words[3].id;
  const learnedOn = E.today(E.dayStart(Date.now()) - 9 * E.DAY);
  const raw = {
    schema: 1,
    words: { [id]: { stage: 2, due: 0, seen: 6, lapses: 0, star: false, learnedOn } },
    logs: [{ id, day: E.today(), grade: "good" }]
  };
  assert.equal(E.validate(raw, ids).words[id].learnedOn, learnedOn);
});

test("a future learnedOn is not trusted", () => {
  const id = words[4].id;
  const raw = {
    schema: 1,
    words: { [id]: { stage: 1, due: 0, seen: 2, lapses: 0, star: false, learnedOn: "2099-01-01" } },
    logs: []
  };
  assert.notEqual(E.validate(raw, ids).words[id].learnedOn, "2099-01-01");
});

test("marking a card as known clears a pending reading retry and the due queue", () => {
  const id = words[5].id;
  const state = E.fresh();
  state.words[id] = {
    stage: 1, due: 0, seen: 3, lapses: 0, star: false, learnedOn: E.today(now),
    readingRetry: true, reviewPending: true, relearning: true
  };
  assert.equal(E.isDue(state.words[id], now, state), true);
  E.rate(state, id, "good", now);
  assert.equal(state.words[id].readingRetry, false);
  assert.equal(E.isDue(state.words[id], now, state), false);
  assert.equal(E.queue(words, state, "review", now).some(w => w.id === id), false);
});

test("answering a review reading question right also clears the retry", () => {
  const id = words[6].id;
  const state = E.fresh();
  state.words[id] = {
    stage: 1, due: 0, seen: 4, lapses: 0, star: false, learnedOn: E.today(now),
    readingRetry: true, reviewPending: true, relearning: true
  };
  E.rate(state, id, "good", now, "reading");
  assert.equal(state.words[id].readingRetry, false);
  assert.equal(E.isDue(state.words[id], now, state), false);
});
