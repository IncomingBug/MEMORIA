// MEMORIA v2 - Application Orchestrator & View Controller
class MemoriaApp {
  constructor() {
    this.entries = [];
    this.tags = [];
    this.user = null;
    this.init();
  }

  async init() {
    try {
      if (window.storageAdapter) await window.storageAdapter.init();
    } catch (error) {
      this.renderFirebaseAuth(error.message);
      return;
    }

    if (window.storageAdapter?.auth && !window.storageAdapter.currentUser) {
      this.renderFirebaseAuth();
      return;
    }
    await this.startApplication();
  }

  async startApplication() {
    window.wizard = new window.CreateMemoryWizard();
    window.scrapbookViewer = new window.ScrapbookViewer();
    window.scrapbookEditor = new window.ScrapbookEditor();
    this.bindEvents();
    await this.refreshDashboard();
  }

  renderFirebaseAuth(initialError = "") {
    let panel = document.getElementById("firebaseAuthPanel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "firebaseAuthPanel";
      panel.className = "wizard-modal";
      panel.innerHTML = `
        <form class="confirm-dialog" style="width:min(440px,94vw)" id="firebaseAuthForm">
          <h2 style="font-family:var(--font-serif);color:var(--gold)">Your scrapbook account</h2>
          <p>Sign in or create an account to save and restore your memories.</p>
          <label class="form-group"><span class="form-label">Email</span><input class="form-input" name="email" type="email" autocomplete="email" required></label>
          <label class="form-group"><span class="form-label">Password</span><input class="form-input" name="password" type="password" autocomplete="current-password" minlength="6" required></label>
          <p id="firebaseAuthError" role="alert" style="color:#ffaaa0"></p>
          <div class="confirm-actions">
            <button type="submit" class="btn-primary" data-auth-action="signin">Sign in</button>
            <button type="submit" class="btn-secondary" data-auth-action="signup">Create account</button>
          </div>
        </form>`;
      document.body.appendChild(panel);
      const form = panel.querySelector("#firebaseAuthForm");
      form.addEventListener("click", event => {
        const submit = event.target.closest("[data-auth-action]");
        if (submit) form.dataset.action = submit.dataset.authAction;
      });
      form.addEventListener("submit", async event => {
        event.preventDefault();
        const fields = new FormData(form);
        const email = String(fields.get("email") || "").trim();
        const password = String(fields.get("password") || "");
        const errorEl = form.querySelector("#firebaseAuthError");
        const action = form.dataset.action || "signin";
        const buttons = [...form.querySelectorAll("button[type=submit]")];
        buttons.forEach(button => { button.disabled = true; });
        try {
          if (action === "signup") await window.storageAdapter.createAccount(email, password);
          else await window.storageAdapter.signIn(email, password);
          panel.remove();
          await this.startApplication();
        } catch (error) {
          errorEl.textContent = error.message || "Authentication failed.";
        } finally {
          buttons.forEach(button => { button.disabled = false; });
        }
      });
    }
    const errorEl = panel.querySelector("#firebaseAuthError");
    if (errorEl && initialError) {
      errorEl.textContent = `Firebase sign-in is unavailable. Enable Anonymous authentication or use an email account. ${initialError}`;
    } else if (errorEl) {
      errorEl.textContent = "Anonymous sign-in is disabled. Sign in with email or create an account.";
    }
    panel.hidden = false;
  }

  bindEvents() {
    // Home view action buttons
    document.getElementById("homeCreateMemoryBtn")?.addEventListener("click", () => {
      window.wizard.open("photo");
    });

    document.getElementById("homeViewMemoriesBtn")?.addEventListener("click", () => {
      window.scrapbookViewer.open();
    });

    document.getElementById("homeClosedBookCover")?.addEventListener("click", () => {
      window.scrapbookViewer.open();
    });

    document.getElementById("homeViewAllEntriesBtn")?.addEventListener("click", () => {
      this.openGalleryModal();
    });

    // Gallery modal close
    document.getElementById("galleryModalCloseBtn")?.addEventListener("click", () => {
      document.getElementById("galleryModal").hidden = true;
    });

    // Tag filter & search in gallery
    document.getElementById("gallerySearchInput")?.addEventListener("input", Utils.debounce(() => {
      this.renderGalleryGrid();
    }, 200));
  }

  async refreshDashboard() {
    try {
      [this.entries, this.tags] = await Promise.all([
        window.storageAdapter.getEntries(),
        window.storageAdapter.getTags()
      ]);

      const countEl = document.getElementById("homeMemoriesCount");
      if (countEl) countEl.innerText = `${this.entries.length} memories captured`;

      // Update closed book cover title if saved
      const bookData = await window.storageAdapter.getScrapbook();
      const coverTitleEl = document.getElementById("coverDisplayTitle");
      if (coverTitleEl && bookData.cover?.title) {
        coverTitleEl.innerText = bookData.cover.title;
      }
      const coverEl = document.getElementById("homeClosedBookCover");
      if (coverEl && bookData.cover?.color) {
        coverEl.style.backgroundColor = bookData.cover.color;
      }
    } catch (err) {
      console.warn("Dashboard refresh notice:", err);
    }
  }

