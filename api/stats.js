// GET /api/stats — private visit report. Requires the STATS_KEY environment variable,
// sent as "Authorization: Bearer <key>".

const crypto = require("crypto");
const { configured, pipeline, hashToRows } = require("./_redis");

function authorized(req) {
  const key = process.env.STATS_KEY;
  const sent = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!key || !sent) return false;
  const a = crypto.createHash("sha256").update(sent).digest();
  const b = crypto.createHash("sha256").update(key).digest();
  return crypto.timingSafeEqual(a, b);
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!process.env.STATS_KEY) return res.status(503).json({ error: "STATS_KEY is not set" });
  if (!authorized(req)) return res.status(401).json({ error: "Wrong key" });
  if (!configured()) return res.status(503).json({ error: "Visit store not configured" });

  try {
    const [total, city, country, day, recent] = await pipeline([
      ["GET", "visits:total"],
      ["HGETALL", "visits:city"],
      ["HGETALL", "visits:country"],
      ["HGETALL", "visits:day"],
      ["LRANGE", "visits:recent", 0, 49],
    ]);

    return res.status(200).json({
      total: Number(total) || 0,
      cities: hashToRows(city),
      countries: hashToRows(country),
      days: hashToRows(day).sort((a, b) => (a.name < b.name ? 1 : -1)).slice(0, 30),
      recent: (recent || []).map((r) => { try { return JSON.parse(r); } catch (e) { return null; } }).filter(Boolean),
    });
  } catch (err) {
    console.error("stats failed:", err);
    return res.status(500).json({ error: "Could not read stats" });
  }
};
