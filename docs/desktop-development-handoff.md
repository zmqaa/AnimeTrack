# AnimeTrack 桌面版开发交接说明

更新时间：2026-07-16

## 1. 当前目标

在不复制项目、不维护第二套前端的前提下，让同一个 AnimeTrack 仓库同时支持：

- Web 模式：部署到服务器，公开浏览，管理员登录后才能修改。
- Desktop 模式：Windows 便携应用，解压后直接运行，本机默认拥有完整管理权限，不需要登录。
- 两种模式共享页面、样式、API、SQLite 数据结构和业务逻辑。
- 使用 Electron 包装现有 Next.js 应用，保持页面样式一致。
- 桌面版允许用户在设置页填写自己的 API Key、API URL 和模型名称。

当前已经完成：

- Web/Desktop 运行模式和权限边界。
- 数据库、封面、备份、设置文件的统一运行时路径。
- 远程封面来源与本地缓存字段拆分。
- 全部 212 条现有动漫的远程 `coverUrl` 恢复。
- 可迁移 JSON 备份格式优化。
- Desktop AI 设置存储、设置页、接口和动态生效。

当前还没有接入 Electron，也没有启用 Next.js standalone 输出。下一阶段应先补正式数据库迁移执行器，然后开始 Electron 外壳。

## 2. 已确定的整体架构

### Web 模式

- 保持现有 NextAuth 管理员登录。
- 访客只能浏览。
- 管理员可以新增、编辑、删除、AI 录入、备份和导入。
- AI 配置继续读取服务器环境变量。

### Desktop 模式

- Electron 启动器未来注入：

```env
ANIMETRACK_RUNTIME=desktop
ANIMETRACK_DATA_DIR=程序目录/data
DB_PATH=程序目录/data/animetrack.db
ANIMETRACK_BACKUPS_DIR=程序目录/data/backups
ANIMETRACK_COVERS_DIR=程序目录/data/covers
ANIMETRACK_SETTINGS_PATH=程序目录/data/settings.json
```

- 桌面模式服务端直接拥有管理能力，不要求 NextAuth 登录。
- 本地服务必须只监听 `127.0.0.1`。
- 登录、注册和退出入口在桌面模式隐藏。
- 数据库、封面、备份、设置文件存放在便携包的 `data/` 目录。

预计最终目录：

```text
AnimeTrack/
├─ AnimeTrack.exe
├─ resources/
└─ data/
   ├─ animetrack.db
   ├─ settings.json
   ├─ covers/
   ├─ backups/
   └─ logs/
```

## 3. 已完成：运行模式和权限抽象

新增：

- `lib/runtime-mode.ts`
- `lib/runtime-paths.ts`
- `hooks/useRuntimeAccess.ts`
- `app/api/runtime/route.ts`

运行模式：

```ts
type RuntimeMode = 'web' | 'desktop';
```

桌面模式只由服务进程环境变量控制：

```env
ANIMETRACK_RUNTIME=desktop
```

不能通过 URL 参数、Cookie 或客户端输入开启桌面模式。

### 服务端权限

`lib/api-response.ts` 已新增统一管理权限判断：

```ts
requireManagePermission()
```

兼容保留了原来的：

```ts
requireAdmin()
```

其内部现在等价于：

```text
Desktop → 直接允许
Web → 必须有 admin session
```

因此现有 API 路由暂时无需全部重命名，也已经支持桌面免登录。

### 前端权限

前端通过：

```ts
useRuntimeAccess()
```

获取：

```ts
{
  mode: 'web' | 'desktop',
  canManage: boolean,
  authenticationRequired: boolean
}
```

已接入：

- 顶部导航
- 动漫列表编辑功能
- 动漫详情编辑功能
- 数据管理页面
- 备份与导入页面
- AI 设置页面

桌面模式会显示管理入口和编辑按钮，同时隐藏退出登录。

## 4. 已完成：统一数据路径

`lib/runtime-paths.ts` 目前提供：

```ts
getDataDirectory()
getDatabasePath()
getBackupsDirectory()
getCoversDirectory()
getSettingsPath()
getProjectResourcePath()
```

支持环境变量：

```env
ANIMETRACK_DATA_DIR
ANIMETRACK_BACKUPS_DIR
ANIMETRACK_COVERS_DIR
ANIMETRACK_SETTINGS_PATH
DB_PATH
```

