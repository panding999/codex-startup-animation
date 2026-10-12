import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'video/mp4' });
  fs.createReadStream('assets/orig_startup_video.mp4').pipe(res);
});

server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const html = `<!doctype html><html><body style="margin:0"><video src="http://127.0.0.1:${port}" autoplay muted style="width:100vw;height:100vh;object-fit:cover"></video></body></html>`;
  fs.writeFileSync('assets/temp_v.html', html);
  
  const cmd = `"${edge}" --headless --disable-gpu --virtual-time-budget=3000 --window-size=1280,720 --screenshot="d:\\work\\animation-antigravity\\assets\\orig_video_frame.png" "d:\\work\\animation-antigravity\\assets\\temp_v.html"`;
  const child = spawn(cmd, { shell: true });
  child.on('close', () => {
    server.close();
    console.log('Frame captured');
  });
});
