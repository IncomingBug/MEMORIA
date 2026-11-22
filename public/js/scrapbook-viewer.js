// MEMORIA v2 - Digital Scrapbook Viewer & Category Navigator
class ScrapbookViewer {
  constructor() {
    this.stageEl = document.getElementById("bookStage");
    this.pageFlip = null;
    this.scrapbookData = null;
    this.entries = [];
    this.tags = [];
    this.currentPeriod = "the past week";
    this.activeSortCategory = "year"; // "year", "mood", "tag"
    this.selectedCalendarMonth = null;
    this.selectedMoodFilter = 5;
    this.selectedTagFilter = null;
    this.searchCriteria = "title";
    this.searchQuery = "";
    this.uiHidden = false;
    this.isClosing = false;
    this.isOpening = false;
    this.currentPageIndex = 0;

    this.init();
  }

  async init() {
    this.bindGlobalEvents();
    window.addEventListener("resize", Utils.debounce(() => {
      if (this.stageEl && !this.stageEl.hidden && !this.isClosing && !this.isOpening) {
        this.cleanContainerAndBuild();
      }
    }, 180));
  }

  bindGlobalEvents() {
    // Top Navbar buttons
    document.getElementById("bookExitBtn")?.addEventListener("click", () => this.close());
    document.getElementById("bookHideUiBtn")?.addEventListener("click", () => this.toggleUi());
    document.getElementById("floatingShowUiBtn")?.addEventListener("click", () => this.toggleUi());

    document.getElementById("bookEditModeBtn")?.addEventListener("click", () => {
      window.scrapbookEditor?.toggle();
    });

    document.getElementById("bookNewSpreadBtn")?.addEventListener("click", () => {
      this.newSpread();
    });

    // Flip arrows
    document.getElementById("bookPrevBtn")?.addEventListener("click", () => {
      if (window.scrapbookEditor?.isOpen || this.isClosing) return;
      if (this.pageFlip) {
        const curr = this.pageFlip.getCurrentPageIndex();
        if (curr <= 0) {
          if (!window.scrapbookEditor?.isOpen) {
            this.close(); // Flipping back from overview closes the book in view mode
          }
        } else {
          this.pageFlip.flipPrev();
        }
      }
    });

    document.getElementById("bookNextBtn")?.addEventListener("click", () => {
      if (!window.scrapbookEditor?.isOpen && !this.isClosing && this.pageFlip) this.pageFlip.flipNext();
    });
  }

  toggleUi() {
    this.uiHidden = !this.uiHidden;
    const navbar = document.getElementById("bookTopNavbar");
    const floatingBtn = document.getElementById("floatingShowUiBtn");
    const prevBtn = document.getElementById("bookPrevBtn");
    const nextBtn = document.getElementById("bookNextBtn");

    if (navbar) navbar.classList.toggle("hidden-ui", this.uiHidden);
    if (floatingBtn) floatingBtn.hidden = !this.uiHidden;
    if (prevBtn) prevBtn.style.opacity = this.uiHidden ? "0" : "1";
    if (nextBtn) nextBtn.style.opacity = this.uiHidden ? "0" : "1";
  }

  // -------------------------------------------------------------------
  // OPEN & CLOSE LIFECYCLE (FIX POINT 9: SEAMLESS RE-OPENING)
  // -------------------------------------------------------------------
  async open() {
    if (this.isOpening || !this.stageEl || !this.stageEl.hidden) return;
    this.isOpening = true;
    this.isClosing = false;
    this.currentPageIndex = 0;
    this.uiHidden = false;
    document.getElementById("bookTopNavbar")?.classList.remove("hidden-ui");
    const floatingButton = document.getElementById("floatingShowUiBtn");
    if (floatingButton) floatingButton.hidden = true;
    document.getElementById("bookPrevBtn")?.style.removeProperty("opacity");
    document.getElementById("bookNextBtn")?.style.removeProperty("opacity");
    this.stageEl.style.transition = "none";
    this.stageEl.style.transform = "scale(0.88)";
    this.stageEl.style.opacity = "0";
    this.stageEl.hidden = false;
    void this.stageEl.offsetHeight;
    this.stageEl.style.transition = "transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.4s ease";
    this.stageEl.style.transform = "scale(1)";
    this.stageEl.style.opacity = "1";
    try {
      await this.loadData();
      this.cleanContainerAndBuild();
    } finally {
      this.isOpening = false;
    }
  }

  close() {
    if (this.isClosing || !this.stageEl || this.stageEl.hidden) return;
    this.isClosing = true;
    window.scrapbookEditor?.close();
    this.stageEl.style.transition = "transform 0.42s cubic-bezier(0.6, 0, 0.8, 0.2), opacity 0.38s ease";
    this.stageEl.style.transform = "scale(0.88)";
    this.stageEl.style.opacity = "0";
    setTimeout(() => {
      if (this.pageFlip) {
        try { this.pageFlip.destroy(); } catch {}
        this.pageFlip = null;
      }
      const container = document.getElementById("flipBookContainer");
      if (container) container.innerHTML = "";
      this.stageEl.hidden = true;
      this.stageEl.style.transition = "none";
      this.stageEl.style.transform = "";
      this.stageEl.style.opacity = "";
      this.currentPageIndex = 0;
      this.isClosing = false;
    }, 440);
  }

  cleanContainerAndBuild() {
    if (this.pageFlip) {
      this.currentPageIndex = this.pageFlip.getCurrentPageIndex();
      try { this.pageFlip.destroy(); } catch {}
      this.pageFlip = null;
    }

    // PageFlip.destroy() removes the original mount node, so restore it before
    // building a new instance. This also makes reopening after Exit reliable.
    let container = document.getElementById("flipBookContainer");
    if (container) {
      const replacement = document.createElement("div");
      replacement.id = "flipBookContainer";
      replacement.className = "flip-book-wrapper";
      container.replaceWith(replacement);
    } else {
      const stageCenter = document.querySelector("#bookStage .spread-book-wrapper") || document.querySelector("#bookStage .stage-center");
      container = document.createElement("div");
      container.id = "flipBookContainer";
      container.className = "flip-book-wrapper";
      stageCenter?.appendChild(container);
    }

    this.buildPages();
    this.initPageFlip();
  }

  async loadData() {
    try {
      [this.entries, this.tags, this.scrapbookData] = await Promise.all([
        window.storageAdapter.getEntries(),
        window.storageAdapter.getTags(),
        window.storageAdapter.getScrapbook()
      ]);
    } catch (e) {
      console.warn("Error loading scrapbook data:", e);
    }
    this.normalizePageLayouts();
  }

  normalizePageLayouts() {
    (this.scrapbookData?.pages || []).forEach(page => {
      if (page.layoutUnit === "percent") return;

      const pageWidth = Number(page.paper?.width) || 530;
      const pageHeight = Number(page.paper?.height) || 710;
      (page.elements || []).forEach(element => {
        const x = Number(element.x);
        const y = Number(element.y);
        const width = Number(element.w);
        const height = Number(element.h);
        element.w = Math.min(95, Math.max(15, Number.isFinite(width) && width > 0 ? width / pageWidth * 100 : 42));
        element.h = Math.min(95, Math.max(10, Number.isFinite(height) && height > 0 ? height / pageHeight * 100 : 24));
        element.x = Math.min(100 - element.w, Math.max(0, Number.isFinite(x) ? x / pageWidth * 100 : 6));
        element.y = Math.min(100 - element.h, Math.max(0, Number.isFinite(y) ? y / pageHeight * 100 : 8));
      });
      page.layoutUnit = "percent";
    });
  }

  getPageFlipEdgeInsetPercent() {
    const pageWidth = window.innerWidth < 768
      ? Math.min(window.innerWidth - 24, 460)
      : Math.min(530, Math.floor((window.innerWidth - 60) / 2));
    return Math.min(20, 24 / Math.max(1, pageWidth) * 100);
  }

