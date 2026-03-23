'use client';

import { useEffect, useRef, useState, useMemo, Suspense, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useTexture, Line } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';

/* ─── Types ─── */
interface Strike {
  id: string;
  lat: number;
  lon: number;
  time: number; // ms
  age: number;  // 0–1 (0=fresh, 1=old)
}

/* ─── lat/lon → sphere vec3 ─── */
function ll2v(lat: number, lon: number, r = 2.02): THREE.Vector3 {
  const phi   = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r  * Math.cos(phi),
    r  * Math.sin(phi) * Math.sin(theta),
  );
}

/* ─── Procedural thunder audio ─── */
let audioCtx: AudioContext | null = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return audioCtx;
}

function playThunder(distance: number) {
  // distance 0–1 (0=close, 1=far)
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const vol = Math.max(0.02, 0.4 * (1 - distance * 0.85));
    const dur = 1.5 + distance * 3;

    // Initial crack (close) or distant rumble
    if (distance < 0.3) {
      const crack = ctx.createOscillator();
      const crackGain = ctx.createGain();
      crack.type = 'sawtooth';
      crack.frequency.setValueAtTime(120 + Math.random() * 80, now);
      crack.frequency.exponentialRampToValueAtTime(30, now + 0.08);
      crackGain.gain.setValueAtTime(vol * 1.5, now);
      crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      crack.connect(crackGain);
      crackGain.connect(ctx.destination);
      crack.start(now); crack.stop(now + 0.15);
    }

    // Rumble noise
    const bufLen = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * (0.4 + distance * 1.2)));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 180 - distance * 100;
    filter.Q.value = 1.5;

    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(0, now + (distance < 0.3 ? 0.05 : 0));
    rumbleGain.gain.linearRampToValueAtTime(vol, now + 0.1 + distance * 0.3);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    // Panner for spatial feel
    const panner = ctx.createStereoPanner();
    panner.pan.value = (Math.random() - 0.5) * 0.6 * (1 - distance);

    noise.connect(filter);
    filter.connect(rumbleGain);
    rumbleGain.connect(panner);
    panner.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + dur + 0.1);
  } catch {}
}

/* ─── Globe components ─── */
function Atmosphere() {
  return (
    <mesh>
      <sphereGeometry args={[2.05, 64, 64]} />
      <shaderMaterial
        transparent blending={THREE.AdditiveBlending} side={THREE.BackSide} depthWrite={false}
        vertexShader={`varying vec3 vNormal;void main(){vNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`}
        fragmentShader={`varying vec3 vNormal;void main(){float i=pow(0.65-dot(vNormal,vec3(0,0,1.0)),4.0);gl_FragColor=vec4(0.2,0.4,1.0,1.0)*i*2.0;}`}
      />
    </mesh>
  );
}

function Clouds() {
  const cloudMap = useTexture('/earth-clouds.png');
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 0.012; });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[2.03, 64, 64]} />
      <meshStandardMaterial map={cloudMap} transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

function EarthGlobe() {
  // Dark night-side earth texture feel
  const colorMap = useTexture('https://unpkg.com/three-globe/example/img/earth-night.jpg');
  return (
    <mesh>
      <sphereGeometry args={[2, 64, 64]} />
      <meshStandardMaterial map={colorMap} roughness={1} metalness={0} />
    </mesh>
  );
}

/* ─── Grid lines ─── */
function GlobeGrid() {
  const lines = useMemo(() => {
    const r: THREE.Vector3[][] = [];
    for (let lat = -60; lat <= 60; lat += 30) {
      const pts: THREE.Vector3[] = [];
      for (let lon = -180; lon <= 180; lon += 5) pts.push(ll2v(lat, lon, 2.022));
      r.push(pts);
    }
    for (let lon = -180; lon < 180; lon += 30) {
      const pts: THREE.Vector3[] = [];
      for (let lat = -90; lat <= 90; lat += 5) pts.push(ll2v(lat, lon, 2.022));
      r.push(pts);
    }
    return r;
  }, []);
  return (
    <>
      {lines.map((pts, i) => (
        <Line key={i} points={pts} color="#4488ff" lineWidth={0.3} transparent opacity={0.06} />
      ))}
    </>
  );
}

