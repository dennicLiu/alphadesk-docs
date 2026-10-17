#!/usr/bin/env python3
"""已上架策略同步: 飞书多维表格 → docs/strategies.json

只读取"已上架视图"表, 每条分享串用与客户端同源的规则校验, 校验不过的直接跳过
(模板示例数据/手填乱串自动过滤)。产出静态 strategies.json, 官网直接 fetch。

所需环境变量(CI 从 GitHub Secrets 注入):
  FEISHU_APP_ID, FEISHU_APP_SECRET
可选:
  FEISHU_APP_TOKEN(默认内置), TABLE_ID(默认内置), OUT(默认 strategies.json)
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import sys
import urllib.parse
import urllib.request

APP_TOKEN = os.environ.get("FEISHU_APP_TOKEN", "LNVfbn069auQXas0IEic8v5cnof")
TABLE_ID = os.environ.get("TABLE_ID", "tbliYHqCfO2XTMK8")  # 已上架视图
API = "https://open.feishu.cn/open-apis"
OUT = os.environ.get("OUT", "strategies.json")

# 48 个合法因子(与 backend/quant.py FACTOR_DEFS 同源)
FACTORS = {
    "ma5_dev","ma10_dev","ma20_dev","ma60_dev","ma20_slope","ma_bull",
    "above_ma_count","ret5","ret10","ret20","ret60","macd_dif_pct","macd_hist_pct",
    "macd_cross","macd_hist_rising","rsi6","rsi12","rsi24","kdj_k","kdj_d","kdj_j",
    "kdj_cross","boll_pctb","boll_width","atr_pct","volat_20d","volume_ratio_5",
    "volume_ratio_10","pos_60d","dist_high_60d","down_days","up_days",
    "lower_shadow_pct","upper_shadow_pct","body_pct","hammer","vol_spike","stop_fall",
    "gap_pct","limit_up","limit_up_days","new_low_rebound","ma_tangle","mf_main_5",
    "mf_main_ratio_5","mf_streak","mf_huge_ratio_5","mf_score",
}


def _http(method: str, url: str, token: str = "", body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    # URL 里可能有中文(字段名), 统一按 UTF-8 编码路径与查询
    url = urllib.parse.quote(url, safe=":/?&=%,")
    req = urllib.request.Request(url, data=data, method=method)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    if data:
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode())


def tenant_token() -> str:
    d = _http("POST", f"{API}/auth/v3/tenant_access_token/internal", body={
        "app_id": os.environ["FEISHU_APP_ID"],
        "app_secret": os.environ["FEISHU_APP_SECRET"],
    })
    if d.get("code") != 0:
        raise SystemExit(f"取 tenant_token 失败: {d}")
    return d["tenant_access_token"]


def validate_share(text: str) -> dict | None:
    """与客户端 decode_share 同规则, 通过返回 {name, rule_count}, 否则 None。"""
    import re
    m = re.search(r"ADS1-([A-Za-z0-9\-_]+)", text or "")
    if not m:
        return None
    b64 = m.group(1)
    try:
        body = json.loads(base64.urlsafe_b64decode(b64 + "=" * (-len(b64) % 4)))
    except Exception:
        return None
    if not isinstance(body, dict) or body.get("v") != 1 or "spec" not in body:
        return None
    check = {k: v for k, v in body.items() if k != "sum"}
    raw = json.dumps(check, ensure_ascii=False, sort_keys=True).encode()
    if hashlib.sha256(raw).hexdigest()[:8] != body.get("sum"):
        return None
    spec = body["spec"]
    entry = spec.get("entry") or {}
    rules = entry.get("rules") or []
    if not rules:
        return None
    used = set()
    for grp in (entry, spec.get("exit") or {}):
        for r in grp.get("rules", []):
            if isinstance(r, dict) and r.get("factor") and not r.get("rules"):
                used.add(str(r["factor"]))
            elif isinstance(r, dict) and r.get("rules"):
                for rr in r["rules"]:
                    if rr.get("factor"):
                        used.add(str(rr["factor"]))
    if used - FACTORS:
        return None
    return {"name": str(body.get("name") or spec.get("name") or "策略")[:60],
            "rule_count": len(rules),
            "factors": sorted(used)[:12],
            "stop_loss_pct": spec.get("stop_loss_pct")}


def _num(v, default=None):
    if v is None:
        return default
    if isinstance(v, (int, float)):
        return v
    try:
        return float(str(v).strip())
    except ValueError:
        return default


def _text(v) -> str:
    """飞书文本字段可能是 str 或 [{text:..}] 富文本数组。"""
    if v is None:
        return ""
    if isinstance(v, str):
        return v
    if isinstance(v, list):
        return "".join(seg.get("text", "") if isinstance(seg, dict) else str(seg) for seg in v)
    return str(v)


def _load_seed() -> list[dict]:
    """本地种子策略(官方示例), 保证广场始终有内容; 与线上按分享串去重。"""
    path = os.environ.get("SEED", "strategies_seed.json")
    try:
        with open(path, encoding="utf-8") as fp:
            return json.load(fp).get("strategies", [])
    except OSError:
        return []


def _audit_seeds(seeds: list[dict]) -> None:
    """种子闸门: 因子必须存在于系统, 否则用户导入必然失败 —— 直接中止同步。"""
    bad = []
    for s in seeds:
        miss = [f for f in (s.get("factors") or []) if f not in FACTORS]
        if miss:
            bad.append((s.get("name") or "?", miss))
    if bad:
        for n, m in bad:
            print(f"  种子含系统不存在的因子: {n!r} -> {m}", file=sys.stderr)
        raise SystemExit(f"种子校验失败: {len(bad)} 条含未知因子, 中止同步")


def main() -> int:
    tok = tenant_token()
    url = f"{API}/bitable/v1/apps/{APP_TOKEN}/tables/{TABLE_ID}/records?page_size=100"
    out = []
    seen = set()
    # 先放种子, 再叠线上(同分享串以线上为准)
    seeds = _load_seed()
    _audit_seeds(seeds)
    for s in seeds:
        if s.get("share"):
            seen.add(s["share"])
            out.append(s)
    while url:
        d = _http("GET", url, tok)
        if d.get("code") != 0:
            raise SystemExit(f"读表失败: {d}")
        data = d.get("data", {})
        for rec in data.get("items", []):
            f = rec.get("fields", {})
            name = _text(f.get("名字")).strip()
            share = _text(f.get("分享串")).strip()
            if not name or not share:
                continue
            chk = validate_share(share)
            if not chk:
                print(f"  跳过(校验不过): {name!r}", file=sys.stderr)
                continue
            if share in seen:
                continue
            seen.add(share)
            score = _num(f.get("成绩"))
            out.append({
                "id": rec.get("record_id", ""),
                "name": name[:60],
                "desc": _text(f.get("简介")).strip()[:120],
                "author": (_text(f.get("作者")).strip() or "热心用户")[:20],
                "rules": int(_num(f.get("规则数"), chk["rule_count"]) or chk["rule_count"]),
                "win_rate": score,
                "buzz": (f"样本外成绩 {score:g}" if score is not None else ""),
                "share": share,
                "source": "community",
                "factors": chk.get("factors") or [],
                "posted_at": str(rec.get("created_time") or "")[:10],
            })
        url = (f"{API}{data['page_token']}&page_size=100"
               if data.get("has_more") and data.get("page_token") else "")

    payload = {"strategies": out, "count": len(out)}
    with open(OUT, "w", encoding="utf-8") as fp:
        json.dump(payload, fp, ensure_ascii=False, indent=2)
    print(f"同步完成: {len(out)} 条有效策略 → {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
