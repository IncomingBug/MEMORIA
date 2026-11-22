const test = require("node:test");
const assert = require("node:assert/strict");

const documentListeners = {};
const buttonAttributes = {};
const label = { textContent: "" };
const button = {
  title: "",
  setAttribute(name, value) {
    buttonAttributes[name] = value;
  },
  querySelector(selector) {
    return selector === ".fullscreen-button-label" ? label : null;
  }
};

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
    return id === "homeFullscreenBtn" ? button : null;
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
  assert.equal(buttonAttributes["aria-pressed"], "true");
  assert.equal(buttonAttributes["aria-label"], "Exit fullscreen");
  assert.equal(label.textContent, "Exit fullscreen");

  global.document.exitFullscreen = () => {
    global.document.fullscreenElement = null;
    return Promise.resolve();
  };
  await app.toggleFullscreen();
  app.updateFullscreenButton();
  assert.equal(global.document.fullscreenElement, null);
  assert.equal(buttonAttributes["aria-pressed"], "false");
  assert.equal(buttonAttributes["aria-label"], "Enter fullscreen");
});

test("fullscreen reports unsupported browsers instead of failing silently", async () => {
  const messages = [];
  global.document.documentElement.requestFullscreen = undefined;
  global.window.app.showToast = message => messages.push(message);

  await global.window.app.toggleFullscreen();

  assert.deepEqual(messages, ["Fullscreen is not supported by this browser."]);
});
