'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';

/* ─── Constants ─── */
const DSN_URL = '/api/dsn';
const POLL_MS = 5000;
const KM_PER_AU = 149597870.7;
const KM_PER_LY = 9.461e12;

/* ─── Launch dates for mission age countup ─── */
const LAUNCH_DATES: Record<string, string> = {
  VOYAGER1: '1977-09-05',
  VOYAGER2: '1977-08-20',
  JWST:     '2021-12-25',
  MRO:      '2005-08-12',
  MAVEN:    '2013-11-18',
  MSL:      '2011-11-26',
  M2020:    '2020-07-30',
  NH:       '2006-01-19',
  JUNO:     '2011-08-05',
  SOHO:     '1995-12-02',
  ACE:      '1997-08-25',
  LRO:      '2009-06-18',
  M01O:     '2001-04-07',
  INSIGHT:  '2018-05-05',
};

function missionAgeDays(scId: string): number | null {
  const d = LAUNCH_DATES[scId];
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

/* ─── Frequency band labels ─── */
function freqBand(hz: number, band: string): string {
  if (band) {
    const b = band.toUpperCase();
    if (b === 'KA') return 'Ka-band';
    if (b === 'X')  return 'X-band';
    if (b === 'S')  return 'S-band';
    if (b === 'L')  return 'L-band';
    if (b === 'UHF') return 'UHF';
    return band;
  }
  if (hz <= 0) return '';
  if (hz < 300e6)  return 'UHF';
  if (hz < 2e9)    return 'S-band';
  if (hz < 12e9)   return 'X-band';
  if (hz < 40e9)   return 'Ka-band';
  return '';
}

/* ─── Signal power in plain English ─── */
function formatPowerWatts(dbm: number): string {
  if (!dbm) return '';
  const watts = Math.pow(10, (dbm - 30) / 10);
  if (watts >= 0.001) return `${watts.toFixed(6)} W`;
  if (watts >= 1e-9)  return `${(watts * 1e9).toFixed(4)} nW`;
  if (watts >= 1e-12) return `${(watts * 1e12).toFixed(4)} pW`;
  if (watts >= 1e-15) return `${(watts * 1e15).toFixed(4)} fW`;
  return `${watts.toExponential(2)} W`;
}

/* ─── Station locations ─── */
const STATIONS: Record<string, { name: string; lat: number; lon: number; color: string }> = {
  gdscc: { name: 'Goldstone', lat:  35.4267, lon: -116.8900, color: '#4FC3F7' },
  mdscc: { name: 'Madrid',    lat:  40.4314, lon:   -4.2481, color: '#81C784' },
  cdscc: { name: 'Canberra',  lat: -35.4014, lon:  148.9819, color: '#FFB74D' },
};

/* ─── Spacecraft database ─── */
const SPACECRAFT: Record<string, { fullName: string; color: string; mission?: string; type?: string; hero?: boolean }> = {
  VOYAGER1: { fullName: 'Voyager 1',                 color: '#F59E0B', mission: 'Interstellar exploration',        type: 'Probe',       hero: true },
  VOYAGER2: { fullName: 'Voyager 2',                 color: '#F59E0B', mission: 'Interstellar exploration',        type: 'Probe',       hero: true },
  JWST:     { fullName: 'James Webb Space Telescope', color: '#FFD54F', mission: 'Infrared observatory at L2',     type: 'Observatory' },
  MRO:      { fullName: 'Mars Reconnaissance Orbiter',color: '#FF7043', mission: 'Mars orbital imaging',           type: 'Orbiter' },
  MAVEN:    { fullName: 'MAVEN',                     color: '#FF7043', mission: 'Mars atmosphere study',           type: 'Orbiter' },
  MSL:      { fullName: 'Curiosity Rover',            color: '#FF7043', mission: 'Mars surface exploration',       type: 'Rover' },
  M2020:    { fullName: 'Perseverance Rover',         color: '#FF7043', mission: 'Mars sample collection',         type: 'Rover' },
  NH:       { fullName: 'New Horizons',               color: '#CE93D8', mission: 'Kuiper Belt exploration',        type: 'Probe' },
  JUNO:     { fullName: 'Juno',                       color: '#A5D6A7', mission: 'Jupiter orbital study',          type: 'Orbiter' },
  SOHO:     { fullName: 'SOHO',                       color: '#FFD54F', mission: 'Solar observation at L1',        type: 'Observatory' },
  ACE:      { fullName: 'ACE',                        color: '#FFD54F', mission: 'Solar wind monitoring at L1',    type: 'Observatory' },
  WIND:     { fullName: 'Wind',                       color: '#FFD54F', mission: 'Solar wind study',               type: 'Observatory' },
  STEREO:   { fullName: 'STEREO',                     color: '#FFD54F', mission: 'Solar imaging',                  type: 'Observatory' },
  'STEREO-A':{ fullName: 'STEREO-A',                  color: '#FFD54F', mission: 'Solar imaging',                  type: 'Observatory' },
  CASSINI:  { fullName: 'Cassini',                    color: '#A5D6A7', mission: 'Saturn exploration',             type: 'Orbiter' },
  ORION:    { fullName: 'Orion / Artemis',            color: '#80CBC4', mission: 'Crewed lunar exploration',       type: 'Crewed' },
  LRO:      { fullName: 'Lunar Reconnaissance Orbiter',color:'#80CBC4', mission: 'Lunar mapping',                 type: 'Orbiter' },
  M01O:     { fullName: 'Mars Odyssey',               color: '#FF7043', mission: 'Mars orbital relay',             type: 'Orbiter' },
  MEX:      { fullName: 'Mars Express',               color: '#FF7043', mission: 'Mars orbital study',             type: 'Orbiter' },
  INSIGHT:  { fullName: 'InSight Lander',             color: '#FF7043', mission: 'Mars seismology',                type: 'Lander' },
  DSN:      { fullName: 'DSN Internal',               color: '#333333', mission: 'Engineering / calibration',      type: 'Internal' },
};

function scInfo(id: string) {
  return SPACECRAFT[id] ?? { fullName: id, color: '#888888', mission: 'Unknown spacecraft', type: 'Unknown' };
}

function isInternal(spacecraft: string): boolean {
  return spacecraft === 'DSN' || spacecraft === 'DSN Internal' || spacecraft === 'TDRSS';
}

/* ─── Types ─── */
interface DishState {
  name: string;
  station: string;
  stationFriendly: string;
  azimuth: number;
  elevation: number;
  spacecraft: string;
  distanceKm: number;
  rtltSeconds: number;
  downDataRate: number;
  upDataRate: number;
  signalPower: number;
  frequency: number;
  band: string;
  isActive: boolean;
  upActive: boolean;
  downActive: boolean;
  activity: string;
}

/* ─── Formatters ─── */
function formatDistance(km: number): string {
  if (km <= 0) return '—';
  if (km < 1e6) return `${km.toLocaleString(undefined, { maximumFractionDigits: 0 })} km`;
  if (km < KM_PER_AU * 0.1) return `${(km / 1e6).toFixed(2)}M km`;
  if (km < KM_PER_LY) return `${(km / KM_PER_AU).toFixed(3)} AU`;
  return `${(km / KM_PER_LY).toFixed(4)} ly`;
}

function formatDistanceHero(km: number): string {
  // Big display: always show AU with full precision
  if (km <= 0) return '—';
  if (km < 1e6) return `${km.toLocaleString(undefined, { maximumFractionDigits: 0 })} km`;
  const au = km / KM_PER_AU;
  if (au < 0.01) return `${(km / 1e6).toFixed(2)}M km`;
  return `${au.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AU`;
}

function formatRTLT(s: number): string {
  if (s <= 0) return '—';
  if (s < 60) return `${s.toFixed(1)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatDataRate(bps: number): string {
  if (bps <= 0) return '—';
  if (bps < 1000) return `${bps} bps`;
  if (bps < 1e6) return `${(bps / 1000).toFixed(1)} kbps`;
  return `${(bps / 1e6).toFixed(2)} Mbps`;
}

function formatFreq(hz: number): string {
  if (hz <= 0) return '—';
  if (hz < 1e9) return `${(hz / 1e6).toFixed(0)} MHz`;
  return `${(hz / 1e9).toFixed(3)} GHz`;
}

/* ─── XML parser ─── */
function parseDsnXml(xmlText: string): DishState[] {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, 'text/xml');
  const dishes: DishState[] = [];
  let currentStation = '';
  let currentFriendly = '';

  const children = xml.documentElement.childNodes;
  for (let i = 0; i < children.length; i++) {
    const node = children[i] as Element;
    if (node.nodeName === 'station') {
      currentStation = node.getAttribute('name') ?? '';
      currentFriendly = node.getAttribute('friendlyName') ?? '';
      continue;
    }
    if (node.nodeName !== 'dish') continue;

    const dishName  = node.getAttribute('name') ?? '';
    const azimuth   = parseFloat(node.getAttribute('azimuthAngle') ?? '0');
    const elevation = parseFloat(node.getAttribute('elevationAngle') ?? '0');
    const activity  = node.getAttribute('activity') ?? '';

    const targetEl   = node.querySelector('target');
    const spacecraft = targetEl?.getAttribute('name') ?? '';
    const distanceKm = parseFloat(targetEl?.getAttribute('downlegRange') ?? '0');
    const rtlt       = parseFloat(targetEl?.getAttribute('rtlt') ?? '0');

    let downDataRate = 0, upDataRate = 0, signalPower = 0, frequency = 0, band = '';
    let upActive = false, downActive = false;

    const downSignals = node.querySelectorAll('downSignal');
    for (let j = 0; j < downSignals.length; j++) {
      const ds = downSignals[j];
      if (ds.getAttribute('active') === 'true') {
        downActive = true;
        downDataRate = Math.max(downDataRate, parseFloat(ds.getAttribute('dataRate') ?? '0'));
        signalPower  = parseFloat(ds.getAttribute('power') ?? '0');
        frequency    = parseFloat(ds.getAttribute('frequency') ?? '0');
        band         = ds.getAttribute('band') ?? '';
      } else {
        const dr = parseFloat(ds.getAttribute('dataRate') ?? '0');
        if (dr > downDataRate) downDataRate = dr;
        if (!band) band = ds.getAttribute('band') ?? '';
        if (!signalPower) signalPower = parseFloat(ds.getAttribute('power') ?? '0');
        if (!frequency) frequency = parseFloat(ds.getAttribute('frequency') ?? '0');
      }
    }

    const upSignals = node.querySelectorAll('upSignal');
    for (let j = 0; j < upSignals.length; j++) {
      const us = upSignals[j];
      if (us.getAttribute('active') === 'true') upActive = true;
      const dr = parseFloat(us.getAttribute('dataRate') ?? '0');
      if (dr > upDataRate) upDataRate = dr;
    }

    // isActive: has a real spacecraft target (not DSN internal), with a valid distance
    const isActive = spacecraft !== '' && !isInternal(spacecraft) && distanceKm > 0;

    dishes.push({
      name: dishName,
      station: currentStation,
      stationFriendly: currentFriendly,
      azimuth: isFinite(azimuth) ? azimuth : 0,
      elevation: isFinite(elevation) ? elevation : 0,
      spacecraft,
      distanceKm: isFinite(distanceKm) ? distanceKm : 0,
      rtltSeconds: isFinite(rtlt) ? rtlt : 0,
      downDataRate: isFinite(downDataRate) ? downDataRate : 0,
      upDataRate: isFinite(upDataRate) ? upDataRate : 0,
      signalPower: isFinite(signalPower) ? signalPower : 0,
      frequency: isFinite(frequency) ? frequency : 0,
      band,
      isActive,
      upActive,
      downActive,
      activity,
    });
  }
  return dishes;
}

/* ─── Dish azimuth/elevation indicator ─── */
function DishIndicator({ azimuth, elevation, color, size = 48 }: {
  azimuth: number; elevation: number; color: string; size?: number;
}) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 4;
  const az = (azimuth * Math.PI) / 180;
  const nx = cx + r * 0.7 * Math.sin(az);
  const ny = cy - r * 0.7 * Math.cos(az);
  const elFrac = Math.max(0, Math.min(1, elevation / 90));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
      {[0, 90, 180, 270].map(deg => {
        const a = (deg * Math.PI) / 180;
        return <line key={deg} x1={cx + (r-4)*Math.sin(a)} y1={cy - (r-4)*Math.cos(a)} x2={cx + r*Math.sin(a)} y2={cy - r*Math.cos(a)} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />;
      })}
      <circle cx={cx} cy={cy} r={r * elFrac * 0.85} fill={color} opacity={0.08} />
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={2} fill={color} />
      <text x={cx} y={5} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize={6} fontFamily="monospace">N</text>
    </svg>
  );
}

/* ─── Signal travel bar ─── */
function SignalTravelBar({ rtlt, color }: { rtlt: number; color: string }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (rtlt <= 0) return;
    const half = rtlt / 2;
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      setProgress((elapsed % half) / half);
    }, 100);
    return () => clearInterval(id);
  }, [rtlt]);
  if (rtlt <= 0) return null;
  return (
    <div className="relative h-1 bg-white/5 rounded-full overflow-hidden w-full">
      <div className="absolute top-0 h-full rounded-full transition-none"
        style={{ left: `${progress * 100}%`, width: '12%', background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
    </div>
  );
}

/* ─── Hero card for Voyager / deep-space probes ─── */
function HeroCard({ dish, onClick, selected }: { dish: DishState; onClick: () => void; selected: boolean }) {
  const sc = scInfo(dish.spacecraft);
  const stColor = STATIONS[dish.station]?.color ?? '#888';
  const days = missionAgeDays(dish.spacecraft);
  const oneWaySecs = dish.rtltSeconds / 2;

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onClick}
      className="w-full text-left border-b-2 px-4 py-4 transition-colors relative overflow-hidden"
      style={{
        borderLeftWidth: 3,
        borderLeftColor: sc.color,
        borderBottomColor: selected ? `${sc.color}40` : 'rgba(255,255,255,0.06)',
        background: selected ? `${sc.color}12` : `${sc.color}06`,
      }}
    >
      {/* Subtle glow */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at left center, ${sc.color}08 0%, transparent 70%)` }} />

      {/* Name + dish */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full animate-pulse shrink-0" style={{ backgroundColor: sc.color }} />
          <span className="text-xs font-bold tracking-wider" style={{ color: sc.color }}>{sc.fullName}</span>
        </div>
        <span className="text-[8px] text-white/25 tracking-widest">{dish.name}</span>
      </div>

      {/* Mission age */}
      {days !== null && (
        <div className="text-[8px] text-white/30 tracking-wider pl-4 mb-2">
          Launched {days.toLocaleString()} days ago
        </div>
      )}

      {/* BIG distance */}
      <div className="pl-4 mb-2">
        <div className="text-2xl font-bold tabular-nums leading-none" style={{ color: sc.color }}>
          {formatDistanceHero(dish.distanceKm)}
        </div>
        <div className="text-[8px] text-white/20 tracking-widest mt-0.5">DISTANCE FROM EARTH</div>
      </div>

      {/* RTLT prominent */}
      <div className="pl-4 mb-2 flex items-baseline gap-2">
        <span className="text-sm font-bold tabular-nums" style={{ color: sc.color }}>{formatRTLT(dish.rtltSeconds)}</span>
        <span className="text-[8px] text-white/30 tracking-widest">ROUND-TRIP LIGHT TIME</span>
      </div>

      {/* One-way hint */}
      {oneWaySecs > 0 && (
        <div className="pl-4 text-[8px] text-white/20 italic mb-2">
          A signal sent now arrives in {formatRTLT(oneWaySecs)}
        </div>
      )}

      {/* Signal travel bar */}
      <div className="pl-4 mb-2">
        <SignalTravelBar rtlt={dish.rtltSeconds} color={sc.color} />
      </div>

      {/* Station + data rates */}
      <div className="flex items-center justify-between pl-4 text-[8px]">
        <span style={{ color: stColor }}>{dish.stationFriendly}</span>
        <div className="flex gap-3">
          <span className="text-white/20">↓ <span className="text-white/40">{formatDataRate(dish.downDataRate)}</span>
            {dish.band || dish.frequency ? <span className="text-white/20 ml-1">{freqBand(dish.frequency, dish.band)}</span> : null}
          </span>
          <span className="text-white/20">↑ <span className="text-white/40">{formatDataRate(dish.upDataRate)}</span></span>
        </div>
      </div>
    </motion.button>
  );
}

