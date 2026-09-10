import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export default function AgeGate() {
  const [isVisible, setIsVisible] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Check if the user has already verified their age
    const hasVerified = localStorage.getItem('godley_age_verified_v2');
    if (!hasVerified) {
      setIsVisible(true);
      // Disable scrolling while age gate is visible
      document.body.style.overflow = 'hidden';
    }
  }, []);

  const handleVerify = (isOfAge: boolean) => {
    if (isOfAge) {
      localStorage.setItem('godley_age_verified_v2', 'true');
      setIsVisible(false);
      document.body.style.overflow = '';
      window.dispatchEvent(new Event('godley_age_verified'));
    } else {
      setError(true);
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className="fixed inset-0 z-[99999] bg-stone-950 flex flex-col items-center justify-center p-6 text-stone-300 font-serif"
        >
          {/* Subtle background texture/overlay similar to the atmospheric background */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,theme(colors.stone.900),theme(colors.stone.950))] opacity-50 z-0" />
          
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="z-10 text-center max-w-md w-full space-y-8"
          >
            <h1 className="text-4xl md:text-5xl uppercase tracking-widest text-amber-500 font-light">
              Godley Ciders
            </h1>
            
            <div className="w-24 h-[1px] bg-amber-500/30 mx-auto" />

            <div className="space-y-4">
              <h2 className="text-xl md:text-2xl uppercase tracking-wider text-stone-200">
                Are you of legal drinking age?
              </h2>
              <p className="text-sm italic text-stone-400">
                You must be 21+ to enter this site.
              </p>
            </div>

            {error ? (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                className="text-red-400 italic text-sm py-4"
              >
                You must be of legal drinking age to enter.
              </motion.div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4 pt-4 justify-center">
                <button
                  onClick={() => handleVerify(true)}
                  className="px-8 py-3 w-full border border-amber-500/50 text-amber-500 uppercase tracking-[0.1em] text-sm hover:bg-amber-500/10 transition-colors duration-300"
                >
                  Yes I'm over 21. Let me in!
                </button>
                <button
                  onClick={() => handleVerify(false)}
                  className="px-8 py-3 border border-stone-800 text-stone-500 uppercase tracking-[0.2em] text-sm hover:bg-stone-800/50 hover:text-stone-300 transition-colors duration-300"
                >
                  No
                </button>
              </div>
            )}
            
            <p className="text-[10px] text-stone-600 uppercase tracking-widest pt-8">
              By entering, you agree to our Terms of Service and Privacy Policy.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
