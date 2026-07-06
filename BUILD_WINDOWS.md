# Windows 桌面版构建指南

## 前置环境（一次性安装）

### 1. 安装 Node.js
去 https://nodejs.org 下载 LTS 版安装，装完后验证：
```powershell
node --version
npm --version
```

### 2. 安装 Rust
去 https://rustup.rs 下载 rustup-init.exe 安装，默认选项一路下一步，装完后在新的终端验证：
```powershell
rustc --version
cargo --version
```

### 3. 克隆项目
```powershell
git clone <你的仓库地址>
cd animetrack
npm install
```

---

## 日常开发

### 启动网页版（和现在一样）
```powershell
npm run dev
```

### 打包桌面版
```powershell
npm run build:desktop
```

第一次打包会下载编译 Rust 依赖（几百个包），等 5-15 分钟。之后改前端代码再打包就只需要几十秒。

---

## 产出位置

打包完成后在：
```
src-tauri\target\release\bundle\
```

里面会有：
- `msi\` — Windows 安装包（推荐分发）
- `nsis\` — NSIS 安装包（可选语言）
- 便携版需要额外配置

---

## 版本更新

改了代码后：
```powershell
git pull
npm install          # 如果 package.json 没变可以跳过
npm run build:desktop
```

---

## 常见问题

**Q: 报错 `cargo metadata` 找不到？**
A: Rust 没装或者没重启终端。运行 `rustc --version` 验证。

**Q: 报 Tauri 版本不匹配？**  
A: 运行 `npm install` 重新安装依赖。

**Q: 想打便携版（免安装 ZIP）？**
A: `npm run build:desktop` 的产物里已经有，或者在 nsis 目录下找。
