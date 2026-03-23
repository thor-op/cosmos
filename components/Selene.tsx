'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';

/* ══════════════════════════════════════════════
   CONSTANTS & DATA
══════════════════════════════════════════════ */
const KM_PER_AU = 149597870.7;
const MOON_DIST_KM = 384400;

const TEXTURE_URLS = {
  color: '/api/moon-texture?type=color',
  bump:  '/api/moon-texture?type=bump',
};

/* ─── Landing sites ─── */
interface LandingSite {
  name: string; lat: number; lon: number; year: number;
  type: 'apollo' | 'luna' | 'change' | 'india' | 'japan' | 'surveyor';
  crew: string | null; rover?: string; color: string;
  detail?: string;
}

const LANDING_SITES: LandingSite[] = [
  { name:'Apollo 11', lat:0.6741,  lon:23.4733,   year:1969, type:'apollo',   crew:'Armstrong, Aldrin, Collins',    color:'#4FC3F7', detail:'First humans on the Moon. Sea of Tranquility. July 20, 1969 · 20:17 UTC. Surface time: 21h 36m. Samples: 21.55 kg.' },
  { name:'Apollo 12', lat:-3.0128, lon:-23.4219,  year:1969, type:'apollo',   crew:'Conrad, Bean, Gordon',          color:'#4FC3F7', detail:'Ocean of Storms. Landed 183m from Surveyor 3. Surface time: 31h 31m. Samples: 34.35 kg.' },
  { name:'Apollo 14', lat:-3.6453, lon:-17.4714,  year:1971, type:'apollo',   crew:'Shepard, Mitchell, Roosa',      color:'#4FC3F7', detail:'Fra Mauro highlands. Alan Shepard hit two golf balls. Surface time: 33h 31m. Samples: 42.28 kg.' },
  { name:'Apollo 15', lat:26.1322, lon:3.6339,    year:1971, type:'apollo',   crew:'Scott, Irwin, Worden',          color:'#4FC3F7', detail:'Hadley-Apennine. First use of Lunar Roving Vehicle. Surface time: 66h 55m. Samples: 77.31 kg.' },
  { name:'Apollo 16', lat:-8.9734, lon:15.5011,   year:1972, type:'apollo',   crew:'Young, Duke, Mattingly',        color:'#4FC3F7', detail:'Descartes Highlands. First landing in highlands. Surface time: 71h 2m. Samples: 95.71 kg.' },
  { name:'Apollo 17', lat:20.1908, lon:30.7717,   year:1972, type:'apollo',   crew:'Cernan, Schmitt, Evans',        color:'#4FC3F7', detail:'Taurus-Littrow valley. Last humans on the Moon. December 14, 1972. Surface time: 74h 59m. Samples: 110.52 kg.' },
  { name:'Luna 9',    lat:7.08,    lon:-64.37,    year:1966, type:'luna',     crew:null,                            color:'#EF5350', detail:'First spacecraft to achieve soft landing on Moon. Feb 3, 1966. Transmitted photos for 3 days.' },
  { name:'Luna 16',   lat:-0.68,   lon:56.30,     year:1970, type:'luna',     crew:null,                            color:'#EF5350', detail:'First robotic sample return. Sea of Fertility. Returned 101g of lunar soil.' },
  { name:'Luna 17',   lat:38.28,   lon:-35.00,    year:1970, type:'luna',     crew:null, rover:'Lunokhod 1',        color:'#EF5350', detail:'Deployed Lunokhod 1 — first remote-controlled rover on another world. Operated 10 months.' },
  { name:'Luna 20',   lat:3.53,    lon:56.55,     year:1972, type:'luna',     crew:null,                            color:'#EF5350', detail:'Sample return from Apollonius highlands. Returned 55g of soil.' },
  { name:'Luna 21',   lat:25.85,   lon:30.45,     year:1973, type:'luna',     crew:null, rover:'Lunokhod 2',        color:'#EF5350', detail:'Deployed Lunokhod 2. Traveled 39km — record for extraterrestrial rover until Opportunity (2014).' },
  { name:'Luna 24',   lat:12.25,   lon:62.20,     year:1976, type:'luna',     crew:null,                            color:'#EF5350', detail:'Last Soviet lunar mission. Returned 170g of soil from Mare Crisium.' },
  { name:"Chang'e 3", lat:44.12,   lon:19.51,     year:2013, type:'change',   crew:null, rover:'Yutu',              color:'#FF7043', detail:"China's first lunar landing. Mare Imbrium. Deployed Yutu rover. Dec 14, 2013." },
  { name:"Chang'e 4", lat:-45.46,  lon:177.60,    year:2019, type:'change',   crew:null, rover:"Yutu-2 (FAR SIDE)", color:'#FF7043', detail:"First ever far side landing. Von Kármán crater. Jan 3, 2019. Yutu-2 still operational." },
  { name:"Chang'e 5", lat:43.06,   lon:51.92,     year:2020, type:'change',   crew:null,                            color:'#FF7043', detail:"Sample return mission. Returned 1.731 kg of lunar material. Dec 2020." },
  { name:"Chang'e 6", lat:-41.64,  lon:-153.99,   year:2024, type:'change',   crew:null,                            color:'#FF7043', detail:"First far side sample return. Apollo crater, South Pole-Aitken Basin. June 2024." },
  { name:'Chandrayaan-3', lat:-69.37, lon:32.32,  year:2023, type:'india',    crew:null, rover:'Pragyan',           color:'#FF8F00', detail:"India's first successful lunar landing. First mission near south pole. Aug 23, 2023. Pragyan operated 14 days." },
  { name:'SLIM',      lat:-13.32,  lon:25.22,     year:2024, type:'japan',    crew:null,                            color:'#CE93D8', detail:"Japan's Smart Lander for Investigating Moon. Jan 19, 2024. Precision landing within 55m of target." },
  { name:'Surveyor 1',lat:-2.47,   lon:-43.34,    year:1966, type:'surveyor', crew:null,                            color:'#80CBC4', detail:'First US soft landing. Oceanus Procellarum. June 2, 1966. Transmitted 11,237 photos.' },
  { name:'Surveyor 3',lat:-3.02,   lon:-23.42,    year:1967, type:'surveyor', crew:null,                            color:'#80CBC4', detail:'Apollo 12 landed 183m away. Parts retrieved by astronauts and returned to Earth.' },
  { name:'Surveyor 5',lat:1.41,    lon:23.18,     year:1967, type:'surveyor', crew:null,                            color:'#80CBC4', detail:'Sea of Tranquility. First chemical analysis of lunar soil.' },
  { name:'Surveyor 6',lat:0.49,    lon:-1.40,     year:1967, type:'surveyor', crew:null,                            color:'#80CBC4', detail:'Sinus Medii. First spacecraft to lift off from lunar surface (brief hop).' },
  { name:'Surveyor 7',lat:-40.86,  lon:-11.47,    year:1968, type:'surveyor', crew:null,                            color:'#80CBC4', detail:'Near Tycho crater. Only Surveyor to land in highlands. Last of the Surveyor program.' },
];

