'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';

/* ══════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════ */
const MOON_DIST_KM = 384400;
const ROCHE_KM     = 19220;

type Mode = 'live' | 'whatif' | 'deeptime';

/* ══════════════════════════════════════════════
   TIDE STATIONS
══════════════════════════════════════════════ */
interface TideStation {
  id: string; name: string; lat: number; lon: number;
}
const TIDE_STATIONS: TideStation[] = [
  { id: '8518750', name: 'New York',      lat: 40.70, lon: -74.01  },
  { id: '9414290', name: 'San Francisco', lat: 37.81, lon: -122.47 },
  { id: '8443970', name: 'Boston',        lat: 42.36, lon: -71.05  },
  { id: '1619910', name: 'Honolulu',      lat: 21.31, lon: -157.87 },
  { id: '8761724', name: 'Grand Isle',    lat: 29.26, lon: -89.96  },
];

interface TideReading {
  station: TideStation;
  current: number;
  trend: 'flooding' | 'ebbing' | 'slack';
  predictions: number[];
}

/* ══════════════════════════════════════════════
   DEEP TIME EVENTS
══════════════════════════════════════════════ */
interface DeepTimeEvent {
  bya: number; // billion years ago (negative = future)
  label: string;
  subtitle: string;
  distKm: number;
  dayHours: number;
  tidalStrength: number;
  earthColor?: string;
}

const DEEP_TIME_EVENTS: DeepTimeEvent[] = [
  { bya: 4.5,  label: 'THE MOON IS BORN',              subtitle: 'Theia impact. Moon 15x closer. Tides 1,000x higher. Days: 5 hours.',                                    distKm: 25000,  dayHours: 5,  tidalStrength: 0.08  },
  { bya: 4.1,  label: 'MAGMA OCEAN ERA',               subtitle: 'Both Earth and Moon were molten. Tidal heating kept Earth\'s surface liquid.',                           distKm: 60000,  dayHours: 7,  tidalStrength: 0.055, earthColor: '#ff4400' },
  { bya: 3.9,  label: 'LATE HEAVY BOMBARDMENT',        subtitle: 'Asteroid impacts peaked. The Moon absorbed strikes that would have sterilized Earth.',                   distKm: 200000, dayHours: 12, tidalStrength: 0.025 },
  { bya: 3.5,  label: 'LIFE BEGINS',                   subtitle: 'Stable tides created intertidal zones where life may have first emerged.',                               distKm: 310000, dayHours: 12, tidalStrength: 0.016 },
  { bya: 2.0,  label: 'COMPLEX CELLS EMERGE',          subtitle: 'Eukaryotic cells appear. Days are 18 hours long.',                                                       distKm: 350000, dayHours: 18, tidalStrength: 0.013 },
  { bya: 0.0,  label: 'NOW',                           subtitle: 'The Moon recedes 3.8 cm per year. Days lengthen 1.4ms per century.',                                    distKm: 384400, dayHours: 24, tidalStrength: 0.012 },
  { bya: -0.6, label: 'THE LAST TOTAL SOLAR ECLIPSE',  subtitle: 'The Moon will be too small to cover the Sun. We live in the only era when perfect eclipses are possible. That era is ending.', distKm: 407000, dayHours: 24.5, tidalStrength: 0.010 },
  { bya: -5.0, label: 'THE SUN BECOMES A RED GIANT',   subtitle: 'Earth is consumed. The Moon, at last, is free.',                                                        distKm: 450000, dayHours: 25,  tidalStrength: 0.009, earthColor: '#ff2200' },
];

