import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildInjection } from '../extension/payload.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

test('buildInjection bundles all assets without syntax errors', async () => {
  const code = await buildInjection(root);
  assert.ok(typeof code === 'string', 'Payload should be a string');
  assert.ok(code.length > 5000, 'Payload should have substantial content');
  assert.ok(code.includes('data:image/jpeg;base64,'), 'Payload should include embedded asset base64');
  assert.ok(code.includes('antigravity-extension-overlay'), 'Payload should include overlay ID');

  // Verify that the code compiles without JS syntax errors
  assert.doesNotThrow(() => {
    new Function(code);
  }, 'Payload code must be syntactically valid JavaScript');
});
