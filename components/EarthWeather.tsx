'use client';

import { useEffect, useRef, useState, useMemo, Suspense, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useTexture, Line } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';

/* ─── Types ─── */
interface WeatherData {
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    surface_pressure: number;
    precipitation: number;
  };
  daily: {
    time: string[];
    sunrise: string[];
    sunset: string[];
    uv_index_max: number[];
    precipitation_sum: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
    wind_speed_10m_max: number[];
  };
  timezone: string;
  timezone_abbreviation: string;
}

interface AqData {
  current: { pm10: number; pm2_5: number; us_aqi: number };
}

interface LocationPin {
  lat: number;
  lon: number;
  name: string;
  weather: WeatherData | null;
  aq: AqData | null;
}

/* ─── WMO weather code → label ─── */
function wmoLabel(code: number): string {
  if (code === 0) return 'CLEAR SKY';
  if (code <= 2) return 'PARTLY CLOUDY';
  if (code === 3) return 'OVERCAST';
  if (code <= 49) return 'FOG';
  if (code <= 59) return 'DRIZZLE';
  if (code <= 69) return 'RAIN';
  if (code <= 79) return 'SNOW';
  if (code <= 84) return 'RAIN SHOWERS';
  if (code <= 94) return 'THUNDERSTORM';
  return 'STORM';
}

function wmoIcon(code: number): string {
  if (code === 0) return '○';
  if (code <= 2) return '◑';
  if (code === 3) return '●';
  if (code <= 49) return '≋';
  if (code <= 59) return '·';
  if (code <= 69) return '↓';
  if (code <= 79) return '❄';
  if (code <= 84) return '↓';
  if (code <= 94) return '⚡';
  return '⚡';
}

/* ─── AQI label ─── */
function aqiLabel(aqi: number): { label: string; color: string } {
  if (aqi <= 50)  return { label: 'GOOD',        color: '#4ade80' };
  if (aqi <= 100) return { label: 'MODERATE',    color: '#facc15' };
  if (aqi <= 150) return { label: 'UNHEALTHY·S', color: '#fb923c' };
  if (aqi <= 200) return { label: 'UNHEALTHY',   color: '#f87171' };
  if (aqi <= 300) return { label: 'VERY UNHEALTHY', color: '#c084fc' };
  return { label: 'HAZARDOUS', color: '#be123c' };
}

/* ─── Wind direction ─── */
function windDir(deg: number): string {
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(deg / 45) % 8];
}

/* ─── lat/lon → THREE.Vector3 on sphere ─── */
function latLonToVec3(lat: number, lon: number, r = 2.02): THREE.Vector3 {
  const phi   = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r  * Math.cos(phi),
    r  * Math.sin(phi) * Math.sin(theta),
  );
}

/* ─── Globe ─── */
function Atmosphere() {
  return (
    <mesh>
      <sphereGeometry args={[2.05, 64, 64]} />
      <shaderMaterial
        transparent blending={THREE.AdditiveBlending} side={THREE.BackSide} depthWrite={false}
        vertexShader={`varying vec3 vNormal;void main(){vNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`}
        fragmentShader={`varying vec3 vNormal;void main(){float i=pow(0.65-dot(vNormal,vec3(0,0,1.0)),4.0);gl_FragColor=vec4(0.3,0.6,1.0,1.0)*i*1.5;}`}
      />
    </mesh>
  );
}

function Clouds() {
  const cloudMap = useTexture('/earth-clouds.png');
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 0.018; });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[2.03, 64, 64]} />
      <meshStandardMaterial map={cloudMap} transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

