import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Soundscape() {
  const [isPlaying, setIsPlaying] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Ambient forest sound loop (Royalty free)
    // Using a reliable source for ambient nature sounds - Garden of Eden style (birds, water, wind)
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2464/2464-preview.mp3');
    audioRef.current.loop = true;
    audioRef.current.volume = 0.5;

    const playAudio = async () => {
      try {
        await audioRef.current?.play();
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn("Audio auto-play blocked, waiting for interaction:", err);
          
          // If auto-play gets blocked, wait for the first click on the document to start it.
          const resumeAudio = () => {
            if (audioRef.current && isPlaying) {
              audioRef.current.play().catch(e => console.log("Still blocked or aborted", e));
            }
            document.removeEventListener('click', resumeAudio);
            document.removeEventListener('touchstart', resumeAudio);
          };
          
          document.addEventListener('click', resumeAudio);
          document.addEventListener('touchstart', resumeAudio);
        }
      }
    };

    const handleVerifyEvent = () => {
      if (audioRef.current && isPlaying) {
        audioRef.current.play().catch(err => console.log("Failed to play on age verify event", err));
      }
    };

    window.addEventListener('godley_age_verified', handleVerifyEvent);

    if (isPlaying) {
      playAudio();
    }

    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
      window.removeEventListener('godley_age_verified', handleVerifyEvent);
    };
  }, []);

  const toggleSound = () => {
    if (isPlaying) {
      audioRef.current?.pause();
    } else {
      audioRef.current?.play().catch(err => console.warn("Audio play blocked:", err));
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="fixed bottom-8 left-8 z-50">
      <button
        onClick={toggleSound}
        className="w-12 h-12 rounded-full border border-stone-800 bg-stone-950/40 backdrop-blur-md flex items-center justify-center text-stone-400 hover:text-amber-500 hover:border-amber-500/50 transition-all duration-500 group relative shadow-2xl"
        title={isPlaying ? "Mute Forest" : "Enable Forest Ambience"}
      >
        <AnimatePresence mode="wait">
          {isPlaying ? (
            <motion.div
              key="playing"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <Volume2 size={20} />
            </motion.div>
          ) : (
            <motion.div
              key="muted"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <VolumeX size={20} />
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* PULSING GLOW WHEN PLAYING */}
        {isPlaying && (
          <div className="absolute inset-0 rounded-full bg-amber-500/10 animate-ping pointer-events-none" />
        )}
      </button>
    </div>
  );
}
