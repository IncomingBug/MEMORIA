// Firebase Storage Adapter (Mode B: Static / Serverless Spark)
class AdapterFirebase {
  constructor(config) {
    this.config = config;
    this.auth = null;
    this.db = null;
    this.currentUser = null;
    this.sdk = null;
  }

  async init() {
    const sdkUrl = "https://www.gstatic.com/firebasejs/10.12.0/";
    const [appMod, authMod, firestoreMod] = await Promise.all([
      import(`${sdkUrl}firebase-app.js`),
      import(`${sdkUrl}firebase-auth.js`),
      import(`${sdkUrl}firebase-firestore.js`)
    ]);

    this.sdk = {
      app: appMod,
      auth: authMod,
      db: firestoreMod
    };

    const app = appMod.initializeApp(this.config);
    this.auth = authMod.getAuth(app);
    this.db = firestoreMod.getFirestore(app);

    // Track auth state or sign in anonymously for demo
    await new Promise((resolve) => {
      let initialStateHandled = false;
      authMod.onAuthStateChanged(this.auth, async (user) => {
        if (user) {
          this.currentUser = user;
          resolve();
        } else if (!initialStateHandled) {
          initialStateHandled = true;
          try {
            const cred = await authMod.signInAnonymously(this.auth);
            this.currentUser = cred.user;
          } catch (error) {
            this.authError = error;
          }
          resolve();
        }
      });
    });
  }

  get uid() {
    if (!this.currentUser) throw new Error("Sign in to Firebase before accessing saved memories.");
    return this.currentUser.uid;
  }

  async signIn(email, password) {
    const credential = await this.sdk.auth.signInWithEmailAndPassword(this.auth, email, password);
    this.currentUser = credential.user;
    return credential.user;
  }

  async createAccount(email, password) {
    if (this.currentUser?.isAnonymous) {
      const credential = this.sdk.auth.EmailAuthProvider.credential(email, password);
      const linked = await this.sdk.auth.linkWithCredential(this.currentUser, credential);
      this.currentUser = linked.user;
      return linked.user;
    }
    const credential = await this.sdk.auth.createUserWithEmailAndPassword(this.auth, email, password);
    this.currentUser = credential.user;
    return credential.user;
  }

  async signOut() {
    if (!this.auth) return;
    await this.sdk.auth.signOut(this.auth);
    this.currentUser = null;
  }

  async getUser() {
    return {
      id: this.uid,
      name: this.currentUser?.displayName || "Journalist",
      settings: { theme: "dark-editorial" }
    };
  }

  async getEntries() {
    if (!this.db) return [];
    const entriesCol = this.sdk.db.collection(this.db, "users", this.uid, "entries");
    const snapshot = await this.sdk.db.getDocs(entriesCol);
    const list = await Promise.all(snapshot.docs.map(async doc => {
      const entry = { id: doc.id, ...doc.data() };
      entry.media = await Promise.all((entry.media || []).map(async item => {
        if (typeof item.pathOrDocId === "string" && item.pathOrDocId.startsWith("data:")) return item;
        const photo = await this.getPhoto(item.docId || item.id || item.pathOrDocId);
        return photo ? { ...item, docId: item.docId || item.id, pathOrDocId: photo.dataUrl } : item;
      }));
      return entry;
    }));
    return list.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  }

