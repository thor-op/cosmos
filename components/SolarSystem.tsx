'use client';

import { useRef, useMemo, useState, useCallback, Suspense, createContext, useContext } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Line, useTexture, Html } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';

const PlanetPosCtx = createContext<React.MutableRefObject<Map<string,THREE.Vector3>>|null>(null);

const BASE = 'https://raw.githubusercontent.com/jeromeetienne/threex.planets/master/images/';
const BASE3 = 'https://threejs.org/examples/textures/planets/';
const TEX = {
  sun:     BASE+'sunmap.jpg',
  mercury: BASE+'mercurymap.jpg',
  venus:   BASE+'venusmap.jpg',
  earth:   BASE3+'earth_atmos_2048.jpg',
  earthC:  BASE3+'earth_clouds_1024.png',
  moon:    BASE3+'moon_1024.jpg',
  mars:    BASE+'marsmap1k.jpg',
  jupiter: BASE+'jupitermap.jpg',
  saturn:  BASE+'saturnmap.jpg',
  saturnR: BASE+'saturnringcolor.jpg',
  uranus:  BASE+'uranusmap.jpg',
  neptune: BASE+'neptunemap.jpg',
};

interface PlanetDef {
  id:string; name:string; radius:number; realRadius:number;
  distance:number; realDistance:number; period:number; rotPeriod:number; tilt:number;
  texKey:keyof typeof TEX; rings?:boolean;
  moons?:{name:string;r:number;d:number;p:number;texKey?:keyof typeof TEX}[];
  gravity:string; escapeVel:string; density:string; atmosphere:string; funFact:string;
  info:{type:string;diameter:string;day:string;year:string;temp:string;moons:string;desc:string};
}

