# 启动后端API服务
from backend.head import argparse, uvicorn
from backend.main import app


# 注册serve子命令参数
def adargs(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--host", default="127.0.0.1", help="监听地址")
    parser.add_argument("--port", type=int, default=8000, help="监听端口")
    parser.add_argument("--log-level", default="info", help="日志级别")


# 启动uvicorn服务
def run(args) -> int:
    uvicorn.run(app, host=args.host, port=args.port, log_level=args.log_level, workers=1)
    return 0