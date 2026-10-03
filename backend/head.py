# 统一外部引用与依赖集中管理模块

# run_backend.py | main.py | routes.py | config.py
import sys
import io
import os
import multiprocessing as mp
import logging
import asyncio
import base64
import ctypes
import ctypes.wintypes
import json
import re
import socket
import sqlite3
import tempfile
import time
import threading
import hashlib
import shutil
import subprocess
import shlex
import unicodedata
import urllib.request
import zipfile
import traceback
from pathlib import Path
from urllib.parse import urlparse, parse_qs, urljoin, urlunparse
from urllib.request import Request as UrlRequest, urlopen
from http.cookiejar import MozillaCookieJar
from typing import List, Dict, Any, Optional, Tuple, Set, Union, Callable

# main.py | routes.py
import uvicorn
import httpx
from fastapi import APIRouter, FastAPI, HTTPException, Query, Request, status
from fastapi.responses import FileResponse, Response, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings

__all__ = [
    "sys",
    "io",
    "os",
    "mp",
    "logging",
    "asyncio",
    "base64",
    "ctypes",
    "json",
    "re",
    "socket",
    "sqlite3",
    "tempfile",
    "time",
    "threading",
    "hashlib",
    "shutil",
    "subprocess",
    "shlex",
    "unicodedata",
    "urllib",
    "zipfile",
    "traceback",
    "Path",
    "urlparse",
    "parse_qs",
    "List",
    "Dict",
    "Any",
    "Optional",
    "Tuple",
    "Set",
    "Union",
    "Callable",
    "uvicorn",
    "httpx",
    "APIRouter",
    "FastAPI",
    "HTTPException",
    "Query",
    "Request",
    "status",
    "FileResponse",
    "Response",
    "JSONResponse",
    "CORSMiddleware",
    "BaseModel",
    "Field",
    "BaseSettings",
]