/* ══════════════════════════════════════════════
   WHAT IF PRESETS
══════════════════════════════════════════════ */
interface WhatIfPreset {
  mult: number; label: string; subtitle: string;
}
const WHATIF_PRESETS: WhatIfPreset[] = [
  { mult: 0.05,  label: 'ROCHE LIMIT · 19,220 KM',       subtitle: 'Tidal forces exceed the Moon\'s structural integrity. The Moon breaks apart into a ring system.' },
  { mult: 0.15,  label: 'TIDES 296× HIGHER',              subtitle: 'Every coastline on Earth flooded daily. All coastal civilizations impossible.' },
  { mult: 0.50,  label: 'TIDES 8× CURRENT HEIGHT',        subtitle: 'Major coastal cities would flood twice daily.' },
  { mult: 1.00,  label: 'CURRENT DISTANCE · 384,400 KM',  subtitle: 'The Moon has been here for ~4.5 billion years.' },
  { mult: 1.50,  label: 'TIDAL FORCES WEAKENING',         subtitle: 'Earth\'s rotation slowing less rapidly. Days would still be ~22 hours.' },
  { mult: 2.50,  label: 'AXIAL TILT DESTABILIZING',       subtitle: 'Without lunar stabilization, Earth\'s tilt varies 0°–85° over millions of years.' },
  { mult: 5.00,  label: 'THE MOON IS EFFECTIVELY GONE',   subtitle: 'Axial tilt: chaotic. Climate: violently unstable. Complex life: unlikely. This is what Mars went through.' },
];

function tidalForce(mult: number): number {
  return 0.012 / Math.pow(Math.max(mult, 0.04), 3);
}

/* ══════════════════════════════════════════════
   SHADERS
══════════════════════════════════════════════ */
const EARTH_VERT = /* glsl */`
  uniform vec3  moonDirection;
  uniform float tidalStrength;
  uniform float time;
  varying vec2  vUv;
  varying vec3  vNormal;
  varying float vTidal;

  void main() {
    vec3 norm = normalize(position);
    float cosTheta = dot(norm, normalize(moonDirection));
    float tidal = (3.0 * cosTheta * cosTheta - 1.0) * 0.5;
    float slosh = sin(time * 0.5) * 0.002 * tidalStrength * 10.0;
    vec3 displaced = position + norm * tidal * tidalStrength + norm * slosh;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
    vNormal = normalize(normalMatrix * norm);
    vUv = uv;
    vTidal = tidal;
  }
`;

const EARTH_FRAG = /* glsl */`
  uniform sampler2D earthTexture;
  uniform float tidalStrength;
  varying vec2  vUv;
  varying vec3  vNormal;
  varying float vTidal;

  void main() {
    vec4 texColor = texture2D(earthTexture, vUv);
    float oceanBlue = clamp(vTidal * tidalStrength * 20.0, -0.1, 0.15);
    texColor.b = clamp(texColor.b + oceanBlue, 0.0, 1.0);
    gl_FragColor = vec4(texColor.rgb, 1.0);
  }
`;

/* ══════════════════════════════════════════════
   STARFIELD
══════════════════════════════════════════════ */
function Starfield() {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(8000 * 3);
    for (let i = 0; i < 8000; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      pos[i*3]   = 90 * Math.sin(phi) * Math.cos(theta);
      pos[i*3+1] = 90 * Math.cos(phi);
      pos[i*3+2] = 90 * Math.sin(phi) * Math.sin(theta);
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  return (
    <points geometry={geo}>
      <pointsMaterial color="#ffffff" size={0.25} sizeAttenuation transparent opacity={0.6} />
    </points>
  );
}

/* ══════════════════════════════════════════════
   MOON MESH
══════════════════════════════════════════════ */
function MoonMesh({ posX, scale }: { posX: number; scale: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef  = useRef<THREE.MeshLambertMaterial>(null);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load('/api/moon-texture?type=color', (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      if (matRef.current) { matRef.current.map = t; matRef.current.needsUpdate = true; }
    });
  }, []);

  useFrame(() => {
    if (meshRef.current) meshRef.current.rotation.y += 0.0003;
  });

  return (
    <mesh ref={meshRef} position={[posX, 0, 0]} scale={[scale, scale, scale]}>
      <sphereGeometry args={[0.9, 64, 64]} />
      <meshLambertMaterial ref={matRef} color="#aaaaaa" />
    </mesh>
  );
}

