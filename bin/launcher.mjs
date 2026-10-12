#!/usr/bin/env node
import { spawn, execSync } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, platform } from 'node:os';
import { injectIntoPort } from '../extension/run.mjs';

// Find Antigravity executable on current OS
function findAntigravityPath() {
  const os = platform();

  if (os === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local');
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const candidates = [
      join(localAppData, 'Programs', 'Antigravity', 'Antigravity.exe'),
      join(localAppData, 'Antigravity', 'Antigravity.exe'),
      join(programFiles, 'Antigravity', 'Antigravity.exe'),
      'C:\\Users\\Admin\\AppData\\Local\\Programs\\Antigravity\\Antigravity.exe'
    ];
    for (const p of candidates) {
      if (existsSync(p)) return p;
    }
  } else if (os === 'darwin') {
    const candidates = [
      '/Applications/Antigravity.app/Contents/MacOS/Antigravity',
      join(homedir(), 'Applications/Antigravity.app/Contents/MacOS/Antigravity')
    ];
    for (const p of candidates) {
      if (existsSync(p)) return p;
    }
  } else {
    // Linux
    const candidates = [
      '/usr/bin/antigravity',
      '/opt/antigravity/antigravity',
      join(homedir(), '.local/share/antigravity/antigravity')
    ];
    for (const p of candidates) {
      if (existsSync(p)) return p;
    }
  }

  return null;
}

// Find a free TCP port on 127.0.0.1
async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(err => (err ? reject(err) : resolve(port)));
    });
  });
}

// Ensure no conflicting Antigravity instance is running without CDP
async function ensureNoConflictingInstance() {
  const os = platform();
  if (process.argv.includes('--no-kill')) return;

  try {
    if (os === 'win32') {
      const output = execSync('tasklist /FI "IMAGENAME eq Antigravity.exe" /NH', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      });
      if (output.toLowerCase().includes('antigravity.exe')) {
        console.log('[Thông báo] Phát hiện Antigravity đang chạy ngầm hoặc đang mở.');
        console.log('>> Đang đóng phiên cũ để khởi động lại kèm cổng gỡ lỗi CDP (đảm bảo hiển thị hoạt cảnh mở đầu)...');
        execSync('taskkill /F /IM Antigravity.exe /T', { stdio: 'ignore' });
        await new Promise(r => setTimeout(r, 1500));
      }
    } else if (os === 'darwin') {
      execSync('pkill -f Antigravity', { stdio: 'ignore' });
      await new Promise(r => setTimeout(r, 1000));
    } else {
      execSync('pkill -f antigravity', { stdio: 'ignore' });
      await new Promise(r => setTimeout(r, 1000));
    }
  } catch (_) {
    // Process wasn't running
  }
}

async function main() {
  console.log('========================================================');
  console.log('       ANTIGRAVITY CUSTOM STARTUP LAUNCHER             ');
  console.log('========================================================\n');

  const customPathArg = process.argv.indexOf('--app-path');
  const appPath = customPathArg >= 0 ? process.argv[customPathArg + 1] : findAntigravityPath();

  if (!appPath || !existsSync(appPath)) {
    console.error('[LỖI] Không tìm thấy ứng dụng Antigravity trên máy tính.');
    console.error('Bạn có thể truyền đường dẫn thủ công bằng:');
    console.error('  node bin/launcher.mjs --app-path "C:\\path\\to\\Antigravity.exe"\n');
    process.exit(1);
  }

  console.log(`[1/4] Đã phát hiện Antigravity: ${appPath}`);

  // Check and close existing instances
  await ensureNoConflictingInstance();

  const port = await getFreePort();
  console.log(`[2/4] Cấp phát cổng gỡ lỗi CDP: 127.0.0.1:${port}`);

  // Launch Antigravity with remote debugging enabled
  console.log('[3/4] Đang khởi chạy Antigravity với cổng CDP...');
  const child = spawn(appPath, [
    `--remote-debugging-address=127.0.0.1`,
    `--remote-debugging-port=${port}`
  ], {
    detached: true,
    stdio: 'ignore'
  });

  child.unref();

  console.log('[4/4] Đang kết nối và tiêm hoạt cảnh khởi động vào Antigravity...');
  try {
    await injectIntoPort(port);
    console.log('\n>> HOÀN TẤT: Hoạt cảnh Neural Awakening đang phát trên Antigravity!');
    console.log('>> Live video wallpaper sẽ tự động duy trì trong Antigravity khi hoạt cảnh kết thúc.');
    console.log('>> Nhấn Ctrl+Alt+B (hoặc Cmd+Option+B) bất kỳ lúc nào để tùy chỉnh theme & video.\n');
  } catch (err) {
    console.error('\n[Lỗi kết nối]', err.message);
    process.exit(1);
  }
}

main();
