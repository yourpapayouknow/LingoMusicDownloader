# LingoMusicDownloader

一款高保真 Apple Music 桌面下载器，采用 FastAPI 后端与 React + Vite + Tauri 前端架构。支持 AAC、ALAC 无损、Dolby/Atmos 能力链路、MV 下载、本地音乐播放、歌词显示，以及可选的自动转码流程。

当前版本：`2.1.1-beta`。

---

## 功能特性

| 功能 | 说明 |
|---|---|
| 多种格式 | AAC、ALAC 无损、Dolby/Atmos 能力链路 |
| MV 下载 | 支持 Apple Music MV 搜索、下载与本地播放 |
| 内置搜索 | 搜索歌曲、专辑、歌手、歌单与 MV |
| 队列与历史 | 实时下载队列 + 专辑分组历史展示 |
| 桌面应用 | 基于 Tauri 的原生桌面容器（自定义主题 UI） |
| 初始化向导 | 首次协议、Cookies 登录、Wrapper 配置入口 |
| 本地播放 | 本地音频播放、LRC 歌词同步、播放列表管理 |
| 可选转码 | AAC/ALAC 自动转码管线（MP3/MP4/FLAC/WAV） |

---

## 环境要求

- Windows 10/11（64 位）
- Python 3.11+
- [uv](https://docs.astral.sh/uv/)（唯一 Python 依赖管理器）
- Node.js 22+
- Rust toolchain（仅在需要自行构建 Tauri 二进制时需要）
- Apple Music 订阅
- WSL2（ALAC/Atmos/MV 等高规格 Wrapper 能力所需）

---

## 安装步骤

### 1. 克隆仓库

```bash
git clone https://github.com/yourpapayouknow/LingoMusicDownloader.git
cd LingoMusicDownloader
```

### 2. 配置 Python 环境（uv）

```powershell
uv sync --locked
```

### 3. 配置前端依赖

```powershell
cd frontend
npm install
cd ..
```

### 4. 准备二进制工具（FFmpeg / mp4decrypt）

大体积二进制文件默认不提交到 Git。请在本地放置以下文件：

- `bin/ffmpeg/ffmpeg.exe`
- `bin/ffmpeg/ffprobe.exe`
- `bin/ffmpeg/ffplay.exe`
- `bin/mp4decrypt.exe`

详细说明见 [bin/README.md](bin/README.md)。

### 5. 可选：准备 Wrapper 运行环境

通过应用内初始化/设置流程安装或重启 Wrapper。若只需要标准 AAC 下载，可不配置 Wrapper。

---

## 使用方法

### 启动应用

方式 A：启动脚本（源码运行推荐）

```powershell
pwsh -NoLogo -NoProfile -File .\launch.ps1
```

方式 B：手动启动后端与 Tauri 开发模式

```powershell
# 终端 1
.\.venv\Scripts\python.exe run_backend.py

# 终端 2
cd frontend
npm run tauri dev
```

方式 C：运行打包后的可执行文件

使用构建产物 `lingo-music-downloader.exe` 的 release 包。

### 首次使用（应用内初始化向导）

首次启动会进入引导流程：

1. 阅读并同意用户协议/免责声明。
2. 打开 Apple Music 登录页并完成 Cookies 获取。
3. 如需高规格能力，继续配置 WSL2 / Wrapper。

后续也可以在设置页重新打开初始化入口。

### 搜索与下载

1. 在搜索页检索歌曲/专辑/歌手/MV。
2. 在设置页选择默认音质与 MV 分辨率。
3. 提交下载任务并在队列中观察状态。
4. 下载完成后自动进入历史/本地库索引。

默认下载目录：`Apple Music/`；可选转码输出目录：`Converted/`。

---

## 测试

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

命令行入口使用 `python -m cli --help` 查看，详见 [cli/README.md](cli/README.md)。

---

## 高级格式（ALAC / Atmos / MV）

1. 确保 WSL2 可用。
2. 在应用内完成 Wrapper 安装/登录。
3. 在设置页启用高品质模式。
4. 若 Wrapper 健康检查失败，下载会直接报错（不再静默降级）。

---

## 项目结构

```
LingoMusicDownloader/
├── backend/
│   ├── api/              # FastAPI 路由与共享状态
│   ├── core/             # 运行时配置
│   ├── db/               # SQLite 设置/历史存储
│   ├── services/         # 下载、元数据、本地库与运行时服务
│   ├── utils/            # 跨层共享工具
│   ├── head.py           # Python 统一外部引用入口
│   └── main.py           # FastAPI 应用入口
├── cli/                  # 核心功能命令行入口
├── frontend/
│   ├── src/              # React 前端源码（head.ts 统一依赖入口）
│   ├── src-tauri/        # Tauri Rust 包装层与配置
│   ├── package.json
│   └── vite.config.ts
├── tests/                # 标准库 unittest 冒烟测试
├── bin/                  # 本地二进制工具目录（占位与说明入库）
├── pyproject.toml        # Python 依赖声明
├── uv.lock               # Python 锁定依赖
├── run_backend.py        # 后端启动入口
└── launch.ps1            # 一体化启动脚本（backend -> desktop app）
```

---

## 依赖项

| 组件 | 库 |
|---|---|
| 后端 API | FastAPI、Uvicorn |
| 下载核心 | [gamdl](https://github.com/glomatico/gamdl) |
| 前端 UI | React、Vite |
| 桌面容器 | Tauri |
| 媒体处理 | FFmpeg、mp4decrypt |

---

## 许可证

MIT 许可证，详见 [LICENSE](LICENSE)。