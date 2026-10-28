// Scene 54–68s: Boötes Void — fly through the cosmic web, punch through the void wall, drift in near-total darkness
(function () {
  'use strict';
  const C = window.CORE;
  const { W, H, TAU, clamp, sstep, gauss, randDir, keyed, camera, P, proj, glow, drawSprite } = C;
  const S = TL.SYNC;
  let X, Y, Z, CR, CG, CB, I, n, gal;

  function init() {
    const r = TL.mulberry32(2024);
    const pts = [];
    const pal = [[0.62, 0.55, 1], [1, 0.66, 0.45], [0.5, 0.72, 1], [0.95, 0.8, 1]];
    const nodes = [];
    while (nodes.length < 260) { const p = [(2 * r() - 1) * 6, (2 * r() - 1) * 4, (2 * r() - 1) * 6 + 1]; if (Math.hypot(p[0], p[1], p[2]) > 1.35) nodes.push(p); }
    nodes.forEach((A, a) => {
      const col = pal[a % 4];
      for (let c = 0; c < 26; c++) pts.push([A[0] + gauss(r) * 0.07, A[1] + gauss(r) * 0.07, A[2] + gauss(r) * 0.07, col, 0.5]);
      const ds = nodes.map((B, bi) => [Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]), bi]).sort((u, v) => u[0] - v[0]);
      for (let m = 1; m <= 3; m++) {
        const [len, bi] = ds[m], B = nodes[bi]; const cnt = Math.round(len * 45);
        for (let c = 0; c < cnt; c++) { const s = r(); pts.push([A[0] + (B[0] - A[0]) * s + gauss(r) * 0.035, A[1] + (B[1] - A[1]) * s + gauss(r) * 0.035, A[2] + (B[2] - A[2]) * s + gauss(r) * 0.035, col, 0.28]); }
      }
    });
    // the void wall: clumpy shell r in [1.0, 1.3]
    let w = 0;
    while (w < 14000) {
      const d = randDir(r); const nn = C.fbm(d[0] * 3 + 9, d[1] * 3, d[2] * 3, 4);
      if (r() > Math.pow(nn, 3) * 3.2) continue;
      const rad = 1.0 + 0.3 * Math.pow(r(), 1.5);
      pts.push([d[0] * rad, d[1] * rad, d[2] * rad, pal[w % 4], 0.3]); w++;
    }
    const keep = pts.filter(p => Math.hypot(p[0], p[1], p[2]) > 0.98);
    n = keep.length;
    X = new Float32Array(n); Y = new Float32Array(n); Z = new Float32Array(n); CR = new Float32Array(n); CG = new Float32Array(n); CB = new Float32Array(n); I = new Float32Array(n);
    keep.forEach((p, j) => { X[j] = p[0]; Y[j] = p[1]; Z[j] = p[2]; CR[j] = p[3][0]; CG[j] = p[3][1]; CB[j] = p[3][2]; I[j] = p[4]; });
    gal = [];
    for (let i = 0; i < 60; i++) { const d = randDir(r), rad = 0.15 + 0.75 * Math.pow(r(), 0.5); gal.push([d[0] * rad, d[1] * rad, d[2] * rad, (r() * 4) | 0, 0.6 + r()]); }
  }

  const zAt = keyed([[54, 3.6, 'lin'], [S.voidWall, 1.15, 'out'], [64.5, 0.05, 'smooth'], [68, 0]]);
  function render(ctx, t, acc) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const z = zAt(t);
    const pos = [0.06 * Math.sin(t * 0.21), 0.12 - 0.05 * (t - 54) / 14, z];
    const yaw = t > 61 ? 0.11 * (t - 61) : 0;
    const look = [pos[0] + Math.sin(yaw) * 1, pos[1] - 0.03, pos[2] - Math.cos(yaw) * 1];
    const cam = camera(pos, look, 62, 0.04 * Math.sin(t * 0.3));
    const vis = sstep(54.6, 56.4, t);
    const fogL = C.lerp(2.2, 0.38, sstep(60.4, 63.5, t)), gain = C.lerp(7, 5, sstep(60.4, 63.5, t));
    const spr = glow(200, 190, 255);
    for (let j = 0; j < n; j++) {
      if (!proj(cam, X[j], Y[j], Z[j])) continue;
      if (P.x < -20 || P.x > W + 20 || P.y < -20 || P.y > H + 20) continue;
      const d = P.d;
      let k = I[j] * vis * Math.exp(-d / fogL) * gain * sstep(0.01, 0.06, d);
      if (d < 0.12) k *= 1 + (0.12 - d) * 25;
      C.starPoint(acc, ctx, P.x, P.y, k, [CR[j], CG[j], CB[j]], spr);
    }
    acc.flush(ctx);
    // the ~60 lonely galaxies inside the void
    const gv = sstep(60, 62.5, t);
    if (gv > 0) for (const g of gal) {
      if (!proj(cam, g[0], g[1], g[2])) continue;
      const size = Math.min(40, 0.02 * cam.foc / P.d);
      drawSprite(ctx, C.galSprites[g[3]], P.x, P.y, Math.max(2, size), gv * 0.32 * g[4] * Math.exp(-P.d / 1.0));
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    return { bloom1: 0.5, bloom2: 0.4 };
  }
  window.SCENE_VOID = { init, render };
})();