function EarthGlobe({ onClick }: { onClick: (lat: number, lon: number) => void }) {
  const colorMap = useTexture('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg');
  const meshRef  = useRef<THREE.Mesh>(null);
  const { camera, raycaster, gl } = useThree();
  const mouseDown = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = gl.domElement;

    const onDown = (e: MouseEvent) => { mouseDown.current = { x: e.clientX, y: e.clientY }; };

    const onUp = (e: MouseEvent) => {
      if (!mouseDown.current || !meshRef.current) return;
      const dx = e.clientX - mouseDown.current.x;
      const dy = e.clientY - mouseDown.current.y;
      mouseDown.current = null;
      // ignore if it was a drag (moved more than 4px)
      if (Math.sqrt(dx * dx + dy * dy) > 4) return;

      const rect = el.getBoundingClientRect();
      const ndc  = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width)  * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObject(meshRef.current);
      if (!hits.length) return;
      const p = hits[0].point.normalize();
      const lat = 90 - Math.acos(Math.max(-1, Math.min(1, p.y))) * (180 / Math.PI);
      const lon = Math.atan2(p.z, -p.x) * (180 / Math.PI) - 180;
      onClick(lat, lon);
    };

    el.addEventListener('mousedown', onDown);
    el.addEventListener('mouseup', onUp);
    return () => { el.removeEventListener('mousedown', onDown); el.removeEventListener('mouseup', onUp); };
  }, [gl, camera, raycaster, onClick]);

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[2, 64, 64]} />
      <meshStandardMaterial map={colorMap} roughness={0.8} metalness={0.1} />
    </mesh>
  );
}

/* ─── Pin marker on globe ─── */
function PinMarker({ pin, active, onClick }: { pin: LocationPin; active: boolean; onClick: () => void }) {
  const pos = useMemo(() => latLonToVec3(pin.lat, pin.lon, 2.04), [pin.lat, pin.lon]);
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.5;
  });

  const color = active ? '#ffffff' : '#60a5fa';

  return (
    <group position={pos}>
      <mesh ref={ref} onClick={onClick}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {active && (
        <mesh>
          <ringGeometry args={[0.05, 0.07, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

/* ─── Lat/lon grid lines ─── */
function GlobeGrid() {
  const lines = useMemo(() => {
    const result: THREE.Vector3[][] = [];
    // latitude lines every 30°
    for (let lat = -60; lat <= 60; lat += 30) {
      const pts: THREE.Vector3[] = [];
      for (let lon = -180; lon <= 180; lon += 4) pts.push(latLonToVec3(lat, lon, 2.022));
      result.push(pts);
    }
    // longitude lines every 30°
    for (let lon = -180; lon < 180; lon += 30) {
      const pts: THREE.Vector3[] = [];
      for (let lat = -90; lat <= 90; lat += 4) pts.push(latLonToVec3(lat, lon, 2.022));
      result.push(pts);
    }
    return result;
  }, []);

  return (
    <>
      {lines.map((pts, i) => (
        <Line key={i} points={pts} color="#ffffff" lineWidth={0.3} transparent opacity={0.04} />
      ))}
    </>
  );
}

/* ─── Stars ─── */
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
      <pointsMaterial color="#ffffff" size={0.18} sizeAttenuation transparent opacity={0.7} />
    </points>
  );
}

function Scene({ pins, activeIdx, onGlobeClick, onPinClick }: {
  pins: LocationPin[];
  activeIdx: number;
  onGlobeClick: (lat: number, lon: number) => void;
  onPinClick: (i: number) => void;
}) {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 5, 5]} intensity={2.5} color="#fff8e0" />
      <directionalLight position={[-8, -2, 6]} intensity={0.15} color="#2244aa" />
      <Suspense fallback={null}>
        <Stars />
        <EarthGlobe onClick={onGlobeClick} />
        <Atmosphere />
        <Clouds />
        <GlobeGrid />
        {pins.map((pin, i) => (
          <PinMarker key={i} pin={pin} active={i === activeIdx} onClick={() => onPinClick(i)} />
        ))}
      </Suspense>
      <OrbitControls enablePan={false} minDistance={3} maxDistance={12} autoRotate autoRotateSpeed={0.2} />
    </>
  );
}

/* ─── HUD stat cell ─── */
function Stat({ label, value, sub, color }: { label: string; value: React.ReactNode; sub?: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-5 py-3 border-b border-white/5">
      <span className="text-[9px] tracking-[0.3em] text-white/30 uppercase">{label}</span>
      <span className="text-sm font-bold tabular-nums" style={{ color: color || 'white' }}>{value}</span>
      {sub && <span className="text-[9px] text-white/25 tracking-wider">{sub}</span>}
    </div>
  );
}

/* ─── Reverse geocode via Nominatim ─── */
async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { 'User-Agent': 'COSMOS-NASA-Explorer/1.0' } }
    );
    const d = await r.json();
    return d.address?.country || d.address?.state || `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
  } catch {
    return `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
  }
}

