// POST /api/visit — count one page load and tally it by location.
// Location comes from the headers Vercel adds to every request; no IP address is stored.

const { configured, pipeline } = require("./_redis");

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|monitor/i;
const RECENT_MAX = 200;

function header(req, name) {
  const v = req.headers[name];
  if (!v) return "";
  try { return decodeURIComponent(v); } catch (e) { return v; }
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!configured()) return res.status(503).json({ error: "Visit store not configured" });

  try {
    if (BOT.test(req.headers["user-agent"] || "")) {
      const [total] = await pipeline([["GET", "visits:total"]]);
      return res.status(200).json({ total: Number(total) || 0, counted: false });
    }

    const country = header(req, "x-vercel-ip-country") || "Unknown";
    const region = header(req, "x-vercel-ip-country-region");
    const city = header(req, "x-vercel-ip-city") || "Unknown";
    const place = [city, region, country].filter(Boolean).join(", ");
    const now = new Date();
    const day = now.toISOString().slice(0, 10);

    const recent = JSON.stringify({
      t: now.toISOString(),
      city,
      region,
      country,
      lat: header(req, "x-vercel-ip-latitude") || null,
      lon: header(req, "x-vercel-ip-longitude") || null,
    });

    const [total] = await pipeline([
      ["INCR", "visits:total"],
      ["HINCRBY", "visits:city", place, 1],
      ["HINCRBY", "visits:country", country, 1],
      ["HINCRBY", "visits:day", day, 1],
      ["LPUSH", "visits:recent", recent],
      ["LTRIM", "visits:recent", 0, RECENT_MAX - 1],
    ]);

    return res.status(200).json({ total: Number(total), counted: true });
  } catch (err) {
    console.error("visit failed:", err);
    return res.status(500).json({ error: "Could not record visit" });
  }
};
