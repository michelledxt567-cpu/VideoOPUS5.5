// Usage:
//   node render.mjs stills 2,9,12        -> out/stills/t_XX.jpg
//   node render.mjs video [f0] [f1]      -> out/cosmic_horror.webm (+ srt/vtt/player)
//   FONT=/path/to/cjk.otf node render.mjs video   (burn Chinese captions into frames)
import http from 'http';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire('/root/.nvm/versions/node/v22.23.4/lib/node_modules/@playwright/mcp/');
const { chromium } = require('playwright-core');
const requireLocal = createRequire(import.meta.url);
const TL = requireLocal('./src/timeline.js');
import { muxWebM, writeSubs, writePlayer } from './mux.mjs';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const SRC = path.join(ROOT, 'src'), OUT = path.join(ROOT, 'out');
fs.mkdirSync(path.join(OUT, 'stills'), { recursive: true });

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(SRC, p === '/' ? 'index.html' : p);
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  const ext = path.extname(file);
  res.writeHead(200, { 'Content-Type': { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.otf': 'font/otf' }[ext] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: '/inner_container/opt/playwright/chromium_headless_shell-1232/chrome-headless-shell-linux64/chrome-headless-shell',
  args: ['--disable-crash-reporter', '--disable-crashpad-for-testing', '--no-zygote', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--max-old-space-size=8000'],
});
const page = await browser.newPage();
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning' || process.env.VERBOSE) console.log('[page]', m.type(), m.text()); });
page.on('pageerror', e => console.log('[pageerror]', e.message));
const video = [], audio = [];
await page.exposeFunction('nodeLog', s => console.log(s));
await page.exposeFunction('nodeVideo', s => { for (const [ts, k, b] of JSON.parse(s)) video.push({ ts, key: !!k, data: Buffer.from(b, 'base64') }); });
await page.exposeFunction('nodeAudio', s => { for (const [ts, dur, b] of JSON.parse(s)) audio.push({ ts, dur, data: Buffer.from(b, 'base64') }); });
await page.goto(`http://127.0.0.1:${port}/`);
const t0 = Date.now();
console.log('fonts', await page.evaluate(() => window.APP.init()));
console.log('init', (Date.now() - t0) / 1000, 's');

const mode = process.argv[2] || 'stills';
if (mode === 'stills') {
  const times = (process.argv[3] || '2,9,12,16,21').split(',').map(Number);
  for (const t of times) {
    const s = Date.now();
    const url = await page.evaluate(t => window.APP.still(t), t);
    const f = path.join(OUT, 'stills', `t_${t.toFixed(2).padStart(5, '0')}.jpg`);
    fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
    console.log('still', t, (Date.now() - s) + 'ms', f);
  }
} else if (mode === 'sheet') {
  const times = process.argv[3].split(',').map(Number);
  const url = await page.evaluate(([t, c]) => window.APP.sheet(t, c), [times, Number(process.argv[5] || 3)]);
  const f = path.join(OUT, 'stills', `sheet_${process.argv[4] || 'x'}.jpg`);
  fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
  console.log('sheet', f);
} else if (mode === 'cover') {
  const r = await page.evaluate(t => window.COVER.make({ bgT: t }), Number(process.argv[3] || 86.5));
  const dir = path.join(OUT, 'cover'); fs.mkdirSync(dir, { recursive: true });
  const w = (n, u) => fs.writeFileSync(path.join(dir, n), Buffer.from(u.split(',')[1], 'base64'));
  w('cover_16x9.png', r.full); w('cover_16x9.jpg', r.jpg); w('cover_4x3.jpg', r.c43); w('cover_guide.jpg', r.guide);
  console.log('cover written', dir);
} else if (mode === 'audio') {
  const a = await page.evaluate(() => window.APP.encodeAudio());
  console.log('audio chunks', a.count, 'desc', a.desc);
  console.log(JSON.stringify(a.stats));
} else if (mode === 'video') {
  const f0 = Number(process.argv[3] || 0), f1 = Number(process.argv[4] || TL.DUR * TL.FPS);
  const a = await page.evaluate(() => window.APP.encodeAudio());
  console.log('audio chunks', a.count, 'desc', !!a.desc, JSON.stringify(a.stats));
  await page.evaluate(o => window.APP.encodeVideo(o), { f0, f1, bitrate: Number(process.env.BITRATE || 6e6) });
  console.log('video chunks', video.length, 'elapsed', (Date.now() - t0) / 1000, 's');
  const name = process.env.NAME || 'cosmic_horror_ii';
  fs.writeFileSync(path.join(OUT, 'video_chunks.json'), JSON.stringify(video.map(v => [v.ts, v.key ? 1 : 0, v.data.toString('base64')])));
  const CAPS = TL.CUES.map(c => [c[0], c[1], c[2].replace(/[\[\]]/g, '').replace(/\n/g, ' ')]);
  const out = path.join(OUT, name + '.webm');
  const bytes = muxWebM({ video, audio, opusHead: a.desc ? Buffer.from(a.desc, 'base64') : null, width: TL.W, height: TL.H, fps: TL.FPS, captions: CAPS, durationMs: (f1 - f0) / TL.FPS * 1000 });
  fs.writeFileSync(out, bytes);
  writeSubs(OUT, name, CAPS);
  
  console.log('wrote', out, (bytes.length / 1e6).toFixed(1), 'MB');
}
await browser.close();
server.close();
