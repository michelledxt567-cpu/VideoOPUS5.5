// Verify a rendered WebM by playing it in Chromium: duration, dimensions, frame grabs, decoded audio loudness.
import http from 'http';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire('/root/.nvm/versions/node/v22.23.4/lib/node_modules/@playwright/mcp/');
const { chromium } = require('playwright-core');
const file = path.resolve(process.argv[2]);
const times = (process.argv[3] || '1').split(',').map(Number);
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/v.webm')) { const st = fs.statSync(file); res.writeHead(200, { 'Content-Type': 'video/webm', 'Content-Length': st.size, 'Accept-Ranges': 'bytes' }); return fs.createReadStream(file).pipe(res); }
  res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<video id=v src="/v.webm" muted preload=auto></video><canvas id=c width=640 height=360></canvas>');
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: '/inner_container/opt/playwright/chromium_headless_shell-1232/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--disable-crash-reporter', '--no-zygote', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${server.address().port}/`);
const info = await page.evaluate(async (times) => {
  const v = document.getElementById('v');
  await new Promise((ok, bad) => { if (v.readyState >= 1) ok(); v.onloadedmetadata = ok; v.onerror = () => bad(new Error('video error ' + (v.error && v.error.message))); });
  const res = { duration: v.duration, w: v.videoWidth, h: v.videoHeight, frames: [] };
  const c = document.getElementById('c'), x = c.getContext('2d');
  for (const t of times) {
    await new Promise(ok => { v.onseeked = ok; v.currentTime = t; });
    x.drawImage(v, 0, 0, 640, 360);
    const d = x.getImageData(0, 0, 640, 360).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2];
    res.frames.push([t, +(s / (d.length / 4) / 3).toFixed(1), c.toDataURL('image/jpeg', 0.8)]);
  }
  const buf = await (await fetch('/v.webm')).arrayBuffer();
  const ac = new OfflineAudioContext(2, 48000, 48000);
  const ab = await ac.decodeAudioData(buf);
  const L = ab.getChannelData(0); let pk = 0, ss = 0; for (let i = 0; i < L.length; i++) { pk = Math.max(pk, Math.abs(L[i])); ss += L[i] * L[i]; }
  res.audio = { duration: ab.duration, channels: ab.numberOfChannels, peak: pk, rmsDb: 10 * Math.log10(ss / L.length) };
  return res;
}, times);
fs.mkdirSync('out/verify', { recursive: true });
for (const [t, mean, url] of info.frames) { fs.writeFileSync(`out/verify/v_${t}.jpg`, Buffer.from(url.split(',')[1], 'base64')); }
console.log(JSON.stringify({ duration: info.duration, w: info.w, h: info.h, frameMeans: info.frames.map(f => [f[0], f[1]]), audio: info.audio }));
await browser.close(); server.close();
