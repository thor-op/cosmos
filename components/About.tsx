'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { Github } from 'lucide-react';

const STACK = [
  { label: 'FRAMEWORK', value: 'Next.js 15 / React 19', sub: 'App Router · RSC · Streaming' },
  { label: 'RENDERING', value: '3D / WebGL', sub: 'Three.js · React Three Fiber · Drei' },
  { label: 'ANIMATION', value: 'Motion', sub: 'Spring physics · Layout animations' },
  { label: 'STYLING', value: 'Tailwind CSS v4', sub: 'Utility-first · CSS variables' },
  { label: 'LANGUAGE', value: 'TypeScript', sub: 'Strict mode · Full type safety' },
  { label: 'DEPLOYMENT', value: 'Edge Runtime', sub: 'Next.js API routes · ISR · NOAA/DONKI proxy' },
];

const APIS = [
  {
    id: '01',
    name: 'NASA InSight',
    endpoint: 'api.nasa.gov/insight_weather',
    desc: 'Seismic and atmospheric telemetry from the InSight lander at Elysium Planitia. Temperature, wind speed, and pressure recorded at the Martian surface.',
    color: 'var(--color-mars)',
    status: 'ARCHIVED',
  },
  {
    id: '02',
    name: 'NASA NeoWs',
    endpoint: 'api.nasa.gov/neo/rest/v1',
    desc: 'Near Earth Object Web Service. Tracks asteroids and comets with close approach data, hazard classification, velocity, and estimated diameter.',
    color: 'var(--color-neo)',
    status: 'LIVE',
  },
  {
    id: '03',
    name: 'WhereTheISS.at',
    endpoint: 'api.wheretheiss.at/v1',
    desc: 'Real-time orbital coordinates of the ISS. Latitude, longitude, altitude, and velocity updated every 5 seconds via polling.',
    color: 'var(--color-iss)',
    status: 'LIVE',
  },
  {
    id: '04',
    name: 'Open-Notify',
    endpoint: 'api.open-notify.org/astros',
    desc: 'Current crew manifest aboard the International Space Station. Proxied through a Next.js API route with 1-hour revalidation.',
    color: 'var(--color-iss)',
    status: 'LIVE',
  },
  {
    id: '05',
    name: 'Open-Meteo',
    endpoint: 'api.open-meteo.com/v1/forecast',
    desc: 'Free, open-source weather API. Powers local Earth conditions for Mars comparison and the full Earth Weather module — current conditions, 7-day forecast, UV, sunrise/sunset, and air quality.',
    color: '#38bdf8',
    status: 'LIVE',
  },
  {
    id: '06',
    name: 'Nominatim / OSM',
    endpoint: 'nominatim.openstreetmap.org/reverse',
    desc: 'Reverse geocoding for ISS ground track. Translates orbital coordinates into human-readable location names in real time.',
    color: '#ffffff',
    status: 'LIVE',
  },
  {
    id: '07',
    name: 'NASA APOD',
    endpoint: 'api.nasa.gov/planetary/apod',
    desc: 'Astronomy Picture of the Day. Returns the featured image or video with title, explanation, and copyright. Archive spans June 16, 1995 to present.',
    color: '#c084fc',
    status: 'LIVE',
  },
  {
    id: '08',
    name: 'NOAA SWPC',
    endpoint: 'services.swpc.noaa.gov/products',
    desc: 'Real-time solar wind plasma and magnetic field data (5-minute cadence). Estimated planetary Kp index updated every minute.',
    color: '#facc15',
    status: 'LIVE',
  },
  {
    id: '09',
    name: 'NASA DONKI',
    endpoint: 'api.nasa.gov/DONKI',
    desc: 'Space Weather Database of Notifications, Knowledge, Information. Solar flare events and coronal mass ejections for the last 30 days.',
    color: '#facc15',
    status: 'LIVE',
  },
  {
    id: '10',
    name: 'NASA EPIC',
    endpoint: 'api.nasa.gov/EPIC/api/natural',
    desc: 'Full-disk Earth imagery from DSCOVR at the L1 Lagrange point. Natural and enhanced color collections, up to 22 frames per day at 2048×2048px.',
    color: '#60a5fa',
    status: 'LIVE',
  },
  {
    id: '11',
    name: 'NOAA GOES-19 SUVI',
    endpoint: 'services.swpc.noaa.gov/images/animations/suvi',
    desc: 'Solar Ultraviolet Imager aboard GOES-19. Full-disk Sun imagery in 6 EUV wavelengths (94–304 Å), updated every few minutes.',
    color: '#fb923c',
    status: 'LIVE',
  },
  {
    id: '12',
    name: 'USGS Earthquake Hazards',
    endpoint: 'earthquake.usgs.gov/earthquakes/feed/v1.0',
    desc: 'Real-time GeoJSON feed of global seismic events. M2.5+ earthquakes for the past 7 days with magnitude, depth, coordinates, and timestamp.',
    color: '#4ade80',
    status: 'LIVE',
  },
  {
    id: '13',
    name: 'Open-Meteo Weather',
    endpoint: 'api.open-meteo.com/v1/forecast',
    desc: 'Free open-source weather API. Current conditions, 7-day forecast, UV index, sunrise/sunset, and precipitation for any coordinate on Earth. Also powers the air quality feed (US AQI, PM2.5, PM10).',
    color: '#38bdf8',
    status: 'LIVE',
  },
  {
    id: '14',
    name: '100,000 Stars — COSMOS',
    endpoint: 'stars.thorxop.dev',
    desc: 'Original Chrome Experiment by the Google Data Arts Team. 119,617 stars from the Hipparcos catalog with real XYZ positions, B-V color indices, spectral data, and named star systems. Embedded and restyled with custom HUD, narrated tour, and spectral mode.',
    color: '#a78bfa',
    status: 'STATIC',
  },
  {
    id: '15',
    name: 'Blitzortung Lightning Network',
    endpoint: 'ws.blitzortung.org',
    desc: 'Crowdsourced real-time global lightning detection network. WebSocket stream of strike coordinates, timestamps, and signal metadata from thousands of volunteer stations worldwide.',
    color: '#facc15',
    status: 'LIVE',
  },
  {
    id: '16',
    name: 'JTWC RSS — Tropical Storms',
    endpoint: 'metoc.navy.mil/jtwc/rss',
    desc: 'Joint Typhoon Warning Center RSS feed for active tropical cyclones. Storm name, category, coordinates, wind speed, pressure, and 5-day forecast track points.',
    color: '#34d399',
    status: 'LIVE',
  },
  {
    id: '17',
    name: 'NASA Deep Space Network',
    endpoint: 'eyes.nasa.gov/dsn/data/dsn.xml',
    desc: 'Live telemetry from the three DSN complexes — Goldstone, Madrid, and Canberra. Active dish targets, signal direction, uplink/downlink rates, and spacecraft identifiers updated every 5 seconds.',
    color: '#38bdf8',
    status: 'LIVE',
  },
  {
    id: '18',
    name: 'NASA LROC / Solar System Scope',
    endpoint: 'api/moon-texture (proxied)',
    desc: 'Lunar Reconnaissance Orbiter Camera color and displacement maps. High-resolution surface texture and topographic bump map for the interactive 3D Moon globe.',
    color: '#94a3b8',
    status: 'STATIC',
  },
  {
    id: '19',
    name: 'NOAA Tides & Currents',
    endpoint: 'api.tidesandcurrents.noaa.gov/api/prod',
    desc: 'Hourly tidal predictions for US coastal stations. Water level relative to MLLW datum, used to drive the live tide sparklines and flooding/ebbing trend indicators.',
    color: '#4FC3F7',
    status: 'LIVE',
  },
];

