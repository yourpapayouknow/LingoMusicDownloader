![LingoMusic](assets/readme-badge.png)

# LingoMusicDownloader

<p align="center">
  <img alt="后端-Python 3.11" src="https://img.shields.io/badge/%E5%90%8E%E7%AB%AF-Python%203.11-3776AB?logo=python&logoColor=white">
  <img alt="后端-FastAPI" src="https://img.shields.io/badge/%E5%90%8E%E7%AB%AF-FastAPI-009688?logo=fastapi&logoColor=white">
  <img alt="前端-React 19" src="https://img.shields.io/badge/%E5%89%8D%E7%AB%AF-React%2019-61DAFB?logo=react&logoColor=black">
  <img alt="前端-TypeScript 6" src="https://img.shields.io/badge/%E5%89%8D%E7%AB%AF-TypeScript%206-3178C6?logo=typescript&logoColor=white">
  <img alt="前端-Vite 8" src="https://img.shields.io/badge/%E5%89%8D%E7%AB%AF-Vite%208-646CFF?logo=vite&logoColor=white">
  <img alt="桌面-Tauri 2" src="https://img.shields.io/badge/%E6%A1%8C%E9%9D%A2-Tauri%202-24C8DB?logo=tauri&logoColor=white">
  <img alt="平台-Windows 10/11" src="https://img.shields.io/badge/%E5%B9%B3%E5%8F%B0-Windows%2010%2F11-0078D4?logo=windows&logoColor=white">
</p>

面向Windows的林檎音乐高保真桌面下载器，支持ALAC与Dolby下载、一键转码和CLI调用。

## 功能特性

| 能力 | 说明 |
| --- | --- |
| 曲库搜索 | 按关键词检索歌曲、专辑、歌手、MV与歌单，支持直接粘贴分享链接 |
| 多规格下载 | AAC、ALAC、**ALAC Hi-res**、Dolby；非AAC规格**依赖解密组件** |
| MV下载 | 1080p高清与4K超高清，下载后可在下载文件夹中查看 |
| 队列与历史 | 专辑与歌单分组、逐曲状态、失败提示、历史记录与本地重扫 |
| 本地播放 | 本地与试听音源、LRC歌词同步、播放列表、随机与单曲循环 |
| 可选转码 | AAC→MP3/MP4/标准AAC；ALAC→FLAC/WAV/MP4 |
| 元数据地区 | 跟随账号，或从28个地区中选择标签语言与商店 |
| 双入口 | 桌面GUI与CLI |

> [!IMPORTANT]
> 下载内容仅限**个人学习与研究**，禁止用于商业或侵权用途。使用前请确保拥有有效的账户订阅；下载内容请**在24小时内删除**。完整声明见应用内「关于 → 使用声明」。

## 快速开始

将以下内容发送给AI编程助手：

```text
帮我安装这个仓库并启动LingoMusic Downloader：https://github.com/yourpapayouknow/LingoMusicDownloader
```

## 传统开始

### 环境要求