  // -------------------------------------------------------------------
  // ALL ENTRIES GALLERY MODAL
  // -------------------------------------------------------------------
  async openGalleryModal() {
    const modal = document.getElementById("galleryModal");
    if (!modal) return;
    this.entries = await window.storageAdapter.getEntries();
    this.tags = await window.storageAdapter.getTags();

    // Render tag filter chips
    const tagFilterContainer = document.getElementById("galleryTagFilters");
    if (tagFilterContainer) {
      tagFilterContainer.innerHTML = `
        <span class="tag-badge selected" data-tag="" style="background: var(--gold); color: #000; cursor: pointer;">All</span>
        ${this.tags.map(t => `
          <span class="tag-badge" data-tag="${t.id}" style="background: ${t.color}; color: #fff; cursor: pointer;">${t.name}</span>
        `).join("")}
      `;
      tagFilterContainer.querySelectorAll(".tag-badge").forEach(badge => {
        badge.addEventListener("click", () => {
          tagFilterContainer.querySelectorAll(".tag-badge").forEach(b => b.classList.remove("selected"));
          badge.classList.add("selected");
          this.activeGalleryTag = badge.dataset.tag;
          this.renderGalleryGrid();
        });
      });
    }

    this.renderGalleryGrid();
    modal.hidden = false;
  }

  renderGalleryGrid() {
    const grid = document.getElementById("galleryGrid");
    const query = document.getElementById("gallerySearchInput")?.value.trim().toLowerCase() || "";
    if (!grid) return;

    let filtered = this.entries;
    if (this.activeGalleryTag) {
      filtered = filtered.filter(e => Array.isArray(e.tags) && e.tags.includes(this.activeGalleryTag));
    }
    if (query) {
      filtered = filtered.filter(e => {
        const titleMatch = (e.title || "").toLowerCase().includes(query);
        const descMatch = (e.description || "").toLowerCase().includes(query);
        return titleMatch || descMatch;
      });
    }

    if (filtered.length === 0) {
      grid.innerHTML = "<div style='grid-column: 1/-1; text-align: center; color: var(--muted); padding: 40px;'>No memories match your search.</div>";
      return;
    }

    grid.innerHTML = filtered.map(e => `
      <div class="polaroid-frame gallery-card" data-id="${e.id}" style="width: 100%;">
        ${e.media?.[0]?.pathOrDocId ? `
          <img src="${e.media[0].pathOrDocId}" class="polaroid-img" alt="Photo">
        ` : `
          <div style="aspect-ratio: 1; background: #2f2520; display: flex; align-items: center; justify-content: center; font-size: 32px;">📖</div>
        `}
        <div class="polaroid-title-text" style="color: #211711; font-size: 14px;">${e.title || Utils.formatDate(e.date)}</div>
      </div>
    `).join("");

    grid.querySelectorAll(".gallery-card").forEach(card => {
      card.addEventListener("click", () => {
        const entry = this.entries.find(item => item.id === card.dataset.id);
        if (entry) {
          window.scrapbookViewer.openEntryInspectionPopup(entry);
        }
      });
    });
  }

  // -------------------------------------------------------------------
  // UI TOASTS & CONFIRM DIALOGS
  // -------------------------------------------------------------------
  showToast(message, duration = 3000) {
    let toast = document.getElementById("appToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "appToast";
      toast.className = "toast";
      document.body.appendChild(toast);
    }
    toast.innerText = message;
    toast.hidden = false;
    toast.style.opacity = "1";

    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.hidden = true, 300);
    }, duration);
  }

  showConfirmDialog(message, actions = []) {
    let dialog = document.getElementById("appConfirmDialog");
    if (!dialog) {
      dialog = document.createElement("div");
      dialog.id = "appConfirmDialog";
      dialog.className = "confirm-dialog";
      document.body.appendChild(dialog);
    }

    dialog.innerHTML = `
      <p class="confirm-text">${message}</p>
      <div class="confirm-actions">
        ${actions.map((act, i) => `
          <button type="button" class="${act.primary ? 'btn-primary' : 'btn-secondary'}" data-index="${i}">
            ${act.label}
          </button>
        `).join("")}
      </div>
    `;

    dialog.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.index);
        dialog.hidden = true;
        if (actions[idx]?.action) actions[idx].action();
      });
    });

    dialog.hidden = false;
  }

  showCustomDialog(title, htmlContent, actions = []) {
    let dialog = document.getElementById("appCustomDialog");
    if (!dialog) {
      dialog = document.createElement("div");
      dialog.id = "appCustomDialog";
      dialog.className = "confirm-dialog";
      document.body.appendChild(dialog);
    }

    dialog.innerHTML = `
      <h3 style="font-family: var(--font-serif); font-size: 22px; color: var(--gold);">${title}</h3>
      <div style="margin: 14px 0; text-align: left;">${htmlContent}</div>
      <div class="confirm-actions">
        ${actions.map((act, i) => `
          <button type="button" class="${act.primary ? 'btn-primary' : 'btn-secondary'}" data-index="${i}">
            ${act.label}
          </button>
        `).join("")}
      </div>
    `;

    dialog.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.index);
        dialog.hidden = true;
        if (actions[idx]?.action) actions[idx].action();
      });
    });

    dialog.hidden = false;
  }

  closeCustomDialog() {
    const dialog = document.getElementById("appCustomDialog");
    if (dialog) dialog.hidden = true;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.app = new MemoriaApp();
});
