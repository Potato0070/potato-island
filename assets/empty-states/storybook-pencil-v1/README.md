# 通用空状态 · C 绘本彩铅

日期：2026-10-16。用户已选定 C「绘本彩铅」。

| 素材 | 用途 | 可搭配的操作 |
|---|---|---|
| empty-inventory.png | 无藏品、暂无持有、合成材料不足 | 去集市、补齐材料 |
| empty-mailbox.png | 暂无消息、订单或成交记录 | 返回、浏览集市；按页面真实能力提供入口 |
| empty-search.png | 搜索或筛选无匹配内容 | 清空搜索、重置筛选 |
| network-unavailable.png | 请求失败、超时或暂时无法连接 | 重试；保留现有内容和输入 |

## 固定规范

- 已定型：C 绘本彩铅插画方向；按钮仍沿用已选 B 彩铅描边，二者共享低饱和自然色与彩铅笔触。
- 无文字独立透明 PNG；全部由内置 ImageGen 逐张生成，不从对比方案板裁切。
- 四角透明通道已检查；原始尺寸、源文件名与检查结果记录于 manifest.json。
- 手机插画初始建议宽 80–112 逻辑像素，保持原始比例，文字与按钮单独排版；灯塔等高形主体按可见尺寸校准，避免比其他素材显得过大。
- 不把空状态插画当作点击按钮，不把其透明留白当作布局间距。
- 空箱仅说明持有/材料状态，离线灯塔仅说明加载异常；不能把请求失败伪装成零资产或没有内容。
- 2026-10-16：已导出 runtime/ 轻量 WebP，金库接入空箱和加载失败灯塔。手机白底显示已检查，其他空态按后续页面逐项接入。原始 PNG 保留本机与 E 盘归档。

## 生成提示词

内置 ImageGen，transparent_background=true，参考方案板最右侧 C 列。

共同提示：One isolated production empty-state illustration for 土豆岛. Match ONLY rightmost C 绘本彩铅: warm storybook colored-pencil contours, gentle handmade asymmetry, pale transparent watercolor underneath, soft paper-tooth strokes, matte natural materials. Low saturation warm ochre, ivory, sage, dusty blue and terracotta. Compact centered complete subject, about 75% canvas width, generous transparent safety margins, genuinely transparent background, opaque recognizable object. Tiny fading grounding marks only, no background rectangle. Readable at 80–112 logical pixels. No text, labels, watermark, comparison grid, characters, faces, mascots, potatoes, sparkles, glossy 3D, strong shadows or saturation.

主体提示：

1. Open clearly EMPTY weathered wooden storage chest, upright lid, cream linen draped over front, tiny stones and grass; no treasures, coins, cards or contents.
2. Freestanding wooden island mailbox, curved sage roof, open door and empty interior, plain sealed ivory envelope beside base, tiny grass/stone marks; no raised unread flag or emblems.
3. Folded parchment island map with sage land, dusty blue sea, short dotted route, wooden magnifying glass diagonally across; no letters, numbers or labels, no desk.
4. Ivory coastal lighthouse with terracotta roof on compact rocks, faint sea and soft mist, small broken/dotted signal motif; no storms, damage or warning marks.
