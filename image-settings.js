/* Antigravity Image & Video Settings Management with Client-Side Contour Tracing */
(function (scope) {
  'use strict';

  // Sobel Edge Detection and Contour Walking (pure JavaScript, runs in browser)
  function vectorize(rgba, width, height) {
    const count = width * height;
    const gray = new Float32Array(count);
    const mag = new Float32Array(count);
    const angle = new Uint8Array(count);
    const edge = new Uint8Array(count);

    // Convert to grayscale
    for (let i = 0; i < count; i++) {
      gray[i] = rgba[i * 4] * 0.299 + rgba[i * 4 + 1] * 0.587 + rgba[i * 4 + 2] * 0.114;
    }

    // Sobel operator
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        const gx = -gray[i - width - 1] + gray[i - width + 1] - 2 * gray[i - 1] + 2 * gray[i + 1] - gray[i + width - 1] + gray[i + width + 1];
        const gy = -gray[i - width - 1] - 2 * gray[i - width] - gray[i - width + 1] + gray[i + width - 1] + 2 * gray[i + width] + gray[i + width + 1];
        mag[i] = Math.hypot(gx, gy);
        const a = (Math.atan2(gy, gx) * 180 / Math.PI + 180) % 180;
        angle[i] = a < 22.5 || a >= 157.5 ? 0 : a < 67.5 ? 1 : a < 112.5 ? 2 : 3;
      }
    }

    const pairs = [[1, -1], [width + 1, -width - 1], [width, -width], [width - 1, -width + 1]];
    for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
        const i = y * width + x;
        const [a, b] = pairs[angle[i]];
        if (mag[i] > 32 && mag[i] >= mag[i + a] && mag[i] > mag[i + b]) edge[i] = 1;
      }
    }

    const neighbors = [-width - 1, -width, -width + 1, -1, 1, width - 1, width, width + 1];
    const visited = new Uint8Array(count);
    const paths = [];

    function walk(start) {
      let current = start, previous = -1;
      const points = [];
      while (current >= 0 && !visited[current]) {
        visited[current] = 1;
        points.push([current % width, Math.floor(current / width)]);
        let next = -1, best = -Infinity;
        for (const d of neighbors) {
          const n = current + d;
          if (n < 0 || n >= count || !edge[n] || visited[n]) continue;
          const dx = n % width - current % width;
          const dy = Math.floor(n / width) - Math.floor(current / width);
          const score = previous < 0 ? mag[n] : dx * (current % width - previous % width) + dy * (Math.floor(current / width) - Math.floor(previous / width));
          if (score > best) { best = score; next = n; }
        }
        previous = current;
        current = next;
      }
      if (points.length >= 8) {
        paths.push(points.filter((_, i) => i % 2 === 0 || i === points.length - 1).map(([x, y]) => [Math.round(x * 1536 / width), Math.round(y * 1024 / height)]));
      }
    }

    for (let i = 0; i < count; i++) {
      if (edge[i] && !visited[i] && neighbors.reduce((n, d) => n + (edge[i + d] || 0), 0) <= 1) walk(i);
    }
    for (let i = 0; i < count; i++) {
      if (edge[i] && !visited[i]) walk(i);
    }

    return paths.sort((a, b) => b.length - a.length).slice(0, 1200);
  }

  // Theme Presets
  const THEME_PRESETS = {
    aura: {
      id: 'aura',
      name: 'Aura Dark Cyber (Tím Aura & Viền Tinh Tế - Mặc định)',
      base: '21 20 27',
      tint: '162 119 255',
      violet: '97 255 202',
      pink: '246 148 255'
    },
    elaina: {
      id: 'elaina',
      name: 'Elaina Starlight Cyber',
      base: '10 14 26',
      tint: '56 189 248',
      violet: '192 132 252'
    },
    'deep-noir': {
      id: 'deep-noir',
      name: 'Deep Space Noir',
      base: '6 6 10',
      tint: '148 163 184',
      violet: '129 140 248'
    },
    'cyber-neon': {
      id: 'cyber-neon',
      name: 'Cyber Neon Matrix',
      base: '8 12 16',
      tint: '34 211 238',
      violet: '244 114 182'
    },
    auto: {
      id: 'auto',
      name: 'Tự động phân tích màu Video',
      base: '21 20 27',
      tint: '162 119 255',
      violet: '97 255 202'
    }
  };

  function defaultPalette() {
    return {
      base: '21 20 27',
      tint: '162 119 255',
      violet: '97 255 202',
      pink: '246 148 255'
    };
  }

  // Extract dominant color palette from image or video element
  function extractPalette(sourceElement) {
    try {
      if (!sourceElement || typeof document === 'undefined') return defaultPalette();
      const sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = 32;
      sampleCanvas.height = 32;
      const ctx = sampleCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return defaultPalette();

      ctx.drawImage(sourceElement, 0, 0, 32, 32);
      const data = ctx.getImageData(0, 0, 32, 32).data;
      const totalPixels = 32 * 32;

      let darkR = 0, darkG = 0, darkB = 0, darkCount = 0;
      let vibrantR = 56, vibrantG = 189, vibrantB = 248, maxVibrancy = -1;
      let warmR = 192, warmG = 132, warmB = 252, maxWarmth = -1;

      for (let i = 0; i < totalPixels; i++) {
        const r = data[i * 4];
        const g = data[i * 4 + 1];
        const b = data[i * 4 + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const sat = max === 0 ? 0 : (max - min) / max;

        // Dark background sample (luminance < 70)
        if (lum < 70) {
          darkR += r;
          darkG += g;
          darkB += b;
          darkCount++;
        }

        // Vibrant cyan/blue highlight sample
        if (sat > 0.35 && lum > 80) {
          const cyanScore = (b * 1.2 + g * 0.9 - r * 0.8) * sat;
          if (cyanScore > maxVibrancy) {
            maxVibrancy = cyanScore;
            vibrantR = r;
            vibrantG = g;
            vibrantB = b;
          }
        }

        // Secondary violet/purple/magenta sample
        if (sat > 0.3 && lum > 70) {
          const violetScore = (r * 0.8 + b * 1.1 - g * 1.2) * sat;
          if (violetScore > maxWarmth) {
            maxWarmth = violetScore;
            warmR = r;
            warmG = g;
            warmB = b;
          }
        }
      }

      // Compute base color (clamped to deep dark cosmic tones for comfortable IDE contrast)
      let baseR = darkCount > 0 ? Math.round(darkR / darkCount) : 10;
      let baseG = darkCount > 0 ? Math.round(darkG / darkCount) : 14;
      let baseB = darkCount > 0 ? Math.round(darkB / darkCount) : 26;
      baseR = Math.max(6, Math.min(16, baseR));
      baseG = Math.max(8, Math.min(20, baseG));
      baseB = Math.max(12, Math.min(32, baseB));

      return {
        base: `${baseR} ${baseG} ${baseB}`,
        tint: `${vibrantR} ${vibrantG} ${vibrantB}`,
        violet: `${warmR} ${warmG} ${warmB}`
      };
    } catch (_) {
      return defaultPalette();
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { vectorize, extractPalette, THEME_PRESETS, defaultPalette };
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.vectorize = vectorize;
    globalThis.extractPalette = extractPalette;
    globalThis.THEME_PRESETS = THEME_PRESETS;
    globalThis.defaultPalette = defaultPalette;
  }
  scope.vectorize = vectorize;
  scope.extractPalette = extractPalette;
  scope.THEME_PRESETS = THEME_PRESETS;
  scope.defaultPalette = defaultPalette;
  if (typeof window === 'undefined') {
    return;
  }

  // IndexedDB Storage
  function database(action, value) {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open('antigravity-startup-settings', 1);
      open.onupgradeneeded = () => {
        open.result.createObjectStore('settings');
      };
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('settings', action === 'read' ? 'readonly' : 'readwrite');
        const store = tx.objectStore('settings');
        const request = action === 'read' ? store.get('config') : store.put(value, 'config');
        tx.oncomplete = () => {
          db.close();
          resolve(action === 'read' ? request.result || {} : value);
        };
        tx.onerror = tx.onabort = () => {
          db.close();
          reject(tx.error || new Error('Không thể lưu cài đặt'));
        };
      };
    });
  }

  // Import Image (Avatar or Artwork)
  async function importImage(file, kind) {
    if (file.size > 35 * 1024 * 1024) throw new Error('Vui lòng chọn ảnh nhỏ hơn 35 MB.');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      throw new Error('Vui lòng chọn ảnh định dạng PNG, JPEG hoặc WebP.');
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    try {
      img.src = url;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = kind === 'avatar' ? 512 : 1536;
      canvas.height = kind === 'avatar' ? 512 : 1024;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#08060d';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const scale = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      const image = canvas.toDataURL('image/png');
      if (kind === 'avatar') return { avatar: image };

      // Generate vector contour paths from downsampled image
      const small = document.createElement('canvas');
      small.width = 768;
      small.height = 512;
      const smallCtx = small.getContext('2d', { willReadFrequently: true });
      smallCtx.drawImage(canvas, 0, 0, 768, 512);
      const contours = vectorize(smallCtx.getImageData(0, 0, 768, 512).data, 768, 512);
      if (!contours.length) throw new Error('Không trích xuất được nét vẽ. Vui lòng chọn ảnh có độ tương phản rõ ràng hơn.');
      return { artwork: image, contours };
    } catch (err) {
      throw new Error(err.message || 'Không thể đọc ảnh, vui lòng thử lại.');
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // Import Video
  async function importVideo(file) {
    if (file.size > 150 * 1024 * 1024) throw new Error('Vui lòng chọn tệp video nhỏ hơn 150 MB để đảm bảo khởi động tức thì.');
    if (!['video/mp4', 'video/webm'].includes(file.type)) {
      throw new Error('Vui lòng chọn tệp video định dạng MP4 hoặc WebM.');
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ video: reader.result });
      reader.onerror = () => reject(new Error('Không thể đọc tệp video.'));
      reader.readAsDataURL(file);
    });
  }

  async function loadConfig() {
    try {
      if (typeof window !== 'undefined') {
        if (window.ANTIGRAVITY_SAVED_CONFIG) return window.ANTIGRAVITY_SAVED_CONFIG;
        if (window.parent && window.parent !== window) {
          try {
            const rawParent = window.parent.localStorage?.getItem('antigravity_theme_config');
            if (rawParent) return JSON.parse(rawParent);
          } catch (_) {}
        }
        const rawLocal = localStorage?.getItem('antigravity_theme_config');
        if (rawLocal) return JSON.parse(rawLocal);
      }
    } catch (_) {}
    return database('read');
  }

  async function saveConfig(config) {
    try {
      if (typeof window !== 'undefined') {
        const str = JSON.stringify(config);
        try { if (window.parent?.localStorage) window.parent.localStorage.setItem('antigravity_theme_config', str); } catch (_) {}
        try { if (window.localStorage) window.localStorage.setItem('antigravity_theme_config', str); } catch (_) {}
        if (window.ANTIGRAVITY_SEND) {
          window.ANTIGRAVITY_SEND({ type: 'antigravity-boot', action: 'saveConfig', config });
        }
      }
    } catch (_) {}
    return database('write', config);
  }

  scope.imageSettings = {
    load: loadConfig,
    save: saveConfig,
    importImage,
    importVideo,
    vectorize,
    extractPalette,
    THEME_PRESETS,
    defaultPalette
  };
})(typeof window === 'undefined' ? {} : window);
