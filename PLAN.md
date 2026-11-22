# MEMORIA v2: IMPLEMENTATION PLAN

## 1. Executive Summary & Architecture Overview
MEMORIA v2 is an editorial digital scrapbook and memory journaling web application. It completely overhauls the previous system into a self-contained application housed in `memoria-v2/` with zero runtime dependencies on the legacy codebase.

The application operates in a **Dual-Mode Architecture** behind a single unified interface (`storage-adapter.js`):
1. **Mode A (Local Server)**:
   - Full-featured Node.js / Express backend with SQLite (`better-sqlite3`).
   - Media uploaded directly to disk (`uploads/<userId>/`).
   - Server-side Groq AI endpoints (`POST /api/ai/followup`, `POST /api/ai/summary`) using `GROQ_API_KEY` from `.env`.
   - Server-side Apple Music catalog search via iTunes Search API with timeout and robust error handling.
   - Demo/local user authentication with separate user IDs.
2. **Mode B (Static / Firebase Spark)**:
   - Client-side static SPA deployable to GitHub Pages or Firebase Hosting (Spark free tier).
   - Firebase Auth (email/password) & Cloud Firestore for data and compressed photo documents (under 1 MiB per document).
   - Zero paid cloud resources (no Firebase Storage bucket or Blaze plan needed).
   - Automatic fallback to generic follow-up questions and client-side plain-text summaries if no protected server AI proxy is configured.

---

## 2. Folder Structure
```
memoria-v2/
├── .env.example              # Sample local environment variables
├── .gitignore                # Git ignore (node_modules, .env, uploads, *.sqlite)
├── .github/
│   └── workflows/
│       └── deploy.yml        # GitHub Pages automated build & deployment
├── firebase-config.js        # Public Firebase credentials (no secrets)
├── firebase.json             # Firebase Hosting configuration
├── firestore.rules           # Strict owner-scoped Firestore security rules
├── package.json              # Project scripts and backend dependencies
├── PLAN.md                   # This implementation plan
├── PROGRESS.md               # Tracking completed phases, untested items, known issues
├── README.md                 # Setup, running instructions, architecture, limits
├── server.js                 # Express backend, SQLite storage, Groq AI proxy, Music search
├── scripts/
│   └── build-static.js       # Prepares static bundle in dist/ for GitHub Pages / Firebase
├── test/
│   ├── api.test.js           # Tests for Express API, limits, drafts, tags, mood math
│   └── data-schema.test.js   # Tests schema normalization, validation, and seed stability
├── uploads/                  # Mode A local uploads directory (git ignored)
└── public/                   # Static client-side assets served by Express or static host
    ├── index.html            # Main single-page application entry point
    ├── assets/
    │   ├── wallpaper.png     # Ambient dark background texture
    │   └── paper-texture.png # Cream paper and binding textures
    ├── styles/
    │   ├── main.css          # Color variables, typography, modals, responsive resets
    │   ├── scrapbook.css     # Scrapbook cover, 2-page spread, rings, polaroid styling
    │   └── editor.css        # Canva-like sliding bottom toolbar, handles, element controls
    ├── js/
    │   ├── app.js            # UI state orchestrator, view transitions, notifications
    │   ├── create-memory.js  # Memory creation wizard (photo flow & simple text flow)
    │   ├── scrapbook-viewer.js # Book opening/zoom, two-page layout, categories, calendar, chapters
    │   ├── scrapbook-editor.js # Interactive drag/drop/resize/rotate, plain sticker, page customizer
    │   ├── storage-adapter.js# Unified interface switching between Mode A & Mode B
    │   ├── adapter-local.js  # Mode A API client implementation
    │   ├── adapter-firebase.js # Mode B Firebase Firestore & Auth implementation
    │   └── utils.js          # Mood calculations, EXIF parsing, seeded randoms, debouncing
    └── vendor/
        ├── page-flip.min.js  # StPageFlip / PageFlip library for realistic page turns
        └── interact.min.js   # Interact.js for fluid drag, resize, and rotation
```

---

## 3. Data Schema (Version 1)
All memory, scrapbook, tag, and draft data adheres to a single versioned JSON format (`schemaVersion: 1`):

