// The caddie brain. Same math as the web app, shared by /api/ask (Siri, web) and /api/sms (Twilio).

export const DEFAULT_BAG = [
  ["Driver", 230], ["3 Wood", 215], ["5 Wood", 200], ["Hybrid", 190],
  ["4 Iron", 180], ["5 Iron", 170], ["6 Iron", 160], ["7 Iron", 150],
  ["8 Iron", 140], ["9 Iron", 130], ["PW", 120], ["GW", 105], ["SW", 90], ["LW", 75],
].map(([name, carry]) => ({ name, carry }));

export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function freshUser() {
  return { bag: DEFAULT_BAG.map(c => ({ ...c })), learn: {}, session: { date: todayKey(), events: [] }, loc: null, lastClub: null };
}

/* ---------- natural language parsing ---------- */
export function parseText(raw) {
  const t = (raw || "").toLowerCase().trim();
  const out = { distance: null, lie: "fairway", windRel: "none", elev: "flat", fb: null, command: null };

  // commands first
  let m = t.match(/^(?:set\s+)?course\s+(.+)/);           // "course farmingdale ny" / "set course 11735"
  if (m) { out.command = { type: "course", query: m[1].trim() }; return out; }
  m = t.match(/^set\s+(.+?)\s+(?:to\s+)?(\d{2,3})$/);      // "set 7 iron 155"
  if (m) { out.command = { type: "setclub", name: m[1].trim(), carry: parseInt(m[2], 10) }; return out; }
  if (/^(bag|my bag|clubs)$/.test(t)) { out.command = { type: "bag" }; return out; }
  if (/^(help|\?|commands)$/.test(t)) { out.command = { type: "help" }; return out; }
  if (/^reset$/.test(t)) { out.command = { type: "reset" }; return out; }

  // feedback about the previous shot
  if (/mis.?hit|chunk|fat|thin|topped|shank|duff/.test(t)) out.fb = "mishit";
  else if (/flush|pure|perfect|nailed|striped|\bgood\b/.test(t)) out.fb = "good";
  else if (/\bshort\b/.test(t) && !/short side/.test(t)) out.fb = "short";
  else if (/\blong\b|flew|airmail|\bover\b/.test(t)) out.fb = "long";

  // the ask
  const num = t.match(/(\d{2,3})/);
  if (num) out.distance = parseInt(num[1], 10);

  if (/deep/.test(t)) out.lie = "deep";
  else if (/rough/.test(t)) out.lie = "rough";
  else if (/sand|bunker/.test(t)) out.lie = "sand";
  else if (/\btee\b/.test(t)) out.lie = "tee";

  if (/into|against/.test(t)) out.windRel = "into";
  else if (/down\s?wind|helping|with the wind/.test(t)) out.windRel = "down";
  else if (/cross/.test(t)) out.windRel = "cross";

  if (/up\s?hill|elevated|raised/.test(t)) out.elev = "up";
  else if (/down\s?hill|below/.test(t)) out.elev = "downhill";

  return out;
}

/* ---------- feedback learning ---------- */
export function applyFeedback(user, fb) {
  if (!user.lastClub) return "I don't have a previous shot on record yet.";
  if (user.session.date !== todayKey()) user.session = { date: todayKey(), events: [] };
  const club = user.lastClub;

  if (fb === "mishit") return "No worries — mishits don't count against your numbers.";

  user.session.events.push({ club, fb });

  if (fb === "good") {
    const a = user.learn[club] || 0;
    if (a !== 0) user.learn[club] = a > 0 ? a - 1 : a + 1;
    return "Nice. That confirms your number.";
  }

  const delta = fb === "short" ? -2 : 2;
  user.learn[club] = clamp((user.learn[club] || 0) + delta, -12, 12);

  const shorts = user.session.events.filter(e => e.fb === "short").length;
  const longs = user.session.events.filter(e => e.fb === "long").length;
  const net = shorts - longs;
  let msg = fb === "short" ? `Got it — trimming your ${club} a touch.` : `Got it — your ${club} is flying today.`;
  if (net >= 2) msg += " You're running short today, so I'll lean toward more club the rest of the round.";
  if (net <= -2) msg += " You've got extra pop today, so I'll lean toward less club the rest of the round.";
  return msg;
}

