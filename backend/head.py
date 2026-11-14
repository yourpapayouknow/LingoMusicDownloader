# 统一外部引用与依赖集中管理模块

# run_backend.py | main.py | routes.py | config.py
import sys
import io
import os
import copy
import argparse
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
import getpass
import urllib.request
import zipfile
import traceback
from pathlib import Path
from urllib.parse import urlparse, parse_qs, urljoin, urlunparse
from urllib.request import Request as UrlRequest, urlopen
from http.cookiejar import MozillaCookieJar
from contextlib import contextmanager, asynccontextmanager
from typing import List, Dict, Any, Optional, Tuple, Set, Union, Callable, Literal

# main.py | routes.py
import uvicorn
import httpx
from fastapi import APIRouter, FastAPI, HTTPException, Query, Request, status
from fastapi.responses import FileResponse, Response, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings

# routes_download.py | 音频元数据：mutagen已改为使用点函数级惰性导入
# routes_cookies.py | webview解密：Crypto已改为使用点函数级惰性导入

# downloader.py | stream & media processing
from httpx_retries import Retry, RetryTransport

# gamdl.api仅含httpx/structlog轻依赖，token初始化必需，保留急切导入；
# gamdl.downloader/interface重型链（PIL/pywidevine/pymp4/protobuf）
# 已收口至backend/services/gamdlrt.py，由downloader.gamdlrt()首次下载时惰性导入
from gamdl.api.constants import APPLE_MUSIC_SEARCH_API_URI, APPLE_MUSIC_AMP_API_URL
from gamdl.api.exceptions import GamdlApiResponseError
from gamdl.api import AppleMusicApi, ItunesApi

__all__ = [
    "sys",
    "io",
    "os",
    "copy",
    "argparse",
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
    "getpass",
    "urllib",
    "zipfile",
    "traceback",
    "Path",
    "urlparse",
    "parse_qs",
    "urljoin",
    "urlunparse",
    "UrlRequest",
    "urlopen",
    "MozillaCookieJar",
    "contextmanager",
    "asynccontextmanager",
    "List",
    "Dict",
    "Any",
    "Optional",
    "Tuple",
    "Set",
    "Union",
    "Callable",
    "Literal",
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
    "Retry",
    "RetryTransport",
    "APPLE_MUSIC_SEARCH_API_URI",
    "APPLE_MUSIC_AMP_API_URL",
    "GamdlApiResponseError",
    "AppleMusicApi",
    "ItunesApi",
]