默认行为：

- Web 数据库仍是 `data/animetrack.db`
- Web 备份仍是项目根目录 `backups/`
- Web 封面仍是 `public/covers/`
- Desktop 备份是 `data/backups/`
- Desktop 封面是 `data/covers/`
- Desktop 设置文件是 `data/settings.json`

备份 API 和 `scheduled_backup.js` 已接入统一路径。

## 5. 封面模型：已经从一个字段拆成两个字段

旧模型只有：

```text
coverUrl
```

它同时存放：

- Bangumi 远程 URL
- `/covers/123.jpg` 本地访问地址

下载成功后，远程 URL 会被本地地址覆盖，造成远程来源丢失。

现在模型为：

```text
coverUrl        远程原始来源，例如 Bangumi URL
localCoverUrl   下载后的本地缓存访问地址
displayCoverUrl API 返回时计算的展示地址，不存数据库
```

展示规则：

```text
本地字段有值且图片文件真实存在
    → displayCoverUrl = localCoverUrl

本地文件不存在，但远程地址存在
    → displayCoverUrl = coverUrl

两者都不可用
    → 无封面
```

注意：不只是判断 `localCoverUrl` 字段是否为空，还会检查磁盘文件是否真实存在。这保证 JSON 导入到另一台服务器、但没有同步本地图片时，可以真正回退到 Bangumi。

### 数据库迁移

新增：

```text
database/migrations/migrate_021_split_cover_source_and_local.sql
```

数据库启动兼容逻辑也已加入 `lib/db.ts`。

旧数据迁移规则：

```text
coverUrl=/covers/...
或
coverUrl=/api/local-covers/...

迁移为：
localCoverUrl=旧 coverUrl
coverUrl=NULL
```

远程 `http://`、`https://` 地址继续保留在 `coverUrl`。

### 当前真实数据库统计

2026-07-16 完成 Bangumi 远程来源恢复后已经实际检查：

```text
动漫总数：212
coverUrl 有远程地址：212
localCoverUrl 有本地地址：211
只有 localCoverUrl、没有 coverUrl：0
```

旧逻辑覆盖丢失的 211 条远程来源已经恢复。

### 本地封面访问

Desktop 模式下载的图片保存在：

```text
data/covers/{id}.jpg
```

通过路由读取：

```text
/api/local-covers/{id}.jpg
```

Web 模式目前继续使用：

```text
public/covers/{id}.jpg
/covers/{id}.jpg
```

已有 `/covers/...` 数据保持兼容。

## 6. 封面来源恢复脚本

已经在现有 Bangumi 批量补全脚本中增加：

```text
--covers-only
```

新增 npm 命令：

```bash
npm run covers:restore-sources
npm run covers:restore-sources:write
```

### 安全预览

```bash
npm run covers:restore-sources -- --limit=10
```

默认 dry-run，不写数据库。

### 正式写入

```bash
npm run covers:restore-sources:write
```

行为：

- 只处理 `coverUrl` 为空的记录。
- 不覆盖已有远程地址。
- 不修改 `localCoverUrl`。
- 不修改标题、评分、简介等其他元数据。
- 优先用 `original_title` 精确匹配 Bangumi。
- 无原名或精确匹配失败时，回退中文标题搜索。

也支持：

```bash
npm run covers:restore-sources -- --ids=1,2,3
npm run covers:restore-sources -- --limit=20 --concurrency=1
```

已经联网预览并正式写入：

```text
处理：211 条
写入：211 条
剩余空 coverUrl：0 条
```

写入前 SQL 备份：

```text
backups/scheduled-backup-2026-07-16_17-16-38.sql
```

审计时发现“原标题包含匹配”会把《笨蛋，测验，召唤兽2》误匹配为首季，现已：

- 将精确匹配收紧为只忽略全半角和空格差异，不再接受短标题包含。
- 单独修正 ID 31 为 Bangumi `[11145] バカとテストと召喚獣にっ!`。
- 网络请求失败会明确显示为失败，不再伪装成“未找到 Bangumi 结果”。

## 7. JSON 导入导出和 SQL 备份

当前 JSON 导出格式版本为 `2`，封面只包含可迁移的远程来源：

```json
{
  "formatVersion": 2,
  "anime": {
    "records": [
      {
        "coverUrl": "https://lain.bgm.tv/..."
      }
    ]
  }
}
```

