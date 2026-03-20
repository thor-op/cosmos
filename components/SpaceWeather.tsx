'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'motion/react';

/* ─── Types ─── */
interface SolarWind {
  speed: number;       // km/s
  density: number;     // p/cm³
  bt: number;          // total field nT
  bz: number;          // Bz nT (negative = geoeffective)
  timestamp: string;
}

interface KpData {
  kp: number;
  timestamp: string;
}

interface Flare {
  flareID: string;
  beginTime: string;
  peakTime: string | null;
  classType: string;
  sourceLocation: string | null;
}

interface CME {
  activityID: string;
  startTime: string;
  note: string;
}

/* ─── Helpers ─── */
function kpToStorm(kp: number): { label: string; color: string; desc: string } {
  if (kp < 4) return { label: 'QUIET', color: '#4ade80', desc: 'No storm activity' };
  if (kp < 5) return { label: 'UNSETTLED', color: '#a3e635', desc: 'Minor disturbance' };
  if (kp < 6) return { label: 'G1 MINOR', color: '#facc15', desc: 'Weak power grid fluctuations' };
  if (kp < 7) return { label: 'G2 MODERATE', color: '#fb923c', desc: 'High-lat aurora visible' };
  if (kp < 8) return { label: 'G3 STRONG', color: '#f87171', desc: 'Aurora to mid-latitudes' };
  if (kp < 9) return { label: 'G4 SEVERE', color: '#e879f9', desc: 'Widespread aurora' };
  return { label: 'G5 EXTREME', color: '#ffffff', desc: 'Aurora to low latitudes' };
}

function auroraLatitude(kp: number): number {
  // Equatorward boundary approximation
  return Math.max(20, 66.5 - (kp * 3.5));
}

function bzColor(bz: number) {
  if (bz > 5) return '#4ade80';
  if (bz > 0) return '#a3e635';
  if (bz > -5) return '#facc15';
  if (bz > -10) return '#fb923c';
  return '#f87171';
}

function flareColor(cls: string) {
  if (cls.startsWith('X')) return '#f87171';
  if (cls.startsWith('M')) return '#fb923c';
  if (cls.startsWith('C')) return '#facc15';
  return '#ffffff40';
}

function formatUTC(s: string) {
  return new Date(s).toUTCString().replace(' GMT', ' UTC').slice(5, 22);
}

/* ─── Radial Gauge ─── */
function RadialGauge({ value, max, color, label, unit, size = 120 }: {
  value: number; max: number; color: string; label: string; unit: string; size?: number;
}) {
  const pct = Math.min(value / max, 1);
  const r = (size / 2) - 10;
  const circ = Math.PI * r; // half circle
  const stroke = circ * pct;
  const cx = size / 2;
  const cy = size / 2 + 10;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`}>
        {/* track */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" strokeLinecap="round"
        />
        {/* fill */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${stroke} ${circ}`}
          style={{ transition: 'stroke-dasharray 1s ease, stroke 0.5s ease' }}
        />
        {/* value */}
        <text x={cx} y={cy - 8} textAnchor="middle" fill="white" fontSize="16" fontFamily="monospace" fontWeight="bold">
          {value % 1 === 0 ? value : value.toFixed(1)}
        </text>
        <text x={cx} y={cy + 6} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="8" fontFamily="monospace">
          {unit}
        </text>
      </svg>
      <span className="text-[9px] tracking-[0.3em] text-white/30 uppercase">{label}</span>
    </div>
  );
}