  async saveEntry(entry) {
    if (!this.db) return entry;
    const entryId = entry.id || `entry-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const docRef = this.sdk.db.doc(this.db, "users", this.uid, "entries", entryId);
    const payload = {
      ...entry,
      id: entryId,
      media: (entry.media || []).map(item => ({
        ...item,
        docId: item.docId || item.id,
        pathOrDocId: item.docId || item.id || item.pathOrDocId
      })),
      updatedAt: new Date().toISOString()
    };
    await this.sdk.db.setDoc(docRef, payload, { merge: true });
    return payload;
  }

  async deleteEntry(id) {
    if (!this.db) return true;
    const docRef = this.sdk.db.doc(this.db, "users", this.uid, "entries", id);
    await this.sdk.db.deleteDoc(docRef);
    return true;
  }

  async getDrafts() {
    if (!this.db) return [];
    const draftsCol = this.sdk.db.collection(this.db, "users", this.uid, "drafts");
    const snapshot = await this.sdk.db.getDocs(draftsCol);
    const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return list.sort((a, b) => String(b.savedAt || "").localeCompare(String(a.savedAt || "")));
  }

  async saveDraft(draft) {
    if (!this.db) return draft;
    const draftsCol = this.sdk.db.collection(this.db, "users", this.uid, "drafts");
    const snapshot = await this.sdk.db.getDocs(draftsCol);

    const draftId = draft.id || `draft-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const alreadyExists = snapshot.docs.some(d => d.id === draftId);

    // Enforce 5 drafts max in Mode B
    if (!alreadyExists && snapshot.docs.length >= 5) {
      throw new Error("You have reached the maximum limit of 5 drafts. Please complete or delete an existing draft.");
    }

    const docRef = this.sdk.db.doc(this.db, "users", this.uid, "drafts", draftId);
    const payload = { ...draft, id: draftId, savedAt: new Date().toISOString() };
    await this.sdk.db.setDoc(docRef, payload, { merge: true });
    return payload;
  }

  async deleteDraft(id) {
    if (!this.db) return true;
    const docRef = this.sdk.db.doc(this.db, "users", this.uid, "drafts", id);
    await this.sdk.db.deleteDoc(docRef);
    return true;
  }

