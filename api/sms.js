// POST /api/sms — Twilio inbound-message webhook.
// Point your Twilio number's "A message comes in" webhook here.
// The texter's phone number becomes their user id, so each person's bag and learning are theirs.
//
// Note: sending automated SMS to US numbers requires Twilio A2P 10DLC registration first.

import { handleMessage } from "../lib/engine.js";
import { getUser, saveUser } from "../lib/store.js";
import { weatherFor, geocode } from "../lib/weather.js";

function twiml(message) {
  const safe = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`;
}

async function readForm(req) {
  // Twilio posts application/x-www-form-urlencoded; parse the raw body defensively.
  if (req.body && typeof req.body === "object" && (req.body.Body || req.body.From)) return req.body;
  const raw = typeof req.body === "string" ? req.body : await new Promise((resolve) => {
    let data = "";
    req.on("data", c => (data += c));
    req.on("end", () => resolve(data));
  });
  return Object.fromEntries(new URLSearchParams(raw || ""));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("POST only");

  const form = await readForm(req);
  const text = (form.Body || "").toString();
  const from = (form.From || "").toString(); // e.g. +15165551234

  if (!from) return res.status(400).send("Missing From");

  const user = await getUser(from);

  // first contact: greet + help
  const isNew = !user.lastClub && user.session.events.length === 0 && !user.loc &&
    JSON.stringify(user.bag.map(c => c.carry)) === JSON.stringify([230,215,200,190,180,170,160,150,140,130,120,105,90,75]) &&
    !/\d/.test(text);

  const result = await handleMessage(user, text, weatherFor(null, null));

  if (result.courseQuery) {
    try {
      const loc = await geocode(result.courseQuery);
      result.reply = loc
        ? (user.loc = loc, `Home course set near ${loc.label}. I'll use that for weather.`)
        : `Couldn't find "${result.courseQuery}" — try a town name or zip.`;
    } catch (e) {
      result.reply = "Couldn't reach the location service — try again shortly.";
    }
  }

  if (isNew && !result.rec) {
    result.reply = 'Caddy here. Text me like a caddy: "150 rough into the wind". After the shot, text "short", "long", "flush", or "mishit" and I learn your game. Set weather with "course <town or zip>". Text "help" anytime.';
  }

  await saveUser(from, user);

  res.setHeader("Content-Type", "text/xml");
  res.status(200).send(twiml(result.reply));
}
