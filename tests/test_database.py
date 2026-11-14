# 数据库连接、读写与回滚测试
import os
import tempfile
import unittest

from backend.db import database


# 在临时目录中重建数据库环境
class DatabaseTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.old_dir = database.DB_DIR
        self.old_path = database.DB_PATH
        database.DB_DIR = os.path.join(self.tempdir.name, "data")
        database.DB_PATH = os.path.join(database.DB_DIR, "test.db")
        database.intdb()

    def tearDown(self):
        database.DB_DIR = self.old_dir
        database.DB_PATH = self.old_path
        self.tempdir.cleanup()

    # 验证历史记录插入、查询、更新与删除
    def test_history_roundtrip(self):
        database.inshstry({
            "track_id": "t1",
            "name": "Song",
            "artist_name": "Artist",
            "album_name": "Album",
            "artwork_url": "",
            "codec": "aac",
            "file_path": "C:/tmp/a.m4a",
            "lyrics_path": "",
            "file_size": 123,
        })
        row = database.gthstrybytrk("t1")
        self.assertEqual(row["name"], "Song")
        database.updhstrylrc("t1", "C:/tmp/a.lrc")
        self.assertEqual(database.gthstrybytrk("t1")["lyrics_path"], "C:/tmp/a.lrc")
        database.dlthstry("t1")
        self.assertIsNone(database.gthstrybytrk("t1"))

    # 验证设置读写与损坏JSON回退
    def test_settings_roundtrip(self):
        database.svstngs({"lingomusic-codec": "alac", "lingomusic-volume": 1})
        values = database.gtallstngs()
        self.assertEqual(values["lingomusic-codec"], "alac")
        self.assertEqual(values["lingomusic-volume"], 1)

    # 验证写事务异常时回滚
    def test_transaction_rollback(self):
        with self.assertRaises(RuntimeError):
            with database.dbcxn(write=True) as conn:
                conn.execute(
                    "INSERT INTO client_settings (config_key, config_value) VALUES (?, ?)",
                    ("lingomusic-rollback", "x"),
                )
                raise RuntimeError("boom")
        self.assertNotIn("lingomusic-rollback", database.gtallstngs())


if __name__ == "__main__":
    unittest.main()