// Scene 24–37.8s: warp through stars → red supergiant → photons fly at camera → supernova → light front hits
(function () {
  'use strict';
  const C = window.CORE;
  const { W, H, TAU, clamp, lerp, sstep, gauss, randDir, glow, drawSprite, starCol } = C;
  const S = TL.SYNC;
  const N = 7000, LEN = 700;
  let sx, sy, sz, sc, si, neb, photons;
  const FOV = 60, FOC = (H / 2) / Math.tan(FOV * Math.PI / 360);

  function vel(t) { return 4 + 300 * sstep(24.0, 25.7, t) * (1 - sstep(26.6, 28.6, t)); }
  // integrated distance (numeric, deterministic)
  function dist(t) { let s = 0; const n = 400, a = 23.0, h = (t - a) / n; for (let i = 0; i < n; i++) s += vel(a + (i + 0.5) * h) * h; return s; }

  function init() {
    const r = TL.mulberry32(99);
    sx = new Float32Array(N); sy = new Float32Array(N); sz = new Float32Array(N); si = new Float32Array(N); sc = [];
    for (let i = 0; i < N; i++) {
      let x, y; do { x = (2 * r() - 1) * 110; y = (2 * r() - 1) * 70; } while (Math.hypot(x, y) < 3);
      sx[i] = x; sy[i] = y; sz[i] = r() * LEN; si[i] = 0.25 + 1.6 * Math.pow(r(), 5); sc.push(starCol(r()));
    }
    neb = [];
    for (let i = 0; i < 6000; i++) {
      const d = randDir(r);
      const n = C.fbm(d[0] * 2.5 + 3, d[1] * 2.5, d[2] * 2.5, 4);
      const col = n > 0.55 ? [1, 0.45, 0.75] : n > 0.47 ? [0.4, 0.95, 1] : [1, 0.62, 0.3];
      neb.push({ d, k: 0.65 + 0.7 * n + 0.08 * gauss(r), col, I: 0.15 + 0.3 * r() });
    }
    photons = [];
    for (let i = 0; i < 260; i++) {
      const a = TAU * r(), m = Math.pow(r(), 0.6);
      photons.push({ te: 27.6 + (i / 260) * 3.6 + 0.05 * r(), ox: Math.cos(a) * m, oy: Math.sin(a) * m * 0.6 });
    }
  }

  const STAR = { x: 0, y: 30, d: 520 }; // fixed relative to camera after the warp
  function render(ctx, t, acc) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const v = vel(t), s = dist(t);
    const shake = t > 35.8 && t < 37.7 ? (t - 35.8) * 3 : 0;
    const jx = shake * Math.sin(t * 91.7) * 1.5, jy = shake * Math.cos(t * 77.3) * 1.5;
    const cx = W / 2 + jx, cy = H / 2 + jy;
    // --- starfield ---
    const shutter = 0.7 / 30;
    const streak = v > 12;
    const fadeStars = 1 - 0.55 * sstep(31.6, 33, t);
    if (streak) {
      ctx.globalCompositeOperation = 'lighter';
      const buckets = [[], [], []];
      for (let i = 0; i < N; i++) {
        let d = ((sz[i] - s) % LEN + LEN) % LEN; if (d < 0.5) continue;
        const d2 = d + v * shutter;
        const x1 = cx + sx[i] / d * FOC, y1 = cy - sy[i] / d * FOC;
        if (x1 < -200 || x1 > W + 200 || y1 < -200 || y1 > H + 200) continue;
        const x2 = cx + sx[i] / d2 * FOC, y2 = cy - sy[i] / d2 * FOC;
        const I = si[i] * (1 - d / LEN) * sstep(0.5, 8, d);
        buckets[I > 0.9 ? 2 : I > 0.4 ? 1 : 0].push(x1, y1, x2, y2);
      }
      const al = clamp((v - 12) / 60);
      [[0.25, 1], [0.5, 1.4], [0.9, 2]].forEach(([a, lw], b) => {
        const arr = buckets[b]; if (!arr.length) return;
        ctx.strokeStyle = `rgba(200,220,255,${a * (0.35 + 0.65 * al)})`; ctx.lineWidth = lw; ctx.beginPath();
        for (let k = 0; k < arr.length; k += 4) { ctx.moveTo(arr[k], arr[k + 1]); ctx.lineTo(arr[k + 2], arr[k + 3]); }
        ctx.stroke();
      });
    }
    {
      const spr = glow(210, 225, 255);
      for (let i = 0; i < N; i++) {
        let d = ((sz[i] - s) % LEN + LEN) % LEN; if (d < 0.5) continue;
        const x = cx + sx[i] / d * FOC, y = cy - sy[i] / d * FOC;
        if (x < 0 || x > W || y < 0 || y > H) continue;
        const I = si[i] * (1 - d / LEN) * sstep(0.5, 6, d) * fadeStars * (streak ? 0.5 : 1);
        C.starPoint(acc, ctx, x, y, I, sc[i], spr);
      }
    }
    // --- target star ---
    const appear = sstep(27.0, 28.6, t);
    const scx = cx + STAR.x / STAR.d * FOC, scy = cy - STAR.y / STAR.d * FOC;
    if (appear > 0 && t < S.nova + 0.05) {
      const flick = 1 + 0.12 * Math.sin(t * 5.3) + 0.08 * Math.sin(t * 13.1 + 1);
      let size = 34 * flick;
      if (t > S.implode) size *= lerp(1, 0.15, sstep(S.implode, S.nova, t));
      drawSprite(ctx, glow(255, 120, 70, 0.1, 0.3), scx, scy, size * 3.2, appear * 0.9);
      drawSprite(ctx, glow(255, 190, 140, 0.2, 0.4), scx, scy, size, appear);
      // diffraction spikes
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = appear * 0.5;
      const g = ctx.createLinearGradient(scx - 260, 0, scx + 260, 0);
      g.addColorStop(0, 'rgba(255,140,90,0)'); g.addColorStop(0.5, 'rgba(255,200,160,0.8)'); g.addColorStop(1, 'rgba(255,140,90,0)');
      ctx.fillStyle = g; ctx.fillRect(scx - 260 * flick, scy - 0.8, 520 * flick, 1.6);
      const g2 = ctx.createLinearGradient(0, scy - 200, 0, scy + 200);
      g2.addColorStop(0, 'rgba(255,140,90,0)'); g2.addColorStop(0.5, 'rgba(255,200,160,0.8)'); g2.addColorStop(1, 'rgba(255,140,90,0)');
      ctx.fillStyle = g2; ctx.fillRect(scx - 0.8, scy - 200 * flick, 1.6, 400 * flick);
      ctx.globalAlpha = 1;
    }
    // --- photons travelling toward the camera ---
    if (t > 27.6 && t < 33.5) {
      ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 1.6;
      ctx.strokeStyle = 'rgba(255,200,150,0.55)'; ctx.beginPath();
      for (const p of photons) {
        const f = (t - p.te) / 1.9; if (f <= 0 || f >= 0.985) continue;
        const pos = (ff) => { const d = STAR.d * (1 - ff); const lat = ff * 140; return [cx + (STAR.x + p.ox * lat) / d * FOC, cy - (STAR.y + p.oy * lat) / d * FOC]; };
        const [x1, y1] = pos(f), [x2, y2] = pos(Math.max(0, f - 0.025));
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      }
      ctx.stroke();
    }
    // --- supernova ---
    if (t >= S.nova) {
      const dt = t - S.nova;
      drawSprite(ctx, glow(255, 250, 240, 0.15, 0.35), scx, scy, 900 * Math.exp(-dt * 2.2) + 30, Math.exp(-dt * 1.2));
      const Rn = 150 * (1 - Math.exp(-dt / 2.4));
      const fade = 0.6 + 0.4 * Math.exp(-dt / 3);
      for (const n of neb) {
        const R = Rn * n.k;
        const x = n.d[0] * R, y = n.d[1] * R + STAR.y, z = STAR.d - n.d[2] * R;
        const px = cx + x / z * FOC, py = cy - y / z * FOC;
        const I = 2.2 * n.I * fade * (1 + 3 * Math.exp(-dt * 2));
        acc.splat(px, py, n.col[0] * I, n.col[1] * I, n.col[2] * I);
      }
      acc.flush(ctx);
      // light front: sphere expanding from star; silhouette radius on screen
      const x = Math.pow(clamp(dt / (S.waveHit - S.nova)), 2.6);
      const ang = Math.asin(Math.min(0.995, x));
      const rp = FOC * Math.tan(ang);
      ctx.globalCompositeOperation = 'lighter';
      if (rp > 2 && rp < 2600) {
        const g = ctx.createRadialGradient(scx, scy, rp * 0.9, scx, scy, rp * 1.02);
        g.addColorStop(0, 'rgba(255,240,220,0)'); g.addColorStop(0.85, `rgba(255,235,210,${0.15 + 0.4 * x})`); g.addColorStop(1, 'rgba(255,240,220,0)');
        ctx.fillStyle = g; ctx.globalAlpha = 1; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = `rgba(255,240,225,${0.01 + 0.12 * x * x})`;
        ctx.beginPath(); ctx.arc(scx, scy, rp, 0, TAU); ctx.fill();
      }
      if (rp >= 1100) { ctx.fillStyle = `rgba(255,245,230,${0.35 * sstep(1100, 2600, rp) + 0.2 * x})`; ctx.fillRect(0, 0, W, H); }
    } else acc.flush(ctx);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    const flash = t >= S.nova ? 0.75 * Math.exp(-(t - S.nova) * 3.2) : 0;
    return { white: flash, bloom1: 0.6, bloom2: 0.5 };
  }
  window.SCENE_LIGHT = { init, render };
})();
