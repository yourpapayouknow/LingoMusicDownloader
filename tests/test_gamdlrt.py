# gamdl惰性运行时导出契约测试
import unittest


# 验证downloader依赖的gamdl名字全部存在
class GamdlRuntimeTests(unittest.TestCase):
    def test_exports(self):
        import backend.services.gamdlrt as runtime
        missing = [name for name in runtime.__all__ if not hasattr(runtime, name)]
        self.assertEqual(missing, [])

    # 验证下载器覆盖方法名仍与gamdl基类一致
    def test_overrides(self):
        import backend.services.gamdlrt as runtime
        classes = [
            runtime.LingoAppleMusicBaseDownloader,
            runtime.LingoAppleMusicSongInterface,
            runtime.LingoAppleMusicMusicVideoInterface,
        ]
        overrides = {
            "download_stream",
            "_get_stream_info",
            "get_wrapper_m3u8",
            "get_media",
            "get_tags",
        }
        for cls in classes:
            for name in cls.__dict__:
                if name in overrides:
                    self.assertTrue(
                        any(name in base.__dict__ for base in cls.__mro__[1:]),
                        f"{cls.__name__}.{name} must override a base method",
                    )


if __name__ == "__main__":
    unittest.main()