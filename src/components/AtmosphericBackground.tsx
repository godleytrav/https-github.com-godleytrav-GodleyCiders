import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useLocation } from 'react-router-dom';

export default function AtmosphericBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const location = useLocation();
  const [isScreensaver, setIsScreensaver] = useState(false);

  const isMainPage = location.pathname === '/' || location.pathname === '/home';

  useEffect(() => {
    const handleScreensaverChange = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      setIsScreensaver(customEvent.detail);
    };
    window.addEventListener('screensaver-change', handleScreensaverChange);
    return () => {
      window.removeEventListener('screensaver-change', handleScreensaverChange);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];

    class Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      opacity: number;

      constructor() {
        this.x = Math.random() * (canvas?.width || 0);
        this.y = Math.random() * (canvas?.height || 0);
        this.size = Math.random() * 3 + 1; // slightly larger dust
        this.speedX = (Math.random() - 0.5) * 0.4;
        this.speedY = (Math.random() - 0.5) * 0.4;
        this.opacity = Math.random() * 0.6 + 0.4; // more opaque dust
      }

      update(width: number, height: number) {
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.x > width) this.x = 0;
        else if (this.x < 0) this.x = width;
        if (this.y > height) this.y = 0;
        else if (this.y < 0) this.y = height;
      }

      draw(context: CanvasRenderingContext2D) {
        context.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
        context.beginPath();
        context.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        context.fill();
      }
    }

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    };

    const initParticles = () => {
      particles = [];
      const count = Math.floor((canvas.width * canvas.height) / 5000); // more dust particles
      for (let i = 0; i < count; i++) {
        particles.push(new Particle());
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.update(canvas.width, canvas.height);
        p.draw(ctx);
      });
      animationFrameId = requestAnimationFrame(animate);
    };

    window.addEventListener('resize', resize);
    resize();
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[-10] overflow-hidden pointer-events-none select-none bg-stone-950">
      {/* BASE BACKGROUND IMAGE */}
      <img 
        src="/assets/app/Enter Eden First Frame.jpeg" 
        alt="" 
        className={`absolute inset-0 w-full h-full object-cover scale-105 filter brightness-100 transition-opacity duration-1000 ${
          isScreensaver || isMainPage ? "opacity-90" : "opacity-[0.05]"
        }`}
      />

      {/* OVERLAY TINT - Lightened and switched to overlay/soft-light for better vibrance */}
      <div className="absolute inset-0 bg-stone-900/20 mix-blend-overlay" />

      {/* DUST PARTICLES CANVAS */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 w-full h-full mix-blend-screen opacity-80 blur-[2px]"
      />

      {/* AMBIENT GLOW - PULSING LIGHT FROM TOP RIGHT */}
      <motion.div 
        animate={{ 
          opacity: [0.1, 0.4, 0.1],
          scale: [1, 1.2, 1]
        }}
        transition={{ 
          duration: 15, 
          repeat: Infinity, 
          ease: "easeInOut" 
        }}
        className="absolute top-[-20%] right-[-10%] w-[80%] h-[80%] rounded-full"
        style={{
          background: 'radial-gradient(circle at center, rgba(251, 191, 36, 0.15) 0%, transparent 60%)',
          filter: 'blur(120px)'
        }}
      />

      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-stone-950/60 to-transparent" />
    </div>
  );
}
