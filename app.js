// ============================================================================
// MimoRoute · AI Travel Planner
// 5-agent pipeline: Geocoder → Scout → Curator → Router → Narrator
// Free APIs: Nominatim, Overpass, OSRM, Pollinations (MiMo V2.5)
// ============================================================================

// ---------- CONFIG ----------
const NOMINATIM = 'https://nominatim.openstreetmap.org';
const OVERPASS  = 'https://overpass-api.de/api/interpreter';
const OSRM      = 'https://router.project-osrm.org';
const POLI      = 'https://text.pollinations.ai/openai';
const REFERRER  = 'mimoroute';
const UA        = 'mimoroute/1.0 (https://gyoomei.github.io/mimoroute)';

// vibe → OSM amenity/tourism filters
const VIBE_QUERY = {
  food:    `node["amenity"~"^(restaurant|food_court)$"]`,
  cafe:    `node["amenity"~"^(cafe|ice_cream)$"]`,
  culture: `node["tourism"~"^(museum|gallery|attraction|artwork)$"];way["tourism"~"^(museum|gallery|attraction)$"]`,
  nature:  `node["leisure"~"^(park|garden|nature_reserve)$"];way["leisure"~"^(park|garden|nature_reserve)$"];node["natural"~"^(beach|peak|waterfall)$"]`,
  nightlife:`node["amenity"~"^(bar|pub|nightclub|biergarten)$"]`,
  shop:    `node["shop"~"^(mall|department_store|gift|art|craft|books)$"]`,
  history: `node["historic"];way["historic"]`,
  family:  `node["leisure"~"^(playground|water_park|theme_park|zoo)$"];way["tourism"="theme_park"]`,
};

// Standard pipeline = food + culture; user can add/swap
const VIBES = [
  { id: 'food',     icon: '🍜', label: { en: 'Food',       id: 'Kuliner'   } },
  { id: 'cafe',     icon: '☕', label: { en: 'Cafe',       id: 'Kafe'      } },
  { id: 'culture',  icon: '🏛️', label: { en: 'Culture',    id: 'Budaya'    } },
  { id: 'nature',   icon: '🌿', label: { en: 'Nature',     id: 'Alam'      } },
  { id: 'history',  icon: '🏯', label: { en: 'History',    id: 'Sejarah'   } },
  { id: 'shop',     icon: '🛍️', label: { en: 'Shopping',   id: 'Belanja'   } },
  { id: 'nightlife',icon: '🍸', label: { en: 'Nightlife',  id: 'Malam'     } },
  { id: 'family',   icon: '👨‍👩‍👧', label: { en: 'Family',     id: 'Keluarga'  } },
];

const EXAMPLES = [
  'Bali, Indonesia',
  'Tokyo, Japan',
  'Barcelona, Spain',
  'Yogyakarta, Indonesia',
  'Lisbon, Portugal',
  'Chiang Mai, Thailand',
];

// ---------- STATE ----------
const state = {
  lang: localStorage.getItem('mr-lang') || 'en',
  theme: localStorage.getItem('mr-theme') || 'dark',
  vibes: new Set(['food', 'culture']),
  itinerary: null, // last result
  city: null,
};

