# AnimeTrack Ubuntu 服务器部署指南

本文面向使用 Ubuntu 和域名部署 AnimeTrack 的用户。示例使用：

- 项目目录：`/home/你的用户名/AnimeTrack`
- 站点域名：`anime.example.com`
- AnimeTrack 内部端口：`3000`

请把示例用户名、域名和密码替换成自己的值。不要直接照搬 `anime.example.com`。

## 1. 准备环境

服务器需要：

- Node.js 20 或更高版本
- Git
- `rsync`
- `curl`
- Nginx
- PM2（让程序在退出终端后继续运行）

先确认 Node.js 和 npm 版本：

```bash
node -v
npm -v
```

如果 Node.js 低于 20，请先通过 Node.js 官方提供的方式安装新版本。然后安装其余系统工具和 PM2：

```bash
sudo apt update
sudo apt install -y git rsync curl nginx
sudo npm install -g pm2
```

## 2. 下载项目

```bash
cd /home/你的用户名
git clone https://github.com/zmqaa/AnimeTrack.git
cd AnimeTrack
npm ci
cp .env.example .env.local
```

## 3. 配置环境变量

生成随机登录密钥：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

编辑配置：

```bash
nano .env.local
```

至少设置：

```dotenv
NEXTAUTH_URL=https://anime.example.com
NEXTAUTH_SECRET=替换为刚生成的随机长字符串
```

需要使用 AI 录入和资料补充时，再填写：

```dotenv
AI_API_KEY=你的_API_Key
AI_API_URL=https://你的服务商提供的完整地址/chat/completions
AI_MODEL=你的模型名称
```

保存文件时，在 nano 中按 `Ctrl+O`、回车，再按 `Ctrl+X`。

## 4. 创建管理员

下面的命令会自动创建 SQLite 数据库和数据表，不需要安装 MySQL、PostgreSQL 等数据库：

```bash
npm run user:create-admin -- admin '请替换为自己的密码' '管理员'
```

数据库默认保存在 `data/animetrack.db`。管理员密码不要使用示例内容，也不要把 `.env.local`、数据库或备份提交到 Git。

正式启动会自动把 `.env.local`、数据库及备份的权限收紧为仅当前 Ubuntu 账号可访问。需要单独检查或修复现有文件时，可执行：

```bash
npm run security:harden-files
```

## 5. 首次启动

项目的正式部署命令会：

1. 检查 Git 工作区是否干净。
2. 拉取 `origin/main` 的最新提交。
3. 在隔离目录中执行生产构建。
4. 使用临时端口启动候选版本。
5. 检查健康状态和静态资源。
6. 检查通过后切换版本并启动 PM2。
7. 保留当前、回滚版本和最近 5 个 release，清理更早的构建产物。

执行：

```bash
npm run deploy:prod
```

确认程序状态：

```bash
pm2 status
curl http://127.0.0.1:3000/api/health
```

健康接口正常返回后，保存 PM2 进程列表：

```bash
pm2 save
pm2 startup
```

`pm2 startup` 会输出一条以 `sudo` 开头的命令。复制并执行它，然后再次运行：

```bash
pm2 save
```

不要把 3000 端口直接开放到公网，后面由 Nginx 转发访问。

## 6. 配置 Nginx

创建站点配置：

```bash
sudo nano /etc/nginx/sites-available/animetrack
```