/* ─── Regular link card ─── */
function LinkCard({ dish, onClick, selected, flash }: {
  dish: DishState; onClick: () => void; selected: boolean; flash: boolean;
}) {
  const sc = scInfo(dish.spacecraft);
  const stColor = STATIONS[dish.station]?.color ?? '#888';
  const days = missionAgeDays(dish.spacecraft);
  const bandLabel = freqBand(dish.frequency, dish.band);

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className="w-full text-left border-b border-white/[0.04] px-4 py-3 transition-colors relative overflow-hidden"
      style={{ background: selected ? `${sc.color}0d` : 'transparent' }}
    >
      {/* Flash line on update */}
      {flash && (
        <motion.div
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: sc.color }}
          initial={{ opacity: 0.8, scaleX: 0 }}
          animate={{ opacity: 0, scaleX: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: sc.color }} />
          <span className="text-[10px] font-bold tracking-wider" style={{ color: sc.color }}>{sc.fullName}</span>
        </div>
        <span className="text-[8px] text-white/30 tracking-widest">{dish.name}</span>
      </div>

      {/* Mission age */}
      {days !== null && (
        <div className="text-[8px] text-white/20 tracking-wider pl-3.5 mb-1">
          Launched {days.toLocaleString()} days ago
        </div>
      )}

      {/* Station + distance */}
      <div className="flex items-center justify-between text-[8px] text-white/30 mb-1">
        <span style={{ color: stColor }}>{dish.stationFriendly}</span>
        <span className="tabular-nums">{formatDistance(dish.distanceKm)}</span>
      </div>

      <SignalTravelBar rtlt={dish.rtltSeconds} color={sc.color} />

      {/* Data rates + band */}
      <div className="flex gap-3 mt-1.5 text-[8px] flex-wrap">
        <span className="text-white/20">↓ <span className="text-white/50">{formatDataRate(dish.downDataRate)}</span>
          {bandLabel && <span className="text-white/25 ml-1">{bandLabel}</span>}
        </span>
        <span className="text-white/20">↑ <span className="text-white/50">{formatDataRate(dish.upDataRate)}</span></span>
        <span className="text-white/20 ml-auto">RTLT <span className="text-white/50">{formatRTLT(dish.rtltSeconds)}</span></span>
      </div>
    </motion.button>
  );
}