/* ─── Stars ─── */
function Stars() {
  const positions = useMemo(() => {
    const arr = new Float32Array(3000 * 3);
    for (let i = 0; i < 3000; i++) {
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

/* ─── Lightning bolt geometry (jagged line from surface outward) ─── */
function LightningBolt({ strike, cameraPos }: { strike: Strike; cameraPos: THREE.Vector3 }) {
  const origin = useMemo(() => ll2v(strike.lat, strike.lon, 2.0), [strike.lat, strike.lon]);
  const normal = useMemo(() => origin.clone().normalize(), [origin]);
  const t = useRef(0);
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  // Build jagged bolt points
  const boltPoints = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const segments = 6;
    // perpendicular basis
    const up = new THREE.Vector3(0, 1, 0);
    const perp = new THREE.Vector3().crossVectors(normal, up).normalize();
    const perp2 = new THREE.Vector3().crossVectors(normal, perp).normalize();
    for (let i = 0; i <= segments; i++) {
      const frac = i / segments;
      const jitter = i === 0 || i === segments ? 0 : (Math.random() - 0.5) * 0.06;
      const jitter2 = i === 0 || i === segments ? 0 : (Math.random() - 0.5) * 0.06;
      pts.push(
        origin.clone()
          .addScaledVector(normal, frac * 0.18)
          .addScaledVector(perp, jitter)
          .addScaledVector(perp2, jitter2)
      );
    }
    return pts;
  }, [origin, normal]);

  useFrame((_, dt) => {
    t.current += dt;
    if (meshRef.current) {
      const fade = Math.max(0, 1 - strike.age * 2);
      (meshRef.current.material as THREE.MeshBasicMaterial).opacity = fade;
    }
    if (ringRef.current) {
      const s = 1 + t.current * 3;
      ringRef.current.scale.set(s, s, s);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - strike.age * 3) * 0.6);
    }
  });

  // Face ring toward camera
  const q = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    return q;
  }, [normal]);

  const age = strike.age;
  const fresh = age < 0.15;

  return (
    <group>
      {/* Bolt line */}
      {fresh && boltPoints.length > 1 && (
        <Line
          points={boltPoints}
          color={age < 0.05 ? '#ffffff' : '#aaddff'}
          lineWidth={age < 0.05 ? 3 : 1.5}
          transparent
          opacity={Math.max(0, 1 - age * 8)}
        />
      )}

      {/* Glow dot */}
      <mesh ref={meshRef} position={origin}>
        <sphereGeometry args={[0.018, 8, 8]} />
        <meshBasicMaterial
          color={age < 0.1 ? '#ffffff' : '#88ccff'}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Expanding ring */}
      <mesh ref={ringRef} position={origin} quaternion={q}>
        <ringGeometry args={[0.02, 0.032, 24]} />
        <meshBasicMaterial
          color="#66aaff"
          transparent
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/* ─── Instanced strike dots for older strikes ─── */
function StrikeDots({ strikes }: { strikes: Strike[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    if (!meshRef.current) return;
    strikes.forEach((s, i) => {
      const pos = ll2v(s.lat, s.lon, 2.02);
      dummy.position.copy(pos);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
      const age = s.age;
      const r = age < 0.1 ? 1 : age < 0.4 ? 0.6 : 0.3;
      const g = age < 0.1 ? 1 : age < 0.4 ? 0.8 : 0.5;
      const b = 1;
      meshRef.current!.setColorAt(i, new THREE.Color(r, g, b));
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  if (!strikes.length) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, strikes.length]}>
      <sphereGeometry args={[0.012, 6, 6]} />
      <meshBasicMaterial transparent blending={THREE.AdditiveBlending} depthWrite={false} vertexColors />
    </instancedMesh>
  );
}

function Scene({ strikes, soundOn }: { strikes: Strike[]; soundOn: boolean }) {
  const { camera } = useThree();
  const cameraPos = useRef(new THREE.Vector3());

  useFrame(() => { cameraPos.current.copy(camera.position); });

  // Fresh strikes get full bolt treatment; older ones are just dots
  const freshStrikes = strikes.filter(s => s.age < 0.5);
  const allStrikes   = strikes;

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 5, 5]} intensity={1.2} color="#ffffff" />
      <directionalLight position={[-8, -3, -5]} intensity={0.15} color="#334466" />
      <Suspense fallback={null}>
        <Stars />
        <EarthGlobe />
        <Atmosphere />
        <Clouds />
        <GlobeGrid />
        <StrikeDots strikes={allStrikes} />
        {freshStrikes.map(s => (
          <LightningBolt key={s.id} strike={s} cameraPos={cameraPos.current} />
        ))}
      </Suspense>
      <OrbitControls enablePan={false} minDistance={2.8} maxDistance={14} autoRotate autoRotateSpeed={0.1} />
    </>
  );
}

/* ─── Mini activity chart ─── */
function ActivityChart({ history }: { history: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    if (!history.length) return;
    const max = Math.max(...history, 1);
    const bw = W / history.length;
    history.forEach((v, i) => {
      const bh = (v / max) * H * 0.9;
      const alpha = 0.3 + (i / history.length) * 0.7;
      ctx.fillStyle = `rgba(100,180,255,${alpha})`;
      ctx.fillRect(i * bw, H - bh, bw - 1, bh);
    });
  }, [history]);
  return <canvas ref={canvasRef} width={200} height={40} className="w-full h-full" />;
}

