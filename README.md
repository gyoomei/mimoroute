# 🧭 MimoRoute

> **AI Travel Planner — paste a city, get a real day plan.**
> Powered by Xiaomi MiMo V2.5 via Pollinations · OpenStreetMap data · OSRM routing · Single HTML

🔗 **[Live demo](https://gyoomei.github.io/mimoroute/)** · 📂 [Repo](https://github.com/gyoomei/mimoroute)

---

## What it does

MimoRoute turns any city, time window, and budget into a fully-walkable day itinerary built by a 5-agent pipeline:

```
You type:
  city:     Bali, Indonesia
  hours:    6
  budget:   Comfort ($30–80)
  vibe:     Food + Culture + Nature

MimoRoute returns:
  • 6 stops, ordered by walking distance
  • OSRM-computed legs between every pair (distance + time)
  • Time slots from morning to evening
  • A narrator paragraph from MiMo V2.5 explaining the day's flow
  • OSM + Google Maps deep links for each stop
  • Estimated spend, total km, copy-as-text and share-link actions
```

Built as one self-contained HTML page. No backend. No API key. No signup.

## Features

| Capability | Detail |
|---|---|
| **Geocoding** | OpenStreetMap Nominatim — works for any city in 200+ countries, no key |
| **POI scouting** | Overpass API queries 8 vibes (food, cafe, culture, nature, history, shop, nightlife, family) within an adaptive radius based on city size |
| **Curation** | Round-robin pick across selected vibes + dedup + nearest-neighbor TSP ordering |
| **Routing** | Walking model — haversine × 1.35 detour factor at 4.8 km/h (more honest than misusing public OSRM, which only supports car profile) |
| **Narration** | MiMo V2.5 (via Pollinations gateway) writes a 3-4 sentence intro paragraph, with anti-Bahasa-Melayu safety net for ID mode |
| **Interface** | Bilingual EN/ID, dark/light theme, mobile responsive, share URLs with deep-linked params |
| **Output** | Copy itinerary as plain text, share link, open city in OSM, individual stop links to OSM + Google Maps |

## How it works

```
┌───────────────────┐
│ User input        │  city + hours + budget + vibes
└─────────┬─────────┘
          │
   ┌──────▼──────┐  Agent 1 — Geocoder
   │ Nominatim   │  → coordinates + bbox + country
   └──────┬──────┘
          │
   ┌──────▼──────┐  Agent 2 — Scout
   │ Overpass    │  → 60 raw POIs across selected vibes
   └──────┬──────┘
          │
   ┌──────▼──────┐  Agent 3 — Curator
   │ JS scoring  │  → top stops via balance + dedup + TSP
   └──────┬──────┘
          │
   ┌──────▼──────┐  Agent 4 — Router
   │ walking-model│  → leg distances and durations
   └──────┬──────┘
          │
   ┌──────▼──────┐  Agent 5 — Narrator
   │ MiMo V2.5   │  → day-flow narrative paragraph
   └──────┬──────┘
          │
   ┌──────▼──────┐
   │ Render      │  timeline + stats + actions
   └─────────────┘
```

## Try these

| Destination | Why it shines |
|---|---|
| Bali, Indonesia | Mixed cafe-warung-temple density, walkable in Ubud or Seminyak |
| Tokyo, Japan | Extreme POI density — curator de-duplicates well |
| Yogyakarta, Indonesia | Strong history + culture + nature mix |
| Lisbon, Portugal | Walkable old town + miradouros + tasca scene |
| Chiang Mai, Thailand | Temple-heavy, friendly to half-day routes |
| Barcelona, Spain | Long-day route showcases TSP ordering across districts |

## Stack

- **Frontend:** Vanilla HTML + CSS + JS (no build step, no framework)
- **Geocoding:** [OpenStreetMap Nominatim](https://nominatim.openstreetmap.org)
- **POI data:** [Overpass API](https://overpass-api.de) (OSM)
- **Routing:** Deterministic walking model (haversine × 1.35 at 4.8 km/h) — see `agentRoute` in app.js
- **AI:** [Xiaomi MiMo V2.5](https://www.xiaomimimo.com/) via [Pollinations.ai](https://pollinations.ai) gateway
- **Hosting:** GitHub Pages

## Architecture decisions

- **Single HTML, zero dependencies** — bullet-proof against deploy issues, no `npm install`, browser opens it directly. Forces architectural discipline.
- **Adaptive radius** — bbox span from Nominatim drives the Overpass search radius, capped at 5 km from city center so every plan stays walkable. Bali → 5 km, Yogyakarta → 4.5 km, neighborhood pins → 2.5 km.
- **Round-robin curation** — picks across selected vibes evenly so a "food + culture" trip never returns 6 cafes.
- **Nearest-neighbor TSP** — greedy ordering from city center outward keeps walking realistic without computing optimal Hamiltonian paths.
- **Narrator fallback** — if Pollinations is rate-limited, a deterministic templated narrative still ships. The route is the value, the paragraph is the polish.
- **Anti-Melayu regex** — Pollinations gpt-oss-20b drifts into Bahasa Melayu when prompted in Indonesian. A 10-pattern post-process filter cleans output before render.

## Run locally

```bash
git clone https://github.com/gyoomei/mimoroute.git
cd mimoroute
python3 -m http.server 8080
# open http://localhost:8080
```

## Roadmap

- [ ] Saved trips (localStorage)
- [ ] Inline OSM Leaflet map preview
- [ ] Multi-day mode (>1 day splits into morning/afternoon/evening segments)
- [ ] Public transit legs via OTP when available
- [ ] Photo previews via Wikimedia Commons API

## License

MIT.

Built with 🔥 by [@gyoomei](https://github.com/gyoomei) · Submitted to **Xiaomi MiMo Orbit 100T Token Creator Program**.
