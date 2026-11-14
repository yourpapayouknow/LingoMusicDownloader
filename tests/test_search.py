# 搜索结果规整与Apple Music链接解析测试
import unittest

from backend.services.search import nrmlsrchrst, prsaplurl


# 验证搜索辅助函数的边界行为
class SearchTests(unittest.TestCase):
    # 空载荷应生成全部分类空桶
    def test_normalize_empty(self):
        result = nrmlsrchrst({})
        self.assertIn("songs", result)
        self.assertEqual(result["songs"]["data"], [])

    # 未知分类应保留为额外桶
    def test_normalize_extra(self):
        result = nrmlsrchrst({"results": {"stations": {"data": [1]}}})
        self.assertEqual(result["stations"]["data"], [1])

    # Apple Music链接应解析出类型与ID
    def test_parse_url(self):
        item_type, item_id = prsaplurl(
            "https://music.apple.com/cn/album/example/123456?i=654321"
        )
        self.assertEqual(item_type, "songs")
        self.assertEqual(item_id, "654321")


if __name__ == "__main__":
    unittest.main()