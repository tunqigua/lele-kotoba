// App-level guards: keyboard focus must not be hijacked, and a stale tab must
// not overwrite progress written by another tab.
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const root = __dirname + "/../dist/";

function boot() {
  const els = new Map(), handlers = {}, winHandlers = {}, storage = new Map();
  const el = selector => {
    if (!els.has(selector)) els.set(selector, {
      innerHTML: "", textContent: "", value: "", style: {}, dataset: {}, files: [],
      classList: { add() {}, remove() {}, toggle() {} },
      showModal() { this.open = true; }, close() { this.open = false; },
      click() {}, remove() {}
    });
    return els.get(selector);
  };
  const document = {
    querySelector(selector) {
      if (selector === "dialog[open]") return [...els.values()].find(node => node.open) || null;
      return el(selector);
    },
    querySelectorAll() { return []; },
    addEventListener(name, callback) { handlers[name] = callback; },
    createElement() { return { ...el(String(Math.random())), click() {}, remove() {}, set id(v) { els.set("#" + v, this); } }; },
    body: { append() {} }
  };
  const ctx = {
    document,
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key)
    },
    location: { hash: "" },
    history: { replaceState(a, b, hash) { ctx.location.hash = hash; } },
    setTimeout() { return 1; }, clearTimeout() {}, confirm() { return true; },
    Date, Intl, Map, Set, Math, Blob, URL, console,
    SpeechSynthesisUtterance: function (text) { this.text = text; },
    speechSynthesis: { getVoices: () => [{ lang: "ja-JP", name: "test" }], cancel() {}, speak() {} }
  };
  ctx.window = { ...ctx, scrollY: 0, scrollTo() {}, addEventListener(name, callback) { winHandlers[name] = callback; } };
  vm.createContext(ctx);
  for (const file of ["data.js", "engine.js", "quiz.js", "app.js"]) {
    vm.runInContext(fs.readFileSync(root + file, "utf8"), ctx, { filename: file });
  }
  return { ctx, els, el, handlers, winHandlers, storage };
}

const KEY = "lele-kotoba-v4";

test("plan toggle keeps the current card and progress, and remembers its state after reload", () => {
  const { ctx, el, handlers, storage } = boot();
  const preference = "lele-kotoba-plan-hidden";
  const snapshot = () => { const s = JSON.parse(storage.get(KEY)); return JSON.stringify({ words:s.words, logs:s.logs, settings:s.settings, readingPlan:s.readingPlan }); };
  const before = snapshot(), card = el("#main").innerHTML;
  const button = { dataset:{action:"togglePlan"}, setAttribute(name,value){this[name]=value;} };
  const click = () => handlers.click({target:{closest:selector=>selector==="[data-action]"?button:null}});
  assert.match(card, /aria-controls="studyPlan" aria-expanded="true"/);
  click();assert.equal(storage.get(preference),"true");assert.equal(el("#studyPlan").hidden,true);
  assert.equal(button["aria-expanded"],"false");assert.equal(button.textContent,"展开学习计划");
  assert.equal(el("#main").innerHTML,card,"toggle must not redraw the card or reset the question");
  assert.equal(snapshot(),before);
  vm.runInContext(fs.readFileSync(root+"app.js","utf8"),ctx,{filename:"app.js"});
  assert.match(el("#main").innerHTML,/id="studyPlan" hidden/);
  assert.match(el("#main").innerHTML,/aria-controls="studyPlan" aria-expanded="false"/);
  click();assert.equal(storage.get(preference),"false");assert.equal(el("#studyPlan").hidden,false);
  assert.equal(snapshot(),before);
});

test("the plan can still be expanded or collapsed when preference storage is unavailable", () => {
  const { ctx, el, handlers } = boot(), original = ctx.localStorage.setItem;
  ctx.localStorage.setItem = (key,value) => { if(key==="lele-kotoba-plan-hidden")throw Error("storage unavailable");original(key,value); };
  const button={dataset:{action:"togglePlan"},setAttribute(){}};
  const click=()=>handlers.click({target:{closest:selector=>selector==="[data-action]"?button:null}});
  assert.doesNotThrow(click);assert.equal(el("#studyPlan").hidden,true);
  assert.doesNotThrow(click);assert.equal(el("#studyPlan").hidden,false);
});

