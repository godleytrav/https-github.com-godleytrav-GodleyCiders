import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Link } from 'react-router-dom';
import Splash from './pages/Splash';
import Home from './pages/Home';
import Club from './pages/Club';
import Wholesale from './pages/Wholesale';
import Story from './pages/Story';
import Shop from './pages/Shop';
import Anatomy from './pages/Anatomy';
import Events from './pages/Events';
import EmployeePortal from './pages/EmployeePortal';
import Blog from './pages/Blog';
import AdminPage from './pages/Admin';
import LiveLabelPage from './pages/LiveLabel';
import Navigation from './components/Navigation';
import { motion, AnimatePresence } from 'motion/react';

import AtmosphericBackground from './components/AtmosphericBackground';
import Soundscape from './components/Soundscape';
import AdminPanel from './components/AdminPanel';
import AgeGate from './components/AgeGate';
import { useAdminStore } from './store/adminStore';
import CartSidebar from './components/CartSidebar';
import PWAPrompt from './components/PWAPrompt';

function ScreensaverManager({ children }: { children: React.ReactNode }) {
  const [isScreensaver, setIsScreensaver] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const location = useLocation();

  useEffect(() => {
    const event = new CustomEvent('screensaver-change', { detail: isScreensaver });
    window.dispatchEvent(event);
  }, [isScreensaver]);

  const resetTimer = () => {
    setIsScreensaver(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    // Don't start screensaver on the Splash screen
    if (location.pathname === '/') return;
    
    // Activate screensaver after 30 seconds of inactivity
    timeoutRef.current = setTimeout(() => {
      setIsScreensaver(true);
    }, 30000); 
  };

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetTimer));
    resetTimer(); // Initialize on mount/route change
    
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  }, [location.pathname]);

  return (
    <>
      <motion.div 
        animate={{ opacity: isScreensaver ? 0 : 1 }} 
        transition={{ duration: 3, ease: "easeInOut" }}
        className={isScreensaver ? "pointer-events-none" : "relative z-10"}
      >
        {children}
      </motion.div>

      <AnimatePresence>
        {isScreensaver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, ease: "easeInOut" }}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-end pb-24 cursor-pointer"
            onClick={resetTimer}
          >
            <motion.div 
              animate={{ opacity: [0.3, 0.7, 0.3], y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="flex flex-col items-center gap-4"
            >
              <div className="w-[1px] h-12 bg-gradient-to-b from-transparent to-amber-500/50" />
              <p className="text-amber-500/60 italic tracking-[0.5em] uppercase font-light text-xs">
                Move mouse to return
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function MainLayout({ children }: { children: React.ReactNode }) {
  const { toggleAdminPanel, socialSettings } = useAdminStore();
  
  return (
    <ScreensaverManager>
      <div className="min-h-screen text-stone-200 font-sans selection:bg-amber-900 selection:text-amber-50">
        <Navigation />
        <main className="pt-24 pb-16 relative z-10">
          {children}
        </main>
        <footer className="border-t border-stone-800/30 bg-stone-950/20 backdrop-blur-sm py-12 text-center text-stone-500 font-serif relative z-10 flex flex-col items-center gap-4">
          {socialSettings && (
            <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center items-center text-[10px] tracking-widest uppercase font-mono text-stone-500 mb-2">
              {socialSettings.instagramUrl && (
                <a href={socialSettings.instagramUrl} target="_blank" rel="noopener noreferrer" className="hover:text-amber-500 transition-colors">
                  Instagram
                </a>
              )}
              {socialSettings.facebookUrl && (
                <a href={socialSettings.facebookUrl} target="_blank" rel="noopener noreferrer" className="hover:text-amber-500 transition-colors">
                  Facebook
                </a>
              )}
              {socialSettings.tiktokUrl && (
                <a href={socialSettings.tiktokUrl} target="_blank" rel="noopener noreferrer" className="hover:text-amber-500 transition-colors">
                  TikTok
                </a>
              )}
              {socialSettings.youtubeUrl && (
                <a href={socialSettings.youtubeUrl} target="_blank" rel="noopener noreferrer" className="hover:text-amber-500 transition-colors">
                  YouTube
                </a>
              )}
            </div>
          )}
          <p className="text-sm tracking-widest uppercase flex items-center justify-center gap-2">
            © {new Date().getFullYear()} Godley Ciders
            <button onClick={toggleAdminPanel} className="opacity-0 cursor-pointer w-2 h-2 rounded-full absolute -right-4 focus:opacity-100"></button>
          </p>
          <div className="flex flex-wrap gap-4 items-center justify-center">
            <Link to="/live" className="text-[10px] tracking-widest uppercase text-amber-500/80 hover:text-amber-400 font-semibold transition-colors">Live Label AR</Link>
            <span className="text-stone-800 text-xs">|</span>
            <Link to="/admin" className="text-[10px] tracking-widest uppercase hover:text-amber-500 transition-colors">Executive Terminal</Link>
            <span className="text-stone-800 text-xs">|</span>
            <button onClick={toggleAdminPanel} className="text-[10px] tracking-widest uppercase hover:text-amber-500 transition-colors cursor-pointer">Quick Settings</button>
            <span className="text-stone-800 text-xs">|</span>
            <Link to="/employee" className="text-[10px] tracking-widest uppercase hover:text-amber-500 transition-colors">Shed Terminal</Link>
          </div>
        </footer>
      </div>
    </ScreensaverManager>
  );
}

function GlobalAdminListener() {
  const { toggleAdminPanel, loadFromFirebase } = useAdminStore();
  
  useEffect(() => {
    loadFromFirebase();
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Shift + Command + E (Mac) or Shift + Control + E (Windows)
      if (e.shiftKey && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        toggleAdminPanel();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleAdminPanel]);
  
  return null;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      {/* @ts-ignore - key is valid but TS doesn't recognize it on RoutesProps */}
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Splash />} />
        
        {/* Main Site Routes */}
        <Route path="/home" element={<MainLayout><Home /></MainLayout>} />
        <Route path="/club" element={<MainLayout><Club /></MainLayout>} />
        <Route path="/wholesale" element={<MainLayout><Wholesale /></MainLayout>} />
        <Route path="/story" element={<MainLayout><Story /></MainLayout>} />
        <Route path="/shop" element={<MainLayout><Shop /></MainLayout>} />
        <Route path="/anatomy" element={<MainLayout><Anatomy /></MainLayout>} />
        <Route path="/events" element={<MainLayout><Events /></MainLayout>} />
        <Route path="/journal" element={<MainLayout><Blog /></MainLayout>} />
        <Route path="/employee" element={<MainLayout><EmployeePortal /></MainLayout>} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/live" element={<LiveLabelPage />} />
        <Route path="/live-label" element={<LiveLabelPage />} />
      </Routes>
    </AnimatePresence>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function PageVisitTracker() {
  const location = useLocation();

  useEffect(() => {
    let sessionId = sessionStorage.getItem('godley_visit_session_id');
    if (!sessionId) {
      sessionId = 'sess_' + Math.random().toString(36).substring(2, 12);
      sessionStorage.setItem('godley_visit_session_id', sessionId);
    }

    fetch('/api/analytics/log-visit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pathname: location.pathname,
        sessionId: sessionId,
        referrer: document.referrer || '',
        userAgent: navigator.userAgent
      })
    }).catch(err => {
      console.warn('Analytics log skipped:', err);
    });
  }, [location.pathname]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <PageVisitTracker />
      <AgeGate />
      <AtmosphericBackground />
      <Soundscape />
      <GlobalAdminListener />
      <AdminPanel />
      <CartSidebar />
      <PWAPrompt />
      <AnimatedRoutes />
    </BrowserRouter>
  );
}

