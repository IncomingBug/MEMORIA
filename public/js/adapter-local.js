// Local Storage Adapter (Mode A: Express + SQLite)
class AdapterLocal {
  constructor() {
    this.userId = localStorage.getItem("memoria_user_id") || "usr_default";
    this.headers = {
      "Content-Type": "application/json",
      "X-User-Id": this.userId
    };
  }

  async init() {
    try {
      const res = await fetch("/api/user", { headers: this.headers });
      if (res.ok) {
        const user = await res.json();
        this.userId = user.id;
        localStorage.setItem("memoria_user_id", this.userId);
      }
    } catch (e) {
      console.warn("Local server initialization notice:", e.message);
    }
  }

  async getUser() {
    const res = await fetch("/api/user", { headers: this.headers });
    if (!res.ok) throw new Error("Failed to fetch user");
    return await res.json();
  }

  async getEntries() {
    const res = await fetch("/api/entries", { headers: this.headers });
    if (!res.ok) throw new Error("Failed to fetch entries");
    return await res.json();
  }

  async saveEntry(entry) {
    const res = await fetch("/api/entries", {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(entry)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to save entry");
    }
    return await res.json();
  }

  async deleteEntry(id) {
    const res = await fetch(`/api/entries/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: this.headers
    });
    return res.ok;
  }

  async getDrafts() {
    const res = await fetch("/api/drafts", { headers: this.headers });
    if (!res.ok) throw new Error("Failed to fetch drafts");
    return await res.json();
  }

  async saveDraft(draft) {
    const res = await fetch("/api/drafts", {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(draft)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to save draft");
    }
    return await res.json();
  }

  async deleteDraft(id) {
    const res = await fetch(`/api/drafts/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: this.headers
    });
    return res.ok;
  }

  async getTags() {
    const res = await fetch("/api/tags", { headers: this.headers });
    if (!res.ok) throw new Error("Failed to fetch tags");
    return await res.json();
  }

  async saveTag(tag) {
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(tag)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to save tag");
    }
    return await res.json();
  }

  async getScrapbook() {
    const res = await fetch("/api/scrapbook", { headers: this.headers });
    if (!res.ok) throw new Error("Failed to fetch scrapbook");
    return await res.json();
  }

  async saveScrapbook(data) {
    const res = await fetch("/api/scrapbook", {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to save scrapbook");
    }
    return await res.json();
  }

  async uploadMedia(files) {
    const res = await fetch("/api/uploads", {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ files })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to upload media");
    }
    const data = await res.json();
    return data.media || [];
  }

  async searchMusic(term, country = "US") {
    const url = `/api/music/search?term=${encodeURIComponent(term)}&country=${encodeURIComponent(country)}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Music catalog search failed");
    }
    const data = await res.json();
    return data.results || [];
  }

  async searchYoutube(term, country = "US") {
    const url = `/api/music/youtube-search?term=${encodeURIComponent(term)}&country=${encodeURIComponent(country)}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "YouTube search failed");
    }
    const data = await res.json();
    return data.results || [];
  }

  async getAiFollowups(text) {
    const res = await fetch("/api/ai/followup", {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ text })
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.questions || [];
  }

  async getAiSummary(params) {
    const res = await fetch("/api/ai/summary", {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(params)
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data.summary || "";
  }
}

window.AdapterLocal = AdapterLocal;
