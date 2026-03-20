'use client';

import { useEffect, useRef, useState, useMemo, useCallback, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sphere, OrbitControls, useTexture, Line } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';

/* ─── Types ─── */
interface Quake {
  id: string; mag: number; place: string; time: number;
  lat: number; lon: number; depth: number;
}
interface SolarWind { bz: number; speed: number; }

/* ─── Helpers ─── */
function latLonToVec3(lat: number, lon: number, r = 2.02): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}
function magColor(mag: number) {
  if (mag < 3) return '#4ade80';
  if (mag < 5) return '#facc15';
  if (mag < 6) return '#fb923c';
  if (mag < 7) return '#f87171';
  return '#e879f9';
}
function magLabel(mag: number) {
  if (mag < 3) return 'MINOR';
  if (mag < 5) return 'LIGHT';
  if (mag < 6) return 'MODERATE';
  if (mag < 7) return 'STRONG';
  return 'MAJOR';
}

/* ─── Globe components ─── */
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
      <meshStandardMaterial map={cloudMap} transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

function EarthGlobe() {
  const colorMap = useTexture('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg');
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 0.03; });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[2, 64, 64]} />
      <meshStandardMaterial map={colorMap} roughness={0.8} metalness={0.1} />
    </mesh>
  );
}

/* ─── Ripple quake marker ─── */
function QuakeMarker({ quake, onClick, highlighted }: { quake: Quake; onClick: () => void; highlighted: boolean }) {
  const ring1 = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);
  const dot   = useRef<THREE.Mesh>(null);
  const t = useRef(Math.random() * Math.PI * 2);
  const pos = useMemo(() => latLonToVec3(quake.lat, quake.lon), [quake.lat, quake.lon]);
  const color = magColor(quake.mag);
  const scale = Math.max(0.5, quake.mag / 5);
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), pos.clone().normalize()), [pos]);

  useFrame((_, dt) => {
    t.current += dt * (highlighted ? 1.4 : 0.9);
    const p  = (t.current % (Math.PI * 2)) / (Math.PI * 2);
    const p2 = ((t.current + Math.PI) % (Math.PI * 2)) / (Math.PI * 2);
    if (ring1.current) {
      const s = 0.08 + p * scale * 1.4;
      ring1.current.scale.set(s, s, s);
      (ring1.current.material as THREE.MeshBasicMaterial).opacity = (1 - p) * (highlighted ? 1 : 0.7);
    }
    if (ring2.current) {
      const s = 0.08 + p2 * scale * 1.4;
      ring2.current.scale.set(s, s, s);
      (ring2.current.material as THREE.MeshBasicMaterial).opacity = (1 - p2) * (highlighted ? 0.8 : 0.45);
    }
    if (dot.current) dot.current.scale.setScalar(highlighted ? 1.4 + Math.sin(t.current * 4) * 0.2 : 1);
  });

  return (
    <group position={pos} quaternion={q}>
      <mesh ref={dot} onClick={onClick}>
        <circleGeometry args={[0.028, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh ref={ring1}>
        <ringGeometry args={[0.04, 0.058, 32]} />
        <meshBasicMaterial color={color} transparent side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ring2}>
        <ringGeometry args={[0.04, 0.058, 32]} />
        <meshBasicMaterial color={color} transparent side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* ─── Tectonic plate outlines (simplified major boundaries as line segments) ─── */
const PLATE_LINES: [number,number][][] = [
  // Pacific Ring of Fire (simplified)
  [[-60,-70],[-55,-68],[-45,-65],[-35,-72],[-25,-70],[-15,-75],[-5,-80],[5,-77],[10,-85],[15,-87],[20,-87],[25,-90],[30,-90],[35,-88],[40,-85],[45,-80],[50,-75],[55,-70],[60,-65]],
  [[60,-165],[55,-160],[50,-155],[45,-150],[40,-145],[35,-140],[30,-135],[25,-130],[20,-125],[15,-120],[10,-115],[5,-110],[0,-105],[-5,-100],[-10,-95],[-15,-90]],
  [[55,160],[50,155],[45,150],[40,145],[35,140],[30,135],[25,130],[20,125],[15,120],[10,115],[5,110],[0,105],[-5,100],[-10,95],[-15,90],[-20,85],[-25,80],[-30,75],[-35,70],[-40,65],[-45,60]],
  // Mid-Atlantic Ridge
  [[65,-18],[60,-25],[55,-30],[50,-28],[45,-27],[40,-28],[35,-30],[30,-40],[25,-44],[20,-45],[15,-44],[10,-42],[5,-32],[0,-15],[-5,-12],[-10,-14],[-15,-14],[-20,-12],[-25,-13],[-30,-14],[-35,-16],[-40,-18],[-45,-16],[-50,-8],[-55,-2],[-60,5]],
];

function TectonicPlates() {
  return (
    <>
      {PLATE_LINES.map((line, i) => {
        const pts = line.map(([lat, lon]) => latLonToVec3(lat, lon, 2.015));
        return <Line key={i} points={pts} color="#ffffff" lineWidth={0.4} transparent opacity={0.08} />;
      })}
    </>
  );
}

/* ─── Starfield ─── */
function Stars() {
  const count = 2000;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 80 + Math.random() * 40;
      arr[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.cos(phi);
      arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return arr;
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.18} sizeAttenuation transparent opacity={0.8} />
    </points>
  );
}

/* ─── Sun ─── */
const SUN_VERT = `
varying vec2 vUv;
varying vec3 vNormal;
void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SUN_FRAG = `
uniform float uTime;
uniform vec3 uColor;
varying vec2 vUv;
varying vec3 vNormal;

// simple hash noise
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  float a = hash(i), b = hash(i+vec2(1,0)), c = hash(i+vec2(0,1)), d = hash(i+vec2(1,1));
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.1; a*=0.5; }
  return v;
}