/* ---------- recommendation ---------- */
export function recommend(user, { distance, lie, windRel, elev }, weather) {
  const ledger = [];
  let plays = distance;
  const mph = weather ? Math.round(weather.windMph) : 0;

  if (windRel === "into" && mph > 0) {
    const add = Math.round(distance * 0.01 * mph);
    plays += add; ledger.push([`Into wind ${mph} mph`, `+${add}`]);
  } else if (windRel === "down" && mph > 0) {
    const sub = Math.round(distance * 0.005 * mph);
    plays -= sub; ledger.push([`Helping wind ${mph} mph`, `-${sub}`]);
  } else if (windRel === "cross" && mph > 0) {
    ledger.push([`Crosswind ${mph} mph`, "aim"]);
  }

  if (weather && typeof weather.tempF === "number") {
    const delta = Math.round((70 - weather.tempF) / 10 * 2);
    if (delta !== 0) {
      plays += delta;
      ledger.push([`${weather.tempF < 70 ? "Cold" : "Warm"} air ${Math.round(weather.tempF)}F`, delta > 0 ? `+${delta}` : `${delta}`]);
    }
  }
  if (weather && weather.rain) { plays += 5; ledger.push(["Rain", "+5"]); }

  if (lie === "rough") { plays += 5; ledger.push(["Rough", "+5"]); }
  if (lie === "deep") { plays += 12; ledger.push(["Deep rough", "+12"]); }
  if (elev === "up") { plays += 8; ledger.push(["Uphill", "+8"]); }
  if (elev === "downhill") { plays -= 8; ledger.push(["Downhill", "-8"]); }

  // today's trend
  if (user.session.date === todayKey()) {
    const shorts = user.session.events.filter(e => e.fb === "short").length;
    const longs = user.session.events.filter(e => e.fb === "long").length;
    const trend = clamp((shorts - longs) * 3, -9, 9);
    if (trend !== 0) {
      plays += trend;
      ledger.push([trend > 0 ? "Running short today" : "Flying it today", trend > 0 ? `+${trend}` : `${trend}`]);
    }
  }

  plays = Math.max(10, Math.round(plays));

  const eff = c => c.carry + (user.learn[c.name] || 0);
  const sorted = [...user.bag].sort((a, b) => eff(a) - eff(b));
  let club = sorted.find(c => eff(c) >= plays);
  let tip = "";

  if (!club) {
    club = sorted[sorted.length - 1];
    tip = `That's more than your longest club carries — hit ${club.name} and plan the next shot.`;
  } else {
    const gap = eff(club) - plays;
    if (gap >= 8) tip = `Smooth swing — ${gap} yards in hand.`;
    else if (gap <= 2) tip = `Full send, or take one more club and swing easy.`;
    const adj = user.learn[club.name] || 0;
    if (adj <= -3) tip += ` Your ${club.name} has been ~${Math.abs(adj)} yds short lately — factored in.`;
    if (adj >= 3) tip += ` Your ${club.name} has been ~${adj} yds long lately — factored in.`;
  }
  if (lie === "deep") tip = `Priority one from deep rough is getting back in play. ${tip}`;
  if (lie === "sand") tip = `From sand take one extra club, ball back, commit. ${tip}`;
  if (windRel === "cross" && mph > 5) tip += ` Aim ${Math.round(mph / 2)}-${mph} yards into the wind and let it work.`;

  user.lastClub = club.name;

  const speech = `${plays === distance ? distance + " yards" : "Plays as " + plays}. Hit your ${club.name}.${tip ? " " + tip : ""}`;
  return { club: club.name, distance, plays, ledger, tip: tip.trim(), speech };
}

/* ---------- one entry point for every channel ---------- */
export async function handleMessage(user, text, weatherFn) {
  const p = parseText(text);

  if (p.command) {
    switch (p.command.type) {
      case "help":
        return { reply: 'Ask like: "150 rough into the wind uphill". After a shot, say "short", "long", "flush", or "mishit". Commands: "bag", "set 7 iron 155", "course <town or zip>", "reset".' };
      case "bag":
        return { reply: user.bag.map(c => `${c.name} ${c.carry + (user.learn[c.name] || 0)}`).join(", ") };
      case "reset":
        Object.assign(user, freshUser());
        return { reply: "Fresh start — default bag, no learned adjustments." };
      case "setclub": {
        const q = p.command.name.replace(/\s+/g, "").toLowerCase();
        const club = user.bag.find(c => c.name.replace(/\s+/g, "").toLowerCase() === q);
        if (club) { club.carry = p.command.carry; return { reply: `${club.name} set to ${club.carry} yards.` }; }
        user.bag.push({ name: p.command.name, carry: p.command.carry });
        return { reply: `Added ${p.command.name} at ${p.command.carry} yards.` };
      }
      case "course":
        return { reply: null, courseQuery: p.command.query }; // caller geocodes and saves
    }
  }

  let fbMsg = null;
  if (p.fb) fbMsg = applyFeedback(user, p.fb);

  if (p.distance) {
    let weather = null;
    try { weather = weatherFn ? await weatherFn(user) : null; } catch (e) { /* no weather, no adjustments */ }
    const rec = recommend(user, p, weather);
    if (!weather) rec.speech += " (No weather data — using raw numbers.)";
    if (fbMsg) rec.speech = fbMsg + " " + rec.speech;
    return { reply: rec.speech, rec };
  }

  if (fbMsg) return { reply: fbMsg };
  return { reply: 'Tell me a distance — like "150 from the rough into the wind". Text "help" for more.' };
}
