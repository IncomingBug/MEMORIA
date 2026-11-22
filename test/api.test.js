const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const net = require("node:net");

const testDbPath = path.join(__dirname, "test-memoria.sqlite");
if (fs.existsSync(testDbPath)) {
  try { fs.unlinkSync(testDbPath); } catch {}
}
process.env.DB_PATH = testDbPath;

const app = require("../server.js");

function computeAverageMood(moodNumbers) {
  if (!Array.isArray(moodNumbers) || moodNumbers.length === 0) {
    return { average: 0, label: "None" };
  }
  const sum = moodNumbers.reduce((acc, m) => acc + Number(m), 0);
  const average = Math.round((sum / moodNumbers.length) * 10) / 10;
  let label = "Awful";
  if (average >= 4.5) label = "Great";
  else if (average >= 3.5) label = "Good";
  else if (average >= 2.5) label = "Not bad";
  else if (average >= 1.5) label = "Not that bad";
  return { average, label };
}

test("Plain JS Mood calculation matches specifications", () => {
  assert.equal(computeAverageMood([5, 5, 4]).label, "Great"); // 4.7
  assert.equal(computeAverageMood([4, 4, 3]).label, "Good"); // 3.7
  assert.equal(computeAverageMood([3, 3, 2]).label, "Not bad"); // 2.7
  assert.equal(computeAverageMood([2, 1, 2]).label, "Not that bad"); // 1.7
  assert.equal(computeAverageMood([1, 1, 1]).label, "Awful"); // 1.0
  assert.equal(computeAverageMood([]).label, "None");
});

test("Express API Suite: User, Entries, Drafts Limit, Tags, Uploads", async (t) => {
  let server;
  let port;

  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      port = server.address().port;
      resolve();
    });
  });

  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  const headers = { "Content-Type": "application/json", "X-User-Id": "test_user" };

  await t.test("GET /api/user returns default user", async () => {
    const res = await fetch(`${baseUrl}/api/user`, { headers });
    assert.equal(res.status, 200);
    const user = await res.json();
    assert.equal(user.id, "test_user");
  });

  await t.test("POST /api/tags and GET /api/tags", async () => {
    const createRes = await fetch(`${baseUrl}/api/tags`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Travel", color: "#4caf50" })
    });
    assert.equal(createRes.status, 200);
    const tag = await createRes.json();
    assert.equal(tag.name, "Travel");
    assert.equal(tag.color, "#4caf50");

    const listRes = await fetch(`${baseUrl}/api/tags`, { headers });
    const tags = await listRes.json();
    assert(tags.some(t => t.name === "Travel"));
  });

  await t.test("POST /api/entries saves and GET /api/entries retrieves", async () => {
    const newEntry = {
      date: "2026-11-22",
      time: "15:00",
      mood: 5,
      title: "First Entry",
      description: "Wonderful afternoon spent journaling.",
      tags: ["tag-travel"],
      music: { title: "Song A", artist: "Artist B" }
    };

    const saveRes = await fetch(`${baseUrl}/api/entries`, {
      method: "POST",
      headers,
      body: JSON.stringify(newEntry)
    });
    assert.equal(saveRes.status, 200);
    const saved = await saveRes.json();
    assert.equal(saved.title, "First Entry");
    assert.equal(saved.mood, 5);

    const listRes = await fetch(`${baseUrl}/api/entries`, { headers });
    const list = await listRes.json();
    assert.equal(list.length, 1);
    assert.equal(list[0].title, "First Entry");
  });

  await t.test("Enforce MAX 5 drafts per user", async () => {
    for (let i = 1; i <= 5; i++) {
      const res = await fetch(`${baseUrl}/api/drafts`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: `draft-${i}`,
          step: 2,
          partialEntry: { title: `Draft ${i}` }
        })
      });
      assert.equal(res.status, 200);
    }

    // 6th draft must be rejected with 400
    const sixthRes = await fetch(`${baseUrl}/api/drafts`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "draft-6",
        step: 1,
        partialEntry: { title: "Draft 6" }
      })
    });
    assert.equal(sixthRes.status, 400);
    const err = await sixthRes.json();
    assert(err.error.includes("maximum limit of 5 drafts"));

    // Updating an existing draft should still be permitted
    const updateRes = await fetch(`${baseUrl}/api/drafts`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "draft-1",
        step: 3,
        partialEntry: { title: "Draft 1 Updated" }
      })
    });
    assert.equal(updateRes.status, 200);

    // Deleting a draft frees up a slot
    const deleteRes = await fetch(`${baseUrl}/api/drafts/draft-1`, {
      method: "DELETE",
      headers
    });
    assert.equal(deleteRes.status, 200);

    // Now a new 5th draft can be created
    const seventhRes = await fetch(`${baseUrl}/api/drafts`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "draft-new",
        step: 1,
        partialEntry: { title: "Draft New" }
      })
    });
    assert.equal(seventhRes.status, 200);
  });

  await t.test("POST /api/uploads rejects > 10 files", async () => {
    const files = Array.from({ length: 11 }, (_, i) => ({
      name: `test-${i}.jpg`,
      dataUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRg=="
    }));
    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: "POST",
      headers,
      body: JSON.stringify({ files })
    });
    assert.equal(res.status, 400);
    const err = await res.json();
    assert(err.error.includes("Maximum 10 media files"));
  });

  await t.test("POST /api/ai/followup returns follow-up questions", async () => {
    const res = await fetch(`${baseUrl}/api/ai/followup`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text: "Today was my birthday party in the garden." })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert(Array.isArray(data.questions));
    assert(data.questions.length > 0);
  });

  await t.test("GET /api/music/youtube-search returns results or valid status", async () => {
    const res = await fetch(`${baseUrl}/api/music/youtube-search?term=piano&country=US`, { headers });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert(Array.isArray(data.results));
  });

  await t.test("POST /api/ai/summary returns reflective summary", async () => {
    const res = await fetch(`${baseUrl}/api/ai/summary`, {
      method: "POST",
      headers,
      body: JSON.stringify({ period: "the past week", moodAverageLabel: "Good", entriesCount: 3 })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert(typeof data.summary === "string" && data.summary.length > 5);
  });
});
