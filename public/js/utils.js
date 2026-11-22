// Utility functions for MEMORIA v2

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