const TYPE_FLAG: Record<string, string> = {
  apollo:   '🇺🇸',
  luna:     '🇷🇺',
  change:   '🇨🇳',
  india:    '🇮🇳',
  japan:    '🇯🇵',
  surveyor: '🇺🇸',
};
const MAJOR_CRATERS = [
  { name:'Tycho',       lat:-43.3, lon:-11.2, diam:85  },
  { name:'Copernicus',  lat:9.7,   lon:-20.1, diam:93  },
  { name:'Plato',       lat:51.6,  lon:-9.4,  diam:101 },
  { name:'Clavius',     lat:-58.4, lon:-14.1, diam:225 },
  { name:'Aristarchus', lat:23.7,  lon:-47.4, diam:40  },
  { name:'Kepler',      lat:8.1,   lon:-38.0, diam:32  },
  { name:'Grimaldi',    lat:-5.5,  lon:-68.3, diam:173 },
  { name:'Schickard',   lat:-44.4, lon:-54.6, diam:227 },
  { name:'Petavius',    lat:-25.1, lon:60.4,  diam:177 },
  { name:'Langrenus',   lat:-8.9,  lon:61.1,  diam:132 },
  { name:'Theophilus',  lat:-11.4, lon:26.4,  diam:110 },
  { name:'Albategnius', lat:-11.2, lon:4.1,   diam:129 },
  { name:'Ptolemaeus',  lat:-9.3,  lon:-1.8,  diam:153 },
  { name:'Alphonsus',   lat:-13.4, lon:-2.8,  diam:119 },
  { name:'Arzachel',    lat:-18.2, lon:-1.9,  diam:97  },
  { name:'Maginus',     lat:-50.5, lon:-6.3,  diam:194 },
  { name:'Longomontanus',lat:-49.6,lon:-21.8, diam:157 },
  { name:'Schiller',    lat:-51.9, lon:-39.0, diam:180 },
  { name:'Bailly',      lat:-66.5, lon:-69.1, diam:287 },
  { name:'Shackleton',  lat:-89.5, lon:0.0,   diam:21  },
];

/* ─── Artemis zones ─── */
const ARTEMIS_ZONES = [
  { name:'Faustini Rim A',        lat:-87.0, lon:75.0  },
  { name:'Peak Near Shackleton',  lat:-89.7, lon:166.5 },
  { name:'Connecting Ridge',      lat:-89.3, lon:188.6 },
  { name:'Haworth',               lat:-87.5, lon:0.0   },
  { name:'Malapert Massif',       lat:-86.0, lon:0.0   },
  { name:'Leibnitz Beta Plateau', lat:-85.0, lon:37.0  },
  { name:'Nobile Rim 1',          lat:-85.2, lon:52.0  },
  { name:'Nobile Rim 2',          lat:-84.7, lon:35.0  },
];

/* ─── Water ice deposits ─── */
const ICE_DEPOSITS = [
  { lat:87.5,  lon:0,   certainty:'MODERATE' },
  { lat:88.2,  lon:90,  certainty:'MODERATE' },
  { lat:86.8,  lon:180, certainty:'MODERATE' },
  { lat:87.1,  lon:270, certainty:'MODERATE' },
  { lat:-84.9, lon:0,   certainty:'CONFIRMED' },
  { lat:-85.7, lon:45,  certainty:'CONFIRMED' },
  { lat:-86.2, lon:90,  certainty:'CONFIRMED' },
  { lat:-87.0, lon:135, certainty:'CONFIRMED' },
  { lat:-85.5, lon:180, certainty:'CONFIRMED' },
  { lat:-86.8, lon:225, certainty:'CONFIRMED' },
  { lat:-84.3, lon:270, certainty:'CONFIRMED' },
  { lat:-85.9, lon:315, certainty:'CONFIRMED' },
  { lat:-89.54,lon:0,   certainty:'HIGH'      },
];

/* ══════════════════════════════════════════════
   MATH HELPERS
══════════════════════════════════════════════ */
// Standard Three.js spherical → cartesian
// lon=0 faces +Z (toward camera), lon=90 faces +X
// This matches Three.js SphereGeometry UV mapping
function latLonToVec3(lat: number, lon: number, r = 1.0): THREE.Vector3 {
  const phi   = (90 - lat) * Math.PI / 180;   // polar angle from +Y
  const theta = (lon + 90) * Math.PI / 180;   // azimuth — +90 so lon=0 faces camera (+Z)
  return new THREE.Vector3(
     r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  );
}

function getMoonPhase(date: Date) {
  const knownNew = new Date('2000-01-06T18:14:00Z');
  const synodicPeriod = 29.530588853;
  const daysSince = (date.getTime() - knownNew.getTime()) / 86400000;
  const phase = ((daysSince % synodicPeriod) + synodicPeriod) % synodicPeriod;
  const illumination = (1 - Math.cos(phase / synodicPeriod * Math.PI * 2)) / 2;
  return { phase, illumination, age: phase, synodicPeriod };
}

