# Caddy

A golf caddy with one brain and three doors: a web app, a Siri Shortcut, and SMS.
Ask it "150 from the rough into the wind, uphill" and it tells you what club to hit —
adjusted for live weather, temperature, lie, elevation, and what it has learned about
your game.

## What's here

- `public/index.html` — the full web app (works standalone; add to home screen on a phone)
- `api/ask.js` — JSON API used by Siri Shortcuts (or anything else)
- `api/sms.js` — Twilio webhook so you can text the caddy
- `lib/engine.js` — the shared brain: parsing, club math, feedback learning

## How the caddy talks

Ask: `150 rough into the wind uphill`
Feedback after a shot: `short` · `long` · `flush` · `mishit` (chunked/fat/thin/shanked all count as mishit)
Combined: `short — now 140 from the fairway`
Commands: `bag` · `set 7 iron 155` · `course farmingdale ny` (or a zip) · `help` · `reset`

Learning: short/long nudges that club ±2 yds (capped ±12). Flush decays adjustments back
toward baseline. Mishits are ignored. Net 2+ shorts today = more club the rest of the
round; resets tomorrow.

## Siri Shortcut (hands-free with AirPods)

Build a Shortcut named **Ask Caddy**:

1. **Dictate Text**
2. **Get Current Location** (optional — enables live weather)
3. **Get Contents of URL** — `https://YOUR-DEPLOYMENT.vercel.app/api/ask`
   - Method: GET, Query items:
     - `user` = your name (any stable id)
     - `q` = Dictated Text (magic variable)
     - `lat` = Current Location ▸ Latitude
     - `lon` = Current Location ▸ Longitude
4. **Get Dictionary Value** — key: `speech`
5. **Speak Text** — the dictionary value

Then: "Hey Siri, Ask Caddy" → speak → hear the club in your AirPods. Assign the
shortcut to the Action Button on newer iPhones for one-press access.

## SMS via Twilio

1. Buy a number at twilio.com (~$1.15/mo)
2. Complete A2P 10DLC registration (required for US texting; takes days–2 weeks)
3. Set the number's messaging webhook ("A message comes in") to
   `https://YOUR-DEPLOYMENT.vercel.app/api/sms` (HTTP POST)
4. Text the number. First text gets a how-to reply. Each phone number gets its own
   bag and learning automatically.

## Making state survive (recommended)

Out of the box, user state lives in serverless memory and resets on cold starts.
For real persistence, create a free Redis database at upstash.com and add two
environment variables in Vercel (Project → Settings → Environment Variables):

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

No code changes needed — the store detects them.

## Deploy

Standard Vercel: `npx vercel --yes`. The `api/` folder becomes serverless functions,
`public/` is served as the site.
