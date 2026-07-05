// Per-user state. Uses Upstash Redis (free tier) if env vars are set, so bags and
// learning survive redeploys. Falls back to in-memory otherwise — fine for testing,
// but state resets whenever the serverless function goes cold.

import { freshUser } from "./engine.js";

const mem = globalThis.__caddyMem || (globalThis.__caddyMem = new Map());
const URL_ = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const hasRedis = Boolean(URL_ && TOKEN);

async function redis(cmd) {
  const r = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  return j.result;
}

export const persistent = hasRedis;

export async function getUser(id) {
  const key = `caddy:user:${id}`;
  try {
    if (hasRedis) {
      const raw = await redis(["GET", key]);
      if (raw) return JSON.parse(raw);
    } else if (mem.has(key)) {
      return mem.get(key);
    }
  } catch (e) { /* fall through to fresh */ }
  return freshUser();
}

export async function saveUser(id, user) {
  const key = `caddy:user:${id}`;
  try {
    if (hasRedis) await redis(["SET", key, JSON.stringify(user)]);
    else mem.set(key, user);
  } catch (e) { /* best effort */ }
}
