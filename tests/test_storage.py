# 下载与转换目录存储路径测试
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.core.config import Settings, settings
from backend.services import storage


# 验证存储路径保存、覆盖与恢复默认
class StorageTests(unittest.TestCase):
    # 保存后配置生效，恢复后回到默认目录
    def test_save_and_reset(self):
        with tempfile.TemporaryDirectory() as tempdir:
            with patch.object(Settings, "bsdir", return_value=tempdir):
                download_dir = Path(tempdir) / "downloads"
                converted_dir = Path(tempdir) / "converted"
                result = storage.svpaths(str(download_dir), str(converted_dir))

                self.assertEqual(result["download_dir"], str(download_dir.resolve()))
                self.assertEqual(settings.outpth(), str(download_dir.resolve()))
                self.assertEqual(settings.cnvtpth(), str(converted_dir.resolve()))
                self.assertTrue(download_dir.is_dir())
                self.assertTrue(converted_dir.is_dir())

                reset_result = storage.rstpaths()
                self.assertEqual(reset_result["download_dir"], str(Path(tempdir) / "Apple Music"))
                self.assertEqual(settings.outpth(), str(Path(tempdir) / "Apple Music"))

    # 相对路径与相同目录应被拒绝
    def test_reject_invalid_paths(self):
        with tempfile.TemporaryDirectory() as tempdir:
            with patch.object(Settings, "bsdir", return_value=tempdir):
                with self.assertRaises(ValueError):
                    storage.svpaths("relative/path", str(Path(tempdir) / "converted"))
                with self.assertRaises(ValueError):
                    storage.svpaths(str(Path(tempdir) / "same"), str(Path(tempdir) / "same"))


if __name__ == "__main__":
    unittest.main()