// ---------- I18N ----------
const T = {
  en: {
    eyebrow: 'AI Travel Planner · MiMo V2.5',
    heroH1: 'Tell me a city. Get a <em>real</em> day plan.',
    heroSub: 'Five agents geocode, scout, curate, route, and narrate — turning any city, budget, and time window into a multi-stop itinerary with cafes, food, culture, and walking legs between stops.',
    pill1: '🆓 No API key', pill2: '🌍 200+ countries', pill3: '📍 OpenStreetMap data', pill4: '🚶 OSRM walking routes',
    lblCity: 'Destination city',
    lblDuration: 'Time available',
    lblBudget: 'Budget tier',
    lblVibe: 'Vibe (pick any, default = food + culture)',
    dur3: '3 hours · half-day', dur6: '6 hours · full day', dur10: '10 hours · long day', dur20: '2 days · weekend',
    bgLow: 'Backpacker · < $30', bgMid: 'Comfort · $30–80', bgHigh: 'Premium · $80+',
    ctaPlan: 'Plan my route →',
    ctaPlanning: 'Planning…',
    ag1: 'Geocoder agent · resolving city',
    ag2: 'Scout agent · fetching POIs',
    ag3: 'Curator agent · selecting stops',
    ag4: 'Router agent · computing legs',
    ag5: 'Narrator agent · writing day plan',
    copy: 'Copy itinerary', share: 'Share link', openMap: 'Open in OSM',
    footerLine: 'Made with 🔥 by <a href="https://github.com/gyoomei">@gyoomei</a> · Powered by <a href="https://www.xiaomimimo.com/">Xiaomi MiMo V2.5</a> via Pollinations · Data from <a href="https://openstreetmap.org">OpenStreetMap</a> &amp; <a href="https://project-osrm.org">OSRM</a>',
    errEmpty: 'Type a city first — e.g. "Bali" or "Tokyo".',
    errCity: 'Could not find that city. Try adding the country (e.g. "Bali, Indonesia").',
    errPois: 'No matching places found. Try a different vibe combination.',
    errNet: 'Network error — check connection and try again.',
    statStops: 'Stops', statDist: 'Distance', statTime: 'Walking', statBudget: 'Est. spend',
    leg: 'Walk', leg_to: 'to next',
    titleTpl: 'Day plan for {city}',
    metaTpl: '{stops} stops · {hours}h plan · {vibes}',
    copied: 'Copied ✓',
    narratorLabel: 'Narrator agent',
  },
  id: {
    eyebrow: 'Perencana Perjalanan AI · MiMo V2.5',
    heroH1: 'Sebut kotanya. Dapat rencana <em>asli</em> sehari.',
    heroSub: 'Lima agent ngegeocode, scout, kurasi, routing, dan menulis cerita — ubah kota, budget, dan jam yang kamu punya jadi itinerary multi-stop lengkap dengan kafe, kuliner, budaya, dan rute jalan kaki antar tempat.',
    pill1: '🆓 Tanpa API key', pill2: '🌍 200+ negara', pill3: '📍 Data OpenStreetMap', pill4: '🚶 Rute jalan OSRM',
    lblCity: 'Kota tujuan',
    lblDuration: 'Waktu tersedia',
    lblBudget: 'Tingkat budget',
    lblVibe: 'Suasana (pilih bebas, default = kuliner + budaya)',
    dur3: '3 jam · setengah hari', dur6: '6 jam · sehari penuh', dur10: '10 jam · seharian', dur20: '2 hari · akhir pekan',
    bgLow: 'Backpacker · < $30', bgMid: 'Nyaman · $30–80', bgHigh: 'Premium · $80+',
    ctaPlan: 'Susun rute →',
    ctaPlanning: 'Menyusun…',
    ag1: 'Geocoder agent · cari koordinat kota',
    ag2: 'Scout agent · ambil daftar tempat',
    ag3: 'Curator agent · pilih stop terbaik',
    ag4: 'Router agent · hitung rute jalan',
    ag5: 'Narrator agent · tulis cerita harian',
    copy: 'Salin itinerary', share: 'Salin link', openMap: 'Buka di OSM',
    footerLine: 'Dibuat dengan 🔥 oleh <a href="https://github.com/gyoomei">@gyoomei</a> · Powered by <a href="https://www.xiaomimimo.com/">Xiaomi MiMo V2.5</a> via Pollinations · Data dari <a href="https://openstreetmap.org">OpenStreetMap</a> &amp; <a href="https://project-osrm.org">OSRM</a>',
    errEmpty: 'Ketik nama kota dulu — contoh "Bali" atau "Tokyo".',
    errCity: 'Kota tidak ketemu. Coba tambahin negaranya (contoh: "Bali, Indonesia").',
    errPois: 'Belum ada tempat yang cocok. Coba kombinasi suasana lain.',
    errNet: 'Koneksi bermasalah — cek internet lalu coba lagi.',
    statStops: 'Stop', statDist: 'Jarak', statTime: 'Jalan kaki', statBudget: 'Estimasi biaya',
    leg: 'Jalan', leg_to: 'ke berikutnya',
    titleTpl: 'Rencana sehari di {city}',
    metaTpl: '{stops} stop · rencana {hours} jam · {vibes}',
    copied: 'Tersalin ✓',
    narratorLabel: 'Narrator agent',
  },
};

