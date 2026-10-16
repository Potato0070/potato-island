# 持仓藏品 F 方案实施记录

日期：2026-10-16
状态：用户已确认 F「海边藏品卡册」，本次按已确认方向实施。

## 已确认的视觉方向

- 白色页面底色，温和的海岸蓝、麦金与暖纸色作为状态和操作色。
- 我的藏品采用横向大卡翻阅：叠层卡片、编号签、状态签、页码点与底部缩略胶片。
- 详情页沿用档案卡片语言，展示实际藏品图片、藏品名、编号、当前状态和真实流转记录。
- 在库藏品提供「转赠」「寄售」；寄售中藏品提供「撤回寄售」。按钮文字由代码渲染，手绘彩铅底图作为独立素材。
- 发布寄售使用底部抽屉；撤回使用轻量居中确认框；成功/失败反馈留在原页面，不强制返回金库。
- A 方案的卡片框、纸面、编号签、状态签、操作图标与弹窗底板使用独立生成素材；数据、文字和可交互状态仍由代码承载，避免整页图片化。
- 从详情页进入的转赠页也纳入这套视觉：复用纸面、卡框、操作图标和确认/结果弹窗素材，保留现有转赠逻辑。
- 所有涉及 Tudooo 的新增图像必须遵循 `docs/design-system/TUDOOO_IP_PROMPT_GUIDE.md`，生成时附上用户确认的角色母版参考图；只变化服饰、道具、动作与场景，避免角色漂移。

## 数据与业务边界

- 页面只显示登录用户当前持有且未销毁的藏品；状态标签来自实际 nfts.status。
- 藏品图优先使用该 NFT 的 image_url，其次回退到系列 collections.image_url。
- 详情页隐藏不存在或不可验证的“底层哈希”；编号使用实际 serial_number。
- 流转记录只展示 transfer_logs 的真实记录；生成时间仅使用 NFT 的 created_at 并明确标注为生成记录。
- 单件寄售及撤回同时校验藏品 ID、当前持有人和预期状态，避免覆盖已变化的资产状态。
- 寄售金额须大于 0、最多两位小数，并遵守系列 max_consign_price。单位为土豆币。
- 批量寄售保留既有 batch_consign_nfts RPC、权益校验和单次 20 件上限，只能选择在库藏品。
- 转赠仍由现有转赠页面完成；详情页传入藏品 ID 后预选该用户在库的对应藏品。
- 所有操作均由用户主动点击提交；本次没有对生产数据执行交易。

## 页面与交互规范

| 元素 | 规范 |
| --- | --- |
| 页面标题 | MiSans Semibold，22px / 28px |
| 详情页导航标题 | MiSans Semibold，19px / 26px |
| 区块标题 | MiSans Semibold，18px / 24px |
| 藏品名 | MiSans Semibold，15–19px / 20–26px |
| 正文与控件 | MiSans Regular 或 Semibold，13–14px / 18–20px |
| 辅助信息 | MiSans Regular，11–12px / 15–18px |
| 输入框 | 至少 16px；容器自绘边框，不采用浏览器默认蓝色焦点框 |
| 主要颜色 | 白底 #FFFFFF、正文棕 #493D35、海岸蓝 #537895、麦金 #A87A3E |
| 交互热区 | 主要按钮高度至少 44px，关闭/返回热区至少 40px |

## 生成素材和实现边界

本方案的原图尺寸与显示比例以 [`ASSET_RATIO_GUIDE.md`](./ASSET_RATIO_GUIDE.md) 为准。卡框、编号/状态签、按钮、纸面与插画分别使用正方形窗口、原生纵横比、九宫格或 `contain`，禁止将一张素材直接拉伸适配所有容器。

| 视觉位置 | 运行时素材 | 由代码承载的内容 |
| --- | --- | --- |
| 藏品册主卡与详情封面 | `album-card-frame-v3.webp`：当前采用的透明窗口彩铅叠卡框 | 实际藏品封面、比例裁切、点击、选中态 |
| 藏品卡纸面与批量寄售抽屉 | `paper-texture.webp`、`archive-paper-panel.webp` | 抽屉高度、滚动、输入校验、价格和数量 |
| 横向信息铭牌/转赠说明区域 | `paper-plaque.webp` | 铭牌上的动态标题和正文 |
| 详情编号签 | `serial-number-tag.webp` | 实际藏品编号与字体 |
| 在库/寄售/不可操作状态签 | `status-in-vault.webp`、`status-listed.webp`、`status-unavailable.webp` | 随 `nfts.status` 更新的状态文字 |
| 操作按钮 | `button-fog-blue.webp`、`button-harvest-gold.webp`、`button-ivory-paper.webp` | 按钮文字、加载/禁用/按压状态 |
| 转赠、寄售、撤回、查看卡册图标 | `icon-transfer-pencil.webp`、`icon-consign-pencil.webp`、`icon-withdraw-pencil.webp`、`icon-album-pencil.webp`、`icon-collection-pencil.webp` | 无障碍名称与按钮动作 |
| 撤回确认与结果反馈 | `withdraw-confirm-panel.webp`、`result-paper-panel.webp` | 标题、藏品信息、金额和确认按钮 |
| 空卡册、无搜索结果、连接异常 | `empty-collection-album.webp`、`empty-search-map.webp`、`empty-network-lighthouse.webp` | 空态文案与重试行为 |
| 转赠选藏抽屉的库存空态 | `empty-transfer-inventory.webp`：从已确认 C 绘本彩铅空仓素材压缩导出 | 无可转赠藏品时的提示与返回行为 |
| 操作结果插画 | `island-market-stall.webp`、`island-archive-tray.webp` | 上架/撤回后的真实结果信息 |
| 转赠挑选和确认 | 复用以上纸面、卡框、按钮与转赠图标 | 接收人、藏品列表、确认信息 |
| 转赠成功反馈 | 已确认采用 B「帆船运送」：`assets/owned-collection/f-card-v1/runtime/transfer-success-tudooo-sailboat.webp`，透明底 Tudooo 彩铅插画 | 成功文案、藏品名与接收人信息 |

卡册翻页、选中、筛选和搜索、表单焦点、校验提示、金额、状态文字、动态藏品图、流转时间线、关闭/返回/搜索等基础矢量控件由代码完成。它们是实时数据或交互语义，不应烘焙进静态图片。按钮文字也由应用绘制，以保持可访问性和一致的字号规范。

本次审查覆盖我的藏品列表、藏品详情、单件/批量寄售、撤回确认与反馈，以及从详情进入的转赠挑选和确认流程。转赠页的「去兑换」应进入现有 `/exchange` 页面；该页仍保留旧视觉，且兑换流程会销毁 Potato 卡，需按已确认素材规范单独预览和复核后再调整。当前发现前端先后更新卡券、藏品和流转记录，不是单一原子操作；在交易流程复核中应优先改为后端原子 RPC，避免部分写入。

市场、公开藏品详情和管理员页面属于其他流程，后续分别依其已确认的视觉方案盘点素材。

运行时文件位于 `assets/owned-collection/f-card-v1/runtime/`。生成原图、选择稿和完整归档位于 `E:\土豆岛资源库\页面预览\2026-10-16_持仓F方案\`。
