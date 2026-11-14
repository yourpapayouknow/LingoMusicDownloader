# 后端守护进程启动与全局异常捕获入口脚本
# 引导期例外：必须在导入backend.head前修正标准输出与sys.path
import sys
import io
import os

# 保证标准输出流采用UTF-8字符编码
if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr.encoding != "utf-8":
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# 将工程根目录添加至系统模块导入路径
project_root = os.path.dirname(os.path.abspath(__file__))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# 统一依赖引用
from backend.head import mp, uvicorn, traceback
from backend.main import app as backend_app
from backend.core.config import settings

# 进程入口主逻辑
if __name__ == "__main__":
    mp.freeze_support()
    try:
        if hasattr(sys, "_base_executable"):
            sys._base_executable = sys.executable
        mp.set_executable(sys.executable)
    except Exception:
        # 多进程初始化失败时记录告警，主进程继续运行
        traceback.print_exc()
        print("[WARN] multiprocessing executable configuration failed.", file=sys.stderr)

    print("Starting LingoMusic Downloader Backend...")
    try:
        os.makedirs(settings.bsdir(), exist_ok=True)
    except Exception:
        traceback.print_exc()
    crash_log_path = os.path.join(settings.bsdir(), "backend_crash.log")

    # 记录未捕获崩溃异常信息至日志文件
    def lgcrsh(msg: str) -> None:
        try:
            with open(crash_log_path, "a", encoding="utf-8") as f:
                f.write(msg + "\n")
        except Exception:
            pass

    # 自定义顶层未捕获异常处理钩子
    def cstmexpt(exc_type, exc_value, exc_traceback) -> None:
        tb = "".join(traceback.format_exception(exc_type, exc_value, exc_traceback))
        lgcrsh("GLOBAL EXCEPTION:\n" + tb)
        sys.__excepthook__(exc_type, exc_value, exc_traceback)

    sys.excepthook = cstmexpt

    try:
        uvicorn.run(backend_app, host="127.0.0.1", port=8000, log_level="info", workers=1)
    except BaseException:
        tb = traceback.format_exc()
        lgcrsh("UVICORN CRASH:\n" + tb)
        raise
