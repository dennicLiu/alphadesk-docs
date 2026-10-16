/* 策略分享串校验(JS 版, 与后端 strategy_share.decode_share 同规则)。
   规则: ADS1- 前缀 → base64url 解码 → JSON{v:1,name,spec,sum} →
   sha256(去 sum 后 canonical JSON)前 8hex 比对 → 买入规则非空 →
   因子名必须在白名单。任何一步失败返回人话原因。 */
(function (global) {
  "use strict";

  var PREFIX = "ADS1-";

  // 48 个合法因子 key(与后端 backend/quant.py FACTOR_DEFS 同源, 2026-10-16 导出)
  var FACTORS = ["ma5_dev","ma10_dev","ma20_dev","ma60_dev","ma20_slope","ma_bull",
    "above_ma_count","ret5","ret10","ret20","ret60","macd_dif_pct","macd_hist_pct",
    "macd_cross","macd_hist_rising","rsi6","rsi12","rsi24","kdj_k","kdj_d","kdj_j",
    "kdj_cross","boll_pctb","boll_width","atr_pct","volat_20d","volume_ratio_5",
    "volume_ratio_10","pos_60d","dist_high_60d","down_days","up_days",
    "lower_shadow_pct","upper_shadow_pct","body_pct","hammer","vol_spike","stop_fall",
    "gap_pct","limit_up","limit_up_days","new_low_rebound","ma_tangle","mf_main_5",
    "mf_main_ratio_5","mf_streak","mf_huge_ratio_5","mf_score"];

  var OPS = ["gte","lte","gt","lt","between","cross_above","cross_below"];

  function b64urlDecode(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    var bin = atob(s), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  async function sha256hex8(str) {
    var hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    var hex = Array.from(new Uint8Array(hash)).map(function (b) {
      return b.toString(16).padStart(2, "0");
    }).join("");
    return hex.slice(0, 8);
  }

  function collectFactors(group, out) {
    var rules = (group && group.rules) || [];
    rules.forEach(function (r) {
      if (r && typeof r === "object" && r.rules && !r.factor) {
        collectFactors(r, out);  // 嵌套子组
      } else if (r && r.factor) {
        out.push(String(r.factor));
      }
    });
  }

  function checkRuleShape(rule, path) {
    if (!rule || typeof rule !== "object") return path + "不是规则对象";
    if (rule.rules && !rule.factor) {  // 子组
      if (rule.op !== undefined && rule.op !== "all" && rule.op !== "any")
        return path + "子组关系只能是全部满足/任一满足";
      var rs = rule.rules;
      if (!Array.isArray(rs) || !rs.length) return path + "子组规则为空";
      for (var i = 0; i < rs.length; i++) {
        var e = checkRuleShape(rs[i], path + "[" + i + "]");
        if (e) return e;
      }
      return "";
    }
    if (FACTORS.indexOf(rule.factor) < 0) return path + "用了未知因子「" + rule.factor + "」";
    if (OPS.indexOf(rule.op) < 0) return path + "用了未知比较符「" + rule.op + "」";
    if (typeof rule.value !== "number" || !isFinite(rule.value))
      return path + "阈值必须是数字";
    if (rule.op === "between" && (typeof rule.value2 !== "number" || !isFinite(rule.value2)))
      return path + "区间比较需要上下两个阈值";
    if (typeof rule.value === "number" && Math.abs(rule.value) > 1e9)
      return path + "阈值大得离谱，请检查";
    return "";
  }

  // 主入口: 返回 Promise<{ok, name?, spec?, ruleCount?, error?}>
  async function validateShare(text) {
    var t = (text || "").trim();
    var m = /ADS1-([A-Za-z0-9\-_]+)/.exec(t);
    if (!m) return { ok: false, error: "不是策略分享串（应以 ADS1- 开头）。请从软件里点「分享」复制。" };
    var decoded;
    try {
      decoded = b64urlDecode(m[1]);
    } catch (e) {
      return { ok: false, error: "分享串损坏（复制缺字），请让对方从软件里重发。" };
    }
    var body;
    try {
      body = JSON.parse(decoded);
    } catch (e) {
      return { ok: false, error: "分享串损坏（复制缺字），请让对方从软件里重发。" };
    }
    if (!body || typeof body !== "object" || body.v !== 1 || !body.spec)
      return { ok: false, error: "分享串版本不支持，请把软件升级到最新版再分享。" };
    // 验签: 后端签的是"去掉 sum 段后重新 dumps 的字节"。
    // JS 重序列化与 Python 字节级不一致(浮点 100000.0 vs 100000)，
    // 所以改为文本手术: 从解码原文里删掉 sum 键值段再验。
    var expect = body.sum || "";
    var unsigned = decoded.replace(/,\s*"sum"\s*:\s*"[0-9a-f]*"/, "")
                          .replace(/"sum"\s*:\s*"[0-9a-f]*"\s*,?/, "");
    var got = "";
    try { got = await sha256hex8(unsigned); } catch (e) { got = ""; }
    if (!expect || got !== expect)
      return { ok: false, error: "分享串校验失败（复制有误），请重发。" };
    var spec = body.spec;
    var entry = spec.entry || {};
    if (!entry.rules || !entry.rules.length)
      return { ok: false, error: "该策略买入规则为空，无法分享。" };
    // 因子白名单 + 规则形状
    var used = [];
    collectFactors(entry, used);
    collectFactors(spec.exit || {}, used);
    var unknown = used.filter(function (f) { return f && f !== "None" && FACTORS.indexOf(f) < 0; });
    if (unknown.length)
      return { ok: false, error: "用了当前版本不支持的因子：" + unknown.join("、") + "。请升级软件。" };
    for (var i = 0; i < entry.rules.length; i++) {
      var e = checkRuleShape(entry.rules[i], "买入规则" + (i + 1));
      if (e) return { ok: false, error: e + "。" };
    }
    // 止损止盈/持有天数合理性（防离谱参数）
    ["stop_loss_pct", "take_profit_pct"].forEach(function (key) {
      var v = spec[key];
      if (v !== undefined && v !== null && (typeof v !== "number" || v <= 0 || v > 90))
        throw { msg: "止损/止盈比例应在 0~90% 之间。" };
    });
    if (spec.max_hold_days !== undefined && spec.max_hold_days !== null &&
        (spec.max_hold_days < 1 || spec.max_hold_days > 250))
      return { ok: false, error: "最长持有天数应在 1~250 之间。" };
    var name = String(body.name || spec.name || "导入策略").slice(0, 60);
    var rc = entry.rules.length;
    return { ok: true, name: name, spec: spec, ruleCount: rc, share: m[0] };
  }

  global.AdShare = { validate: validateShare, FACTORS: FACTORS, PREFIX: PREFIX };
})(window);
