# MEMORIA v2

> *Every day is a work of art.*  
> A bespoke digital scrapbook and memory journaling web application designed with warm, dark editorial elegance, realistic paper page turning, and authentic "messy" personal scrapbook aesthetics.

---

## 1. Architecture Overview: Dual-Mode Architecture

MEMORIA v2 runs in **two execution modes** behind a unified client storage abstraction (`storage-adapter.js`):

### Mode A: Full Local Server (Express + SQLite)
- **Runtime:** Node.js + Express 5 with embedded SQLite (`better-sqlite3`).
- **Media Storage:** Stored directly on disk under `uploads/<userId>/`.
- **AI Integration:** Server-side proxy for Groq API (`POST /api/ai/followup`, `POST /api/ai/summary`) using `GROQ_API_KEY`. Never exposes secrets to browser clients. Falls back intelligently to built-in conversational heuristics if no key is present.
- **Music Search:** Server-side proxy to official iTunes / Apple Music catalog with timeout protection.
- **Persistence:** Local SQLite database file (`memoria.sqlite`).

### Mode B: Serverless Static Single-Page App (GitHub Pages / Firebase Spark)
- **Runtime:** Completely static frontend build without requiring an Express server.
- **Authentication & Database:** Firebase Auth (Email/Password or Anonymous) + Cloud Firestore directly from the browser using the Firebase v13+ modular SDK.
- **Zero Cost / No Blaze Required:** Complies with the free Firebase Spark plan: photos are compressed on the client into WebP/JPEG under 850 KB and stored in individual Firestore photo documents.
- **Fallbacks:** Automatically uses intelligent local follow-up questions, client-side reflections, and official music links when running serverless.
- **Authentication setup:** Enable Anonymous Authentication in Firebase Authentication for automatic demo sign-in, or use the email/password sign-in and account creation form.
- **AI:** Static hosting does not expose a Groq key. Configure `window.MEMORIA_AI_ENDPOINT_URL` to a protected AI proxy; otherwise the documented fallback is used.
- **Before sharing:** Enable Email/Password in Firebase Authentication, or enable Anonymous for one-click demo access. Deploy `firestore.rules` to the configured Firebase project before inviting testers.
- Authentication and Firestore authorization are separate. On GitHub Pages, publish the rules manually in Firebase Console under **Firestore Database → Rules**; the Pages workflow only deploys the website.

---

## 2. Quickstart & How to Run

### Running in Mode A (Local Server)

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Configure environment variables (optional):**
   ```bash
   cp .env.example .env
   ```
   *(Optionally specify `PORT=3000` and `GROQ_API_KEY=...` for Groq AI reflections).*
3. **Start the local server:**
   ```bash
   npm start
   ```
4. **Open in browser:**
   ```
   http://localhost:3000
   ```
   Localhost uses the Express/SQLite adapter even when Firebase web configuration is present, so the local Groq proxy works. To test Firebase Auth locally, set `window.MEMORIA_FORCE_FIREBASE = true` in `public/firebase-config.js`.

### Running Tests
Execute the unit and integration test suite:
```bash
npm test
```
*Covers Express endpoints, tag creation, draft limits, upload size restrictions, mood calculation heuristics, seed stability, and time filtering.*

### Building and Deploying Mode B (Static / GitHub Pages / Firebase)

1. **Generate the static bundle:**
   ```bash
   npm run build:static
   ```
   *Creates a standalone static distribution in `dist/` with `.nojekyll`.*
2. **Configure Firebase for cloud saves:**
   Edit the root `firebase-config.js` with your Firebase web-app configuration:
   ```javascript
   window.MEMORIA_FIREBASE_CONFIG = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT.firebaseapp.com",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_PROJECT.appspot.com",
     appId: "YOUR_APP_ID"
   };
   ```
3. **Deploy to Firebase Hosting:**
   ```bash
   firebase deploy --only hosting,firestore:rules
   ```
   *For GitHub Pages, set the repository's Pages source to **GitHub Actions**, then push to `main` to trigger `.github/workflows/deploy.yml`. The workflow deploys the static site; deploy Firestore rules separately with `firebase deploy --only firestore:rules`.*

---

## 3. Data Schema (Version 1)

All application state conforms to a single versioned JSON structure (`schemaVersion: 1`):

