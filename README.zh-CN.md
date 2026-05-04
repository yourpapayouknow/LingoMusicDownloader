# LingoMusicDownloader

一款功能强大的 Apple Music 桌面下载器，支持 AAC、ALAC 无损和 Dolby Atmos 格式。基于 FastAPI 后端与 Flet 桌面前端构建，通过 WSL2 集成实现高级音频格式支持。

---

## 功能特性

| 功能 | 说明 |
|---|---|
| 🎵 **多种格式** | AAC（标准）、ALAC 无损、Dolby Atmos |
| 🔍 **内置搜索** | 直接在应用内搜索歌曲、专辑和 MV |
| 📥 **下载队列** | 实时监控所有下载任务进度 |
| 🖥️ **桌面 UI** | 通过 Flet 实现的原生桌面窗口 |
| 🔧 **WSL2 Wrapper** | 集成 WSL2 服务，用于无损与 Atmos 解密 |
| 🚀 **一键启动** | `launch.ps1` 按正确顺序自动启动全部服务 |

---

## 环境要求

- **Windows 10/11**（64 位）
- **Python 3.10+**
- **WSL2**（Windows Subsystem for Linux 2）—— 下载 ALAC 无损或 Dolby Atmos 时必需
  - 安装方式：以管理员身份运行 `wsl --install`
- **Apple Music 订阅** —— 需要有效的订阅账号
- **Apple Music Cookie** —— 用于 Apple Music 身份认证

---

## 安装步骤

### 1. 克隆仓库

```bash
git clone https://github.com/yourpapayouknow/LingoMusicDownloader.git
cd LingoMusicDownloader
```

### 2. 配置 Python 虚拟环境

```powershell
python -m venv venv
# 直接通过 venv 中的 pip 安装依赖（无需激活环境）
.\venv\Scripts\pip install -r backend\requirements.txt
.\venv\Scripts\pip install -r frontend\requirements.txt
```

> **注意**：不要直接运行 `.\venv\Scripts\Activate.ps1`，Windows 默认禁止运行未签名的 PS1 脚本。
> 如果你希望使用 `activate`，请先执行一次以下命令：
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```

### 3. 配置 WSL2 Wrapper（仅 ALAC / Atmos 需要）

Wrapper 是一个运行在 WSL2 中的 Linux 二进制程序，通过以下命令下载并配置：

```powershell
python backend\utils\setup_wsl.py
```

此脚本将：
- 下载 `wrapper` 二进制文件至 `backend\wsl_wrapper\`
- 通过 WSL2 设置正确的执行权限

> **提示**：如果只需要下载标准 AAC 格式，可跳过此步骤。

### 4. 创建桌面快捷方式（可选）

```powershell
powershell -ExecutionPolicy Bypass -File .\create_shortcut.ps1
```

此命令将在桌面创建 **"LingoMusicDownloader"** 快捷方式，方便一键启动。

---

## 使用方法

### 启动应用

**方式 A —— 桌面快捷方式**（推荐）：
双击桌面上的 **LingoMusicDownloader** 图标。

**方式 B —— 直接运行 PowerShell 脚本**：
```powershell
powershell -ExecutionPolicy Bypass -File .\launch.ps1
```

**方式 C —— 直接运行 Python**（无 Wrapper）：
```powershell
.\venv\Scripts\python.exe run_app.py
```

启动器（`launch.ps1`）按以下顺序启动各服务：
1. **WSL2 Wrapper** —— 在 WSL2 中以最小化窗口启动（端口 10020 / 20020 / 30020）
2. **FastAPI 后端** —— 作为后台线程启动，监听 `http://127.0.0.1:8000`
3. **Flet 前端** —— 打开桌面 UI 窗口

---

### 首次使用：配置 Apple Music Cookie

首次启动（或 Cookie 缺失）时，应用会弹出配置对话框：

1. 在浏览器中打开 [music.apple.com](https://music.apple.com) 并登录。
2. 安装 Cookie 导出扩展，例如 [Cookie-Editor](https://cookie-editor.com/)。
3. 以 **Netscape** 格式导出 Cookie。
4. 将导出内容粘贴到对话框中，点击 **保存并继续**。

Cookie 将保存至项目根目录的 `cookies.txt` 文件中。

---

### 搜索与下载

1. 在搜索框中输入关键词（如 `Taylor Swift Lover`），按 **Enter** 或点击 🔍。
2. 从下拉菜单中选择所需的**音频编解码器**和 **MV 分辨率**。
3. 如需下载 ALAC 或 Atmos，请勾选 **"使用 Wrapper（ALAC/Atmos 需要）"**。
4. 点击结果卡片上的 **Download** 按钮开始下载。
5. 在右侧**下载队列**面板中监控进度。

下载的文件保存至项目根目录的 `Apple Music/` 文件夹中。

---

## 高级格式（ALAC 无损 / Atmos）

下载无损或 Atmos 内容前：

1. 确保 WSL2 已安装并正常运行。
2. 运行 `python backend\utils\setup_wsl.py` 下载 Wrapper 二进制。
3. 通过 `launch.ps1` 启动应用（Wrapper 会自动启动）。
4. 在应用中从编解码器下拉菜单选择 **ALAC 无损** 或 **Dolby Atmos**。
5. 下载前勾选 **"使用 Wrapper（ALAC/Atmos 需要）"**。

---

## 项目结构

```
LingoMusicDownloader/
├── backend/
│   ├── api/            # FastAPI 路由定义
│   ├── core/           # 配置与设置
│   ├── services/       # 下载管理器（gamdl 集成）
│   ├── utils/          # WSL 配置、工具下载工具
│   ├── wsl_wrapper/    # WSL2 Wrapper 二进制（已 git 忽略）
│   └── main.py         # FastAPI 应用入口
├── frontend/
│   ├── assets/         # 图标和图片资源
│   ├── components/     # 可复用 UI 组件
│   ├── utils/          # API 客户端（向后端发起请求）
│   ├── views/          # 页面/视图定义
│   └── main.py         # Flet 应用入口
├── bin/                # ffmpeg、mp4decrypt 二进制（已 git 忽略）
├── run_app.py          # 统一入口（后端线程 + 前端）
├── launch.ps1          # 一键启动脚本（Wrapper → 应用）
└── create_shortcut.ps1 # 在桌面创建 launch.ps1 的快捷方式
```

---

## 依赖项

| 组件 | 库 |
|---|---|
| 后端 API | FastAPI、Uvicorn |
| 下载器 | [gamdl](https://github.com/WorldObservationLog/gamdl) |
| 前端 UI | [Flet](https://flet.dev) |
| HTTP 客户端 | Requests |
| 配置管理 | Pydantic-Settings |

---

## 许可证

MIT 许可证 —— 详见 [LICENSE](LICENSE) 文件。
