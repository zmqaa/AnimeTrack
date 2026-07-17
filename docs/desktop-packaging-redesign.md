# AnimeTrack 桌面便携版打包重构设计

状态：核心方案与应用图标已实施  
日期：2026-07-17

## 1. 结论

AnimeTrack 不需要拆成两个独立仓库，也不需要制作安装器。

推荐继续保留一套 Next.js 业务代码和一个轻量 Electron 外壳，但把桌面发行目标从“portable 单文件 EXE”改成“ZIP 目录便携版”：

```text
AnimeTrack-win-x64.zip
└─ AnimeTrack/
   ├─ AnimeTrack.exe
   ├─ resources/
   └─ data/                 # 首次启动后自动生成
      ├─ animetrack.db
      ├─ settings.json      # 首次保存设置后生成
      ├─ backups/
      ├─ covers/
      └─ logs/
```

用户解压 ZIP 后双击 `AnimeTrack.exe` 即可使用。应用不写注册表，不要求管理员权限，不创建系统服务，整个目录可以一起移动或备份。

## 2. 当前状态判断

### 2.1 体积并非主要问题

当前产物 `AnimeTrack-1.0.0-portable.exe` 约为 166 MB。对于同时包含 Chromium、Electron、Next.js 服务端和 SQLite 原生模块的应用，这个数量级正常。

本轮优化不应把“尽可能缩小 EXE”作为第一目标。更值得解决的是构建过程复杂、职责重复和首次运行语义不清晰。

### 2.2 当前构建链路过于曲折

现有桌面打包大致经过：

1. 执行 Next.js standalone 构建。
2. 把静态文件、`public`、数据库资源和脚本补进 standalone。
3. 编译 Electron 主进程。
4. 把 standalone 再复制到 `dist-desktop`。
5. 将 `node_modules` 重命名为 `server_node_modules`。
6. 把根目录原生依赖重编译为 Electron ABI。
7. 多次复制 `better-sqlite3` 和 `bcrypt`。
8. electron-builder 打包。
9. 再把根目录原生依赖恢复为 Node ABI。
10. 清理部分中间产物。

主要问题不是步骤多本身，而是构建会临时修改开发环境中的原生依赖。构建失败或中断时，根目录 `node_modules` 可能停留在错误 ABI，后续 Web 开发和桌面运行会互相影响。

此外，`prepare-standalone.js`、`prepare-package-standalone.js`、`sync-native-modules.js`、`after-pack.js` 和 `package-electron.js` 之间存在职责重叠。

### 2.3 数据库已经具备自动创建能力

桌面主进程启动时会先创建 `data/`、`backups/`、`covers/` 和 `logs/`。本地 Next.js 服务的健康检查会打开 `data/animetrack.db`，执行 `database/schema.sql` 和尚未执行的迁移。

因此首次双击时已经可以自动完成“创建空数据库 + 建表 + 迁移”，无需提前在 ZIP 中放置数据库，也不需要用户点击初始化按钮。

当前 `/setup` 页面做的主要是导入 `seed_anime_data.sql`，它更接近“导入示例数据”，不应继续与数据库初始化混为一谈。

## 3. 产品行为设计

### 3.1 推荐的首次启动行为

1. 用户解压 ZIP。
2. 用户双击 `AnimeTrack.exe`。
3. 应用在 EXE 同级自动创建 `data/`。
4. 应用创建空的 `animetrack.db`，执行 schema 和迁移。
5. 应用直接打开首页，展示空状态和“添加第一部动画”的入口。
6. 用户按需配置 AI，配置写入 `data/settings.json`。

这是个人数据工具最自然的默认行为：应用负责准备结构，但不擅自写入示例或作者自己的数据。

### 3.2 示例数据与初始化分离

建议定义三个独立概念：

- 数据库初始化：应用内部自动完成，不需要 UI。
- 首次使用引导：可选 UI，用于解释数据目录、备份和 AI 设置。
- 示例数据导入：显式操作，用户主动选择后才执行。

后续可以把 `/setup` 改造成桌面首次使用引导，也可以直接移除其桌面职责。第一阶段打包重构不依赖这项界面修改。

### 3.3 数据目录规则

桌面便携版继续使用：

```text
<exe 所在目录>/data
```

优点：

- 整个目录复制到另一台电脑即可迁移。
- 用户很容易找到数据库和备份。
- 不依赖 `%APPDATA%`。
- 删除整个目录即可完整卸载。

限制：

- 不应放进 `C:\Program Files` 等普通用户不可写目录。
- 不建议直接在 ZIP 内双击运行，必须先完整解压。
- 应在 README 中说明不要只复制 EXE，必须保留 `resources/`。

