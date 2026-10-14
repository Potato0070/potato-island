# 实施记录

## 2026-10-14：首页视觉第一阶段

- `app/(tabs)/index.tsx`：使用确认稿中裁出的八个彩铅图标，替换首页入口 emoji；左上角加上 Logo B 图形和“土豆岛”字标；首页底色、文字、边框、卡片强调色改为已确认的低饱和配色；入口显示名称同步确认稿中的“捐赠兑换”“资产转移”。
- `app/(tabs)/_layout.tsx`：底部导航采用雾霾蓝选中态、半透明白色背景模糊、圆角、细边框和轻柔浮起阴影，保持各 tab 路由和功能。
- `assets/homepage/`：保存 Expo 构建使用的轻量 Logo B 和八个图标切片；原始高分辨率视觉稿同步存入 E 盘归档。
- 未更改 Supabase 查询、数据状态、价格/倒计时/刷新行为和卡片跳转。

### 验证

- `npm run lint`：通过，0 errors；显示 26 条既有跨页面 warning，本轮修改文件没有 warning。
- `npx expo export --platform web --output-dir .expo-preview`：通过，首页和资源成功打包。
- `npx tsc --noEmit`：未通过；报错均在本轮未修改的 `app/my-orders.tsx`、`app/wallet.tsx` 和 `potato-app/` 模板文件，本轮修改文件无 TypeScript 报错。
- 本地浏览器自动截图未完成：受限环境缺少 Playwright Chromium，Edge 自动启动也被本机管道策略中止；不影响 Expo Web bundle 成功。

## 2026-10-14：底部导航二次迭代

- `app/(tabs)/_layout.tsx`：Tab 标题更新为“首页、集市、旨意、消息、金库”，接入自定义底部导航组件。
- `components/LiquidGlassTabBar.tsx`：新增漂浮玻璃底栏、A 方向岛民主题图标、触摸弹起和横向拖动跟手透镜；拖动结束后切换到命中的 Tab。维持五个既有路由。
- 视觉实现使用 `expo-blur`、React Native `Animated` 与 `PanResponder`，未增加依赖；透镜通过局部图标放大、模糊底板、边缘高光和阴影模拟折射。
- 未触碰 Supabase、资产、交易和页面数据逻辑。

### 验证

- `npx eslint 'app/(tabs)/_layout.tsx' components/LiquidGlassTabBar.tsx`：通过，0 errors、0 warnings。
- `npx expo export --platform web --output-dir .expo-preview`：通过，36 条静态路由完成导出。
- `npx tsc --noEmit --pretty false`：仍有既有错误，集中在未修改的 `app/my-orders.tsx`、`app/wallet.tsx` 与 `potato-app/` 模板文件；新导航组件未报告类型错误。
- 线上验收待推送并等待 `podao.fun` 部署更新后进行。

## 2026-10-14：导航栏切换宽度修复

- `components/LiquidGlassTabBar.tsx`：导航外框改为填满安全边距内的实际布局容器，使用 `onLayout` 测得的宽度计算五个入口、触点命中区与透镜位置；选中 Tab 时仅移动内部透镜，外框宽度保持稳定。
- 未调整五个页面内容、路由、数据和交易逻辑；用户确认的暖白液态玻璃样式与图标保留。

### 验证

- `npx eslint 'app/(tabs)/_layout.tsx' components/LiquidGlassTabBar.tsx`：通过，0 errors、0 warnings。
- `npx expo export --platform web --output-dir .expo-preview`：通过，36 条静态路由完成导出。
- `npx tsc --noEmit --pretty false`：未通过，报错仅在原有 `app/my-orders.tsx`、`app/wallet.tsx` 和 `potato-app/` 模板；导航组件未报告类型错误。

## 2026-10-14：交易集市视觉优化

- `app/(tabs)/market.tsx`：页面底色改为纯白；标题、搜索、动态分类与排序按实际操作顺序排布；选中态使用雾霾蓝，卡片采用轻边框和低阴影；退市状态改为浅色遮罩，保留藏品可辨识度；空态和骨架屏同步收敛配色。
- 保留 Supabase 查询、动态分类、名称搜索、最新/价格排序、AsyncStorage 偏好、双列卡片数据、退市判断、价格标签、集合页跳转与下拉刷新；没有增加无后端依据的筛选功能。

### 验证

- `npx eslint 'app/(tabs)/market.tsx'`：0 errors；保留 3 条该文件原有空 `catch` 参数 warning。
- `git diff --check`：通过。
- `npx expo export --platform web --output-dir .expo-preview`：通过，36 条静态路由完成导出。
- TypeScript 全量检查沿用上文记录的既有跨页面错误；本次仅修改页面样式和搜索框排布，没有改动数据逻辑。

## 2026-10-14：交易集市排序与关注交互

- `app/(tabs)/market.tsx`：顶部品牌区加入 Logo B；排序项调整为“最热、最新、价格排序、关注”，最热通过 `transfer_logs` 统计近 30 天正价且有卖家的流转记录，排除好友转赠与首发/创世铸造，成交数相同则按藏品创建时间排序。
- 藏品卡片增加独立爱心按钮，关注 ID 使用 `@market_followed_collection_ids` 本地保存；“关注”筛选即时展示用户收藏的藏品，空态提示如何收藏。
- 保持每张藏品图 1:1；退市章放大；价格排序按钮显示当前升/降方向。没有写数据库或更改交易行为。
- `CHANGE_BOUNDARIES.md`：记录用户对集市交互追加确认，限定新增范围。

### 验证

- `npx eslint 'app/(tabs)/market.tsx'`：通过，无 errors、无 warnings。
- `git diff --check`：通过。
- `npx expo export --platform web --output-dir .expo-preview`：通过，36 条静态路由完成导出；`/(tabs)/market` 页面打包成功。
- 推送后线上首页返回 HTTP 200；首页引用的公开 JS bundle 已包含 `@market_followed_collection_ids`、`transfer_logs`、`heart-outline` 等本轮实现标记。内置浏览器中直达 `/market` 返回 404，且线上页面截图访问超时，因此已确认部署资源更新，未能完成可视化交互验收。
- TypeScript 全量检查未重复执行；此前已记录的既有跨页面错误不属于本轮范围。本次页面 ESLint 无 errors、无 warnings，`git diff --check` 通过。
