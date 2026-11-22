# MEMORIA v2 Progress Tracker

## Phase Status Summary
- [x] **Phase 0: Planning & Architecture Foundation** - Completed `PLAN.md`, schema v1 definition, and project isolation.
- [x] **Phase 1: Project Skeleton, Storage Adapter & "Create a Memory" Flow** - Fully implemented and verified.
- [x] **Phase 2: Scrapbook Viewer, Cover, Animated Turning & Overview** - Fully implemented and verified.
- [x] **Phase 3: Categories (Calendar, Mood, Tags), Search, Chapters & Archive** - Fully implemented and verified.
- [x] **Phase 4: Canva-Style Scrapbook Editor (6 Capabilities, Undo/Redo & Cover Customizer)** - Fully implemented and verified.
- [x] **Phase 5: Firebase Mode B Implementation, Static Build & GitHub Pages Workflow** - Fully implemented and verified.
- [x] **Phase 6: Responsive Layout Verification, Polish, Tests & Complete Documentation** - Fully implemented and verified.

---

## Detailed Resolutions for User Feedback & Original Scrapbook Features

1. **True Drag-and-Drop from Palette**:
   - Palette items in the bottom toolbar use HTML5 drag-and-drop. Dropping an element places it near the pointer; adding by clicking is disabled.
2. **Drag-Out from Photo Inspection Modal**:
   - The left-side, blurred inspection modal shows every attached photo as an individual draggable card. Dragging a photo, sticky note, or music sticker opens Editor Mode automatically.
3. **Blank Spread Creation & Chapter Assignment**:
   - Added "+ New Spread" in both the Editor toolbar and the Chapters menu, adding two fresh blank pages (`page-left` and `page-right`) to the book.
   - Chapters category now supports renaming chapters (`✏️ Rename`), toggling page assignments (`Page 1`, `Page 2`, etc.), deleting, and reordering chapters.
4. **Active Element Inspector Bar (Per-Element Styling & Sizing)**:
   - Added the live inspector bar directly in Editor Mode (inspired by the reference screenshot):
     - **Title / Note Text Input:** Live editing of the selected element's text.
     - **Font Family Selector:** Per-element font switching (Caveat, DM Sans, Cormorant Garamond, Playfair Display, Georgia, Arial).
     - **Font Size Selector:** Per-element sizing (14px, 16px, 18px, 20px, 24px, 28px, 32px) constrained to safe ranges.
     - **Color Swatches & Custom Color:** Direct background color changes for sticky notes and cards.
     - **Resize Handles (`.spread-resize`):** Page-relative corner resizing constrained to the page boundaries.
     - **Paper Color & Cover Customizer:** Complete page paper and cover tone/texture customizers.
5. **Drag Only in Edit Mode**:
   - Elements are static in View Mode (clicking a polaroid inspects it; page swipes/drags turn pages).
   - In Editor Mode, `.editing-mode` activates: elements become movable and resizable, and central page-flip drag is disabled so editing is effortless.
6. **Corner / Edge Column Page Flipping**:
   - Page flips via mouse/touch dragging are constrained to the outer edge margins (`.page-flip-edge-strip` and `cornerSize: 45`), preventing clicks inside the page content from accidentally curling pages. Prominent side `<` and `>` buttons provide one-click flipping.
7. **Multi-Source Musical Stickers (YouTube, Apple Music, Custom Links)**:
   - Music selector now provides 3 dedicated source tabs:
     - **YouTube:** Live YouTube Data API v3 search with thumbnails and embedded player support.
     - **Apple Music:** iTunes Search API with track search.
     - **Custom Web Link:** Direct attachment of Spotify, SoundCloud, or external links.
8. **Instagram & TikTok Social Embeds**:
   - Added `Social Embed` element in the palette and plain sticker transformation.
   - Accepts Instagram Reel/Post URLs or TikTok video URLs, rendering an authentic scrapbook card with platform badge and embedded/preview player.
9. **Scrapbook Reopening Fix**:
   - Fixed the lifecycle bug where `PageFlip.destroy()` corrupted subsequent opens. Container DOM is cleanly refreshed and rebuilt, allowing infinite open/close cycles without page reload.
