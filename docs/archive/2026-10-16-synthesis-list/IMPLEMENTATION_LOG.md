# 实现记录

## 2026-10-16

- 以用户确认的 B 方案为基准，重构 `app/synthesis-list.tsx` 的活动列表排版。
- 增加进行中、未开始、已结束的动态状态筛选与数量；优先使用活动 `start_time`，未配置时回退到记录创建时间，并以 `end_time` 与剩余额度判定结束状态。
- 卡片改为横向紧凑信息布局，保留方形藏品图、起止时间、合成额度进度与详情页入口。
- 详情页路由、Supabase 活动数据与原合成流程保持沿用。
- 更新 `docs/design-system/UI_GUIDELINES.md` 的合成列表基线。

## 验收

- `npx eslint app/synthesis-list.tsx`：通过。
- `npx expo export --platform web`：通过，导出包含 `/synthesis-list` 路由。
- `npx tsc --noEmit --pretty false`：全仓仍有其他文件与内嵌 `potato-app` 模板的既有错误；未报告 `app/synthesis-list.tsx` 错误。具体位置见本次 Codex 对话记录。