const PLANETS:PlanetDef[] = [
  {id:'mercury',name:'MERCURY',radius:0.18,realRadius:2439.7,distance:4.5,realDistance:0.387,period:0.241,rotPeriod:58.6,tilt:0.03,texKey:'mercury',gravity:'3.7 m/s',escapeVel:'4.3 km/s',density:'5.43 g/cm3',atmosphere:'None (trace exosphere)',funFact:'A year on Mercury is shorter than its day.',info:{type:'Terrestrial',diameter:'4,879 km',day:'58.6 Earth days',year:'88 Earth days',temp:'-180 to 430C',moons:'0',desc:'Smallest planet. Heavily cratered. Extreme temperature swings due to no atmosphere.'}},
  {id:'venus',name:'VENUS',radius:0.45,realRadius:6051.8,distance:7.2,realDistance:0.723,period:0.615,rotPeriod:-243,tilt:177.4,texKey:'venus',gravity:'8.87 m/s',escapeVel:'10.4 km/s',density:'5.24 g/cm3',atmosphere:'CO2 96%, N2 3.5%',funFact:'A day on Venus is longer than its year. It rotates backwards.',info:{type:'Terrestrial',diameter:'12,104 km',day:'243 Earth days',year:'225 Earth days',temp:'465C avg',moons:'0',desc:'Hottest planet. Dense CO2 atmosphere creates runaway greenhouse effect.'}},
  {id:'earth',name:'EARTH',radius:0.48,realRadius:6371,distance:10,realDistance:1.0,period:1.0,rotPeriod:1.0,tilt:23.4,texKey:'earth',moons:[{name:'Moon',r:0.13,d:1.1,p:0.0748,texKey:'moon'}],gravity:'9.81 m/s',escapeVel:'11.2 km/s',density:'5.51 g/cm3',atmosphere:'N2 78%, O2 21%',funFact:'Earth is the densest planet and the only one not named after a god.',info:{type:'Terrestrial',diameter:'12,742 km',day:'24 hours',year:'365.25 days',temp:'-88 to 58C',moons:'1',desc:'Only known planet harboring life. 71% water surface.'}},
  {id:'mars',name:'MARS',radius:0.26,realRadius:3389.5,distance:13.5,realDistance:1.524,period:1.881,rotPeriod:1.026,tilt:25.2,texKey:'mars',moons:[{name:'Phobos',r:0.06,d:0.7,p:0.0175},{name:'Deimos',r:0.04,d:1.0,p:0.034}],gravity:'3.72 m/s',escapeVel:'5.0 km/s',density:'3.93 g/cm3',atmosphere:'CO2 95%, N2 2.6%',funFact:'Olympus Mons is the tallest volcano in the solar system at 22 km.',info:{type:'Terrestrial',diameter:'6,779 km',day:'24h 37m',year:'687 Earth days',temp:'-125 to 20C',moons:'2',desc:'The Red Planet. Home to Olympus Mons at 22km.'}},
  {id:'jupiter',name:'JUPITER',radius:1.4,realRadius:69911,distance:22,realDistance:5.203,period:11.86,rotPeriod:0.414,tilt:3.1,texKey:'jupiter',moons:[{name:'Io',r:0.1,d:2.2,p:0.0048},{name:'Europa',r:0.09,d:2.8,p:0.0097},{name:'Ganymede',r:0.12,d:3.5,p:0.0196},{name:'Callisto',r:0.08,d:4.2,p:0.0456}],gravity:'24.8 m/s',escapeVel:'59.5 km/s',density:'1.33 g/cm3',atmosphere:'H2 90%, He 10%',funFact:"Jupiter's Great Red Spot has raged for 350+ years, wider than Earth.",info:{type:'Gas Giant',diameter:'139,820 km',day:'9h 56m',year:'11.86 Earth years',temp:'-110C (cloud tops)',moons:'95',desc:'Largest planet. 1,300 Earths fit inside.'}},
  {id:'saturn',name:'SATURN',radius:1.15,realRadius:58232,distance:32,realDistance:9.537,period:29.46,rotPeriod:0.444,tilt:26.7,texKey:'saturn',rings:true,moons:[{name:'Titan',r:0.14,d:2.8,p:0.0437},{name:'Enceladus',r:0.08,d:3.8,p:0.0875}],gravity:'10.4 m/s',escapeVel:'35.5 km/s',density:'0.69 g/cm3',atmosphere:'H2 96%, He 3%',funFact:'Saturn is less dense than water - it would float.',info:{type:'Gas Giant',diameter:'116,460 km',day:'10h 42m',year:'29.46 Earth years',temp:'-140C (cloud tops)',moons:'146',desc:'Rings span 282,000 km but only ~10m thick.'}},
  {id:'uranus',name:'URANUS',radius:0.75,realRadius:25362,distance:42,realDistance:19.19,period:84.01,rotPeriod:-0.718,tilt:97.8,texKey:'uranus',rings:true,moons:[{name:'Titania',r:0.07,d:1.6,p:0.023},{name:'Oberon',r:0.06,d:2.0,p:0.036}],gravity:'8.87 m/s',escapeVel:'21.3 km/s',density:'1.27 g/cm3',atmosphere:'H2 83%, He 15%, CH4 2%',funFact:'Uranus poles experience 42 years of sunlight then 42 years of darkness.',info:{type:'Ice Giant',diameter:'50,724 km',day:'17h 14m',year:'84 Earth years',temp:'-195C avg',moons:'28',desc:'Rotates on its side at 98 axial tilt.'}},
  {id:'neptune',name:'NEPTUNE',radius:0.72,realRadius:24622,distance:52,realDistance:30.07,period:164.8,rotPeriod:0.671,tilt:28.3,texKey:'neptune',moons:[{name:'Triton',r:0.1,d:1.8,p:0.0205}],gravity:'11.2 m/s',escapeVel:'23.5 km/s',density:'1.64 g/cm3',atmosphere:'H2 80%, He 19%, CH4 1%',funFact:"Neptune's moon Triton orbits backwards and will be torn apart in ~3.6 billion years.",info:{type:'Ice Giant',diameter:'49,244 km',day:'16h 6m',year:'165 Earth years',temp:'-200C avg',moons:'16',desc:'Windiest planet at 2,100 km/h.'}},
];