其中：

- `coverUrl` 是可迁移的远程来源。
- `localCoverUrl` 只是本地路径引用，不再写入新 JSON。
- `displayCoverUrl` 是计算字段，不再写入新 JSON。
- 如果旧数据的 `coverUrl` 仍是 `/covers/...` 等本地路径，新导出也会忽略该字段。
- JSON 文件本身不包含图片二进制内容。

导入逻辑支持：

- 新格式中只包含远程 `coverUrl` 的记录
- 过渡格式中的 `coverUrl` 与 `localCoverUrl`
- 旧格式中 `coverUrl=/covers/...` 的记录

旧格式导入时会自动识别成本地字段。

以下脚本已增加 `localCoverUrl`：

- `scripts/db/scheduled_backup.js`
- `scripts/db/export_full_backup.js`
- `scripts/db/export_anime_seed.js`
- `scripts/import-export.ts`

## 8. 已完成：Desktop AI 设置

新增：

```text
lib/runtime-settings.ts
app/settings/page.tsx
app/api/settings/ai/route.ts
app/api/settings/ai/test/route.ts
```

桌面设置格式：

```json
{
  "version": 1,
  "ai": {
    "provider": "deepseek",
    "apiUrl": "https://api.deepseek.com/chat/completions",
    "model": "deepseek-chat",
    "apiKey": "sk-...",
    "jsonFormat": true,
    "disableThinking": false
  }
}
```

配置优先级：

```text
Desktop：settings.json > 环境变量 > 默认值
Web：环境变量 > 默认值
```

实现行为：

- Desktop 设置页可保存 API URL、模型、API Key、JSON 输出和 thinking 开关。
- API Key 不会由 GET 接口返回明文，只返回是否存在和脱敏预览。
- Web 设置页只读并提示由服务器环境变量管理，不会覆盖线上密钥。
- `data/settings.json` 和临时文件已加入 `.gitignore`。
- 保存使用桌面数据目录，可通过 `ANIMETRACK_SETTINGS_PATH` 覆盖。
- AI 请求每次动态读取配置，保存后立即生效，无需重启。
- 设置页提供连接测试；测试只向用户配置的 AI 服务发送固定测试文本。

设置相关路由：

```text
GET /api/settings/ai
PUT /api/settings/ai
POST /api/settings/ai/test
```

尚未进行浏览器界面验收，需在 Desktop 运行模式接入后自行打开页面确认实际观感。

## 9. 验证情况

已通过：

```bash
npx tsc --noEmit
npm run build:next
git diff --check
node --check scripts/enrich/enrich_bangumi.js
```

生产构建成功，已包含：

```text
/settings
/api/settings/ai
/api/settings/ai/test
/api/local-covers/[file]
/api/runtime
```

现有唯一警告：

```text
components/dashboard/CastNetwork.tsx
React Hook useCallback has an unnecessary dependency: 'theme'
```

这是本轮修改前已有的警告，与桌面化和封面改造无关。

按照项目 `AGENTS.md` 约定，本轮没有启动浏览器，也没有截图验收。

## 10. 需要注意的当前工作区状态

这些改动尚未提交。

本轮是在用户上一提交：

```text
c4b1c74 小优化，模块化
```

之后继续开发的。

当前工作区包含四组连续改动：

1. 桌面运行模式、权限、数据路径前置改造。
2. 双封面字段、迁移、回退和恢复脚本。
3. JSON 导出封面字段优化。
4. Desktop AI 设置存储、接口、页面和动态运行时配置。

不要随意 reset 或丢弃。

数据库本体已因远程封面来源恢复而发生修改：

```text
data/animetrack.db
```

写入前备份：

```text
backups/scheduled-backup-2026-07-16_17-16-38.sql
```

当前 `git status` 还显示原先被追踪的 SQLite WAL 文件为删除状态：

```text
D data/animetrack.db-wal
D data/animetrack.db-shm
```

这是数据库连接关闭后的运行文件状态。不要为了清理状态而直接 reset、checkout 或手工重建；下一窗口应先确认是否有 Next.js/Node 进程和这些文件原本是否应继续被 Git 追踪，再决定如何处理。

## 11. 下一阶段开发顺序

### 第一步：正式数据库迁移执行器

