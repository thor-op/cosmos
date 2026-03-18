'use client';

import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, Line } from '@react-three/drei';
import { Suspense, useEffect, useState, useRef, useMemo } from 'react';
import { CountUp } from './CountUp';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, addDays, subDays } from 'date-fns';

interface Asteroid {
  id: string;
  name: string;
  isHazardous: boolean;
  missDistanceLD: number;
  missDistanceKM: number;
  velocityKMH: number;
  diameterMin: number;
  diameterMax: number;
  diameterAvg: number;
  dangerScore: number;
  orbitAngle: number; // Random angle for visualization
  orbitRadius: number; // Based on miss distance
}

function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return function() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function AsteroidMesh({ id, size, isHazardous, isSelected }: { id: string, size: number, isHazardous: boolean, isSelected: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const geometry = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const pos = geo.attributes.position;
    const random = seededRandom(id);
    
    for (let i = 0; i < pos.count; i++) {
      const vertex = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
      vertex.normalize();
      const displacement = 0.8 + random() * 0.4;
      vertex.multiplyScalar(displacement);
      pos.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    geo.computeVertexNormals();
    return geo;
  }, [id]);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.x += 0.005;
      meshRef.current.rotation.y += 0.005;
    }
  });

  const scale = Math.max(0.2, Math.min(2, size / 60));

  return (
    <mesh ref={meshRef} geometry={geometry} scale={scale}>
      <meshStandardMaterial 
        color={isHazardous ? (isSelected ? '#FCD34D' : '#F59E0B') : (isSelected ? '#9CA3AF' : '#4B5563')} 
        roughness={0.9} 
        metalness={0.1} 
        flatShading={true}
      />
      {isSelected && (
        <mesh>
          <icosahedronGeometry args={[1.2, 1]} />
          <meshBasicMaterial color="#FFFFFF" wireframe={true} transparent opacity={0.3} />
        </mesh>
      )}
    </mesh>
  );
}

function OrbitingAsteroid({ ast, isSelected }: { ast: Asteroid, isSelected: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  
  const points = useMemo(() => {
    const pts = [];
    // Logarithmic scale for orbit radius to keep it visible
    const radius = 3 + Math.log10(ast.missDistanceLD + 1) * 15;
    const random = seededRandom(ast.id)();
    const yOffset = (random - 0.5) * (radius * 0.5);
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      pts.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        yOffset,
        Math.sin(angle) * (radius * 0.8)
      ));
    }
    return pts;
  }, [ast]);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      const time = clock.getElapsedTime();
      const speed = ast.velocityKMH / 40000; 
      const currentAngle = ast.orbitAngle + time * speed;
      
      const radius = 3 + Math.log10(ast.missDistanceLD + 1) * 15;
      const random = seededRandom(ast.id)();
      const yOffset = (random - 0.5) * (radius * 0.5);
      
      groupRef.current.position.x = Math.cos(currentAngle) * radius;
      groupRef.current.position.y = yOffset;
      groupRef.current.position.z = Math.sin(currentAngle) * (radius * 0.8);
    }
  });

  return (
    <group>
      {isSelected && (
        <Line points={points} color="rgba(255, 255, 255, 0.2)" lineWidth={1} />
      )}
      <group ref={groupRef}>
        <AsteroidMesh id={ast.id} size={ast.diameterAvg} isHazardous={ast.isHazardous} isSelected={isSelected} />
      </group>
    </group>
  );
}

function AsteroidSystem({ asteroids, selectedId }: { asteroids: Asteroid[], selectedId: string | null }) {
  return (
    <group>
      {/* Earth */}
      <Sphere args={[1, 32, 32]}>
        <meshStandardMaterial color="#4FC3F7" roughness={0.8} metalness={0.2} />
      </Sphere>
      {/* Earth Atmosphere */}
      <mesh>
        <sphereGeometry args={[1.1, 32, 32]} />
        <meshBasicMaterial color="#4FC3F7" transparent opacity={0.1} blending={THREE.AdditiveBlending} />
      </mesh>
      
      {asteroids.map(ast => (
        <OrbitingAsteroid key={ast.id} ast={ast} isSelected={selectedId === ast.id} />
      ))}
    </group>
  );
}

