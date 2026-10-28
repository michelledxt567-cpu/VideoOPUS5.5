// 3D helpers + Act 1 (title), Act 2 (fear), Act 3 (scale: human on horizon → cosmos)
(function () {
  'use strict';
  const C = window.CORE;
  const { W, H, TAU, PI, clamp, lerp, sstep, win, ease, gauss, randDir, keyed, camera, P, proj, projDir, glow, drawSprite, starCol } = C;
  const S = TL.SYNC;

  // ---------- 3D helpers ----------
  function cs(cam, x, y, z, out) { const dx = x - cam.pos[0], dy = y - cam.pos[1], dz = z - cam.pos[2]; out[0] = dx * cam.r[0] + dy * cam.r[1] + dz * cam.r[2]; out[1] = dx * cam.u[0] + dy * cam.u[1] + dz * cam.u[2]; out[2] = dx * cam.f[0] + dy * cam.f[1] + dz * cam.f[2]; return out; }
  const A = [0, 0, 0], B = [0, 0, 0];
  class Lines {
    constructor(n = 10) { this.n = n; this.b = Array.from({ length: n }, () => []); this.w = Array.from({ length: n }, () => []); }
    add(cam, p, q, alpha, near = 0.05) {
      if (alpha <= 0.004) return;
      cs(cam, p[0], p[1], p[2], A); cs(cam, q[0], q[1], q[2], B);
      if (A[2] < near && B[2] < near) return;
      let ax = A[0], ay = A[1], az = A[2], bx = B[0], by = B[1], bz = B[2];
      if (az < near) { const s = (near - az) / (bz - az); ax += (bx - ax) * s; ay += (by - ay) * s; az = near; }
      else if (bz < near) { const s = (near - bz) / (az - bz); bx += (ax - bx) * s; by += (ay - by) * s; bz = near; }
      const k = cam.foc;
      const x1 = W / 2 + ax / az * k, y1 = H / 2 - ay / az * k, x2 = W / 2 + bx / bz * k, y2 = H / 2 - by / bz * k;
      if ((x1 < -50 && x2 < -50) || (x1 > W + 50 && x2 > W + 50) || (y1 < -50 && y2 < -50) || (y1 > H + 50 && y2 > H + 50)) return;
      const i = Math.min(this.n - 1, Math.floor(alpha * this.n));
      this.b[i].push(x1, y1, x2, y2);
    }
    flush(ctx, rgb, width = 1, scale = 1) {
      ctx.lineWidth = width; ctx.strokeStyle = `rgb(${rgb})`; ctx.lineCap = 'round';
      for (let i = 0; i < this.n; i++) {
        const arr = this.b[i]; if (!arr.length) continue;
        ctx.globalAlpha = Math.min(1, (i + 0.5) / this.n * scale);
        ctx.beginPath(); for (let k = 0; k < arr.length; k += 4) { ctx.moveTo(arr[k], arr[k + 1]); ctx.lineTo(arr[k + 2], arr[k + 3]); }
        ctx.stroke(); arr.length = 0;
      }
      ctx.globalAlpha = 1;
    }
  }

  // Boxes: {c:[x,y,z], s:[w,h,d], yaw, tilt, roll, col:[r,g,b]}
  function boxVerts(b) {
    const [hx, hy, hz] = [b.s[0] / 2, b.s[1] / 2, b.s[2] / 2];
    const cy = Math.cos(b.yaw || 0), sy = Math.sin(b.yaw || 0), ct = Math.cos(b.tilt || 0), st = Math.sin(b.tilt || 0), cr = Math.cos(b.roll || 0), sr = Math.sin(b.roll || 0);
    const v = [];
    for (const [x, y, z] of [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]) {
      let px = x * hx, py = y * hy, pz = z * hz;
      let y2 = py * ct - pz * st, z2 = py * st + pz * ct; py = y2; pz = z2;            // tilt (x-axis)
      let x2 = px * cr - py * sr; y2 = px * sr + py * cr; px = x2; py = y2;            // roll (z-axis)
      x2 = px * cy + pz * sy; z2 = -px * sy + pz * cy; px = x2; pz = z2;               // yaw (y-axis)
      v.push([b.c[0] + px, b.c[1] + py, b.c[2] + pz]);
    }
    return v;
  }
  const FACES = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [3, 7, 6, 2], [0, 4, 7, 3], [1, 2, 6, 5]];
  for (const b of []) boxVerts(b);
  function prepBoxes(list) { for (const b of list) b.v = boxVerts(b); return list; }
  // fog: {col:[r,g,b], d}, light: unit vector
  function drawBoxes(ctx, cam, list, fog, light, opts = {}) {
    const faces = [], tmp = [0, 0, 0];
    for (const b of list) {
      if (b.alpha === 0) continue;
      const cv = b.v.map(p => cs(cam, p[0], p[1], p[2], [0, 0, 0]));
      if (cv.every(q => q[2] < 0.1)) continue;
      for (const f of FACES) {
        const q = f.map(i => cv[i]);
        if (q.some(p => p[2] < 0.1)) continue;
        const s = q.map(p => [W / 2 + p[0] / p[2] * cam.foc, H / 2 - p[1] / p[2] * cam.foc]);
        let area = 0; for (let i = 0; i < 4; i++) { const a = s[i], c = s[(i + 1) % 4]; area += a[0] * c[1] - c[0] * a[1]; }
        if (area <= 0) continue;
        const wv = f.map(i => b.v[i]);
        const e1 = [wv[1][0] - wv[0][0], wv[1][1] - wv[0][1], wv[1][2] - wv[0][2]], e2 = [wv[3][0] - wv[0][0], wv[3][1] - wv[0][1], wv[3][2] - wv[0][2]];
        const n = C.norm(C.cross(e2, e1));
        const z = (q[0][2] + q[1][2] + q[2][2] + q[3][2]) / 4;
        const lam = Math.max(0, C.dot(n, light));
        const amb = opts.amb ?? 0.28;
        const k = amb + (1 - amb) * lam;
        const fg = (1 - Math.exp(-z / fog.d)) * (b.fogK ?? 1);
        const col = b.col;
        const r = lerp(col[0] * k, fog.col[0], fg), g = lerp(col[1] * k, fog.col[1], fg), bb = lerp(col[2] * k, fog.col[2], fg);
        const rim = opts.rim ? Math.pow(1 - Math.abs(C.dot(n, cam.f)), 3) * opts.rim * (1 - fg) : 0;
        faces.push([z, s, `rgb(${r + rim * 120 | 0},${g + rim * 140 | 0},${bb + rim * 170 | 0})`, b.alpha ?? 1]);
      }
    }
    faces.sort((a, b) => b[0] - a[0]);
    ctx.globalCompositeOperation = 'source-over';
    for (const [, s, col, a] of faces) {
      ctx.globalAlpha = a; ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(s[0][0], s[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(s[i][0], s[i][1]); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Human silhouette; feet at (x,y), height h px. walk: phase (radians) or null
  function figure(ctx, x, y, h, walk, rimCol, alpha = 1) {
    if (h < 0.6 || alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = 'source-over';
    const u = h / 100;
    const sw = walk == null ? 0 : Math.sin(walk);
    ctx.fillStyle = '#020304';
    ctx.beginPath(); ctx.arc(x, y - 92 * u, 6.5 * u, 0, TAU); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 9 * u, y - 82 * u); ctx.lineTo(x + 9 * u, y - 82 * u); ctx.lineTo(x + 7 * u, y - 46 * u); ctx.lineTo(x - 7 * u, y - 46 * u); ctx.closePath(); ctx.fill();
    ctx.lineCap = 'round'; ctx.strokeStyle = '#020304';
    ctx.lineWidth = 5.5 * u;
    for (const s of [1, -1]) { ctx.beginPath(); ctx.moveTo(x + 3.5 * s * u, y - 48 * u); ctx.lineTo(x + (3.5 * s + 9 * sw * s) * u, y - 3 * u); ctx.stroke(); }
    ctx.lineWidth = 4 * u;
    for (const s of [1, -1]) { ctx.beginPath(); ctx.moveTo(x + 8 * s * u, y - 78 * u); ctx.lineTo(x + (10 * s - 6 * sw * s) * u, y - 50 * u); ctx.stroke(); }
    if (rimCol && h > 6) { // rim light along top/left edge
      ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = rimCol; ctx.lineWidth = Math.max(0.6, 1.1 * u);
      ctx.beginPath(); ctx.arc(x, y - 92 * u, 6.5 * u, PI * 1.05, PI * 1.85); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 9 * u, y - 82 * u); ctx.lineTo(x - 7 * u, y - 46 * u); ctx.stroke();
    }
    ctx.restore();
  }

  function starsInit(n, seed, R, zmin, zmax) {
    const r = TL.mulberry32(seed), s = [];
    for (let i = 0; i < n; i++) s.push({ p: [(2 * r() - 1) * R, (2 * r() - 1) * R * 0.6, lerp(zmin, zmax, r())], I: 0.2 + 2.2 * Math.pow(r(), 6), c: starCol(r()) });
    return s;
  }

  window.U3 = { cs, Lines, prepBoxes, drawBoxes, figure, starsInit };

  // =============== ACT 1: TITLE ===============
  let tStars, blobAng;
  const T1 = {
    init() { tStars = starsInit(3200, 11, 140, -420, 10); },
    render(ctx, t, acc) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      const z = -2.6 * (t + 0.4 * t * t / 9);
      const cam = camera([0.3 * Math.sin(t * 0.2), 0.15 * Math.sin(t * 0.13), z], [0.3 * Math.sin(t * 0.2) + 0.03, 0, z - 10], 55, 0.02 * Math.sin(t * 0.17));
      const vis = sstep(0.2, 3.2, t);
      const blob = [26, -10, z - 230]; // keeps a constant-ish distance: always looming
      const bz = 230;
      const spr = glow(200, 215, 255);
      const drawStars = (far) => {
        for (const s of tStars) {
          if (!proj(cam, s.p[0], s.p[1], s.p[2])) continue;
          if ((P.d > bz) !== far) continue;
          if (P.x < -20 || P.x > W + 20 || P.y < -20 || P.y > H + 20) continue;
          const I = s.I * vis * Math.min(3, 40 / P.d) * sstep(0.5, 6, P.d);
          C.starPoint(acc, ctx, P.x, P.y, I, s.c, spr);
        }
        acc.flush(ctx);
      };
      drawStars(true);
      // looming dark mass — never fully visible, extends past frame
      const bv = sstep(1.4, 6.5, t);
      if (bv > 0 && proj(cam, blob[0], blob[1], blob[2])) {
        const R = 170 / P.d * cam.foc, cx = P.x, cy = P.y;
        ctx.save();
        ctx.beginPath();
        for (let k = 0; k <= 160; k++) {
          const a = k / 160 * TAU;
          const n = C.fbm(Math.cos(a) * 1.3 + 4, Math.sin(a) * 1.3, t * 0.05, 4);
          const rr = R * (0.82 + 0.36 * n);
          k ? ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.86) : ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.86);
        }
        ctx.closePath();
        ctx.globalAlpha = bv; ctx.fillStyle = '#000'; ctx.fill();
        ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 1.2; ctx.strokeStyle = `rgba(90,120,170,${0.07 * bv})`; ctx.stroke();
        ctx.lineWidth = 14; ctx.strokeStyle = `rgba(60,90,150,${0.035 * bv})`; ctx.stroke();
        ctx.restore();
      }
      drawStars(false);
      return { bloom1: 0.5, bloom2: 0.45 };
    },
  };

  // =============== ACT 2: FEAR ===============
  let dust, fogP, eyes, shapes, fStars;
  const F2 = {
    init() {
      const r = TL.mulberry32(21);
      dust = []; for (let i = 0; i < 2600; i++) dust.push([(2 * r() - 1) * 14, 0, (2 * r() - 1) * 14, 0.3 + r()]);
      fogP = []; for (let i = 0; i < 260; i++) fogP.push([(2 * r() - 1) * 16, r() * 4, -20 + r() * 30, 0.5 + r(), r() * TAU]);
      eyes = []; for (let i = 0; i < 16; i++) { const a = -PI * 0.92 + r() * PI * 0.84, d = 7 + 16 * r(); eyes.push({ p: [Math.cos(a) * d * 1.3, 0.6 + 2.6 * r(), Math.sin(a) * d - 2], t0: S.threats + r() * 2.2, blink: r() * 10, s: 0.035 + 0.03 * r() }); }
      shapes = []; for (let i = 0; i < 7; i++) { const a = -PI * 0.9 + i / 6 * PI * 0.8 + gauss(r) * 0.08, d = 9 + 10 * r(); shapes.push({ p: [Math.cos(a) * d * 1.25, 0, Math.sin(a) * d - 3], h: 3.5 + 5 * r(), w: 0.6 + 0.8 * r(), seed: r() * 10 }); }
      fStars = []; for (let i = 0; i < 4200; i++) { const d = randDir(r); const rad = 12 + 40 * r(); fStars.push({ p: [d[0] * rad, Math.abs(d[1]) * rad * 0.8 + 0.5, d[2] * rad], I: 0.25 + 2 * Math.pow(r(), 5), c: starCol(r()) }); }
    },
    render(ctx, t, acc) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      const rec = sstep(S.recede, 26.6, t);           // space opens up
      const dist = lerp(8.6, 6.2, sstep(9, 21, t)) + 7 * Math.pow(rec, 1.6);
      const ang = 0.16 * Math.sin((t - 9) * 0.12) - 0.05;
      const camY = lerp(1.55, 2.2, rec);
      const pos = [Math.sin(ang) * dist, camY, Math.cos(ang) * dist];
      const cam = camera(pos, [0, lerp(1.05, 1.5, rec), 0], 46, 0);
      const ground = 1 - sstep(S.recede + 0.2, 25.2, t);
      const vis = sstep(8.6, 10.4, t);
      // haze backdrop (lets dark silhouettes read)
      const hz = (0.05 + 0.07 * win(t, 14.8, 22.4, 1.4, 1.0)) * ground * vis;
      if (hz > 0) { const g = ctx.createLinearGradient(0, H * 0.25, 0, H * 0.72); g.addColorStop(0, 'rgba(20,28,40,0)'); g.addColorStop(0.7, `rgba(40,52,70,${hz})`); g.addColorStop(1, 'rgba(20,28,40,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      // stars receding: positions pushed away from camera
      const sv = sstep(S.recede - 0.4, 24.4, t);
      if (sv > 0) {
        const k = 1 + 5 * Math.pow(sstep(S.recede, 27.4, t), 1.4);
        const spr = glow(210, 222, 255);
        for (const s of fStars) {
          const x = pos[0] + (s.p[0] - pos[0]) * k, y = pos[1] + (s.p[1] - pos[1]) * k, z = pos[2] + (s.p[2] - pos[2]) * k;
          if (!proj(cam, x, y, z)) continue;
          if (P.x < 0 || P.x > W || P.y < 0 || P.y > H) continue;
          C.starPoint(acc, ctx, P.x, P.y, s.I * sv * Math.min(2.4, 30 / P.d), s.c, spr);
        }
        acc.flush(ctx);
      }
      // threat silhouettes (dark shapes in haze)
      const th = win(t, S.threats - 0.6, S.threatsGone + 0.9, 1.6, 1.3) * vis;
      if (th > 0) for (const sh of shapes) {
        const back = sstep(S.threatsGone - 0.3, S.threatsGone + 1.2, t) * 6;
        const px = sh.p[0] * (1 + back * 0.08), pz = sh.p[2] - back;
        if (!proj(cam, px, 0, pz)) continue; const bx = P.x, by = P.y, d = P.d;
        const hp = sh.h / d * cam.foc, wp = sh.w / d * cam.foc;
        ctx.save(); ctx.globalAlpha = th * 0.92; ctx.fillStyle = '#010203';
        ctx.beginPath(); ctx.moveTo(bx - wp, by);
        for (let k = 0; k <= 20; k++) { const v = k / 20, wob = (C.fbm(sh.seed, v * 3, t * 0.2, 3) - 0.5) * wp * 0.8; ctx.lineTo(bx - wp * (1 - v * 0.55) + wob, by - hp * v); }
        for (let k = 20; k >= 0; k--) { const v = k / 20, wob = (C.fbm(sh.seed + 3, v * 3, t * 0.2, 3) - 0.5) * wp * 0.8; ctx.lineTo(bx + wp * (1 - v * 0.55) + wob, by - hp * v); }
        ctx.closePath(); ctx.fill(); ctx.restore();
      }
      // ground dust lit by the pool
      const lightI = vis * (0.9 + 0.06 * Math.sin(t * 7.3) * Math.sin(t * 3.1));
      if (ground > 0) {
        for (const d of dust) {
          const rr = Math.hypot(d[0], d[2]); const L = Math.exp(-rr * rr / 6) * lightI * ground;
          if (L < 0.01 || !proj(cam, d[0], 0, d[2])) continue;
          acc.splat(P.x, P.y, 1.0 * L * d[3] * 0.5, 0.86 * L * d[3] * 0.5, 0.7 * L * d[3] * 0.5);
        }
        acc.flush(ctx);
        // light pool + cone
        if (proj(cam, 0, 0, 0)) {
          const gx = P.x, gy = P.y, rp = 1.9 / P.d * cam.foc;
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          ctx.setTransform(1, 0, 0, 0.32, 0, gy * 0.68);
          const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, rp);
          g.addColorStop(0, `rgba(255,214,170,${0.42 * lightI * ground})`); g.addColorStop(0.5, `rgba(255,190,140,${0.12 * lightI * ground})`); g.addColorStop(1, 'rgba(255,180,120,0)');
          ctx.fillStyle = g; ctx.fillRect(gx - rp, gy - rp, rp * 2, rp * 2);
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          if (proj(cam, 0, 7, 0)) {
            const tx = P.x, ty = P.y;
            const cg = ctx.createLinearGradient(0, ty, 0, gy);
            cg.addColorStop(0, 'rgba(255,220,180,0)'); cg.addColorStop(1, `rgba(255,214,170,${0.11 * lightI * ground})`);
            ctx.fillStyle = cg; ctx.beginPath(); ctx.moveTo(tx - 6, ty); ctx.lineTo(tx + 6, ty); ctx.lineTo(gx + rp * 0.75, gy); ctx.lineTo(gx - rp * 0.75, gy); ctx.closePath(); ctx.fill();
          }
          ctx.restore();
        }
      }
      // the person
      if (proj(cam, 0, 0, 0)) {
        const fx = P.x, fy = P.y, h = 1.75 / P.d * cam.foc;
        figure(ctx, fx, fy, h, null, `rgba(255,205,160,${0.5 * ground + 0.2})`, vis);
        const warm = 0.25 + 0.75 * rec;      // the human becomes a warm light point
        drawSprite(ctx, glow(255, 200, 150, 0.15, 0.35), fx, fy - h * 0.55, 14 + 10 * rec, vis * warm * 0.55);
      }
      // eyes
      if (th > 0) for (const e of eyes) {
        const a = sstep(e.t0, e.t0 + 0.8, t) * (1 - sstep(S.threatsGone - 0.2 + e.blink * 0.04, S.threatsGone + 0.4 + e.blink * 0.04, t));
        if (a <= 0 || !proj(cam, e.p[0], e.p[1], e.p[2])) continue;
        const bl = Math.abs(Math.sin(t * 0.7 + e.blink)) > 0.985 ? 0.1 : 1;
        const sep = 0.11 / P.d * cam.foc, sz = Math.max(1.2, e.s / P.d * cam.foc * 3);
        for (const s of [-1, 1]) drawSprite(ctx, glow(255, 170, 110, 0.2, 0.35), P.x + s * sep, P.y, sz, a * bl * 0.8);
      }
      // floating fog motes (parallax foreground)
      ctx.globalCompositeOperation = 'lighter';
      for (const f of fogP) {
        const x = f[0] + Math.sin(t * 0.1 + f[4]) * 0.6, y = f[1] + Math.sin(t * 0.13 + f[4]) * 0.2, z = f[2];
        if (!proj(cam, x, y, z)) continue;
        const sz = 1.4 / P.d * cam.foc;
        drawSprite(ctx, glow(70, 85, 110, 0.0, 0.3), P.x, P.y, sz, 0.035 * f[3] * ground * vis);
      }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      return { bloom1: 0.55, bloom2: 0.45 };
    },
  };

  // =============== ACT 3: SCALE (horizon prologue + logarithmic zoom) ===============
  let pStars;
  const K = TL.COSMOS_OFFSET;
  const altLog = keyed([[26.8, 0.25, 'lin'], [28.4, 0.35, 'smooth'], [30.6, 0.9, 'in'], [32.4, 7.45]]);
  const A3 = {
    init() { pStars = []; const r = TL.mulberry32(5150); for (let i = 0; i < 5000; i++) { const z = r() * 0.98 + 0.02; pStars.push([(2 * r() - 1) * 1.2, z, r(), 0.04 + 1.4 * Math.pow(r(), 9), starCol(r())]); } window.SCENE_COSMOS.init(); },
    render(ctx, t, acc) {
      const local = t - K;
      const pro = 1 - sstep(31.7, 32.5, t);
      if (pro >= 1 || t < 31.7) { this.prologue(ctx, t, acc, 1); return { bloom1: 0.5, bloom2: 0.45 }; }
      const info = window.SCENE_COSMOS.render(ctx, local, acc) || {};
      if (pro > 0) {
        ctx.save(); ctx.globalAlpha = pro;
        const tmp = this._tmp || (this._tmp = C.mk(W, H)); const tx = tmp.getContext('2d');
        this.prologue(tx, t, acc, 1); ctx.drawImage(tmp, 0, 0); ctx.restore();
      }
      return info;
    },
    prologue(ctx, t, acc, a) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      const lh = altLog(t), h = Math.pow(10, lh), R = 6.371e6, foc = (H / 2) / Math.tan(25 * PI / 180);
      const alpha = Math.asin(R / (R + h));
      const rp = Math.min(3e5, foc * Math.tan(alpha));
      const w = sstep(4.3, 7.4, lh);
      const top = lerp(H * 0.64, H / 2 - rp, w);
      const cx = W / 2, cy = top + rp;
      // stars
      const sv = sstep(26.8, 28, t) * 0.9;
      for (const s of pStars) {
        const x = (s[0] * 0.5 + 0.5) * W * 1.2 - W * 0.1 + (t - 26.8) * 4 * s[1], y = s[2] * H;
        if (y > top + 40) continue;
        acc.splat(x, y, s[4][0] * s[3] * sv, s[4][1] * s[3] * sv, s[4][2] * s[3] * sv);
      }
      acc.flush(ctx);
      // atmosphere glow along limb
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const th = 26 + 40 * (1 - w);
      const g = ctx.createRadialGradient(cx, cy, Math.max(0, rp - 2), cx, cy, rp + th);
      g.addColorStop(0, 'rgba(90,150,255,0.55)'); g.addColorStop(0.25, 'rgba(70,120,240,0.22)'); g.addColorStop(1, 'rgba(40,80,200,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rp + th, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      // night-side planet disc
      const dg = ctx.createRadialGradient(cx - rp * 0.3, cy - rp * 0.9, 0, cx, cy, rp);
      dg.addColorStop(0, 'rgb(14,22,40)'); dg.addColorStop(0.6, 'rgb(5,8,16)'); dg.addColorStop(1, 'rgb(2,3,7)');
      ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(cx, cy, rp, 0, TAU); ctx.fill();
      // city-light speckles once high enough
      const cl = sstep(4.5, 6.2, lh) * (1 - sstep(7.0, 7.45, lh));
      if (cl > 0) {
        const r = TL.mulberry32(9);
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 900; i++) {
          const a = -PI / 2 + (r() - 0.5) * 2.2 * (0.2 + w), d = rp * (0.15 + 0.85 * Math.sqrt(r()));
          const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d; if (y < top) continue;
          ctx.globalAlpha = cl * 0.5 * r(); ctx.fillStyle = 'rgb(255,190,120)'; ctx.fillRect(x, y, 1.3, 1.3);
        }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
      ctx.restore();
      // person standing on top of the limb → warm point
      const fh = Math.min(240, 1.75 / (h * 0.9 + 1.2) * foc * 0.5);
      figure(ctx, cx, top + 1, fh, null, 'rgba(140,190,255,0.6)', 1);
      drawSprite(ctx, glow(255, 200, 150, 0.15, 0.35), cx, top - Math.max(2, fh * 0.55), 22, 0.35 + 0.4 * sstep(1, 4, lh));
    },
    hud(ctx, t, logD) { if (t > 32) window.SCENE_COSMOS.hud(ctx, t - K, logD); },
  };

  window.ACT_TITLE = T1; window.ACT_FEAR = F2; window.ACT_COSMOS = A3;
})();
