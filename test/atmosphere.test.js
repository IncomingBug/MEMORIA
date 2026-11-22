const test = require("node:test");
const assert = require("node:assert/strict");

global.window = {};
require("../public/js/utils.js");
const Utils = global.window.Utils;

test("Memory titles use story words and stay concise", () => {
  const title = Utils.generateMemoryTitle(
    "We walked through the yellow park, drank cocoa, and talked for hours.",
    "2026-11-22"
  );
  const words = title.split(/\s+/);

  assert(words.length >= 3 && words.length <= 5);
  assert.match(title, /Yellow/);
  assert.match(title, /Park/);
});

test("Short stories receive a dated title with at least three words", () => {
  const title = Utils.generateMemoryTitle("I smiled.", "2026-11-22");

  assert.equal(title, "Smiled November Day Memory");
});

test("Mood and soundtrack atmosphere produce distinct page treatments", () => {
  const quietDay = Utils.getMemoryAtmosphere(2, "quiet");
  const energeticDay = Utils.getMemoryAtmosphere(5, "restless");
  const filteredDay = Utils.getMemoryAtmosphere(4, "warm", "bw");

  assert.notEqual(quietDay.paperColor, energeticDay.paperColor);
  assert.notEqual(quietDay.noteColor, energeticDay.noteColor);
  assert.notEqual(quietDay.layout.photoWidth, energeticDay.layout.photoWidth);
  assert.equal(filteredDay.photoFilter, "grayscale(1)");
});
