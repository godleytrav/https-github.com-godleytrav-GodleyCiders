import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAdminStore } from '../store/adminStore';

export default function Anatomy() {
  const [activeHp, setActiveHp] = useState<any>(null);
  const { anatomyImageUrl, anatomyHotspots } = useAdminStore();
  const [imgSrc, setImgSrc] = useState(anatomyImageUrl);
  const [showHotspots, setShowHotspots] = useState(false);

  // Update image source if it changes in admin panel while we're on the page
  useEffect(() => {
    setImgSrc(anatomyImageUrl);
  }, [anatomyImageUrl]);

  useEffect(() => {
    // Delay showing hotspots until the layout transition finishes
    const timer = setTimeout(() => setShowHotspots(true), 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative w-full min-h-[70vh] flex flex-col text-stone-200 font-sans selection:bg-amber-900 selection:text-amber-50"
    >
      <div className="flex-1 w-full h-full flex items-center justify-center p-4">
        <motion.div 
          layoutId="anatomy-container"
          className="relative inline-block leading-none max-w-full max-h-full"
        >
          <motion.img 
            layoutId="anatomy-image"
            src={imgSrc} 
            onError={(e) => {
              e.currentTarget.src = "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?q=80&w=2070&auto=format&fit=crop";
            }}
            alt="Anatomy of an Apple" 
            className="max-w-full max-h-[85vh] object-contain opacity-95 rounded-lg" 
          />
          
          <AnimatePresence>
            {showHotspots && anatomyHotspots.map((hp, i) => {
              const isActive = activeHp?.id === hp.id;
              return (
                <motion.button
                  key={hp.id}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1, type: "spring" }}
                  className="absolute w-12 h-12 -translate-x-1/2 -translate-y-1/2 rounded-full cursor-pointer flex items-center justify-center z-10 focus:outline-none group sm:w-10 sm:h-10"
                  style={{ left: `${hp.x}%`, top: `${hp.y}%` }}
                  onClick={() => setActiveHp(hp)}
                  onMouseEnter={() => {
                    if (window.innerWidth >= 640) setActiveHp(hp);
                  }}
                  onMouseLeave={() => {
                    if (window.innerWidth >= 640) setActiveHp(null);
                  }}
                >
                  <div className={`w-3 h-3 rounded-full border-2 border-amber-400 transition-all duration-300 pointer-events-none sm:w-2 sm:h-2
                    ${isActive ? 'bg-amber-400 scale-150 shadow-[0_0_20px_#f59e0b]' : 'bg-amber-500/30 group-hover:bg-amber-400 group-hover:scale-150 group-hover:shadow-[0_0_20px_#f59e0b]'}`} 
                  />
                  <div className="absolute inset-0 rounded-full border border-amber-500/20 animate-pulse" />
                </motion.button>
              )
            })}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Fact Card */}
      <AnimatePresence>
        {activeHp && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className={`absolute bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 w-[94%] sm:w-[90%] max-w-lg bg-stone-900/95 sm:bg-stone-950/90 border-2 border-amber-500/40 p-5 sm:p-6 rounded-lg backdrop-blur-xl z-[60] shadow-[0_10px_50px_rgba(0,0,0,0.8)]`}
          >
            <button 
              onClick={() => setActiveHp(null)}
              className="absolute top-4 right-4 text-amber-500 hover:text-amber-400 transition-colors"
            >
              <X size={20} />
            </button>
            <h3 className="text-2xl uppercase text-amber-500 tracking-widest mb-2 font-medium">{activeHp.title}</h3>
            <div className="w-8 h-[1px] bg-amber-500/50 mb-4" />
            <p className="text-lg text-stone-300 italic leading-relaxed">{activeHp.description}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
