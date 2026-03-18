'use client';

import { useEffect, useState } from 'react';
import { CountUp } from './CountUp';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface EarthData {
  temp: number;
  wind: number;
  pressure: number;
  season: string;
  location: string;
}

interface MarsData {
  sol: string;
  date: string;
  temp: { min: number; max: number; avg: number };
  wind: number;
  pressure: number;
  season: string;
}

export function MarsWeather() {
  const [earthData, setEarthData] = useState<EarthData | null>(null);
  const [marsData, setMarsData] = useState<MarsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredMetric, setHoveredMetric] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch Earth weather
        let lat, lon;
        try {
          if ('geolocation' in navigator) {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
            });
            lat = pos.coords.latitude;
            lon = pos.coords.longitude;
          }
        } catch (e) {
          // ignore, fallback to IP
        }
        
        let earthWeather = {
          temp: 15,
          wind: 10,
          pressure: 1013,
          season: 'Spring',
          location: 'Earth',
        };

        try {
          const earthUrl = lat && lon 
            ? `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
            : `https://api.open-meteo.com/v1/forecast?latitude=51.5074&longitude=-0.1278&current_weather=true`;
          const earthRes = await fetch(earthUrl);
          if (earthRes.ok) {
            const earthJson = await earthRes.json();
            const current = earthJson.current_weather;
            earthWeather.temp = current.temperature;
            earthWeather.wind = current.windspeed;
            earthWeather.location = lat && lon ? 'Local' : 'London';
          }
        } catch (e) {
          console.warn('Earth weather fetch failed, using fallback', e);
        }
        
        // Simple season calculation for Earth (Northern Hemisphere assumption for demo)
        const month = new Date().getMonth();
        let season = 'Winter';
        if (month >= 2 && month <= 4) season = 'Spring';
        else if (month >= 5 && month <= 7) season = 'Summer';
        else if (month >= 8 && month <= 10) season = 'Autumn';
        earthWeather.season = season;

        setEarthData(earthWeather);

        // Fetch Mars weather (InSight)
        const apiKey = process.env.NEXT_PUBLIC_NASA_API_KEY;
        const marsRes = await fetch(`https://api.nasa.gov/insight_weather/?api_key=${apiKey}&feedtype=json&ver=1.0`);
        
        if (!marsRes.ok) {
          throw new Error(`Mars API returned ${marsRes.status}`);
        }
        
        const marsJson = await marsRes.json();
        
        const solKeys = marsJson.sol_keys;
        if (solKeys && solKeys.length > 0) {
          const latestSol = solKeys[solKeys.length - 1];
          const data = marsJson[latestSol];
          
          setMarsData({
            sol: latestSol,
            date: new Date(data.First_UTC).toLocaleDateString(),
            temp: {
              min: data.AT?.mn || -95,
              max: data.AT?.mx || -10,
              avg: data.AT?.av || -60,
            },
            wind: data.HWS?.av || 5.5,
            pressure: data.PRE?.av || 715,
            season: data.Season || 'winter',
          });
        } else {
          // Fallback data if API returns empty (InSight mission ended)
          setMarsData({
            sol: '1011',
            date: '2021-09-27',
            temp: { min: -96.5, max: -12.3, avg: -62.1 },
            wind: 6.2,
            pressure: 718.5,
            season: 'summer',
          });
        }
      } catch (error) {
        console.error('Failed to fetch weather data', error);
        // Fallback data
        setMarsData({
          sol: '1011',
          date: '2021-09-27',
          temp: { min: -96.5, max: -12.3, avg: -62.1 },
          wind: 6.2,
          pressure: 718.5,
          season: 'summer',
        });
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-t-2 border-[var(--color-mars)] animate-spin" />
      </div>
    );
  }

  const MetricRow = ({ id, label, earthVal, marsVal, unit, differential }: { id: string, label: string, earthVal: React.ReactNode, marsVal: React.ReactNode, unit: string, differential?: string }) => {
    const isHovered = hoveredMetric === id;
    
    return (
      <div 
        className={twMerge(
          "grid grid-cols-[1fr_auto_1fr] gap-8 py-6 border-b border-white/5 transition-colors duration-300 relative",
          isHovered ? "bg-white/5" : ""
        )}
        onMouseEnter={() => setHoveredMetric(id)}
        onMouseLeave={() => setHoveredMetric(null)}
      >
        <div className="text-right flex items-baseline justify-end gap-2">
          <span className="font-mono text-2xl md:text-4xl tracking-tighter">{earthVal}</span>
          <span className="text-white/40 text-xs">{unit}</span>
        </div>
        <div className="text-center w-24 flex flex-col items-center justify-center relative">
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">{label}</span>
          {differential && (
            <div className="absolute top-[calc(50%+14px)] left-1/2 -translate-x-1/2 z-10 bg-[#080808] px-2.5 py-0.5 rounded-full border border-white/10 flex items-center gap-1.5 shadow-xl">
              <span className="text-white/40 text-[9px]">Δ</span>
              <span className="text-[10px] font-mono text-[var(--color-mars)] whitespace-nowrap">{differential}</span>
            </div>
          )}
        </div>
        <div className="text-left flex items-baseline justify-start gap-2">
          <span className="font-mono text-2xl md:text-4xl tracking-tighter text-[var(--color-mars)]">{marsVal}</span>
          <span className="text-[var(--color-mars)]/40 text-xs">{unit}</span>
        </div>
      </div>
    );
  };

  const getTempDiff = () => {
    if (!earthData || !marsData) return undefined;
    const diff = Math.round(earthData.temp - marsData.temp.avg);
    return `${Math.abs(diff)}°C colder`;
  };

  return (
    <div className="w-full h-full flex flex-col md:flex-row relative">
      <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-white/10 hidden md:block -translate-x-1/2 z-20" />
      
      {/* Earth Side */}
      <div className="flex-1 flex flex-col p-8 md:p-16 justify-center relative overflow-hidden">
        {/* Earth Atmosphere/Cloud static */}
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle at 30% 30%, rgba(59, 130, 246, 0.15) 0%, transparent 70%)' }} />
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-screen" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.015' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>
        
        <div className="absolute top-8 left-8 md:top-16 md:left-16 z-10">
          <h2 className="text-4xl md:text-6xl font-bold tracking-tighter opacity-10">EARTH</h2>
          <p className="font-mono text-xs text-white/40 mt-2 uppercase tracking-widest">{earthData?.location || 'LOCAL'}</p>
          <p className="font-mono text-xs text-white/40 mt-1 uppercase tracking-widest">CURRENT</p>
        </div>
      </div>

      {/* Mars Side */}
      <div className="flex-1 flex flex-col p-8 md:p-16 justify-center relative overflow-hidden">
        {/* Mars Dust/Atmosphere static */}
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle at 70% 30%, rgba(239, 68, 68, 0.1) 0%, transparent 70%)' }} />
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-screen" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>

        <div className="absolute top-8 right-8 md:top-16 md:right-16 text-right z-10">
          <h2 className="text-4xl md:text-6xl font-bold tracking-tighter text-[var(--color-mars)] opacity-20">MARS</h2>
          <p className="font-mono text-xs text-[var(--color-mars)]/60 mt-2 uppercase tracking-widest">ELYSIUM PLANITIA</p>
          <p className="font-mono text-xs text-[var(--color-mars)]/60 mt-1 uppercase tracking-widest">SOL {marsData?.sol}</p>
        </div>
      </div>

      {/* Center Data Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-30">
        <div className="w-full max-w-4xl px-8 pointer-events-auto">
          <MetricRow 
            id="temp" 
            label="TEMP" 
            earthVal={<CountUp value={earthData?.temp || 0} />} 
            marsVal={<CountUp value={marsData?.temp.avg || 0} />} 
            unit="°C" 
            differential={getTempDiff()}
          />
          <MetricRow 
            id="wind" 
            label="WIND" 
            earthVal={<CountUp value={earthData?.wind || 0} decimals={1} />} 
            marsVal={<CountUp value={marsData?.wind || 0} decimals={1} />} 
            unit="KM/H" 
          />
          <MetricRow 
            id="pressure" 
            label="PRESSURE" 
            earthVal={<CountUp value={earthData?.pressure || 0} />} 
            marsVal={<CountUp value={marsData?.pressure || 0} />} 
            unit="HPA" 
          />
          <div 
            className={twMerge(
              "grid grid-cols-[1fr_auto_1fr] gap-8 py-6 transition-colors duration-300",
              hoveredMetric === 'season' ? "bg-white/5" : ""
            )}
            onMouseEnter={() => setHoveredMetric('season')}
            onMouseLeave={() => setHoveredMetric(null)}
          >
            <div className="text-right">
              <span className="font-mono text-xl md:text-2xl tracking-widest uppercase">{earthData?.season}</span>
            </div>
            <div className="text-center w-24 flex items-center justify-center">
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">SEASON</span>
            </div>
            <div className="text-left">
              <span className="font-mono text-xl md:text-2xl tracking-widest uppercase text-[var(--color-mars)]">{marsData?.season}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status Footer */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center w-full">
        <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">
          Last recorded sol: {marsData?.sol} ({marsData?.date}) • InSight Mission Ended
        </p>
      </div>
    </div>
  );
}