/* ─── Idle dish row ─── */
function IdleDishRow({ name }: { name: string }) {
  return (
    <div className="w-full text-left border-b border-white/[0.03] px-4 py-2.5 flex items-center justify-between opacity-40">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-white/10 shrink-0" />
        <span className="text-[9px] text-white/20 tracking-widest">{name}</span>
      </div>
      <span className="text-[8px] text-white/15 tracking-widest uppercase">IDLE</span>
    </div>
  );
}

/* ─── Station column ─── */
function StationColumn({ stationKey, dishes, selectedDish, onSelect, flashSet }: {
  stationKey: string;
  dishes: DishState[];
  selectedDish: DishState | null;
  onSelect: (d: DishState) => void;
  flashSet: Set<string>;
}) {
  const st = STATIONS[stationKey];
  const active = dishes.filter(d => d.isActive && !isInternal(d.spacecraft));
  const idle   = dishes.filter(d => !d.isActive && !isInternal(d.spacecraft));

  return (
    <div className="flex flex-col border-r border-white/10 last:border-r-0 flex-1 min-w-0">
      <div className="px-4 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: st.color }} />
          <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: st.color }}>{st.name}</span>
        </div>
        <div className="text-[8px] text-white/20 tracking-wider pl-4">
          {active.length} ACTIVE · {dishes.length} DISHES
        </div>
      </div>

      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <AnimatePresence initial={false}>
          {active.map(d => {
            const sc = scInfo(d.spacecraft);
            if (sc.hero) {
              return (
                <HeroCard key={d.name} dish={d}
                  onClick={() => onSelect(d)}
                  selected={selectedDish?.name === d.name} />
              );
            }
            return (
              <LinkCard key={d.name} dish={d}
                onClick={() => onSelect(d)}
                selected={selectedDish?.name === d.name}
                flash={flashSet.has(d.name)} />
            );
          })}
        </AnimatePresence>

        {/* Idle dishes */}
        {idle.map(d => <IdleDishRow key={d.name} name={d.name} />)}

        {dishes.length === 0 && (
          <div className="px-4 py-6 text-[8px] text-white/15 tracking-widest uppercase text-center">No data</div>
        )}
      </div>
    </div>
  );
}

