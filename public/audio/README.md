# 精彩瞬间 · 背景音乐

播放器读取本目录下的音频文件作为「精彩瞬间」栏目的背景音乐。

当前文件：`wc2026-theme.m4a`

- 歌曲：**Dai Dai** —— 2026 美加墨世界杯主题曲（Shakira & Burna Boy）
- 来源：Bilibili MV `https://www.bilibili.com/video/BV1gK5Y6EEUH`
- 格式：AAC / fragmented MP4（`.m4a`），浏览器原生支持播放

## 更换歌曲

替换 `wc2026-theme.m4a` 即可（文件名保持不变）。如需改名，请同步修改
`src/views/Gallery.tsx` 中的 `THEME_SONG_URL` 与 `THEME_SONG_TITLE`。

> 注意：Bilibili 的 DASH 音频流为 `.m4s`（fragmented MP4），下载后直接以 `.m4a`
> 提供即可被浏览器播放，无需额外转码（前提是没有 moov 在后的传统 MP4 问题）。
