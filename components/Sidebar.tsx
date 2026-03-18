'use client';

import { motion } from 'motion/react';
import { Compass, Orbit, Satellite, Info, ImageIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type ModuleType = 'mars' | 'neo' | 'iss' | 'apod' | 'about';

interface SidebarProps {
  activeModule: ModuleType;
  setActiveModule: (module: ModuleType) => void;
}

export function Sidebar({ activeModule, setActiveModule }: SidebarProps) {
  const navItems = [
    { id: 'mars', label: 'MARS', icon: Compass, color: 'bg-[var(--color-mars)]' },
    { id: 'neo', label: 'NEO', icon: Orbit, color: 'bg-[var(--color-neo)]' },
    { id: 'iss', label: 'ISS', icon: Satellite, color: 'bg-[var(--color-iss)]' },
    { id: 'apod', label: 'APOD', icon: ImageIcon, color: 'bg-purple-400' },
    { id: 'about', label: 'ABOUT', icon: Info, color: 'bg-white' },
  ] as const;

  return (
    <nav className="fixed top-0 left-0 w-full h-16 md:w-16 md:h-full border-b md:border-b-0 md:border-r border-white/10 bg-[#080808]/80 backdrop-blur-md z-50 flex md:flex-col items-center justify-between md:justify-center px-4 md:px-0 py-0 md:py-8">
      <div className="hidden md:flex flex-col items-center gap-2 mb-auto">
        <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center">
          <span className="text-xs font-bold tracking-tighter">CO</span>
        </div>
      </div>

      <div className="flex md:flex-col items-center gap-8 md:gap-12 w-full md:w-auto justify-center">
        {navItems.map((item) => {
          const isActive = activeModule === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveModule(item.id)}
              className={twMerge(
                "relative flex flex-col items-center gap-1 group transition-colors duration-300",
                isActive ? "text-white" : "text-white/40 hover:text-white/80"
              )}
            >
              <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
              <span className="text-[10px] font-mono tracking-widest uppercase mt-1 md:hidden">
                {item.label}
              </span>
              
              {isActive && (
                <motion.div
                  layoutId="activeIndicator"
                  className={twMerge("absolute -bottom-3 md:-right-4 md:bottom-auto md:top-1/2 md:-translate-y-1/2 w-1.5 h-1.5 rounded-full", item.color)}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="hidden md:block mt-auto">
        <div className="w-1 h-1 rounded-full bg-white/20" />
      </div>
    </nav>
  );
}
