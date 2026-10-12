import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { buildInjection } from './payload.mjs';
import { connect, pageTarget, localSocket } from './cdp.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

export async function injectIntoPort(port) {
  const source = await buildInjection(root);
  const deadline = Date.now() + 45000;
  let lastError = 'Đang chờ cửa sổ Antigravity';

  while (Date.now() < deadline) {
    let client;
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
        signal: AbortSignal.timeout(1500),
        redirect: 'error'
      });
      if (!response.ok) throw new Error('Cổng gỡ lỗi CDP chưa sẵn sàng');
      const targets = await response.json();
      if (!Array.isArray(targets)) throw new Error('Danh sách cửa sổ không hợp lệ');

      const target = targets.find(pageTarget);
      if (!target) throw new Error('Chưa tìm thấy cửa sổ chính của Antigravity');

      const wsUrl = localSocket(target.webSocketDebuggerUrl, port);
      client = await connect(wsUrl);

      const result = await client.call('Runtime.evaluate', {
        expression: source,
        returnByValue: true,
        awaitPromise: true
      });

      if (result.exceptionDetails || result.result?.value?.installed !== true) {
        throw new Error('Script hoạt cảnh chưa được nạp vào trang');
      }

      // Check if animation is ready to start
      for (let attempt = 0; attempt < 50; attempt++) {
        const answer = await client.call('Runtime.evaluate', {
          expression: 'globalThis.__antigravityExtension?.status()',
          returnByValue: true
        });
        const state = answer.result?.value;
        if (state?.ready) {
          console.log('[Antigravity] Hoạt cảnh khởi động đã bắt đầu phát thành công!');
          console.log('[Antigravity] Nhấn Ctrl+Alt+B (hoặc Cmd+Option+B) để mở bảng cài đặt hình ảnh/video.');
          return true;
        }
        if (state?.phase === 'failed' || state?.phase === 'timeout') {
          throw new Error('Không thể khởi tạo hoạt ảnh.');
        }
        await delay(100);
      }
      throw new Error('Xác nhận khởi động hoạt ảnh quá thời gian');
    } catch (err) {
      lastError = err.message;
    } finally {
      client?.close();
    }
    await delay(200);
  }
  throw new Error('Không thể kết nối vào Antigravity: ' + lastError);
}

async function main() {
  const portIndex = process.argv.indexOf('--port');
  const port = portIndex >= 0 ? Number(process.argv[portIndex + 1]) : 9222;
  await injectIntoPort(port);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(err => {
    console.error('[Lỗi]', err.message);
    process.exitCode = 1;
  });
}