function phaseName(phase: number): string {
  const p = phase / 29.530588853;
  if (p < 0.025 || p > 0.975) return 'New Moon';
  if (p < 0.25)  return 'Waxing Crescent';
  if (p < 0.275) return 'First Quarter';
  if (p < 0.475) return 'Waxing Gibbous';
  if (p < 0.525) return 'Full Moon';
  if (p < 0.725) return 'Waning Gibbous';
  if (p < 0.775) return 'Last Quarter';
  return 'Waning Crescent';
}

function getNextPhase(date: Date, targetFrac: number): Date {
  const { phase } = getMoonPhase(date);
  const synodicPeriod = 29.530588853;
  const target = targetFrac * synodicPeriod;
  let daysUntil = target - phase;
  if (daysUntil <= 0) daysUntil += synodicPeriod;
  return new Date(date.getTime() + daysUntil * 86400000);
}

function getSunDirection(date: Date): THREE.Vector3 {
  const daysSinceJ2000 = (date.getTime() - new Date('2000-01-01T12:00:00Z').getTime()) / 86400000;
  const meanLon  = (280.460 + 0.9856474 * daysSinceJ2000) % 360;
  const meanAnom = (357.528 + 0.9856003 * daysSinceJ2000) % 360;
  const M = meanAnom * Math.PI / 180;
  const eclLon = (meanLon + 1.915 * Math.sin(M) + 0.020 * Math.sin(2 * M)) * Math.PI / 180;
  // Match latLonToVec3 convention: lon=0 → +Z, lon=90 → +X
  const sunLon = eclLon + Math.PI / 2;
  return new THREE.Vector3(Math.cos(sunLon), 0, Math.sin(sunLon)).normalize();
}

function getLibration(date: Date) {
  const d = (date.getTime() - new Date('2000-01-01').getTime()) / 86400000;
  return {
    lon: 7.9 * Math.sin(d * 2 * Math.PI / 27.321) * Math.PI / 180,
    lat: 6.7 * Math.sin(d * 2 * Math.PI / 27.212) * Math.PI / 180,
  };
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

function daysUntil(d: Date, now: Date): number {
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

/* ══════════════════════════════════════════════
   PHASE DISC SVG
══════════════════════════════════════════════ */
function PhaseDisc({ illumination, phase, size = 40 }: { illumination: number; phase: number; size?: number }) {
  const r = size / 2 - 2;
  const cx = size / 2, cy = size / 2;
  const waxing = phase < 14.765;
  // Terminator x offset: -r (new) → 0 (quarter) → +r (full)
  const offset = r * Math.cos(phase / 29.530588853 * Math.PI * 2);
  const rx = Math.abs(offset);
  const sweep = offset >= 0 ? 1 : 0;
  const litSweep = waxing ? 0 : 1;
  const d = `M ${cx} ${cy - r} A ${r} ${r} 0 1 ${litSweep} ${cx} ${cy + r} A ${rx} ${r} 0 1 ${sweep} ${cx} ${cy - r} Z`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="#111" stroke="rgba(255,255,255,0.1)" strokeWidth={0.5} />
      <path d={d} fill="#e8d5a0" opacity={0.9} />
    </svg>
  );
}

/* ══════════════════════════════════════════════
   THREE.JS SCENE COMPONENTS
══════════════════════════════════════════════ */

/* ─── Starfield ─── */
function Starfield() {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array(10000 * 3);
    const sizes = new Float32Array(10000);
    for (let i = 0; i < 10000; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      positions[i * 3]     = 90 * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = 90 * Math.cos(phi);
      positions[i * 3 + 2] = 90 * Math.sin(phi) * Math.sin(theta);
      sizes[i] = Math.random() * 0.4 + 0.1;
    }
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    return g;
  }, []);

  return (
    <points geometry={geo}>
      <pointsMaterial color="#ffffff" size={0.3} sizeAttenuation transparent opacity={0.7} />
    </points>
  );
}

/* ─── Moon mesh ─── */
function MoonMesh({ sunDir, currentDate }: {
  sunDir: THREE.Vector3;
  currentDate: Date;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef  = useRef<THREE.MeshLambertMaterial>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    let colorTex: THREE.Texture | null = null;
    let bumpTex:  THREE.Texture | null = null;

    const tryApply = () => {
      if (!matRef.current || !colorTex) return;
      colorTex.colorSpace = THREE.SRGBColorSpace;
      matRef.current.map = colorTex;
      if (bumpTex) matRef.current.bumpMap = bumpTex;
      matRef.current.color.set(0xffffff);
      matRef.current.needsUpdate = true;
      setLoaded(true);
    };

    loader.load(
      TEXTURE_URLS.color,
      (t) => { colorTex = t; tryApply(); },
      undefined,
      () => {
        // NASA failed — try unpkg directly
        loader.load('https://unpkg.com/three-globe/example/img/moon_surface.jpg', (t) => {
          colorTex = t; tryApply();
        });
      }
    );

    loader.load(TEXTURE_URLS.bump, (t) => { bumpTex = t; tryApply(); });
  }, []);

  useFrame(() => {
    if (!meshRef.current) return;
    const lib = getLibration(currentDate);
    meshRef.current.rotation.y = lib.lon;
    meshRef.current.rotation.x = lib.lat;
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 128, 128]} />
      <meshLambertMaterial ref={matRef} color={loaded ? 0xffffff : 0x888888} />
    </mesh>
  );
}

/* ─── Terminator line ─── */
function Terminator({ sunDir }: { sunDir: THREE.Vector3 }) {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const perp1 = new THREE.Vector3(0, 1, 0);
    if (Math.abs(sunDir.dot(perp1)) > 0.9) perp1.set(1, 0, 0);
    const t1 = new THREE.Vector3().crossVectors(sunDir, perp1).normalize();
    const t2 = new THREE.Vector3().crossVectors(sunDir, t1).normalize();
    for (let i = 0; i <= 128; i++) {
      const angle = (i / 128) * Math.PI * 2;
      const pt = new THREE.Vector3()
        .addScaledVector(t1, Math.cos(angle))
        .addScaledVector(t2, Math.sin(angle))
        .multiplyScalar(1.002);
      pts.push(pt);
    }
    return pts;
  }, [sunDir]);

  const geo = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);
  const lineObj = useMemo(() =>
    new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 })),
  [geo]);

  return <primitive object={lineObj} />;
}

