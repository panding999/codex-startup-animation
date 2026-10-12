import { spawn } from 'child_process';
import { connect } from '../extension/cdp.mjs';

const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const child1 = spawn(edge, ['--remote-debugging-port=9444', '--headless', 'about:blank']);

await new Promise(r => setTimeout(r, 1500));
const res = await fetch('http://127.0.0.1:9444/json/list');
const targets = await res.json();
const client = await connect(targets[0].webSocketDebuggerUrl);

// Write to indexedDB in about:blank
const eval1 = await client.call('Runtime.evaluate', {
  expression: `new Promise((resolve) => {
    const req = indexedDB.open('test_db', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('store');
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('store', 'readwrite');
      tx.objectStore('store').put('saved_value_123', 'key');
      tx.oncomplete = () => { db.close(); resolve('saved'); };
    };
  })`,
  awaitPromise: true,
  returnByValue: true
});
console.log('Write result in about:blank:', eval1.result?.value);

client.close();
child1.kill();

// Reopen and check if indexedDB in about:blank kept the value
await new Promise(r => setTimeout(r, 1500));
const child2 = spawn(edge, ['--remote-debugging-port=9444', '--headless', 'about:blank']);
await new Promise(r => setTimeout(r, 1500));
const res2 = await fetch('http://127.0.0.1:9444/json/list');
const targets2 = await res2.json();
const client2 = await connect(targets2[0].webSocketDebuggerUrl);

const eval2 = await client2.call('Runtime.evaluate', {
  expression: `new Promise((resolve) => {
    const req = indexedDB.open('test_db', 1);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('store')) { db.close(); return resolve('STORE_NOT_FOUND'); }
      const tx = db.transaction('store', 'readonly');
      const getReq = tx.objectStore('store').get('key');
      tx.oncomplete = () => { db.close(); resolve(getReq.result); };
    };
    req.onerror = () => resolve('ERROR');
  })`,
  awaitPromise: true,
  returnByValue: true
});
console.log('Read result after reopen in about:blank:', eval2.result?.value);
client2.close();
child2.kill();