const t = (k) => T[state.lang][k] ?? k;

// ---------- UTILS ----------
const $ = (id) => document.getElementById(id);
const fmtKm = (m) => m < 1000 ? `${Math.round(m)} m` : `${(m/1000).toFixed(1)} km`;
const fmtMin = (s) => s < 60 ? '< 1 min' : `${Math.round(s/60)} min`;
const fmtUsd = (n) => `$${Math.round(n)}`;
const haversine = (a, b) => {
  const R = 6371000, toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const x = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(x));
};
const slug = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---------- AGENT 1 — GEOCODER ----------
async function agentGeocode(city) {
  setStep(1, 'active');
  const url = `${NOMINATIM}/search?q=${encodeURIComponent(city)}&format=json&limit=1&addressdetails=1`;
  const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!r.ok) throw new Error('geocode_failed');
  const arr = await r.json();
  if (!arr || !arr.length) throw new Error('city_not_found');
  const hit = arr[0];
  setStep(1, 'done');
  return {
    name: (hit.address?.city || hit.address?.town || hit.address?.village || hit.address?.county || hit.name || hit.display_name.split(',')[0]).trim(),
    full: hit.display_name,
    country: hit.address?.country || '',
    lat: parseFloat(hit.lat),
    lon: parseFloat(hit.lon),
    bbox: hit.boundingbox?.map(parseFloat),
  };
}

// ---------- AGENT 2 — SCOUT (Overpass) ----------
async function agentScout(city, vibes) {
  setStep(2, 'active');
  const radius = pickRadius(city); // adaptive based on city size
  const queries = [...vibes].map((v) => VIBE_QUERY[v])
    .filter(Boolean).join(';')
    .replace(/(\bnode|\bway)\[/g, `$1(around:${radius},${city.lat},${city.lon})[`);
  const data = `[out:json][timeout:18];(${queries};);out center 60;`;
  const r = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(data),
  });
  if (!r.ok) throw new Error('overpass_failed');
  const json = await r.json();
  const pois = (json.elements || []).map((el) => {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (!lat || !lon || !el.tags) return null;
    const cat = classify(el.tags);
    return {
      id: el.id,
      name: el.tags.name || el.tags['name:en'] || null,
      lat, lon,
      category: cat,
      cuisine: el.tags.cuisine || null,
      website: el.tags.website || el.tags['contact:website'] || null,
      hours: el.tags.opening_hours || null,
      tags: el.tags,
    };
  }).filter(p => p && p.name);
  setStep(2, 'done', `${pois.length} POIs`);
  if (!pois.length) throw new Error('no_pois');
  return pois;
}
const pickRadius = (c) => {
  // heuristic — bigger bbox = wider radius cap
  if (!c.bbox) return 4000;
  const span = Math.abs(c.bbox[1] - c.bbox[0]) + Math.abs(c.bbox[3] - c.bbox[2]);
  if (span > 1.0)  return 12000; // metros / regions
  if (span > 0.4)  return 7000;
  if (span > 0.15) return 4500;
  return 2500;
};
function classify(tags) {
  if (tags.amenity === 'cafe' || tags.amenity === 'ice_cream') return 'cafe';
  if (tags.amenity === 'restaurant' || tags.amenity === 'food_court') return 'food';
  if (tags.amenity === 'bar' || tags.amenity === 'pub' || tags.amenity === 'nightclub' || tags.amenity === 'biergarten') return 'nightlife';
  if (tags.tourism === 'museum' || tags.tourism === 'gallery' || tags.tourism === 'artwork') return 'culture';
  if (tags.tourism === 'attraction' || tags.tourism === 'theme_park') return 'culture';
  if (tags.historic) return 'history';
  if (tags.leisure === 'park' || tags.leisure === 'garden' || tags.leisure === 'nature_reserve' || tags.natural) return 'nature';
  if (tags.shop) return 'shop';
  if (tags.leisure === 'playground' || tags.leisure === 'water_park' || tags.leisure === 'zoo') return 'family';
  return 'other';
}

