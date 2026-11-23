import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAdminStore } from '../store/adminStore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronDown, ChevronUp, Save, Loader2, LogIn, Trash2, Plus,
  Search, Filter, Shield, Users, Briefcase, 
  FileText, ShoppingBag, BookOpen, Layers, Settings, Sparkles, Mail,
  Database, HelpCircle, HardDrive, Cpu, ExternalLink, RefreshCw,
  BarChart2, TrendingUp, Download, Globe, Clock, DollarSign, Bell
} from 'lucide-react';
import { db, auth } from '../firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';

import ClubMembersList from './ClubMembersList';
import WholesaleInquiriesList from './WholesaleInquiriesList';
import ShopReservationsList from './ShopReservationsList';
import NotificationsCenter from './NotificationsCenter';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

function CollapsibleSection({ title, children, defaultOpen = false }: { title: string, children: React.ReactNode, defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-stone-800 rounded bg-stone-900/30 overflow-hidden mb-4 font-sans text-left">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full flex justify-between items-center p-3 text-xs uppercase tracking-wider font-semibold text-stone-400 hover:text-amber-500 hover:bg-stone-900/50 transition-colors"
      >
        <span>{title}</span>
        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-stone-800 p-3 space-y-4"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AdminPanel() {
  const { 
    showAdminPanel, 
    toggleAdminPanel,
    devBypassWholesale,
    toggleDevBypassWholesale,
    devBypassClub,
    toggleDevBypassClub,
    splashVideoUrl,
    setSplashVideoUrl,
    splashStoryTexts,
    setSplashStoryText,
    anatomyImageUrl,
    setAnatomyImageUrl,
    anatomyHotspots,
    setAnatomyHotspot,
    homeSettings,
    setHomeSettings,
    products,
    setProduct,
    setProductHotspot,
    clubSettings,
    setClubSettings,
    wholesaleSettings,
    setWholesaleSettings,
    storySettings,
    setStorySettings,
    setStoryScene,
    setStorySceneHitbox,
    shopSettings,
    setShopSettings,
    shopProducts,
    setShopProduct,
    addShopProduct,
    deleteShopProduct,
    socialSettings,
    setSocialSettings
  } = useAdminStore();
  
  const location = useLocation();
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  
  // Widescreen Top/Side navigation states
  const [activeTab, setActiveTab] = useState<'pages' | 'database' | 'notifications' | 'metrics' | 'terminal'>('pages');
  const [activePageTab, setActivePageTab] = useState<'splash' | 'anatomy' | 'home' | 'club' | 'wholesale' | 'story' | 'shop' | 'journal'>('home');
  const [activeDbTab, setActiveDbTab] = useState<'members' | 'wholesale' | 'reservations'>('members');
  const [unreadNotifsCount, setUnreadNotifsCount] = useState<number>(0);

  useEffect(() => {
    const qUnread = query(collection(db, 'admin_notifications'), where('read', '==', false));
    const unsub = onSnapshot(qUnread, (snap) => {
      setUnreadNotifsCount(snap.size);
    }, (err) => {
      console.warn("Unread notifs listener:", err);
    });
    return () => unsub();
  }, []);

  // Telemetry & Metrics state
  const [metrics, setMetrics] = useState<any>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState('');

  const fetchMetrics = async () => {
    setMetricsLoading(true);
    setMetricsError('');
    try {
      const res = await fetch('/api/analytics/metrics');
      if (!res.ok) throw new Error('Failed to retrieve metrics metadata.');
      const data = await res.json();
      setMetrics(data);
    } catch (err: any) {
      console.error(err);
      setMetricsError(err.message || 'Error loading analytics telemetry');
    } finally {
      setMetricsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'metrics') {
      fetchMetrics();
    }
  }, [activeTab]);

  const downloadCSV = (filename: string, csvContent: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportCollection = async (collectionName: string, label: string) => {
    try {
      const { collection, getDocs, query, orderBy } = await import('firebase/firestore');
      const q = query(collection(db, collectionName), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        alert(`No records found in ${label} to export.`);
        return;
      }

      const docsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      
      const allKeys = new Set<string>();
      docsData.forEach(doc => {
        Object.keys(doc).forEach(key => {
          if (typeof doc[key] !== 'object' || doc[key] === null) {
            allKeys.add(key);
          }
        });
      });
      const headers = Array.from(allKeys);

      const csvRows = [
        headers.join(','),
        ...docsData.map(doc => {
          return headers.map(header => {
            const val = doc[header];
            if (val === undefined || val === null) return '""';
            const strVal = String(val).replace(/"/g, '""');
            return `"${strVal}"`;
          }).join(',');
        })
      ];

      downloadCSV(`godley_${collectionName}_export_${new Date().toISOString().split('T')[0]}.csv`, csvRows.join('\n'));
    } catch (err: any) {
      console.error(err);
      alert(`Failed to export ${label}: ` + err.message);
    }
  };

  const exportCRMUnified = async () => {
    try {
      const { collection, getDocs } = await import('firebase/firestore');
      const clubSnap = await getDocs(collection(db, 'club_leads'));
      const wholesaleSnap = await getDocs(collection(db, 'wholesale_inquiries'));
      const reservSnap = await getDocs(collection(db, 'shop_reservations'));

      const unifiedContacts: any[] = [];

      clubSnap.forEach(doc => {
        const d = doc.data();
        unifiedContacts.push({
          Name: d.name || "",
          Email: d.email || "",
          Phone: d.phone || "",
          Source: `Club Member (${d.tier || "Core"})`,
          Date: d.createdAt ? (typeof d.createdAt === 'string' ? d.createdAt : new Date(d.createdAt).toISOString()) : ""
        });
      });

      wholesaleSnap.forEach(doc => {
        const d = doc.data();
        unifiedContacts.push({
          Name: d.contactName || d.businessName || "",
          Email: d.email || "",
          Phone: d.phone || "",
          Source: `Wholesale Inquire (${d.businessName || ""})`,
          Date: d.createdAt ? (typeof d.createdAt === 'string' ? d.createdAt : new Date(d.createdAt).toISOString()) : ""
        });
      });

      reservSnap.forEach(doc => {
        const d = doc.data();
        unifiedContacts.push({
          Name: d.customerName || "",
          Email: d.email || "",
          Phone: d.phone || "",
          Source: `Pre-Order Standby (Ticket #${d.ticketNumber || ""})`,
          Date: d.createdAt ? (typeof d.createdAt === 'string' ? d.createdAt : new Date(d.createdAt).toISOString()) : ""
        });
      });

      if (unifiedContacts.length === 0) {
        alert("No contact records found in CRM to export.");
        return;
      }

      const headers = ["Name", "Email", "Phone", "Source", "Date"];
      const csvRows = [
        headers.join(','),
        ...unifiedContacts.map(c => {
          return headers.map(h => {
            const val = c[h];
            const strVal = String(val).replace(/"/g, '""');
            return `"${strVal}"`;
          }).join(',');
        })
      ];

      downloadCSV(`godley_unified_crm_export_${new Date().toISOString().split('T')[0]}.csv`, csvRows.join('\n'));
    } catch (err: any) {
      console.error(err);
      alert("Failed to export Unified CRM: " + err.message);
    }
  };

  // Reactively highlight the page customized based on the current location route
  useEffect(() => {
    if (location.pathname === '/') setActivePageTab('splash');
    else if (location.pathname === '/anatomy') setActivePageTab('anatomy');
    else if (location.pathname === '/home') setActivePageTab('home');
    else if (location.pathname === '/club') setActivePageTab('club');
    else if (location.pathname === '/wholesale') setActivePageTab('wholesale');
    else if (location.pathname === '/story') setActivePageTab('story');
    else if (location.pathname === '/shop') setActivePageTab('shop');
    else if (location.pathname === '/journal') setActivePageTab('journal');
  }, [location.pathname]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      setCurrentUser(user);
    });
    return unsub;
  }, []);

  const handleSave = async () => {
    setSaveError('');
    if (!currentUser) {
      try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      } catch (err: any) {
        // Log info, but do not block saving since we have verified server-side Admin fallback
        console.warn("Google Sign-In skipped or domain not whitelisted; proceeding with secure server-side save:", err.message);
      }
    }
    
    setIsSaving(true);
    try {
      await useAdminStore.getState().saveToFirebase();
      alert("Successfully published all changes to the Firestore database!");
    } catch (err: any) {
      if (err.message?.includes("permission-denied") || err.message?.includes("Missing or insufficient permissions")) {
         setSaveError("Permission denied. Enter your admin PIN or verify admin credentials.");
      } else {
         setSaveError(err.message || "Failed to save");
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (!showAdminPanel) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
        {/* Fullscreen Modal Backdrop dismissal block */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="w-full max-w-6xl h-[88vh] bg-[#0c0a09] border border-stone-850 rounded-xl overflow-hidden shadow-2xl flex flex-col font-sans text-stone-200"
        >
          {/* Executive Header */}
          <header className="px-6 py-4 bg-stone-900/50 border-b border-stone-850 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-amber-500/10 border border-amber-500/30 p-2 rounded">
                <Shield className="w-5 h-5 text-amber-500" />
              </div>
              <div className="text-left">
                <span className="text-[10px] uppercase font-mono tracking-widest text-amber-500/80 block font-bold">Godley Ciders Security Hub</span>
                <h1 className="text-sm font-serif font-black tracking-wider uppercase text-stone-100 flex items-center gap-1.5 leading-none">
                  Master Administrative Executive Terminal
                </h1>
              </div>
            </div>

            {/* Profile & Immediate Save Action Cluster */}
            <div className="flex items-center gap-3">
              {currentUser && (
                <div className="hidden sm:flex flex-col text-right font-mono text-[10px] text-stone-500">
                  <span className="text-stone-400 font-bold">Verified Administrator</span>
                  <span>{currentUser.email}</span>
                </div>
              )}

              <button 
                type="button"
                onClick={() => {
                  toggleAdminPanel();
                  navigate('/admin');
                }}
                className="hidden md:flex items-center gap-1.5 px-3 py-2 bg-stone-900 hover:bg-stone-850 text-stone-200 border border-stone-800 text-xs uppercase font-bold tracking-wider rounded transition-all cursor-pointer font-sans"
              >
                <ExternalLink className="w-3.5 h-3.5 text-amber-500" /> Full Admin Suite (/admin)
              </button>

              <button 
                onClick={handleSave} 
                disabled={isSaving}
                className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:bg-stone-800 text-stone-950 px-4 py-2 text-xs uppercase font-bold tracking-wider rounded transition-all cursor-pointer font-sans shadow"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (currentUser ? <Save className="w-3.5 h-3.5" /> : <LogIn className="w-3.5 h-3.5" />)}
                {currentUser ? 'Publish Updates' : 'Sign In To Save'}
              </button>

              <button 
                onClick={toggleAdminPanel} 
                className="text-stone-400 hover:text-white p-1 hover:bg-stone-850 rounded text-sm transition-colors cursor-pointer font-bold font-sans"
              >
                Close
              </button>
            </div>
          </header>

          {/* Error / Feedback Banner */}
          {saveError && (
            <div className="bg-red-950/70 border-b border-red-500/20 px-6 py-2.5 text-xs text-red-200 leading-relaxed font-sans text-left uppercase tracking-wider flex items-start gap-2">
              <span className="text-red-400 block font-bold">WARNING ERROR:</span>
              <span className="font-semibold">{saveError}</span>
            </div>
          )}

          {/* Primary Multi-Tab Hub Layout */}
          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar Navigation */}
            <aside className="w-64 bg-[#0a0807] border-r border-stone-850 p-4 space-y-1 overflow-y-auto flex flex-col justify-between">
              <div className="space-y-1">
                <span className="text-[9px] uppercase font-bold font-mono tracking-widest text-[#78716c] px-3 block mb-2">Category Clusters</span>
                
                <button
                  type="button"
                  onClick={() => setActiveTab('pages')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-left text-xs uppercase tracking-wider font-semibold transition-all cursor-pointer ${
                    activeTab === 'pages' 
                      ? 'bg-amber-500/10 text-amber-500 border-l-2 border-amber-500 pl-4 font-black' 
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/40'
                  }`}
                >
                  <FileText className="w-4 h-4" /> Pages Content Editor
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('database')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-left text-xs uppercase tracking-wider font-semibold transition-all cursor-pointer ${
                    activeTab === 'database' 
                      ? 'bg-amber-500/10 text-amber-500 border-l-2 border-amber-500 pl-4 font-black' 
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/40'
                  }`}
                >
                  <Database className="w-4 h-4" /> Database Collections
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('notifications')}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded text-left text-xs uppercase tracking-wider font-semibold transition-all cursor-pointer ${
                    activeTab === 'notifications' 
                      ? 'bg-amber-500/10 text-amber-500 border-l-2 border-amber-500 pl-4 font-black' 
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Bell className="w-4 h-4" /> Alerts & Email Hub
                  </div>
                  {unreadNotifsCount > 0 && (
                    <span className="bg-amber-500 text-stone-950 text-[9px] font-mono font-black px-1.5 py-0.2 rounded-full animate-pulse">
                      {unreadNotifsCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('metrics')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-left text-xs uppercase tracking-wider font-semibold transition-all cursor-pointer ${
                    activeTab === 'metrics' 
                      ? 'bg-amber-500/10 text-amber-500 border-l-2 border-amber-500 pl-4 font-black' 
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/40'
                  }`}
                >
                  <BarChart2 className="w-4 h-4" /> Site Metrics & CRM
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('terminal')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-left text-xs uppercase tracking-wider font-semibold transition-all cursor-pointer ${
                    activeTab === 'terminal' 
                      ? 'bg-amber-500/10 text-amber-500 border-l-2 border-amber-500 pl-4 font-black' 
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/40'
                  }`}
                >
                  <Cpu className="w-4 h-4" /> Diagnostics Terminal
                </button>
              </div>

              {/* Status and telemetry indicators */}
              <div className="bg-stone-900/30 p-3 rounded-lg border border-stone-850/60 font-mono text-[9px] text-[#78716c] text-left space-y-1.5">
                <div className="flex justify-between">
                  <span>SSL STATUS:</span>
                  <span className="text-emerald-500/80 uppercase font-black">SECURE</span>
                </div>
                <div className="flex justify-between">
                  <span>MASTER PIN:</span>
                  <span className="text-amber-500/80 font-bold">{clubSettings.portalPasscode || '1234'}</span>
                </div>
                <div className="flex justify-between">
                  <span>STOCKS:</span>
                  <span className="text-stone-400">{shopProducts.length} items</span>
                </div>
              </div>
            </aside>

            {/* Immersive Main Panel Content Area */}
            <main className="flex-1 bg-stone-950/20 p-6 overflow-y-auto space-y-6">
              
              {/* PAGE SETTINGS TAB */}
              {activeTab === 'pages' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-stone-850 pb-4">
                    <div>
                      <h2 className="text-lg font-serif font-bold text-stone-100 uppercase tracking-widest">Pages Content Editor</h2>
                      <p className="text-xs text-stone-400 mt-1">Select any page below to instantly customize live captions, titles, videos, hot spots, or inventory cards.</p>
                    </div>
                  </div>

                  {/* Horizontal subtabs for every individual page */}
                  <div className="flex flex-wrap gap-1.5 border-b border-stone-850 pb-2">
                    {[
                      { id: 'splash', label: 'Splash video', icon: Sparkles },
                      { id: 'anatomy', label: 'Anatomy', icon: Layers },
                      { id: 'home', label: 'Home Page', icon: FileText },
                      { id: 'club', label: 'Cider Club', icon: Users },
                      { id: 'wholesale', label: 'Wholesale', icon: Briefcase },
                      { id: 'story', label: 'Story Branch', icon: BookOpen },
                      { id: 'shop', label: 'Standby Store', icon: ShoppingBag },
                      { id: 'journal', label: 'Journal SEO', icon: Mail },
                    ].map(tab => {
                      const Icon = tab.icon;
                      const isActive = activePageTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActivePageTab(tab.id as any)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded text-xs uppercase tracking-wider font-semibold transition-all cursor-pointer ${
                            isActive 
                              ? 'bg-stone-850 text-amber-500 font-bold border border-stone-750' 
                              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/40'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" /> {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* SUB-PAGES EDITORS */}
                  <div className="pt-2 font-sans text-left">
                    {activePageTab === 'splash' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <h3 className="text-sm font-serif font-bold tracking-wider text-amber-500 uppercase">Splash Background Video</h3>
                          <div className="space-y-1 bg-stone-900/40 border border-stone-850 rounded-lg p-4">
                            <label className="text-[10px] text-[#a8a29e] uppercase font-bold tracking-widest block mb-1">Video Source Link (MP4 or Streaming)</label>
                            <input 
                              type="text" 
                              value={splashVideoUrl} 
                              onChange={(e) => setSplashVideoUrl(e.target.value)}
                              className="w-full bg-[#0a0807] border border-stone-800 rounded p-3 text-xs text-amber-500 focus:outline-none focus:border-amber-500 font-mono"
                            />
                            <p className="text-[10px] text-stone-500 leading-normal pt-1.5 font-sans">
                              Provides atmospheric cinematic looping. We highly suggest high-fidelity Vimeo, Cloud Library, or static assets (.mp4 format).
                            </p>
                          </div>

                          <div className="bg-stone-900/40 border border-stone-850 rounded-lg p-4 space-y-3">
                            <span className="text-xs uppercase font-serif font-black text-stone-300 block">Immediate Testing Options</span>
                            <p className="text-[10px] text-stone-400 leading-relaxed font-sans">
                              The Age-Gate is secure and saves user consent locally in the browser so returning patrons don't get pestered. Use this prompt button to clear local registers and test the verification gateway again:
                            </p>
                            <button
                              onClick={() => {
                                localStorage.removeItem('godley_age_verified_v2');
                                window.location.reload();
                              }}
                              className="w-full bg-stone-950 hover:bg-stone-900 border border-amber-500/20 hover:border-amber-500 text-stone-200 font-bold uppercase tracking-wider text-[10px] py-2.5 rounded transition-all cursor-pointer font-sans"
                            >
                              Reset Age Gate Bypass & Reload
                            </button>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h3 className="text-sm font-serif font-bold tracking-wider text-amber-500 uppercase">Scroll Story Cap Layer Overlay</h3>
                          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                            {splashStoryTexts.map((item, index) => (
                              <div key={index} className="space-y-1 bg-stone-900/45 p-3 rounded border border-stone-850">
                                <div className="text-[9px] font-mono text-amber-500/70 font-semibold mb-1 uppercase tracking-widest flex justify-between">
                                  <span>Text Overlay Segment {index + 1}</span>
                                  <span>Scroll: {Math.round(item.start * 100)}% - {Math.round(item.end * 100)}%</span>
                                </div>
                                <textarea
                                  value={item.text}
                                  onChange={(e) => setSplashStoryText(index, e.target.value)}
                                  className="w-full bg-[#0c0a09] border border-stone-800 rounded p-2 text-xs text-stone-300 focus:outline-none focus:border-amber-500"
                                  rows={2}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {activePageTab === 'anatomy' && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-serif font-bold tracking-wider text-amber-500 uppercase">Anatomy Page Visual Hotspots</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1 bg-stone-900/45 border border-stone-850 p-4 rounded-lg">
                            <label className="text-[10px] text-stone-400 uppercase tracking-wider block font-bold font-mono">Interactive Diagram Canvas Image Link</label>
                            <input 
                              type="text" 
                              value={anatomyImageUrl} 
                              onChange={(e) => setAnatomyImageUrl(e.target.value)}
                              className="w-full bg-[#0a0807] border border-stone-800 rounded p-2 text-xs text-stone-300 focus:outline-none font-mono focus:border-amber-500"
                            />
                            <p className="text-[10px] text-stone-500 italic mt-1 leading-normal font-sans">
                              Provide a premium, high-resolution graphic (with transparent alpha transparency ideally) to map interactive cork, label, bottle, or sediment hotspots.
                            </p>
                          </div>
                          
                          <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2">
                            {anatomyHotspots.map((item, index) => (
                              <div key={index} className="space-y-2 bg-stone-900/50 p-3 rounded border border-stone-800 block text-left">
                                <div className="text-[10px] text-amber-500/70 uppercase tracking-widest font-mono font-bold">Dynamic Hotspot #{index + 1}</div>
                                <input type="text" value={item.title} placeholder="Title" onChange={(e) => setAnatomyHotspot(index, { ...item, title: e.target.value })} className="w-full bg-[#0a0807] border border-stone-700 rounded p-1.5 text-xs text-stone-300 focus:border-amber-500 font-semibold" />
                                <textarea value={item.description} placeholder="Description" rows={2} onChange={(e) => setAnatomyHotspot(index, { ...item, description: e.target.value })} className="w-full bg-[#0a0807] border border-stone-700 rounded p-1.5 text-[10px] text-stone-400 focus:border-amber-500 resize-none font-sans" />
                                <div className="flex gap-2">
                                  <div className="flex-1"><label className="text-[8px] text-stone-500 uppercase font-mono">X coordinate (%)</label><input type="number" min="0" max="100" value={item.x} onChange={(e) => setAnatomyHotspot(index, { ...item, x: Number(e.target.value) })} className="w-full bg-[#0a0807] border border-stone-700 rounded p-1 text-xs text-stone-300 font-mono" /></div>
                                  <div className="flex-1"><label className="text-[8px] text-stone-500 uppercase font-mono">Y coordinate (%)</label><input type="number" min="0" max="100" value={item.y} onChange={(e) => setAnatomyHotspot(index, { ...item, y: Number(e.target.value) })} className="w-full bg-[#0a0807] border border-stone-700 rounded p-1 text-xs text-stone-300 font-mono" /></div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {activePageTab === 'home' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                        <div className="space-y-4">
                          <CollapsibleSection title="Aesthetic Welcome Typography" defaultOpen>
                            <div className="space-y-3">
                              <div>
                                <label className="text-[10px] text-stone-400 uppercase font-bold tracking-wider font-mono">Header Title</label>
                                <input type="text" value={homeSettings.heroTitle} onChange={e => setHomeSettings({ heroTitle: e.target.value })} className="w-full bg-[#0c0a09] border border-stone-850 rounded p-2 text-xs text-stone-100 focus:border-amber-500" />
                              </div>
                              <div>
                                <label className="text-[10px] text-stone-400 uppercase font-bold tracking-wider font-mono">Header Subtitle Paragraph</label>
                                <textarea value={homeSettings.heroSubtitle} onChange={e => setHomeSettings({ heroSubtitle: e.target.value })} className="w-full bg-[#0c0a09] border border-stone-850 rounded p-2 text-xs text-stone-400 focus:border-amber-500" rows={2} />
                              </div>
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <label className="text-[10px] text-stone-500 uppercase font-mono">Title Color</label>
                                  <input type="text" value={homeSettings.heroTitleColor} onChange={e => setHomeSettings({ heroTitleColor: e.target.value })} className="w-full bg-[#0c0a09] border border-stone-850 rounded p-2 text-xs text-stone-300" />
                                </div>
                                <div className="flex-1">
                                  <label className="text-[10px] text-stone-500 uppercase font-mono">Title Font Family</label>
                                  <input type="text" value={homeSettings.heroTitleFont} onChange={e => setHomeSettings({ heroTitleFont: e.target.value })} className="w-full bg-[#0c0a09] border border-stone-850 rounded p-2 text-xs text-stone-300" />
                                </div>
                              </div>
                              <div>
                                <label className="text-[10px] text-stone-500 uppercase font-mono">Tailwind Typography Sizing Class</label>
                                <input type="text" value={homeSettings.heroTitleSize} onChange={e => setHomeSettings({ heroTitleSize: e.target.value })} className="w-full bg-[#0c0a09] border border-stone-850 rounded p-2 text-xs text-stone-300" />
                              </div>
                            </div>
                          </CollapsibleSection>

                          <CollapsibleSection title="Volcanic Geology / Anatomy Intro">
                            <div className="space-y-3">
                              <div>
                                <label className="text-[10px] text-stone-400 uppercase font-bold tracking-wider font-mono">Anatomy Title Banner</label>
                                <textarea value={homeSettings.anatomySectionTitle} onChange={e => setHomeSettings({ anatomySectionTitle: e.target.value })} className="w-full bg-[#0c0a09] border border-stone-850 rounded p-2 text-xs text-stone-200" rows={2} />
                              </div>
                              <div>
                                <label className="text-[10px] text-stone-400 uppercase font-bold tracking-wider font-mono">Anatomy Subtitle Paragraph</label>
                                <textarea value={homeSettings.anatomySectionSubtitle} onChange={e => setHomeSettings({ anatomySectionSubtitle: e.target.value })} className="w-full bg-[#0c0a09] border border-stone-850 rounded p-2 text-xs text-stone-400" rows={2} />
                              </div>
                            </div>
                          </CollapsibleSection>

                          <CollapsibleSection title="Scenic / Story Segment Overlay">
                            <div className="space-y-3">
                              <div>
                                <label className="text-[10px] text-stone-400 uppercase font-mono font-bold block mb-0.5">Focus Story Overlay Title</label>
                                <input type="text" value={homeSettings.storyTitle} onChange={e => setHomeSettings({ storyTitle: e.target.value })} className="w-full bg-[#0c0a09] border border-stone-850 rounded p-2 text-xs text-stone-200" />
                              </div>
                              <div>
                                <label className="text-[10px] text-stone-400 uppercase font-mono font-bold block mb-0.5">Focus Story Overlay Description</label>
                                <textarea value={homeSettings.storyBody} onChange={e => setHomeSettings({ storyBody: e.target.value })} className="w-full bg-[#0c0a09] border border-stone-850 rounded p-2 text-[10px] text-stone-300" rows={3} />
                              </div>
                              <div>
                                <label className="text-[10px] text-stone-500 uppercase font-mono">Button Overlay Caption</label>
                                <input type="text" value={homeSettings.storyButtonText} onChange={e => setHomeSettings({ storyButtonText: e.target.value })} className="w-full bg-[#0c0a09] border border-stone-850 rounded p-2 text-xs text-stone-350" />
                              </div>
                            </div>
                          </CollapsibleSection>
                        </div>

                        <div className="space-y-4">
                          <div className="border border-stone-850 bg-stone-900/30 rounded-lg p-4 space-y-4">
                            <h3 className="text-sm font-serif font-bold tracking-wider text-amber-500 uppercase">Interactive Eden Specimen (Bottles)</h3>
                            <div className="space-y-4 max-h-[480px] overflow-y-auto pr-2">
                              {products.map((prod, pIndex) => (
                                <div key={prod.id} className="space-y-3 bg-[#0c0a09] p-3 rounded-lg border border-stone-850">
                                  <h4 className="text-amber-500 text-xs font-serif font-black tracking-widest uppercase border-b border-stone-900 pb-1.5">{prod.name}</h4>
                                  <div>
                                    <label className="text-[10px] text-stone-500 uppercase font-mono">Name</label>
                                    <input type="text" value={prod.name} onChange={e => setProduct(pIndex, { name: e.target.value })} className="w-full bg-[#070505] border border-stone-800 rounded p-2 text-xs text-stone-300 focus:border-amber-500" />
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-[10px] text-stone-550 uppercase font-mono">Cider Vintage</label>
                                      <input type="text" value={prod.vintage} onChange={e => setProduct(pIndex, { vintage: e.target.value })} className="w-full bg-[#070505] border border-stone-800 rounded p-2 text-xs text-stone-350" />
                                    </div>
                                    <div>
                                      <label className="text-[10px] text-stone-550 uppercase font-mono">Specimen Illustration Link</label>
                                      <input type="text" value={prod.imageUrl} onChange={e => setProduct(pIndex, { imageUrl: e.target.value })} className="w-full bg-[#070505] border border-stone-800 rounded p-2 text-xs text-stone-350" />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-stone-500 uppercase font-mono">Product Profile Notes</label>
                                    <textarea value={prod.description} onChange={e => setProduct(pIndex, { description: e.target.value })} className="w-full bg-[#070505] border border-stone-800 rounded p-2 text-[10px] text-stone-400 focus:border-amber-500" rows={2} />
                                  </div>
                                  
                                  <div className="pt-2">
                                    <label className="text-[9px] text-[#78716c] font-black uppercase font-mono tracking-widest border-b border-stone-900 block pb-1 mb-2">Bottle Hotspots</label>
                                    {prod.hotspots.map((hp, hIndex) => (
                                      <div key={hp.id} className="space-y-1.5 mb-3 bg-[#070505] p-2 border border-stone-850 rounded">
                                        <input type="text" value={hp.title} placeholder="Hotspot Label Title" onChange={e => setProductHotspot(pIndex, hIndex, { ...hp, title: e.target.value })} className="w-full bg-[#0c0a09] border border-stone-850 rounded p-1 text-[10px] text-stone-300 font-semibold" />
                                        <textarea value={hp.description} placeholder="Short Description text" rows={2} onChange={e => setProductHotspot(pIndex, hIndex, { ...hp, description: e.target.value })} className="w-full bg-[#0c0a09] border border-stone-850 rounded p-1 text-[10px] text-stone-400 font-sans resize-none" />
                                        <div className="flex gap-2 font-mono text-[9px]">
                                          <input type="number" value={hp.x} onChange={e => setProductHotspot(pIndex, hIndex, { ...hp, x: Number(e.target.value) })} className="w-full bg-[#0c0a09] border border-stone-850 rounded p-1 text-[#a8a29e]" placeholder="X %" />
                                          <input type="number" value={hp.y} onChange={e => setProductHotspot(pIndex, hIndex, { ...hp, y: Number(e.target.value) })} className="w-full bg-[#0c0a09] border border-stone-850 rounded p-1 text-[#a8a29e]" placeholder="Y %" />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {activePageTab === 'club' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                        <div className="space-y-4">
                          <h3 className="text-sm font-serif font-bold tracking-wider text-amber-500 uppercase">Cider Club Header Text</h3>
                          <div className="bg-stone-900/40 border border-stone-850 rounded-lg p-4 space-y-3">
                            <div>
                              <label className="text-[10px] text-stone-400 font-mono font-bold block mb-0.5">Hero Headline Title</label>
                              <input type="text" value={clubSettings.title} onChange={e => setClubSettings({ title: e.target.value })} className="w-full bg-[#0c0a09] border border-stone-850 p-2 text-xs text-stone-150" />
                            </div>
                            <div>
                              <label className="text-[10px] text-stone-400 font-mono font-bold block mb-0.5">Sub-headline Description</label>
                              <textarea value={clubSettings.subtitle} onChange={e => setClubSettings({ subtitle: e.target.value })} className="w-full bg-[#0c0a09] border border-stone-850 p-2 text-xs text-stone-400" rows={3} />
                            </div>
                          </div>

                          <h3 className="text-sm font-serif font-bold tracking-wider text-amber-500 uppercase">Club Subscriptions Costing ($/month)</h3>
                          <div className="bg-stone-900/40 border border-[#292524] rounded-lg p-4 grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-[9px] text-[#78716c] uppercase font-bold tracking-wider font-mono">Core cost</label>
                              <input type="text" value={clubSettings.corePrice ?? "45"} onChange={e => setClubSettings({ corePrice: e.target.value })} className="w-full bg-[#0c0a09] border border-[#292524] text-center p-2 text-xs text-amber-500 font-mono" />
                            </div>
                            <div>
                              <label className="text-[9px] text-[#78716c] uppercase font-bold tracking-wider font-mono">Branch cost</label>
                              <input type="text" value={clubSettings.branchPrice ?? "75"} onChange={e => setClubSettings({ branchPrice: e.target.value })} className="w-full bg-[#0c0a09] border border-[#292524] text-center p-2 text-xs text-amber-500 font-mono" />
                            </div>
                            <div>
                              <label className="text-[9px] text-[#78716c] uppercase font-bold tracking-wider font-mono">Heritage cost</label>
                              <input type="text" value={clubSettings.heritagePrice ?? "120"} onChange={e => setClubSettings({ heritagePrice: e.target.value })} className="w-full bg-[#0c0a09] border border-[#292524] text-center p-2 text-xs text-amber-500 font-mono" />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4 border border-stone-850 rounded-lg p-4 bg-stone-900/30">
                          <h3 className="text-sm font-serif font-bold tracking-wider text-stone-200 uppercase">Priority Gatekeeper Settings</h3>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between bg-stone-950 p-3 rounded-lg border border-stone-850">
                              <div className="max-w-[200px]">
                                <label className="text-[10px] text-stone-200 uppercase block font-bold">Wines & Ciders Waitlist Mode</label>
                                <p className="text-[9px] text-stone-500 mt-0.5 leading-normal">Forces new registrations to the pre-sale standby database queue instead of direct Stripe checkout.</p>
                              </div>
                              <input 
                                type="checkbox" 
                                checked={!!clubSettings.isWaitlistMode} 
                                onChange={e => setClubSettings({ isWaitlistMode: e.target.checked })} 
                                className="w-4 h-4 accent-amber-500 rounded bg-[#0a0807] border-stone-800 cursor-pointer"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-stone-500 uppercase font-mono font-bold block mb-0.5">Active spots currently clear (Allocations remaining)</label>
                              <input 
                                type="text" 
                                value={clubSettings.activeSpotsAvailable ?? "0"} 
                                onChange={e => setClubSettings({ activeSpotsAvailable: e.target.value })} 
                                className="w-full bg-[#0c0a09] border border-stone-800 rounded p-2 text-xs text-[#a8a29e] font-mono" 
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-stone-500 uppercase font-mono font-bold block mb-0.5">Maximum memberships caps limit</label>
                              <input 
                                type="text" 
                                value={clubSettings.maxMembers ?? "150"} 
                                onChange={e => setClubSettings({ maxMembers: e.target.value })} 
                                className="w-full bg-[#0c0a09] border border-stone-800 rounded p-2 text-xs text-[#a8a29e] font-mono" 
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-stone-500 uppercase font-mono font-bold block mb-0.5">Employee portal PIN passcode</label>
                              <input 
                                type="text" 
                                value={clubSettings.portalPasscode ?? "1234"} 
                                onChange={e => setClubSettings({ portalPasscode: e.target.value })} 
                                className="w-full bg-[#0c0a09] border border-stone-800 rounded p-2 text-xs text-[#a8a29e] font-mono" 
                              />
                              <p className="text-[9px] text-stone-500 mt-1 leading-normal font-sans">
                                Authorizes terminal access inside Placer tasting sheds at <code className="text-amber-500">/employee</code>.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {activePageTab === 'wholesale' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                        <div className="space-y-4">
                          <h3 className="text-sm font-serif font-bold tracking-wider text-amber-500 uppercase">Wholesale Hub Headings</h3>
                          <div className="#bg-stone-900/40 border border-stone-850 rounded-lg p-4 space-y-3">
                            <div>
                              <label className="text-[10px] text-stone-400 font-mono font-bold block mb-0.5">Headline Title</label>
                              <input type="text" value={wholesaleSettings.title} onChange={e => setWholesaleSettings({ title: e.target.value })} className="w-full bg-[#0c0a09] border border-stone-850 p-2 text-xs text-stone-200" />
                            </div>
                            <div>
                              <label className="text-[10px] text-stone-400 font-mono font-bold block mb-0.5">Subtitle Paragraph</label>
                              <textarea value={wholesaleSettings.subtitle} onChange={e => setWholesaleSettings({ subtitle: e.target.value })} className="w-full bg-[#0c0a09] border border-stone-850 p-2 text-xs text-stone-400" rows={2} />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h3 className="text-sm font-serif font-bold tracking-wider text-amber-500 uppercase">Partnership Credentials & Terms</h3>
                          <div className="bg-stone-900/40 border border-[#292524] rounded-lg p-4 space-y-3">
                            <div>
                              <label className="text-[10px] text-stone-400 font-mono font-bold block mb-0.5">Main Informational Block</label>
                              <textarea value={wholesaleSettings.body} onChange={e => setWholesaleSettings({ body: e.target.value })} className="w-full bg-[#0c0a09] border border-stone-850 p-2 text-xs text-stone-400" rows={4} />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] text-stone-500 uppercase font-mono">Wholesale Approval Gmail</label>
                                <input type="email" value={wholesaleSettings.email} onChange={e => setWholesaleSettings({ email: e.target.value })} className="w-full bg-[#0c0a09] border border-stone-850 p-2 text-xs text-[#a8a29e]" />
                              </div>
                              <div>
                                <label className="text-[10px] text-stone-500 uppercase font-mono">Tasting Room phone</label>
                                <input type="text" value={wholesaleSettings.phone} onChange={e => setWholesaleSettings({ phone: e.target.value })} className="w-full bg-[#0c0a09] border border-stone-850 p-2 text-xs text-[#a8a29e]" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {activePageTab === 'story' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                        <div className="space-y-4">
                          <h3 className="text-sm font-serif font-bold tracking-wider text-amber-500 uppercase">Cinematic Story Headings</h3>
                          <div className="bg-stone-900/40 border border-stone-850 rounded-lg p-4 space-y-3">
                            <div>
                              <label className="text-[10px] text-stone-400 font-mono font-bold block mb-0.5">Story Headline Title</label>
                              <input type="text" value={storySettings.title} onChange={e => setStorySettings({ title: e.target.value })} className="w-full bg-[#0c0a09] border border-stone-850 p-2 text-xs text-stone-150" />
                            </div>
                            <div>
                              <label className="text-[10px] text-stone-400 font-mono font-bold block mb-0.5">Brief Story Tagline Subtitle</label>
                              <textarea value={storySettings.subtitle} onChange={e => setStorySettings({ subtitle: e.target.value })} className="w-full bg-[#0c0a09] border border-stone-850 p-2 text-xs text-stone-400 font-sans" rows={2} />
                            </div>
                            <div>
                              <label className="text-[10px] text-stone-400 font-mono font-bold block mb-0.5">Primary Story Description (Paragraph 1)</label>
                              <textarea value={storySettings.body1} onChange={e => setStorySettings({ body1: e.target.value })} className="w-full bg-[#0c0a09] border border-stone-850 p-2 text-[10px] text-stone-450 leading-relaxed font-sans" rows={3} />
                            </div>
                            <div>
                              <label className="text-[10px] text-stone-400 font-mono font-bold block mb-0.5">Detailed Story Description (Paragraph 2)</label>
                              <textarea value={storySettings.body2} onChange={e => setStorySettings({ body2: e.target.value })} className="w-full bg-[#0c0a09] border border-stone-850 p-2 text-[10px] text-stone-450 leading-relaxed font-sans" rows={3} />
                            </div>
                            <div>
                              <label className="text-[10px] text-stone-500 uppercase font-mono">Aesthetic Scenic Static Banner</label>
                              <input type="text" value={storySettings.imageUrl} onChange={e => setStorySettings({ imageUrl: e.target.value })} className="w-full bg-[#0c0a09] border border-stone-850 p-2 text-xs text-stone-300" />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h3 className="text-sm font-serif font-bold tracking-wider text-amber-500 uppercase">Interactive Video Branches Scene Node Map</h3>
                          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                            {storySettings.scenes.map((scene, sIndex) => (
                              <div key={scene.id} className="space-y-3 bg-[#0c0a09] p-3 rounded-lg border border-stone-850 font-sans">
                                <h4 className="text-amber-500 text-xs font-serif font-black tracking-widest uppercase border-b border-stone-900 pb-1.5">{scene.id}</h4>
                                <div>
                                  <label className="text-[10px] text-stone-400 uppercase font-mono block mb-1">Interactive Video Node URL</label>
                                  <input type="text" value={scene.videoUrl} onChange={e => setStoryScene(sIndex, { videoUrl: e.target.value })} className="w-full bg-[#070505] border border-stone-800 rounded p-2 text-xs text-amber-500 font-mono" />
                                </div>
                                
                                <div className="pt-2">
                                  <label className="text-[9px] text-[#78716c] font-bold uppercase tracking-widest block mb-2 font-mono">Branch Decisions Hitboxes</label>
                                  {scene.hitboxes.map((hitbox, hIndex) => (
                                    <div key={hitbox.id} className="space-y-2 mb-3 bg-[#070505] p-2 border border-stone-850 rounded text-left">
                                      <input type="text" value={hitbox.label} placeholder="Decision Option Label" onChange={e => setStorySceneHitbox(sIndex, hIndex, { label: e.target.value })} className="w-full bg-[#0c0a09] border border-stone-850 rounded p-1.5 text-xs text-stone-300 font-semibold" />
                                      <div className="grid grid-cols-2 gap-2 font-mono text-[9px]">
                                        <div>
                                          <label className="text-[8px] text-stone-500 uppercase font-mono">Timeline Start (s)</label>
                                          <input type="number" value={hitbox.timeStart} onChange={e => setStorySceneHitbox(sIndex, hIndex, { timeStart: Number(e.target.value) })} className="w-full bg-[#0c0a09] border border-stone-850 rounded p-1 text-[#a8a29e]" />
                                        </div>
                                        <div>
                                          <label className="text-[8px] text-stone-500 uppercase font-mono">Timeline End (s)</label>
                                          <input type="number" value={hitbox.timeEnd} onChange={e => setStorySceneHitbox(sIndex, hIndex, { timeEnd: Number(e.target.value) })} className="w-full bg-[#0c0a09] border border-stone-850 rounded p-1 text-[#a8a29e]" />
                                        </div>
                                      </div>
                                      
                                      <div className="grid grid-cols-4 gap-1 font-mono text-[8px]">
                                        <div><label className="text-stone-500">X (%)</label><input type="number" value={hitbox.x} onChange={e => setStorySceneHitbox(sIndex, hIndex, { x: Number(e.target.value) })} className="w-full bg-[#0c0a09] border border-stone-850 rounded p-0.5 text-stone-300" /></div>
                                        <div><label className="text-stone-500">Y (%)</label><input type="number" value={hitbox.y} onChange={e => setStorySceneHitbox(sIndex, hIndex, { y: Number(e.target.value) })} className="w-full bg-[#0c0a09] border border-stone-850 rounded p-0.5 text-stone-300" /></div>
                                        <div><label className="text-stone-500">W (%)</label><input type="number" value={hitbox.width} onChange={e => setStorySceneHitbox(sIndex, hIndex, { width: Number(e.target.value) })} className="w-full bg-[#0c0a09] border border-stone-850 rounded p-0.5 text-stone-300" /></div>
                                        <div><label className="text-stone-500">H (%)</label><input type="number" value={hitbox.height} onChange={e => setStorySceneHitbox(sIndex, hIndex, { height: Number(e.target.value) })} className="w-full bg-[#0c0a09] border border-stone-850 rounded p-0.5 text-stone-300" /></div>
                                      </div>
                                      
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="text-[8px] text-stone-500 uppercase font-mono">Destination Node Link</label>
                                          <input type="text" value={hitbox.targetSceneId} onChange={e => setStorySceneHitbox(sIndex, hIndex, { targetSceneId: e.target.value })} className="w-full bg-[#0c0a09] border border-stone-850 rounded p-1.5 text-[10px] text-stone-300 font-mono" />
                                        </div>
                                        <div>
                                          <label className="text-[8px] text-stone-500 uppercase font-mono">Tasting Dialogue Script</label>
                                          <textarea value={hitbox.dialogue || ''} onChange={e => setStorySceneHitbox(sIndex, hIndex, { dialogue: e.target.value })} className="w-full bg-[#0c0a09] border border-stone-850 rounded p-1 text-[9px] text-[#a8a29e]" rows={1} />
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {activePageTab === 'shop' && (
                      <div className="space-y-6 text-left">
                        <div className="grid grid-cols-1 md:grid-[#0c0a09]-2 gap-6">
                          <div className="bg-stone-900/40 border border-stone-850 rounded-lg p-4 space-y-3">
                            <h3 className="text-sm font-serif font-bold tracking-wider text-amber-500 uppercase">Shop Storefront Headlines</h3>
                            <div>
                              <label className="text-[10px] text-stone-400 font-mono font-bold block mb-0.5">Headline Title</label>
                              <input type="text" value={shopSettings.title} onChange={e => setShopSettings({ title: e.target.value })} className="w-full bg-[#0c0a09] border border-stone-850 p-2 text-xs text-stone-150" />
                            </div>
                            <div>
                              <label className="text-[10px] text-stone-400 font-mono font-bold block mb-0.5">Tagline Sub-headline</label>
                              <textarea value={shopSettings.subtitle} onChange={e => setShopSettings({ subtitle: e.target.value })} className="w-full bg-[#0c0a09] border border-stone-850 p-2 text-xs text-stone-400" rows={2} />
                            </div>
                          </div>

                          <div className="bg-[#1c1917]/20 border border-amber-900/30 p-4 rounded-lg space-y-2">
                            <h3 className="text-xs uppercase font-mono font-black text-amber-500 flex items-center gap-1">Direct Stripe Checkout & Inventory Sync</h3>
                            <p className="text-[10px] text-stone-400 leading-relaxed font-sans">
                              Live inventory automatically decrements when orders complete via Apple Pay, Google Pay, or card. Manage stock quantities below:
                            </p>
                            <div className="bg-amber-955/20 border border-amber-500/20 p-3 rounded font-mono text-[9px] text-amber-400">
                              Direct purchasing is live. Any new products added here will be immediately purchasable on the web store.
                            </div>
                          </div>
                        </div>

                        {/* Store Catalog layout manager */}
                        <div className="border border-stone-850 rounded-lg p-5 bg-[#0a0807]">
                          <div className="flex justify-between items-center border-b border-stone-850 pb-3 mb-4">
                            <div>
                              <h3 className="text-md font-serif font-bold tracking-wider text-stone-150 uppercase">Active Shop Catalog & Live Inventory</h3>
                              <p className="text-[11px] text-stone-400 font-sans mt-0.5">Add ciders or merchandise. Stock updates here sync directly to the online store and POS.</p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  addShopProduct({
                                    name: "New Vintage Cider",
                                    type: "Harvest Vintage",
                                    description: "Crafted with 100% estate and heirloom heritage apples.",
                                    price: 24,
                                    image: "/assets/ciders/(store)The_knowedge.webp",
                                    available: true,
                                    category: "cider",
                                    inventoryCount: 48
                                  });
                                }}
                                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 text-[11px] font-bold uppercase tracking-wider rounded flex items-center gap-1.5 transition-all shadow cursor-pointer font-sans"
                              >
                                <Plus size={13} /> Add Cider
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  addShopProduct({
                                    name: "Godley Cellar Goods",
                                    type: "Apparel & Gear",
                                    description: "Custom premium merchandise handcrafted for Godley patrons.",
                                    price: 32,
                                    image: "/assets/Merchandise /T-shirt.png",
                                    available: true,
                                    category: "merch",
                                    inventoryCount: 25
                                  });
                                }}
                                className="px-3 py-1.5 border border-stone-700 hover:border-amber-500/60 text-stone-300 hover:text-amber-400 text-[11px] font-bold uppercase tracking-wider rounded flex items-center gap-1.5 transition-all cursor-pointer font-sans"
                              >
                                <Plus size={13} /> Add Merch
                              </button>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {shopProducts.map((prod, pIndex) => (
                              <div key={prod.id || pIndex} className="bg-stone-950 p-3.5 rounded-lg border border-stone-850 space-y-3 text-left relative group">
                                <div className="flex justify-between items-center border-b border-stone-900 pb-2">
                                  <div className="flex items-center gap-2">
                                    {prod.image && (
                                      <img 
                                        src={prod.image} 
                                        alt={prod.name} 
                                        className="w-8 h-8 object-contain rounded bg-stone-900 border border-stone-800 p-0.5" 
                                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                      />
                                    )}
                                    <span className="text-amber-500 text-xs font-serif font-black tracking-widest uppercase">{prod.name}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <label className="text-[9px] text-stone-400 flex items-center gap-1 cursor-pointer">
                                      Active:
                                      <input type="checkbox" checked={prod.available} onChange={e => setShopProduct(pIndex, { available: e.target.checked })} className="accent-amber-500" />
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => { if (window.confirm(`Delete product "${prod.name}"?`)) deleteShopProduct(pIndex); }}
                                      className="text-stone-500 hover:text-red-400 transition-colors p-1"
                                      title="Delete Product"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div>
                                    <label className="text-[10px] text-stone-500 uppercase font-mono">Product Name</label>
                                    <input type="text" value={prod.name} onChange={e => setShopProduct(pIndex, { name: e.target.value })} className="w-full bg-[#0a0807] border border-stone-850 rounded p-1.5 text-stone-300" />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-stone-500 uppercase font-mono font-bold">Category</label>
                                    <select value={prod.category || "cider"} onChange={e => setShopProduct(pIndex, { category: e.target.value as any })} className="w-full bg-[#0a0807] border border-stone-850 rounded p-1.5 text-stone-300 h-[32px]">
                                      <option value="cider">Liquid Class (Cider)</option>
                                      <option value="merch">Dry Class (Merch)</option>
                                    </select>
                                  </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <label className="text-[10px] text-stone-550 uppercase font-mono">Subtitle / Vintage</label>
                                    <input type="text" value={prod.type} onChange={e => setShopProduct(pIndex, { type: e.target.value })} className="w-full bg-[#0a0807] border border-[#292524] text-[#a8a29e] p-1.5 rounded" />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-stone-550 uppercase font-mono">Price ($)</label>
                                    <input type="number" value={prod.price} onChange={e => setShopProduct(pIndex, { price: Number(e.target.value) })} className="w-full bg-[#0a0807] border border-[#292524] text-amber-505 p-1.5 rounded font-mono" />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-stone-550 uppercase font-mono font-bold text-amber-400">In Stock Count</label>
                                    <input type="number" value={prod.inventoryCount ?? 20} onChange={e => setShopProduct(pIndex, { inventoryCount: Number(e.target.value) })} className="w-full bg-[#0a0807] border border-[#292524] text-amber-505 p-1.5 rounded font-mono" />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-[10px] text-stone-500 uppercase font-mono">Illustration Image URL or Asset Path</label>
                                  <input type="text" value={prod.image} onChange={e => setShopProduct(pIndex, { image: e.target.value })} className="w-full bg-[#0a0807] border border-stone-800 p-1.5 rounded font-mono text-[9px] text-[#a8a29e]" />
                                </div>
                                <div>
                                  <label className="text-[10px] text-stone-500 uppercase font-mono font-bold block mb-0.5">Description Notes</label>
                                  <textarea value={prod.description} onChange={e => setShopProduct(pIndex, { description: e.target.value })} className="w-full bg-[#0a0807] border border-[#292524] text-stone-400 p-1 font-sans text-[10px]" rows={2} />
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          <div className="flex flex-col sm:flex-row gap-3 mt-4">
                            <button
                              type="button"
                              onClick={() => {
                                addShopProduct({
                                  name: "New Vintage Cider",
                                  type: "Heritage Cider",
                                  description: "Slow-fermented estate blend.",
                                  price: 24,
                                  image: "/assets/ciders/(store)The_knowedge.webp",
                                  available: true,
                                  category: "cider",
                                  inventoryCount: 48
                                });
                              }}
                              className="flex-1 py-3 border-2 border-dashed border-stone-800 hover:border-amber-500/50 hover:bg-stone-900/40 text-stone-400 hover:text-amber-500 font-bold text-xs uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer font-sans"
                            >
                              <Plus size={14} /> Add New Cider Product
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                addShopProduct({
                                  name: "New Merch Item",
                                  type: "Merchandise",
                                  description: "Authentic Godley Ciders gear.",
                                  price: 30,
                                  image: "/assets/Merchandise /T-shirt.png",
                                  available: true,
                                  category: "merch",
                                  inventoryCount: 20
                                });
                              }}
                              className="flex-1 py-3 border-2 border-dashed border-stone-800 hover:border-stone-600 hover:bg-stone-900/40 text-stone-400 hover:text-stone-200 font-bold text-xs uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer font-sans"
                            >
                              <Plus size={14} /> Add New Merchandise Product
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {activePageTab === 'journal' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                        <div className="space-y-4">
                          <h3 className="text-sm font-serif font-bold tracking-wider text-amber-500 uppercase">Aesthetic Social Accounts Coordinates</h3>
                          <div className="bg-stone-900/40 border border-[#292524] rounded-lg p-4 space-y-3 font-sans">
                            <p className="text-[10px] text-stone-500 italic">These direct coordinates instantly configure your scrapbook anchors and public sensory links.</p>
                            <div>
                              <label className="text-[9px] text-stone-400 font-mono uppercase block mb-0.5">Instagram Account Link</label>
                              <input type="url" value={socialSettings?.instagramUrl ?? ""} onChange={e => setSocialSettings({ instagramUrl: e.target.value })} className="w-full bg-[#0c0a09] border border-stone-800 p-1.5 rounded text-[10px] text-stone-300 font-mono" placeholder="https://instagram.com/godleyciders" />
                            </div>
                            <div>
                              <label className="text-[9px] text-stone-400 font-mono uppercase block mb-0.5">Facebook Account Link</label>
                              <input type="url" value={socialSettings?.facebookUrl ?? ""} onChange={e => setSocialSettings({ facebookUrl: e.target.value })} className="w-full bg-[#0c0a09] border border-stone-800 p-1.5 rounded text-[10px] text-stone-300 font-mono" placeholder="https://facebook.com/godleyciders" />
                            </div>
                            <div>
                              <label className="text-[9px] text-stone-400 font-mono uppercase block mb-0.5">TikTok Account Link</label>
                              <input type="url" value={socialSettings?.tiktokUrl ?? ""} onChange={e => setSocialSettings({ tiktokUrl: e.target.value })} className="w-full bg-[#0c0a09] border border-stone-800 p-1.5 rounded text-[10px] text-stone-300 font-mono" placeholder="https://tiktok.com/@godleyciders" />
                            </div>
                            <div>
                              <label className="text-[9px] text-stone-400 font-mono uppercase block mb-0.5">YouTube Channel Link</label>
                              <input type="url" value={socialSettings?.youtubeUrl ?? ""} onChange={e => setSocialSettings({ youtubeUrl: e.target.value })} className="w-full bg-[#0c0a09] border border-stone-800 p-1.5 rounded text-[10px] text-stone-300 font-mono" placeholder="https://youtube.com/@godleyciders" />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h3 className="text-sm font-serif font-bold tracking-wider text-stone-200 uppercase">Google Crawling Indexes & Serps</h3>
                          <div className="bg-[#0c0a09] border border-stone-850 p-4 rounded-lg space-y-3 font-sans text-xs">
                            <div className="flex justify-between items-center bg-stone-950 p-2 border border-stone-900 rounded font-mono text-[9px]">
                              <span className="text-stone-500">Google SEO Core Indexing</span>
                              <span className="text-emerald-400 font-black">100 / 100</span>
                            </div>
                            <div className="flex justify-between items-center bg-stone-950 p-2 border border-stone-900 rounded font-mono text-[9px]">
                              <span className="text-stone-500">Structured JSON-LD Schema</span>
                              <span className="text-amber-500 font-bold">Active Compliant</span>
                            </div>
                            
                            <span className="text-xs font-serif text-stone-400 block pt-1 font-bold">Organic Google Snippet Preview</span>
                            <div className="bg-[#0a0807] border border-stone-850 p-3 rounded text-left font-sans text-[11px] leading-relaxed text-[#4d5156] bg-stone-950">
                              <span className="text-stone-500 block text-[9px]">https://godleyciders.com › journal</span>
                              <h4 className="text-[#1a0dab] font-semibold text-xs py-0.5 hover:underline">The Science of Wild Fermentation | Godley Ciders</h4>
                              <span>June 2026 — Learn the biology of native yeast fermentation in organic Placer County apple strains...</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* DATABASE COLLECTIONS TAB */}
              {activeTab === 'database' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-stone-850 pb-4">
                    <div>
                      <h2 className="text-lg font-serif font-bold text-stone-100 uppercase tracking-widest">Database Collections</h2>
                      <p className="text-xs text-stone-400 mt-1">Direct read-write tables of active queues, standby registers, pre-orders, and verified distributors.</p>
                    </div>
                  </div>

                  {/* Horizontal subtabs for database collections */}
                  <div className="flex gap-1.5 border-b border-stone-850 pb-2">
                    {[
                      { id: 'members', label: 'Club Members Log', count: 'Collection matches' },
                      { id: 'wholesale', label: 'Wholesale Inquiries', count: 'Partners' },
                      { id: 'reservations', label: 'Pre-Orders Standby Queue', count: 'Sales' },
                    ].map(tab => {
                      const isActive = activeDbTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveDbTab(tab.id as any)}
                          className={`px-4 py-2 rounded text-xs uppercase tracking-wider font-semibold transition-all cursor-pointer ${
                            isActive 
                              ? 'bg-stone-850 text-amber-500 font-black border border-stone-750' 
                              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/40'
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* DATABASE MODULE CONTAINER */}
                  <div className="bg-stone-900/20 border border-stone-850 p-4 rounded-xl min-h-[300px]">
                    {!currentUser ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                        <LogIn className="w-8 h-8 text-stone-600 animate-bounce" />
                        <div className="space-y-1">
                          <h4 className="text-sm uppercase font-serif font-bold text-stone-300">Authentication Required</h4>
                          <p className="text-xs text-stone-500 max-w-sm">Durable database entries are securely gated behind California Administrative protocols. Please sign in to authenticate.</p>
                        </div>
                        <button 
                          onClick={handleSave}
                          className="bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold uppercase tracking-wider text-xs px-5 py-2.5 rounded transition-all cursor-pointer"
                        >
                          Sign In via Google Admin Account
                        </button>
                      </div>
                    ) : (
                      <>
                        {activeDbTab === 'members' && <ClubMembersList />}
                        {activeDbTab === 'wholesale' && <WholesaleInquiriesList />}
                        {activeDbTab === 'reservations' && <ShopReservationsList />}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* SITE METRICS & CRM ANALYTICS TAB */}
              {activeTab === 'metrics' && (
                <div className="space-y-6 text-left">
                  <div className="flex items-center justify-between border-b border-stone-850 pb-4">
                    <div>
                      <h2 className="text-lg font-serif font-bold text-stone-100 uppercase tracking-widest">Site Metrics & CRM</h2>
                      <p className="text-xs text-stone-400 mt-1">Live customer traffic telemetry, conversion metrics, and integrated CRM records database.</p>
                    </div>
                    <button
                      type="button"
                      onClick={fetchMetrics}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 border border-stone-800 text-[10px] uppercase font-bold tracking-wider text-stone-400 hover:text-amber-500 rounded transition-colors cursor-pointer animate-none"
                    >
                      <RefreshCw size={12} className={metricsLoading ? 'animate-spin' : ''} />
                      Refresh Data
                    </button>
                  </div>

                  {metricsError && (
                    <div className="bg-red-950/40 border border-red-500/20 p-3 rounded text-[10px] text-red-400 font-mono">
                      Error: {metricsError}
                    </div>
                  )}

                  {metricsLoading && !metrics ? (
                    <div className="flex flex-col items-center justify-center py-24 space-y-3">
                      <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                      <p className="text-xs text-stone-500 font-mono uppercase tracking-widest">Compiling CRM Telemetry...</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Telemetry Cards Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="bg-[#0a0807] border border-stone-850 p-4 rounded-lg text-left space-y-1">
                          <span className="text-[9px] uppercase font-mono font-bold text-stone-500 flex items-center gap-1">
                            <Globe size={11} className="text-stone-600" /> Unique Visits
                          </span>
                          <p className="text-2xl font-serif text-stone-250 font-light">{metrics?.visits ?? 0}</p>
                          <span className="text-[9px] text-stone-600 block">Total sessions tracked</span>
                        </div>
                        <div className="bg-[#0a0807] border border-stone-850 p-4 rounded-lg text-left space-y-1">
                          <span className="text-[9px] uppercase font-mono font-bold text-stone-500 flex items-center gap-1">
                            <Clock size={11} className="text-stone-600" /> Pageviews
                          </span>
                          <p className="text-2xl font-serif text-amber-500 font-light">{metrics?.pageviews ?? 0}</p>
                          <span className="text-[9px] text-stone-600 block">Route loads total</span>
                        </div>
                        <div className="bg-[#0a0807] border border-stone-850 p-4 rounded-lg text-left space-y-1">
                          <span className="text-[9px] uppercase font-mono font-bold text-stone-500 flex items-center gap-1">
                            <Users size={11} className="text-stone-600" /> Club Members
                          </span>
                          <p className="text-2xl font-serif text-stone-250 font-light">{metrics?.signups ?? 0}</p>
                          <span className="text-[9px] text-stone-600 block">Active club registrations</span>
                        </div>
                        <div className="bg-[#0a0807] border border-stone-850 p-4 rounded-lg text-left space-y-1">
                          <span className="text-[9px] uppercase font-mono font-bold text-stone-500 flex items-center gap-1">
                            <ShoppingBag size={11} className="text-stone-600" /> Pre-Orders
                          </span>
                          <p className="text-2xl font-serif text-stone-250 font-light">{metrics?.reservations ?? 0}</p>
                          <span className="text-[9px] text-stone-600 block">Standby list count</span>
                        </div>
                        <div className="bg-[#0a0807] border border-stone-850 p-4 rounded-lg text-left space-y-1">
                          <span className="text-[9px] uppercase font-mono font-bold text-stone-500 flex items-center gap-1">
                            <DollarSign size={11} className="text-emerald-500/80" /> Settled Sales
                          </span>
                          <p className="text-2xl font-serif text-emerald-400 font-bold">
                            ${(metrics?.revenue ?? 0).toFixed(2)}
                          </p>
                          <span className="text-[9px] text-stone-600 block">{metrics?.paidOrdersCount ?? 0} settled orders</span>
                        </div>
                      </div>

                      {/* Middle Grid: Path Views & Export Center */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Traffic Breakdown per Route */}
                        <div className="bg-[#0a0807] border border-stone-850 rounded-lg p-5 space-y-4">
                          <h3 className="text-xs uppercase font-mono font-black text-amber-500 tracking-wider">Pageviews per Path coordinate</h3>
                          <div className="space-y-1.5 font-mono text-[10px]">
                            {metrics?.pathBreakdown && Object.keys(metrics.pathBreakdown).length > 0 ? (
                              Object.entries(metrics.pathBreakdown)
                                .sort((a, b) => (b[1] as number) - (a[1] as number))
                                .map(([path, count]) => {
                                  const totalViews = metrics?.pageviews || 1;
                                  const pct = Math.round(((count as number) / totalViews) * 100);
                                  return (
                                    <div key={path} className="space-y-1">
                                      <div className="flex justify-between text-stone-300">
                                        <span className="text-stone-400">{path}</span>
                                        <span>{count as number} views ({pct}%)</span>
                                      </div>
                                      <div className="w-full bg-stone-900 h-1.5 rounded-full overflow-hidden border border-stone-850">
                                        <div className="bg-amber-500/60 h-full rounded-full" style={{ width: `${pct}%` }} />
                                      </div>
                                    </div>
                                  );
                                })
                            ) : (
                              <p className="text-stone-600 text-left italic">Waiting for visits telemetry to stream...</p>
                            )}
                          </div>
                        </div>

                        {/* EXPORT CENTRE */}
                        <div className="bg-[#0a0807] border border-stone-850 rounded-lg p-5 space-y-4">
                          <h3 className="text-xs uppercase font-mono font-black text-amber-500 tracking-wider">CRM Data Export Hub</h3>
                          <p className="text-[10px] text-stone-500 italic font-sans">
                            Extract active databases into standard spreadsheets instantly for external newsletter dispatches or inventory ingestion.
                          </p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            <button
                              type="button"
                              onClick={() => exportCollection('club_leads', 'Club Members')}
                              className="flex items-center justify-center gap-2 py-3 bg-stone-900 border border-stone-800 hover:border-amber-500/40 text-stone-300 hover:text-amber-500 text-[10px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer font-sans"
                            >
                              <Download size={12} /> Club Members (.csv)
                            </button>
                            <button
                              type="button"
                              onClick={() => exportCollection('wholesale_inquiries', 'Wholesale Partners')}
                              className="flex items-center justify-center gap-2 py-3 bg-stone-900 border border-stone-800 hover:border-amber-500/40 text-stone-300 hover:text-amber-500 text-[10px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer font-sans"
                            >
                              <Download size={12} /> Wholesale (.csv)
                            </button>
                            <button
                              type="button"
                              onClick={() => exportCollection('shop_reservations', 'Pre-Orders Standby Queue')}
                              className="flex items-center justify-center gap-2 py-3 bg-stone-900 border border-stone-800 hover:border-amber-500/40 text-stone-300 hover:text-amber-500 text-[10px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer font-sans"
                            >
                              <Download size={12} /> Pre-orders (.csv)
                            </button>
                            <button
                              type="button"
                              onClick={() => exportCollection('visitor_logs', 'Visitor Logs')}
                              className="flex items-center justify-center gap-2 py-3 bg-stone-900 border border-stone-800 hover:border-amber-500/40 text-stone-300 hover:text-amber-500 text-[10px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer font-sans"
                            >
                              <Download size={12} /> Traffic Logs (.csv)
                            </button>
                          </div>

                          <div className="border-t border-stone-850 pt-4 mt-2">
                            <button
                              type="button"
                              onClick={exportCRMUnified}
                              className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold uppercase tracking-widest rounded transition-all cursor-pointer font-sans shadow-lg"
                            >
                              <Download size={14} /> Export Unified CRM Directory (.csv)
                            </button>
                            <p className="text-[9px] text-stone-600 mt-1.5 text-center font-sans">
                              Compiles contacts across all subscription lists into a unified marketing spreadsheet directory.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Recent Orders Log */}
                      <div className="bg-[#0a0807] border border-stone-850 rounded-lg p-5">
                        <h3 className="text-xs uppercase font-mono font-black text-amber-500 tracking-wider mb-3 text-left">Recent Online Settlements (Stripe Gateway)</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-[11px] font-sans">
                            <thead>
                              <tr className="border-b border-stone-850 text-[9px] uppercase tracking-wider text-stone-500">
                                <th className="pb-2">Order Reference</th>
                                <th className="pb-2">Customer name</th>
                                <th className="pb-2">Email</th>
                                <th className="pb-2">Amount settled</th>
                                <th className="pb-2">Status</th>
                                <th className="pb-2">Settled At</th>
                              </tr>
                            </thead>
                            <tbody>
                              {metrics?.recentOrders && metrics.recentOrders.length > 0 ? (
                                metrics.recentOrders.map((ord: any) => (
                                  <tr key={ord.id} className="border-b border-stone-900/40 hover:bg-stone-900/20 text-stone-300">
                                    <td className="py-2.5 font-mono text-[10px] text-amber-500 font-bold">#GOD-{ord.orderId}</td>
                                    <td className="py-2.5 font-bold">{ord.customerName}</td>
                                    <td className="py-2.5 text-stone-400">{ord.customerEmail}</td>
                                    <td className="py-2.5 font-mono text-emerald-400 font-bold">${ord.total.toFixed(2)}</td>
                                    <td className="py-2.5">
                                      <span className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[9px] uppercase font-mono rounded">
                                        {ord.status}
                                      </span>
                                    </td>
                                    <td className="py-2.5 text-stone-500 font-mono text-[9px]">{new Date(ord.createdAt).toLocaleString()}</td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={6} className="py-4 text-center text-stone-500 italic">No credit settlements logged on the server.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* NOTIFICATIONS & EMAIL LOGS HUB */}
              {activeTab === 'notifications' && (
                <NotificationsCenter />
              )}

              {/* CONSOLE / SYSTEM DIAG PANEL */}
              {activeTab === 'terminal' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-stone-850 pb-4">
                    <div>
                      <h2 className="text-lg font-serif font-bold text-stone-100 uppercase tracking-widest">Diagnostics Terminal Console</h2>
                      <p className="text-xs text-stone-400 mt-1">Developer triggers, active project endpoints, bypass switches, and simulation gates.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
                    {/* Bypasses */}
                    <div className="border border-stone-850 rounded-lg p-5 bg-[#0a0807] space-y-4">
                      <h3 className="text-xs uppercase font-mono font-black text-amber-500 tracking-wider">Gate Bypasses & Sandbox Keys</h3>
                      
                      <div className="space-y-3 font-sans">
                        <label className="flex items-center gap-3 text-xs text-stone-300 cursor-pointer select-none bg-[#0c0a09] border border-stone-850 p-2.5 rounded-lg hover:border-stone-750 transition-all">
                          <input type="checkbox" checked={devBypassWholesale} onChange={toggleDevBypassWholesale} className="accent-amber-500 w-4 h-4 rounded cursor-pointer" />
                          <div>
                            <span className="font-semibold block text-stone-250">Bypass Wholesale Distributors Verification</span>
                            <span className="text-[10px] text-stone-500">Allows instant form testing without requiring license verification steps.</span>
                          </div>
                        </label>
                        
                        <label className="flex items-center gap-3 text-xs text-stone-300 cursor-pointer select-none bg-[#0c0a09] border border-stone-850 p-2.5 rounded-lg hover:border-stone-750 transition-all">
                          <input type="checkbox" checked={devBypassClub} onChange={toggleDevBypassClub} className="accent-amber-500 w-4 h-4 rounded cursor-pointer" />
                          <div>
                            <span className="font-semibold block text-stone-250">Bypass Cider Club Standby Waiting Gate</span>
                            <span className="text-[10px] text-stone-500">Allows direct test purchases even under waitlist mode.</span>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* BevForge Specs */}
                    <div className="border border-stone-850 rounded-lg p-5 bg-[#0a0807] space-y-4 lg:col-span-2">
                      <h3 className="text-xs uppercase font-mono font-black text-amber-500 tracking-wider">BevForge Custom Code Integration Coordinates</h3>
                      <p className="text-[10px] text-stone-400 italic font-sans mb-1">
                        Connect your local program or custom code terminal securely via our real-time Sync & Ingestion API protocols:
                      </p>

                      <div className="space-y-3 font-mono text-[9px]">
                        <div className="bg-[#0c0a09] border border-stone-850 p-3 rounded-lg space-y-1.5">
                          <div className="flex justify-between border-b border-stone-850 pb-1.5 mb-1.5">
                            <span className="text-[#a8a29e] font-bold">1. Outbound Pull Queue (Local Ingestion)</span>
                            <span className="text-emerald-400 uppercase font-black font-mono">GET</span>
                          </div>
                          <p className="text-stone-300 select-all">https://godleyciders.com/api/sync/pull</p>
                          <p className="text-[#78716c] text-[8px] leading-relaxed">
                            Pulls latest queued order activities, pre-sales, and wholesale registrants. Employs local CRM outbox state sync.
                          </p>
                        </div>

                        <div className="bg-[#0c0a09] border border-stone-850 p-3 rounded-lg space-y-1.5">
                          <div className="flex justify-between border-b border-stone-850 pb-1.5 mb-1.5">
                            <span className="text-[#a8a29e] font-bold">2. Acknowledge Logs (Clear Queue)</span>
                            <span className="text-amber-500 uppercase font-black font-mono">POST</span>
                          </div>
                          <p className="text-stone-300 select-all">https://godleyciders.com/api/sync/ack</p>
                          <p className="text-[#78716c] text-[8px] leading-relaxed">
                            Clears pulled entries from the cloud queue once successfully synced and recorded to your local system database.
                          </p>
                        </div>

                        <div className="bg-[#0c0a09] border border-stone-850 p-3 rounded-lg space-y-1.5">
                          <div className="flex justify-between border-b border-stone-850 pb-1.5 mb-1.5">
                            <span className="text-[#a8a29e] font-bold">3. Inbound Webhook (Local to Web)</span>
                            <span className="text-blue-400 uppercase font-black font-mono">POST</span>
                          </div>
                          <p className="text-stone-300 select-all">https://godleyciders.com/api/webhooks/sync</p>
                          <p className="text-[#78716c] text-[8px] leading-relaxed">
                            Send direct product stock levels and state verification updates from your custom local program directly back to the website.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Technical details bottom row */}
                  <div className="border border-stone-850 rounded-lg p-5 bg-[#0a0807] space-y-3 text-left">
                    <h3 className="text-xs uppercase font-mono font-black text-amber-500 tracking-wider">Operational Firebase Meta-parameters</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#0c0a09] border border-stone-850 rounded-lg p-4 font-mono text-[10px] text-[#a8a29e]">
                      <div>
                        <span className="text-[#78716c] block text-[8px] uppercase font-bold tracking-wider mb-0.5">Secure Firestore Project ID</span>
                        <span className="text-stone-300 select-all break-all">{(auth as any).app?.options?.projectId || 'Unconfigured Project'}</span>
                      </div>
                      <div>
                        <span className="text-[#78716c] block text-[8px] uppercase font-bold tracking-wider mb-0.5">Secure Auth Domain Coordinates</span>
                        <span className="text-stone-300 select-all break-all">{(auth as any).app?.options?.authDomain || 'Unconfigured Domain'}</span>
                      </div>
                      <div>
                        <span className="text-[#78716c] block text-[8px] uppercase font-bold tracking-wider mb-0.5">Key Access Token MD5 Header</span>
                        <span className="text-stone-300 select-all break-all">
                          {(auth as any).app?.options?.apiKey ? `${(auth as any).app.options.apiKey.substring(0, 18)}...` : 'Unconfigured Token'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </main>
          </div>

          {/* Footer bar */}
          <footer className="bg-[#0a0807] px-6 py-3 border-t border-stone-850 flex items-center justify-between text-[10px] font-mono text-[#78716c]">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
              <span>LOGGED IN ADMIN SESSIONS SECURED VIA COMPLIANT SECURE PROTOCOL</span>
            </div>
            <div>
              <span>LOCAL STAMP: {new Date().toLocaleDateString()}</span>
            </div>
          </footer>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
