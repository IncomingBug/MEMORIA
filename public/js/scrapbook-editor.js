// MEMORIA v2 - Canva-Style Interactive Scrapbook Editor
class ScrapbookEditor {
  constructor() {
    this.panelEl = document.getElementById("editorBottomPanel");
    this.inspectorBarEl = document.getElementById("editorInspectorBar");
    this.activeElementId = null;
    this.selectedElementModel = null;
    this.isOpen = false;
    this.history = [];
    this.historyIndex = -1;
    this.maxHistory = 30;

    this.debouncedSave = Utils.debounce(async () => {
      if (window.scrapbookViewer?.scrapbookData) {
        try {
          await window.storageAdapter.saveScrapbook(window.scrapbookViewer.scrapbookData);
        } catch (error) {
          console.error("Could not save scrapbook layout:", error);
          window.app.showToast("Could not save the layout. Please try again.");
        }
      }
    }, 600);

    this.init();
  }

  init() {
    this.bindEvents();
    this.setupInteract();
    this.setupPaletteDragAndDrop();
  }

  bindEvents() {
    // Toolbar buttons
    document.getElementById("editorCloseBtn")?.addEventListener("click", () => this.close());
    document.getElementById("editorUndoBtn")?.addEventListener("click", () => this.undo());
    document.getElementById("editorRedoBtn")?.addEventListener("click", () => this.redo());
    document.getElementById("editorRecolorPageBtn")?.addEventListener("click", () => this.openPageCustomizer());
    document.getElementById("editorCoverGearBtn")?.addEventListener("click", () => this.openCoverEditor());
    document.getElementById("editorNewSpreadBtn")?.addEventListener("click", () => {
      window.scrapbookViewer?.newSpread();
    });

    // Inspector bar live controls (Point 4)
    const textInput = document.getElementById("inspectorTextInput");
    textInput?.addEventListener("input", (e) => {
      if (!this.selectedElementModel) return;
      const val = e.target.value;
      if (this.selectedElementModel.type === "polaroid") {
        this.selectedElementModel.content.title = val;
      } else {
        this.selectedElementModel.content.text = val;
      }
      this.updateDomForSelectedElement();
      this.debouncedSave();
    });

    const fontSelect = document.getElementById("inspectorFontSelect");
    fontSelect?.addEventListener("change", (e) => {
      if (!this.selectedElementModel) return;
      if (!this.selectedElementModel.style) this.selectedElementModel.style = {};
      this.selectedElementModel.style.font = e.target.value;
      this.updateDomForSelectedElement();
      this.debouncedSave();
    });

    const sizeSelect = document.getElementById("inspectorFontSizeSelect");
    sizeSelect?.addEventListener("change", (e) => {
      if (!this.selectedElementModel) return;
      if (!this.selectedElementModel.style) this.selectedElementModel.style = {};
      this.selectedElementModel.style.size = parseInt(e.target.value, 10);
      this.updateDomForSelectedElement();
      this.debouncedSave();
    });

    const textAlignSelect = document.getElementById("inspectorTextAlignSelect");
    textAlignSelect?.addEventListener("change", (e) => {
      if (!this.selectedElementModel || !["sticky", "text"].includes(this.selectedElementModel.type)) return;
      if (!this.selectedElementModel.style) this.selectedElementModel.style = {};
      this.selectedElementModel.style.textAlign = e.target.value;
      this.updateDomForSelectedElement();
      this.debouncedSave();
    });

    const colorInput = document.getElementById("inspectorColorInput");
    colorInput?.addEventListener("input", (e) => {
      if (!this.selectedElementModel || !["sticky", "music"].includes(this.selectedElementModel.type)) return;
      if (!this.selectedElementModel.style) this.selectedElementModel.style = {};
      this.selectedElementModel.style.bgColor = e.target.value;
      this.updateDomForSelectedElement();
      this.debouncedSave();
    });

    const textColorInput = document.getElementById("inspectorTextColorInput");
    textColorInput?.addEventListener("input", (e) => {
      if (!this.selectedElementModel || !["sticky", "text", "polaroid"].includes(this.selectedElementModel.type)) return;
      if (!this.selectedElementModel.style) this.selectedElementModel.style = {};
      this.selectedElementModel.style.color = e.target.value;
      this.updateDomForSelectedElement();
      this.debouncedSave();
    });

    document.querySelectorAll(".inspector-swatch").forEach(swatch => {
      swatch.addEventListener("click", () => {
        if (!this.selectedElementModel || !["sticky", "music"].includes(this.selectedElementModel.type)) return;
        if (!this.selectedElementModel.style) this.selectedElementModel.style = {};
        const col = swatch.dataset.color;
        this.selectedElementModel.style.bgColor = col;
        if (colorInput) colorInput.value = col;
        this.updateDomForSelectedElement();
        this.debouncedSave();
      });
    });

    // Disable opening links while in Edit Mode (Capture phase)
    document.getElementById("bookStage")?.addEventListener("click", (e) => {
      if (this.isOpen) {
        const element = e.target.closest(".scrapbook-element");
        if (element && !e.target.closest(".element-controls-overlay")) {
          this.selectElement(element);
        }
        const link = e.target.closest("a");
        if (link) {
          e.preventDefault();
          e.stopPropagation();
          window.app?.showToast?.("Link opening is disabled while in Edit Mode.");
        }
      }
    }, true);

    // Keep nav arrows properly hugging the scrapbook on window resize during edit mode
    window.addEventListener("resize", () => {
      if (this.isOpen) {
        this.updateNavArrowPositions();
      }
    });
  }

  // -------------------------------------------------------------------
  // TRUE HTML5 DRAG & DROP FROM PALETTE (POINT 1)
  // -------------------------------------------------------------------
  setupPaletteDragAndDrop() {
    document.querySelectorAll(".palette-item").forEach(item => {
      item.setAttribute("draggable", "true");
      item.addEventListener("dragstart", (e) => {
        if (!this.isOpen) {
          e.preventDefault();
          window.app?.showToast?.("Open Editor Mode before placing elements.");
          return;
        }
        const type = item.dataset.type;
        e.dataTransfer.setData("application/json", JSON.stringify({
          source: "palette",
          type
        }));
        e.dataTransfer.effectAllowed = "copy";
      });
    });
  }

  getPageHorizontalBounds(pageId) {
    const viewer = window.scrapbookViewer;
    const pages = viewer?.scrapbookData?.pages || [];
    const pageIndex = pages.findIndex(page => page.id === pageId);
    const pageElements = [...document.querySelectorAll(".entry-scrapbook-page")]
      .filter(page => page.dataset.pageId === pageId);
    const pageElement = pageElements.find(page => page.getBoundingClientRect().width > 0);
    const pageRect = pageElement?.getBoundingClientRect();
    const leftEdge = pageElement
      ? pageElement.classList.contains("page-left")
      : pageIndex < 0 || pageIndex % 2 === 0;
    const inset = pageRect?.width
      ? 14 / pageRect.width * 100
      : viewer?.getPageFlipEdgeInsetPercent?.() || 0;
    return {
      minX: leftEdge ? inset : 0,
      maxRight: leftEdge ? 100 : 100 - inset
    };
  }