写入以下内容，并替换域名：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name anime.example.com;

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_buffering off;
        proxy_read_timeout 300s;
    }
}
```

启用配置并检查语法：

```bash
sudo ln -s /etc/nginx/sites-available/animetrack /etc/nginx/sites-enabled/animetrack
sudo nginx -t
sudo systemctl reload nginx
```

如果 `/etc/nginx/sites-enabled/animetrack` 已经存在，不要重复创建软链接。先确保域名的 DNS 记录已经指向这台服务器，再访问：

```text
http://anime.example.com
```

## 7. 配置 HTTPS

安装 Certbot：

```bash
sudo apt install -y certbot python3-certbot-nginx
```

申请证书并让 Certbot 自动修改 Nginx 配置：

```bash
sudo certbot --nginx -d anime.example.com
```

证书签发成功后，可以使用仓库内的完整入口模板替换第 6 节的基础配置。模板包含安全响应头、20MB 上传限制、代理超时、流式响应支持，以及登录、AI、导入和恢复入口的适度限流。先在项目目录验证模板：

```bash
npm run nginx:check-example
```

再复制配置；这些命令不会自动执行，已有站点配置应先自行备份和对比：

```bash
sudo install -m 0644 config/nginx/animetrack-rate-limits.conf.example /etc/nginx/conf.d/animetrack-rate-limits.conf
sudo install -m 0644 config/nginx/animetrack-proxy.conf.example /etc/nginx/snippets/animetrack-proxy.conf
sudo install -m 0644 config/nginx/animetrack-security.conf.example /etc/nginx/snippets/animetrack-security.conf
sudo install -m 0644 config/nginx/animetrack-site.conf.example /etc/nginx/sites-available/animetrack
sudo nano /etc/nginx/sites-available/animetrack
```

必须把 `anime.example.com` 和两条证书路径替换为实际值。模板默认 Nginx 是直接面向公网的入口，此时 `$remote_addr` 就是真实客户端地址。如果前面还有 Cloudflare 等 CDN，应只信任服务商公布的 IP 段并配置 `real_ip_header`，不要直接信任任意请求传入的 `X-Forwarded-For`。

应用前检查语法，再平滑重载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

限流只覆盖低频高成本入口，触发时返回 HTTP 429；普通页面浏览不受影响。AI 快速录入关闭代理缓冲并保留 300 秒读取超时，以便 NDJSON（逐行 JSON）进度流及时到达浏览器。CSP（内容安全策略）允许 HTTP(S) 远程封面，但脚本、接口连接和表单仍限制在本站。

完成后确认：

```text
https://anime.example.com/login
```

建议依次人工确认：首页与封面、管理员登录、AI 快速录入进度、JSON 导入导出、SQL 备份下载和恢复。响应头可用以下命令抽查：

```bash
curl -sSI https://anime.example.com/login | grep -Ei 'strict-transport-security|content-security-policy|x-content-type-options|referrer-policy'
```

如果此前在 `.env.local` 中临时填写了 HTTP 地址，请改为最终的 HTTPS 地址并重新部署。

## 8. 中国大陆网络

Bangumi 元数据和封面请求由这台服务器发起：

- 海外服务器能够访问 `api.bgm.tv` 和 `lain.bgm.tv` 时，用户浏览器不需要代理。
- 中国大陆服务器需要具备可用的出站代理或 TUN 网络，否则手动添加仍可使用，但 AI 录入与资料补充可能无法取得完整元数据和封面。

可以在服务器上执行：

```bash
curl -sS -o /dev/null -w "HTTP %{http_code} 连接 %{time_connect}s 总计 %{time_total}s\n" https://api.bgm.tv
curl -sS -o /dev/null -w "HTTP %{http_code} 连接 %{time_connect}s 总计 %{time_total}s\n" https://lain.bgm.tv
```

HTTP 400、404 或 405 等状态不代表网络不通；DNS、TLS 或连接超时才通常表示连接存在问题。

## 9. 更新版本

先确认没有在服务器仓库中直接修改代码：

```bash
git status
```

然后更新依赖并执行安全发布：

```bash
git pull --ff-only
npm ci
npm run deploy:prod
```

部署脚本会先检查候选版本，失败时不会直接覆盖正在运行的版本。生产部署要求 Git 工作区干净。

成功部署后会自动清理旧的 `.deploy` 构建产物，默认保留最近 5 个 release，并始终保护当前版本、上一个回滚版本和刚构建版本。可先只读预览清理范围：

```bash
npm run deploy:cleanup
```

确认后手动执行清理：

```bash
npm run deploy:cleanup:apply
```

如需增加保留数量，可在部署时设置 `DEPLOY_RELEASE_KEEP`，允许范围为 2 到 50。失败构建的源码目录会保留用于排查，下一次成功部署后自动清理；仍被 `build.lock` 使用的目录不会删除。

## 10. 备份

手动生成可回导的 JSON 备份：

```bash
npm run db:scheduled-json-backup
```

默认数据库、封面和备份目录分别是：

```text
data/
public/covers/
backups/
```

至少应定期备份 `data/animetrack.db` 和 `public/covers/`。完整 JSON 备份默认写入 `backups/json/`，不包含管理员账号和本地封面文件。

需要生成便于数据库维护的完整 SQL 时，可执行：

```bash
npm run db:full-backup
```

该命令不导出 `users` 表，恢复时保留目标数据库已有账号。使用 `npm run db:apply-sql -- <备份文件>` 恢复即可；如果管理员账号丢失，执行 `npm run user:create-admin -- <用户名> <密码> [显示名]` 重新创建。JSON 便携备份同样不包含账号。

## 常见问题

### `npm run deploy:prod` 提示 Git 工作区不干净

先执行：

```bash
git status
```

不要直接删除不认识的文件或改动。确认它们的来源并妥善保存后，再进行生产部署。

### 访问域名出现 502

检查 AnimeTrack 和 Nginx：

```bash
pm2 status
pm2 logs anime-track --lines 100
curl http://127.0.0.1:3000/api/health
sudo nginx -t
```

### AI 功能不可用

检查 `.env.local` 中的 `AI_API_KEY`、完整 `AI_API_URL` 和 `AI_MODEL`。登录管理员账号后，也可以在设置页执行 AI 连接测试。

### Bangumi 资料或封面无法获取

在服务器上测试 `api.bgm.tv` 和 `lain.bgm.tv`。AI API 可用不代表 Bangumi 网络一定可用。