  clampRotatedElementToPage(pageEl, element, elementEl) {
    const pageRect = pageEl?.getBoundingClientRect();
    const width = Number(element?.w);
    const height = Number(element?.h);
    const x = Number(element?.x);
    const y = Number(element?.y);
    if (!pageRect?.width || !pageRect.height || !Number.isFinite(width) || !Number.isFinite(height) ||
      !Number.isFinite(x) || !Number.isFinite(y)) return false;

    const widthPx = width / 100 * pageRect.width;
    const heightPx = height / 100 * pageRect.height;
    const radians = (Number(element.rotation) || 0) * Math.PI / 180;
    const rotatedWidth = Math.abs(widthPx * Math.cos(radians)) + Math.abs(heightPx * Math.sin(radians));
    const rotatedHeight = Math.abs(heightPx * Math.cos(radians)) + Math.abs(widthPx * Math.sin(radians));
    const edgeWidth = pageEl.querySelector(".page-flip-edge-strip")?.getBoundingClientRect().width || 24;
    const safetyGap = Math.min(2, pageRect.width / 200);
    const leftPage = pageEl.classList.contains("page-left");
    const safeLeft = leftPage ? edgeWidth + safetyGap : 0;
    const safeRight = pageRect.width - (leftPage ? 0 : edgeWidth + safetyGap);
    const minCenterX = safeLeft + rotatedWidth / 2;
    const maxCenterX = safeRight - rotatedWidth / 2;
    const centerX = x / 100 * pageRect.width + widthPx / 2;
    const boundedCenterX = minCenterX <= maxCenterX
      ? Math.max(minCenterX, Math.min(maxCenterX, centerX))
      : (leftPage ? minCenterX : maxCenterX);
    const minCenterY = rotatedHeight / 2;
    const maxCenterY = pageRect.height - rotatedHeight / 2;
    const centerY = y / 100 * pageRect.height + heightPx / 2;
    const boundedCenterY = minCenterY <= maxCenterY
      ? Math.max(minCenterY, Math.min(maxCenterY, centerY))
      : pageRect.height / 2;
    const nextX = Math.round((boundedCenterX - widthPx / 2) / pageRect.width * 100 * 10000) / 10000;
    const nextY = Math.round((boundedCenterY - heightPx / 2) / pageRect.height * 100 * 10000) / 10000;
    const changed = Math.abs(x - nextX) > 0.001 || Math.abs(y - nextY) > 0.001;
    if (!changed) return false;

    element.x = nextX;
    element.y = nextY;
    if (elementEl) {
      elementEl.style.left = `${nextX}%`;
      elementEl.style.top = `${nextY}%`;
    }
    return true;
  }

  clampRotatedPageElements() {
    let changed = false;
    const pageEls = document.querySelectorAll("#flipBookContainer .entry-scrapbook-page");
    pageEls.forEach(pageEl => {
      const page = this.scrapbookData?.pages?.find(item => item.id === pageEl.dataset.pageId);
      if (!page) return;
      page.elements?.forEach(element => {
        const elementEl = [...pageEl.querySelectorAll(".scrapbook-element")]
          .find(item => item.dataset.elementId === element.id);
        changed = this.clampRotatedElementToPage(pageEl, element, elementEl) || changed;
      });
    });

    if (changed) {
      window.storageAdapter.saveScrapbook(this.scrapbookData).catch(error => {
        console.error("Could not save rotated element bounds:", error);
        window.app?.showToast?.("Could not save the adjusted page layout.");
      });
    }
  }

  // -------------------------------------------------------------------
  // BUILD PAGES DOM (TWO PAGES OPEN AT ALL TIMES)
  // -------------------------------------------------------------------
  buildPages() {
    const container = document.getElementById("flipBookContainer");
    if (!container) return;
    container.innerHTML = "";

    // 1. Overview Spread (Pages 0 & 1)
    const pOverviewL = this.createOverviewLeftPage();
    const pOverviewR = this.createOverviewRightPage();
    container.appendChild(pOverviewL);
    container.appendChild(pOverviewR);

    // 2. Categories Spread (Pages 2 & 3)
    const pCatL = this.createCategoriesLeftPage();
    const pCatR = this.createCategoriesRightPage();
    container.appendChild(pCatL);
    container.appendChild(pCatR);

    // 3. Search Spread (Pages 4 & 5)
    const pSearchL = this.createSearchLeftPage();
    const pSearchR = this.createSearchRightPage();
    container.appendChild(pSearchL);
    container.appendChild(pSearchR);

    // 4. Chapters Spread (Pages 6 & 7)
    const pChapL = this.createChaptersLeftPage();
    const pChapR = this.createChaptersRightPage();
    container.appendChild(pChapL);
    container.appendChild(pChapR);

    // 5. Entry / Diary Pages (Pages 8+)
    let userPages = this.scrapbookData?.pages || [];
    if (userPages.length === 0 && this.entries.length > 0) {
      this.generateDefaultEntryPages();
      userPages = this.scrapbookData?.pages || [];
    }
    let needsPageSave = false;
    if (userPages.length % 2 !== 0) {
      userPages.push({
        id: `page-user-${Date.now()}-R`,
        kind: "entry",
        section: "entries",
        side: "right",
        layoutUnit: "percent",
        paper: { color: "#f8f3e8", lining: "none", width: 530, height: 710 },
        elements: []
      });
      needsPageSave = true;
    }

    const edgeInset = this.getPageFlipEdgeInsetPercent();
    userPages.forEach((pData, idx) => {
      const leftEdge = idx % 2 === 0;
      const minX = leftEdge ? edgeInset : 0;
      const maxRight = leftEdge ? 100 : 100 - edgeInset;
      (pData.elements || []).forEach(element => {
        const elementWidth = Number(element.w);
        const width = Math.min(
          Number.isFinite(elementWidth) && elementWidth > 0 ? elementWidth : 42,
          maxRight - minX
        );
        const rawX = Number(element.x);
        const x = Math.max(minX, Math.min(maxRight - width, Number.isFinite(rawX) ? rawX : minX));
        if (Number(element.w) !== width || Number(element.x) !== x) needsPageSave = true;
        element.w = width;
        element.x = x;
      });

      const pageEl = document.createElement("div");
      pageEl.className = `book-page ${idx % 2 === 0 ? "page-left" : "page-right"} entry-scrapbook-page`;
      pageEl.id = pData.id;
      pageEl.dataset.pageId = pData.id;
      pageEl.style.backgroundColor = pData.paper?.color || "#f8f3e8";
      if (pData.paper?.font) pageEl.style.fontFamily = pData.paper.font;

      // Outer edge flip strip (Point 6: corner/edge drag only)
      const flipStrip = document.createElement("div");
      flipStrip.className = "page-flip-edge-strip";
      pageEl.appendChild(flipStrip);

      // Render elements on page
      (pData.elements || []).forEach(el => {
        const renderedEl = this.renderPageElement(el);
        if (renderedEl) pageEl.appendChild(renderedEl);
      });

      // Drag and drop listeners on entry page (Point 1 & Point 2)
      this.setupPageDropHandlers(pageEl);

      container.appendChild(pageEl);
    });

    if (needsPageSave) {
      window.storageAdapter.saveScrapbook(this.scrapbookData).catch(error => {
        console.error("Could not save page boundaries and layout:", error);
        window.app?.showToast?.("Could not save the scrapbook page layout.");
      });
    }

    this.setupPageFlipEdgeHandlers();
  }

