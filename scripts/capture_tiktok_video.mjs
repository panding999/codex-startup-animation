import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import { connect } from '../extension/cdp.mjs';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9333;

const child = spawn(edgePath, [
  `--remote-debugging-port=${port}`,
  '--headless',
  '--disable-gpu',
  '--window-size=1280,720',
  '--autoplay-policy=no-user-gesture-required',
  'about:blank'
]);

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  await delay(2000);
  const res = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await res.json();
  const page = targets.find(t => t.type === 'page');
  const client = await connect(page.webSocketDebuggerUrl);

  console.log('Connected to CDP');
  await client.call('Page.enable');
  await client.call('Page.navigate', { url: 'https://www.tiktok.com/@vanthang15_09_2007/video/7694511307977968948' });
  await delay(4000);

  // Click modal if exists
  await client.call('Runtime.evaluate', {
    expression: `
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Got it') || b.textContent.includes('Accept') || b.textContent.includes('Allow'));
        if (btn) btn.click();
        const v = document.querySelector('video');
        if (v) {
          v.muted = true;
          v.play();
        }
      })()
    `
  });

  await delay(2000);

  for (let i = 0; i < 8; i++) {
    const shot = await client.call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`assets/tiktok_frame_${i}.png`, Buffer.from(shot.data, 'base64'));
    console.log(`Captured frame ${i}`);
    await delay(1500);
  }

  client.close();
  child.kill();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  child.kill();
  process.exit(1);
});