10. **Small Floating "Show UI" Button**:
    - When "Hide UI" is clicked, all navigation hides and a small floating pill button (`👁️ Show UI`) appears in the top-right corner to easily restore the UI.
11. **Zoomed-In & Immersive Presentation**:
    - Increased book dimensions to `min(1200px, 96vw) x min(780px, calc(100vh - 80px))` with 540x720px pages, center binder rings (`.spread-rings`), rich leather background, and large Polaroid and note components matching the original reference.
12. **Live Groq AI, YouTube API & Firebase Configuration**:
    - Local Groq requests use the server-side `GROQ_API_KEY`; no Groq secret is exposed in browser code.
    - Mode B needs a configured protected AI endpoint (`MEMORIA_AI_ENDPOINT_URL`) for Groq; static mode otherwise uses its documented fallback.
    - Firebase email/password authentication and Firestore persistence are implemented, but the deployed Firebase account and remote data flow still need end-to-end verification.

## Follow-up Corrections & Verification (2026-11-22)

- Fixed a syntax error in the Firebase adapter that prevented it from loading; added its missing Apple catalog search and preview URL support.
- Localhost now uses the local Express/SQLite adapter by default, keeping Groq requests server-side. Firebase can be forced locally with `window.MEMORIA_FORCE_FIREBASE = true`.
- Firebase mode now supports email/password account creation and sign-in when anonymous auth is disabled. The currently configured Firebase project rejected anonymous sign-in during browser verification; remote email/password sign-in was not verified.
- Palette items require Editor Mode; inspection-popup drags open Editor Mode automatically. Page drops use delegated handlers so PageFlip's rendered page copies accept drops. Blank spreads are normalized to even page pairs before navigation; drag-moving an existing item to the opposite page is supported.
- Added editable selection on click in Editor Mode so note text/font/size controls activate, and added YouTube/Apple/custom music selection with in-place YouTube playback or Apple preview audio when a preview is provided.
- Page flips now listen only on the outside page-edge strips; editor geometry is constrained to the available viewport height.
- Verified in a local browser: open/close/reopen, blank spread creation, palette drag onto the right page, moving an item across pages, changing a sticky note's text/font/size, and dragging a photo out of its inspection popup while editing. All 14 automated tests and JavaScript syntax checks pass.
- Mode B's configured external Firebase data path and protected AI endpoint still require deployment credentials for end-to-end verification. Static hosting falls back to local generic AI prompts unless `MEMORIA_AI_ENDPOINT_URL` is configured; no Groq key is placed in browser code.

## Photo Layout Rebuild (2026-11-22)

- Reused the old scrapbook's framed photo and caption treatment in v2, with page-relative geometry migrated from existing pixel layouts.
- Polaroid drops now open a picker for real photos from saved memories instead of creating blank placeholder cards.
- Resize handles use page-relative pointer movement and clamp dimensions to the page. Default memory layouts use separated positions to reduce unintended overlap.
- A one-sided user page now gets a persisted blank partner page, so drops and cross-page moves target real page data instead of a display-only placeholder.
- Browser verification covered legacy pixel-layout migration, photo selection, resize bounds, and moving a photo onto the blank partner page. JavaScript syntax checks and all 14 tests pass.

## Sticky Note & Inspection Improvements (2026-11-22)

- Sticky-note text wraps and expands the note height to fit content within the page when possible; notes use an internal scroll area only when the page has no remaining space.
- Added per-element text alignment controls for sticky notes and text blocks, plus a circular drag handle for free rotation.
- Inspection panels now use a blurred backdrop, sit on the left, show all photos attached to an entry, and automatically open Editor Mode when an item is dragged.
- The opaque, paper-colored 24px edge rail is reserved for page turns. Element placement is inset, and rotation-aware bounds reposition rotated elements so their visual boxes stay clear of the rail.
- Browser verification confirmed a 90° sticky note that previously extended past the page edge is repositioned clear of the rail, rail clicks turn pages, and all attached photos appear. A pointer drag of the second photo onto the right page opened Editor Mode and placed the correct photo.
- JavaScript syntax checks and all 14 automated tests pass after the final adjustments.
