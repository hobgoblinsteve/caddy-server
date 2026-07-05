// GET or POST /api/ask
//   q    — what you'd say to a caddy: "150 rough into the wind uphill", "short", "bag", "course 11735"
//   user — any stable id (a name, a phone number, a device id). Keeps your bag separate from everyone else's.
//   lat, lon — optional; Siri Shortcuts can attach current location for live weather.
//
// Returns JSON: { speech, ... }. Siri Shortcuts reads .speech and speaks it.

import { handleMessage } from "../lib/engine.js";
import { getUser, saveUser, persistent } from "../lib/store.js";
import { weatherFor, geocode } from "../lib/weather.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  const src = req.method === "POST" ? (req.body || {}) : (req.query || {});
  const q = (src.q || src.text || "").toString();
  const userId = (src.user || "").toString().trim().toLowerCase();
  const lat = src.lat != null && src.lat !== "" ? parseFloat(src.lat) : null;
  const lon = src.lon != null && src.lon !== "" ? parseFloat(src.lon) : null;

  if (!userId) return res.status(400).json({ error: "Missing 'user' — pass any stable id, like your name." });
  if (!q) return res.status(400).json({ error: "Missing 'q' — what would you ask your caddy?" });

  const user = await getUser(userId);
  const result = await handleMessage(user, q, weatherFor(lat, lon));

  // the one command the engine hands back to us: setting a home course
  if (result.courseQuery) {
    try {
      const loc = await geocode(result.courseQuery);
      if (loc) {
        user.loc = loc;
        result.reply = `Home course set near ${loc.label}. I'll use that for weather.`;
      } else {
        result.reply = `Couldn't find "${result.courseQuery}" — try a town name or zip code.`;
      }
    } catch (e) {
      result.reply = "Couldn't reach the location service — try again in a bit.";
    }
  }

  await saveUser(userId, user);

  res.status(200).json({
    speech: result.reply,
    ...(result.rec || {}),
    persistent, // false means state resets on cold starts — add Upstash env vars to fix
  });
}
