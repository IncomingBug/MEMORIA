const test = require("node:test");
const assert = require("node:assert/strict");

global.window = {};
global.document = {};
require("../public/js/scrapbook-viewer.js");

function makeViewer(entries) {
  const viewer = Object.create(global.window.ScrapbookViewer.prototype);
  viewer.entries = entries;
  return viewer;
}

test("last weekend range includes Saturday and Sunday, including on Monday", () => {
  const viewer = makeViewer([]);

  assert.deepEqual(
    viewer.getLastWeekendRange(new Date(2026, 10, 22, 12)),
    { startDate: "2026-11-21", endDate: "2026-11-22" }
  );
  assert.deepEqual(
    viewer.getLastWeekendRange(new Date(2026, 10, 23, 12)),
    { startDate: "2026-11-21", endDate: "2026-11-22" }
  );
  assert.deepEqual(
    viewer.getLastWeekendRange(new Date(2026, 10, 21, 12)),
    { startDate: "2026-11-21", endDate: "2026-11-21" }
  );
});

test("weekend reel selects at most five matching memories in chronological order", () => {
  const viewer = makeViewer([
    { id: "outside", date: "2026-11-20" },
    { id: "one", date: "2026-11-21", time: "09:00" },
    { id: "two", date: "2026-11-21", time: "10:00" },
    { id: "three", date: "2026-11-21", time: "11:00" },
    { id: "four", date: "2026-11-22", time: "09:00" },
    { id: "five", date: "2026-11-22", time: "10:00" },
    { id: "six", date: "2026-11-22", time: "11:00" },
    { id: "future", date: "2026-11-23" }
  ]);

  const entries = viewer.getLastWeekendEntries({
    startDate: "2026-11-21",
    endDate: "2026-11-22"
  });
  assert.deepEqual(entries.map(entry => entry.id), ["two", "three", "four", "five", "six"]);
});