type StudyTab = 'data'|'compare'|'facts'|'orbits';
type MoonDef = NonNullable<PlanetDef['moons']>[number];

function Stars() {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(3000*3);
    for (let i=0;i<3000;i++) {
      const r=300+Math.random()*200, theta=Math.random()*Math.PI*2, phi=Math.acos(2*Math.random()-1);
      pos[i*3]=r*Math.sin(phi)*Math.cos(theta); pos[i*3+1]=r*Math.sin(phi)*Math.sin(theta); pos[i*3+2]=r*Math.cos(phi);
    }
    g.setAttribute('position',new THREE.BufferAttribute(pos,3)); return g;
  },[]);
  return <points geometry={geo}><pointsMaterial size={0.35} color="#ffffff" sizeAttenuation transparent opacity={0.85}/></points>;
}

function Sun({paused,onSelect,selected}:{paused:boolean;onSelect:()=>void;selected:boolean}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const tex = useTexture(TEX.sun);
  useFrame((_,delta)=>{ if(!paused&&meshRef.current) meshRef.current.rotation.y+=delta*0.04; });
  return (
    <group position={[0,0,0]}>
      {[3.2,3.8,4.6].map((s,i)=>(
        <mesh key={i}><sphereGeometry args={[s,16,16]}/><meshBasicMaterial color="#ff7700" transparent opacity={0.035-i*0.008} side={THREE.BackSide}/></mesh>
      ))}
      <mesh ref={meshRef} onClick={(e)=>{e.stopPropagation();onSelect();}} onPointerOver={()=>{document.body.style.cursor='pointer';}} onPointerOut={()=>{document.body.style.cursor='auto';}}>
        <sphereGeometry args={[2.8,64,64]}/>
        <meshStandardMaterial map={tex} emissiveMap={tex} emissive={new THREE.Color(1,0.55,0.05)} emissiveIntensity={0.7}/>
      </mesh>
      {selected&&<mesh rotation={[-Math.PI/2,0,0]}><ringGeometry args={[3.2,3.5,64]}/><meshBasicMaterial color="#ffffff" transparent opacity={0.4} side={THREE.DoubleSide}/></mesh>}
      <pointLight intensity={8} distance={600} decay={1.2} color="#fff5e0"/>
    </group>
  );
}

function OrbitPath({distance,highlight}:{distance:number;highlight?:boolean}) {
  const pts = useMemo<[number,number,number][]>(()=>{
    const a:[number,number,number][]=[];
    for(let i=0;i<=128;i++){const ang=(i/128)*Math.PI*2;a.push([Math.cos(ang)*distance,0,Math.sin(ang)*distance]);}
    return a;
  },[distance]);
  return <Line points={pts} color="#ffffff" lineWidth={highlight?0.8:0.3} transparent opacity={highlight?0.3:0.07}/>;
}

function AsteroidBelt() {
  const geo = useMemo(()=>{
    const g=new THREE.BufferGeometry(), pos=new Float32Array(1800*3);
    for(let i=0;i<1800;i++){const r=16+Math.random()*2.5,a=Math.random()*Math.PI*2;pos[i*3]=Math.cos(a)*r;pos[i*3+1]=(Math.random()-0.5)*0.4;pos[i*3+2]=Math.sin(a)*r;}
    g.setAttribute('position',new THREE.BufferAttribute(pos,3)); return g;
  },[]);
  return <points geometry={geo}><pointsMaterial size={0.08} color="#aaaaaa" sizeAttenuation transparent opacity={0.5}/></points>;
}

