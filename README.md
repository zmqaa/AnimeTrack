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

## Windows 本地运行

需要先安装 [Node.js 20+](https://nodejs.org/) 和 [Git](https://git-scm.com/)。在 PowerShell 中依次执行：

```powershell
git clone https://github.com/zmqaa/AnimeTrack.git
Set-Location AnimeTrack
npm.cmd install
Copy-Item .env.example .env.local
```

生成一段随机的登录密钥：

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

用记事本打开配置文件：

```powershell
notepad .env.local
```

至少修改下面两项，并把刚生成的随机字符串填入 `NEXTAUTH_SECRET`：

```dotenv
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=替换为随机长字符串
```

AI 功能是可选的，相关环境变量及示例见 `.env.example`。配置完成后创建管理员账号，SQLite 数据库和表会同时自动建立，不需要安装数据库服务：

```powershell
npm.cmd run user:create-admin -- admin '请替换为自己的密码' '管理员'
```

启动 AnimeTrack：

```powershell
npm.cmd run dev
```

保持这个 PowerShell 窗口开启，然后访问：

- `http://localhost:3000/login`：登录管理员账号
- `http://localhost:3000`：打开 AnimeTrack

需要停止时回到 PowerShell 按 `Ctrl+C`。如需导入仓库内的示例数据，可以在开发服务运行期间打开 `http://localhost:3000/setup`；正常使用不需要执行这一步。

如果 PowerShell 提示无法运行 `npm.ps1`，继续使用文档中的 `npm.cmd` 即可，不需要修改系统执行策略。

## Linux 与 macOS 本地运行

需要 Node.js 20+ 和 Git：

```bash
git clone https://github.com/zmqaa/AnimeTrack.git
cd AnimeTrack
npm install
cp .env.example .env.local
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

编辑 `.env.local`，填写正确的 `NEXTAUTH_URL`、刚生成的 `NEXTAUTH_SECRET`，并按需配置 AI。随后执行：

```bash
npm run user:create-admin -- admin '请替换为自己的密码' '管理员'
npm run dev
```

SQLite 数据库默认保存在 `data/animetrack.db`。打开 `http://localhost:3000/login` 登录；需要停止时按 `Ctrl+C`。

## Ubuntu 服务器部署

生产环境的完整部署、域名、HTTPS、后台运行、升级和备份说明见：

[Ubuntu 服务器部署指南](docs/ubuntu-deployment.md)

## 中国大陆网络说明

AnimeTrack 的 Bangumi 元数据和封面请求由运行 AnimeTrack 的服务器发起，而不是由浏览器直接请求。

- 部署在能够正常访问 Bangumi 的海外服务器时，元数据和封面功能可以直接使用，用户浏览器不需要配置代理。
- 部署在中国大陆的本地电脑或服务器时，需要确保运行 AnimeTrack 的 Node.js 进程能够访问 `api.bgm.tv` 和 `lain.bgm.tv`。最简单的方式通常是开启代理软件的 TUN 模式，再启动 AnimeTrack。
- 仅开启浏览器代理可能无效，因为 AI 录入、资料补充和封面下载都由 Node.js 服务端执行。
- 无法访问 Bangumi 时，手动添加和已有记录管理仍可使用，但 AI 录入与资料补充可能无法取得完整元数据和封面。
- AI API 与 Bangumi 是两条独立连接。AI API 可以访问，不代表 Bangumi 一定可以访问；反之亦然。

可以在运行 AnimeTrack 的设备上测试基础连通性。Linux、macOS 或 Git Bash：

```bash
curl -sS -o /dev/null -w "HTTP %{http_code} 连接 %{time_connect}s 总计 %{time_total}s\n" https://api.bgm.tv
curl -sS -o /dev/null -w "HTTP %{http_code} 连接 %{time_connect}s 总计 %{time_total}s\n" https://lain.bgm.tv
```

Windows CMD 或 PowerShell：

```powershell
curl.exe -sS -o NUL -w "HTTP %{http_code} 连接 %{time_connect}s 总计 %{time_total}s\n" https://api.bgm.tv
curl.exe -sS -o NUL -w "HTTP %{http_code} 连接 %{time_connect}s 总计 %{time_total}s\n" https://lain.bgm.tv
```

返回 400、404 或 405 等 HTTP 状态不代表连接失败；只要不是 DNS、TLS 或连接超时，通常就说明目标域名至少可以连接。AnimeTrack 不提供公共代理或 Bangumi 中转节点。

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

`db:scheduled-json-backup` 生成与 Web 页面“导出 JSON”相同格式的完整便携备份，包含总备注和按集数记录的分集随记，默认保存到 `backups/json/`，并保留最近 10 份：

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

可通过 `ANIMETRACK_JSON_BACKUPS_DIR` 修改保存目录，通过 `ANIMETRACK_JSON_BACKUP_KEEP` 修改默认保留份数。JSON 备份包含全部番剧、观看历史和漫画，不包含用户账号或本地封面文件。

## 数据与安全

- `data/`、`backups/`、`public/covers/` 和 `.env.local` 均被 Git 忽略。
- 不要把数据库、备份、AI Key 或 `NEXTAUTH_SECRET` 提交到仓库。
- 管理、备份和数据写入操作要求管理员登录。
- 封面优先使用本地缓存，缓存缺失时回退到 `coverUrl` 保存的远程来源。

## 技术栈

Next.js 14、React 18、TypeScript、Tailwind CSS、SQLite、NextAuth.js。

## 项目说明

这是一个长期维护的自用项目。公开仓库主要用于展示、备份代码和持续迭代，线上站点中的个人数据不会随仓库发布。
