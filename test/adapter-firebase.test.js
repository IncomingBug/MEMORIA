const test = require("node:test");
const assert = require("node:assert/strict");

global.window = {};
require("../public/js/adapter-firebase.js");

const AdapterFirebase = global.window.AdapterFirebase;
const originalFetch = global.fetch;

test("Firebase adapter returns Apple preview playback URLs", async () => {
  global.fetch = async (url) => {
    assert.match(String(url), /itunes\.apple\.com\/search/);
    return {
      ok: true,
      json: async () => ({
        results: [{
          trackName: "Sample Song",
          artistName: "Sample Artist",
          trackViewUrl: "https://music.apple.com/sample",
          previewUrl: "https://audio-ssl.itunes.apple.com/sample-preview.m4a"
        }]
      })
    };
  };

  try {
    const adapter = new AdapterFirebase({});
    const tracks = await adapter.searchMusic("Sample Song");
    assert.equal(tracks.length, 1);
    assert.equal(tracks[0].provider, "apple");
    assert.equal(tracks[0].previewUrl, "https://audio-ssl.itunes.apple.com/sample-preview.m4a");
  } finally {
    global.fetch = originalFetch;
  }
});
