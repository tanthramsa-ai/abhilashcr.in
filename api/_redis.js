// Minimal Upstash Redis REST client (no dependencies).
// Works with either the Upstash Marketplace integration (KV_REST_API_*)
// or a direct Upstash database (UPSTASH_REDIS_REST_*).

const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

function configured() {
  return Boolean(URL && TOKEN);
}

// Run several commands in one round trip; returns each command's result.
async function pipeline(commands) {
  const res = await fetch(URL.replace(/\/$/, "") + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error("Redis HTTP " + res.status);
  const out = await res.json();
  return out.map((r) => {
    if (r.error) throw new Error(r.error);
    return r.result;
  });
}

// Redis returns hashes as a flat [field, value, field, value, ...] array.
function hashToRows(flat) {
  const rows = [];
  for (let i = 0; i < (flat || []).length; i += 2) rows.push({ name: flat[i], visits: Number(flat[i + 1]) });
  return rows.sort((a, b) => b.visits - a.visits);
}

module.exports = { configured, pipeline, hashToRows };