| 组件 | 要求 |
| --- | --- |
| 操作系统 | Windows10/11（64bit） |
| PowerShell | 7.0+ |
| Python | 3.11+ |
| uv | 最新版，安装见[uv文档](https://docs.astral.sh/uv/) |
| Node.js | 22.13+ |
| Rust | 源码构建时需要 |
| FFmpeg | 需自行准备 |
| 林檎音乐 | 有效订阅与可登录账号 |
| WSL2 | 机载版本 |

> [!NOTE]
> 标准AAC下载、队列、历史、本地播放、歌词与转码不依赖WSL2。

### 1. 获取代码

```powershell
git clone https://github.com/yourpapayouknow/LingoMusicDownloader.git
cd LingoMusicDownloader
```

### 2. 安装依赖

```powershell
uv sync --locked

cd frontend
npm install
cd ..
```

### 3. 准备二进制工具

安装命令：

```powershell
pwsh -NoLogo -NoProfile -File .\bin\install.ps1
```


| 文件 | 用途 |
| --- | --- |
| `bin/ffmpeg/ffmpeg.exe` | 转码、MV封装、ALAC/杜比本地播放解码 |
| `bin/ffmpeg/ffprobe.exe` | 探测音频编码与规格 |
| `bin/mp4decrypt.exe` | MV解密 |

二进制说明：[bin/README.md](bin/README.md)。

### 4. 启动应用

一键启动脚本：

```powershell
pwsh -NoLogo -NoProfile -File .\launch.ps1
```

启动时按需创建`.venv`、同步Python依赖、安装前端依赖、检查8000端口、启动后端并打开桌面应用。已有`frontend/src-tauri/target/release/lingo-music-downloader.exe`时直接复用，否则使用`npm run tauri dev`。

手动启动（两个终端）：

```powershell
# 终端1：后端
.\.venv\Scripts\python.exe run_backend.py
```

```powershell
# 终端2：桌面端
cd frontend
npm run tauri dev
```

桌面快捷方式：

```powershell
pwsh -NoLogo -NoProfile -File .\create_shortcut.ps1
```

### 5. 首次配置

1. 首次启动会显示用户协议；滚动到底部后才能点击「同意并下一页」。
2. 点击「登录」在应用内完成账户登录，登录凭据保存到`cookies.txt`。
3. 按需安装WSL2与解密组件；可先选择「仍然进入」，之后在设置页重新打开初始化向导。
4. 在设置页选择下载音质、MV画质、元数据地区与存储位置。

默认下载目录与`Converted/`转码目录可在设置 → 存储位置修改。

### 6. 启用高品音质

ALAC、杜比全景声与MV高画质需要解密组件：

1. 在设置页或初始化向导中安装WSL2（**约15GB**，优先使用D盘）。应用内安装需要管理员权限与`gsudo`；未安装`gsudo`时先运行`wsl --install`。
2. 安装解密组件并使用独立的账号登录；如启用两步验证，按提示输入验证码。
3. 在设置页打开「高品音质下载」并选择ALAC或杜比全景声。

> [!WARNING]
> 未安装或未启动解密组件时，高品音质选项会被禁用。安装状态与进度见设置页，详细日志见安装弹窗。

## 使用指南

### 搜索与下载

- 在搜索框输入关键词或直接粘贴分享链接，按Enter或点击「搜索」。
- 使用「全部 / 曲目 / 专辑 / 歌手 / MV」筛选结果；点击「下载」后可确认任务信息。
- 下载任务每3秒刷新一次；专辑与歌单按曲目展开，失败任务标记状态。
- 完成后可在「下载」页打开文件夹；曲目还可播放本地文件或加入播放列表。

### 本地播放与歌词

- 顶栏播放器支持播放/暂停、上一首/下一首、进度、音量、随机与单曲循环。
- 本地曲目从`data/lingo.db`索引读取，歌词使用同名`.lrc`文件。
- 快捷键：Space播放/暂停；Esc依次关闭歌词面板与播放列表面板。

### 设置

| 设置项 | 说明 |
| --- | --- |
| 音频品质 | AAC标准、ALAC无损（24-bit/192kHz Max）、杜比全景声 |
| MV画质 | 1080p或4K（Max） |
| 元数据地区 | 跟随账号，或选择28个地区之一 |
| 转码 | AAC→MP3/MP4/标准AAC；ALAC→FLAC/WAV/MP4 |
| 登录凭据 | 粘贴**Netscape**格式Cookies，保存后如有需要请重启应用 |
| 存储位置 | 修改下载与转换目录，或恢复默认 |

## 命令行

CLI与桌面应用共用后端逻辑，支持批量与脚本化调用。

```powershell
.\.venv\Scripts\python.exe -m cli --help
```

| 子命令 | 用途 |
| --- | --- |
| `serve` | 启动后端API（默认`127.0.0.1:8000`） |
| `search` | 搜索林檎音乐曲库 |
| `download` | 提交URL下载任务并等待结果 |
| `settings` | 读取或写入客户端设置 |
| `library` | 扫描下载目录或列出本地历史 |
| `wrapper` | 检查、安装或启动解密组件 |
| `wsl` | 检查或安装WSL2 |

```powershell
# 搜索
.\.venv\Scripts\python.exe -m cli search "周杰伦" --limit 20

# 下载ALAC（需解密组件）
.\.venv\Scripts\python.exe -m cli download "<分享链接>" --codec alac --wrapper

# 扫描本地曲库
.\.venv\Scripts\python.exe -m cli library scan
```

CLI说明：[cli/README.md](cli/README.md)。

## 目录结构

```text
LingoMusicDownloader/
├── backend/
│   ├── api/            # FastAPI路由（搜索、下载、设置、存储、WSL2、解密组件）
│   ├── core/           # 配置、路径与二进制解析
│   ├── db/             # SQLite设置、历史与搜索偏好
│   ├── services/       # gamdl适配、下载队列、搜索、元数据、本地库、转码
│   ├── utils/          # 跨层共享工具
│   ├── head.py         # Python统一依赖入口
│   └── main.py         # FastAPI应用入口
├── cli/                # 七个子命令（serve/search/download/settings/library/wrapper/wsl）
├── frontend/
│   ├── src/            # React应用（views/ components/ app/ ui/ ...）
│   └── src-tauri/      # Tauri2 Rust外壳与图标
├── tests/              # 26项标准库unittest
├── bin/                # 本地二进制工具
├── data/               # SQLite与运行时数据
├── assets/             # 品牌资源与README徽章
├── launch.ps1          # 一键启动脚本
├── create_shortcut.ps1 # 创建桌面快捷方式
├── pyproject.toml      # Python依赖
└── uv.lock             # 锁定依赖
```

### 运行架构

```text
Tauri2+React19（前端）
          │ HTTP
          ▼
FastAPI 127.0.0.1:8000（后端）
   ├── SQLite：data/lingo.db
   ├── gamdl/林檎音乐API
   └── WSL2解密组件（:10020 / :20020 / :30020）
```

## 技术栈

| 层 | 技术 |
| --- | --- |
| 后端 | FastAPI、Uvicorn、gamdl 3.5.2、httpx、yt-dlp、m3u8、mutagen、Pillow、pycryptodome |
| 前端 | React 19、TypeScript 6、Vite 8、MingCute Icons |
| 桌面 | Tauri 2、Rust |
| 数据 | SQLite（`data/lingo.db`）、JSON（`data/storage_paths.json`） |
| 媒体 | FFmpeg、ffprobe、mp4decrypt |
| 环境 | uv、PowerShell 7、WSL2 |

## 开发与测试

```powershell
# 后端测试
.\.venv\Scripts\python.exe -m unittest discover -s tests -v

# 前端检查与构建
cd frontend
npm run lint
npm run build

# 构建桌面安装包
npm run tauri build
```

> [!NOTE]
> 首次运行后端测试前，请先启动一次后端（`.\.venv\Scripts\python.exe -m cli serve`或`launch.ps1`）以创建`data/lingo.db`；全新检出没有`data/`目录时，`settings get`测试会因缺表失败。

## 常见问题

| 现象 | 处理 |
| --- | --- |
| 搜索或下载提示初始化失败 | 登录凭据可能已过期。到设置页重新登录林檎音乐，或重新粘贴Cookies并重启应用。 |
| 高品音质、杜比或4K不可选 | 解密组件未就绪。安装并启动WSL2/解密组件，确认健康检查通过。 |
| 下载或转码提示缺少FFmpeg/mp4decrypt | 按 [bin/README.md](bin/README.md) 放置二进制文件后重启后端。 |
| 启动脚本提示端口被占用 | 后端固定使用8000；前端开发服务器固定使用5173。关闭对应端口的占用进程后重试。 |
| 只想使用命令行 | 运行`.\.venv\Scripts\python.exe -m cli serve`，另开终端使用`search`、`download`等子命令。 |

## 免责声明

- 下载内容仅限个人学习与研究，不得用于商业或侵权用途。
- 不托管、不传播任何受版权保护的音频、歌词、封面或MV；相关内容权利归原权利人所有。
- 下载内容请在24小时内删除。
- 因使用导致的账号封禁、版权纠纷或其他法律责任，由使用者自行承担。

## 致谢

- [gamdl](https://github.com/glomatico/gamdl)：林檎音乐下载核心
- [Tauri](https://github.com/tauri-apps/tauri)、[React](https://github.com/facebook/react)、[Vite](https://github.com/vitejs/vite)：桌面容器与前端
- [FastAPI](https://github.com/fastapi/fastapi)：后端框架
- [MingCute Icons](https://github.com/Richard9394/MingCute)：界面图标
- FFmpeg、mp4decrypt：媒体处理与解密
