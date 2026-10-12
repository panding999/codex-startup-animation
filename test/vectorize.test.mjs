import test from 'node:test';
import assert from 'node:assert/strict';
import '../image-settings.js';

const vectorize = globalThis.vectorize;

test('vectorize detects square edges accurately', () => {
  const width = 100, height = 100;
  const rgba = new Uint8ClampedArray(width * height * 4);

  // Draw a bright square in the center
  for (let y = 20; y < 80; y++) {
    for (let x = 20; x < 80; x++) {
      const idx = (y * width + x) * 4;
      rgba[idx] = 255;
      rgba[idx + 1] = 255;
      rgba[idx + 2] = 255;
      rgba[idx + 3] = 255;
    }
  }

  const paths = vectorize(rgba, width, height);
  assert.ok(Array.isArray(paths), 'Paths should be an array');
  assert.ok(paths.length > 0, 'Should find contour paths around the square');
  assert.ok(paths[0].length >= 8, 'Paths should have at least 8 points');
});

test('vectorize handles blank canvas without crashing', () => {
  const width = 50, height = 50;
  const rgba = new Uint8ClampedArray(width * height * 4);
  const paths = vectorize(rgba, width, height);
  assert.equal(paths.length, 0, 'Blank image should yield 0 contours');
});

test('theme presets and default palette are defined and structured properly', () => {
  const presets = globalThis.THEME_PRESETS;
  const def = globalThis.defaultPalette();

  assert.ok(presets && typeof presets === 'object', 'THEME_PRESETS should be an object');
  assert.ok(presets.aura, 'Should include aura theme preset');
  assert.ok(presets.elaina, 'Should include elaina theme preset');
  assert.ok(presets.auto, 'Should include auto palette preset');
  assert.equal(typeof presets.aura.base, 'string');
  assert.equal(typeof presets.aura.tint, 'string');
  assert.equal(typeof presets.aura.violet, 'string');

  assert.ok(def, 'Default palette should exist');
  assert.equal(typeof def.base, 'string');
  assert.equal(typeof def.tint, 'string');
  assert.equal(typeof def.violet, 'string');
});

