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

    // ================= SCORE (152 s) =================
    const SY = TL.SYNC;
    function cluster(t0, t1, freqs, amp, cut = 900, wet = 0.6) { pad(freqs, 'sawtooth', [[t0, 0], [t0 + (t1 - t0) * 0.6, amp], [t1, 0]], cut, t0, t1 + 0.05, wet); }
    function drone(t0, t1, f, pts, type = 'sine') { const o = osc(type, f, t0, t1), g = gain(); env(g.gain, pts); const lp = filt('lowpass', 200); o.connect(lp); lp.connect(g); out(g, 1, 0.2); }
    function air(t0, t1, pts, f = 500, q = 0.8, wet = 0.5) { const n = noise(PINK, t0, t1), bp = filt('bandpass', f, q), g = gain(); const l = osc('sine', 0.09, t0, t1), lg = gain(f * 0.4); l.connect(lg); lg.connect(bp.frequency); env(g.gain, pts); n.connect(bp); bp.connect(g); out(g, 1, wet); }
    function footstep(t, amp, pan) { const n = noise(BROWN, t, t + 0.25), lp = filt('lowpass', 420), g = gain(); env(g.gain, [[t, 0], [t + 0.006, 0.5 * amp], [t + 0.18, 0.0005, 'e']]); n.connect(lp); lp.connect(g); out(g, 1, 0.5, pan); }
    // ACT 1 — title
    drone(0, 9.6, 36.7, [[0, 0], [3, 0.35], [8.6, 0.4], [9.6, 0]]);
    air(0.5, 9.4, [[0.5, 0], [4, 0.05], [8.8, 0.04], [9.4, 0]], 300, 0.7);
    revSwell(3.4, SY.titleHit, 0.55, 200, 7000);
    impact(SY.titleHit, 0.9, 24); bell(SY.titleHit, 293.7, 0.55, 0, 6); bell(SY.titleHit + 0.02, 440, 0.3, 0.3, 6);
    pad([73.4, 110, 146.8], 'triangle', [[SY.titleHit, 0], [6.6, 0.05], [8.6, 0.04], [9.8, 0]], 1200, SY.titleHit, 10, 0.7);
    // ACT 2 — fear
    air(8.6, 27.4, [[8.6, 0], [10.5, 0.07], [15.6, 0.08], [21.5, 0.12], [21.65, 0.015, 's'], [26, 0.03], [27.4, 0]], 260, 0.6, 0.4);
    for (let t = 10.2, k = 0; t < 21.4; t += 1.15 - k * 0.012, k++) heartbeat(t, 0.38 + k * 0.035);
    cluster(SY.threats - 0.4, SY.threatsGone, [61.7, 65.4, 92.5, 98], 0.09, 700);
    for (let i = 0; i < 9; i++) { const t = SY.threats + i * 0.62 + rnd() * 0.3, n = noise(WHITE, t, t + 0.8), bp = filt('bandpass', 1800 + 1500 * rnd(), 6), g = gain(); env(g.gain, [[t, 0], [t + 0.25, 0.05], [t + 0.7, 0.0005, 'e']]); n.connect(bp); bp.connect(g); out(g, 0.6, 0.8, rnd() * 1.6 - 0.8); }
    tick(SY.threatsGone, 0.6);
    revSwell(SY.recede - 0.1, 25.8, 0.35, 150, 3000);
    glide(SY.recede, 27.2, 880, 330, 0.03, -0.4); glide(SY.recede + 0.3, 27.2, 1320, 494, 0.02, 0.4);
    pad([110, 164.8, 220, 329.6], 'triangle', [[22.4, 0], [25.5, 0.045], [27.6, 0.05], [30, 0.05]], 1600, 22.4, 31, 0.8);
    // ACT 3 — scale
    pad([55, 82.41, 110], 'sawtooth', [[27, 0], [30, 0.06], [38, 0.1], [43.6, 0.14], [47.5, 0.11], [50.2, 0]], [[27, 200], [34, 500], [38, 900], [43.6, 2200], [49.5, 600]], 27, 50.6, 0.45);
    whoosh(30.6, 32.3, 0.55, 120, 3000); impact(32.3, 0.55, 30);
    TL.ZOOMS.forEach(([a, b], i) => { whoosh(a, b, 0.7 + i * 0.22); impact(b, 0.65 + i * 0.22, 30 - i * 3); });
    bell(44.0, 220, 0.6, 0, 6); bell(44.02, 329.6, 0.35, 0.2, 6);
    revSwell(48.4, 49.9, 0.3, 400, 8000);
    // ACT 4 — geometry: clean intervals that slowly detune
    { const g = gain(); env(g.gain, [[49.9, 0], [51.5, 0.05], [62, 0.05], [68.3, 0.045], [68.45, 0.0, 's']]); [220, 330, 440].forEach((f, i) => { const o = osc('sine', f, 49.9, 68.5); env(o.detune, [[49.9, 0], [56, 0], [66, (i - 1) * 38]]); o.connect(g); }); out(g, 1, 0.6); }
    for (let t = 51.0; t < 55.0; t += 0.5) tick(t, 0.45);
    whoosh(54.6, 56.6, 0.6, 200, 2600);
    for (let t = 56.4; t < 66.8; t += 0.42 - 0.18 * Math.min(1, (t - 56.4) / 5) * (t < 64 ? 1 : 0)) tick(t, 0.3);
    bell(61.5, 1046.5, 0.6, -0.3, 5); bell(61.52, 1108.7, 0.5, 0.3, 5);
    cluster(57.5, 67.8, [207.7, 220, 233.1], 0.035, 1400);
    { const g = gain(); env(g.gain, [[68.4, 0], [69.2, 0.04], [72.2, 0.035], [73.6, 0]]); osc('sine', 440, 68.4, 73.7).connect(g); osc('sine', 443.1, 68.4, 73.7).connect(g); out(g, 1, 0.6); }
    // ACT 5 — indifferent ruins: pressure, footsteps that recede
    drone(72.6, 96.2, 29.1, [[72.6, 0], [76, 0.12], [88, 0.18], [94, 0.22], [96.2, 0]]);
    rumble(72.6, 96.2, [[72.6, 0], [76, 0.05], [90, 0.09], [95.5, 0.1], [96.2, 0]], 90);
    air(72.6, 96, [[72.6, 0], [75, 0.06], [92, 0.09], [96, 0]], 180, 0.5, 0.9);
    for (let t = 73.2, k = 0; t < 88; t += 0.6, k++) { const dist = Math.max(0, (t - 75) / 11); footstep(t, 0.7 * Math.exp(-dist * 2.2), -0.4 + (t - 73) * 0.05); }
    glide(78, 84, 55, 41, 0.06, -0.5, 'sawtooth'); glide(84.5, 91, 49, 36.7, 0.07, 0.5, 'sawtooth');
    impact(SY.act5 + 15.2, 0.65, 22);
    // ACT 6 — sea, fog, Lovecraft
    { const n = noise(PINK, 94.6, 118), lp = filt('lowpass', 500), g = gain(); const l = osc('sine', 0.16, 94.6, 118), lg = gain(0.06); l.connect(lg); lg.connect(g.gain); env(g.gain, [[94.6, 0], [97, 0.09], [113, 0.1], [117.4, 0.03], [118, 0]]); n.connect(lp); lp.connect(g); out(g, 1, 0.5); }
    bell(95.8, 196, 0.6, 0, 6); bell(101.0, 174.6, 0.55, -0.2, 6);
    for (const [t, f] of [[103.5, 55], [109.0, 51.9]]) { const o = osc('sawtooth', f, t, t + 4), lp = filt('lowpass', 260), g = gain(); env(g.gain, [[t, 0], [t + 1.2, 0.09], [t + 3.8, 0.0005, 'e']]); o.connect(lp); lp.connect(g); out(g, 1, 0.9); }
    pad([98, 116.5, 146.8], 'triangle', [[105, 0], [106.5, 0.035], [109.6, 0.03], [110.5, 0.0]], 1500, 105, 110.6, 0.9);
    cluster(110.6, 117.0, [92.5, 98, 103.8, 138.6], 0.08, 900);
    revSwell(115.6, 117.55, 0.6, 200, 9000);
    // ACT 7 — climax: awe, not heroics
    SY.words.forEach((t, i) => { impact(t, 0.75 + i * 0.12, 26 - i * 2); bell(t, [146.8, 138.6, 130.8][i], 0.6, 0, 6); });
    pad([73.4, 110, 138.6, 164.8, 220], 'sawtooth', [[117.4, 0], [121.6, 0.06], [125.6, 0.09], [129.4, 0.1], [SY.peak, 0.16], [136, 0.13], [139.6, 0.0]], [[117.4, 300], [129.4, 900], [SY.peak, 2600], [139, 400]], 117.4, 139.8, 0.55);
    revSwell(SY.pullback, SY.peak, 0.9, 120, 9000);
    impact(SY.peak, 1.1, 20);
    air(SY.peak, 139.4, [[SY.peak, 0], [132, 0.12], [137, 0.08], [139.4, 0]], 2400, 1.2, 0.9);
    drone(129.4, 140, 27.5, [[129.4, 0], [SY.peak, 0.6], [137, 0.45], [140, 0]]);
    // ACT 8 — coda: stars go out, then silence
    TL.DEATH.pings.forEach((p, i) => bell(p.t, p.last ? 293.7 : [880, 784, 659.3, 587.3, 523.3, 440][Math.min(5, Math.floor(i / 3))], p.last ? 0.7 : 0.3, p.pan, p.last ? 7 : 3));
    pad([146.8, 220], 'sine', [[139, 0], [141, 0.035], [147.6, 0.03], [151.5, 0]], 900, 139, 151.8, 0.9);
    for (const L of TL.LABELS) blip(L.t0);
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