function MoonMesh({moon,speed,paused,showLabels}:{moon:MoonDef;speed:number;paused:boolean;showLabels:boolean}) {
  const ref=useRef<THREE.Mesh>(null), t=useRef(Math.random()*Math.PI*2);
  const tex=useTexture(moon.texKey?TEX[moon.texKey]:TEX.moon);
  useFrame((_,delta)=>{
    if(!ref.current) return;
    if(!paused) t.current+=delta*speed*(1/moon.p)*0.3;
    ref.current.position.set(Math.cos(t.current)*moon.d,0,Math.sin(t.current)*moon.d);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[moon.r,16,16]}/>
      <meshStandardMaterial map={tex} roughness={1}/>
      {showLabels&&<Html center distanceFactor={8} style={{pointerEvents:'none'}}><span style={{color:'rgba(255,255,255,0.3)',fontSize:'8px',fontFamily:'monospace',whiteSpace:'nowrap',letterSpacing:'0.1em'}}>{moon.name}</span></Html>}
    </mesh>
  );
}

function Planet({def,idx,speed,paused,onSelect,selected,showLabels,realScale}:{def:PlanetDef;idx:number;speed:number;paused:boolean;onSelect:(id:string)=>void;selected:boolean;showLabels:boolean;realScale:boolean}) {
  const groupRef=useRef<THREE.Group>(null), meshRef=useRef<THREE.Mesh>(null), cloudRef=useRef<THREE.Mesh>(null);
  const timeRef=useRef(Math.random()*Math.PI*2);
  const posMap=useContext(PlanetPosCtx);
  const tex=useTexture(TEX[def.texKey]), cloudTex=useTexture(TEX.earthC), satRingTex=useTexture(TEX.saturnR);
  const displayRadius=realScale?Math.max(0.05,(def.realRadius/6371)*0.48):def.radius;
  const displayDist=realScale?Math.pow(def.realDistance,0.5)*12:def.distance;

  useFrame((_,delta)=>{
    if(!groupRef.current||!meshRef.current) return;
    if(!paused) timeRef.current+=delta*speed*(1/def.period)*0.3;
    groupRef.current.position.set(Math.cos(timeRef.current)*displayDist,0,Math.sin(timeRef.current)*displayDist);
    if(posMap){let v=posMap.current.get(def.id);if(!v){v=new THREE.Vector3();posMap.current.set(def.id,v);}groupRef.current.getWorldPosition(v);}
    if(!paused){meshRef.current.rotation.y+=delta*(def.rotPeriod<0?-0.3:0.5);if(cloudRef.current)cloudRef.current.rotation.y+=delta*0.55;}
  });

  return (
    <group ref={groupRef}>
      <group rotation={[0,0,(def.tilt*Math.PI)/180]}>
        <mesh ref={meshRef} onClick={(e)=>{e.stopPropagation();onSelect(def.id);}} onPointerOver={()=>{document.body.style.cursor='pointer';}} onPointerOut={()=>{document.body.style.cursor='auto';}}>
          <sphereGeometry args={[displayRadius,64,64]}/>
          <meshStandardMaterial map={tex} roughness={0.8} metalness={0.05}/>
        </mesh>
        {def.id==='earth'&&<mesh ref={cloudRef}><sphereGeometry args={[displayRadius*1.012,48,48]}/><meshStandardMaterial map={cloudTex} transparent opacity={0.35} depthWrite={false}/></mesh>}
        {def.id==='saturn'&&<mesh rotation={[Math.PI/2,0,0]}><ringGeometry args={[displayRadius*1.3,displayRadius*2.3,128]}/><meshBasicMaterial map={satRingTex} transparent side={THREE.DoubleSide} opacity={0.9}/></mesh>}
        {def.id==='uranus'&&<mesh rotation={[Math.PI/2,0,0]}><ringGeometry args={[displayRadius*1.4,displayRadius*1.8,64]}/><meshBasicMaterial color="#7de8e8" transparent opacity={0.2} side={THREE.DoubleSide}/></mesh>}
        {def.moons?.map((moon,mi)=><MoonMesh key={mi} moon={moon} speed={speed} paused={paused} showLabels={showLabels}/>)}
      </group>
      {selected&&<mesh rotation={[-Math.PI/2,0,0]}><ringGeometry args={[displayRadius*1.9,displayRadius*2.1,64]}/><meshBasicMaterial color="#ffffff" transparent opacity={0.5} side={THREE.DoubleSide}/></mesh>}
      {showLabels&&<Html center position={[0,displayRadius+0.5,0]} distanceFactor={20} style={{pointerEvents:'none'}}><span style={{color:selected?'#ffffff':'rgba(255,255,255,0.4)',fontSize:'9px',fontFamily:'monospace',letterSpacing:'0.2em',whiteSpace:'nowrap'}}>{def.name}</span></Html>}
    </group>
  );
}

