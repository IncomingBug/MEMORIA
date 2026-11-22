const test = require("node:test");
const assert = require("node:assert/strict");

global.window = {};
global.getComputedStyle = element => element.computedStyle;
require("../public/js/scrapbook-editor.js");

function makeEditor(type, { y = 10, height = 10, scrollHeight = 200, paddingTop = "0px", paddingBottom = "0px" } = {}) {
  const text = { scrollHeight };
  const box = {
    scrollHeight,
    style: {},
    computedStyle: { paddingTop, paddingBottom },
    querySelector: () => text
  };
  const page = { getBoundingClientRect: () => ({ height: 1000 }) };
  const element = {
    style: {},
    closest: () => page,
    querySelector: selector => selector === ".sticky-note" || selector === ".scrapbook-plain-text" ? box : null
  };
  const editor = Object.create(global.window.ScrapbookEditor.prototype);
  editor.selectedElementModel = { type, y, h: height };
  return { editor, element, box };
}

test("sticky text grows to fit while accounting for note padding", () => {
  const { editor, element, box } = makeEditor("sticky", {
    scrollHeight: 200,
    paddingTop: "16px",
    paddingBottom: "16px"
  });

  assert.equal(editor.fitTextToContent(element), true);
  assert.ok(Math.abs(editor.selectedElementModel.h - 23.2) < 0.001);
  assert.equal(box.style.overflowY, "hidden");
});

test("plain text grows to fit and wraps inside its element", () => {
  const { editor, element, box } = makeEditor("text", { scrollHeight: 300 });

  assert.equal(editor.fitTextToContent(element), true);
  assert.equal(editor.selectedElementModel.h, 30);
  assert.equal(box.style.overflowX, "hidden");
});

test("text taller than the remaining page stays scrollable within page bounds", () => {
  const { editor, element, box } = makeEditor("text", {
    y: 70,
    height: 10,
    scrollHeight: 600
  });

  assert.equal(editor.fitTextToContent(element), true);
  assert.equal(editor.selectedElementModel.h, 30);
  assert.equal(box.style.overflowY, "auto");
});
