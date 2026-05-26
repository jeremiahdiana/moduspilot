'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

interface Props {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  distance?: number;
}

export default function RevealSection({
  children,
  className = '',
  delay = 0,
  direction = 'up',
  distance = 32,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px 0px' });

  const offsets = {
    up:    { x: 0,         y: distance  },
    down:  { x: 0,         y: -distance },
    left:  { x: distance,  y: 0         },
    right: { x: -distance, y: 0         },
    none:  { x: 0,         y: 0         },
  };

  const { x, y } = offsets[direction];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x, y, filter: 'blur(4px)' }}
      animate={inView ? { opacity: 1, x: 0, y: 0, filter: 'blur(0px)' } : {}}
      transition={{
        duration: 0.7,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
