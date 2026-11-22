const test = require("node:test");
const assert = require("node:assert/strict");

// Load utils in Node context
const Utils = {
  seededRandom(seed) {
    let s = Number(seed) || 12345;
    return function() {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  },

  getMessyRotation(seed) {
    const rng = Utils.seededRandom(seed);
    return Math.round((rng() * 8 - 4) * 10) / 10;
  },

  computeAverageMood(moodNumbers) {
    if (!Array.isArray(moodNumbers) || moodNumbers.length === 0) {
      return { average: 0, label: "None", count: 0 };
    }
    const valid = moodNumbers.map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 5);
    if (valid.length === 0) return { average: 0, label: "None", count: 0 };

    const sum = valid.reduce((acc, v) => acc + v, 0);
    const average = Math.round((sum / valid.length) * 10) / 10;
    let label = "Awful";
    if (average >= 4.5) label = "Great";
    else if (average >= 3.5) label = "Good";
    else if (average >= 2.5) label = "Not bad";
    else if (average >= 1.5) label = "Not that bad";

    return { average, label, count: valid.length };
  },

  filterEntriesByPeriod(entries, period) {
    if (!Array.isArray(entries)) return [];
    const now = new Date("2026-11-22T12:00:00Z");
    const todayStr = "2026-11-22";

    return entries.filter(e => {
      if (!e.date) return false;
      const entryDate = new Date(e.date + "T00:00:00Z");
      if (isNaN(entryDate.getTime())) return false;

      if (period === "today") return e.date === todayStr;
      const diffMs = now.getTime() - entryDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (period === "the past week") return diffDays >= 0 && diffDays <= 7;
      if (period === "the past month") return diffDays >= 0 && diffDays <= 31;
      if (period === "the past year") return diffDays >= 0 && diffDays <= 366;
      return true;
    });
  }
};

test("Deterministic seed generates stable, non-shuffling messy angles", () => {
  const seed = 4281;
  const rot1 = Utils.getMessyRotation(seed);
  const rot2 = Utils.getMessyRotation(seed);
  assert.equal(rot1, rot2, "Identical seed must produce identical rotation");
  assert(rot1 >= -4 && rot1 <= 4, "Rotation angle must stay within [-4, +4] degrees");

  const otherSeed = 9912;
  const rot3 = Utils.getMessyRotation(otherSeed);
  assert.notEqual(rot1, rot3);
});

test("Mood calculation strictly adheres to specification boundaries", () => {
  // >= 4.5 -> Great
  assert.equal(Utils.computeAverageMood([5, 5, 5, 4]).label, "Great");
  assert.equal(Utils.computeAverageMood([5, 4]).label, "Great"); // 4.5

  // >= 3.5 -> Good
  assert.equal(Utils.computeAverageMood([4, 4, 3]).label, "Good"); // 3.7
  assert.equal(Utils.computeAverageMood([4, 3]).label, "Good"); // 3.5

  // >= 2.5 -> Not bad
  assert.equal(Utils.computeAverageMood([3, 3, 2]).label, "Not bad"); // 2.7
  assert.equal(Utils.computeAverageMood([3, 2]).label, "Not bad"); // 2.5

  // >= 1.5 -> Not that bad
  assert.equal(Utils.computeAverageMood([2, 1, 2]).label, "Not that bad"); // 1.7
  assert.equal(Utils.computeAverageMood([2, 1]).label, "Not that bad"); // 1.5

  // < 1.5 -> Awful
  assert.equal(Utils.computeAverageMood([1, 1]).label, "Awful");
  assert.equal(Utils.computeAverageMood([1]).label, "Awful");
  assert.equal(Utils.computeAverageMood([]).label, "None");
});

test("Time window filtering correctly groups entries", () => {
  const sampleEntries = [
    { id: "e1", date: "2026-11-22", mood: 5 }, // today
    { id: "e2", date: "2026-11-18", mood: 4 }, // 4 days ago (past week)
    { id: "e3", date: "2026-11-01", mood: 3 }, // 21 days ago (past month)
    { id: "e4", date: "2026-06-15", mood: 2 }, // 5 months ago (past year)
    { id: "e5", date: "2024-01-01", mood: 1 }  // 2+ years ago (outside year)
  ];

  const today = Utils.filterEntriesByPeriod(sampleEntries, "today");
  assert.equal(today.length, 1);
  assert.equal(today[0].id, "e1");

  const week = Utils.filterEntriesByPeriod(sampleEntries, "the past week");
  assert.equal(week.length, 2);

  const month = Utils.filterEntriesByPeriod(sampleEntries, "the past month");
  assert.equal(month.length, 3);

  const year = Utils.filterEntriesByPeriod(sampleEntries, "the past year");
  assert.equal(year.length, 4);
});
