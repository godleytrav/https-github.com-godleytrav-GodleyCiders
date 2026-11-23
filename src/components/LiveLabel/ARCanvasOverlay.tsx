import React, { useEffect, useRef } from 'react';

interface ARCanvasOverlayProps {
  effectType: 'harvest_mist' | 'golden_amber_rings' | 'fermentation_spark' | 'orchard_breeze';
  isActive: boolean;
  bottleRect?: { x: number; y: number; width: number; height: number };
}

export const ARCanvasOverlay: React.FC<ARCanvasOverlayProps> = ({
  effectType,
  isActive,
  bottleRect
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = canvas.offsetWidth || window.innerWidth);
    let height = (canvas.height = canvas.offsetHeight || window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth || window.innerWidth;
      height = canvas.height = canvas.offsetHeight || window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particle structures
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      alpha: number;
      maxAlpha: number;
      color: string;
      life: number;
      maxLife: number;
      angle?: number;
      spin?: number;
    }> = [];

    // Initialize particles based on effect
    const initParticles = () => {
      particles.length = 0;
      const count = effectType === 'fermentation_spark' ? 70 : 45;
      for (let i = 0; i < count; i++) {
        const originX = bottleRect ? bottleRect.x + Math.random() * bottleRect.width : width * 0.25 + Math.random() * (width * 0.5);
        const originY = bottleRect ? bottleRect.y + Math.random() * bottleRect.height : height * 0.3 + Math.random() * (height * 0.5);

        particles.push({
          x: originX,
          y: originY,
          vx: (Math.random() - 0.5) * 0.8,
          vy: effectType === 'fermentation_spark' ? -0.8 - Math.random() * 1.5 : (Math.random() - 0.5) * 0.5,
          size: Math.random() * 4 + 1.5,
          alpha: Math.random() * 0.8,
          maxAlpha: 0.4 + Math.random() * 0.5,
          color: effectType === 'golden_amber_rings' 
            ? 'rgba(245, 158, 11, ' 
            : effectType === 'harvest_mist' 
              ? 'rgba(231, 229, 228, ' 
              : 'rgba(251, 191, 36, ',
          life: Math.random() * 100,
          maxLife: 100 + Math.random() * 100,
          angle: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 0.03
        });
      }
    };

    initParticles();

    let frame = 0;
    const render = () => {
      frame++;
      ctx.clearRect(0, 0, width, height);

      if (!isActive) {
        animationId = requestAnimationFrame(render);
        return;
      }

      const bx = bottleRect ? bottleRect.x : width * 0.3;
      const by = bottleRect ? bottleRect.y : height * 0.25;
      const bw = bottleRect ? bottleRect.width : width * 0.4;
      const bh = bottleRect ? bottleRect.height : height * 0.5;

      // 1. GOLDEN AMBER RINGS EFFECT
      if (effectType === 'golden_amber_rings') {
        const cx = bx + bw / 2;
        const cy = by + bh * 0.55;
        const maxRadius = Math.max(bw, bh) * 0.7;

        for (let ring = 0; ring < 3; ring++) {
          const ringProgress = ((frame * 0.008 + ring * 0.33) % 1);
          const r = ringProgress * maxRadius;
          const alpha = (1 - ringProgress) * 0.5;

          ctx.save();
          ctx.beginPath();
          ctx.ellipse(cx, cy, r * 1.2, r * 0.45, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(245, 158, 11, ${alpha})`;
          ctx.lineWidth = 2.5;
          ctx.shadowColor = 'rgba(245, 158, 11, 0.8)';
          ctx.shadowBlur = 12;
          ctx.stroke();
          ctx.restore();
        }
      }

      // 2. HARVEST MIST EFFECT
      if (effectType === 'harvest_mist') {
        ctx.save();
        const mistGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
        mistGrad.addColorStop(0, 'rgba(214, 211, 209, 0)');
        mistGrad.addColorStop(0.5, `rgba(231, 229, 228, ${0.12 + Math.sin(frame * 0.02) * 0.05})`);
        mistGrad.addColorStop(1, 'rgba(214, 211, 209, 0)');
        ctx.fillStyle = mistGrad;
        ctx.fillRect(bx - 20, by, bw + 40, bh);
        ctx.restore();
      }

      // 3. PARTICLES & BUBBLES
      for (const p of particles) {
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        if (p.angle !== undefined && p.spin !== undefined) {
          p.angle += p.spin;
        }

        // Fade in and out
        const halfLife = p.maxLife / 2;
        const currentAlpha = p.life < halfLife 
          ? (p.life / halfLife) * p.maxAlpha 
          : (1 - (p.life - halfLife) / halfLife) * p.maxAlpha;

        ctx.save();
        ctx.fillStyle = `${p.color}${Math.max(0, currentAlpha)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Shimmer glint for sparkles
        if (effectType === 'fermentation_spark' && p.size > 2.5) {
          ctx.strokeStyle = `rgba(255, 255, 255, ${currentAlpha * 0.8})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x - p.size * 1.5, p.y);
          ctx.lineTo(p.x + p.size * 1.5, p.y);
          ctx.moveTo(p.x, p.y - p.size * 1.5);
          ctx.lineTo(p.x, p.y + p.size * 1.5);
          ctx.stroke();
        }

        ctx.restore();

        // Recycle particle
        if (p.life >= p.maxLife || (effectType === 'fermentation_spark' && p.y < by)) {
          p.x = bx + Math.random() * bw;
          p.y = effectType === 'fermentation_spark' ? by + bh : by + Math.random() * bh;
          p.life = 0;
        }
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
    };
  }, [effectType, isActive, bottleRect]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-20 w-full h-full"
    />
  );
};