/* ─── Kp Bar ─── */
function KpBar({ kp }: { kp: number }) {
  const storm = kpToStorm(kp);
  const aurora = auroraLatitude(kp);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[9px] tracking-[0.3em] text-white/30 uppercase mb-1">KP INDEX</div>
          <div className="text-5xl font-bold tracking-tighter" style={{ color: storm.color }}>
            {kp.toFixed(1)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold tracking-widest" style={{ color: storm.color }}>{storm.label}</div>
          <div className="text-[10px] text-white/30 tracking-wider mt-1">{storm.desc}</div>
        </div>
      </div>

      {/* 0–9 bar */}
      <div className="relative h-2 bg-white/5 rounded-none overflow-hidden">
        <motion.div
          className="absolute left-0 top-0 h-full rounded-none"
          style={{ backgroundColor: storm.color }}
          initial={{ width: 0 }}
          animate={{ width: `${(kp / 9) * 100}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
        {[1,2,3,4,5,6,7,8].map(n => (
          <div key={n} className="absolute top-0 h-full w-px bg-black/40" style={{ left: `${(n/9)*100}%` }} />
        ))}
      </div>
      <div className="flex justify-between text-[8px] text-white/20 font-mono">
        {[0,1,2,3,4,5,6,7,8,9].map(n => <span key={n}>{n}</span>)}
      </div>

      {/* Aurora */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <span className="text-[9px] tracking-[0.3em] text-white/30 uppercase">AURORA VISIBLE ABOVE</span>
        <span className="font-mono text-sm font-bold" style={{ color: storm.color }}>{aurora.toFixed(1)}° LAT</span>
      </div>
    </div>
  );
}

/* ─── Main ─── */
export function SpaceWeather() {
  const [wind, setWind] = useState<SolarWind | null>(null);
  const [kp, setKp] = useState<KpData | null>(null);
  const [flares, setFlares] = useState<Flare[]>([]);
  const [cmes, setCmes] = useState<CME[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const tickRef = useRef(0);

  const fetchAll = async () => {
    try {
      // Proxy route — avoids NOAA CORS block
      const noaaRes = await fetch('/api/space-weather');
      const noaaData = await noaaRes.json();

      if (noaaData.error || !noaaData.mag || !noaaData.plasma || !noaaData.kp) {
        throw new Error(noaaData.error ?? 'Missing NOAA data');
      }

      // mag: [time_tag, bx, by, bz, lon, lat, bt]
      // first row is header, skip it
      const magRows = noaaData.mag.filter((r: unknown[]) => r[0] !== 'time_tag');
      const last = magRows[magRows.length - 1];
      const bt = parseFloat(last[6]);
      const bz = parseFloat(last[3]);

      // plasma: [time_tag, density, speed, temperature]
      const plasmaRows = noaaData.plasma.filter((r: unknown[]) => r[0] !== 'time_tag');
      const lastP = plasmaRows[plasmaRows.length - 1];
      setWind({
        speed: parseFloat(lastP[2]),
        density: parseFloat(lastP[1]),
        bt,
        bz,
        timestamp: last[0],
      });

      // kp: array of objects { time_tag, estimated_kp, ... }
      const kpRows = noaaData.kp;
      const lastKp = kpRows[kpRows.length - 1];
      setKp({ kp: parseFloat(lastKp.estimated_kp ?? lastKp.kp_index), timestamp: lastKp.time_tag });

      // NASA DONKI — solar flares (last 30 days)
      const apiKey = process.env.NEXT_PUBLIC_NASA_API_KEY;
      const now = new Date();
      const start = new Date(now); start.setDate(start.getDate() - 30);
      const fmt = (d: Date) => d.toISOString().split('T')[0];

      const flareRes = await fetch(
        `https://api.nasa.gov/DONKI/FLR?startDate=${fmt(start)}&endDate=${fmt(now)}&api_key=${apiKey}`
      );
      const flareJson = await flareRes.json();
      setFlares(Array.isArray(flareJson) ? flareJson.slice(-8).reverse() : []);

      // NASA DONKI — CMEs (last 30 days)
      const cmeRes = await fetch(
        `https://api.nasa.gov/DONKI/CME?startDate=${fmt(start)}&endDate=${fmt(now)}&api_key=${apiKey}`
      );
      const cmeJson = await cmeRes.json();
      setCmes(Array.isArray(cmeJson) ? cmeJson.slice(-5).reverse() : []);

      setLastUpdate(new Date().toUTCString().slice(17, 25) + ' UTC');
      setLoading(false);
      tickRef.current += 1;
    } catch (e) {
      console.error('Space weather fetch failed', e);
      setError(e instanceof Error ? e.message : 'Fetch failed');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="w-full h-full bg-[#080808] text-white font-mono overflow-hidden flex flex-col">

      {/* ── TOP BAR ── */}
      <div className="flex items-stretch border-b border-white/10 bg-black/40 shrink-0">
        <div className="flex items-center gap-3 px-6 py-3 border-r border-white/10">
          <span className="text-[9px] tracking-[0.35em] text-white/30 uppercase">MODULE</span>
          <span className="text-sm font-bold tracking-widest text-white">SPACE WEATHER</span>
        </div>
        <div className="flex items-center px-6 py-3 border-r border-white/10 gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#facc15] animate-pulse" />
          <span className="text-[9px] tracking-[0.3em] text-white/30 uppercase">NOAA SWPC · NASA DONKI</span>
        </div>
        <div className="flex items-center px-6 py-3 ml-auto">
          <span className="text-[9px] tracking-[0.3em] text-white/20 uppercase">
            {loading ? 'LOADING...' : `UPDATED ${lastUpdate}`}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-t border-[#facc15] animate-spin" />
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <span className="text-[10px] tracking-[0.3em] text-white/30 uppercase">UPSTREAM ERROR</span>
          <span className="text-xs text-white/20 font-mono">{error}</span>
          <button
            onClick={() => { setError(null); setLoading(true); fetchAll(); }}
            className="mt-2 px-4 py-2 border border-white/10 text-[9px] tracking-[0.3em] text-white/40 hover:text-white/70 hover:border-white/30 transition-colors uppercase"
          >
            RETRY
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

          {/* ── ROW 1: KP + GAUGES ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 border-b border-white/5">

            {/* Kp Index */}
            <div className="p-8 md:p-10 border-b md:border-b-0 md:border-r border-white/5">
              <KpBar kp={kp?.kp ?? 0} />
            </div>

            {/* Solar Wind Gauges */}
            <div className="p-8 md:p-10 flex flex-col gap-6">
              <div className="text-[9px] tracking-[0.4em] text-white/30 uppercase">SOLAR WIND</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end justify-items-center">
                <RadialGauge value={wind?.speed ?? 0} max={900} color="#4FC3F7" label="SPEED" unit="KM/S" />
                <RadialGauge value={wind?.density ?? 0} max={30} color="#a78bfa" label="DENSITY" unit="P/CM³" />
                <RadialGauge value={wind?.bt ?? 0} max={50} color="#fb923c" label="B TOTAL" unit="nT" />
                <div className="flex flex-col items-center gap-2">
                  <div className="flex flex-col items-center justify-center w-[120px] h-[78px]">
                    <div className="text-[9px] tracking-[0.2em] text-white/30 uppercase mb-1">Bz</div>
                    <div className="text-3xl font-bold tabular-nums" style={{ color: bzColor(wind?.bz ?? 0) }}>
                      {(wind?.bz ?? 0) > 0 ? '+' : ''}{(wind?.bz ?? 0).toFixed(1)}
                    </div>
                    <div className="text-[8px] text-white/20 mt-0.5">nT</div>
                  </div>
                  <span className="text-[9px] tracking-[0.3em] text-white/30 uppercase">Bz COMPONENT</span>
                  <span className="text-[8px] tracking-widest" style={{ color: bzColor(wind?.bz ?? 0) }}>
                    {(wind?.bz ?? 0) < -5 ? 'GEOEFFECTIVE' : (wind?.bz ?? 0) < 0 ? 'SOUTHWARD' : 'NORTHWARD'}
                  </span>
                </div>
              </div>
              <p className="text-[8px] text-white/15 leading-relaxed">
                Negative Bz (southward) couples with Earth's magnetosphere, driving geomagnetic storms. Values below −10 nT indicate significant activity.
              </p>
            </div>
          </div>

          {/* ── ROW 2: FLARES + CMEs ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 border-b border-white/5">

            {/* Solar Flares */}
            <div className="border-b md:border-b-0 md:border-r border-white/5">
              <div className="px-8 py-4 border-b border-white/5 flex items-center justify-between">
                <span className="text-[9px] tracking-[0.4em] text-white/30 uppercase">SOLAR FLARES — LAST 30 DAYS</span>
                <span className="text-[9px] text-white/20">{flares.length} EVENTS</span>
              </div>
              {flares.length === 0 ? (
                <div className="px-8 py-6 text-[10px] text-white/20 tracking-widest">NO FLARE DATA</div>
              ) : (
                flares.map((f, i) => (
                  <motion.div
                    key={f.flareID ?? i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="grid grid-cols-[auto_1fr_auto] gap-4 items-center px-8 py-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                  >
                    <span
                      className="text-sm font-bold tracking-tight w-10"
                      style={{ color: flareColor(f.classType) }}
                    >
                      {f.classType}
                    </span>
                    <div>
                      <div className="text-[10px] text-white/50">{formatUTC(f.beginTime)}</div>
                      {f.sourceLocation && (
                        <div className="text-[9px] text-white/20 tracking-wider">{f.sourceLocation}</div>
                      )}
                    </div>
                    {f.peakTime && (
                      <span className="text-[8px] text-white/20 tracking-wider">PEAK {formatUTC(f.peakTime)}</span>
                    )}
                  </motion.div>
                ))
              )}
            </div>

            {/* CMEs */}
            <div>
              <div className="px-8 py-4 border-b border-white/5 flex items-center justify-between">
                <span className="text-[9px] tracking-[0.4em] text-white/30 uppercase">CORONAL MASS EJECTIONS</span>
                <span className="text-[9px] text-white/20">{cmes.length} EVENTS</span>
              </div>
              {cmes.length === 0 ? (
                <div className="px-8 py-6 text-[10px] text-white/20 tracking-widest">NO CME DATA</div>
              ) : (
                cmes.map((c, i) => (
                  <motion.div
                    key={c.activityID}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="px-8 py-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-white/60 tracking-wider">{formatUTC(c.startTime)}</span>
                      <span className="text-[8px] text-white/20 tracking-widest">{c.activityID.slice(-6)}</span>
                    </div>
                    {c.note && (
                      <p className="text-[9px] text-white/30 leading-relaxed line-clamp-2">{c.note}</p>
                    )}
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* ── FLARE CLASS LEGEND ── */}
          <div className="px-8 py-5 flex flex-wrap gap-6 border-b border-white/5">
            <span className="text-[9px] tracking-[0.3em] text-white/20 uppercase self-center">FLARE CLASS</span>
            {[
              { cls: 'A / B', color: '#ffffff40', desc: 'Background' },
              { cls: 'C', color: '#facc15', desc: 'Minor' },
              { cls: 'M', color: '#fb923c', desc: 'Moderate' },
              { cls: 'X', color: '#f87171', desc: 'Intense' },
            ].map(({ cls, color, desc }) => (
              <div key={cls} className="flex items-center gap-2">
                <span className="text-xs font-bold" style={{ color }}>{cls}</span>
                <span className="text-[9px] text-white/20">{desc}</span>
              </div>
            ))}
          </div>

        </div>
      )}
    </div>
  );
}
