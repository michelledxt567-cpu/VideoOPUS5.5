// Scene 68–82s: accelerating expansion (redshifting galaxy lattice) → last stars die one by one
// Scene 82–90s: outro — pale blue dot
(function () {
  'use strict';
  const C = window.CORE;
  const { W, H, TAU, clamp, lerp, sstep, win, gauss, camera, P, proj, projDir, glow, drawSprite, starCol } = C;
  const S = TL.SYNC;
  let lat, latIdx, sky;

  function init() {
    const r = TL.mulberry32(314);
    lat = []; latIdx = new Map();
    const R = 4;
    for (let i = -R; i <= R; i++) for (let j = -2; j <= 2; j++) for (let k = -R; k <= R; k++) {
      if (i === 0 && j === 0 && k === 0) continue;
      const p = [i + gauss(r) * 0.18, j * 0.9 + gauss(r) * 0.18, k + gauss(r) * 0.18];
      latIdx.set(i + ',' + j + ',' + k, lat.length);
      lat.push({ p, v: (r() * 4) | 0, s: 0.12 + 0.1 * r(), key: [i, j, k] });
    }
    sky = [];
    for (let i = 0; i < 1500; i++) { const z = 2 * r() - 1, a = TAU * r(), s = Math.sqrt(1 - z * z); sky.push([s * Math.cos(a), z, s * Math.sin(a), 0.05 + 0.5 * Math.pow(r(), 6), starCol(r())]); }
  }

  const aOf = (t) => Math.exp(0.33 * Math.max(0, t - 68.4));
  function clockExp(t) { return t < 79 ? lerp(10, 14, clamp((t - 68.8) / 10)) : lerp(14, 100, C.ease(clamp((t - 79.0) / 1.4))); }

  function redshift(z) { // 0 → white-blue, 1 → deep red
    return [lerp(0.85, 1, z), lerp(0.9, 0.25, z), lerp(1, 0.12, z)];
  }

  function renderExpansion(ctx, t, acc, alpha) {
    const a = aOf(t);
    const yaw = 0.15 + 0.025 * (t - 68), pos = [0, 0.35, 0];
    const cam = camera(pos, [Math.sin(yaw), 0.2, -Math.cos(yaw)], 65);
    const HOR = 7.5;
    // comoving grid lines
    ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 1;
    const seg = [];
    for (const g of lat) {
      const [i, j, k] = g.key;
      for (const nb of [[i + 1, j, k], [i, j + 1, k], [i, j, k + 1]]) {
        const idx = latIdx.get(nb.join(',')); if (idx === undefined) continue;
        const q = lat[idx];
        const A = [g.p[0] * a, g.p[1] * a, g.p[2] * a], B = [q.p[0] * a, q.p[1] * a, q.p[2] * a];
        const dA = Math.hypot(A[0], A[1], A[2]);
        const f = (1 - sstep(HOR * 0.5, HOR, dA)) * alpha;
        if (f < 0.02) continue;
        if (!proj(cam, A[0], A[1], A[2])) continue; const x1 = P.x, y1 = P.y;
        if (!proj(cam, B[0], B[1], B[2])) continue;
        seg.push([x1, y1, P.x, P.y, f]);
      }
    }
    for (const s of seg) { ctx.strokeStyle = `rgba(120,150,255,${0.06 * s[4]})`; ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); ctx.stroke(); }
    // galaxies
    for (const g of lat) {
      const x = g.p[0] * a, y = g.p[1] * a, z = g.p[2] * a;
      const dist = Math.hypot(x, y, z);
      const fade = (1 - sstep(HOR * 0.55, HOR, dist)) * alpha;
      if (fade <= 0.01 || !proj(cam, x, y, z)) continue;
      const zr = clamp(dist / HOR);
      const col = redshift(zr);
      const size = Math.min(80, g.s * cam.foc / P.d);
      drawSprite(ctx, C.galSprites[g.v], P.x, P.y, size, fade * 0.9);
      drawSprite(ctx, glow(col[0] * 255 | 0, col[1] * 255 | 0, col[2] * 255 | 0, 0.15, 0.3), P.x, P.y, size * 0.6 + 3, fade * 0.7);
    }
    // home galaxy (gravitationally bound, does not recede)
    if (proj(cam, 0.55, -0.25, -1.5)) drawSprite(ctx, C.galSprites[1], P.x, P.y, 0.42 * cam.foc / P.d, alpha);
  }

  function renderStars(ctx, t, acc, alpha) {
    const yaw = -0.05 + 0.03 * (t - 76);
    const cam = camera([0, 0, 0], [Math.sin(yaw), 0.02, -Math.cos(yaw)], 60);
    const spr = glow(255, 220, 190);
    for (const s of TL.DEATH.stars) {
      if (!projDir(cam, s.dir[0], s.dir[1], s.dir[2])) continue;
      if (P.x < -50 || P.x > W + 50 || P.y < -50 || P.y > H + 50) continue;
      let b = s.last ? 1.6 : s.lum * 2.4 / Math.sqrt(s.dist);
      let col = starCol(s.hue);
      const dt = t - s.td;
      if (s.last) {
        b *= 1 - sstep(80.4, s.td + 0.15, t); col = [1, 0.5, 0.35];
        if (b > 0.01) drawSprite(ctx, glow(255, 120, 80, 0.1, 0.3), P.x, P.y, 26 * Math.sqrt(b), alpha * Math.min(1, b));
      } else if (s.dwarf) { b *= 1 - sstep(s.td - 1.2, s.td, t); col = [1, 0.55, 0.4]; }
      else if (dt > -0.18 && dt < 0) { b *= 1 + 4 * (1 + dt / 0.18); col = [1, 0.75, 0.6]; }
      else if (dt >= 0) b *= Math.exp(-dt / 0.22) * (dt < 0.05 ? 5 : 1);
      if (b <= 0.004) continue;
      C.starPoint(acc, ctx, P.x, P.y, b * alpha, col, spr);
    }
    acc.flush(ctx);
  }

  function render(ctx, t, acc) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const mix = sstep(75.4, 76.6, t);
    if (mix < 1) renderExpansion(ctx, t, acc, (1 - mix) * sstep(68.0, 69.2, t));
    if (mix > 0) renderStars(ctx, t, acc, mix);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    return { clockExp: clockExp(t), bloom1: 0.55, bloom2: 0.45 };
  }

  // ---------------- outro ----------------
  function renderOutro(ctx, t, acc) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const cam = camera([0, 0, 0], [0.1, 0.05, -1], 60);
    const sv = sstep(84, 86.5, t) * 0.35;
    if (sv > 0) {
      for (const s of sky) { if (!projDir(cam, s[0], s[1], s[2])) continue; acc.splat(P.x, P.y, s[4][0] * s[3] * sv, s[4][1] * s[3] * sv, s[4][2] * s[3] * sv); }
      acc.flush(ctx);
    }
    const a = sstep(S.dotAppear, S.dotAppear + 1.4, t);
    const cx = W / 2 + 70, cy = H / 2 - 40;
    // Voyager-style scattered sunbeam
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.translate(cx, cy); ctx.rotate(-0.32);
    const g = ctx.createLinearGradient(0, -90, 0, 90);
    g.addColorStop(0, 'rgba(255,170,120,0)'); g.addColorStop(0.5, `rgba(255,190,150,${0.11 * a})`); g.addColorStop(1, 'rgba(255,170,120,0)');
    ctx.fillStyle = g; ctx.fillRect(-1400, -90, 2800, 180);
    ctx.restore();
    const pulse = 1 + 0.06 * Math.sin(t * 2.2);
    drawSprite(ctx, glow(120, 170, 255, 0.12, 0.35), cx, cy, 22 * pulse, a * 0.85);
    ctx.globalAlpha = a; ctx.fillStyle = 'rgb(190,215,255)'; ctx.fillRect(cx - 1.2, cy - 1.2, 2.4, 2.4);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    return { bloom1: 0.5, bloom2: 0.4 };
  }
  function hudOutro(ctx, t) {
    const a = win(t, S.title, 89.9, 1.2, 0.8);
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(235,240,255,0.95)';
    ctx.font = `200 54px ${C.FONT}`; ctx.letterSpacing = `${lerp(14, 26, clamp((t - S.title) / 3.5))}px`;
    ctx.fillText('COSMIC  HORROR', W / 2, H / 2 + 170);
    ctx.fillStyle = 'rgba(150,190,255,0.8)'; ctx.fillRect(W / 2 - 40, H / 2 + 200, 80, 1.5);
    ctx.font = `400 16px ${C.FONT}`; ctx.letterSpacing = '8px'; ctx.fillStyle = 'rgba(170,200,255,0.75)';
    ctx.fillText('THE UNIVERSE IS NOT HOSTILE  ·  IT IS INDIFFERENT', W / 2, H / 2 + 240);
    ctx.restore();
  }

  window.SCENE_DEATH = { init, render };
  window.SCENE_OUTRO = { render: renderOutro, hud: hudOutro };
})();
