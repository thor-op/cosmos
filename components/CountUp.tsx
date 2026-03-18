'use client';

import { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'motion/react';

interface CountUpProps {
  value: number;
  decimals?: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
}

export function CountUp({ value, decimals = 0, duration = 2, suffix = '', prefix = '' }: CountUpProps) {
  const [hasMounted, setHasMounted] = useState(false);
  const spring = useSpring(0, { duration: duration * 1000, bounce: 0 });
  
  useEffect(() => {
    setHasMounted(true);
    spring.set(value);
  }, [value, spring]);

  const display = useTransform(spring, (current) => {
    return `${prefix}${current.toFixed(decimals)}${suffix}`;
  });

  if (!hasMounted) {
    return <span>{prefix}{value.toFixed(decimals)}{suffix}</span>;
  }

  return <motion.span>{display}</motion.span>;
}
