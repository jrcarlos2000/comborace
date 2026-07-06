import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import colors from '../theme/colors';

export interface ParticlesHandle {
  explode: (x: number, y: number, rgb: string) => void;
  confetti: (x: number, y: number, rgb: string) => void;
  pulse: (x: number, y: number, rgb: string) => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
  shape: 'spark' | 'chip' | 'ring';
  gravity: number;
  drag: number;
  ringMax: number;
}

// Chips composite with plain alpha, so on the light arena the palette leans on the saturated
// brand/semantic tones plus a dark grey for contrast instead of the white that vanished on light.
const CONFETTI_PALETTE = [colors.brand.DEFAULT, colors.cash, colors.gold, colors.grey[800]];
const EXPLOSION_PALETTE = [colors.crash, colors.gold, colors.grey[700], colors.grey[900]];

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// Dependency-free particle layer: one full-screen canvas and one shared loop, kept off the
// React render path so bursts never cost the race a frame.
export const Particles = forwardRef<ParticlesHandle>(function Particles(_props, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);

  useImperativeHandle(ref, () => ({
    explode(x, y, rgb) {
      const colors = [`rgb(${rgb})`, ...EXPLOSION_PALETTE];
      particles.current.push({
        x, y, vx: 0, vy: 0, life: 0.35, maxLife: 0.35, size: 8, color: `rgba(${rgb},1)`,
        rot: 0, vr: 0, shape: 'ring', gravity: 0, drag: 1, ringMax: 90,
      });
      for (let i = 0; i < 34; i++) {
        const a = rand(0, Math.PI * 2);
        const speed = rand(120, 620);
        particles.current.push({
          x, y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          life: rand(0.5, 1.0),
          maxLife: 1.0,
          size: rand(2, 5),
          color: colors[Math.floor(Math.random() * colors.length)],
          rot: 0, vr: 0, shape: 'spark',
          gravity: 900, drag: 0.9, ringMax: 90,
        });
      }
    },
    confetti(x, y, rgb) {
      const colors = [`rgb(${rgb})`, ...CONFETTI_PALETTE];
      for (let i = 0; i < 84; i++) {
        const a = rand(-Math.PI * 0.85, -Math.PI * 0.15);
        const speed = rand(220, 640);
        particles.current.push({
          x: x + rand(-14, 14),
          y: y + rand(-8, 8),
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          life: rand(1.4, 2.4),
          maxLife: 2.4,
          size: rand(4, 9),
          color: colors[Math.floor(Math.random() * colors.length)],
          rot: rand(0, Math.PI * 2),
          vr: rand(-9, 9),
          shape: 'chip',
          gravity: 760, drag: 0.98, ringMax: 90,
        });
      }
    },
    // Phase-offset expanding rings so a cash lands as a shockwave, not a single flash.
    pulse(x, y, rgb) {
      for (let i = 0; i < 3; i++) {
        particles.current.push({
          x, y, vx: 0, vy: 0,
          life: 0.9, maxLife: 0.9,
          size: 4, color: `rgba(${rgb},0.9)`,
          rot: 0, vr: 0, shape: 'ring', gravity: 0, drag: 1,
          ringMax: 120 + i * 46,
        });
      }
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      const list = particles.current;
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.life -= dt;
        if (p.life <= 0) {
          list.splice(i, 1);
          continue;
        }
        p.vy += p.gravity * dt;
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;

        const alpha = Math.min(1, p.life / (p.maxLife * 0.6));
        ctx.globalAlpha = alpha;

        if (p.shape === 'ring') {
          const grow = 1 - p.life / p.maxLife;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 3 * (1 - grow);
          ctx.beginPath();
          ctx.arc(p.x, p.y, 8 + grow * p.ringMax, 0, Math.PI * 2);
          ctx.stroke();
        } else if (p.shape === 'chip') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          ctx.restore();
        } else {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-50"
      aria-hidden="true"
    />
  );
});
