# AnimeTrack

AnimeTrack 是一个同时支持 Web 和 Windows 桌面运行的个人动漫记录工具。它用来管理想看、在看和已看作品，记录观看进度与时间线，并整理封面、标签、声优和首播信息。

在线预览：[anime.zmqaa.com](https://anime.zmqaa.com/)

## 功能

- 动漫库：状态、评分、集数进度、标签及多种筛选和展示方式
- 快速记录：追加观看进度和观看历史
- 数据视图：Dashboard、时间线、季度视图和图谱视图
- 元数据：简介、封面、原名、首播日期、声优等资料维护
- AI 辅助：标题和 Bangumi 元数据补全，支持 OpenAI 兼容接口
- 数据管理：JSON 导入导出、SQL 备份、恢复和定时备份
- 多主题界面和响应式布局
- Windows ZIP 便携版，与 Web 版共用同一套业务代码

## Web 本地运行

需要 Node.js 20+。

```bash
git clone https://github.com/zmqqqa/AnimeTrack.git
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

## Windows 桌面版

桌面版是 Electron 外壳加本地 Next.js 服务。它只监听 `127.0.0.1`，不需要单独启动服务器，也不要求登录管理员账号。

从源码启动桌面版：

```bash
npm run desktop:start
```

生成并验证 Windows ZIP 便携包：

```bash
npm run desktop:dist
```

发行包输出到 `dist-electron/AnimeTrack-<version>-win-x64.zip`。解压后直接运行 `AnimeTrack.exe`；数据库、封面、备份、日志和桌面设置保存在 EXE 同级的 `data/` 目录，移动整个目录即可迁移。

桌面版 AI 配置可直接在应用的“设置”页面保存；Web 版 AI 配置仍由服务器环境变量管理。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动 Web 开发服务 |
| `npm run lint` | 运行 ESLint |
| `npm run build:next` | 执行 Next.js 生产构建 |
| `npm run desktop:start` | 构建并启动桌面版 |
| `npm run desktop:pack` | 生成 Windows unpacked 目录 |
| `npm run desktop:dist` | 构建、验证并生成桌面 ZIP |
| `npm run db:full-backup` | 导出完整 SQL 备份 |
| `npm run user:create-admin -- <用户名> <密码> [显示名]` | 创建或更新管理员 |

其他数据库、封面和元数据维护命令见 `package.json`。

## 数据与安全

- `data/`、`backups/`、`public/covers/` 和 `.env.local` 均被 Git 忽略。
- 不要把数据库、备份、AI Key、`NEXTAUTH_SECRET` 或桌面版 `data/` 目录提交到仓库。
- Web 模式要求管理员登录后才能修改数据；桌面模式默认拥有本机管理权限。
- 封面优先使用本地缓存，缓存缺失时回退到 `coverUrl` 保存的远程来源。

## 文档

- [桌面便携版打包设计与实施结果](docs/desktop-packaging-redesign.md)

## 技术栈

Next.js 14、React 18、TypeScript、Tailwind CSS、SQLite、NextAuth.js、Electron。

## 项目说明

这是一个长期维护的自用项目。公开仓库主要用于展示、备份代码和持续迭代，线上站点中的个人数据不会随仓库发布。
