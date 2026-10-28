// Frame compositor + encoding driver (runs inside headless Chromium)
(function () {
  'use strict';
  const C = window.CORE;
  const { W, H, sstep, win } = C;
  let canvas, ctx, acc, opts = {};

  const SCENES = () => [
    [0, 24.0, window.SCENE_COSMOS],
    [24.0, 37.8, window.SCENE_LIGHT],
    [37.8, 54.0, window.SCENE_BH],
    [54.0, 68.0, window.SCENE_VOID],
    [68.0, 82.0, window.SCENE_DEATH],
    [82.0, 90.01, window.SCENE_OUTRO],
  ];

  function hudValue(L, t, info) {
    if (L.value === '@timerate') return 'TIME ×' + (info.timeRate ?? 1).toFixed(2);
    if (L.value === '@clock') return 'T + 10^{' + Math.round(info.clockExp ?? 10) + '} YEARS';
    return L.value;
  }

  function renderFrame(t) {
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    let info = {}, scene = null;
    for (const [a, b, s] of SCENES()) if (t >= a && t < b) { scene = s; break; }
    if (scene) info = scene.render(ctx, t, acc) || {};
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    C.bloom(ctx, canvas, info.bloom1 ?? 0.55, info.bloom2 ?? 0.45);
    C.vignette(ctx);
    if (scene && scene.hud) scene.hud(ctx, t, info.logD, info);
    for (const L of TL.LABELS) C.drawLabel(ctx, t, L, hudValue(L, t, info));
    if (opts.cjk) C.drawCaption(ctx, t, TL.CAPTIONS);
    // global dips / flashes
    let black = Math.max(
      1 - sstep(0, 1.0, t),
      win(t, 23.55, 24.45, 0.42, 0.45),
      win(t, 67.4, 68.5, 0.55, 0.5),
      sstep(89.0, 89.9, t),
    );
    if (info.black) black = Math.max(black, info.black);
    if (black > 0) { ctx.globalAlpha = Math.min(1, black); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
    const white = Math.max(sstep(37.3, 37.62, t) * (1 - sstep(37.85, 39.2, t)), info.white || 0);
    if (white > 0) { ctx.globalAlpha = Math.min(1, white); ctx.fillStyle = '#fffaf2'; ctx.fillRect(0, 0, W, H); }
    ctx.globalAlpha = 1;
  }

  async function init(o = {}) {
    opts = o;
    canvas = document.getElementById('c'); canvas.width = W; canvas.height = H;
    ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
    await document.fonts.load(`200 50px "Noto Sans"`); await document.fonts.load(`500 23px "Noto Sans"`); await document.fonts.load(`300 34px "Noto Sans"`);
    if (o.cjk) { const f = new FontFace('CJK', `url(${o.cjk})`); await f.load(); document.fonts.add(f); }
    acc = new C.Accum(); C.initPost();
    for (const [, , s] of SCENES()) if (s && s.init) s.init();
    return true;
  }

  function still(t, q = 0.88) { renderFrame(t); return canvas.toDataURL('image/jpeg', q); }
  function sheet(times, cols = 3) {
    const tw = 640, th = 360, rows = Math.ceil(times.length / cols);
    const s = C.mk(tw * cols, th * rows), sx = s.getContext('2d');
    sx.fillStyle = '#222'; sx.fillRect(0, 0, s.width, s.height);
    times.forEach((t, i) => {
      renderFrame(t);
      const x = (i % cols) * tw, y = Math.floor(i / cols) * th;
      sx.drawImage(canvas, x + 2, y + 2, tw - 4, th - 4);
      sx.fillStyle = '#ff0'; sx.font = '20px "Noto Sans"'; sx.fillText('t=' + t, x + 10, y + 26);
    });
    return s.toDataURL('image/jpeg', 0.85);
  }

  function u8ToB64(u8) {
    let s = ''; const CH = 0x8000;
    for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    return btoa(s);
  }

  async function encodeAudio() {
    const buf = await window.AUDIO.build();
    const chunks = []; let desc = null;
    const enc = new AudioEncoder({
      output: (ch, meta) => { const d = new Uint8Array(ch.byteLength); ch.copyTo(d); chunks.push({ ts: ch.timestamp, dur: ch.duration, d }); if (meta && meta.decoderConfig && meta.decoderConfig.description && !desc) desc = new Uint8Array(meta.decoderConfig.description); },
      error: (e) => { throw e; },
    });
    enc.configure({ codec: 'opus', sampleRate: 48000, numberOfChannels: 2, bitrate: 192000 });
    const L = buf.getChannelData(0), R = buf.getChannelData(1), N = L.length, step = 48000;
    for (let i = 0; i < N; i += step) {
      const n = Math.min(step, N - i), data = new Float32Array(n * 2);
      data.set(L.subarray(i, i + n), 0); data.set(R.subarray(i, i + n), n);
      enc.encode(new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(i / 48000 * 1e6), data }));
    }
    await enc.flush();
    for (let i = 0; i < chunks.length; i += 200) {
      const batch = chunks.slice(i, i + 200).map(c => [c.ts, c.dur, u8ToB64(c.d)]);
      await window.nodeAudio(JSON.stringify(batch));
    }
    return { count: chunks.length, desc: desc ? u8ToB64(desc) : null, stats: window.AUDIO.stats };
  }

  async function encodeVideo(o) {
    const fps = TL.FPS, total = Math.round(TL.DUR * fps);
    const f0 = o.f0 ?? 0, f1 = o.f1 ?? total;
    const pending = []; let err = null;
    const enc = new VideoEncoder({
      output: (ch) => { const d = new Uint8Array(ch.byteLength); ch.copyTo(d); pending.push([ch.timestamp, ch.type === 'key' ? 1 : 0, d]); },
      error: (e) => { err = e; },
    });
    enc.configure({ codec: o.codec || 'vp09.00.41.08', width: W, height: H, bitrate: o.bitrate || 10e6, framerate: fps, bitrateMode: 'variable', latencyMode: 'quality' });
    const tStart = performance.now();
    for (let f = f0; f < f1; f++) {
      if (err) throw err;
      renderFrame(f / fps);
      const vf = new VideoFrame(canvas, { timestamp: Math.round(f * 1e6 / fps), duration: Math.round(1e6 / fps) });
      enc.encode(vf, { keyFrame: f % (fps * 2) === 0 });
      vf.close();
      while (enc.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 2));
      if (pending.length > 20 || f === f1 - 1) {
        const batch = pending.splice(0).map(([ts, k, d]) => [ts, k, u8ToB64(d)]);
        await window.nodeVideo(JSON.stringify(batch));
      }
      if (f % 30 === 0) await window.nodeLog(`frame ${f}/${f1} ${((performance.now() - tStart) / 1000).toFixed(1)}s`);
    }
    await enc.flush();
    const batch = pending.splice(0).map(([ts, k, d]) => [ts, k, u8ToB64(d)]);
    if (batch.length) await window.nodeVideo(JSON.stringify(batch));
    return true;
  }

  window.APP = { init, still, sheet, renderFrame, encodeAudio, encodeVideo };
})();
