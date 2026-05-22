#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json, urllib.request, io, sys, time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

queries = [
    ('deepseek-tui+skills+community+repo', 'DeepSeek TUI community skills'),
    ('deepseek+code-review+OR+refactor+OR+debug+skill', 'DeepSeek code skills'),
    ('deepseek+project-analysis+OR+codebase+OR+repo+analysis', 'Project analysis'),
    ('awesome+mcp+servers+OR+awesome-mcp+code+tools', 'Awesome MCP lists'),
]

for q, label in queries:
    url = f'https://api.github.com/search/repositories?q={q}&sort=stars&order=desc&per_page=6'
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'curl/7.0'})
        with urllib.request.urlopen(req, timeout=25) as resp:
            d = json.loads(resp.read())
        count = d.get('total_count', 0)
        print(f"\n{'='*60}")
        print(f'  {label}  total={count}')
        print(f"{'='*60}")
        for i, item in enumerate(d.get('items', [])):
            desc = (item.get('description') or 'N/A')[:120]
            print(f"\n{i+1}. {item['full_name']}  *{item['stargazers_count']}  [{item.get('language','?')}]")
            print(f'   {desc}')
            print(f'   {item["html_url"]}')
        time.sleep(2)
    except Exception as e:
        print(f'\n[ERROR] {q}: {e}')
        time.sleep(3)
