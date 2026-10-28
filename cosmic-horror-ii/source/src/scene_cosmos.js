// Scene 0–24s: Earth intro + logarithmic zoom-out (Earth → Solar System → Milky Way → Observable Universe)
(function () {
  'use strict';
  const C = window.CORE;
  const { W, H, PI, TAU, clamp, lerp, sstep, win, gauss, mk, norm, randDir, keyed, camera, P, proj, projDir, glow, drawSprite, starPoint, starCol } = C;
  const AU = 1.496e11, LY = 9.461e15;

  // ---------------- Earth texture ----------------
  function hash3(x, y, z) {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function vnoise(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    let fx = x - xi, fy = y - yi, fz = z - zi;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
    const l = (a, b, t) => a + (b - a) * t;
    const c000 = hash3(xi, yi, zi), c100 = hash3(xi + 1, yi, zi), c010 = hash3(xi, yi + 1, zi), c110 = hash3(xi + 1, yi + 1, zi);
    const c001 = hash3(xi, yi, zi + 1), c101 = hash3(xi + 1, yi, zi + 1), c011 = hash3(xi, yi + 1, zi + 1), c111 = hash3(xi + 1, yi + 1, zi + 1);
    return l(l(l(c000, c100, fx), l(c010, c110, fx), fy), l(l(c001, c101, fx), l(c011, c111, fx), fy), fz);
  }
  function fbm(x, y, z, oct) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, z * f); n += a; a *= 0.5; f *= 2.03; } return s / n; }
  window.CORE.fbm = fbm;

  const TW = 1024, TH = 512;
  let texCol, texCloud, texLight, texOcean;
  function buildEarth() {
    texCol = new Uint8ClampedArray(TW * TH * 3); texCloud = new Uint8ClampedArray(TW * TH);
    texLight = new Uint8ClampedArray(TW * TH); texOcean = new Uint8ClampedArray(TW * TH);
    const rr = TL.mulberry32(42);
    for (let j = 0; j < TH; j++) {
      const lat = PI / 2 - (j + 0.5) / TH * PI, cl = Math.cos(lat), sl = Math.sin(lat);
      for (let i = 0; i < TW; i++) {
        const lon = (i + 0.5) / TW * TAU - PI;
        const x = cl * Math.cos(lon), y = sl, z = cl * Math.sin(lon);
        const n = fbm(x * 1.6 + 11, y * 1.6 + 3, z * 1.6 + 7, 6) + 0.12 * (fbm(x * 6, y * 6, z * 6, 3) - 0.5);
        const land = n > 0.53;
        const k = j * TW + i, k3 = k * 3;
        const alat = Math.abs(lat) * 180 / PI;
        let r, g, b;
        if (land) {
          const m = fbm(x * 4 + 5, y * 4, z * 4, 4);
          const desert = clamp(1 - Math.abs(alat - 24) / 14) * sstep(0.45, 0.6, m);
          r = lerp(38, 168, desert); g = lerp(78, 136, desert); b = lerp(36, 86, desert);
          const h = sstep(0.53, 0.66, n); r = lerp(r, 120, h * 0.5); g = lerp(g, 105, h * 0.5); b = lerp(b, 80, h * 0.5);
          if (alat > 62) { const ice = sstep(62, 72, alat); r = lerp(r, 236, ice); g = lerp(g, 242, ice); b = lerp(b, 248, ice); }
          texLight[k] = (n > 0.545 && alat < 60 && fbm(x * 18, y * 18, z * 18, 2) > 0.58 && rr() < 0.55) ? 255 * (0.4 + 0.6 * rr()) : 0;
        } else {
          const sh = sstep(0.44, 0.53, n);
          r = lerp(4, 22, sh); g = lerp(20, 78, sh); b = lerp(52, 128, sh);
          if (alat > 74) { r = 225; g = 235; b = 245; }
          texOcean[k] = alat > 74 ? 0 : 255;
        }
        texCol[k3] = r; texCol[k3 + 1] = g; texCol[k3 + 2] = b;
        const cn = fbm(x * 2.6 + 40, y * 5.2, z * 2.6, 6);
        texCloud[k] = 255 * sstep(0.52, 0.72, cn);
      }
    }
  }

  let earthCv, earthCx, earthImg; const EMAX = 760;
  function drawEarth(ctx, cx, cy, R, rot, sun, alpha) {
    if (R < 1.4) {
      drawSprite(ctx, glow(110, 165, 255), cx, cy, 6 + 4 * R, alpha * 0.9);
      ctx.globalAlpha = alpha; ctx.fillStyle = 'rgb(170,205,255)'; ctx.fillRect(cx - 1, cy - 1, 2, 2); ctx.globalAlpha = 1;
      return;
    }
    const r = Math.min(R, EMAX / 2 - 4), S = Math.ceil(2 * r + 6), c0 = S / 2;
    if (!earthCv) { earthCv = mk(EMAX, EMAX); earthCx = earthCv.getContext('2d'); earthImg = earthCx.createImageData(EMAX, EMAX); }
    const d = earthImg.data;
    const tilt = 0.41, ct = Math.cos(tilt), st = Math.sin(tilt);
    const hx = sun[0], hy = sun[1], hz = sun[2] + 1, hl = Math.hypot(hx, hy, hz);
    const Hx = hx / hl, Hy = hy / hl, Hz = hz / hl;
    for (let py = 0; py < S; py++) {
      const ny = -(py + 0.5 - c0) / r;
      for (let px = 0; px < S; px++) {
        const j = (py * EMAX + px) * 4;
        const nx = (px + 0.5 - c0) / r;
        const d2 = nx * nx + ny * ny;
        if (d2 >= 1) { d[j + 3] = 0; continue; }
        const nz = Math.sqrt(1 - d2);
        const x1 = nx * ct + ny * st, y1 = -nx * st + ny * ct;
        let lon = Math.atan2(x1, nz) + rot;
        let u = (lon / TAU) % 1; if (u < 0) u += 1;
        const v = 0.5 - Math.asin(y1) / PI;
        const ti = Math.min(TH - 1, (v * TH) | 0) * TW + Math.min(TW - 1, (u * TW) | 0);
        const L = nx * sun[0] + ny * sun[1] + nz * sun[2];
        const diff = L > 0 ? L : 0;
        const day = sstep(-0.12, 0.22, L);
        const cl = texCloud[ti] / 255;
        let r0 = texCol[ti * 3], g0 = texCol[ti * 3 + 1], b0 = texCol[ti * 3 + 2];
        const lit = 0.025 + 0.975 * diff;
        r0 *= lit; g0 *= lit; b0 *= lit;
        const cw = 245 * (0.03 + 0.97 * diff);
        r0 += (cw - r0) * cl * 0.9; g0 += (cw - g0) * cl * 0.9; b0 += (cw * 1.02 - b0) * cl * 0.9;
        const night = (1 - day) * (1 - cl) * texLight[ti] / 255;
        r0 += 255 * night; g0 += 175 * night; b0 += 80 * night;
        const sp = nx * Hx + ny * Hy + nz * Hz;
        if (sp > 0 && texOcean[ti]) { const s = Math.pow(sp, 60) * 160 * (1 - cl) * day; r0 += s; g0 += s * 0.95; b0 += s * 0.85; }
        const rim = Math.pow(1 - nz, 2.2) * (0.1 + 0.9 * sstep(-0.35, 0.45, L));
        r0 += 70 * rim; g0 += 130 * rim; b0 += 255 * rim;
        d[j] = r0; d[j + 1] = g0; d[j + 2] = b0;
        d[j + 3] = 255 * clamp((1 - Math.sqrt(d2)) * r * 1.5);
      }
    }
    earthCx.putImageData(earthImg, 0, 0, 0, 0, S, S);
    ctx.save();
    ctx.globalAlpha = alpha;
    const scale = R / r;
    ctx.drawImage(earthCv, 0, 0, S, S, cx - c0 * scale, cy - c0 * scale, S * scale, S * scale);
    // atmosphere halo (sun side)
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, R * 0.97, cx, cy, R * 1.16);
    g.addColorStop(0, 'rgba(90,150,255,0.28)'); g.addColorStop(0.3, 'rgba(80,140,255,0.12)'); g.addColorStop(1, 'rgba(60,110,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.2, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // ---------------- datasets (meters, Earth at origin) ----------------
  const SUN = [-AU, 0, 0];
  const PLANETS = [
    [0.387, [180, 170, 160], 2.1], [0.723, [235, 205, 150], 2.6], [1.524, [225, 115, 75], 2.3],
    [5.20, [225, 195, 155], 3.4], [9.58, [235, 215, 165], 3.1], [19.2, [160, 225, 235], 2.6], [30.07, [110, 150, 255], 2.6],
  ];
  const GAL_C = [-2.53e20 * 0.92, 0, -2.53e20 * 0.39];
  let sky, belt, oort, local, galaxy, neigh, web, galSprites;

  function pointsSet(n) { return { n, x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n), r: new Float32Array(n), g: new Float32Array(n), b: new Float32Array(n), i: new Float32Array(n), s: new Float32Array(n), k: new Uint8Array(n) }; }
  function setPt(S, j, p, col, I, size = 0, k = 0) { S.x[j] = p[0]; S.y[j] = p[1]; S.z[j] = p[2]; S.r[j] = col[0]; S.g[j] = col[1]; S.b[j] = col[2]; S.i[j] = I; S.s[j] = size; S.k[j] = k; }

  function buildSets() {
    const r = TL.mulberry32(1234);
    // sky (directions) incl. Milky Way band
    sky = pointsSet(9000);
    const bandN = norm([0.3, 1, 0.45]);
    for (let j = 0; j < 9000; j++) {
      let d;
      if (j < 3500) d = randDir(r);
      else { // band: perturb points near great circle perpendicular to bandN
        let v = randDir(r); const k = v[0] * bandN[0] + v[1] * bandN[1] + v[2] * bandN[2];
        const off = gauss(r) * 0.09;
        v = norm([v[0] - bandN[0] * (k - off), v[1] - bandN[1] * (k - off), v[2] - bandN[2] * (k - off)]); d = v;
      }
      const I = j < 3500 ? 0.05 + 1.6 * Math.pow(r(), 9) : 0.03 + 0.05 * r();
      setPt(sky, j, d, starCol(r()), I);
    }
    // asteroid + kuiper belts
    belt = pointsSet(5000);
    for (let j = 0; j < 5000; j++) {
      const kuiper = j >= 2000;
      const a = (kuiper ? 30 + 20 * Math.pow(r(), 0.7) : 2.2 + r()) * AU, th = TAU * r();
      setPt(belt, j, [SUN[0] + a * Math.cos(th), gauss(r) * a * (kuiper ? 0.06 : 0.02), SUN[2] + a * Math.sin(th)], kuiper ? [0.6, 0.75, 1] : [1, 0.85, 0.7], kuiper ? 0.05 : 0.07);
    }
    // Oort cloud shell
    oort = pointsSet(5000);
    for (let j = 0; j < 5000; j++) {
      const d = randDir(r), rad = (2000 + 98000 * Math.pow(r(), 1.6)) * AU;
      setPt(oort, j, [SUN[0] + d[0] * rad, d[1] * rad, SUN[2] + d[2] * rad], [0.65, 0.78, 1], 0.06 + 0.06 * r());
    }
    // local stars ~ up to 1500 ly
    local = pointsSet(4000);
    for (let j = 0; j < 4000; j++) {
      const d = randDir(r), rad = (4 + 1500 * Math.pow(r(), 0.5)) * LY;
      setPt(local, j, [SUN[0] + d[0] * rad, d[1] * rad * 0.5, SUN[2] + d[2] * rad], starCol(r()), 0.3 + 3 * Math.pow(r(), 4));
    }
    // galaxy
    const GR = 4.9e20; const NG = 42000;
    galaxy = pointsSet(NG);
    for (let j = 0; j < NG; j++) {
      let p, col, I;
      const q = r();
      if (q < 0.17) { // bulge
        const s = 0.11 * GR; p = [gauss(r) * s, gauss(r) * s * 0.55, gauss(r) * s];
        col = [1, 0.86, 0.64]; I = 0.3;
      } else if (q < 0.82) { // arms
        const arm = (r() * 4) | 0;
        const rad = GR * (0.1 + 0.9 * Math.pow(r(), 0.75));
        const th = arm * PI / 2 + Math.log(rad / (0.1 * GR)) / Math.tan(0.38) + gauss(r) * 0.22 * (0.4 + 0.6 * (1 - rad / GR));
        const rr2 = rad * (1 + gauss(r) * 0.06);
        p = [rr2 * Math.cos(th), gauss(r) * 0.012 * GR, rr2 * Math.sin(th)];
        const hii = r() < 0.06;
        col = hii ? [1, 0.45, 0.65] : (r() < 0.6 ? [0.62, 0.74, 1] : [0.9, 0.9, 1]); I = hii ? 0.5 : 0.28;
      } else { // diffuse disk
        const rad = -Math.log(1 - r() * 0.98) * 0.3 * GR, th = TAU * r();
        p = [rad * Math.cos(th), gauss(r) * 0.02 * GR, rad * Math.sin(th)];
        col = [0.85, 0.82, 0.86]; I = 0.16;
      }
      setPt(galaxy, j, p, col, I);
    }
    // neighbouring galaxies (fly-by between 10^21 and 10^25 m)
    neigh = pointsSet(2600);
    for (let j = 0; j < 2600; j++) {
      const d = randDir(r), rad = Math.pow(10, 22.25 + 2.7 * Math.pow(r(), 0.8));
      setPt(neigh, j, [d[0] * rad, d[1] * rad, d[2] * rad], r() < 0.5 ? [1, 0.88, 0.72] : [0.75, 0.82, 1], 0.6 + r(), (0.6 + 2.4 * r()) * 1e20, (r() * 4) | 0);
    }
    // cosmic web inside observable universe radius
    const RU = 4.4e26;
    const nodes = [];
    while (nodes.length < 420) { const p = [(2 * r() - 1) * RU, (2 * r() - 1) * RU, (2 * r() - 1) * RU]; if (Math.hypot(p[0], p[1], p[2]) < RU) nodes.push(p); }
    const pts = [];
    const palette = [[0.62, 0.5, 1], [1, 0.62, 0.42], [0.45, 0.68, 1], [0.95, 0.75, 1]];
    for (let a = 0; a < nodes.length; a++) {
      const A = nodes[a];
      const ds = nodes.map((B, bi) => [Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]), bi]).sort((u, v) => u[0] - v[0]);
      const col = palette[a % 4];
      for (let c = 0; c < 30; c++) pts.push([[A[0] + gauss(r) * 0.012 * RU, A[1] + gauss(r) * 0.012 * RU, A[2] + gauss(r) * 0.012 * RU], col, 0.45]);
      for (let m = 1; m <= 3; m++) {
        const [len, bi] = ds[m]; if (bi < a && m > 1) continue; const B = nodes[bi];
        const cnt = Math.round(len / RU * 70);
        for (let c = 0; c < cnt; c++) {
          const s = r(), w = 0.006 * RU;
          pts.push([[A[0] + (B[0] - A[0]) * s + gauss(r) * w, A[1] + (B[1] - A[1]) * s + gauss(r) * w, A[2] + (B[2] - A[2]) * s + gauss(r) * w], col, 0.22]);
        }
      }
    }
    web = pointsSet(pts.length);
    pts.forEach((q, j) => setPt(web, j, q[0], q[1], q[2]));
    // small galaxy sprites
    galSprites = [];
    for (let v = 0; v < 4; v++) {
      const S = 96, cv = mk(S, S), cx = cv.getContext('2d'); cx.globalCompositeOperation = 'lighter';
      const inc = [0.35, 0.7, 0.2, 1][v], rot = v * 1.1;
      for (let j = 0; j < 1500; j++) {
        const p = galaxy;
        const k = (j * 28) % p.n;
        let x = p.x[k] / 4.9e20, z = p.z[k] / 4.9e20;
        const xr = x * Math.cos(rot) - z * Math.sin(rot), zr = x * Math.sin(rot) + z * Math.cos(rot);
        const sx = S / 2 + xr * S * 0.46, sy = S / 2 + zr * S * 0.46 * inc;
        cx.fillStyle = `rgba(${p.r[k] * 255 | 0},${p.g[k] * 255 | 0},${p.b[k] * 255 | 0},0.35)`;
        cx.fillRect(sx, sy, 1.3, 1.3);
      }
      const g = cx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.18);
      g.addColorStop(0, 'rgba(255,230,190,0.9)'); g.addColorStop(1, 'rgba(255,220,180,0)');
      cx.fillStyle = g; cx.fillRect(0, 0, S, S);
      galSprites.push(cv);
    }
    window.CORE.galSprites = galSprites; window.CORE.galaxySet = galaxy; window.CORE.webSet = web;
  }

  // ---------------- camera timeline ----------------
  const logDAt = keyed([
    [0, 7.56, 'lin'], [8.0, 7.47, 'in'], [10.4, 7.86, 'ease'], [11.6, 12.95, 'lin'],
    [13.9, 13.12, 'ease'], [15.3, 21.0, 'lin'], [18.3, 21.18, 'ease'], [19.7, 26.95, 'lin'], [24.2, 27.07],
  ]);
  const pitchAt = keyed([[7.0, 0.14, 'smooth'], [10, 0.3, 'smooth'], [13, 0.44, 'smooth'], [17, 0.5, 'smooth'], [21, 0.62, 'smooth'], [27, 0.34]]);
  window.CORE.logDAt = logDAt;

  function drawSet(acc, ctx, cam, S, D, vis, opts = {}) {
    if (vis <= 0.003) return;
    const n = S.n, iD = 1 / D, base = (opts.I || 1) * vis;
    const spr = opts.spr;
    const rot = opts.rot || 0, cx = opts.cx || 0, cz = opts.cz || 0;
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const near = opts.near || 0;
    for (let j = 0; j < n; j++) {
      let x = S.x[j], y = S.y[j], z = S.z[j];
      if (rot) { const xx = x * cr - z * sr; z = x * sr + z * cr; x = xx; }
      x = (x + cx) * iD; y *= iD; z = (z + cz) * iD;
      if (!proj(cam, x, y, z)) continue;
      if (P.x < -50 || P.x > W + 50 || P.y < -50 || P.y > H + 50) continue;
      let I = S.i[j] * base;
      if (opts.inv) I *= Math.min(opts.invMax || 6, opts.inv / (P.d * P.d));
      if (near) I *= sstep(near * 0.3, near, P.d);
      if (opts.gal && S.s[j] * iD * cam.foc / P.d > 1.6) {
        const size = Math.min(260, S.s[j] * iD * cam.foc / P.d);
        drawSprite(ctx, galSprites[S.k[j]], P.x, P.y, size, vis * sstep(0.0005, 0.01, P.d));
        continue;
      }
      starPoint(acc, ctx, P.x, P.y, I, [S.r[j], S.g[j], S.b[j]], spr);
    }
  }

  function render(ctx, t, acc) {
    const logD = logDAt(t), D = Math.pow(10, logD);
    const pitch = pitchAt(logD), yaw = -0.25 + 0.018 * t + 0.035 * (logD - 7.4);
    const dir = [Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw)];
    const cam = camera(dir, [0, 0, 0], 50);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    // sky (stars at infinity)
    const skyVis = (1 - sstep(19.4, 20.6, logD)) * sstep(0, 1.2, t);
    if (skyVis > 0) {
      const spr = glow(200, 220, 255);
      for (let j = 0; j < sky.n; j++) {
        if (!projDir(cam, sky.x[j], sky.y[j], sky.z[j])) continue;
        if (P.x < 0 || P.x > W || P.y < 0 || P.y > H) continue;
        starPoint(acc, ctx, P.x, P.y, sky.i[j] * skyVis * 0.9, [sky.r[j], sky.g[j], sky.b[j]], spr);
      }
    }
    // solar system dust
    drawSet(acc, ctx, cam, belt, D, sstep(11.0, 12.2, logD) * (1 - sstep(14.2, 15.2, logD)));
    drawSet(acc, ctx, cam, oort, D, C.win(logD, 13.8, 17.6, 0.9, 1.0), { I: 1.2 });
    drawSet(acc, ctx, cam, local, D, C.win(logD, 14.6, 20.4, 1.0, 1.2), { inv: 0.012, invMax: 5, spr: glow(210, 225, 255) });
    // galaxy (surface-brightness-ish normalization)
    const GRpx = 4.9e20 / D * cam.foc;
    const gI = clamp(GRpx / 380, 0.004, 1.25);
    drawSet(acc, ctx, cam, galaxy, D, sstep(18.9, 20.3, logD) * gI, { cx: GAL_C[0], cz: GAL_C[2], rot: -0.012 * t, I: 1.0 });
    drawSet(acc, ctx, cam, neigh, D, C.win(logD, 21.3, 26.4, 0.6, 1.3), { gal: true, inv: 0.05, invMax: 4, spr: glow(255, 230, 200) });
    const webVis = sstep(24.2, 25.9, logD);
    drawSet(acc, ctx, cam, web, D, webVis, { I: 2.4, near: 0.02 });
    acc.flush(ctx);

    // edge of the observable universe
    if (webVis > 0) {
      const ang = Math.asin(Math.min(0.99, 4.4e26 / D));
      const rp = cam.foc * Math.tan(ang);
      if (proj(cam, 0, 0, 0)) {
        const g = ctx.createRadialGradient(P.x, P.y, rp * 0.86, P.x, P.y, rp * 1.08);
        g.addColorStop(0, 'rgba(255,120,60,0)'); g.addColorStop(0.6, `rgba(255,140,80,${0.16 * webVis})`);
        g.addColorStop(0.72, `rgba(255,190,130,${0.22 * webVis})`); g.addColorStop(1, 'rgba(255,120,60,0)');
        ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
    }

    // orbits and planets
    const orbVis = sstep(10.8, 11.8, logD) * (1 - sstep(14.0, 15.0, logD));
    ctx.globalAlpha = 1;
    if (orbVis > 0) {
      ctx.lineWidth = 1.1;
      for (const [a, col] of [[1, [120, 170, 255]], ...PLANETS]) {
        ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${0.33 * orbVis})`;
        ctx.beginPath(); let started = false;
        for (let k = 0; k <= 160; k++) {
          const th = k / 160 * TAU;
          if (proj(cam, (SUN[0] + a * AU * Math.cos(th)) / D, 0, (SUN[2] + a * AU * Math.sin(th)) / D)) {
            if (!started) { ctx.moveTo(P.x, P.y); started = true; } else ctx.lineTo(P.x, P.y);
          } else started = false;
        }
        ctx.stroke();
      }
      PLANETS.forEach(([a, col, sz], k) => {
        const th = 1.3 + k * 2.1;
        if (proj(cam, (SUN[0] + a * AU * Math.cos(th)) / D, 0, (SUN[2] + a * AU * Math.sin(th)) / D))
          drawSprite(ctx, glow(col[0], col[1], col[2], 0.25, 0.4), P.x, P.y, sz * 3, orbVis);
      });
    }
    // moon orbit + moon
    const moonVis = C.win(logD, 8.1, 11.4, 0.6, 0.8);
    const MO = 3.84e8, mth = 2.35;
    if (moonVis > 0) {
      ctx.strokeStyle = `rgba(200,210,230,${0.25 * moonVis})`; ctx.lineWidth = 1; ctx.beginPath();
      let st = false;
      for (let k = 0; k <= 120; k++) { const th = k / 120 * TAU; if (proj(cam, MO * Math.cos(th) / D, 0, MO * Math.sin(th) / D)) { if (!st) { ctx.moveTo(P.x, P.y); st = true; } else ctx.lineTo(P.x, P.y); } else st = false; }
      ctx.stroke();
    }
    if (proj(cam, MO * Math.cos(mth) / D, 0, MO * Math.sin(mth) / D)) {
      const mr = 1.737e6 / D * cam.foc / P.d;
      const a = 1 - sstep(11.0, 12.0, logD);
      if (mr > 1.5) {
        const g = ctx.createRadialGradient(P.x - mr * 0.5, P.y - mr * 0.2, 0, P.x, P.y, mr);
        g.addColorStop(0, 'rgba(225,222,215,1)'); g.addColorStop(0.7, 'rgba(120,118,114,1)'); g.addColorStop(1, 'rgba(25,25,25,1)');
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a; ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(P.x, P.y, mr, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'lighter';
      } else drawSprite(ctx, glow(220, 220, 215), P.x, P.y, 5, a * 0.7);
    }
    // sun
    if (proj(cam, SUN[0] / D, 0, SUN[2] / D)) {
      const sv = 1 - sstep(19.6, 20.6, logD);
      const sz = lerp(70, 7, sstep(11, 19, logD));
      drawSprite(ctx, glow(255, 220, 160, 0.06, 0.3), P.x, P.y, sz, sv);
    }
    // earth
    ctx.globalCompositeOperation = 'source-over';
    if (proj(cam, 0, 0, 0)) {
      const R = 6.371e6 / D * cam.foc / P.d;
      const L = norm([SUN[0], SUN[1], SUN[2]]);
      const sunV = norm([L[0] * cam.r[0] + L[1] * cam.r[1] + L[2] * cam.r[2], L[0] * cam.u[0] + L[1] * cam.u[1] + L[2] * cam.u[2], -(L[0] * cam.f[0] + L[1] * cam.f[1] + L[2] * cam.f[2])]);
      drawEarth(ctx, P.x, P.y, R, 0.9 + 0.06 * t, sunV, 1 - sstep(20, 22, logD));
      // "you are here" marker
      const ma = C.win(t, 11.9, 23.5, 0.5, 0.4) * (R < 3 ? 1 : 0);
      if (ma > 0) {
        const pul = 1 + 0.12 * Math.sin(t * 4);
        ctx.globalAlpha = ma; ctx.strokeStyle = 'rgba(140,200,255,0.85)'; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.arc(P.x, P.y, 15 * pul, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(P.x + 11, P.y - 11); ctx.lineTo(P.x + 48, P.y - 48); ctx.lineTo(P.x + 120, P.y - 48); ctx.stroke();
        ctx.fillStyle = 'rgba(170,215,255,0.95)'; ctx.font = `500 15px ${C.FONT}`; ctx.letterSpacing = '4px';
        ctx.font = `20px "SansR"`; ctx.fillText('你在这里', P.x + 54, P.y - 56); ctx.letterSpacing = '0px';
        ctx.globalAlpha = 1;
      }
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    return { logD };
  }

  function hud(ctx, t, logD) {
    const a = C.win(t, 8.3, 23.6, 0.6, 0.4);
    if (a <= 0) return;
    const e = Math.round(logD);
    ctx.save(); ctx.globalAlpha = a * 0.85; ctx.fillStyle = 'rgba(190,215,255,0.9)';
    ctx.font = `500 14px ${C.FONT}`; ctx.letterSpacing = '6px'; ctx.textAlign = 'left';
    const x = W - 330, y = H - 120;
    ctx.font = `16px "SansR"`; ctx.fillText('视野尺度', x, y - 34);
    ctx.letterSpacing = '2px';
    C.drawRich(ctx, `~10^{${e}} m`, x, y + 4, 34, 300);
    ctx.fillRect(x, y + 22, 200, 1);
    for (let k = 0; k <= 20; k++) { const xx = x + k * 10; ctx.fillRect(xx, y + (k % 5 ? 18 : 14), 1, k % 5 ? 4 : 8); }
    const mk = clamp((logD - 7) / 20); ctx.fillStyle = 'rgba(140,200,255,1)'; ctx.fillRect(x + 200 * mk - 2, y + 10, 4, 14);
    ctx.restore();
  }

  window.SCENE_COSMOS = { init() { buildEarth(); buildSets(); }, render, hud, drawEarth };
})();
