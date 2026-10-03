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
import getpass
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

# routes_download.py | audio metadata
from mutagen import File as MutagenFile
from mutagen.mp4 import MP4Cover

# routes_cookies.py | webview decrypt
from Crypto.Cipher import AES

# downloader.py | stream & media processing
import m3u8
from yt_dlp import YoutubeDL
from httpx_retries import Retry, RetryTransport
from gamdl.api.constants import APPLE_MUSIC_SEARCH_API_URI, APPLE_MUSIC_AMP_API_URL
from gamdl.api.exceptions import GamdlApiResponseError
from gamdl.interface.exceptions import (
    GamdlInterfaceDecryptionNotAvailableError,
    GamdlInterfaceFormatNotAvailableError,
)
from gamdl.api import AppleMusicApi
from gamdl.downloader import (
    AppleMusicBaseDownloader,
    AppleMusicDownloader,
    AppleMusicMusicVideoDownloader,
    AppleMusicSongDownloader,
    AppleMusicUploadedVideoDownloader,
)
from gamdl.downloader.enums import DownloadMode
from gamdl.downloader.exceptions import GamdlDownloaderMediaFileExistsError
from gamdl.interface import (
    AppleMusicBaseInterface,
    AppleMusicInterface,
    AppleMusicMusicVideoInterface,
    AppleMusicSongInterface,
    AppleMusicUploadedVideoInterface,
    SongCodec,
    MusicVideoResolution,
)
from gamdl.interface.constants import MP4_FORMAT_CODECS
from gamdl.interface.types import StreamInfo, StreamInfoAv
from gamdl.interface.enums import MediaFileFormat

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
