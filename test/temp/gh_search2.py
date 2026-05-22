#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Search GitHub API - part 2."""
import json, sys, urllib.request, io, time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

queries = [
    ("mcp-server+filesystem+OR+git+OR+shell+OR+project", "MCP filesystem/git tools"),
    ("\"skill\"+deepseek+OR+\"deepseek-tui\"+code", "DeepSeek skills for code"),
    ("\"deepseek\"+skill+OR+prompt+coding", "DeepSeek skills prompts"),
    ("lovable+OR+v0+OR+bolt+deepseek+coding", "AI coding tools with DeepSeek"),
]

for q, label in queries:
    url = f"https://api.github.com/search/repositories?q={q}&sort=stars&order=desc&per_page=8"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "curl/7.0"})
        with urllib.request.urlopen(req, timeout=20) as resp:
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
        time.sleep(1.5)  # rate limit friendly
    except Exception as e:
        print(f"\n[ERROR] {q}: {e}")
        time.sleep(3)
