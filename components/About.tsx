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
  { label: 'DEPLOYMENT', value: 'Edge Runtime', sub: 'Next.js API routes · ISR' },
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
    desc: 'Free, open-source weather API. Provides local Earth conditions for real-time comparison against Martian atmospheric data.',
    color: '#ffffff',
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
          { n: 7, suffix: '', label: 'LIVE DATA SOURCES' },
          { n: 4, suffix: '', label: 'INTERACTIVE MODULES' },
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
                <span className="text-[10px] tracking-[0.2em] text-white/20 uppercase">{`0${i + 1} / 04`}</span>
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
