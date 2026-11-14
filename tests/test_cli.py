# CLI入口冒烟测试
import subprocess
import sys
import unittest
from pathlib import Path


# 验证CLI帮助与设置读取命令
class CliTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(__file__).resolve().parents[1]

    # CLI帮助应正常退出
    def test_help(self):
        result = subprocess.run(
            [sys.executable, "-m", "cli", "--help"],
            cwd=self.root,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=60,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("serve", result.stdout)

    # 设置读取应返回JSON
    def test_settings_get(self):
        result = subprocess.run(
            [sys.executable, "-m", "cli", "settings", "get"],
            cwd=self.root,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=60,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("{", result.stdout)


if __name__ == "__main__":
    unittest.main()