// Utility functions for MEMORIA v2

const titleStopWords = new Set(
  "a an and are as at be been but by for from had has have he her i in into is it its me my of on or our she that the their them there they this through to up was we were with you your я мы ты он она оно они это этот эта эти и а но или в во на под за из к ко от до у по с со как что чтобы был была были быть мне мой моя моё мои наш наша наше наши его ее её их день сегодня очень там тут тогда потом уже".split(" ")
);

const Utils = {
  // Deterministic PRNG using seed for messy aesthetic stability
  seededRandom(seed) {
    let s = Number(seed) || 12345;
    return function() {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  },

  // Generates a messy angle between -4 and +4 degrees based on a seed
  getMessyRotation(seed) {
    const rng = Utils.seededRandom(seed);
    return Math.round((rng() * 8 - 4) * 10) / 10;
  },

  generateMemoryTitle(text, date) {
    const words = String(text || "")
      .normalize("NFKC")
      .replace(/https?:\/\/\S+/gi, "")
      .match(/[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu) || [];
    const titleWords = [];
    const seen = new Set();
    for (const word of words) {
      const normalized = word.toLocaleLowerCase();
      if (normalized.length < 3 || titleStopWords.has(normalized) || seen.has(normalized)) continue;
      titleWords.push(word);
      seen.add(normalized);
      if (titleWords.length === 5) break;
    }

    if (titleWords.length < 3) {
      const parsedDate = date ? new Date(`${date}T00:00:00`) : new Date();
      const month = Number.isNaN(parsedDate.getTime())
        ? "Daily"
        : parsedDate.toLocaleString("en-US", { month: "long" });
      for (const word of [month, "Day", "Memory"]) {
        if (titleWords.length === 5) break;
        if (!seen.has(word.toLocaleLowerCase())) {
          titleWords.push(word);
          seen.add(word.toLocaleLowerCase());
        }
      }
    }

    return titleWords.slice(0, 5)
      .map(word => word.charAt(0).toLocaleUpperCase() + word.slice(1))
      .join(" ");
  },

  getMemoryAtmosphere(mood, soundtrackMood, photoFilter) {
    const paperColors = {
      1: "#e5eaf0",
      2: "#e9efec",
      3: "#f1efe6",
      4: "#f8eedb",
      5: "#f7e4d7"
    };
    const soundtrackStyles = {
      quiet: {
        noteColor: "#dce7e5",
        font: "Cormorant Garamond",
        rotationScale: 0.35,
        photoFilter: "saturate(.78) brightness(1.02)",
        layout: { photoX: 9, photoY: 8, noteX: 52, noteY: 43, musicX: 8, musicY: 73, photoWidth: 40 }
      },
      warm: {
        noteColor: "#f4dfbb",
        font: "Caveat",
        rotationScale: 0.7,
        photoFilter: "sepia(.12) saturate(1.08)",
        layout: { photoX: 7, photoY: 8, noteX: 51, noteY: 43, musicX: 7, musicY: 73, photoWidth: 42 }
      },
      bright: {
        noteColor: "#f7e8a4",
        font: "DM Sans",
        rotationScale: 1.15,
        photoFilter: "saturate(1.16) contrast(1.03)",
        layout: { photoX: 6, photoY: 6, noteX: 50, noteY: 46, musicX: 10, musicY: 75, photoWidth: 44 }
      },
      dreamy: {
        noteColor: "#e8def2",
        font: "Playfair Display",
        rotationScale: 0.5,
        photoFilter: "saturate(.84) brightness(1.04)",
        layout: { photoX: 8, photoY: 9, noteX: 51, noteY: 44, musicX: 8, musicY: 74, photoWidth: 40 }
      },
      restless: {
        noteColor: "#f0d1c5",
        font: "DM Sans",
        rotationScale: 1.5,
        photoFilter: "contrast(1.12) saturate(1.08)",
        layout: { photoX: 9, photoY: 6, noteX: 48, noteY: 45, musicX: 11, musicY: 74, photoWidth: 44 }
      }
    };
    const userPhotoFilters = {
      warm: "sepia(.3) saturate(1.15)",
      vintage: "sepia(.4) contrast(.92)",
      bw: "grayscale(1)",
      faded: "saturate(.65) contrast(.88)",
      dramatic: "contrast(1.2) saturate(1.15)"
    };
    const numericMood = Math.min(5, Math.max(1, Math.round(Number(mood) || 3)));
    const defaultSoundtrackMood = numericMood <= 2 ? "quiet" : numericMood === 3 ? "dreamy" : numericMood === 4 ? "warm" : "bright";
    const selectedSoundtrackMood = Object.prototype.hasOwnProperty.call(soundtrackStyles, soundtrackMood)
      ? soundtrackMood
      : defaultSoundtrackMood;

    return {
      mood: numericMood,
      soundtrackMood: selectedSoundtrackMood,
      paperColor: paperColors[numericMood],
      ...soundtrackStyles[selectedSoundtrackMood],
      photoFilter: userPhotoFilters[photoFilter] || soundtrackStyles[selectedSoundtrackMood].photoFilter
    };
  },

  // Average mood calculation strictly following specifications:
  // mean of 1-5 values
  // >= 4.5 "Great", >= 3.5 "Good", >= 2.5 "Not bad", >= 1.5 "Not that bad", else "Awful"
  computeAverageMood(moodNumbers) {
    if (!Array.isArray(moodNumbers) || moodNumbers.length === 0) {
      return { average: 0, label: "None", count: 0 };
    }
    const valid = moodNumbers.map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 5);
    if (valid.length === 0) return { average: 0, label: "None", count: 0 };

    const sum = valid.reduce((acc, v) => acc + v, 0);
    const average = Math.round((sum / valid.length) * 10) / 10;
    let label = "Awful";
    if (average >= 4.5) label = "Great";
    else if (average >= 3.5) label = "Good";
    else if (average >= 2.5) label = "Not bad";
    else if (average >= 1.5) label = "Not that bad";

    return { average, label, count: valid.length };
  },

  // Filter entries according to requested time window
  filterEntriesByPeriod(entries, period) {
    if (!Array.isArray(entries)) return [];
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    return entries.filter(e => {
      if (!e.date) return false;
      const entryDate = new Date(e.date + "T00:00:00");
      if (isNaN(entryDate.getTime())) return false;

      if (period === "today") {
        return e.date === todayStr;
      }
      const diffMs = now.getTime() - entryDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (period === "the past week") return diffDays >= 0 && diffDays <= 7;
      if (period === "the past month") return diffDays >= 0 && diffDays <= 31;
      if (period === "the past year") return diffDays >= 0 && diffDays <= 366;
      return true;
    });
  },

  // Client-side image compression using canvas
  async compressImage(file, maxDimension = 1600, quality = 0.82) {
    if (!file.type.startsWith("image/") || file.type.includes("gif")) {
      // Return raw data URL for gifs or non-compressibles
      return Utils.fileToDataUrl(file);
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          // Use WebP if supported, fallback to JPEG
          const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
          const dataUrl = canvas.toDataURL(mime, quality);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error("Failed to load image for compression"));
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  // Lightweight browser EXIF parser for GPS and timestamp
  async readExif(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = function(e) {
        const buffer = e.target.result;
        const view = new DataView(buffer);
        if (view.byteLength < 2 || view.getUint16(0, false) !== 0xFFD8) {
          return resolve(null); // Not a standard JPEG
        }

        let offset = 2;
        const length = view.byteLength;
        while (offset < length) {
          if (view.getUint8(offset) !== 0xFF) break;
          const marker = view.getUint8(offset + 1);
          if (marker === 0xE1) { // APP1 Exif
            try {
              const exifHeader = view.getUint32(offset + 4, false);
              if (exifHeader === 0x45786966) { // "Exif"
                const tiffOffset = offset + 10;
                const littleEndian = view.getUint16(tiffOffset, false) === 0x4949;
                const ifdOffset = view.getUint32(tiffOffset + 4, littleEndian);
                const tagCount = view.getUint16(tiffOffset + ifdOffset, littleEndian);

                let gpsInfoOffset = null;
                let dateTimeOriginal = null;

                for (let i = 0; i < tagCount; i++) {
                  const tagEntryOffset = tiffOffset + ifdOffset + 2 + i * 12;
                  const tag = view.getUint16(tagEntryOffset, littleEndian);
                  if (tag === 0x8825) { // GPS IFD pointer
                    gpsInfoOffset = view.getUint32(tagEntryOffset + 8, littleEndian);
                  }
                }

                if (gpsInfoOffset) {
                  const gpsTagCount = view.getUint16(tiffOffset + gpsInfoOffset, littleEndian);
                  let latRef = "N", lonRef = "E";
                  let latVals = null, lonVals = null;

                  for (let j = 0; j < gpsTagCount; j++) {
                    const gpsTagOffset = tiffOffset + gpsInfoOffset + 2 + j * 12;
                    const tag = view.getUint16(gpsTagOffset, littleEndian);
                    if (tag === 1) latRef = String.fromCharCode(view.getUint8(gpsTagOffset + 8));
                    if (tag === 3) lonRef = String.fromCharCode(view.getUint8(gpsTagOffset + 8));
                  }

                  return resolve({
                    latRef,
                    lonRef,
                    label: `GPS (${latRef}, ${lonRef})`
                  });
                }
              }
            } catch (err) {
              console.debug("EXIF parse skipped:", err);
            }
            break;
          }
          offset += 2 + view.getUint16(offset + 2, false);
        }
        resolve(null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsArrayBuffer(file.slice(0, 65536));
    });
  },

  debounce(func, wait = 300) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  },

  formatDate(dateStr) {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr + "T00:00:00");
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return dateStr;
    }
  },

  moodEmojis: {
    5: { emoji: "🥰", label: "Very happy" },
    4: { emoji: "🙂", label: "Happy" },
    3: { emoji: "😐", label: "Neutral" },
    2: { emoji: "🙁", label: "Sad" },
    1: { emoji: "😫", label: "Awful" }
  }
};

window.Utils = Utils;
