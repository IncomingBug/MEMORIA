// MEMORIA v2 - Memory Creation Wizard Controller
class CreateMemoryWizard {
  constructor() {
    this.modalEl = document.getElementById("createMemoryModal");
    this.flowType = "photo"; // "photo" or "text"
    this.currentStep = 1;
    this.draftId = null;

    // Entry state
    this.state = {
      date: new Date().toISOString().split("T")[0],
      time: new Date().toTimeString().slice(0, 5),
      mood: 4,
      media: [], // array of { id, type, dataUrl, name, title }
      currentMediaIndex: 0,
      filter: "none",
      dayText: "",
      followUpQuestions: [],
      followUpAnswers: [],
      title: "",
      folderTitle: "",
      description: "",
      musicAtmosphere: "warm",
      music: {},
      geolocation: {},
      tags: []
    };

    this.availableTags = [];
    this.init();
  }

  async init() {
    this.bindEvents();
  }

  bindEvents() {
    // Nav bar buttons
    document.getElementById("wizardCloseBtn")?.addEventListener("click", () => {
      this.toggleDropdown("wizardCloseDropdown");
    });

    document.getElementById("saveDraftBtn")?.addEventListener("click", () => {
      this.saveCurrentDraft();
    });

    document.getElementById("discardDraftBtn")?.addEventListener("click", () => {
      this.close();
    });

    document.getElementById("wizardSkipBtn")?.addEventListener("click", () => {
      this.skipCurrentStep();
    });

    document.getElementById("startFromDraftBtn")?.addEventListener("click", () => {
      this.openDraftsManager();
    });

    // Close dropdown on outside click
    document.addEventListener("click", (e) => {
      const dropdown = document.getElementById("wizardCloseDropdown");
      const btn = document.getElementById("wizardCloseBtn");
      if (dropdown && !dropdown.contains(e.target) && !btn?.contains(e.target)) {
        dropdown.hidden = true;
      }
    });
  }

  toggleDropdown(id) {
    const el = document.getElementById(id);
    if (el) el.hidden = !el.hidden;
  }

  storageErrorMessage(error, operation) {
    const permissionDenied = error?.code === "permission-denied" ||
      /missing or insufficient permissions/i.test(error?.message || "");
    if (permissionDenied) {
      return `Firestore denied permission while ${operation}. Publish firestore.rules to the Firebase project configured in firebase-config.js, then try again.`;
    }
    return `Couldn't ${operation}: ${error?.message || String(error)}`;
  }

  async open(flowType = "photo", resumeDraft = null) {
    this.flowType = flowType;
    this.currentStep = 1;
    this.draftId = resumeDraft ? resumeDraft.id : null;
    this.tagLoadError = null;

    if (resumeDraft) {
      this.state = { ...this.state, ...(resumeDraft.partialEntry || {}) };
      this.currentStep = resumeDraft.step || 1;
    } else {
      this.resetState();
    }

    const loadErrors = [];
    try {
      this.availableTags = await window.storageAdapter.getTags();
    } catch (error) {
      this.availableTags = [];
      this.tagLoadError = error;
      loadErrors.push(this.storageErrorMessage(error, "loading your tags"));
    }

    try {
      const drafts = await window.storageAdapter.getDrafts();
      const draftNavBtn = document.getElementById("startFromDraftBtn");
      if (draftNavBtn) {
        draftNavBtn.hidden = drafts.length === 0;
      }
    } catch (error) {
      loadErrors.push(this.storageErrorMessage(error, "loading your drafts"));
    }
    if (loadErrors.length) {
      window.app.showToast(loadErrors.join(" "));
    }

    this.render();
    if (this.modalEl) this.modalEl.hidden = false;
  }

  close() {
    if (this.modalEl) this.modalEl.hidden = true;
    this.resetState();
  }

  resetState() {
    this.flowType = "photo";
    this.currentStep = 1;
    this.draftId = null;
    this.state = {
      date: new Date().toISOString().split("T")[0],
      time: new Date().toTimeString().slice(0, 5),
      mood: 4,
      media: [],
      currentMediaIndex: 0,
      filter: "none",
      dayText: "",
      followUpQuestions: [],
      followUpAnswers: [],
      title: "",
      folderTitle: "",
      description: "",
      musicAtmosphere: "warm",
      music: {},
      geolocation: {},
      tags: []
    };
  }

  render() {
    const container = document.getElementById("wizardStepContainer");
    if (!container) return;

    const skipButton = document.getElementById("wizardSkipBtn");
    if (skipButton) {
      const finalStep = (this.flowType === "photo" && this.currentStep === 4) ||
        (this.flowType === "text" && this.currentStep === 2);
      skipButton.textContent = finalStep
        ? "Save memory"
        : this.flowType === "photo" && this.currentStep === 3
          ? "Skip questions →"
          : "Skip →";
    }

    if (this.flowType === "photo") {
      this.renderPhotoFlow(container);
    } else {
      this.renderSimpleTextFlow(container);
    }
  }

