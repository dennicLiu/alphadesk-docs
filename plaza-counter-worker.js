/* 策略广场复制计数后端 · Cloudflare Worker(免费额度足够)
 *
 * 部署:
 *   1. Cloudflare Dashboard → Workers & Pages → Create → Worker
 *   2. 粘贴本文件代码 → Deploy
 *   3. KV Namespace: Workers & Pages → Storage → KV → Create, 命名 PLAZA_COUNTS
 *      回到 Worker → Settings → Variables → 绑定 KV Namespace, 变量名 PLAZA_COUNTS
 *   4. 把 Worker 域名(如 https://plaza-counter.你的名字.workers.dev)填进
 *      alphadesk-docs/plaza-config.js 的 window.PLAZA_COUNTER
 *
 * 接口:
 *   GET  /all        -> { counts: { <策略id>: N } }
 *   POST /hit {id}   -> { id, count }
 *   CORS 已放开, 任意站点可调。
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    const ns = env.PLAZA_COUNTS;

    try {
      if (url.pathname === "/all") {
        const all = (await ns.list())?.objects || [];
        const counts = {};
        for (const k of all) counts[k.key] = Number(await ns.get(k.key)) || 0;
        return json({ counts });
      }

      if (url.pathname === "/hit" && req.method === "POST") {
        const { id } = await req.json();
        if (!id || typeof id !== "string" || id.length > 80) {
          return json({ error: "bad id" }, 400);
        }
        const cur = Number(await ns.get(id)) || 0;
        const next = cur + 1;
        await ns.put(id, String(next));
        return json({ id, count: next });
      }

      return json({ error: "not found" }, 404);
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 500);
    }
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}