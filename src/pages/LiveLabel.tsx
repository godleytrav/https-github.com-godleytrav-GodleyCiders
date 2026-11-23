import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Camera, Eye, ArrowLeft, RefreshCw, AlertCircle, Sparkles, Check, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LiveLabel, DEFAULT_LIVE_LABELS } from '../types/liveLabel';
import { ARCanvasOverlay } from '../components/LiveLabel/ARCanvasOverlay';
import { BottleReticle } from '../components/LiveLabel/BottleReticle';
import { TastingNodes } from '../components/LiveLabel/TastingNodes';
import { StudioBottleView } from '../components/LiveLabel/StudioBottleView';

export default function LiveLabelPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const codeParam = searchParams.get('code');

  const [labels, setLabels] = useState<LiveLabel[]>(DEFAULT_LIVE_LABELS);
  const [currentLabel, setCurrentLabel] = useState<LiveLabel>(DEFAULT_LIVE_LABELS[0]);
  const [viewMode, setViewMode] = useState<'camera' | 'studio'>('camera');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isTargetLocked, setIsTargetLocked] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 1. Fetch live labels from API
  useEffect(() => {
    const fetchLabels = async () => {
      try {
        const res = await fetch('/api/live-labels');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.labels) && data.labels.length > 0) {
            setLabels(data.labels);
            // Match with codeParam if exists
            if (codeParam) {
              const matched = data.labels.find((l: LiveLabel) => l.code === codeParam || l.id === codeParam);
              if (matched) {
                setCurrentLabel(matched);
                setIsTargetLocked(true);
                return;
              }
            }
            setCurrentLabel(data.labels[0]);
          }
        }
      } catch (err) {
        console.warn("Could not load dynamic live labels, using defaults:", err);
      }
    };
    fetchLabels();
  }, [codeParam]);

  // Update selected label when codeParam changes
  useEffect(() => {
    if (codeParam && labels.length > 0) {
      const matched = labels.find(l => l.code === codeParam || l.id === codeParam);
      if (matched) {
        setCurrentLabel(matched);
        setIsTargetLocked(true);
      }
    }
  }, [codeParam, labels]);

  // 2. Camera Stream Handler
  useEffect(() => {
    if (viewMode !== 'camera') {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [viewMode]);

  const startCamera = async () => {
    try {
      setCameraError(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API not supported in this browser environment.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().then(() => {
          setIsCameraActive(true);
        }).catch(e => {
          console.warn("Camera play interrupted:", e);
        });
      }
    } catch (err: any) {
      console.warn("Camera access error:", err);
      setCameraError(err.message || "Camera permission was not granted.");
      setViewMode('studio'); // Graceful fallback
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const handleSelectLabel = (lbl: LiveLabel) => {
    setCurrentLabel(lbl);
    setSearchParams({ code: lbl.code });
    setIsTargetLocked(true);
    setShowDrawer(false);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-stone-950 font-sans select-none">
      {/* 1. TOP HEADER & NAVIGATION BAR */}
      <header className="absolute top-0 left-0 right-0 z-40 px-4 py-3 bg-gradient-to-b from-stone-950/95 via-stone-950/70 to-transparent flex items-center justify-between pointer-events-auto">
        <Link
          to="/"
          className="flex items-center gap-2 text-stone-300 hover:text-white transition-colors bg-stone-900/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-stone-800 text-xs"
        >
          <ArrowLeft size={14} />
          <span className="font-serif tracking-wider font-semibold">Exit</span>
        </Link>

        {/* Center Title Badge */}
        <div className="text-center">
          <span className="text-[10px] tracking-widest uppercase font-mono text-amber-500 font-bold block">
            Godley Ciders
          </span>
          <h1 className="text-sm font-serif text-stone-200 tracking-wider font-semibold">
            Live Label Studio
          </h1>
        </div>

        {/* View Mode Toggle: Camera vs Studio */}
        <div className="flex items-center bg-stone-900/80 backdrop-blur-md p-1 rounded-full border border-stone-800 text-xs">
          <button
            onClick={() => setViewMode('camera')}
            className={`px-3 py-1 rounded-full flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'camera'
                ? 'bg-amber-600 text-stone-950 font-bold shadow-md'
                : 'text-stone-400 hover:text-stone-200'
            }`}
            title="Scan Physical Bottle via Camera"
          >
            <Camera size={13} />
            <span className="hidden sm:inline">Camera</span>
          </button>
          <button
            onClick={() => setViewMode('studio')}
            className={`px-3 py-1 rounded-full flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'studio'
                ? 'bg-amber-600 text-stone-950 font-bold shadow-md'
                : 'text-stone-400 hover:text-stone-200'
            }`}
            title="Inspect 3D Bottle in Studio"
          >
            <Eye size={13} />
            <span className="hidden sm:inline">Studio</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN DISPLAY CANVAS */}
      <main className="relative w-full h-full">
        {viewMode === 'camera' ? (
          <div className="relative w-full h-full overflow-hidden bg-black flex items-center justify-center">
            {/* Live Camera Video Feed */}
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="absolute inset-0 w-full h-full object-cover z-0"
            />

            {/* Subtle Vignette & Tint */}
            <div className="absolute inset-0 bg-radial-gradient from-transparent via-stone-950/20 to-stone-950/60 pointer-events-none z-1" />

            {/* Canvas Particle Overlay */}
            <ARCanvasOverlay
              effectType={currentLabel.canvasEffectType || 'golden_amber_rings'}
              isActive={isTargetLocked}
            />

            {/* Animated Video Overlay if detected and video type */}
            {isTargetLocked && currentLabel.augmentedMediaType === 'video' && currentLabel.augmentedMediaUrl && (
              <div className="absolute inset-0 z-15 flex items-center justify-center pointer-events-none">
                <div className="w-56 sm:w-64 h-80 sm:h-96 rounded-2xl overflow-hidden mix-blend-screen opacity-85 shadow-[0_0_50px_rgba(245,158,11,0.4)]">
                  <video
                    src={currentLabel.augmentedMediaUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover filter contrast-125"
                  />
                </div>
              </div>
            )}

            {/* Optical Bottle Reticle / HUD */}
            <BottleReticle
              isLocked={isTargetLocked}
              labelName={currentLabel.name}
              vintage={currentLabel.vintage}
              onLockToggle={() => setIsTargetLocked(!isTargetLocked)}
            />
          </div>
        ) : (
          /* Studio 3D Bottle Mode */
          <StudioBottleView
            label={currentLabel}
            isAugmenting={isTargetLocked}
            onToggleAugment={() => setIsTargetLocked(!isTargetLocked)}
          />
        )}
      </main>

      {/* 3. TASTING & SPATIAL AUDIO NODES */}
      <TastingNodes label={currentLabel} isLocked={isTargetLocked} />

      {/* 4. SWITCH VINTAGE QUICK DOCK (TOP BAR ACTION OR DRAWER) */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
        <button
          onClick={() => setShowDrawer(true)}
          className="bg-stone-900/80 hover:bg-stone-850 backdrop-blur-md border border-stone-800/80 px-3.5 py-1 rounded-full text-[11px] font-sans text-stone-300 hover:text-white flex items-center gap-1.5 shadow-md cursor-pointer"
        >
          <span className="text-amber-500 font-bold">Vintage:</span>
          <span className="font-serif font-medium truncate max-w-[130px]">{currentLabel.name}</span>
          <ChevronRight size={13} className="text-stone-500" />
        </button>
      </div>

      {/* 5. VINTAGE SELECTION SLIDE-UP DRAWER */}
      <AnimatePresence>
        {showDrawer && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm pointer-events-auto">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-stone-950 border-t border-stone-800 rounded-t-3xl p-6 max-w-lg mx-auto w-full max-h-[70vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-4 border-b border-stone-800">
                <div>
                  <h3 className="font-serif text-lg text-stone-100 font-semibold">
                    Select Godley Vintage
                  </h3>
                  <p className="text-xs text-stone-400">
                    Choose which bottle label to augment with live effects
                  </p>
                </div>
                <button
                  onClick={() => setShowDrawer(false)}
                  className="text-stone-400 hover:text-white text-xs bg-stone-900 px-3 py-1.5 rounded-lg border border-stone-800 cursor-pointer"
                >
                  Close
                </button>
              </div>

              {/* Grid / List of Available Labels */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                {labels.map((lbl) => (
                  <div
                    key={lbl.id}
                    onClick={() => handleSelectLabel(lbl)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 ${
                      currentLabel.id === lbl.id
                        ? 'bg-amber-950/20 border-amber-500/80 ring-1 ring-amber-500/50'
                        : 'bg-stone-900/40 hover:bg-stone-900 border-stone-800/80'
                    }`}
                  >
                    <div className="w-12 h-16 rounded-lg bg-stone-950 overflow-hidden flex items-center justify-center p-1 border border-stone-850 shrink-0">
                      <img
                        src={lbl.targetImageUrl}
                        alt={lbl.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="overflow-hidden">
                      <h4 className="text-xs font-serif font-bold text-stone-100 truncate">
                        {lbl.name}
                      </h4>
                      <p className="text-[10px] text-amber-400 font-mono mt-0.5">
                        {lbl.vintage}
                      </p>
                      <span className="text-[9px] text-stone-400 uppercase tracking-wider block mt-1">
                        {lbl.augmentedMediaType === 'video' ? 'Animated Video Layer' : 'Terroir Mist & Light'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