当前 `localCoverUrl` 仍使用 `lib/db.ts` 中的专门兼容检查。桌面应用升级后必须能自动、安全地执行未来迁移，因此建议先实现：

```text
lib/database-migrations.ts
schema_migrations 表
按文件编号执行 database/migrations/*.sql
单个迁移事务执行
迁移前自动备份数据库
重复启动时不重复执行
迁移失败时保留原数据库并记录明确错误
```

注意：

- 现有 `database/migrations/migrate_021_split_cover_source_and_local.sql` 需要纳入正式执行器。
- 需要兼容已有数据库已经由启动逻辑完成 `localCoverUrl` 修改的情况。
- 不要让迁移执行器再次破坏或覆盖现有 212 条远程 `coverUrl`。

### 第二步：Next.js standalone 输出

当前状态：

- `next.config.mjs` 尚未配置 `output: 'standalone'`。
- `package.json` 尚无桌面构建命令。
- 尚未验证 standalone 目录中静态资源和 `public/` 的复制。

建议：

```text
next.config.mjs → output: 'standalone'
增加 desktop 构建脚本
构建后复制 .next/static
按需复制 public
验证 standalone/server.js 可由指定 HOSTNAME、PORT 启动
```

启动环境必须包含：

```env
HOSTNAME=127.0.0.1
PORT=动态空闲端口
ANIMETRACK_RUNTIME=desktop
ANIMETRACK_DATA_DIR=便携包/data
```

### 第三步：Electron 外壳

当前仓库尚未安装 Electron、打包器或相关类型，也没有 Electron 主进程文件。

建议新增结构：

```text
desktop/
├─ main.ts
├─ server.ts
└─ window.ts
```

主流程：

1. 获取单实例锁。
2. 计算 exe 同级的 `data/` 目录并创建所需子目录。
3. 获取本地空闲端口。
4. 注入 Desktop 环境变量。
5. 启动 Next standalone 服务，只监听 `127.0.0.1`。
6. 等待健康检查成功。
7. 创建 BrowserWindow 并加载本地 URL。
8. 窗口全部关闭时终止服务进程。
9. 将服务日志写入 `data/logs/`。

建议新增轻量健康路由：

```text
GET /api/health
```

它只需返回运行模式和数据库可用状态，不返回密钥或敏感路径。现有 `/api/runtime` 可用于模式确认，但不应承担完整健康检查。

安全边界：

- 禁止监听 `0.0.0.0`。
- `BrowserWindow` 使用 `contextIsolation: true`。
- 默认关闭 `nodeIntegration`。
- 外部链接交给系统浏览器。
- 不把 Desktop 模式开放为 URL 参数或客户端开关。
- 关闭应用时确保 Next 服务进程退出。

### 第四步：Windows 便携打包

目标产物：

```text
AnimeTrack/
├─ AnimeTrack.exe
├─ resources/
└─ data/
```

第一版优先 ZIP 便携包，不必先做安装器。需要验证：

- 解压到普通可写目录后可直接运行。
- 同目录数据随应用迁移。
- 路径包含中文和空格时可运行。
- 无管理员权限时可运行。
- 关闭后没有残留服务进程。
- 第二次启动能复用数据库并正确执行迁移。

## 12. 下一窗口建议先检查的文件

```text
docs/desktop-development-handoff.md
lib/runtime-mode.ts
lib/runtime-paths.ts
lib/runtime-settings.ts
lib/db.ts
lib/api-response.ts
lib/ai-runtime.ts
app/api/runtime/route.ts
app/api/local-covers/[file]/route.ts
app/api/settings/ai/route.ts
app/api/settings/ai/test/route.ts
app/settings/page.tsx
next.config.mjs
package.json
```

## 13. 建议在新任务中的开场描述

可以直接对新任务说：

> 请先阅读 `docs/desktop-development-handoff.md`，继续 AnimeTrack 单仓库 Web/Desktop 双模式开发。远程封面来源、JSON 迁移备份和 Desktop AI 设置已经完成。请保留全部现有未提交改动，不要 reset、checkout 或清理工作区。下一步先实现正式数据库迁移执行器，然后启用 Next.js standalone 并开始 Electron Windows 便携外壳；本地服务必须只监听 `127.0.0.1`，不要启动浏览器做界面验收，完成后运行类型检查和生产构建。
