'use client';

import { useEffect, useState, useRef, Suspense, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sphere, useTexture, OrbitControls, Line, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { CountUp } from './CountUp';
import { motion, AnimatePresence } from 'motion/react';
import { Maximize, Minimize, Eye, EyeOff } from 'lucide-react';

/* ─── Animated number (smooth interpolation) ─── */
function AnimatedNumber({ value, decimals = 4 }: { value: number; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const current = useRef(value);
  useEffect(() => {
    let af: number;
    const update = () => {
      if (!ref.current) return;
      const diff = value - current.current;
      if (Math.abs(diff) < Math.pow(10, -decimals - 1)) {
        current.current = value;
        ref.current.innerText = value.toFixed(decimals);
        return;
      }
      current.current += diff * 0.05;
      ref.current.innerText = current.current.toFixed(decimals);
      af = requestAnimationFrame(update);
    };
    af = requestAnimationFrame(update);
    return () => cancelAnimationFrame(af);
  }, [value, decimals]);
  return <span ref={ref}>{current.current.toFixed(decimals)}</span>;
}

/* ─── Helpers ─── */
function getAgencyColor(name: string) {
  const l = name.toLowerCase();
  if (/(oleg|nikolai|alexander|alexey|ivan|yuri|boris|sergey|konstantin|anton|denis|maxim|chub|grebenkin|kononenko)/.test(l)) return '#EF4444';
  if (/(andreas|samantha|thomas|luca|matthias|tim|gerst|pesquet|mogensen|cristoforetti)/.test(l)) return '#EAB308';
  if (/(satoshi|koichi|akihiko|soichi|takuya|kimiya|norishige|furukawa|wakata|hoshide)/.test(l)) return '#10B981';
  return '#3B82F6';
}

function getAgencyLabel(name: string) {
  const l = name.toLowerCase();
  if (/(oleg|nikolai|alexander|alexey|ivan|yuri|boris|sergey|konstantin|anton|denis|maxim|chub|grebenkin|kononenko)/.test(l)) return 'ROSCOSMOS';
  if (/(andreas|samantha|thomas|luca|matthias|tim|gerst|pesquet|mogensen|cristoforetti)/.test(l)) return 'ESA';
  if (/(satoshi|koichi|akihiko|soichi|takuya|kimiya|norishige|furukawa|wakata|hoshide)/.test(l)) return 'JAXA';
  return 'NASA';
}

function getOceanName(lat: number, lon: number) {
  if (lat > 60) return 'Arctic Ocean';
  if (lat < -60) return 'Southern Ocean';
  if (lon > 20 && lon < 146 && lat < 30) return 'Indian Ocean';
  if (lon > -98 && lon < 20) return 'Atlantic Ocean';
  return 'Pacific Ocean';
}

interface IssData { lat: number; lon: number; altitude: number; velocity: number; location: string; }
interface Crew { name: string; craft: string; }

function getCartesian(lat: number, lon: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

/* ─── 3D Components ─── */
function ISSModel() {
  const { scene } = useGLTF('https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/i/ISS_stationary.glb?emrc=69b8ecb057b8b');
  return <primitive object={scene} scale={0.002} rotation={[0, Math.PI / 2, 0]} />;
}

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
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.02;
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[2.03, 64, 64]} />
      <meshStandardMaterial
        map={cloudMap}
        transparent
        opacity={0.35}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function Earth({ issLat, issLon, pastTrail, futureTrail }: { issLat: number; issLon: number; pastTrail: THREE.Vector3[]; futureTrail: THREE.Vector3[] }) {
  const colorMap = useTexture('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg');
  const earthGroupRef = useRef<THREE.Group>(null);
  const issRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const issPos = useMemo(() => getCartesian(issLat, issLon, 2.1), [issLat, issLon]);
  const currentPos = useRef(issPos.clone());

  useFrame(() => {
    if (!earthGroupRef.current || !issRef.current) return;
    currentPos.current.lerp(issPos, 0.05);
    issRef.current.position.copy(currentPos.current);
    const issWorldPos = new THREE.Vector3();
    issRef.current.getWorldPosition(issWorldPos);
    camera.position.lerp(issWorldPos.clone().normalize().multiplyScalar(camera.position.length()), 0.05);
    camera.lookAt(0, 0, 0);
    if (futureTrail.length > 5) issRef.current.lookAt(futureTrail[5]);
    else if (futureTrail.length > 0) issRef.current.lookAt(futureTrail[0]);
  });

  const pastPoints = useMemo(() => [...pastTrail, issPos], [pastTrail, issPos]);
  const pastColors = useMemo(() => pastPoints.map((_, i) => {
    const c = new THREE.Color();
    c.lerpColors(new THREE.Color('#000000'), new THREE.Color('#FFFFFF'), Math.pow(i / (pastPoints.length - 1 || 1), 2));
    return c;
  }), [pastPoints]);
  const futurePoints = useMemo(() => [issPos, ...futureTrail], [issPos, futureTrail]);

  return (
    <group ref={earthGroupRef}>
      <Sphere args={[2, 64, 64]}>
        <meshStandardMaterial map={colorMap} roughness={0.8} metalness={0.1} />
      </Sphere>
      <Atmosphere />
      <Clouds />
      {pastPoints.length > 1 && <Line points={pastPoints} vertexColors={pastColors as any} lineWidth={2} transparent blending={THREE.AdditiveBlending} />}
      {futurePoints.length > 1 && <Line points={futurePoints} color="#4FC3F7" lineWidth={2} dashed dashScale={50} dashSize={0.5} gapSize={0.5} />}
      <group ref={issRef}>
        <ISSModel />
        <pointLight color="#4FC3F7" intensity={2} distance={1} />
      </group>
    </group>
  );
}

/* ─── Main Component ─── */
export function IssTracker() {
  const [issData, setIssData] = useState<IssData | null>(null);
  const [crew, setCrew] = useState<Crew[]>([]);
  const [pastTrail, setPastTrail] = useState<THREE.Vector3[]>([]);
  const [futureTrail, setFutureTrail] = useState<THREE.Vector3[]>([]);
  const [passTime, setPassTime] = useState<number | null>(null);
  const [passError, setPassError] = useState<string | null>(null);
  const [passTimeStr, setPassTimeStr] = useState<string | null>(null);
  const [loadingPass, setLoadingPass] = useState(false);
  const [activeCam, setActiveCam] = useState<1 | 2>(1);
  const [sunPos, setSunPos] = useState<[number, number, number]>([100, 0, 0]);
  const [showHud, setShowHud] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tick, setTick] = useState(0); // pulse every 5s
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen().catch(() => {});
    else document.exitFullscreen();
  };

  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  useEffect(() => {
    if (!passTime) return;
    const update = () => {
      const diff = passTime - Date.now();
      if (diff <= 0) { setPassTimeStr('NOW'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setPassTimeStr(`${h}H ${m}M ${s}S`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [passTime]);

  useEffect(() => {
    const updateSun = () => {
      const now = new Date();
      const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
      const decl = -23.44 * Math.cos((360 / 365) * (dayOfYear + 10) * (Math.PI / 180));
      const utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
      const pos = getCartesian(decl, 15 * (12 - utcH), 100);
      setSunPos([pos.x, pos.y, pos.z]);
    };
    updateSun();
    const sunId = setInterval(updateSun, 60000);

    fetch('/api/crew').then(r => r.json()).then(d => {
      if (d.people) setCrew(d.people.filter((p: any) => p.craft === 'ISS'));
    }).catch(() => {});

    const fetchTrails = async () => {
      try {
        const now = Math.floor(Date.now() / 1000);
        const pastTs = Array.from({ length: 10 }, (_, i) => now - (10 - i) * 60).join(',');
        const futureTs = Array.from({ length: 10 }, (_, i) => now + (i + 1) * 60).join(',');
        const [pR, fR] = await Promise.all([
          fetch(`https://api.wheretheiss.at/v1/satellites/25544/positions?timestamps=${pastTs}`),
          fetch(`https://api.wheretheiss.at/v1/satellites/25544/positions?timestamps=${futureTs}`),
        ]);
        const [pD, fD] = await Promise.all([pR.json(), fR.json()]);
        setPastTrail(pD.map((d: any) => getCartesian(d.latitude, d.longitude, 2.1)));
        setFutureTrail(fD.map((d: any) => getCartesian(d.latitude, d.longitude, 2.1)));
      } catch {}
    };
    fetchTrails();
    const trailId = setInterval(fetchTrails, 60000);

    const fetchPosition = async () => {
      try {
        const res = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
        const data = await res.json();
        const lat = parseFloat(data.latitude);
        const lon = parseFloat(data.longitude);
        let locationStr = getOceanName(lat, lon);
        try {
          const gR = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, {
            headers: { 'User-Agent': 'COSMOS-NASA-Explorer/1.0' },
          });
          const gD = await gR.json();
          if (gD.address) locationStr = gD.address.country || gD.address.state || 'Unknown Landmass';
        } catch {}
        setIssData({ lat, lon, altitude: parseFloat(data.altitude), velocity: parseFloat(data.velocity), location: locationStr });
        setTick(t => t + 1);
      } catch {}
    };
    fetchPosition();
    const posId = setInterval(fetchPosition, 5000);

    return () => { clearInterval(posId); clearInterval(trailId); clearInterval(sunId); };
  }, []);

  const handlePassOverMe = () => {
    setLoadingPass(true);
    if (!('geolocation' in navigator)) { setPassError('NOT SUPPORTED'); setLoadingPass(false); return; }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        try {
          let lonDiff = coords.longitude - (issData?.lon || 0);
          if (lonDiff < 0) lonDiff += 360;
          let mins = lonDiff / 4;
          if (mins < 10) mins += 90;
          setPassTime(Date.now() + mins * 60000);
        } catch { setPassError('CALC FAILED'); }
        setLoadingPass(false);
      },
      () => { setPassError('DENIED'); setLoadingPass(false); },
    );
  };

  return (
    <div ref={containerRef} className="w-full h-full relative bg-black overflow-hidden">

      {/* ── 3D Globe ── */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 6], fov: 45 }}>
          <ambientLight intensity={0.05} />
          <directionalLight position={sunPos} intensity={3} />
          <Suspense fallback={null}>
            <Earth issLat={issData?.lat || 0} issLon={issData?.lon || 0} pastTrail={pastTrail} futureTrail={futureTrail} />
          </Suspense>
          <OrbitControls enablePan={false} enableZoom minDistance={2.5} maxDistance={10} />
        </Canvas>
      </div>

      {/* ── HUD ── */}
      <AnimatePresence>
        {showHud && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 z-10 pointer-events-none"
          >

            {/* ── TOP BAR ── */}
            <div className="pointer-events-auto absolute top-0 left-0 right-0 flex items-stretch border-b border-white/10 bg-black/60 backdrop-blur-md">
              {/* Title cell */}
              <div className="flex items-center gap-4 px-6 py-3 border-r border-white/10">
                <div className="flex flex-col">
                  <span className="font-mono text-[9px] tracking-[0.35em] text-white/30 uppercase">OBJECT</span>
                  <span className="font-mono text-sm font-bold tracking-widest text-white">ISS</span>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="flex flex-col">
                  <span className="font-mono text-[9px] tracking-[0.35em] text-white/30 uppercase">STATUS</span>
                  <span className="flex items-center gap-1.5 font-mono text-sm font-bold tracking-widest text-[var(--color-iss)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-iss)] animate-pulse" />
                    LIVE
                  </span>
                </div>
              </div>

              {/* Coords strip */}
              <div className="flex items-center divide-x divide-white/10 flex-1 overflow-hidden">
                {[
                  { label: 'LAT', value: <><AnimatedNumber value={issData?.lat || 0} />°</> },
                  { label: 'LON', value: <><AnimatedNumber value={issData?.lon || 0} />°</> },
                  { label: 'ALT', value: <><CountUp value={issData?.altitude || 0} /> KM</> },
                  { label: 'VEL', value: <><CountUp value={issData?.velocity || 0} /> KM/H</> },
                ].map(({ label, value }) => (
                  <div key={label} className="flex flex-col px-5 py-3 min-w-0">
                    <span className="font-mono text-[9px] tracking-[0.3em] text-white/30 uppercase">{label}</span>
                    <span className="font-mono text-sm text-white tabular-nums">{value}</span>
                  </div>
                ))}
              </div>

              {/* Location */}
              <div className="hidden md:flex flex-col justify-center px-6 border-l border-white/10 min-w-[180px]">
                <span className="font-mono text-[9px] tracking-[0.3em] text-white/30 uppercase mb-0.5">CURRENTLY OVER</span>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={issData?.location}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.25 }}
                    className="font-mono text-sm text-[var(--color-iss)] truncate"
                  >
                    {issData?.location || '—'}
                  </motion.span>
                </AnimatePresence>
              </div>

              {/* Update pulse */}
              <div className="hidden md:flex items-center px-5 border-l border-white/10">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={tick}
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 0 }}
                    transition={{ duration: 2 }}
                    className="w-1.5 h-1.5 rounded-full bg-[var(--color-iss)]"
                  />
                </AnimatePresence>
              </div>
            </div>

            {/* ── BOTTOM-LEFT: NEXT PASS ── */}
            <div className="pointer-events-auto absolute bottom-16 left-0 border-t border-r border-white/10 bg-black/60 backdrop-blur-md">
              <button
                onClick={handlePassOverMe}
                disabled={loadingPass || passTime !== null || passError !== null}
                className="flex items-center gap-4 px-6 py-4 group disabled:opacity-60"
              >
                {loadingPass ? (
                  <div className="w-3 h-3 rounded-full border-t border-white/60 animate-spin" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full border border-white/30 group-hover:border-[var(--color-iss)] group-hover:bg-[var(--color-iss)] transition-colors" />
                )}
                <div className="flex flex-col items-start">
                  <span className="font-mono text-[9px] tracking-[0.3em] text-white/30 uppercase">NEXT PASS</span>
                  <span className={`font-mono text-xs tracking-widest ${passTimeStr ? 'text-[var(--color-iss)]' : passError ? 'text-red-400' : 'text-white/60 group-hover:text-white transition-colors'}`}>
                    {passError || (passTimeStr ? `IN ${passTimeStr}` : 'CALCULATE FOR MY LOCATION')}
                  </span>
                </div>
              </button>
            </div>

            {/* ── RIGHT PANEL ── */}
            <div className="pointer-events-auto absolute top-[53px] right-0 bottom-0 w-72 flex flex-col border-l border-white/10 bg-black/60 backdrop-blur-md">

              {/* Live Cam */}
              <div className="border-b border-white/10">
                <div className="flex items-center justify-between px-5 py-3">
                  <span className="flex items-center gap-2 font-mono text-[9px] tracking-[0.3em] text-white/40 uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    LIVE CAM
                  </span>
                  <div className="flex gap-px">
                    {([1, 2] as const).map(n => (
                      <button
                        key={n}
                        onClick={() => setActiveCam(n)}
                        className={`font-mono text-[9px] tracking-widest px-3 py-1.5 border transition-colors duration-200 ${
                          activeCam === n
                            ? 'border-white/20 text-white bg-white/10'
                            : 'border-white/5 text-white/30 hover:text-white/60'
                        }`}
                      >
                        CAM {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative aspect-video bg-black border-t border-white/5 overflow-hidden">
                  <iframe
                    width="100%" height="100%"
                    src={activeCam === 1
                      ? 'https://www.youtube.com/embed/zPH5KtjJFaQ?autoplay=1&mute=1&controls=0&disablekb=1&modestbranding=1'
                      : 'https://www.youtube.com/embed/sWasdbDVNvc?autoplay=1&mute=1&controls=0&disablekb=1&modestbranding=1'}
                    title="ISS Live Stream"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0"
                  />
                  {/* scanline overlay */}
                  <div
                    className="absolute inset-0 pointer-events-none opacity-20"
                    style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.4) 2px, rgba(0,0,0,0.4) 4px)' }}
                  />
                </div>
              </div>

              {/* Crew */}
              <div className="flex flex-col flex-1 min-h-0">
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
                  <span className="font-mono text-[9px] tracking-[0.3em] text-white/40 uppercase">CREW ABOARD</span>
                  <span className="font-mono text-lg font-bold text-[var(--color-iss)] tabular-nums">{crew.length || '—'}</span>
                </div>
                <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {crew.length === 0 ? (
                    <div className="px-5 py-4 font-mono text-[10px] text-white/20 tracking-widest">LOADING...</div>
                  ) : (
                    crew.map((member, i) => {
                      const color = getAgencyColor(member.name);
                      const agency = getAgencyLabel(member.name);
                      return (
                        <motion.div
                          key={member.name}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex items-center justify-between px-5 py-3 border-b border-white/5 group hover:bg-white/[0.02] transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
                            />
                            <span className="font-mono text-[10px] text-white/70 uppercase tracking-wider truncate group-hover:text-white transition-colors">
                              {member.name}
                            </span>
                          </div>
                          <span
                            className="font-mono text-[8px] tracking-widest shrink-0 ml-2 opacity-50"
                            style={{ color }}
                          >
                            {agency}
                          </span>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BOTTOM CONTROLS ── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between border-t border-white/10 bg-black/60 backdrop-blur-md px-4 h-12">
        <span className="font-mono text-[9px] tracking-[0.3em] text-white/20 uppercase hidden md:block">
          INTERNATIONAL SPACE STATION · NORAD 25544
        </span>
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => setShowHud(!showHud)}
            className="flex items-center gap-2 px-4 py-2 font-mono text-[9px] tracking-widest text-white/40 hover:text-white border border-transparent hover:border-white/10 transition-all duration-200"
          >
            {showHud ? <EyeOff size={12} /> : <Eye size={12} />}
            {showHud ? 'HIDE HUD' : 'SHOW HUD'}
          </button>
          <div className="w-px h-4 bg-white/10" />
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-2 px-4 py-2 font-mono text-[9px] tracking-widest text-white/40 hover:text-white border border-transparent hover:border-white/10 transition-all duration-200"
          >
            {isFullscreen ? <Minimize size={12} /> : <Maximize size={12} />}
            {isFullscreen ? 'EXIT' : 'FULLSCREEN'}
          </button>
        </div>
      </div>

    </div>
  );
}

useGLTF.preload('https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/i/ISS_stationary.glb?emrc=69b8ecb057b8b');