const MODULES = [
  {
    id: 'MARS',
    color: 'var(--color-mars)',
    title: 'Mars Weather Station',
    lines: [
      'Fetches the last recorded sol from NASA InSight API.',
      'Compares Martian atmospheric data against your local Earth weather via geolocation.',
      'Metrics: temperature (min/max/avg), wind speed, atmospheric pressure, and season.',
      'InSight mission ended Dec 2022 — data reflects the final recorded sol.',
    ],
  },
  {
    id: 'NEO',
    color: 'var(--color-neo)',
    title: 'Near Earth Object Tracker',
    lines: [
      'Queries NASA NeoWs for a 7-day window of close-approach asteroids.',
      'Computes a custom danger score from miss distance, velocity, diameter, and hazard flag.',
      'Renders a live 3D orbital simulation using React Three Fiber with seeded procedural asteroid geometry.',
      'Navigate time windows forward/backward. Filter by hazard status or proximity.',
    ],
  },
  {
    id: 'ISS',
    color: 'var(--color-iss)',
    title: 'ISS Live Tracker',
    lines: [
      'Polls ISS position every 5 seconds and smoothly interpolates on a 3D Earth globe.',
      'Renders past orbital trail and predicted future path using Three.js Line geometry.',
      'Loads the official NASA ISS GLB model. Sun position calculated from real UTC time.',
      'Crew manifest proxied server-side. Live NASA HDTV streams embedded via YouTube.',
    ],
  },
  {
    id: 'APOD',
    color: '#c084fc',
    title: 'Astronomy Picture of the Day',
    lines: [
      'Full-viewport NASA APOD image pulled fresh from the NASA Planetary API.',
      'Date picker spanning the entire archive — every day since June 16, 1995.',
      'HD image loaded when available. Video APODs fall back to embedded iframe.',
      'Slide-in info panel with full NASA explanation text and copyright attribution.',
    ],
  },
  {
    id: 'SOLAR',
    color: '#facc15',
    title: 'Space Weather Monitor',
    lines: [
      'Real-time Kp index from NOAA SWPC with geomagnetic storm classification (G1–G5).',
      'Live solar wind speed, density, Bt and Bz from NOAA 5-minute plasma/mag feeds.',
      'Solar flare log (last 30 days) and CME events from NASA DONKI API.',
      'Aurora visibility latitude calculated from current Kp. Refreshes every 60 seconds.',
    ],
  },
  {
    id: 'EPIC',
    color: '#60a5fa',
    title: 'EPIC Earth — Full Disk Imagery',
    lines: [
      'Full-disk Earth photos from NASA\'s DSCOVR satellite at the L1 Lagrange point, 1.5M km away.',
      'Natural and enhanced color collections. Up to 22 images per day at 2048×2048px.',
      'Filmstrip scrubber to step through the day\'s captures. Autoplay timelapse mode.',
      'Per-image metadata: centroid coordinates, DSCOVR/Sun J2000 positions, capture time.',
    ],
  },
  {
    id: 'SDO',
    color: '#fb923c',
    title: 'GOES-19 Solar Imager',
    lines: [
      'Live full-disk Sun imagery from GOES-19 SUVI in 6 extreme ultraviolet wavelengths.',
      'Each wavelength reveals a different temperature layer — from chromosphere to 10M K flare plasma.',
      'Autoplay cycles through all bands. Refresh pulls the latest image from NOAA SWPC.',
      'Wavelength guide with temperature ranges and solar feature descriptions.',
    ],
  },
  {
    id: 'QUAKE',
    color: '#4ade80',
    title: 'Seismic · Solar Correlation',
    lines: [
      'Real-time USGS earthquake feed — M2.5+ events globally for the past 7 days.',
      'Every quake rendered as a ripple animation on a 3D Earth globe, color-coded by magnitude.',
      'Overlays live NOAA solar wind Bz — the geomagnetic coupling parameter.',
      'Magnitude filter, event list, and detail panel. Correlation is visual, not scientific.',
    ],
  },
  {
    id: 'SYSTEM',
    color: '#2dd4bf',
    title: 'Solar System Simulator',
    lines: [
      'Real-time 3D orbital simulation of all 8 planets with accurate periods and axial tilts.',
      'Procedural GLSL shaders for each planet — FBM noise surface, gas giant band patterns.',
      'Dynamic lighting from the Sun — each planet lit from its actual orbital position.',
      'Click any planet to focus camera and view detailed data. Speed control and pause/play.',
    ],
  },
  {
    id: 'WEATHER',
    color: '#38bdf8',
    title: 'Earth Weather',
    lines: [
      'Click anywhere on the 3D globe to fetch live weather for that location.',
      'Current conditions: temperature, feels like, humidity, wind, pressure, precipitation.',
      'Sun rise/set times with a live daylight progress bar. UV index with color-coded risk scale.',
      'Air quality index (US AQI, PM2.5, PM10) from Open-Meteo. 7-day forecast with temp range bars.',
    ],
  },
  {
    id: 'GALAXIES',
    color: '#a78bfa',
    title: '100,000 Stars',
    lines: [
      'An interactive visualization of the stellar neighborhood — 119,617 stars from the Hipparcos catalog rendered in WebGL.',
      'Zoom from the full Milky Way down to individual named stars. Each star positioned at its real cartesian coordinates.',
      'Spectral color index mode maps B-V values to actual star temperatures — from red M-dwarfs at 3,840K to blue O-type supergiants at 42,000K.',
      '10-stop narrated guided tour with per-stop audio, synced captions, and cinematic camera transitions through the stellar neighborhood.',
      'Click any named star to pull up spectral class, radius, B-V index, and a direct Wikipedia link.',
    ],
  },
  {
    id: 'THUNDER',
    color: '#facc15',
    title: 'Global Lightning Tracker',
    lines: [
      'Live WebSocket stream from the Blitzortung crowdsourced lightning detection network.',
      'Every strike rendered as an animated flash on a 3D Earth globe with geographic coordinates.',
      'Strike counter, active region heatmap, and per-strike timestamp in the side panel.',
      'Optional thunder sound effects synced to each detected strike event.',
    ],
  },
  {
    id: 'STORMS',
    color: '#34d399',
    title: 'Tropical Storm Tracker',
    lines: [
      'Active tropical cyclones from the JTWC RSS feed — Atlantic, Pacific, and Indian Ocean basins.',
      'Storm track rendered on a 3D globe with animated forecast cone and travelling pulse dot.',
      'Per-storm data: category, sustained winds, central pressure, and 5-day forecast waypoints.',
      'Storm list panel with real-time category badges and basin filtering.',
    ],
  },
  {
    id: 'SIGNAL',
    color: '#38bdf8',
    title: 'NASA Deep Space Network',
    lines: [
      'Live telemetry from all three DSN complexes — Goldstone (CA), Madrid (ES), and Canberra (AU).',
      'Per-dish link cards showing active spacecraft target, signal direction, uplink/downlink data rates.',
      'Animated signal travel bar visualizing the one-way light-time delay to each spacecraft.',
      'Log-scale radial network map plotting spacecraft distances from Earth — from LEO to the Voyagers.',
    ],
  },
  {
    id: 'MOON',
    color: '#94a3b8',
    title: 'Selene — Interactive Moon Globe',
    lines: [
      'Full 3D Moon globe with NASA LROC high-resolution color and bump displacement textures.',
      '25 landing sites — Apollo, Luna, Chang\'e, Chandrayaan, and Artemis zones — with pulse animations.',
      'Terminator line calculated from real UTC time. Crater rings, water ice deposits, and Artemis landing zones as toggleable overlays.',
      'Time scrubber with mission quick-jump buttons. Click any site for mission details, country flag, and landing date.',
    ],
  },
  {
    id: 'TIDES',
    color: '#4FC3F7',
    title: 'Tidal Gravity Simulation',
    lines: [
      'Custom GLSL vertex shader deforms the Earth mesh using the P₂ Legendre polynomial — tidal bulge is physically derived, not faked.',
      'LIVE mode: real NOAA tidal predictions for 5 US coastal stations with sparklines and flooding/ebbing trend.',
      'WHAT IF mode: drag the Moon from the Roche limit to 5× current distance. Watch tidal forces change by 3 orders of magnitude.',
      'DEEP TIME mode: scrub through 4.5 billion years — from the Theia impact to the Sun\'s red giant phase.',
    ],
  },
];