/* ─── Main component ─── */
const MAX_STRIKES = 500;
const FADE_MS     = 20000; // strikes fade over 20s
const HISTORY_BINS = 40;

export function Thunder() {
  const [strikes, setStrikes]     = useState<Strike[]>([]);
  const [connected, setConnected] = useState(false);
  const [soundOn, setSoundOn]     = useState(false); // off by default — user must enable
  const [totalCount, setTotalCount] = useState(0);
  const [ratePerMin, setRatePerMin] = useState(0);
  const [history, setHistory]     = useState<number[]>(Array(HISTORY_BINS).fill(0));
  const [audioReady, setAudioReady] = useState(false);

  const wsRef       = useRef<EventSource | null>(null);
  const binCount    = useRef(0);
  const strikeSeq   = useRef(0);
  const binTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const rateBuffer  = useRef<number[]>([]);
  const soundOnRef  = useRef(soundOn);
  useEffect(() => { soundOnRef.current = soundOn; }, [soundOn]);

  /* ── SSE connection (proxied through Next.js API to avoid CORS) ── */
  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const es = new EventSource('/api/lightning');
    wsRef.current = es;

    es.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'status') {
          setConnected(msg.connected);
          return;
        }
        if (msg.type !== 'strike') return;

        const strike: Strike = {
          id: `${++strikeSeq.current}-${msg.time}-${(msg.lat as number).toFixed(3)}-${(msg.lon as number).toFixed(3)}`,
          lat: msg.lat,
          lon: msg.lon,
          time: Date.now(),
          age: 0,
        };
        setStrikes(prev => [...prev, strike].slice(-MAX_STRIKES));
        binCount.current++;
        setTotalCount(c => c + 1);

        if (soundOnRef.current) {
          const dist = Math.min(1, Math.abs(msg.lat) / 90 * 0.5 + Math.random() * 0.5);
          playThunder(dist);
        }
      } catch {}
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      setTimeout(connect, 3000);
    };

    es.onopen = () => setConnected(true);
  }, []);

  /* ── Mount: connect + start animation loop ── */
  useEffect(() => {
    connect();

    // Tick: age strikes and remove faded ones
    const tick = setInterval(() => {
      const now = Date.now();
      setStrikes(prev => {
        if (!prev.length) return prev;
        return prev
          .map(s => ({ ...s, age: (now - s.time) / FADE_MS }))
          .filter(s => s.age < 1);
      });
    }, 50);

    // Rate counter: bucket per second, compute per-minute rate
    binTimer.current = setInterval(() => {
      rateBuffer.current.push(binCount.current);
      binCount.current = 0;
      if (rateBuffer.current.length > 60) rateBuffer.current.shift();
      const sum = rateBuffer.current.reduce((a, b) => a + b, 0);
      setRatePerMin(sum);

      setHistory(prev => {
        const next = [...prev.slice(1), rateBuffer.current[rateBuffer.current.length - 1] ?? 0];
        return next;
      });
    }, 1000);

    return () => {
      clearInterval(tick);
      if (binTimer.current) clearInterval(binTimer.current);
      wsRef.current?.close();
    };
  }, []); // eslint-disable-line

  /* ── Enable audio on first user interaction ── */
  const enableAudio = () => {
    setSoundOn(true);
    setAudioReady(true);
    try { getAudioCtx().resume(); } catch {}
  };

  const activeCount = strikes.filter(s => s.age < 0.3).length;

  return (
    <div className="w-full h-full bg-[#020408] text-white font-mono overflow-hidden flex flex-col">

      {/* ── TOP BAR ── */}
      <div className="flex items-stretch border-b border-white/10 bg-black/60 shrink-0 flex-wrap">
        <div className="flex items-center gap-3 px-6 py-3 border-r border-white/10">
          <span className="text-[9px] tracking-[0.35em] text-white/30 uppercase">MODULE</span>
          <span className="text-sm font-bold tracking-widest text-yellow-300">THUNDER</span>
        </div>

        <div className="flex items-center px-5 py-3 border-r border-white/10 gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-yellow-300 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-[9px] tracking-[0.3em] text-white/30 uppercase">
            {connected ? 'BLITZORTUNG · LIVE' : 'RECONNECTING...'}
          </span>
        </div>

        <div className="flex items-center px-5 py-3 border-r border-white/10 gap-3">
          <span className="text-[9px] text-white/30 uppercase tracking-widest">RATE</span>
          <span className="text-sm font-bold tabular-nums text-yellow-300">{ratePerMin}</span>
          <span className="text-[9px] text-white/20">/MIN</span>
        </div>

        <div className="flex items-center px-5 py-3 border-r border-white/10 gap-3">
          <span className="text-[9px] text-white/30 uppercase tracking-widest">TOTAL</span>
          <span className="text-sm font-bold tabular-nums text-white/70">{totalCount.toLocaleString()}</span>
        </div>

        <div className="flex items-center px-5 py-3 border-r border-white/10 gap-3">
          <span className="text-[9px] text-white/30 uppercase tracking-widest">ACTIVE</span>
          <span className="text-sm font-bold tabular-nums text-blue-300">{activeCount}</span>
        </div>

        <div className="flex items-center px-4 py-3 ml-auto gap-2">
          <button
            onClick={audioReady ? () => setSoundOn(s => !s) : enableAudio}
            className="flex items-center gap-2 px-4 py-1.5 text-[9px] tracking-[0.25em] uppercase border transition-all duration-200"
            style={{
              borderColor: soundOn ? 'rgba(253,224,71,0.4)' : 'rgba(255,255,255,0.1)',
              color: soundOn ? '#fde047' : 'rgba(255,255,255,0.3)',
              background: soundOn ? 'rgba(253,224,71,0.06)' : 'transparent',
            }}
          >
            <span>{soundOn ? '⚡' : '○'}</span>
            {audioReady ? (soundOn ? 'THUNDER ON' : 'THUNDER OFF') : 'ENABLE AUDIO'}
          </button>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Globe */}
        <div className="flex-1 relative">
          <Canvas camera={{ position: [0, 0, 6], fov: 45 }}>
            <Scene strikes={strikes} soundOn={soundOn} />
          </Canvas>

          {/* Activity chart overlay */}
          <div className="absolute bottom-6 left-6 w-52">
            <div className="text-[9px] tracking-[0.3em] text-white/20 uppercase mb-1.5">STRIKE ACTIVITY</div>
            <div className="h-10 bg-black/40 border border-white/5">
              <ActivityChart history={history} />
            </div>
          </div>

          {/* Legend */}
          <div className="absolute bottom-6 right-6 flex flex-col gap-1.5">
            {[
              { color: '#ffffff', label: '< 1S' },
              { color: '#88ccff', label: '1–5S' },
              { color: '#4488cc', label: '5–10S' },
              { color: '#224466', label: '> 10S' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-[8px] text-white/30 tracking-wider">{label}</span>
              </div>
            ))}
          </div>

          {/* Audio prompt */}
          <AnimatePresence>
            {!audioReady && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute top-6 left-1/2 -translate-x-1/2 pointer-events-none"
              >
                <div className="text-[9px] tracking-[0.3em] text-yellow-300/40 uppercase text-center">
                  ENABLE AUDIO FOR SPATIAL THUNDER
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="w-64 shrink-0 border-l border-white/10 flex flex-col overflow-hidden bg-black/20">

          {/* Live feed */}
          <div className="px-4 py-3 border-b border-white/10">
            <span className="text-[9px] tracking-[0.3em] text-white/30 uppercase">LIVE FEED</span>
          </div>

          <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <AnimatePresence initial={false}>
              {[...strikes].reverse().slice(0, 60).map(s => {
                const age = s.age;
                const col = age < 0.1 ? '#ffffff' : age < 0.3 ? '#aaddff' : age < 0.6 ? '#5588aa' : '#334455';
                return (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center gap-3 px-4 py-2 border-b border-white/[0.03]"
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: col }} />
                    <span className="text-[9px] tabular-nums text-white/40 w-16 shrink-0">
                      {s.lat.toFixed(1)}°{s.lat >= 0 ? 'N' : 'S'}
                    </span>
                    <span className="text-[9px] tabular-nums text-white/30 flex-1">
                      {Math.abs(s.lon).toFixed(1)}°{s.lon >= 0 ? 'E' : 'W'}
                    </span>
                    <span className="text-[8px] text-white/15 shrink-0">
                      {Math.round(s.age * FADE_MS / 1000)}s
                    </span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Stats footer */}
          <div className="border-t border-white/10 px-4 py-3 flex flex-col gap-2">
            <div className="flex justify-between text-[9px]">
              <span className="text-white/25 tracking-widest uppercase">Source</span>
              <span className="text-white/40">Blitzortung.org</span>
            </div>
            <div className="flex justify-between text-[9px]">
              <span className="text-white/25 tracking-widest uppercase">Fade</span>
              <span className="text-white/40">{FADE_MS / 1000}s</span>
            </div>
            <div className="flex justify-between text-[9px]">
              <span className="text-white/25 tracking-widest uppercase">Max shown</span>
              <span className="text-white/40">{MAX_STRIKES}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
