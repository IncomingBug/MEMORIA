const test = require("node:test");
const assert = require("node:assert/strict");

let pageFlipOptions;
global.window = {
  innerWidth: 1280,
  innerHeight: 900,
  location: { origin: "https://example.test" },
  scrapbookEditor: { isOpen: false },
  St: {
    PageFlip: class {
      constructor(element, options) {
        pageFlipOptions = options;
        this.listeners = {};
      }
      loadFromHTML() {}
      on(event, listener) {
        this.listeners[event] = listener;
      }
    }
  }
};
global.document = {
  getElementById: () => ({}),
  querySelectorAll: () => []
};
global.requestAnimationFrame = callback => callback();
require("../public/js/scrapbook-viewer.js");

function makeViewer() {
  const viewer = Object.create(global.window.ScrapbookViewer.prototype);
  viewer.currentPageIndex = 0;
  viewer.scrapbookData = { pages: [] };
  viewer.clampRotatedPageElements = () => {};
  return viewer;
}

test("page-turn edge inset is 14 pixels on desktop and mobile", () => {
  const viewer = makeViewer();
  for (const [viewportWidth, pageWidth] of [[1280, 530], [568, 460]]) {
    global.window.innerWidth = viewportWidth;
    const inset = viewer.getPageFlipEdgeInsetPercent();
    assert.ok(Math.abs(inset * pageWidth / 100 - 14) < 0.001);
  }
});

test("PageFlip's built-in click and mouse gestures are disabled", () => {
  const viewer = makeViewer();
  viewer.initPageFlip();

  assert.equal(pageFlipOptions.useMouseEvents, false);
  assert.equal(pageFlipOptions.disableFlipByClick, false);
  assert.equal(pageFlipOptions.showPageCorners, false);
});

test("only a pointer gesture that starts on a page rail flips pages", () => {
  const listeners = {};
  const container = {
    dataset: {},
    addEventListener: (type, listener) => { listeners[type] = listener; }
  };
  global.document.getElementById = () => container;
  global.window.innerWidth = 1280;

  const viewer = makeViewer();
  viewer.pageFlip = {
    flips: 0,
    getCurrentPageIndex: () => 1,
    flipPrev() { this.flips++; },
    flipNext() { this.flips++; }
  };
  viewer.setupPageFlipEdgeHandlers();

  const event = target => ({
    target,
    pointerId: 1,
    clientX: 100,
    preventDefault() {},
    stopPropagation() {}
  });
  const pageContent = { closest: () => null };
  listeners.pointerdown(event(pageContent));
  listeners.pointerup(event(pageContent));
  assert.equal(viewer.pageFlip.flips, 0);

  const page = { classList: { contains: () => false } };
  const rail = {
    closest: selector => selector === ".page-flip-edge-strip" ? rail : selector === ".book-page" ? page : null,
    setPointerCapture() {}
  };
  listeners.pointerdown(event(rail));
  listeners.pointerup(event(rail));
  assert.equal(viewer.pageFlip.flips, 1);
});

test("YouTube IDs are extracted only from supported YouTube URL formats", () => {
  const viewer = makeViewer();
  assert.equal(viewer.getYouTubeVideoId({ videoId: "dQw4w9WgXcQ" }), "dQw4w9WgXcQ");
  assert.equal(viewer.getYouTubeVideoId({ link: "https://youtu.be/dQw4w9WgXcQ?t=4" }), "dQw4w9WgXcQ");
  assert.equal(viewer.getYouTubeVideoId({ link: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }), "dQw4w9WgXcQ");
  assert.equal(viewer.getYouTubeVideoId({ embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" }), "dQw4w9WgXcQ");
  assert.equal(viewer.getYouTubeVideoId({ link: "https://example.com/watch?v=dQw4w9WgXcQ" }), "");
});

test("changing scrapbook pages closes the inline YouTube player", () => {
  const viewer = makeViewer();
  let closeCount = 0;
  viewer.closeYouTubePlayer = () => { closeCount++; };
  viewer.initPageFlip();

  viewer.pageFlip.listeners.flip({ data: 2 });
  assert.equal(closeCount, 1);
  assert.equal(viewer.currentPageIndex, 2);

  viewer.pageFlip.listeners.flip({ data: 2 });
  assert.equal(closeCount, 1);
});