function GlitchText({ text }: { text: string }) {
  const [glitch, setGlitch] = useState(false);
  useEffect(() => {
    const t = setInterval(() => {
      setGlitch(true);
      setTimeout(() => setGlitch(false), 120);
    }, 4000 + Math.random() * 3000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className={`relative inline-block transition-all duration-75 ${glitch ? 'translate-x-[2px] opacity-80' : ''}`}>
      {text}
      {glitch && (
        <span className="absolute inset-0 text-[var(--color-neo)] translate-x-[-3px] opacity-60 pointer-events-none select-none">{text}</span>
      )}
    </span>
  );
}

function Counter({ to, duration = 2000 }: { to: number; duration?: number }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min((now - start) / duration, 1);
          setVal(Math.floor(p * to));
          if (p < 1) requestAnimationFrame(tick);
          else setVal(to);
        };
        requestAnimationFrame(tick);
      }
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [to, duration]);

  return <span ref={ref}>{val}</span>;
}

export function About() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ container: containerRef });
  const lineWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    fetch('https://api.github.com/repos/thor-op/cosmos')
      .then(r => r.json())
      .then(d => { if (typeof d.stargazers_count === 'number') setStars(d.stargazers_count); })
      .catch(() => {});
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-y-auto bg-[#080808] text-white font-mono [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
    >
      {/* Scroll progress bar */}
      <motion.div
        className="fixed top-0 left-16 right-0 h-[1px] bg-white/20 origin-left z-50"
        style={{ scaleX: scrollYProgress }}
      />

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex flex-col justify-end px-12 md:px-24 pb-20 overflow-hidden border-b border-white/5">
        {/* background grid */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
            backgroundSize: '80px 80px',
          }}
        />
        {/* big number */}
        <div className="absolute top-12 right-12 md:right-24 text-[20vw] font-bold leading-none text-white/[0.02] select-none pointer-events-none tracking-tighter">
          ABOUT
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 max-w-5xl"
        >
          <p className="text-[10px] tracking-[0.4em] text-white/30 mb-8 uppercase">
            COSMOS EXPLORER — V1.0 — 2026
          </p>
          <h1 className="text-[clamp(3rem,10vw,9rem)] font-bold leading-[0.9] tracking-tighter mb-10">
            <GlitchText text="REAL-TIME" />
            <br />
            <span className="text-white/20">SPACE</span>
            <br />
            <span className="bg-gradient-to-r from-[var(--color-mars)] via-[var(--color-neo)] to-[var(--color-iss)] bg-clip-text text-transparent">
              INTELLIGENCE
            </span>
          </h1>
          <p className="text-sm md:text-base text-white/40 max-w-xl leading-relaxed tracking-wide uppercase">
            A brutalist data terminal aggregating live telemetry from NASA, ESA, and open-source space APIs — rendered in real time.
          </p>
        </motion.div>

        {/* scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 right-12 md:right-24 flex flex-col items-center gap-2 text-white/20"
        >
          <div className="w-[1px] h-16 bg-gradient-to-b from-transparent to-white/20" />
          <span className="text-[9px] tracking-[0.3em] rotate-90 origin-center mt-4">SCROLL</span>
        </motion.div>
      </section>

      {/* ── STATS ROW ── */}
      <section className="border-b border-white/5 grid grid-cols-2 md:grid-cols-4">
        {[
          { n: 19, suffix: '', label: 'LIVE DATA SOURCES' },
          { n: 16, suffix: '', label: 'INTERACTIVE MODULES' },
          { n: 5, suffix: 'S', label: 'ISS UPDATE INTERVAL' },
          { n: 100, suffix: '%', label: 'FREE & OPEN SOURCE' },
        ].map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="px-10 py-12 border-r border-white/5 last:border-r-0"
          >
            <div className="text-5xl md:text-6xl font-bold tracking-tighter text-white mb-2">
              <Counter to={s.n} />{s.suffix}
            </div>
            <div className="text-[9px] tracking-[0.3em] text-white/30 uppercase">{s.label}</div>
          </motion.div>
        ))}
      </section>

      {/* ── MODULES ── */}
      <section className="border-b border-white/5 px-12 md:px-24 py-24">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-[9px] tracking-[0.4em] text-white/30 uppercase mb-16"
        >
          — WHAT WE DO
        </motion.p>

        <div className="space-y-0">
          {MODULES.map((mod, i) => (
            <motion.div
              key={mod.id}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="group grid grid-cols-[auto_1fr] gap-12 py-12 border-t border-white/5 hover:border-white/10 transition-colors duration-500"
            >
              <div className="flex flex-col items-start gap-3 w-32">
                <span
                  className="text-[9px] tracking-[0.3em] font-bold px-3 py-1 rounded-full border"
                  style={{ color: mod.color, borderColor: `${mod.color}40` }}
                >
                  {mod.id}
                </span>
                <span className="text-[10px] tracking-[0.2em] text-white/20 uppercase">{`${String(i + 1).padStart(2, '0')} / ${MODULES.length}`}</span>
              </div>

              <div>
                <h3
                  className="text-2xl md:text-4xl font-bold tracking-tighter mb-6 group-hover:translate-x-2 transition-transform duration-500"
                  style={{ color: mod.color }}
                >
                  {mod.title}
                </h3>
                <ul className="space-y-3">
                  {mod.lines.map((line, j) => (
                    <li key={j} className="flex gap-4 text-sm text-white/50 leading-relaxed">
                      <span className="text-white/20 shrink-0 mt-0.5">→</span>
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── HOW WE DO IT ── */}
      <section className="border-b border-white/5 px-12 md:px-24 py-24">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-[9px] tracking-[0.4em] text-white/30 uppercase mb-16"
        >
          — HOW WE DO IT
        </motion.p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          {STACK.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="group flex items-start gap-6 py-8 px-6 border border-white/5 hover:bg-white/[0.02] transition-colors duration-300 -mt-[1px] -ml-[1px]"
            >
              <span className="text-[9px] text-white/20 tracking-widest mt-1 w-6 shrink-0">{`0${i + 1}`}</span>
              <div>
                <div className="text-[9px] tracking-[0.3em] text-white/30 uppercase mb-1">{s.label}</div>
                <div className="text-base font-bold tracking-tight text-white mb-1">{s.value}</div>
                <div className="text-xs text-white/30">{s.sub}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── DATA SOURCES ── */}
      <section className="border-b border-white/5 px-12 md:px-24 py-24">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-[9px] tracking-[0.4em] text-white/30 uppercase mb-16"
        >
          — DATA SOURCES
        </motion.p>

        <div className="space-y-0">
          {APIS.map((api, i) => (
            <motion.div
              key={api.id}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="group grid grid-cols-[auto_1fr_auto] gap-8 items-start py-8 border-t border-white/5 hover:border-white/10 transition-colors"
            >
              <span className="text-[9px] text-white/20 tracking-widest mt-1">{api.id}</span>
              <div>
                <div className="flex items-center gap-4 mb-2">
                  <h4 className="text-base font-bold tracking-tight" style={{ color: api.color }}>{api.name}</h4>
                  <code className="text-[9px] text-white/20 tracking-wider hidden md:block">{api.endpoint}</code>
                </div>
                <p className="text-xs text-white/40 leading-relaxed max-w-2xl">{api.desc}</p>
              </div>
              <span
                className="text-[9px] tracking-[0.2em] px-2 py-1 rounded border shrink-0 mt-1"
                style={{
                  color: api.status === 'LIVE' ? '#4ade80' : '#ffffff40',
                  borderColor: api.status === 'LIVE' ? '#4ade8030' : '#ffffff10',
                }}
              >
                {api.status}
              </span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── FOOTER / CREDITS ── */}
      <section className="px-12 md:px-24 py-24 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.015] pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
            backgroundSize: '80px 80px',
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10"
        >
          <p className="text-[9px] tracking-[0.4em] text-white/30 uppercase mb-12">— CREATED BY</p>

          <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-12">
            <div className="flex items-center gap-6">
              <img
                src="https://github.com/thor-op.png"
                alt="THORXOP"
                className="rounded-full border border-white/10 grayscale hover:grayscale-0 transition-all duration-500 w-[clamp(3rem,8vw,7rem)] h-[clamp(3rem,8vw,7rem)] object-cover shrink-0"
              />
              <div>
                <h2 className="text-[clamp(3rem,8vw,7rem)] font-bold tracking-tighter leading-none text-white mb-4">
                  THORXOP
                </h2>
                <p className="text-xs text-white/30 tracking-widest uppercase max-w-sm leading-relaxed">
                  Building interfaces at the intersection of data, space, and the open web.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4 items-start md:items-end">
              <a
                href="https://github.com/thor-op/cosmos"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 border border-white/10 hover:border-white/30 px-5 py-3 text-xs tracking-[0.2em] uppercase transition-all duration-300 hover:bg-white/5"
              >
                <Github size={13} />
                <span className="text-white/60 group-hover:text-white transition-colors">OPEN SOURCE</span>
                <span className="w-px h-3 bg-white/10" />
                <span className="flex items-center gap-1.5 text-white/40 group-hover:text-white/70 transition-colors">
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/>
                  </svg>
                  {stars !== null ? stars.toLocaleString() : '—'}
                </span>
                <span className="text-white/20 group-hover:translate-x-1 transition-transform duration-300">→</span>
              </a>
              <p className="text-[9px] text-white/20 tracking-widest">
                DATA PROVIDED BY NASA OPEN APIS · OSM · OPEN-METEO
              </p>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
