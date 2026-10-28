// 《宇宙恐怖——当宇宙不再以人类为中心》 Master timeline (shared by visuals, typography, audio, subtitles)
(function (root) {
  'use strict';
  const DUR = 152, W = 1920, H = 1080, FPS = 60;
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Acts
  const ACTS = [
    [0, 9.2, 'title'], [8.6, 27.6, 'fear'], [26.8, 50.6, 'cosmos'], [49.8, 73.8, 'geom'],
    [72.6, 95.8, 'ruins'], [94.6, 117.8, 'ocean'], [116.8, 139.6, 'climax'], [138.6, DUR + 0.01, 'end'],
  ];

  // Typographic cues: [t0, t1, text, opts]   [..] = emphasis,  \n = line break
  const CUES = [
    [9.6, 12.4, '我们害怕黑暗。'],
    [12.8, 15.6, '因为我们以为……'],
    [15.8, 18.7, '黑暗里，[有什么东西]。'],
    [19.0, 21.7, '传统恐怖，来自[未知的威胁]。'],
    [22.1, 23.7, '但如果……'],
    [23.9, 26.8, '宇宙根本没有\n把我们当作[威胁的对象]呢？'],
    [28.0, 31.4, '在我们的故事里，人类是[主角]。'],
    [38.9, 41.8, '但在宇宙中……'],
    [44.0, 49.4, '我们甚至[不是中心]。', { size: 66 }],
    [51.0, 55.4, '我们依靠感官，[理解]世界。'],
    [57.2, 60.4, '但如果……'],
    [62.4, 68.6, '有些事物，\n从未落入我们的[理解范围]？'],
    [76.0, 79.4, '最可怕的存在……'],
    [80.0, 83.4, '未必[憎恨]人类。'],
    [84.4, 87.6, '它甚至可能……'],
    [88.2, 93.8, '从未[注意过]我们。', { size: 66 }],
    // Lovecraft block
    [95.8, 100.6, 'H. P. LOVECRAFT', { latin: true, size: 86, track: 20, y: 452, glow: 1 }],
    [96.5, 100.6, '1890 – 1937', { latin: true, size: 26, track: 12, y: 520, w: 300, dim: 0.7 }],
    [97.2, 100.6, '霍华德·菲利普斯·洛夫克拉夫特', { size: 34, y: 606, track: 6 }],
    [97.7, 100.6, '美国作家 · 宇宙恐怖文学最具影响力的代表人物', { sans: true, size: 26, y: 660, dim: 0.75, track: 4 }],
    [101.0, 104.7, '《克苏鲁的呼唤》', { size: 70, y: 500, glow: 1 }],
    [101.7, 104.7, '短篇小说 · 1928 年发表于美国杂志《诡丽幻谭》', { sans: true, size: 26, y: 584, dim: 0.75, track: 4 }],
    [105.1, 109.7, '“我想，世上最仁慈的事，\n莫过于人类的心智\n无法将其所知的一切关联起来。”', { size: 44, y: 470, lh: 1.75, stagger: 0.035 }],
    [106.2, 109.7, '——《克苏鲁的呼唤》开篇（意译）', { sans: true, size: 24, y: 700, dim: 0.65, track: 4 }],
    [110.1, 113.3, '洛夫克拉夫特笔下的恐怖，\n并不只来自[怪物的力量]。'],
    [113.7, 117.0, '而来自——\n[人类认知的崩塌]。', { size: 62 }],
    // Climax
    [117.6, 121.2, '渺小。', { size: 104, track: 30 }],
    [121.6, 125.2, '不可理解。', { size: 104, track: 30 }],
    [125.6, 129.2, '漠不关心。', { size: 104, track: 30 }],
    [131.0, 136.8, '这，就是[宇宙恐怖]。', { size: 78, glow: 1 }],
    // Coda
    [140.4, 144.6, '真正的恐怖，不是宇宙中[有什么]。'],
    [145.2, 151.4, '而是宇宙，从未为我们[准备答案]。', { exit: 2.2 }],
  ];

  // Factual / framing labels (lower-left). tag marks fact vs fiction vs metaphor.
  const LABELS = [
    { t0: 32.1, t1: 34.1, title: '地球', value: '直径约 12,742 公里', tag: '天文事实' },
    { t0: 35.3, t1: 37.6, title: '太阳系', value: '阳光抵达海王星约需 4 小时', tag: '天文事实' },
    { t0: 39.0, t1: 41.9, title: '银河系', value: '直径约 10 万光年 · 数千亿颗恒星', tag: '天文事实' },
    { t0: 43.4, t1: 47.6, title: '可观测宇宙', value: '直径约 930 亿光年', tag: '天文事实' },
    { t0: 56.0, t1: 61.2, title: '视觉隐喻', value: '并非科学意义上的“高维空间”', tag: '隐喻' },
    { t0: 101.4, t1: 104.8, title: '拉莱耶  R’LYEH', value: '小说中虚构的沉没之城', tag: '文学虚构' },
  ];

  // cosmos scene reuses the earlier zoom engine with a +23.6 s offset
  const COSMOS_OFFSET = 23.6;
  const ZOOMS = [[10.4, 11.6], [13.9, 15.3], [18.3, 19.7]].map(([a, b]) => [a + COSMOS_OFFSET, b + COSMOS_OFFSET]);
  const SYNC = {
    titleHit: 5.4, fearStart: 9.0, threats: 15.8, threatsGone: 21.6, recede: 22.2, act3: 27.0,
    earthGone: 46.5, act4: 50.0, dive: 55.0, still: 68.4, act5: 73.0, act6: 95.0, act7: 117.0,
    words: [117.6, 121.6, 125.6], pullback: 129.4, peak: 131.0, act8: 139.0, lastStar: 147.6,
  };

  // Coda star field (shared with audio so each "ping" matches a visible star death)
  const DEATH = (function () {
    const r = mulberry32(777), stars = [];
    for (let i = 0; i < 2600; i++) {
      const z = 2 * r() - 1, a = 2 * Math.PI * r(), s = Math.sqrt(1 - z * z);
      stars.push({ dir: [s * Math.cos(a), z, s * Math.sin(a)], dist: 2 + 28 * r(), lum: Math.pow(r(), 6) * 7 + 0.3, td: 139.6 + 7.4 * Math.pow(r(), 0.8), hue: r(), last: false });
    }
    const l = Math.hypot(0.16, 0.12, -1);
    stars.push({ dir: [0.16 / l, 0.12 / l, -1 / l], dist: 2.2, lum: 3.0, td: SYNC.lastStar, hue: 0.95, last: true });
    const ranked = stars.map((s, i) => ({ i, b: s.lum / Math.sqrt(s.dist) })).sort((a, b) => b.b - a.b).slice(0, 18).map(o => o.i);
    const pings = ranked.map(i => ({ t: stars[i].td, pan: Math.max(-0.8, Math.min(0.8, stars[i].dir[0])), last: stars[i].last }));
    if (!pings.some(p => p.last)) pings.push({ t: SYNC.lastStar, pan: 0.15, last: true });
    pings.sort((a, b) => a.t - b.t);
    return { stars, pings };
  })();

  const TL = { DUR, W, H, FPS, ACTS, CUES, LABELS, ZOOMS, SYNC, DEATH, COSMOS_OFFSET, mulberry32 };
  root.TL = TL;
  if (typeof module !== 'undefined' && module.exports) module.exports = TL;
})(typeof window !== 'undefined' ? window : globalThis);