  async getTags() {
    if (!this.db) return [];
    const tagsCol = this.sdk.db.collection(this.db, "users", this.uid, "tags");
    const snapshot = await this.sdk.db.getDocs(tagsCol);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async saveTag(tag) {
    if (!this.db) return tag;
    const tagId = tag.id || `tag-${(tag.name || "").toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now().toString(36)}`;
    const docRef = this.sdk.db.doc(this.db, "users", this.uid, "tags", tagId);
    const payload = { ...tag, id: tagId };
    await this.sdk.db.setDoc(docRef, payload, { merge: true });
    return payload;
  }

  async getScrapbook() {
    const empty = { cover: { color: "#211711", texture: "leather", title: "My Memories", elements: [] }, pages: [], chapters: [] };
    if (!this.db) return empty;
    const docRef = this.sdk.db.doc(this.db, "users", this.uid, "scrapbook", "state");
    const snap = await this.sdk.db.getDoc(docRef);
    const state = snap.exists() ? snap.data() : empty;
    const pagesCol = this.sdk.db.collection(this.db, "users", this.uid, "scrapbook", "state", "pages");
    const pagesSnap = await this.sdk.db.getDocs(pagesCol);
    const storedPages = pagesSnap.empty ? (state.pages || []) : pagesSnap.docs.map(page => ({ id: page.id, ...page.data() }));
    state.pages = await Promise.all(storedPages.map(async page => ({
      ...page,
      elements: await Promise.all((page.elements || []).map(async element => {
        const mediaId = element.mediaId || element.content?.mediaId;
        if (!mediaId || element.content?.photoUrl?.startsWith("data:")) return element;
        const photo = await this.getPhoto(mediaId);
        return photo ? { ...element, content: { ...element.content, photoUrl: photo.dataUrl } } : element;
      }))
    })));
    return state;
  }

  async saveScrapbook(data) {
    if (!this.db) return data;
    const uid = this.uid;
    const firestore = this.sdk.db;
    const docRef = firestore.doc(this.db, "users", uid, "scrapbook", "state");
    const pagesCol = firestore.collection(this.db, "users", uid, "scrapbook", "state", "pages");
    const existing = await firestore.getDocs(pagesCol);
    const pages = (data.pages || []).map(page => {
      const savedPage = JSON.parse(JSON.stringify(page));
      for (const element of savedPage.elements || []) {
        const photoUrl = element.content?.photoUrl;
        const mediaId = element.mediaId || element.content?.mediaId;
        if (typeof photoUrl === "string" && photoUrl.startsWith("data:")) {
          if (!mediaId) throw new Error("Upload scrapbook photos before saving this layout.");
          element.mediaId = mediaId;
          delete element.content.photoUrl;
        }
      }
      const bytes = new TextEncoder().encode(JSON.stringify(savedPage)).length;
      if (bytes > 850000) throw new Error(`Scrapbook page "${page.id}" is too large to save to Firestore.`);
      return savedPage;
    });

    const keepIds = new Set(pages.map(page => page.id));
    const operations = [
      ...existing.docs.filter(page => !keepIds.has(page.id)).map(page => ({ type: "delete", ref: page.ref })),
      ...pages.map(page => ({
        type: "set",
        ref: firestore.doc(this.db, "users", uid, "scrapbook", "state", "pages", page.id),
        data: page
      }))
    ];
    for (let start = 0; start < operations.length; start += 450) {
      const batch = firestore.writeBatch(this.db);
      operations.slice(start, start + 450).forEach(operation => {
        if (operation.type === "delete") batch.delete(operation.ref);
        else batch.set(operation.ref, operation.data);
      });
      await batch.commit();
    }

    const metadata = { ...data };
    delete metadata.pages;
    await firestore.setDoc(docRef, metadata);
    return data;
  }

  async getPhoto(photoId) {
    if (!photoId) return null;
    const ref = this.sdk.db.doc(this.db, "users", this.uid, "photos", photoId);
    const snapshot = await this.sdk.db.getDoc(ref);
    return snapshot.exists() ? snapshot.data() : null;
  }

  async uploadMedia(files) {
    if (!files.length) return [];
    if (files.length > 10) throw new Error("Maximum 10 media files allowed per memory entry.");

    const results = [];
    const batch = this.sdk.db.writeBatch(this.db);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const photoId = `photo-${Date.now()}-${i}`;
      const docRef = this.sdk.db.doc(this.db, "users", this.uid, "photos", photoId);

      const byteLength = new TextEncoder().encode(file.dataUrl || "").length;
      if (byteLength > 850000) {
        throw new Error(`Photo "${file.name || i}" is too large for the free Firebase storage. Choose a smaller image.`);
      }

      batch.set(docRef, { dataUrl: file.dataUrl, name: file.name || "", title: file.title || "" });
      results.push({
        id: photoId,
        docId: photoId,
        type: file.type || "image",
        pathOrDocId: file.dataUrl, // In Mode B browser direct, photo dataUrl or docRef
        title: file.title || "",
        order: i
      });
    }

    await batch.commit();
    return results;
  }

  async searchYoutube(term) {
    try {
      const apiKey = window.MEMORIA_YOUTUBE_API_KEY || "";
      if (apiKey) {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=10&q=${encodeURIComponent(term)}&key=${apiKey}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          return (data.items || []).map(item => ({
            id: item.id?.videoId,
            title: item.snippet?.title,
            artist: item.snippet?.channelTitle,
            artwork: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url,
            link: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
            embedUrl: `https://www.youtube-nocookie.com/embed/${item.id?.videoId}`,
            videoId: item.id?.videoId,
            provider: "youtube"
          })).filter(t => t.id && t.title);
        }
      }
    } catch (error) {
      console.warn("YouTube search unavailable:", error.message);
    }

