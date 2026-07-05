# Deploying Caddy — no coding, no terminal, ~5 minutes

Everything happens in a web browser.

## Step 1 — Put the code on GitHub

1. Go to **github.com** and sign in (or create a free account)
2. Click the **+** in the top right → **New repository**
3. Name it `caddy` → leave everything else default → **Create repository**
4. On the new repo page, click the **"uploading an existing file"** link
5. Unzip `caddy-server.zip` on your computer, then **drag the contents of the
   caddy-server folder** (the `api`, `lib`, `public` folders and the loose files)
   into the upload area
6. Click **Commit changes**

> If the drag-and-drop won't take the folders, upload the loose files first, then
> open each folder on your computer and drag its files in — GitHub's uploader
> keeps folder structure when you drag folders from Finder/Explorer.

## Step 2 — Connect Vercel

1. Go to **vercel.com** → **Sign up** → choose **Continue with GitHub** (one click)
2. Click **Add New… → Project**
3. Your `caddy` repo appears in the list → click **Import**
4. Change nothing → click **Deploy**
5. ~30 seconds later you get a URL like `https://caddy-xyz.vercel.app`

That URL is your app:
- Open it on your phone → Share → **Add to Home Screen** = the Caddy app
- `https://YOUR-URL/api/ask?user=yourname&q=150+rough` = the API (try it in a browser!)

## Step 3 (recommended) — Make learning survive restarts

Without this, saved bags/learning reset whenever the server naps (it still works,
it just forgets between sessions).

1. Go to **upstash.com** → sign up free → **Create Database** (Redis, any region)
2. On the database page, copy the **REST URL** and **REST TOKEN**
3. In Vercel: your project → **Settings → Environment Variables** → add both:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
4. Vercel project → **Deployments** → ⋯ menu on the latest → **Redeploy**

## Step 4 (optional) — Siri Shortcut for AirPods

See README.md → "Siri Shortcut". Five actions in the Shortcuts app, then
"Hey Siri, Ask Caddy" works from a locked phone.

## Step 5 (optional, later) — SMS

See README.md → "SMS via Twilio". Requires buying a Twilio number and completing
US carrier registration, so treat it as a later milestone.
