// Shared timeline: used by visuals, audio (browser) and muxer/subtitles (node).
(function (root) {
  'use strict';
  const DUR = 90, W = 1920, H = 1080, FPS = 30;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Chinese captions [start, end, text]
  const CAPTIONS = [
    [0.8, 3.8, '抬头仰望夜空时，你看到的是什么？'],
    [4.2, 7.6, '其实，你正在凝视一片深渊。'],
    [8.6, 10.6, '地球，直径约一万两千公里。'],
    [11.7, 14.0, '光从太阳出发，要四个多小时才能抵达海王星。'],
    [15.4, 18.4, '银河系，直径约十万光年，拥有数千亿颗恒星。'],
    [19.8, 21.8, '可观测宇宙，直径约930亿光年。'],
    [21.9, 23.7, '银河系，只是其中数千亿个星系之一。'],
    [24.6, 27.8, '星光，需要时间才能穿越这片黑暗。'],
    [28.6, 31.4, '你今晚看到的星光，可能在几百年前就已出发。'],
    [32.4, 36.8, '而发出它的那颗恒星，也许早已死去。'],
    [38.8, 41.7, '黑洞——连光都无法逃脱的地方。'],
    [42.0, 45.6, 'TON 618，质量约为太阳的660亿倍。'],
    [46.0, 49.6, '它的视界半径约1300天文单位，是海王星轨道的40多倍。'],
    [50.0, 53.5, '越靠近它，时间流逝得越慢……越过视界，再无归途。'],
    [55.0, 58.3, '比黑洞更让人不安的，是“什么都没有”。'],
    [58.7, 62.2, '牧夫座空洞，直径约3.3亿光年，其中只发现了约60个星系。'],
    [62.5, 64.9, '如果银河系位于它的中心，'],
    [65.0, 67.6, '直到1960年代，人类都不会知道还有别的星系。'],
    [68.8, 71.8, '宇宙正在加速膨胀。'],
    [72.1, 75.6, '遥远的星系将逐个退出视界，永远无法再被看见。'],
    [76.0, 78.8, '约百万亿年后，最后一颗恒星也将熄灭。'],
    [79.0, 81.8, '最终，宇宙将归于永恒的黑暗与寂静。'],
    [83.2, 85.9, '但在这片无边的黑暗里，有一颗暗淡的蓝点。'],
    [86.2, 89.4, '那里的生命，学会了仰望星空。'],
  ];

  // On-screen HUD labels (Latin glyphs only — burned into the frames)
  const LABELS = [
    { t0: 8.5, t1: 10.5, title: 'EARTH', value: 'Ø 12,742 km' },
    { t0: 11.7, t1: 14.0, title: 'SOLAR SYSTEM', value: 'SUN TO NEPTUNE · 4.2 LIGHT-HOURS' },
    { t0: 15.4, t1: 18.4, title: 'MILKY WAY', value: 'Ø ~100,000 LIGHT-YEARS' },
    { t0: 19.8, t1: 23.6, title: 'OBSERVABLE UNIVERSE', value: 'Ø ~93,000,000,000 LIGHT-YEARS' },
    { t0: 28.8, t1: 31.4, title: 'STARLIGHT', value: 'DEPARTED 640 YEARS AGO' },
    { t0: 32.6, t1: 36.6, title: 'SOURCE', value: 'NO LONGER EXISTS' },
    { t0: 42.0, t1: 45.6, title: 'TON 618', value: '66,000,000,000 SOLAR MASSES' },
    { t0: 46.0, t1: 49.6, title: 'EVENT HORIZON', value: 'R ~1,300 AU' },
    { t0: 50.0, t1: 53.3, title: 'TIME DILATION', value: '@timerate' },
    { t0: 58.7, t1: 62.3, title: 'BOÖTES VOID', value: 'Ø ~330,000,000 LY · ~60 GALAXIES' },
    { t0: 68.8, t1: 81.4, title: 'COSMIC CLOCK', value: '@clock' },
  ];

  // Scale-zoom transitions (whoosh start, impact) shared by audio + camera
  const ZOOMS = [[10.4, 11.6], [13.9, 15.3], [18.3, 19.7]];

  // Key sync points
  const SYNC = {
    journeyStart: 8.0,
    warpStart: 24.0, warpEnd: 28.6,
    implode: 31.2, nova: 31.6, waveHit: 37.6,
    bhStart: 37.8, dilation: 50.0, plunge: 53.0, horizon: 54.0,
    voidWall: 59.8, deathStart: 68.0, starsStart: 76.0, lastStar: 81.3,
    dotAppear: 83.0, title: 86.4,
  };

  // Heat-death star field (shared so audio "pings" match visible star deaths)
  const DEATH = (function () {
    const r = mulberry32(777);
    const stars = [];
    for (let i = 0; i < 2800; i++) {
      const z = 2 * r() - 1, a = 2 * Math.PI * r(), s = Math.sqrt(1 - z * z);
      const dir = [s * Math.cos(a), z, s * Math.sin(a)];
      const dist = 2 + 28 * r();
      const lum = Math.pow(r(), 6) * 7 + 0.3;
      const dwarf = r() < 0.3;
      const td = 76.4 + 4.5 * Math.sqrt(r());
      const hue = r();
      stars.push({ dir, dist, lum, dwarf, td, hue, last: false });
    }
    const l = Math.hypot(-0.2, 0.06, -1);
    stars.push({ dir: [-0.2 / l, 0.06 / l, -1 / l], dist: 2.2, lum: 3.0, dwarf: true, td: 81.3, hue: 0.95, last: true });
    const ranked = stars.map((s, i) => ({ i, b: s.lum / (s.dist * s.dist) }))
      .sort((a, b) => b.b - a.b).slice(0, 22).map(o => o.i);
    const pings = ranked.map(i => ({ t: stars[i].td, pan: Math.max(-0.8, Math.min(0.8, stars[i].dir[0])), last: stars[i].last }));
    if (!pings.some(p => p.last)) pings.push({ t: 81.3, pan: -0.2, last: true });
    pings.sort((a, b) => a.t - b.t);
    return { stars, pings };
  })();

  const TL = { DUR, W, H, FPS, CAPTIONS, LABELS, ZOOMS, SYNC, DEATH, mulberry32 };
  root.TL = TL;
  if (typeof module !== 'undefined' && module.exports) module.exports = TL;
})(typeof window !== 'undefined' ? window : globalThis);
