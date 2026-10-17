#!/usr/bin/env python3
"""统计 GitHub Release 资产真实下载量, 写回 version.json(定时任务调用)。"""
import json
import os
import subprocess
from datetime import date
from pathlib import Path

REPO = os.environ.get("REPO", "dennicLiu/alphadesk-app")
VERSION_JSON = Path(__file__).resolve().parent.parent / "version.json"
JQ = ('.[] | .assets[] | select(.name | test("^AlphaDesk-.*[.]zip$"))'
      ' | "\\(.name)|\\(.download_count)"')


def fetch_counts(repo):
    out = subprocess.run(
        ["gh", "api", f"repos/{repo}/releases", "--paginate", "--jq", JQ],
        capture_output=True, text=True, timeout=60,
        env={**os.environ, "GH_TOKEN": os.environ.get("GH_TOKEN", "")},
    )
    if out.returncode != 0:
        raise SystemExit("gh api 失败: " + out.stderr.strip()[:300])
    counts = {}
    for line in out.stdout.splitlines():
        if "|" not in line:
            continue
        name, cnt = line.rsplit("|", 1)
        if not cnt.strip().isdigit():
            continue
        low = name.lower()
        key = "win" if "win" in low else ("mac" if "mac" in low else "other")
        counts[key] = counts.get(key, 0) + int(cnt.strip())
    return counts


def main():
    counts = fetch_counts(REPO)
    win, mac = counts.get("win", 0), counts.get("mac", 0)
    total = win + mac
    data = json.loads(VERSION_JSON.read_text(encoding="utf-8"))
    data["stats"] = {"github": total, "win": win, "mac": mac,
                     "updated": date.today().isoformat()}
    VERSION_JSON.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Windows", win, "+ Mac", mac, "= 合计", total)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())