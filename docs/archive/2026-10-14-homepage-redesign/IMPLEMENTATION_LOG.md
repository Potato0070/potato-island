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

## 2026-10-14：交易集市确认稿与导航 C 款

- `app/(tabs)/market.tsx`：页面标题改为居中且不显示品牌区；搜索框、动态分类、次级排序和藏品卡片按确认稿统一暖白、麦芽金与雾霾蓝层级。排序行靠右，左侧新增根据当前 `processedData` 得出的“共 N 件”。分类名称仍来自后台，不硬编码预览稿的临时分类。
- 退市标改为更明显的陶土红章；保留现有方形图片、藏品字段、关注本地存储、近 30 日热度、导航与刷新行为。
- `components/LiquidGlassTabBar.tsx`：将五个手绘矢量占位图替换为 C 款独立 PNG 图标；保留五个标签、液态玻璃容器、全宽布局和跟手透镜交互。
- `docs/design-system/UI_GUIDELINES.md`：建立页面标题、正文、辅助文字字号和行高，以及间距、颜色、控件规格与预览确认流程基准。
- 旨意、消息、金库预览稿已生成并待用户确认；本次未改对应页面代码。

### 验证

- `npx eslint 'app/(tabs)/market.tsx' components/LiquidGlassTabBar.tsx`：通过。
- `npx expo export --platform web --output-dir .expo-preview`：通过，36 条静态路由导出完成。
- `git diff --check`：通过。
- `npx tsc --noEmit --pretty false`：全量检查仍因既有错误未通过，错误在未修改的 `app/my-orders.tsx`、`app/wallet.tsx` 与 `potato-app/` 模板目录；本次修改的集市、导航组件未报告类型错误。
- 旨意、消息、金库仅有待确认效果稿，未改这些页面代码；效果稿中的内容和数据均为示例。

## 2026-10-14：集市最终规范与金库预览归档

- 集市卡片的在售量、流通量和价格说明统一到规范中的 11sp 辅助字号；保留已确认的结构、数据逻辑和动态交互。
- 导航继续使用 `assets/navigation/set-c/` 五个图标；`app/(tabs)/_layout.tsx` 的实际标签为“首页、集市、旨意、消息、金库”，液态玻璃栏与跟手透镜交互保留。
- 记录创世神金库预览确认：以普通玩家金库图为底稿，增加身份徽标与中枢控制台卡。本次仅归档确认稿，没有把预览数据或管理员入口写入金库代码。

### 最新验证

- `npx eslint 'app/(tabs)/market.tsx' components/LiquidGlassTabBar.tsx`：通过，无 errors、无 warnings。
- `git diff --check`：通过。
- `npx expo export --platform web --output-dir .expo-preview-market`：Metro 打包及 36 条路由渲染完成；最终复制静态资源时因 Windows `EPERM` 创建 `assets\\assets` 目录而退出，完整导出未通过。
- `npx tsc --noEmit --pretty false`：仍有既有跨页面错误，位于未修改的 `app/my-orders.tsx`、`app/wallet.tsx` 和 `potato-app/` 模板目录；集市和导航文件没有类型错误。
