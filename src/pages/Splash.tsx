import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAdminStore } from '../store/adminStore';

function getDirectVideoUrl(url: string) {
  if (!url) return '';
  if (url.includes('drive.google.com')) {
    const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      // route via our local custom Range-supporting streaming proxy
      return `/api/video-proxy?id=${match[1]}`;
    }
  }
  return url;
}

export default function Splash() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const { splashStoryTexts, splashVideoUrl } = useAdminStore();
  const resolvedVideoUrl = useMemo(() => getDirectVideoUrl(splashVideoUrl), [splashVideoUrl]);

  const isVideoMode = useMemo(() => {
    return !!splashVideoUrl;
  }, [splashVideoUrl]);

  // Phase-based state machine for cinematic automated playback:
  // 'gate': waiting for age verification
  // 'text': displaying the story text sequences on automatic slide dissolves
  // 'video': text is done; video (or image) fades in and plays
  // 'ended': video has finished or skipped, final enter buttons are visible
  const [appPhase, setAppPhase] = useState<'gate' | 'text' | 'video' | 'ended'>('gate');
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [videoCanPlay, setVideoCanPlay] = useState(false);

  // Asset frame paths as fallback (from existing code)
  const framePaths = useMemo(() => {
    try {
      const modules = (import.meta as any).glob('/public/assets/Enter Eden Splash/*.{jpg,jpeg,png,webp}', { eager: true });
      return Object.keys(modules).sort().map(p => p.replace('/public', ''));
    } catch(e) {
      console.warn(e);
      return [];
    }
  }, []);

  const [framesLoaded, setFramesLoaded] = useState(false);

  // Buffer loader state
  const isLoaded = useMemo(() => {
    return isVideoMode ? videoCanPlay : (framePaths.length > 0 ? framesLoaded : true);
  }, [isVideoMode, videoCanPlay, framePaths.length, framesLoaded]);

  // Preload frame paths if any
  useEffect(() => {
    if (framePaths.length === 0) return;
    let loadedCount = 0;
    framePaths.forEach(src => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        loadedCount++;
        if (loadedCount === framePaths.length) {
          setFramesLoaded(true);
        }
      };
      img.onerror = () => {
        loadedCount++;
        if (loadedCount === framePaths.length) {
          setFramesLoaded(true);
        }
      };
    });
  }, [framePaths]);

  // Handle Age Verification State synchronization
  useEffect(() => {
    const verified = localStorage.getItem('godley_age_verified_v2') === 'true';
    if (verified) {
      setAppPhase('text');
    }

    const handleGlobalVerify = () => {
      setAppPhase('text');
    };

    window.addEventListener('godley_age_verified', handleGlobalVerify);
    return () => {
      window.removeEventListener('godley_age_verified', handleGlobalVerify);
    };
  }, []);

  // Text playback sequence timer
  useEffect(() => {
    if (appPhase !== 'text') return;

    // 2.5 seconds per text slide (with snappy 0.8s slide fades)
    const textStayDuration = 2500;
    
    const timer = setTimeout(() => {
      if (currentTextIndex < 1) { // 2 story frames (0 and 1)
        setCurrentTextIndex(prev => prev + 1);
      } else {
        setAppPhase('video');
      }
    }, textStayDuration);

    return () => clearTimeout(timer);
  }, [appPhase, currentTextIndex]);

  // Video playback management when video phase starts
  useEffect(() => {
    if (appPhase === 'video' && videoRef.current && isVideoMode) {
      videoRef.current.currentTime = 0;
      videoRef.current.muted = false; // interact-triggered means unmuted is valid
      
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.warn("Autoplay with sound was blocked or interrupted, trying muted fallback:", err);
          if (videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current.play().catch(e => console.error("Muted fallback play failed:", e));
          }
        });
      }
    }
  }, [appPhase, isVideoMode]);

  // Fallback for image mode (how long image stays before revealing buttons)
  useEffect(() => {
    if (appPhase === 'video' && !isVideoMode) {
      const timer = setTimeout(() => {
        setAppPhase('ended');
      }, 6000); // Fades in background and keeps it clear for 6 seconds, then shows buttons
      return () => clearTimeout(timer);
    }
  }, [appPhase, isVideoMode]);

  const handleVideoEnded = () => {
    setAppPhase('ended');
  };

  const handleSkip = () => {
    setAppPhase('ended');
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  // Extract the texts to be safe
  const validStoryTexts = useMemo(() => {
    return (splashStoryTexts || []).filter(item => item && item.text && item.text.trim() !== '');
  }, [splashStoryTexts]);

  const currentTextObj = validStoryTexts[currentTextIndex];

  return (
    <div id="splash-container" className="fixed inset-0 w-screen h-screen bg-black overflow-hidden select-none font-serif text-white z-50">
      
      {/* BACKGROUNDS (preloaded in DOM behind absolute black curtain during text phase) */}
      <div 
        id="media-pane"
        className="absolute inset-0 w-full h-full z-0 transition-opacity duration-[1500ms] ease-in-out"
        style={{
          opacity: appPhase === 'video' || appPhase === 'ended' ? 1 : 0
        }}
      >
        {isVideoMode ? (
          <video
            id="splash-video"
            ref={videoRef}
            src={resolvedVideoUrl}
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
            onCanPlay={() => setVideoCanPlay(true)}
            onLoadedData={() => setVideoCanPlay(true)}
            onEnded={handleVideoEnded}
            preload="auto"
            crossOrigin="anonymous"
            poster="/assets/app/Enter Eden First Frame.jpeg"
          />
        ) : framePaths.length > 0 ? (
          <motion.img 
            id="splash-fallback-image"
            src={framePaths[0]}
            alt="Godley Splash Background"
            className="absolute inset-0 w-full h-full object-cover"
            animate={appPhase === 'video' ? { scale: 1.05 } : { scale: 1 }}
            transition={{ duration: 8, ease: "easeOut" }}
          />
        ) : (
          <div className="absolute inset-0 w-full h-full bg-stone-950 flex items-center justify-center text-xs text-stone-600">
            No video or image found
          </div>
        )}
        
        {/* Subtle dark vignette overlay over video/image to make navigation clear */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />
      </div>

      {/* OVERLAY CURTAIN FOR THE TEXT SEQUENCE (Solid black to allow preloading) */}
      <AnimatePresence>
        {appPhase === 'text' && (
          <motion.div 
            id="text-sequence-pane"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className="absolute inset-0 bg-black z-10 flex items-center justify-center pointer-events-none"
          >
            {/* Ambient subtle golden background glow during text */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(217,119,6,0.03)_0%,transparent_70%)] opacity-80" />
            
            {/* Dissolving Story Text with Smoke Transition */}
            <div className="relative w-[90vw] max-w-4xl h-80 z-20 flex items-center justify-center">
              <AnimatePresence mode="wait">
                {currentTextIndex === 0 ? (
                  <motion.div
                    key="welcome-slide"
                    initial={{ opacity: 0, filter: "blur(15px)", scale: 0.96 }}
                    animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
                    exit={{ opacity: 0, filter: "blur(20px)", scale: 1.04 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="absolute inset-0 flex flex-col items-center justify-center text-center px-6"
                  >
                    <span className="text-amber-500 font-mono text-xs uppercase tracking-[0.4em] mb-4 opacity-80">
                      Welcome
                    </span>
                    <h2 className="text-5xl md:text-7xl lg:text-8xl italic font-black text-stone-100 font-serif drop-shadow-[0_0_40px_rgba(245,158,11,0.25)] leading-tight">
                      Godley Ciders
                    </h2>
                  </motion.div>
                ) : currentTextIndex === 1 ? (
                  <motion.div
                    key="beginning-slide"
                    initial={{ opacity: 0, filter: "blur(15px)", scale: 0.96 }}
                    animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
                    exit={{ opacity: 0, filter: "blur(20px)", scale: 1.04 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="absolute inset-0 flex flex-col items-center justify-center text-center px-6"
                  >
                    <h2 className="text-3xl md:text-5xl lg:text-6xl italic font-light tracking-[0.08em] text-stone-200 drop-shadow-[0_0_35px_rgba(251,191,36,0.2)] leading-relaxed">
                      "In The Beginning ..."
                    </h2>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SKIP INTRO BUTTON */}
      {(appPhase === 'text' || appPhase === 'video') && (
        <button
          id="skip-intro-btn"
          onClick={handleSkip}
          className="absolute top-8 right-8 z-[150] text-[10px] tracking-[0.3em] font-sans text-stone-500 hover:text-amber-500 hover:scale-105 pointer-events-auto transition-all duration-300 uppercase select-none border border-stone-800/60 bg-stone-950/40 backdrop-blur-md px-4 py-2 rounded-full cursor-pointer"
        >
          Skip Intro
        </button>
      )}

      {/* FINAL BUTTON REVEAL */}
      <AnimatePresence>
        {appPhase === 'ended' && (
          <motion.div 
            id="ended-navigation-pane"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="absolute inset-0 flex flex-col items-center justify-end pb-24 md:pb-32 px-4 z-[120] pointer-events-none"
          >
            {/* Optional text or label above buttons */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 1 }}
              className="text-center mb-8"
            >
              <h1 className="text-2xl md:text-3xl font-light italic tracking-widest text-amber-200/90 lowercase">
                enter the garden.
              </h1>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col md:flex-row items-stretch md:items-center justify-center gap-6 px-4 md:px-0 w-full max-w-lg md:max-w-none pointer-events-auto"
            >
              <button 
                id="btn-proceed"
                onClick={() => navigate('/home')}
                className="group relative px-10 py-5 rounded-lg overflow-hidden transition-all duration-500 hover:scale-105 active:scale-95 border border-stone-800 hover:border-amber-500/40 bg-stone-950/70 backdrop-blur-md shadow-2xl flex-1 md:flex-none md:min-w-[220px]"
              >
                <motion.div 
                  animate={{ opacity: [0.2, 0.4, 0.2] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 bg-stone-900/20" 
                />
                <span className="relative z-10 text-stone-300 font-sans tracking-[0.25em] font-black text-xs uppercase group-hover:text-amber-400 transition-colors">
                  proceed with caution
                </span>
                <div className="absolute inset-x-0 bottom-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/30 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
              </button>

              <button 
                id="btn-apple"
                onClick={() => navigate('/club')}
                className="group relative px-10 py-5 rounded-lg overflow-hidden transition-all duration-500 hover:scale-105 active:scale-95 border border-amber-500 bg-amber-500 text-stone-950 shadow-[0_4px_30px_rgba(245,158,11,0.25)] hover:shadow-[0_4px_45px_rgba(245,158,11,0.45)] flex-1 md:flex-none md:min-w-[220px]"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-white/10 opacity-70" />
                <span className="relative z-10 text-stone-950 font-serif font-black text-sm tracking-[0.15em] uppercase">
                  take the apple
                </span>
                <div className="absolute inset-0 bg-white/20 scale-y-0 group-hover:scale-y-100 origin-bottom transition-transform duration-500" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AMBIENT CONTENT BUFFER LOADER */}
      <AnimatePresence>
        {!isLoaded && appPhase === 'text' && (
          <motion.div
            id="splash-buffering-loader"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
            className="absolute bottom-6 left-6 z-[160] flex items-center gap-3 pointer-events-none"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80 animate-ping" />
            <span className="text-[9px] uppercase tracking-[0.25em] text-stone-500 font-sans">
              media buffering...
            </span>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
