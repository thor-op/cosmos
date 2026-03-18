'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Calendar, Info, X } from 'lucide-react';

interface ApodData {
  date: string;
  title: string;
  explanation: string;
  url: string;
  hdurl?: string;
  media_type: 'image' | 'video';
  copyright?: string;
}

function formatDate(d: Date) {
  return d.toISOString().split('T')[0];
}

function parseDate(s: string) {
  const [y, m, day] = s.split('-').map(Number);
  return new Date(y, m - 1, day);
}

const MIN_DATE = new Date(1995, 5, 16); // June 16 1995 — first APOD

export function Apod() {
  const [date, setDate] = useState<Date>(new Date());
  const [data, setData] = useState<ApodData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [imgLoaded, setImgLoaded] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setImgLoaded(false);
    const apiKey = process.env.NEXT_PUBLIC_NASA_API_KEY;
    fetch(`https://api.nasa.gov/planetary/apod?api_key=${apiKey}&date=${formatDate(date)}`)
      .then(r => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((d: ApodData) => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [date]);

  // close picker on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const go = (delta: number) => {
    setDate(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() + delta);
      if (next < MIN_DATE || next > new Date()) return prev;
      return next;
    });
  };

  const applyPicker = () => {
    const d = parseDate(inputVal);
    if (!isNaN(d.getTime()) && d >= MIN_DATE && d <= new Date()) {
      setDate(d);
      setShowPicker(false);
    }
  };

  const today = new Date();
  const isToday = formatDate(date) === formatDate(today);
  const isMin = formatDate(date) === formatDate(MIN_DATE);

  return (
    <div className="w-full h-full relative bg-black overflow-hidden font-mono">

      {/* ── BACKGROUND IMAGE ── */}
      <AnimatePresence mode="wait">
        {data?.media_type === 'image' && (
          <motion.div
            key={data.url}
            initial={{ opacity: 0 }}
            animate={{ opacity: imgLoaded ? 1 : 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 z-0"
          >
            <img
              src={data.hdurl || data.url}
              alt={data.title}
              onLoad={() => setImgLoaded(true)}
              className="w-full h-full object-cover"
            />
            {/* gradient vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/40" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* video fallback */}
      {data?.media_type === 'video' && (
        <div className="absolute inset-0 z-0 flex items-center justify-center bg-black">
          <iframe
            src={data.url}
            className="w-full h-full"
            frameBorder="0"
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40 pointer-events-none" />
        </div>
      )}

      {/* loading shimmer */}
      {loading && (
        <div className="absolute inset-0 z-0 bg-[#080808]">
          <div className="absolute inset-0 opacity-5"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full border-t border-white/30 animate-spin" />
          </div>
        </div>
      )}

      {/* ── TOP BAR ── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-stretch border-b border-white/10 bg-black/50 backdrop-blur-md">
        <div className="flex items-center gap-3 px-6 py-3 border-r border-white/10">
          <span className="text-[9px] tracking-[0.35em] text-white/30 uppercase">MODULE</span>
          <span className="text-sm font-bold tracking-widest text-white">APOD</span>
        </div>
        <div className="flex items-center px-6 py-3 border-r border-white/10 gap-3">
          <span className="text-[9px] tracking-[0.35em] text-white/30 uppercase">DATE</span>
          <span className="text-sm text-white tracking-wider">{formatDate(date)}</span>
        </div>
        {data && (
          <div className="flex items-center px-6 py-3 flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.span
                key={data.title}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.3 }}
                className="text-sm text-white/50 truncate tracking-wide"
              >
                {data.title}
              </motion.span>
            </AnimatePresence>
          </div>
        )}
        {data?.copyright && (
          <div className="hidden md:flex items-center px-6 border-l border-white/10">
            <span className="text-[9px] tracking-[0.25em] text-white/20 uppercase">© {data.copyright.trim()}</span>
          </div>
        )}
      </div>

      {/* ── BOTTOM HUD ── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex items-stretch border-t border-white/10 bg-black/50 backdrop-blur-md">

        {/* Prev */}
        <button
          onClick={() => go(-1)}
          disabled={isMin}
          className="flex items-center gap-2 px-5 py-3 border-r border-white/10 text-white/40 hover:text-white hover:bg-white/5 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={14} />
          <span className="text-[9px] tracking-[0.3em] uppercase hidden md:block">PREV</span>
        </button>

        {/* Date picker trigger */}
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => { setShowPicker(p => !p); setInputVal(formatDate(date)); }}
            className="flex items-center gap-2 px-5 py-3 border-r border-white/10 text-white/40 hover:text-white hover:bg-white/5 transition-all"
          >
            <Calendar size={14} />
            <span className="text-[9px] tracking-[0.3em] uppercase hidden md:block">JUMP TO DATE</span>
          </button>

          <AnimatePresence>
            {showPicker && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full mb-2 left-0 bg-[#0e0e0e] border border-white/10 p-4 flex flex-col gap-3 min-w-[220px] shadow-2xl"
              >
                <span className="text-[9px] tracking-[0.3em] text-white/30 uppercase">SELECT DATE</span>
                <input
                  type="date"
                  value={inputVal}
                  min={formatDate(MIN_DATE)}
                  max={formatDate(today)}
                  onChange={e => setInputVal(e.target.value)}
                  className="bg-white/5 border border-white/10 text-white text-xs px-3 py-2 tracking-wider focus:outline-none focus:border-white/30 transition-colors [color-scheme:dark]"
                />
                <button
                  onClick={applyPicker}
                  className="bg-white/10 hover:bg-white/20 text-white text-[9px] tracking-[0.3em] uppercase py-2 transition-colors"
                >
                  GO
                </button>
                <p className="text-[8px] text-white/20 tracking-wider">APOD archive: Jun 16, 1995 → today</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Today */}
        <button
          onClick={() => setDate(new Date())}
          disabled={isToday}
          className="flex items-center gap-2 px-5 py-3 border-r border-white/10 text-white/40 hover:text-white hover:bg-white/5 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
        >
          <span className="text-[9px] tracking-[0.3em] uppercase">TODAY</span>
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Info toggle */}
        <button
          onClick={() => setShowInfo(p => !p)}
          className={`flex items-center gap-2 px-5 py-3 border-l border-white/10 transition-all ${showInfo ? 'text-white bg-white/5' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
        >
          {showInfo ? <X size={14} /> : <Info size={14} />}
          <span className="text-[9px] tracking-[0.3em] uppercase hidden md:block">{showInfo ? 'CLOSE' : 'ABOUT IMAGE'}</span>
        </button>

        {/* Next */}
        <button
          onClick={() => go(1)}
          disabled={isToday}
          className="flex items-center gap-2 px-5 py-3 border-l border-white/10 text-white/40 hover:text-white hover:bg-white/5 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
        >
          <span className="text-[9px] tracking-[0.3em] uppercase hidden md:block">NEXT</span>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* ── INFO PANEL ── */}
      <AnimatePresence>
        {showInfo && data && (
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-[53px] bottom-[49px] right-0 z-20 w-full max-w-sm border-l border-white/10 bg-black/80 backdrop-blur-xl flex flex-col overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto p-8 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <p className="text-[9px] tracking-[0.35em] text-white/30 uppercase mb-4">{data.date}</p>
              <h2 className="text-xl font-bold tracking-tight text-white leading-snug mb-6">{data.title}</h2>
              {data.copyright && (
                <p className="text-[9px] tracking-[0.25em] text-white/30 uppercase mb-6">© {data.copyright.trim()}</p>
              )}
              <p className="text-xs text-white/50 leading-relaxed">{data.explanation}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ERROR ── */}
      {error && !loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="border border-white/10 bg-black/80 px-8 py-6 flex flex-col gap-3">
            <span className="text-[9px] tracking-[0.3em] text-red-400 uppercase">ERROR {error}</span>
            <span className="text-xs text-white/40">Could not load APOD for {formatDate(date)}</span>
            <button onClick={() => setDate(new Date())} className="text-[9px] tracking-[0.3em] text-white/60 hover:text-white uppercase transition-colors">
              → BACK TO TODAY
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