// ---------- AGENT 3 — CURATOR ----------
function agentCurate(pois, vibes, durationH, city) {
  setStep(3, 'active');
  // target stops by duration
  const targetStops = durationH <= 3 ? 4 : durationH <= 6 ? 6 : durationH <= 10 ? 8 : 12;
  // bias: keep balance across vibes, prefer named & reasonably-distinct locations
  const byCat = {};
  pois.forEach(p => { (byCat[p.category] ||= []).push(p); });
  const orderedCats = [...vibes];
  // Score each POI: shorter dist from city center weighted moderately
  pois.forEach(p => {
    p._d = haversine(p, city);
    p._score = -p._d / 1000 + (p.cuisine ? 0.3 : 0) + (p.hours ? 0.2 : 0) + (p.website ? 0.15 : 0);
  });
  Object.values(byCat).forEach(arr => arr.sort((a, b) => b._score - a._score));

  // round-robin pick across vibes; dedupe via name+catkey
  const picked = [];
  const seen = new Set();
  let safety = 200;
  while (picked.length < targetStops && safety-- > 0) {
    let progressed = false;
    for (const v of orderedCats) {
      const arr = byCat[v];
      if (!arr || !arr.length) continue;
      const next = arr.shift();
      if (!next) continue;
      const key = (next.name + '_' + next.category).toLowerCase();
      if (seen.has(key)) continue;
      // skip if too close (<120m) to existing pick
      if (picked.some(s => haversine(s, next) < 120)) continue;
      seen.add(key);
      picked.push(next);
      progressed = true;
      if (picked.length >= targetStops) break;
    }
    if (!progressed) break;
  }
  // re-order: greedy nearest-neighbor TSP starting from city center
  const ordered = [];
  let cur = city;
  const remaining = picked.slice();
  while (remaining.length) {
    let bestI = 0, bestD = Infinity;
    remaining.forEach((p, i) => {
      const d = haversine(cur, p);
      if (d < bestD) { bestD = d; bestI = i; }
    });
    const next = remaining.splice(bestI, 1)[0];
    ordered.push(next);
    cur = next;
  }
  // assign time slots (linear across duration)
  const startH = durationH >= 20 ? 9 : Math.max(8, 12 - Math.round(durationH/2));
  const slot = durationH / Math.max(1, ordered.length);
  ordered.forEach((p, i) => {
    const h = startH + slot * i;
    p.timeStart = formatHm(h);
    p.timeEnd   = formatHm(h + slot * 0.7);
  });
  setStep(3, 'done', `${ordered.length} stops`);
  return ordered;
}
function formatHm(h) {
  const day = h >= 24 ? '+1' : '';
  const hh = Math.floor(h % 24);
  const mm = Math.round((h - Math.floor(h)) * 60) % 60;
  return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}${day}`;
}

// ---------- AGENT 4 — ROUTER (OSRM) ----------
async function agentRoute(stops) {
  setStep(4, 'active');
  if (stops.length < 2) { setStep(4, 'done', '0 legs'); return { legs: [], totalDist: 0, totalDur: 0 }; }
  // OSRM walking, batch as a single multi-waypoint request
  const coords = stops.map(s => `${s.lon},${s.lat}`).join(';');
  const url = `${OSRM}/route/v1/foot/${coords}?overview=false&steps=false`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('osrm_failed');
  const json = await r.json();
  if (!json.routes?.length) throw new Error('osrm_no_route');
  const legs = json.routes[0].legs.map(l => ({ distance: l.distance, duration: l.duration }));
  setStep(4, 'done', `${legs.length} legs · ${(json.routes[0].distance/1000).toFixed(1)}km`);
  return { legs, totalDist: json.routes[0].distance, totalDur: json.routes[0].duration };
}

// ---------- AGENT 5 — NARRATOR (MiMo V2.5 via Pollinations) ----------
async function agentNarrate({ city, stops, durationH, budget, vibes, totalKm }) {
  setStep(5, 'active');
  const stopList = stops.map((s, i) => `${i+1}. ${s.name} (${s.category}${s.cuisine ? ', ' + s.cuisine : ''})`).join('\n');
  const langDir = state.lang === 'id'
    ? `WAJIB Bahasa Indonesia BAKU. DILARANG: mahu, sebab, kerana, awak, pula, tetapi, ialah, kalian. PAKAI: mau, karena, kamu, juga, tapi, adalah. Jangan campur Inggris/Melayu kecuali nama tempat asli.`
    : `Reply in clear, conversational English. Do not mix in Indonesian, Malay, or other languages.`;
  const sys = `You are a smart, warm local-guide narrator for a travel route in ${city.name}, ${city.country}. Write a 3-4 sentence intro paragraph for this day plan. Speak directly to the traveler ("you"). Mention how the route flows (morning energy → midday substance → afternoon culture → evening wind-down — adapt to actual stops). Drop ONE specific local cultural detail (food, ritual, or geography). NO bullet lists. NO headings. Plain prose only. ${langDir}`;
  const user = `Trip: ${durationH}h, ${budget} budget, vibes: ${[...vibes].join(', ')}.\nStops:\n${stopList}\nTotal walking: ${totalKm.toFixed(1)} km.`;

  let text = '';
  try {
    const r = await fetch(`${POLI}?referrer=${REFERRER}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai-fast',
        messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
        referrer: REFERRER,
        temperature: 0.75,
      }),
    });
    if (r.ok) {
      const json = await r.json();
      text = json.choices?.[0]?.message?.content?.trim() || '';
    }
  } catch (_) { /* fallback below */ }
  // Fallback narrative if AI is rate-limited
  if (!text || text.length < 30) {
    text = state.lang === 'id'
      ? `Rencana ini ngajak kamu nyusurin ${city.name} dengan ritme yang manusiawi — mulai dari titik energi pagi, lanjut ke pusat aktivitas siang, baru turun ke ketenangan sore. ${stops.length} stop disusun by walking-distance jadi kamu bisa ngerasain tempo kotanya tanpa buru-buru. Total jalan kaki sekitar ${totalKm.toFixed(1)} km — wajar untuk ${durationH} jam, sambil sempet duduk dan menikmati setiap stop.`
      : `This route walks you through ${city.name} at a human tempo — starting with morning energy, settling into the midday density, then easing into the afternoon calm. The ${stops.length} stops are arranged by proximity so you feel the city's rhythm without rushing. Total ${totalKm.toFixed(1)} km of walking is reasonable for ${durationH} hours, leaving room to actually sit at each spot.`;
  }
  // Anti-Bahasa-Melayu safety net (per skill pitfall #21a)
  if (state.lang === 'id') {
    const fix = [
      [/\bmahu\b/gi, 'mau'], [/\bsebab\b/gi, 'karena'], [/\bkerana\b/gi, 'karena'],
      [/\bawak\b/gi, 'kamu'], [/\bpula\b/gi, 'juga'], [/\btetapi\b/gi, 'tapi'],
      [/\bialah\b/gi, 'adalah'], [/\bkalian\b/gi, 'kalian'], [/\blazat\b/gi, 'enak'],
      [/\bsedap\b/gi, 'enak'], [/\bsuka\b ada\b/gi, 'sering ada'],
    ];
    fix.forEach(([re, rep]) => { text = text.replace(re, rep); });
  }
  setStep(5, 'done');
  return text;
}