若目录不可写，应用应在启动阶段给出明确错误，而不是等数据库操作失败后显示模糊的服务启动错误。

## 4. 新打包目标

### 4.1 使用 ZIP target，停止使用 portable target

electron-builder 的 `portable` target 表示“单文件便携可执行程序”，运行时仍需要自解压。它不是本项目真正想要的形态。

新目标应为 electron-builder 的 Windows `zip` target，或者先生成 unpacked 目录再由构建脚本压缩。优先使用 `zip` target，减少自维护逻辑。

发布产物建议命名为：

```text
AnimeTrack-1.0.0-win-x64.zip
```

### 4.2 产物中不携带运行时数据

ZIP 中不包含开发数据库、WAL、备份、本地封面、日志或 AI 设置。

`data/` 可以完全不打包，由首次启动创建。这样也避免空目录在 ZIP 工具之间表现不一致。

应继续打包以下只读资源：

- Next.js standalone 服务。
- `.next/static`。
- 必要的 `public` 静态资源，但不包含 `public/covers` 缓存。
- `database/schema.sql`。
- `database/migrations/*.sql`。
- 如果仍保留示例导入功能，则包含 `database/seed_anime_data.sql`。

## 5. 构建重构方案

### 5.1 期望命令

保留少量、语义清晰的入口：

```text
npm run desktop:dev       # 本地桌面开发/验证
npm run desktop:build     # 构建并准备 staging 目录
npm run desktop:dist      # 生成最终 ZIP
npm run desktop:verify    # 验证产物结构和原生模块
```

`desktop:dist` 最终应顺序执行构建、staging、打包和验证，不再要求开发者手动调用中间命令。

### 5.2 单一 staging 阶段

把现有多个准备脚本合并成一个职责明确的 staging 脚本：

```text
scripts/desktop/prepare-staging.js
```

它只负责：

1. 校验 `.next/standalone/server.js` 存在。
2. 清空并创建 `dist-desktop/standalone`。
3. 复制 standalone、`.next/static`、必要的 `public` 和数据库资源。
4. 明确排除个人数据与缓存。
5. 输出 staging 清单和大小。

不在该脚本中调用 electron-builder，也不修改根目录依赖。

### 5.3 原生模块隔离

目标是打包过程不再把项目根目录中的 `bcrypt` 和 `better-sqlite3` 在 Node ABI 与 Electron ABI 之间来回切换。

建议分两步实施：

第一步：将 `bcrypt` 替换为纯 JavaScript 的 `bcryptjs`。它只用于 Web 登录密码校验，桌面模式本身不需要登录。这样桌面产物只剩 `better-sqlite3` 一个必须处理的原生模块。

第二步：仅在 staging 目录内为目标 Electron 版本重建 `better-sqlite3`，根目录 `node_modules` 始终保持开发所需的 Node ABI。可以使用隔离的 rebuild 工作目录或缓存目录，但不得原地修改根依赖后再“恢复”。

如果第二步受 Next.js output tracing 结构限制，可以先保留一个简化的复制脚本，但仍应让 Electron ABI 文件来自独立缓存，而不是根依赖的临时状态。

### 5.4 删除重复职责

重构完成后，预计可以删除或合并：

- `scripts/desktop/prepare-standalone.js`
- `scripts/desktop/prepare-package-standalone.js`
- `scripts/desktop/sync-native-modules.js`
- `scripts/desktop/after-pack.js`
- `scripts/desktop/package-electron.js`

最终是否全部删除取决于原生模块隔离方案，但至少不应再同时存在“打包前同步”和 `afterPack` 二次同步。

### 5.5 package.json 职责

本阶段不引入 monorepo，也不拆仓库。只整理根 `package.json`：

- Web 依赖继续作为正式 dependencies。
- Electron 和打包工具继续作为 devDependencies。
- electron-builder 配置切换到 ZIP target。
- 打包文件清单只引用编译后的 Electron 主进程和 prepared standalone。
- 对 staging 目录使用显式包含清单，避免构建缓存被 output tracing 意外带入。

等桌面原生功能明显增加后，再评估 `apps/web`、`apps/desktop` workspace 结构。当前为了解决打包脚本而迁移 monorepo，收益不足以覆盖改造成本。

## 6. 验证与验收

### 6.1 静态与构建验证

- TypeScript 类型检查通过。
- Next.js production build 通过。
- Electron 主进程编译通过。
- staging 中不存在开发数据库、WAL、备份、封面缓存、日志和 `.env`。
- ZIP 中不存在 `.next/cache` 和无关开发依赖。

### 6.2 产物验证

