# CLI 使用说明

所有命令从项目根目录执行，统一入口为 `python -m cli`。

```powershell
# 查看全部命令
.\.venv\Scripts\python.exe -m cli --help

# 启动后端服务（默认127.0.0.1:8000）
.\.venv\Scripts\python.exe -m cli serve

# 搜索音乐目录
.\.venv\Scripts\python.exe -m cli search "周杰伦" --limit 20

# 提交并跟踪下载任务
.\.venv\Scripts\python.exe -m cli download "<分享链接>" --codec alac --wrapper

# 读取或写入设置
.\.venv\Scripts\python.exe -m cli settings get
.\.venv\Scripts\python.exe -m cli settings set --key lingomusic-codec --value alac

# 扫描本地库或列出历史
.\.venv\Scripts\python.exe -m cli library scan
.\.venv\Scripts\python.exe -m cli library list

# 解密组件与WSL2
.\.venv\Scripts\python.exe -m cli wrapper precheck
.\.venv\Scripts\python.exe -m cli wrapper start
.\.venv\Scripts\python.exe -m cli wsl precheck
.\.venv\Scripts\python.exe -m cli wsl install
```

CLI 只负责参数解析与调度，业务逻辑全部位于 `backend/` 服务层。Wrapper 与 WSL 命令需要本机已安装对应运行环境。