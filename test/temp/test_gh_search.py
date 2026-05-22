#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gh_search 脚本的单元测试。
Mock 掉 urllib 网络请求，只测解析、格式化和错误处理逻辑。
"""

import json
import io
import unittest
from unittest.mock import patch, MagicMock
from typing import Any

# ---------------------------------------------------------------------------
# 将 gh_search.py 的搜索逻辑提取为可测试的函数
# 注意：原脚本是过程式的，这里把核心逻辑拆成函数以便测试
# ---------------------------------------------------------------------------

BASE_QUERIES = [
    ("topic:deepseek-mcp", "DeepSeek MCP servers (topic)"),
    ("deepseek+coding+CLI+agent+tool+OR+code", "DeepSeek coding CLI/agents"),
    ('"deepseek-tui"+plugin+OR+extension+OR+skill', "DeepSeek TUI plugins/skills"),
    ("mcp-server+code+review+OR+analysis+OR+lint", "MCP code review/analysis"),
    ("mcp-server+filesystem+OR+git+OR+shell+OR+project", "MCP filesystem/git tools"),
    ('"skill"+deepseek+OR+"deepseek-tui"+code', "DeepSeek skills for code"),
]

SAMPLE_REPO = {
    "id": 1,
    "full_name": "test-owner/test-repo",
    "html_url": "https://github.com/test-owner/test-repo",
    "description": "A test repository for DeepSeek MCP integration",
    "stargazers_count": 42,
    "language": "Python",
    "fork": False,
}

SAMPLE_API_RESPONSE: dict[str, Any] = {
    "total_count": 1,
    "incomplete_results": False,
    "items": [SAMPLE_REPO],
}

EMPTY_API_RESPONSE: dict[str, Any] = {
    "total_count": 0,
    "incomplete_results": False,
    "items": [],
}


def build_search_url(query: str, per_page: int = 8) -> str:
    """构建 GitHub 搜索 API URL。"""
    return (
        f"https://api.github.com/search/repositories"
        f"?q={query}&sort=stars&order=desc&per_page={per_page}"
    )


def parse_response(body: bytes) -> dict[str, Any]:
    """解析 GitHub API 返回的 JSON。"""
    return json.loads(body)


def format_repo(item: dict[str, Any], index: int) -> str:
    """将单个仓库项格式化为多行字符串。"""
    name = item.get("full_name", "?")
    stars = item.get("stargazers_count", 0)
    lang = item.get("language") or "?"
    desc = (item.get("description") or "N/A")[:130]
    url = item.get("html_url", "")
    return (
        f"\n{index}. {name}  *{stars}  [{lang}]\n"
        f"   {desc}\n"
        f"   {url}"
    )


def format_header(label: str, query: str, total: int, width: int = 70) -> str:
    """格式化搜索结果的标题行。"""
    sep = "=" * width
    return (
        f"\n{sep}\n"
        f"  {label}  (q={query})  total={total}\n"
        f"{sep}"
    )


def collect_search_results(query: str, label: str, per_page: int = 8) -> list[str]:
    """
    调用 GitHub API 并返回格式化的输出行列表。
    生产环境中替换为真实 urllib.request；测试中用 mock。
    """
    # 这个函数在测试中会被 mock 替换，此处保留原脚本调用方式
    import urllib.request

    url = build_search_url(query, per_page)
    req = urllib.request.Request(url, headers={"User-Agent": "curl/7.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = parse_response(resp.read())
    count = data.get("total_count", 0)
    lines = [format_header(label, query, count)]
    for i, item in enumerate(data.get("items", [])):
        lines.append(format_repo(item, i + 1))
    return lines


# ---------------------------------------------------------------------------
# 测试用例
# ---------------------------------------------------------------------------


class TestBuildSearchUrl(unittest.TestCase):
    """验证 URL 构建逻辑。"""

    def test_simple_query(self):
        url = build_search_url("test-query")
        self.assertIn("q=test-query", url)
        self.assertIn("sort=stars", url)
        self.assertIn("per_page=8", url)
        self.assertTrue(url.startswith("https://api.github.com/search/repositories?"))

    def test_complex_query(self):
        q = 'topic:deepseek-mcp'
        url = build_search_url(q, per_page=5)
        self.assertIn("q=topic:deepseek-mcp", url)  # f-string 不会编码 :
        self.assertIn("per_page=5", url)

    def test_encoded_query(self):
        """验证含特殊字符的查询（如 +, OR, "）"""
        q = '"deepseek-tui"+plugin'
        url = build_search_url(q)
        # urllib.parse.quote 不会编码双引号，这里只验证包含原始内容
        self.assertIn("q=", url)
        self.assertIn("deepseek-tui", url)


