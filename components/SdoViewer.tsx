'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';

/* ─── GOES-19 SUVI wavelength catalogue ─── */
const WAVELENGTHS = [
  { id: '171', label: '171 Å', desc: 'Extreme UV · Corona loops',       color: '#c8a84b' },
  { id: '304', label: '304 Å', desc: 'Chromosphere · Prominences',      color: '#e8622a' },
  { id: '195', label: '195 Å', desc: 'Hot corona · Active regions',     color: '#5bc8c8' },
  { id: '284', label: '284 Å', desc: 'Upper corona · 2M K plasma',      color: '#c87dd4' },
  { id: '131', label: '131 Å', desc: 'Flare peaks · 10M K plasma',      color: '#4fc3f7' },
  { id: '094', label: '94 Å',  desc: 'Flare regions · 6M K plasma',     color: '#4ade80' },
] as const;

type WavelengthId = typeof WAVELENGTHS[number]['id'];

const SUVI_BASE = 'https://services.swpc.noaa.gov/images/animations/suvi/primary';

function suviUrl(id: WavelengthId) {
  return `${SUVI_BASE}/${id}/latest.png`;
}

export function SdoViewer() {
  const [active, setActive]     = useState<WavelengthId>('171');
  const [loaded, setLoaded]     = useState(false);
  const [ts, setTs]             = useState(Date.now());
  const [autoplay, setAutoplay] = useState(false);
  const [autoIdx, setAutoIdx]   = useState(0);
  const [infoOpen, setInfoOpen] = useState(false);

  const current = WAVELENGTHS.find(w => w.id === active)!;

  useEffect(() => {
    if (!autoplay) return;
    const id = setInterval(() => {
      setAutoIdx(i => {
        const next = (i + 1) % WAVELENGTHS.length;
        setActive(WAVELENGTHS[next].id);
        setLoaded(false);
        return next;
      });
    }, 2200);
    return () => clearInterval(id);
  }, [autoplay]);

  const refresh = useCallback(() => {
    setLoaded(false);
    setTs(Date.now());
  }, []);

  const select = (id: WavelengthId) => {
    setAutoplay(false);
    setActive(id);
    setLoaded(false);
  };

  return (
    <div className="w-full h-full bg-[#080808] text-white font-mono overflow-hidden flex flex-col">

      {/* ── TOP BAR ── */}
      <div className="flex items-stretch border-b border-white/10 bg-black/40 shrink-0">
        <div className="flex items-center gap-3 px-6 py-3 border-r border-white/10">
          <span className="text-[9px] tracking-[0.35em] text-white/30 uppercase">MODULE</span>
          <span className="text-sm font-bold tracking-widest text-white">GOES-19 · SOLAR ULTRAVIOLET IMAGER</span>
        </div>
        <div className="flex items-center px-6 py-3 border-r border-white/10 gap-2">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: current.color }} />
          <span className="text-[9px] tracking-[0.3em] text-white/30 uppercase">{current.label} · {current.desc}</span>
        </div>
        <div className="flex items-center gap-6 px-6 py-3 ml-auto">
          <button onClick={refresh} className="text-[9px] tracking-[0.3em] text-white/30 hover:text-white/70 uppercase transition-colors">
            REFRESH
          </button>
          <button
            onClick={() => setAutoplay(a => !a)}
            className="text-[9px] tracking-[0.3em] uppercase transition-colors"
            style={{ color: autoplay ? current.color : 'rgba(255,255,255,0.3)' }}
          >
            {autoplay ? '■ STOP' : '▶ AUTOPLAY'}
          </button>
          <button onClick={() => setInfoOpen(o => !o)} className="text-[9px] tracking-[0.3em] text-white/30 hover:text-white/70 uppercase transition-colors">
            INFO
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ── WAVELENGTH STRIP ── */}
        <div className="w-28 shrink-0 border-r border-white/10 flex flex-col">
          {WAVELENGTHS.map((w) => (
            <button
              key={w.id}
              onClick={() => select(w.id)}
              className="relative flex flex-col items-start px-4 py-4 border-b border-white/5 hover:bg-white/[0.03] transition-colors text-left flex-1"
            >
              {active === w.id && (
                <motion.div
                  layoutId="waveActive"
                  className="absolute inset-0"
                  style={{ backgroundColor: `${w.color}12`, borderLeft: `2px solid ${w.color}` }}
                  transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                />
              )}
              <span className="text-xs font-bold tracking-tight relative z-10" style={{ color: active === w.id ? w.color : 'rgba(255,255,255,0.35)' }}>
                {w.label}
              </span>
              <span className="text-[8px] text-white/20 leading-tight mt-1 relative z-10 line-clamp-2">
                {w.desc}
              </span>
            </button>
          ))}
        </div>

        {/* ── MAIN IMAGE ── */}
        <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-black">
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="w-8 h-8 rounded-full border-t-2 animate-spin" style={{ borderColor: current.color }} />
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={`${active}-${ts}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: loaded ? 1 : 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="w-full h-full flex items-center justify-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${suviUrl(active)}?_t=${ts}`}
                alt={`GOES-19 SUVI ${current.label}`}
                onLoad={() => setLoaded(true)}
                onError={() => setLoaded(true)}
                className="max-w-full max-h-full object-contain"
                style={{ filter: 'brightness(1.05) contrast(1.08)' }}
              />
            </motion.div>
          </AnimatePresence>

          {/* bottom-left label */}
          <div className="absolute bottom-4 left-4 pointer-events-none">
            <div className="text-[9px] tracking-[0.3em] text-white/20 uppercase">NOAA / GOES-19 / SUVI</div>
            <div className="text-xs font-bold tracking-widest mt-0.5" style={{ color: current.color }}>
              {current.label}
            </div>
          </div>

          {/* bottom-right note */}
          <div className="absolute bottom-4 right-4 text-[8px] text-white/15 tracking-widest pointer-events-none text-right">
            UPDATED EVERY FEW MINUTES<br />services.swpc.noaa.gov
          </div>
        </div>

        {/* ── INFO PANEL ── */}
        <AnimatePresence>
          {infoOpen && (
            <motion.div
              initial={{ x: 300 }}
              animate={{ x: 0 }}
              exit={{ x: 300 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="w-72 shrink-0 border-l border-white/10 bg-[#080808] overflow-y-auto flex flex-col [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <span className="text-[9px] tracking-[0.4em] text-white/30 uppercase">ABOUT SUVI</span>
                <button onClick={() => setInfoOpen(false)} className="text-white/30 hover:text-white/70 text-xs">✕</button>
              </div>
              <div className="px-6 py-6 flex flex-col gap-5 text-[11px] text-white/40 leading-relaxed">
                <p>
                  GOES-19 SUVI (Solar Ultraviolet Imager) captures full-disk images of the Sun in six extreme ultraviolet wavelengths, updated every few minutes.
                </p>
                <p>
                  Each wavelength reveals a different temperature layer — from the chromosphere at ~50,000 K up to flare plasma exceeding 10 million K.
                </p>
                <div className="border-t border-white/5 pt-4 flex flex-col gap-0">
                  <div className="text-[9px] tracking-[0.3em] text-white/20 uppercase mb-3">WAVELENGTH GUIDE</div>
                  {WAVELENGTHS.map(w => (
                    <div key={w.id} className="flex items-start gap-3 py-2.5 border-b border-white/5">
                      <span className="text-xs font-bold w-14 shrink-0" style={{ color: w.color }}>{w.label}</span>
                      <span className="text-[10px] text-white/30">{w.desc}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-white/5 pt-4">
                  <div className="text-[9px] tracking-[0.3em] text-white/20 uppercase mb-2">DATA SOURCE</div>
                  <p className="text-[10px] text-white/25">NOAA Space Weather Prediction Center<br />services.swpc.noaa.gov</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