/* ─── Main component ─── */
export function EarthWeather() {
  const [pins, setPins]         = useState<LocationPin[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading]   = useState(false);
  const [hint, setHint]         = useState(true);

  const active = pins[activeIdx] ?? null;
  const w = active?.weather?.current;
  const d = active?.weather?.daily;
  const aq = active?.aq?.current;

  /* fetch weather for a lat/lon */
  const fetchWeather = useCallback(async (lat: number, lon: number) => {
    setLoading(true);
    setHint(false);
    try {
      const name = await reverseGeocode(lat, lon);
      const res  = await fetch(`/api/weather?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`);
      const data = await res.json();
      const pin: LocationPin = {
        lat, lon, name,
        weather: data.weather ?? null,
        aq: data.aq ?? null,
      };
      setPins(prev => {
        // replace if same location already exists (within ~1°)
        const idx = prev.findIndex(p => Math.abs(p.lat - lat) < 1 && Math.abs(p.lon - lon) < 1);
        if (idx >= 0) {
          const next = [...prev]; next[idx] = pin; return next;
        }
        return [...prev, pin];
      });
      setPins(prev => { setActiveIdx(prev.length - 1); return prev; });
    } catch {}
    setLoading(false);
  }, []);

  /* on mount: use geolocation */
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => fetchWeather(coords.latitude, coords.longitude),
        () => fetchWeather(40.7128, -74.006), // fallback: NYC
      );
    } else {
      fetchWeather(40.7128, -74.006);
    }
  }, [fetchWeather]);

  const handleGlobeClick = useCallback((lat: number, lon: number) => {
    fetchWeather(lat, lon);
  }, [fetchWeather]);

  /* format time from ISO string */
  const fmtTime = (iso?: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const aqInfo = aq ? aqiLabel(aq.us_aqi) : null;

  return (
    <div className="w-full h-full bg-[#080808] text-white font-mono overflow-hidden flex flex-col">

      {/* ── TOP BAR ── */}
      <div className="flex items-stretch border-b border-white/10 bg-black/40 shrink-0 flex-wrap">
        <div className="flex items-center gap-3 px-6 py-3 border-r border-white/10">
          <span className="text-[9px] tracking-[0.35em] text-white/30 uppercase">MODULE</span>
          <span className="text-sm font-bold tracking-widest">EARTH WEATHER</span>
        </div>
        <div className="flex items-center px-5 py-3 border-r border-white/10 gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-[9px] tracking-[0.3em] text-white/30 uppercase">OPEN-METEO · NOMINATIM</span>
        </div>
        {active && (
          <div className="flex items-center px-5 py-3 border-r border-white/10 gap-3">
            <span className="text-[9px] text-white/30 uppercase tracking-widest">LOCATION</span>
            <span className="text-sm font-bold text-blue-400 uppercase">{active.name}</span>
          </div>
        )}
        {loading && (
          <div className="flex items-center px-5 py-3 gap-2 ml-auto">
            <div className="w-3 h-3 rounded-full border-t border-blue-400 animate-spin" />
            <span className="text-[9px] text-white/30 tracking-widest">FETCHING...</span>
          </div>
        )}
        <div className="flex items-center px-5 py-3 ml-auto gap-2">
          <span className="text-[9px] text-white/20 tracking-widest hidden md:block">CLICK GLOBE TO SELECT LOCATION</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ── GLOBE ── */}
        <div className="flex-1 relative">
          <Canvas camera={{ position: [0, 0, 6], fov: 45 }}>
            <Scene
              pins={pins}
              activeIdx={activeIdx}
              onGlobeClick={handleGlobeClick}
              onPinClick={setActiveIdx}
            />
          </Canvas>

          {/* hint overlay */}
          <AnimatePresence>
            {hint && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <div className="text-center">
                  <div className="text-[9px] tracking-[0.4em] text-white/20 uppercase mb-2">CLICK ANYWHERE ON THE GLOBE</div>
                  <div className="text-[9px] tracking-[0.3em] text-white/10 uppercase">TO FETCH WEATHER DATA</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* pin tabs */}
          {pins.length > 1 && (
            <div className="absolute bottom-6 left-6 flex flex-col gap-1">
              <span className="text-[9px] tracking-[0.3em] text-white/30 uppercase mb-1">LOCATIONS</span>
              {pins.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIdx(i)}
                  className="text-left px-3 py-1.5 text-[9px] tracking-widest uppercase border transition-colors"
                  style={{
                    borderColor: i === activeIdx ? 'rgba(96,165,250,0.5)' : 'rgba(255,255,255,0.08)',
                    color: i === activeIdx ? '#60a5fa' : 'rgba(255,255,255,0.3)',
                    background: i === activeIdx ? 'rgba(96,165,250,0.08)' : 'transparent',
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}

          {/* coords */}
          {active && (
            <div className="absolute bottom-6 right-6 text-right">
              <div className="text-[9px] text-white/20 tracking-widest">
                {active.lat.toFixed(4)}° {active.lat >= 0 ? 'N' : 'S'} &nbsp;
                {Math.abs(active.lon).toFixed(4)}° {active.lon >= 0 ? 'E' : 'W'}
              </div>
              {active.weather && (
                <div className="text-[9px] text-white/15 tracking-widest mt-0.5">
                  {active.weather.timezone_abbreviation}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="w-72 shrink-0 border-l border-white/10 flex flex-col overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

          {!active || !w ? (
            <div className="flex-1 flex items-center justify-center">
              <span className="text-[9px] text-white/20 tracking-widest">
                {loading ? 'LOADING...' : 'SELECT A LOCATION'}
              </span>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={active.name}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col"
              >
                {/* big temp */}
                <div className="px-5 py-6 border-b border-white/10">
                  <div className="text-[9px] tracking-[0.3em] text-white/30 uppercase mb-1">{active.name}</div>
                  <div className="flex items-end gap-3">
                    <span className="text-6xl font-bold tabular-nums leading-none">
                      {Math.round(w.temperature_2m)}°
                    </span>
                    <div className="flex flex-col mb-1">
                      <span className="text-[9px] text-white/30 tracking-widest">FEELS {Math.round(w.apparent_temperature)}°C</span>
                      <span className="text-[9px] text-white/50 tracking-widest mt-1">
                        {wmoIcon(w.weather_code)} {wmoLabel(w.weather_code)}
                      </span>
                    </div>
                  </div>
                  {d && (
                    <div className="flex gap-3 mt-3">
                      <span className="text-[9px] text-white/25 tracking-widest">↑ {Math.round(d.temperature_2m_max[0])}°</span>
                      <span className="text-[9px] text-white/25 tracking-widest">↓ {Math.round(d.temperature_2m_min[0])}°</span>
                    </div>
                  )}
                </div>

                {/* stats grid */}
                <Stat label="HUMIDITY"       value={`${w.relative_humidity_2m}%`} />
                <Stat label="WIND"           value={`${Math.round(w.wind_speed_10m)} KM/H`} sub={windDir(w.wind_direction_10m)} />
                <Stat label="PRESSURE"       value={`${Math.round(w.surface_pressure)} hPa`} />
                <Stat label="PRECIPITATION"  value={`${w.precipitation} mm`} sub={d ? `DAILY: ${d.precipitation_sum[0]} mm` : undefined} />

                {/* sun times */}
                {d && (
                  <div className="px-5 py-4 border-b border-white/5">
                    <div className="text-[9px] tracking-[0.3em] text-white/30 uppercase mb-3">SUN</div>
                    <div className="flex justify-between">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] text-white/25 tracking-widest">RISE</span>
                        <span className="text-sm font-bold text-yellow-300">{fmtTime(d.sunrise[0])}</span>
                      </div>
                      <div className="w-px bg-white/5" />
                      <div className="flex flex-col gap-0.5 items-end">
                        <span className="text-[9px] text-white/25 tracking-widest">SET</span>
                        <span className="text-sm font-bold text-orange-400">{fmtTime(d.sunset[0])}</span>
                      </div>
                    </div>
                    {/* daylight bar */}
                    {(() => {
                      const rise = new Date(d.sunrise[0]).getTime();
                      const set  = new Date(d.sunset[0]).getTime();
                      const now  = Date.now();
                      const total = set - rise;
                      const pct  = Math.max(0, Math.min(1, (now - rise) / total));
                      const daylight = Math.round(total / 3600000);
                      return (
                        <div className="mt-3">
                          <div className="h-[2px] bg-white/5 relative">
                            <div className="absolute left-0 top-0 h-full bg-yellow-300/40" style={{ width: `${pct * 100}%` }} />
                            <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-yellow-300" style={{ left: `${pct * 100}%`, transform: 'translate(-50%,-50%)' }} />
                          </div>
                          <div className="text-[9px] text-white/20 tracking-widest mt-1.5">{daylight}H DAYLIGHT</div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* UV */}
                {d && (
                  <div className="px-5 py-4 border-b border-white/5">
                    <div className="text-[9px] tracking-[0.3em] text-white/30 uppercase mb-2">UV INDEX</div>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold" style={{
                        color: d.uv_index_max[0] <= 2 ? '#4ade80' : d.uv_index_max[0] <= 5 ? '#facc15' : d.uv_index_max[0] <= 7 ? '#fb923c' : '#f87171'
                      }}>
                        {d.uv_index_max[0].toFixed(1)}
                      </span>
                      <span className="text-[9px] text-white/30 tracking-widest">
                        {d.uv_index_max[0] <= 2 ? 'LOW' : d.uv_index_max[0] <= 5 ? 'MODERATE' : d.uv_index_max[0] <= 7 ? 'HIGH' : d.uv_index_max[0] <= 10 ? 'VERY HIGH' : 'EXTREME'}
                      </span>
                    </div>
                    <div className="mt-2 h-[3px] bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(d.uv_index_max[0] / 12, 1) * 100}%`,
                          background: 'linear-gradient(to right, #4ade80, #facc15, #fb923c, #f87171)',
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* AQI */}
                {aq && aqInfo && (
                  <div className="px-5 py-4 border-b border-white/5">
                    <div className="text-[9px] tracking-[0.3em] text-white/30 uppercase mb-2">AIR QUALITY</div>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl font-bold" style={{ color: aqInfo.color }}>{aq.us_aqi}</span>
                      <span className="text-[9px] tracking-widest" style={{ color: aqInfo.color }}>{aqInfo.label}</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-[9px]">
                        <span className="text-white/30 tracking-widest">PM2.5</span>
                        <span className="text-white/60">{aq.pm2_5.toFixed(1)} µg/m³</span>
                      </div>
                      <div className="flex justify-between text-[9px]">
                        <span className="text-white/30 tracking-widest">PM10</span>
                        <span className="text-white/60">{aq.pm10.toFixed(1)} µg/m³</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 7-day forecast */}
                {d && d.time && (
                  <div className="px-5 py-4 border-b border-white/5">
                    <div className="text-[9px] tracking-[0.3em] text-white/30 uppercase mb-3">7-DAY FORECAST</div>
                    <div className="flex flex-col gap-0">
                      {d.time.map((dateStr, i) => {
                        const date = new Date(dateStr);
                        const dayLabel = i === 0 ? 'TODAY' : date.toLocaleDateString([], { weekday: 'short' }).toUpperCase();
                        const tMax = Math.round(d.temperature_2m_max[i]);
                        const tMin = Math.round(d.temperature_2m_min[i]);
                        const code = d.weather_code[i];
                        const precip = d.precipitation_sum[i];
                        // temp bar: normalize across the week
                        const allMax = Math.max(...d.temperature_2m_max);
                        const allMin = Math.min(...d.temperature_2m_min);
                        const range = allMax - allMin || 1;
                        const barLeft = ((tMin - allMin) / range) * 100;
                        const barWidth = ((tMax - tMin) / range) * 100;
                        return (
                          <div key={dateStr} className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
                            <span className="text-[9px] tracking-widest text-white/40 w-10 shrink-0">{dayLabel}</span>
                            <span className="text-[10px] text-white/30 w-4 shrink-0">{wmoIcon(code)}</span>
                            <div className="flex-1 relative h-[3px] bg-white/5">
                              <div
                                className="absolute h-full bg-gradient-to-r from-blue-400 to-orange-400 opacity-60"
                                style={{ left: `${barLeft}%`, width: `${Math.max(barWidth, 4)}%` }}
                              />
                            </div>
                            <span className="text-[9px] text-white/25 w-6 text-right shrink-0">{tMin}°</span>
                            <span className="text-[9px] text-white/60 w-6 text-right shrink-0 font-bold">{tMax}°</span>
                            {precip > 0 && (
                              <span className="text-[8px] text-blue-400/60 w-8 text-right shrink-0">{precip}mm</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* timezone */}
                <div className="px-5 py-4">
                  <div className="text-[9px] tracking-[0.3em] text-white/30 uppercase mb-1">TIMEZONE</div>
                  <div className="text-sm text-white/60 tracking-wider">{active.weather?.timezone}</div>
                </div>

              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
