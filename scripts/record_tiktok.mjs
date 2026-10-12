import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { connect } from '../extension/cdp.mjs';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9336;

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
  await delay(5000);

  console.log('Recording video via MediaRecorder inside browser...');

  const recordResult = await client.call('Runtime.evaluate', {
    expression: `
      new Promise(async (resolve, reject) => {
        try {
          const v = document.querySelector('video');
          if (!v) return resolve({ error: 'No video element' });

          v.currentTime = 0;
          v.muted = true;
          await v.play();

          const stream = v.captureStream ? v.captureStream() : v.mozCaptureStream();
          const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
          const chunks = [];

          recorder.ondataavailable = e => {
            if (e.data && e.data.size > 0) chunks.push(e.data);
          };

          recorder.onstop = async () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve({ base64: reader.result.split(',')[1], duration: v.duration });
            };
            reader.readAsDataURL(blob);
          };

          recorder.start();
          setTimeout(() => {
            recorder.stop();
          }, (v.duration || 16.6) * 1000 + 500);
        } catch (e) {
          resolve({ error: e.message });
        }
      })
    `,
    awaitPromise: true,
    returnByValue: true
  }, 45000);

  const val = recordResult.result.value;
  if (val && val.base64) {
    fs.writeFileSync('assets/tiktok_recorded.webm', Buffer.from(val.base64, 'base64'));
    console.log('Successfully recorded assets/tiktok_recorded.webm! Size:', fs.statSync('assets/tiktok_recorded.webm').size);
  } else {
    console.log('Recording failed:', val);
  }

  client.close();
  child.kill();
  process.exit(0);
}

run().catch(e => { console.error(e); child.kill(); process.exit(1); });
