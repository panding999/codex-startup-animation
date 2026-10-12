import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';

const seekTime = process.argv[2] || '2.5';
const outFile = `assets/shot_seek_${seekTime.replace('.', 's')}s.png`;

const server = http.createServer((req, res) => {
  const parsed = new URL(req.url, `http://127.0.0.1:3000`);
  let pathname = parsed.pathname;
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.join(process.cwd(), pathname.replace(/^\//, ''));
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = path.extname(filePath);
  const mimeMap = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.mp4': 'video/mp4'
  };
  const stat = fs.statSync(filePath);
  const total = stat.size;
  const range = req.headers.range;

  if (range && ext === '.mp4') {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
    const chunkSize = end - start + 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'video/mp4'
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': total,
      'Accept-Ranges': 'bytes',
      'Content-Type': mimeMap[ext] || 'application/octet-stream'
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const url = `http://127.0.0.1:${port}/index.html?seek=${seekTime}`;
  const outPath = path.join(process.cwd(), outFile);

  const cmd = `"${edge}" --headless --disable-gpu --virtual-time-budget=3000 --window-size=1280,720 --screenshot="${outPath}" "${url}"`;
  exec(cmd, (err, stdout, stderr) => {
    if (err) console.error('Exec error:', err.message);
    else console.log(`Screenshot saved successfully to ${outFile}`);
    server.close();
    process.exit(0);
  });
});