void main() {
  vec2 uv = vUv * 4.0;
  float n = fbm(uv + uTime * 0.08);
  float n2 = fbm(uv * 1.5 - uTime * 0.05 + 3.7);
  float surface = n * 0.6 + n2 * 0.4;

  // limb darkening
  float limb = pow(max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0), 0.4);

  vec3 hotCore  = vec3(1.0, 0.98, 0.85);
  vec3 midTone  = uColor;
  vec3 darkSpot = vec3(0.6, 0.25, 0.05);

  vec3 col = mix(darkSpot, mix(midTone, hotCore, surface), smoothstep(0.2, 0.7, surface));
  col *= 0.6 + 0.4 * limb;

  gl_FragColor = vec4(col, 1.0);
}`;

function Sun({ bz }: { bz: number }) {
  const uniforms = useRef({ uTime: { value: 0 }, uColor: { value: new THREE.Color('#ff8800') } });
  // Fixed world position — does NOT rotate with camera or Earth
  const pos = useMemo(() => new THREE.Vector3(16, 3, -6), []);
  const coronaColor = bz < -10 ? '#ff3300' : bz < -5 ? '#ff6600' : '#ffaa22';

  useFrame((_, dt) => {
    uniforms.current.uTime.value += dt;
    uniforms.current.uColor.value.set(coronaColor);
  });

  return (
    <group position={pos}>
      <mesh>
        <sphereGeometry args={[1.4, 64, 64]} />
        <shaderMaterial vertexShader={SUN_VERT} fragmentShader={SUN_FRAG} uniforms={uniforms.current} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.9, 32, 32]} />
        <meshBasicMaterial color={coronaColor} transparent opacity={0.22} side={THREE.BackSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[2.6, 32, 32]} />
        <meshBasicMaterial color={coronaColor} transparent opacity={0.10} side={THREE.BackSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[3.8, 32, 32]} />
        <meshBasicMaterial color={coronaColor} transparent opacity={0.04} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

/* ─── Solar wind stream particles ─── */
function SolarWindStream({ bz }: { bz: number }) {
  const count = 120;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const particles = useMemo(() => Array.from({ length: count }, () => ({
    t: Math.random(),
    speed: 0.004 + Math.random() * 0.003,
    offset: (Math.random() - 0.5) * 3,
    offsetY: (Math.random() - 0.5) * 3,
  })), []);

  const active = bz < -5;
  const streamColor = bz < -10 ? '#ff4422' : bz < -5 ? '#fb923c' : '#facc1540';

  useFrame(() => {
    if (!meshRef.current) return;
    particles.forEach((p, i) => {
      p.t = (p.t + p.speed * (active ? 1.6 : 0.6)) % 1;
      // travel from Sun (x=18) toward Earth (x=0), slight spread
      const x = 18 - p.t * 20;
      const y = p.offsetY * (1 - p.t * 0.5);
      const z = p.offset * (1 - p.t * 0.5) - 8 + p.t * 8;
      dummy.position.set(x, y, z);
      dummy.scale.setScalar(active ? 0.06 : 0.03);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color={streamColor} transparent opacity={active ? 0.7 : 0.25} />
    </instancedMesh>
  );
}

function Scene({ quakes, onSelect, selected, bz }: { quakes: Quake[]; onSelect: (q: Quake) => void; selected: Quake | null; bz: number }) {
  return (
    <>
      {/* Fixed lights — not affected by Earth rotation */}
      <ambientLight intensity={0.35} />
      {/* Sun direction: matches Sun position [16,3,-6] normalized */}
      <directionalLight position={[16, 3, -6]} intensity={2.5} color="#fff8e0" />
      {/* Soft blue fill for night side */}
      <directionalLight position={[-8, -2, 6]} intensity={0.2} color="#2244aa" />

      <Suspense fallback={null}>
        <Stars />
        <Sun bz={bz} />
        <SolarWindStream bz={bz} />
        <EarthGlobe />
        <Atmosphere />
        <Clouds />
        <TectonicPlates />
        {quakes.map(q => (
          <QuakeMarker key={q.id} quake={q} onClick={() => onSelect(q)} highlighted={selected?.id === q.id} />
        ))}
      </Suspense>
      <OrbitControls enablePan={false} minDistance={3} maxDistance={12} autoRotate autoRotateSpeed={0.25} />
    </>
  );
}

/* ─── Waveform visualiser (seismograph style) ─── */
function Seismograph({ quake, playing }: { quake: Quake; playing: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);
  const tRef      = useRef(0);
  const color     = magColor(quake.mag);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width, H = canvas.height;

    // Synthetic seismogram: P-wave + S-wave + surface wave envelope
    const pDelay   = 20;
    const sDelay   = pDelay + 30;
    const surfDelay = sDelay + 50;
    const amp = Math.pow(10, quake.mag - 3) * 0.4;

    function envelope(x: number, delay: number, width: number, decay: number) {
      if (x < delay) return 0;
      const t = x - delay;
      return Math.exp(-t / decay) * Math.sin(t / width * Math.PI * 2);
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      // grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      for (let y = H * 0.25; y < H; y += H * 0.25) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      // baseline
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();

      // waveform
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = color;
      ctx.shadowBlur = 4;

      const progress = playing ? Math.min(tRef.current / 300, 1) : 1;
      const drawTo = Math.floor(W * progress);

      for (let x = 0; x < drawTo; x++) {
        const xNorm = (x / W) * 200;
        const noise = (Math.random() - 0.5) * 0.5;
        const p = envelope(xNorm, pDelay, 2, 15) * amp * 0.6;
        const s = envelope(xNorm, sDelay, 3, 20) * amp;
        const surf = envelope(xNorm, surfDelay, 6, 40) * amp * 1.4;
        const y = H / 2 - (p + s + surf + noise) * (H * 0.35);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // phase labels
      if (progress > pDelay / 200) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '9px monospace';
        ctx.fillText('P', (pDelay / 200) * W + 2, 12);
      }
      if (progress > sDelay / 200) {
        ctx.fillStyle = color;
        ctx.fillText('S', (sDelay / 200) * W + 2, 12);
      }
      if (progress > surfDelay / 200) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillText('SURF', (surfDelay / 200) * W + 2, 12);
      }

      // scan line
      if (playing && progress < 1) {
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(drawTo, 0); ctx.lineTo(drawTo, H);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    if (playing) {
      tRef.current = 0;
      const tick = () => {
        tRef.current += 2;
        draw();
        if (tRef.current < 320) animRef.current = requestAnimationFrame(tick);
      };
      animRef.current = requestAnimationFrame(tick);
    } else {
      tRef.current = 300;
      draw();
    }

    return () => cancelAnimationFrame(animRef.current);
  }, [quake, playing, color]);

  return <canvas ref={canvasRef} width={480} height={100} className="w-full h-full" />;
}

/* ─── Audio synthesis ─── */
function playQuakeSound(mag: number) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = ctx.currentTime;
    const duration = 2 + mag * 0.5;

    // Low rumble
    const rumble = ctx.createOscillator();
    const rumbleGain = ctx.createGain();
    rumble.type = 'sawtooth';
    rumble.frequency.setValueAtTime(20 + mag * 3, now);
    rumble.frequency.exponentialRampToValueAtTime(10, now + duration);
    rumbleGain.gain.setValueAtTime(0, now);
    rumbleGain.gain.linearRampToValueAtTime(0.15 * (mag / 9), now + 0.1);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    rumble.connect(rumbleGain);

    // P-wave click
    const pOsc = ctx.createOscillator();
    const pGain = ctx.createGain();
    pOsc.type = 'sine';
    pOsc.frequency.setValueAtTime(80 + mag * 20, now + 0.3);
    pOsc.frequency.exponentialRampToValueAtTime(30, now + 0.8);
    pGain.gain.setValueAtTime(0, now + 0.3);
    pGain.gain.linearRampToValueAtTime(0.2 * (mag / 9), now + 0.35);
    pGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    pOsc.connect(pGain);

    // S-wave
    const sOsc = ctx.createOscillator();
    const sGain = ctx.createGain();
    sOsc.type = 'triangle';
    sOsc.frequency.setValueAtTime(40 + mag * 10, now + 0.7);
    sOsc.frequency.exponentialRampToValueAtTime(15, now + 1.5);
    sGain.gain.setValueAtTime(0, now + 0.7);
    sGain.gain.linearRampToValueAtTime(0.25 * (mag / 9), now + 0.8);
    sGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    sOsc.connect(sGain);

    // Noise burst
    const bufSize = ctx.sampleRate * duration;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.3));
    const noise = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();
    noise.buffer = buf;
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 200 + mag * 50;
    noiseGain.gain.setValueAtTime(0.1 * (mag / 9), now + 0.5);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);

    [rumbleGain, pGain, sGain, noiseGain].forEach(g => g.connect(ctx.destination));
    [rumble, pOsc, sOsc, noise].forEach(s => { s.start(now); s.stop(now + duration + 0.1); });

    setTimeout(() => ctx.close(), (duration + 0.5) * 1000);
  } catch (e) { /* audio not available */ }
}

/* ─── Depth cross-section diagram ─── */
function DepthDiagram({ quake }: { quake: Quake }) {
  const maxDepth = 700;
  const pct = Math.min(quake.depth / maxDepth, 1);
  const zones = [
    { label: 'SHALLOW', range: '0–70km', color: '#f87171', from: 0, to: 0.1 },
    { label: 'INTERMEDIATE', range: '70–300km', color: '#fb923c', from: 0.1, to: 0.43 },
    { label: 'DEEP', range: '300–700km', color: '#a78bfa', from: 0.43, to: 1 },
  ];
  const zone = quake.depth < 70 ? zones[0] : quake.depth < 300 ? zones[1] : zones[2];

  return (
    <div className="flex gap-4 items-start">
      {/* depth bar */}
      <div className="relative w-6 bg-white/5 rounded-none" style={{ height: 120 }}>
        {zones.map(z => (
          <div key={z.label} className="absolute w-full" style={{
            top: `${z.from * 100}%`, height: `${(z.to - z.from) * 100}%`,
            backgroundColor: `${z.color}20`, borderTop: `1px solid ${z.color}30`,
          }} />
        ))}
        <div
          className="absolute w-full flex items-center justify-center transition-all duration-700"
          style={{ top: `${pct * 100}%`, transform: 'translateY(-50%)' }}
        >
          <div className="w-3 h-3 rounded-full border-2" style={{ backgroundColor: zone.color, borderColor: zone.color }} />
        </div>
      </div>
      <div className="flex flex-col justify-between" style={{ height: 120 }}>
        <div className="text-[8px] text-white/20">0 km</div>
        <div className="flex flex-col gap-0.5">
          <div className="text-xs font-bold" style={{ color: zone.color }}>{quake.depth.toFixed(1)} km</div>
          <div className="text-[9px] tracking-widest" style={{ color: zone.color }}>{zone.label}</div>
          <div className="text-[8px] text-white/20">{zone.range}</div>
        </div>
        <div className="text-[8px] text-white/20">700 km</div>
      </div>
    </div>
  );
}

/* ─── Magnitude timeline chart ─── */
function MagTimeline({ quakes }: { quakes: Quake[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || quakes.length === 0) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const sorted = [...quakes].sort((a, b) => a.time - b.time);
    const minT = sorted[0].time, maxT = sorted[sorted.length - 1].time;
    const tRange = maxT - minT || 1;

    // grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let m = 2; m <= 9; m++) {
      const y = H - ((m - 2) / 7) * H * 0.85 - H * 0.05;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.font = '8px monospace';
      ctx.fillText(`M${m}`, 2, y - 2);
    }

    // bars
    sorted.forEach(q => {
      const x = ((q.time - minT) / tRange) * (W - 10) + 5;
      const barH = ((q.mag - 2) / 7) * H * 0.85;
      const y = H - barH - H * 0.05;
      ctx.fillStyle = magColor(q.mag) + 'cc';
      ctx.fillRect(x - 1.5, y, 3, barH);
    });
  }, [quakes]);

  return <canvas ref={canvasRef} width={600} height={80} className="w-full h-full" />;
}

/* ─── Main component ─── */
export function QuakeTracker() {
  const [quakes, setQuakes]   = useState<Quake[]>([]);
  const [wind, setWind]       = useState<SolarWind | null>(null);
  const [selected, setSelected] = useState<Quake | null>(null);
  const [loading, setLoading] = useState(true);
  const [minMag, setMinMag]   = useState(4);
  const [lastUpdate, setLastUpdate] = useState('');
  const [wavePlay, setWavePlay] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [tab, setTab]         = useState<'list' | 'chart' | 'solar'>('list');

  useEffect(() => {
    const load = async () => {
      try {
        const [quakeRes, windRes] = await Promise.all([
          fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson'),
          fetch('/api/space-weather'),
        ]);
        const qj = await quakeRes.json();
        setQuakes(qj.features.map((f: any) => ({
          id: f.id, mag: f.properties.mag, place: f.properties.place,
          time: f.properties.time, lat: f.geometry.coordinates[1],
          lon: f.geometry.coordinates[0], depth: f.geometry.coordinates[2],
        })));
        const wd = await windRes.json();
        if (wd.mag && Array.isArray(wd.mag)) {
          const rows = wd.mag.filter((r: any[]) => r[0] !== 'time_tag');
          const last = rows[rows.length - 1];
          if (last) setWind({ bz: parseFloat(last[3]), speed: parseFloat(last[2] ?? 0) });
        }
        setLastUpdate(new Date().toUTCString().slice(5, 22) + ' UTC');
        setLoading(false);
      } catch { setLoading(false); }
    };
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => quakes.filter(q => q.mag >= minMag), [quakes, minMag]);

  const handleSelect = useCallback((q: Quake) => {
    setSelected(q);
    setWavePlay(true);
    if (soundOn) playQuakeSound(q.mag);
    setTimeout(() => setWavePlay(false), 3500);
  }, [soundOn]);

  const bzColor = wind
    ? wind.bz < -10 ? '#f87171' : wind.bz < -5 ? '#fb923c' : wind.bz < 0 ? '#facc15' : '#4ade80'
    : '#ffffff40';

  const magCounts = useMemo(() => ({
    light: quakes.filter(q => q.mag >= 3 && q.mag < 5).length,
    moderate: quakes.filter(q => q.mag >= 5 && q.mag < 6).length,
    strong: quakes.filter(q => q.mag >= 6 && q.mag < 7).length,
    major: quakes.filter(q => q.mag >= 7).length,
  }), [quakes]);

  return (
    <div className="w-full h-full bg-[#080808] text-white font-mono overflow-hidden flex flex-col">

      {/* ── TOP BAR ── */}
      <div className="flex items-stretch border-b border-white/10 bg-black/40 shrink-0 flex-wrap">
        <div className="flex items-center gap-3 px-6 py-3 border-r border-white/10">
          <span className="text-[9px] tracking-[0.35em] text-white/30 uppercase">MODULE</span>
          <span className="text-sm font-bold tracking-widest">SEISMIC · SOLAR CORRELATION</span>
        </div>
        <div className="flex items-center px-5 py-3 border-r border-white/10 gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[9px] tracking-[0.3em] text-white/30 uppercase">USGS · NOAA SWPC</span>
        </div>
        {wind && (
          <div className="flex items-center px-5 py-3 border-r border-white/10 gap-3">
            <span className="text-[9px] text-white/30 uppercase tracking-widest">Bz</span>
            <span className="text-sm font-bold tabular-nums" style={{ color: bzColor }}>
              {wind.bz > 0 ? '+' : ''}{wind.bz.toFixed(1)} nT
            </span>
            <span className="text-[8px] tracking-widest" style={{ color: bzColor }}>
              {wind.bz < -10 ? '⚡ GEOEFFECTIVE' : wind.bz < -5 ? 'SOUTHWARD' : wind.bz < 0 ? 'WEAK-S' : 'NORTHWARD'}
            </span>
          </div>
        )}
        <div className="flex items-center gap-4 px-5 py-3 ml-auto">
          <button
            onClick={() => setSoundOn(s => !s)}
            className="text-[9px] tracking-[0.3em] uppercase transition-colors"
            style={{ color: soundOn ? '#4ade80' : 'rgba(255,255,255,0.2)' }}
          >
            {soundOn ? '♪ SOUND ON' : '♪ SOUND OFF'}
          </button>
          <span className="text-[9px] text-white/20 tracking-widest hidden md:block">
            {loading ? 'LOADING...' : `${filtered.length} EVENTS · ${lastUpdate}`}
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ── GLOBE ── */}
        <div className="flex-1 relative">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-t border-green-400 animate-spin" />
            </div>
          ) : (
            <Canvas camera={{ position: [0, 0, 6], fov: 45 }}>
              <Scene quakes={filtered} onSelect={handleSelect} selected={selected} bz={wind?.bz ?? 0} />
            </Canvas>
          )}

          {/* mag filter */}
          <div className="absolute bottom-6 left-6 flex flex-col gap-2">
            <span className="text-[9px] tracking-[0.3em] text-white/30 uppercase">MIN MAG</span>
            <div className="flex gap-1">
              {[2,3,4,5,6].map(m => (
                <button key={m} onClick={() => setMinMag(m)}
                  className="w-8 h-8 text-[10px] font-bold border transition-colors"
                  style={{
                    borderColor: minMag === m ? magColor(m) : 'rgba(255,255,255,0.1)',
                    color: minMag === m ? magColor(m) : 'rgba(255,255,255,0.3)',
                    backgroundColor: minMag === m ? `${magColor(m)}18` : 'transparent',
                  }}
                >{m}+</button>
              ))}
            </div>
          </div>

          {/* legend */}
          <div className="absolute bottom-6 right-6 flex flex-col gap-1.5">
            {[
              { label: 'M3–5 LIGHT', color: '#facc15', count: magCounts.light },
              { label: 'M5–6 MODERATE', color: '#fb923c', count: magCounts.moderate },
              { label: 'M6–7 STRONG', color: '#f87171', count: magCounts.strong },
              { label: 'M7+ MAJOR', color: '#e879f9', count: magCounts.major },
            ].map(({ label, color, count }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-[8px] text-white/30 tracking-wider">{label}</span>
                <span className="text-[8px] text-white/20 ml-1">{count}</span>
              </div>
            ))}
          </div>

          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[8px] text-white/15 tracking-widest pointer-events-none">
            CORRELATION ≠ CAUSATION · VISUAL EXPLORATION ONLY
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="w-72 shrink-0 border-l border-white/10 flex flex-col overflow-hidden">
          {/* tabs */}
          <div className="flex border-b border-white/10 shrink-0">
            {(['list', 'chart', 'solar'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="flex-1 py-3 text-[9px] tracking-[0.3em] uppercase transition-colors border-r border-white/5 last:border-r-0"
                style={{ color: tab === t ? 'white' : 'rgba(255,255,255,0.3)', borderBottom: tab === t ? '1px solid white' : 'none' }}
              >{t}</button>
            ))}
          </div>

          {tab === 'solar' ? (
            <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex flex-col">

              {/* Live Bz readout */}
              {wind && (
                <div className="px-5 py-4 border-b border-white/5">
                  <div className="text-[9px] tracking-[0.3em] text-white/30 uppercase mb-3">LIVE SOLAR WIND</div>
                  <div className="flex items-end justify-between mb-2">
                    <div className="text-3xl font-bold tabular-nums" style={{ color: bzColor }}>
                      {wind.bz > 0 ? '+' : ''}{wind.bz.toFixed(1)}
                      <span className="text-sm ml-1 font-normal text-white/30">nT Bz</span>
                    </div>
                    <div className="text-[9px] font-bold tracking-widest" style={{ color: bzColor }}>
                      {wind.bz < -10 ? '⚡ GEOEFFECTIVE' : wind.bz < -5 ? 'SOUTHWARD' : wind.bz < 0 ? 'WEAK-S' : 'NORTHWARD'}
                    </div>
                  </div>
                  <div className="relative h-1.5 bg-white/5 mb-1">
                    <div className="absolute top-0 h-full w-px bg-white/20" style={{ left: '50%' }} />
                    <div className="absolute top-0 h-full transition-all duration-1000"
                      style={{
                        width: `${Math.min(Math.abs(wind.bz) / 20 * 50, 50)}%`,
                        backgroundColor: bzColor,
                        left: wind.bz < 0 ? `${50 - Math.min(Math.abs(wind.bz) / 20 * 50, 50)}%` : '50%',
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[7px] text-white/15">
                    <span>−20 nT</span><span>0</span><span>+20 nT</span>
                  </div>
                </div>
              )}

              <div className="px-5 py-4 border-b border-white/5">
                <div className="text-[9px] tracking-[0.3em] text-white/30 uppercase mb-2">WHAT IS Bz?</div>
                <p className="text-[10px] text-white/40 leading-relaxed">
                  Bz is the north-south component of the interplanetary magnetic field (IMF). When Bz points <span className="text-white/60">southward (negative)</span>, it reconnects with Earth's magnetosphere — opening a channel for energy transfer from the solar wind.
                </p>
              </div>

              <div className="px-5 py-4 border-b border-white/5">
                <div className="text-[9px] tracking-[0.3em] text-white/30 uppercase mb-3">Bz SCALE</div>
                {[
                  { range: '> 0 nT',     label: 'NORTHWARD',   color: '#4ade80', desc: 'Magnetosphere closed. Minimal coupling.' },
                  { range: '0 to −5',    label: 'WEAK SOUTH',  color: '#facc15', desc: 'Slight coupling. Minor auroral activity.' },
                  { range: '−5 to −10',  label: 'SOUTHWARD',   color: '#fb923c', desc: 'Moderate coupling. G1–G2 storm possible.' },
                  { range: '< −10 nT',   label: 'GEOEFFECTIVE',color: '#f87171', desc: 'Strong coupling. G3+ storm. Wide aurora.' },
                ].map(({ range, label, color, desc }) => (
                  <div key={label} className="flex gap-3 py-2 border-b border-white/5 last:border-0">
                    <div className="w-1 shrink-0 mt-1 self-stretch rounded-full" style={{ backgroundColor: color }} />
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[9px] font-bold" style={{ color }}>{label}</span>
                        <span className="text-[8px] text-white/20">{range}</span>
                      </div>
                      <p className="text-[9px] text-white/30 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-5 py-4 border-b border-white/5">
                <div className="text-[9px] tracking-[0.3em] text-white/30 uppercase mb-2">THE HYPOTHESIS</div>
                <p className="text-[10px] text-white/40 leading-relaxed mb-3">
                  Some researchers propose that geomagnetic storms triggered by southward Bz may modulate stress in Earth's crust via electromagnetic induction in conductive rock — potentially influencing fault slip timing.
                </p>
                <p className="text-[10px] text-white/40 leading-relaxed">
                  Studies by Odintsov et al. (2006) and Han et al. (2004) found statistical correlations between Kp index peaks and increased seismicity within 1–3 days. The mechanism remains debated.
                </p>
              </div>

              <div className="px-5 py-4 border-b border-white/5">
                <div className="text-[9px] tracking-[0.3em] text-white/30 uppercase mb-3">WHAT TO LOOK FOR</div>
                {[
                  { n: '01', text: 'Bz drops below −10 nT for sustained periods (>1 hour)' },
                  { n: '02', text: 'Cluster of M5+ quakes within 24–72 hours of a geomagnetic storm' },
                  { n: '03', text: 'Quakes concentrated along subduction zones (Ring of Fire)' },
                  { n: '04', text: 'Shallow quakes (<70km) are more likely stress-related than deep ones' },
                ].map(({ n, text }) => (
                  <div key={n} className="flex gap-3 py-2 border-b border-white/5 last:border-0">
                    <span className="text-[8px] text-white/20 shrink-0 mt-0.5">{n}</span>
                    <p className="text-[9px] text-white/40 leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>

              <div className="px-5 py-4">
                <div className="text-[9px] tracking-[0.3em] text-white/20 uppercase mb-2">DISCLAIMER</div>
                <p className="text-[9px] text-white/20 leading-relaxed">
                  This correlation is <span className="text-white/35">not scientifically established</span>. No peer-reviewed consensus supports solar wind as a direct earthquake trigger. Visual exploration only.
                </p>
              </div>
            </div>
          ) : tab === 'chart' ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5">
                <div className="text-[9px] tracking-[0.3em] text-white/30 uppercase mb-1">MAGNITUDE TIMELINE — 7 DAYS</div>
                <div className="text-[8px] text-white/20">Each bar = one event. Height = magnitude.</div>
              </div>
              <div className="p-4 flex-1">
                <MagTimeline quakes={quakes} />
              </div>
              {wind && (
                <div className="px-4 py-4 border-t border-white/5">
                  <div className="text-[9px] tracking-[0.3em] text-white/30 uppercase mb-2">SOLAR WIND Bz</div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-white/40">Current</span>
                    <span className="text-sm font-bold" style={{ color: bzColor }}>{wind.bz > 0 ? '+' : ''}{wind.bz.toFixed(1)} nT</span>
                  </div>
                  <div className="h-1 bg-white/5 relative">
                    <div className="absolute top-0 h-full w-px bg-white/20" style={{ left: '50%' }} />
                    <div className="absolute top-0 h-full transition-all duration-1000"
                      style={{
                        width: `${Math.min(Math.abs(wind.bz) / 20 * 50, 50)}%`,
                        backgroundColor: bzColor,
                        left: wind.bz < 0 ? `${50 - Math.min(Math.abs(wind.bz) / 20 * 50, 50)}%` : '50%',
                      }}
                    />
                  </div>
                  <p className="text-[8px] text-white/20 mt-2 leading-relaxed">
                    {wind.bz < -10 ? 'Strong southward Bz — active magnetospheric coupling.' : wind.bz < -5 ? 'Moderate southward Bz.' : wind.bz < 0 ? 'Weak southward Bz.' : 'Northward Bz — closed magnetosphere.'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between shrink-0">
                <span className="text-[9px] tracking-[0.3em] text-white/30 uppercase">RECENT EVENTS</span>
                <span className="text-[9px] text-white/20">{filtered.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {[...filtered].sort((a, b) => b.time - a.time).slice(0, 60).map((q, i) => (
                  <motion.button key={q.id}
                    initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.015 }}
                    onClick={() => handleSelect(q)}
                    className="w-full text-left px-5 py-3 border-b border-white/5 hover:bg-white/[0.03] transition-colors"
                    style={{ backgroundColor: selected?.id === q.id ? `${magColor(q.mag)}08` : undefined }}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-bold" style={{ color: magColor(q.mag) }}>M{q.mag.toFixed(1)}</span>
                      <span className="text-[8px] text-white/20 tracking-wider">{magLabel(q.mag)}</span>
                    </div>
                    <div className="text-[10px] text-white/40 truncate">{q.place}</div>
                    <div className="text-[8px] text-white/20 mt-0.5">{new Date(q.time).toUTCString().slice(5, 22)} UTC · {q.depth.toFixed(0)}km</div>
                  </motion.button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── DETAIL PANEL ── */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ y: 200, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 200, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            className="absolute bottom-0 left-16 right-72 border-t border-white/10 bg-[#060606]/96 backdrop-blur-sm"
          >
            <div className="flex items-start gap-0 divide-x divide-white/5">
              {/* mag + location */}
              <div className="px-6 py-4 flex flex-col gap-1 min-w-[160px]">
                <div className="text-[9px] tracking-[0.3em] text-white/30 uppercase">MAGNITUDE</div>
                <div className="text-5xl font-bold tracking-tighter" style={{ color: magColor(selected.mag) }}>
                  M{selected.mag.toFixed(1)}
                </div>
                <div className="text-[9px] tracking-widest mt-1" style={{ color: magColor(selected.mag) }}>{magLabel(selected.mag)}</div>
              </div>
              {/* depth diagram */}
              <div className="px-6 py-4">
                <div className="text-[9px] tracking-[0.3em] text-white/30 uppercase mb-3">DEPTH</div>
                <DepthDiagram quake={selected} />
              </div>
              {/* waveform */}
              <div className="px-6 py-4 flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[9px] tracking-[0.3em] text-white/30 uppercase">SYNTHETIC SEISMOGRAM</div>
                  <button onClick={() => { setWavePlay(true); if (soundOn) playQuakeSound(selected.mag); setTimeout(() => setWavePlay(false), 3500); }}
                    className="text-[8px] tracking-widest text-white/30 hover:text-white/70 transition-colors uppercase">
                    ▶ REPLAY
                  </button>
                </div>
                <div className="h-[100px]">
                  <Seismograph quake={selected} playing={wavePlay} />
                </div>
                <div className="flex gap-4 mt-1">
                  {[['P-WAVE', 'Primary compression wave'], ['S-WAVE', 'Secondary shear wave'], ['SURFACE', 'Love & Rayleigh waves']].map(([k, v]) => (
                    <div key={k} className="flex flex-col">
                      <span className="text-[8px] font-bold text-white/40">{k}</span>
                      <span className="text-[7px] text-white/20">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* coords + time */}
              <div className="px-6 py-4 flex flex-col gap-3 min-w-[180px]">
                <div>
                  <div className="text-[9px] tracking-[0.3em] text-white/30 uppercase mb-1">LOCATION</div>
                  <div className="text-xs text-white/60 leading-relaxed">{selected.place}</div>
                  <div className="text-[9px] text-white/30 mt-1">{selected.lat.toFixed(3)}°, {selected.lon.toFixed(3)}°</div>
                </div>
                <div>
                  <div className="text-[9px] tracking-[0.3em] text-white/30 uppercase mb-1">TIME</div>
                  <div className="text-[10px] text-white/50">{new Date(selected.time).toUTCString().slice(5, 25)} UTC</div>
                </div>
              </div>
              <button onClick={() => setSelected(null)}
                className="px-4 py-4 text-white/20 hover:text-white/60 transition-colors self-start text-xs">✕</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
