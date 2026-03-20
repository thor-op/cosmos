'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Play, Pause, Calendar, Info, X } from 'lucide-react';

/* ─── Types ─── */
interface EpicImage {
  identifier: string;
  image: string;
  date: string;
  caption: string;
  centroid_coordinates: { lat: number; lon: number };
  dscovr_j2000_position: { x: number; y: number; z: number };
  sun_j2000_position: { x: number; y: number; z: number };
}


/* ─── Helpers ─── */
function imageUrl(img: EpicImage, type: 'natural' | 'enhanced' = 'natural') {
  const d = img.date.split(' ')[0]; // "YYYY-MM-DD"
  const [y, m, day] = d.split('-');
  return `https://epic.gsfc.nasa.gov/archive/${type}/${y}/${m}/${day}/jpg/${img.image}.jpg`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function formatTime(d: string) {
  return d.split(' ')[1]?.slice(0, 5) + ' UTC';
}

function distanceKm(pos: { x: number; y: number; z: number }) {
  return Math.round(Math.sqrt(pos.x ** 2 + pos.y ** 2 + pos.z ** 2)).toLocaleString();
}

/* ─── Main ─── */
export function EpicEarth() {
  const [images, setImages] = useState<EpicImage[]>([]);
  const [index, setIndex] = useState(0);
  const [type, setType] = useState<'natural' | 'enhanced'>('natural');
  const [loading, setLoading] = useState(true);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const fetchImages = useCallback(async (date?: string, collection = type) => {
    setLoading(true);
    setError(null);
    setImgLoaded(false);
    setIndex(0);
    try {
      const url = date
        ? `https://epic.gsfc.nasa.gov/api/${collection}/date/${date}`
        : `https://epic.gsfc.nasa.gov/api/${collection}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status}`);
      const data: EpicImage[] = await res.json();
      if (!data.length) throw new Error('NO IMAGES FOR THIS DATE');
      setImages(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [type]);

  // Fetch available dates for picker
  useEffect(() => {
    fetch(`https://epic.gsfc.nasa.gov/api/${type}/available`)
      .then(r => r.json())
      .then((d: string[]) => setAvailableDates([...d].reverse()))
      .catch(() => {});
  }, [type]);

  // Initial load
  useEffect(() => { fetchImages(); }, []);

  // Re-fetch when type changes
  useEffect(() => {
    if (images.length) fetchImages(selectedDate || undefined, type);
  }, [type]);

  // Autoplay
  useEffect(() => {
    if (playing && images.length > 1) {
      playRef.current = setInterval(() => {
        setIndex(i => (i + 1) % images.length);
        setImgLoaded(false);
      }, 1200);
    } else {
      if (playRef.current) clearInterval(playRef.current);
    }
    return () => { if (playRef.current) clearInterval(playRef.current); };
  }, [playing, images.length]);

  // Close picker on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const current = images[index] ?? null;
  const total = images.length;

  const prev = () => { setIndex(i => Math.max(0, i - 1)); setImgLoaded(false); };
  const next = () => { setIndex(i => Math.min(total - 1, i + 1)); setImgLoaded(false); };

  return (
    <div className="w-full h-full bg-black font-mono flex flex-col overflow-hidden">

      {/* ── TOP BAR ── */}
      <div className="flex items-stretch border-b border-white/10 bg-black/60 backdrop-blur-md shrink-0 z-20">
        <div className="flex items-center gap-3 px-6 py-3 border-r border-white/10">
          <span className="text-[9px] tracking-[0.35em] text-white/30 uppercase">MODULE</span>
          <span className="text-sm font-bold tracking-widest text-white">EPIC EARTH</span>
        </div>
        <div className="flex items-center px-5 py-3 border-r border-white/10 gap-1">
          {(['natural', 'enhanced'] as const).map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`text-[9px] tracking-[0.25em] uppercase px-3 py-1.5 border transition-colors duration-200 ${
                type === t ? 'border-white/20 text-white bg-white/10' : 'border-white/5 text-white/30 hover:text-white/60'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {current && (
          <>
            <div className="hidden md:flex items-center px-6 py-3 border-r border-white/10 gap-3">
              <span className="text-[9px] tracking-[0.3em] text-white/30 uppercase">DATE</span>
              <span className="text-sm text-white">{formatDate(current.date)}</span>
              <span className="text-[9px] text-white/30">{formatTime(current.date)}</span>
            </div>
            <div className="hidden md:flex items-center px-6 py-3 border-r border-white/10 gap-3">
              <span className="text-[9px] tracking-[0.3em] text-white/30 uppercase">CENTROID</span>
              <span className="text-sm text-white tabular-nums">
                {current.centroid_coordinates.lat.toFixed(2)}° {current.centroid_coordinates.lon.toFixed(2)}°
              </span>
            </div>
            <div className="hidden md:flex items-center px-6 py-3 gap-3">
              <span className="text-[9px] tracking-[0.3em] text-white/30 uppercase">DSCOVR DIST</span>
              <span className="text-sm text-white tabular-nums">{distanceKm(current.dscovr_j2000_position)} KM</span>
            </div>
          </>
        )}
        <div className="ml-auto flex items-center px-5 border-l border-white/10">
          <span className="text-[9px] tracking-[0.3em] text-white/20 uppercase">
            {loading ? 'LOADING...' : `${total} IMAGES`}
          </span>
        </div>
      </div>

      {/* ── MAIN VIEWPORT ── */}
      <div className="flex-1 relative overflow-hidden">

        {/* Image */}
        <AnimatePresence mode="wait">
          {current && (
            <motion.div
              key={current.identifier}
              initial={{ opacity: 0 }}
              animate={{ opacity: imgLoaded ? 1 : 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 flex items-center justify-center bg-black"
            >
              <img
                src={imageUrl(current, type)}
                alt={current.caption}
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgLoaded(true)}
                className="w-full h-full object-contain"
              />
              {/* subtle vignette */}
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.7) 100%)' }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading spinner */}
        {(loading || (current && !imgLoaded)) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
            <div className="w-6 h-6 rounded-full border-t border-white/30 animate-spin" />
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="border border-white/10 bg-black/80 px-8 py-6 flex flex-col gap-3">
              <span className="text-[9px] tracking-[0.3em] text-red-400 uppercase">ERROR · {error}</span>
              <button onClick={() => fetchImages()} className="text-[9px] tracking-[0.3em] text-white/40 hover:text-white uppercase transition-colors">
                → LOAD LATEST
              </button>
            </div>
          </div>
        )}

        {/* Frame counter — top right overlay */}
        {!loading && total > 0 && (
          <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-black/50 backdrop-blur-sm px-3 py-1.5 border border-white/10">
            <span className="text-[9px] tracking-[0.3em] text-white/40 tabular-nums">
              {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
            </span>
          </div>
        )}

        {/* Filmstrip thumbnails — bottom overlay */}
        {!loading && images.length > 1 && (
          <div className="absolute bottom-0 left-0 right-0 z-10 flex gap-1 px-4 pb-3 pt-8 overflow-x-auto [&::-webkit-scrollbar]:hidden"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)' }}
          >
            {images.map((img, i) => (
              <button
                key={img.identifier}
                onClick={() => { setIndex(i); setImgLoaded(false); }}
                className={`shrink-0 w-12 h-12 overflow-hidden border transition-all duration-200 ${
                  i === index ? 'border-white/60 opacity-100' : 'border-white/10 opacity-40 hover:opacity-70'
                }`}
              >
                <img
                  src={imageUrl(img, type)}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}

        {/* Info panel */}
        <AnimatePresence>
          {showInfo && current && (
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="absolute top-0 right-0 bottom-0 z-20 w-full max-w-xs border-l border-white/10 bg-black/85 backdrop-blur-xl flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                <span className="text-[9px] tracking-[0.35em] text-white/30 uppercase">IMAGE DATA</span>
                <button onClick={() => setShowInfo(false)} className="text-white/30 hover:text-white transition-colors">
                  <X size={14} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6 [&::-webkit-scrollbar]:hidden">
                <div>
                  <div className="text-[9px] tracking-[0.3em] text-white/30 uppercase mb-1">IDENTIFIER</div>
                  <div className="text-xs text-white/60 break-all">{current.identifier}</div>
                </div>
                <div>
                  <div className="text-[9px] tracking-[0.3em] text-white/30 uppercase mb-1">CAPTURED</div>
                  <div className="text-sm text-white">{formatDate(current.date)}</div>
                  <div className="text-xs text-white/40">{formatTime(current.date)}</div>
                </div>
                <div>
                  <div className="text-[9px] tracking-[0.3em] text-white/30 uppercase mb-1">CENTROID</div>
                  <div className="text-sm text-white tabular-nums">
                    {current.centroid_coordinates.lat.toFixed(4)}° N<br />
                    {current.centroid_coordinates.lon.toFixed(4)}° E
                  </div>
                </div>
                {[
                  { label: 'DSCOVR POSITION', pos: current.dscovr_j2000_position },
                  { label: 'SUN POSITION', pos: current.sun_j2000_position },
                ].map(({ label, pos }) => (
                  <div key={label}>
                    <div className="text-[9px] tracking-[0.3em] text-white/30 uppercase mb-2">{label}</div>
                    <div className="grid grid-cols-3 gap-2">
                      {(['x', 'y', 'z'] as const).map(ax => (
                        <div key={ax} className="bg-white/[0.03] border border-white/5 px-2 py-2">
                          <div className="text-[8px] text-white/20 uppercase mb-0.5">{ax}</div>
                          <div className="text-[10px] text-white/60 tabular-nums">{Math.round(pos[ax]).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                    <div className="text-[8px] text-white/20 mt-1">km · J2000</div>
                  </div>
                ))}
                <div>
                  <div className="text-[9px] tracking-[0.3em] text-white/30 uppercase mb-1">CAPTION</div>
                  <p className="text-xs text-white/40 leading-relaxed">{current.caption}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── BOTTOM BAR ── */}
      <div className="flex items-stretch border-t border-white/10 bg-black/60 backdrop-blur-md shrink-0 z-20">

        {/* Prev */}
        <button
          onClick={prev}
          disabled={index === 0 || loading}
          className="flex items-center gap-2 px-5 py-3 border-r border-white/10 text-white/40 hover:text-white hover:bg-white/5 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={14} />
          <span className="text-[9px] tracking-[0.3em] uppercase hidden md:block">PREV</span>
        </button>

        {/* Play/Pause */}
        <button
          onClick={() => setPlaying(p => !p)}
          disabled={loading || total < 2}
          className={`flex items-center gap-2 px-5 py-3 border-r border-white/10 transition-all disabled:opacity-20 ${
            playing ? 'text-white bg-white/5' : 'text-white/40 hover:text-white hover:bg-white/5'
          }`}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
          <span className="text-[9px] tracking-[0.3em] uppercase hidden md:block">{playing ? 'PAUSE' : 'PLAY'}</span>
        </button>

        {/* Date picker */}
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setShowPicker(p => !p)}
            className={`flex items-center gap-2 px-5 py-3 border-r border-white/10 transition-all ${
              showPicker ? 'text-white bg-white/5' : 'text-white/40 hover:text-white hover:bg-white/5'
            }`}
          >
            <Calendar size={14} />
            <span className="text-[9px] tracking-[0.3em] uppercase hidden md:block">DATE</span>
          </button>

          <AnimatePresence>
            {showPicker && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full mb-2 left-0 bg-[#0e0e0e] border border-white/10 shadow-2xl min-w-[200px]"
              >
                <div className="px-4 py-3 border-b border-white/10">
                  <span className="text-[9px] tracking-[0.3em] text-white/30 uppercase">SELECT DATE</span>
                </div>
                <div className="max-h-56 overflow-y-auto [&::-webkit-scrollbar]:hidden">
                  {availableDates.slice(0, 60).map(d => (
                    <button
                      key={d}
                      onClick={() => {
                        setSelectedDate(d);
                        fetchImages(d, type);
                        setShowPicker(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-[10px] tracking-wider border-b border-white/5 transition-colors hover:bg-white/5 ${
                        d === selectedDate ? 'text-white bg-white/5' : 'text-white/40'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Latest */}
        <button
          onClick={() => { setSelectedDate(''); fetchImages(undefined, type); }}
          className="flex items-center gap-2 px-5 py-3 border-r border-white/10 text-white/40 hover:text-white hover:bg-white/5 transition-all"
        >
          <span className="text-[9px] tracking-[0.3em] uppercase">LATEST</span>
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* NOAA credit */}
        <div className="hidden md:flex items-center px-6 border-l border-white/10">
          <span className="text-[9px] tracking-[0.25em] text-white/15 uppercase">DSCOVR · EPIC · NASA / NOAA</span>
        </div>

        {/* Info */}
        <button
          onClick={() => setShowInfo(p => !p)}
          className={`flex items-center gap-2 px-5 py-3 border-l border-white/10 transition-all ${
            showInfo ? 'text-white bg-white/5' : 'text-white/40 hover:text-white hover:bg-white/5'
          }`}
        >
          {showInfo ? <X size={14} /> : <Info size={14} />}
          <span className="text-[9px] tracking-[0.3em] uppercase hidden md:block">{showInfo ? 'CLOSE' : 'DATA'}</span>
        </button>

        {/* Next */}
        <button
          onClick={next}
          disabled={index === total - 1 || loading}
          className="flex items-center gap-2 px-5 py-3 border-l border-white/10 text-white/40 hover:text-white hover:bg-white/5 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
        >
          <span className="text-[9px] tracking-[0.3em] uppercase hidden md:block">NEXT</span>
          <ChevronRight size={14} />
        </button>
      </div>

    </div>
  );
}