  // Handle drops onto scrapbook page (From Palette or From Photo Inspection Popup)
  async placeDroppedItem(pageId, payload, dropX, dropY) {
    if (!this.isOpen) return;
    const pages = window.scrapbookViewer?.scrapbookData?.pages || [];
    const targetPage = pages.find(p => p.id === pageId);
    if (!targetPage) return;
    const horizontalBounds = this.getPageHorizontalBounds(pageId);

    const seed = Date.now() % 10000;
    const rotation = Utils.getMessyRotation(seed);
    const type = payload.type || "sticky";

    if (type === "music" && !payload.content?.link) {
      this.openMusicLinkDialog((music) => {
        this.placeDroppedItem(pageId, { ...payload, type, content: music }, dropX, dropY);
      });
      return;
    }

    if (type === "polaroid" && !payload.content?.photoUrl) {
      this.openPhotoPicker(pageId, dropX, dropY, payload);
      return;
    }

    let newEl = {
      id: `el-${type}-${Date.now()}`,
      type,
      x: dropX,
      y: dropY,
      w: 42,
      h: 24,
      rotation,
      z: (targetPage.elements?.length || 0) + 1,
      content: payload.content || {},
      style: { font: "Caveat", size: 18, color: "#211711", bgColor: "#fff9c4" },
      seed
    };

    if (payload.entryId) {
      newEl.entryId = payload.entryId;
    }

    if (type === "polaroid") {
      newEl.w = 42;
      newEl.h = 40;
      newEl.style.font = "Caveat";
    } else if (type === "sticky") {
      newEl.w = 42;
      newEl.h = 28;
      if (!newEl.content.text) newEl.content = { text: "Add handwritten thought..." };
    } else if (type === "music") {
      newEl.w = 42;
      newEl.h = payload.content?.embedUrl || payload.content?.videoId ? 26 : 12;
      if (!newEl.content.title) {
        newEl.content = { title: "Melody", artist: "Artist", link: "#", provider: "apple" };
      }
    } else if (type === "text") {
      newEl.w = 38;
      newEl.h = 16;
      newEl.style.font = "Cormorant Garamond";
      newEl.style.size = 20;
      if (!newEl.content.text) newEl.content = { text: "Handwritten note..." };
    } else if (type === "social") {
      // Prompt for social link if added fresh from palette
      const url = prompt("Paste Instagram or TikTok link (https://...):");
      if (!url) return;
      newEl = this.createSocialEmbedModel(url, dropX, dropY, seed);
    } else if (type === "plain") {
      newEl.w = 26;
      newEl.h = 16;
    }

    newEl.x = Math.min(
      horizontalBounds.maxRight - newEl.w,
      Math.max(horizontalBounds.minX, dropX - newEl.w / 2)
    );
    newEl.y = Math.min(100 - newEl.h, Math.max(0, dropY - newEl.h / 2));
    if (!targetPage.elements) targetPage.elements = [];
    targetPage.elements.push(newEl);

    window.scrapbookViewer.cleanContainerAndBuild();

    // Select the newly placed item
    setTimeout(() => {
      const placedDom = document.getElementById(newEl.id);
      if (placedDom) this.selectElement(placedDom);
    }, 80);

    this.snapshot();
    this.debouncedSave();
    window.app.showToast(`Placed ${type} on page.`);
  }

  openPhotoPickerForElement(elementId, pageId) {
    const element = document.getElementById(elementId);
    const resolvedPageId = pageId || element?.closest(".entry-scrapbook-page")?.dataset.pageId;
    if (!resolvedPageId) return;
    this.openPhotoPicker(resolvedPageId, 0, 0, {}, elementId);
  }

  openPhotoPicker(pageId, x, y, payload = {}, elementId = null) {
    const photos = (window.scrapbookViewer?.entries || []).flatMap(entry =>
      (entry.media || [])
        .filter(media => media.pathOrDocId || media.url || media.dataUrl)
        .map(media => ({
          entry,
          media,
          url: media.pathOrDocId || media.url || media.dataUrl
        }))
    );
    if (photos.length === 0) {
      window.app?.showToast?.("Add a photo to a memory before placing it on the scrapbook.");
      return;
    }

    let modal = document.getElementById("scrapbookPhotoPicker");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "scrapbookPhotoPicker";
      modal.className = "wizard-modal editor-dialog-backdrop";
      document.body.appendChild(modal);
    }
    modal.innerHTML = `
      <div class="confirm-dialog photo-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="photoPickerTitle">
        <div class="photo-picker-heading">
          <h2 id="photoPickerTitle">Choose a scrapbook photo</h2>
          <button type="button" class="photo-picker-close" aria-label="Close">&times;</button>
        </div>
        <div class="photo-picker-grid"></div>
      </div>
    `;
    modal.querySelector(".photo-picker-close").addEventListener("click", () => { modal.hidden = true; });

