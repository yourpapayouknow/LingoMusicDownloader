import threading
import uvicorn
import flet as ft
import sys
import os

# Add the project root to sys.path to resolve imports correctly
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

# Now we can import from backend and frontend
from backend.main import app as backend_app
from frontend.main import main as frontend_main

def start_backend():
    # Run uvicorn in a quiet mode
    uvicorn.run(backend_app, host="127.0.0.1", port=8000, log_level="info")

if __name__ == "__main__":
    # 1. Start the backend in a background thread
    backend_thread = threading.Thread(target=start_backend, daemon=True)
    backend_thread.start()
    
    # 2. Start the Flet frontend
    # Note: frontend_main is the function 'main(page: ft.Page)'
    ft.app(target=frontend_main)
