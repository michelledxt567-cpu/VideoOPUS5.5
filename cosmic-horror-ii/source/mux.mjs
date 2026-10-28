// Minimal WebM (Matroska) muxer: VP9 video + Opus audio + UTF-8 subtitle track, with SeekHead + Cues.
import fs from 'fs';
import path from 'path';

function idBytes(id) { const b = []; while (id > 0) { b.unshift(id & 0xff); id = Math.floor(id / 256); } return Buffer.from(b); }
function vsize(n) {
  for (let len = 1; len <= 8; len++) {
    if (n < 2 ** (7 * len) - 1) {
      const b = Buffer.alloc(len); let v = n;
      for (let i = len - 1; i >= 0; i--) { b[i] = v % 256; v = Math.floor(v / 256); }
      b[0] |= 0x80 >> (len - 1); return b;
    }
  }
  throw new Error('size too large');
}
const el = (id, payload) => Buffer.concat([idBytes(id), vsize(payload.length), payload]);
const master = (id, kids) => el(id, Buffer.concat(kids));
function uint(id, v, fixed) {
  let x = BigInt(Math.round(v)); const bytes = [];
  if (fixed) for (let i = 0; i < fixed; i++) { bytes.unshift(Number(x & 0xffn)); x >>= 8n; }
  else do { bytes.unshift(Number(x & 0xffn)); x >>= 8n; } while (x > 0n);
  return el(id, Buffer.from(bytes));
}
const flt = (id, v) => { const b = Buffer.alloc(8); b.writeDoubleBE(v); return el(id, b); };
const str = (id, s) => el(id, Buffer.from(s, 'utf8'));

function opusHead(preSkip = 312) {
  const b = Buffer.alloc(19);
  b.write('OpusHead', 0, 'ascii'); b[8] = 1; b[9] = 2; b.writeUInt16LE(preSkip, 10);
  b.writeUInt32LE(48000, 12); b.writeInt16LE(0, 16); b[18] = 0; return b;
}

export function muxWebM({ video, audio, opusHead: head, width, height, fps, captions, durationMs }) {
  if (!head || head.slice(0, 8).toString('ascii') !== 'OpusHead') head = opusHead(312);
  const preSkip = head.readUInt16LE(10);
  const info = master(0x1549A966, [uint(0x2AD7B1, 1000000), str(0x4D80, 'cosmic-mux'), str(0x5741, 'cosmic-render (WebCodecs)'), flt(0x4489, durationMs)]);
  const tracks = master(0x1654AE6B, [
    master(0xAE, [uint(0xD7, 1), uint(0x73C5, 1), uint(0x83, 1), uint(0x9C, 0), str(0x86, 'V_VP9'), uint(0x23E383, Math.round(1e9 / fps)),
      master(0xE0, [uint(0xB0, width), uint(0xBA, height)])]),
    master(0xAE, [uint(0xD7, 2), uint(0x73C5, 2), uint(0x83, 2), uint(0x9C, 0), str(0x86, 'A_OPUS'), el(0x63A2, head),
      uint(0x56AA, Math.round(preSkip / 48000 * 1e9)), uint(0x56BB, 80000000), master(0xE1, [flt(0xB5, 48000), uint(0x9F, 2)])]),
    master(0xAE, [uint(0xD7, 3), uint(0x73C5, 3), uint(0x83, 0x11), uint(0x9C, 0), str(0x86, 'S_TEXT/UTF8'), str(0x22B59C, 'chi'),
      str(0x536E, '中文字幕'), uint(0x88, 1), uint(0x55AA, 1)]),
  ]);

  // gather blocks
  const blocks = [];
  for (const v of video) blocks.push({ tr: 1, ms: Math.round(v.ts / 1000), key: v.key, data: v.data, ord: 0 });
  for (const a of audio) blocks.push({ tr: 2, ms: Math.round(a.ts / 1000), key: true, data: a.data, ord: 1 });
  for (const [s, e, text] of captions) blocks.push({ tr: 3, ms: Math.round(s * 1000), dur: Math.round((e - s) * 1000), data: Buffer.from(text, 'utf8'), ord: 2 });
  blocks.sort((a, b) => a.ms - b.ms || a.ord - b.ord);

  const clusters = []; let cur = null;
  for (const b of blocks) {
    const startNew = !cur || (b.tr === 1 && b.key) || b.ms - cur.ms > 30000;
    if (startNew) { cur = { ms: b.ms, items: [] }; clusters.push(cur); }
    cur.items.push(b);
  }
  const clusterBufs = clusters.map(c => {
    const kids = [uint(0xE7, c.ms)];
    for (const b of c.items) {
      const hdr = Buffer.alloc(4); hdr[0] = 0x80 | b.tr; hdr.writeInt16BE(b.ms - c.ms, 1);
      if (b.tr === 3) { hdr[3] = 0; kids.push(master(0xA0, [el(0xA1, Buffer.concat([hdr, b.data])), uint(0x9B, b.dur)])); }
      else { hdr[3] = b.key ? 0x80 : 0; kids.push(el(0xA3, Buffer.concat([hdr, b.data]))); }
    }
    return master(0x1F43B675, kids);
  });

  const seekHead = (pi, pt, pc) => master(0x114D9B74, [
    master(0x4DBB, [el(0x53AB, idBytes(0x1549A966)), uint(0x53AC, pi, 8)]),
    master(0x4DBB, [el(0x53AB, idBytes(0x1654AE6B)), uint(0x53AC, pt, 8)]),
    master(0x4DBB, [el(0x53AB, idBytes(0x1C53BB6B)), uint(0x53AC, pc, 8)]),
  ]);
  const shLen = seekHead(0, 0, 0).length;
  const infoPos = shLen, tracksPos = infoPos + info.length; let pos = tracksPos + tracks.length;
  const cuePts = [];
  clusters.forEach((c, i) => {
    if (c.items.some(b => b.tr === 1 && b.key)) cuePts.push(master(0xBB, [uint(0xB3, c.ms), master(0xB7, [uint(0xF7, 1), uint(0xF1, pos)])]));
    pos += clusterBufs[i].length;
  });
  const cues = master(0x1C53BB6B, cuePts);
  const segment = Buffer.concat([seekHead(infoPos, tracksPos, pos), info, tracks, ...clusterBufs, cues]);
  const ebml = master(0x1A45DFA3, [uint(0x4286, 1), uint(0x42F7, 1), uint(0x42F2, 4), uint(0x42F3, 8), str(0x4282, 'webm'), uint(0x4287, 4), uint(0x4285, 2)]);
  return Buffer.concat([ebml, el(0x18538067, segment)]);
}