```json
{
  "schemaVersion": 1,
  "user": {
    "id": "usr_default",
    "name": "Journalist",
    "settings": {
      "theme": "dark-editorial",
      "reducedMotion": false
    }
  },
  "entries": [
    {
      "id": "entry-1732270000000-abcd",
      "createdAt": "2026-11-22T14:55:00.000Z",
      "date": "2026-11-22",
      "time": "14:55",
      "mood": 4,
      "title": "Autumn Stroll",
      "description": "Walked through the park with warm coffee and gentle wind.",
      "followUpAnswers": [
        {
          "question": "What memorable moment caught your eye?",
          "answer": "Golden leaves falling across the stone path."
        }
      ],
      "tags": ["tag-nature", "tag-coffee"],
      "music": {
        "title": "Autumn Leaves",
        "artist": "Nat King Cole",
        "link": "https://music.apple.com/...",
        "provider": "apple"
      },
      "geolocation": {
        "lat": 43.2389,
        "lng": 76.8897,
        "label": "Central Park"
      },
      "filter": "warm",
      "media": [
        {
          "id": "media-1",
          "type": "image",
          "pathOrDocId": "/uploads/usr_default/photo-1.jpg",
          "title": "Golden trees",
          "order": 0
        }
      ]
    }
  ],
  "tags": [
    { "id": "tag-nature", "name": "Nature", "color": "#7cb342" },
    { "id": "tag-coffee", "name": "Coffee", "color": "#8d6e63" }
  ],
  "drafts": [
    {
      "id": "draft-1",
      "savedAt": "2026-11-22T14:50:00.000Z",
      "step": 2,
      "partialEntry": {
        "date": "2026-11-22",
        "time": "14:50",
        "mood": 5,
        "media": []
      }
    }
  ],
  "scrapbook": {
    "cover": {
      "color": "#211711",
      "texture": "leather",
      "title": "Memoria Scrapbook",
      "elements": []
    },
    "pages": [
      {
        "id": "page-overview-l",
        "kind": "main",
        "section": "overview",
        "side": "left",
        "paper": { "color": "#f2e6d2", "lining": "none", "width": 460, "height": 620 },
        "elements": []
      },
      {
        "id": "page-overview-r",
        "kind": "main",
        "section": "overview",
        "side": "right",
        "paper": { "color": "#f2e6d2", "lining": "none", "width": 460, "height": 620 },
        "elements": []
      },
      {
        "id": "page-entry-1",
        "kind": "entry",
        "section": "entries",
        "side": "left",
        "paper": { "color": "#f2e6d2", "lining": "ruled", "width": 460, "height": 620 },
        "elements": [
          {
            "id": "el-polaroid-1",
            "type": "polaroid",
            "entryId": "entry-1732270000000-abcd",
            "x": 40,
            "y": 50,
            "w": 240,
            "h": 300,
            "rotation": -2.5,
            "z": 1,
            "content": {
              "mediaId": "media-1",
              "title": "Autumn Stroll"
            },
            "style": { "font": "DM Sans", "size": 14, "color": "#211711" },
            "seed": 1042
          }
        ]
      }
    ],
    "chapters": [
      { "id": "ch-default", "name": "Memories 2026", "pageIds": ["page-entry-1"] }
    ],
    "theme": "editorial"
  }
}
```

### Key Optimization Rules
1. **Derivation at Read Time**: Mood averages, category groupings, monthly calendar aggregations, and search indexing are derived on demand rather than duplicated in storage.
2. **Stable Seeds for "Messy" Aesthetics**: Each element has a persistent random `seed` calculated upon creation, guaranteeing that rotations (-4° to +4°) and subtle tape/corner offsets look naturally messy without shifting on every page flip or reload.
3. **Decoupled Media References**: Entries store paths or document references rather than large inlined binary blobs in the main registry document.

---

## 4. Chosen Libraries & Dependencies
- **Backend (Mode A)**:
  - `express`: Lightweight web application server for routing and API endpoints.
  - `better-sqlite3`: High-performance, synchronous SQLite library for local persistence.
  - `dotenv`: Secure environment variable loader for `.env`.
- **Frontend & Scrapbook**:
  - `PageFlip` (StPageFlip): Battle-tested, realistic canvas/CSS 3D book page curl and flip engine. Supports dragging page corners, keyboard arrows, and square flip navigation buttons.
  - `interact.js`: Standard, smooth multi-touch drag, resize, and rotation library for the Canva-like editor.
- **External APIs**:
  - `Groq API` (`https://api.groq.com/openai/v1`): High-speed inference for conversational follow-up questions and mood-based reflective summaries (server-proxied only; never exposed client-side).
  - `iTunes Search API` (`itunes.apple.com/search`): Safe official music metadata lookup for song stickers.

---

## 5. Dual-Mode Storage Adapter Contract (`storage-adapter.js`)
Both local server execution and static serverless execution implement the exact same asynchronous interface:

```javascript
class StorageAdapter {
  async init(): Promise<void>;
  async getEntries(): Promise<Entry[]>;
  async saveEntry(entry: Entry): Promise<Entry>;
  async deleteEntry(id: string): Promise<boolean>;
  
  async getDrafts(): Promise<Draft[]>;
  async saveDraft(draft: Draft): Promise<Draft>;
  async deleteDraft(id: string): Promise<boolean>;
  
  async getTags(): Promise<Tag[]>;
  async saveTag(tag: Tag): Promise<Tag>;
  
  async getScrapbook(): Promise<Scrapbook>;
  async saveScrapbook(data: Scrapbook): Promise<Scrapbook>;
  
  async uploadMedia(files: FileList | File[]): Promise<MediaItem[]>;
  async searchMusic(term: string, country?: string): Promise<SongResult[]>;
  
  async getAiFollowups(promptText: string): Promise<string[]>;
  async getAiSummary(period: string, moodAverageLabel: string, entriesSummary: any[]): Promise<string>;
}
```

At application initialization:
- Checks `window.MEMORIA_FIREBASE_CONFIG`.
- If valid Firebase configuration keys are present, binds `adapter-firebase.js`.
- Otherwise, binds `adapter-local.js` targeting Express `/api/*`.

---

## 6. Implementation Phases (Strict Execution Order)

### Phase 1: Project Skeleton & Create a Memory Flow
- Set up `package.json`, `.env.example`, `.gitignore`, `server.js`, SQLite database schema.
- Implement `storage-adapter.js` with `adapter-local.js`.
- Build "Create a memory" full photo wizard (4 steps: media upload + camera capture, date/time/mood/filter, AI follow-ups, preview with Polaroid title/description/music/tags/geolocation).
- Build "Simple text entry" flow (2 steps: date/time/mood, title/desc/music/tags).
- Enforce limits: max 10 media uploads, max 5 drafts per user, prompt on tag omission.

### Phase 2: "View Memories" & Realistic Scrapbook Viewer
- Implement main menu "View memories" trigger, smooth eased zoom into the book.
- Integrate `PageFlip` for realistic 2-page spread and paper curls.
- Build Top Navbar: "Hide UI" reading mode, Pencil icon (Editor), "Exit".
- Implement Category 1: Overview page (left page: mood period dropdown + plain JS mood average + AI summary; right page: 5 action buttons).
- Implement Category: Recent (Polaroid + yellow sticky note + music sticker). Auto-place entries on pages. Entry popup preview.

### Phase 3: Categories, Search, Chapters, and All Entries
- Implement "Categories" page: Year columns + interactive 1st–31st monthly calendar with day photo badges; Mood spreads; Tag spreads.
- Implement "Search" category: search by Title, Music, Tag, Month, Year (omitting full description content).
- Implement "Chapters": organize pages into bookmarks/chapters, reorder, delete.
- Implement "All entries" gallery view.

### Phase 4: Canva-Style Scrapbook Editor Mode
- Slide-up bottom toolbar triggered by pencil icon or Overview gear.
- Palette: Polaroid, Text box, Yellow sticky note, Music sticker, Images/media, Shapes, Tape, Emoji stickers, Plain sticker.
- Drag-out from entry popup directly onto pages.
- 6 Essential capabilities:
  1. Resize any element
  2. Add any element through plain sticker
  3. Recolor pages
  4. Change fonts
  5. Move elements across pages
  6. Resize pages (diary format)
- Full undo/redo history (20+ states), rotate, z-index layering, debounced auto-save.
- Cover customizer modal (rightmost gear icon).

### Phase 5: Firebase Mode B Implementation (Serverless Spark)
- `adapter-firebase.js`: Firebase v13+ modular SDK for Auth and Firestore.
- Client-side image compression (Canvas WebP/JPEG) ensuring photo documents stay under 1 MiB.
- `firestore.rules`: Strict user-scoped authentication rules.
- `scripts/build-static.js`: Bundle generation in `dist/`.
- GitHub Pages deployment workflow `.github/workflows/deploy.yml`.
- Graceful fallbacks for AI and media in Mode B.

### Phase 6: Polish, Verification & Responsiveness
- Test layout at 360px, 768px, and 1280px viewport widths to prevent any clipping or overflow.
- Automated API and schema unit tests (`npm.cmd test`).
- Verification of empty states and friendly error messaging.
- Complete `README.md` and `PROGRESS.md`.

---

## 7. Risks and Mitigation Strategies
| Risk | Severity | Mitigation Strategy |
| :--- | :--- | :--- |
| **Firestore Document 1 MiB Cap in Mode B** | High | Client-side compression before write (`< 800 KB`), split scrapbook pages into child documents or individual sub-collections if total pages exceed threshold. |
| **Viewport Clipping on Mobile (360px)** | High | Use CSS container queries and flex/grid with scroll containers. Single-page flip layout on viewports < 768px; two-page spread on >= 768px. |
| **Editor Drag Clashing with Book Flip** | Medium | Disable PageFlip touch/pointer gesture listeners while Editor mode is active or an element is being dragged/resized. |
| **AI Groq API Downtime / Missing Keys** | Low | Fallback heuristic algorithms generate sensible follow-up questions and standard summaries automatically without interrupting user flow. |