  // -------------------------------------------------------------------
  // FULL PHOTO FLOW (4 WINDOWS)
  // -------------------------------------------------------------------
  renderPhotoFlow(container) {
    if (this.currentStep === 1) {
      container.innerHTML = `
        <div class="wizard-step-card">
          <h2 class="wizard-step-title">Capture the Moment</h2>
          <p class="wizard-step-subtitle">Upload up to 10 photos, videos, or GIFs, or take a picture with your camera.</p>

          <div class="upload-action-box">
            <label class="upload-button-large">
              <span>📁 Choose a photo/file (up to 10)</span>
              <input type="file" id="wizardFileInput" accept="image/*,video/*,image/gif" multiple hidden>
            </label>

            <label class="upload-button-large">
              <span>📷 Or take a photo</span>
              <input type="file" id="wizardCameraInput" accept="image/*" capture="environment" hidden>
            </label>

            <span class="file-count-badge" id="selectedFileBadge">
              ${this.state.media.length > 0 ? `${this.state.media.length} files selected` : ""}
            </span>
          </div>

          <div style="text-align: center; margin-top: 10px; border-top: 1px solid var(--line); padding-top: 16px;">
            <button type="button" class="btn-secondary" id="switchToTextEntryBtn">
              ✏️ Make a simple text entry
            </button>
          </div>

          ${this.state.media.length > 0 ? `
            <div style="display: flex; justify-content: flex-end; margin-top: 10px;">
              <button type="button" class="btn-primary" id="step1NextBtn">Next &rarr;</button>
            </div>
          ` : ""}
        </div>
      `;

      document.getElementById("wizardFileInput")?.addEventListener("change", (e) => this.handleFiles(e.target.files));
      document.getElementById("wizardCameraInput")?.addEventListener("change", (e) => this.handleFiles(e.target.files));
      document.getElementById("switchToTextEntryBtn")?.addEventListener("click", () => {
        this.flowType = "text";
        this.currentStep = 1;
        this.render();
      });
      document.getElementById("step1NextBtn")?.addEventListener("click", () => {
        this.currentStep = 2;
        this.render();
      });

    } else if (this.currentStep === 2) {
      const activeMedia = this.state.media[this.state.currentMediaIndex] || this.state.media[0] || {};
      container.innerHTML = `
        <div class="wizard-step-card">
          <h2 class="wizard-step-title">Date, Mood & Atmosphere</h2>

          <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
            <div class="polaroid-frame" style="width: min(280px, 80vw); transform: rotate(-1deg); filter: ${this.getCssFilter(this.state.filter)};">
              ${activeMedia.type === "video" ? `
                <video src="${activeMedia.dataUrl}" style="width: 100%; aspect-ratio: 1; object-fit: cover;" controls></video>
              ` : `
                <img src="${activeMedia.dataUrl}" class="polaroid-img" alt="Captured memory">
              `}
              <div class="polaroid-title-text">${activeMedia.title || "Untitled moment"}</div>
            </div>

            ${this.state.media.length > 1 ? `
              <div style="display: flex; gap: 8px; overflow-x: auto; max-width: 100%; padding: 4px;">
                ${this.state.media.map((m, idx) => `
                  <button type="button" class="btn-secondary" style="padding: 4px 8px; font-size: 11px; ${this.state.currentMediaIndex === idx ? "border-color: var(--gold);" : ""}" onclick="window.wizard.setMediaIndex(${idx})">
                    Photo ${idx + 1}
                  </button>
                `).join("")}
              </div>
            ` : ""}
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div class="form-group">
              <label class="form-label" for="entryDateInput">Date</label>
              <input type="date" id="entryDateInput" class="form-input" value="${this.state.date}">
            </div>
            <div class="form-group">
              <label class="form-label" for="entryTimeInput">Time</label>
              <input type="time" id="entryTimeInput" class="form-input" value="${this.state.time}">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Mood of the day</label>
            <div class="mood-picker">
              ${[5, 4, 3, 2, 1].map(m => `
                <button type="button" class="mood-btn ${this.state.mood === m ? "selected" : ""}" data-mood="${m}" title="${Utils.moodEmojis[m].label}">
                  ${Utils.moodEmojis[m].emoji}
                </button>
              `).join("")}
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Add a filter? <span style="font-size: 11px; opacity: 0.7;">(Experimental)</span></label>
            <div class="filter-selector">
              ${["none", "warm", "vintage", "bw", "faded", "dramatic"].map(f => `
                <button type="button" class="filter-chip ${this.state.filter === f ? "active" : ""}" data-filter="${f}">
                  ${f.toUpperCase()}
                </button>
              `).join("")}
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; margin-top: 12px;">
            <button type="button" class="btn-secondary" id="step2BackBtn">&larr; Back</button>
            <button type="button" class="btn-primary" id="step2NextBtn">Next &rarr;</button>
          </div>
        </div>
      `;

      document.getElementById("entryDateInput")?.addEventListener("change", (e) => this.state.date = e.target.value);
      document.getElementById("entryTimeInput")?.addEventListener("change", (e) => this.state.time = e.target.value);
      container.querySelectorAll(".mood-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          this.state.mood = Number(btn.dataset.mood);
          this.render();
        });
      });
      container.querySelectorAll(".filter-chip").forEach(btn => {
        btn.addEventListener("click", () => {
          this.state.filter = btn.dataset.filter;
          this.render();
        });
      });
      document.getElementById("step2BackBtn")?.addEventListener("click", () => {
        this.currentStep = 1;
        this.render();
      });
      document.getElementById("step2NextBtn")?.addEventListener("click", () => {
        this.currentStep = 3;
        this.render();
      });

    } else if (this.currentStep === 3) {
      container.innerHTML = `
        <div class="wizard-step-card">
          <h2 class="wizard-step-title">Tell Me About the Day</h2>
          <p class="wizard-step-subtitle">What made today memorable? An AI companion will offer gentle follow-up questions to help you recall sensory and emotional details.</p>

          <div class="form-group">
            <textarea id="dayTextInput" class="form-textarea" placeholder="Today was my birthday and we had cake in the garden...">${this.state.dayText}</textarea>
          </div>

          <div style="display: flex; justify-content: flex-end;">
            <button type="button" class="btn-secondary" id="triggerAiQuestionsBtn">
              ✨ Ask me more questions
            </button>
          </div>

          <div id="aiQuestionsWrapper" class="ai-questions-container" ${this.state.followUpQuestions.length ? "" : "hidden"}>
            <div style="font-weight: 600; font-size: 13px; color: var(--gold); letter-spacing: 1px;">FOLLOW-UP REFLECTIONS:</div>
            ${this.state.followUpQuestions.map((q, idx) => `
              <div class="ai-question-item">
                <div class="ai-question-text">"${q}"</div>
                <input type="text" class="form-input follow-up-answer-input" data-index="${idx}" placeholder="Optional answer..." value="${this.state.followUpAnswers[idx]?.answer || ""}">
              </div>
            `).join("")}
          </div>

          <div style="display: flex; justify-content: space-between; margin-top: 16px;">
            <button type="button" class="btn-secondary" id="step3BackBtn">&larr; Back</button>
            <button type="button" class="btn-primary" id="step3NextBtn">Preview Memory &rarr;</button>
          </div>
        </div>
      `;

      const dayInput = document.getElementById("dayTextInput");
      dayInput?.addEventListener("input", (e) => {
        this.state.dayText = e.target.value;
      });

      document.getElementById("triggerAiQuestionsBtn")?.addEventListener("click", async () => {
        const text = this.state.dayText.trim();
        if (!text) {
          window.app.showToast("Please write a few words about the day first.");
          return;
        }
        window.app.showToast("Gathering thoughtful questions...");
        const questions = await window.storageAdapter.getAiFollowups(text);
        this.state.followUpQuestions = questions;
        this.render();
      });

      container.querySelectorAll(".follow-up-answer-input").forEach(input => {
        input.addEventListener("input", (e) => {
          const idx = Number(e.target.dataset.index);
          const q = this.state.followUpQuestions[idx];
          this.state.followUpAnswers[idx] = { question: q, answer: e.target.value };
        });
      });

      document.getElementById("step3BackBtn")?.addEventListener("click", () => {
        this.currentStep = 2;
        this.render();
      });

      document.getElementById("step3NextBtn")?.addEventListener("click", () => {
        this.state.description = Utils.composeMemoryDescription(
          this.state.dayText,
          this.state.followUpAnswers,
          this.state.description
        );
        this.currentStep = 4;
        this.render();
      });

    } else if (this.currentStep === 4) {
      // Preview Window (Left Polaroid with Title input, Right Context menu)
      const activeMedia = this.state.media[this.state.currentMediaIndex] || this.state.media[0] || {};
      container.innerHTML = `
        <div class="wizard-step-card" style="width: min(880px, 100%);">
          <h2 class="wizard-step-title">Memory Preview</h2>

          <div class="preview-layout">
            <!-- Left: Polaroid with Title input -->
            <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
              <div class="polaroid-frame" style="width: min(320px, 100%); filter: ${this.getCssFilter(this.state.filter)};">
                ${activeMedia.type === "video" ? `
                  <video src="${activeMedia.dataUrl}" style="width: 100%; aspect-ratio: 1; object-fit: cover;" controls></video>
                ` : `
                  <img src="${activeMedia.dataUrl}" class="polaroid-img" alt="Memory photo">
                `}
                <div style="position: absolute; bottom: 4px; left: 8px; right: 8px;">
                  <input type="text" id="previewTitleInput" class="form-input" style="font-family: var(--font-script); font-size: 18px; text-align: center; background: transparent; border: none; border-bottom: 1px dashed #c0b0a0; color: #211711;" placeholder="Caption this photo..." value="${activeMedia.title || ""}">
                </div>
              </div>

              ${this.state.media.length > 1 ? `
                <div style="display: flex; gap: 6px; flex-wrap: wrap; justify-content: center;">
                  ${this.state.media.map((m, idx) => `
                    <button type="button" class="btn-secondary" style="font-size: 11px; padding: 3px 8px; ${this.state.currentMediaIndex === idx ? "border-color: var(--gold);" : ""}" onclick="window.wizard.setMediaIndex(${idx})">
                      ${idx + 1}: ${m.title || "Photo"}
                    </button>
                  `).join("")}
                </div>
              ` : ""}
            </div>

            <!-- Right: Context Controls -->
            <div style="display: flex; flex-direction: column; gap: 16px;">
              <div class="form-group">
                <label class="form-label" for="memoryFolderTitleInput">Day folder title</label>
                <input type="text" id="memoryFolderTitleInput" class="form-input" maxlength="80" placeholder="A short title will be suggested from your story">
                <small style="color: var(--muted);">Leave blank to create a title from your description.</small>
              </div>

              <div class="form-group">
                <label class="form-label" for="previewDescInput">Description</label>
                <textarea id="previewDescInput" class="form-textarea" style="min-height: 90px;">${this.state.description}</textarea>
              </div>

              <!-- Music Search & Selection with YouTube, Apple Music or Custom Link -->
              <div class="form-group">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <label class="form-label" style="margin: 0;">Music Soundtrack</label>
                  <div style="display: flex; gap: 4px;">
                    <button type="button" class="btn-secondary music-source-btn active" data-src="youtube" style="font-size: 11px; padding: 2px 8px; border-color: var(--gold);">YouTube</button>
                    <button type="button" class="btn-secondary music-source-btn" data-src="apple" style="font-size: 11px; padding: 2px 8px;">Apple</button>
                    <button type="button" class="btn-secondary music-source-btn" data-src="custom" style="font-size: 11px; padding: 2px 8px;">Link</button>
                  </div>
                </div>

                <div id="musicSearchBox" style="display: flex; gap: 8px;">
                  <input type="text" id="musicSearchInput" class="form-input" placeholder="Search song or artist on YouTube..." value="${this.state.music.title ? `${this.state.music.title} - ${this.state.music.artist || ""}` : ""}">
                  <button type="button" class="btn-secondary" id="searchMusicBtn">Search</button>
                </div>

                <div id="customMusicBox" style="display: none; flex-direction: column; gap: 6px; margin-top: 6px;">
                  <input type="text" id="customSongTitle" class="form-input" placeholder="Song title...">
                  <input type="text" id="customSongArtist" class="form-input" placeholder="Artist name...">
                  <input type="url" id="customSongUrl" class="form-input" placeholder="Web link (Spotify, SoundCloud, etc.)...">
                  <button type="button" class="btn-primary" id="saveCustomSongBtn" style="padding: 4px 10px; font-size: 12px; align-self: flex-start;">Attach Link</button>
                </div>

                <div id="musicSearchResults" style="display: flex; flex-direction: column; gap: 4px; max-height: 140px; overflow-y: auto; margin-top: 6px;"></div>
              </div>

              <div class="form-group">
                <label class="form-label" for="musicAtmosphereSelect">What does the song feel like?</label>
                <select id="musicAtmosphereSelect" class="form-select">
                  <option value="quiet">Quiet and spacious</option>
                  <option value="warm">Warm and nostalgic</option>
                  <option value="bright">Bright and playful</option>
                  <option value="dreamy">Dreamy and soft</option>
                  <option value="restless">Restless and energetic</option>
                </select>
                <small style="color: var(--muted);">This choice shapes the page's color, type, and composition.</small>
              </div>

              <!-- Geolocation -->
              <div class="form-group">
                <label class="form-label">Geolocation <span style="font-size: 11px; opacity: 0.7;">(Experimental)</span></label>
                <input type="text" id="geolocationInput" class="form-input" placeholder="Place name or location tag..." value="${this.state.geolocation.label || ""}">
              </div>

              <!-- Tags -->
              <div class="form-group">
                <div style="display: flex; justify-content: space-between; align-items: baseline;">
                  <label class="form-label">Tags</label>
                  <button type="button" style="font-size: 12px; color: var(--gold);" id="createTagModalBtn">+ Create a tag</button>
                </div>
                <div class="tags-chip-row" id="tagsSelectionRow">
                  ${this.availableTags.map(t => {
                    const isSelected = this.state.tags.includes(t.id);
                    return `
                      <span class="tag-badge ${isSelected ? "selected" : ""}" style="background-color: ${t.color}; color: #fff;" data-id="${t.id}">
                        ${isSelected ? "✓" : "+"} ${t.name}
                      </span>
                    `;
                  }).join("")}
                </div>
              </div>

              <!-- Inline Tag Creator Box (Hidden by default) -->
              <div id="inlineTagCreator" style="background: rgba(0,0,0,0.4); padding: 10px; border: 1px dashed var(--line-strong);" hidden>
                <div style="font-size: 12px; color: var(--gold); margin-bottom: 6px;">Create a new tag:</div>
                <div style="display: flex; gap: 8px;">
                  <input type="text" id="newTagNameInput" class="form-input" placeholder="Tag name (e.g. Gaming)...">
                  <input type="color" id="newTagColorInput" value="#d5ad70" style="width: 40px; height: 38px; border: none; cursor: pointer;">
                  <button type="button" class="btn-primary" id="saveNewTagBtn">Save</button>
                </div>
              </div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; margin-top: 20px; border-top: 1px solid var(--line); padding-top: 16px;">
            <button type="button" class="btn-secondary" id="step4BackBtn">&larr; Back</button>
            <button type="button" class="btn-primary" id="saveMemoryFinalBtn">💾 Save Memory</button>
          </div>
        </div>
      `;

      // Event handlers for Preview Step
      const titleInput = document.getElementById("previewTitleInput");
      titleInput?.addEventListener("input", (e) => {
        const val = e.target.value;
        if (this.state.media[this.state.currentMediaIndex]) {
          this.state.media[this.state.currentMediaIndex].title = val;
        }
      });

      const folderTitleInput = document.getElementById("memoryFolderTitleInput");
      if (folderTitleInput) {
        folderTitleInput.value = this.state.folderTitle;
        folderTitleInput.placeholder = Utils.generateMemoryTitle(this.state.description, this.state.date);
        folderTitleInput.addEventListener("input", event => {
          this.state.folderTitle = event.target.value;
        });
      }

      const descInput = document.getElementById("previewDescInput");
      descInput?.addEventListener("input", (e) => this.state.description = e.target.value);

      const musicAtmosphereSelect = document.getElementById("musicAtmosphereSelect");
      if (musicAtmosphereSelect) {
        musicAtmosphereSelect.value = this.state.musicAtmosphere;
        musicAtmosphereSelect.addEventListener("change", event => {
          this.state.musicAtmosphere = event.target.value;
        });
      }

      const geoInput = document.getElementById("geolocationInput");
      geoInput?.addEventListener("input", (e) => this.state.geolocation.label = e.target.value);

      // Music Source Toggle & Search
      let activeMusicSource = "youtube";
      container.querySelectorAll(".music-source-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          container.querySelectorAll(".music-source-btn").forEach(b => {
            b.classList.remove("active");
            b.style.borderColor = "var(--line)";
          });
          btn.classList.add("active");
          btn.style.borderColor = "var(--gold)";
          activeMusicSource = btn.dataset.src;

          const searchBox = document.getElementById("musicSearchBox");
          const customBox = document.getElementById("customMusicBox");
          const searchInput = document.getElementById("musicSearchInput");
          if (activeMusicSource === "custom") {
            if (searchBox) searchBox.style.display = "none";
            if (customBox) customBox.style.display = "flex";
          } else {
            if (searchBox) searchBox.style.display = "flex";
            if (customBox) customBox.style.display = "none";
            if (searchInput) {
              searchInput.placeholder = activeMusicSource === "youtube" ? "Search song or artist on YouTube..." : "Search song or artist on Apple Music...";
            }
          }
        });
      });

      document.getElementById("searchMusicBtn")?.addEventListener("click", async () => {
        const term = document.getElementById("musicSearchInput")?.value.trim();
        if (!term) return;
        const resContainer = document.getElementById("musicSearchResults");
        if (!resContainer) return;
        resContainer.innerHTML = `<div style='font-size: 12px; color: var(--muted);'>Searching ${activeMusicSource === "youtube" ? "YouTube" : "Apple Music"}...</div>`;
        try {
          const results = activeMusicSource === "youtube"
            ? await window.storageAdapter.searchYoutube(term)
            : await window.storageAdapter.searchMusic(term);

          if (results.length === 0) {
            resContainer.innerHTML = "<div style='font-size: 12px; color: var(--muted);'>No tracks found.</div>";
            return;
          }
          resContainer.innerHTML = results.map((track, i) => `
            <div class="music-search-item" data-index="${i}" style="display: flex; justify-content: space-between; align-items: center; padding: 6px; background: rgba(255,255,255,0.06); font-size: 12px; cursor: pointer; border-radius: 2px;">
              <span>${track.provider === 'youtube' ? '▶' : '🎵'} <strong>${track.title}</strong> - ${track.artist}</span>
              <span style="color: var(--gold);">&plus; Select</span>
            </div>
          `).join("");

          resContainer.querySelectorAll(".music-search-item").forEach(item => {
            item.addEventListener("click", () => {
              const track = results[Number(item.dataset.index)];
              this.state.music = track;
              const input = document.getElementById("musicSearchInput");
              if (input) input.value = `${track.title} - ${track.artist}`;
              resContainer.innerHTML = "";
            });
          });
        } catch (err) {
          resContainer.innerHTML = `<div style='font-size: 12px; color: #ff8888;'>${err.message}</div>`;
        }
      });

      document.getElementById("saveCustomSongBtn")?.addEventListener("click", () => {
        const title = document.getElementById("customSongTitle")?.value.trim() || "Soundtrack";
        const artist = document.getElementById("customSongArtist")?.value.trim() || "";
        const link = document.getElementById("customSongUrl")?.value.trim() || "#";
        this.state.music = { title, artist, link, provider: "custom" };
        window.app.showToast(`Music linked: ${title}`);
        const input = document.getElementById("musicSearchInput");
        if (input) input.value = `${title} - ${artist}`;
      });

      // Tag selection toggles
      container.querySelectorAll(".tag-badge").forEach(badge => {
        badge.addEventListener("click", () => {
          const tagId = badge.dataset.id;
          if (this.state.tags.includes(tagId)) {
            this.state.tags = this.state.tags.filter(id => id !== tagId);
          } else {
            this.state.tags.push(tagId);
          }
          this.render();
        });
      });

      // Inline Tag Creator toggler
      document.getElementById("createTagModalBtn")?.addEventListener("click", () => {
        const box = document.getElementById("inlineTagCreator");
        if (box) box.hidden = !box.hidden;
      });

      document.getElementById("saveNewTagBtn")?.addEventListener("click", async () => {
        const nameInput = document.getElementById("newTagNameInput");
        const colorInput = document.getElementById("newTagColorInput");
        const name = nameInput?.value.trim();
        const color = colorInput?.value || "#d5ad70";
        if (!name) return;

        try {
          const newTag = await window.storageAdapter.saveTag({ name, color });
          this.availableTags.push(newTag);
          this.state.tags.push(newTag.id);
          this.render();
        } catch (err) {
          window.app.showToast(this.storageErrorMessage(err, "saving the tag"));
        }
      });

      document.getElementById("step4BackBtn")?.addEventListener("click", () => {
        this.currentStep = 3;
        this.render();
      });

      document.getElementById("saveMemoryFinalBtn")?.addEventListener("click", () => {
        this.attemptFinalSave();
      });
    }
  }

  // -------------------------------------------------------------------
  // SIMPLE TEXT ENTRY FLOW (2 WINDOWS)
  // -------------------------------------------------------------------
  renderSimpleTextFlow(container) {
    if (this.currentStep === 1) {
      container.innerHTML = `
        <div class="wizard-step-card">
          <h2 class="wizard-step-title">Simple Text Entry</h2>
          <p class="wizard-step-subtitle">How are we feeling today?</p>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div class="form-group">
              <label class="form-label" for="simpleDateInput">Date</label>
              <input type="date" id="simpleDateInput" class="form-input" value="${this.state.date}">
            </div>
            <div class="form-group">
              <label class="form-label" for="simpleTimeInput">Time</label>
              <input type="time" id="simpleTimeInput" class="form-input" value="${this.state.time}">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">How are we feeling?</label>
            <div class="mood-picker">
              ${[5, 4, 3, 2, 1].map(m => `
                <button type="button" class="mood-btn ${this.state.mood === m ? "selected" : ""}" data-mood="${m}" title="${Utils.moodEmojis[m].label}">
                  ${Utils.moodEmojis[m].emoji}
                </button>
              `).join("")}
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; margin-top: 16px;">
            <button type="button" class="btn-secondary" id="simpleSwitchToPhotoBtn">📷 Photo Flow</button>
            <button type="button" class="btn-primary" id="simpleStep1NextBtn">Next &rarr;</button>
          </div>
        </div>
      `;

      document.getElementById("simpleDateInput")?.addEventListener("change", (e) => this.state.date = e.target.value);
      document.getElementById("simpleTimeInput")?.addEventListener("change", (e) => this.state.time = e.target.value);
      container.querySelectorAll(".mood-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          this.state.mood = Number(btn.dataset.mood);
          this.render();
        });
      });
      document.getElementById("simpleSwitchToPhotoBtn")?.addEventListener("click", () => {
        this.flowType = "photo";
        this.currentStep = 1;
        this.render();
      });
      document.getElementById("simpleStep1NextBtn")?.addEventListener("click", () => {
        this.currentStep = 2;
        this.render();
      });

    } else if (this.currentStep === 2) {
      container.innerHTML = `
        <div class="wizard-step-card">
          <h2 class="wizard-step-title">Write Your Thoughts</h2>

          <div class="form-group">
            <label class="form-label" for="simpleTitleInput">Title (optional)</label>
            <input type="text" id="simpleTitleInput" class="form-input" placeholder="Give this reflection a title..." value="${this.state.title}">
          </div>

          <div class="form-group">
            <label class="form-label" for="simpleDescInput">Description</label>
            <textarea id="simpleDescInput" class="form-textarea" placeholder="Dear journal..." style="min-height: 120px;">${this.state.description}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Music (optional)</label>
            <div style="display: flex; gap: 8px;">
              <input type="text" id="simpleMusicInput" class="form-input" placeholder="Search song or artist..." value="${this.state.music.title ? `${this.state.music.title} - ${this.state.music.artist || ""}` : ""}">
              <button type="button" class="btn-secondary" id="simpleMusicSearchBtn">Search</button>
            </div>
            <div id="simpleMusicResults" style="display: flex; flex-direction: column; gap: 4px; max-height: 100px; overflow-y: auto; margin-top: 6px;"></div>
          </div>

          <div class="form-group">
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <label class="form-label">Tags</label>
              <button type="button" style="font-size: 12px; color: var(--gold);" id="simpleCreateTagBtn">+ Create a tag</button>
            </div>
            <div class="tags-chip-row">
              ${this.availableTags.map(t => {
                const isSelected = this.state.tags.includes(t.id);
                return `
                  <span class="tag-badge ${isSelected ? "selected" : ""}" style="background-color: ${t.color}; color: #fff;" data-id="${t.id}">
                    ${isSelected ? "✓" : "+"} ${t.name}
                  </span>
                `;
              }).join("")}
            </div>
          </div>

          <!-- Inline Tag Creator Box -->
          <div id="simpleInlineTagCreator" style="background: rgba(0,0,0,0.4); padding: 10px; border: 1px dashed var(--line-strong);" hidden>
            <div style="font-size: 12px; color: var(--gold); margin-bottom: 6px;">Create a new tag:</div>
            <div style="display: flex; gap: 8px;">
              <input type="text" id="simpleNewTagName" class="form-input" placeholder="Tag name...">
              <input type="color" id="simpleNewTagColor" value="#d5ad70" style="width: 40px; height: 38px; border: none; cursor: pointer;">
              <button type="button" class="btn-primary" id="simpleSaveNewTagBtn">Save</button>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; margin-top: 18px; border-top: 1px solid var(--line); padding-top: 14px;">
            <button type="button" class="btn-secondary" id="simpleStep2BackBtn">&larr; Back</button>
            <button type="button" class="btn-primary" id="simpleSaveMemoryBtn">💾 Save Memory</button>
          </div>
        </div>
      `;

      document.getElementById("simpleTitleInput")?.addEventListener("input", (e) => this.state.title = e.target.value);
      document.getElementById("simpleDescInput")?.addEventListener("input", (e) => this.state.description = e.target.value);

      document.getElementById("simpleMusicSearchBtn")?.addEventListener("click", async () => {
        const term = document.getElementById("simpleMusicInput")?.value.trim();
        if (!term) return;
        const resEl = document.getElementById("simpleMusicResults");
        if (!resEl) return;
        resEl.innerHTML = "<div style='font-size: 12px; color: var(--muted);'>Searching...</div>";
        try {
          const results = await window.storageAdapter.searchMusic(term);
          resEl.innerHTML = results.map((t, idx) => `
            <div class="music-search-item" data-index="${idx}" style="padding: 4px; font-size: 12px; background: rgba(255,255,255,0.05); cursor: pointer;">
              🎵 ${t.title} - ${t.artist}
            </div>
          `).join("");
          resEl.querySelectorAll(".music-search-item").forEach(item => {
            item.addEventListener("click", () => {
              const track = results[Number(item.dataset.index)];
              this.state.music = track;
              document.getElementById("simpleMusicInput").value = `${track.title} - ${track.artist}`;
              resEl.innerHTML = "";
            });
          });
        } catch (e) {
          resEl.innerHTML = `<div style='font-size: 12px; color: #ff8888;'>${e.message}</div>`;
        }
      });

      container.querySelectorAll(".tag-badge").forEach(badge => {
        badge.addEventListener("click", () => {
          const tagId = badge.dataset.id;
          if (this.state.tags.includes(tagId)) {
            this.state.tags = this.state.tags.filter(id => id !== tagId);
          } else {
            this.state.tags.push(tagId);
          }
          this.render();
        });
      });

      document.getElementById("simpleCreateTagBtn")?.addEventListener("click", () => {
        const box = document.getElementById("simpleInlineTagCreator");
        if (box) box.hidden = !box.hidden;
      });

      document.getElementById("simpleSaveNewTagBtn")?.addEventListener("click", async () => {
        const name = document.getElementById("simpleNewTagName")?.value.trim();
        const color = document.getElementById("simpleNewTagColor")?.value || "#d5ad70";
        if (!name) return;
        try {
          const newTag = await window.storageAdapter.saveTag({ name, color });
          this.availableTags.push(newTag);
          this.state.tags.push(newTag.id);
          this.render();
        } catch (e) {
          window.app.showToast(this.storageErrorMessage(e, "saving the tag"));
        }
      });

      document.getElementById("simpleStep2BackBtn")?.addEventListener("click", () => {
        this.currentStep = 1;
        this.render();
      });

      document.getElementById("simpleSaveMemoryBtn")?.addEventListener("click", () => {
        this.attemptFinalSave();
      });
    }
  }

  setMediaIndex(idx) {
    this.state.currentMediaIndex = idx;
    this.render();
  }

  getCssFilter(filterName) {
    switch (filterName) {
      case "warm": return "sepia(0.3) saturate(1.3) contrast(1.05)";
      case "vintage": return "sepia(0.55) contrast(0.9) brightness(0.95)";
      case "bw": return "grayscale(1) contrast(1.2)";
      case "faded": return "contrast(0.85) brightness(1.1) saturate(0.8)";
      case "dramatic": return "contrast(1.4) saturate(1.2) brightness(0.9)";
      default: return "none";
    }
  }

  async handleFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    if (this.state.media.length + files.length > 10) {
      window.app.showToast("Maximum 10 files allowed per entry.");
      return;
    }

    window.app.showToast("Processing media files...");
    for (const file of files) {
      try {
        const isVideo = file.type.startsWith("video/");
        const isGif = file.type.includes("gif");
        let dataUrl;

        if (isVideo) {
          dataUrl = await Utils.fileToDataUrl(file);
        } else if (isGif) {
          dataUrl = await Utils.fileToDataUrl(file);
        } else {
          // Compress image client side
          dataUrl = await Utils.compressImage(file);
          // Check for EXIF metadata
          const exif = await Utils.readExif(file);
          if (exif && !this.state.geolocation.label) {
            this.state.geolocation = exif;
          }
        }

        this.state.media.push({
          id: `media-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          type: isVideo ? "video" : (isGif ? "gif" : "image"),
          dataUrl,
          name: file.name,
          title: ""
        });
      } catch (err) {
        console.error("File processing error:", err);
      }
    }

    this.render();
  }

  skipCurrentStep() {
    if (this.flowType === "photo") {
      if (this.currentStep === 3) {
        this.state.description = Utils.composeMemoryDescription(
          this.state.dayText,
          this.state.followUpAnswers,
          this.state.description
        );
        this.currentStep = 4;
        this.render();
      } else if (this.currentStep === 4) {
        this.attemptFinalSave();
      } else if (this.currentStep < 4) {
        this.currentStep += 1;
        this.render();
      }
    } else {
      if (this.currentStep === 1) {
        this.currentStep = 2;
        this.render();
      } else if (this.currentStep === 2) {
        this.attemptFinalSave();
      }
    }
  }

  async saveCurrentDraft() {
    try {
      const draftPayload = {
        id: this.draftId || `draft-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        step: this.currentStep,
        partialEntry: {
          flowType: this.flowType,
          ...this.state
        }
      };

      const saved = await window.storageAdapter.saveDraft(draftPayload);
      this.draftId = saved.id;
      window.app.showToast("Draft saved successfully!");
      const dropdown = document.getElementById("wizardCloseDropdown");
      if (dropdown) dropdown.hidden = true;
      this.close();
      window.app.refreshDashboard();
    } catch (err) {
      window.app.showConfirmDialog(
        this.storageErrorMessage(err, "saving this draft"),
        [{ label: "OK", primary: true, action: () => {} }]
      );
    }
  }

  async openDraftsManager() {
    try {
      const drafts = await window.storageAdapter.getDrafts();
      if (drafts.length === 0) {
        window.app.showToast("No saved drafts found.");
        return;
      }

      let contentHtml = `
        <div style="font-size: 14px; margin-bottom: 12px; color: var(--gold);">Saved Drafts (${drafts.length}/5):</div>
        <div style="display: flex; flex-direction: column; gap: 8px; max-height: 260px; overflow-y: auto;">
          ${drafts.map((d, i) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(255,255,255,0.06); border: 1px solid var(--line);">
              <div>
                <div style="font-weight: 600; font-size: 13px;">${d.partialEntry?.title || "Untitled Draft"} (Step ${d.step})</div>
                <div style="font-size: 11px; color: var(--muted);">${new Date(d.savedAt).toLocaleString()}</div>
              </div>
              <div style="display: flex; gap: 6px;">
                <button type="button" class="btn-primary" style="padding: 4px 10px; font-size: 11px;" onclick="window.wizard.resumeDraftById('${d.id}')">Resume</button>
                <button type="button" class="btn-secondary" style="padding: 4px 10px; font-size: 11px; color: #ff8888;" onclick="window.wizard.deleteDraftById('${d.id}')">Delete</button>
              </div>
            </div>
          `).join("")}
        </div>
      `;

      window.app.showCustomDialog("Start from a Draft", contentHtml, [
        { label: "Cancel", action: () => {} }
      ]);
    } catch (err) {
      window.app.showToast("Failed to fetch drafts: " + err.message);
    }
  }

  async resumeDraftById(id) {
    try {
      const drafts = await window.storageAdapter.getDrafts();
      const draft = drafts.find(d => d.id === id);
      if (draft) {
        window.app.closeCustomDialog();
        this.open(draft.partialEntry?.flowType || "photo", draft);
      }
    } catch (err) {
      window.app.showToast("Failed to resume draft: " + err.message);
    }
  }

  async deleteDraftById(id) {
    try {
      await window.storageAdapter.deleteDraft(id);
      window.app.showToast("Draft deleted.");
      window.app.closeCustomDialog();
      const drafts = await window.storageAdapter.getDrafts();
      const draftNavBtn = document.getElementById("startFromDraftBtn");
      if (draftNavBtn) draftNavBtn.hidden = drafts.length === 0;
    } catch (err) {
      window.app.showToast("Failed to delete draft: " + err.message);
    }
  }

  // Final Save with Tag Warning check
  async attemptFinalSave() {
    if (this.state.tags.length === 0) {
      const message = this.tagLoadError
        ? `${this.storageErrorMessage(this.tagLoadError, "loading your tags")} You can still try saving without a tag.`
        : "You sure you don't want to add any tag? Tags help find entries easier";
      window.app.showConfirmDialog(
        message,
        [
          { label: "Add a tag", primary: false, action: () => {} },
          { label: "Save anyway", primary: true, action: () => this.performSave() }
        ]
      );
      return;
    }
    await this.performSave();
  }

  async performSave() {
    const description = String(this.state.description || "");
    if (this.flowType === "photo") {
      if (!description.trim()) {
        window.app.showToast("Write a few words about the day before saving.");
        return;
      }
      if (!this.state.media.some(item => item.type === "image" || item.type === "gif")) {
        window.app.showToast("Add at least one photo to the day's memory.");
        return;
      }
      let musicUrl;
      try {
        musicUrl = new URL(this.state.music.link);
      } catch {
        window.app.showToast("Choose a song or add a valid music link.");
        return;
      }
      if (!this.state.music.title || !["http:", "https:"].includes(musicUrl.protocol)) {
        window.app.showToast("Choose a song or add a valid music link.");
        return;
      }
    }

    window.app.showToast("Saving memory...");

    let saveStage = "saving the memory";
    let savedEntry = null;
    try {
      // 1. Upload media if present
      let uploadedMedia = [];
      if (this.state.media.length > 0) {
        saveStage = "uploading its photos";
        uploadedMedia = await window.storageAdapter.uploadMedia(this.state.media);
      }

      // 2. Build final entry payload
      const entryPayload = {
        date: this.state.date,
        time: this.state.time,
        mood: this.state.mood,
        title: String(this.state.folderTitle || "").trim() || String(this.state.title || "").trim() || Utils.generateMemoryTitle(description, this.state.date),
        description,
        followUpAnswers: this.state.followUpAnswers.filter(a => a && a.answer),
        tags: this.state.tags,
        music: { ...this.state.music, atmosphere: this.state.musicAtmosphere },
        geolocation: this.state.geolocation,
        filter: this.state.filter,
        media: uploadedMedia
      };

      saveStage = "saving the memory entry";
      savedEntry = await window.storageAdapter.saveEntry(entryPayload);

      // 3. Auto-place entry onto the scrapbook
      saveStage = "saving its scrapbook page";
      await window.scrapbookViewer.autoPlaceEntry(savedEntry);

      // 4. Clean up draft if this was resumed
      if (this.draftId) {
        await window.storageAdapter.deleteDraft(this.draftId).catch(() => {});
      }

      window.app.showToast("Memory saved to your scrapbook!");
      this.close();
      window.app.refreshDashboard();
    } catch (err) {
      const permissionDenied = err?.code === "permission-denied" ||
        /missing or insufficient permissions/i.test(err?.message || "");
      const detail = permissionDenied
        ? `Firestore denied permission while ${saveStage}. Publish firestore.rules to the same Firebase project and confirm you're signed in.`
        : err.message;
      if (savedEntry) {
        window.app.showToast(`Memory saved, but its scrapbook page could not be saved: ${detail}`);
        this.close();
        window.app.refreshDashboard();
        return;
      }
      window.app.showToast("Save failed: " + detail);
    }
  }
}

window.CreateMemoryWizard = CreateMemoryWizard;
