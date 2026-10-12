import { execSync } from 'node:child_process';
import fs from 'node:fs';

const ffmpeg = 'D:\\Data\\ffmpeg-8.1.2-essentials_build\\bin\\ffmpeg.exe';
const width = 1920;
const height = 1080;
const count = width * height;

console.log('Extracting RGBA from assets/artwork.jpg (frame 0.0s sleeping)...');
const buf = execSync(`"${ffmpeg}" -i assets/artwork.jpg -f rawvideo -pix_fmt rgba -`, { maxBuffer: 30 * 1024 * 1024 });

console.log('Computing luminance and gradients...');
const gray = new Float32Array(count);
for (let i = 0; i < count; i++) {
  const r = buf[i * 4];
  const g = buf[i * 4 + 1];
  const b = buf[i * 4 + 2];
  gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
}

// 3x3 Gaussian Blur to suppress JPEG noise
const smoothGray = new Float32Array(count);
for (let y = 1; y < height - 1; y++) {
  for (let x = 1; x < width - 1; x++) {
    const idx = y * width + x;
    smoothGray[idx] = (
      gray[idx - width - 1] + 2 * gray[idx - width] + gray[idx - width + 1] +
      2 * gray[idx - 1]     + 4 * gray[idx]         + 2 * gray[idx + 1] +
      gray[idx + width - 1] + 2 * gray[idx + width] + gray[idx + width + 1]
    ) / 16;
  }
}

// Sobel Operator & Angle
const mag = new Float32Array(count);
const angle = new Uint8Array(count);
for (let y = 1; y < height - 1; y++) {
  for (let x = 1; x < width - 1; x++) {
    const idx = y * width + x;
    const gx = -smoothGray[idx - width - 1] + smoothGray[idx - width + 1]
               - 2 * smoothGray[idx - 1]     + 2 * smoothGray[idx + 1]
               - smoothGray[idx + width - 1] + smoothGray[idx + width + 1];
    const gy = -smoothGray[idx - width - 1] - 2 * smoothGray[idx - width] - smoothGray[idx - width + 1]
               + smoothGray[idx + width - 1] + 2 * smoothGray[idx + width] + smoothGray[idx + width + 1];
    mag[idx] = Math.hypot(gx, gy);
    const a = (Math.atan2(gy, gx) * 180 / Math.PI + 180) % 180;
    angle[idx] = (a < 22.5 || a >= 157.5) ? 0 : (a < 67.5) ? 1 : (a < 112.5) ? 2 : 3;
  }
}

// Non-Maximum Suppression (thin edges)
const thin = new Uint8Array(count);
const pairs = [[1, -1], [width + 1, -width - 1], [width, -width], [width - 1, -width + 1]];

for (let y = 2; y < height - 2; y++) {
  for (let x = 2; x < width - 2; x++) {
    const idx = y * width + x;
    const m = mag[idx];

    // Character focus: Elaina is primarily at x >= 620, y >= 30
    if (x < 620 || y < 30 || x > 1850 || y > 1050) continue;

    // Face zone: keep cute anime features, suppress cheek wrinkles
    const inFace = (x >= 1235 && x <= 1395 && y >= 240 && y <= 345);
    const isEyelash = (x >= 1245 && x <= 1295 && y >= 250 && y <= 290) ||
                      (x >= 1350 && x <= 1395 && y >= 265 && y <= 300);
    const isMouth = (x >= 1295 && x <= 1330 && y >= 320 && y <= 340);
    const isBook = (y >= 345);

    let threshold = 22;
    if (inFace) {
      if (isEyelash) {
        threshold = 18; // Delicate closed eyelashes
      } else if (isMouth) {
        threshold = 22; // Cute soft mouth
      } else if (isBook) {
        threshold = 24; // Book top
      } else {
        threshold = 999; // ZERO cheek noise
      }
    }

    if (m < threshold) continue;

    const [a, b] = pairs[angle[idx]];
    if (m >= mag[idx + a] && m > mag[idx + b]) {
      thin[idx] = 1;
    }
  }
}

// Contour tracing
const visited = new Uint8Array(count);
const neighbors = [-width - 1, -width, -width + 1, -1, 1, width - 1, width, width + 1];
const rawPaths = [];

for (let y = 2; y < height - 2; y++) {
  for (let x = 2; x < width - 2; x++) {
    const startIdx = y * width + x;
    if (!thin[startIdx] || visited[startIdx]) continue;

    let curr = startIdx;
    let prev = -1;
    const pts = [];

    while (curr >= 0 && !visited[curr]) {
      visited[curr] = 1;
      const px = curr % width;
      const py = Math.floor(curr / width);
      pts.push([px, py]);

      let next = -1;
      let best = -Infinity;
      for (const d of neighbors) {
        const n = curr + d;
        if (n < 0 || n >= count || !thin[n] || visited[n]) continue;
        const nx = n % width;
        const ny = Math.floor(n / width);
        const score = prev < 0 ? mag[n] : (nx - px) * (px - (prev % width)) + (ny - py) * (py - Math.floor(prev / width));
        if (score > best) {
          best = score;
          next = n;
        }
      }
      prev = curr;
      curr = next;
    }

    if (pts.length >= 8) {
      // Subsample smoothly every 2 points to keep curves sleek, delicate, and lightweight
      const sampled = pts.filter((_, idx) => idx % 2 === 0 || idx === pts.length - 1);
      rawPaths.push(sampled);
    }
  }
}

// Sort by length descending, pick top 540 paths for delicate rich details
rawPaths.sort((a, b) => b.length - a.length);
const selectedPaths = rawPaths.slice(0, 540);

console.log(`Found ${rawPaths.length} raw paths, selected top ${selectedPaths.length} paths.`);

const outputCode = `window.CONTOUR_PATHS = ${JSON.stringify(selectedPaths)};\n`;
fs.writeFileSync('assets/contours.js', outputCode, 'utf8');
fs.writeFileSync('assets/elaina-contours.js', outputCode, 'utf8');
console.log('Saved assets/contours.js and assets/elaina-contours.js successfully. File size:', outputCode.length);