function CameraTracker({selectedId,realScale}:{selectedId:string|null;realScale:boolean}) {
  const {camera}=useThree();
  const posMap=useContext(PlanetPosCtx);
  const smoothTarget=useRef(new THREE.Vector3());
  const smoothCam=useRef(new THREE.Vector3(0,40,80));

  useFrame(()=>{
    if(!selectedId) return;
    let target:THREE.Vector3;
    let offsetDist=10;
    if(selectedId==='sun') {
      target=new THREE.Vector3(0,0,0); offsetDist=14;
    } else {
      const pos=posMap?.current.get(selectedId);
      if(!pos) return;
      target=pos.clone();
      const p=PLANETS.find(pl=>pl.id===selectedId);
      const r=p?(realScale?Math.max(0.05,(p.realRadius/6371)*0.48):p.radius):1;
      offsetDist=Math.max(4,r*10);
    }
    smoothTarget.current.lerp(target,0.06);
    const desired=smoothTarget.current.clone().add(new THREE.Vector3(0,offsetDist*0.4,offsetDist));
    smoothCam.current.lerp(desired,0.06);
    camera.position.copy(smoothCam.current);
    camera.lookAt(smoothTarget.current);
  });
  return null;
}

function Scene({speed,paused,selectedId,onSelect,showLabels,showBelt,realScale}:{speed:number;paused:boolean;selectedId:string|null;onSelect:(id:string|null)=>void;showLabels:boolean;showBelt:boolean;realScale:boolean}) {
  return (
    <>
      <ambientLight intensity={0.05}/>
      <Stars/>
      <Sun paused={paused} onSelect={()=>onSelect('sun')} selected={selectedId==='sun'}/>
      {showBelt&&<AsteroidBelt/>}
      {PLANETS.map((p,i)=>(
        <group key={p.id}>
          <OrbitPath distance={realScale?Math.pow(p.realDistance,0.5)*12:p.distance} highlight={selectedId===p.id}/>
          <Planet def={p} idx={i} speed={speed} paused={paused} onSelect={onSelect} selected={selectedId===p.id} showLabels={showLabels} realScale={realScale}/>
        </group>
      ))}
      <CameraTracker selectedId={selectedId} realScale={realScale}/>
      <OrbitControls enableDamping dampingFactor={0.08} minDistance={2} maxDistance={300} enabled={!selectedId}/>
    </>
  );
}

