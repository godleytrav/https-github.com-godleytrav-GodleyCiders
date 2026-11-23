import React from 'react';
import { Scan, Sparkles, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

interface BottleReticleProps {
  isLocked: boolean;
  labelName?: string;
  vintage?: string;
  onLockToggle?: () => void;
}

export const BottleReticle: React.FC<BottleReticleProps> = ({
  isLocked,
  labelName,
  vintage,
  onLockToggle
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-10 px-6">
      {/* Outer Viewfinder Frame */}
      <div className="relative w-64 h-96 sm:w-72 sm:h-[430px] rounded-3xl border-2 border-dashed transition-all duration-700 flex flex-col items-center justify-between p-4"
        style={{
          borderColor: isLocked ? 'rgba(245, 158, 11, 0.9)' : 'rgba(214, 211, 209, 0.4)',
          boxShadow: isLocked 
            ? '0 0 35px rgba(245, 158, 11, 0.25), inset 0 0 25px rgba(245, 158, 11, 0.15)' 
            : 'none'
        }}
      >
        {/* Reticle Corner Marks */}
        <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-amber-500 rounded-tl-xl" />
        <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-amber-500 rounded-tr-xl" />
        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-amber-500 rounded-bl-xl" />
        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-amber-500 rounded-br-xl" />

        {/* Top Status Capsule */}
        <div className="pointer-events-auto">
          <div className={`px-3 py-1 rounded-full text-[10px] font-sans font-semibold tracking-widest uppercase flex items-center gap-1.5 transition-all shadow-md ${
            isLocked 
              ? 'bg-amber-500 text-stone-950 shadow-amber-500/20' 
              : 'bg-stone-900/80 backdrop-blur-md text-stone-300 border border-stone-700/60'
          }`}>
            {isLocked ? (
              <>
                <CheckCircle2 size={12} className="text-stone-950 stroke-[2.5]" />
                <span>Vintage Augmented</span>
              </>
            ) : (
              <>
                <Scan size={12} className="text-amber-500 animate-pulse" />
                <span>Align Bottle Front</span>
              </>
            )}
          </div>
        </div>

        {/* Center Optical Scanning Laser Line (when searching) */}
        {!isLocked && (
          <motion.div
            className="w-full h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_12px_#f59e0b]"
            animate={{ y: [-130, 130, -130] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        {/* Bottle Silhouette Guide Outline */}
        <div className="w-32 h-64 border border-stone-500/20 rounded-2xl flex flex-col items-center justify-between py-3 pointer-events-none opacity-40">
          <div className="w-8 h-10 border-t border-x border-stone-400/40 rounded-t-sm" />
          <div className="w-24 h-44 border border-stone-400/40 rounded-lg flex items-center justify-center">
            <span className="text-[8px] uppercase tracking-widest text-stone-400">Front Label</span>
          </div>
        </div>

        {/* Bottom Lock / Unlock Action */}
        <div className="pointer-events-auto">
          {onLockToggle && (
            <button
              onClick={onLockToggle}
              className={`px-4 py-1.5 rounded-full text-xs font-sans font-semibold tracking-wider uppercase transition-all shadow-lg flex items-center gap-1.5 cursor-pointer ${
                isLocked 
                  ? 'bg-stone-900/90 text-stone-300 hover:text-white border border-stone-700' 
                  : 'bg-amber-600 hover:bg-amber-500 text-stone-950'
              }`}
            >
              <Sparkles size={13} />
              {isLocked ? 'Re-scan Bottle' : 'Lock Vintage'}
            </button>
          )}
        </div>
      </div>

      {/* Target Title below viewfinder */}
      <div className="mt-4 text-center">
        <h2 className="text-stone-200 font-serif text-base tracking-wider uppercase drop-shadow-md">
          {labelName || 'Godley Ciders Vintage'}
        </h2>
        {vintage && (
          <p className="text-amber-400 text-xs font-mono tracking-widest uppercase drop-shadow">
            {vintage}
          </p>
        )}
      </div>
    </div>
  );
};
