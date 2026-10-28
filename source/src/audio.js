// Procedural sound design (OfflineAudioContext). Every cue is keyed to TL.SYNC / TL.ZOOMS / TL.LABELS / TL.DEATH.
(function () {
  'use strict';
  const S = TL.SYNC, SR = 48000;

  function makeNoise(ac, kind, sec) {
    const n = SR * sec, b = ac.createBuffer(2, n, SR), r = TL.mulberry32(kind.length * 977);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let last = 0, b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < n; i++) {
        const w = r() * 2 - 1;
        if (kind === 'white') d[i] = w;
        else if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
        else { b0 = 0.997 * b0 + w * 0.029591; b1 = 0.985 * b1 + w * 0.032534; b2 = 0.95 * b2 + w * 0.048056; d[i] = (b0 + b1 + b2 + w * 0.05) * 1.6; }
      }
    }
    return b;
  }
  function makeIR(ac, sec, decay) {
    const n = SR * sec, b = ac.createBuffer(2, n, SR), r = TL.mulberry32(5);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let lp = 0;
      for (let i = 0; i < n; i++) { const t = i / n; lp += (r() * 2 - 1 - lp) * (0.5 - 0.42 * t); d[i] = lp * Math.pow(1 - t, decay) * (i < SR * 0.015 ? i / (SR * 0.015) : 1); }
    }
    return b;
  }

  async function build() {
    const ac = new OfflineAudioContext(2, SR * TL.DUR, SR);
    const master = ac.createGain(); master.gain.value = 0.9;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.006; comp.release.value = 0.35;
    master.connect(comp); comp.connect(ac.destination);
    const verb = ac.createConvolver(); verb.buffer = makeIR(ac, 6, 2.4);
    const verbIn = ac.createGain(); verbIn.connect(verb);
    const verbOut = ac.createGain(); verbOut.gain.value = 0.5; verb.connect(verbOut); verbOut.connect(master);
    const WHITE = makeNoise(ac, 'white', 6), BROWN = makeNoise(ac, 'brown', 6), PINK = makeNoise(ac, 'pink', 6);
    const rnd = TL.mulberry32(8080);

    function out(node, dry = 1, wet = 0.3, pan = 0) {
      let n = node;
      if (pan) { const p = ac.createStereoPanner(); p.pan.value = pan; node.connect(p); n = p; }
      if (dry) { const g = ac.createGain(); g.gain.value = dry; n.connect(g); g.connect(master); }
      if (wet) { const g = ac.createGain(); g.gain.value = wet; n.connect(g); g.connect(verbIn); }
    }
    function env(param, pts) {
      param.setValueAtTime(pts[0][1], pts[0][0]);
      for (let i = 1; i < pts.length; i++) {
        const [t, v, ty] = pts[i];
        if (ty === 'e') param.exponentialRampToValueAtTime(Math.max(v, 1e-4), t);
        else if (ty === 's') param.setValueAtTime(v, t);
        else param.linearRampToValueAtTime(v, t);
      }
    }
    function noise(buf, t0, t1) { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.start(t0, rnd() * 4); s.stop(t1); return s; }
    function osc(type, f, t0, t1, detune = 0) { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune; o.start(t0); o.stop(t1); return o; }
    function filt(type, f, q = 0.7) { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
    function gain(v = 0) { const g = ac.createGain(); g.gain.value = v; return g; }

    // ---------- building blocks ----------
    function pad(freqs, type, pts, cutoff, t0, t1, wet = 0.4, detuneRamp) {
      const f = filt('lowpass', 400, 0.5); const g = gain(); env(g.gain, pts);
      if (Array.isArray(cutoff)) env(f.frequency, cutoff); else f.frequency.value = cutoff;
      freqs.forEach((fr, i) => {
        for (const dt of [-7, 7]) {
          const o = osc(type, fr, t0, t1, dt + (i % 2 ? 3 : -3));
          if (detuneRamp) env(o.detune, detuneRamp.map(([t, v]) => [t, v + dt]));
          const p = ac.createStereoPanner(); p.pan.value = dt > 0 ? 0.35 : -0.35; o.connect(p); p.connect(f);
        }
      });
      f.connect(g); out(g, 1, wet);
    }
    function heartbeat(t, amp = 1, pitch = 1) {
      for (const [dt, a] of [[0, 1], [0.27, 0.65]]) {
        const o = osc('sine', 62 * pitch, t + dt, t + dt + 0.5);
        env(o.frequency, [[t + dt, 62 * pitch], [t + dt + 0.16, 34 * pitch, 'e']]);
        const g = gain(); env(g.gain, [[t + dt, 0], [t + dt + 0.008, 0.9 * a * amp], [t + dt + 0.32, 0.001, 'e']]);
        const lp = filt('lowpass', 180); o.connect(lp); lp.connect(g); out(g, 1, 0.12);
      }
    }
    function impact(t, amp = 1, low = 26) {
      const o = osc('sine', 75, t, t + 4.5); env(o.frequency, [[t, 75], [t + 1.8, low, 'e']]);
      const g = gain(); env(g.gain, [[t, 0], [t + 0.01, 0.95 * amp], [t + 3.6, 0.001, 'e']]); o.connect(g); out(g, 1, 0.25);
      const n = noise(BROWN, t, t + 2.5), lp = filt('lowpass', 900), ng = gain();
      env(lp.frequency, [[t, 2500], [t + 1.2, 120, 'e']]); env(ng.gain, [[t, 0], [t + 0.005, 0.7 * amp], [t + 1.6, 0.001, 'e']]);
      n.connect(lp); lp.connect(ng); out(ng, 1, 0.6);
    }
    function whoosh(t0, t1, amp = 1, f0 = 180, f1 = 5000) {
      const n = noise(PINK, t0, t1 + 0.3), bp = filt('bandpass', f0, 1.2), g = gain();
      env(bp.frequency, [[t0, f0], [t1, f1, 'e'], [t1 + 0.25, f0 * 2, 'e']]);
      env(g.gain, [[t0, 0], [t1 - 0.05, 0.55 * amp, 'e'], [t1 + 0.2, 0.001, 'e']]);
      n.connect(bp); bp.connect(g); out(g, 1, 0.35);
      const o = osc('sawtooth', 40, t0, t1 + 0.2), lp = filt('lowpass', 300), og = gain();
      env(o.frequency, [[t0, 40], [t1, 160, 'e']]); env(og.gain, [[t0, 0], [t1 - 0.05, 0.12 * amp, 'e'], [t1 + 0.1, 0.0001, 'e']]);
      o.connect(lp); lp.connect(og); out(og, 1, 0.2);
    }
    function revSwell(t0, t1, amp = 1, f0 = 300, f1 = 9000) {
      const n = noise(WHITE, t0, t1 + 0.05), lp = filt('lowpass', f0, 0.9), g = gain();
      env(lp.frequency, [[t0, f0], [t1, f1, 'e']]); env(g.gain, [[t0, 0.0005], [t1, 0.5 * amp, 'e'], [t1 + 0.03, 0.0001, 'e']]);
      n.connect(lp); lp.connect(g); out(g, 1, 0.4);
    }
    function tick(t, amp = 1) {
      const n = noise(WHITE, t, t + 0.05), hp = filt('bandpass', 3800, 4), g = gain();
      env(g.gain, [[t, 0], [t + 0.001, 0.5 * amp], [t + 0.035, 0.0005, 'e']]); n.connect(hp); hp.connect(g); out(g, 1, 0.3);
    }
    function bell(t, f, amp = 1, pan = 0, dur = 3.5) {
      [[1, 1], [2.76, 0.35], [5.4, 0.15], [8.93, 0.06]].forEach(([m, a]) => {
        if (f * m > 18000) return;
        const o = osc('sine', f * m, t, t + dur); const g = gain();
        env(g.gain, [[t, 0], [t + 0.004, 0.18 * a * amp], [t + dur / m ** 0.4, 0.0005, 'e']]); o.connect(g); out(g, 0.8, 0.7, pan);
      });
    }
    function blip(t) {
      for (const [f, a, dt] of [[1760, 1, 0], [2637, 0.6, 0.05]]) {
        const o = osc('sine', f, t + dt, t + dt + 0.2), g = gain();
        env(g.gain, [[t + dt, 0], [t + dt + 0.003, 0.05 * a], [t + dt + 0.15, 0.0005, 'e']]); o.connect(g); out(g, 1, 0.4, 0.15);
      }
    }
    function glide(t0, t1, f0, f1, amp, pan = 0, type = 'sine') {
      const o = osc(type, f0, t0, t1 + 0.1); env(o.frequency, [[t0, f0], [t1, f1, 'e']]);
      const vib = osc('sine', 5, t0, t1); const vg = gain(f0 * 0.006); vib.connect(vg); vg.connect(o.frequency);
      const g = gain(); env(g.gain, [[t0, 0], [t0 + 0.4, amp], [t1, 0.0005, 'e']]); o.connect(g); out(g, 1, 0.6, pan);
    }
    function rumble(t0, t1, pts, cutoff = 110) {
      const n = noise(BROWN, t0, t1), lp = filt('lowpass', cutoff, 0.8), g = gain(); env(g.gain, pts);
      n.connect(lp); lp.connect(g); out(g, 1, 0.1);
    }

    // ================= SCORE =================
    const A1 = 55, E2 = 82.41, A2 = 110;
    // --- Intro + scale journey (0–24) ---
    pad([A1, E2, A2], 'sawtooth', [[0, 0], [3, 0.05], [8, 0.07], [15.3, 0.1], [19.7, 0.13], [23.4, 0.14], [23.95, 0]], [[0, 160], [8, 260], [11.6, 500], [15.3, 900], [19.7, 1600], [23.5, 2400]], 0, 24.2, 0.45);
    pad([329.6, 440, 523.3], 'triangle', [[15, 0], [17, 0.018], [19.7, 0.03], [23.5, 0.035], [23.95, 0]], 2200, 15, 24.2, 0.8);
    for (let t = 1.0, k = 0; t < 7.7; t += 1.0, k++) heartbeat(t, 0.45 + k * 0.06);
    impact(S.journeyStart, 0.6);
    TL.ZOOMS.forEach(([a, b], i) => { whoosh(a, b, 0.7 + i * 0.25); impact(b, 0.65 + i * 0.25, 30 - i * 3); });
    revSwell(22.9, 23.95, 0.7, 200, 6000);
    // --- Starlight (24–37.8) ---
    {
      const n = noise(PINK, 24, 29), bp = filt('bandpass', 300, 0.9), g = gain();
      env(bp.frequency, [[24, 250], [25.7, 2600, 'e'], [26.6, 2800], [28.6, 220, 'e']]);
      env(g.gain, [[24, 0], [24.4, 0.25], [25.7, 0.55], [26.6, 0.55], [28.8, 0.0005, 'e']]); n.connect(bp); bp.connect(g); out(g, 1, 0.4);
      const o = osc('sawtooth', 45, 24, 29), lp = filt('lowpass', 500), og = gain();
      env(o.frequency, [[24, 45], [25.7, 110, 'e'], [26.6, 115], [28.6, 38, 'e']]); env(og.gain, [[24, 0], [25.7, 0.1], [26.6, 0.1], [28.6, 0.0005, 'e']]);
      o.connect(lp); lp.connect(og); out(og, 1, 0.3);
    }
    {
      const g = gain(); env(g.gain, [[27.6, 0], [29, 0.022], [31.0, 0.022], [S.implode, 0.0005, 'e']]);
      for (const f of [880, 1318.5, 1760]) { const o = osc('sine', f, 27.6, 31.4); const tr = osc('sine', 6 + f / 900, 27.6, 31.4), tg = gain(0.4); tr.connect(tg); const og = gain(0.6); tg.connect(og.gain); o.connect(og); og.connect(g); }
      out(g, 1, 0.8);
    }
    for (let t = 28.6; t < 31.2; t += 0.62) tick(t, 0.8);
    revSwell(S.implode - 0.4, S.nova, 0.6, 400, 12000);
    glide(S.implode - 0.3, S.nova, 200, 1400, 0.05);
    { // nova: bright shing (no bass) — then eerie silence
      const n = noise(WHITE, S.nova, S.nova + 2.5), hp = filt('highpass', 3000), g = gain();
      env(g.gain, [[S.nova, 0], [S.nova + 0.005, 0.45], [S.nova + 1.8, 0.0005, 'e']]); n.connect(hp); hp.connect(g); out(g, 0.8, 1);
      [1975, 2637, 3520].forEach((f, i) => bell(S.nova, f, 0.7, i - 1, 5));
    }
    pad([73.4, 77.8], 'triangle', [[32, 0], [34, 0.05], [37.3, 0.07], [S.waveHit, 0]], 600, 32, 37.8, 0.5);
    revSwell(33.6, S.waveHit, 1.1, 120, 9000);
    glide(34.5, S.waveHit, 90, 900, 0.035, 0, 'sawtooth');
    impact(S.waveHit, 1.25, 20);
    // --- Black hole (37.8–54) ---
    rumble(37.8, 54.05, [[37.8, 0], [40, 0.16], [50, 0.27], [53.9, 0.42], [S.horizon, 0, 's']]);
    {
      const o = osc('sine', 31, 37.8, 54.05), am = osc('sine', 0.35, 37.8, 54.05), ag = gain(0.5); am.connect(ag);
      const g = gain(); env(g.gain, [[37.8, 0], [41, 0.13], [53.9, 0.26], [S.horizon, 0, 's']]); ag.connect(g.gain); o.connect(g); out(g, 1, 0);
    }
    pad([A1, 58.27, E2], 'sawtooth', [[38.5, 0], [41, 0.06], [50, 0.09], [53.9, 0.1], [S.horizon, 0, 's']], [[38, 300], [53.9, 900]], 38, 54.05, 0.4, [[38, 0], [50, 0], [53.9, -700]]);
    {
      let t = 39.0;
      while (t < 53.2) { const r = 1 - 0.93 * Math.min(1, Math.max(0, (t - S.dilation) / 3.4)); heartbeat(t, 0.85, 0.75 + 0.25 * Math.pow(r, 0.3)); t += 1.0 / Math.max(0.28, Math.pow(r, 0.6)); }
      let k = 50.0; while (k < 53.3) { const r = 1 - 0.93 * Math.min(1, (k - 50) / 3.4); tick(k, 0.7); k += 0.5 / Math.max(0.2, r); }
    }
    glide(S.plunge, S.horizon - 0.02, 420, 28, 0.08, 0, 'triangle');
    revSwell(S.plunge + 0.2, S.horizon - 0.01, 0.8, 200, 7000);
    // --- Void (54–68): near-silence ---
    {
      const n = noise(PINK, 55, 68.5), bp = filt('bandpass', 600, 1.6), g = gain();
      const lfo = osc('sine', 0.13, 55, 68.5), lg = gain(350); lfo.connect(lg); lg.connect(bp.frequency);
      env(g.gain, [[55, 0], [57.5, 0.06], [S.voidWall - 0.6, 0.08], [S.voidWall + 0.3, 0.16], [62, 0.03], [67.6, 0.012], [68.3, 0]]);
      n.connect(bp); bp.connect(g); out(g, 1, 0.6);
      const tn = osc('sine', 3150, 61.5, 68.4), tg = gain(); env(tn.gain === undefined ? tg.gain : tg.gain, [[61.5, 0], [64, 0.0035], [67.5, 0.002], [68.3, 0]]); tn.connect(tg); out(tg, 1, 0.2);
    }
    whoosh(S.voidWall - 1.4, S.voidWall + 0.1, 0.45, 150, 2500);
    { const o = osc('sine', 27.5, 58.7, 64), o2 = osc('sine', 55, 58.7, 64), g = gain(); env(g.gain, [[58.7, 0], [58.75, 0.35], [63.5, 0.0005, 'e']]); o.connect(g); o2.connect(g); out(g, 1, 0.5); }
    bell(63.1, 659.3, 0.35, -0.6, 4); bell(65.9, 587.3, 0.3, 0.55, 4);
    // --- Heat death (68–82) ---
    pad([A2, 130.8, 164.8, 220], 'triangle', [[68.2, 0], [70, 0.05], [76, 0.04], [81.6, 0.0]], [[68, 1600], [81.6, 180]], 68, 82, 0.6);
    [68.8, 69.9, 71.0, 72.2, 73.3, 74.4].forEach((t, i) => glide(t, t + 3.4, 950 - i * 60, 110, 0.022, (i % 2 ? 0.5 : -0.5)));
    const PENTA = [1760, 1568, 1318.5, 1174.7, 1046.5, 880, 784, 659.3];
    TL.DEATH.pings.forEach((p, i) => bell(p.t, p.last ? 440 : PENTA[Math.min(PENTA.length - 1, Math.floor(i / 3))], p.last ? 0.9 : 0.42, p.pan, p.last ? 6 : 2.6));
    { let t = 69.6, k = 0; while (t < 80.8) { heartbeat(t, 0.7 - k * 0.04, 0.9); t += 1.25 + k * 0.17; k++; } }
    // --- Outro (82–90) ---
    bell(S.dotAppear, 587.3, 0.8, 0, 6);
    pad([146.8, 220, 293.7, 370, 659.3], 'sine', [[S.dotAppear, 0], [85.5, 0.05], [88.3, 0.05], [89.95, 0]], 2500, S.dotAppear, 90, 0.8);
    revSwell(S.title - 1.2, S.title, 0.25, 800, 9000);
    bell(S.title, 880, 0.6, 0, 4); bell(S.title + 0.02, 1318.5, 0.35, 0.3, 4);
    // HUD blips
    TL.LABELS.forEach(L => blip(L.t0));

    const buf = await ac.startRendering();
    // normalize + stats
    const L = buf.getChannelData(0), R = buf.getChannelData(1);
    let peak = 0; for (let i = 0; i < L.length; i++) { const a = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (a > peak) peak = a; }
    const k = 0.89 / (peak || 1); for (let i = 0; i < L.length; i++) { L[i] *= k; R[i] *= k; }
    const perSec = [];
    for (let s = 0; s < TL.DUR; s++) { let sum = 0, pk = 0; for (let i = s * SR; i < (s + 1) * SR; i++) { sum += L[i] * L[i]; pk = Math.max(pk, Math.abs(L[i])); } perSec.push([Math.round(10 * Math.log10(sum / SR + 1e-12)), Math.round(20 * Math.log10(pk + 1e-9))]); }
    window.AUDIO.stats = { rawPeak: peak, gain: k, perSecRmsPeakDb: perSec };
    return buf;
  }
  window.AUDIO = { build, stats: null };
})();
