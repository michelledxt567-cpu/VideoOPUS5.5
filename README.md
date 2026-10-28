# 宇宙恐怖 · Cosmic Horror

一段 90 秒的「宇宙恐怖」科普视频，画面与音效全部由代码程序化生成（Canvas2D + WebCodecs，无任何外部素材）。

## 下载观看

- **成片：** [`cosmic_horror.webm`](cosmic_horror.webm) — 1920×1080 · 30fps · VP9 视频 + Opus 立体声 · 90 秒（含中文字幕轨）
- **带字幕播放器：** 把 `player.html` 和视频放同一目录，用 Chrome/Edge/Firefox 打开即可（建议戴耳机）
- **字幕文件：** `cosmic_horror.zh.srt` / `cosmic_horror.zh.vtt`

> 浏览器直接播放 webm 不显示内嵌字幕，请用 `player.html`；VLC / mpv / PotPlayer 会自动显示内嵌中文字幕。

## 内容分镜

| 时间 | 场景 |
|---|---|
| 0–8s | 自转的地球 |
| 8–24s | 从地球拉远至太阳系 → 银河系 → 可观测宇宙 |
| 24–38s | 穿越星场 → 红超巨星 → 超新星爆发 |
| 38–54s | 黑洞 TON 618（引力透镜吸积盘、潮汐撕裂、时间膨胀） |
| 54–68s | 牧夫座空洞（near-total darkness） |
| 68–82s | 加速膨胀 → 恒星逐一熄灭（宇宙热寂） |
| 82–90s | 暗淡蓝点 · 片尾 |

## 源码 / 重新渲染

全部源码在 `source/`，渲染说明见 [`source/PLAN.md`](source/PLAN.md)。

```bash
cd source
node render.mjs video            # 渲染全片 → out/cosmic_horror.webm（约 3 分钟）
FONT=/path/to/cjk.otf node render.mjs video   # 把中文字幕烧进画面
```