/* ─── Detail panel ─── */
function DetailPanel({ dish, onClose }: { dish: DishState; onClose: () => void }) {
  const sc = scInfo(dish.spacecraft);
  const st = STATIONS[dish.station];
  const days = missionAgeDays(dish.spacecraft);
  const bandLabel = freqBand(dish.frequency, dish.band);
  const powerWatts = dish.signalPower ? formatPowerWatts(dish.signalPower) : null;

  const rows: [string, string][] = [
    ['Spacecraft',    sc.fullName],
    ['Mission',       sc.mission ?? '—'],
    ['Type',          sc.type ?? '—'],
    ...(days !== null ? [['Mission age', `${days.toLocaleString()} days`] as [string, string]] : []),
    ['Dish',          dish.name],
    ['Station',       dish.stationFriendly],
    ['Azimuth',       `${dish.azimuth.toFixed(1)}°`],
    ['Elevation',     `${dish.elevation.toFixed(1)}°`],
    ['Distance',      formatDistance(dish.distanceKm)],
    ['One-way light', formatRTLT(dish.rtltSeconds / 2)],
    ['RTLT',          formatRTLT(dish.rtltSeconds)],
    ['Down rate',     formatDataRate(dish.downDataRate)],
    ['Up rate',       formatDataRate(dish.upDataRate)],
    ['Signal power',  dish.signalPower ? `${dish.signalPower} dBm` : '—'],
    ...(powerWatts ? [['Power (watts)', powerWatts] as [string, string]] : []),
    ['Frequency',     formatFreq(dish.frequency)],
    ['Band',          bandLabel || dish.band || '—'],
    ['Activity',      dish.activity || '—'],
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="w-72 shrink-0 border-l border-white/10 flex flex-col bg-black/30 overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-white/10 flex items-start justify-between shrink-0">
        <div>
          <div className="text-xs font-bold tracking-wider mb-0.5" style={{ color: sc.color }}>{sc.fullName}</div>
          <div className="text-[8px] text-white/30 tracking-widest uppercase">{dish.name} · {dish.stationFriendly}</div>
        </div>
        <button onClick={onClose} className="text-white/20 hover:text-white/60 text-xs mt-0.5">✕</button>
      </div>

      <div className="flex items-center justify-center py-5 border-b border-white/10 shrink-0">
        <div className="flex flex-col items-center gap-2">
          <DishIndicator azimuth={dish.azimuth} elevation={dish.elevation} color={sc.color} size={80} />
          <div className="text-[8px] text-white/20 tracking-widest">AZ {dish.azimuth.toFixed(1)}° · EL {dish.elevation.toFixed(1)}°</div>
        </div>
      </div>

      {dish.rtltSeconds > 0 && (
        <div className="px-5 py-4 border-b border-white/10 shrink-0">
          <div className="text-[8px] text-white/25 tracking-widest uppercase mb-2">Signal in transit</div>
          <SignalTravelBar rtlt={dish.rtltSeconds} color={sc.color} />
          <div className="flex justify-between text-[8px] text-white/20 mt-1.5">
            <span style={{ color: st?.color }}>{dish.stationFriendly}</span>
            <span className="text-white/30">{formatRTLT(dish.rtltSeconds / 2)} one-way</span>
            <span style={{ color: sc.color }}>{sc.fullName}</span>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-5 py-3">
        <div className="flex flex-col gap-2">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between items-baseline gap-2">
              <span className="text-[8px] text-white/25 tracking-widest uppercase shrink-0">{label}</span>
              <span className="text-[9px] text-white/60 text-right tabular-nums">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10 px-5 py-3 flex gap-4 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${dish.upActive ? 'animate-pulse' : 'opacity-20'}`}
            style={{ backgroundColor: dish.upActive ? sc.color : '#fff' }} />
          <span className="text-[8px] text-white/30 tracking-widest">UPLINK</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${dish.downActive ? 'animate-pulse' : 'opacity-20'}`}
            style={{ backgroundColor: dish.downActive ? sc.color : '#fff' }} />
          <span className="text-[8px] text-white/30 tracking-widest">DOWNLINK</span>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Network map — log-scale radial, zoomable/pannable ─── */
function NetworkMap({ dishes }: { dishes: DishState[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tick, setTick] = useState(0);
  const [dims, setDims] = useState({ w: 800, h: 500 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 });

  useEffect(() => {
    const id = setInterval(() => setTick(t => (t + 1) % 200), 60);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDims({ w: width, h: height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Wheel zoom
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.4, Math.min(6, z * (e.deltaY < 0 ? 1.12 : 0.89))));
  }, []);

  // Drag pan
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  }, [pan]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    setPan({ x: dragStart.current.px + e.clientX - dragStart.current.x, y: dragStart.current.py + e.clientY - dragStart.current.y });
  }, []);

  const onMouseUp = useCallback(() => { dragging.current = false; }, []);

  const activeDishes = dishes.filter(d => d.isActive && !isInternal(d.spacecraft));
  const { w, h } = dims;
  const cx = w / 2, cy = h / 2;

  const MIN_KM = 1e5;
  const MAX_KM = 2.5e10;
  const MIN_R  = 40;
  const MAX_R  = Math.min(cx, cy) * 0.88;

  function logR(km: number): number {
    if (km <= 0) return MIN_R;
    const clamped = Math.max(MIN_KM, Math.min(MAX_KM, km));
    const t = Math.log10(clamped / MIN_KM) / Math.log10(MAX_KM / MIN_KM);
    return MIN_R + t * (MAX_R - MIN_R);
  }

  const rings = [
    { km: 1.5e6,            label: 'L2 · 1.5M km' },
    { km: KM_PER_AU * 0.5,  label: '0.5 AU' },
    { km: KM_PER_AU * 1.5,  label: '1.5 AU' },
    { km: KM_PER_AU * 10,   label: '10 AU' },
    { km: KM_PER_AU * 50,   label: '50 AU' },
    { km: KM_PER_AU * 150,  label: '150 AU' },
  ];

  const scKey = activeDishes.map(d => d.spacecraft).join(',');
  const scAngles = useMemo(() => {
    const unique = [...new Set(activeDishes.map(d => d.spacecraft))];
    const map: Record<string, number> = {};
    unique.forEach((sc, i) => {
      map[sc] = (i / Math.max(unique.length, 1)) * Math.PI * 2 - Math.PI / 2;
    });
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scKey]);

  const starDots = useMemo(() => {
    const stars = [];
    for (let i = 0; i < 140; i++) {
      stars.push(<circle key={i} cx={Math.random() * w} cy={Math.random() * h} r={Math.random() * 0.8 + 0.2} fill="white" opacity={Math.random() * 0.4 + 0.1} />);
    }
    return stars;
  }, [w, h]);

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden cursor-grab active:cursor-grabbing select-none"
      onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full">
        {starDots}
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom}) translate(${cx*(1-1/zoom)},${cy*(1-1/zoom)})`}>
          {/* Distance rings */}
          {rings.map(({ km, label }) => {
            const r = logR(km);
            if (r > MAX_R + 10) return null;
            return (
              <g key={label}>
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} strokeDasharray="3 6" />
                <text x={cx + r + 3} y={cy - 3} fill="rgba(255,255,255,0.15)" fontSize={8 / zoom} fontFamily="monospace">{label}</text>
              </g>
            );
          })}

          {/* Earth */}
          <circle cx={cx} cy={cy} r={18} fill="#0d1f3c" stroke="rgba(100,160,255,0.3)" strokeWidth={1.5} />
          <circle cx={cx} cy={cy} r={18} fill="none" stroke="rgba(100,160,255,0.08)" strokeWidth={8} />
          <text x={cx} y={cy + 28} textAnchor="middle" fill="rgba(100,160,255,0.5)" fontSize={8 / zoom} fontFamily="monospace">EARTH</text>

          {/* Station dots */}
          {Object.entries(STATIONS).map(([key, st]) => {
            const stAngle = key === 'gdscc' ? -0.5 : key === 'mdscc' ? 0.5 : 2.2;
            const sx = cx + 14 * Math.cos(stAngle);
            const sy = cy + 14 * Math.sin(stAngle);
            return (
              <g key={key}>
                <circle cx={sx} cy={sy} r={3} fill={st.color} />
                <circle cx={sx} cy={sy} r={6} fill="none" stroke={st.color} strokeWidth={0.6} opacity={0.3}>
                  <animate attributeName="r" values="3;8;3" dur="2.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.3;0;0.3" dur="2.5s" repeatCount="indefinite" />
                </circle>
              </g>
            );
          })}

          {/* Signal lines + spacecraft */}
          {activeDishes.map((d, i) => {
            const sc = scInfo(d.spacecraft);
            const angle = scAngles[d.spacecraft] ?? (i / activeDishes.length) * Math.PI * 2;
            const r = logR(d.distanceKm);
            const ex = cx + r * Math.cos(angle);
            const ey = cy + r * Math.sin(angle);
            const stAngle = d.station === 'gdscc' ? -0.5 : d.station === 'mdscc' ? 0.5 : 2.2;
            const sx = cx + 14 * Math.cos(stAngle);
            const sy = cy + 14 * Math.sin(stAngle);
            const t = ((tick * 0.005 + i * 0.11) % 1);
            const px = sx + (ex - sx) * t;
            const py = sy + (ey - sy) * t;
            const labelR = r + 14;
            const lx = cx + labelR * Math.cos(angle);
            const ly = cy + labelR * Math.sin(angle);
            const anchor = Math.cos(angle) > 0 ? 'start' : 'end';
            const isHero = !!sc.hero;

            return (
              <g key={d.name}>
                <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={sc.color} strokeWidth={isHero ? 1 : 0.5} opacity={isHero ? 0.35 : 0.2} />
                <line x1={sx} y1={sy} x2={cx + 30 * Math.cos(angle)} y2={cy + 30 * Math.sin(angle)} stroke={sc.color} strokeWidth={1.5} opacity={0.6} />
                <circle cx={px} cy={py} r={isHero ? 3.5 : 2.5} fill={sc.color} opacity={0.95} />
                <circle cx={px} cy={py} r={isHero ? 7 : 5} fill={sc.color} opacity={0.2} />
                <circle cx={ex} cy={ey} r={isHero ? 6 : 4} fill={sc.color} opacity={0.9} />
                <circle cx={ex} cy={ey} r={isHero ? 10 : 7} fill="none" stroke={sc.color} strokeWidth={0.8} opacity={0.4} />
                <text x={lx} y={ly} textAnchor={anchor} fill={sc.color} fontSize={(isHero ? 11 : 9) / zoom} fontFamily="monospace" opacity={0.85} fontWeight={isHero ? 'bold' : 'normal'}>
                  {sc.fullName}
                </text>
                <text x={lx} y={ly + 11 / zoom} textAnchor={anchor} fill="rgba(255,255,255,0.25)" fontSize={7 / zoom} fontFamily="monospace">
                  {formatDistance(d.distanceKm)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Zoom hint */}
      <div className="absolute bottom-10 right-4 text-[7px] text-white/15 tracking-widest pointer-events-none">
        SCROLL TO ZOOM · DRAG TO PAN
      </div>
    </div>
  );
}

/* ─── Main component ─── */
export function Signal() {
  const [dishes, setDishes]           = useState<DishState[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [nowMs, setNowMs]             = useState(Date.now());
  const [selected, setSelected]       = useState<DishState | null>(null);
  const [tab, setTab]                 = useState<'links' | 'map'>('links');
  // Track which dish names changed on last poll for flash effect
  const [flashSet, setFlashSet]       = useState<Set<string>>(new Set());
  const prevDishesRef                 = useRef<Map<string, DishState>>(new Map());
  const abortRef                      = useRef<AbortController | null>(null);

  const fetchDsn = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    try {
      const res = await fetch(DSN_URL, { signal: abortRef.current.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const parsed = parseDsnXml(text);

      // Compute which dishes changed vs previous poll
      const prev = prevDishesRef.current;
      const changed = new Set<string>();
      for (const d of parsed) {
        const p = prev.get(d.name);
        if (p && (p.distanceKm !== d.distanceKm || p.downDataRate !== d.downDataRate || p.spacecraft !== d.spacecraft)) {
          changed.add(d.name);
        }
      }
      prevDishesRef.current = new Map(parsed.map(d => [d.name, d]));

      setDishes(parsed);
      setLastUpdated(Date.now());
      setLoading(false);
      setError(null);
      if (changed.size > 0) {
        setFlashSet(changed);
        setTimeout(() => setFlashSet(new Set()), 900);
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setError('DSN feed unavailable');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDsn();
    const id = setInterval(fetchDsn, POLL_MS);
    return () => { clearInterval(id); abortRef.current?.abort(); };
  }, [fetchDsn]);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const secsAgo = lastUpdated ? Math.floor((nowMs - lastUpdated) / 1000) : null;

  // Filter out DSN internal entries entirely
  const visibleDishes = useMemo(() =>
    dishes.filter(d => !isInternal(d.spacecraft)), [dishes]);

  const activeDishes = useMemo(() =>
    visibleDishes.filter(d => d.isActive), [visibleDishes]);

  const byStation = useMemo(() => {
    const map: Record<string, DishState[]> = { gdscc: [], mdscc: [], cdscc: [] };
    for (const d of visibleDishes) {
      if (map[d.station]) map[d.station].push(d);
    }
    return map;
  }, [visibleDishes]);

  const farthest = useMemo(() =>
    activeDishes.reduce<DishState | null>((best, d) =>
      !best || d.distanceKm > best.distanceKm ? d : best, null),
  [activeDishes]);

  // Bottom ticker: sort by distance descending (Voyager leftmost)
  const tickerDishes = useMemo(() =>
    [...activeDishes].sort((a, b) => b.distanceKm - a.distanceKm).slice(0, 8),
  [activeDishes]);

  return (
    <div className="w-full h-full bg-[#020408] text-white font-mono overflow-hidden flex flex-col">

      {/* ── TOP BAR ── */}
      <div className="flex items-stretch border-b border-white/10 bg-black/60 shrink-0 flex-wrap">
        <div className="flex items-center gap-3 px-6 py-3 border-r border-white/10">
          <span className="text-[9px] tracking-[0.35em] text-white/30 uppercase">MODULE</span>
          <span className="text-sm font-bold tracking-widest text-emerald-400">SIGNAL</span>
        </div>

        <div className="flex items-center px-5 py-3 border-r border-white/10 gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-yellow-400 animate-pulse' : error ? 'bg-red-500' : 'bg-emerald-400 animate-pulse'}`} />
          <span className="text-[9px] tracking-[0.3em] text-white/30 uppercase">
            {loading ? 'CONNECTING...' : error ? 'ERROR' : 'NASA DSN · LIVE'}
          </span>
        </div>

        <div className="flex items-center px-5 py-3 border-r border-white/10 gap-3">
          <span className="text-[9px] text-white/30 uppercase tracking-widest">LINKS</span>
          <span className="text-sm font-bold tabular-nums text-emerald-400">{activeDishes.length}</span>
        </div>

        {farthest && (
          <div className="flex items-center px-5 py-3 border-r border-white/10 gap-3">
            <span className="text-[9px] text-white/20 tracking-widest">FARTHEST</span>
            <span className="text-[9px] font-bold tabular-nums" style={{ color: scInfo(farthest.spacecraft).color }}>
              {scInfo(farthest.spacecraft).fullName}
            </span>
            <span className="text-[9px] text-white/30 tabular-nums">{formatDistance(farthest.distanceKm)}</span>
          </div>
        )}

        <div className="flex items-center px-5 py-3 border-r border-white/10 gap-2 ml-auto">
          <span className="text-[8px] text-white/15 tabular-nums">
            {secsAgo === null ? '—' : secsAgo === 0 ? 'JUST NOW' : `${secsAgo}s AGO`}
          </span>
        </div>

        <div className="flex items-center px-3 py-3 gap-1">
          {(['links', 'map'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-3 py-1 text-[8px] tracking-widest uppercase transition-colors border"
              style={{
                borderColor: tab === t ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.08)',
                color: tab === t ? '#34d399' : 'rgba(255,255,255,0.25)',
                background: tab === t ? 'rgba(52,211,153,0.06)' : 'transparent',
              }}
            >{t}</button>
          ))}
        </div>
      </div>

      {/* ── MAIN ── */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {tab === 'map' ? (
            <div className="flex-1 relative overflow-hidden bg-[#020408]">
              <NetworkMap dishes={visibleDishes} />
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-6 pointer-events-none">
                {Object.entries(STATIONS).map(([key, st]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: st.color }} />
                    <span className="text-[8px] text-white/30 tracking-wider">{st.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 overflow-hidden">
              {loading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 rounded-full border-t border-emerald-400 animate-spin" />
                    <div className="text-[9px] text-white/20 tracking-widest uppercase">Connecting to DSN</div>
                  </div>
                </div>
              ) : error ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-[9px] text-red-400/50 tracking-widest uppercase">{error}</div>
                </div>
              ) : (
                Object.keys(STATIONS).map(key => (
                  <StationColumn
                    key={key}
                    stationKey={key}
                    dishes={byStation[key] ?? []}
                    selectedDish={selected}
                    onSelect={d => setSelected(prev => prev?.name === d.name ? null : d)}
                    flashSet={flashSet}
                  />
                ))
              )}
            </div>
          )}
        </div>

        <AnimatePresence>
          {selected && (
            <DetailPanel dish={selected} onClose={() => setSelected(null)} />
          )}
        </AnimatePresence>
      </div>

      {/* ── BOTTOM TICKER — sorted by distance desc ── */}
      {tickerDishes.length > 0 && (
        <div className="border-t border-white/10 bg-black/40 px-6 py-2 flex gap-8 overflow-x-auto shrink-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {tickerDishes.map(d => {
            const sc = scInfo(d.spacecraft);
            return (
              <div key={d.name} className="flex items-center gap-3 shrink-0">
                <span className="w-1 h-1 rounded-full" style={{ backgroundColor: sc.color }} />
                <span className="text-[8px] tracking-wider" style={{ color: sc.color }}>{sc.fullName}</span>
                <span className="text-[8px] text-white/20">·</span>
                <span className="text-[8px] text-white/40 tabular-nums">{formatDistance(d.distanceKm)}</span>
                {d.rtltSeconds > 0 && (
                  <>
                    <span className="text-[8px] text-white/20">·</span>
                    <span className="text-[8px] text-white/25 tabular-nums">{formatRTLT(d.rtltSeconds)} RTLT</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
