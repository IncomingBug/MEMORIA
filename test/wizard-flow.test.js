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