/* ─── Landing site markers ─── */
function LandingMarkers({ sites, cameraZ, onSelect, selectedSite, currentDate }: {
  sites: LandingSite[];
  cameraZ: number;
  onSelect: (s: LandingSite | null) => void;
  selectedSite: LandingSite | null;
  currentDate: Date;
}) {
  const currentYear = currentDate.getFullYear();
  const [pulse, setPulse] = useState(1.0);

  useFrame(({ clock }) => {
    setPulse(0.75 + 0.25 * Math.sin(clock.getElapsedTime() * 2.5));
  });

  return (
    <>
      {sites.map(site => {
        if (site.year > currentYear) return null;
        const pos = latLonToVec3(site.lat, site.lon, 1.012);
        const isSelected = selectedSite?.name === site.name;
        const baseSize = site.type === 'apollo' ? 0.028 : 0.022;
        const size = isSelected ? baseSize * 1.8 : baseSize * pulse;

        return (
          <mesh
            key={site.name}
            position={pos}
            onClick={(e) => { e.stopPropagation(); onSelect(isSelected ? null : site); }}
          >
            <sphereGeometry args={[size, 8, 8]} />
            <meshBasicMaterial
              color={isSelected ? '#ffffff' : site.color}
              transparent
              opacity={isSelected ? 1 : 0.92}
            />
          </mesh>
        );
      })}
    </>
  );
}

/* ─── Ice deposit markers ─── */
function IceMarkers({ visible }: { visible: boolean }) {
  const [pulse, setPulse] = useState(0.7);
  useFrame(({ clock }) => {
    setPulse(0.5 + 0.4 * Math.sin(clock.getElapsedTime() * 1.2));
  });
  if (!visible) return null;
  return (
    <>
      {ICE_DEPOSITS.map((ice, i) => {
        const pos = latLonToVec3(ice.lat, ice.lon, 1.008);
        return (
          <mesh key={i} position={pos}>
            <sphereGeometry args={[0.022, 8, 8]} />
            <meshBasicMaterial color="#88ccff" transparent opacity={pulse} />
          </mesh>
        );
      })}
    </>
  );
}

/* ─── Artemis zone markers ─── */
function ArtemisMarkers({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <>
      {ARTEMIS_ZONES.map((zone, i) => {
        const pos = latLonToVec3(zone.lat, zone.lon, 1.009);
        return (
          <mesh key={i} position={pos}>
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshBasicMaterial color="#FF7043" transparent opacity={0.75} />
          </mesh>
        );
      })}
    </>
  );
}

/* ─── Crater rings ─── */
function CraterRings({ visible, cameraZ }: { visible: boolean; cameraZ: number }) {
  const opacity = visible ? Math.max(0, Math.min(0.35, (3.5 - cameraZ) * 0.2)) : 0;
  if (opacity <= 0) return null;

  return (
    <>
      {MAJOR_CRATERS.map(crater => {
        const center = latLonToVec3(crater.lat, crater.lon, 1.003);
        // Angular radius of crater on unit sphere
        const angRad = (crater.diam / 2) / 1737.4; // km to radians
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= 48; i++) {
          const a = (i / 48) * Math.PI * 2;
          // Rotate a point on a small circle around the center
          const up = center.clone().normalize();
          const perp = new THREE.Vector3(0, 1, 0);
          if (Math.abs(up.dot(perp)) > 0.9) perp.set(1, 0, 0);
          const t1 = new THREE.Vector3().crossVectors(up, perp).normalize();
          const t2 = new THREE.Vector3().crossVectors(up, t1).normalize();
          const pt = center.clone()
            .addScaledVector(t1, Math.sin(angRad) * Math.cos(a))
            .addScaledVector(t2, Math.sin(angRad) * Math.sin(a))
            .normalize()
            .multiplyScalar(1.003);
          pts.push(pt);
        }
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const lineObj = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity }));
        return <primitive key={crater.name} object={lineObj} />;
      })}
    </>
  );
}

/* ─── Apollo orbit path ─── */
function ApolloOrbit({ site, visible }: { site: LandingSite; visible: boolean }) {
  const tickRef = useRef(0);
  const [t, setT] = useState(0);

  useFrame(() => {
    if (!visible) return;
    tickRef.current = (tickRef.current + 0.003) % 1;
    setT(tickRef.current);
  });

  const orbitPts = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const r = 1.016; // ~100km altitude
    const incl = 10 * Math.PI / 180;
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(
        r * Math.cos(a),
        r * Math.sin(a) * Math.sin(incl),
        r * Math.sin(a) * Math.cos(incl),
      ));
    }
    return pts;
  }, []);

  const orbitGeo = useMemo(() => new THREE.BufferGeometry().setFromPoints(orbitPts), [orbitPts]);

  // Descent arc
  const descentPts = useMemo(() => {
    const surface = latLonToVec3(site.lat, site.lon, 1.0);
    const orbitPt = latLonToVec3(site.lat, site.lon, 1.016);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 32; i++) {
      const frac = i / 32;
      pts.push(new THREE.Vector3().lerpVectors(orbitPt, surface, frac));
    }
    return pts;
  }, [site]);

  const descentGeo = useMemo(() => new THREE.BufferGeometry().setFromPoints(descentPts), [descentPts]);

  const orbitLine   = useMemo(() => new THREE.Line(orbitGeo,   new THREE.LineBasicMaterial({ color: '#4FC3F7', transparent: true, opacity: 0.4 })), [orbitGeo]);
  const descentLine = useMemo(() => new THREE.Line(descentGeo, new THREE.LineBasicMaterial({ color: '#FF7043', transparent: true, opacity: 0.6 })), [descentGeo]);

  if (!visible) return null;

  // Pulse dot along orbit
  const idx = Math.floor(t * (orbitPts.length - 1));
  const pulsePos = orbitPts[idx] ?? orbitPts[0];

  return (
    <group>
      <primitive object={orbitLine} />
      <primitive object={descentLine} />
      <mesh position={pulsePos}>
        <sphereGeometry args={[0.008, 6, 6]} />
        <meshBasicMaterial color="#4FC3F7" />
      </mesh>
    </group>
  );
}

