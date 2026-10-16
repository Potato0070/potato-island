# 金库快捷图标 · A 经典岛居

日期：2026-10-16。用户已选择 A「经典岛居」。

| 名称 | 文件 | 主体 |
|---|---|---|
| 订单 | orders.png | 木夹与订单小票 |
| 邀请 | invite.png | 两封邀请信与鼠尾草绿封印 |
| 求购 | buy-request.png | 藤编购物篮与空白便签 |
| 钱包 | wallet.png | 麦金色零钱包与雾蓝搭扣 |
| 设置 | settings.png | 木质六齿齿轮 |

合成、权益、转赠分别复用 assets/homepage/icons/gene.png、lord.png、transfer.png。首页和导航图标不因本次素材制作重新设计。

## 定型与接入范围

- A 经典岛居主体和低饱和彩铅风已确定，保留浅暖白圆形纸底，圆底以外透明。
- 这五张由内置 ImageGen 参考 A 行逐张生成，均为无字独立 PNG，不从方案板裁切。
- 四角透明检查与原始尺寸见 manifest.json；目前为高分辨率原图。
- 接入页面前要检查四边游离像素、在 40–48 逻辑像素下的清晰度，并与三个复用图标校准圆底和主体的视觉大小；不得只看放大的单张图。
- 完成页面预览验收后再导出运行用轻量资源，避免将大原图直接作为高频加载的小图标。
- 图标文字标签单独使用页面字体，不在图片内生成；邀请图标不代表邀请功能已接通。
- 2026-10-16：runtime/ 中的轻量 WebP 已接入金库页面。原始 PNG 保留在本机与 E 盘归档，不作为运行时资源上传。已检查手机与桌面实际显示及快捷入口。

## 生成记录

工具：内置 ImageGen；transparent_background=true；参考已确认对比板最上方 A 行。

共同提示：One isolated production treasury shortcut icon for 土豆岛. Reproduce ONLY the appropriate TOP ROW A 经典岛居 icon. Match proportions, low-saturation colors, warm brown pencil contours, matte colored-pencil shading and light watercolor paper texture. Square centered single complete icon with very pale warm ivory circular paper medallion, transparent outside circle. Circle about 84% canvas width; object about 58–65%, entirely within circle. Tiny ochre pencil accent strokes permitted. Readable at 40–48 logical pixels. No labels, letters, numbers, backdrop outside circle, mascots, faces, 3D, neon or cast shadow.

主体提示分别为：wood-clipped ivory order receipt with three pictographic lines and muted colored bullet dots；two overlapping sealed ivory envelopes, sage wax seal；compact empty wicker basket with handle and blank request tag；ochre coin purse with curved dusty-blue clasp and two round clasp knobs；plain warm wooden six-tooth gear with open circular center, no other tool。
