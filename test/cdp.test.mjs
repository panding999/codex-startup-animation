import test from 'node:test';
import assert from 'node:assert/strict';
import { pageTarget, localSocket } from '../extension/cdp.mjs';

test('pageTarget accurately identifies Antigravity main window', () => {
  assert.equal(pageTarget({
    type: 'page',
    url: 'https://127.0.0.1:56650/',
    title: 'Antigravity'
  }), true);

  assert.equal(pageTarget({
    type: 'page',
    url: 'http://localhost:3000/',
    title: 'Antigravity IDE'
  }), true);

  // Ignore internal devtools and extensions
  assert.equal(pageTarget({
    type: 'page',
    url: 'devtools://devtools/bundled/inspector.html'
  }), false);

  assert.equal(pageTarget({
    type: 'page',
    url: 'chrome-extension://abcdef/popup.html'
  }), false);

  // Ignore non-page targets
  assert.equal(pageTarget({
    type: 'service_worker',
    url: 'https://127.0.0.1:56650/sw.js'
  }), false);
});

test('localSocket rejects foreign hosts and accepts localhost', () => {
  assert.equal(
    localSocket('ws://127.0.0.1:9222/devtools/page/1234', 9222),
    'ws://127.0.0.1:9222/devtools/page/1234'
  );

  assert.throws(() => {
    localSocket('ws://example.com:9222/devtools/page/1234', 9222);
  }, /Từ chối/);
});
