# 土豆岛彩铅按钮底图 v1

日期：2026-10-16。用户已选择 B「彩铅描边」方向。

## 资源用途

| 文件 | 用途 | 文字建议 |
|---|---|---|
| primary-blue.png | 推进流程、确认、提交、选材 | 白色 |
| transaction-gold.png | 购买、竞价、确认出价、兑换 | 深棕色 |
| secondary-ivory.png | 返回、取消、稍后、次要操作 | 深棕色 |
| danger-terracotta.png | 撤销、删除、销毁等需明确后果的操作 | 深棕色 |

这批文件为 ImageGen 生成的独立无字透明 PNG 原图，不从方案拼图裁切。四角透明通道已检查；尺寸记录见 manifest.json。

## 已定型与可调整范围

- 已定型：B 彩铅风格；低饱和雾蓝、麦金、暖白、陶土四类；浅色内边与轻微不规则彩铅轮廓；文字与底图分开。
- 可微调：整体纹理强度、运行时按钮的视觉高度、文字对比度、按压位移与禁用反馈。
- 未获本次选择确认：新字体、全站页面替换、按钮业务行为变化及上线发布。
- 购买与竞价复用同一麦金底图，实际标签应写清“购买 / 发起竞价 / 确认出价”，不使用含糊的统一“确认”替代交易动作。

## 接入要求

- 主按钮推荐视觉高 48–52 逻辑像素，紧凑按钮 40；点击热区最小 44 × 44。
- 正文标签由页面真实文字渲染，单行居中；字体方案需单独验收，不照抄预览图中的手写字。
- 原图画布含透明留白，各文件画布比例不同。接入时先以可见边界对齐，针对实际按钮尺寸处理背景显示范围和圆角保护，不能直接把全部原图随意拉满导致视觉高度不同。
- 特别窄的返回、关闭、排序、全选、关注等控件继续使用代码/矢量；不要把宽底板挤压成小方块。
- 按压、禁用、加载、键盘焦点由组件控制；加载中锁定重复提交。
- 2026-10-16：已导出 runtime/ 轻量 WebP，雾蓝底图通过 PencilButton 组件接入金库空态与重试入口；背景明确跟随按钮宽高，已验证不会按原图尺寸溢出。其余类型待对应页面确认后复用。原始 PNG 保留本机与 E 盘归档。

## 生成记录

使用内置 ImageGen，transparent_background=true。参考为已确认方案板的中间 B 列。

共同提示词：Production reusable text-free button background PNG for 土豆岛, a cozy hand-drawn island collectible app. Match ONLY the MIDDLE column B 彩铅描边: restrained warm brown colored-pencil double outline, softly rounded elongated rectangular shape, fine diagonal colored-pencil strokes, subtle paper tooth, crisp but gently imperfect hand-drawn edges. ONE single complete blank button, no letters, symbols, labels or icons. Shape approximately 4.2:1 width to height; central 88% of canvas width with transparent safety margins. Front-on flat UI asset, no perspective, cast shadow, backdrop, glow or 3D. Thin warm-brown pencil border, narrow ivory inner rim, uniform fill and calm central area for live UI text. Match B, not A watercolor or C paper-cut.

颜色后缀依次为：muted dusty ocean blue #668CA7；subdued malt ochre #B18A53；very pale warm ivory #FBF7EE；muted light terracotta #C99283。
