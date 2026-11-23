import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Mountain, Wine, Sparkles, ChevronUp, ChevronDown, ShoppingBag, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { LiveLabel } from '../../types/liveLabel';

interface TastingNodesProps {
  label: LiveLabel;
  isLocked: boolean;
}

export const TastingNodes: React.FC<TastingNodesProps> = ({ label, isLocked }) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Audio setup
  useEffect(() => {
    if (label.audioNarrationUrl) {
      audioRef.current = new Audio(label.audioNarrationUrl);
      audioRef.current.loop = true;
      audioRef.current.volume = 0.6;
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsPlayingAudio(false);
    };
  }, [label.audioNarrationUrl]);

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlayingAudio(true);
      }).catch(err => {
        console.warn("Audio playback error:", err);
      });
    }
  };

  return (
    <>
      {/* 1. FLOATING AUDIO BADGE (TOP RIGHT) */}
      {label.audioNarrationUrl && (
        <div className="absolute top-20 right-4 z-30 pointer-events-auto">
          <button
            onClick={toggleAudio}
            className={`p-3 rounded-full backdrop-blur-xl border transition-all duration-300 shadow-xl flex items-center gap-2 cursor-pointer ${
              isPlayingAudio 
                ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-amber-500/30' 
                : 'bg-stone-950/80 text-stone-300 hover:text-white border-stone-800'
            }`}
            title="Listen to Terroir & Winemaker Story"
          >
            {isPlayingAudio ? (
              <>
                <Volume2 size={16} className="animate-pulse" />
                <div className="flex items-end gap-0.5 h-3">
                  <span className="w-0.5 h-full bg-stone-950 animate-[bounce_0.6s_infinite]" />
                  <span className="w-0.5 h-2/3 bg-stone-950 animate-[bounce_0.8s_infinite]" />
                  <span className="w-0.5 h-4/5 bg-stone-950 animate-[bounce_0.5s_infinite]" />
                </div>
              </>
            ) : (
              <VolumeX size={16} />
            )}
          </button>
        </div>
      )}

      {/* 2. FLOATING TERROIR ELEVATION TAG (TOP LEFT) */}
      {isLocked && label.terroirNotes.elevation && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute top-20 left-4 z-30 pointer-events-auto bg-stone-950/85 backdrop-blur-md border border-stone-800/80 px-3 py-2 rounded-xl shadow-lg font-sans max-w-[170px]"
        >
          <div className="flex items-center gap-1.5 text-amber-500 text-[10px] uppercase font-bold tracking-wider mb-0.5">
            <Mountain size={11} />
            <span>Terroir Elevation</span>
          </div>
          <p className="text-xs text-stone-200 font-semibold leading-tight">
            {label.terroirNotes.elevation}
          </p>
          {label.terroirNotes.abv && (
            <p className="text-[10px] text-stone-400 font-mono mt-0.5">
              {label.terroirNotes.abv} • {label.terroirNotes.sweetness}
            </p>
          )}
        </motion.div>
      )}

      {/* 3. BOTTOM SLIDING EXPERIENTIAL HUD */}
      <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-auto p-4 max-w-lg mx-auto">
        <div className="bg-stone-950/90 backdrop-blur-xl border border-stone-800 rounded-3xl shadow-2xl p-4 transition-all duration-300 font-sans">
          {/* Header Row */}
          <div className="flex items-center justify-between pb-3 border-b border-stone-800/70">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span className="text-[10px] font-mono tracking-widest text-amber-500 uppercase">
                  Live Label Feed
                </span>
              </div>
              <h3 className="text-stone-100 font-serif text-sm tracking-wide font-medium mt-0.5 truncate max-w-[240px]">
                {label.name}
              </h3>
            </div>

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-stone-400 hover:text-stone-200 flex items-center gap-1 bg-stone-900 px-2.5 py-1.5 rounded-lg border border-stone-800 cursor-pointer"
            >
              <span>{isExpanded ? 'Less' : 'Tasting Notes'}</span>
              {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </div>

          {/* Expandable Terroir & Pairing Drawer */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden pt-3 space-y-3 text-xs"
              >
                {/* Winemaker Story Quote */}
                {label.terroirNotes.storyQuote && (
                  <p className="text-stone-300 italic text-[11px] leading-relaxed border-l-2 border-amber-500 pl-2.5 py-0.5">
                    "{label.terroirNotes.storyQuote}"
                  </p>
                )}

                {/* Varietal Blend */}
                <div className="bg-stone-900/60 p-2.5 rounded-xl border border-stone-800/60">
                  <span className="text-[9px] uppercase tracking-wider text-stone-400 font-bold block mb-1">
                    Orchard Varietal Blend
                  </span>
                  <p className="text-stone-200 text-xs font-serif">
                    {label.terroirNotes.varietals}
                  </p>
                </div>

                {/* Pairing Advice */}
                {label.terroirNotes.pairing && (
                  <div className="bg-stone-900/60 p-2.5 rounded-xl border border-stone-800/60 flex items-start gap-2">
                    <Wine size={15} className="text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-stone-400 font-bold block">
                        Cellar Pairing Recommendation
                      </span>
                      <p className="text-stone-300 text-[11px] mt-0.5">
                        {label.terroirNotes.pairing}
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom Call to Action */}
          <div className="mt-3 pt-2.5 flex items-center justify-between gap-3">
            <div className="text-[10px] text-stone-400 font-mono">
              <span>{label.vintage}</span>
            </div>

            <Link
              to={label.ctaUrl || '/shop'}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer ml-auto"
            >
              <ShoppingBag size={13} />
              <span>{label.ctaLabel || 'Order Vintage'}</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};
