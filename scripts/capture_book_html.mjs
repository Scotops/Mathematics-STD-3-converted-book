#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'tmp', 'html-audit');
const endpoint = process.env.CDP_ENDPOINT || 'http://127.0.0.1:9223';
await fs.mkdir(outDir, { recursive: true });

const pages = await (await fetch(`${endpoint}/json`)).json();
const target = pages.find(page => page.type === 'page');
if (!target) throw new Error('No Chrome page target is available');
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let nextId = 1;
const pending = new Map();
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const task = pending.get(message.id);
  if (!task) return;
  pending.delete(message.id);
  if (message.error) task.reject(new Error(message.error.message));
  else task.resolve(message.result);
});

function cdp(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function waitForReady() {
  for (let attempt = 0; attempt < 80; attempt++) {
    const result = await cdp('Runtime.evaluate', {
      expression: `document.readyState === 'complete' && getComputedStyle(document.querySelector('#content')).opacity !== '0'`,
      returnByValue: true,
    });
    if (result.result.value) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Page did not become ready');
}

await cdp('Page.enable');
await cdp('Runtime.enable');
await cdp('Emulation.setDeviceMetricsOverride', {
  width: 930,
  height: 1280,
  deviceScaleFactor: 1,
  mobile: false,
});

for (let physical = 1; physical <= 184; physical++) {
  const file = physical === 1 ? 'index.html' : `pg${String(physical).padStart(3, '0')}_sec001.html`;
  await cdp('Page.navigate', { url: `http://127.0.0.1:4175/${file}?visual-audit=1` });
  await waitForReady();
  await cdp('Runtime.evaluate', {
    expression: `(() => {
      const style = document.createElement('style');
      style.textContent = '#interface-container,#nav-container,[role="dialog"]{display:none!important} body{align-items:flex-start!important}';
      document.head.append(style);
      window.scrollTo(0, 0);
    })()`,
  });
  const metrics = await cdp('Page.getLayoutMetrics');
  const height = Math.ceil(metrics.cssContentSize.height);
  const shot = await cdp('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: 930, height, scale: 1 },
  });
  await fs.writeFile(path.join(outDir, `html-${String(physical).padStart(3, '0')}.png`), Buffer.from(shot.data, 'base64'));
  process.stdout.write(`${physical}${physical % 20 === 0 ? '\n' : ' '}`);
}

socket.close();
process.stdout.write(`\nCaptured 184 pages in ${outDir}\n`);
