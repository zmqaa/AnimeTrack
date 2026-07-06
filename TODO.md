# 待办：从 animetrackdesk 合入的功能

> 2026-06-22 对比分析后整理，后续逐项实施。

## 一、新增功能

### 1.1 动漫推荐系统 ⭐

desk 版新增了完整的推荐引擎：
- 基于用户库内标签、声优、观看模式生成偏好画像
- 从 Bangumi API 拉取候选动漫
- AI 对候选进行打分排序
- 新增页面：`/anime/recommendations`

涉及文件（desk 版）：
- `src/pages/AnimeRecommendationsPage.tsx`
- `src/lib/anime-recommendations.ts`

### 1.2 用户偏好分析

desk 版新增了观看偏好分析：
- 分析观看时间分布、类型偏好、声优偏好等
- 整合到 Dashboard 或独立展示

涉及文件（desk 版）：
- `lib/anime-preference-insights.ts`

### 1.3 设置页面整合

desk 版把主题、AI 配置、存储信息集中在一个设置页面：
- 主题选择器（目前 web 版已有侧边栏主题切换）
- AI 服务商配置（Base URL、Model、API Key 测试连接）
- 数据库/存储信息展示

## 二、代码优化

> 以下待实际 review 后确认，先列方向。

### 2.1 可能臃肿的模块

- `lib/anime-enrichment.ts` — AI 元数据补充逻辑，desk 版和 web 版都有，可能有很多冗余分支
- `components/Dashboard.tsx` — Dashboard 组件可能过大
- 两套数据层的重复逻辑（web 版的 server-side DB ops vs desk 版的 Tauri store）

### 2.2 优化方向

- 抽离重复代码，合并相似逻辑
- 大组件拆分
- 删除未使用的代码路径
- 统一类型定义（两个版本有些类型不一致）

## 三、实施顺序

1. 先在服务器上把 web 版跑起来，确认当前状态
2. Review 代码，标记臃肿/冗余的地方
3. 从推荐系统开始，逐项合入 desk 版新功能
4. 优化清理
5. 删除 animetrackdesk

## 四、参考

- desk 版路径：`~/projects/animetrackdesk`（合入后删除）
- web 版路径：`~/projects/animetrack`
