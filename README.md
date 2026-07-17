# AnimeTrack

一个自用的动漫记录站，用来整理看过、在看和想看的动画，也会顺手记录进度、时间线和一些元数据。

在线预览：https://anime.zmqaa.com/

## 主要功能

- 记录观看状态、集数进度和历史
- 查看时间线、季度视图和简单统计
- 管理封面、简介、标签、声优、首播日期等资料
- 用 AI 辅助补全标题和元数据

## 快速开始

需要 Node.js 20+。数据默认保存在本地 SQLite 文件 `data/animetrack.db`，不需要单独安装数据库服务。

```bash
git clone https://github.com/zmqqqa/AnimeTrack.git
cd AnimeTrack
npm install
cp .env.example .env.local
# 编辑 .env.local，至少设置 NEXTAUTH_URL 和随机的 NEXTAUTH_SECRET
npm run dev
```

然后浏览器打开 `http://localhost:3000/setup`，点一键初始化。初始化完成后，在另一个终端创建管理员账号：

```bash
npm run user:create-admin -- admin 你的强密码 "管理员"
```

再打开 `http://localhost:3000/login` 登录。


## 说明

- 这是一个长期自用项目，公开仓库以展示和浏览为主
- 线上站点主要用于我自己的追番记录和整理

## 技术栈

Next.js 14 / React 18 / TypeScript / Tailwind CSS / SQLite / NextAuth.js

## 封面来源补充

封面使用两个字段：`coverUrl` 保存 Bangumi 等远程来源地址，`localCoverUrl`
保存下载后的本地缓存地址。页面优先显示本地缓存，本地缓存不存在时回退到远程地址。

旧数据如果只有本地封面，可以先预览批量匹配结果：

```bash
npm run covers:restore-sources -- --limit=10
```

确认匹配正确后再写入数据库：

```bash
npm run covers:restore-sources:write
```

也可以用 `--ids=1,2,3` 只处理指定记录。脚本默认不会覆盖已有的 `coverUrl`。
