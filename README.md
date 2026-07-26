# AnimeTrack

AnimeTrack 是一个个人动漫记录 Web 应用。它用来管理想看、在看和已看作品，记录观看进度与时间线，并整理封面、标签、声优和首播信息。

在线预览：[anime.zmqaa.com](https://anime.zmqaa.com/)

## 功能

- 动漫库：状态、评分、集数进度、标签及多种筛选和展示方式
- 快速记录：追加观看进度和观看历史
- 数据视图：Dashboard、时间线、季度视图和图谱视图
- 元数据：简介、封面、原名、首播日期、声优等资料维护
- AI 辅助：标题和 Bangumi 元数据补全，支持 OpenAI 兼容接口
- 数据管理：JSON 导入导出、SQL 备份、恢复和定时备份
- 多主题界面和响应式布局
- 支持自定义数据库、备份和封面存储路径

## 本地运行

需要 Node.js 20+。

```bash
git clone https://github.com/zmqaa/AnimeTrack.git
cd AnimeTrack
npm install
cp .env.example .env.local
npm run dev
```

Windows PowerShell 可以用：

```powershell
Copy-Item .env.example .env.local
npm.cmd run dev
```

编辑 `.env.local`，至少设置：

```dotenv
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=替换为随机长字符串
```

SQLite 数据库默认位于 `data/animetrack.db`，不需要额外安装数据库服务。首次运行时：

1. 打开 `http://localhost:3000/setup` 创建数据库并按需导入示例数据。
2. 创建管理员账号：

   ```bash
   npm run user:create-admin -- admin 你的密码 "管理员"
   ```

3. 打开 `http://localhost:3000/login` 登录。

AI 功能是可选的，相关环境变量及说明见 `.env.example`。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动 Web 开发服务 |
| `npm run lint` | 运行 ESLint |
| `npm test` | 运行测试 |
| `npm run build:next` | 执行 Next.js 生产构建 |
| `npm run db:full-backup` | 导出完整 SQL 备份 |
| `npm run db:scheduled-json-backup` | 生成可回导的 JSON 备份并自动轮转 |
| `npm run user:create-admin -- <用户名> <密码> [显示名]` | 创建或更新管理员 |

其他数据库、封面和元数据维护命令见 `package.json`。

## 服务器定时 JSON 备份

`db:scheduled-json-backup` 生成与 Web 页面“导出 JSON”相同格式的完整便携备份，包含总备注和按集数记录的分集随记，默认保存到 `backups/json/`，并保留最近 30 份：

```bash
npm run db:scheduled-json-backup
npm run db:scheduled-json-backup -- --keep 60
```

服务器可以通过 `crontab -e` 每天执行一次。下面示例每天北京时间 03:20 备份；请按实际项目路径和 `npm` 路径调整：

```cron
CRON_TZ=Asia/Shanghai
20 3 * * * cd /home/ubuntu/projects/animetrack && /usr/bin/npm run db:scheduled-json-backup >> /home/ubuntu/projects/animetrack/logs/json-backup.log 2>&1
```

首次配置前先创建日志目录，并手动运行一次命令确认数据库路径和写入权限正确：

```bash
mkdir -p logs
npm run db:scheduled-json-backup
```

可通过 `ANIMETRACK_JSON_BACKUPS_DIR` 修改保存目录，通过 `ANIMETRACK_JSON_BACKUP_KEEP` 修改默认保留份数。JSON 备份包含全部番剧和观看历史，不包含用户账号或本地封面文件。

## 数据与安全

- `data/`、`backups/`、`public/covers/` 和 `.env.local` 均被 Git 忽略。
- 不要把数据库、备份、AI Key 或 `NEXTAUTH_SECRET` 提交到仓库。
- 管理、备份和数据写入操作要求管理员登录。
- 封面优先使用本地缓存，缓存缺失时回退到 `coverUrl` 保存的远程来源。

## 技术栈

Next.js 14、React 18、TypeScript、Tailwind CSS、SQLite、NextAuth.js。

## 项目说明

这是一个长期维护的自用项目。公开仓库主要用于展示、备份代码和持续迭代，线上站点中的个人数据不会随仓库发布。
