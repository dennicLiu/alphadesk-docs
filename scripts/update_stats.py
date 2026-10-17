#!/usr/bin/env python3
"""统计 GitHub Release 资产真实下载量, 写回 version.json(定时任务调用)。

只统计 AlphaDesk-*.zip 安装包, 排除演示视频等资产。
同一版本同时存在 "AlphaDesk-<版本>-win.zip" 与 "AlphaDesk-latest-win.zip",
是同一份内容的两个文件名, 用户从哪个链接下就只计到哪一个, 直接求和即可。
"""
import json
import os
import subprocess
from datetime import date
from pathlib import Path

REPO = os.environ.get("REPO", "dennicLiu/alphadesk-app")
VERSION_JSON = Path(__file__).resolve().parent.parent / "version.json"
JQ = ('.[] | .assets[] | select(.name | test("^AlphaDesk-.*[.]zip$"))'
      ' | .download_count')


def fetch_counts(repo):
    out = subprocess.run(
        ["gh", "api", f"repos/{repo}/releases", "--paginate", "--jq", JQ],
        capture_output=True, text=True, timeout=60,
        env={**os.environ, "GH_TOKEN": os.environ.get("GH_TOKEN", "")},
    )
    if out.returncode != 0:
        raise SystemExit("gh api 失败: " + out.stderr.strip()[:300])
    return [int(x) for x in out.stdout.split() if x.strip().isdigit()]


def main():
    counts = fetch_counts(REPO)
    total = sum(counts)
    data = json.loads(VERSION_JSON.read_text(encoding="utf-8"))
    data.setdefault("stats", {})["github"] = total
    data["stats"]["updated"] = date.today().isoformat()
    VERSION_JSON.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("资产数", len(counts), "真实累计下载", total)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())