const test = require("node:test");
const assert = require("node:assert/strict");

global.window = {};
require("../public/js/utils.js");
global.Utils = global.window.Utils;
require("../public/js/create-memory.js");

function makeWizard(flowType, currentStep) {
  const wizard = Object.create(global.window.CreateMemoryWizard.prototype);
  wizard.flowType = flowType;
  wizard.currentStep = currentStep;
  wizard.state = {
    dayText: "A quiet walk by the river.",
    description: "",
    followUpAnswers: [{ question: "What did you hear?", answer: "Leaves moving in the wind." }]
  };
  wizard.render = () => {};
  return wizard;
}

test("Skipping reflection questions continues with the story and answers only", () => {
  const wizard = makeWizard("photo", 3);

  wizard.skipCurrentStep();

  assert.equal(wizard.currentStep, 4);
  assert.equal(wizard.state.description, "A quiet walk by the river.\n\n• Leaves moving in the wind.");
  assert.doesNotMatch(wizard.state.description, /What did you hear/);
});

test("Skipping the final photo step saves instead of doing nothing", () => {
  const wizard = makeWizard("photo", 4);
  let saveRequested = false;
  wizard.attemptFinalSave = () => { saveRequested = true; };

  wizard.skipCurrentStep();

  assert.equal(saveRequested, true);
});

test("Skipping the final text step saves instead of doing nothing", () => {
  const wizard = makeWizard("text", 2);
  let saveRequested = false;
  wizard.attemptFinalSave = () => { saveRequested = true; };

  wizard.skipCurrentStep();

  assert.equal(saveRequested, true);
});

function makeSaveWizard(music = {}) {
  const wizard = makeWizard("photo", 4);
  wizard.state = {
    date: "2026-11-22",
    time: "12:00",
    mood: 4,
    title: "A day together",
    folderTitle: "A day together",
    description: "We spent the afternoon together.",
    followUpAnswers: [],
    media: [{ type: "image", dataUrl: "data:image/jpeg;base64,abc" }],
    tags: [],
    music,
    musicAtmosphere: "warm",
    geolocation: {},
    filter: "none"
  };
  wizard.close = () => {};
  return wizard;
}

test("A photo memory can be saved without music or tags", async () => {
  const wizard = makeSaveWizard();
  let savedPayload;
  let confirmShown = false;
  global.window.app = {
    showToast() {},
    showConfirmDialog() { confirmShown = true; },
    refreshDashboard() {}
  };
  global.window.storageAdapter = {
    async uploadMedia(media) { return media; },
    async saveEntry(payload) {
      savedPayload = payload;
      return { id: "saved-entry", ...payload };
    }
  };
  global.window.scrapbookViewer = { async autoPlaceEntry() {} };

  await wizard.attemptFinalSave();

  assert.equal(confirmShown, false);
  assert.deepEqual(savedPayload.tags, []);
  assert.equal(savedPayload.music.title, undefined);
});

test("A partially entered music selection still requires a valid link", async () => {
  const wizard = makeSaveWizard({ title: "A song" });
  const messages = [];
  let saveCalled = false;
  global.window.app = {
    showToast(message) { messages.push(message); },
    refreshDashboard() {}
  };
  global.window.storageAdapter = {
    async uploadMedia() { throw new Error("Should not upload media for invalid music."); },
    async saveEntry() { saveCalled = true; }
  };

  await wizard.attemptFinalSave();

  assert.equal(saveCalled, false);
  assert.match(messages[0], /valid music link/);
});

test("Firestore permission errors identify the failed wizard operation", () => {
  const wizard = makeWizard("text", 2);

  const message = wizard.storageErrorMessage(
    { code: "permission-denied" },
    "saving this draft"
  );

  assert.match(message, /saving this draft/);
  assert.match(message, /firestore\.rules/);
  assert.match(message, /firebase-config\.js/);
});
