import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Eye, RotateCw } from 'lucide-react';
import { LiveLabel } from '../../types/liveLabel';
import { ARCanvasOverlay } from './ARCanvasOverlay';

interface StudioBottleViewProps {
  label: LiveLabel;
  isAugmenting: boolean;
  onToggleAugment: () => void;
}

export const StudioBottleView: React.FC<StudioBottleViewProps> = ({
  label,
  isAugmenting,
  onToggleAugment
}) => {
  const [rotationY, setRotationY] = useState(0);

  const handleRotate = () => {
    setRotationY(prev => (prev + 360));
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-4">
      {/* Studio Floor & Ambient Radial Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(245,158,11,0.08)_0%,_transparent_70%)] pointer-events-none" />

      {/* Interactive 3D Bottle Stage */}
      <div className="relative flex flex-col items-center justify-center max-w-xs sm:max-w-sm w-full">
        {/* Canvas Particle Effect Overlay */}
        <ARCanvasOverlay
          effectType={label.canvasEffectType || 'golden_amber_rings'}
          isActive={isAugmenting}
        />

        {/* Bottle Container with Smooth 3D Transform */}
        <motion.div
          className="relative w-56 sm:w-64 h-[420px] flex items-center justify-center transition-all duration-700 select-none"
          animate={{ rotateY: rotationY }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={{ perspective: 1000 }}
        >
          {/* Base Physical Bottle Image */}
          <img
            src={label.targetImageUrl}
            alt={label.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-contain filter drop-shadow-[0_20px_40px_rgba(0,0,0,0.85)] z-10 transition-transform duration-500"
          />

          {/* Augmented Video Overlay (if video type) */}
          {isAugmenting && label.augmentedMediaType === 'video' && label.augmentedMediaUrl && (
            <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none overflow-hidden rounded-2xl mix-blend-screen opacity-85">
              <video
                src={label.augmentedMediaUrl}
                autoPlay
                loop
                muted
                playsInline
                className="w-48 h-72 object-cover rounded-xl filter contrast-125"
              />
            </div>
          )}

          {/* Living Glow Pulsing Aura */}
          {isAugmenting && (
            <motion.div
              className="absolute inset-x-8 inset-y-16 rounded-3xl bg-amber-500/20 blur-2xl z-0 pointer-events-none"
              animate={{ opacity: [0.3, 0.7, 0.3], scale: [0.95, 1.05, 0.95] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </motion.div>

        {/* Studio Control Dock */}
        <div className="mt-4 flex items-center gap-3 z-30">
          <button
            onClick={onToggleAugment}
            className={`px-4 py-2 rounded-full text-xs font-sans font-bold tracking-wider uppercase transition-all shadow-lg flex items-center gap-1.5 cursor-pointer ${
              isAugmenting
                ? 'bg-amber-500 text-stone-950 shadow-amber-500/30'
                : 'bg-stone-900 hover:bg-stone-850 text-stone-300 border border-stone-800'
            }`}
          >
            <Sparkles size={13} className={isAugmenting ? 'animate-spin' : ''} />
            <span>{isAugmenting ? 'Augmented Layer Active' : 'Activate Live Label'}</span>
          </button>

          <button
            onClick={handleRotate}
            className="p-2.5 rounded-full bg-stone-900/80 hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-800 transition-colors shadow-md cursor-pointer"
            title="Inspect 360 Spin"
          >
            <RotateCw size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