const pad = (n, w = 2) => String(n).padStart(w, '0');
function stamp(s, sep) { const ms = Math.round(s * 1000); return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}${sep}${pad(ms % 1000, 3)}`; }
export function writeSubs(dir, name, caps) {
  fs.writeFileSync(path.join(dir, name + '.zh.srt'), caps.map(([a, b, t], i) => `${i + 1}\n${stamp(a, ',')} --> ${stamp(b, ',')}\n${t}\n`).join('\n'));
  fs.writeFileSync(path.join(dir, name + '.zh.vtt'), 'WEBVTT\n\n' + caps.map(([a, b, t]) => `${stamp(a, '.')} --> ${stamp(b, '.')}\n${t}\n`).join('\n'));
}
export function writePlayer(dir, name, caps) {
  const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>宇宙恐怖 · Cosmic Horror</title>
<style>
html,body{margin:0;height:100%;background:#000;color:#fff;font-family:"PingFang SC","Microsoft YaHei","Noto Sans CJK SC","Source Han Sans SC",sans-serif}
.wrap{position:relative;width:100vw;max-width:calc(100vh*16/9);aspect-ratio:16/9;margin:auto;top:50%;transform:translateY(-50%)}
video{width:100%;height:100%;display:block;background:#000}
#cap{position:absolute;left:0;right:0;bottom:8.5%;text-align:center;font-size:clamp(14px,2.3vw,44px);letter-spacing:.12em;
 text-shadow:0 0 12px #000,0 0 4px #000;pointer-events:none;transition:opacity .25s,transform .4s;opacity:0}
#start{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6);cursor:pointer;font-size:22px;letter-spacing:.3em}
</style></head><body>
<div class="wrap"><video id="v" src="${name}.webm" preload="auto" playsinline controls></video><div id="cap"></div>
<div id="start">▶ 点击播放（建议佩戴耳机）</div></div>
<script>
const CAPS=${JSON.stringify(caps)};
const v=document.getElementById('v'),cap=document.getElementById('cap'),st=document.getElementById('start');
st.onclick=()=>{st.remove();v.play();};
let cur=-1;
(function loop(){const t=v.currentTime;let k=CAPS.findIndex(c=>t>=c[0]&&t<c[1]);
 if(k!==cur){cur=k;if(k<0){cap.style.opacity=0;}else{cap.textContent=CAPS[k][2];cap.style.opacity=1;cap.style.transform='translateY(6px)';requestAnimationFrame(()=>cap.style.transform='translateY(0)');}}
 requestAnimationFrame(loop);})();
</script></body></html>`;
  fs.writeFileSync(path.join(dir, 'player.html'), html);
}
