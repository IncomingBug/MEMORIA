const test = require("node:test");
const assert = require("node:assert/strict");

const documentListeners = {};
const buttonAttributes = {
  homeFullscreenBtn: {},
  bookFullscreenBtn: {}
};
const buttonLabels = {};
const buttons = Object.fromEntries(Object.keys(buttonAttributes).map(id => {
  const label = { textContent: "" };
  buttonLabels[id] = label;
  return [id, {
    title: "",
    setAttribute(name, value) {
      buttonAttributes[id][name] = value;
    },
    querySelector(selector) {
      return selector === ".fullscreen-button-label" ? label : null;
    }
  }];
}));

global.document = {
  fullscreenElement: null,
  documentElement: {
    requestFullscreen() {
      global.document.fullscreenElement = global.document.documentElement;
      return Promise.resolve();
    }
  },
  addEventListener(type, listener) {
    documentListeners[type] = listener;
  },
  getElementById(id) {
    return buttons[id] || null;
  }
};
global.window = {
  storageAdapter: {
    init: () => new Promise(() => {})
  }
};

require("../public/js/app.js");
documentListeners.DOMContentLoaded();

test("fullscreen navbar button enters and exits fullscreen and tracks browser state", async () => {
  const app = global.window.app;

  await app.toggleFullscreen();
  assert.equal(global.document.fullscreenElement, global.document.documentElement);

  app.updateFullscreenButton();
  assert.equal(buttonAttributes.homeFullscreenBtn["aria-pressed"], "true");
  assert.equal(buttonAttributes.homeFullscreenBtn["aria-label"], "Exit fullscreen");
  assert.equal(buttonAttributes.bookFullscreenBtn["aria-label"], "Exit fullscreen");
  assert.equal(buttonLabels.homeFullscreenBtn.textContent, "Exit fullscreen");
  assert.equal(buttonLabels.bookFullscreenBtn.textContent, "Exit fullscreen");

  global.document.exitFullscreen = () => {
    global.document.fullscreenElement = null;
    return Promise.resolve();
  };
  await app.toggleFullscreen();
  app.updateFullscreenButton();
  assert.equal(global.document.fullscreenElement, null);
  assert.equal(buttonAttributes.homeFullscreenBtn["aria-pressed"], "false");
  assert.equal(buttonAttributes.bookFullscreenBtn["aria-pressed"], "false");
  assert.equal(buttonAttributes.bookFullscreenBtn["aria-label"], "Enter fullscreen");
});

test("fullscreen reports unsupported browsers instead of failing silently", async () => {
  const messages = [];
  global.document.documentElement.requestFullscreen = undefined;
  global.window.app.showToast = message => messages.push(message);

  await global.window.app.toggleFullscreen();

  assert.deepEqual(messages, ["Fullscreen is not supported by this browser."]);
});
