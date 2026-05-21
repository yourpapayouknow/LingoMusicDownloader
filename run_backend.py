import sys
import io
import os
import multiprocessing as mp

# Force UTF-8 encoding on standard streams to prevent UnicodeEncodeError on Windows
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
if sys.stderr.encoding != 'utf-8':
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import uvicorn

# Add the project root to sys.path to resolve imports correctly
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

from backend.main import app as backend_app

if __name__ == "__main__":
    # Force uvicorn/multiprocessing child processes to use the same venv
    # interpreter instead of falling back to base Anaconda Python on Windows.
    try:
        if hasattr(sys, "_base_executable"):
            sys._base_executable = sys.executable  # type: ignore[attr-defined]
        mp.set_executable(sys.executable)
    except Exception:
        pass

    print("Starting LingoMusic Downloader Backend...")
    import traceback
    
    crash_log_path = os.path.join(project_root, "backend_crash.log")

    def log_crash(msg):
        try:
            with open(crash_log_path, "a", encoding="utf-8") as f:
                f.write(msg + "\n")
        except Exception:
            pass

    def custom_excepthook(exc_type, exc_value, exc_traceback):
        tb = "".join(traceback.format_exception(exc_type, exc_value, exc_traceback))
        log_crash("GLOBAL EXCEPTION:\n" + tb)
        sys.__excepthook__(exc_type, exc_value, exc_traceback)

    sys.excepthook = custom_excepthook

    try:
        uvicorn.run(backend_app, host="127.0.0.1", port=8000, log_level="info", workers=1)
    except BaseException as e:
        tb = traceback.format_exc()
        log_crash("UVICORN CRASH:\n" + tb)
        raise