  setupPageFlipEdgeHandlers() {
    document.querySelectorAll("#flipBookContainer .book-page").forEach((page, index) => {
      let strip = page.querySelector(".page-flip-edge-strip");
      if (!strip) {
        strip = document.createElement("div");
        strip.className = "page-flip-edge-strip";
        page.appendChild(strip);
      }
      strip.classList.toggle("page-left", index % 2 === 0);
      strip.classList.toggle("page-right", index % 2 !== 0);
    });

    const container = document.getElementById("flipBookContainer");
    if (!container || container.dataset.edgeHandlersReady) return;
    container.dataset.edgeHandlersReady = "true";
    container.addEventListener("pointerdown", event => {
      const strip = event.target.closest(".page-flip-edge-strip");
      if (!strip || window.scrapbookEditor?.isOpen) return;
      const page = strip.closest(".book-page");
      this.edgeGestureStart = {
        x: event.clientX,
        previous: page?.classList.contains("page-left") || false
      };
      strip.setPointerCapture?.(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    }, true);
    container.addEventListener("pointerup", event => {
      const strip = event.target.closest(".page-flip-edge-strip");
      const gesture = this.edgeGestureStart;
      this.edgeGestureStart = null;
      if (!strip || !gesture || window.scrapbookEditor?.isOpen || !this.pageFlip) return;
      const distance = event.clientX - gesture.x;
      event.preventDefault();
      event.stopPropagation();
      if (Math.abs(distance) > 24 && ((gesture.previous && distance > 0) || (!gesture.previous && distance < 0))) return;
      if (gesture.previous) {
        if (this.pageFlip.getCurrentPageIndex() <= 0) this.close();
        else this.pageFlip.flipPrev();
      } else {
        this.pageFlip.flipNext();
      }
    }, true);
    container.addEventListener("pointercancel", () => { this.edgeGestureStart = null; }, true);
  }

  // Drag and drop target handling for pages
  setupPageDropHandlers(pageEl) {
    const container = document.getElementById("flipBookContainer");
    if (!container || container.dataset.dropHandlersReady) return;
    container.dataset.dropHandlersReady = "true";

    container.addEventListener("dragover", (event) => {
      const targetPage = event.target.closest(".entry-scrapbook-page");
      if (!window.scrapbookEditor?.isOpen || !targetPage) return;
      event.preventDefault();
      targetPage.classList.add("page-drag-over");
      event.dataTransfer.dropEffect = "copy";
    }, true);

    container.addEventListener("dragleave", (event) => {
      event.target.closest(".entry-scrapbook-page")?.classList.remove("page-drag-over");
    }, true);

    container.addEventListener("click", event => {
      if (window.scrapbookEditor?.isOpen) return;
      const photo = event.target.closest(".scrapbook-element[data-type='polaroid']");
      if (!photo) return;
      const entry = this.entries.find(item => item.id === photo.dataset.entryId);
      if (entry) this.openEntryInspectionPopup(entry);
    }, true);

    container.addEventListener("drop", async (event) => {
      const targetPage = event.target.closest(".entry-scrapbook-page");
      if (!window.scrapbookEditor?.isOpen || !targetPage) return;
      event.preventDefault();
      event.stopPropagation();
      targetPage.classList.remove("page-drag-over");

      const raw = event.dataTransfer.getData("application/json");
      if (!raw) return;
      try {
        const payload = JSON.parse(raw);
        const rect = targetPage.getBoundingClientRect();
        const dropX = Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100));
        const dropY = Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100));
        await window.scrapbookEditor.placeDroppedItem(targetPage.dataset.pageId, payload, dropX, dropY);
      } catch (error) {
        console.error("Drop placement error:", error);
        window.app?.showToast?.("Could not place that item on the page.");
      }
    }, true);
  }

  initPageFlip() {
    const el = document.getElementById("flipBookContainer");
    if (!el) return;

    if (window.St && window.St.PageFlip) {
      const isMobile = window.innerWidth < 768;
      // Zoomed-in dimensions (Point 11)
      const width = isMobile
        ? Math.min(window.innerWidth - 24, 460)
        : Math.min(530, Math.floor((window.innerWidth - 60) / 2));
      const editorReserve = window.scrapbookEditor?.isOpen ? 254 : 24;
      const availableHeight = Math.max(480, window.innerHeight - 54 - editorReserve);
      const userPageIndex = Math.max(0, this.currentPageIndex - 8);
      const currentPaperHeight = this.scrapbookData?.pages?.[userPageIndex]?.paper?.height || 710;
      const height = Math.min(isMobile ? 680 : 780, availableHeight, currentPaperHeight);

      this.pageFlip = new window.St.PageFlip(el, {
        width,
        height,
        size: "fixed",
        minWidth: 320,
        maxWidth: 600,
        minHeight: 480,
        maxHeight: 960,
        maxShadowOpacity: 0.55,
        showCover: false,
        mobileScrollSupport: true,
        useMouseEvents: false,
        showPageCorners: false,
        cornerSize: 0,
        flippingTime: 650,
        startPage: this.currentPageIndex
      });

      this.pageFlip.loadFromHTML(document.querySelectorAll(".book-page"));
      this.pageFlip.on("flip", (event) => {
        this.currentPageIndex = Number(event.data) || 0;
        this.clampRotatedPageElements();
      });
      requestAnimationFrame(() => this.clampRotatedPageElements());
    }
  }

  // -------------------------------------------------------------------
  // CATEGORY 1: OVERVIEW PAGES
  // -------------------------------------------------------------------
  createOverviewLeftPage() {
    const page = document.createElement("div");
    page.className = "book-page page-left";

    const filtered = Utils.filterEntriesByPeriod(this.entries, this.currentPeriod);
    const moodNumbers = filtered.map(e => e.mood);
    const moodStat = Utils.computeAverageMood(moodNumbers);

    page.innerHTML = `
      <div class="overview-heading-row">
        <h1 class="overview-title">Overview</h1>
        <button type="button" class="overview-gear-btn" id="overviewEditGear" title="Customize look">⚙️</button>
      </div>

      <div style="margin-top: 14px;">
        <span style="font-size: 14px; color: var(--brown); font-weight: 500;">Mood for:</span>
        <select id="overviewPeriodSelect" class="form-select" style="display: inline-block; width: auto; margin-left: 8px; color: var(--brown); background: #fff; border: 1px solid var(--brown); font-size: 13px; padding: 4px 10px;">
          <option value="today" ${this.currentPeriod === "today" ? "selected" : ""}>today</option>
          <option value="the past week" ${this.currentPeriod === "the past week" ? "selected" : ""}>the past week</option>
          <option value="the past month" ${this.currentPeriod === "the past month" ? "selected" : ""}>the past month</option>
          <option value="the past year" ${this.currentPeriod === "the past year" ? "selected" : ""}>the past year</option>
        </select>
      </div>

      <div class="mood-summary-box">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #7a6045; margin-bottom: 4px;">Calculated Mood Average:</div>
        <div class="mood-average-display">
          ${moodStat.label !== "None" ? `${moodStat.label} (${moodStat.average}/5)` : "No entries recorded for this period"}
        </div>
        <div class="mood-reflection-text" id="overviewAiReflection">
          Consulting journal memories...
        </div>
      </div>

      <div style="margin-top: 26px; font-size: 14px; color: #554; line-height: 1.6;">
        <p><strong>Total Memories:</strong> ${this.entries.length}</p>
        <p><strong>Period Memories:</strong> ${filtered.length}</p>
      </div>
    `;

    page.querySelector("#overviewEditGear")?.addEventListener("click", () => {
      window.scrapbookEditor?.toggle();
    });

    page.querySelector("#overviewPeriodSelect")?.addEventListener("change", (e) => {
      this.currentPeriod = e.target.value;
      this.refreshOverviewSpread();
    });

    // Real Groq AI reflection summary (Point 12)
    setTimeout(async () => {
      const summaryText = await window.storageAdapter.getAiSummary({
        period: this.currentPeriod,
        moodAverageLabel: moodStat.label,
        entriesCount: filtered.length
      });
      const el = page.querySelector("#overviewAiReflection");
      if (el) el.innerText = `"${summaryText}"`;
    }, 40);

    return page;
  }

  createOverviewRightPage() {
    const page = document.createElement("div");
    page.className = "book-page page-right";
    page.innerHTML = `
      <div style="border-bottom: 2px solid var(--brown); padding-bottom: 8px; margin-bottom: 22px;">
        <h2 style="font-family: var(--font-serif); font-size: 26px; color: var(--brown);">Table of Contents</h2>
      </div>

      <div class="overview-nav-list">
        <div class="overview-nav-item" id="navRecentBtn">
          <span>Recent</span>
          <span>&rarr;</span>
        </div>
        <div class="overview-nav-item" id="navCategoriesBtn">
          <span>Categories</span>
          <span>&rarr;</span>
        </div>
        <div class="overview-nav-item" id="navSearchBtn">
          <span>Search</span>
          <span>&rarr;</span>
        </div>
        <div class="overview-nav-item" id="navChaptersBtn">
          <span>Chapters</span>
          <span>&rarr;</span>
        </div>
        <div class="overview-nav-item" id="navAllEntriesBtn">
          <span>All Entries</span>
          <span>&rarr;</span>
        </div>
      </div>
    `;

    page.querySelector("#navRecentBtn")?.addEventListener("click", () => this.jumpToRecent());
    page.querySelector("#navCategoriesBtn")?.addEventListener("click", () => this.flipToPage(2));
    page.querySelector("#navSearchBtn")?.addEventListener("click", () => this.flipToPage(4));
    page.querySelector("#navChaptersBtn")?.addEventListener("click", () => this.flipToPage(6));
    page.querySelector("#navAllEntriesBtn")?.addEventListener("click", () => window.app.openGalleryModal());

    return page;
  }

  refreshOverviewSpread() {
    const pL = document.querySelector(".page-left");
    if (pL && pL.parentElement) {
      const newL = this.createOverviewLeftPage();
      pL.replaceWith(newL);
    }
  }

  // -------------------------------------------------------------------
  // CATEGORY: CATEGORIES & CALENDAR
  // -------------------------------------------------------------------
  createCategoriesLeftPage() {
    const page = document.createElement("div");
    page.className = "book-page page-left";
    page.innerHTML = `
      <div style="border-bottom: 2px solid var(--brown); padding-bottom: 8px; margin-bottom: 18px;">
        <h2 style="font-family: var(--font-serif); font-size: 28px; color: var(--brown);">Categories</h2>
      </div>

      <p style="font-size: 13px; color: #554; margin-bottom: 12px;">Sort it by:</p>
      <div class="sort-tabs">
        <button type="button" class="sort-tab-btn ${this.activeSortCategory === "year" ? "active" : ""}" data-sort="year">Year</button>
        <button type="button" class="sort-tab-btn ${this.activeSortCategory === "mood" ? "active" : ""}" data-sort="mood">Mood</button>
        <button type="button" class="sort-tab-btn ${this.activeSortCategory === "tag" ? "active" : ""}" data-sort="tag">Tags</button>
      </div>

      <div style="font-size: 13px; color: #776; font-style: italic; margin-top: 36px; line-height: 1.5;">
        Browse through your recorded years, inspect emotional seasons, or flip across tagged moments.
      </div>
    `;

    page.querySelectorAll(".sort-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this.activeSortCategory = btn.dataset.sort;
        this.cleanContainerAndBuild();
        this.flipToPage(2);
      });
    });

    return page;
  }

  createCategoriesRightPage() {
    const page = document.createElement("div");
    page.className = "book-page page-right";

    if (this.activeSortCategory === "year") {
      this.renderYearCategory(page);
    } else if (this.activeSortCategory === "mood") {
      this.renderMoodCategory(page);
    } else {
      this.renderTagCategory(page);
    }

    return page;
  }

  renderYearCategory(container) {
    const grouped = {};
    this.entries.forEach(e => {
      if (!e.date) return;
      const [year, month] = e.date.split("-");
      if (!grouped[year]) grouped[year] = new Set();
      grouped[year].add(month);
    });

    const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
    const years = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

    if (years.length === 0) {
      container.innerHTML = "<div style='color: var(--muted); text-align: center; margin-top: 40px;'>No memories recorded yet.</div>";
      return;
    }

    if (this.selectedCalendarMonth) {
      const { year, month } = this.selectedCalendarMonth;
      const monthIdx = Number(month) - 1;
      const monthLabel = monthNames[monthIdx];
      const daysInMonth = new Date(Number(year), Number(month), 0).getDate();

      const monthEntries = this.entries.filter(e => e.date && e.date.startsWith(`${year}-${month}`));
      const entriesByDay = {};
      monthEntries.forEach(e => {
        const day = Number(e.date.split("-")[2]);
        if (!entriesByDay[day]) entriesByDay[day] = [];
        entriesByDay[day].push(e);
      });

      container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid rgba(0,0,0,0.1); padding-bottom: 6px;">
          <h3 style="font-family: var(--font-serif); font-size: 20px; text-transform: capitalize;">${monthLabel} ${year}</h3>
          <button type="button" class="btn-secondary" id="calBackToYearsBtn" style="color: var(--brown); font-size: 11px; padding: 2px 8px;">&larr; All Years</button>
        </div>

        <div class="calendar-grid">
          ${["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => `<div class="cal-header-cell">${d}</div>`).join("")}
          ${Array.from({ length: daysInMonth }, (_, i) => {
            const dayNum = i + 1;
            const dayList = entriesByDay[dayNum] || [];
            const hasEntry = dayList.length > 0;
            const photoUrl = hasEntry ? (dayList[0].media?.[0]?.pathOrDocId || "") : "";
            return `
              <div class="cal-day-cell ${hasEntry ? "has-entries" : ""}" data-day="${dayNum}">
                <span>${dayNum}</span>
                ${photoUrl ? `<img src="${photoUrl}" class="cal-thumb-icon" alt="Day thumb">` : ""}
              </div>
            `;
          }).join("")}
        </div>
      `;

      container.querySelector("#calBackToYearsBtn")?.addEventListener("click", () => {
        this.selectedCalendarMonth = null;
        this.renderYearCategory(container);
      });

      container.querySelectorAll(".cal-day-cell.has-entries").forEach(cell => {
        cell.addEventListener("click", () => {
          const day = Number(cell.dataset.day);
          const list = entriesByDay[day] || [];
          if (list[0]) this.openEntryInspectionPopup(list[0]);
        });
      });

    } else {
      container.innerHTML = `
        <h3 style="font-family: var(--font-serif); font-size: 20px; margin-bottom: 12px; color: var(--brown);">Chronological Archives</h3>
        <div class="year-columns-container">
          ${years.map(y => `
            <div class="year-column">
              <div class="year-title">${y}</div>
              <div style="display: flex; flex-direction: column; gap: 4px;">
                ${Array.from(grouped[y]).sort().map(m => `
                  <div class="month-item" data-year="${y}" data-month="${m}">
                    ${monthNames[Number(m) - 1]} (${this.entries.filter(e => e.date?.startsWith(`${y}-${m}`)).length})
                  </div>
                `).join("")}
              </div>
            </div>
          `).join("")}
        </div>
      `;

      container.querySelectorAll(".month-item").forEach(item => {
        item.addEventListener("click", () => {
          this.selectedCalendarMonth = { year: item.dataset.year, month: item.dataset.month };
          this.renderYearCategory(container);
        });
      });
    }
  }

  renderMoodCategory(container) {
    const moods = [5, 4, 3, 2, 1];
    const filtered = this.entries.filter(e => e.mood === this.selectedMoodFilter);

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(0,0,0,0.1); padding-bottom: 8px;">
        <h3 style="font-family: var(--font-serif); font-size: 20px; color: var(--brown);">Entries by Mood</h3>
        <div style="display: flex; gap: 4px;">
          ${moods.map(m => `
            <button type="button" class="mood-btn ${this.selectedMoodFilter === m ? "selected" : ""}" style="font-size: 20px; padding: 2px 4px;" data-m="${m}">
              ${Utils.moodEmojis[m].emoji}
            </button>
          `).join("")}
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 14px; margin-top: 16px; max-height: 490px; overflow-y: auto;">
        ${filtered.map(entry => `
          <div class="polaroid-frame mood-grid-item" data-id="${entry.id}" style="width: 100%;">
            ${entry.media?.[0] ? `
              <img src="${entry.media[0].pathOrDocId}" class="polaroid-img" alt="Photo">
            ` : `
              <div style="aspect-ratio: 1; background: #e8dcc6; display: flex; align-items: center; justify-content: center; font-size: 28px;">📝</div>
            `}
            <div class="polaroid-title-text" style="font-size: 13px;">${entry.title || Utils.formatDate(entry.date)}</div>
          </div>
        `).join("")}
      </div>
    `;

    container.querySelectorAll(".mood-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this.selectedMoodFilter = Number(btn.dataset.m);
        this.renderMoodCategory(container);
      });
    });

    container.querySelectorAll(".mood-grid-item").forEach(item => {
      item.addEventListener("click", () => {
        const entry = this.entries.find(e => e.id === item.dataset.id);
        if (entry) this.openEntryInspectionPopup(entry);
      });
    });
  }

  renderTagCategory(container) {
    if (this.tags.length === 0) {
      container.innerHTML = "<div style='color: var(--muted); text-align: center; margin-top: 40px;'>No tags created yet.</div>";
      return;
    }

    if (!this.selectedTagFilter) this.selectedTagFilter = this.tags[0].id;
    const currentTag = this.tags.find(t => t.id === this.selectedTagFilter) || this.tags[0];
    const filtered = this.entries.filter(e => Array.isArray(e.tags) && e.tags.includes(currentTag.id));

    container.innerHTML = `
      <div style="border-bottom: 1px solid rgba(0,0,0,0.1); padding-bottom: 8px;">
        <h3 style="font-family: var(--font-serif); font-size: 20px; color: var(--brown);">Tagged Memories</h3>
        <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px;">
          ${this.tags.map(t => `
            <span class="tag-badge ${t.id === this.selectedTagFilter ? "selected" : ""}" style="background-color: ${t.color}; color: #fff; font-size: 11px; padding: 3px 8px; cursor: pointer;" data-tagid="${t.id}">
              ${t.name}
            </span>
          `).join("")}
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 14px; margin-top: 16px; max-height: 490px; overflow-y: auto;">
        ${filtered.map(entry => `
          <div class="polaroid-frame tag-grid-item" data-id="${entry.id}" style="width: 100%;">
            ${entry.media?.[0] ? `
              <img src="${entry.media[0].pathOrDocId}" class="polaroid-img" alt="Photo">
            ` : `
              <div style="aspect-ratio: 1; background: #e8dcc6; display: flex; align-items: center; justify-content: center; font-size: 28px;">📝</div>
            `}
            <div class="polaroid-title-text" style="font-size: 13px;">${entry.title || Utils.formatDate(entry.date)}</div>
          </div>
        `).join("")}
      </div>
    `;

    container.querySelectorAll(".tag-badge").forEach(badge => {
      badge.addEventListener("click", () => {
        this.selectedTagFilter = badge.dataset.tagid;
        this.renderTagCategory(container);
      });
    });

    container.querySelectorAll(".tag-grid-item").forEach(item => {
      item.addEventListener("click", () => {
        const entry = this.entries.find(e => e.id === item.dataset.id);
        if (entry) this.openEntryInspectionPopup(entry);
      });
    });
  }

  // -------------------------------------------------------------------
  // CATEGORY: SEARCH
  // -------------------------------------------------------------------
  createSearchLeftPage() {
    const page = document.createElement("div");
    page.className = "book-page page-left";
    page.innerHTML = `
      <div style="border-bottom: 2px solid var(--brown); padding-bottom: 8px; margin-bottom: 20px;">
        <h2 style="font-family: var(--font-serif); font-size: 28px; color: var(--brown);">Search</h2>
      </div>

      <div class="form-group">
        <label class="form-label" style="color: var(--brown);">Search by:</label>
        <select id="searchCriteriaSelect" class="form-select" style="background: #fff; color: var(--brown); border: 1px solid var(--brown);">
          <option value="title" ${this.searchCriteria === "title" ? "selected" : ""}>Title</option>
          <option value="music" ${this.searchCriteria === "music" ? "selected" : ""}>Music</option>
          <option value="tag" ${this.searchCriteria === "tag" ? "selected" : ""}>Tag</option>
          <option value="month" ${this.searchCriteria === "month" ? "selected" : ""}>Month (01-12)</option>
          <option value="year" ${this.searchCriteria === "year" ? "selected" : ""}>Year (YYYY)</option>
        </select>
      </div>

      <div class="form-group" style="margin-top: 14px;">
        <input type="text" id="scrapbookSearchInput" class="form-input" placeholder="Type search query..." value="${this.searchQuery}" style="background: #fff; color: var(--brown); border: 1px solid var(--brown);">
      </div>

      <div style="font-size: 13px; color: #776; font-style: italic; margin-top: 36px; line-height: 1.5;">
        Search indexes titles, soundtrack badges, tags, months, and years directly.
      </div>
    `;

    page.querySelector("#searchCriteriaSelect")?.addEventListener("change", (e) => {
      this.searchCriteria = e.target.value;
      this.refreshSearchRightPage();
    });

    page.querySelector("#scrapbookSearchInput")?.addEventListener("input", Utils.debounce((e) => {
      this.searchQuery = e.target.value.trim().toLowerCase();
      this.refreshSearchRightPage();
    }, 250));

    return page;
  }

  createSearchRightPage() {
    const page = document.createElement("div");
    page.className = "book-page page-right";
    page.id = "searchRightPageContainer";
    this.renderSearchResults(page);
    return page;
  }

  refreshSearchRightPage() {
    const page = document.getElementById("searchRightPageContainer");
    if (page) this.renderSearchResults(page);
  }

  renderSearchResults(container) {
    if (!this.searchQuery) {
      container.innerHTML = "<div style='color: #887; text-align: center; margin-top: 40px; font-style: italic;'>Enter a search query to view matching Polaroids.</div>";
      return;
    }

    const matches = this.entries.filter(e => {
      if (this.searchCriteria === "title") return (e.title || "").toLowerCase().includes(this.searchQuery);
      if (this.searchCriteria === "music") {
        const musicStr = `${e.music?.title || ""} ${e.music?.artist || ""}`.toLowerCase();
        return musicStr.includes(this.searchQuery);
      }
      if (this.searchCriteria === "tag") {
        const matchedTagIds = this.tags.filter(t => t.name.toLowerCase().includes(this.searchQuery)).map(t => t.id);
        return Array.isArray(e.tags) && e.tags.some(tid => matchedTagIds.includes(tid));
      }
      if (this.searchCriteria === "month") return (e.date || "").split("-")[1] === this.searchQuery.padStart(2, "0");
      if (this.searchCriteria === "year") return (e.date || "").startsWith(this.searchQuery);
      return false;
    });

    if (matches.length === 0) {
      container.innerHTML = `<div style='color: #887; text-align: center; margin-top: 40px;'>No results for "${this.searchQuery}".</div>`;
      return;
    }

    container.innerHTML = `
      <div style="font-family: var(--font-serif); font-size: 18px; margin-bottom: 12px; color: var(--brown);">Found ${matches.length} matches:</div>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 14px; max-height: 480px; overflow-y: auto;">
        ${matches.map(entry => `
          <div class="polaroid-frame search-result-item" data-id="${entry.id}" style="width: 100%;">
            ${entry.media?.[0] ? `
              <img src="${entry.media[0].pathOrDocId}" class="polaroid-img" alt="Photo">
            ` : `
              <div style="aspect-ratio: 1; background: #e8dcc6; display: flex; align-items: center; justify-content: center; font-size: 28px;">📝</div>
            `}
            <div class="polaroid-title-text" style="font-size: 13px;">${entry.title || Utils.formatDate(entry.date)}</div>
          </div>
        `).join("")}
      </div>
    `;

    container.querySelectorAll(".search-result-item").forEach(item => {
      item.addEventListener("click", () => {
        const entry = this.entries.find(e => e.id === item.dataset.id);
        if (entry) this.openEntryInspectionPopup(entry);
      });
    });
  }

  // -------------------------------------------------------------------
  // CATEGORY: CHAPTERS (POINT 3: CREATE, RENAME, ASSIGN PAGES)
  // -------------------------------------------------------------------
  createChaptersLeftPage() {
    const page = document.createElement("div");
    page.className = "book-page page-left";
    page.innerHTML = `
      <div style="border-bottom: 2px solid var(--brown); padding-bottom: 8px; margin-bottom: 18px;">
        <h2 style="font-family: var(--font-serif); font-size: 28px; color: var(--brown);">Chapters</h2>
      </div>

      <p style="font-size: 13px; color: #554; line-height: 1.5; margin-bottom: 16px;">
        Organize your memories into chapters and bookmarks. Rename them, add new spreads, or reorder narrative sections.
      </p>

      <div class="form-group">
        <label class="form-label" style="color: var(--brown);">Create a new chapter:</label>
        <div style="display: flex; gap: 8px;">
          <input type="text" id="newChapterNameInput" class="form-input" placeholder="Chapter title..." style="background: #fff; color: var(--brown); border: 1px solid var(--brown);">
          <button type="button" class="btn-primary" id="addChapterBtn">Add</button>
        </div>
      </div>

      <div style="margin-top: 24px; border-top: 1px dashed rgba(0,0,0,0.15); padding-top: 16px;">
        <button type="button" class="btn-secondary" id="chapterNewSpreadBtn" style="color: var(--brown); border-color: var(--brown); width: 100%;">
          📄 + Add New Blank Spread to Book
        </button>
      </div>
    `;

    page.querySelector("#addChapterBtn")?.addEventListener("click", async () => {
      const name = page.querySelector("#newChapterNameInput")?.value.trim();
      if (!name) return;
      if (!this.scrapbookData.chapters) this.scrapbookData.chapters = [];
      this.scrapbookData.chapters.push({
        id: `ch-${Date.now()}`,
        name,
        pageIds: []
      });
      await window.storageAdapter.saveScrapbook(this.scrapbookData);
      window.app.showToast(`Chapter "${name}" created!`);
      this.cleanContainerAndBuild();
      this.flipToPage(6);
    });

    page.querySelector("#chapterNewSpreadBtn")?.addEventListener("click", () => {
      this.newSpread();
    });

    return page;
  }

  createChaptersRightPage() {
    const page = document.createElement("div");
    page.className = "book-page page-right";
    const chapters = this.scrapbookData?.chapters || [];
    const allPages = this.scrapbookData?.pages || [];
    const escapeHtml = value => String(value).replace(/[&<>"']/g, char =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

    page.innerHTML = `
      <h3 style="font-family: var(--font-serif); font-size: 20px; margin-bottom: 14px; color: var(--brown);">Chapter Registry</h3>
      <div style="display: flex; flex-direction: column; gap: 10px; max-height: 500px; overflow-y: auto;">
        ${chapters.map((ch, idx) => `
          <div style="display: flex; flex-direction: column; gap: 6px; padding: 10px 14px; background: rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.1); border-radius: 3px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span style="font-family: var(--font-serif); font-size: 17px; font-weight: 600; color: var(--brown);">${escapeHtml(ch.name)}</span>
                <span style="font-size: 11px; color: #776; margin-left: 8px;">(${ch.pageIds?.length || 0} pages)</span>
              </div>
              <div style="display: flex; gap: 4px;">
                <button type="button" class="btn-secondary" data-chapter-action="up" data-chapter-index="${idx}" aria-label="Move ${escapeHtml(ch.name)} up">↑</button>
                <button type="button" class="btn-secondary" data-chapter-action="down" data-chapter-index="${idx}" aria-label="Move ${escapeHtml(ch.name)} down">↓</button>
                <button type="button" class="btn-secondary" data-chapter-action="rename" data-chapter-id="${ch.id}" style="font-size: 11px; padding: 2px 6px; color: var(--brown);">✏️ Rename</button>
                <button type="button" class="btn-secondary" data-chapter-action="delete" data-chapter-index="${idx}" style="font-size: 11px; padding: 2px 6px; color: #ff6666;" aria-label="Delete ${escapeHtml(ch.name)}">&times;</button>
              </div>
            </div>

            <!-- Page assignment checkboxes -->
            <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px;">
              ${allPages.map((p, pIdx) => {
                const isAssigned = (ch.pageIds || []).includes(p.id);
                return `
                  <button type="button" class="btn-secondary" data-chapter-action="toggle-page" data-chapter-id="${ch.id}" data-page-id="${p.id}" style="font-size: 10px; padding: 2px 6px; ${isAssigned ? 'background: var(--brown); color: #fff;' : 'color: var(--brown);'}">
                    ${isAssigned ? '✓ ' : ''}Page ${pIdx + 1}
                  </button>
                `;
              }).join("")}
            </div>
          </div>
        `).join("")}
      </div>
    `;

    page.querySelectorAll("[data-chapter-action]").forEach(button => {
      button.addEventListener("click", () => {
        const action = button.dataset.chapterAction;
        if (action === "rename") {
          const chapter = chapters.find(item => item.id === button.dataset.chapterId);
          if (chapter) this.renameChapterPrompt(chapter.id, chapter.name);
        } else if (action === "toggle-page") {
          this.togglePageInChapter(button.dataset.chapterId, button.dataset.pageId);
        } else if (action === "delete") {
          this.deleteChapter(Number(button.dataset.chapterIndex));
        } else if (action === "up" || action === "down") {
          this.moveChapter(Number(button.dataset.chapterIndex), action === "up" ? -1 : 1);
        }
      });
    });

    return page;
  }

  async moveChapter(index, offset) {
    const destination = index + offset;
    const chapters = this.scrapbookData?.chapters;
    if (!chapters || destination < 0 || destination >= chapters.length) return;
    [chapters[index], chapters[destination]] = [chapters[destination], chapters[index]];
    await window.storageAdapter.saveScrapbook(this.scrapbookData);
    this.cleanContainerAndBuild();
    this.flipToPage(6);
  }

  async renameChapterPrompt(chapterId, currentName) {
    const newName = prompt("Rename chapter to:", currentName);
    if (newName && newName.trim() && newName.trim() !== currentName) {
      const ch = this.scrapbookData?.chapters?.find(c => c.id === chapterId);
      if (ch) {
        ch.name = newName.trim();
        await window.storageAdapter.saveScrapbook(this.scrapbookData);
        window.app.showToast("Chapter renamed.");
        this.cleanContainerAndBuild();
        this.flipToPage(6);
      }
    }
  }

  async togglePageInChapter(chapterId, pageId) {
    const ch = this.scrapbookData?.chapters?.find(c => c.id === chapterId);
    if (!ch) return;
    if (!ch.pageIds) ch.pageIds = [];
    if (ch.pageIds.includes(pageId)) {
      ch.pageIds = ch.pageIds.filter(id => id !== pageId);
    } else {
      ch.pageIds.push(pageId);
    }
    await window.storageAdapter.saveScrapbook(this.scrapbookData);
    this.cleanContainerAndBuild();
    this.flipToPage(6);
  }

  async deleteChapter(index) {
    if (this.scrapbookData?.chapters?.[index]) {
      this.scrapbookData.chapters.splice(index, 1);
      await window.storageAdapter.saveScrapbook(this.scrapbookData);
      window.app.showToast("Chapter removed.");
      this.cleanContainerAndBuild();
      this.flipToPage(6);
    }
  }

  // Point 3: Create New Blank Spread
  async newSpread() {
    if (!this.scrapbookData) {
      this.scrapbookData = await window.storageAdapter.getScrapbook();
    }
    if (!this.scrapbookData.pages) this.scrapbookData.pages = [];

    if (this.scrapbookData.pages.length % 2 !== 0) {
      this.scrapbookData.pages.push({
        id: `page-user-${Date.now()}-R`,
        kind: "entry",
        section: "entries",
        side: "right",
        layoutUnit: "percent",
        paper: { color: "#f8f3e8", lining: "none", width: 530, height: 710 },
        elements: []
      });
    }

    const targetPageIndex = this.scrapbookData.pages.length;
    const spreadNum = Math.floor(targetPageIndex / 2) + 1;
    const pageL = {
      id: `page-user-${Date.now()}-L`,
      kind: "entry",
      section: "entries",
      side: "left",
      layoutUnit: "percent",
      paper: { color: "#f8f3e8", lining: "none", width: 530, height: 710 },
      elements: []
    };
    const pageR = {
      id: `page-user-${Date.now()}-R`,
      kind: "entry",
      section: "entries",
      side: "right",
      layoutUnit: "percent",
      paper: { color: "#f8f3e8", lining: "none", width: 530, height: 710 },
      elements: []
    };

    this.scrapbookData.pages.push(pageL, pageR);
    await window.storageAdapter.saveScrapbook(this.scrapbookData);
    window.app.showToast(`New spread ${spreadNum} added!`);
    this.cleanContainerAndBuild();

    // Flip to the newly created spread
    setTimeout(() => {
      this.flipToPage(8 + targetPageIndex);
    }, 100);
  }

  // -------------------------------------------------------------------
  // ENTRY INSPECTION POPUP WITH DRAG-OUT CAPABILITY (POINT 2)
  // -------------------------------------------------------------------
  openEntryInspectionPopup(entry) {
    let popup = document.getElementById("entryInspectionModal");
    if (!popup) {
      popup = document.createElement("div");
      popup.id = "entryInspectionModal";
      popup.className = "wizard-modal entry-inspection-backdrop";
      document.body.appendChild(popup);
    }

    popup.classList.add("entry-inspection-backdrop");
    const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
    const mediaItems = (Array.isArray(entry.media) ? entry.media : [])
      .filter(media => media &&
        media.type !== "video" &&
        media.type !== "audio" &&
        !String(media.type || "").startsWith("video/") &&
        !String(media.type || "").startsWith("audio/"))
      .map(media => ({
        media,
        url: media.pathOrDocId || media.url || media.dataUrl || ""
      }))
      .filter(item => item.url);
    const photoMarkup = mediaItems.length
      ? mediaItems.map(({ media, url }, index) => `
          <div class="polaroid-frame draggable-source-item inspection-photo-card"
               draggable="false" id="popupDragPhoto-${index}" title="Drag this photo onto a scrapbook page">
            <span class="drag-hint-badge">Drag ↷</span>
            <img src="${escapeHtml(url)}" class="polaroid-img" draggable="false" alt="${escapeHtml(media.title || media.name || `Photo ${index + 1}`)}">
            <span class="inspection-photo-caption">${escapeHtml(media.title || media.name || `Photo ${index + 1}`)}</span>
          </div>
        `).join("")
      : `<div class="polaroid-empty-state">No photos attached to this memory.</div>`;
    const description = escapeHtml(entry.description || "").replace(/\r?\n/g, "<br>");
    const musicTitle = escapeHtml(entry.music?.title || "");
    const musicArtist = escapeHtml(entry.music?.artist || "");
    popup.innerHTML = `
      <div class="confirm-dialog entry-inspection-dialog" role="dialog" aria-modal="true" aria-labelledby="entryInspectionTitle">
        <div style="display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid var(--line); padding-bottom: 10px;">
          <div>
            <h2 id="entryInspectionTitle" style="font-family: var(--font-serif); font-size: 26px; color: var(--gold);">${escapeHtml(entry.title || "Memory Entry")}</h2>
            <div style="font-size: 12px; color: var(--muted);">${escapeHtml(Utils.formatDate(entry.date))} ${escapeHtml(entry.time || "")}</div>
          </div>
          <button type="button" class="inspection-close-btn" style="font-size: 22px; color: var(--muted);" aria-label="Close inspection">&times;</button>
        </div>

        <div style="font-size: 12px; color: var(--gold); margin: 8px 0; background: rgba(213, 173, 112, 0.1); padding: 6px 12px; border-radius: 3px;">
          💡 <strong>Tip:</strong> Drag any photo or item onto a scrapbook page. Editor Mode opens automatically.
        </div>

        <section style="margin-top: 12px;">
          <h3 style="margin: 0 0 8px; color: var(--gold); font: 16px var(--font-serif);">Photos (${mediaItems.length})</h3>
          <div class="inspection-photo-grid">${photoMarkup}</div>
        </section>

        <div style="display: flex; flex-direction: column; gap: 14px; margin-top: 14px;">
            ${description ? `
              <div class="sticky-note draggable-source-item" draggable="false" id="popupDragSticky" title="Drag the note onto a scrapbook page">
                <span class="drag-hint-badge">Drag ↷</span>
                <div class="washi-tape"></div>
                <div class="sticky-text-body">${description}</div>
              </div>
            ` : ""}

            ${entry.music?.title ? `
              <div class="music-sticker draggable-source-item" draggable="false" id="popupDragMusic" style="cursor: grab; width: 100%;" title="Drag the music sticker onto a scrapbook page">
                <span class="drag-hint-badge">Drag ↷</span>
                <span>🎵</span>
                <span>${musicTitle} - ${musicArtist}</span>
              </div>
            ` : ""}

            ${entry.geolocation?.label ? `
              <div style="font-size: 13px; color: var(--gold); padding: 4px 8px; background: rgba(0,0,0,0.3); border-radius: 2px;">
                📍 ${escapeHtml(entry.geolocation.label)}
              </div>
            ` : ""}
        </div>

        <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-top: 20px; border-top: 1px solid var(--line); padding-top: 12px;">
          <button type="button" class="btn-primary" id="popupEnableEditorBtn">✏️ Open Editor</button>
          <button type="button" class="btn-primary" id="locateInBookBtn">📖 Locate in Scrapbook</button>
          <button type="button" class="btn-secondary inspection-close-btn">Close</button>
        </div>
      </div>
    `;

    const setupDrag = (element, type, content) => {
      if (!element) return;
      element.draggable = false;
      const payload = {
        source: "popup",
        type,
        entryId: entry.id,
        content
      };
      let pointerDrag = null;
      const clearPointerDrag = () => {
        if (pointerDrag) {
          document.removeEventListener("pointermove", onPointerMove, true);
          document.removeEventListener("pointerup", onPointerUp, true);
          document.removeEventListener("pointercancel", onPointerCancel, true);
        }
        document.querySelectorAll("#flipBookContainer .page-drag-over")
          .forEach(page => page.classList.remove("page-drag-over"));
        popup.classList.remove("dragging-out");
        pointerDrag = null;
      };
      const openEditorForDrag = () => {
        const editor = window.scrapbookEditor;
        if (!editor || editor.isOpen) return;
        const opening = this.stageEl?.hidden ? this.open() : Promise.resolve();
        editor.open();
        opening.catch(error => {
          console.error("Could not open the scrapbook for drag-and-drop:", error);
          editor.close();
          clearPointerDrag();
          window.app?.showToast?.("Could not open the scrapbook. Please try again.");
        });
      };
      const onPointerMove = event => {
        if (!pointerDrag || event.pointerId !== pointerDrag.pointerId) return;
        if (!pointerDrag.started) {
          if (Math.hypot(event.clientX - pointerDrag.startX, event.clientY - pointerDrag.startY) < 6) return;
          pointerDrag.started = true;
          popup.classList.add("dragging-out");
          openEditorForDrag();
        }

        const page = document.elementFromPoint(event.clientX, event.clientY)?.closest(".entry-scrapbook-page");
        document.querySelectorAll("#flipBookContainer .page-drag-over")
          .forEach(item => item.classList.toggle("page-drag-over", item === page));
      };
      const onPointerUp = event => {
        if (!pointerDrag || event.pointerId !== pointerDrag.pointerId) return;
        const state = pointerDrag;
        const page = state.started && window.scrapbookEditor?.isOpen
          ? document.elementFromPoint(event.clientX, event.clientY)?.closest(".entry-scrapbook-page")
          : null;
        if (page) {
          event.preventDefault();
          event.stopPropagation();
          const rect = page.getBoundingClientRect();
          const dropX = Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100));
          const dropY = Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100));
          window.scrapbookEditor.placeDroppedItem(page.dataset.pageId, payload, dropX, dropY)
            .catch(error => {
              console.error("Could not place the dragged item:", error);
              window.app?.showToast?.("Could not place that item on the page.");
            });
        }
        clearPointerDrag();
      };
      const onPointerCancel = event => {
        if (!pointerDrag || event.pointerId !== pointerDrag.pointerId) return;
        clearPointerDrag();
      };

      element.addEventListener("pointerdown", event => {
        if (event.button !== 0 && event.pointerType !== "touch") return;
        pointerDrag = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          started: false
        };
        document.addEventListener("pointermove", onPointerMove, true);
        document.addEventListener("pointerup", onPointerUp, true);
        document.addEventListener("pointercancel", onPointerCancel, true);
      });
    };

    mediaItems.forEach(({ media, url }, index) => {
      setupDrag(popup.querySelector(`#popupDragPhoto-${index}`), "polaroid", {
        photoUrl: url,
        mediaId: media.docId || media.id,
        title: media.title || entry.title || "",
        capturedAt: entry.date || ""
      });
    });
    setupDrag(popup.querySelector("#popupDragSticky"), "sticky", { text: entry.description || "" });
    setupDrag(popup.querySelector("#popupDragMusic"), "music", entry.music || {});

    popup.querySelectorAll(".inspection-close-btn").forEach(button => {
      button.addEventListener("click", () => { popup.hidden = true; });
    });

    popup.querySelector("#popupEnableEditorBtn")?.addEventListener("click", async () => {
      if (this.stageEl?.hidden) await this.open();
      window.scrapbookEditor?.open();
      window.app?.showToast?.("Drag the inspected items onto an entry page.");
    });

    popup.querySelector("#locateInBookBtn")?.addEventListener("click", () => {
      popup.hidden = true;
      this.locateEntryInScrapbook(entry.id);
    });

    popup.classList.remove("dragging-out");
    popup.hidden = false;
  }

  locateEntryInScrapbook(entryId) {
    const pages = this.scrapbookData?.pages || [];
    const pageIndex = pages.findIndex(p => (p.elements || []).some(el => el.entryId === entryId));
    if (pageIndex !== -1) {
      this.flipToPage(8 + pageIndex);
    } else {
      window.app.showToast("Entry is on recent page.");
      this.jumpToRecent();
    }
  }

  // -------------------------------------------------------------------
  // AUTO-PLACEMENT OF NEW ENTRIES ONTO SCRAPBOOK PAGES
  // -------------------------------------------------------------------
  async autoPlaceEntry(entry) {
    if (!this.scrapbookData) {
      this.scrapbookData = await window.storageAdapter.getScrapbook();
    }
    if (!this.scrapbookData.pages) this.scrapbookData.pages = [];

    let targetPage = this.scrapbookData.pages[this.scrapbookData.pages.length - 1];
    if (!targetPage || (targetPage.elements || []).length >= 3) {
      targetPage = {
        id: `page-user-${Date.now()}`,
        kind: "entry",
        section: "entries",
        layoutUnit: "percent",
        paper: { color: "#f8f3e8", lining: "ruled", width: 530, height: 710 },
        elements: []
      };
      this.scrapbookData.pages.push(targetPage);
    }

    const seed = Date.now() % 10000;
    const rotation = Utils.getMessyRotation(seed);

    const polaroidEl = {
      id: `el-polaroid-${Date.now()}`,
      type: "polaroid",
      entryId: entry.id,
      x: 6,
      y: 7,
      w: 42,
      h: 40,
      rotation,
      z: 1,
      content: {
        photoUrl: entry.media?.[0]?.pathOrDocId || "",
        mediaId: entry.media?.[0]?.docId || entry.media?.[0]?.id,
        title: entry.title || "",
        capturedAt: entry.date || ""
      },
      style: { font: "DM Sans", size: 14, color: "#211711" },
      seed
    };
    targetPage.elements.push(polaroidEl);

    if (entry.description) {
      targetPage.elements.push({
        id: `el-sticky-${Date.now() + 1}`,
        type: "sticky",
        entryId: entry.id,
        x: 52,
        y: 43,
        w: 42,
        h: 28,
        rotation: -rotation,
        z: 2,
        content: { text: entry.description },
        style: { font: "Caveat", size: 18, color: "#332b00", bgColor: "#fff9c4" },
        seed: seed + 1
      });
    }

    if (entry.music?.title) {
      targetPage.elements.push({
        id: `el-music-${Date.now() + 2}`,
        type: "music",
        entryId: entry.id,
        x: 6,
        y: 72,
        w: 42,
        h: entry.music.embedUrl || entry.music.videoId ? 26 : 12,
        rotation: rotation * 0.5,
        z: 3,
        content: entry.music,
        style: {},
        seed: seed + 2
      });
    }

    await window.storageAdapter.saveScrapbook(this.scrapbookData);
  }

  generateDefaultEntryPages() {
    this.scrapbookData.pages = [];
    this.entries.forEach(e => {
      this.autoPlaceEntry(e);
    });
  }

  // -------------------------------------------------------------------
  // RENDER PAGE ELEMENTS
  // -------------------------------------------------------------------
  renderPageElement(el) {
    const div = document.createElement("div");
    div.className = "scrapbook-element";
    div.id = el.id;
    div.dataset.elementId = el.id;
    div.dataset.type = el.type;
    if (el.entryId) div.dataset.entryId = el.entryId;
    div.style.left = `${el.x}%`;
    div.style.top = `${el.y}%`;
    div.style.width = el.w ? `${el.w}%` : "auto";
    div.style.height = el.h ? `${el.h}%` : "auto";
    div.style.zIndex = el.z || 1;
    div.style.transform = `rotate(${el.rotation || 0}deg)`;

    // Corner resize handle (Point 4)
    const resizeHandle = document.createElement("button");
    resizeHandle.type = "button";
    resizeHandle.className = "spread-resize";
    resizeHandle.setAttribute("aria-label", "Resize element");
    resizeHandle.title = "Resize";
    resizeHandle.textContent = "↘";

    const rotateHandle = document.createElement("button");
    rotateHandle.type = "button";
    rotateHandle.className = "spread-rotate";
    rotateHandle.setAttribute("aria-label", "Rotate element");
    rotateHandle.title = "Drag around the element to rotate";
    rotateHandle.textContent = "⟳";

    if (el.type === "polaroid") {
      const content = el.content || {};
      const frame = document.createElement("div");
      frame.className = "polaroid-frame scrapbook-photo-frame";
      frame.innerHTML = '<div class="corner-tape-tl"></div><div class="corner-tape-br"></div>';

      if (content.photoUrl) {
        const image = document.createElement("img");
        image.src = content.photoUrl;
        image.alt = content.title || "Memory photograph";
        image.draggable = false;
        image.className = "polaroid-img";
        frame.appendChild(image);
      } else {
        const placeholder = document.createElement("div");
        placeholder.className = "polaroid-empty-state";
        const choosePhoto = document.createElement("button");
        choosePhoto.type = "button";
        choosePhoto.className = "photo-picker-trigger";
        choosePhoto.dataset.openPhotoPicker = "true";
        choosePhoto.dataset.elementId = el.id;
        choosePhoto.textContent = "Choose a saved photo";
        choosePhoto.hidden = !window.scrapbookEditor?.isOpen;
        placeholder.append("📷", choosePhoto);
        frame.appendChild(placeholder);
      }

      const caption = document.createElement("div");
      caption.className = "polaroid-caption";
      const title = document.createElement("div");
      title.className = "polaroid-title-text";
      title.textContent = content.title || "";
      title.style.fontFamily = el.style?.font || "Caveat";
      title.style.fontSize = `${el.style?.size || 19}px`;
      title.style.color = el.style?.color || "#211711";
      caption.appendChild(title);
      if (content.capturedAt) {
        const capturedAt = document.createElement("div");
        capturedAt.className = "polaroid-photo-date";
        capturedAt.textContent = Utils.formatDate(content.capturedAt);
        caption.appendChild(capturedAt);
      }
      frame.appendChild(caption);
      div.appendChild(frame);

    } else if (el.type === "sticky") {
      const stickyText = String(el.content?.text || "")
        .replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char])
        .replace(/\n/g, "<br>");
      const textAlign = ["left", "center", "right", "justify"].includes(el.style?.textAlign)
        ? el.style.textAlign
        : "left";
      div.innerHTML += `
        <div class="sticky-note" style="width: 100%; height: 100%; background-color: ${el.style?.bgColor || '#fff9c4'}; font-family: ${el.style?.font || 'Caveat'}; font-size: ${el.style?.size || 19}px; color: ${el.style?.color || '#332b00'}; white-space: pre-wrap;">
          <div class="washi-tape"></div>
          <div class="sticky-text-body" style="text-align: ${textAlign};">${stickyText}</div>
        </div>
      `;
      div.querySelector(".sticky-note").style.textAlign = textAlign;

    } else if (el.type === "music") {
      const content = el.content || {};
      const player = content.previewUrl
        ? `<audio controls preload="none" src="${content.previewUrl}" aria-label="Play ${content.title || "selected track"}"></audio>`
        : content.embedUrl || content.videoId
          ? `<iframe src="${content.embedUrl || `https://www.youtube-nocookie.com/embed/${encodeURIComponent(content.videoId)}`}" title="Play ${content.title || "selected track"}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`
          : "";
      div.innerHTML += `
        <div class="music-sticker music-sticker-player" style="width: 100%; background-color: ${el.style?.bgColor || '#2b2221'};">
          <div class="music-sticker-heading"><span>${content.provider === 'youtube' ? '▶' : '🎵'}</span><span>${content.title || "Music"} - ${content.artist || ""}</span></div>
          ${player}
          <a href="${content.link || '#'}" target="_blank" rel="noopener noreferrer">Open on ${content.provider === "youtube" ? "YouTube" : content.provider === "apple" ? "Apple Music" : "music service"}</a>
        </div>
      `;

    } else if (el.type === "text") {
      const textContent = String(el.content?.text || "")
        .replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char])
        .replace(/\n/g, "<br>");
      const textAlign = ["left", "center", "right", "justify"].includes(el.style?.textAlign)
        ? el.style.textAlign
        : "left";
      div.innerHTML += `
        <div style="font-family: ${el.style?.font || 'Cormorant Garamond'}; font-size: ${el.style?.size || 20}px; color: ${el.style?.color || '#211711'}; width: 100%; height: 100%; line-height: 1.5; padding: 4px; white-space: pre-wrap; text-align: ${textAlign};">
          ${textContent}
        </div>
      `;

    } else if (el.type === "social") {
      // Social Embed for Instagram & TikTok (Point 8)
      const content = el.content || {};
      const isIg = content.platform === "instagram";
      div.innerHTML += `
        <div class="social-embed-card" style="width: 100%; height: 100%;">
          <div class="social-embed-header">
            <span class="social-badge ${isIg ? 'badge-instagram' : 'badge-tiktok'}">${isIg ? 'Instagram' : 'TikTok'}</span>
            <a href="${content.url || '#'}" target="_blank" style="color: var(--gold); text-decoration: none; font-size: 11px;">Open ↗</a>
          </div>
          <div class="social-preview-body">
            ${content.embedUrl ? `
              <iframe src="${content.embedUrl}" allowfullscreen></iframe>
            ` : `
              <div style="font-size: 12px; color: var(--muted); text-align: center; padding: 12px;">
                ${content.caption || content.url}
              </div>
            `}
          </div>
        </div>
      `;

    } else if (el.type === "plain") {
      div.innerHTML += `
        <div class="plain-sticker" id="plainStickerTrigger-${el.id}" style="width: 100%;">
          <span style="font-size: 22px;">✨</span>
          <span>Click to assign content</span>
        </div>
      `;
      div.addEventListener("click", () => {
        window.scrapbookEditor?.openPlainStickerModal(el);
      });
    }

    div.appendChild(resizeHandle);
    div.appendChild(rotateHandle);
    return div;
  }

  jumpToRecent() {
    this.flipToPage(8);
  }

  flipToPage(pageIndex) {
    if (this.pageFlip) {
      try {
        this.pageFlip.flip(pageIndex);
      } catch (e) {
        console.warn("Flip error:", e);
      }
    }
  }
}

window.ScrapbookViewer = ScrapbookViewer;
