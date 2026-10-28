// Act 4 (impossible geometry), Act 5 (indifferent ruins), Act 6 (Lovecraft / sea fog / R'lyeh)
(function () {
  'use strict';
  const C = window.CORE, U = window.U3;
  const { W, H, TAU, PI, clamp, lerp, sstep, win, ease, gauss, randDir, keyed, camera, P, proj, glow, drawSprite, starCol, norm, cross } = C;
  const S = TL.SYNC;

  // =============== ACT 4: GEOMETRY ===============
  const PER = 16; // spatial period along -z
  const L1 = new U.Lines(10), L2 = new U.Lines(10), L3 = new U.Lines(10);
  // camera path relative to "home" origin; travels 3 periods during the dive and returns to the same relative pose
  const travel = keyed([[49.8, 0, 'lin'], [55.0, 0, 'in'], [58.0, 10, 'lin'], [64.0, 38, 'out'], [67.6, 48, 'lin'], [80, 48]]);
  const inCor = keyed([[49.8, 0, 'lin'], [54.6, 0, 'smooth'], [56.4, 1, 'lin'], [64.6, 1, 'smooth'], [67.6, 0]]);
  function geoCam(t) {
    const orbit = 0.55 + 0.08 * (t - 49.8) - 0.6 * sstep(67.6, 69.6, t) * 0 ;
    const o = Math.min(orbit, 0.55 + 0.08 * (68.4 - 49.8));
    const home = [Math.sin(o) * 6.2, 2.1, Math.cos(o) * 6.2];
    const cor = [0, 0.55, 5.2];
    const k = inCor(t);
    const z = -travel(t);
    const p = [lerp(home[0], cor[0], k), lerp(home[1], cor[1], k), lerp(home[2], cor[2], k) + z];
    const tg = [lerp(0, 0, k), lerp(0.1, 0.55, k), lerp(0, -10, k) + z];
    const still = sstep(68.0, 69.0, t);
    const jitter = still * 0.004 * Math.sin(t * 2.3);
    return camera([p[0] + jitter, p[1], p[2]], tg, lerp(55, 62, k), 0);
  }
  let pen;
  function penrose() {
    const cam = geoCam(61.5);
    const P0 = [0.6, 0.9, cam.pos[2] - 11];
    const v = norm([P0[0] - cam.pos[0], P0[1] - cam.pos[1], P0[2] - cam.pos[2]]);
    const d = [-v[0], -v[1], -v[2]];                       // e1+e2+e3 ∝ d
    let a = norm(cross(d, [0, 1, 0])), b = cross(a, d);
    // orthonormal e1,e2,e3 with sum along d
    const s3 = 1 / Math.sqrt(3), c = Math.sqrt(2 / 3);
    const E = [0, 1, 2].map(i => { const ang = i * TAU / 3 + 0.3; return [d[0] * s3 + c * (Math.cos(ang) * a[0] + Math.sin(ang) * b[0]), d[1] * s3 + c * (Math.cos(ang) * a[1] + Math.sin(ang) * b[1]), d[2] * s3 + c * (Math.cos(ang) * a[2] + Math.sin(ang) * b[2])]; });
    const Ln = 2.2, pts = [P0];
    for (const e of E) { const q = pts[pts.length - 1]; pts.push([q[0] + e[0] * Ln, q[1] + e[1] * Ln, q[2] + e[2] * Ln]); }
    pen = pts;
  }
  function rot(p, ax, ay) { let [x, y, z] = p; const c1 = Math.cos(ax), s1 = Math.sin(ax), c2 = Math.cos(ay), s2 = Math.sin(ay); let y2 = y * c1 - z * s1, z2 = y * s1 + z * c1; y = y2; z = z2; const x2 = x * c2 + z * s2; z2 = -x * s2 + z * c2; return [x2, y, z2]; }
  const CUBE_E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  const CUBE_V = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
  const G4 = {
    init() { penrose(); },
    render(ctx, t, acc) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      const cam = geoCam(t);
      const vis = sstep(49.8, 51.2, t) * (1 - sstep(72.4, 73.6, t));
      const fogD = 15;
      const fz = (p) => { cs3(cam, p); return Math.exp(-Math.max(0, T3[2]) / fogD); };
      const cz = cam.pos[2];
      const n0 = Math.round(-cz / PER); // nearest home index
      const cor = sstep(54.8, 56.6, t) * (1 - sstep(64.8, 67.4, t));
      const still = sstep(68.0, 69.0, t);
      // floor grid (periodic)
      const gy = -1.05;
      const g0 = Math.floor(cz) - 34, g1 = Math.floor(cz) + 8;
      const ga = 0.55 * vis * (1 - 0.5 * cor);
      for (let x = -14; x <= 14; x++) for (let z = g0; z < g1; z += 2) { const p = [x, gy, z], q = [x, gy, z + 2]; L1.add(cam, p, q, ga * fz([x, gy, z + 1]) * (x % 4 ? 0.5 : 1)); }
      for (let z = g0; z < g1; z++) for (let x = -14; x < 14; x += 2) { const p = [x, gy, z], q = [x + 2, gy, z]; L1.add(cam, p, q, ga * fz([x + 1, gy, z]) * (z % 4 ? 0.5 : 1)); }
      // home objects for the nearest periods (cube + axes)
      for (let n = n0 - 1; n <= n0 + 3; n++) {
        const oz = -n * PER;
        const ov = vis * (n === n0 ? 1 : cor);
        if (ov < 0.01) continue;
        // axes
        const ax = 0.85 * ov;
        L2.add(cam, [-0.2, 0, oz], [3.4, 0, oz], ax * fz([1.5, 0, oz])); L2.add(cam, [0, -0.2, oz], [0, 3.0, oz], ax * fz([0, 1.4, oz])); L2.add(cam, [0, 0, oz + 0.2], [0, 0, oz - 3.4], ax * fz([0, 0, oz - 1.5]));
        for (let k = 1; k <= 3; k++) { L2.add(cam, [k, -0.07, oz], [k, 0.07, oz], ax); L2.add(cam, [-0.07, k, oz], [0.07, k, oz], ax); L2.add(cam, [0, -0.07, oz - k], [0, 0.07, oz - k], ax); }
        // cube (rotation is time-locked → identical on every visit)
        const ry = 0.5 + 0.25 * (t - 49.8) * (1 - still * 0.98), rx = 0.35;
        const sc = 0.62, cc = [0, 0.75, oz];
        const vv = CUBE_V.map(v => { const r = rot([v[0] * sc, v[1] * sc, v[2] * sc], rx, ry); return [r[0] + cc[0], r[1] + cc[1], r[2] + cc[2]]; });
        for (const [i, j] of CUBE_E) L3.add(cam, vv[i], vv[j], ov * fz(cc));
        // contradictory perspective: the same cube in reversed perspective, drifting in and out
        if (still > 0 && n === n0) {
          const k = still * (0.5 + 0.5 * Math.sin((t - 68.4) * 1.6 - PI / 2));
          cs3(cam, cc); const zc = T3[2];
          const inv = vv.map(p => { cs3(cam, p); const dz = T3[2] - zc; const zz = zc - dz * 2.2; return [T3[0] / T3[2] * zz, T3[1] / T3[2] * zz, zz]; });
          const toW = (q) => [cam.pos[0] + q[0] * cam.r[0] + q[1] * cam.u[0] + q[2] * cam.f[0], cam.pos[1] + q[0] * cam.r[1] + q[1] * cam.u[1] + q[2] * cam.f[1], cam.pos[2] + q[0] * cam.r[2] + q[1] * cam.u[2] + q[2] * cam.f[2]];
          for (const [i, j] of CUBE_E) L3.add(cam, toW(inv[i]), toW(inv[j]), k * 0.8);
        }
      }
      // corridor frames
      if (cor > 0.01) {
        const tw = 0.0 + 0.055 * sstep(57.0, 63.0, t);
        const f0 = Math.floor(-cz / 2) - 2, f1 = f0 + 34;
        for (let k = f0; k < f1; k++) {
          const z = -k * 2 - 2.6; if (z > cz - 0.3) continue;
          const a = (k * tw) % TAU, hw = 1.7, hh = 1.7, yc = 0.6;
          const cnr = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), yc + x * Math.sin(a) + y * Math.cos(a), z]);
          const al = cor * vis * fz([0, yc, z]);
          for (let i = 0; i < 4; i++) L3.add(cam, cnr[i], cnr[(i + 1) % 4], al * 0.9);
          const a2 = ((k + 1) * tw) % TAU, z2 = z - 2;
          const nx = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => [x * Math.cos(a2) - y * Math.sin(a2), yc + x * Math.sin(a2) + y * Math.cos(a2), z2]);
          for (let i = 0; i < 4; i++) L2.add(cam, cnr[i], nx[i], al * 0.4);
        }
      }
      ctx.globalCompositeOperation = 'lighter';
      L1.flush(ctx, '120,150,210', 1, 0.7);
      L2.flush(ctx, '170,195,240', 1.2, 0.9);
      L3.flush(ctx, '225,235,255', 1.6, 1);
      // Penrose: three beams, drawn so the last overlaps the first (impossible closure at t≈61.5)
      const pv = win(t, 58.6, 65.6, 1.2, 1.2) * vis;
      if (pv > 0) {
        ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'butt';
        for (let i = 0; i < 3; i++) {
          const a = pen[i], b = pen[i + 1];
          cs3(cam, a); if (T3[2] < 0.3) continue; const x1 = W / 2 + T3[0] / T3[2] * cam.foc, y1 = H / 2 - T3[1] / T3[2] * cam.foc, w1 = 0.5 / T3[2] * cam.foc;
          cs3(cam, b); if (T3[2] < 0.3) continue; const x2 = W / 2 + T3[0] / T3[2] * cam.foc, y2 = H / 2 - T3[1] / T3[2] * cam.foc;
          const ext = 0.5 * w1 / Math.hypot(x2 - x1, y2 - y1);
          const ax1 = x1 - (x2 - x1) * ext, ay1 = y1 - (y2 - y1) * ext, ax2 = x2 + (x2 - x1) * ext, ay2 = y2 + (y2 - y1) * ext;
          ctx.globalAlpha = pv; ctx.strokeStyle = 'rgb(230,238,255)'; ctx.lineWidth = w1 + 3;
          ctx.beginPath(); ctx.moveTo(ax1, ay1); ctx.lineTo(ax2, ay2); ctx.stroke();
          ctx.strokeStyle = 'rgb(4,6,10)'; ctx.lineWidth = w1;
          ctx.beginPath(); ctx.moveTo(ax1, ay1); ctx.lineTo(ax2, ay2); ctx.stroke();
          ctx.strokeStyle = `rgba(150,180,230,${0.5})`; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(ax1, ay1); ctx.lineTo(ax2, ay2); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      ctx.globalCompositeOperation = 'source-over';
      return { bloom1: 0.5, bloom2: 0.4 };
    },
  };
  const T3 = [0, 0, 0];
  function cs3(cam, p) { return U.cs(cam, p[0], p[1], p[2], T3); }

  // =============== ACT 5: RUINS ===============
  let ruins, ruinStars;
  const camDist = keyed([[72.6, 7.5, 'lin'], [76.0, 7.0, 'in'], [84, 60, 'lin'], [95.8, 1400]]);
  const R5 = {
    init() {
      const r = TL.mulberry32(505); ruins = [];
      const stone = () => { const v = 30 + 14 * r(); return [v * 0.95, v, v * 1.1]; };
      // near ruins: pillars, lintels, tilted slabs (scale ~ 4–20 m)
      for (let i = 0; i < 34; i++) {
        const x = (2 * r() - 1) * 34, z = -10 - 40 * r(); if (Math.abs(x) < 3 && z > -16) continue;
        const kind = r();
        if (kind < 0.5) { const h = 6 + 16 * r(); ruins.push({ c: [x, h / 2, z], s: [1.6 + 2 * r(), h, 1.6 + 2 * r()], yaw: r() * 0.6, tilt: (r() - 0.5) * 0.18, roll: (r() - 0.5) * 0.14, col: stone() }); }
        else if (kind < 0.75) { ruins.push({ c: [x, 0.8 + r() * 2, z], s: [6 + 8 * r(), 1.6 + 2 * r(), 3 + 3 * r()], yaw: r() * 1.2, tilt: (r() - 0.5) * 0.4, roll: (r() - 0.5) * 0.3, col: stone() }); }
        else { const h = 14 + 10 * r(); ruins.push({ c: [x, h / 2 - 1, z], s: [3 + 3 * r(), h, 1.2], yaw: r() * 2, tilt: 0.3 * (r() - 0.5), roll: 0.35 * (r() - 0.5), col: stone() }); }
      }
      // the ground they stand on is one step of a colossal stepped structure
      for (let k = 0; k < 9; k++) {
        const h = 26, w = 220 + 120 * k, d = 120 + 70 * k;
        ruins.push({ c: [0, -h / 2 - k * h, -40 - k * 40 + d / 2 - 60], s: [w, h, d], yaw: 0, col: [26, 28, 32] });
      }
      for (let k = 0; k < 7; k++) {
        const h = 120 + 90 * k;
        ruins.push({ c: [(k % 2 ? -1 : 1) * (60 + 40 * k), h / 2 - 20, -70 - 30 * k], s: [18 + 6 * k, h, 18 + 6 * k], yaw: 0.2 * k, tilt: 0.05 * (k % 3 - 1), col: [30, 32, 36] });
      }
      // incomprehensible megastructures beyond (km scale), extending past the frame
      for (let k = 0; k < 9; k++) {
        const h = 900 + 1700 * r(), x = (2 * r() - 1) * 2600, z = -900 - 2600 * r();
        ruins.push({ c: [x, h / 2 - 300, z], s: [140 + 400 * r(), h, 140 + 400 * r()], yaw: r() * 3, tilt: (r() - 0.5) * 0.3, roll: (r() - 0.5) * 0.4, col: [8, 9, 12], fogK: 0.55 });
      }
      ruins.push({ c: [300, 1200, -5200], s: [4200, 5200, 900], yaw: 0.4, tilt: 0.12, roll: -0.2, col: [5, 6, 8], fogK: 0.5 });
      U.prepBoxes(ruins);
      ruinStars = U.starsInit(1200, 77, 1, 0, 1);
    },
    render(ctx, t, acc) {
      const d = camDist(t);
      const vis = sstep(72.6, 74.6, t);
      const fog = { col: [24, 28, 37], d: 30 + d * 1.6 };
      // sky: haze brighter near horizon
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgb(4,5,8)'); g.addColorStop(0.55, 'rgb(22,26,35)'); g.addColorStop(1, 'rgb(10,11,15)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (const s of ruinStars) acc.splat(s.p[0] * 0.5 * W + W / 2, (s.p[1] * 0.5 + 0.5) * H * 0.5, s.c[0] * s.I * 0.12, s.c[1] * s.I * 0.12, s.c[2] * s.I * 0.12);
      acc.flush(ctx);
      const el = 0.12 + 0.12 * sstep(76, 92, t);
      const pos = [1.2, 1.5 + d * Math.sin(el), 4 + d * Math.cos(el)];
      const tgt = [0, lerp(2.4, -d * 0.08, sstep(76, 95, t)), lerp(-8, -d * 0.5, sstep(76, 95, t))];
      const cam = camera(pos, tgt, 50, 0);
      U.drawBoxes(ctx, cam, ruins, fog, norm([-0.5, 0.75, 0.42]), { amb: 0.32, rim: 0.35 });
      // the walker
      const wx = lerp(-2.6, 2.4, clamp((t - 72.6) / 21)), wz = -3;
      if (proj(cam, wx, 0, wz)) {
        const h = 1.75 / P.d * cam.foc;
        U.figure(ctx, P.x, P.y, h, t * 5.2, 'rgba(160,190,240,0.55)', vis);
        drawSprite(ctx, glow(255, 200, 150, 0.15, 0.35), P.x, P.y - h * 0.55, 8 + h * 0.08, vis * 0.45 * (1 - sstep(86, 93, t)));
      }
      // drifting fog banks (parallax)
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        const y = H * (0.55 + 0.07 * i) + 6 * Math.sin(t * 0.2 + i), x = ((t * (6 + 3 * i) + i * 400) % (W + 1200)) - 600;
        const gg = ctx.createRadialGradient(x, y, 0, x, y, 520);
        gg.addColorStop(0, `rgba(60,70,90,${0.06})`); gg.addColorStop(1, 'rgba(60,70,90,0)');
        ctx.fillStyle = gg; ctx.setTransform(1, 0, 0, 0.25, 0, y * 0.75); ctx.fillRect(x - 520, y - 520, 1040, 1040); ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
      ctx.globalCompositeOperation = 'source-over';
      return { bloom1: 0.35, bloom2: 0.35, black: 1 - vis };
    },
  };

  // =============== ACT 6: SEA / R'LYEH ===============
  let city, colossus;
  const O6 = {
    init() {
      const r = TL.mulberry32(1928); city = [];
      for (let i = 0; i < 26; i++) {
        const x = (2 * r() - 1) * 170, z = -120 - 170 * r(), h = 25 + 80 * r();
        city.push({ c: [x, h / 2 - 8, z], s: [8 + 20 * r(), h, 8 + 18 * r()], yaw: r() * 3, tilt: (r() - 0.5) * 0.55, roll: (r() - 0.5) * 0.6, col: [24, 36, 34] });
      }
      city.push({ c: [-20, 34, -230], s: [70, 80, 50], yaw: 0.7, tilt: 0.35, roll: -0.3, col: [26, 38, 36] });
      U.prepBoxes(city);
      colossus = []; for (let k = 0; k <= 200; k++) { const a = k / 200; colossus.push(C.fbm(a * 6 + 2, 1.5, 0, 5)); }
    },
    render(ctx, t, acc) {
      const vis = sstep(94.6, 96.2, t);
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgb(3,5,7)'); g.addColorStop(0.5, 'rgb(14,20,24)'); g.addColorStop(0.56, 'rgb(10,15,18)'); g.addColorStop(1, 'rgb(2,3,4)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const z0 = -(t - 94.6) * 1.6;
      const cam = camera([0, 3.2 + 0.3 * Math.sin(t * 0.35), 20 + z0], [0, 4.5, -60 + z0], 52, 0.015 * Math.sin(t * 0.4));
      const reveal = sstep(100.8, 108, t);
      const fogD = lerp(25, 140, reveal);
      // colossus silhouette on the horizon (never fully visible)
      const cv = sstep(105.5, 112, t) * vis;
      if (cv > 0) {
        if (proj(cam, 0, 0, -1600)) {
          const hy = P.y, s = 520;
          ctx.beginPath(); ctx.moveTo(-50, hy + 4);
          for (let k = 0; k <= 200; k++) { const a = k / 200; const env = Math.sin(a * PI); ctx.lineTo(-50 + a * (W + 100), hy - (0.15 + env * 1.3) * s * (0.6 + 0.6 * colossus[k])); }
          ctx.lineTo(W + 50, hy + 4); ctx.closePath();
          ctx.globalAlpha = cv; ctx.fillStyle = 'rgb(6,9,11)'; ctx.fill();
          ctx.strokeStyle = `rgba(90,120,130,${0.12 * cv})`; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
      // sunken city (wrong angles)
      const cityA = sstep(100.4, 103, t) * vis;
      for (const b of city) b.alpha = cityA;
      U.drawBoxes(ctx, cam, city, { col: [12, 18, 21], d: fogD }, norm([0.3, 0.8, 0.5]), { amb: 0.35, rim: 0.4 });
      // sea surface: wave lines
      const Lw = new U.Lines(10);
      for (let i = 0; i < 70; i++) {
        const z = z0 + 18 - Math.pow(i, 1.45) * 0.9; let prev = null;
        const al = Math.exp(-(cam.pos[2] - z) / 70) * vis;
        for (let k = 0; k <= 60; k++) {
          const x = (k / 60 - 0.5) * (40 + (cam.pos[2] - z) * 1.6);
          const y = 0.5 * Math.sin(x * 0.18 + t * 0.9 + z * 0.3) + 0.35 * Math.sin(x * 0.47 - t * 1.3 + z * 0.11) + 0.2 * Math.sin(z * 0.6 + t * 0.7);
          const p = [x, y, z]; if (prev) Lw.add(cam, prev, p, al * (0.35 + 0.3 * Math.sin(x * 0.5 + t))); prev = p;
        }
      }
      ctx.globalCompositeOperation = 'lighter'; Lw.flush(ctx, '110,140,150', 1, 0.6);
      // fog banks
      for (let i = 0; i < 7; i++) {
        const y = H * (0.47 + 0.05 * i), x = ((t * (9 + 4 * i) + i * 330) % (W + 1400)) - 700;
        const gg = ctx.createRadialGradient(x, y, 0, x, y, 640);
        gg.addColorStop(0, `rgba(70,90,95,${0.08 * (1 - reveal * 0.5)})`); gg.addColorStop(1, 'rgba(70,90,95,0)');
        ctx.fillStyle = gg; ctx.setTransform(1, 0, 0, 0.22, 0, y * 0.78); ctx.fillRect(x - 640, y - 640, 1280, 1280); ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
      ctx.globalCompositeOperation = 'source-over';
      // darken behind the title/quote cards
      const card = Math.max(win(t, 95.4, 101, 0.8, 0.8), win(t, 104.8, 110, 0.6, 0.8)) * 0.55;
      if (card > 0) { const cg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.55); cg.addColorStop(0, `rgba(0,0,0,${card})`); cg.addColorStop(1, `rgba(0,0,0,${card * 0.3})`); ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H); }
      return { bloom1: 0.4, bloom2: 0.4 };
    },
  };

  window.ACT_GEOM = G4; window.ACT_RUINS = R5; window.ACT_OCEAN = O6;
})();
