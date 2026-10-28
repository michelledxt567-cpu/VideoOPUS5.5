# 宇宙恐怖 · 90s 科普视频 — 制作方案

## 环境约束（已探测）
- 无外网、无 pip/npm；无中文字体；系统 ffmpeg 不存在（Playwright 自带的极简版只支持 VP8）。
- 可用：Playwright headless shell（Chromium 151）—— WebCodecs: VP9 / H.264 / AV1 视频编码 + Opus 音频编码；Canvas2D、OfflineAudioContext。

## 管线
1. `src/timeline.js` 共享时间轴（字幕、HUD 标签、音画同步事件）。
2. `src/visuals.js` 确定性渲染 `render(ctx, t)`（Canvas2D + 自研 3D 透视相机 + 加法累积点渲染 + bloom）。
3. `src/audio.js` OfflineAudioContext 程序化合成音效/配乐（与时间轴同步）。
4. `render.mjs` 驱动 Chromium 逐帧渲染 → WebCodecs VP9 + Opus → `mux.mjs` 自写 WebM 封装（含中文字幕轨 S_TEXT/UTF8，默认开启）。
5. 输出：`out/cosmic_horror.webm`、`.srt/.vtt`、`player.html`（浏览器播放并叠加中文字幕）。
6. 中文字幕：沙箱无中文字体 → 软字幕 + 播放器叠加；若用户上传字体可 `FONT=... node render.mjs` 烧录。

## 分镜（秒）
| 时间 | 场景 | 画面 | 声音 |
|---|---|---|---|
| 0–8 | 引子 | 地球特写，星空 | 心跳、低频嗡鸣 |
| 8–24 | 尺度 | Powers-of-Ten 式拉远：地球→太阳系→银河系→可观测宇宙（穿越恒星/星系飞掠，纵深） | 每级 whoosh + 冲击低音，层层叠加 |
| 24–38 | 死去的星光 | 跃迁穿越星场 → 红超巨星 → 光子飞向镜头 → 超新星 → 光波前扑面 | 跃迁声、滴答、静默闪光、反向渐强、巨响 |
| 38–54 | 黑洞 TON 618 | 带引力透镜的吸积盘、潮汐撕裂恒星、时间膨胀、坠入视界 | 次声隆隆、心跳变慢、下沉滑音、骤停 |
| 54–68 | 牧夫座空洞 | 穿过宇宙网壁进入空洞，四周几乎全黑 | 近乎寂静、风声、耳鸣高音 |
| 68–82 | 热寂 | 加速膨胀的星系网格红移消失；恒星逐颗熄灭；宇宙时钟 10^100 | 红移下滑音、玻璃般熄灭音、心跳停止 |
| 82–90 | 尾声 | 暗淡蓝点 + 光束，标题 | 温暖和弦、钟声 |

## 使用
```bash
node render.mjs sheet 9,17,45 name 3   # 预览帧拼图 → out/stills/
node render.mjs video                  # 全片 → out/cosmic_horror.webm（约 3 分钟）
FONT=/path/SourceHanSansSC.otf node render.mjs video   # 把中文字幕烧录进画面
node verify.mjs out/cosmic_horror.webm 5,45,88         # 在 Chromium 中解码校验
```