/* ─── Controls (drag to rotate, scroll to zoom) ─── */
function Controls({ pivotRef, cameraZRef, onCameraZ }: {
  pivotRef: React.RefObject<THREE.Group | null>;
  cameraZRef: React.MutableRefObject<number>;
  onCameraZ: (z: number) => void;
}) {
  const { camera, gl } = useThree();
  const isDragging = useRef(false);
  const lastMouse  = useRef({ x: 0, y: 0 });
  const autoRotate = useRef(true);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetFOV  = useRef(45);
  const camRef = camera as THREE.PerspectiveCamera;

  // Touch pinch
  const lastPinchDist = useRef<number | null>(null);

  useEffect(() => {
    const el = gl.domElement;

    const onDown = (e: MouseEvent) => {
      isDragging.current = true;
      autoRotate.current = false;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current || !pivotRef.current) return;
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      pivotRef.current.rotation.y += dx * 0.005;
      pivotRef.current.rotation.x += dy * 0.005;
      pivotRef.current.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pivotRef.current.rotation.x));
      lastMouse.current = { x: e.clientX, y: e.clientY };
    };
    const onUp = () => {
      isDragging.current = false;
      resumeTimer.current = setTimeout(() => { autoRotate.current = true; }, 3000);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraZRef.current = Math.max(1.8, Math.min(8, cameraZRef.current + e.deltaY * 0.005));
      onCameraZ(cameraZRef.current);
    };

    // Touch
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging.current = true;
        autoRotate.current = false;
        lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        if (resumeTimer.current) clearTimeout(resumeTimer.current);
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastPinchDist.current = Math.sqrt(dx * dx + dy * dy);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1 && isDragging.current && pivotRef.current) {
        const dx = e.touches[0].clientX - lastMouse.current.x;
        const dy = e.touches[0].clientY - lastMouse.current.y;
        pivotRef.current.rotation.y += dx * 0.005;
        pivotRef.current.rotation.x += dy * 0.005;
        lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2 && lastPinchDist.current !== null) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const delta = lastPinchDist.current - dist;
        cameraZRef.current = Math.max(1.8, Math.min(8, cameraZRef.current + delta * 0.01));
        onCameraZ(cameraZRef.current);
        lastPinchDist.current = dist;
      }
    };
    const onTouchEnd = () => {
      isDragging.current = false;
      lastPinchDist.current = null;
      resumeTimer.current = setTimeout(() => { autoRotate.current = true; }, 3000);
    };

    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);

    return () => {
      el.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
  }, [gl, pivotRef, cameraZRef, onCameraZ]);

  useFrame(() => {
    if (autoRotate.current && pivotRef.current) {
      pivotRef.current.rotation.y += 0.0008;
    }
    // Smooth camera Z
    const targetZ = cameraZRef.current;
    camera.position.z += (targetZ - camera.position.z) * 0.08;
    // Dynamic FOV
    const fov = 20 + (camera.position.z - 1.8) * 8;
    targetFOV.current += (fov - targetFOV.current) * 0.05;
    camRef.fov = targetFOV.current;
    camRef.updateProjectionMatrix();
  });

  return null;
}

/* ─── Scene ─── */
function Scene({
  currentDate, overlays, selectedSite, onSelectSite, cameraZRef, onCameraZ,
  pivotRef, sunDir, showOrbit, farSideTarget,
}: {
  currentDate: Date;
  overlays: Record<string, boolean>;
  selectedSite: LandingSite | null;
  onSelectSite: (s: LandingSite | null) => void;
  cameraZRef: React.MutableRefObject<number>;
  onCameraZ: (z: number) => void;
  pivotRef: React.RefObject<THREE.Group | null>;
  sunDir: THREE.Vector3;
  showOrbit: boolean;
  farSideTarget: number;
}) {
  const [cameraZ, setCameraZ] = useState(3.2);
  const localCameraZ = useRef(3.2);

  const handleCameraZ = useCallback((z: number) => {
    localCameraZ.current = z;
    setCameraZ(z);
    onCameraZ(z);
  }, [onCameraZ]);

  // Far side tween
  const currentRotY = useRef(0);
  useFrame(() => {
    if (!pivotRef.current) return;
    currentRotY.current += (farSideTarget - currentRotY.current) * 0.04;
    // Only apply far side offset on top of drag rotation
  });

  return (
    <>
      <Controls pivotRef={pivotRef} cameraZRef={cameraZRef} onCameraZ={handleCameraZ} />
      <Starfield />

      {/* Lighting — Lambert: strong directional sun + enough ambient to see dark side */}
      <ambientLight color={0x606070} intensity={0.6} />
      <directionalLight
        color={0xfff8e8}
        intensity={3.0}
        position={[sunDir.x * 10, sunDir.y * 10, sunDir.z * 10]}
      />
      {/* Earthshine — faint blue on night side */}
      <directionalLight color={0x223366} intensity={0.2} position={[0, 0, 5]} />

      <group ref={pivotRef}>
        <MoonMesh sunDir={sunDir} currentDate={currentDate} />
        <Terminator sunDir={sunDir} />
        <LandingMarkers
          sites={LANDING_SITES}
          cameraZ={cameraZ}
          onSelect={onSelectSite}
          selectedSite={selectedSite}
          currentDate={currentDate}
        />
        <IceMarkers visible={overlays.ice} />
        <ArtemisMarkers visible={overlays.artemis} />
        <CraterRings visible={overlays.craters} cameraZ={cameraZ} />
        {selectedSite?.type === 'apollo' && showOrbit && (
          <ApolloOrbit site={selectedSite} visible={showOrbit} />
        )}
      </group>
    </>
  );
}

