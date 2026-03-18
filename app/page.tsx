'use client';

import { useState } from 'react';
import { Sidebar, ModuleType } from '@/components/Sidebar';
import { MarsWeather } from '@/components/MarsWeather';
import { NeoTracker } from '@/components/NeoTracker';
import { IssTracker } from '@/components/IssTracker';
import { About } from '@/components/About';
import { Apod } from '@/components/Apod';
import { AnimatePresence, motion } from 'motion/react';

export default function Home() {
  const [activeModule, setActiveModule] = useState<ModuleType>('mars');

  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-white overflow-hidden relative">
      <Sidebar activeModule={activeModule} setActiveModule={setActiveModule} />
      
      <div className="pt-16 md:pt-0 md:pl-16 h-screen w-full relative">
        <AnimatePresence mode="wait">
          {activeModule === 'mars' && (
            <motion.div
              key="mars"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="h-full w-full"
            >
              <MarsWeather />
            </motion.div>
          )}
          {activeModule === 'neo' && (
            <motion.div
              key="neo"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="h-full w-full"
            >
              <NeoTracker />
            </motion.div>
          )}
          {activeModule === 'iss' && (
            <motion.div
              key="iss"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="h-full w-full"
            >
              <IssTracker />
            </motion.div>
          )}
          {activeModule === 'apod' && (
            <motion.div
              key="apod"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="h-full w-full"
            >
              <Apod />
            </motion.div>
          )}
          {activeModule === 'about' && (
            <motion.div
              key="about"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="h-full w-full"
            >
              <About />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 text-[10px] font-mono text-white/20 tracking-widest hidden md:block whitespace-nowrap">
        NASA API · api.nasa.gov
      </div>
    </main>
  );
}
