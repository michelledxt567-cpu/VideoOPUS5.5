// Act 7 (climax: smallness + incomprehensibility + indifference in one expanding space) and Act 8 (coda)
(function () {
  'use strict';
  const C = window.CORE, U = window.U3;
  const { W, H, TAU, PI, clamp, lerp, sstep, win, ease, gauss, randDir, keyed, camera, P, proj, projDir, glow, drawSprite, starCol, norm } = C;
  const S = TL.SYNC;
  const [w1, w2, w3] = S.words;
  const LL = new U.Lines(10), LC = new U.Lines(10);
  let mono, bgStars, cubes;
  const logDist = keyed([[116.8, Math.log10(7), 'lin'], [S.pullback, Math.log10(16), 'in'], [133.5, 2.6, 'lin'], [139.6, 4.6]]);
  const GSC = 30 / 4.9e20, WSC = 7000 / 4.4e26, GCX = -17, GCZ = -7;

  const CL7 = {
    init() {
      const r = TL.mulberry32(7007);
      mono = [];
      for (let i = 0; i < 11; i++) { const a = i / 11 * TAU + gauss(r) * 0.15, rad = 70 + 40 * r(), h = 110 + 160 * r(); mono.push({ c: [Math.cos(a) * rad, h / 2 - 40 - 30 * r(), Math.sin(a) * rad], s: [10 + 14 * r(), h, 4 + 6 * r()], yaw: -a + PI / 2 + gauss(r) * 0.3, tilt: (r() - 0.5) * 0.25, roll: (r() - 0.5) * 0.25, col: [22, 24, 30] }); }
      U.prepBoxes(mono);
      bgStars = []; for (let i = 0; i < 2500; i++) bgStars.push([randDir(r), 0.05 + 0.9 * Math.pow(r(), 7), starCol(r())]);
      cubes = []; for (let i = 0; i < 9; i++) { const d = randDir(r), rad = 10 + 16 * r(); cubes.push({ c: [d[0] * rad, d[1] * rad * 0.6, d[2] * rad], s: 0.6 + 1.2 * r(), sp: (r() - 0.5) * 0.6, ph: r() * TAU }); }
    },
    render(ctx, t, acc) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      const d = Math.pow(10, logDist(t));
      const yaw = 0.4 + 0.035 * (t - 116.8), el = 0.42 + 0.2 * sstep(S.pullback, 138, t);
      const pos = [Math.sin(yaw) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(yaw) * Math.cos(el) * d];
      const cam = camera(pos, [0, 0, 0], 52, 0.03);
      const vis = sstep(116.8, 118.2, t);
      const a1 = sstep(w1 - 0.2, w1 + 1.8, t), a2 = sstep(w2 - 0.2, w2 + 1.8, t), a3 = sstep(w3 - 0.2, w3 + 1.8, t);
      const spr = glow(210, 220, 255);
      // background stars (infinity)
      for (const [dir, I, c] of bgStars) { if (!projDir(cam, dir[0], dir[1], dir[2])) continue; if (P.x < 0 || P.x > W || P.y < 0 || P.y > H) continue; acc.splat(P.x, P.y, c[0] * I * vis * 0.6, c[1] * I * vis * 0.6, c[2] * I * vis * 0.6); }
      // cosmic web: the outermost shell, revealed by the pullback
      const webV = sstep(132.5, 136, t);
      if (webV > 0) { const Wb = C.webSet; for (let j = 0; j < Wb.n; j += 1) { if (!proj(cam, Wb.x[j] * WSC, Wb.y[j] * WSC, Wb.z[j] * WSC)) continue; if (P.x < 0 || P.x > W || P.y < 0 || P.y > H) continue; const I = Wb.i[j] * webV * 2.2 * sstep(30, 600, P.d); acc.splat(P.x, P.y, Wb.r[j] * I, Wb.g[j] * I, Wb.b[j] * I); } }
      // 渺小 → the spiral galaxy returns, with us on an arm
      if (a1 > 0) {
        const G = C.galaxySet, rotA = 0.02 * (t - 116.8), cr = Math.cos(rotA), sr = Math.sin(rotA);
        const gI = a1 * Math.min(1.2, 60 / Math.max(20, d)) * 0.9;
        for (let j = 0; j < G.n; j += 1) {
          const x0 = G.x[j] * GSC, z0 = G.z[j] * GSC, x = x0 * cr - z0 * sr + GCX, z = x0 * sr + z0 * cr + GCZ, y = G.y[j] * GSC - 1.2;
          if (!proj(cam, x, y, z)) continue; if (P.x < 0 || P.x > W || P.y < 0 || P.y > H) continue;
          const I = G.i[j] * gI * sstep(0.5, 3, P.d);
          acc.splat(P.x, P.y, G.r[j] * I, G.g[j] * I, G.b[j] * I);
        }
      }
      acc.flush(ctx);
      // 漠不关心 → monoliths, indifferent, standing in the dark
      if (a3 > 0) { for (const b of mono) b.alpha = a3; U.drawBoxes(ctx, cam, mono, { col: [0, 0, 0], d: 260 + d * 0.8 }, norm([0.4, 0.6, -0.7]), { amb: 0.12, rim: 0.9 }); }
      // 不可理解 → the lattice and the cubes from before
      if (a2 > 0) {
        const fz = (z) => Math.exp(-z / (40 + d * 0.6));
        const T = [0, 0, 0];
        for (let i = -4; i <= 4; i++) for (let k = -4; k <= 4; k++) {
          const x = i * 7, z = k * 7;
          U.cs(cam, x, 0, z, T); const f = fz(Math.max(0, T[2])) * a2 * 0.35;
          LL.add(cam, [x, -28, z], [x, 28, z], f * 0.6);
          LL.add(cam, [-28, i * 7, z], [28, i * 7, z], f * 0.5);
          LL.add(cam, [x, k * 7, -28], [x, k * 7, 28], f * 0.5);
        }
        for (const cb of cubes) {
          const ry = cb.ph + cb.sp * (t - 116.8), rx = 0.4;
          const vv = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map(v => {
            let [x, y, z] = [v[0] * cb.s, v[1] * cb.s, v[2] * cb.s];
            const y2 = y * Math.cos(rx) - z * Math.sin(rx), z2 = y * Math.sin(rx) + z * Math.cos(rx); y = y2; z = z2;
            const x2 = x * Math.cos(ry) + z * Math.sin(ry), z3 = -x * Math.sin(ry) + z * Math.cos(ry);
            return [x2 + cb.c[0], y + cb.c[1], z3 + cb.c[2]];
          });
          for (const [i, j] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) LC.add(cam, vv[i], vv[j], a2 * 0.8 * Math.min(1, 40 / d));
        }
        ctx.globalCompositeOperation = 'lighter';
        LL.flush(ctx, '130,160,230', 1, 0.9);
        LC.flush(ctx, '220,232,255', 1.3, 1);
        ctx.globalCompositeOperation = 'source-over';
      }
      // the human light — shrinking until it can no longer be told apart
      if (proj(cam, 0, 0, 0)) {
        const I = vis * Math.min(1, 9 / d);
        drawSprite(ctx, glow(255, 200, 150, 0.15, 0.35), P.x, P.y, 6 + 40 * I, I);
        if (I > 0.003) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, I * 3); ctx.fillStyle = 'rgb(255,226,190)'; ctx.fillRect(P.x - 1, P.y - 1, 2, 2); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
      }
      const pulse = Math.max(0, Math.exp(-Math.max(0, t - S.peak) * 2.5) * (t > S.peak ? 1 : 0));
      return { bloom1: 0.55 + 0.25 * pulse, bloom2: 0.5 + 0.2 * pulse };
    },
  };

  const END = {
    render(ctx, t, acc) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      const yaw = 0.02 * (t - 138.6);
      const cam = camera([0, 0, 0], [Math.sin(yaw), 0.05, -Math.cos(yaw)], 60);
      const vis = sstep(138.6, 140.2, t);
      const spr = glow(255, 225, 200);
      for (const s of TL.DEATH.stars) {
        if (!projDir(cam, s.dir[0], s.dir[1], s.dir[2])) continue;
        if (P.x < -20 || P.x > W + 20 || P.y < -20 || P.y > H + 20) continue;
        let b = s.last ? 1.4 : s.lum * 2.2 / Math.sqrt(s.dist), col = starCol(s.hue);
        const dt = t - s.td;
        if (s.last) { b *= 1 - sstep(s.td - 1.6, s.td + 0.25, t); col = [1, 0.6, 0.45]; if (b > 0.01) drawSprite(ctx, glow(255, 140, 100, 0.1, 0.3), P.x, P.y, 22 * Math.sqrt(b), vis * Math.min(1, b)); }
        else if (dt > -0.2 && dt < 0) { b *= 1 + 3 * (1 + dt / 0.2); }
        else if (dt >= 0) b *= Math.exp(-dt / 0.25);
        if (b <= 0.004) continue;
        C.starPoint(acc, ctx, P.x, P.y, b * vis, col, spr);
      }
      acc.flush(ctx);
      return { bloom1: 0.5, bloom2: 0.4 };
    },
  };
  window.ACT_CLIMAX = CL7; window.ACT_END = END;
})();