// ---------- ORCHESTRATOR ----------
async function plan() {
  const cityRaw = $('city-input').value.trim();
  if (!cityRaw) return showError(t('errEmpty'));

  const durationH = parseFloat($('duration').value);
  const budget = $('budget').value;
  const vibes = state.vibes.size ? state.vibes : new Set(['food', 'culture']);

  hideError();
  $('result').classList.remove('on');
  $('loading').classList.add('on');
  resetSteps();
  $('plan-btn').disabled = true;
  $('plan-btn').textContent = t('ctaPlanning');

  try {
    const city = await agentGeocode(cityRaw);
    state.city = city;
    const pois = await agentScout(city, vibes);
    const stops = agentCurate(pois, vibes, durationH, city);
    const { legs, totalDist, totalDur } = await agentRoute(stops);
    const totalKm = totalDist / 1000;
    const narrative = await agentNarrate({ city, stops, durationH, budget, vibes, totalKm });

    // budget estimate
    const perStopUsd = budget === 'low' ? 6 : budget === 'mid' ? 14 : 32;
    const estSpend = stops.length * perStopUsd;

    state.itinerary = { city, stops, legs, totalDist, totalDur, durationH, budget, vibes: [...vibes], narrative, estSpend };
    render(state.itinerary);

    // update URL
    const u = new URL(location.href);
    u.searchParams.set('city', cityRaw);
    u.searchParams.set('h', String(durationH));
    u.searchParams.set('b', budget);
    u.searchParams.set('v', [...vibes].join(','));
    u.searchParams.set('lang', state.lang);
    history.replaceState(null, '', u.toString());
  } catch (e) {
    console.error('[plan]', e);
    if (e.message === 'city_not_found' || e.message === 'geocode_failed') showError(t('errCity'));
    else if (e.message === 'no_pois') showError(t('errPois'));
    else showError(`${t('errNet')} (${e.message || 'unknown'})`);
  } finally {
    $('loading').classList.remove('on');
    $('plan-btn').disabled = false;
    $('plan-btn').textContent = t('ctaPlan');
  }
}

