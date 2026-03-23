'use client';

import { useEffect, useRef, useState, useMemo, Suspense, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useTexture, Line } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';

/* ─── Types ─── */
interface Storm {
  id: string;
  name: string;
  basin: string;
  classification: string;
  lat: number;
  lon: number;
  windSpeed: number;        // knots
  pressure?: number;        // mb
  movement?: string;
  source: 'nhc' | 'gdacs' | 'jtwc';
  forecastTrack?: [number, number][];   // [lat, lon] pairs
  conePoly?: [number, number][];        // cone of uncertainty polygon
  historicalTrack?: [number, number][]; // past positions
}

interface HistoricalStorm {
  id: string;
  name: string;
  year: number;
  track: [number, number][];
  maxWind: number;
}

/* ─── Helpers ─── */
function ll2v(lat: number, lon: number, r = 2.02): THREE.Vector3 {
  const phi   = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  );
}

function categoryColor(windKnots: number): string {
  if (windKnots < 34)  return '#94a3b8'; // TD
  if (windKnots < 64)  return '#38bdf8'; // TS
  if (windKnots < 83)  return '#facc15'; // Cat 1
  if (windKnots < 96)  return '#fb923c'; // Cat 2
  if (windKnots < 113) return '#f87171'; // Cat 3
  if (windKnots < 137) return '#e879f9'; // Cat 4
  return '#ffffff';                       // Cat 5
}

function categoryLabel(windKnots: number): string {
  if (windKnots < 34)  return 'TD';
  if (windKnots < 64)  return 'TS';
  if (windKnots < 83)  return 'CAT 1';
  if (windKnots < 96)  return 'CAT 2';
  if (windKnots < 113) return 'CAT 3';
  if (windKnots < 137) return 'CAT 4';
  return 'CAT 5';
}

/* ─── Parse NHC CurrentStorms response ─── */
function parseNhcStorms(raw: any[]): Storm[] {
  return raw.map((s: any) => {
    const id = s.id ?? s.stormId ?? `nhc-${s.name}`;
    return {
      id,
      name: s.name ?? 'Unknown',
      basin: s.basin ?? '',
      classification: s.classification ?? '',
      lat: parseFloat(s.latitudeNumeric ?? s.lat ?? 0),
      lon: parseFloat(s.longitudeNumeric ?? s.lon ?? 0),
      windSpeed: parseFloat(s.maxWindMPH ?? s.windSpeed ?? 0) * 0.868976, // mph→knots if needed
      pressure: s.minPressureMB ? parseFloat(s.minPressureMB) : undefined,
      movement: s.movementDesc,
      source: 'nhc' as const,
    };
  }).filter(s => isFinite(s.lat) && isFinite(s.lon));
}

/* ─── Parse NHC forecast GeoJSON ─── */
function parseForecastGeoJSON(stormId: string, geojson: any): Partial<Storm> {
  if (!geojson?.features) return {};
  const track: [number, number][] = [];
  const cone: [number, number][] = [];

  for (const f of geojson.features) {
    const type = f.geometry?.type;
    const props = f.properties ?? {};

    if (type === 'LineString' && props.STORMTYPE !== undefined) {
      // forecast track line
      for (const [lon, lat] of (f.geometry.coordinates ?? [])) {
        track.push([lat, lon]);
      }
    }
    if (type === 'Polygon' && props.FCSTPRD !== undefined) {
      // cone polygon
      for (const [lon, lat] of (f.geometry.coordinates?.[0] ?? [])) {
        cone.push([lat, lon]);
      }
    }
  }

  return { forecastTrack: track.length ? track : undefined, conePoly: cone.length ? cone : undefined };
}

/* ─── Globe sub-components ─── */
function Atmosphere() {
  return (
    <mesh>
      <sphereGeometry args={[2.05, 64, 64]} />
      <shaderMaterial
        transparent blending={THREE.AdditiveBlending} side={THREE.BackSide} depthWrite={false}
        vertexShader={`varying vec3 vNormal;void main(){vNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`}
        fragmentShader={`varying vec3 vNormal;void main(){float i=pow(0.65-dot(vNormal,vec3(0,0,1.0)),4.0);gl_FragColor=vec4(0.2,0.5,1.0,1.0)*i*2.0;}`}
      />
    </mesh>
  );
}

