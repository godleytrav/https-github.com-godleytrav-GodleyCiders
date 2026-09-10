import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useAdminStore, Scene, Hitbox } from '../store/adminStore';

gsap.registerPlugin(ScrollTrigger);

export default function InteractiveStory() {
  const { storySettings } = useAdminStore();
  const scenes = storySettings.scenes.reduce((acc, scene) => {
    acc[scene.id] = scene;
    return acc;
  }, {} as Record<string, Scene>);

  const containerRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  
  const video1Ref = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);
  
  const [currentSceneId, setCurrentSceneId] = useState<string>('intro');
  const [activeVideoIndex, setActiveVideoIndex] = useState<1 | 2>(1);
  
  const [progress, setProgress] = useState(0);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  
  const [dialogueOpen, setDialogueOpen] = useState<{ text: string; target: string } | null>(null);
  
  const scrollTriggerRef = useRef<ScrollTrigger | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const pannerNodeRef = useRef<StereoPannerNode | null>(null);

  const loadScene = async (sceneId: string, smoothTransition = true) => {
    const scene = scenes[sceneId];
    if (!scene) return;
    
    // Determine which video element is inactive to load into
    const inactiveVideoRef = activeVideoIndex === 1 ? video2Ref : video1Ref;
    
    if (inactiveVideoRef.current) {
      setIsVideoLoaded(false);
      try {
        inactiveVideoRef.current.src = scene.videoUrl;
        inactiveVideoRef.current.load();
        
        await new Promise((resolve) => {
          if (inactiveVideoRef.current) {
            inactiveVideoRef.current.onloadedmetadata = () => resolve(true);
            setTimeout(() => resolve(true), 1500);
          } else resolve(true);
        });
        
        inactiveVideoRef.current.currentTime = 0;
        
        const newActiveIndex = activeVideoIndex === 1 ? 2 : 1;
        setActiveVideoIndex(newActiveIndex);
        setCurrentSceneId(sceneId);
        setIsVideoLoaded(true);
      } catch (err) {
        console.error("Error loading scene:", err);
        setIsVideoLoaded(true);
      }
    }
  };

  useEffect(() => {
    loadScene('intro', false);
    
    // Setup Audio Engine
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContext) {
      audioContextRef.current = new AudioContext();
      gainNodeRef.current = audioContextRef.current.createGain();
      pannerNodeRef.current = audioContextRef.current.createStereoPanner();
      
      pannerNodeRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(audioContextRef.current.destination);
    }

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (scrollTriggerRef.current) {
        scrollTriggerRef.current.kill();
      }
    };
  }, []);

  // Setup GSAP and Video Ticker
  useEffect(() => {
    if (!containerRef.current || !stickyRef.current) return;

    scrollTriggerRef.current = ScrollTrigger.create({
      trigger: containerRef.current,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.1, // Smooth scrub
      onUpdate: (self) => {
        if (dialogueOpen) {
          // If a dialogue is open, we can artificially lock scrolling, 
          // but natively we usually manage this by locking the document body scroll.
          // For now, we allow the progress to update, but we could cap it.
        } else {
          setProgress(self.progress);
        }
      }
    });

    // Ticker to sync video & audio
    const updateVideoTime = () => {
      const activeVideoEl = activeVideoIndex === 1 ? video1Ref.current : video2Ref.current;
      if (activeVideoEl && activeVideoEl.duration) {
        const targetTime = progress * activeVideoEl.duration;
        // Optimization: only update if delta is significant to prevent jank
        if (Math.abs(activeVideoEl.currentTime - targetTime) > 0.05) {
          activeVideoEl.currentTime = targetTime;
        }

        // Update Audio Engine (Pan left to right based on progress)
        if (pannerNodeRef.current && gainNodeRef.current) {
          pannerNodeRef.current.pan.value = (progress * 2) - 1; // -1 to 1
          // Gain logic: pulse volume subtly
          gainNodeRef.current.gain.value = 0.5 + Math.sin(progress * Math.PI) * 0.2;
        }
      }
    };

    gsap.ticker.add(updateVideoTime);

    // Disable scrolling when dialogue is open
    if (dialogueOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    return () => {
      gsap.ticker.remove(updateVideoTime);
      document.body.style.overflow = "auto";
    };
  }, [progress, activeVideoIndex, dialogueOpen]);


  const currentScene = scenes[currentSceneId];
  const activeVideoEl = activeVideoIndex === 1 ? video1Ref.current : video2Ref.current;
  const currentTime = activeVideoEl ? activeVideoEl.currentTime : 0;

  const handleHitboxClick = (hitbox: Hitbox) => {
    if (hitbox.dialogue) {
      setDialogueOpen({ text: hitbox.dialogue, target: hitbox.targetSceneId });
    } else {
      // Direct jump
      // We should ideally reset scroll back to top of container, but smoothly.
      if (scrollTriggerRef.current) {
        // Reset scroll position to top of container
        window.scrollTo({
          top: containerRef.current?.offsetTop || 0,
          behavior: 'smooth'
        });
      }
      loadScene(hitbox.targetSceneId);
    }
  };

  const proceedFromDialogue = () => {
    if (dialogueOpen) {
      const target = dialogueOpen.target;
      setDialogueOpen(null);
      if (scrollTriggerRef.current) {
        window.scrollTo({
          top: containerRef.current?.offsetTop || 0,
          behavior: 'smooth'
        });
      }
      loadScene(target);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-[300vh] bg-stone-950">
      <div 
        ref={stickyRef} 
        className="sticky top-0 w-full h-screen overflow-hidden flex items-center justify-center bg-black"
      >
        {!isVideoLoaded && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-stone-950">
            <div className="text-amber-500 uppercase tracking-widest animate-pulse font-serif border border-amber-500/20 px-8 py-4 bg-stone-900/50 backdrop-blur-sm rounded">
              Memories Materializing...
            </div>
          </div>
        )}

        <video
          ref={video1Ref}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
            activeVideoIndex === 1 ? 'opacity-100 z-10' : 'opacity-0 z-0'
          }`}
          muted
          playsInline
          preload="auto"
        />
        <video
          ref={video2Ref}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
            activeVideoIndex === 2 ? 'opacity-100 z-10' : 'opacity-0 z-0'
          }`}
          muted
          playsInline
          preload="auto"
        />

        {/* HUD over the active video */}
        <div className="absolute inset-0 z-20 pointer-events-none">
          {/* Overlay to darken borders */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-stone-950/20 to-stone-950 border-[16px] border-stone-950/80 mix-blend-multiply pointer-events-none"></div>
          
          {/* Hitboxes */}
          {currentScene && currentScene.hitboxes.map(hitbox => {
            const isActive = currentTime >= hitbox.timeStart && currentTime <= hitbox.timeEnd;
            if (!isActive) return null;
            return (
              <motion.div
                key={hitbox.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => handleHitboxClick(hitbox)}
                className="absolute border border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/30 backdrop-blur-sm pointer-events-auto cursor-pointer transition-colors duration-300 group flex items-center justify-center"
                style={{
                  left: `${hitbox.x}%`,
                  top: `${hitbox.y}%`,
                  width: `${hitbox.width}%`,
                  height: `${hitbox.height}%`,
                }}
              >
                <div className="opacity-0 group-hover:opacity-100 text-amber-400 text-xs uppercase tracking-widest bg-stone-950/80 px-2 py-1 transform translate-y-8 font-serif transition-opacity">
                  {hitbox.label}
                </div>
              </motion.div>
            );
          })}

          {/* Dialogue Box Overlay */}
          <AnimatePresence>
            {dialogueOpen && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-stone-950/60 backdrop-blur-md flex items-center justify-center pointer-events-auto"
              >
                <div className="bg-stone-900 border border-stone-800 p-8 max-w-md w-full mx-4 shadow-2xl relative overflow-hidden font-serif">
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent"></div>
                  <div className="text-xl text-stone-300 leading-relaxed italic mb-8 border-l-2 border-amber-500/50 pl-4 py-2">
                    "{dialogueOpen.text}"
                  </div>
                  <div className="flex justify-end">
                    <button 
                      onClick={proceedFromDialogue}
                      className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold uppercase tracking-widest text-sm transition-colors rounded-sm"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Progress Indicator */}
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 w-64 h-1 bg-stone-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-amber-500" 
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-[10px] text-stone-500 uppercase tracking-widest">
            Scroll to Navigate Memory
          </div>
        </div>
      </div>
    </div>
  );
}