    return [{
      title: term,
      artist: "YouTube Video",
      artwork: "",
      link: `https://www.youtube.com/results?search_query=${encodeURIComponent(term)}`,
      embedUrl: "",
      provider: "youtube"
    }];
  }

  async searchMusic(term, country = "US") {
    const url = new URL("https://itunes.apple.com/search");
    url.search = new URLSearchParams({
      term,
      country,
      entity: "song",
      limit: "10"
    }).toString();

    const response = await fetch(url);
    if (!response.ok) throw new Error("Apple Music search is temporarily unavailable.");
    const data = await response.json();
    return (data.results || []).map(track => ({
      title: track.trackName,
      artist: track.artistName,
      album: track.collectionName,
      artwork: track.artworkUrl100,
      link: track.trackViewUrl,
      previewUrl: track.previewUrl || "",
      provider: "apple"
    })).filter(track => track.title && track.artist);
  }

  async getAiFollowups(text) {
    // If AI_ENDPOINT_URL is configured, proxy to it
    const endpoint = this.config.aiEndpointUrl || window.MEMORIA_AI_ENDPOINT_URL || "";
    if (endpoint) {
      try {
        const res = await fetch(endpoint.replace(/\/$/, "") + "/followup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.questions?.length) return data.questions;
        }
      } catch (error) {
        console.warn("Configured AI follow-up endpoint unavailable:", error.message);
      }
    } else {
      try {
        const res = await fetch("/api/ai/followup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.questions?.length) return data.questions;
        }
      } catch (error) {
        console.info("Local AI endpoint unavailable; using the static fallback.", error.message);
      }
    }
    // Mode B intelligent canned fallback
    const lower = text.toLowerCase();
    if (lower.includes("birthday") || lower.includes("party")) {
      return ["Who celebrated with you?", "What was your favorite moment of the day?"];
    }
    if (lower.includes("walk") || lower.includes("trip")) {
      return ["What scents or sounds did you notice?", "Did anything unexpected happen?"];
    }
    return [
      "What was an unexpected moment that made you smile?",
      "Who or what gave you a comforting feeling today?",
      "Is there a detail or scent you want to remember?"
    ];
  }

  async getAiSummary({ period, moodAverageLabel }) {
    const endpoint = this.config.aiEndpointUrl || window.MEMORIA_AI_ENDPOINT_URL || "";
    if (endpoint) {
      try {
        const res = await fetch(endpoint.replace(/\/$/, "") + "/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ period, moodAverageLabel })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.summary) return data.summary;
        }
      } catch (error) {
        console.warn("Configured AI summary endpoint unavailable:", error.message);
      }
    } else {
      try {
        const res = await fetch("/api/ai/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ period, moodAverageLabel })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.summary) return data.summary;
        }
      } catch (error) {
        console.info("Local AI endpoint unavailable; using the static fallback.", error.message);
      }
    }
    const label = moodAverageLabel || "Good";
    const fallbacks = {
      "Great": "A luminous chapter filled with vivid highlights and cherished laughter.",
      "Good": "Gentle, steady days marked by quiet warmth and pleasant discoveries.",
      "Not bad": "A balanced stretch of calm routines and reflective afternoon pauses.",
      "Not that bad": "A resilient period navigated with patience, holding onto small comforts.",
      "Awful": "Challenging days carried with quiet fortitude, leaving room for gentler tomorrows."
    };
    return fallbacks[label] || `A thoughtful ${period || "period"} recorded in your journal.`;
  }

  async getAiStoryReel(params) {
    const endpoint = this.config.aiEndpointUrl || window.MEMORIA_AI_ENDPOINT_URL || "";
    const urls = [
      ...(endpoint ? [endpoint.replace(/\/$/, "") + "/reel"] : []),
      "/api/ai/reel"
    ];
    let lastError;

    for (const url of urls) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params)
        });
        if (!res.ok) throw new Error(`Story reel endpoint returned ${res.status}.`);
        const data = await res.json();
        if (!data.title || !Array.isArray(data.captions)) {
          throw new Error("Story reel endpoint returned an invalid response.");
        }
        return data;
      } catch (error) {
        lastError = error;
        console.warn("Story reel AI endpoint unavailable:", error.message);
      }
    }

    throw new Error(lastError?.message || "Story reel AI endpoint unavailable.");
  }
}

window.AdapterFirebase = AdapterFirebase;