- **`user`**: `{ id, name, settings }`
- **`entries[]`**:
  - `id`: Unique string identifier
  - `createdAt`, `date`, `time`
  - `mood`: 1 (Awful), 2 (Sad), 3 (Neutral), 4 (Happy), 5 (Very Happy)
  - `title`, `description`
  - `followUpAnswers[]`: `[{ question, answer }]`
  - `tags[]`: Array of tag IDs
  - `music`: `{ title, artist, link, provider, atmosphere }`
  - `geolocation`: `{ lat, lng, label }`
  - `filter`: CSS filter name (`none`, `warm`, `vintage`, `bw`, `faded`, `dramatic`)
  - `media[]`: `[{ id, type, pathOrDocId, title, order }]`
- **`tags[]`**: `{ id, name, color }`
- **`drafts[]`** *(Max 5)*: `{ id, savedAt, step, partialEntry }`
- **`scrapbook`**:
  - `cover`: `{ color, texture, title, elements[] }`
  - `pages[]`: `{ id, kind, section, atmosphere, paper: { color, lining, width, height }, elements[] }`
  - `chapters[]`: `{ id, name, pageIds[], entryId? }`
  - `theme`: Editorial design theme string
- **`element`**:
  - `{ id, type, x, y, w, h, rotation, z, content, style, seed }`
  - **Seed Guarantee:** Every element preserves its initial random `seed`, ensuring deterministic and persistent "messy" angles (-4° to +4°) that never jitter across turns or reloads.

---

## 4. Feature Highlights

### 🌟 "Create a Memory" Wizard
- **Full Photo Flow (4 Guided Windows):**
  1. *Capture / Choose:* Multi-upload up to 10 files (photos, videos, GIFs) or take a photo with the camera. Option to switch to Simple Text Entry.
  2. *Atmosphere:* Centered photo with Date (default today), Time (default current), 5-mood emoji picker, and experimental CSS filters (warm, vintage, black & white, faded, dramatic).
  3. *Reflections:* "Tell me about the day" input. Integrates Groq AI to suggest thoughtful follow-up questions one at a time (e.g., sensory details, who was there). Optional answers merge directly into the description.
  4. *Preview:* Left Polaroid with editable title; right context menu with description, Apple Music / YouTube search, EXIF GPS reader, and tag picker.
- **Simple Text Entry Flow (2 Windows):**
  1. Date, time, and 5-tier mood picker.
  2. Title (optional), description, music, tags, and save.
- **Drafts Management:**
  - Nav bar with "Save draft" and "Discard".
  - If drafts exist, "Start from a draft?" appears on the nav bar.
  - Hard limit of **5 drafts per user**. Attempting a 6th draft produces a polite notification to finish or delete an existing draft.
- **Inline Tag Creation:**
  - Create custom tags on the fly with custom colors.
  - Missing tag warning: *"You sure you don't want to add any tag? Tags help find entries easier"* with one-click confirmation.

### 📖 "View Memories" Digital Scrapbook
- **Realistic Open-Book Spread:**
  - Always opens to a **two-page spread** with realistic paper curl, shadows, and smooth easing zoom.
  - Powered by StPageFlip with touch swipe, corner dragging, and square `<` / `>` edge buttons.
  - Flipping back from the Overview closes the book back to the home view.
- **Top Navbar:**
  - `Hide UI`: Immersive distraction-free reading mode.
  - `Editor Mode`: Toggles the sliding Canva-like editor.
  - `Exit`: Closes the book and returns to the home view.
- **Built-in Categories:**
  1. **Overview:**
     - Left page: Heading with editor gear icon, "Mood for" dropdown (`today`, `the past week`, `the past month`, `the past year`), exact arithmetic mean calculation in plain JS (`>=4.5` Great, `>=3.5` Good, `>=2.5` Not bad, `>=1.5` Not that bad, else Awful), and Groq reflective summary.
     - Right page: Table of contents action buttons (`Recent ->`, `Categories ->`, `Search ->`, `Chapters ->`, `All entries ->`).
  2. **Recent:**
     - Shows the latest entry arranged as a Polaroid, yellow sticky note (description), and rectangular music sticker.
     - Clicking any Polaroid opens a blurred, left-side inspection panel showing every attached photo. Dragging a photo or item opens Editor Mode automatically and lets you place it on the scrapbook.
  3. **Categories:**
     - *Year & Calendar:* Scrollable year columns with months. Clicking a month displays an interactive 1st–31st calendar with latest photo badges on days with memories.
     - *Mood:* Dedicated two-page spreads for each mood with "Locate in scrapbook" functionality.
     - *Tags:* Row-by-row tagged photos across flippable pages.
  4. **Search:**
     - Filtered query by Title, Music, Tag, Month, or Year without heavy description scanning.
  5. **Chapters:**
     - Create, reorder, bookmark, or remove chapters and organized page groupings.
  6. **All Entries Gallery:**
     - Chronological grid archive with live text search and tag filters.