/* ══════════════════════════════════════════════
   EARTH MESH (deformable shader)
══════════════════════════════════════════════ */
function EarthMesh({ moonPosX, tidalStrength, earthColor }: {
  moonPosX: number;
  tidalStrength: number;
  earthColor?: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef  = useRef<THREE.ShaderMaterial>(null);
  const timeRef = useRef(0);

  const uniforms = useMemo(() => ({
    moonDirection:  { value: new THREE.Vector3(-1, 0, 0) },
    tidalStrength:  { value: tidalStrength },
    time:           { value: 0 },
    earthTexture:   { value: null as THREE.Texture | null },
  }), []);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(
      'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        uniforms.earthTexture.value = t;
      }
    );
  }, [uniforms]);

  useFrame(({ clock }) => {
    if (!matRef.current) return;
    timeRef.current = clock.getElapsedTime();
    matRef.current.uniforms.time.value = timeRef.current;
    matRef.current.uniforms.tidalStrength.value = tidalStrength;
    // Moon direction: from Earth (+1.8,0,0) toward Moon (moonPosX,0,0)
    const dir = new THREE.Vector3(moonPosX - 1.8, 0, 0).normalize();
    matRef.current.uniforms.moonDirection.value = dir;
    if (meshRef.current) meshRef.current.rotation.y += 0.002;
  });

  // Magma/red giant tint
  const tintColor = earthColor ?? '#ffffff';

  return (
    <mesh ref={meshRef} position={[1.8, 0, 0]}>
      <sphereGeometry args={[1.15, 128, 128]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={EARTH_VERT}
        fragmentShader={EARTH_FRAG}
        uniforms={uniforms}
      />
      {earthColor && (
        <meshBasicMaterial color={earthColor} transparent opacity={0.25} depthWrite={false} />
      )}
    </mesh>
  );
}