/* ══════════════════════════════════════════════
   CSS LABEL OVERLAY
══════════════════════════════════════════════ */
function LabelOverlay({ sites, pivotRef, cameraZ, currentDate }: {
  sites: LandingSite[];
  pivotRef: React.RefObject<THREE.Group | null>;
  cameraZ: number;
  currentDate: Date;
}) {
  const [labels, setLabels] = useState<{ site: LandingSite; x: number; y: number; visible: boolean }[]>([]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const currentYear = currentDate.getFullYear();

  useEffect(() => {
    if (cameraZ >= 3.5) { setLabels([]); return; }
    const update = () => {
      if (!canvasRef.current || !pivotRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const w = rect.width, h = rect.height;
      // Approximate projection: use pivot rotation to determine visibility
      const rotY = pivotRef.current.rotation.y;
      const rotX = pivotRef.current.rotation.x;
      const fov = 20 + (cameraZ - 1.8) * 8;
      const aspect = w / h;
      const proj = new THREE.PerspectiveCamera(fov, aspect, 0.1, 200);
      proj.position.set(0, 0, cameraZ);
      proj.lookAt(0, 0, 0);

      const newLabels = sites
        .filter(s => s.year <= currentYear)
        .map(site => {
          const worldPos = latLonToVec3(site.lat, site.lon, 1.015);
          // Apply pivot rotation
          worldPos.applyEuler(new THREE.Euler(rotX, rotY, 0, 'XYZ'));
          // Check if facing camera
          const visible = worldPos.z > 0.1;
          // Project to screen
          const ndc = worldPos.clone().project(proj);
          const x = (ndc.x * 0.5 + 0.5) * w;
          const y = (-ndc.y * 0.5 + 0.5) * h;
          return { site, x, y, visible };
        })
        .filter(l => l.visible && l.x > 0 && l.x < w && l.y > 0 && l.y < h);
      setLabels(newLabels);
    };
    const id = setInterval(update, 100);
    update();
    return () => clearInterval(id);
  }, [cameraZ, pivotRef, sites, currentYear]);

  return (
    <div ref={canvasRef} className="absolute inset-0 pointer-events-none overflow-hidden">
      {labels.map(({ site, x, y }) => (
        <div
          key={site.name}
          className="absolute transform -translate-x-1/2 -translate-y-full pointer-events-none"
          style={{
            left: x, top: y - 4,
            opacity: Math.max(0, (3.5 - cameraZ) / 1.5),
            transition: 'opacity 0.3s',
          }}
        >
          <div
            className="text-[8px] font-mono tracking-wider whitespace-nowrap px-1 py-0.5 rounded"
            style={{
              color: site.crew ? '#ffffff' : 'rgba(255,255,255,0.55)',
              background: 'rgba(0,0,0,0.6)',
              border: `1px solid ${site.color}44`,
            }}
          >
            {site.name}
            {site.rover?.includes('FAR SIDE') && (
              <span className="text-amber-400 ml-1">(FAR SIDE)</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════
   SITE DETAIL PANEL
══════════════════════════════════════════════ */
function SitePanel({ site, onClose }: { site: LandingSite; onClose: () => void }) {
  const typeLabel: Record<string, string> = {
    apollo: 'NASA · CREWED', luna: 'USSR · ROBOTIC', change: 'CNSA · ROBOTIC',
    india: 'ISRO · ROBOTIC', japan: 'JAXA · ROBOTIC', surveyor: 'NASA · ROBOTIC',
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="absolute right-0 top-0 bottom-0 w-72 bg-black/80 border-l border-white/10 flex flex-col overflow-hidden backdrop-blur-sm z-20"
    >
      <div className="px-5 py-4 border-b border-white/10 flex items-start justify-between shrink-0">
        <div>
          <div className="text-xs font-bold tracking-wider mb-0.5" style={{ color: site.color }}>
            {TYPE_FLAG[site.type]} {site.name}
          </div>
          <div className="text-[8px] text-white/30 tracking-widest uppercase">{typeLabel[site.type]} · {site.year}</div>
        </div>
        <button onClick={onClose} className="text-white/20 hover:text-white/60 text-xs mt-0.5">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {/* Coordinates */}
        <div className="flex gap-4 mb-4 text-[8px]">
          <div>
            <div className="text-white/25 tracking-widest uppercase mb-0.5">Latitude</div>
            <div className="text-white/60 tabular-nums">{site.lat.toFixed(4)}°</div>
          </div>
          <div>
            <div className="text-white/25 tracking-widest uppercase mb-0.5">Longitude</div>
            <div className="text-white/60 tabular-nums">{site.lon.toFixed(4)}°</div>
          </div>
        </div>

        {/* Crew */}
        {site.crew && (
          <div className="mb-4">
            <div className="text-[8px] text-white/25 tracking-widest uppercase mb-1.5">Crew</div>
            {site.crew.split(', ').map(name => (
              <div key={name} className="text-[9px] text-white/60 mb-0.5">{name}</div>
            ))}
          </div>
        )}

        {/* Rover */}
        {site.rover && (
          <div className="mb-4">
            <div className="text-[8px] text-white/25 tracking-widest uppercase mb-1">Rover</div>
            <div className="text-[9px] text-white/60">{site.rover}</div>
          </div>
        )}

        {/* Detail */}
        {site.detail && (
          <div className="mb-4">
            <div className="text-[8px] text-white/25 tracking-widest uppercase mb-1.5">Mission Notes</div>
            <div className="text-[9px] text-white/50 leading-relaxed">{site.detail}</div>
          </div>
        )}

        {/* Apollo orbit button */}
        {site.type === 'apollo' && (
          <div className="mt-2 text-[8px] text-white/25 tracking-widest uppercase">
            Orbit path shown above
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════
   APOLLO 17 EASTER EGG
══════════════════════════════════════════════ */
function Apollo17Egg({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onDone, 5500);
    return () => clearTimeout(t);
  }, [visible, onDone]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center z-50 pointer-events-none"
        >
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 1 }}
            className="text-center"
          >
            <div className="text-white/60 font-mono text-sm tracking-widest mb-4">
              "The last time a human stood on another world"
            </div>
            <div className="text-white/40 font-mono text-xs tracking-widest mb-2">December 14, 1972</div>
            <div className="text-white/25 font-mono text-[10px] tracking-widest">
              {new Date().getFullYear() - 1972} years ago
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ══════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════ */
export function Selene() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedSite, setSelectedSite] = useState<LandingSite | null>(null);
  const [showOrbit, setShowOrbit] = useState(false);
  const [cameraZ, setCameraZ] = useState(3.2);
  const [farSide, setFarSide] = useState(false);
  const [showEgg, setShowEgg] = useState(false);
  const [overlays, setOverlays] = useState({
    ice: false, artemis: false, craters: true, sites: true,
  });

  const pivotRef = useRef<THREE.Group>(null);
  const cameraZRef = useRef(3.2);

  // Recalculate sun direction every 60s
  const [sunDir, setSunDir] = useState(() => getSunDirection(new Date()));
  useEffect(() => {
    setSunDir(getSunDirection(currentDate));
    const id = setInterval(() => setSunDir(getSunDirection(currentDate)), 60000);
    return () => clearInterval(id);
  }, [currentDate]);

  // Moon phase data
  const phaseData = useMemo(() => getMoonPhase(currentDate), [currentDate]);
  const phase = phaseName(phaseData.phase);
  const nextFull = useMemo(() => getNextPhase(currentDate, 0.5), [currentDate]);
  const nextNew  = useMemo(() => getNextPhase(currentDate, 0.0), [currentDate]);

  // Far side toggle
  const handleFarSide = useCallback((toFar: boolean) => {
    setFarSide(toFar);
    if (pivotRef.current) {
      pivotRef.current.rotation.y += toFar ? Math.PI : -Math.PI;
    }
  }, []);

  // Pole views
  const handlePoleView = useCallback((pole: 'north' | 'south') => {
    if (!pivotRef.current) return;
    pivotRef.current.rotation.x = pole === 'north' ? -Math.PI / 2 : Math.PI / 2;
    pivotRef.current.rotation.y = 0;
  }, []);

  // Site selection
  const handleSelectSite = useCallback((site: LandingSite | null) => {
    setSelectedSite(site);
    setShowOrbit(site?.type === 'apollo');
    if (site?.name === 'Apollo 17') {
      setShowEgg(true);
    }
  }, []);

  // Time controls
  const handleDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const d = new Date(e.target.value);
    if (!isNaN(d.getTime())) setCurrentDate(d);
  }, []);

  const toggleOverlay = useCallback((key: string) => {
    setOverlays(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));
  }, []);

  const dateStr = currentDate.toISOString().slice(0, 16);
  const isApollo11Date = currentDate.getFullYear() === 1969 && currentDate.getMonth() === 6 && currentDate.getDate() === 20;

  return (
    <div className="w-full h-full bg-[#000005] text-white font-mono overflow-hidden flex flex-col relative">

      {/* ── TOP BAR ── */}
      <div className="flex items-stretch border-b border-white/10 bg-black/60 shrink-0 z-10 flex-wrap">
        <div className="flex items-center gap-3 px-6 py-3 border-r border-white/10">
          <span className="text-[9px] tracking-[0.35em] text-white/30 uppercase">MODULE</span>
          <span className="text-sm font-bold tracking-widest" style={{ color: '#FFF9C4' }}>SELENE</span>
        </div>
        <div className="flex items-center px-5 py-3 border-r border-white/10 gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-100 animate-pulse" />
          <span className="text-[9px] tracking-[0.3em] text-white/30 uppercase">EARTH'S MOON</span>
        </div>
        <div className="flex items-center px-5 py-3 border-r border-white/10 gap-3">
          <span className="text-[9px] text-white/30 uppercase tracking-widest">PHASE</span>
          <span className="text-[9px] font-bold" style={{ color: '#FFF9C4' }}>{phase.toUpperCase()}</span>
        </div>
        <div className="flex items-center px-5 py-3 border-r border-white/10 gap-3">
          <span className="text-[9px] text-white/30 uppercase tracking-widest">ILLUMINATION</span>
          <span className="text-[9px] font-bold tabular-nums" style={{ color: '#FFF9C4' }}>
            {(phaseData.illumination * 100).toFixed(1)}%
          </span>
        </div>
        {farSide && (
          <div className="flex items-center px-5 py-3 gap-2">
            <span className="text-[9px] text-amber-400 tracking-widest uppercase animate-pulse">FAR SIDE · NEVER VISIBLE FROM EARTH</span>
          </div>
        )}
      </div>

      {/* ── MAIN LAYOUT ── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* ── LEFT PANEL ── */}
        <div className="w-52 shrink-0 border-r border-white/10 bg-black/40 flex flex-col overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] z-10">

          {/* Phase disc + data */}
          <div className="px-4 py-4 border-b border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <PhaseDisc illumination={phaseData.illumination} phase={phaseData.phase} size={44} />
              <div>
                <div className="text-[9px] font-bold tracking-wider" style={{ color: '#FFF9C4' }}>{phase}</div>
                <div className="text-[8px] text-white/30 mt-0.5">{(phaseData.illumination * 100).toFixed(1)}% lit</div>
              </div>
            </div>
            {[
              ['AGE',       `${phaseData.age.toFixed(1)} days`],
              ['DISTANCE',  `${MOON_DIST_KM.toLocaleString()} km`],
              ['NEXT FULL', `${formatDate(nextFull)} · ${daysUntil(nextFull, currentDate)}d`],
              ['NEXT NEW',  `${formatDate(nextNew)} · ${daysUntil(nextNew, currentDate)}d`],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between items-baseline mb-1.5">
                <span className="text-[7px] text-white/25 tracking-widest uppercase">{label}</span>
                <span className="text-[8px] text-white/55 tabular-nums text-right">{value}</span>
              </div>
            ))}
          </div>

          {/* Overlays */}
          <div className="px-4 py-3 border-b border-white/10">
            <div className="text-[7px] text-white/20 tracking-widest uppercase mb-2">Overlays</div>
            {[
              { key: 'sites',   label: 'Landing Sites', color: '#4FC3F7' },
              { key: 'craters', label: 'Named Craters',  color: '#ffffff' },
              { key: 'ice',     label: 'Water Ice',      color: '#88ccff' },
              { key: 'artemis', label: 'Artemis Zones',  color: '#FF7043' },
            ].map(({ key, label, color }) => {
              const on = overlays[key as keyof typeof overlays];
              return (
                <button
                  key={key}
                  onClick={() => toggleOverlay(key)}
                  className="flex items-center gap-2 w-full py-1.5 text-left group"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 transition-all"
                    style={{
                      backgroundColor: on ? color : 'transparent',
                      border: `1.5px solid ${on ? color : 'rgba(255,255,255,0.15)'}`,
                      boxShadow: on ? `0 0 6px ${color}88` : 'none',
                    }}
                  />
                  <span className="text-[8px] tracking-wider transition-colors"
                    style={{ color: on ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.25)' }}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Views */}
          <div className="px-4 py-3 border-b border-white/10">
            <div className="text-[7px] text-white/20 tracking-widest uppercase mb-2">Views</div>
            <div className="grid grid-cols-2 gap-1">
              {[
                { label: 'NEAR SIDE', action: () => handleFarSide(false) },
                { label: 'FAR SIDE',  action: () => handleFarSide(true)  },
                { label: 'N. POLE',   action: () => handlePoleView('north') },
                { label: 'S. POLE',   action: () => handlePoleView('south') },
              ].map(({ label, action }) => (
                <button
                  key={label}
                  onClick={action}
                  className="px-2 py-1.5 text-[7px] tracking-widest border border-white/10 hover:border-white/30 text-white/30 hover:text-white/60 transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Landing sites list */}
          <div className="px-4 py-3 flex-1">
            <div className="text-[7px] text-white/20 tracking-widest uppercase mb-2">
              Landing Sites ({LANDING_SITES.filter(s => s.year <= currentDate.getFullYear()).length})
            </div>
            {LANDING_SITES.filter(s => s.year <= currentDate.getFullYear()).map(site => (
              <button
                key={site.name}
                onClick={() => handleSelectSite(selectedSite?.name === site.name ? null : site)}
                className="flex items-center gap-2 w-full py-1 text-left group"
              >
                <span className="text-[9px] shrink-0">{TYPE_FLAG[site.type]}</span>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: site.color }} />
                <span className={`text-[8px] tracking-wider transition-colors ${selectedSite?.name === site.name ? 'text-white' : 'text-white/30 group-hover:text-white/60'}`}>
                  {site.name}
                </span>
                <span className="text-[7px] text-white/15 ml-auto">{site.year}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── GLOBE ── */}
        <div className="flex-1 relative overflow-hidden">
          <Canvas
            camera={{ position: [0, 0, 3.2], fov: 45, near: 0.1, far: 200 }}
            gl={{ antialias: true, alpha: false }}
            onCreated={({ gl }) => {
              gl.setPixelRatio(Math.min(devicePixelRatio, 2));
              gl.setClearColor('#000005');
            }}
          >
            <Scene
              currentDate={currentDate}
              overlays={overlays}
              selectedSite={selectedSite}
              onSelectSite={handleSelectSite}
              cameraZRef={cameraZRef}
              onCameraZ={setCameraZ}
              pivotRef={pivotRef}
              sunDir={sunDir}
              showOrbit={showOrbit}
              farSideTarget={0}
            />
          </Canvas>

          {/* CSS label overlay */}
          {overlays.sites && (
            <LabelOverlay
              sites={LANDING_SITES}
              pivotRef={pivotRef}
              cameraZ={cameraZ}
              currentDate={currentDate}
            />
          )}

          {/* Crater labels when zoomed */}
          {overlays.craters && cameraZ < 2.5 && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 text-[7px] text-white/20 tracking-widest uppercase pointer-events-none">
              Named craters visible
            </div>
          )}

          {/* Apollo 11 historical note */}
          {isApollo11Date && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 border border-blue-400/30 px-4 py-2 text-center pointer-events-none">
              <div className="text-[9px] text-blue-300 tracking-widest uppercase animate-pulse">
                FIRST HUMAN MOON LANDING · JULY 20, 1969
              </div>
            </div>
          )}

          {/* Apollo 17 easter egg */}
          <Apollo17Egg visible={showEgg} onDone={() => setShowEgg(false)} />

          {/* Site detail panel */}
          <AnimatePresence>
            {selectedSite && !showEgg && (
              <SitePanel site={selectedSite} onClose={() => { setSelectedSite(null); setShowOrbit(false); }} />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── TIME CONTROLS ── */}
      <div className="border-t border-white/10 bg-black/60 px-4 py-2 flex items-center gap-2 shrink-0 z-10 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <span className="text-[8px] text-white/25 tracking-widest uppercase shrink-0">TIME</span>
        <input
          type="datetime-local"
          value={dateStr}
          min="1969-07-01T00:00"
          max="2030-12-31T23:59"
          onChange={handleDateChange}
          className="bg-transparent border border-white/10 text-[9px] text-white/50 px-2 py-1 font-mono focus:outline-none focus:border-white/30 [color-scheme:dark] shrink-0"
        />
        {[
          { label: '🌍 TODAY',          date: new Date() },
          { label: '🇺🇸 Apollo 11',     date: new Date('1969-07-20T20:17:00Z') },
          { label: '🇺🇸 Apollo 17',     date: new Date('1972-12-14T22:54:00Z') },
          { label: '🇨🇳 Chang\'e 4',    date: new Date('2019-01-03T02:26:00Z') },
          { label: '🇮🇳 Chandrayaan-3', date: new Date('2023-08-23T18:02:00Z') },
          { label: '🇯🇵 SLIM',          date: new Date('2024-01-19T15:20:00Z') },
          { label: '🇨🇳 Chang\'e 6',    date: new Date('2024-06-01T22:23:00Z') },
        ].map(({ label, date }) => (
          <button
            key={label}
            onClick={() => setCurrentDate(date)}
            className="px-3 py-1.5 text-[9px] border border-white/15 hover:border-white/40 text-white/40 hover:text-white/80 transition-colors shrink-0 whitespace-nowrap rounded-sm"
          >
            {label}
          </button>
        ))}
        <div className="ml-auto text-[8px] text-white/20 tabular-nums shrink-0">
          {currentDate.toUTCString().slice(0, 25)} UTC
        </div>
      </div>
    </div>
  );
}
