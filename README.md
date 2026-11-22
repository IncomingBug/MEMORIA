# MEMORIA

**Every day is a work of art.** MEMORIA is a digital scrapbook and memory journal for collecting the photos, words, mood, place, and soundtrack that make a day yours.

- **Live app:** https://incomingbug.github.io/MEMORIA/
- **Source repository:** https://github.com/IncomingBug/MEMORIA

## What makes MEMORIA different

- **One moment, many details:** Save up to 10 photos, videos, or GIFs in a single memory, with captions, date and time, a story, mood, place, and tags. A quick text-only flow is also available.
- **Music you choose:** Search Apple Music or YouTube, or add a link from another service. The chosen track and its mood can shape the page.
- **A scrapbook that feels personal:** Customize the cover, paper, fonts, text size and color, and notes. In edit mode, move, resize, rotate, layer, and rearrange items across pages. Create spreads and organize pages into named chapters.
- **An archive you can return to:** Browse memories by chapter, date, mood, tag, or search.
- **Optional AI, not AI-authored memories:** In local mode, Groq can suggest reflection questions and create a weekend Story Reel from the user's text, mood, and music. Photos are not sent to the model. Without an AI key or endpoint, clear non-AI fallbacks remain.

Pages are composed by code from user-provided content and choices. MEMORIA does not copy individual artworks or train a generative model on artists' works.

## Music providers

- **Apple Music:** Search uses Apple's public iTunes Search API and does not require an API key. A short audio preview is available when Apple supplies one; the full track opens on its official Apple Music page.
- **YouTube:** Catalog search requires a YouTube Data API v3 key. The public configuration currently has no key, so it offers a YouTube search link rather than catalog results. When a video ID is available, the scrapbook opens it in a compact in-app player and stops playback when the page changes.
- **Other link:** Add a direct music-service URL. MEMORIA does not promise in-app playback for arbitrary external links.

## Run locally

Requirements: Node.js and npm.

```bash
npm install
npm start
```

Open http://localhost:3000. The local server uses Express and SQLite; it creates a local database on first run. Uploaded files stay in the local `uploads/` directory.

### Optional API keys

Copy `.env.example` to `.env` and add only the services you want to use:

```text
YOUTUBE_API_KEY=your_youtube_data_api_key
GROQ_API_KEY=your_groq_api_key
```

Keep `.env` private and never commit it. The local server reads these keys server-side; Apple Music search needs no key.

For static Firebase hosting, configure the Firebase web app in `firebase-config.js`, enable the desired Firebase Authentication providers, and publish `firestore.rules`. To enable YouTube catalog search on a static site, set `MEMORIA_YOUTUBE_API_KEY` in that file and restrict the key to YouTube Data API v3 and the site's HTTP referrers. A browser-side key is visible to visitors; do not put Groq or service-account secrets there.

## Where your memories are stored

- **GitHub Pages / Firebase mode:** Firebase Authentication and Cloud Firestore store each user's entries, tags, drafts, and scrapbook pages. Firestore rules scope access to the signed-in user's UID. Photos are compressed in the browser and stored in separate Firestore documents; this version does not use Firebase Storage.
- **Local mode:** Express and SQLite store data on the machine running the app; media files stay under `uploads/`.

The public app does not include shared sample memories. A newly opened account may have an empty scrapbook; create memories to try the full experience.

## Build, tests, and deployment

```bash
npm test
npm run build:static
```

`npm run build:static` creates the deployable site in `dist/`. Pushing to `main` triggers the GitHub Pages workflow in `.github/workflows/deploy.yml`. Firestore rules are deployed separately through Firebase Console or Firebase CLI.

## Tech stack

HTML, CSS, and JavaScript; Node.js and Express; SQLite for local persistence; Firebase Authentication and Cloud Firestore for the hosted app; StPageFlip for page turns; Interact.js for editing; iTunes Search API and optional YouTube Data API v3 and Groq APIs.