/* ══════════════════════════════════════════════
   FIELD LINES
══════════════════════════════════════════════ */
function FieldLines({ moonPosX, tidalStrength }: { moonPosX: number; tidalStrength: number }) {
  const dotsRef     = useRef<THREE.Mesh[]>([]);
  const progressRef = useRef<number[]>([]);
  const COUNT = 12;
  const CONE_HALF = Math.PI / 3; // ±60°

  // Build curves: fan from Moon surface toward Earth in a cone
  const curves = useMemo(() => {
    const moonPos  = new THREE.Vector3(moonPosX, 0, 0);
    const earthPos = new THREE.Vector3(1.8, 0, 0);
    const result: THREE.CatmullRomCurve3[] = [];

    for (let i = 0; i < COUNT; i++) {
      const angle = (i / COUNT) * Math.PI * 2;
      // Fan angle: spread ±60° around the Moon-Earth axis (x-axis)
      const fanAngle = (i / (COUNT - 1) - 0.5) * 2 * CONE_HALF;
      const moonR = 0.82;
      // Start on Moon surface, fanned in a cone
      const startY = Math.sin(fanAngle) * moonR;
      const startZ = Math.cos(angle) * Math.abs(Math.cos(fanAngle)) * moonR * 0.3;
      const start = moonPos.clone().add(new THREE.Vector3(Math.cos(fanAngle) * moonR * 0.1, startY, startZ));

      // End near Earth surface
      const earthR = 1.05;
      const endY = Math.sin(fanAngle) * earthR * 0.6;
      const endZ = Math.cos(angle) * 0.15;
      const end = earthPos.clone().add(new THREE.Vector3(-earthR * 0.3, endY, endZ));

      // Midpoint bows outward (away from the axis)
      const mid = start.clone().lerp(end, 0.5);
      mid.y += Math.sin(fanAngle) * 0.55;
      mid.z += startZ * 0.4;
      mid.x -= 0.1; // slight bow away from center

      result.push(new THREE.CatmullRomCurve3([start, mid, end], false, 'catmullrom', 0.5));
    }
    return result;
  }, [moonPosX]);

  const tubeGeos = useMemo(() =>
    curves.map(c => new THREE.TubeGeometry(c, 24, 0.005, 4, false)),
  [curves]);

  useEffect(() => {
    progressRef.current = Array.from({ length: COUNT }, (_, i) => (i / COUNT));
  }, []);

  useFrame(() => {
    const speed = 0.003 + tidalStrength * 0.15;
    progressRef.current = progressRef.current.map(p => (p + speed) % 1);
    dotsRef.current.forEach((dot, i) => {
      if (!dot || !curves[i]) return;
      dot.position.copy(curves[i].getPoint(progressRef.current[i]));
    });
  });

  return (
    <group>
      {tubeGeos.map((geo, i) => (
        <mesh key={i} geometry={geo}>
          <meshBasicMaterial color="#4488ff" transparent opacity={0.3} />
        </mesh>
      ))}
      {Array.from({ length: COUNT }, (_, i) => (
        <mesh key={`dot-${i}`} ref={el => { if (el) dotsRef.current[i] = el; }}>
          <sphereGeometry args={[0.022, 6, 6]} />
          <meshBasicMaterial color="#88bbff" transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  );
}

/* ══════════════════════════════════════════════
   ROCHE RING
══════════════════════════════════════════════ */
function RocheRing({ visible, opacity }: { visible: boolean; opacity: number }) {
  if (!visible) return null;
  return (
    <mesh position={[1.8, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[1.35, 1.85, 64]} />
      <meshBasicMaterial color="#aaaaaa" transparent opacity={opacity} side={THREE.DoubleSide} />
    </mesh>
  );
}

function ConnectingLine({ moonPosX }: { moonPosX: number }) {
  const ref = useRef<THREE.LineSegments>(null);
  useEffect(() => {
    if (!ref.current) return;
    const points = [new THREE.Vector3(moonPosX, 0, 0), new THREE.Vector3(1.8, 0, 0)];
    ref.current.geometry.setFromPoints(points);
  }, [moonPosX]);
  return (
    <lineSegments ref={ref}>
      <bufferGeometry />
      <lineBasicMaterial color="#222244" transparent opacity={0.4} />
    </lineSegments>
  );
}

/* ══════════════════════════════════════════════
   SCENE
══════════════════════════════════════════════ */
function Scene({ moonPosX, moonScale, tidalStrength, earthColor, showRoche, rocheOpacity }: {
  moonPosX: number;
  moonScale: number;
  tidalStrength: number;
  earthColor?: string;
  showRoche: boolean;
  rocheOpacity: number;
}) {
  return (
    <>
      <Starfield />
      <ambientLight color={0xffffff} intensity={1.2} />
      <directionalLight color={0xfff4e0} intensity={1.5} position={[5, 3, 5]} />
      <ConnectingLine moonPosX={moonPosX} />
      <MoonMesh posX={moonPosX} scale={moonScale} />
      <EarthMesh moonPosX={moonPosX} tidalStrength={tidalStrength} earthColor={earthColor} />
      <FieldLines moonPosX={moonPosX} tidalStrength={tidalStrength} />
      <RocheRing visible={showRoche} opacity={rocheOpacity} />
    </>
  );
}

/* ══════════════════════════════════════════════
   SPARKLINE
══════════════════════════════════════════════ */
function Sparkline({ data, color = '#4499ff' }: { data: number[]; color?: string }) {
  if (!data.length) return null;
  const w = 80, h = 24;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1} opacity={0.6} />
    </svg>
  );
}

/* ══════════════════════════════════════════════
   DRAMATIC TEXT OVERLAY
══════════════════════════════════════════════ */
function DramaticText({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20"
      style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.5) 0%, transparent 70%)' }}
    >
      <div className="text-center max-w-2xl px-8">
        <div className="font-mono text-2xl text-white/90 tracking-widest mb-4 leading-tight">
          {title}
        </div>
        <div className="font-mono text-[13px] text-white/50 leading-relaxed tracking-wide">
          {subtitle}
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════ */
export function Tides() {
  const [mode, setMode] = useState<Mode>('live');
  const [tideData, setTideData]     = useState<TideReading[]>([]);
  const [loadingTides, setLoadingTides] = useState(true);
  const [whatIfMult, setWhatIfMult] = useState(1.0);
  const [deepTimeIdx, setDeepTimeIdx] = useState(5); // default = NOW
  const [dramaticText, setDramaticText] = useState<{ title: string; subtitle: string } | null>(null);
  const dramaticTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPresetRef = useRef<number>(-1);
  const prevDeepRef   = useRef<number>(5);

  /* ── Derived scene values ── */
  const { moonPosX, moonScale, tidalStrength, earthColor, showRoche, rocheOpacity } = useMemo(() => {
    if (mode === 'live') {
      return { moonPosX: -1.8, moonScale: 1.2, tidalStrength: 0.035, earthColor: undefined, showRoche: false, rocheOpacity: 0 };
    }
    if (mode === 'whatif') {
      const ts = tidalForce(whatIfMult);
      const posX = -1.2 - whatIfMult * 0.4;
      const sc   = Math.max(0.4, Math.min(1.2, 1 / whatIfMult * 0.5 + 0.5));
      const roche = whatIfMult < 0.12;
      const rop   = roche ? Math.max(0, (0.12 - whatIfMult) / 0.07) * 0.4 : 0;
      return { moonPosX: posX, moonScale: sc, tidalStrength: ts, earthColor: undefined, showRoche: roche, rocheOpacity: rop };
    }
    // deeptime
    const ev = DEEP_TIME_EVENTS[deepTimeIdx];
    const distRatio = ev.distKm / MOON_DIST_KM;
    const posX = -1.2 - distRatio * 0.4;
    const sc   = Math.max(0.4, Math.min(1.2, 1 / distRatio * 0.5 + 0.5));
    return { moonPosX: posX, moonScale: sc, tidalStrength: ev.tidalStrength, earthColor: ev.earthColor, showRoche: false, rocheOpacity: 0 };
  }, [mode, whatIfMult, deepTimeIdx]);

  /* ── Fetch NOAA tide data ── */
  const fetchTides = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const results: TideReading[] = [];
    await Promise.allSettled(TIDE_STATIONS.map(async (station) => {
      try {
        const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&datum=MLLW&time_zone=gmt&interval=h&units=metric&application=cosmos&format=json&begin_date=${today}&end_date=${today}&station=${station.id}`;
        const res = await fetch(`/api/tides?url=${encodeURIComponent(url)}`);
        if (!res.ok) return;
        const json = await res.json();
        const preds: { t: string; v: string }[] = json.predictions ?? [];
        if (!preds.length) return;
        const nowH = new Date().getUTCHours();
        const current = parseFloat(preds[Math.min(nowH, preds.length - 1)]?.v ?? '0');
        const prev    = parseFloat(preds[Math.max(0, nowH - 1)]?.v ?? '0');
        const diff    = current - prev;
        const trend: TideReading['trend'] = Math.abs(diff) < 0.05 ? 'slack' : diff > 0 ? 'flooding' : 'ebbing';
        results.push({ station, current, trend, predictions: preds.slice(0, 24).map(p => parseFloat(p.v)) });
      } catch { /* skip */ }
    }));
    if (results.length) { setTideData(results); setLoadingTides(false); }
    else setLoadingTides(false);
  }, []);

  useEffect(() => {
    fetchTides();
    const id = setInterval(fetchTides, 300000);
    return () => clearInterval(id);
  }, [fetchTides]);

  /* ── Dramatic text trigger ── */
  const showDramatic = useCallback((title: string, subtitle: string) => {
    if (dramaticTimer.current) clearTimeout(dramaticTimer.current);
    setDramaticText({ title, subtitle });
    dramaticTimer.current = setTimeout(() => setDramaticText(null), 5000);
  }, []);

  /* ── What If preset detection ── */
  useEffect(() => {
    if (mode !== 'whatif') return;
    const idx = WHATIF_PRESETS.findIndex(p => Math.abs(p.mult - whatIfMult) < 0.001);
    if (idx >= 0 && idx !== prevPresetRef.current) {
      prevPresetRef.current = idx;
      showDramatic(WHATIF_PRESETS[idx].label, WHATIF_PRESETS[idx].subtitle);
    }
  }, [whatIfMult, mode, showDramatic]);

  /* ── Deep time event trigger ── */
  useEffect(() => {
    if (mode !== 'deeptime') return;
    if (deepTimeIdx !== prevDeepRef.current) {
      prevDeepRef.current = deepTimeIdx;
      const ev = DEEP_TIME_EVENTS[deepTimeIdx];
      showDramatic(ev.label, ev.subtitle);
    }
  }, [deepTimeIdx, mode, showDramatic]);

  /* ── Phase + tidal type ── */
  const moonPhaseLabel = useMemo(() => {
    const knownNew = new Date('2000-01-06T18:14:00Z');
    const days = (Date.now() - knownNew.getTime()) / 86400000;
    const phase = ((days % 29.530588853) + 29.530588853) % 29.530588853;
    const p = phase / 29.530588853;
    if (p < 0.025 || p > 0.975) return 'New Moon';
    if (p < 0.25)  return 'Waxing Crescent';
    if (p < 0.275) return 'First Quarter';
    if (p < 0.475) return 'Waxing Gibbous';
    if (p < 0.525) return 'Full Moon';
    if (p < 0.725) return 'Waning Gibbous';
    if (p < 0.775) return 'Last Quarter';
    return 'Waning Crescent';
  }, []);

  const tidalType = useMemo(() => {
    const label = moonPhaseLabel;
    return (label === 'Full Moon' || label === 'New Moon') ? 'Spring' : (label === 'First Quarter' || label === 'Last Quarter') ? 'Neap' : 'Mixed';
  }, [moonPhaseLabel]);

  const currentEvent = mode === 'deeptime' ? DEEP_TIME_EVENTS[deepTimeIdx] : null;

  return (
    <div className="w-full h-full bg-[#080808] text-white font-mono overflow-hidden flex flex-col">

      {/* ── TOP BAR ── */}
      <div className="flex items-stretch border-b border-white/10 bg-black/60 shrink-0 flex-wrap z-10">
        <div className="flex items-center gap-3 px-6 py-3 border-r border-white/10">
          <span className="text-[9px] tracking-[0.35em] text-white/30 uppercase">MODULE</span>
          <span className="text-sm font-bold tracking-widest text-[#4FC3F7]">TIDES</span>
        </div>
        <div className="flex items-center px-5 py-3 border-r border-white/10 gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4FC3F7] animate-pulse" />
          <span className="text-[9px] tracking-[0.3em] text-white/30 uppercase">LUNAR GRAVITY SIMULATION</span>
        </div>
        {/* Mode tabs */}
        <div className="flex items-center px-3 py-3 gap-1 ml-auto">
          {(['live', 'whatif', 'deeptime'] as Mode[]).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className="px-3 py-1 text-[8px] tracking-widest uppercase transition-colors border"
              style={{
                borderColor: mode === m ? 'rgba(79,195,247,0.4)' : 'rgba(255,255,255,0.08)',
                color: mode === m ? '#4FC3F7' : 'rgba(255,255,255,0.25)',
                background: mode === m ? 'rgba(79,195,247,0.06)' : 'transparent',
              }}>
              {m === 'live' ? 'LIVE' : m === 'whatif' ? 'WHAT IF' : 'DEEP TIME'}
            </button>
          ))}
        </div>
      </div>

      {/* ── MAIN ── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* ── LEFT PANEL ── */}
        <div className="w-52 shrink-0 border-r border-white/10 bg-black/40 flex flex-col overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] z-10">

          {/* Physics constants */}
          <div className="px-4 py-3 border-b border-white/10">
            <div className="text-[7px] text-white/20 tracking-widest uppercase mb-2">Lunar Physics</div>
            {[
              ['EARTH-MOON DIST', mode === 'deeptime' && currentEvent ? `${currentEvent.distKm.toLocaleString()} km` : mode === 'whatif' ? `${Math.round(MOON_DIST_KM * whatIfMult).toLocaleString()} km` : '384,400 km'],
              ['TIDAL FORCE',     `${(tidalStrength * 100 / 0.012).toFixed(0)}% of normal`],
              ['LUNAR PHASE',     moonPhaseLabel],
              ['TIDAL TYPE',      tidalType],
              ['MOON RECESSION',  '3.8 cm / year'],
              ['DAY SLOWDOWN',    '1.4 ms / century'],
              ...(mode === 'deeptime' && currentEvent ? [['DAY LENGTH', `${currentEvent.dayHours}h`]] : []),
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between items-baseline mb-1.5">
                <span className="text-[7px] text-white/25 tracking-widest uppercase">{label}</span>
                <span className="text-[8px] text-white/55 tabular-nums text-right">{value}</span>
              </div>
            ))}
            {/* Tidal force gauge */}
            <div className="mt-2">
              <div className="text-[7px] text-white/20 tracking-widest uppercase mb-1">Tidal Force</div>
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, tidalStrength / 0.08 * 100)}%`,
                    background: tidalStrength > 0.04 ? '#ef4444' : tidalStrength > 0.02 ? '#f97316' : '#4FC3F7',
                  }} />
              </div>
            </div>
          </div>

          {/* Live tide stations */}
          {mode === 'live' && (
            <div className="px-4 py-3 border-b border-white/10 flex-1">
              <div className="text-[7px] text-white/20 tracking-widest uppercase mb-2">
                Tidal Stations {loadingTides && <span className="text-white/15">· loading</span>}
              </div>
              {tideData.length === 0 && !loadingTides && (
                <div className="text-[7px] text-white/15 tracking-widest">NOAA data unavailable</div>
              )}
              {tideData.map(r => (
                <div key={r.station.id} className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[8px] text-white/50 tracking-wider">{r.station.name}</span>
                    <span className="text-[8px] tabular-nums" style={{
                      color: r.trend === 'flooding' ? '#4FC3F7' : r.trend === 'ebbing' ? '#94a3b8' : '#fbbf24'
                    }}>
                      {r.current >= 0 ? '+' : ''}{r.current.toFixed(2)}m {r.trend === 'flooding' ? '▲' : r.trend === 'ebbing' ? '▼' : '—'}
                    </span>
                  </div>
                  <Sparkline data={r.predictions} color={r.trend === 'flooding' ? '#4FC3F7' : '#94a3b8'} />
                </div>
              ))}
            </div>
          )}

          {/* Deep time event info */}
          {mode === 'deeptime' && currentEvent && (
            <div className="px-4 py-3 flex-1">
              <div className="text-[7px] text-white/20 tracking-widest uppercase mb-2">Current Era</div>
              <div className="text-[9px] font-bold text-white/70 mb-1">{currentEvent.label}</div>
              <div className="text-[8px] text-white/35 leading-relaxed">{currentEvent.subtitle}</div>
              <div className="mt-3 text-[7px] text-white/20 tracking-widest uppercase">
                {currentEvent.bya === 0 ? 'TODAY' : currentEvent.bya > 0 ? `${currentEvent.bya} BYA` : `+${Math.abs(currentEvent.bya)} BYA FUTURE`}
              </div>
            </div>
          )}

          {/* What if info */}
          {mode === 'whatif' && (
            <div className="px-4 py-3 flex-1">
              <div className="text-[7px] text-white/20 tracking-widest uppercase mb-2">Scenario</div>
              <div className="text-[9px] text-white/50 mb-1">{Math.round(MOON_DIST_KM * whatIfMult).toLocaleString()} km</div>
              <div className="text-[8px] text-white/30">{(whatIfMult * 100).toFixed(0)}% of current distance</div>
              <div className="text-[8px] text-white/30 mt-1">Tidal force: {(tidalStrength / 0.012).toFixed(1)}× normal</div>
              {whatIfMult < 0.12 && (
                <div className="mt-3 text-[8px] text-red-400 tracking-wider animate-pulse">
                  ⚠ ROCHE LIMIT ZONE
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── CANVAS ── */}
        <div className="flex-1 relative overflow-hidden">
          <Canvas
            camera={{ position: [0, 0, 6], fov: 50, near: 0.1, far: 200 }}
            gl={{ antialias: true, alpha: false }}
            onCreated={({ gl }) => {
              gl.setPixelRatio(Math.min(devicePixelRatio, 2));
              gl.setClearColor('#080808');
            }}
          >
            <Scene
              moonPosX={moonPosX}
              moonScale={moonScale}
              tidalStrength={tidalStrength}
              earthColor={earthColor}
              showRoche={showRoche}
              rocheOpacity={rocheOpacity}
            />
          </Canvas>

          {/* Labels */}
          <div className="absolute top-4 left-[25%] -translate-x-1/2 text-[8px] text-white/20 tracking-widest uppercase pointer-events-none">MOON</div>
          <div className="absolute top-4 right-[25%] translate-x-1/2 text-[8px] text-white/20 tracking-widest uppercase pointer-events-none">EARTH</div>

          {/* Dramatic text overlay */}
          <AnimatePresence>
            {dramaticText && (
              <DramaticText title={dramaticText.title} subtitle={dramaticText.subtitle} />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── BOTTOM CONTROLS ── */}
      <div className="border-t border-white/10 bg-black/60 px-6 py-3 shrink-0 z-10">

        {/* WHAT IF slider */}
        {mode === 'whatif' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-[7px] text-white/25 tracking-widest uppercase">
              <span>5% · ROCHE LIMIT</span>
              <span>MOON DISTANCE</span>
              <span>500% · EFFECTIVELY GONE</span>
            </div>
            <input
              type="range" min={0.05} max={5.0} step={0.01}
              value={whatIfMult}
              onChange={e => setWhatIfMult(parseFloat(e.target.value))}
              className="w-full accent-[#4FC3F7] cursor-pointer"
            />
            <div className="flex justify-between gap-2 flex-wrap">
              {WHATIF_PRESETS.map(p => (
                <button key={p.mult}
                  onClick={() => setWhatIfMult(p.mult)}
                  className="text-[7px] tracking-wider border px-2 py-1 transition-colors"
                  style={{
                    borderColor: Math.abs(whatIfMult - p.mult) < 0.01 ? '#4FC3F7' : 'rgba(255,255,255,0.08)',
                    color: Math.abs(whatIfMult - p.mult) < 0.01 ? '#4FC3F7' : 'rgba(255,255,255,0.25)',
                  }}>
                  {(p.mult * 100).toFixed(0)}%
                </button>
              ))}
            </div>
          </div>
        )}

        {/* DEEP TIME timeline */}
        {mode === 'deeptime' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-[7px] text-white/25 tracking-widest uppercase">
              <span>4.5 BYA · FORMATION</span>
              <span>DEEP TIME</span>
              <span>+5 BYA · RED GIANT</span>
            </div>
            <div className="flex gap-1 flex-wrap">
              {DEEP_TIME_EVENTS.map((ev, i) => (
                <button key={i}
                  onClick={() => setDeepTimeIdx(i)}
                  className="flex-1 min-w-0 px-2 py-2 text-[7px] tracking-wider border transition-colors text-center"
                  style={{
                    borderColor: deepTimeIdx === i ? '#4FC3F7' : 'rgba(255,255,255,0.08)',
                    color: deepTimeIdx === i ? '#4FC3F7' : 'rgba(255,255,255,0.25)',
                    background: deepTimeIdx === i ? 'rgba(79,195,247,0.06)' : 'transparent',
                  }}>
                  {ev.bya === 0 ? 'NOW' : ev.bya > 0 ? `${ev.bya}B` : `+${Math.abs(ev.bya)}B`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* LIVE mode info */}
        {mode === 'live' && (
          <div className="flex items-center gap-6 text-[8px] text-white/25">
            <span>NOAA tidal predictions · updated every 5 minutes</span>
            <span className="ml-auto">Moon recedes 3.8 cm/year · Earth day lengthens 1.4ms/century</span>
          </div>
        )}
      </div>
    </div>
  );
}
