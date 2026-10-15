# 底部导航图标碎片修复

日期：2026-10-15

## 问题与原因

线上首页和本地 PNG 均已检查。旨意、消息、金库三个源切片的左侧带入相邻图案，右侧主体还存在截断。问题在插图资源本身，并非玻璃透镜位移或导航栏宽度导致。

## 本轮修复

- 以原图为参照清理三个图标，移除邻图碎片并补齐被截断的主体，延续已选 C 款的水彩手绘画风。
- 导出为带透明安全边距的 256 × 256 PNG，接入 `assets/navigation/set-c-clean/`；原切片保留在 `assets/navigation/set-c/` 供追溯。
- 只修改三个资源引用，不改导航路径、标签、尺寸、按压或滑动行为。
- 源图使用内置 ImageGen 编辑，集成时仅做透明画布居中和等比缩放。
- 三个资源四边可见像素均为 0，已在暖灰底检查完整轮廓与主体居中。

## 生成源文件

- 旨意：`exec-7549ede1-f853-4b75-adad-7d029aa71e24.png`
- 消息：`exec-f5bbdf16-f6ad-4fbf-b2c2-f6d0b4d8fb96.png`
- 金库：`exec-f8aef4b7-a326-48b9-893b-5dadb9b41a2f.png`

生成源图、修复前切片、轻量运行资源与修复说明已复制到 `E:\土豆岛资源库\导航栏图标\C款\2026-10-15碎片修复\`。

## 验证与发布

- `npx eslint components/LiquidGlassTabBar.tsx` 通过；修改范围的 `git diff --check` 通过。
- 修复提交为 `524130c`，已同步 `origin/main`。
- 部署后刷新线上首页，实际截图中的旨意、消息、金库三个图标轮廓完整、无邻图碎片。普通图标和透镜图标共用同一份资源映射。
- 后续优化方案已形成 18 页 PDF 与 Markdown，覆盖当前 29 个页面文件、共享交互状态、创世中枢任务和分批验收；文档中的新增方向尚未批量实施。
- PDF 已逐页渲染检查中文显示与布局，归档副本哈希与验收稿一致；两种文档位于 `E:\土豆岛资源库\优化方案\2026-10-15\`，Markdown 源稿另保留于仓库 `docs/roadmap/`。

## 内置 ImageGen 提示词留档

模式：内置 ImageGen，分别以原三个 PNG 为编辑参照，透明背景。三次请求使用下列共享提示词，将 SUBJECT 替换为对应主体描述。

Edit the supplied existing navigation icon. Keep the same recognizable subject, colors, watercolor/pencil brushwork and warm brown outline. Subject: SUBJECT. Remove ALL fragments belonging to adjacent icons along the left edge, any thin isolated marks, and any colored matte/halo noise. Reconstruct the right side of this icon which is currently cut off so the complete silhouette is visible. Place exactly ONE isolated complete icon centered on a genuinely transparent square canvas with generous transparent padding of about 10 percent on all four sides. Preserve the existing design as faithfully as possible; this is a production cleanup, not a style redesign. No background, no text, no shadow outside the artwork, no neighboring objects, no detached edge specks, no cropped content. The entire subject and its natural attached leaves must fit completely inside the canvas.

- 旨意主体：a rolled parchment map with a green sprout island, water and leaves
- 消息主体：a cute white duck mail courier wearing a blue captain cap and blue outfit holding a sealed heart envelope
- 金库主体：a warm brown wooden treasure chest with gold trim, a potato emblem on the front and small green leaves
