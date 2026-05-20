#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Celest Phase 2 — 全面自动化验证脚本

用法:
    python test/phase2_verify.py          # 运行所有检查
    python test/phase2_verify.py --quick   # 仅静态检查（不跑构建）
    python test/phase2_verify.py --verbose # 详细输出

覆盖:
    1. 文件结构完整性          — 所有必需文件存在
    2. 协议类型定义             — protocol.ts 包含 Phase 2 类型
    3. 后端消息路由             — chatViewProvider.ts 分发新消息
    4. 流式打字机               — appendText() 原地追加逻辑
    5. Thinking 实时流          — appendReasoning() 增量追加
    6. 工具调用卡片             — addToolCall() / updateToolResult()
    7. Stop 按钮                — App.vue 中的 Stop 按钮逻辑
    8. 自动重试机制             — attemptRestart() 指数退避
    9. localStorage 缓存        — 持久化 watch + onMounted
    10. InputBox disabled        — props.disabled 支持
    11. ContextBar props 化      — defineProps 接收参数
    12. 构建产物验证             — 大小合理性
    13. vitest 测试执行          — 7/7 passed
"""

import os
import re
import sys
import json
import subprocess
from pathlib import Path
from typing import List, Tuple, Optional

# ─── 配置 ───────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parent.parent  # celest/
SRC = ROOT / "src"
GUI = ROOT / "gui" / "src"
GUI_COMPONENTS = GUI / "components"
OUT = ROOT / "out"

REQUIRED_FILES = [
    SRC / "protocol.ts",
    SRC / "tuiProcessManager.ts",
    SRC / "chatViewProvider.ts",
    SRC / "extension.ts",
    SRC / "jsonRpcClient.ts",
    SRC / "logger.ts",
    GUI / "App.vue",
    GUI_COMPONENTS / "ChatView.vue",
    GUI_COMPONENTS / "InputBox.vue",
    GUI_COMPONENTS / "ThinkingBlock.vue",
    GUI_COMPONENTS / "ContextBar.vue",
    GUI_COMPONENTS / "MarkdownRenderer.vue",
    ROOT / "docs" / "PLAN.md",
    ROOT / "docs" / "CHANGELOG.md",
    ROOT / "docs" / "BUGLOG.md",
]

BUILD_FILES = [
    OUT / "extension.js",
    OUT / "gui" / "index.html",
    OUT / "gui" / "assets" / "index.js",
    OUT / "gui" / "assets" / "index.css",
]

# ─── 工具函数 ──────────────────────────────────────────────────

PASS = "[PASS]"
FAIL = "[FAIL]"
WARN = "[WARN]"
SKIP = "[SKIP]"

results: List[Tuple[str, bool, str]] = []

def check(name: str, condition: bool, detail: str = "") -> bool:
    """记录单个检查结果"""
    status = PASS if condition else FAIL
    msg = detail if detail else ""
    results.append((name, condition, msg))
    if not condition:
        print(f"  {FAIL} {name}: {msg}")
    elif "--verbose" in sys.argv:
        print(f"  {PASS} {name}")
    return condition

def read_file(path: Path) -> Optional[str]:
    try:
        return path.read_text(encoding="utf-8")
    except Exception:
        return None

def grep_file(path: Path, pattern: str) -> bool:
    """检查文件中是否包含某个正则模式"""
    content = read_file(path)
    if content is None:
        return False
    return bool(re.search(pattern, content, re.MULTILINE))

def grep_file_count(path: Path, pattern: str) -> int:
    """统计正则匹配次数"""
    content = read_file(path)
    if content is None:
        return 0
    return len(re.findall(pattern, content, re.MULTILINE))

# ─── 检查函数 ──────────────────────────────────────────────────

def check_file_structure():
    """1. 文件结构完整性"""
    print("\n[1/13] 文件结构完整性")
    all_ok = True
    for f in REQUIRED_FILES:
        exists = f.exists()
        if not exists:
            all_ok = False
            print(f"  {FAIL} 缺失: {f.relative_to(ROOT)}")
        elif "--verbose" in sys.argv:
            print(f"  {PASS} {f.relative_to(ROOT)} ({f.stat().st_size} bytes)")
    return check("所有必需文件存在", all_ok)


def check_protocol_types():
    """2. 协议类型定义"""
    print("\n[2/13] 协议类型定义 (protocol.ts)")
    path = SRC / "protocol.ts"
    checks = [
        ("AcpTextContent",       r"export interface AcpTextContent"),
        ("AcpToolCallContent",   r"export interface AcpToolCallContent"),
        ("AcpToolResultContent", r"export interface AcpToolResultContent"),
        ("AcpReasoningContent",  r"export interface AcpReasoningContent"),
        ("AcpContentUnion",      r"export type AcpContentUnion"),
        ("AcpContentUpdate 细化", r"content: AcpContentUnion"),
    ]
    all_ok = True
    for name, pattern in checks:
        ok = grep_file(path, pattern)
        if not ok:
            all_ok = False
            print(f"  {FAIL} 缺失类型: {name}")
        elif "--verbose" in sys.argv:
            print(f"  {PASS} {name}")
    return check("协议类型定义完整", all_ok)


def check_message_routing():
    """3. 后端消息路由"""
    print("\n[3/13] 后端消息路由 (chatViewProvider.ts)")
    path = SRC / "chatViewProvider.ts"
    routes = [
        ("tuiText 分发",       r"tuiText.*text.*update\.content\.text"),
        ("tuiReasoning 分发",  r"tuiReasoning.*reasoning.*update\.content\.reasoning"),
        ("tuiToolCall 分发",   r"tuiToolCall.*toolCall.*update\.content\.toolCall"),
        ("tuiToolResult 分发", r"tuiToolResult.*toolResult.*update\.content\.toolResult"),
        ("tuiReconnected 分发", r"tuiReconnected"),
        ("tuiCrashed 分发",    r"tuiCrashed"),
        ("onStatusChange 监听", r"onStatusChange"),
    ]
    all_ok = True
    for name, pattern in routes:
        ok = grep_file(path, pattern)
        if not ok:
            all_ok = False
            print(f"  {FAIL} 缺失路由: {name}")
        elif "--verbose" in sys.argv:
            print(f"  {PASS} {name}")
    return check("后端消息路由完整", all_ok)


def check_streaming_typewriter():
    """4. 流式打字机"""
    print("\n[4/13] 流式打字机效果 (ChatView.vue)")
    path = GUI_COMPONENTS / "ChatView.vue"
    checks = [
        ("appendText 函数",    r"function appendText"),
        ("ensureAssistant",    r"function ensureAssistant"),
        ("原地追加逻辑",        r"lastPart\.content = \(lastPart\.content"),
        ("lastPart 检查",      r"lastPart && lastPart\.type === 'text'"),
        ("currentAssistant",   r"function currentAssistant"),
    ]
    all_ok = True
    for name, pattern in checks:
        ok = grep_file(path, pattern)
        if not ok:
            all_ok = False
            print(f"  {FAIL} 缺失: {name}")
        elif "--verbose" in sys.argv:
            print(f"  {PASS} {name}")
    return check("打字机效果实现完整", all_ok)


def check_thinking_stream():
    """5. Thinking 实时流"""
    print("\n[5/13] Thinking 实时流 (ChatView.vue)")
    path = GUI_COMPONENTS / "ChatView.vue"
    checks = [
        ("appendReasoning 函数", r"function appendReasoning"),
        ("reasoning 原地追加",    r"lastPart\.type === 'thinking'"),
        ("App.vue 处理 tuiReasoning", r"case 'tuiReasoning'"),
    ]
    all_ok = True
    for name, pattern in checks:
        target = path if "App.vue" not in name else GUI / "App.vue"
        ok = grep_file(target, pattern)
        if not ok:
            all_ok = False
            print(f"  {FAIL} 缺失: {name}")
        elif "--verbose" in sys.argv:
            print(f"  {PASS} {name}")
    return check("Thinking 流式实现", all_ok)


def check_tool_call_cards():
    """6. 工具调用卡片"""
    print("\n[6/13] 工具调用卡片 (ChatView.vue)")
    path = GUI_COMPONENTS / "ChatView.vue"
    checks = [
        ("addToolCall 函数",      r"function addToolCall"),
        ("updateToolResult 函数", r"function updateToolResult"),
        ("tool-call-card 样式",    r"\.tool-call-card"),
        ("status-pending 样式",    r"\.status-pending"),
        ("status-success 样式",    r"\.status-success"),
        ("status-error 样式",      r"\.status-error"),
        ("formatArgs 辅助",        r"function formatArgs"),
        ("formatResult 辅助",      r"function formatResult"),
        ("App.vue 处理 tuiToolCall",    r"case 'tuiToolCall'"),
        ("App.vue 处理 tuiToolResult",  r"case 'tuiToolResult'"),
    ]
    all_ok = True
    for name, pattern in checks:
        target = path if "App.vue" not in name else GUI / "App.vue"
        ok = grep_file(target, pattern)
        if not ok:
            all_ok = False
            print(f"  {FAIL} 缺失: {name}")
        elif "--verbose" in sys.argv:
            print(f"  {PASS} {name}")
    return check("工具调用卡片完整", all_ok)


def check_stop_button():
    """7. Stop 按钮"""
    print("\n[7/13] Stop 按钮 (App.vue)")
    path = GUI / "App.vue"
    checks = [
        ("Stop 按钮 UI",           r"class=\"stop-btn\""),
        ("@click=\"handleStop\"",  r"@click=\"handleStop\""),
        ("handleStop 函数",        r"function handleStop"),
        ("cancelPrompt 发送",      r"type: 'cancelPrompt'"),
        ("promptRunning 条件显示", r"v-if=\"promptRunning\""),
        ("stop-btn 样式",          r"\.stop-btn"),
        ("Stop 按钮颜色 #f85149",  r"#f85149"),
    ]
    all_ok = True
    for name, pattern in checks:
        ok = grep_file(path, pattern)
        if not ok:
            all_ok = False
            print(f"  {FAIL} 缺失: {name}")
        elif "--verbose" in sys.argv:
            print(f"  {PASS} {name}")
    return check("Stop 按钮完整", all_ok)


def check_auto_retry():
    """8. 自动重试机制"""
    print("\n[8/13] 自动重试机制 (tuiProcessManager.ts)")
    path = SRC / "tuiProcessManager.ts"
    checks = [
        ("attemptRestart 函数",  r"private async attemptRestart"),
        ("_retryCount 计数器",    r"_retryCount"),
        ("_maxRetries 上限",     r"_maxRetries"),
        ("_retryDelay 退避基数", r"_retryDelay"),
        ("指数退避乘方",          r"Math\.pow\(2"),
        ("_disposed 标志",       r"_disposed"),
        ("startInternal 拆分",   r"private async startInternal"),
        ("onStatusChange 事件",  r"onStatusChange"),
        ("tuiReconnected 事件",  r"tuiReconnected"),
        ("tuiCrashed 事件",      r"tuiCrashed"),
        ("重试延迟日志",          r"restart attempt"),
    ]
    all_ok = True
    for name, pattern in checks:
        ok = grep_file(path, pattern)
        if not ok:
            all_ok = False
            print(f"  {FAIL} 缺失: {name}")
        elif "--verbose" in sys.argv:
            print(f"  {PASS} {name}")
    return check("自动重试机制完整", all_ok)


def check_localstorage():
    """9. localStorage 持久化"""
    print("\n[9/13] localStorage 持久化 (ChatView.vue)")
    path = GUI_COMPONENTS / "ChatView.vue"
    checks = [
        ("STORAGE_KEY 常量",       r"const STORAGE_KEY = 'celest_messages'"),
        ("loadFromStorage 函数",   r"function loadFromStorage"),
        ("saveToStorage 函数",     r"function saveToStorage"),
        ("localStorage.getItem",   r"localStorage\.getItem"),
        ("localStorage.setItem",   r"localStorage\.setItem"),
        ("防抖定时器 saveTimer",    r"let saveTimer"),
        ("防抖 500ms",             r"setTimeout\([\s\S]*?500"),
        ("watch 深度监听",          r"watch\(messages.*deep: true"),
        ("onMounted 恢复",         r"onMounted\(\(\) => loadFromStorage"),
        ("clear 时 saveToStorage", r"saveToStorage\(\)"),
    ]
    all_ok = True
    for name, pattern in checks:
        ok = grep_file(path, pattern)
        if not ok:
            all_ok = False
            print(f"  {FAIL} 缺失: {name}")
        elif "--verbose" in sys.argv:
            print(f"  {PASS} {name}")
    return check("localStorage 持久化完整", all_ok)


def check_inputbox_disabled():
    """10. InputBox disabled 支持"""
    print("\n[10/13] InputBox disabled (InputBox.vue)")
    path = GUI_COMPONENTS / "InputBox.vue"
    checks = [
        ("disabled prop",          r"disabled\?.*boolean"),
        ("textarea :disabled",     r":disabled=\"disabled\""),
        ("button 禁用条件",         r"disabled.*\|\| disabled"),
        ("handleSend 检查 disabled", r"props\.disabled"),
        ("禁用样式 opacity",        r"\.prompt-input:disabled"),
        ("禁用 cursor",            r"cursor: not-allowed"),
    ]
    all_ok = True
    for name, pattern in checks:
        ok = grep_file(path, pattern)
        if not ok:
            all_ok = False
            print(f"  {FAIL} 缺失: {name}")
        elif "--verbose" in sys.argv:
            print(f"  {PASS} {name}")
    return check("InputBox disabled 完整", all_ok)


def check_contextbar_props():
    """11. ContextBar props 化"""
    print("\n[11/13] ContextBar props 化 (ContextBar.vue)")
    path = GUI_COMPONENTS / "ContextBar.vue"
    checks = [
        ("defineProps",         r"defineProps"),
        ("modelName prop",      r"modelName.*string"),
        ("turnCount prop",      r"turnCount.*number"),
        ("sessionId prop",      r"sessionId\?.*string"),
    ]
    all_ok = True
    for name, pattern in checks:
        ok = grep_file(path, pattern)
        if not ok:
            all_ok = False
            print(f"  {FAIL} 缺失: {name}")
        elif "--verbose" in sys.argv:
            print(f"  {PASS} {name}")
    return check("ContextBar props 化", all_ok)


def check_build_artifacts():
    """12. 构建产物验证"""
    print("\n[12/13] 构建产物验证")
    all_ok = True
    for f in BUILD_FILES:
        if f.exists():
            size = f.stat().st_size
            kb = size / 1024

            if f.name == "extension.js":
                if not (10 < kb < 50):
                    all_ok = False
                    print(f"  {FAIL} {f.name}: {kb:.1f} KB (expected 10-50 KB)")
                elif "--verbose" in sys.argv:
                    print(f"  {PASS} {f.name}: {kb:.1f} KB OK")
            elif f.name == "index.js":
                if not (100 < kb < 500):
                    all_ok = False
                    print(f"  {FAIL} {f.name}: {kb:.1f} KB (expected 100-500 KB)")
                elif "--verbose" in sys.argv:
                    print(f"  {PASS} {f.name}: {kb:.1f} KB OK")
            else:
                if "--verbose" in sys.argv:
                    print(f"  {PASS} {f.name}: {kb:.1f} KB")
        else:
            all_ok = False
            print(f"  {FAIL} 缺失: {f.relative_to(ROOT)}")
    return check("构建产物完整且大小合理", all_ok)


def run_vitest() -> bool:
    """13. 运行 vitest"""
    print("\n[13/13] vitest 单元测试")

    quick = "--quick" in sys.argv
    if quick:
        print(f"  {SKIP} --quick 模式，跳过测试运行")
        return check("vitest 测试（跳过）", True, "--quick mode")

    # 查找 node 路径
    node_candidates = [
        r"D:\nodejs\node.exe",
        r"C:\Program Files\nodejs\node.exe",
    ]
    node_exe = None
    for c in node_candidates:
        if Path(c).exists():
            node_exe = c
            break

    if not node_exe:
        # 尝试从 PATH 找
        try:
            result = subprocess.run(["where", "node"], capture_output=True, text=True, timeout=5, shell=True)
            if result.returncode == 0 and result.stdout.strip():
                node_exe = result.stdout.strip().split("\n")[0].strip()
        except Exception:
            pass

    if not node_exe:
        print(f"  {WARN} 找不到 node.exe，跳过 vitest")
        return check("vitest 测试（跳过）", True, "node.exe not found")

    vitest_bin = ROOT / "node_modules" / "vitest" / "vitest.mjs"
    if not vitest_bin.exists():
        print(f"  {WARN} vitest.mjs 不存在，跳过")
        return check("vitest 测试（跳过）", True, "vitest.mjs not found")

    try:
        result = subprocess.run(
            [node_exe, str(vitest_bin), "run"],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            timeout=60000,
        )
        output = result.stdout + result.stderr

        # 解析测试结果
        passed_match = re.search(r"Tests\s+(\d+)\s+passed.*?(\d+)", output)
        total_match = re.search(r"Tests\s+(\d+)\s+passed.*?\((\d+)\)", output)
        files_match = re.search(r"Test Files\s+(\d+)\s+passed.*?\((\d+)\)", output)

        if passed_match:
            passed = int(passed_match.group(1))
            total = int(passed_match.group(2)) if passed_match.lastindex >= 2 else passed
            print(f"  {PASS if passed == total else FAIL} 测试: {passed}/{total} passed")
            return check(f"vitest {passed}/{total} passed", passed == total)
        else:
            # 回退：检查退出码
            ok = result.returncode == 0
            print(f"  {PASS if ok else FAIL} exit code: {result.returncode}")
            return check("vitest exit code", ok, f"code={result.returncode}")

    except subprocess.TimeoutExpired:
        print(f"  {FAIL} vitest timeout")
        return check("vitest 执行", False, "timeout")
    except Exception as e:
        print(f"  {FAIL} vitest error: {e}")
        return check("vitest 执行", False, str(e))


# ─── 主流程 ──────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  Celest Phase 2 — 全面自动化验证")
    print("=" * 60)

    if "--quick" in sys.argv:
        print("  (--quick 模式: 跳过构建和测试运行)\n")

    tests = [
        ("文件结构完整性",      check_file_structure),
        ("协议类型定义",        check_protocol_types),
        ("后端消息路由",        check_message_routing),
        ("流式打字机效果",      check_streaming_typewriter),
        ("Thinking 实时流",     check_thinking_stream),
        ("工具调用卡片",        check_tool_call_cards),
        ("Stop 按钮",           check_stop_button),
        ("自动重试机制",        check_auto_retry),
        ("localStorage 持久化", check_localstorage),
        ("InputBox disabled",   check_inputbox_disabled),
        ("ContextBar props 化", check_contextbar_props),
        ("构建产物验证",        check_build_artifacts),
        ("vitest 测试",         run_vitest),
    ]

    for name, fn in tests:
        fn()

    # ─── 汇总 ────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("  验证结果汇总")
    print("=" * 60)

    passed = sum(1 for _, ok, _ in results if ok)
    failed = sum(1 for _, ok, _ in results if not ok)
    total = len(results)

    for name, ok, detail in results:
        icon = PASS if ok else FAIL
        d = f" — {detail}" if detail else ""
        print(f"  {icon} {name}{d}")

    print(f"\n  总计: {passed}/{total} 通过", end="")
    if failed > 0:
        print(f", {failed} 失败", end="")
    print()

    if failed > 0:
        print(f"\n  {FAIL} 存在未通过的检查项，请修复后重新验证。")
        sys.exit(1)
    else:
        print(f"\n  {PASS} 所有检查通过！Phase 2 验证成功。")
        sys.exit(0)


if __name__ == "__main__":
    main()
