// Bilibili cover: 16:9 canvas (1920x1080); all key content inside the centred 4:3 safe area (x 240..1680).
(function () {
  'use strict';
  const C = window.CORE;
  const { W, H, TAU, sstep, glow, drawSprite } = C;
  const SAFE_X0 = 240, SAFE_X1 = 1680;

  function bgScene(ctx, t) { window.APP.renderFrameRaw(t); ctx.drawImage(document.getElementById('c'), 0, 0); }

  function drawCover(opts = {}) {
    const out = C.mk(W, H), ctx = out.getContext('2d');
    // 1) background: the indifferent-ruins shot (tiny human vs colossal structures)
    bgScene(ctx, opts.bgT ?? 86.5);
    // 2) grade: darken top for the title, keep the tiny human readable
    let g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0.78)'); g.addColorStop(0.42, 'rgba(0,0,0,0.35)'); g.addColorStop(0.7, 'rgba(0,0,0,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // fade the 16:9 side wings so the 4:3 crop doesn't lose anything important
    for (const [x0, x1] of [[0, SAFE_X0 + 60], [W, SAFE_X1 - 60]]) {
      const sg = ctx.createLinearGradient(x0, 0, x1, 0);
      sg.addColorStop(0, 'rgba(0,0,0,0.55)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg; ctx.fillRect(Math.min(x0, x1), 0, Math.abs(x1 - x0), H);
    }
    // 3) a cold cosmic eye / void in the sky, partially off the safe area's top (implies scale)
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const ex = W / 2, ey = 150;
    const rg = ctx.createRadialGradient(ex, ey, 60, ex, ey, 520);
    rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(0.18, 'rgba(110,150,230,0.10)'); rg.addColorStop(0.24, 'rgba(160,190,255,0.16)'); rg.addColorStop(0.4, 'rgba(80,110,190,0.05)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    ctx.restore();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(ex, ey, 100, 0, TAU); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(200,220,255,0.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ex, ey, 101, 0, TAU); ctx.stroke(); ctx.restore();

    // 4) typography (all inside 4:3 safe area)
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    // main title
    ctx.font = '210px "SerifB"'; ctx.letterSpacing = '36px';
    ctx.shadowColor = 'rgba(140,180,255,0.65)'; ctx.shadowBlur = 50;
    ctx.fillStyle = 'rgb(236,242,255)';
    ctx.fillText('宇宙恐怖', W / 2 + 18, 468);
    ctx.shadowBlur = 0; ctx.globalAlpha = 0.2; ctx.fillStyle = 'rgb(120,170,255)'; ctx.fillText('宇宙恐怖', W / 2 + 21, 470); ctx.globalAlpha = 1;
    // latin
    ctx.font = '300 38px "Noto Sans"'; ctx.letterSpacing = '30px'; ctx.fillStyle = 'rgba(190,210,245,0.95)';
    ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 14;
    ctx.fillText('COSMIC HORROR', W / 2 + 15, 548);
    ctx.fillStyle = 'rgba(160,195,255,0.9)'; ctx.fillRect(W / 2 - 90, 584, 180, 2);
    // hook line
    ctx.font = '62px "SerifB"'; ctx.letterSpacing = '8px';
    ctx.shadowColor = 'rgba(255,190,130,0.55)'; ctx.shadowBlur = 26;
    ctx.fillStyle = 'rgb(255,236,214)';
    ctx.fillText('它甚至从未注意过我们', W / 2 + 4, 686);
    // subtitle
    ctx.shadowColor = 'rgba(0,0,0,0.95)'; ctx.shadowBlur = 14;
    ctx.font = '36px "SerifL"'; ctx.letterSpacing = '12px'; ctx.fillStyle = 'rgba(214,224,240,0.95)';
    ctx.fillText('当宇宙不再以人类为中心', W / 2 + 6, 760);
    ctx.restore();

    // 5) the tiny human with a warm light (bottom-centre, kept away from B站's bottom-right duration badge)
    const hx = W / 2, hy = 952;
    drawSprite(ctx, glow(255, 200, 150, 0.15, 0.35), hx, hy - 16, 46, 0.85);
    window.U3.figure(ctx, hx, hy, 34, null, 'rgba(255,205,160,0.8)', 1);
    // lower-left tag (inside safe area, left side)
    ctx.save(); ctx.font = '26px "SansR"'; ctx.letterSpacing = '6px'; ctx.textAlign = 'left';
    const tag = '洛夫克拉夫特 · 科普', tw = ctx.measureText(tag).width - 6;
    ctx.strokeStyle = 'rgba(150,200,255,0.9)'; ctx.lineWidth = 1.5; ctx.strokeRect(SAFE_X0 + 70.5, 920.5, tw + 36, 46);
    ctx.fillStyle = 'rgba(170,210,255,1)'; ctx.fillText(tag, SAFE_X0 + 88, 953);
    ctx.restore();
    return out;
  }

  function guide(cv) {
    const o = C.mk(W, H), x = o.getContext('2d'); x.drawImage(cv, 0, 0);
    x.fillStyle = 'rgba(255,0,80,0.22)'; x.fillRect(0, 0, SAFE_X0, H); x.fillRect(SAFE_X1, 0, W - SAFE_X1, H);
    x.strokeStyle = '#ff3366'; x.lineWidth = 3; x.setLineDash([14, 10]); x.strokeRect(SAFE_X0, 2, SAFE_X1 - SAFE_X0, H - 4);
    x.setLineDash([]); x.fillStyle = '#ff3366'; x.font = '28px "SansR"'; x.fillText('4:3 安全区', SAFE_X0 + 16, 40);
    x.strokeStyle = 'rgba(255,200,0,0.9)'; x.lineWidth = 2; x.strokeRect(SAFE_X1 - 200, H - 80, 180, 60); x.fillStyle = 'rgba(255,200,0,1)'; x.font = '22px "SansR"'; x.fillText('时长角标区', SAFE_X1 - 180, H - 42);
    return o;
  }
  function crop43(cv) { const o = C.mk(1440, 1080); o.getContext('2d').drawImage(cv, SAFE_X0, 0, 1440, 1080, 0, 0, 1440, 1080); return o; }

  window.COVER = {
    make(opts) {
      const cv = drawCover(opts);
      return { full: cv.toDataURL('image/png'), jpg: cv.toDataURL('image/jpeg', 0.95), c43: crop43(cv).toDataURL('image/jpeg', 0.95), guide: guide(cv).toDataURL('image/jpeg', 0.85) };
    },
  };
})();
