import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { connect } from '../extension/cdp.mjs';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9335;

const child = spawn(edgePath, [
  `--remote-debugging-port=${port}`,
  '--headless',
  '--disable-gpu',
  '--window-size=1280,720',
  '--autoplay-policy=no-user-gesture-required',
  'about:blank'
]);

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  await delay(2000);
  const res = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await res.json();
  const page = targets.find(t => t.type === 'page');
  const client = await connect(page.webSocketDebuggerUrl);

  await client.call('Page.enable');
  await client.call('Page.navigate', { url: 'https://www.tiktok.com/@vanthang15_09_2007/video/7694511307977968948' });
  await delay(6000);

  const evalRes = await client.call('Runtime.evaluate', {
    expression: `
      (async () => {
        const v = document.querySelector('video');
        if (!v) return { error: 'No video element' };
        return {
          src: v.currentSrc || v.src,
          duration: v.duration,
          videoWidth: v.videoWidth,
          videoHeight: v.videoHeight
        };
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Video info:', evalRes.result.value);

  // If video is found, download it via fetch in page
  if (evalRes.result.value && evalRes.result.value.src) {
    const downloadRes = await client.call('Runtime.evaluate', {
      expression: `
        (async () => {
          try {
            const v = document.querySelector('video');
            const src = v.currentSrc || v.src;
            const resp = await fetch(src);
            const blob = await resp.blob();
            return new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result.split(',')[1]);
              reader.readAsDataURL(blob);
            });
          } catch (e) {
            return { error: e.message };
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });

    if (typeof downloadRes.result.value === 'string') {
      fs.writeFileSync('assets/tiktok_downloaded.mp4', Buffer.from(downloadRes.result.value, 'base64'));
      console.log('Successfully saved assets/tiktok_downloaded.mp4! Size:', fs.statSync('assets/tiktok_downloaded.mp4').size);
    } else {
      console.log('Fetch error:', downloadRes.result.value);
    }
  }

  client.close();
  child.kill();
  process.exit(0);
}

run().catch(e => { console.error(e); child.kill(); process.exit(1); });
