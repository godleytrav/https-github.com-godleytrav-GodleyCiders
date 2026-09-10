import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Share, PlusSquare, Smartphone, X, Check } from 'lucide-react';

export default function PWAPrompt() {
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    // 1. Safety check to guarantee window is defined
    if (typeof window === 'undefined') return;

    // 2. Check if running on iOS (iPad/iPhone/iPod)
    const ua = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isAppleDevice);

    // 3. Check if already running in standalone PWA window
    // @ts-ignore
    const standaloneMode = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(standaloneMode);

    // 4. Verify user preference dismissal state from localStorage or sessionStorage
    const isDismissed = localStorage.getItem('g_ciders_pwa_prompt_dismissed');
    const isSessionDismissed = sessionStorage.getItem('g_ciders_pwa_prompt_session_dismissed');

    // 5. Conditions to show: Is iOS, NOT in standalone mode already, and NOT dismissed previously (permanently or in this session)
    if (isAppleDevice && !standaloneMode && !isDismissed && !isSessionDismissed) {
      // Delay presentation slightly for optimal user landing experience
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, []);

  // When clicking 'X' or 'Maybe Later'
  const handleDismissTemporary = () => {
    setIsVisible(false);
    if (dontShowAgain) {
      localStorage.setItem('g_ciders_pwa_prompt_dismissed', 'true');
    } else {
      sessionStorage.setItem('g_ciders_pwa_prompt_session_dismissed', 'true');
    }
  };

  // When clicking 'Great, I'll install it!' or choosing to mark it completed
  const handleDismissPermanent = () => {
    setIsVisible(false);
    localStorage.setItem('g_ciders_pwa_prompt_dismissed', 'true');
  };

  if (!isIOS || isStandalone) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 150, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 150, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 25 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-[92vw] max-w-md bg-stone-950/95 border border-amber-500/40 p-5 rounded-xl shadow-[0_10px_40px_rgba(245,158,11,0.15)] text-left backdrop-blur-md"
          id="pwa-install-prompt"
        >
          {/* Header Line */}
          <div className="flex justify-between items-start gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-stone-900 border border-amber-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                <img 
                  src="/logo.svg" 
                  alt="Godley Ciders App" 
                  className="w-10 h-10 object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h3 className="text-stone-100 font-serif font-black text-sm tracking-wide">
                  Godley Ciders App
                </h3>
                <p className="text-[10px] text-amber-500 font-mono uppercase tracking-widest font-semibold">
                  Install on your Home Screen
                </p>
              </div>
            </div>
            
            <button
              onClick={handleDismissTemporary}
              className="text-stone-500 hover:text-stone-300 p-1 rounded-full hover:bg-stone-900 transition-colors cursor-pointer"
              aria-label="Dismiss banner"
              type="button"
            >
              <X size={16} />
            </button>
          </div>

          {/* Description */}
          <p className="text-xs text-stone-300 leading-relaxed font-sans mb-5">
            Add Godley Ciders to your Home Screen for instant, hands-free access to your <strong>Member Pass</strong>, bottles release vouchers, and quick countertop check-ins!
          </p>

          {/* iOS Instructional Steps */}
          <div className="border-t border-stone-800/60 pt-4 space-y-3 font-sans">
            <div className="flex gap-3 items-center">
              <div className="w-7 h-7 rounded-full bg-stone-900 border border-stone-800 flex items-center justify-center text-xs text-amber-500 font-mono font-bold shrink-0">
                1
              </div>
              <p className="text-xs text-stone-200">
                Tap the <strong className="text-stone-100 font-medium">Share Button</strong> inside Safari's system bar:
                <span className="inline-flex items-center justify-center bg-stone-900 text-amber-500 p-1.5 rounded ml-2 align-middle border border-stone-800">
                  <Share size={13} className="text-amber-500" />
                </span>
              </p>
            </div>

            <div className="flex gap-3 items-center">
              <div className="w-7 h-7 rounded-full bg-stone-900 border border-stone-800 flex items-center justify-center text-xs text-amber-500 font-mono font-bold shrink-0">
                2
              </div>
              <p className="text-xs text-stone-200 flex-1">
                Scroll down and select <strong className="text-stone-100 font-medium">Add to Home Screen</strong>:
                <span className="inline-flex items-center justify-center bg-stone-900 text-amber-500 p-1.5 rounded ml-2 align-middle border border-stone-800 font-serif font-bold text-[10px]">
                  +
                </span>
              </p>
            </div>
          </div>

          {/* Custom Checkbox Row for Opt-out */}
          <div className="mt-4 pt-4 border-t border-stone-900 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-4.5 h-4.5 rounded border flex items-center justify-center transition-all ${
                dontShowAgain 
                  ? 'bg-amber-500 border-amber-500 text-stone-950' 
                  : 'border-stone-800 bg-stone-900 group-hover:border-amber-500/50'
              }`}>
                {dontShowAgain && <Check size={11} strokeWidth={3} className="text-stone-950" />}
              </div>
              <span className="text-[11px] text-stone-400 select-none group-hover:text-stone-300 transition-colors font-sans">
                Don't show this message again
              </span>
            </label>
          </div>

          {/* Prompt Action buttons */}
          <div className="mt-4 flex gap-2.5">
            <button
              type="button"
              onClick={handleDismissPermanent}
              className="flex-1 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-sans font-black text-[10px] uppercase tracking-wider rounded-md text-center shadow-lg transition-all cursor-pointer"
            >
              Great, I'll install it!
            </button>
            <button
              type="button"
              onClick={handleDismissTemporary}
              className="px-4 py-2.5 border border-stone-800 hover:border-stone-700 text-stone-400 hover:text-stone-200 font-mono text-[9px] uppercase rounded-md transition-all cursor-pointer"
            >
              Maybe Later
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
