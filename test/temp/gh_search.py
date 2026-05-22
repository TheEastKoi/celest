#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Search GitHub API and pretty-print results."""
import json, sys, urllib.request, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

queries = [
    ("topic:deepseek-mcp", "DeepSeek MCP servers (topic)"),
    ("deepseek+coding+CLI+agent+tool+OR+code", "DeepSeek coding CLI/agents"),
    ("\"deepseek-tui\"+plugin+OR+extension+OR+skill", "DeepSeek TUI plugins/skills"),
    ("mcp-server+code+review+OR+analysis+OR+lint", "MCP code review/analysis"),
    ("mcp-server+filesystem+OR+git+OR+shell+OR+project", "MCP filesystem/git tools"),
    ("\"skill\"+deepseek+OR+\"deepseek-tui\"+code", "DeepSeek skills for code"),
]

for q, label in queries:
    url = f"https://api.github.com/search/repositories?q={q}&sort=stars&order=desc&per_page=8"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "curl/7.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            d = json.loads(resp.read())
        count = d.get('total_count', 0)
        print(f"\n{'='*70}")
        print(f"  {label}  (q={q})  total={count}")
        print(f"{'='*70}")
        for i, item in enumerate(d.get('items', [])):
            desc = (item.get('description') or 'N/A')[:130]
            stars = item.get('stargazers_count', 0)
            lang = item.get('language') or '?'
            print(f"\n{i+1}. {item['full_name']}  *{stars}  [{lang}]")
            print(f"   {desc}")
            print(f"   {item['html_url']}")
    except Exception as e:
        print(f"\n[ERROR] {q}: {e}")