export function NeoTracker() {
  const [asteroids, setAsteroids] = useState<Asteroid[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [filter, setFilter] = useState<'all' | 'hazardous' | 'close'>('all');
  const [sort, setSort] = useState<'danger' | 'distance' | 'velocity' | 'size'>('danger');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setStartDate(new Date());
  }, []);

  useEffect(() => {
    if (!startDate) return;

    async function fetchNeo() {
      setLoading(true);
      try {
        const startStr = format(startDate!, 'yyyy-MM-dd');
        const endStr = format(addDays(startDate!, 7), 'yyyy-MM-dd');
        const apiKey = process.env.NEXT_PUBLIC_NASA_API_KEY;
        
        const res = await fetch(`https://api.nasa.gov/neo/rest/v1/feed?start_date=${startStr}&end_date=${endStr}&api_key=${apiKey}`);
        
        if (!res.ok) {
          throw new Error(`NEO API returned ${res.status}`);
        }
        
        const data = await res.json();
        
        const parsedAsteroids: Asteroid[] = [];
        
        if (data && data.near_earth_objects) {
          Object.keys(data.near_earth_objects).forEach(date => {
            data.near_earth_objects[date].forEach((neo: any) => {
              const missDistanceLD = parseFloat(neo.close_approach_data[0].miss_distance.lunar);
              const missDistanceKM = parseFloat(neo.close_approach_data[0].miss_distance.kilometers);
              const velocityKMH = parseFloat(neo.close_approach_data[0].relative_velocity.kilometers_per_hour);
              const diameterMin = neo.estimated_diameter.meters.estimated_diameter_min;
              const diameterMax = neo.estimated_diameter.meters.estimated_diameter_max;
              const diameterAvg = (diameterMin + diameterMax) / 2;
              const isHazardous = neo.is_potentially_hazardous_asteroid;

              // Danger score formula
              let score = 0;
              if (missDistanceLD < 20) score += (20 - missDistanceLD) * 2; // closer = higher
              score += velocityKMH / 5000; // bonus for velocity
              score += diameterAvg / 50; // bonus for size
              if (isHazardous) score *= 1.4;
              score = Math.min(99, Math.max(1, score));

              parsedAsteroids.push({
                id: neo.id,
                name: neo.name.replace(/[()]/g, ''),
                isHazardous,
                missDistanceLD,
                missDistanceKM,
                velocityKMH,
                diameterMin,
                diameterMax,
                diameterAvg,
                dangerScore: score,
                orbitAngle: Math.random() * Math.PI * 2,
                orbitRadius: Math.max(50, missDistanceLD * 5), // Scale for visualization
              });
            });
          });
        }

        setAsteroids(parsedAsteroids);
      } catch (error) {
        console.error('Failed to fetch NEO data', error);
        // Fallback mock data
        const mockAsteroids: Asteroid[] = Array.from({ length: 15 }).map((_, i) => {
          const isHazardous = Math.random() > 0.8;
          const missDistanceLD = 5 + Math.random() * 50;
          const velocityKMH = 10000 + Math.random() * 50000;
          const diameterAvg = 10 + Math.random() * 500;
          
          let score = 0;
          if (missDistanceLD < 20) score += (20 - missDistanceLD) * 2;
          score += velocityKMH / 5000;
          score += diameterAvg / 50;
          if (isHazardous) score *= 1.4;
          score = Math.min(99, Math.max(1, score));

          return {
            id: `mock-${i}`,
            name: `2026 XX${i}`,
            isHazardous,
            missDistanceLD,
            missDistanceKM: missDistanceLD * 384400,
            velocityKMH,
            diameterMin: diameterAvg * 0.8,
            diameterMax: diameterAvg * 1.2,
            diameterAvg,
            dangerScore: score,
            orbitAngle: Math.random() * Math.PI * 2,
            orbitRadius: Math.max(50, missDistanceLD * 5),
          };
        });
        setAsteroids(mockAsteroids);
      } finally {
        setLoading(false);
      }
    }

    fetchNeo();
  }, [startDate]);

  const filteredAsteroids = useMemo(() => {
    let result = asteroids;
    if (filter === 'hazardous') result = result.filter(a => a.isHazardous);
    if (filter === 'close') result = result.filter(a => a.missDistanceLD < 10);
    
    return result.sort((a, b) => {
      if (sort === 'danger') return b.dangerScore - a.dangerScore;
      if (sort === 'distance') return a.missDistanceLD - b.missDistanceLD;
      if (sort === 'velocity') return b.velocityKMH - a.velocityKMH;
      if (sort === 'size') return b.diameterAvg - a.diameterAvg;
      return 0;
    });
  }, [asteroids, filter, sort]);

  const totalCount = asteroids.length;
  const hazardousCount = asteroids.filter(a => a.isHazardous).length;
  const closest = asteroids.length > 0 ? Math.min(...asteroids.map(a => a.missDistanceKM)) : 0;
  const fastest = asteroids.length > 0 ? Math.max(...asteroids.map(a => a.velocityKMH)) : 0;

  return (
    <div className="w-full h-full flex flex-col relative">
      {/* Summary Bar */}
      <div className="h-16 border-b border-white/10 flex items-center justify-between px-8 bg-[#080808]/80 backdrop-blur-md z-10">
        <div className="flex gap-8 text-xs font-mono">
          <div className="flex flex-col">
            <span className="text-white/40 uppercase tracking-widest">TOTAL</span>
            <span className="text-lg"><CountUp value={totalCount} /></span>
          </div>
          <div className="flex flex-col">
            <span className="text-[var(--color-neo)]/60 uppercase tracking-widest">HAZARDOUS</span>
            <span className="text-lg text-[var(--color-neo)]"><CountUp value={hazardousCount} /></span>
          </div>
          <div className="flex flex-col hidden md:flex">
            <span className="text-white/40 uppercase tracking-widest">CLOSEST (KM)</span>
            <span className="text-lg"><CountUp value={closest} /></span>
          </div>
          <div className="flex flex-col hidden md:flex">
            <span className="text-white/40 uppercase tracking-widest">FASTEST (KM/H)</span>
            <span className="text-lg"><CountUp value={fastest} /></span>
          </div>
        </div>
        
        <div className="flex gap-4 items-center">
          <button 
            onClick={() => startDate && setStartDate(subDays(startDate, 7))}
            className="text-white/40 hover:text-white transition-colors text-xs font-mono"
            disabled={!startDate}
          >
            ← PREV
          </button>
          <span className="text-xs font-mono tracking-widest">
            {startDate ? `${format(startDate, 'MMM dd')} - ${format(addDays(startDate, 7), 'MMM dd')}` : 'LOADING...'}
          </span>
          <button 
            onClick={() => startDate && setStartDate(addDays(startDate, 7))}
            className="text-white/40 hover:text-white transition-colors text-xs font-mono"
            disabled={!startDate}
          >
            NEXT →
          </button>
        </div>
      </div>

      {/* Orbital Map */}
      <div className="flex-1 min-h-[40vh] relative border-b border-white/10">
        <Canvas camera={{ position: [0, 25, 40], fov: 45 }}>
          <ambientLight intensity={0.1} />
          <directionalLight position={[10, 10, 10]} intensity={2} />
          <Suspense fallback={null}>
            <AsteroidSystem asteroids={filteredAsteroids} selectedId={selectedId} />
          </Suspense>
          <OrbitControls enablePan={false} minDistance={5} maxDistance={100} />
        </Canvas>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#080808]/50 backdrop-blur-sm z-10">
            <div className="w-8 h-8 rounded-full border-t-2 border-[var(--color-neo)] animate-spin" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="h-12 border-b border-white/5 flex items-center px-8 gap-8 text-xs font-mono text-white/40 overflow-x-auto">
        <div className="flex gap-4 items-center">
          <span className="uppercase tracking-widest">FILTER:</span>
          {['all', 'hazardous', 'close'].map(f => (
            <button 
              key={f} 
              onClick={() => setFilter(f as any)}
              className={twMerge("uppercase tracking-widest transition-colors", filter === f ? "text-white" : "hover:text-white/70")}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="w-[1px] h-4 bg-white/10" />
        <div className="flex gap-4 items-center">
          <span className="uppercase tracking-widest">SORT:</span>
          {['danger', 'distance', 'velocity', 'size'].map(s => (
            <button 
              key={s} 
              onClick={() => setSort(s as any)}
              className={twMerge("uppercase tracking-widest transition-colors", sort === s ? "text-white" : "hover:text-white/70")}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Asteroid List */}
      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-8 py-4 text-[10px] font-mono text-white/30 uppercase tracking-widest sticky top-0 bg-[#080808] z-10 border-b border-white/5">
          <div>NAME</div>
          <div className="text-right">DISTANCE (LD)</div>
          <div className="text-right">VELOCITY (KM/H)</div>
          <div className="text-right">SIZE (M)</div>
          <div className="text-right">DANGER</div>
        </div>
        
        {filteredAsteroids.map(ast => (
          <div 
            key={ast.id}
            onClick={() => setSelectedId(ast.id)}
            className={twMerge(
              "grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-8 py-4 border-b border-white/5 cursor-pointer transition-colors duration-200 hover:bg-white/5 items-center",
              selectedId === ast.id ? "bg-white/5" : "",
              ast.isHazardous ? "border-l-2 border-l-[var(--color-neo)]" : "border-l-2 border-l-transparent"
            )}
          >
            <div className="font-mono text-sm truncate pr-4">{ast.name}</div>
            <div className="font-mono text-sm text-right text-white/70">{ast.missDistanceLD.toFixed(2)}</div>
            <div className="font-mono text-sm text-right text-white/70">{Math.round(ast.velocityKMH).toLocaleString()}</div>
            <div className="font-mono text-sm text-right text-white/70">{Math.round(ast.diameterAvg)}</div>
            <div className="flex items-center justify-end gap-2">
              <span className={twMerge("font-mono text-sm", ast.isHazardous ? "text-[var(--color-neo)]" : "text-white/70")}>
                {Math.round(ast.dangerScore)}
              </span>
              <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className={twMerge("h-full", ast.isHazardous ? "bg-[var(--color-neo)]" : "bg-white/30")}
                  style={{ width: `${ast.dangerScore}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
