import tempfile
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.wxarticle_archive import (
    hashed_image_name,
    read_urls,
    safe_filename,
    save_result,
)


class WxArticleArchiveClientTests(unittest.TestCase):
    def test_read_urls_from_file_and_args_dedupes(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "urls.txt"
            path.write_text(
                "# comment\nhttps://mp.weixin.qq.com/s/one\n\nhttps://mp.weixin.qq.com/s/two\n",
                encoding="utf-8",
            )
            urls = read_urls(str(path), ["https://mp.weixin.qq.com/s/one"])
        self.assertEqual(
            urls,
            ["https://mp.weixin.qq.com/s/one", "https://mp.weixin.qq.com/s/two"],
        )

    def test_safe_filename_replaces_windows_invalid_characters(self):
        self.assertEqual(safe_filename('a/b\\c:d*e?f"g<h>i|j'), "a_b_c_d_e_f_g_h_i_j")

    def test_hashed_image_name_avoids_basename_collision(self):
        first = hashed_image_name("https://mmbiz.qpic.cn/x/640?wx_fmt=jpeg")
        second = hashed_image_name("https://mmbiz.qpic.cn/y/640?wx_fmt=jpeg")
        self.assertNotEqual(first, second)
        self.assertTrue(first.endswith(".jpg"))

    def test_save_result_writes_markdown_without_images(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = {
                "url": "https://mp.weixin.qq.com/s/example",
                "title": "Hello / World",
                "markdown": "# Hello\n\nBody",
                "images": [],
            }
            path = save_result(
                result,
                Path(tmp),
                image_workers=1,
                api_base="https://wxarticle-api.example.com",
                api_key="secret",
                download_images=False,
                keep_cloud_images=False,
            )
            self.assertEqual(path.name, "Hello _ World.md")
            self.assertEqual(path.read_text(encoding="utf-8"), "# Hello\n\nBody\n")

    def test_save_result_can_keep_cloud_image_links(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = {
                "url": "https://mp.weixin.qq.com/s/example",
                "title": "Cloud Images",
                "markdown": "![x](https://mmbiz.qpic.cn/demo/640?wx_fmt=jpeg)",
                "images": ["https://mmbiz.qpic.cn/demo/640?wx_fmt=jpeg"],
                "cloudImages": [
                    {
                        "originalUrl": "https://mmbiz.qpic.cn/demo/640?wx_fmt=jpeg",
                        "url": "/v2/assets/job/item/hash.jpg",
                    }
                ],
            }
            path = save_result(
                result,
                Path(tmp),
                image_workers=1,
                api_base="https://wxarticle-api.example.com",
                api_key="secret",
                download_images=True,
                keep_cloud_images=True,
            )
            self.assertIn(
                "https://wxarticle-api.example.com/v2/assets/job/item/hash.jpg",
                path.read_text(encoding="utf-8"),
            )


if __name__ == "__main__":
    unittest.main()
