# 路径白名单、zip-slip与CORS安全回归测试
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.testclient import TestClient

from backend.api.routes_download import vldopnptr
from backend.api.routes_wrapper import sfzipxtr
from backend.core.config import settings
from backend.main import app


# 验证目录白名单与压缩包解压边界
class SecurityTests(unittest.TestCase):
    # 允许下载目录内的路径
    def test_allowed_path(self):
        target = Path(settings.outpth()) / "sub" / "track.m4a"
        self.assertEqual(vldopnptr(str(target)), target.resolve())

    # 拒绝目录外路径、尾分隔符与UNC路径
    def test_blocked_paths(self):
        root = Path(settings.outpth()).resolve()
        for bad in [str(root / ".." / "evil.txt"), "C:/Windows/System32/calc.exe/", r"\\server\share\x"]:
            with self.assertRaises(HTTPException):
                vldopnptr(bad)

    # 拒绝包含路径穿越成员的压缩包
    def test_zip_slip_blocked(self):
        with tempfile.TemporaryDirectory() as tempdir:
            archive = Path(tempdir) / "bad.zip"
            with zipfile.ZipFile(archive, "w") as zf:
                zf.writestr("../evil.txt", "x")
            with self.assertRaises(ValueError):
                sfzipxtr(archive, Path(tempdir) / "out")

    # 验证CORS仅放行白名单来源
    def test_cors_whitelist(self):
        with patch("backend.main.intdb", lambda: None):
            with TestClient(app) as client:
                blocked = client.get("/", headers={"Origin": "https://evil.example"})
                allowed = client.get("/", headers={"Origin": "http://localhost:5173"})
        self.assertIsNone(blocked.headers.get("access-control-allow-origin"))
        self.assertEqual(allowed.headers.get("access-control-allow-origin"), "http://localhost:5173")

    # 验证open-folder拒绝任意可执行文件路径
    def test_open_folder_rejects_external(self):
        with patch("backend.main.intdb", lambda: None):
            with TestClient(app) as client:
                response = client.post("/api/open-folder", json={"path": "C:/Windows/System32/calc.exe/"})
        self.assertEqual(response.status_code, 403)


if __name__ == "__main__":
    unittest.main()