// ---------- RENDER ----------
function render(it) {
  $('resTitle').textContent = t('titleTpl').replace('{city}', it.city.name);
  $('resMeta').textContent = t('metaTpl')
    .replace('{stops}', it.stops.length)
    .replace('{hours}', it.durationH)
    .replace('{vibes}', it.vibes.map(v => VIBES.find(x => x.id === v)?.label[state.lang] || v).join(' · '));

  $('narrative').innerHTML = `<span class="narrator-label">${t('narratorLabel')} · MiMo V2.5</span>${escapeHtml(it.narrative)}`;

  const km = (it.totalDist / 1000).toFixed(1);
  $('stats').innerHTML = `
    <div class="stat"><div class="stat-label">${t('statStops')}</div><div class="stat-val">${it.stops.length}</div></div>
    <div class="stat"><div class="stat-label">${t('statDist')}</div><div class="stat-val">${km}<span style="font-size:13px"> km</span></div></div>
    <div class="stat"><div class="stat-label">${t('statTime')}</div><div class="stat-val">${Math.round(it.totalDur/60)}<span style="font-size:13px"> min</span></div></div>
    <div class="stat"><div class="stat-label">${t('statBudget')}</div><div class="stat-val">${fmtUsd(it.estSpend)}</div><div class="stat-sub">${it.budget}</div></div>
  `;

  // timeline
  const lines = [];
  it.stops.forEach((s, i) => {
    const vibeMeta = VIBES.find(v => v.id === s.category);
    const catLabel = (vibeMeta ? `${vibeMeta.icon} ${vibeMeta.label[state.lang]}` : s.category) + (s.cuisine ? ` · ${s.cuisine}` : '');
    const tip = stopTip(s, i, it.stops.length);
    const osmLink = `https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lon}#map=18/${s.lat}/${s.lon}`;
    const gmapLink = `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lon}`;
    lines.push(`
      <div class="stop" data-num="${i+1}">
        <div class="stop-head">
          <div class="stop-name">${escapeHtml(s.name)}</div>
          <div class="stop-time">${s.timeStart} – ${s.timeEnd}</div>
        </div>
        <div class="stop-cat">${catLabel}</div>
        <div class="stop-tip">${escapeHtml(tip)}</div>
        <div class="stop-foot">
          ${s.hours ? `<span>🕐 ${escapeHtml(s.hours)}</span>` : ''}
          ${s.website ? `<a href="${escapeAttr(s.website)}" target="_blank" rel="noopener">🔗 site</a>` : ''}
          <a href="${osmLink}" target="_blank" rel="noopener">📍 OSM</a>
          <a href="${gmapLink}" target="_blank" rel="noopener">🗺️ Google</a>
        </div>
      </div>
    `);
    if (i < it.stops.length - 1 && it.legs[i]) {
      const leg = it.legs[i];
      lines.push(`<div class="leg"><span class="leg-mode">${t('leg')}</span> · ${fmtKm(leg.distance)} · ${fmtMin(leg.duration)} ${t('leg_to')} stop ${i+2}</div>`);
    }
  });
  $('timeline').innerHTML = lines.join('');

  $('result').classList.add('on');
  $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function stopTip(s, idx, total) {
  const dayPart = idx === 0 ? 'kickoff' : idx === total - 1 ? 'closer' : idx === Math.floor(total/2) ? 'midpoint' : 'mid';
  const cat = s.category;
  if (state.lang === 'id') {
    const opts = {
      cafe:    [`Mulai di ${s.name} buat ngumpulin energi sambil ngamatin ritme kota.`, `Stop kafe yang tepat untuk reset sebelum lanjut.`],
      food:    [`Makanan di ${s.name} cukup substantial — tempat ideal kalau perut udah kosong.`, `Coba menu lokal yang khas tempat ini.`],
      culture: [`Sisihkan 30–45 menit di ${s.name} biar bener-bener bisa nyerap konteksnya, bukan cuma foto-foto.`, `Tempat ini biasanya lebih sepi pas pagi atau jelang sore.`],
      nature:  [`Ruang hijau seperti ${s.name} kasih jeda yang dibutuhin antara stop yang padat.`, `Cocok dipakai duduk sebentar dan bernapas.`],
      history: [`Pelajari sedikit konteks sejarah ${s.name} sebelum masuk biar lebih bermakna.`, `Banyak detail yang baru kelihatan kalau kamu jalan pelan.`],
      shop:    [`${s.name} cocok kalau kamu mau cari oleh-oleh atau lihat produk lokal.`, `Tawar dengan sopan kalau di pasar tradisional.`],
      nightlife:[`${s.name} adalah closer yang pas — energi malam yang khas kota ini.`, `Mulai pelan, lihat ritme tempatnya dulu.`],
      family:  [`Tempat ramah keluarga, anak-anak bakal dapet ruang gerak.`, `Bawa air dan camilan ringan.`],
      other:   [`Pas untuk istirahat sejenak sebelum lanjut ke stop berikutnya.`],
    };
    const arr = opts[cat] || opts.other;
    return arr[idx % arr.length];
  } else {
    const opts = {
      cafe:    [`Start at ${s.name} to gather energy while reading the city's rhythm.`, `A clean cafe stop to reset before pushing on.`],
      food:    [`The food at ${s.name} is substantial — perfect when the tank is empty.`, `Try whatever's most local here.`],
      culture: [`Give ${s.name} 30–45 minutes so the context lands instead of just photos.`, `Mornings or late afternoons here tend to be quieter.`],
      nature:  [`Green space like ${s.name} gives you the breather between dense stops.`, `Sit for a moment, decompress.`],
      history: [`Skim a bit of ${s.name}'s history before walking in — the details land harder.`, `Slow walking surfaces what fast walking misses.`],
      shop:    [`${s.name} is your souvenir + local-product moment.`, `Negotiate politely if it's a traditional market.`],
      nightlife:[`${s.name} is a fitting closer — the city's evening signature.`, `Start slow, read the room first.`],
      family:  [`Family-friendly stop with room for kids to move.`, `Bring water and light snacks.`],
      other:   [`A short pause before the next stop.`],
    };
    const arr = opts[cat] || opts.other;
    return arr[idx % arr.length];
  }
}

function escapeHtml(s) { return (s || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function escapeAttr(s) { return escapeHtml(s); }

// ---------- LOADING STEPS ----------
function setStep(n, status, meta) {
  const el = document.querySelector(`.agent-step[data-step="${n}"]`);
  if (!el) return;
  el.classList.remove('active', 'done');
  if (status) el.classList.add(status);
  if (meta) {
    const m = el.querySelector('.step-meta');
    if (m) m.textContent = meta;
  }
}
function resetSteps() { for (let i = 1; i <= 5; i++) setStep(i, ''); }

function showError(msg) { const e = $('error'); e.textContent = msg; e.classList.add('on'); }
function hideError() { $('error').classList.remove('on'); }

// ---------- COPY / SHARE ----------
function copyItinerary() {
  if (!state.itinerary) return;
  const it = state.itinerary;
  const lines = [];
  lines.push(`${t('titleTpl').replace('{city}', it.city.name)}`);
  lines.push('—'.repeat(40));
  lines.push(it.narrative);
  lines.push('');
  it.stops.forEach((s, i) => {
    lines.push(`${i+1}. [${s.timeStart}] ${s.name} (${s.category}${s.cuisine ? ', ' + s.cuisine : ''})`);
    if (i < it.stops.length - 1 && it.legs[i]) {
      lines.push(`   ↓ ${fmtKm(it.legs[i].distance)} · ${fmtMin(it.legs[i].duration)}`);
    }
  });
  lines.push('');
  lines.push(`${(it.totalDist/1000).toFixed(1)} km · ${Math.round(it.totalDur/60)} min · est ${fmtUsd(it.estSpend)}`);
  lines.push('via MimoRoute · https://gyoomei.github.io/mimoroute/');
  navigator.clipboard.writeText(lines.join('\n')).then(() => flashBtn('copy-btn', t('copied')));
}
function shareLink() {
  navigator.clipboard.writeText(location.href).then(() => flashBtn('share-btn', t('copied')));
}
function openMap() {
  if (!state.itinerary) return;
  const it = state.itinerary;
  const c = it.city;
  const url = `https://www.openstreetmap.org/?mlat=${c.lat}&mlon=${c.lon}#map=14/${c.lat}/${c.lon}`;
  window.open(url, '_blank', 'noopener');
}
function flashBtn(id, label) {
  const el = $(id);
  const span = el.querySelector('span');
  if (!span) return;
  const orig = span.textContent;
  span.textContent = label;
  setTimeout(() => { span.textContent = orig; }, 1600);
}

// ---------- LANG / THEME / RENDER STATIC ----------
function applyLang() {
  document.documentElement.lang = state.lang;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  $('lang-btn').textContent = state.lang === 'en' ? 'EN' : 'ID';
  renderVibes();
  renderExamples();
  if (state.itinerary) render(state.itinerary);
  localStorage.setItem('mr-lang', state.lang);
}
function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  $('theme-btn').textContent = state.theme === 'dark' ? '☾' : '☀';
  localStorage.setItem('mr-theme', state.theme);
}
function renderVibes() {
  const wrap = $('vibes');
  wrap.innerHTML = '';
  VIBES.forEach(v => {
    const b = document.createElement('button');
    b.className = 'vibe' + (state.vibes.has(v.id) ? ' on' : '');
    b.dataset.id = v.id;
    b.innerHTML = `<span class="vibe-icon">${v.icon}</span>${v.label[state.lang]}`;
    b.addEventListener('click', () => {
      if (state.vibes.has(v.id)) state.vibes.delete(v.id);
      else state.vibes.add(v.id);
      if (!state.vibes.size) state.vibes.add('food');
      renderVibes();
    });
    wrap.appendChild(b);
  });
}
function renderExamples() {
  const wrap = $('examples');
  wrap.innerHTML = '';
  EXAMPLES.forEach(ex => {
    const b = document.createElement('button');
    b.className = 'example';
    b.textContent = ex;
    b.addEventListener('click', () => { $('city-input').value = ex; });
    wrap.appendChild(b);
  });
}

// ---------- INIT ----------
function init() {
  applyTheme();
  applyLang();

  $('lang-btn').addEventListener('click', () => {
    state.lang = state.lang === 'en' ? 'id' : 'en';
    applyLang();
  });
  $('theme-btn').addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme();
  });
  $('plan-btn').addEventListener('click', plan);
  $('city-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') plan(); });
  $('copy-btn').addEventListener('click', copyItinerary);
  $('share-btn').addEventListener('click', shareLink);
  $('map-btn').addEventListener('click', openMap);

  // restore from URL
  const u = new URL(location.href);
  const urlLang = u.searchParams.get('lang');
  if (urlLang === 'id' || urlLang === 'en') { state.lang = urlLang; applyLang(); }
  const urlCity = u.searchParams.get('city');
  if (urlCity) {
    $('city-input').value = urlCity;
    const h = u.searchParams.get('h'); if (h) $('duration').value = h;
    const b = u.searchParams.get('b'); if (b) $('budget').value = b;
    const v = u.searchParams.get('v');
    if (v) {
      state.vibes = new Set(v.split(',').filter(Boolean));
      renderVibes();
    }
    setTimeout(plan, 400);
  }
}

document.addEventListener('DOMContentLoaded', init);
