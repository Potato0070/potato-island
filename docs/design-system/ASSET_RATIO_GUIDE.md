# 土豆岛素材比例与展示规范

状态：跨页面通用规范。新增或替换素材时，先确认画布比例与透明安全区，再确定组件显示方式；不得为了塞进容器而把整张素材横向或纵向压扁。

## 统一规则

| 素材用途 | 画布比例 | 组件显示规则 | 是否允许裁切 |
| --- | --- | --- | --- |
| 藏品、PFP、头像、藏品缩略图 | 1:1 | 外层固定正方形；藏品图在展示窗内 `cover`，保证每个卡位尺寸一致 | 可在正方形窗口内裁切，不拉伸 |
| 卡框、贴纸、角色和独立插画 | 保留源图比例 | `contain`，由容器适配，不改变素材本身比例 | 默认不裁切 |
| 竖向编号签、状态签 | 约 1:2 | 按源图比例设定宽高；文字作为独立图层叠加 | 不裁切、不拉伸 |
| 横向按钮底图 | 约 3.8:1 | 使用九宫格，只拉伸中间区域，四角和边缘按高度等比缩放 | 不裁切 |
| 有装饰边框的纸面、确认框和结果卡 | 按源图设计稿 | 使用九宫格保持四角和边框厚度；内容区域由布局承载 | 不裁切 |
| 无边框纸纹 | 1:1 | `cover` 保持纸纹比例；不使用九宫格拉长纹理 | 允许裁切纹理边缘，不裁切主体 |
| 空状态插画 | 保留源图比例 | 使用 `contain`；容器尺寸按画布比例设定 | 不裁切 |

## F 方案运行时素材基准

以下尺寸以 `assets/owned-collection/f-card-v1/runtime/` 中当前确认的 WebP 原图为准。比值为宽 ÷ 高。

| 素材 | 原图尺寸 | 比值 | 显示约束 |
| --- | ---: | ---: | --- |
| `album-card-frame-v3.webp` | 1254 × 1254 | 1.000 | 正方形卡框；藏品展示窗 left 15.5%、top 16.7%、width 70.2%、height 66.8% |
| `serial-number-tag.webp` | 382 × 784 | 0.487 | 32 × 66 dp，约 1:2 |
| `status-in-vault.webp` | 409 × 812 | 0.504 | 34 × 68 dp，约 1:2 |
| `status-listed.webp` | 410 × 811 | 0.506 | 34 × 68 dp，约 1:2 |
| `status-unavailable.webp` | 408 × 812 | 0.502 | 34 × 68 dp，约 1:2 |
| `button-fog-blue.webp` | 900 × 238 | 3.782 | 九宫格；源图切片 top/bottom 30 px、left/right 110 px |
| `button-harvest-gold.webp` | 900 × 239 | 3.766 | 九宫格；源图切片 top/bottom 30 px、left/right 110 px |
| `button-ivory-paper.webp` | 900 × 229 | 3.930 | 九宫格；源图切片 top/bottom 30 px、left/right 110 px |
| `archive-paper-panel.webp` | 493 × 750 | 0.657 | 竖向纸面，九宫格 48/42/48/42 px |
| `paper-plaque.webp` | 471 × 229 | 2.057 | 横向铭牌，九宫格 32/34/32/34 px |
| `paper-texture.webp` | 512 × 512 | 1.000 | 纸纹背景使用 `cover`，不得拉宽纹理 |
| `withdraw-confirm-panel.webp` | 897 × 665 | 1.349 | 九宫格，每边 72 px |
| `result-paper-panel.webp` | 799 × 757 | 1.055 | 九宫格，每边 68 px |
| `empty-collection-album.webp` | 842 × 564 | 1.493 | `contain`，容器 190 × 127 dp |
| `empty-search-map.webp` | 739 × 604 | 1.224 | `contain`，容器 190 × 155 dp |
| `empty-network-lighthouse.webp` | 609 × 622 | 0.979 | `contain`，容器 190 × 194 dp |
| `empty-transfer-inventory.webp` | 640 × 427 | 1.499 | `contain`，容器约 174 × 116 dp |
| `transfer-success-tudooo-sailboat.webp` | 900 × 900 | 1.000 | 正方形透明画布，`contain` |
| `island-market-stall.webp` | 560 × 611 | 0.917 | `contain`，保留竖向插画比例 |
| `island-archive-tray.webp` | 560 × 558 | 1.004 | `contain`，接近正方形 |

## 组件责任

- `FolioArtwork` 固定 1:1；动态藏品图只在卡框透明窗口中裁切，卡框本身完整显示。
- `FolioSerialTag` 与 `FolioStateTag` 统一使用接近原图的 1:2 画布；编号和状态文字不烘焙进标签图片。
- `FolioButton` 使用九宫格按钮底图；可变长文案只改变中间宽度，不挤压手绘边角。
- `FolioPaperSurface` 的纸面、铭牌、确认与结果素材使用九宫格；纯纸纹背景保持原比例并按容器裁切。
- 空状态、成功反馈和 Tudooo 插画使用 `contain`。如果素材在容器里显得过小，应调整容器，而不是改变原图比例。

## 新素材交付要求

1. 生成前确定用途、目标画布比例、透明背景需求和安全留白。
2. 状态贴纸、图标、角色等独立素材保留完整透明边界，不把动态文案、价格或编号烘焙进图。
3. 带边框的可变尺寸素材要在源图中预留九宫格安全区；装饰不能进入可拉伸的中心切片。
4. 导出后记录像素尺寸、宽高比、透明边界和实际组件显示规则，再纳入代码。
5. 未经用户确认，不把候选图替换进运行时资源库。
