// Compositor: overlapping acts are cross-dissolved; post (bloom/vignette), typography, encoding.
(function () {
  'use strict';
  const C = window.CORE;
  const { W, H, sstep } = C;
  let canvas, ctx, acc, layer, lctx;
  const SC = () => ({ title: window.ACT_TITLE, fear: window.ACT_FEAR, cosmos: window.ACT_COSMOS, geom: window.ACT_GEOM, ruins: window.ACT_RUINS, ocean: window.ACT_OCEAN, climax: window.ACT_CLIMAX, end: window.ACT_END });

  function renderFrame(t) {
    const scenes = SC();
    const act = TL.ACTS.filter(([a, b]) => t >= a && t < b);
    let info = {};
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (act.length === 1) info = scenes[act[0][2]].render(ctx, t, acc) || {};
    else if (act.length >= 2) {
      const [A, B] = act;                                   // A ends, B begins: dissolve across the overlap
      const k = sstep(B[0], A[1], t);
      const ia = scenes[A[2]].render(ctx, t, acc) || {};
      lctx.globalCompositeOperation = 'source-over'; lctx.globalAlpha = 1;
      const ib = scenes[B[2]].render(lctx, t, acc) || {};
      ctx.globalAlpha = k; ctx.drawImage(layer, 0, 0); ctx.globalAlpha = 1;
      info = k > 0.5 ? ib : ia;
      info.bloom1 = (ia.bloom1 ?? 0.5) * (1 - k) + (ib.bloom1 ?? 0.5) * k;
      info.bloom2 = (ia.bloom2 ?? 0.45) * (1 - k) + (ib.bloom2 ?? 0.45) * k;
      info.black = (ia.black || 0) * (1 - k) + (ib.black || 0) * k;
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    if (info.black) { ctx.globalAlpha = Math.min(1, info.black); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    C.bloom(ctx, canvas, info.bloom1 ?? 0.5, info.bloom2 ?? 0.45);
    C.vignette(ctx);
    const cur = act.length ? act[act.length - 1][2] : 'end';
    if (cur === 'cosmos' || (act.length === 2 && act[0][2] === 'cosmos')) window.ACT_COSMOS.hud(ctx, t, info.logD);
    window.TYPE.drawAll(ctx, t, info);
    const black = Math.max(1 - sstep(0, 1.6, t), sstep(151.3, 151.95, t));
    if (black > 0) { ctx.globalAlpha = black; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  }

  async function init() {
    canvas = document.getElementById('c'); canvas.width = W; canvas.height = H;
    ctx = canvas.getContext('2d', { alpha: false });
    layer = C.mk(W, H); lctx = layer.getContext('2d', { alpha: false });
    const fonts = [['SerifL', 'fonts/NotoSerifSC-Light.otf'], ['SerifB', 'fonts/NotoSerifSC-SemiBold.otf'], ['SansL', 'fonts/NotoSansSC-Light.otf'], ['SansR', 'fonts/NotoSansSC-Regular.otf']];
    for (const [n, u] of fonts) { const f = new FontFace(n, `url(${u})`); await f.load(); document.fonts.add(f); }
    for (const w of ['200', '300', '400', '500']) await document.fonts.load(`${w} 30px "Noto Sans"`);
    acc = new C.Accum(); C.initPost();
    for (const s of Object.values(SC())) if (s && s.init) s.init();
    return [...document.fonts].map(f => f.family + ':' + f.status).join(',');
  }
  function still(t, q = 0.88) { renderFrame(t); return canvas.toDataURL('image/jpeg', q); }
  function sheet(times, cols = 3) {
    const tw = 640, th = 360, rows = Math.ceil(times.length / cols);
    const s = C.mk(tw * cols, th * rows), sx = s.getContext('2d');
    sx.fillStyle = '#222'; sx.fillRect(0, 0, s.width, s.height);
    times.forEach((t, i) => { renderFrame(t); const x = (i % cols) * tw, y = Math.floor(i / cols) * th; sx.drawImage(canvas, x + 2, y + 2, tw - 4, th - 4); sx.fillStyle = '#ff0'; sx.font = '20px "Noto Sans"'; sx.fillText('t=' + t, x + 10, y + 26); });
    return s.toDataURL('image/jpeg', 0.85);
  }
  function u8ToB64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }

  async function encodeAudio() {
    const buf = await window.AUDIO.build();
    const chunks = []; let desc = null;
    const enc = new AudioEncoder({ output: (ch, meta) => { const d = new Uint8Array(ch.byteLength); ch.copyTo(d); chunks.push([ch.timestamp, ch.duration, d]); if (meta?.decoderConfig?.description && !desc) desc = new Uint8Array(meta.decoderConfig.description); }, error: e => { throw e; } });
    enc.configure({ codec: 'opus', sampleRate: 48000, numberOfChannels: 2, bitrate: 192000 });
    const L = buf.getChannelData(0), R = buf.getChannelData(1), N = L.length;
    for (let i = 0; i < N; i += 48000) { const n = Math.min(48000, N - i), data = new Float32Array(n * 2); data.set(L.subarray(i, i + n), 0); data.set(R.subarray(i, i + n), n); enc.encode(new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(i / 48000 * 1e6), data })); }
    await enc.flush();
    for (let i = 0; i < chunks.length; i += 300) await window.nodeAudio(JSON.stringify(chunks.slice(i, i + 300).map(c => [c[0], c[1], u8ToB64(c[2])])));
    return { count: chunks.length, desc: desc ? u8ToB64(desc) : null, stats: window.AUDIO.stats };
  }
  async function encodeVideo(o) {
    const fps = TL.FPS, total = Math.round(TL.DUR * fps), f0 = o.f0 ?? 0, f1 = o.f1 ?? total;
    const pending = []; let err = null;
    const enc = new VideoEncoder({ output: ch => { const d = new Uint8Array(ch.byteLength); ch.copyTo(d); pending.push([ch.timestamp, ch.type === 'key' ? 1 : 0, d]); }, error: e => { err = e; } });
    enc.configure({ codec: 'vp09.00.41.08', width: W, height: H, bitrate: o.bitrate || 6e6, framerate: fps, bitrateMode: 'variable', latencyMode: 'quality' });
    const t0 = performance.now();
    for (let f = f0; f < f1; f++) {
      if (err) throw err;
      renderFrame(f / fps);
      const vf = new VideoFrame(canvas, { timestamp: Math.round(f * 1e6 / fps), duration: Math.round(1e6 / fps) });
      enc.encode(vf, { keyFrame: f % (fps * 2) === 0 }); vf.close();
      while (enc.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 2));
      if (pending.length > 30) await window.nodeVideo(JSON.stringify(pending.splice(0).map(([ts, k, d]) => [ts, k, u8ToB64(d)])));
      if (f % 300 === 0) await window.nodeLog(`frame ${f}/${f1} ${((performance.now() - t0) / 1000).toFixed(0)}s`);
    }
    await enc.flush();
    if (pending.length) await window.nodeVideo(JSON.stringify(pending.splice(0).map(([ts, k, d]) => [ts, k, u8ToB64(d)])));
    return true;
  }
  window.APP = { init, still, sheet, renderFrame, encodeAudio, encodeVideo };
})();
