// Chinese kinetic typography: per-character staggered reveal, delayed emphasis, glow, fact/fiction tags, title sequence.
(function () {
  'use strict';
  const C = window.CORE;
  const { W, H, clamp, lerp, sstep, win } = C;
  const F = { serif: '"SerifL"', serifB: '"SerifB"', sans: '"SansL"', sansR: '"SansR"', latin: '"Noto Sans"' };
  const layoutCache = new Map();

  // per-act default caption baseline
  const ACT_Y = { title: 0.5, fear: 0.83, cosmos: 0.15, geom: 0.8, ruins: 0.2, ocean: 0.5, climax: 0.72, end: 0.5 };
  function actAt(t) { let a = 'end'; for (const [t0, t1, n] of TL.ACTS) if (t >= t0 && t < t1) { a = n; } return a; }

  function parse(text) { // -> lines of [{ch, emph}]
    const lines = []; let cur = [], emph = false;
    for (const ch of text) {
      if (ch === '[') { emph = true; continue; }
      if (ch === ']') { emph = false; continue; }
      if (ch === '\n') { lines.push(cur); cur = []; continue; }
      cur.push({ ch, emph });
    }
    lines.push(cur);
    return lines;
  }

  function fontFor(o, emph, size) {
    if (o.latin) return `300 ${size}px ${F.latin}`;
    if (o.sans) return `${size}px ${F.sans}`;
    return `${size}px ${emph ? F.serifB : F.serif}`;
  }

  function layout(ctx, cue) {
    const key = cue[2] + JSON.stringify(cue[3] || {});
    if (layoutCache.has(key)) return layoutCache.get(key);
    const o = cue[3] || {};
    const size = o.size || 54, track = o.track ?? (o.sans ? 4 : 8), lh = o.lh || 1.6;
    const lines = parse(cue[2]);
    const out = []; let idx = 0;
    lines.forEach((ln, li) => {
      let w = 0; const chars = [];
      for (const c of ln) {
        ctx.font = fontFor(o, c.emph, size);
        const cw = ctx.measureText(c.ch).width;
        chars.push({ ch: c.ch, emph: c.emph, x: w, w: cw, i: idx++ });
        w += cw + track;
      }
      w -= track;
      out.push({ chars, w, dy: (li - (lines.length - 1) / 2) * size * lh });
    });
    const L = { lines: out, n: idx, size, o };
    layoutCache.set(key, L);
    return L;
  }

  function drawCue(ctx, t, cue, drift) {
    const [t0, t1] = cue; const o = cue[3] || {};
    if (t < t0 - 0.05 || t > t1 + 0.05) return;
    const L = layout(ctx, cue);
    const stagger = o.stagger ?? Math.min(0.06, 1.1 / Math.max(6, L.n));
    const exitDur = o.exit || 0.75;
    const baseY = o.y ?? H * (ACT_Y[actAt(t0 + 0.01)] ?? 0.5);
    const emphDelay = 0.38;
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    for (const ln of L.lines) {
      const x0 = W / 2 - ln.w / 2 + (drift ? drift[0] : 0);
      const y = baseY + ln.dy + L.size * 0.36 + (drift ? drift[1] : 0);
      for (const c of ln.chars) {
        const ti = t0 + c.i * stagger + (c.emph ? emphDelay : 0);
        const a = sstep(ti, ti + 0.7, t);
        const te = t1 - exitDur + (c.i / Math.max(1, L.n)) * exitDur * 0.45;
        const e = 1 - sstep(te, te + exitDur * 0.55, t);
        const al = a * e;
        if (al <= 0.003) continue;
        const rise = (1 - a) * 16 - (1 - e) * 10;
        const sc = 1 + (1 - a) * 0.06;
        ctx.font = fontFor(o, c.emph, L.size);
        ctx.globalAlpha = al * (o.dim ?? 1);
        const cx = x0 + c.x + c.w / 2, cy = y + rise;
        ctx.setTransform(sc, 0, 0, sc, cx * (1 - sc), cy * (1 - sc));
        if (c.emph || o.glow) {
          ctx.shadowColor = c.emph ? 'rgba(255,214,170,0.75)' : 'rgba(170,200,255,0.6)';
          ctx.shadowBlur = 22 + 10 * (1 - a);
          ctx.fillStyle = c.emph ? 'rgba(255,238,220,1)' : 'rgba(236,242,255,0.98)';
        } else {
          ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 14;
          ctx.fillStyle = 'rgba(214,224,240,0.93)';
        }
        ctx.fillText(c.ch, x0 + c.x, cy);
      }
    }
    ctx.restore();
  }

  function drawLabel(ctx, t, Lb) {
    const a = win(t, Lb.t0, Lb.t1, 0.35, 0.5);
    if (a <= 0) return;
    const x = 140, y = H - 250, g = sstep(Lb.t0, Lb.t0 + 0.6, t);
    ctx.save();
    ctx.globalAlpha = a;
    const tagCol = Lb.tag === '文学虚构' ? [255, 180, 140] : Lb.tag === '隐喻' ? [200, 170, 255] : [150, 200, 255];
    const col = `rgba(${tagCol[0]},${tagCol[1]},${tagCol[2]},0.95)`;
    ctx.font = `18px ${F.sansR}`; ctx.letterSpacing = '4px';
    const tw = ctx.measureText(Lb.tag).width + 22;
    ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y - 60.5, tw * g, 30);
    ctx.fillStyle = col; ctx.globalAlpha = a * sstep(Lb.t0 + 0.2, Lb.t0 + 0.6, t);
    ctx.fillText(Lb.tag, x + 11, y - 39);
    ctx.globalAlpha = a; ctx.fillRect(x, y - 8, 46 * g, 1.5);
    ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 12;
    ctx.font = `24px ${F.sansR}`; ctx.letterSpacing = '8px'; ctx.fillStyle = col;
    ctx.globalAlpha = a * sstep(Lb.t0 + 0.15, Lb.t0 + 0.55, t);
    ctx.fillText(Lb.title, x, y + 30);
    ctx.font = `40px ${F.serif}`; ctx.letterSpacing = '3px'; ctx.fillStyle = 'rgba(240,244,255,0.96)';
    ctx.globalAlpha = a * sstep(Lb.t0 + 0.35, Lb.t0 + 0.85, t);
    ctx.fillText(Lb.value, x, y + 88 + (1 - sstep(Lb.t0 + 0.35, Lb.t0 + 0.85, t)) * 8);
    ctx.restore();
  }

  // ---------------- Title sequence ----------------
  function drawTitle(ctx, t) {
    if (t < 3.2 || t > 9.4) return;
    const S = TL.SYNC;
    const out = sstep(7.7, 9.0, t), push = 1 + 0.05 * sstep(7.4, 9.2, t) + 0.012 * (t - 3.2) / 6;
    ctx.save();
    ctx.setTransform(push, 0, 0, push, W / 2 * (1 - push), H / 2 * (1 - push));
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    // main title
    const T = '宇宙恐怖', size = 136, track = 40;
    ctx.font = `${size}px ${F.serifB}`; ctx.letterSpacing = '0px';
    const ws = [...T].map(c => ctx.measureText(c).width);
    const total = ws.reduce((a, b) => a + b, 0) + track * 3;
    let x = W / 2 - total / 2;
    const hit = Math.exp(-Math.max(0, t - S.titleHit) * 1.6) * (t > S.titleHit ? 1 : 0);
    [...T].forEach((c, i) => {
      const ti = 3.6 + i * 0.26;
      const a = sstep(ti, ti + 1.1, t) * (1 - sstep(7.75 + i * 0.12, 8.7 + i * 0.12, t));
      if (a > 0.003) {
        const y = 488 + (1 - sstep(ti, ti + 1.1, t)) * 18;
        ctx.globalAlpha = a;
        ctx.shadowColor = `rgba(160,195,255,${0.45 + 0.5 * hit})`; ctx.shadowBlur = 30 + 40 * hit;
        ctx.fillStyle = `rgba(${lerp(222, 255, hit)},${lerp(230, 250, hit)},255,1)`;
        ctx.fillText(c, x, y);
        // faint chromatic edge
        ctx.globalAlpha = a * 0.18; ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(120,170,255,1)';
        ctx.fillText(c, x + 1.6, y + 0.6);
      }
      x += ws[i] + track;
    });
    // light sweep on hit
    if (t > S.titleHit && t < S.titleHit + 1.4) {
      const p = (t - S.titleHit) / 1.4, sx = lerp(W / 2 - 420, W / 2 + 420, p);
      const g = ctx.createLinearGradient(sx - 90, 0, sx + 90, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(220,235,255,${0.22 * (1 - p)})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(W / 2 - 520, 360, 1040, 160);
      ctx.globalCompositeOperation = 'source-over';
    }
    // COSMIC HORROR
    {
      const a = sstep(4.6, 5.8, t) * (1 - out);
      const tr = lerp(46, 26, C.ease(clamp((t - 4.6) / 1.6)));
      ctx.font = `300 30px ${F.latin}`; ctx.letterSpacing = tr + 'px'; ctx.textAlign = 'center';
      ctx.globalAlpha = a; ctx.shadowColor = 'rgba(150,190,255,0.5)'; ctx.shadowBlur = 16; ctx.fillStyle = 'rgba(190,210,245,0.95)';
      ctx.fillText('COSMIC HORROR', W / 2 + tr / 2, 568);
      const lw = 160 * C.ease(clamp((t - S.titleHit) / 0.9));
      ctx.globalAlpha = a * 0.8; ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(160,195,255,0.9)';
      ctx.fillRect(W / 2 - lw / 2, 604, lw, 1.2);
    }
    // subtitle
    {
      const sub = '当宇宙不再以人类为中心';
      ctx.font = `34px ${F.serif}`; ctx.letterSpacing = '10px'; ctx.textAlign = 'left';
      const sw = ctx.measureText(sub).width; let sx = W / 2 - sw / 2;
      [...sub].forEach((c, i) => {
        const ti = 6.0 + i * 0.07;
        const a = sstep(ti, ti + 0.8, t) * (1 - out);
        const cw = ctx.measureText(c).width + 10;
        if (a > 0.003) { ctx.globalAlpha = a * 0.92; ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 10; ctx.fillStyle = 'rgba(205,215,235,1)'; ctx.fillText(c, sx, 668 + (1 - a) * 10); }
        sx += cw;
      });
    }
    ctx.restore();
  }

  function drawAll(ctx, t, info) {
    drawTitle(ctx, t);
    for (const Lb of TL.LABELS) drawLabel(ctx, t, Lb);
    for (const cue of TL.CUES) drawCue(ctx, t, cue, info && info.drift);
  }

  window.TYPE = { drawAll, F };
})();