    const grid = modal.querySelector(".photo-picker-grid");
    photos.forEach(photo => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "photo-picker-option";
      const image = document.createElement("img");
      image.src = photo.url;
      image.alt = photo.entry.title || "Memory photograph";
      const label = document.createElement("span");
      label.textContent = photo.entry.title || Utils.formatDate(photo.entry.date);
      option.append(image, label);
      option.addEventListener("click", async () => {
        const content = {
          photoUrl: photo.url,
          mediaId: photo.media.docId || photo.media.id,
          title: photo.entry.title || "",
          capturedAt: photo.entry.date || ""
        };
        if (elementId) {
          const page = window.scrapbookViewer?.scrapbookData?.pages?.find(item => item.id === pageId);
          const model = page?.elements?.find(item => item.id === elementId);
          if (!model) {
            window.app?.showToast?.("Could not find that scrapbook photo.");
            return;
          }
          model.content = { ...(model.content || {}), ...content };
          model.entryId = photo.entry.id;
          modal.hidden = true;
          window.scrapbookViewer.cleanContainerAndBuild();
          this.snapshot();
          this.debouncedSave();
          window.app?.showToast?.("Photo added to the scrapbook.");
          return;
        }

        modal.hidden = true;
        await this.placeDroppedItem(pageId, {
          ...payload,
          entryId: photo.entry.id,
          content
        }, x, y);
      });
      grid.appendChild(option);
    });

    modal.hidden = false;
  }

  createSocialEmbedModel(url, x, y, seed) {
    const isIg = url.includes("instagram.com");
    let embedUrl = "";
    if (isIg) {
      const match = url.match(/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/);
      if (match) embedUrl = `https://www.instagram.com/p/${match[1]}/embed`;
    } else {
      const match = url.match(/video\/(\d+)/);
      if (match) embedUrl = `https://www.tiktok.com/embed/v2/${match[1]}`;
    }

    return {
      id: `el-social-${Date.now()}`,
      type: "social",
      x,
      y,
      w: 45,
      h: 38,
      rotation: Utils.getMessyRotation(seed),
      z: 2,
      content: {
        platform: isIg ? "instagram" : "tiktok",
        url,
        embedUrl,
        caption: url
      },
      style: {},
      seed
    };
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  // Dynamically position flip arrows snug against the edges of the scrapbook in edit mode
  updateNavArrowPositions() {
    const prevBtn = document.getElementById("bookPrevBtn");
    const nextBtn = document.getElementById("bookNextBtn");
    if (!prevBtn || !nextBtn) return;

    if (this.isOpen) {
      const stage = document.querySelector(".stage-center");
      const bookWrapper = document.querySelector("#flipBookContainer .stf__wrapper") || 
                          document.querySelector("#flipBookContainer .stf__parent") ||
                          document.querySelector(".spread-book-wrapper");
      if (stage && bookWrapper) {
        const stageRect = stage.getBoundingClientRect();
        const bookRect = bookWrapper.getBoundingClientRect();
        if (bookRect.width > 0) {
          const leftOffset = Math.max(8, Math.round(bookRect.left - stageRect.left - 54));
          const rightOffset = Math.max(8, Math.round(stageRect.right - bookRect.right - 54));
          prevBtn.style.left = `${leftOffset}px`;
          prevBtn.style.right = "auto";
          nextBtn.style.right = `${rightOffset}px`;
          nextBtn.style.left = "auto";
          return;
        }
      }
      prevBtn.style.left = "max(10px, calc(50% - 530px - 58px))";
      prevBtn.style.right = "auto";
      nextBtn.style.right = "max(10px, calc(50% - 530px - 58px))";
      nextBtn.style.left = "auto";
    } else {
      prevBtn.style.left = "";
      prevBtn.style.right = "";
      nextBtn.style.left = "";
      nextBtn.style.right = "";
    }
  }

  // Point 5: Drag items ONLY in edit mode
  open() {
    this.isOpen = true;
    document.getElementById("bookStage")?.classList.add("editing-mode");
    if (this.panelEl) this.panelEl.classList.remove("collapsed");
    // Recreate PageFlip with input handlers disabled; changing its settings
    // after construction does not unregister the already-bound pointer events.
    window.scrapbookViewer?.cleanContainerAndBuild();

    // Move flip page arrows closer to the scrapbook edges
    this.updateNavArrowPositions();

    window.app.showToast("Editor Mode Active: drag, resize, and style any element.");
    this.snapshot();
  }

  close() {
    this.isOpen = false;
    document.getElementById("bookStage")?.classList.remove("editing-mode");
    if (this.panelEl) this.panelEl.classList.add("collapsed");

    // Rebuild in reading mode so page turns work again after editing.
    if (!window.scrapbookViewer?.isClosing) {
      window.scrapbookViewer?.cleanContainerAndBuild();
    }

    // Restore nav flip arrow positions
    this.updateNavArrowPositions();

    this.deselectAll();
  }

  // -------------------------------------------------------------------
  // INTERACT.JS DRAG, RESIZE & ROTATE (ACTIVE ONLY IN EDIT MODE)
  // -------------------------------------------------------------------
  setupInteract() {
    const stage = document.getElementById("bookStage");
    stage?.addEventListener("click", event => {
      const trigger = event.target.closest("[data-open-photo-picker]");
      if (!trigger || !this.isOpen) return;
      event.preventDefault();
      event.stopPropagation();
      this.openPhotoPickerForElement(
        trigger.dataset.elementId,
        trigger.closest(".entry-scrapbook-page")?.dataset.pageId
      );
    });

    stage?.addEventListener("pointerdown", event => {
      const rotationHandle = event.target.closest(".spread-rotate");
      if (rotationHandle && this.isOpen) {
        const element = rotationHandle.closest(".scrapbook-element");
        const page = element?.closest(".entry-scrapbook-page");
        const model = page && window.scrapbookViewer?.scrapbookData?.pages
          ?.find(item => item.id === page.dataset.pageId)?.elements
          ?.find(item => item.id === element.dataset.elementId);
        if (!element || !model) return;

        event.preventDefault();
        event.stopPropagation();
        this.selectElement(element);

        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const pointerAngle = pointerEvent =>
          Math.atan2(pointerEvent.clientY - centerY, pointerEvent.clientX - centerX) * 180 / Math.PI;
        let lastAngle = pointerAngle(event);
        let rotation = Number(model.rotation) || 0;
        const rotate = moveEvent => {
          let delta = pointerAngle(moveEvent) - lastAngle;
          if (delta > 180) delta -= 360;
          if (delta < -180) delta += 360;
          rotation += delta;
          lastAngle = pointerAngle(moveEvent);
          element.style.transform = `rotate(${rotation}deg)`;
        };
        const finish = () => {
          rotationHandle.removeEventListener("pointermove", rotate);
          rotationHandle.removeEventListener("pointerup", finish);
          rotationHandle.removeEventListener("pointercancel", finish);
          this.updateElementModel(element);
          window.scrapbookViewer?.clampRotatedElementToPage(page, model, element);
          this.snapshot();
          this.debouncedSave();
        };

        rotationHandle.addEventListener("pointermove", rotate);
        rotationHandle.addEventListener("pointerup", finish, { once: true });
        rotationHandle.addEventListener("pointercancel", finish, { once: true });
        rotationHandle.setPointerCapture(event.pointerId);
        return;
      }

      const handle = event.target.closest(".spread-resize");
      if (!handle || !this.isOpen) return;
      const element = handle.closest(".scrapbook-element");
      const page = element?.closest(".entry-scrapbook-page");
      const model = page && window.scrapbookViewer?.scrapbookData?.pages
        ?.find(item => item.id === page.dataset.pageId)?.elements
        ?.find(item => item.id === element.dataset.elementId);
      if (!element || !page || !model) return;
      const pageRect = page.getBoundingClientRect();
      if (!pageRect.width || !pageRect.height) return;
      const horizontalBounds = this.getPageHorizontalBounds(page.dataset.pageId);

      event.preventDefault();
      event.stopPropagation();
      this.selectElement(element);

      const startX = event.clientX;
      const startY = event.clientY;
      const startWidth = Number(model.w);
      const startHeight = Number(model.h);
      const minWidth = model.type === "polaroid" ? 15 : 10;
      const minHeight = model.type === "polaroid" ? 16 : 8;

      const resize = moveEvent => {
        const width = Math.min(
          horizontalBounds.maxRight - model.x,
          Math.max(minWidth, startWidth + (moveEvent.clientX - startX) / pageRect.width * 100)
        );
        const height = Math.min(
          100 - model.y,
          Math.max(minHeight, startHeight + (moveEvent.clientY - startY) / pageRect.height * 100)
        );
        element.style.width = `${width}%`;
        element.style.height = `${height}%`;
      };
      const finish = () => {
        handle.removeEventListener("pointermove", resize);
        handle.removeEventListener("pointerup", finish);
        handle.removeEventListener("pointercancel", finish);
        if (["sticky", "text"].includes(model.type)) this.fitTextToContent(element);
        this.updateElementModel(element);
        window.scrapbookViewer?.clampRotatedElementToPage(page, model, element);
        this.snapshot();
        this.debouncedSave();
      };

      handle.addEventListener("pointermove", resize);
      handle.addEventListener("pointerup", finish, { once: true });
      handle.addEventListener("pointercancel", finish, { once: true });
      handle.setPointerCapture(event.pointerId);
    });

    if (!window.interact) return;

    window.interact(".book-stage.editing-mode .entry-scrapbook-page .scrapbook-element")
      .draggable({
        ignoreFrom: ".spread-resize, .spread-rotate, .element-controls-overlay, .photo-picker-trigger",
        listeners: {
          start: (event) => {
            if (!this.isOpen) return;
            this.selectElement(event.target);
          },
          move: (event) => {
            if (!this.isOpen) return;
            const target = event.target;
            const pageRect = target.closest(".entry-scrapbook-page")?.getBoundingClientRect();
            if (!pageRect?.width || !pageRect.height) return;
            const left = parseFloat(target.style.left || "0") + event.dx / pageRect.width * 100;
            const top = parseFloat(target.style.top || "0") + event.dy / pageRect.height * 100;
            const width = parseFloat(target.style.width || "0");
            const height = parseFloat(target.style.height || "0");
            const horizontalBounds = this.getPageHorizontalBounds(target.closest(".entry-scrapbook-page")?.dataset.pageId);
            target.style.left = `${Math.max(horizontalBounds.minX, Math.min(horizontalBounds.maxRight - width, left))}%`;
            target.style.top = `${Math.max(0, Math.min(100 - height, top))}%`;
          },
          end: (event) => {
            if (!this.isOpen) return;
            if (!this.moveElementToDropPage(event.target, event.clientX, event.clientY)) {
              this.updateElementModel(event.target);
              const page = event.target.closest(".entry-scrapbook-page");
              const model = window.scrapbookViewer?.scrapbookData?.pages
                ?.find(item => item.id === page?.dataset.pageId)?.elements
                ?.find(item => item.id === event.target.dataset.elementId);
              if (page && model) {
                window.scrapbookViewer?.clampRotatedElementToPage(page, model, event.target);
              }
            }
            this.snapshot();
            this.debouncedSave();
          }
        }
      });
  }

  moveElementToDropPage(domEl, clientX, clientY) {
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
    const sourceEl = domEl.closest(".entry-scrapbook-page");
    const destinationEl = [...document.querySelectorAll(".entry-scrapbook-page")].find(page => {
      const rect = page.getBoundingClientRect();
      return rect.width > 0 && page.dataset.pageId !== sourceEl?.dataset.pageId &&
        clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    });
    if (!sourceEl || !destinationEl || sourceEl === destinationEl) return false;

    const data = window.scrapbookViewer?.scrapbookData;
    const sourcePage = data?.pages?.find(page => page.id === sourceEl.dataset.pageId);
    const targetPage = data?.pages?.find(page => page.id === destinationEl.dataset.pageId);
    if (!sourcePage || !targetPage) return false;

    const index = (sourcePage.elements || []).findIndex(element => element.id === domEl.dataset.elementId);
    if (index < 0) return false;
    const [model] = sourcePage.elements.splice(index, 1);
    const rect = destinationEl.getBoundingClientRect();
    const horizontalBounds = this.getPageHorizontalBounds(destinationEl.dataset.pageId);
    model.x = Math.max(
      horizontalBounds.minX,
      Math.min(horizontalBounds.maxRight - model.w, (clientX - rect.left) / rect.width * 100 - model.w / 2)
    );
    model.y = Math.max(0, Math.min(100 - model.h, (clientY - rect.top) / rect.height * 100 - model.h / 2));
    targetPage.elements = targetPage.elements || [];
    targetPage.elements.push(model);

    const targetIndex = data.pages.indexOf(targetPage);
    window.scrapbookViewer.cleanContainerAndBuild();
    window.scrapbookViewer.flipToPage(8 + targetIndex);
    window.app?.showToast?.("Moved element to the other page.");
    return true;
  }

  selectElement(domEl) {
    this.deselectAll();
    domEl.classList.add("selected");
    this.activeElementId = domEl.dataset.elementId;

    // Find backing data model
    const pageId = domEl.closest(".entry-scrapbook-page")?.dataset.pageId;
    const page = window.scrapbookViewer?.scrapbookData?.pages?.find(p => p.id === pageId);
    this.selectedElementModel = page?.elements?.find(e => e.id === this.activeElementId) || null;

    // Sync Inspector Bar
    this.populateInspectorBar();
    this.attachOverlayControls(domEl);
    if (this.fitTextToContent(domEl)) {
      this.snapshot();
      this.debouncedSave();
    }
  }

  deselectAll() {
    document.querySelectorAll(".scrapbook-element.selected").forEach(el => {
      el.classList.remove("selected");
      el.querySelector(".element-controls-overlay")?.remove();
    });
    this.activeElementId = null;
    this.selectedElementModel = null;
    this.clearInspectorBar();
  }

  populateInspectorBar() {
    const textInput = document.getElementById("inspectorTextInput");
    const fontSelect = document.getElementById("inspectorFontSelect");
    const sizeSelect = document.getElementById("inspectorFontSizeSelect");
    const colorInput = document.getElementById("inspectorColorInput");
    const textColorInput = document.getElementById("inspectorTextColorInput");

    if (!this.selectedElementModel) return;

    if (textInput) {
      textInput.value = this.selectedElementModel.type === "polaroid"
        ? (this.selectedElementModel.content.title || "")
        : (this.selectedElementModel.content.text || "");
      textInput.disabled = false;
    }

    if (fontSelect) {
      fontSelect.value = this.selectedElementModel.style?.font || "DM Sans";
      fontSelect.disabled = false;
    }

    if (sizeSelect) {
      const currentSize = Number(this.selectedElementModel.style?.size) || 18;
      const availableSizes = [...sizeSelect.options].map(option => Number(option.value)).filter(Number.isFinite);
      sizeSelect.value = String(availableSizes.reduce((closest, size) =>
        Math.abs(size - currentSize) < Math.abs(closest - currentSize) ? size : closest,
      availableSizes[0] || 18));
      sizeSelect.disabled = false;
    }

    const textAlignSelect = document.getElementById("inspectorTextAlignSelect");
    if (textAlignSelect) {
      const supportsAlignment = ["sticky", "text"].includes(this.selectedElementModel.type);
      textAlignSelect.value = this.selectedElementModel.style?.textAlign || "left";
      textAlignSelect.disabled = !supportsAlignment;
    }

    if (colorInput) {
      colorInput.value = this.selectedElementModel.style?.bgColor || "#fff9c4";
      colorInput.disabled = !["sticky", "music"].includes(this.selectedElementModel.type);
    }

    if (textColorInput) {
      const supportsTextColor = ["sticky", "text", "polaroid"].includes(this.selectedElementModel.type);
      textColorInput.value = this.selectedElementModel.style?.color ||
        (this.selectedElementModel.type === "sticky" ? "#332b00" : "#211711");
      textColorInput.disabled = !supportsTextColor;
    }
  }

  clearInspectorBar() {
    const textInput = document.getElementById("inspectorTextInput");
    const fontSelect = document.getElementById("inspectorFontSelect");
    const sizeSelect = document.getElementById("inspectorFontSizeSelect");
    const textAlignSelect = document.getElementById("inspectorTextAlignSelect");
    const colorInput = document.getElementById("inspectorColorInput");
    const textColorInput = document.getElementById("inspectorTextColorInput");

    if (textInput) { textInput.value = ""; textInput.disabled = true; }
    if (fontSelect) fontSelect.disabled = true;
    if (sizeSelect) sizeSelect.disabled = true;
    if (textAlignSelect) textAlignSelect.disabled = true;
    if (colorInput) colorInput.disabled = true;
    if (textColorInput) textColorInput.disabled = true;
  }

  updateDomForSelectedElement() {
    if (!this.activeElementId || !this.selectedElementModel) return;
    const domEl = document.getElementById(this.activeElementId);
    if (!domEl) return;

    const style = this.selectedElementModel.style || {};

    if (this.selectedElementModel.type === "polaroid") {
      const titleEl = domEl.querySelector(".polaroid-title-text");
      if (titleEl) {
        titleEl.innerText = this.selectedElementModel.content.title || "";
        if (style.font) titleEl.style.fontFamily = style.font;
        if (style.size) titleEl.style.fontSize = `${style.size}px`;
        if (style.color) titleEl.style.color = style.color;
      }
    } else if (this.selectedElementModel.type === "sticky") {
      const noteEl = domEl.querySelector(".sticky-note");
      const textEl = domEl.querySelector(".sticky-text-body");
      if (noteEl) {
        if (style.bgColor) noteEl.style.backgroundColor = style.bgColor;
        if (style.font) noteEl.style.fontFamily = style.font;
        if (style.size) noteEl.style.fontSize = `${style.size}px`;
        if (style.color) noteEl.style.color = style.color;
        noteEl.style.textAlign = style.textAlign || "left";
      }
      if (textEl) {
        textEl.textContent = this.selectedElementModel.content.text || "";
        textEl.style.textAlign = style.textAlign || "left";
      }
      this.fitTextToContent(domEl);
    } else if (this.selectedElementModel.type === "text") {
      domEl.style.fontFamily = style.font || "Cormorant Garamond";
      domEl.style.fontSize = `${style.size || 20}px`;
      const inner = domEl.querySelector(".scrapbook-plain-text");
      if (inner) {
        inner.textContent = this.selectedElementModel.content.text || "";
        inner.style.textAlign = style.textAlign || "left";
        if (style.color) inner.style.color = style.color;
      }
      this.fitTextToContent(domEl);
    } else if (this.selectedElementModel.type === "music") {
      const stickerEl = domEl.querySelector(".music-sticker");
      if (stickerEl && style.bgColor) stickerEl.style.backgroundColor = style.bgColor;
    }
  }

  fitTextToContent(domEl) {
    const model = this.selectedElementModel;
    const page = domEl.closest(".entry-scrapbook-page");
    if (!["sticky", "text"].includes(model?.type) || !page) return false;

    const box = model.type === "sticky"
      ? domEl.querySelector(".sticky-note")
      : domEl.querySelector(".scrapbook-plain-text");
    const text = model.type === "sticky" ? box?.querySelector(".sticky-text-body") : box;
    if (!box || !text) return false;

    const pageRect = page.getBoundingClientRect();
    if (!pageRect.height) return false;

    const availableHeight = Math.max(0, 100 - Number(model.y || 0));
    const previousHeight = Number(model.h) || 0;
    const boxStyle = getComputedStyle(box);
    const verticalPadding = model.type === "sticky"
      ? parseFloat(boxStyle.paddingTop) + parseFloat(boxStyle.paddingBottom)
      : 0;
    const requiredHeight = (text.scrollHeight + verticalPadding) / pageRect.height * 100;
    const nextHeight = Math.min(availableHeight, Math.max(previousHeight, requiredHeight));
    const changed = nextHeight > previousHeight + 0.1;

    model.h = nextHeight;
    domEl.style.height = `${nextHeight}%`;
    box.style.height = "100%";
    box.style.overflowY = requiredHeight > availableHeight ? "auto" : "hidden";
    box.style.overflowX = "hidden";
    return changed;
  }

  attachOverlayControls(el) {
    el.querySelector(".element-controls-overlay")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "element-controls-overlay";
    overlay.innerHTML = `
      <button type="button" class="ctrl-btn" title="Rotate left" data-act="rot-left">↶</button>
      <button type="button" class="ctrl-btn" title="Rotate right" data-act="rot-right">↷</button>
      <button type="button" class="ctrl-btn" title="Bring forward" data-act="z-up">▲</button>
      <button type="button" class="ctrl-btn" title="Send back" data-act="z-down">▼</button>
      <button type="button" class="ctrl-btn" title="Move to page..." data-act="move-page">📑</button>
      <button type="button" class="ctrl-btn" style="color: #ff7777;" title="Delete" data-act="del">&times;</button>
    `;

    overlay.querySelector("[data-act='rot-left']")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.rotateElement(el, -10);
    });

    overlay.querySelector("[data-act='rot-right']")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.rotateElement(el, 10);
    });

    overlay.querySelector("[data-act='z-up']")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const currentZ = parseInt(el.style.zIndex || 1, 10);
      el.style.zIndex = currentZ + 1;
      this.updateElementModel(el);
      this.debouncedSave();
    });

    overlay.querySelector("[data-act='z-down']")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const currentZ = parseInt(el.style.zIndex || 1, 10);
      el.style.zIndex = Math.max(1, currentZ - 1);
      this.updateElementModel(el);
      this.debouncedSave();
    });

    overlay.querySelector("[data-act='move-page']")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.promptMoveToPage(el);
    });

    overlay.querySelector("[data-act='del']")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.deleteElement(el);
    });

    el.appendChild(overlay);
  }

  rotateElement(el, delta) {
    const transform = el.style.transform || "";
    const match = transform.match(/rotate\(([-0-9.]+)deg\)/);
    const currentRot = match ? parseFloat(match[1]) : 0;
    const newRot = currentRot + delta;
    el.style.transform = `rotate(${newRot}deg)`;
    this.updateElementModel(el);
    const page = el.closest(".entry-scrapbook-page");
    const model = window.scrapbookViewer?.scrapbookData?.pages
      ?.find(item => item.id === page?.dataset.pageId)?.elements
      ?.find(item => item.id === el.dataset.elementId);
    if (page && model) window.scrapbookViewer?.clampRotatedElementToPage(page, model, el);
    this.debouncedSave();
  }

  deleteElement(el) {
    const id = el.dataset.elementId;
    const pageId = el.closest(".entry-scrapbook-page")?.dataset.pageId;
    if (pageId && window.scrapbookViewer?.scrapbookData?.pages) {
      const page = window.scrapbookViewer.scrapbookData.pages.find(p => p.id === pageId);
      if (page) {
        page.elements = (page.elements || []).filter(item => item.id !== id);
      }
    }
    el.remove();
    this.deselectAll();
    this.snapshot();
    this.debouncedSave();
    window.app.showToast("Element removed.");
  }

  // -------------------------------------------------------------------
  // 6 ESSENTIAL CAPABILITIES
  // -------------------------------------------------------------------

  // Capability 2: Transform Plain Sticker
  openPlainStickerModal(elModel) {
    let modal = document.getElementById("plainStickerModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "plainStickerModal";
      modal.className = "wizard-modal";
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="confirm-dialog" style="width: min(520px, 92vw);">
        <h3 style="font-family: var(--font-serif); font-size: 24px; color: var(--gold);">Plain Sticker Transformation</h3>
        <p style="font-size: 13px; color: var(--cream);">Choose what this plain sticker should become:</p>

        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 12px;">
          <button type="button" class="btn-secondary" id="transformToText">✏️ Handwritten Note / Quote</button>
          <button type="button" class="btn-secondary" id="transformToSticky">🟨 Yellow Sticky Note</button>
          <button type="button" class="btn-secondary" id="transformToMusic">🎵 Song Soundtrack Badge</button>
          <button type="button" class="btn-secondary" id="transformToSocial">📱 Social Embed (Instagram / TikTok)</button>
          <label class="btn-secondary" style="display: block; text-align: center; cursor: pointer;">
            🖼️ Upload Photo or Sticker
            <input type="file" id="plainStickerFileInput" accept="image/*" hidden>
          </label>
        </div>

        <div style="margin-top: 16px; text-align: right;">
          <button type="button" class="btn-secondary" onclick="document.getElementById('plainStickerModal').hidden = true;">Cancel</button>
        </div>
      </div>
    `;

    modal.querySelector("#transformToText")?.addEventListener("click", () => {
      const text = prompt("Enter text for this note:", "A quiet memory...");
      if (text) {
        elModel.type = "text";
        elModel.w = 38;
        elModel.h = 16;
        elModel.content = { text };
        elModel.style = { font: "Caveat", size: 20, color: "#211711" };
        this.commitPlainTransformation(modal, elModel);
      }
    });

    modal.querySelector("#transformToSticky")?.addEventListener("click", () => {
      const text = prompt("Write message on sticky note:", "Remember this moment...");
      if (text) {
        elModel.type = "sticky";
        elModel.w = 42;
        elModel.h = 28;
        elModel.content = { text };
        elModel.style = { font: "Caveat", size: 18, color: "#332b00", bgColor: "#fff9c4" };
        this.commitPlainTransformation(modal, elModel);
      }
    });

    modal.querySelector("#transformToMusic")?.addEventListener("click", () => {
      modal.hidden = true;
      this.openMusicLinkDialog((music) => {
        elModel.type = "music";
        elModel.w = 42;
        elModel.h = 12;
        elModel.content = music;
        this.commitPlainTransformation(modal, elModel);
      });
    });

    modal.querySelector("#transformToSocial")?.addEventListener("click", () => {
      const url = prompt("Paste Instagram or TikTok link (https://...):");
      if (url) {
        const isIg = url.includes("instagram.com");
        let embedUrl = "";
        if (isIg) {
          const match = url.match(/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/);
          if (match) embedUrl = `https://www.instagram.com/p/${match[1]}/embed`;
        } else {
          const match = url.match(/video\/(\d+)/);
          if (match) embedUrl = `https://www.tiktok.com/embed/v2/${match[1]}`;
        }
        elModel.type = "social";
        elModel.w = 45;
        elModel.h = 38;
        elModel.content = { platform: isIg ? "instagram" : "tiktok", url, embedUrl, caption: url };
        this.commitPlainTransformation(modal, elModel);
      }
    });

    modal.querySelector("#plainStickerFileInput")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (file) {
        const dataUrl = await Utils.compressImage(file);
        const [media] = await window.storageAdapter.uploadMedia([{
          name: file.name,
          type: "image",
          dataUrl
        }]);
        elModel.type = "polaroid";
        elModel.w = 42;
        elModel.h = 40;
        elModel.content = {
          photoUrl: media.pathOrDocId,
          mediaId: media.docId || media.id,
          title: file.name.split(".")[0]
        };
        this.commitPlainTransformation(modal, elModel);
      }
    });

    modal.hidden = false;
  }

  commitPlainTransformation(modal, elModel) {
    modal.hidden = true;
    elModel.x = Math.min(100 - elModel.w, Math.max(0, elModel.x));
    elModel.y = Math.min(100 - elModel.h, Math.max(0, elModel.y));
    window.scrapbookViewer.cleanContainerAndBuild();
    this.snapshot();
    this.debouncedSave();
    window.app.showToast("Sticker transformed!");
  }

  // Capability 3 & 4 & 6: Recolor Page, Font Choice & Resize Page Dimensions
  openPageCustomizer() {
    let modal = document.getElementById("pageCustomizerModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "pageCustomizerModal";
      modal.className = "wizard-modal";
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="page-customizer-modal" role="dialog" aria-modal="true" aria-labelledby="pageCustomizerTitle">
        <div style="display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid var(--line); padding-bottom: 10px;">
          <h3 id="pageCustomizerTitle" style="font-family: var(--font-serif); font-size: 22px; color: var(--gold);">Scrapbook Paper & Dimensions</h3>
          <button type="button" style="font-size: 20px; color: var(--muted);" onclick="document.getElementById('pageCustomizerModal').hidden = true;">&times;</button>
        </div>

        <div class="form-group">
          <label class="form-label">Paper Color / Tone:</label>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            ${[
              { name: "Cream Paper", color: "#f8f3e8" },
              { name: "Aged Parchment", color: "#f2e6d2" },
              { name: "Sage Green", color: "#e4ebe1" },
              { name: "Dusty Rose", color: "#faebeb" },
              { name: "Dark Walnut", color: "#2d2426" }
            ].map(p => `
              <button type="button" class="btn-secondary" style="background-color: ${p.color}; color: #000; font-size: 11px; padding: 6px 12px; border: 1px solid var(--line-strong);" onclick="window.scrapbookEditor.setPageColor('${p.color}')">
                ${p.name}
              </button>
            `).join("")}
            <label class="page-customizer-color" title="Choose a custom page color">
              <input type="color" id="customPageColorInput" value="#f8f3e8" aria-label="Custom page color">
              <span>Custom color</span>
            </label>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Default Page Font:</label>
          <select id="customizerFontSelect" class="form-select" style="background: #251b1b;">
            <option value="DM Sans">DM Sans (Clean Sans)</option>
            <option value="Cormorant Garamond">Cormorant Garamond (Editorial Serif)</option>
            <option value="Playfair Display">Playfair Display (Classic Elegant)</option>
            <option value="Caveat">Caveat (Handwritten Script)</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Page Height (Diary Mode):</label>
          <div class="page-height-options">
            <button type="button" class="btn-secondary" onclick="window.scrapbookEditor.setPageHeight(710)">Standard Book (710px)</button>
            <button type="button" class="btn-secondary" onclick="window.scrapbookEditor.setPageHeight(800)">Tall Journal (800px)</button>
            <button type="button" class="btn-secondary" onclick="window.scrapbookEditor.setPageHeight(920)">Long Diary (920px)</button>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; margin-top: 14px;">
          <button type="button" class="btn-primary" onclick="document.getElementById('pageCustomizerModal').hidden = true;">Done</button>
        </div>
      </div>
    `;

    modal.querySelector("#customizerFontSelect")?.addEventListener("change", (e) => {
      this.setPageFont(e.target.value);
    });
    modal.querySelector("#customPageColorInput")?.addEventListener("input", (e) => {
      this.setPageColor(e.target.value);
    });

    modal.hidden = false;
  }

  setPageColor(color) {
    (window.scrapbookViewer?.scrapbookData?.pages || []).forEach(p => {
      if (!p.paper) p.paper = {};
      p.paper.color = color;
    });
    document.querySelectorAll(".book-page").forEach(el => {
      el.style.backgroundColor = color;
    });
    this.debouncedSave();
    window.app.showToast(`Pages recolored to ${color}`);
  }

  setPageFont(font) {
    (window.scrapbookViewer?.scrapbookData?.pages || []).forEach(p => {
      if (!p.paper) p.paper = {};
      p.paper.font = font;
      (p.elements || []).forEach(el => {
        if (!el.style) el.style = {};
        el.style.font = font;
      });
    });
    window.scrapbookViewer.cleanContainerAndBuild();
    this.debouncedSave();
    window.app.showToast(`Typography set to ${font}`);
  }

  setPageHeight(height) {
    (window.scrapbookViewer?.scrapbookData?.pages || []).forEach(p => {
      if (!p.paper) p.paper = {};
      p.paper.height = height;
    });
    window.scrapbookViewer.cleanContainerAndBuild();
    this.debouncedSave();
    window.app.showToast(`Page layout adjusted to ${height}px height.`);
  }

  // Capability 5: Move Elements From One Page to Another
  promptMoveToPage(el) {
    const pages = window.scrapbookViewer?.scrapbookData?.pages || [];
    if (pages.length <= 1) {
      window.app.showToast("Only 1 page exists. Add more pages first.");
      return;
    }

    const currentPageId = el.closest(".entry-scrapbook-page")?.dataset.pageId;
    const targetIdx = prompt(`Move element to which page? (1 to ${pages.length})`);
    const pageNum = parseInt(targetIdx, 10);

    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= pages.length) {
      const targetPage = pages[pageNum - 1];
      const sourcePage = pages.find(p => p.id === currentPageId);

      if (sourcePage && targetPage && sourcePage !== targetPage) {
        const elId = el.dataset.elementId;
        const elModel = (sourcePage.elements || []).find(item => item.id === elId);
        if (elModel) {
          sourcePage.elements = sourcePage.elements.filter(item => item.id !== elId);
          if (!targetPage.elements) targetPage.elements = [];
          targetPage.elements.push(elModel);

          window.scrapbookViewer.cleanContainerAndBuild();
          window.scrapbookViewer.flipToPage(8 + pageNum - 1);
          this.snapshot();
          this.debouncedSave();
          window.app.showToast(`Moved element to Page ${pageNum}.`);
        }
      }
    }
  }

  // Cover Customizer Modal
  openCoverEditor() {
    let modal = document.getElementById("coverEditorModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "coverEditorModal";
      modal.className = "wizard-modal";
      document.body.appendChild(modal);
    }

    const cover = window.scrapbookViewer?.scrapbookData?.cover || {
      color: "#211711",
      texture: "leather",
      title: "My Memories"
    };

    modal.innerHTML = `
      <div class="confirm-dialog" style="width: min(520px, 94vw);">
        <h3 style="font-family: var(--font-serif); font-size: 24px; color: var(--gold);">Scrapbook Cover Customizer</h3>
        <p style="font-size: 13px; color: var(--cream);">Design the face of your scrapbook:</p>

        <div class="form-group" style="margin-top: 10px;">
          <label class="form-label">Cover Title:</label>
          <input type="text" id="coverTitleInput" class="form-input" value="${cover.title}">
        </div>

        <div class="form-group">
          <label class="form-label">Cover Color:</label>
          <div style="display: flex; gap: 8px;">
            <input type="color" id="coverColorInput" value="${cover.color}" style="width: 50px; height: 38px; border: none; cursor: pointer;">
            <span style="font-size: 13px; color: var(--muted); align-self: center;">Select leather tone</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Texture Finish:</label>
          <select id="coverTextureSelect" class="form-select" style="background: #251b1b;">
            <option value="leather" ${cover.texture === "leather" ? "selected" : ""}>Fine Leather</option>
            <option value="cloth" ${cover.texture === "cloth" ? "selected" : ""}>Woven Linen Cloth</option>
            <option value="aged" ${cover.texture === "aged" ? "selected" : ""}>Vintage Dark Spine</option>
          </select>
        </div>

        <div style="display: flex; justify-content: space-between; margin-top: 18px;">
          <button type="button" class="btn-secondary" onclick="document.getElementById('coverEditorModal').hidden = true;">Cancel</button>
          <button type="button" class="btn-primary" id="saveCoverSettingsBtn">💾 Apply to Cover</button>
        </div>
      </div>
    `;

    modal.querySelector("#saveCoverSettingsBtn")?.addEventListener("click", async () => {
      const title = modal.querySelector("#coverTitleInput")?.value.trim() || "My Memories";
      const color = modal.querySelector("#coverColorInput")?.value || "#211711";
      const texture = modal.querySelector("#coverTextureSelect")?.value || "leather";

      if (!window.scrapbookViewer.scrapbookData.cover) {
        window.scrapbookViewer.scrapbookData.cover = {};
      }
      window.scrapbookViewer.scrapbookData.cover.title = title;
      window.scrapbookViewer.scrapbookData.cover.color = color;
      window.scrapbookViewer.scrapbookData.cover.texture = texture;

      await window.storageAdapter.saveScrapbook(window.scrapbookViewer.scrapbookData);
      modal.hidden = true;
      window.app.refreshDashboard();
      window.app.showToast("Cover updated!");
    });

    modal.hidden = false;
  }

  openMusicLinkDialog(onSave, initial = {}) {
    let modal = document.getElementById("musicLinkModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "musicLinkModal";
      modal.className = "wizard-modal editor-dialog-backdrop";
      document.body.appendChild(modal);
    }
    modal.innerHTML = `
      <div class="confirm-dialog editor-input-dialog" id="musicLinkForm" role="dialog" aria-modal="true">
        <h3 class="editor-dialog-title">Choose Music</h3>
        <div class="music-provider-tabs">
          <button type="button" class="btn-secondary music-provider active" data-provider="youtube">YouTube</button>
          <button type="button" class="btn-secondary music-provider" data-provider="apple">Apple Music</button>
          <button type="button" class="btn-secondary music-provider" data-provider="custom">Other link</button>
        </div>
        <div id="musicCatalogSearch" class="form-group">
          <label class="form-label" for="musicCatalogTerm">Search track or artist</label>
          <div class="music-catalog-search-row">
            <input class="form-input" id="musicCatalogTerm" value="${this.escapeDialogValue(initial.title || "")}" placeholder="Track or artist">
            <button type="button" class="btn-secondary" id="musicCatalogSearchBtn">Search</button>
          </div>
          <div id="musicCatalogResults" class="music-catalog-results" aria-live="polite"></div>
          <div id="musicCatalogPreview" class="music-catalog-preview"></div>
        </div>
        <div id="customMusicFields" class="form-group" hidden>
          <label class="form-label">Song title</label><input class="form-input" id="customMusicTitle" maxlength="120" value="${this.escapeDialogValue(initial.title || "")}" placeholder="Song title">
          <label class="form-label">Artist</label><input class="form-input" id="customMusicArtist" maxlength="120" value="${this.escapeDialogValue(initial.artist || "")}" placeholder="Artist name">
          <label class="form-label">Music URL</label><input class="form-input" id="customMusicUrl" type="url" value="${this.escapeDialogValue(initial.link || "")}" placeholder="YouTube, Spotify, SoundCloud, or other link">
          <small class="music-selection-status">YouTube video links play in the scrapbook when embedding is allowed.</small>
        </div>
        <div class="confirm-actions">
          <button type="button" class="btn-secondary" data-cancel>Cancel</button>
          <button type="button" class="btn-primary" id="musicChoiceSaveBtn">Add music</button>
        </div>
      </div>`;
    let provider = "youtube";
    let selectedTrack = initial.title && initial.link ? initial : null;
    modal.querySelectorAll(".music-provider").forEach(button => {
      button.addEventListener("click", () => {
        provider = button.dataset.provider;
        modal.querySelectorAll(".music-provider").forEach(item => item.classList.toggle("active", item === button));
        modal.querySelector("#musicCatalogSearch").hidden = provider === "custom";
        modal.querySelector("#customMusicFields").hidden = provider !== "custom";
        selectedTrack = null;
        modal.querySelector("#musicCatalogPreview").replaceChildren();
        modal.querySelector("#musicCatalogResults").replaceChildren();
      });
    });
    modal.querySelector("#musicCatalogSearchBtn").addEventListener("click", async () => {
      const term = modal.querySelector("#musicCatalogTerm").value.trim();
      if (term.length < 2) {
        window.app?.showToast?.("Enter at least two characters to search.");
        return;
      }
      const resultsEl = modal.querySelector("#musicCatalogResults");
      resultsEl.textContent = "Searching...";
      try {
        const results = provider === "youtube"
          ? await window.storageAdapter.searchYoutube(term)
          : await window.storageAdapter.searchMusic(term);
        resultsEl.replaceChildren();
        if (!results.length) {
          resultsEl.textContent = provider === "youtube"
            ? "No YouTube results. Configure a YouTube API key or use Other link."
            : "No Apple Music results found.";
          return;
        }
        results.forEach(track => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "music-catalog-result";
          button.textContent = `${track.title} — ${track.artist}`;
          button.addEventListener("click", () => {
            selectedTrack = track;
            const preview = modal.querySelector("#musicCatalogPreview");
            preview.replaceChildren();
            if (track.previewUrl) {
              const audio = document.createElement("audio");
              audio.controls = true;
              audio.preload = "none";
              audio.src = track.previewUrl;
              preview.appendChild(audio);
            } else if (track.embedUrl || track.videoId) {
              const player = document.createElement("iframe");
              const videoId = track.videoId || track.id;
              player.src = track.embedUrl || `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`;
              player.title = `Play ${track.title}`;
              player.allow = "autoplay; encrypted-media; picture-in-picture";
              player.allowFullscreen = true;
              preview.appendChild(player);
            } else {
              const link = document.createElement("a");
              link.href = track.link;
              link.target = "_blank";
              link.rel = "noopener noreferrer";
              link.textContent = "Open track on its official service";
              preview.appendChild(link);
            }
          });
          resultsEl.appendChild(button);
        });
      } catch (error) {
        resultsEl.textContent = error.message || "Music search failed.";
      }
    });
    modal.querySelector("#musicChoiceSaveBtn").addEventListener("click", () => {
      if (provider === "custom") {
        const title = modal.querySelector("#customMusicTitle").value.trim();
        const artist = modal.querySelector("#customMusicArtist").value.trim();
        const link = modal.querySelector("#customMusicUrl").value.trim();
        try {
          const url = new URL(link);
          if (!["http:", "https:"].includes(url.protocol)) throw new Error();
        } catch {
          window.app?.showToast?.("Enter a valid https:// or http:// music link.");
          return;
        }
        selectedTrack = { title: title || "Soundtrack", artist, link, provider: "custom" };
      }
      if (!selectedTrack) {
        window.app?.showToast?.("Search for and select a track first.");
        return;
      }
      modal.hidden = true;
      onSave(selectedTrack);
    });
    modal.querySelector("[data-cancel]").addEventListener("click", () => { modal.hidden = true; });
    modal.hidden = false;
    modal.querySelector("#musicCatalogTerm").focus();
  }

  escapeDialogValue(value) {
    return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  updateElementModel(domEl) {
    const id = domEl.dataset.elementId;
    const pageId = domEl.closest(".entry-scrapbook-page")?.dataset.pageId;
    if (!pageId || !window.scrapbookViewer?.scrapbookData?.pages) return;

    const page = window.scrapbookViewer.scrapbookData.pages.find(p => p.id === pageId);
    if (!page) return;

    const elModel = (page.elements || []).find(e => e.id === id);
    if (!elModel) return;

    const x = parseFloat(domEl.style.left);
    const y = parseFloat(domEl.style.top);
    const width = parseFloat(domEl.style.width);
    const height = parseFloat(domEl.style.height);
    if (Number.isFinite(x)) elModel.x = x;
    if (Number.isFinite(y)) elModel.y = y;
    if (Number.isFinite(width)) elModel.w = width;
    if (Number.isFinite(height)) elModel.h = height;
    elModel.z = parseInt(domEl.style.zIndex, 10) || elModel.z;

    const transform = domEl.style.transform || "";
    const match = transform.match(/rotate\(([-0-9.]+)deg\)/);
    if (match) elModel.rotation = parseFloat(match[1]);
  }

  // -------------------------------------------------------------------
  // UNDO / REDO (30 STATES)
  // -------------------------------------------------------------------
  snapshot() {
    if (!window.scrapbookViewer?.scrapbookData) return;
    const stateCopy = JSON.parse(JSON.stringify(window.scrapbookViewer.scrapbookData));
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(stateCopy);
    if (this.history.length > this.maxHistory) this.history.shift();
    this.historyIndex = this.history.length - 1;
    this.updateUndoRedoButtons();
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex -= 1;
      window.scrapbookViewer.scrapbookData = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
      window.scrapbookViewer.cleanContainerAndBuild();
      this.updateUndoRedoButtons();
      this.debouncedSave();
      window.app.showToast("Undo.");
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex += 1;
      window.scrapbookViewer.scrapbookData = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
      window.scrapbookViewer.cleanContainerAndBuild();
      this.updateUndoRedoButtons();
      this.debouncedSave();
      window.app.showToast("Redo.");
    }
  }

  updateUndoRedoButtons() {
    const undoBtn = document.getElementById("editorUndoBtn");
    const redoBtn = document.getElementById("editorRedoBtn");
    if (undoBtn) undoBtn.disabled = this.historyIndex <= 0;
    if (redoBtn) redoBtn.disabled = this.historyIndex >= this.history.length - 1;
  }
}

window.ScrapbookEditor = ScrapbookEditor;
