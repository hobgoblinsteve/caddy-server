// Weather via Open-Meteo (free, no API key).

export async function currentWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,precipitation,wind_speed_10m,wind_direction_10m` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph`;
  const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error("weather fetch failed");
  const c = (await r.json()).current;
  return { tempF: c.temperature_2m, windMph: c.wind_speed_10m, windDeg: c.wind_direction_10m, rain: c.precipitation > 0 ? 1 : 0 };
}

// "farmingdale ny" or "11735" -> {lat, lon, label}
export async function geocode(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en`;
  const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error("geocode failed");
  const j = await r.json();
  const hit = j.results && j.results[0];
  if (!hit) return null;
  return { lat: hit.latitude, lon: hit.longitude, label: [hit.name, hit.admin1].filter(Boolean).join(", ") };
}

// Pick the best weather source for a user: explicit lat/lon beats saved course location.
export function weatherFor(lat, lon) {
  return async (user) => {
    if (lat != null && lon != null) return currentWeather(lat, lon);
    if (user.loc) return currentWeather(user.loc.lat, user.loc.lon);
    return null;
  };
}
