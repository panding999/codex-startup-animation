(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const escapeHtml = str => str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  
  let TOTAL_DURATION = 12500;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const embedded = window.parent !== window && (window.ANTIGRAVITY_EXTERNAL || window.AEMEATH_EXTERNAL || new URLSearchParams(location.search).has('embedded'));

  const defaultAssets = {
    artwork: 'assets/artwork.jpg',
    avatar: 'assets/avatar.jpg',
    video: 'assets/startup-video.mp4'
  };
  const assets = window.ANTIGRAVITY_ASSETS || window.AEMEATH_ASSETS || defaultAssets;

  if (embedded) document.body.classList.add('embedded');

  // DOM Elements
  const stage = $('#character-stage') || $('.character-stage');
  const video = $('.character-video');
  const artwork = $('.character-artwork');
  const canvas = $('.character-canvas');
  const scanline = $('.scanline-laser');
  const orbitalSystem = $('.orbital-system');
  const meteorsLayer = $('.meteors-layer');
  const codeStream = $('#code-stream');
  const ambientGlow = $('.ambient-glow');
  const ratioText = $('#ratio');
  const syncBar = $('#sync-bar');
  const bottomProgress = $('#bottom-progress');
  const syncStatus = $('#sync-status');
  const timecode = $('#timecode');
  const flash = $('.transition-flash');
  const shutter = $('.shutter-line');
  const slider = $('#timeline');
  const pauseBtn = $('#pause');
  const replayBtn = $('#replay');
  const elapsedOut = $('#elapsed');
  const dialog = $('#settings-dialog');
  const wallpaperSlider = $('#wallpaper-strength');
  const wallpaperValue = $('#wallpaper-value');
  const themeSelect = $('#theme-preset');
  const editorOpacitySlider = $('#editor-opacity');
  const editorOpacityValue = $('#editor-opacity-value');

  // Ensure default media paths are populated immediately (vital for embedded iframe mode)
  if (video && (!video.getAttribute('src') || video.getAttribute('src') === '')) {
    video.src = assets.video;
  }
  if (artwork && (!artwork.getAttribute('src') || artwork.getAttribute('src') === '')) {
    artwork.src = assets.artwork;
  }

  if (slider) slider.max = String(TOTAL_DURATION / 1000);

  // Math Helpers
  const clamp = n => Math.max(0, Math.min(1, n));
  const smooth = n => { const t = clamp(n); return t * t * (3 - 2 * t); };

  // Playback State
  let playing = false;
  let elapsed = 0;
  let origin = 0;
  let frame = 0;
  let completed = false;
  let userConfig = null;
  let wallpaperStrength = 40;
  let editorOpacity = 82;
  let currentThemePreset = 'elaina';
  let autoPalette = null;

  const send = (action, details = {}) => {
    const data = { type: 'antigravity-boot', action, ...details };
    if (window.ANTIGRAVITY_SEND) {
      window.ANTIGRAVITY_SEND(data);
    } else if (window.AEMEATH_SEND) {
      window.AEMEATH_SEND(data);
    } else if (embedded) {
      window.parent.postMessage(data, '*');
    }
  };

  // 49 Authentic Sci-Fi Script Lines Matching the Original TikTok Reference Video
  const CODE_LINES = [
    { text: "// 凝神静气 · 开启星脉", type: "comment" },
    { text: "const seed = 'ocean://memory';", type: "code", tokens: [
      { t: "keyword", v: "const " }, { t: "ident", v: "seed" }, { t: "op", v: " = " }, { t: "string", v: "'ocean://memory'" }, { t: "op", v: ";" }
    ]},
    { text: "await boot(seed); // neural matrix online", type: "code", tokens: [
      { t: "keyword", v: "await " }, { t: "fn", v: "boot" }, { t: "op", v: "(" }, { t: "ident", v: "seed" }, { t: "op", v: "); " }, { t: "comment", v: "// neural matrix online" }
    ]},
    { text: "const clock = sync('neural');", type: "code", tokens: [
      { t: "keyword", v: "const " }, { t: "ident", v: "clock" }, { t: "op", v: " = " }, { t: "fn", v: "sync" }, { t: "op", v: "(" }, { t: "string", v: "'neural'" }, { t: "op", v: ");" }
    ]},
    { text: "clock.rate = 60; // synchronize light particles", type: "code", tokens: [
      { t: "ident", v: "clock" }, { t: "op", v: "." }, { t: "prop", v: "rate" }, { t: "op", v: " = " }, { t: "number", v: "60" }, { t: "op", v: "; " }, { t: "comment", v: "// synchronize light particles" }
    ]},
    { text: "// 光子阵列 · 信号连入", type: "comment" },
    { text: "const photons = collect('cyan');", type: "code", tokens: [
      { t: "keyword", v: "const " }, { t: "ident", v: "photons" }, { t: "op", v: " = " }, { t: "fn", v: "collect" }, { t: "op", v: "(" }, { t: "string", v: "'cyan'" }, { t: "op", v: ");" }
    ]},
    { text: "photons.spread(0.72);", type: "code", tokens: [
      { t: "ident", v: "photons" }, { t: "op", v: "." }, { t: "fn", v: "spread" }, { t: "op", v: "(" }, { t: "number", v: "0.72" }, { t: "op", v: ");" }
    ]},
    { text: "await photons.align(); // spectrum calibrated", type: "code", tokens: [
      { t: "keyword", v: "await " }, { t: "ident", v: "photons" }, { t: "op", v: "." }, { t: "fn", v: "align" }, { t: "op", v: "(); " }, { t: "comment", v: "// spectrum calibrated" }
    ]},
    { text: "// 搜集微光 · 重建轮廓", type: "comment" },
    { text: "const light = scan('hair');", type: "code", tokens: [
      { t: "keyword", v: "const " }, { t: "ident", v: "light" }, { t: "op", v: " = " }, { t: "fn", v: "scan" }, { t: "op", v: "(" }, { t: "string", v: "'hair'" }, { t: "op", v: ");" }
    ]},
    { text: "await light.trace(); // luminous strands rebuilt", type: "code", tokens: [
      { t: "keyword", v: "await " }, { t: "ident", v: "light" }, { t: "op", v: "." }, { t: "fn", v: "trace" }, { t: "op", v: "(); " }, { t: "comment", v: "// luminous strands rebuilt" }
    ]},
    { text: "light.edge = 0.85;", type: "code", tokens: [
      { t: "ident", v: "light" }, { t: "op", v: "." }, { t: "prop", v: "edge" }, { t: "op", v: " = " }, { t: "number", v: "0.85" }, { t: "op", v: ";" }
    ]},
    { text: "light.tint = ['cyan', 'violet', 'ice'];", type: "code", tokens: [
      { t: "ident", v: "light" }, { t: "op", v: "." }, { t: "prop", v: "tint" }, { t: "op", v: " = [" }, { t: "string", v: "'cyan'" }, { t: "op", v: ", " }, { t: "string", v: "'violet'" }, { t: "op", v: ", " }, { t: "string", v: "'ice'" }, { t: "op", v: "];" }
    ]},
    { text: "// 深空链路 · 初始化", type: "comment" },
    { text: "const link = connect('deep-space');", type: "code", tokens: [
      { t: "keyword", v: "const " }, { t: "ident", v: "link" }, { t: "op", v: " = " }, { t: "fn", v: "connect" }, { t: "op", v: "(" }, { t: "string", v: "'deep-space'" }, { t: "op", v: ");" }
    ]},
    { text: "await link.listen();", type: "code", tokens: [
      { t: "keyword", v: "await " }, { t: "ident", v: "link" }, { t: "op", v: "." }, { t: "fn", v: "listen" }, { t: "op", v: "();" }
    ]},
    { text: "link.signal = 1.0;", type: "code", tokens: [
      { t: "ident", v: "link" }, { t: "op", v: "." }, { t: "prop", v: "signal" }, { t: "op", v: " = " }, { t: "number", v: "1.0" }, { t: "op", v: ";" }
    ]},
    { text: "// 解码记忆图谱 · 密集与网格星脉同步", type: "comment" },
    { text: "const face = await decode(); // resolve topology", type: "code", tokens: [
      { t: "keyword", v: "const " }, { t: "ident", v: "face" }, { t: "op", v: " = " }, { t: "keyword", v: "await " }, { t: "fn", v: "decode" }, { t: "op", v: "(); " }, { t: "comment", v: "// resolve topology" }
    ]},
    { text: "face.mesh({ density: 0.96 });", type: "code", tokens: [
      { t: "ident", v: "face" }, { t: "op", v: "." }, { t: "fn", v: "mesh" }, { t: "op", v: "({ " }, { t: "prop", v: "density" }, { t: "op", v: ": " }, { t: "number", v: "0.96" }, { t: "op", v: " });" }
    ]},
    { text: "face.resolve();", type: "code", tokens: [
      { t: "ident", v: "face" }, { t: "op", v: "." }, { t: "fn", v: "resolve" }, { t: "op", v: "();" }
    ]},
    { text: "// 曼陀罗线 · 浮现重绘", type: "comment" },
    { text: "const contour = trace('silhouette');", type: "code", tokens: [
      { t: "keyword", v: "const " }, { t: "ident", v: "contour" }, { t: "op", v: " = " }, { t: "fn", v: "trace" }, { t: "op", v: "(" }, { t: "string", v: "'silhouette'" }, { t: "op", v: ");" }
    ]},
    { text: "contour.smooth(0.92); // preserve silhouette", type: "code", tokens: [
      { t: "ident", v: "contour" }, { t: "op", v: "." }, { t: "fn", v: "smooth" }, { t: "op", v: "(" }, { t: "number", v: "0.92" }, { t: "op", v: "); " }, { t: "comment", v: "// preserve silhouette" }
    ]},
    { text: "await contour.reveal();", type: "code", tokens: [
      { t: "keyword", v: "await " }, { t: "ident", v: "contour" }, { t: "op", v: "." }, { t: "fn", v: "reveal" }, { t: "op", v: "();" }
    ]},
    { text: "// 速度穿越 · 硝烟四散", type: "comment" },
    { text: "const trails = emit('stardust');", type: "code", tokens: [
      { t: "keyword", v: "const " }, { t: "ident", v: "trails" }, { t: "op", v: " = " }, { t: "fn", v: "emit" }, { t: "op", v: "(" }, { t: "string", v: "'stardust'" }, { t: "op", v: ");" }
    ]},
    { text: "trails.velocity = 0.86;", type: "code", tokens: [
      { t: "ident", v: "trails" }, { t: "op", v: "." }, { t: "prop", v: "velocity" }, { t: "op", v: " = " }, { t: "number", v: "0.86" }, { t: "op", v: ";" }
    ]},
    { text: "trails.palette = light.tint;", type: "code", tokens: [
      { t: "ident", v: "trails" }, { t: "op", v: "." }, { t: "prop", v: "palette" }, { t: "op", v: " = " }, { t: "ident", v: "light" }, { t: "op", v: "." }, { t: "prop", v: "tint" }, { t: "op", v: ";" }
    ]},
    { text: "await trails.cross();", type: "code", tokens: [
      { t: "keyword", v: "await " }, { t: "ident", v: "trails" }, { t: "op", v: "." }, { t: "fn", v: "cross" }, { t: "op", v: "();" }
    ]},
    { text: "// 凝神静气 · 开启星脉", type: "comment" },
    { text: "await eyes.open(0.85); // iris aperture synchronized", type: "code", tokens: [
      { t: "keyword", v: "await " }, { t: "ident", v: "eyes" }, { t: "op", v: "." }, { t: "fn", v: "open" }, { t: "op", v: "(" }, { t: "number", v: "0.85" }, { t: "op", v: "); " }, { t: "comment", v: "// iris aperture synchronized" }
    ]},
    { text: "const pulse = connect('iris');", type: "code", tokens: [
      { t: "keyword", v: "const " }, { t: "ident", v: "pulse" }, { t: "op", v: " = " }, { t: "fn", v: "connect" }, { t: "op", v: "(" }, { t: "string", v: "'iris'" }, { t: "op", v: ");" }
    ]},
    { text: "pulse.glow('cyan');", type: "code", tokens: [
      { t: "ident", v: "pulse" }, { t: "op", v: "." }, { t: "fn", v: "glow" }, { t: "op", v: "(" }, { t: "string", v: "'cyan'" }, { t: "op", v: ");" }
    ]},
    { text: "// 灵犀核心 · 视觉定焦", type: "comment" },
    { text: "pulse.phase = clock.phase;", type: "code", tokens: [
      { t: "ident", v: "pulse" }, { t: "op", v: "." }, { t: "prop", v: "phase" }, { t: "op", v: " = " }, { t: "ident", v: "clock" }, { t: "op", v: "." }, { t: "prop", v: "phase" }, { t: "op", v: ";" }
    ]},
    { text: "pulse.bloom(0.72);", type: "code", tokens: [
      { t: "ident", v: "pulse" }, { t: "op", v: "." }, { t: "fn", v: "bloom" }, { t: "op", v: "(" }, { t: "number", v: "0.72" }, { t: "op", v: ");" }
    ]},
    { text: "await pulse.stabilize();", type: "code", tokens: [
      { t: "keyword", v: "await " }, { t: "ident", v: "pulse" }, { t: "op", v: "." }, { t: "fn", v: "stabilize" }, { t: "op", v: "();" }
    ]},
    { text: "// 闭目沉思之境已尽 · 浮光跃金迎客往来", type: "comment" },
    { text: "scene.attach(face);", type: "code", tokens: [
      { t: "ident", v: "scene" }, { t: "op", v: "." }, { t: "fn", v: "attach" }, { t: "op", v: "(" }, { t: "ident", v: "face" }, { t: "op", v: ");" }
    ]},
    { text: "scene.depth = 'quiet';", type: "code", tokens: [
      { t: "ident", v: "scene" }, { t: "op", v: "." }, { t: "prop", v: "depth" }, { t: "op", v: " = " }, { t: "string", v: "'quiet'" }, { t: "op", v: ";" }
    ]},
    { text: "scene.focus = eyes.center;", type: "code", tokens: [
      { t: "ident", v: "scene" }, { t: "op", v: "." }, { t: "prop", v: "focus" }, { t: "op", v: " = " }, { t: "ident", v: "eyes" }, { t: "op", v: "." }, { t: "prop", v: "center" }, { t: "op", v: ";" }
    ]},
    { text: "// 镜头拉远至正常比例 · 并在此处开始播放", type: "comment" },
    { text: "await scene.zoomOut({ duration: 'normal', scale: 1.0 });", type: "code", tokens: [
      { t: "keyword", v: "await " }, { t: "ident", v: "scene" }, { t: "op", v: "." }, { t: "fn", v: "zoomOut" }, { t: "op", v: "({ " }, { t: "prop", v: "duration" }, { t: "op", v: ": " }, { t: "string", v: "'normal'" }, { t: "op", v: ", " }, { t: "prop", v: "scale" }, { t: "op", v: ": " }, { t: "number", v: "1.0" }, { t: "op", v: " });" }
    ]},
    { text: "await scene.playVideo();", type: "code", tokens: [
      { t: "keyword", v: "await " }, { t: "ident", v: "scene" }, { t: "op", v: "." }, { t: "fn", v: "playVideo" }, { t: "op", v: "();" }
    ]},
    { text: "trails.release();", type: "code", tokens: [
      { t: "ident", v: "trails" }, { t: "op", v: "." }, { t: "fn", v: "release" }, { t: "op", v: "();" }
    ]},
    { text: "await sync('consciousness');", type: "code", tokens: [
      { t: "keyword", v: "await " }, { t: "fn", v: "sync" }, { t: "op", v: "(" }, { t: "string", v: "'consciousness'" }, { t: "op", v: ");" }
    ]},
    { text: "await scene.ready(); // consciousness online", type: "code", tokens: [
      { t: "keyword", v: "await " }, { t: "ident", v: "scene" }, { t: "op", v: "." }, { t: "fn", v: "ready" }, { t: "op", v: "(); " }, { t: "comment", v: "// consciousness online" }
    ]}
  ];

  function renderLineHTML(line, charCount, isTyping) {
    if (line.type === 'comment') {
      const text = line.text.slice(0, charCount);
      return `<span class="tok-comment">${escapeHtml(text)}</span>${isTyping ? '<span class="tok-cursor"></span>' : ''}`;
    }
    let remaining = charCount;
    let html = '';
    for (const token of line.tokens) {
      if (remaining <= 0) break;
      const chunk = token.v.slice(0, remaining);
      remaining -= chunk.length;
      let cls = '';
      if (token.t === 'keyword') cls = 'tok-keyword';
      else if (token.t === 'fn') cls = 'tok-fn';
      else if (token.t === 'string') cls = 'tok-string';
      else if (token.t === 'number') cls = 'tok-number';
      else if (token.t === 'prop') cls = 'tok-prop';
      else if (token.t === 'op') cls = 'tok-op';
      else if (token.t === 'comment') cls = 'tok-comment';
      else cls = 'tok-ident';
      html += cls ? `<span class="${cls}">${escapeHtml(chunk)}</span>` : escapeHtml(chunk);
    }
    if (isTyping) {
      html += '<span class="tok-cursor"></span>';
    }
    return html;
  }

  // ========================================================
  // CHARACTER OUTLINE & NEURAL AWAKENING ENGINE
  // ========================================================
  let preparedPaths = [];
  let totalContourLength = 0;
  let contourGradient = null;

  function initContours(rawPaths) {
    if (!Array.isArray(rawPaths)) return;
    totalContourLength = 0;

    preparedPaths = rawPaths.map(points => {
      if (!points || points.length < 2) return null;
      let len = 0;
      let minY = 9999;
      for (let i = 1; i < points.length; i++) {
        len += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
        if (points[i][1] < minY) minY = points[i][1];
      }
      totalContourLength += len;
      const path2d = new Path2D();
      if (points.length < 3) {
        points.forEach((p, idx) => idx ? path2d.lineTo(p[0], p[1]) : path2d.moveTo(p[0], p[1]));
      } else {
        path2d.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length - 1; i++) {
          const xc = (points[i][0] + points[i + 1][0]) / 2;
          const yc = (points[i][1] + points[i + 1][1]) / 2;
          path2d.quadraticCurveTo(points[i][0], points[i][1], xc, yc);
        }
        path2d.lineTo(points[points.length - 1][0], points[points.length - 1][1]);
      }
      const isMain = len >= 160;
      return { points, total: len, minY, path2d, isMain };
    }).filter(Boolean);
  }

  if (window.CONTOUR_PATHS) {
    initContours(window.CONTOUR_PATHS);
  }


  // Draw Neon Contours with Progressive Scanline Reveal (Samsung Wonderland Edge Style)
  const ctx = canvas?.getContext('2d');
  function drawNeonContours(t) {
    if (!ctx || !preparedPaths.length) return;

    // Auto-hide character contours cleanly once video takes over to ensure 100% lag-free playback
    if (t >= 4000) {
      if (canvas) {
        if (canvas.style.opacity !== '0') canvas.style.opacity = '0';
        if (canvas.style.display !== 'none') canvas.style.display = 'none';
      }
      if (scanline && scanline.style.opacity !== '0') scanline.style.opacity = '0';
      return;
    }

    if (canvas && canvas.style.display === 'none') {
      canvas.style.display = 'block';
    }

    ctx.clearRect(0, 0, 1920, 1080);

    if (!contourGradient) {
      contourGradient = ctx.createLinearGradient(0, 40, 0, 1060);
      contourGradient.addColorStop(0.00, '#fde047'); // Bright golden yellow (top cowlick & hair strands)
      contourGradient.addColorStop(0.18, '#fb923c'); // Warm sunset orange
      contourGradient.addColorStop(0.36, '#f472b6'); // Rose pink / magenta
      contourGradient.addColorStop(0.58, '#c084fc'); // Electric purple / violet
      contourGradient.addColorStop(0.80, '#38bdf8'); // Sky neon cyan
      contourGradient.addColorStop(1.00, '#22d3ee'); // Bright electric teal
    }

    // Top-to-Bottom Neural Scanline Laser Sweep (0s to 3.5s)
    let scanY = 1080;
    if (t < 3500) {
      scanY = (t / 3500) * 1080;
      if (scanline) {
        scanline.style.opacity = '1';
        scanline.style.top = `${((scanY / 1080) * 100).toFixed(2)}%`;
      }
    } else {
      if (scanline) scanline.style.opacity = '0';
    }

    const drawRatio = clamp(t / 3500);
    const targetLen = drawRatio * totalContourLength;

    // Smooth soft fadeout as video blooms into full focus (3.5s - 4.0s)
    const contourFade = t < 3500 ? 1.0 : Math.max(0, 1.0 - (t - 3500) / 500);
    if (canvas) canvas.style.opacity = String(contourFade);

    // Wonderland Edge Dynamic Shimmer Pulse (always vivid and luminous)
    const edgePulse = 0.94 + 0.06 * Math.sin(t * 0.007);
    const alpha1 = edgePulse * contourFade;

    ctx.save();
    // Clip strictly to scanY so no lines appear below the laser sweep
    ctx.beginPath();
    ctx.rect(0, 0, 1920, Math.min(1080, scanY));
    ctx.clip();

    // Pass 1: Delicate Chromatic Neon Filament (Thinner main lines ~0.95px, fine details ~0.50px)
    ctx.save();
    ctx.strokeStyle = contourGradient;
    ctx.globalAlpha = alpha1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    let accum1 = 0;
    for (const p of preparedPaths) {
      if (accum1 >= targetLen) break;
      if (t < 3500 && p.minY > scanY) continue;
      ctx.lineWidth = p.isMain ? 0.95 : 0.50;
      const avail = targetLen - accum1;
      if (avail >= p.total) {
        ctx.setLineDash([]);
        ctx.stroke(p.path2d);
        accum1 += p.total;
      } else {
        ctx.setLineDash([avail, p.total]);
        ctx.stroke(p.path2d);
        accum1 += avail;
        break;
      }
    }
    ctx.restore();

    // Pass 2: Ultra-crisp Laser White Filament Core (Main ~0.40px, details ~0.22px)
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 0.95 * alpha1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    let accum2 = 0;
    for (const p of preparedPaths) {
      if (accum2 >= targetLen) break;
      if (t < 3500 && p.minY > scanY) continue;
      ctx.lineWidth = p.isMain ? 0.40 : 0.22;
      const avail = targetLen - accum2;
      if (avail >= p.total) {
        ctx.setLineDash([]);
        ctx.stroke(p.path2d);
        accum2 += p.total;
      } else {
        ctx.setLineDash([avail, p.total]);
        ctx.stroke(p.path2d);
        accum2 += avail;
        break;
      }
    }
    ctx.restore();

    // Laser contact flare along the scanline
    if (t < 3500) {
      ctx.save();
      const contactGrad = ctx.createLinearGradient(0, scanY - 3, 0, scanY + 3);
      contactGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
      contactGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.85)');
      contactGrad.addColorStop(1, 'rgba(192, 132, 252, 0)');
      ctx.fillStyle = contactGrad;
      ctx.fillRect(0, scanY - 2, 1920, 4);
      ctx.restore();
    }

    ctx.restore();
  }

  // Master Timeline Render Loop
  let lastLineIndex = -1;
  let lastCharCount = -1;

  function render(t) {
    // 1. Timecode & Progress Ratio
    const sec = Math.floor(t / 1000);
    const cs = Math.floor((t % 1000) / 10);
    if (timecode) timecode.textContent = `00:${String(sec).padStart(2, '0')}:${String(cs).padStart(2, '0')}`;
    if (elapsedOut) elapsedOut.innerHTML = `${(t / 1000).toFixed(1)} <span>/ ${(TOTAL_DURATION / 1000).toFixed(1)}s</span>`;
    if (slider && !slider.matches(':active')) slider.value = String(t / 1000);

    const progressRatio = clamp(t / (TOTAL_DURATION - 800));
    const pct = (progressRatio * 100).toFixed(2);
    if (ratioText) ratioText.textContent = `${pct}%`;
    if (syncBar) syncBar.style.width = `${pct}%`;
    if (bottomProgress) bottomProgress.style.width = `${pct}%`;

    // 2. Status Text
    if (syncStatus) {
      if (t < 2000) syncStatus.textContent = 'INITIALIZING NEURAL LINK';
      else if (t < 3500) syncStatus.textContent = 'PHOTON MATRIX CALIBRATION';
      else if (t < 6500) syncStatus.textContent = 'RECONSTRUCTING TOPOLOGY';
      else if (t < 9500) syncStatus.textContent = 'SYNCHRONIZING CONSCIOUSNESS';
      else syncStatus.textContent = 'SYSTEM ONLINE // AWAKENING COMPLETE';
    }

    // 3. Dynamic Camera Zoom Engine:
    // Starts zoomed-in close on the upper head (scale 1.78, translate(-6%, -5%))
    // Smoothly zooms out between 3.5s and 8.5s down to normal framing (scale 1.0, translate(0, 0))
    if (stage) {
      if (t <= 3500) {
        stage.style.transform = 'scale(1.78) translate(-6%, -5%)';
      } else if (t <= 8500) {
        const alpha = smooth((t - 3500) / 5000);
        const scale = 1.78 - 0.78 * alpha;
        const tx = -6 * (1 - alpha);
        const ty = -5 * (1 - alpha);
        stage.style.transform = `scale(${scale.toFixed(4)}) translate(${tx.toFixed(2)}%, ${ty.toFixed(2)}%)`;
      } else {
        stage.style.transform = 'scale(1) translate(0%, 0%)';
      }
    }

    // 4. Pitch-Black Character Laser Reveal (Starts pitch black, scans top-to-bottom and clarifies)
    if (artwork) {
      if (t < 3500) {
        const scanY = (t / 3500) * 1080;
        const scanPct = ((scanY / 1080) * 100).toFixed(2);
        const brightnessVal = (0.50 + 0.50 * (t / 3500)).toFixed(2);
        artwork.style.opacity = '1';
        artwork.style.filter = `contrast(1.15) brightness(${brightnessVal})`;
        artwork.style.clipPath = `polygon(0 0, 100% 0, 100% ${scanPct}%, 0 ${scanPct}%)`;
        artwork.style.webkitClipPath = `polygon(0 0, 100% 0, 100% ${scanPct}%, 0 ${scanPct}%)`;
      } else if (t <= 4500) {
        artwork.style.clipPath = 'none';
        artwork.style.webkitClipPath = 'none';
        artwork.style.filter = 'none';
        const fade = smooth((t - 3500) / 1000);
        artwork.style.opacity = String(1.0 - fade);
      } else {
        artwork.style.clipPath = 'none';
        artwork.style.webkitClipPath = 'none';
        artwork.style.filter = 'none';
        artwork.style.opacity = '0';
      }
    }

    // Celestial FX (Orbital rings, meteors & ambient glow) bloom ONLY after the laser scan finishes!
    if (t < 3500) {
      if (orbitalSystem) orbitalSystem.style.opacity = '0';
      if (meteorsLayer) meteorsLayer.style.opacity = '0';
      if (ambientGlow) ambientGlow.style.opacity = '0';
    } else {
      const fxBloom = smooth((t - 3500) / 1200);
      if (orbitalSystem) orbitalSystem.style.opacity = String(fxBloom);
      if (meteorsLayer) meteorsLayer.style.opacity = String(fxBloom);
      if (ambientGlow) ambientGlow.style.opacity = String(0.12 + 0.35 * fxBloom);
    }

    // Auto-hide character contours after video takes over
    if (t < 4000) {
      drawNeonContours(t);
    } else {
      if (canvas && canvas.style.display !== 'none') {
        canvas.style.opacity = '0';
        canvas.style.display = 'none';
        if (ctx) ctx.clearRect(0, 0, 1920, 1080);
      }
      if (scanline && scanline.style.opacity !== '0') {
        scanline.style.opacity = '0';
      }
    }

    // 5. Live Video Playback (Starts cleanly from 0.0s right when laser reveal finishes and camera zooms out)
    if (video) {
      if (t < 3500) {
        video.style.opacity = '0';
        if (!video.paused) video.pause();
        if (video.currentTime !== 0) video.currentTime = 0;
      } else {
        const videoFade = smooth((t - 3500) / 1000);
        video.style.opacity = String(videoFade);

        if (video.duration && isFinite(video.duration)) {
          const targetVideoTime = Math.min(video.duration, (t - 3500) / 1000);
          if (Math.abs(video.currentTime - targetVideoTime) > 1.5) {
            video.currentTime = targetVideoTime;
          }
        }
        if (playing && video.paused) {
          video.play().catch(() => {});
        }
      }
    }

    // 6. Live Code Terminal Typewriter (Flows all the way down full vertical screen)
    if (codeStream) {
      const codeStart = 60;
      const codeEnd = 10500;
      const totalLines = CODE_LINES.length;

      let currentLineIdx = -1;
      let currentCharCount = 0;

      if (t >= codeStart) {
        const lineFraction = clamp((t - codeStart) / (codeEnd - codeStart)) * totalLines;
        currentLineIdx = Math.min(totalLines - 1, Math.floor(lineFraction));
        const withinLineProgress = clamp(lineFraction - currentLineIdx);
        const activeLineObj = CODE_LINES[currentLineIdx];
        currentCharCount = Math.floor(withinLineProgress * activeLineObj.text.length);
      }

      if (currentLineIdx !== lastLineIndex || currentCharCount !== lastCharCount) {
        lastLineIndex = currentLineIdx;
        lastCharCount = currentCharCount;

        let linesHTML = '';
        for (let i = 0; i <= currentLineIdx; i++) {
          const l = CODE_LINES[i];
          const isCurrent = i === currentLineIdx;
          const chars = isCurrent ? currentCharCount : l.text.length;
          linesHTML += `<div class="code-line">${renderLineHTML(l, chars, isCurrent)}</div>`;
        }
        codeStream.innerHTML = linesHTML;
        codeStream.scrollTop = codeStream.scrollHeight;
      }

      // Dim left code stream slightly as character awakes to draw full focus
      if (t >= 7500) {
        codeStream.style.opacity = '0.72';
      } else {
        codeStream.style.opacity = '1';
      }
    }

    // 8. Climax Shutter & Flash into Antigravity
    const shutterStart = 10800;
    if (t >= shutterStart) {
      if (shutter) {
        shutter.style.opacity = '1';
        shutter.style.transform = `scaleX(${clamp((t - shutterStart) / 600)})`;
      }
      if (flash) {
        const fProg = clamp((t - shutterStart) / 550);
        const fFade = Math.max(0, 1 - (t - (shutterStart + 550)) / 450);
        flash.style.opacity = String(smooth(fProg) * fFade);
      }
    } else {
      if (shutter) shutter.style.opacity = '0';
      if (flash) flash.style.opacity = '0';
    }

    // 9. Completion Check
    if (t >= TOTAL_DURATION && !completed) {
      completed = true;
      send('complete', { videoTime: video ? video.currentTime : 0 });
      if (!embedded) {
        pause();
      }
    }
  }

  function tick(timestamp) {
    if (!playing) return;
    elapsed = timestamp - origin;
    if (elapsed > TOTAL_DURATION) elapsed = TOTAL_DURATION;
    render(elapsed);
    if (elapsed < TOTAL_DURATION) {
      frame = requestAnimationFrame(tick);
    }
  }

  function play() {
    if (completed && elapsed >= TOTAL_DURATION) {
      elapsed = 0;
      completed = false;
      lastLineIndex = -1;
      if (canvas) {
        canvas.style.display = 'block';
        canvas.style.opacity = '1';
      }
    }
    playing = true;
    origin = performance.now() - elapsed;
    if (pauseBtn) pauseBtn.textContent = 'Tạm dừng';
    if (video) {
      if (elapsed >= 3200) {
        video.play().catch(() => {});
      } else {
        video.pause();
        video.currentTime = 0;
      }
    }
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(tick);
  }

  function pause() {
    playing = false;
    cancelAnimationFrame(frame);
    if (pauseBtn) pauseBtn.textContent = 'Tiếp tục';
    if (video) video.pause();
  }

  function seek(targetMs) {
    elapsed = Math.max(0, Math.min(TOTAL_DURATION, targetMs));
    origin = performance.now() - elapsed;
    lastLineIndex = -1;
    if (elapsed < 3200 && canvas) {
      canvas.style.display = 'block';
      canvas.style.opacity = '1';
    }
    render(elapsed);
    if (video && video.duration) {
      video.currentTime = elapsed < 3200 ? 0 : Math.min(video.duration, (elapsed - 3200) / 1000);
    }
  }

  function restart() {
    pause();
    completed = false;
    lastLineIndex = -1;
    seek(0);
    play();
  }

  function getActivePalette() {
    if (currentThemePreset === 'auto') {
      if (autoPalette) return autoPalette;
      if (window.imageSettings?.extractPalette && video && video.readyState >= 2) {
        autoPalette = window.imageSettings.extractPalette(video);
        return autoPalette;
      }
      if (window.imageSettings?.extractPalette && artwork && artwork.complete) {
        autoPalette = window.imageSettings.extractPalette(artwork);
        return autoPalette;
      }
    }
    const presets = window.imageSettings?.THEME_PRESETS;
    if (presets && presets[currentThemePreset]) {
      return presets[currentThemePreset];
    }
    return {
      base: '10 14 26',
      tint: '56 189 248',
      violet: '192 132 252'
    };
  }

  function applyWallpaperSettings() {
    const pal = getActivePalette();
    send('background', {
      strength: wallpaperStrength,
      editorOpacity: editorOpacity,
      themePreset: currentThemePreset,
      palette: pal,
      isVideo: true,
      video: userConfig?.video || assets.video,
      image: userConfig?.artwork || assets.artwork
    });
  }

  async function loadUserConfig() {
    try {
      if (window.imageSettings) {
        userConfig = await window.imageSettings.load();
        if (userConfig.video && video) {
          video.src = userConfig.video;
        } else if (video && (!video.src || video.src.endsWith('/'))) {
          video.src = assets.video;
        }
        if (userConfig.artwork && artwork) {
          artwork.src = userConfig.artwork;
        } else if (artwork && (!artwork.src || artwork.src.endsWith('/'))) {
          artwork.src = assets.artwork;
        }
        if (userConfig.contours) {
          initContours(userConfig.contours);
        }
        if (typeof userConfig.strength === 'number') {
          wallpaperStrength = userConfig.strength;
          if (wallpaperSlider) wallpaperSlider.value = String(wallpaperStrength);
          if (wallpaperValue) wallpaperValue.textContent = `${wallpaperStrength}%`;
        }
        if (typeof userConfig.editorOpacity === 'number') {
          editorOpacity = userConfig.editorOpacity;
          if (editorOpacitySlider) editorOpacitySlider.value = String(editorOpacity);
          if (editorOpacityValue) editorOpacityValue.textContent = `${editorOpacity}%`;
        }
        if (userConfig.themePreset) {
          currentThemePreset = userConfig.themePreset;
          if (themeSelect) themeSelect.value = currentThemePreset;
        }
      }
    } catch (_) {}

    applyWallpaperSettings();
  }

  function setupEvents() {
    // Playback Buttons
    pauseBtn?.addEventListener('click', () => (playing ? pause() : play()));
    replayBtn?.addEventListener('click', restart);

    // Timeline Slider
    slider?.addEventListener('input', e => {
      seek(Number(e.target.value) * 1000);
    });

    // Skip Buttons
    const skip = () => {
      completed = true;
      send('complete', { videoTime: video ? video.currentTime : 0 });
      if (!embedded) {
        seek(TOTAL_DURATION);
      }
    };

    $('.skip')?.addEventListener('click', skip);
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') skip();
      else if (e.code === 'Space' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        playing ? pause() : play();
      }
    });

    // Settings Modal
    $('#image-settings')?.addEventListener('click', () => openSettings());
    $('#settings-dialog form')?.addEventListener('submit', () => send('settings-close'));

    themeSelect?.addEventListener('change', e => {
      currentThemePreset = e.target.value;
      autoPalette = null;
      applyWallpaperSettings();
    });

    editorOpacitySlider?.addEventListener('input', e => {
      editorOpacity = Number(e.target.value);
      if (editorOpacityValue) editorOpacityValue.textContent = `${editorOpacity}%`;
      applyWallpaperSettings();
    });

    wallpaperSlider?.addEventListener('input', e => {
      wallpaperStrength = Number(e.target.value);
      if (wallpaperValue) wallpaperValue.textContent = `${wallpaperStrength}%`;
      applyWallpaperSettings();
    });

    $('#video-file')?.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        $('#settings-status').textContent = 'Đang tải video mới...';
        const res = await window.imageSettings.importVideo(file);
        userConfig = { ...userConfig, video: res.video };
        if (video) video.src = res.video;
        const previewV = $('#video-settings-preview');
        if (previewV) previewV.src = res.video;
        autoPalette = null;
        applyWallpaperSettings();
        $('#settings-status').textContent = 'Đã nạp video thành công.';
      } catch (err) {
        $('#settings-status').textContent = err.message;
      }
    });

    $('#artwork-file')?.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        $('#settings-status').textContent = 'Đang trích xuất nét vẽ Neon từ ảnh...';
        const res = await window.imageSettings.importImage(file, 'artwork');
        userConfig = { ...userConfig, artwork: res.artwork, contours: res.contours };
        if (artwork) artwork.src = res.artwork;
        const previewArt = $('#artwork-preview');
        if (previewArt) previewArt.src = res.artwork;
        initContours(res.contours);
        autoPalette = null;
        applyWallpaperSettings();
        $('#settings-status').textContent = 'Đã trích xuất nét vẽ thành công!';
      } catch (err) {
        $('#settings-status').textContent = err.message;
      }
    });

    dialog?.addEventListener('close', () => send('settings-close'));

    $('#replay-startup')?.addEventListener('click', () => {
      dialog?.close();
      send('settings-close');
      restart();
    });

    $('#preview-images')?.addEventListener('click', async () => {
      try {
        await window.imageSettings.save({
          ...userConfig,
          strength: wallpaperStrength,
          editorOpacity: editorOpacity,
          themePreset: currentThemePreset
        });
        applyWallpaperSettings();
        $('#settings-status').textContent = 'Đã lưu cài đặt và áp dụng theme thành công!';
        dialog?.close();
        send('settings-close');
        if (!embedded) {
          restart();
        }
      } catch (err) {
        $('#settings-status').textContent = err.message;
      }
    });

    $('#reset-images')?.addEventListener('click', async () => {
      try {
        await window.imageSettings.save({});
        $('#settings-status').textContent = 'Đã đặt lại về mặc định.';
        location.reload();
      } catch (_) {}
    });
  }

  function openSettings() {
    if (!dialog) return;
    dialog.showModal();
    send('settings-open');
  }

  async function init() {
    setupEvents();
    await loadUserConfig();

    if (window.ANTIGRAVITY_OPEN_SETTINGS || window.AEMEATH_OPEN_SETTINGS) {
      openSettings();
      send('ready');
      return;
    }

    send('ready');
    const seekParam = new URLSearchParams(location.search).get('seek');
    if (seekParam) {
      const targetS = Number(seekParam);
      seek(targetS * 1000);
      pause();
      if (video) {
        const vidTime = targetS < 3.2 ? 0 : (targetS - 3.2);
        if (video.duration && isFinite(video.duration)) {
          video.currentTime = Math.min(video.duration, vidTime);
        } else {
          video.addEventListener('loadedmetadata', () => {
            video.currentTime = Math.min(video.duration, vidTime);
          }, { once: true });
        }
      }
    } else {
      restart();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.antigravityLauncherUI = {
    openSettings,
    restart,
    seek,
    play,
    pause
  };
})();
