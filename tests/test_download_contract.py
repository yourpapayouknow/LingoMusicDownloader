# 下载请求契约与下载核心重载测试
import asyncio
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from pydantic import ValidationError

from backend.api import routes_cookies, routes_download
from backend.api.routes_cookies import intmngrrtr
from backend.api.routes_download import DownloadRequest, nrmlvdqlty
from backend.main import app
from backend.services.downloader import DownloadManager
from backend.utils.common import nrmlcdclbl, vlddwnopt


# 验证前端别名可被下载接口接受并归一化
class DownloadContractTests(unittest.TestCase):
    def test_ui_aliases(self):
        request = DownloadRequest(
            url="https://music.apple.com/cn/album/example/1",
            codec="atmos",
            video_resolution="4k",
            use_wrapper=True,
            metadata_region="auto",
        )
        self.assertEqual(nrmlcdclbl(request.codec), "dolby")
        self.assertEqual(nrmlvdqlty(request.video_resolution), "2160p")
        self.assertEqual(request.metadata_region, "auto")

    # 验证非法地区仍被拒绝
    def test_invalid_region(self):
        with self.assertRaises(ValidationError):
            DownloadRequest(
                url="https://music.apple.com/cn/album/example/1",
                metadata_region="auto2",
            )

    # 验证共享校验覆盖高品音质与地区组合
    def test_validation_helper(self):
        self.assertIsNotNone(vlddwnopt("alac", False, None))
        self.assertIsNone(vlddwnopt("atmos", True, "auto"))
        self.assertIsNotNone(vlddwnopt("aac", False, "usa"))


# 验证前端原始载荷会以规范化值进入下载队列
class DownloadRouteTests(unittest.TestCase):
    def test_ui_payload_is_normalized(self):
        captured = {}

        async def fake_adque(url, codec=None, video_resolution=None, use_wrapper=False, metadata_region=None):
            captured.update({
                "url": url,
                "codec": codec,
                "video_resolution": video_resolution,
                "use_wrapper": use_wrapper,
                "metadata_region": metadata_region,
            })
            return True

        with (
            patch("backend.main.intdb", lambda: None),
            patch.object(routes_download.manager, "ensinit", AsyncMock(return_value=True)),
            patch.object(routes_download.manager, "adque", AsyncMock(side_effect=fake_adque)),
            patch.object(routes_download, "wrprhlth", return_value={"all_ok": True}),
        ):
            with TestClient(app) as client:
                response = client.post("/api/download", json={
                    "url": "https://music.apple.com/cn/album/example/1",
                    "codec": "atmos",
                    "video_resolution": "4k",
                    "use_wrapper": True,
                    "metadata_region": "auto",
                })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(captured["codec"], "dolby")
        self.assertEqual(captured["video_resolution"], "2160p")
        self.assertEqual(captured["metadata_region"], "auto")

    # 验证未启用解密组件时atmos会被拒绝
    def test_atmos_without_wrapper_rejected(self):
        with (
            patch("backend.main.intdb", lambda: None),
            patch.object(routes_download.manager, "ensinit", AsyncMock(return_value=True)),
        ):
            with TestClient(app) as client:
                response = client.post("/api/download", json={
                    "url": "https://music.apple.com/cn/album/example/1",
                    "codec": "atmos",
                    "use_wrapper": False,
                })
        self.assertEqual(response.status_code, 400)


# 验证凭据保存与登录完成会走强制重载
class CookieReloadTests(unittest.IsolatedAsyncioTestCase):
    async def test_intmngrrtr_uses_relinit(self):
        with (
            patch.object(routes_cookies.manager, "relinit", AsyncMock(return_value=True)) as relinit,
            patch.object(routes_cookies.manager, "ensinit", AsyncMock(return_value=True)) as ensinit,
        ):
            self.assertTrue(await intmngrrtr(attempts=1))
        relinit.assert_awaited_once()
        ensinit.assert_not_awaited()


# 验证重载失败保留旧客户端，成功后原子替换
class DownloaderReloadTests(unittest.IsolatedAsyncioTestCase):
    async def test_relinit_keeps_old_api_on_failure(self):
        manager = DownloadManager()
        old_api = object()
        manager.apple_music_api = old_api
        manager.is_initialized = True
        manager._bldapi = AsyncMock(return_value=None)

        self.assertFalse(await manager.relinit())
        self.assertIs(manager.apple_music_api, old_api)
        self.assertTrue(manager.is_initialized)

    async def test_relinit_swaps_after_success(self):
        manager = DownloadManager()
        old_api = object()
        new_api = object()
        manager.apple_music_api = old_api
        manager.is_initialized = True
        manager._bldapi = AsyncMock(return_value=new_api)

        self.assertTrue(await manager.relinit())
        self.assertIs(manager.apple_music_api, new_api)
        self.assertTrue(manager.is_initialized)

    async def test_relinit_keeps_api_during_build(self):
        manager = DownloadManager()
        old_api = object()
        manager.apple_music_api = old_api
        manager.is_initialized = True
        started = asyncio.Event()
        release = asyncio.Event()

        async def slow_build():
            started.set()
            await release.wait()
            return object()

        manager._bldapi = slow_build
        task = asyncio.create_task(manager.relinit())
        await started.wait()
        self.assertIs(manager.apple_music_api, old_api)
        self.assertTrue(manager.is_initialized)
        release.set()
        self.assertTrue(await task)


if __name__ == "__main__":
    unittest.main()