class TestParseResponse(unittest.TestCase):
    """验证 JSON 解析逻辑。"""

    def test_parse_full_response(self):
        body = json.dumps(SAMPLE_API_RESPONSE).encode("utf-8")
        result = parse_response(body)
        self.assertEqual(result["total_count"], 1)
        self.assertEqual(result["items"][0]["full_name"], "test-owner/test-repo")

    def test_parse_empty_response(self):
        body = json.dumps(EMPTY_API_RESPONSE).encode("utf-8")
        result = parse_response(body)
        self.assertEqual(result["total_count"], 0)
        self.assertEqual(len(result["items"]), 0)

    def test_parse_malformed_json(self):
        with self.assertRaises(json.JSONDecodeError):
            parse_response(b"not json")

    def test_parse_missing_fields(self):
        """当 API 返回的字段不完整时不应崩溃。"""
        minimal = json.dumps({"total_count": 0}).encode("utf-8")
        result = parse_response(minimal)
        self.assertEqual(result.get("total_count"), 0)
        self.assertIsNone(result.get("items"))


class TestFormatRepo(unittest.TestCase):
    """验证仓库项的格式化输出。"""

    def test_format_normal(self):
        output = format_repo(SAMPLE_REPO, 1)
        self.assertIn("test-owner/test-repo", output)
        self.assertIn("*42", output)
        self.assertIn("[Python]", output)
        self.assertIn("DeepSeek MCP integration", output)
        self.assertIn("https://github.com/test-owner/test-repo", output)

    def test_format_missing_description(self):
        repo = {**SAMPLE_REPO, "description": None}
        output = format_repo(repo, 1)
        self.assertIn("N/A", output)

    def test_format_no_language(self):
        repo = {**SAMPLE_REPO, "language": None}
        output = format_repo(repo, 1)
        self.assertIn("[?]", output)

    def test_format_long_description_truncated(self):
        long_desc = "x" * 200
        repo = {**SAMPLE_REPO, "description": long_desc}
        output = format_repo(repo, 1)
        # 只截取前 130 字符
        self.assertIn("x" * 130, output)
        self.assertNotIn("x" * 131, output)

    def test_format_index_numbering(self):
        output_1 = format_repo(SAMPLE_REPO, 1)
        output_5 = format_repo(SAMPLE_REPO, 5)
        self.assertTrue(output_1.startswith("\n1. "))
        self.assertTrue(output_5.startswith("\n5. "))


class TestFormatHeader(unittest.TestCase):
    """验证标题格式化。"""

    def test_header_contains_info(self):
        header = format_header("My Label", "q=test", 10)
        self.assertIn("My Label", header)
        self.assertIn("q=test", header)
        self.assertIn("total=10", header)
        self.assertIn("=" * 70, header)

    def test_header_custom_width(self):
        header = format_header("X", "y", 5, width=10)
        self.assertIn("=" * 10, header)


class TestCollectSearchResults(unittest.TestCase):
    """验证完整的搜索→格式化流程（mock 网络层）。"""

    @patch("urllib.request.urlopen")
    def test_happy_path(self, mock_urlopen: MagicMock):
        """正常返回一条结果，输出应包含标题和格式化项。"""
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps(SAMPLE_API_RESPONSE).encode("utf-8")
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        with patch("sys.stdout", new_callable=io.StringIO):
            lines = collect_search_results("test-query", "Test Label", per_page=8)

        self.assertIn("Test Label", lines[0])
        self.assertIn("total=1", lines[0])
        self.assertTrue(any("test-owner/test-repo" in l for l in lines))
        self.assertTrue(any("*42" in l for l in lines))

    @patch("urllib.request.urlopen")
    def test_empty_results(self, mock_urlopen: MagicMock):
        """API 返回 0 条结果时不应崩溃。"""
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps(EMPTY_API_RESPONSE).encode("utf-8")
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        with patch("sys.stdout", new_callable=io.StringIO):
            lines = collect_search_results("q=empty", "Empty", per_page=8)

        self.assertIn("total=0", lines[0])
        # 只有标题行，没有仓库项
        self.assertEqual(len(lines), 1)

    @patch("urllib.request.urlopen")
    def test_network_error_raises(self, mock_urlopen: MagicMock):
        """网络异常应向上传播（由调用方处理）。"""
        import urllib.error

        mock_urlopen.side_effect = urllib.error.URLError("timeout")

        with self.assertRaises(urllib.error.URLError):
            collect_search_results("q=err", "Error", per_page=8)


class TestBaseQueries(unittest.TestCase):
    """验证 BASE_QUERIES 配置完整性。"""

    def test_all_queries_have_label(self):
        for q, label in BASE_QUERIES:
            self.assertIsInstance(q, str)
            self.assertIsInstance(label, str)
            self.assertGreater(len(q), 0)
            self.assertGreater(len(label), 0)

    def test_no_duplicate_labels(self):
        labels = [label for _, label in BASE_QUERIES]
        self.assertEqual(len(labels), len(set(labels)))

    def test_no_duplicate_queries(self):
        queries = [q for q, _ in BASE_QUERIES]
        self.assertEqual(len(queries), len(set(queries)))


if __name__ == "__main__":
    unittest.main(verbosity=2)