### 🎨 Canva-Style Scrapbook Editor
- Sliding bottom tray activated by the pencil button or Overview gear.
- Droppable onto entry/diary pages (category pages remain protected).
- **Element Palette:** Polaroid frames, text boxes, yellow sticky notes, music stickers, media, washi tape, and the **Plain Sticker** (click to transform into notes, quotes, music, or photo uploads). Polaroids use saved memory photos rather than empty placeholders.
- **The 6 Core Capabilities:**
  1. **Resize Any Element:** A corner handle resizes within the page; element position and size scale with the page.
  2. **Add through Plain Sticker:** Empty sticker transforms on demand.
  3. **Recolor Pages:** Select from cream paper, aged parchment, sage green, dusty rose, or dark velvet.
  4. **Change Fonts:** Cormorant Garamond, DM Sans, Playfair Display, Caveat script.
  5. **Move Elements Across Pages:** Move items across pages via menu or edge dragging.
  6. **Resize Page Itself:** Expand page dimensions to 760px or 880px for long-form diary entries.
- **Sticky Notes:** Long text wraps and expands the note to fit within the page where possible; use the inspector's Text align control for left, centered, right, or justified text. A circular handle rotates selected elements by dragging around them.
- **Page Turning:** A paper-colored, opaque outer edge rail is reserved for page turns. Regular element geometry is inset from it, and rotated elements are repositioned to keep their visual bounds clear of the rail where they fit.
- **Scrapbook Cover Customizer:** Rightmost gear icon opens the cover modal to customize title, leather/cloth texture, and colors.
- **History & Auto-Save:** 30-level Undo/Redo stack with debounced background synchronization.

### 🌦️ Day Atmosphere System
- Mood sets the page-paper palette; the selected soundtrack feeling (quiet, warm, bright, dreamy, or restless) changes the note color, typeface, photo treatment, and composition.
- Each saved memory gets its own scrapbook page and chapter named from the story. The suggested title uses story keywords and can be edited before saving.
- The visual language stays consistent through the same page structure and type system, while the mood and soundtrack choices explain each day's variation.

---

## 5. Limits & Guardrails

| Constraint | Limit | Behavior / Error Handling |
| :--- | :--- | :--- |
| **Media Files per Entry** | 10 files | Enforced on client file input and server `/api/uploads`. Friendly alert shown. |
| **Drafts per User** | 5 drafts | Enforced on client and server. 6th draft blocked with message to resume or delete. |
| **Image Size (Mode A)** | <= 15 MB | Compressed client-side to WebP/JPEG before upload. |
| **GIF Size (Mode A)** | <= 10 MB | Enforced on server. |
| **Video Size (Mode A)** | <= 50 MB | Enforced on server. |
| **Firestore Document (Mode B)** | <= 850 KB | Client compresses photos before writing to Firestore document. |
| **Responsive Widths** | 360px, 768px, 1280px | Flexible layout with responsive single/two-page views, no clipping or horizontal scroll leaks. |

---

## 6. Project Directory Tree

```
MEMORIA/
├── .env.example
├── .gitignore
├── .github/workflows/deploy.yml
├── firebase-config.js
├── firebase.json
├── firestore.rules
├── package.json
├── package-lock.json
├── PLAN.md
├── PROGRESS.md
├── README.md
├── server.js
├── scripts/
│   └── build-static.js
├── test/
│   ├── atmosphere.test.js
│   ├── wizard-flow.test.js
│   ├── api.test.js
│   └── data-schema.test.js
├── uploads/             (created at runtime; ignored by Git)
└── public/
    ├── index.html
    ├── assets/
    │   └── wallpaper.png
    ├── styles/
    │   ├── main.css
    │   ├── scrapbook.css
    │   └── editor.css
    ├── js/
    │   ├── app.js
    │   ├── create-memory.js
    │   ├── scrapbook-viewer.js
    │   ├── scrapbook-editor.js
    │   ├── storage-adapter.js
    │   ├── adapter-local.js
    │   ├── adapter-firebase.js
    │   └── utils.js
    └── vendor/
        ├── page-flip.browser.js
        └── interact.min.js
```
