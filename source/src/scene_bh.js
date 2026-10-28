// Scene 37.8–54s: TON 618 — lensed accretion disk, tidal disruption, time dilation, plunge through the horizon
(function () {
  'use strict';
  const C = window.CORE;
  const { W, H, TAU, clamp, lerp, sstep, ease, gauss, randDir, camera, glow, drawSprite, starCol } = C;
  const S = TL.SYNC;
  const ND = 90000, NS = 2500, NB = 3000;
  let dr, dth, dy, dcol, dI, bg, bgc, bgi;
  const SHADOW = 4.3;

  function init() {
    const r = TL.mulberry32(618);
    dr = new Float32Array(ND); dth = new Float32Array(ND); dy = new Float32Array(ND); dI = new Float32Array(ND); dcol = [];
    for (let i = 0; i < ND; i++) {
      let rad;
      do { rad = 3 + 14 * Math.pow(r(), 1.5); } while (r() > 0.55 + 0.45 * Math.pow(Math.sin(rad * 2.2 + 0.7 * Math.sin(rad)), 2));
      dr[i] = rad; dth[i] = TAU * r(); dy[i] = gauss(r) * 0.025 * rad;
      const f = clamp((rad - 3) / 14);
      const c = f < 0.3 ? [1, lerp(0.97, 0.78, f / 0.3), lerp(0.9, 0.5, f / 0.3)] : [lerp(1, 0.75, (f - 0.3) / 0.7), lerp(0.78, 0.28, (f - 0.3) / 0.7), lerp(0.5, 0.12, (f - 0.3) / 0.7)];
      dcol.push(c); dI[i] = (0.13 + 0.15 * r()) * Math.pow(3 / rad, 0.8);
    }
    bg = []; bgc = []; bgi = new Float32Array(NB);
    for (let i = 0; i < NB; i++) { bg.push(randDir(r)); bgc.push(starCol(r())); bgi[i] = 0.08 + 1.2 * Math.pow(r(), 8); }
  }

  const timeRate = (t) => 1 - 0.93 * sstep(S.dilation, 53.4, t);
  function tau(t) { let s = 0; const n = 200, a = 37.8, h = Math.max(0, t - a) / n; for (let i = 0; i < n; i++) s += timeRate(a + (i + 0.5) * h) * h; return s; }

  // lensing: given camera-space (X right, Y up, Z depth) and lens distance Dl, emit image(s)
  function lensPoint(out, X, Y, Z, Dl, foc, cx, cy, I, col, shadowAng, acc, inf) {
    const bx = X / Z, by = Y / Z;
    if (Z <= Dl && !inf) { // in front: direct (slight), occlusion handled by draw order
      acc.splat(cx + bx * foc, cy - by * foc, col[0] * I, col[1] * I, col[2] * I); return;
    }
    const thE2 = inf ? 2 / Dl : 7.5 * (Z - Dl) / (Dl * Z);
    const b = Math.hypot(bx, by) + 1e-6, ux = bx / b, uy = by / b;
    const q = Math.sqrt(b * b + 4 * thE2);
    const tp = (b + q) / 2, tm = (b - q) / 2;
    const u = b / Math.sqrt(thE2), uq = u * Math.sqrt(u * u + 4);
    const base = (u * u + 2) / (2 * uq);
    const mp = Math.min(6, base + 0.5), mm = Math.min(5, Math.max(0, base - 0.5));
    if (tp > shadowAng) { const k = I * mp; acc.splat(cx + ux * tp * foc, cy - uy * tp * foc, col[0] * k, col[1] * k, col[2] * k); }
    if (-tm > shadowAng * 1.0 && mm > 0.01) { const k = I * mm; acc.splat(cx + ux * tm * foc, cy - uy * tm * foc, col[0] * k, col[1] * k, col[2] * k); }
  }

  function render(ctx, t, acc) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const u = clamp((t - 37.8) / (S.plunge - 37.8));
    let d = lerp(50, 21, ease(u) * 0.6 + u * 0.4);
    if (t > S.plunge) d = lerp(21, 2.2, Math.pow(clamp((t - S.plunge) / (S.horizon - S.plunge - 0.15)), 2));
    const elev = lerp(0.17, 0.09, u), yaw = 0.25 + 0.03 * (t - 38);
    const pos = [d * Math.cos(elev) * Math.sin(yaw), d * Math.sin(elev), d * Math.cos(elev) * Math.cos(yaw)];
    const cam = camera(pos, [0, 0, 0], 50, -0.07);
    const foc = cam.foc, cx = W / 2, cy = H / 2;
    const shadowAng = SHADOW / d;
    const tt = tau(t), rate = timeRate(t);
    const red = 1 - 0.35 * sstep(S.dilation, 53.4, t);
    const F = cam.f, R = cam.r, U = cam.u;
    const toCam = (x, y, z) => { const dx = x - pos[0], dy2 = y - pos[1], dz = z - pos[2]; return [dx * R[0] + dy2 * R[1] + dz * R[2], dx * U[0] + dy2 * U[1] + dz * U[2], dx * F[0] + dy2 * F[1] + dz * F[2]]; };
    // background stars (lensed, at infinity)
    for (let i = 0; i < NB; i++) {
      const v = bg[i]; const Z = v[0] * F[0] + v[1] * F[1] + v[2] * F[2]; if (Z < 0.2) continue;
      const X = v[0] * R[0] + v[1] * R[1] + v[2] * R[2], Y = v[0] * U[0] + v[1] * U[1] + v[2] * U[2];
      lensPoint(null, X, Y, Z, d, foc, cx, cy, bgi[i] * 0.8, bgc[i], shadowAng, acc, true);
    }
    // disk: two passes (behind lens plane, then front)
    const front = [];
    const beta = (rr) => Math.sqrt(0.5 / rr);
    for (let i = 0; i < ND; i++) {
      const rr = dr[i], th = dth[i] + 2.4 * Math.pow(rr, -1.5) * tt * 1.6;
      const c = Math.cos(th), s = Math.sin(th);
      const x = rr * c, z = -rr * s, y = dy[i];
      const [X, Y, Z] = toCam(x, y, z);
      if (Z <= 0.05) continue;
      // doppler: velocity direction (tangent, counter-clockwise from above)
      const vx = -s, vz = -c; // d/dth of (cos, -sin)
      const vc = (vx * R[0] + vz * R[2]) * X + (vx * U[0] + vz * U[2]) * Y + (vx * F[0] + vz * F[2]) * Z;
      const cosA = -vc / Math.hypot(X, Y, Z); // >0 approaching
      const b = beta(rr), g = 1 / (Math.sqrt(1 - b * b) * (1 - b * cosA));
      const boost = Math.min(2.6, Math.max(0.45, Math.pow(g, 2.0))) * Math.pow(50 / d, 1.2) * Math.sqrt(1 - 1 / rr) * red;
      const col = dcol[i], I = dI[i] * boost;
      const cc = g > 1 ? [col[0], Math.min(1, col[1] * (0.8 + 0.25 * g)), Math.min(1, col[2] * (0.6 + 0.5 * g))] : [col[0], col[1] * g, col[2] * g * g];
      if (Z > d) lensPoint(null, X, Y, Z, d, foc, cx, cy, I, cc, shadowAng, acc, false);
      else front.push(X, Y, Z, I, cc[0], cc[1], cc[2]);
    }
    // tidal disruption stream (43–53s)
    const sh = Math.pow(clamp((t - 43.5) / 9.5), 1.15);
    if (t > 42.5 && sh < 0.999) {
      const path = (sg) => { const rr = lerp(26, 3.6, Math.pow(sg, 0.8)); const ph = 1.2 + 2.6 * Math.PI * Math.pow(sg, 1.25); return [rr * Math.cos(ph), 2.4 * Math.pow(1 - sg, 2), -rr * Math.sin(ph)]; };
      const spread = 0.003 + 0.42 * sh * sh;
      const vis = sstep(42.5, 44, t);
      for (let k = 0; k < NS; k++) {
        const sg = sh - spread * (k / NS) + (k % 7) * 0.0004;
        if (sg < 0) continue;
        const p = path(sg); const [X, Y, Z] = toCam(p[0], p[1] + ((k * 37) % 11 - 5) * 0.04, p[2] + ((k * 53) % 13 - 6) * 0.04); if (Z <= 0.05) continue;
        const I = 0.55 * vis * (1 - 0.6 * k / NS) * red;
        const col = [1, 0.92, 0.75];
        if (Z > d) lensPoint(null, X, Y, Z, d, foc, cx, cy, I, col, shadowAng, acc, false); else front.push(X, Y, Z, I, col[0], col[1], col[2]);
      }
      if (sh < 0.12) { const p = path(sh); const [X, Y, Z] = toCam(p[0], p[1], p[2]); if (Z > 0.1) drawSprite(ctx, glow(255, 230, 180), cx + X / Z * foc, cy - Y / Z * foc, 14, vis); }
    }
    acc.flush(ctx);
    // shadow + photon ring
    const sp = Math.min(4000, foc * Math.tan(Math.min(1.5, shadowAng)));
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(cx, cy, sp, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    const ringA = 0.75 * red;
    const rg = ctx.createRadialGradient(cx, cy, sp * 0.985, cx, cy, sp * 1.09);
    rg.addColorStop(0, `rgba(255,225,190,${ringA})`); rg.addColorStop(0.25, `rgba(255,170,90,${ringA * 0.35})`); rg.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(cx, cy, sp * 1.1, 0, TAU); ctx.arc(cx, cy, sp * 0.985, 0, TAU, true); ctx.fill('evenodd');
    // front disk
    for (let k = 0; k < front.length; k += 7) {
      const Z = front[k + 2], I = front[k + 3];
      acc.splat(cx + front[k] / Z * foc, cy - front[k + 1] / Z * foc, front[k + 4] * I, front[k + 5] * I, front[k + 6] * I);
    }
    acc.flush(ctx);
    ctx.globalCompositeOperation = 'source-over';
    const black = sstep(S.horizon - 0.55, S.horizon - 0.05, t);
    return { timeRate: rate, black, bloom1: 0.65, bloom2: 0.55 };
  }
  window.SCENE_BH = { init, render };
})();