function StudyPanel({planet,onClose}:{planet:PlanetDef;onClose:()=>void}) {
  const [tab,setTab]=useState<StudyTab>('data');
  const er=6371;
  return (
    <motion.div initial={{opacity:0,x:24}} animate={{opacity:1,x:0}} exit={{opacity:0,x:24}} transition={{duration:0.2}}
      className="absolute top-4 right-4 w-80 border border-white/10 bg-black/90 backdrop-blur-sm font-mono text-xs z-20 flex flex-col max-h-[calc(100vh-2rem)] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 shrink-0">
        <div><span className="text-white tracking-widest text-sm">{planet.name}</span><span className="text-white/30 text-[9px] tracking-wider ml-2">{planet.info.type}</span></div>
        <button onClick={onClose} className="text-white/30 hover:text-white transition-colors text-lg leading-none">x</button>
      </div>
      <div className="flex border-b border-white/10 shrink-0">
        {(['data','compare','facts','orbits'] as StudyTab[]).map(t=>(
          <button key={t} onClick={()=>setTab(t)} className={"flex-1 py-2 text-[9px] tracking-widest uppercase transition-colors "+(tab===t?'text-white border-b border-white':'text-white/30 hover:text-white/60')}>{t}</button>
        ))}
      </div>
      <div className="overflow-y-auto flex-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {tab==='data'&&(
          <div className="px-3 py-3">
            {([['TYPE',planet.info.type],['DIAMETER',planet.info.diameter],['ROTATION',Math.abs(planet.rotPeriod)+' days'+(planet.rotPeriod<0?' (retrograde)':'')],['ORBITAL PERIOD',planet.info.year],['AXIAL TILT',planet.tilt+'deg'],['TEMPERATURE',planet.info.temp],['GRAVITY',planet.gravity],['ESCAPE VEL',planet.escapeVel],['DENSITY',planet.density],['ATMOSPHERE',planet.atmosphere],['MOONS',planet.info.moons],['DISTANCE FROM SUN',planet.realDistance+' AU']] as [string,string][]).map(([k,v])=>(
              <div key={k} className="flex justify-between gap-2 py-1.5 border-b border-white/5">
                <span className="text-white/30 tracking-widest text-[9px] shrink-0">{k}</span>
                <span className="text-white/70 text-[10px] text-right">{v}</span>
              </div>
            ))}
          </div>
        )}
        {tab==='compare'&&(
          <div className="px-3 py-3 space-y-3">
            <p className="text-white/30 text-[9px] tracking-widest">COMPARED TO EARTH</p>
            {([{label:'DIAMETER',val:planet.realRadius/er,unit:'x Earth',max:12},{label:'GRAVITY',val:parseFloat(planet.gravity)/9.81,unit:'x Earth g',max:3},{label:'DISTANCE',val:planet.realDistance,unit:'AU',max:35},{label:'YEAR LENGTH',val:planet.period,unit:'Earth years',max:170}]).map(({label,val,unit,max})=>(
              <div key={label} className="space-y-1">
                <div className="flex justify-between"><span className="text-white/30 text-[9px] tracking-widest">{label}</span><span className="text-white/60 text-[10px]">{val.toFixed(2)} {unit}</span></div>
                <div className="h-1 bg-white/5 w-full"><div className="h-full bg-white/40 transition-all duration-500" style={{width:Math.min(100,(val/max)*100)+'%'}}/></div>
              </div>
            ))}
            <div className="border-t border-white/10 pt-3">
              <p className="text-white/30 text-[9px] tracking-widest mb-3">SIZE COMPARISON</p>
              <div className="flex items-end gap-4">
                <div className="flex flex-col items-center gap-1"><div className="bg-blue-400/60 rounded-full" style={{width:24,height:24}}/><span className="text-[8px] text-white/30">EARTH</span></div>
                <div className="flex flex-col items-center gap-1">
                  <div className="rounded-full" style={{width:Math.max(4,Math.min(80,(planet.realRadius/er)*24)),height:Math.max(4,Math.min(80,(planet.realRadius/er)*24)),background:planet.id==='mercury'?'#a09080':planet.id==='venus'?'#e8c87a':planet.id==='mars'?'#c1440e':planet.id==='jupiter'?'#c88b5a':planet.id==='saturn'?'#e8d5a0':planet.id==='uranus'?'#7de8e8':planet.id==='neptune'?'#3a5fe8':'#2a6ab5'}}/>
                  <span className="text-[8px] text-white/30">{planet.name}</span>
                </div>
              </div>
            </div>
          </div>
        )}
        {tab==='facts'&&(
          <div className="px-3 py-3 space-y-3">
            <div className="border border-white/10 p-3"><p className="text-[9px] text-white/30 tracking-widest mb-2">FUN FACT</p><p className="text-white/70 text-[10px] leading-relaxed">{planet.funFact}</p></div>
            <div className="border border-white/10 p-3"><p className="text-[9px] text-white/30 tracking-widest mb-2">DESCRIPTION</p><p className="text-white/60 text-[10px] leading-relaxed">{planet.info.desc}</p></div>
            {planet.moons&&planet.moons.length>0&&(
              <div className="border border-white/10 p-3"><p className="text-[9px] text-white/30 tracking-widest mb-2">NOTABLE MOONS</p>
                {planet.moons.map(m=><div key={m.name} className="flex justify-between py-0.5"><span className="text-white/50 text-[10px]">{m.name}</span><span className="text-white/25 text-[9px]">period {(m.p*365.25).toFixed(1)}d</span></div>)}
              </div>
            )}
          </div>
        )}
        {tab==='orbits'&&(
          <div className="px-3 py-3">
            <p className="text-white/30 text-[9px] tracking-widest mb-2">ORBITAL MECHANICS</p>
            {([['SEMI-MAJOR AXIS',planet.realDistance+' AU'],['ORBITAL PERIOD',planet.info.year],['ORBITAL SPEED',(29.78/Math.sqrt(planet.realDistance)).toFixed(1)+' km/s'],['ROTATION PERIOD',Math.abs(planet.rotPeriod)+' days'],['AXIAL TILT',planet.tilt+'deg'],['DIRECTION',planet.rotPeriod<0?'Retrograde':'Prograde']] as [string,string][]).map(([k,v])=>(
              <div key={k} className="flex justify-between gap-2 py-1.5 border-b border-white/5">
                <span className="text-white/30 tracking-widest text-[9px]">{k}</span><span className="text-white/70 text-[10px]">{v}</span>
              </div>
            ))}
            <div className="pt-3">
              <p className="text-[9px] text-white/30 tracking-widest mb-2">KEPLER 3RD LAW</p>
              <p className="text-[10px] text-white/50 leading-relaxed">
                T2 = a3<br/>
                {planet.period.toFixed(3)}2 = {(planet.period**2).toFixed(3)}<br/>
                {planet.realDistance.toFixed(3)}3 = {(planet.realDistance**3).toFixed(3)}<br/>
                <span className="text-white/30">Ratio T2/a3 = {((planet.period**2)/(planet.realDistance**3)).toFixed(3)} (ideal: 1.000)</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function SolarSystem() {
  const [speed,setSpeed]=useState(1);
  const [paused,setPaused]=useState(false);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [showLabels,setShowLabels]=useState(true);
  const [showBelt,setShowBelt]=useState(true);
  const [realScale,setRealScale]=useState(false);
  const planetPositions=useRef<Map<string,THREE.Vector3>>(new Map());
  const selectedPlanet=PLANETS.find(p=>p.id===selectedId)??null;
  const handleSelect=useCallback((id:string|null)=>setSelectedId(id),[]);

  return (
    <div className="relative w-full h-full bg-black font-mono select-none">
      <div className="absolute top-4 left-4 z-20 text-[10px] tracking-widest text-white/25 uppercase pointer-events-none">Solar System</div>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex gap-2 flex-wrap justify-center max-w-xl">
        <button onClick={()=>handleSelect('sun')} className={"text-[9px] tracking-widest transition-colors px-1 "+(selectedId==='sun'?'text-yellow-300':'text-white/25 hover:text-white/60')}>SUN</button>
        {PLANETS.map(p=>(
          <button key={p.id} onClick={()=>handleSelect(p.id)} className={"text-[9px] tracking-widest transition-colors px-1 "+(selectedId===p.id?'text-white':'text-white/25 hover:text-white/60')}>{p.name}</button>
        ))}
      </div>

      <div className="absolute bottom-4 left-4 z-20 flex flex-wrap items-center gap-3">
        <button onClick={()=>setPaused(p=>!p)} className="text-[10px] tracking-widest text-white/40 hover:text-white border border-white/10 hover:border-white/30 px-3 py-1.5 transition-colors">{paused?'> PLAY':'|| PAUSE'}</button>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-white/30 tracking-widest">SPEED</span>
          <input type="range" min={0.1} max={20} step={0.1} value={speed} onChange={e=>setSpeed(parseFloat(e.target.value))} className="w-20 accent-white/60 h-0.5"/>
          <span className="text-[9px] text-white/50 w-10">{speed.toFixed(1)}x</span>
        </div>
        {(['LABELS','BELT','REAL SCALE'] as const).map((label,i)=>{
          const active=i===0?showLabels:i===1?showBelt:realScale;
          const toggle=i===0?()=>setShowLabels(v=>!v):i===1?()=>setShowBelt(v=>!v):()=>setRealScale(v=>!v);
          return <button key={label} onClick={toggle} className={"text-[9px] tracking-widest border px-2 py-1 transition-colors "+(active?'border-white/30 text-white/60':'border-white/10 text-white/25')}>{label}</button>;
        })}
        {selectedId&&<button onClick={()=>handleSelect(null)} className="text-[9px] tracking-widest text-white/40 hover:text-white border border-white/10 hover:border-white/30 px-2 py-1 transition-colors">FREE CAM</button>}
      </div>

      <AnimatePresence>
        {selectedId==='sun'&&(
          <motion.div initial={{opacity:0,x:24}} animate={{opacity:1,x:0}} exit={{opacity:0,x:24}} transition={{duration:0.2}}
            className="absolute top-4 right-4 w-80 border border-white/10 bg-black/90 backdrop-blur-sm font-mono text-xs z-20">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
              <span className="text-yellow-300 tracking-widest text-sm">THE SUN</span>
              <button onClick={()=>handleSelect(null)} className="text-white/30 hover:text-white transition-colors text-lg leading-none">x</button>
            </div>
            <div className="px-3 py-3">
              {([['TYPE','G-type main-sequence star'],['AGE','4.6 billion years'],['DIAMETER','1,392,700 km (109x Earth)'],['MASS','1.989e30 kg (333,000x Earth)'],['SURFACE TEMP','5,500C'],['CORE TEMP','15,000,000C'],['ROTATION (equator)','25 Earth days'],['COMPOSITION','H2 73%, He 25%, other 2%'],['LUMINOSITY','3.828e26 W'],['DISTANCE FROM EARTH','149.6 million km (1 AU)']] as [string,string][]).map(([k,v])=>(
                <div key={k} className="flex justify-between gap-2 py-1.5 border-b border-white/5">
                  <span className="text-white/30 tracking-widest text-[9px] shrink-0">{k}</span>
                  <span className="text-white/70 text-[10px] text-right">{v}</span>
                </div>
              ))}
              <p className="text-white/40 text-[10px] leading-relaxed pt-3">The Sun contains 99.86% of all mass in the solar system. Light takes 8 min 20 sec to reach Earth.</p>
            </div>
          </motion.div>
        )}
        {selectedPlanet&&<StudyPanel planet={selectedPlanet} onClose={()=>handleSelect(null)}/>}
      </AnimatePresence>

      <PlanetPosCtx.Provider value={planetPositions}>
        <Canvas camera={{position:[0,40,80],fov:50}} gl={{antialias:true,alpha:false}} style={{background:'#000005'}} onClick={()=>handleSelect(null)}>
          <Suspense fallback={null}>
            <Scene speed={speed} paused={paused} selectedId={selectedId} onSelect={handleSelect} showLabels={showLabels} showBelt={showBelt} realScale={realScale}/>
          </Suspense>
        </Canvas>
      </PlanetPosCtx.Provider>
    </div>
  );
}
