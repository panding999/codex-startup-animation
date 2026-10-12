import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { installRenderer } from './renderer.mjs';

export async function buildInjection(root) {
  const [html, css, skin, settings, contours, animation, avatar, artwork, videoBuf] = await Promise.all([
    'index.html',
    'style.css',
    'extension/wallpaper.css',
    'image-settings.js',
    'assets/contours.js',
    'animation.js',
    'assets/avatar.jpg',
    'assets/artwork.jpg',
    'assets/startup-video.mp4'
  ].map(name => readFile(join(root, name))));

  const payload = {
    html: html.toString()
      .replace(/<!doctype[^>]*>/ig, '')
      .replace(/<html[^>]*>|<\/html>/ig, '')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/ig, '')
      .replace(/<link\b[^>]*>/ig, '')
      .replace(/<meta\b[^>]*http-equiv[^>]*>/ig, '')
      .replace(/src="assets\/[^"]*"/g, 'src=""'),
    css: css.toString(),
    skin: skin.toString(),
    assets: {
      avatar: 'data:image/jpeg;base64,' + avatar.toString('base64'),
      artwork: 'data:image/jpeg;base64,' + artwork.toString('base64'),
      videoBase64: videoBuf.toString('base64')
    },
    diskConfig: await readFile(join(root, 'assets/user-config.json'), 'utf8')
      .then(t => JSON.parse(t))
      .catch(() => null)
  };

  const mount = `function(window) {
    const document = window.document, location = window.location, performance = window.performance, indexedDB = window.indexedDB, Image = window.Image, Path2D = window.Path2D, URL = window.URL, module = undefined;
    const requestAnimationFrame = window.requestAnimationFrame.bind(window), cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
    ${settings}
    ${contours}
    ${animation}
  }`;

  return `(${installRenderer.toString()})(${JSON.stringify(payload)}, ${mount})`;
}
