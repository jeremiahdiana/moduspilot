'use client';

import { useEffect, useRef } from 'react';

// A slow constellation field — violet nodes drifting with faint links. Same
// system as the login hero, tuned quieter for a page you sit and read.
function Constellation() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    type Node = { x: number; y: number; vx: number; vy: number; r: number; phase: number; speed: number };
    let nodes: Node[] = [];
    let raf = 0;
    const init = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const count = Math.min(70, Math.floor((canvas.width * canvas.height) / 16000));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        r: Math.random() * 1.5 + 0.4,
        phase: Math.random() * Math.PI * 2,
        speed: 0.008 + Math.random() * 0.014,
      }));
    };
    init();
    window.addEventListener('resize', init);

    const LINK = 140;
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy; n.phase += n.speed;
        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
        const a = 0.3 + 0.25 * Math.sin(n.phase);
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(196,181,253,${a})`;
        ctx.fill();
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
          const d = Math.hypot(dx, dy);
          if (d < LINK) {
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(139,92,246,${(1 - d / LINK) * 0.14})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', init); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full" />;
}

export default function Aurora() {
  return (
    <>
      <div className="fm-aurora">
        <div className="fm-blob" style={{ width: '52vw', height: '52vw', top: '-16%', left: '-10%', background: 'radial-gradient(circle, rgba(124,58,237,0.55), transparent 70%)', animation: 'orb-drift-1 20s ease-in-out infinite' }} />
        <div className="fm-blob" style={{ width: '44vw', height: '44vw', top: '-6%', right: '-8%', background: 'radial-gradient(circle, rgba(192,132,252,0.45), transparent 70%)', animation: 'orb-drift-2 26s ease-in-out infinite' }} />
        <div className="fm-blob" style={{ width: '40vw', height: '40vw', bottom: '-14%', left: '18%', background: 'radial-gradient(circle, rgba(99,102,241,0.42), transparent 70%)', animation: 'orb-drift-3 23s ease-in-out infinite' }} />
        <div className="fm-blob" style={{ width: '30vw', height: '30vw', bottom: '4%', right: '10%', background: 'radial-gradient(circle, rgba(217,70,239,0.28), transparent 70%)', animation: 'orb-drift-1 30s ease-in-out infinite reverse' }} />
        <Constellation />
      </div>
      <div className="fm-vignette" />
    </>
  );
}