function Clouds() {
  const cloudMap = useTexture('/earth-clouds.png');
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 0.01; });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[2.03, 64, 64]} />
      <meshStandardMaterial map={cloudMap} transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

function EarthGlobe() {
  const colorMap = useTexture('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg');
  return (
    <mesh>
      <sphereGeometry args={[2, 64, 64]} />
      <meshStandardMaterial map={colorMap} roughness={0.8} metalness={0.1} />
    </mesh>
  );
}

function Stars() {
  const positions = useMemo(() => {
    const arr = new Float32Array(2000 * 3);
    for (let i = 0; i < 2000; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = 80 + Math.random() * 40;
      arr[i*3]   = r * Math.sin(phi) * Math.cos(theta);
      arr[i*3+1] = r * Math.cos(phi);
      arr[i*3+2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return arr;
  }, []);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.12} sizeAttenuation transparent opacity={0.6} />
    </points>
  );
}

/* ─── Storm marker: spinning cyclone ─── */
function StormMarker({ storm, selected, onClick }: { storm: Storm; selected: boolean; onClick: () => void }) {
  const pos    = useMemo(() => ll2v(storm.lat, storm.lon, 2.02), [storm.lat, storm.lon]);
  const normal = useMemo(() => pos.clone().normalize(), [pos]);
  const q      = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal), [normal]);
  const color  = categoryColor(storm.windSpeed);
  const t      = useRef(0);
  const ring1  = useRef<THREE.Mesh>(null);
  const ring2  = useRef<THREE.Mesh>(null);
  const ring3  = useRef<THREE.Mesh>(null);
  const dot    = useRef<THREE.Mesh>(null);
  const scale  = Math.max(0.6, Math.min(2.0, storm.windSpeed / 80));

  useFrame((_, dt) => {
    t.current += dt;
    // Pulsing rings — simulate cyclone rotation
    const p1 = (t.current * 0.8) % (Math.PI * 2);
    const p2 = (t.current * 0.8 + Math.PI * 0.66) % (Math.PI * 2);
    const p3 = (t.current * 0.8 + Math.PI * 1.33) % (Math.PI * 2);
    const pulse = (p: number) => 0.5 + 0.5 * Math.sin(p);

    if (ring1.current) {
      const s = (0.06 + pulse(p1) * 0.08) * scale;
      ring1.current.scale.set(s, s, s);
      (ring1.current.material as THREE.MeshBasicMaterial).opacity = selected ? 0.9 : 0.6 + pulse(p1) * 0.3;
    }
    if (ring2.current) {
      const s = (0.06 + pulse(p2) * 0.08) * scale;
      ring2.current.scale.set(s, s, s);
      (ring2.current.material as THREE.MeshBasicMaterial).opacity = selected ? 0.7 : 0.4 + pulse(p2) * 0.3;
    }
    if (ring3.current) {
      const s = (0.06 + pulse(p3) * 0.08) * scale;
      ring3.current.scale.set(s, s, s);
      (ring3.current.material as THREE.MeshBasicMaterial).opacity = selected ? 0.5 : 0.25 + pulse(p3) * 0.2;
    }
    if (dot.current) {
      dot.current.scale.setScalar(selected ? 1.5 + Math.sin(t.current * 4) * 0.2 : 1);
    }
  });

  return (
    <group position={pos} quaternion={q}>
      {/* Core dot */}
      <mesh ref={dot} onClick={onClick}>
        <circleGeometry args={[0.022, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {/* Three staggered rings for cyclone feel */}
      {[ring1, ring2, ring3].map((ref, i) => (
        <mesh key={i} ref={ref}>
          <ringGeometry args={[0.035 + i * 0.018, 0.05 + i * 0.018, 32]} />
          <meshBasicMaterial color={color} transparent side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

/* ─── Forecast cone polygon on globe ─── */
function ConePoly({ coords, color }: { coords: [number, number][]; color: string }) {
  const pts = useMemo(() => coords.map(([lat, lon]) => ll2v(lat, lon, 2.025)), [coords]);
  if (pts.length < 2) return null;
  return (
    <Line points={[...pts, pts[0]]} color={color} lineWidth={0.8} transparent opacity={0.35} />
  );
}

/* ─── Animated forecast track — moving pulse along the path ─── */
function ForecastTrack({ coords, color }: { coords: [number, number][]; color: string }) {
  const pts = useMemo(() => coords.map(([lat, lon]) => ll2v(lat, lon, 2.025)), [coords]);
  const coreRef  = useRef<THREE.Points>(null);
  const haloRef  = useRef<THREE.Points>(null);
  const t = useRef(0);

  const { totalLen, cumDist } = useMemo(() => {
    let total = 0;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) {
      total += pts[i].distanceTo(pts[i - 1]);
      cum.push(total);
    }
    return { totalLen: total, cumDist: cum };
  }, [pts]);

  const sampleAt = useCallback((d: number): THREE.Vector3 => {
    const clamped = Math.max(0, Math.min(totalLen, d));
    for (let i = 1; i < cumDist.length; i++) {
      if (cumDist[i] >= clamped) {
        const segLen = cumDist[i] - cumDist[i - 1];
        const frac = segLen > 0 ? (clamped - cumDist[i - 1]) / segLen : 0;
        return pts[i - 1].clone().lerp(pts[i], frac);
      }
    }
    return pts[pts.length - 1].clone();
  }, [pts, cumDist, totalLen]);

  const pulsePositions = useMemo(() => new Float32Array(3), []);

  useFrame((_, dt) => {
    t.current = (t.current + dt * 0.18) % 1;
    const pos = sampleAt(t.current * totalLen);
    pulsePositions[0] = pos.x;
    pulsePositions[1] = pos.y;
    pulsePositions[2] = pos.z;
    const geo1 = (coreRef.current?.geometry as THREE.BufferGeometry | undefined);
    const geo2 = (haloRef.current?.geometry as THREE.BufferGeometry | undefined);
    if (geo1) geo1.attributes.position.needsUpdate = true;
    if (geo2) geo2.attributes.position.needsUpdate = true;
    const scale = 1 + 0.35 * Math.sin(t.current * Math.PI * 24);
    coreRef.current?.scale.setScalar(scale);
    haloRef.current?.scale.setScalar(scale);
  });

  if (pts.length < 2) return null;

  return (
    <group>
      {/* Faint base trail */}
      <Line points={pts} color={color} lineWidth={0.5} transparent opacity={0.18} />
      {/* Solid track */}
      <Line points={pts} color={color} lineWidth={1.8} transparent opacity={0.5} />
      {/* Shared geometry for pulse */}
      {/* Core bright dot */}
      <points ref={coreRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[pulsePositions, 3]} />
        </bufferGeometry>
        <pointsMaterial color={color} size={0.055} sizeAttenuation transparent opacity={1}
          blending={THREE.AdditiveBlending} depthWrite={false} />
      </points>
      {/* Soft halo */}
      <points ref={haloRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[pulsePositions, 3]} />
        </bufferGeometry>
        <pointsMaterial color={color} size={0.15} sizeAttenuation transparent opacity={0.28}
          blending={THREE.AdditiveBlending} depthWrite={false} />
      </points>
    </group>
  );
}

/* ─── Historical track line ─── */
function HistoricalTrack({ track, color }: { track: [number, number][]; color: string }) {
  const pts = useMemo(() => track.map(([lat, lon]) => ll2v(lat, lon, 2.022)), [track]);
  if (pts.length < 2) return null;
  return <Line points={pts} color={color} lineWidth={0.6} transparent opacity={0.25} />;
}

/* ─── Scene ─── */
function Scene({
  storms, selected, onSelect, historicalStorms, showHistory,
}: {
  storms: Storm[];
  selected: Storm | null;
  onSelect: (s: Storm) => void;
  historicalStorms: HistoricalStorm[];
  showHistory: boolean;
}) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 5, 5]} intensity={1.4} color="#fff8f0" />
      <directionalLight position={[-8, -3, -5]} intensity={0.15} color="#334466" />
      <Suspense fallback={null}>
        <Stars />
        <EarthGlobe />
        <Atmosphere />
        <Clouds />

        {/* Historical tracks */}
        {showHistory && historicalStorms.map(h => (
          <HistoricalTrack key={h.id} track={h.track} color={categoryColor(h.maxWind)} />
        ))}

        {/* Active storm overlays */}
        {storms.map(s => (
          <group key={s.id}>
            {s.conePoly && <ConePoly coords={s.conePoly} color={categoryColor(s.windSpeed)} />}
            {s.forecastTrack && <ForecastTrack coords={s.forecastTrack} color={categoryColor(s.windSpeed)} />}
            <StormMarker storm={s} selected={selected?.id === s.id} onClick={() => onSelect(s)} />
          </group>
        ))}
      </Suspense>
      <OrbitControls enablePan={false} minDistance={2.8} maxDistance={14} autoRotate autoRotateSpeed={0.08} />
    </>
  );
}

/* ─── IBTrACS CSV parser (minimal — only what we need) ─── */
function parseIBTraCS(csv: string): HistoricalStorm[] {
  const lines = csv.split('\n');
  // Skip first 2 header lines
  const dataLines = lines.slice(2).filter(l => l.trim());
  const storms = new Map<string, HistoricalStorm>();

  for (const line of dataLines) {
    const cols = line.split(',');
    if (cols.length < 12) continue;
    const sid   = cols[0]?.trim();
    const name  = cols[5]?.trim() || 'UNNAMED';
    const year  = parseInt(cols[1]?.trim() ?? '0');
    const lat   = parseFloat(cols[8]?.trim() ?? '');
    const lon   = parseFloat(cols[9]?.trim() ?? '');
    const wind  = parseFloat(cols[10]?.trim() ?? '0');
    if (!sid || !isFinite(lat) || !isFinite(lon)) continue;

    if (!storms.has(sid)) {
      storms.set(sid, { id: sid, name, year, track: [], maxWind: 0 });
    }
    const s = storms.get(sid)!;
    s.track.push([lat, lon]);
    if (wind > s.maxWind) s.maxWind = wind;
  }

  return Array.from(storms.values()).filter(s => s.track.length >= 2);
}

/* ─── Main component ─── */
const POLL_MS = 300_000; // 5 min

export function Storms() {
  const [storms, setStorms]           = useState<Storm[]>([]);
  const [selected, setSelected]       = useState<Storm | null>(null);
  const [loading, setLoading]         = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [nowMs, setNowMs]             = useState(Date.now());
  const [historicalStorms, setHistoricalStorms] = useState<HistoricalStorm[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [histLoading, setHistLoading] = useState(false);
  const [error, setError]             = useState<string | null>(null);

  /* ── Fetch active storms ── */
  const fetchStorms = useCallback(async () => {
    try {
      const res  = await fetch('/api/storms');
      const data = await res.json();
      const merged: Storm[] = (data.storms ?? []).map((s: any) => ({
        ...s,
        source: (s.source ?? 'jtwc') as Storm['source'],
      }));
      setStorms(merged);
      setLastUpdated(Date.now());
      setLoading(false);
      setError(null);
    } catch (e) {
      setError('Failed to fetch storm data');
      setLoading(false);
    }
  }, []);

  /* ── Load historical IBTrACS on demand ── */
  const loadHistory = useCallback(async () => {
    if (historicalStorms.length > 0) { setShowHistory(h => !h); return; }
    setHistLoading(true);
    try {
      const res = await fetch(
        'https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r00/access/csv/ibtracs.last3years.list.v04r00.csv'
      );
      const text = await res.text();
      const parsed = parseIBTraCS(text);
      setHistoricalStorms(parsed);
      setShowHistory(true);
    } catch { setError('Failed to load historical data'); }
    setHistLoading(false);
  }, [historicalStorms.length]);

  useEffect(() => {
    fetchStorms();
    const id = setInterval(fetchStorms, POLL_MS);
    return () => clearInterval(id);
  }, [fetchStorms]);

  // "X min ago" ticker
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const minsAgo = lastUpdated ? Math.floor((nowMs - lastUpdated) / 60_000) : null;

  const handleSelect = useCallback((s: Storm) => {
    setSelected(prev => prev?.id === s.id ? null : s);
  }, []);

  return (
    <div className="w-full h-full bg-[#020810] text-white font-mono overflow-hidden flex flex-col">

      {/* ── TOP BAR ── */}
      <div className="flex items-stretch border-b border-white/10 bg-black/60 shrink-0 flex-wrap">
        <div className="flex items-center gap-3 px-6 py-3 border-r border-white/10">
          <span className="text-[9px] tracking-[0.35em] text-white/30 uppercase">MODULE</span>
          <span className="text-sm font-bold tracking-widest text-cyan-300">STORMS</span>
        </div>

        <div className="flex items-center px-5 py-3 border-r border-white/10 gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-yellow-400 animate-pulse' : error ? 'bg-red-500' : 'bg-cyan-400 animate-pulse'}`} />
          <span className="text-[9px] tracking-[0.3em] text-white/30 uppercase">
            {loading ? 'LOADING...' : error ? 'ERROR' : 'NOAA NHC · GDACS'}
          </span>
        </div>

        <div className="flex items-center px-5 py-3 border-r border-white/10 gap-3">
          <span className="text-[9px] text-white/30 uppercase tracking-widest">ACTIVE</span>
          <span className="text-sm font-bold tabular-nums text-cyan-300">{storms.length}</span>
        </div>

        <div className="flex items-center px-5 py-3 border-r border-white/10 gap-3">
          <span className="text-[9px] text-white/20 tracking-widest">
            {minsAgo === null ? '—' : minsAgo === 0 ? 'JUST UPDATED' : `UPDATED ${minsAgo}M AGO`}
          </span>
        </div>

        <div className="flex items-center px-4 py-3 ml-auto gap-3">
          <button
            onClick={loadHistory}
            disabled={histLoading}
            className="flex items-center gap-2 px-4 py-1.5 text-[9px] tracking-[0.25em] uppercase border transition-all duration-200"
            style={{
              borderColor: showHistory ? 'rgba(34,211,238,0.4)' : 'rgba(255,255,255,0.1)',
              color: showHistory ? '#22d3ee' : 'rgba(255,255,255,0.3)',
              background: showHistory ? 'rgba(34,211,238,0.06)' : 'transparent',
            }}
          >
            {histLoading ? '...' : showHistory ? '◉ HISTORY ON' : '○ HISTORY'}
          </button>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Globe */}
        <div className="flex-1 relative">
          <Canvas camera={{ position: [0, 0, 6], fov: 45 }}>
            <Scene
              storms={storms}
              selected={selected}
              onSelect={handleSelect}
              historicalStorms={historicalStorms}
              showHistory={showHistory}
            />
          </Canvas>

          {/* Category legend */}
          <div className="absolute bottom-6 left-6 flex flex-col gap-1.5">
            {[
              { label: 'CAT 5', color: '#ffffff', min: 137 },
              { label: 'CAT 4', color: '#e879f9', min: 113 },
              { label: 'CAT 3', color: '#f87171', min: 96 },
              { label: 'CAT 2', color: '#fb923c', min: 83 },
              { label: 'CAT 1', color: '#facc15', min: 64 },
              { label: 'T. STORM', color: '#38bdf8', min: 34 },
              { label: 'T. DEP.', color: '#94a3b8', min: 0 },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-[8px] text-white/30 tracking-wider">{label}</span>
              </div>
            ))}
          </div>

          {/* No storms notice */}
          {!loading && storms.length === 0 && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <div className="text-[9px] tracking-[0.3em] text-white/20 uppercase">NO ACTIVE STORMS</div>
              <div className="text-[8px] text-white/10 mt-1">Basin is quiet</div>
            </div>
          )}

          {/* Sources */}
          <div className="absolute bottom-6 right-6 text-right">
            <div className="text-[8px] text-white/15 tracking-wider">NOAA NHC · GDACS</div>
            {showHistory && <div className="text-[8px] text-cyan-400/30 tracking-wider mt-0.5">+ IBTrACS 3yr</div>}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="w-72 shrink-0 border-l border-white/10 flex flex-col overflow-hidden bg-black/20">
          <div className="px-4 py-3 border-b border-white/10">
            <span className="text-[9px] tracking-[0.3em] text-white/30 uppercase">ACTIVE SYSTEMS</span>
          </div>

          <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-6 h-6 rounded-full border-t border-cyan-400 animate-spin" />
              </div>
            ) : storms.length === 0 ? (
              <div className="px-4 py-6 text-[9px] text-white/20 tracking-widest uppercase text-center">
                No active storms
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {storms.map(s => {
                  const color = categoryColor(s.windSpeed);
                  const isSelected = selected?.id === s.id;
                  return (
                    <motion.button
                      key={s.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      onClick={() => handleSelect(s)}
                      className="w-full text-left px-4 py-3 border-b border-white/[0.04] transition-colors"
                      style={{ background: isSelected ? `${color}10` : 'transparent' }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: color }} />
                          <span className="text-xs font-bold tracking-wider" style={{ color }}>
                            {s.name}
                          </span>
                        </div>
                        <span className="text-[8px] tracking-widest px-1.5 py-0.5 border" style={{ borderColor: `${color}40`, color }}>
                          {categoryLabel(s.windSpeed)}
                        </span>
                      </div>
                      <div className="flex gap-4 text-[8px] text-white/30 pl-4">
                        <span>{s.lat.toFixed(1)}°{s.lat >= 0 ? 'N' : 'S'} {Math.abs(s.lon).toFixed(1)}°{s.lon >= 0 ? 'E' : 'W'}</span>
                        <span>{Math.round(s.windSpeed)} kt</span>
                        {s.pressure && <span>{s.pressure} mb</span>}
                      </div>
                      {s.movement && (
                        <div className="text-[8px] text-white/20 pl-4 mt-0.5">{s.movement}</div>
                      )}
                      <div className="text-[8px] text-white/15 pl-4 mt-0.5 uppercase tracking-wider">
                        {s.basin} · {s.source === 'nhc' ? 'NHC' : 'GDACS'}
                      </div>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            )}
          </div>

          {/* Selected storm detail */}
          <AnimatePresence>
            {selected && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="border-t border-white/10 px-4 py-4 flex flex-col gap-2 bg-black/40"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[9px] tracking-[0.3em] text-white/30 uppercase">DETAIL</span>
                  <button onClick={() => setSelected(null)} className="text-[9px] text-white/20 hover:text-white/50">✕</button>
                </div>
                <div className="text-sm font-bold" style={{ color: categoryColor(selected.windSpeed) }}>
                  {selected.name}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[9px]">
                  <span className="text-white/30">WIND</span>
                  <span className="text-white/70">{Math.round(selected.windSpeed)} kt / {Math.round(selected.windSpeed * 1.15078)} mph</span>
                  {selected.pressure && <>
                    <span className="text-white/30">PRESSURE</span>
                    <span className="text-white/70">{selected.pressure} mb</span>
                  </>}
                  <span className="text-white/30">POSITION</span>
                  <span className="text-white/70">{selected.lat.toFixed(2)}° {selected.lon.toFixed(2)}°</span>
                  <span className="text-white/30">BASIN</span>
                  <span className="text-white/70">{selected.basin || '—'}</span>
                  <span className="text-white/30">FORECAST</span>
                  <span className="text-white/70">{selected.forecastTrack ? `${selected.forecastTrack.length} pts` : 'N/A'}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer */}
          <div className="border-t border-white/10 px-4 py-3 flex flex-col gap-1.5 shrink-0">
            <div className="flex justify-between text-[9px]">
              <span className="text-white/25 tracking-widest uppercase">Poll</span>
              <span className="text-white/40">5 min</span>
            </div>
            <div className="flex justify-between text-[9px]">
              <span className="text-white/25 tracking-widest uppercase">Coverage</span>
              <span className="text-white/40">Global</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
