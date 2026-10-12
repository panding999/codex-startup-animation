// Runtime-only appearance layer for Antigravity. No writes to installed binaries.
export function installRenderer(payload, mount) {
  if (window.top !== window) return { installed: false, reason: 'child-frame' };
  if (window.__antigravityExtension) return { installed: true, alreadyActive: true };

  let frame = null, watchdog = 0, observer = null, priorFocus = null, disposed = false;
  let ready = false, completed = false, phase = 'loading', wallpaperURL = null, lastImage = null;
  let liveVideo = null, scrim = null, themeButton = null, pendingBackgroundConfig = null;
  const root = document.documentElement;
  const before = new Map(['--antigravity-wallpaper', '--antigravity-wash'].map(k => [k, [root.style.getPropertyValue(k), root.style.getPropertyPriority(k)]]));
  const originalAttribute = root.getAttribute('data-antigravity-skin');

  // Create persistent Blob URL for video from base64 (completely bypasses Chromium file:/// security restrictions)
  let videoBlobUrl = null;
  if (payload.assets && payload.assets.videoBase64) {
    try {
      const bin = atob(payload.assets.videoBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      videoBlobUrl = URL.createObjectURL(new Blob([bytes], { type: 'video/mp4' }));
      payload.assets.video = videoBlobUrl;
    } catch (err) {
      console.error('Antigravity: Failed to create video blob URL:', err);
    }
  }

  const style = document.createElement('style');
  style.id = 'antigravity-extension-style';
  style.textContent = payload.skin;

  const STORAGE_KEY = 'antigravity_theme_config';

  function saveConfig(data) {
    try {
      if (data && typeof data === 'object') {
        const toSave = {
          strength: data.strength,
          editorOpacity: data.editorOpacity,
          themePreset: data.themePreset,
          palette: data.palette,
          isVideo: data.isVideo,
          video: (typeof data.video === 'string' && !data.video.startsWith('blob:')) ? data.video : undefined,
          image: (typeof data.image === 'string' && !data.image.startsWith('blob:')) ? data.image : undefined
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      }
    } catch (_) {}
  }

  function loadConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return null;
  }

  function removeOverlay() {
    clearTimeout(watchdog);
    observer?.disconnect();
    observer = null;
    frame?.remove();
    frame = null;
    if (priorFocus?.isConnected) priorFocus.focus();
    priorFocus = null;
  }

  function removeLiveVideo() {
    if (liveVideo) {
      liveVideo.remove();
      liveVideo = null;
    }
    if (scrim) {
      scrim.remove();
      scrim = null;
    }
  }

  function removeThemeButton() {
    if (themeButton) {
      themeButton.remove();
      themeButton = null;
    }
  }

  function createThemeButton() {
    if (themeButton || !document.body) return;
    themeButton = document.createElement('button');
    themeButton.id = 'antigravity-theme-toggle-btn';
    themeButton.type = 'button';
    themeButton.title = 'Tùy chỉnh Theme & Live Wallpaper (F4 hoặc Ctrl+Alt+B)';
    themeButton.innerHTML = 'Theme (F4)';
    Object.assign(themeButton.style, {
      position: 'fixed',
      bottom: '10px',
      right: '18px',
      zIndex: '99999',
      padding: '3px 10px',
      fontSize: '11px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontWeight: '500',
      color: '#f1f5f9',
      background: 'rgba(10, 14, 26, 0.85)',
      border: '1px solid rgba(56, 189, 248, 0.4)',
      borderRadius: '16px',
      cursor: 'pointer',
      backdropFilter: 'blur(8px)',
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.45)',
      transition: 'all 0.2s ease',
      opacity: '0.85'
    });
    themeButton.addEventListener('mouseenter', () => {
      themeButton.style.opacity = '1';
      themeButton.style.borderColor = '#38bdf8';
      themeButton.style.boxShadow = '0 0 12px rgba(56, 189, 248, 0.5)';
    });
    themeButton.addEventListener('mouseleave', () => {
      themeButton.style.opacity = '0.85';
      themeButton.style.borderColor = 'rgba(56, 189, 248, 0.4)';
      themeButton.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.45)';
    });
    themeButton.addEventListener('click', () => show(true));
    document.body.appendChild(themeButton);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    removeOverlay();
    removeLiveVideo();
    removeThemeButton();
    style.remove();
    if (videoBlobUrl) URL.revokeObjectURL(videoBlobUrl);
    videoBlobUrl = null;
    if (wallpaperURL) URL.revokeObjectURL(wallpaperURL);
    wallpaperURL = null;
    lastImage = null;
    if (originalAttribute === null) root.removeAttribute('data-antigravity-skin');
    else root.setAttribute('data-antigravity-skin', originalAttribute);
    for (const [key, [value, priority]] of before) {
      if (value) root.style.setProperty(key, value, priority);
      else root.style.removeProperty(key);
    }
    window.removeEventListener('message', message);
    window.removeEventListener('keydown', keyboard, true);
    document.removeEventListener('keydown', keyboard, true);
    delete window.__antigravityExtension;
    delete window.openThemeSettings;
    delete window.antigravitySettings;
  }

  function background(data) {
    if (!data) return;
    pendingBackgroundConfig = data;
    saveConfig(data);

    if (!style.isConnected && document.head) document.head.appendChild(style);

    const strength = Number.isFinite(data.strength) ? Math.max(0, Math.min(75, data.strength)) : 40;
    const editorOpacity = Number.isFinite(data.editorOpacity) ? Math.max(50, Math.min(95, data.editorOpacity)) : 82;

    // Dynamic Video Palette Harmonics (Applies to Tailwind, Monaco, and VS Code tokens)
    if (data.palette) {
      const b = data.palette.base;
      const t = data.palette.tint;
      const v = data.palette.violet;
      const op = (editorOpacity / 100).toFixed(2);

      root.style.setProperty('--antigravity-base', b);
      root.style.setProperty('--antigravity-tint-rgb', t);
      root.style.setProperty('--antigravity-violet-rgb', v);

      // Direct Tailwind UI variable updates on Antigravity workbench
      root.style.setProperty('--color-background', `rgba(${b} / ${op})`);
      root.style.setProperty('--background', `rgba(${b} / ${op})`);
      root.style.setProperty('--sidebar', `rgba(${b} / 0.75)`);
      root.style.setProperty('--color-sidebar-secondary', `rgba(${b} / 0.82)`);
      root.style.setProperty('--color-card', `rgba(${b} / 0.65)`);
      root.style.setProperty('--card', `rgba(${b} / 0.65)`);
      root.style.setProperty('--color-primary', `rgb(${t})`);
      root.style.setProperty('--primary', `rgb(${t})`);
      root.style.setProperty('--color-border', `rgba(${t} / 0.22)`);
      root.style.setProperty('--border', `rgba(${t} / 0.22)`);
      root.style.setProperty('--syntax-comment', '#64748b');
      root.style.setProperty('--syntax-tag', `rgb(${v})`);
      root.style.setProperty('--syntax-attr-name', `rgb(${t})`);
      root.style.setProperty('--syntax-default-fg', '#f1f5f9');
    }
    root.style.setProperty('--antigravity-editor-opacity', String(editorOpacity / 100));

    // Static Image Fallback Support
    if (typeof data.image === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(data.image)) {
      if (strength > 0 && data.image !== lastImage) {
        const comma = data.image.indexOf(','), mime = data.image.slice(5, data.image.indexOf(';'));
        const binary = atob(data.image.slice(comma + 1));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const previous = wallpaperURL;
        wallpaperURL = URL.createObjectURL(new Blob([bytes], { type: mime }));
        lastImage = data.image;
        root.style.setProperty('--antigravity-wallpaper', `url(${JSON.stringify(wallpaperURL)})`);
        if (previous) URL.revokeObjectURL(previous);
      }
    }

    if (strength === 0) {
      root.style.removeProperty('--antigravity-wallpaper');
      if (wallpaperURL) URL.revokeObjectURL(wallpaperURL);
      wallpaperURL = null;
      lastImage = null;
      removeLiveVideo();
    }
    root.style.setProperty('--antigravity-wallpaper-opacity', String(strength / 100));
    root.style.setProperty('--antigravity-wash', String(1 - strength / 100));
    root.toggleAttribute('data-antigravity-skin', strength > 0 || Boolean(data.themePreset));

    // Defer DOM elements (video, scrim, themeButton) if document.body is not yet available
    if (!document.body) return;

    // Live Video Wallpaper Support
    const resolvedVideo = (typeof data.video === 'string' && !data.video.startsWith('blob:'))
      ? data.video
      : (payload.assets?.video || videoBlobUrl);

    if (data.isVideo && resolvedVideo && strength > 0) {
      if (!liveVideo) {
        liveVideo = document.createElement('video');
        liveVideo.id = 'antigravity-live-video-wallpaper';
        liveVideo.setAttribute('muted', '');
        liveVideo.setAttribute('playsinline', '');
        liveVideo.setAttribute('autoplay', '');
        liveVideo.setAttribute('loop', '');
        liveVideo.autoplay = true;
        liveVideo.loop = true;
        liveVideo.muted = true;
        liveVideo.playsInline = true;
        Object.assign(liveVideo.style, {
          position: 'fixed',
          inset: '0',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: '0',
          pointerEvents: 'none',
          willChange: 'transform',
          transform: 'translate3d(0, 0, 0)',
          transition: 'opacity 0.4s ease'
        });
        document.body.appendChild(liveVideo);
      }
      if (!scrim) {
        scrim = document.createElement('div');
        scrim.id = 'antigravity-wallpaper-scrim';
        document.body.appendChild(scrim);
      }
      if (liveVideo.src !== resolvedVideo) {
        liveVideo.src = resolvedVideo;
      }
      liveVideo.style.opacity = String(strength / 100);
      liveVideo.play().catch(() => {});
    } else {
      removeLiveVideo();
    }

    // Ensure floating theme button is rendered
    createThemeButton();
  }

  function show(settings = false) {
    if (disposed || frame) return;
    priorFocus = document.activeElement;
    phase = settings ? 'settings' : 'loading';
    frame = document.createElement('iframe');
    frame.id = 'antigravity-extension-overlay';
    frame.title = 'Antigravity Startup Animation';
    Object.assign(frame.style, {
      position: 'fixed',
      inset: '0',
      width: '100%',
      height: '100%',
      border: '0',
      zIndex: '2147483646',
      background: 'transparent',
      colorScheme: 'dark'
    });

    const current = frame;
    current.addEventListener('load', () => {
      if (frame !== current || disposed) return;
      try {
        const win = current.contentWindow, doc = win.document;
        doc.documentElement.innerHTML = payload.html;
        const css = doc.createElement('style');
        css.textContent = payload.css;
        doc.head.appendChild(css);

        win.ANTIGRAVITY_EXTERNAL = true;
        win.ANTIGRAVITY_ASSETS = payload.assets;
        win.ANTIGRAVITY_OPEN_SETTINGS = settings;
        win.ANTIGRAVITY_SAVED_CONFIG = loadConfig();
        win.ANTIGRAVITY_SEND = data => message({ source: win, data });

        // Backward compatibility
        win.AEMEATH_EXTERNAL = true;
        win.AEMEATH_ASSETS = payload.assets;
        win.AEMEATH_OPEN_SETTINGS = settings;
        win.AEMEATH_SAVED_CONFIG = win.ANTIGRAVITY_SAVED_CONFIG;
        win.AEMEATH_SEND = win.ANTIGRAVITY_SEND;

        mount(win);
        current.focus();
      } catch (err) {
        phase = 'failed';
        console.error('Antigravity extension injection error:', err);
        removeOverlay();
      }
    }, { once: true });

    current.src = 'about:blank';
    document.body.appendChild(current);
    watchdog = setTimeout(() => {
      phase = 'timeout';
      removeOverlay();
    }, 25000);
  }

  function message(event) {
    if (!frame || event.source !== frame.contentWindow) return;
    const data = event.data;
    if (!data || (data.type !== 'antigravity-boot' && data.type !== 'aemeath-boot')) return;

    if (data.action === 'background') background(data);
    if (data.action === 'saveConfig') {
      saveConfig(data.config);
      background(data.config);
    }
    if (data.action === 'ready') { ready = true; phase = 'playing'; }
    if (data.action === 'complete') {
      completed = true;
      phase = 'complete';
      if (liveVideo && Number.isFinite(data.videoTime)) {
        try { liveVideo.currentTime = data.videoTime; } catch (_) {}
      }
      removeOverlay();
      createThemeButton();
    }
    if (data.action === 'assetError') { phase = 'failed'; removeOverlay(); }
    if (data.action === 'settings-close') {
      phase = 'playing';
      clearTimeout(watchdog);
      removeOverlay();
    }
    if (data.action === 'restore') dispose();
  }

  function keyboard(event) {
    // Support F4 key OR Ctrl+Alt+B OR Ctrl+Shift+B OR Cmd+Alt+B
    const isB = event.code === 'KeyB' || event.key?.toLowerCase() === 'b';
    const isF4 = event.key === 'F4' || event.code === 'F4';
    const isCombo = (event.metaKey || event.ctrlKey) && (event.altKey || event.shiftKey) && isB;

    if (isF4 || isCombo) {
      event.preventDefault();
      event.stopPropagation();
      show(true);
    }
  }

  window.addEventListener('message', message);
  window.addEventListener('keydown', keyboard, true);
  document.addEventListener('keydown', keyboard, true);

  window.openThemeSettings = () => show(true);
  window.antigravitySettings = () => show(true);

  window.__antigravityExtension = {
    dispose,
    openSettings: () => show(true),
    status: () => ({
      ready,
      completed,
      phase,
      overlay: Boolean(frame),
      wallpaper: root.hasAttribute('data-antigravity-skin')
    })
  };

  // Restore saved theme or default on startup immediately so theme is persistent across closing & reopening!
  const savedConfig = loadConfig() || payload.diskConfig || {
    strength: 40,
    editorOpacity: 88,
    themePreset: 'aura',
    isVideo: true,
    palette: {
      base: '21 20 27',
      tint: '162 119 255',
      violet: '97 255 202',
      pink: '246 148 255'
    }
  };
  background(savedConfig);

  function onBodyReady() {
    if (pendingBackgroundConfig) {
      background(pendingBackgroundConfig);
    }
    show();
  }

  if (document.body) onBodyReady();
  else {
    observer = new MutationObserver(() => {
      if (document.body) {
        observer.disconnect();
        observer = null;
        onBodyReady();
      }
    });
    observer.observe(document, { childList: true, subtree: true });
  }

  return { installed: true };
}