- 解压到含中文和空格的普通目录可启动。
- 无管理员权限可启动。
- 首次启动自动生成 `data/animetrack.db`。
- 首次启动生成的数据库包含完整 schema 和 migration 记录。
- 第二次启动复用原数据库，不重复导入任何数据。
- `better-sqlite3` 能在打包后的 Electron/Node 运行时加载。
- 关闭窗口后本地 Next.js 子进程退出。
- 移动整个解压目录后仍能启动并读取随目录移动的数据。
- 删除 `data/` 后再次启动，可以重新创建干净数据库。
- ZIP 解压后，直接删除整个目录即可完成卸载。

按照项目约定，代码修改阶段优先进行类型检查和生产构建；最终 EXE 的实际双击验收由用户在本机完成。

## 7. 实施顺序

### 阶段 A：发行形态简化

- 将 target 从 `portable` 改为 `zip`。
- 统一产物命名。
- 明确排除 `data/` 和缓存。
- 增加产物结构验证。

这是风险最低、最先产生用户价值的一步。

### 阶段 B：构建脚本收敛

- 合并 standalone 准备脚本。
- 去掉重复复制和重复 native sync。
- 统一日志与失败清理。
- 更新 npm scripts 和桌面开发文档。

### 阶段 C：原生依赖隔离

- 评估并迁移到 `bcryptjs`。
- 在 staging 或独立缓存内重建 `better-sqlite3`。
- 移除“构建后恢复根 node_modules”的逻辑。

这是降低维护风险最关键的一步，但需要对打包后的原生模块做真实启动验证。

### 阶段 D：首次使用体验

- 将数据库初始化、示例数据导入和首次使用引导拆分。
- 空库首页提供明确的第一步入口。
- 需要时增加“导入示例数据”按钮，但默认不执行。

这属于产品体验优化，不应阻塞打包链路重构。

## 8. 本轮不做

- 不制作 MSI、NSIS 等安装器。
- 不增加注册表、开机启动、系统服务或桌面快捷方式。
- 不拆成两个仓库。
- 不为了减少几十 MB 改写现有 Next.js 应用。
- 不把个人数据库或 AI Key 打进发布包。
- 不自动导入作者的真实数据。
- 不在第一阶段加入自动更新。

## 9. 决策摘要

| 事项 | 决策 |
| --- | --- |
| 仓库结构 | 继续单仓库 |
| Web/Desktop 业务代码 | 继续共用 |
| Windows 发行格式 | ZIP 目录便携版 |
| 安装器 | 不做 |
| 数据目录 | EXE 同级 `data/` |
| 数据库创建 | 首次双击自动创建 |
| 默认数据 | 空库，不自动导入示例 |
| 首次引导 | 后续独立优化 |
| 构建重构重点 | 单一 staging、原生依赖隔离、删除重复脚本 |
| 体积优化优先级 | 低于可靠性和可维护性 |

## 10. 实施结果

2026-07-17 已完成：

- Windows target 从 `portable` 改为 `zip`。
- 最终产物为 `dist-electron/AnimeTrack-1.0.0-win-x64.zip`。
- standalone staging 收敛为 `scripts/desktop/prepare-staging.js`。
- staging 内独立重建 `better-sqlite3`，根目录 Node ABI 不再被修改。
- 登录和管理员创建脚本从原生 `bcrypt` 迁移为 `bcryptjs`。
- electron-builder 禁用自动依赖重建，只打包 Electron 外壳和 prepared standalone。
- 删除原有五个重复的准备、同步和 afterPack 脚本。
- 增加 staging 结构、原生模块、最终 ZIP 和 unpacked 目录验证。
- ZIP 验证成功后自动清理 unpacked、中间 staging、构建缓存和旧版本发行包，只保留最新 ZIP。
- 已生成包含 16、24、32、48、64、128、256 像素层级的 Windows ICO，并接入 electron-builder。
- 同一图标已生成 Next.js favicon 与 Apple touch icon。
- staging 大小约 33.1 MB；ZIP 大小约 150.0 MB。
- `app.asar` 约 12 KB，确认没有把 Web 依赖重复打进 Electron 外壳。

当前命令：

```bash
npm run desktop:start   # 构建后启动桌面开发版本
npm run desktop:pack    # 生成 win-unpacked 目录
npm run desktop:dist    # 构建、验证并生成 ZIP
npm run desktop:verify  # 单独验证 staging 和 Electron 原生模块
npm run desktop:clean:dist # 单独清理已验证发行流程留下的中间产物
```

尚未完成：

- 首次使用引导与示例数据导入的产品体验拆分。
- 由用户实际双击 EXE 验收窗口、首次数据库创建和目录移动场景。
