// Core rendering utilities: math, 3D camera, additive point accumulator, sprites, bloom, HUD text.
(function () {
  'use strict';
  const { W, H } = TL;
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const ease = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const win = (t, a, b, fi, fo) => sstep(a, a + fi, t) * (1 - sstep(b - fo, b, t));
  function gauss(r) { const u = Math.max(1e-9, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); }
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  function randDir(r) { const z = 2 * r() - 1, a = TAU * r(), s = Math.sqrt(1 - z * z); return [s * Math.cos(a), z, s * Math.sin(a)]; }

  // piecewise keys: [t, value, segType] segType of the segment starting at this key: lin|ease|in|out
  function keyed(keys) {
    return function (t) {
      if (t <= keys[0][0]) return keys[0][1];
      for (let i = 0; i < keys.length - 1; i++) {
        const [t0, v0, ty] = keys[i], [t1, v1] = keys[i + 1];
        if (t <= t1) {
          let s = (t - t0) / (t1 - t0);
          if (ty === 'ease') s = ease(s); else if (ty === 'in') s = s * s; else if (ty === 'out') s = 1 - (1 - s) * (1 - s); else if (ty === 'smooth') s = s * s * (3 - 2 * s);
          return v0 + (v1 - v0) * s;
        }
      }
      return keys[keys.length - 1][1];
    };
  }

  // ---------- camera ----------
  function camera(pos, target, fovDeg, roll = 0) {
    const f = norm([target[0] - pos[0], target[1] - pos[1], target[2] - pos[2]]);
    let r = norm(cross(f, [0, 1, 0]));
    let u = cross(r, f);
    if (roll) {
      const c = Math.cos(roll), s = Math.sin(roll);
      const r2 = [r[0] * c + u[0] * s, r[1] * c + u[1] * s, r[2] * c + u[2] * s];
      const u2 = [u[0] * c - r[0] * s, u[1] * c - r[1] * s, u[2] * c - r[2] * s];
      r = r2; u = u2;
    }
    const foc = (H / 2) / Math.tan(fovDeg * PI / 360);
    return { pos, f, r, u, foc };
  }
  // projection result held in P (avoid allocations)
  const P = { x: 0, y: 0, d: 0 };
  function proj(c, x, y, z) {
    const dx = x - c.pos[0], dy = y - c.pos[1], dz = z - c.pos[2];
    const d = dx * c.f[0] + dy * c.f[1] + dz * c.f[2];
    if (d <= 1e-9) return false;
    const k = c.foc / d;
    P.x = W / 2 + (dx * c.r[0] + dy * c.r[1] + dz * c.r[2]) * k;
    P.y = H / 2 - (dx * c.u[0] + dy * c.u[1] + dz * c.u[2]) * k;
    P.d = d;
    return true;
  }
  function projDir(c, x, y, z) { // direction at infinity
    const d = x * c.f[0] + y * c.f[1] + z * c.f[2];
    if (d <= 1e-6) return false;
    const k = c.foc / d;
    P.x = W / 2 + (x * c.r[0] + y * c.r[1] + z * c.r[2]) * k;
    P.y = H / 2 - (x * c.u[0] + y * c.u[1] + z * c.u[2]) * k;
    P.d = d;
    return true;
  }

  // ---------- additive float accumulator (sub-pixel stars) ----------
  class Accum {
    constructor() {
      this.buf = new Float32Array(W * H * 3);
      this.cv = mk(W, H); this.cx = this.cv.getContext('2d');
      this.img = this.cx.createImageData(W, H);
      const d = this.img.data; for (let i = 3; i < d.length; i += 4) d[i] = 255;
      this.lut = new Uint8ClampedArray(4096);
      for (let i = 0; i < 4096; i++) { const v = i / 512; this.lut[i] = 255 * (1 - Math.exp(-1.35 * v)) / (1 - Math.exp(-1.35 * 8)) * 1.0 + 0; }
      // soft knee: near-linear for dim values
      for (let i = 0; i < 4096; i++) { const v = i / 512; this.lut[i] = Math.round(255 * (v < 0.6 ? v : 0.6 + 0.4 * (1 - Math.exp(-(v - 0.6) / 0.4)))); }
      this.used = false;
    }
    clear() { if (this.used) this.buf.fill(0); this.used = false; }
    splat(x, y, r, g, b) {
      x -= 0.5; y -= 0.5;
      const ix = x | 0, iy = y | 0;
      if (x < 0 || y < 0 || ix >= W - 1 || iy >= H - 1) return;
      const fx = x - ix, fy = y - iy;
      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
      const B = this.buf; let i = (iy * W + ix) * 3;
      B[i] += r * w00; B[i + 1] += g * w00; B[i + 2] += b * w00;
      B[i + 3] += r * w10; B[i + 4] += g * w10; B[i + 5] += b * w10;
      i += W * 3;
      B[i] += r * w01; B[i + 1] += g * w01; B[i + 2] += b * w01;
      B[i + 3] += r * w11; B[i + 4] += g * w11; B[i + 5] += b * w11;
      this.used = true;
    }
    flush(ctx, alpha = 1) {
      if (!this.used) return;
      const B = this.buf, d = this.img.data, L = this.lut, n = W * H;
      for (let p = 0, j = 0, i = 0; p < n; p++, j += 4, i += 3) {
        let v = B[i] * 512; d[j] = L[v > 4095 ? 4095 : v | 0];
        v = B[i + 1] * 512; d[j + 1] = L[v > 4095 ? 4095 : v | 0];
        v = B[i + 2] * 512; d[j + 2] = L[v > 4095 ? 4095 : v | 0];
      }
      this.cx.putImageData(this.img, 0, 0);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha;
      ctx.drawImage(this.cv, 0, 0); ctx.restore();
      this.clear();
    }
  }

  // ---------- sprites ----------
  const spriteCache = new Map();
  function glow(r, g, b, core = 0.12, tail = 0.35) {
    const key = r + ',' + g + ',' + b + ',' + core + ',' + tail;
    if (spriteCache.has(key)) return spriteCache.get(key);
    const S = 128, c = mk(S, S), x = c.getContext('2d');
    const gr = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(core, `rgba(${r},${g},${b},0.85)`);
    gr.addColorStop(tail, `rgba(${r},${g},${b},0.18)`);
    gr.addColorStop(0.7, `rgba(${r},${g},${b},0.04)`);
    gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = gr; x.fillRect(0, 0, S, S);
    spriteCache.set(key, c);
    return c;
  }
  function drawSprite(ctx, spr, x, y, size, alpha) {
    if (alpha <= 0.002 || size <= 0.2) return;
    if (x < -size || y < -size || x > W + size || y > H + size) return;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(spr, x - size, y - size, size * 2, size * 2);
  }
  // star point: tiny -> accumulator, bright -> + sprite glow
  function starPoint(acc, ctx, x, y, I, col, spr) {
    if (I <= 0.004) return;
    acc.splat(x, y, col[0] * I, col[1] * I, col[2] * I);
    if (I > 1.2 && spr) drawSprite(ctx, spr, x, y, 3.5 * Math.sqrt(I), Math.min(1, (I - 1.2) * 0.5));
  }

  // temperature-ish star colors (0..1 floats)
  const STAR_COLS = [[0.62, 0.72, 1.0], [0.8, 0.86, 1.0], [1.0, 1.0, 1.0], [1.0, 0.95, 0.82], [1.0, 0.82, 0.6], [1.0, 0.62, 0.45]];
  function starCol(u) { return STAR_COLS[Math.min(5, (u * 6) | 0)]; }

  // ---------- post: bloom + vignette ----------
  let b1, b1x, b2, b2x, vig;
  function initPost() {
    b1 = mk(W / 4, H / 4); b1x = b1.getContext('2d');
    b2 = mk(W / 16 | 0, H / 16 | 0); b2x = b2.getContext('2d');
    vig = mk(W, H); const vx = vig.getContext('2d');
    const g = vx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.72)');
    vx.fillStyle = g; vx.fillRect(0, 0, W, H);
  }
  function bloom(ctx, canvas, s1 = 0.6, s2 = 0.5) {
    b1x.globalCompositeOperation = 'copy';
    b1x.filter = 'contrast(1.9) blur(2px)';
    b1x.drawImage(canvas, 0, 0, b1.width, b1.height);
    b1x.filter = 'none';
    b2x.globalCompositeOperation = 'copy';
    b2x.filter = 'blur(1.5px)';
    b2x.drawImage(b1, 0, 0, b2.width, b2.height);
    b2x.filter = 'none';
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = s1; ctx.drawImage(b1, 0, 0, W, H);
    ctx.globalAlpha = s2; ctx.drawImage(b2, 0, 0, W, H);
    ctx.restore();
  }
  function vignette(ctx) { ctx.save(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(vig, 0, 0); ctx.restore(); }

  // ---------- HUD text ----------
  const FONT = '"Noto Sans", sans-serif';
  // rich text: supports 10^{14}
  function richWidth(ctx, text, size, weight) {
    let w = 0; const parts = text.split(/(\^\{[^}]*\})/);
    for (const p of parts) {
      if (p.startsWith('^{')) { ctx.font = `${weight} ${size * 0.55}px ${FONT}`; w += ctx.measureText(p.slice(2, -1)).width; }
      else { ctx.font = `${weight} ${size}px ${FONT}`; w += ctx.measureText(p).width; }
    }
    return w;
  }
  function drawRich(ctx, text, x, y, size, weight) {
    const parts = text.split(/(\^\{[^}]*\})/);
    for (const p of parts) {
      if (p.startsWith('^{')) {
        ctx.font = `${weight} ${size * 0.55}px ${FONT}`;
        const s = p.slice(2, -1); ctx.fillText(s, x, y - size * 0.42); x += ctx.measureText(s).width + 4;
      } else { ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillText(p, x, y); x += ctx.measureText(p).width; }
    }
    return x;
  }
  function drawLabel(ctx, t, L, valueText) {
    const a = win(t, L.t0, L.t1, 0.2, 0.45);
    if (a <= 0) return;
    const x = 140, y = H - 255;
    const n = Math.floor((t - L.t0) / 0.018);
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = a;
    ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(150,195,255,0.9)';
    ctx.fillRect(x, y - 44, 56 * sstep(L.t0, L.t0 + 0.5, t), 2);
    ctx.letterSpacing = '10px';
    ctx.font = `500 23px ${FONT}`;
    ctx.fillStyle = 'rgba(165,205,255,0.95)';
    ctx.fillText(L.title.slice(0, n), x, y);
    ctx.letterSpacing = '3px';
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    const dyn = L.value.startsWith('@');
    const v = dyn ? valueText : L.value.slice(0, Math.max(0, n - 4));
    if (v) drawRich(ctx, v, x, y + 64, 50, 200);
    ctx.restore();
  }
  // optional burned-in Chinese caption (only if a CJK font was supplied)
  function drawCaption(ctx, t, caps) {
    for (const [a, b, text] of caps) {
      const al = win(t, a, b, 0.25, 0.3);
      if (al <= 0) continue;
      ctx.save();
      ctx.globalAlpha = al; ctx.globalCompositeOperation = 'source-over';
      ctx.font = `44px CJK`; ctx.textAlign = 'center'; ctx.letterSpacing = '4px';
      ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 14;
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fillText(text, W / 2, H - 92 + (1 - sstep(a, a + 0.4, t)) * 8);
      ctx.restore();
    }
  }

  window.CORE = {
    W, H, PI, TAU, clamp, lerp, sstep, ease, win, gauss, mk, norm, cross, dot, randDir, keyed,
    camera, P, proj, projDir, Accum, glow, drawSprite, starPoint, starCol, STAR_COLS,
    initPost, bloom, vignette, FONT, drawRich, richWidth, drawLabel, drawCaption,
  };
})();