test("Enter on a focused row button is left to the button, not the row", () => {
  const { ctx, el, handlers } = boot();
  const id = ctx.window.KOTOBA_DATA.words[0].id;
  const button = { closest: selector => selector.includes("button") ? button : null };
  handlers.keydown({ key: "Enter", ctrlKey: false, metaKey: false, altKey: false, preventDefault() {}, target: button });
  assert.notEqual(el("#detailDialog").open, true, "the star button must keep its own activation");
  const row = { dataset: { id }, closest: selector => selector === "tr[data-id]" ? row : null };
  handlers.keydown({ key: "Enter", ctrlKey: false, metaKey: false, altKey: false, preventDefault() {}, target: row });
  assert.equal(el("#detailDialog").open, true, "Enter on the row itself still opens the word");
});

test("typing shortcuts keep working when focus is not on a control", () => {
  const { ctx, handlers } = boot();
  const target = { closest: () => null, matches: () => false };
  handlers.keydown({ key: "1", code: "Digit1", ctrlKey: false, metaKey: false, altKey: false, preventDefault() {}, target });
  assert.ok(true, "no exception while focus sits on the page body");
});

test("a stale tab refuses to overwrite progress written by another tab", () => {
  const { ctx, el, handlers, winHandlers, storage } = boot();
  const id = ctx.window.KOTOBA_DATA.words[0].id;
  const base = JSON.parse(storage.get(KEY));
  const other = { ...base, savedAt: "2099-01-01T00:00:00.000Z" };
  storage.set(KEY, JSON.stringify(other));
  const button = { dataset: { action: "star", id }, disabled: false };
  handlers.click({ target: { closest: selector => selector === "[data-action]" ? button : null } });
  const after = JSON.parse(storage.get(KEY));
  assert.equal(after.savedAt, "2099-01-01T00:00:00.000Z", "the other tab's payload must survive");
  assert.equal(after.words[id]?.star, undefined, "this tab's star must not be written");
  assert.match(el("#saveStatus").textContent, /待刷新/);
  // The storage event means this tab has caught up, so writing resumes.
  winHandlers.storage({ key: KEY, newValue: JSON.stringify(other) });
  assert.match(el("#saveStatus").textContent, /本机保存/);
  handlers.click({ target: { closest: selector => selector === "[data-action]" ? button : null } });
  assert.equal(JSON.parse(storage.get(KEY)).words[id].star, true);
});

test("a fresh tab with no prior writes is never blocked", () => {
  const { ctx, el, handlers, storage } = boot();
  const id = ctx.window.KOTOBA_DATA.words[0].id;
  const button = { dataset: { action: "star", id }, disabled: false };
  handlers.click({ target: { closest: selector => selector === "[data-action]" ? button : null } });
  assert.equal(JSON.parse(storage.get(KEY)).words[id].star, true);
  assert.match(el("#saveStatus").textContent, /本机保存/);
});

test("resuming a page catches up with saved progress before writing", () => {
  for (const event of ["pageshow", "focus"]) {
    const { ctx, handlers, winHandlers, storage } = boot();
    const E = ctx.window.KotobaEngine, id = ctx.window.KOTOBA_DATA.words[0].id;
    const other = JSON.parse(storage.get(KEY));
    E.rate(other, id, "good");
    other.savedAt = "2099-01-01T00:00:00.000Z";
    storage.set(KEY, JSON.stringify(other));
    winHandlers[event]();
    const button = { dataset: { action: "star", id }, disabled: false };
    handlers.click({ target: { closest: selector => selector === "[data-action]" ? button : null } });
    const after = JSON.parse(storage.get(KEY));
    assert.equal(after.words[id].seen, 1, event);
    assert.equal(after.words[id].star, true, event);
    assert.deepEqual(after.logs, JSON.parse(JSON.stringify(other.logs)), event);
  }
});
