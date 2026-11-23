import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useAdminStore } from '../store/adminStore';
import { 
  Sparkles, 
  Heart, 
  Sliders, 
  Star, 
  Lock, 
  User as UserIcon, 
  Plus, 
  Check, 
  Clock, 
  BookOpen, 
  ArrowRight, 
  Share2, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  Type, 
  Bookmark, 
  Calendar, 
  Hash, 
  QrCode, 
  Flame, 
  ChevronRight,
  ShieldCheck,
  CheckCircle,
  Smartphone,
  X,
  ChevronLeft,
  Monitor,
  Tv,
  Play,
  Pause,
  Maximize
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// Available ciders for virtual label swiping/tapping
const PRESS_LIST = [
  {
    id: 'golden-russet',
    name: 'Golden Russet Blend',
    style: 'Champagne Brut Style',
    abv: '7.8% ABV',
    themeColor: '#eab308', // gold-500
    subtext: 'Bountiful honeyed nose',
    gradientClass: 'from-amber-500/10 via-yellow-500/5 to-transparent',
    borderClass: 'border-yellow-500/30 group-hover:border-yellow-500/60',
    colorText: 'text-yellow-500',
    badgeBg: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
  },
  {
    id: 'roxbury-russet',
    name: 'Roxbury Russet Cask',
    style: 'Traditional Cask Dry',
    abv: '8.2% ABV',
    themeColor: '#d97706', // amber-600
    subtext: 'Rich neutral French oak finish',
    gradientClass: 'from-amber-600/10 via-amber-500/5 to-transparent',
    borderClass: 'border-amber-600/30 group-hover:border-amber-600/60',
    colorText: 'text-amber-500',
    badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
  },
  {
    id: 'wickson-crab',
    name: 'Wickson Crab Wild Draft',
    style: 'Extreme Bone-Dry',
    abv: '8.4% ABV',
    themeColor: '#84cc16', // lime-500
    subtext: 'High acid, wild yeast buzz',
    gradientClass: 'from-lime-500/10 via-yellow-600/5 to-transparent',
    borderClass: 'border-lime-500/30 group-hover:border-lime-500/60',
    colorText: 'text-lime-500',
    badgeBg: 'bg-lime-500/10 text-lime-400 border-lime-500/20'
  },
  {
    id: 'ginger-hops',
    name: 'Auburn Ginger Hops',
    style: 'Botanized Dry Draft',
    abv: '6.9% ABV',
    themeColor: '#f97316', // orange-500
    subtext: 'Fresh root ginger infusion',
    gradientClass: 'from-orange-500/10 via-red-500/5 to-transparent',
    borderClass: 'border-orange-500/30 group-hover:border-orange-500/60',
    colorText: 'text-orange-500',
    badgeBg: 'bg-orange-500/10 text-orange-400 border-orange-500/20'
  }
];

// Rich, SEO articles preserved as "Cidermaker's Archives" inside Taproom Feed
const BLOG_POSTS = [
  {
    id: 'wild-fermentation-science',
    title: 'The Science of Wild Fermentation: Placer County Heirloom Apples',
    slug: 'wild-fermentation-science',
    date: 'June 10, 2026',
    readTime: '6 min read',
    category: 'Cidercraft & Science',
    excerpt: 'Deep in the foothill stone-soil of Placer County, wild local yeasts ferment our heirloom apples under custom temperatures. Explore the biology of micro-terroir that defines Godley Ciders.',
    content: `Cider making is an ancient dialogue between soil, sun, and yeast. While modern industrial facilities rely on commercially engineered yeasts to drive fast, predictable fermentation, Godley Ciders champions a slower, riskier, but infinitely more rewarding path: Wild Fermentation.

Our foothill vineyards and orchards are blessed with native yeasts—specifically strains of *Saccharomyces uvarum* and diverse micro-flora residing natively on the waxy skins of our heirloom apple cultivars (including Roxbury Russet and Golden Russet).

### The Biodynamic Terroir of Auburn & Placer County
Placer County is defined by its well-drained, mineral-rich, volcanic stone soils and warm afternoon sun coupled with cool Sierra mountain air gaps. When these factors align:
1. Apples produce a rich density of polyphenols (tannins) and balanced malic acidity.
2. Wild yeast colonies develop unique complex flavor precursors—yielding hints of dry honeycomb, damp native oak, and leather notes that simply cannot be synthesized in a lab.

### Micro-Climatology in the Cask
Our fermentation runs slow, cool, and on-sediment inside hand-sanded organic French neutral oak cooperage. We allow natural temperature curves to guide yeast activity. As fermentation completes over several months, the cider develops natural stability. In alignment with California Department of Food and Beverage codes, our methods ensure strict purity—never pasteurized, never watered down, and zero artificial coloring.`,
    tags: ['Wild Fermentation', 'Placer County', 'Golden Russet', 'Soil Biology', 'Cidercraft'],
    seoKeywords: 'wild fermentation, heirloom cider apples, Placer County ciders, artisan cidermaker, natural yeast fermentation, California craft cider, Auburn CA orchards',
    metaDescription: 'Discover the native biology of wild yeast fermentation and volcanic stone-soil micro-climatology in Placer County. Authored by cidermaker Travis Godley.',
    elevation: '1,240 FT (Auburn Foothills)',
    acidity: 'pH 3.42',
    brix: '16.5° Brix',
    yeasts: 'Native Saccharomyces uvarum',
    aging: '6 months neutral French Oak',
    acidityScore: 85,
    tanninScore: 45,
    drynessScore: 95,
    effervescentScore: 60,
  },
  {
    id: 'cider-pairing-guide',
    title: 'Art of the Table: Pairing Heirloom Cider with Farm-to-Table Cuisine',
    slug: 'cider-pairing-guide',
    date: 'May 28, 2026',
    readTime: '5 min read',
    category: 'Gastronomy',
    excerpt: 'Forget sweet cider pairings. True bone-dry heritage ciders match complex roasted pork belly, sharp Placer goat cheeses, and artisan sourdough like fine vintage Champagne.',
    content: `For decades, ciders in North America were marketed as heavily sweetened, low-character alternative drafts. But a culinary renaissance is unfolding. Bone-dry heritage ciders are reclaiming their place next to top-tier vintage wines on Michelin-starred tables.

Because Godley Ciders emphasizes dry, oak-finished fermentation with significant tannin structures, our bottles display distinct acidity that slices beautifully through rich culinary fats.

### Pairing Blueprint: Acid vs. Polyphonic Fats

Here is the master pairing menu vetted in our Placer County host cellar lounge:

*   **Pairing One: The Wild Homestead Reserve & Roasted Pork Belly**
    The intense tannic structure of our Golden Russet blend bonds with caramelized pork fat. The clean malic acidity clears the palate with each sip, leaving behind delicate wood undertones.
*   **Pairing Two: Double-Fermented Dry Draft & Placer Goat Cheese**
    Local artisanal chèvre demands an acidic equal. The crisp, honeyed aroma of dry honey yeast cuts the creaminess flawlessly, balancing natural saltiness with high-elevation mineral notes.
*   **Pairing Three: Ginger Hops Blend & Heirloom Sourdough**
    Wild-fermented yeasts and earthy ginger flavors resonate with natural lactobacillus cultures in artisan country loaves. A perfect rustic comfort match.`,
    tags: ['Cider Pairing', 'Gastronomy', 'Pork Belly', 'Local Goat Cheese', 'Dry Cider Cuisine'],
    seoKeywords: 'heirloom cider food pairing, dry cider gastronomy, local farm-to-table pairings, gourmet cider combinations, Placer County cheese pairing, organic dry draft',
    metaDescription: 'A modern culinary guide to pairing bone-dry heirloom ciders with artisan farm-to-table ciders, roasted fat meats, and sharp Placer County cheese boards.',
    elevation: '1,150 FT (Lincoln Foothills)',
    acidity: 'pH 3.31',
    brix: '17.2° Brix',
    yeasts: 'Wild Saccharomyces & Honey Yeast',
    aging: '12 months old oak barrels',
    acidityScore: 90,
    tanninScore: 30,
    drynessScore: 100,
    effervescentScore: 80,
  },
  {
    id: 'legacy-orchards-preservation',
    title: 'Shedding Light On Legacy Cask Orchards: Keeping History Alive',
    slug: 'legacy-orchards-preservation',
    date: 'April 15, 2026',
    readTime: '8 min read',
    category: 'Legacy & Sustainability',
    excerpt: 'Centuries-old apple varieties are dissolving under modern commercial agriculture. Travis Godley details the fight to graft, source, and multiply vintage cider cultivars.',
    content: `If you walk through a standard grocery store, you might think apples come in only half a dozen varieties: Gala, Fuji, Red Delicious, and Granny Smith. These monocultures were selected for long industrial shelf-life and high water yields. They are completely unsuitable for cidermaking.

Real craft cider requires "spitters"—apples so dense with natural tannins and organic acids that drinking their immediate fresh juice makes you want to spit it out. In England and France, these vintage varieties are treated as sacred. In California, they were nearly lost to history.

### The Grafting Crusade in Placer County
At Godley Ciders, we do not settle for commercial juices. Over the past five seasons, we have mapped out wild, abandoned, pre-prohibition homestead orchards across Northern California. 

Using traditional grafting techniques, we clip dormant budwood from sleeping centenarian trees and fuse them onto active, volcanic-grown rootstocks right here in Auburn. This keeps heritage assets alive, maintaining:
- **Golden Russet**: The Champagne of cider apples.
- **Roxbury Russet**: North America's oldest cultivated variety, dating back to 1640.
- **Wickson Crab**: A high-sugar, ultra-high acid California marvel grown by legacy dry-land farmers.

By preserving these orchards, we secure dry ciders that reflect ancient micro-terroirs. Standard industrial brands cannot copy this flavor, because they lack the heritage wood to grow it.`,
    tags: ['Grafting Crusade', 'Legacy Orchards', 'Roxbury Russet', 'Traditional Grafting', 'Rare Cultivars'],
    seoKeywords: 'heirloom apple farming, legacy cider orchards, traditional apple grafting, Roxbury Russet California, Placer County heritage apples, Godley ciders sustainability',
    metaDescription: 'Explore Travis Godley’s dedicated project to preserve, graft, and harvest historical pre-prohibition cider apple orchards across California’s volcanic foothills.',
    elevation: '1,350 FT (Centenarian Plots)',
    acidity: 'pH 3.55',
    brix: '18.4° Brix',
    yeasts: 'Indigenous Wild Yeasts',
    aging: '18 months slow lees aging',
    acidityScore: 75,
    tanninScore: 85,
    drynessScore: 90,
    effervescentScore: 40,
  }
];

// Fast, no-typing pairing bubbles
const PAIRING_BUBBLES = [
  { label: "Sharp Cheddar" },
  { label: "Creamy Chèvre" },
  { label: "Roasted Pork" },
  { label: "Smoked BBQ" },
  { label: "Spicy Tacos" },
  { label: "Sourdough Bread" },
  { label: "Apple Fritters" },
  { label: "Candied Bacon" }
];

export default function Blog() {
  const { socialSettings } = useAdminStore();
  
  // Condense the Journal into three clean tabs:
  // 'log-taste' (Log a Taste input), 'my-cellar' (My Cellar list), 'taproom-feed' (Public community + blog)
  const [activeTab, setActiveTab] = useState<'log-taste' | 'my-cellar' | 'taproom-feed'>('log-taste');
  
  // Taproom Feed Sub-Tab Selector ('guestbook' for polaroids, 'maker-logs' for Travis's blogs)
  const [feedSubTab, setFeedSubTab] = useState<'guestbook' | 'maker-logs'>('guestbook');
  
  // Blog detailed reader mode states (retained from old version)
  const [selectedPost, setSelectedPost] = useState<typeof BLOG_POSTS[0] | null>(BLOG_POSTS[0]);
  const [readFontSize, setReadFontSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [isDimmed, setIsDimmed] = useState(false);
  const [showTerroirSpecs, setShowTerroirSpecs] = useState(true);

  // Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Firestore community comments (The Guest Scrapbook)
  const [scrapbookRecords, setScrapbookRecords] = useState<any[]>([]);
  const [scrapbookLoading, setScrapbookLoading] = useState(false);

  // Interactive "Log a Taste" Form States
  const [selectedCider, setSelectedCider] = useState<string>('Golden Russet Blend');
  const [sliderSweetness, setSliderSweetness] = useState<number>(10); // Default Dry
  const [sliderCharacter, setSliderCharacter] = useState<number>(15); // Default Crisp
  const [selectedPairings, setSelectedPairings] = useState<string[]>(['Sharp Cheddar']);
  const [remarksText, setRemarksText] = useState<string>('');
  const [publishLive, setPublishLive] = useState<boolean>(true); // Defaults to ON

  // Guest Information (No typing auth barrier!)
  const [guestName, setGuestName] = useState<string>('');

  const [formLoading, setFormLoading] = useState(false);
  const [formSuccess, setFormSuccess] = useState(false);

  // Local Storage Tasting History (For guest offline cellar value!)
  const [localHistory, setLocalHistory] = useState<any[]>([]);
  
  // Database Personal history if logged in
  const [cloudHistory, setCloudHistory] = useState<any[]>([]);

  // Local user likes record to prevent duplicate abuse
  const [likedCards, setLikedCards] = useState<{ [key: string]: boolean }>({});
  const [floatingHearts, setFloatingHearts] = useState<{ id: string; x: number; y: number; cardId: string }[]>([]);

  // Projector Theatre Mode states (Taproom Physical-to-Digital Bridge)
  const [projectorActive, setProjectorActive] = useState<boolean>(false);
  const [projectorIndex, setProjectorIndex] = useState<number>(0);
  const [projectorSpeed, setProjectorSpeed] = useState<number>(8000); // 8 seconds default
  const [projectorTheme, setProjectorTheme] = useState<'candlelight' | 'midnight' | 'orchard'>('candlelight');
  const [projectorFont, setProjectorFont] = useState<'serif' | 'sans'>('serif');
  const [projectorPlaying, setProjectorPlaying] = useState<boolean>(true);

  // Passive profanity filter scanner to ensure clean events projection
  const sanitizeText = (txt: string): string => {
    if (!txt) return "";
    const badWords = [
      /\bshit\b/gi, /\bfuck\b/gi, /\basshole\b/gi, /\bbitch\b/gi, /\bcunt\b/gi,
      /\bdick\b/gi, /\bcock\b/gi, /\bpussy\b/gi, /\bastard\b/gi, /\bwhore\b/gi
    ];
    let clean = txt;
    badWords.forEach(pattern => {
      clean = clean.replace(pattern, (match) => {
        return match[0] + "*".repeat(match.length - 1);
      });
    });
    return clean;
  };

  // Listen to Auth State
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return unsub;
  }, []);

  // Hydrate local storage history on startup
  useEffect(() => {
    try {
      const stored = localStorage.getItem('godley_local_cellar');
      if (stored) {
        setLocalHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.warn("Storage hydration bypassed.", e);
    }
  }, []);

  // Listen live to the "blog_comments" collection (Cask Guest Scrapbook)
  useEffect(() => {
    const q = query(collection(db, 'blog_comments'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setScrapbookRecords(records);
    }, (err) => {
      console.warn("Real-time guestboard is operating in standby mode.", err);
    });
    return unsub;
  }, []);

  // Listen live to user's "tasting_logs" only if authenticated
  useEffect(() => {
    if (!currentUser) {
      setCloudHistory([]);
      return;
    }
    const q = query(collection(db, 'tasting_logs'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Filter safely in memory for auth boundaries
      const filtered = logs.filter((l: any) => l.userId === currentUser.uid);
      setCloudHistory(filtered);
    }, (err) => {
      console.warn("Cloud vault is holding in offline secure lock.", err);
    });
    return unsub;
  }, [currentUser]);

  // Auto-cycling loop for Projector mode slideshow (Taproom Physical-to-Digital Bridge)
  useEffect(() => {
    if (!projectorActive || !projectorPlaying) return;
    
    const liveTastings = scrapbookRecords.filter(r => r.isTastingLog === true);
    if (liveTastings.length <= 1) return;

    const interval = setInterval(() => {
      setProjectorIndex((prevIndex) => (prevIndex + 1) % liveTastings.length);
    }, projectorSpeed);

    return () => clearInterval(interval);
  }, [projectorActive, projectorPlaying, scrapbookRecords, projectorSpeed]);

  // Handle Cider Label swipe tap
  const handleCiderTap = (name: string) => {
    setSelectedCider(name);
  };

  // Toggle pairing tag
  const handlePairingToggle = (tagLabel: string) => {
    if (selectedPairings.includes(tagLabel)) {
      setSelectedPairings(prev => prev.filter(p => p !== tagLabel));
    } else {
      setSelectedPairings(prev => [...prev, tagLabel]);
    }
  };

  // Calculate sweetness label text dynamically
  const getSweetnessText = (val: number) => {
    if (val <= 15) return "BONE DRY (Zesty, champagne residual weight)";
    if (val <= 45) return "CRISP DRY (Refreshing, orchard skin finish)";
    if (val <= 75) return "OFF-DRY (Perfect sweet fruit bloom)";
    return "NECTAR SWEET (Indulgent wilderness honeycomb finish)";
  };

  // Calculate crispness vs oaky funk label
  const getCharacterText = (val: number) => {
    if (val <= 20) return "RAZOR CRISP (Pure stainless, cool air finish)";
    if (val <= 50) return "BALANCED SIPPABLE (Clean vintage wood notes)";
    if (val <= 80) return "OAK BRIGHT (Neutral cask tannins, subtle forest nose)";
    return "HISTORIC FUNK (Indigenous wild yeasts, clay floor depth)";
  };

  // Dynamic user naming label
  const activeUserDisplayName = currentUser 
    ? (currentUser.displayName || currentUser.email?.split('@')[0] || "Club Member")
    : (guestName.trim() || "Guest");

  // Submit Tasting Log (Gamified execution)
  const handleTastingLogPublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (remarksText.length === 0) return;
    setFormLoading(true);

    const safeNotes = sanitizeText(remarksText);
    const timeNow = new Date();

    const newLogItem = {
      isTastingLog: true,
      authorName: activeUserDisplayName,
      ciderName: selectedCider,
      sweetness: sliderSweetness,
      character: sliderCharacter,
      pairings: selectedPairings,
      notes: safeNotes,
      rating: 5, // perfect rating for community events
      createdAtStamp: timeNow.getTime(),
      likes: 0
    };

    try {
      // 1. If user published LIVE to Taproom, write directly to the world-readable "blog_comments"
      if (publishLive) {
        await addDoc(collection(db, 'blog_comments'), {
          ...newLogItem,
          createdAt: serverTimestamp(),
          postSlug: 'taproom-session',
          postTitle: 'Taproom Taste Session'
        });
      }

      // 2. If user is logged in, write securely in Firestore "tasting_logs" for long-term vault
      if (currentUser) {
        await addDoc(collection(db, 'tasting_logs'), {
          ...newLogItem,
          userId: currentUser.uid,
          userEmail: currentUser.email || 'guest@godleyciders.com',
          makePublic: publishLive,
          createdAt: serverTimestamp()
        });
      }

      // 3. Always save locally to ensure guest retention without friction!
      const updatedLocal = [
        {
          id: 'local_' + Date.now(),
          ...newLogItem,
          localDate: timeNow.toLocaleDateString()
        },
        ...localHistory
      ].slice(0, 50); // limit to last 50 local reviews
      
      setLocalHistory(updatedLocal);
      localStorage.setItem('godley_local_cellar', JSON.stringify(updatedLocal));

      // Reset Form and show success badge
      setRemarksText('');
      setFormSuccess(true);
      setTimeout(() => setFormSuccess(false), 4500);
      
      // Auto transition to Feed so they see their live result pop in instantly!
      setTimeout(() => {
        setActiveTab('taproom-feed');
        setFeedSubTab('guestbook');
      }, 800);

    } catch (err) {
      console.error("Tasting storage error: ", err);
      alert("Taste recorded locally. Cloud sync holding on sleep.");
    } finally {
      setFormLoading(false);
    }
  };

  // Heart cheers click animation
  const handleScrapbookHeartCheers = async (cardId: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    
    // Prevent excessive spamming but allow dynamic micro feedback
    if (likedCards[cardId]) {
      setLikedCards(prev => ({ ...prev, [cardId]: false }));
      try {
        await updateDoc(doc(db, 'blog_comments', cardId), {
          likes: increment(-1)
        });
      } catch (err) {
        // standalone fallbacks
      }
      return;
    }

    setLikedCards(prev => ({ ...prev, [cardId]: true }));
    
    // Add heart blast coordinates
    const rect = e.currentTarget.getBoundingClientRect();
    const heartId = 'heart_' + Date.now() + Math.random();
    const newHeart = {
      id: heartId,
      cardId,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    setFloatingHearts(prev => [...prev, newHeart]);
    setTimeout(() => {
      setFloatingHearts(prev => prev.filter(h => h.id !== heartId));
    }, 1500);

    try {
      await updateDoc(doc(db, 'blog_comments', cardId), {
        likes: increment(1)
      });
    } catch (err) {
      console.warn("Likes count holding offline.");
    }
  };

  // Helper mapping to find label details
  const getCiderAccentColor = (name: string) => {
    const press = PRESS_LIST.find(p => p.name === name);
    return press ? press.themeColor : '#eab308';
  };

  return (
    <div id="tasting-journal-portal" className="max-w-7xl mx-auto px-6 lg:px-8 py-6 text-left space-y-10 relative">
      
      {/* Dim overlay for active focus reading mode */}
      <AnimatePresence>
        {isDimmed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-stone-950/90 backdrop-blur-[4px] z-[990] pointer-events-none transition-all duration-500"
          />
        )}
      </AnimatePresence>

      {/* HEADER SECTION */}
      <header className="border-b border-stone-900 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
        <div className="space-y-3 max-w-2xl">
          <div className="flex items-center gap-2">
            <Sparkles className="text-amber-500 w-4 h-4 animate-pulse" />
            <span className="text-[9px] text-amber-500 uppercase tracking-[0.3em] font-mono font-black">
              Godley Ciders Sensory Lab
            </span>
          </div>
          <h1 className="font-serif text-3xl md:text-5xl text-white font-medium uppercase tracking-tight leading-none">
            Member <span className="text-amber-500 italic font-black">Tasting Journal</span>
          </h1>
          <p className="font-sans text-stone-400 text-xs md:text-sm leading-relaxed">
            Rate our high-altitude heirloom blends in under 15 seconds. Log structural acids, nose profiles, and dining pairings privately or projection-share live onto the taproom walls.
          </p>
        </div>

        {/* Dynamic event table instructions or QR invitation */}
        <div className="hidden lg:flex items-center gap-3.5 bg-stone-900/40 p-3 rounded-xl border border-stone-850/60 max-w-sm">
          <QrCode className="text-amber-500 w-10 h-10 shrink-0 opacity-80" />
          <div className="text-[10px] font-sans text-stone-400">
            <span className="font-bold text-stone-200 block">TABLE-SIDE FLIGHT MATCH</span>
            Guests can scan flight-paddle QR codes to launch this portal live. Zero login barriers to pin a taste!
          </div>
        </div>
      </header>

      {/* THREE-WAY PORTAL WORKSPACE TABS */}
      <div className="space-y-6 relative z-10">
        
        {/* TAB BUTTON NAVIGATION BAR */}
        <div id="portal-navigation-tabs" className="bg-stone-950/80 p-1 rounded-xl border border-stone-900 flex justify-between gap-2 overflow-x-auto text-[11px] md:text-xs font-sans font-medium uppercase tracking-wider max-w-2xl md:mx-0">
          <button
            onClick={() => setActiveTab('log-taste')}
            className={`flex-1 py-2.5 px-3.5 rounded-lg text-center cursor-pointer transition-all whitespace-nowrap flex items-center justify-center gap-2 ${
              activeTab === 'log-taste' 
                ? 'bg-amber-600 text-stone-950 font-extrabold shadow-[0_0_20px_rgba(217,119,6,0.25)]' 
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/35'
            }`}
          >
            <span>1. Log a Taste</span>
          </button>
          
          <button
            onClick={() => setActiveTab('my-cellar')}
            className={`flex-1 py-2.5 px-3.5 rounded-lg text-center cursor-pointer transition-all whitespace-nowrap flex items-center justify-center gap-2 ${
              activeTab === 'my-cellar' 
                ? 'bg-amber-600 text-stone-950 font-extrabold shadow-[0_0_20px_rgba(217,119,6,0.25)]' 
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/35'
            }`}
          >
            <span>2. My Cellar</span>
            {(currentUser ? cloudHistory.length > 0 : localHistory.length > 0) && (
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-sans ${activeTab === 'my-cellar' ? 'bg-stone-950 text-amber-500 font-bold' : 'bg-amber-500/10 text-amber-400 font-bold'}`}>
                {currentUser ? cloudHistory.length : localHistory.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('taproom-feed')}
            className={`flex-1 py-2.5 px-3.5 rounded-lg text-center cursor-pointer transition-all whitespace-nowrap flex items-center justify-center gap-2 ${
              activeTab === 'taproom-feed' 
                ? 'bg-amber-600 text-stone-950 font-extrabold shadow-[0_0_20px_rgba(217,119,6,0.25)]' 
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/35'
            }`}
          >
            <span>3. Taproom Feed</span>
          </button>
        </div>

        {/* WORKSPACE CONTENT AREA */}
        <div className="min-h-[500px]">
          <AnimatePresence mode="wait">
            
            {/* =========================================================================
                TAB 1: LOG A TASTE (THE GAMIFIED SOMMELIER INPUTS)
                ========================================================================= */}
            {activeTab === 'log-taste' && (
              <motion.div
                key="log-taste-panel"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
              >
                
                {/* LEFT COL: CORE TASTING INPUTS (8 COLS CODE) */}
                <form onSubmit={handleTastingLogPublish} className="lg:col-span-8 bg-stone-950/40 border border-stone-900 p-6 md:p-8 rounded-2xl space-y-7 relative overflow-hidden">
                  
                  {/* Decorative background visual anchor */}
                  <div className="absolute right-3 top-3 opacity-[0.02] text-white select-none pointer-events-none font-mono font-black text-6xl">
                    TASTE_LAB
                  </div>

                  {/* Header Question */}
                  <div className="border-b border-stone-900 pb-4">
                    <span className="text-[8px] text-amber-500/80 tracking-[0.25em] font-mono font-black uppercase block mb-1">Interactive Sommelier inputs</span>
                    <h2 className="font-serif text-lg md:text-xl text-stone-100 uppercase tracking-wide font-black">
                      What's in your glass, {currentUser ? currentUser.displayName || currentUser.email?.split('@')[0] : "Friend"}?
                    </h2>
                  </div>

                  {/* 1. VISUAL SWIPE CAROUSEL OF CIDER NECK-LABELS */}
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center text-[10px] font-mono text-stone-500 uppercase font-black">
                      <span>1. Select Cider (Swipe / Tap)</span>
                      <span className="text-amber-500 font-bold">Selected: {selectedCider}</span>
                    </div>

                    {/* Infinite horizontal scrolling label track */}
                    <div className="flex overflow-x-auto pb-3 pt-1 gap-4 -mx-1 px-1 scrollbar-thin scrollbar-thumb-stone-800 scrollbar-track-transparent">
                      {PRESS_LIST.map((cider) => {
                        const isChosen = selectedCider === cider.name;
                        return (
                          <motion.div
                            key={cider.id}
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleCiderTap(cider.name)}
                            className={`min-w-[170px] max-w-[170px] rounded-xl p-4 border text-left cursor-pointer transition-all duration-500 relative overflow-hidden group select-none flex flex-col justify-between h-[130px] ${
                              isChosen
                                ? 'bg-stone-950 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.12)]'
                                : 'bg-stone-900/20 border-stone-900 hover:border-stone-800'
                            }`}
                          >
                            {/* Selected active glow ring */}
                            {isChosen && (
                              <div className="absolute top-2 right-2 text-amber-500 bg-amber-500/10 p-0.5 rounded-full ring-1 ring-amber-500/30">
                                <Check size={11} className="stroke-[3]" />
                              </div>
                            )}

                            {/* Stylized premium physical vinyl Cider logo block inside label */}
                            <div className="space-y-1 relative z-10">
                              <span className={`text-[8px] uppercase tracking-widest font-mono font-black block ${cider.colorText}`}>
                                {cider.style}
                              </span>
                              <h3 className="font-serif text-xs font-black uppercase text-stone-100 tracking-wide line-clamp-1 leading-tight group-hover:text-amber-500 transition-colors">
                                {cider.name}
                              </h3>
                              <p className="text-[9px] text-stone-500 font-sans italic line-clamp-1">
                                {cider.subtext}
                              </p>
                            </div>

                            {/* Footer ABV information */}
                            <div className="relative z-10 flex justify-between items-center text-[9px] font-mono text-stone-400 border-t border-stone-900/80 pt-2 shrink-0">
                              <span>GODLEY PRESS</span>
                              <span className="font-bold">{cider.abv}</span>
                            </div>

                            {/* Custom linear overlay highlighting selection gradient */}
                            <div className={`absolute inset-0 bg-gradient-to-b ${cider.gradientClass} opacity-60 pointer-events-none`} />
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. LARGE CHUNKY TOUCH-SLIDERS (NO-TYPING ZONE) */}
                  <div className="space-y-6 pt-2 bg-stone-900/30 p-5 rounded-2xl border border-stone-900/50">
                    
                    {/* SWEETNESS SLIDER */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[10px] font-mono text-stone-400 uppercase font-bold">
                        <span>Dryness Index</span>
                        <span className="text-amber-500 font-black">Level {sliderSweetness}%</span>
                      </div>

                      {/* Tactile Slider bar with extreme touch sizing */}
                      <div className="relative flex items-center select-none py-1.5">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={sliderSweetness}
                          onChange={(e) => setSliderSweetness(parseInt(e.target.value))}
                          className="w-full h-2.5 bg-stone-950 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>

                      {/* Slide range markers */}
                      <div className="flex justify-between text-[8px] font-mono text-stone-600 uppercase font-black tracking-widest">
                        <span>Bone Dry</span>
                        <span>Honey Sweet</span>
                      </div>

                      {/* Dynamic updating micro-copy */}
                      <div className="bg-stone-950/40 p-2 rounded border border-stone-900 text-left">
                        <span className="text-[9px] font-mono text-stone-400 block tracking-wide">
                          {getSweetnessText(sliderSweetness)}
                        </span>
                      </div>
                    </div>

                    {/* CHARACTER / CRISPNESS SLIDER */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[10px] font-mono text-stone-400 uppercase font-bold">
                        <span>Pristine Crisp vs Funky Oak</span>
                        <span className="text-amber-500 font-black">Level {sliderCharacter}%</span>
                      </div>

                      {/* Tactile Slider bar */}
                      <div className="relative flex items-center select-none py-1.5">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={sliderCharacter}
                          onChange={(e) => setSliderCharacter(parseInt(e.target.value))}
                          className="w-full h-2.5 bg-stone-950 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>

                      {/* Slide range markers */}
                      <div className="flex justify-between text-[8px] font-mono text-stone-600 uppercase font-black tracking-widest">
                        <span>Clean & Crisp</span>
                        <span>Wild Funk</span>
                      </div>

                      {/* Dynamic updating micro-copy */}
                      <div className="bg-stone-950/40 p-2 rounded border border-stone-900 text-left">
                        <span className="text-[9px] font-mono text-stone-400 block tracking-wide">
                          {getCharacterText(sliderCharacter)}
                        </span>
                      </div>
                    </div>

                  </div>

                  {/* 3. MULTI-SELECT PAIRING TAG BUBBLES */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-[10px] font-mono text-stone-400 uppercase font-bold">
                      <span>2. Log Pairing Affinities (Multi-Select)</span>
                      {selectedPairings.length > 0 && (
                        <span className="text-stone-500 text-[9px]">{selectedPairings.length} Selected</span>
                      )}
                    </div>

                    {/* Pill items grid */}
                    <div className="flex flex-wrap gap-2">
                      {PAIRING_BUBBLES.map((pill) => {
                        const isSelected = selectedPairings.includes(pill.label);
                        return (
                          <motion.button
                            type="button"
                            key={pill.label}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handlePairingToggle(pill.label)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold font-sans transition-all duration-300 uppercase cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500 text-stone-950 border-amber-600 font-black shadow-[0_4px_12px_rgba(245,158,11,0.15)] scale-102'
                                : 'bg-stone-900/40 text-stone-400 border-stone-900 hover:border-stone-800 hover:text-stone-300'
                            }`}
                          >
                            <span>{pill.label}</span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 4. 180-CHARACTER REMARKS BLOCK */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-mono text-stone-400 uppercase font-bold">
                      <span>3. Tasting Remarks (Max 180 chars)</span>
                      <span className={`text-[9px] font-bold transition-all duration-300 ${180 - remarksText.length <= 10 ? 'text-red-500 scale-110 font-mono font-black animate-pulse' : 'text-stone-500'}`}>
                        {180 - remarksText.length} cells left
                      </span>
                    </div>

                    <textarea
                      required
                      value={remarksText}
                      onChange={(e) => setRemarksText(e.target.value.slice(0, 180))}
                      rows={2.5}
                      placeholder="e.g. Sharp lemon-cider splash! Balanced neutral French Oak notes at length. Pairs flawlessly with sharp goat chèvre on hot flatbread. 10/10."
                      className="w-full bg-stone-900 border border-stone-850 p-3 text-xs md:text-sm text-stone-200 focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/30 outline-none rounded-xl resize-none font-sans leading-relaxed"
                    />
                  </div>

                  {/* If user is a Guest, invite their Name directly inside the form (No auth barriers!) */}
                  {!currentUser && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="bg-amber-600/5 p-4 rounded-xl border border-amber-500/10 space-y-2 text-left"
                    >
                      <label className="text-[9px] text-amber-500 font-mono uppercase font-black tracking-wider block">
                        Enter Guest Initials/Name (No password required)
                      </label>
                      <input
                        type="text"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value.slice(0, 20))}
                        className="w-full md:max-w-xs bg-stone-950 border border-stone-850 rounded p-2 text-xs text-stone-200 focus:border-amber-500 outline-none font-mono"
                        placeholder="e.g., Sarah M. / Travis G."
                        required
                      />
                      <p className="text-[8px] text-stone-500 font-sans italic">
                        Allows guest reviews instantly onto Cask Board & locks log history to your browser's private local Cellar tab!
                      </p>
                    </motion.div>
                  )}

                  {/* 5. THE STYLIZED PUBLISH SLIDE-TOGGLE */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-3 border-t border-stone-900">
                    
                    {/* Visual Slide toggle button */}
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] text-stone-500 font-mono uppercase font-black block">Privacy Level</span>
                      
                      <button
                        type="button"
                        onClick={() => setPublishLive(!publishLive)}
                        className="bg-stone-900 p-1.5 rounded-lg border border-stone-850 flex gap-1 text-[9px] font-mono select-none cursor-pointer transition-colors hover:border-stone-800"
                      >
                        <span className={`px-2 py-1 rounded text-center transition-all ${!publishLive ? 'bg-stone-950 text-amber-400 border border-stone-850 font-bold' : 'text-stone-500'}`}>
                          PRIVATE
                        </span>
                        <span className={`px-2 py-1 rounded text-center transition-all ${publishLive ? 'bg-amber-600 text-stone-950 font-black shadow-md' : 'text-stone-500'}`}>
                          TAPROOM LIVE
                        </span>
                      </button>
                    </div>

                    {/* Submit Button */}
                    <Button
                      type="submit"
                      disabled={formLoading || remarksText.trim().length === 0}
                      className="bg-amber-600 hover:bg-amber-500 text-stone-950 font-black uppercase tracking-widest text-[10px] py-1.5 px-6 h-10 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg shadow-amber-950/20"
                    >
                      {formLoading ? 'Recording Taste...' : 'Pin Tasting To Scrapbook'}
                    </Button>

                  </div>

                  {/* Success modal feedback message */}
                  <AnimatePresence>
                    {formSuccess && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="p-3 text-center text-[10px] bg-emerald-950/20 text-emerald-400 border border-emerald-500/20 rounded-xl font-mono mt-4"
                      >
                        Tasting saved successfully! Instantly displayed on Cask Scrapbook projection.
                      </motion.div>
                    )}
                  </AnimatePresence>

                </form>

                {/* RIGHT COL: PROMOTIONAL WORKSPACE CAMPAIGN & SETUP INFO (4 COLS) */}
                <div className="lg:col-span-4 space-y-6">
                  
                  {/* Visual Representation of Flight Paddle Mat QR Invitation */}
                  <div className="bg-stone-950 border border-stone-900 p-5 rounded-2xl text-center space-y-4 shadow-xl">
                    <div className="text-center pb-2 border-b border-stone-900">
                      <span className="text-[8px] text-amber-500 uppercase tracking-[0.25em] font-mono font-bold block">Physical Event Bridge</span>
                      <h4 className="font-serif text-xs text-stone-200 uppercase font-black tracking-widest mt-1">
                        Flight Paddles QR Setup
                      </h4>
                    </div>

                    {/* Highly polished SVG mockup of taproom coaster card */}
                    <div className="bg-stone-900/30 border border-stone-800 rounded-xl p-3 inline-block relative overflow-hidden text-left space-y-2.5 w-full">
                      <div className="flex gap-2 relative z-10">
                        {/* Actual readable beautifully geometric SVG simulated QR */}
                        <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/40 rounded-lg p-1.5 shrink-0 flex items-center justify-center">
                          <svg className="w-full h-full text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <rect x="2" y="2" width="6" height="6" rx="0.5" />
                            <rect x="16" y="2" width="6" height="6" rx="0.5" />
                            <rect x="2" y="16" width="6" height="6" rx="0.5" />
                            <path d="M16 16h2v2h-2zm2 2h2v2h-2zm-2 2h2v2h-2z" />
                            <circle cx="5" cy="5" r="1.5" fill="currentColor" />
                            <circle cx="19" cy="5" r="1.5" fill="currentColor" />
                            <circle cx="5" cy="19" r="1.5" fill="currentColor" />
                          </svg>
                        </div>

                        <div className="text-[9px] font-sans text-stone-400 space-y-0.5 leading-tight">
                          <span className="font-bold text-stone-200 block uppercase">Table flight Mat Badge</span>
                          <p>Place this code under your sample flight glass blocks. Guests scan, taste, and instantly project reviews to the wall screen!</p>
                        </div>
                      </div>

                      {/* Mockup visual label tag */}
                      <div className="bg-stone-950/60 p-2 border border-stone-900 rounded font-mono text-[8px] text-stone-500 flex justify-between uppercase">
                        <span>Device Redirect</span>
                        <span className="text-amber-500">Active</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-serif font-black uppercase text-stone-300 block tracking-wider">Taproom Projector Wall</span>
                      <p className="text-[9px] text-stone-500 font-sans leading-relaxed">
                        To run live event scrapbook slides, simply connect a monitor or project this website's "Taproom Feed" tab live in fullscreen on the taproom wall! Submissions show up in real-time.
                      </p>
                    </div>
                  </div>

                  {/* Club Membership Signin Gated banner */}
                  {!currentUser && (
                    <div className="bg-stone-900/10 border border-stone-900 p-5 rounded-2xl text-center space-y-4">
                      <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center text-amber-500 mx-auto">
                        <Lock size={15} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-serif text-xs text-stone-200 uppercase font-black">Persist History with Club Pass</h4>
                        <p className="text-[9px] text-stone-500 font-sans leading-relaxed">
                          Guests lose tracking notes when they delete browser cache. Grab or log into your Cider Club profile to unlock global lifetime cellar vault sync!
                        </p>
                      </div>
                      <a href="/club">
                        <Button className="w-full bg-amber-600/15 hover:bg-amber-600/25 text-amber-400 border border-amber-500/30 text-[9px] font-mono uppercase tracking-widest py-1.5 h-8">
                          Club Members Login / Register
                        </Button>
                      </a>
                    </div>
                  )}

                  {/* CIDERMAKER TACTILE EDUCATION WIDGET */}
                  <div className="bg-stone-950/40 p-5 rounded-2xl border border-stone-900 space-y-3.5 text-left text-xs font-sans">
                    <span className="text-[8px] text-amber-500 uppercase tracking-widest font-mono font-black block">Harvester Note</span>
                    <h5 className="font-serif text-stone-200 text-xs uppercase font-bold tracking-wider flex items-center gap-1.5">
                      Spitters vs Sweet Cooking fruit?
                    </h5>
                    <p className="text-[9px] text-stone-400 leading-relaxed italic">
                      "Real artisanal cider demands spitters—ancient apple cultivars so heavy in tannins & malic acid that they taste completely bitter raw but ferment into gold. Golden Russet & Wickson Crab are our pride here." — Travis Godley
                    </p>
                  </div>

                </div>

              </motion.div>
            )}

            {/* =========================================================================
                TAB 2: MY CELLAR (THE INDIVIDUAL MEMBER VAULT / OFFLINE LOGS)
                ========================================================================= */}
            {activeTab === 'my-cellar' && (
              <motion.div
                key="my-cellar-panel"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="max-w-4xl space-y-6"
              >
                
                {/* Vault Header summary bar */}
                <div className="bg-stone-950/40 border border-stone-900 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="text-left space-y-1">
                    <span className="text-[8px] font-mono text-stone-500 uppercase block tracking-widest font-bold">Local & Secure Database Records</span>
                    <h3 className="font-serif text-base text-stone-100 uppercase tracking-wide font-black">
                      Your Saved Cider Cellar
                    </h3>
                    <p className="text-[10px] text-stone-400 font-sans max-w-xl">
                      {currentUser 
                        ? `Loaded ${cloudHistory.length} cloud secured vault-logs. You have total session persistence.` 
                        : `Loaded ${localHistory.length} browser-local guest logs. Logging in locks reviews permanently.`
                      }
                    </p>
                  </div>
                  
                  {currentUser && (
                    <div className="flex items-center gap-1.5 bg-emerald-950/20 border border-emerald-500/20 text-emerald-400 p-2 rounded-xl text-[9px] font-mono font-semibold">
                      <ShieldCheck size={12} />
                      <span>SECURE CLOUD SYNC ACTIVE</span>
                    </div>
                  )}
                </div>

                {/* List Container */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Fetching the correct list based on authentication state */}
                  {(() => {
                    const activeCellarList = currentUser ? cloudHistory : localHistory;
                    
                    if (activeCellarList.length === 0) {
                      return (
                        <div className="md:col-span-2 bg-stone-900/10 border border-stone-900 p-12 text-center rounded-2xl space-y-4">
                          <Bookmark className="text-stone-600 w-10 h-10 mx-auto opacity-40 animate-pulse" />
                          <div className="space-y-1 max-w-sm mx-auto">
                            <h4 className="font-serif text-sm text-stone-300 uppercase font-black">Cellar Archive is Empty</h4>
                            <p className="text-[10px] text-stone-500 font-sans leading-relaxed">
                              You haven't recorded any cider tasting notes yet! Slip into your taproom seat, tap "Log a Taste" and write your very first sensory review cards.
                            </p>
                          </div>
                          <Button 
                            onClick={() => setActiveTab('log-taste')}
                            className="bg-amber-600/10 text-amber-500 hover:bg-amber-600/25 border border-amber-500/20 text-[10px] uppercase font-mono py-1.5 px-6"
                          >
                            Go Log a Glass
                          </Button>
                        </div>
                      );
                    }

                    return activeCellarList.map((log: any, idx: number) => {
                      const colorAccent = getCiderAccentColor(log.ciderName);
                      return (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          key={log.id || 'cellar_' + idx}
                          className="bg-stone-950/40 p-5 rounded-2xl border border-stone-900 text-left space-y-4 hover:border-stone-850/60 shadow-md flex flex-col justify-between"
                        >
                          <div className="space-y-3">
                            
                            {/* Card Header showing cider and star score */}
                            <div className="flex justify-between items-start border-b border-stone-900 pb-2.5">
                              <div>
                                <span className="text-[8px] uppercase tracking-widest font-mono text-stone-500 font-black block">Harvester Blend Log</span>
                                <h4 className="font-serif text-sm font-black uppercase text-stone-100 mt-0.5" style={{ color: colorAccent }}>
                                  {log.ciderName}
                                </h4>
                              </div>
                              
                              <div className="flex gap-0.5 text-amber-500">
                                {Array.from({ length: log.rating || 5 }).map((_, i) => (
                                  <Star key={i} size={10} className="fill-current text-amber-500" />
                                ))}
                              </div>
                            </div>

                            {/* Remarks citation */}
                            <p className="font-sans text-xs italic text-stone-300 leading-relaxed">
                              "{log.notes}"
                            </p>

                            {/* Pairing labels and tags */}
                            {log.pairings && log.pairings.length > 0 && (
                              <div className="space-y-1">
                                <span className="text-[8px] font-mono text-stone-500 uppercase block tracking-wider font-bold">Logged Pairings:</span>
                                <div className="flex flex-wrap gap-1">
                                  {log.pairings.map((p: string) => (
                                    <span key={p} className="text-[8px] font-sans font-black uppercase tracking-wider bg-stone-900 text-stone-400 border border-stone-850 px-2 py-0.5 rounded-md">
                                      {p}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Sensory Sliders representation as beautiful mini inline progress gauges */}
                            <div className="grid grid-cols-2 gap-3 pt-2">
                              <div className="space-y-1">
                                <div className="flex justify-between text-[7px] font-mono text-stone-500 tracking-wider">
                                  <span>SWEETNESS</span>
                                  <span className="font-black text-stone-300">{log.sweetness || 10}%</span>
                                </div>
                                <div className="w-full h-1 bg-stone-900 rounded-full overflow-hidden">
                                  <div className="bg-amber-500 h-full rounded-full" style={{ width: `${log.sweetness || 10}%` }} />
                                </div>
                              </div>

                              <div className="space-y-1">
                                <div className="flex justify-between text-[7px] font-mono text-stone-500 tracking-wider">
                                  <span>CHARACTER/FUNK</span>
                                  <span className="font-black text-stone-300">{log.character || 15}%</span>
                                </div>
                                <div className="w-full h-1 bg-stone-900 rounded-full overflow-hidden">
                                  <div className="bg-amber-500 h-full rounded-full" style={{ width: `${log.character || 15}%` }} />
                                </div>
                              </div>
                            </div>

                          </div>

                          {/* Footer details */}
                          <div className="flex justify-between items-center text-[8px] font-mono text-stone-500 border-t border-stone-900 pt-3 mt-2">
                            <span className="uppercase">
                              {log.makePublic ? 'Shared to board' : 'Private log'}
                            </span>
                            <span>
                              {log.localDate || (log.createdAt ? new Date(log.createdAt.seconds * 1000).toLocaleDateString() : 'Just now')}
                            </span>
                          </div>

                        </motion.div>
                      );
                    });
                  })()}

                </div>

              </motion.div>
            )}

            {/* =========================================================================
                TAB 3: TAPROOM FEED (THE ASYMMETRICAL COMMUNITY BOARD & SEO LOGS)
                ========================================================================= */}
            {activeTab === 'taproom-feed' && (
              <motion.div
                key="taproom-feed-panel"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="space-y-8"
              >
                
                {/* SUB HEADER DUAL TOGGLE SWITCH FOR FEED SUB-DOMAINS */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-stone-900 pb-4 gap-4 w-full text-xs font-sans">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setFeedSubTab('guestbook')}
                      className={`px-3.5 py-1.5 rounded-lg border text-[10.5px] font-bold uppercase cursor-pointer transition-colors ${
                        feedSubTab === 'guestbook'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/35 font-bold shadow-md'
                          : 'bg-stone-900/10 text-stone-400 border-stone-900 hover:text-stone-300 hover:border-stone-850'
                      }`}
                    >
                      Live Polaroid Board
                    </button>
                    
                    <button
                      onClick={() => setFeedSubTab('maker-logs')}
                      className={`px-3.5 py-1.5 rounded-lg border text-[10.5px] font-bold uppercase cursor-pointer transition-colors ${
                        feedSubTab === 'maker-logs'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/35 font-bold shadow-md'
                          : 'bg-stone-900/10 text-stone-400 border-stone-900 hover:text-stone-300 hover:border-stone-850'
                      }`}
                    >
                      Cidermaker's Log (SEO Archives)
                    </button>
                  </div>

                  {/* Taproom Physical-to-Digital Bridge activation button */}
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setProjectorActive(true);
                        setProjectorPlaying(true);
                      }}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl text-[11px] font-sans font-bold uppercase tracking-wider cursor-pointer bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 shadow-[0_0_20px_rgba(217,119,6,0.25)] hover:shadow-[0_0_30px_rgba(217,119,6,0.4)] transition-all duration-350 flex items-center justify-center gap-2 group"
                    >
                      <Tv size={13} className="animate-pulse" />
                      <span>Open Projector Theater Mode</span>
                    </button>
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  
                  {/* SUB-TAB A: THE LIVE GUESTBOOK POLAROID MASONRY WALL */}
                  {feedSubTab === 'guestbook' && (
                    <motion.div
                      key="guestbook-posts"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-6"
                    >
                      <div className="max-w-2xl text-left bg-stone-950/20 p-4 border border-stone-900 rounded-xl space-y-1">
                        <span className="text-[8px] font-mono text-stone-500 block uppercase font-bold">Asymmetrical Pinterest Board</span>
                        <h4 className="font-serif text-sm text-stone-300 uppercase font-black">The Cask Room Scrapbook</h4>
                        <p className="text-[9px] text-stone-500 font-sans leading-relaxed">
                          Somatic review cards displayed directly from desktop and table smartphones. Tap the red cheers heart on any card to toast back!
                        </p>
                      </div>

                      {/* Polaroid Walls Asymmetrical Staggered pinboard */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 relative">
                        {(() => {
                          // Display tasting logs shared live, filter clean records
                          const liveTastings = scrapbookRecords.filter(r => r.isTastingLog === true);

                          if (liveTastings.length === 0) {
                            return (
                              <div className="sm:col-span-2 md:col-span-3 bg-stone-900/10 border border-stone-900 py-16 text-center rounded-2xl space-y-4">
                                <Sparkles className="text-amber-500/30 w-10 h-10 mx-auto opacity-60 animate-pulse" />
                                <div className="space-y-1 max-w-sm mx-auto">
                                  <h4 className="font-serif text-xs text-stone-400 uppercase font-bold tracking-widest">No Live Posts Yet</h4>
                                  <p className="text-[10px] text-stone-500 font-sans leading-relaxed">
                                    Be the very first guest or member to submit a tasting card from table flight paddles!
                                  </p>
                                </div>
                              </div>
                            );
                          }

                          return liveTastings.map((log: any, idx: number) => {
                            const isLiked = !!likedCards[log.id];
                            
                            // Highly organic physical offset rotations using framed index offsets
                            const tiltClass = 
                              idx % 4 === 1 ? 'md:rotate-[0.6deg]' :
                              idx % 4 === 2 ? 'md:rotate-[-0.8deg]' :
                              idx % 4 === 3 ? 'md:rotate-[0.5deg]' : 'md:rotate-[-0.6deg]';

                            const ciderColor = getCiderAccentColor(log.ciderName);
                            const ratingsCount = log.rating || 5;

                            return (
                              <motion.div
                                key={log.id}
                                layout
                                initial={{ opacity: 0, scale: 0.9, y: 15 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                transition={{ type: 'spring', stiffness: 220, damping: 22 }}
                                className={`bg-stone-950 p-5 rounded-lg border border-stone-900 text-left space-y-4 relative overflow-hidden shadow-xl hover:shadow-2xl transition-shadow ${tiltClass} border-t-2`}
                                style={{ borderTopColor: ciderColor }}
                              >
                                {/* Floating heart coordinates rendering container */}
                                <AnimatePresence>
                                  {floatingHearts
                                    .filter(h => h.cardId === log.id)
                                    .map(heart => (
                                      <motion.div
                                        key={heart.id}
                                        initial={{ opacity: 1, scale: 0.6, y: heart.y - 10, x: heart.x }}
                                        animate={{ opacity: 0, scale: 1.6, y: heart.y - 120, x: heart.x + (Math.random() * 40 - 20) }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 1.4, ease: 'easeOut' }}
                                        className="absolute pointer-events-none text-red-500 text-base z-50 select-none font-sans filter drop-shadow"
                                      >
                                        <Heart className="w-4 h-4 fill-red-500 text-red-500" />
                                      </motion.div>
                                    ))
                                  }
                                </AnimatePresence>

                                {/* User attribution & star score */}
                                <div className="flex justify-between items-start text-[10px] font-sans pb-2 border-b border-stone-900">
                                  <div className="space-y-0.5">
                                    <span className="text-[8px] tracking-wider uppercase font-mono text-stone-500 block">Contributor</span>
                                    <span className="text-stone-200 font-bold flex items-center gap-1.5 font-serif">
                                      <UserIcon size={9} className="text-amber-500 shrink-0" />
                                      {log.authorName} says...
                                    </span>
                                  </div>

                                  <div className="flex gap-0.5 text-amber-500">
                                    {Array.from({ length: ratingsCount }).map((_, i) => (
                                      <Star key={i} size={8} className="fill-current text-amber-500" />
                                    ))}
                                  </div>
                                </div>

                                {/* Active Sipped Cider Badge */}
                                <div className="inline-block px-2.2 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-wide uppercase border bg-stone-900/60" style={{ color: ciderColor, borderColor: `${ciderColor}1e` }}>
                                  Sipped: {log.ciderName}
                                </div>

                                {/* The 180-Character Remark Quote in highly readable serif */}
                                <p className="font-serif text-sm tracking-wide italic text-stone-100 leading-relaxed block pl-2 border-l border-zinc-800">
                                  "{log.notes}"
                                </p>

                                {/* Pairing indicators in footer (Emojis check!) */}
                                {log.pairings && log.pairings.length > 0 && (
                                  <div className="space-y-1">
                                    <span className="text-[7.5px] font-mono text-stone-500 uppercase block tracking-wider font-bold">Event Pairing:</span>
                                    <div className="flex flex-wrap gap-1">
                                      {log.pairings.map((p: string) => (
                                        <span key={p} className="text-[9px] font-sans bg-stone-900 text-stone-400 px-2 py-0.5 rounded border border-stone-850 inline-flex items-center gap-1">
                                          <span className="text-[8px] uppercase tracking-wider font-bold">{p}</span>
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Interactive Cheers/Tap widget bar */}
                                <div className="flex justify-between items-center pt-3 border-t border-stone-900 mt-1 select-none text-[8px] font-mono text-stone-500">
                                  <div className="flex items-center gap-1">
                                    <span>Sweetness {log.sweetness || 10}%</span>
                                    <span>•</span>
                                    <span>Crisp {log.character || 15}%</span>
                                  </div>

                                  <button
                                    onClick={(e) => handleScrapbookHeartCheers(log.id, e)}
                                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border cursor-pointer select-none transition-all duration-300 ${
                                      isLiked 
                                        ? 'bg-red-500/10 text-red-400 border-red-500/30 font-black' 
                                        : 'bg-stone-900/40 border-stone-850 hover:bg-stone-900 hover:text-stone-300'
                                    }`}
                                    title="Cheers back!"
                                  >
                                    <Heart size={9} className={isLiked ? 'fill-current text-red-500' : ''} />
                                    <span>TOAST ({log.likes || 0})</span>
                                  </button>
                                </div>

                              </motion.div>
                            );
                          });
                        })()}
                      </div>

                    </motion.div>
                  )}

                  {/* SUB-TAB B: TRAVIS'S BLOG ARTICLE LOGS & SEO CODES */}
                  {feedSubTab === 'maker-logs' && (
                    <motion.div
                      key="maker-logs-tab"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start text-left"
                    >
                      {/* Left Block: List selector of preserved archives */}
                      <div className="lg:col-span-4 space-y-3">
                        <span className="text-[8px] text-amber-500/80 tracking-[0.25em] font-mono font-black uppercase block">Harvester Archives</span>
                        
                        <div className="flex flex-col gap-2">
                          {BLOG_POSTS.map((post) => {
                            const isSelected = selectedPost?.id === post.id;
                            return (
                              <button
                                key={post.id}
                                onClick={() => setSelectedPost(post)}
                                className={`p-4 rounded-xl text-left border transition-all duration-300 relative group cursor-pointer ${
                                  isSelected 
                                    ? 'bg-stone-950 border-amber-600/50 shadow-lg' 
                                    : 'bg-stone-900/10 border-stone-900 hover:border-stone-850'
                                }`}
                              >
                                <div className="flex justify-between items-start mb-1 text-[8px] font-mono">
                                  <span className="text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded uppercase font-bold text-[7px]">
                                    {post.category}
                                  </span>
                                  <span className="text-stone-500 flex items-center gap-1 uppercase">
                                    <Clock size={8} /> {post.readTime}
                                  </span>
                                </div>
                                <h4 className="font-serif text-xs font-black uppercase text-stone-200 group-hover:text-amber-500 transition-colors leading-snug">
                                  {post.title}
                                </h4>
                                <p className="font-sans text-stone-500 text-[10px] line-clamp-2 mt-1 leading-relaxed">
                                  {post.excerpt}
                                </p>
                              </button>
                            );
                          })}
                        </div>

                      </div>

                      {/* Right Block: Expanded full reading workspace overlay */}
                      <div className="lg:col-span-8">
                        <AnimatePresence mode="wait">
                          {selectedPost && (() => {
                            const firstChar = selectedPost.content.charAt(0);
                            const remainingContent = selectedPost.content.slice(1);
                            
                            return (
                              <motion.article
                                key={selectedPost.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className={`border border-stone-850 p-6 md:p-8 rounded-2xl space-y-6 relative overflow-hidden transition-all duration-500 ${
                                  isDimmed 
                                    ? 'bg-stone-950 border-amber-500/45 shadow-amber-950/20 z-[1000] ring-1 ring-amber-500/10' 
                                    : 'bg-stone-950/40 shadow-stone-950/40 z-10'
                                }`}
                              >
                                {/* Decorative giant backdrop label */}
                                <div className="absolute right-0 top-0 text-[100px] font-black text-stone-900/5 font-mono pointer-events-none select-none uppercase tracking-widest z-0">
                                  {selectedPost.id.slice(0, 4)}
                                </div>

                                <div className="relative z-10 space-y-6">
                                  
                                  {/* Compact reading adjustments controller bar */}
                                  <div className="flex justify-between items-center bg-stone-900/20 p-2 rounded-lg border border-stone-900 text-[9px] font-mono text-stone-500">
                                    <span className="uppercase font-bold tracking-wider text-stone-400">Reader Preferences</span>
                                    
                                    <div className="flex gap-2.5">
                                      <button 
                                        onClick={() => {
                                          if (readFontSize === 'sm') setReadFontSize('md');
                                          else if (readFontSize === 'md') setReadFontSize('lg');
                                          else setReadFontSize('sm');
                                        }}
                                        className="flex items-center gap-1 hover:text-amber-400 transition-colors uppercase cursor-pointer"
                                      >
                                        <Type size={9} />
                                        <span>Size: {readFontSize}</span>
                                      </button>

                                      <button 
                                        onClick={() => setShowTerroirSpecs(!showTerroirSpecs)}
                                        className={`flex items-center gap-1 transition-colors uppercase cursor-pointer ${showTerroirSpecs ? 'text-amber-500 font-bold' : ''}`}
                                      >
                                        <Sliders size={9} />
                                        <span>Metrics: {showTerroirSpecs ? 'On' : 'Off'}</span>
                                      </button>

                                      <button 
                                        onClick={() => setIsDimmed(!isDimmed)}
                                        className={`flex items-center gap-1 transition-colors uppercase cursor-pointer ${isDimmed ? 'text-amber-400' : ''}`}
                                      >
                                        {isDimmed ? <EyeOff size={9} /> : <Eye size={9} />}
                                        <span>Dim Mode</span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Article text header */}
                                  <header className="border-b border-stone-900 pb-4 space-y-2.5">
                                    <div className="flex gap-2 items-center text-[9px] text-stone-500 font-mono uppercase">
                                      <span>{selectedPost.category}</span>
                                      <span>•</span>
                                      <span>{selectedPost.date}</span>
                                    </div>

                                    <h2 className="font-serif text-xl md:text-2xl font-black uppercase text-white tracking-tight leading-snug">
                                      {selectedPost.title}
                                    </h2>

                                    <span className="text-[10px] text-stone-400 italic block font-sans">
                                      Written and archived by Travis Godley • Master Cidermaker Log
                                    </span>
                                  </header>

                                  {/* Content body layout with giant dropcap capital */}
                                  <div className={`font-sans leading-relaxed text-stone-300 whitespace-pre-wrap transition-all duration-300 ${
                                    readFontSize === 'sm' ? 'text-xs' : 
                                    readFontSize === 'md' ? 'text-xs md:text-sm' : 'text-sm md:text-base'
                                  }`}>
                                    <span className="font-serif text-3xl md:text-4xl text-amber-500 float-left mr-2.5 mt-1 font-black bg-stone-900 border border-stone-850 p-2 py-0.5 rounded">
                                      {firstChar}
                                    </span>
                                    {remainingContent}
                                  </div>

                                  {/* Dynamic Harvester Sliders Terroir metrics block */}
                                  {showTerroirSpecs && (
                                    <motion.div 
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      className="p-4 bg-stone-900/30 rounded-xl border border-stone-850 space-y-3.5"
                                    >
                                      <div>
                                        <span className="text-[7.5px] text-amber-500 font-mono uppercase tracking-widest block font-bold">Harvester's Lab Index</span>
                                        <h5 className="font-serif text-[10.5px] uppercase tracking-wider text-stone-200 mt-0.5">
                                          Terroir Chemical Properties
                                        </h5>
                                      </div>

                                      <div className="grid grid-cols-2 gap-3 text-[9px] font-mono text-zinc-400">
                                        <div className="border-l border-amber-500/40 pl-2">
                                          <span className="text-[8px] text-stone-500 block">ELEVATION</span>
                                          <span className="text-zinc-200 font-semibold">{selectedPost.elevation}</span>
                                        </div>
                                        <div className="border-l border-amber-500/40 pl-2">
                                          <span className="text-[8px] text-stone-500 block">MEASURED DENSITY</span>
                                          <span className="text-zinc-200 font-semibold">{selectedPost.acidity} / {selectedPost.brix}</span>
                                        </div>
                                        <div className="col-span-2 border-l border-amber-500/40 pl-2">
                                          <span className="text-[8px] text-stone-500 block">YEASTS & COOPERAGE</span>
                                          <span className="text-zinc-200 font-semibold">{selectedPost.yeasts} • {selectedPost.aging}</span>
                                        </div>
                                      </div>

                                      {/* Bar charts for acidity, tannin, residual sweetness */}
                                      <div className="space-y-2.5 pt-2 border-t border-stone-950">
                                        <div className="space-y-1">
                                          <div className="flex justify-between text-[8px] font-mono text-zinc-500 uppercase">
                                            <span>Acidity Index</span>
                                            <span className="text-amber-500 font-bold">{selectedPost.acidityScore}%</span>
                                          </div>
                                          <div className="w-full h-1 bg-stone-950 rounded-full overflow-hidden">
                                            <div className="bg-amber-500 h-full rounded-full" style={{ width: `${selectedPost.acidityScore}%` }} />
                                          </div>
                                        </div>

                                        <div className="space-y-1">
                                          <div className="flex justify-between text-[8px] font-mono text-zinc-500 uppercase">
                                            <span>Polyphenolic Tannins</span>
                                            <span className="text-amber-500 font-bold">{selectedPost.tanninScore}%</span>
                                          </div>
                                          <div className="w-full h-1 bg-stone-950 rounded-full overflow-hidden">
                                            <div className="bg-amber-500 h-full rounded-full" style={{ width: `${selectedPost.tanninScore}%` }} />
                                          </div>
                                        </div>

                                        <div className="space-y-1">
                                          <div className="flex justify-between text-[8px] font-mono text-zinc-500 uppercase">
                                            <span>Bone Dry Index</span>
                                            <span className="text-amber-500 font-bold">{selectedPost.drynessScore}%</span>
                                          </div>
                                          <div className="w-full h-1 bg-stone-950 rounded-full overflow-hidden">
                                            <div className="bg-amber-500 h-full rounded-full" style={{ width: `${selectedPost.drynessScore}%` }} />
                                          </div>
                                        </div>
                                      </div>

                                    </motion.div>
                                  )}

                                </div>
                              </motion.article>
                            );
                          })()}
                        </AnimatePresence>
                      </div>

                    </motion.div>
                  )}

                </AnimatePresence>

              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>

      {/* =========================================================================
          THEATRE PROJECTION MODE FULLSCREEN (Taproom Physical-to-Digital Bridge)
          ========================================================================= */}
      <AnimatePresence>
        {projectorActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-[2000] flex flex-col justify-between p-8 md:p-12 font-sans select-none overflow-hidden transition-colors duration-1000 ${
              projectorTheme === 'candlelight' 
                ? 'bg-gradient-to-tr from-stone-950 via-amber-955 to-stone-955 text-stone-100' 
                : projectorTheme === 'midnight' 
                ? 'bg-gradient-to-tr from-stone-950 via-zinc-950 to-stone-950 text-stone-100' 
                : 'bg-gradient-to-tr from-stone-950 via-stone-900 to-stone-950 text-stone-100'
            }`}
            style={{ 
              backgroundColor: projectorTheme === 'candlelight' ? '#0c0a09' : projectorTheme === 'midnight' ? '#09090b' : '#0c0a09' 
            }}
          >
            {/* AMBIENT BACKGROUND GLOW TO SIMULATE FIREPLACE/CANDLELIGHT OR SUN */}
            {projectorTheme === 'candlelight' && (
              <div className="absolute inset-x-0 top-0 h-full w-full bg-[radial-gradient(circle_at_50%_-20%,rgba(217,119,6,0.12),transparent_60%)] animate-pulse pointer-events-none duration-4000" />
            )}
            {projectorTheme === 'midnight' && (
              <div className="absolute inset-x-0 top-0 h-full w-full bg-[radial-gradient(circle_at_50%_-20%,rgba(14,165,233,0.06),transparent_60%)] pointer-events-none" />
            )}
            {projectorTheme === 'orchard' && (
              <div className="absolute inset-x-0 top-0 h-full w-full bg-[radial-gradient(circle_at_50%_-20%,rgba(132,204,22,0.08),transparent_60%)] pointer-events-none" />
            )}

            {/* TOP BAR / CONTROL BOARD */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-stone-900 pb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-amber-500/10 to-amber-500/20 rounded-xl border border-amber-500/30">
                  <Tv className="text-amber-500 w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <span className="text-[10px] text-amber-500 uppercase tracking-[0.25em] font-mono font-bold block">
                    Godley Ciders • High Elevation Projections
                  </span>
                  <h2 className="font-serif text-lg text-white font-medium uppercase tracking-wider">
                    Cask Room <span className="text-amber-500 italic font-bold">Scrapbook Slide</span>
                  </h2>
                </div>
              </div>

              {/* CONTROLS (AWESOME FOR THE AV NERD USER!) */}
              <div className="flex flex-wrap items-center gap-4 bg-stone-950/85 p-2.5 rounded-xl border border-stone-850/60 text-[10px] font-sans">
                {/* Theme Selector */}
                <div className="flex items-center gap-1.5 border-r border-stone-900 pr-4">
                  <span className="text-stone-500 uppercase font-bold text-[9px] mr-1">Ambiance:</span>
                  {(['candlelight', 'midnight', 'orchard'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setProjectorTheme(t)}
                      className={`px-2 py-1 rounded-md uppercase font-bold transition-all text-[9.5px] cursor-pointer ${
                        projectorTheme === t 
                          ? 'bg-amber-600 text-stone-950' 
                          : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
                      }`}
                    >
                      {t === 'candlelight' ? 'Warm' : t === 'midnight' ? 'Cosmic' : 'Grove'}
                    </button>
                  ))}
                </div>

                {/* Typography Toggle */}
                <div className="flex items-center gap-1.5 border-r border-stone-900 pr-4">
                  <span className="text-stone-500 uppercase font-bold text-[9px] mr-1">Typography:</span>
                  {(['serif', 'sans'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setProjectorFont(f)}
                      className={`px-2 py-1 rounded-md uppercase font-bold transition-all text-[9.5px] cursor-pointer ${
                        projectorFont === f 
                          ? 'bg-amber-600 text-stone-950' 
                          : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
                      }`}
                    >
                      {f === 'serif' ? 'Roman Serif' : 'Swiss Sans'}
                    </button>
                  ))}
                </div>

                {/* Cycles Speed Selector */}
                <div className="flex items-center gap-1.5 border-r border-stone-900 pr-4">
                  <span className="text-stone-500 uppercase font-bold text-[9px] mr-1">Speed:</span>
                  {([4000, 8000, 15000] as const).map((ms) => (
                    <button
                      key={ms}
                      onClick={() => {
                        setProjectorSpeed(ms);
                        setProjectorIndex(0);
                      }}
                      className={`px-2 py-1 rounded-md uppercase font-bold transition-all text-[9.5px] cursor-pointer ${
                        projectorSpeed === ms 
                          ? 'bg-amber-600 text-stone-950' 
                          : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
                      }`}
                    >
                      {ms / 1000}s
                    </button>
                  ))}
                </div>

                {/* Cycle controls triggers */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const list = scrapbookRecords.filter(r => r.isTastingLog === true);
                      if (list.length > 0) {
                        setProjectorIndex((prev) => (prev - 1 + list.length) % list.length);
                      }
                    }}
                    className="p-1.5 bg-stone-900 hover:bg-stone-850 text-stone-400 hover:text-white rounded-lg cursor-pointer"
                    title="Previous Slide"
                  >
                    <ChevronLeft size={14} />
                  </button>

                  <button
                    onClick={() => setProjectorPlaying(!projectorPlaying)}
                    className="p-1.5 bg-stone-900 hover:bg-stone-850 text-stone-400 hover:text-white rounded-lg cursor-pointer flex items-center justify-center"
                    title={projectorPlaying ? 'Pause Slideshow' : 'Play Slideshow'}
                  >
                    {projectorPlaying ? <Pause size={13} className="text-amber-500" /> : <Play size={13} className="text-emerald-500" />}
                  </button>

                  <button
                    onClick={() => {
                      const list = scrapbookRecords.filter(r => r.isTastingLog === true);
                      if (list.length > 0) {
                        setProjectorIndex((prev) => (prev + 1) % list.length);
                      }
                    }}
                    className="p-1.5 bg-stone-900 hover:bg-stone-850 text-stone-400 hover:text-white rounded-lg cursor-pointer"
                    title="Next Slide"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>

                {/* Close Overlay */}
                <button
                  onClick={() => setProjectorActive(false)}
                  className="ml-3 p-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-stone-950 rounded-xl transition-all cursor-pointer border border-red-500/20"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* CORE HERO WORKSPACE */}
            <div className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center justify-center my-6 max-h-[calc(100vh-230px)] overflow-hidden">
              
              {/* LEFT SIDE: THE MASSIVE SLIDE HOLDER (8 COLS) */}
              <div className="lg:col-span-8 flex flex-col justify-center h-full max-w-4xl mx-auto w-full relative">
                <AnimatePresence mode="wait">
                  {(() => {
                    const list = scrapbookRecords.filter(r => r.isTastingLog === true);
                    const activeLog = list[projectorIndex];
                    
                    if (list.length > 0 && activeLog) {
                      const colorAccent = getCiderAccentColor(activeLog.ciderName);
                      return (
                        <motion.div
                          key={activeLog.id + '_' + projectorIndex}
                          initial={{ opacity: 0, x: 25, scale: 0.98 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          exit={{ opacity: 0, x: -25, scale: 0.98 }}
                          transition={{ duration: 0.7, ease: 'easeOut' }}
                          className="space-y-8 select-none text-left"
                        >
                          {/* Active Cider Ribbon */}
                          <div className="space-y-2">
                            <span 
                              className="text-xs uppercase tracking-[0.25em] font-mono font-black border-l-4 pl-3 block"
                              style={{ borderColor: colorAccent, color: colorAccent }}
                            >
                              Cider Class Flight
                            </span>
                            
                            <h3 className="font-serif text-3xl md:text-5xl font-black uppercase text-stone-100 tracking-tight">
                              {activeLog.ciderName}
                            </h3>
                          </div>

                          {/* Glowing Ratings Stars */}
                          <div className="flex gap-1.5 text-amber-500">
                            {Array.from({ length: activeLog.rating || 5 }).map((_, i) => (
                              <Star key={i} size={18} className="fill-current text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                            ))}
                          </div>

                          {/* Large Immersive Comment */}
                          <div className="py-4 border-l-2 border-stone-800 pl-6 md:pl-8">
                            <p className={`text-stone-200 tracking-wide leading-relaxed italic block ${
                              projectorFont === 'serif' 
                                ? 'font-serif text-2xl md:text-4xl font-medium' 
                                : 'font-sans text-xl md:text-3xl font-bold'
                            }`}>
                              "{activeLog.notes}"
                            </p>
                          </div>

                          {/* Event Pairings & Stats info line */}
                          <div className="flex flex-wrap items-center gap-6 pt-2">
                            {/* Author */}
                            <div className="space-y-1">
                              <span className="text-[9px] uppercase tracking-widest text-stone-500 block font-sans">Sensory Tasted By</span>
                              <span className="font-serif text-lg text-amber-500 font-bold block">
                                {activeLog.authorName}
                              </span>
                            </div>

                            {/* Pairing badges */}
                            {activeLog.pairings && activeLog.pairings.length > 0 && (
                              <div className="space-y-1 border-l border-stone-900 pl-6">
                                <span className="text-[9px] uppercase tracking-widest text-stone-500 block font-sans">Harmonious Pairings</span>
                                <div className="flex gap-2">
                                  {activeLog.pairings.map((p: string) => (
                                    <span key={p} className="text-xs bg-stone-905/60 text-stone-300 border border-stone-850 px-3 py-1 bg-stone-900 rounded-xl font-medium flex items-center gap-1.5">
                                      <span>{p}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Slide loop status bar (tactile visual countdown) */}
                          {projectorPlaying && (
                            <div className="w-full h-1 bg-stone-950/80 rounded-full overflow-hidden mt-6">
                              <motion.div 
                                key={`bar_${projectorIndex}`}
                                initial={{ width: '0%' }}
                                animate={{ width: '100%' }}
                                transition={{ duration: projectorSpeed / 1000, ease: 'linear' }}
                                className="bg-amber-600 h-full rounded-full"
                              />
                            </div>
                          )}

                        </motion.div>
                      );
                    } else {
                      return (
                        <motion.div
                          key="projector-empty"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="text-center p-12 bg-stone-950/40 rounded-2xl border border-stone-900 max-w-lg mx-auto space-y-6"
                        >
                          <Sparkles className="text-amber-500 mx-auto w-12 h-12 animate-bounce" />
                          <div className="space-y-2">
                            <h4 className="font-serif text-xl text-white uppercase font-bold">The Scroll Awaits its First Scribble</h4>
                            <p className="text-sm text-stone-400 font-sans leading-relaxed">
                              Scan the Flight paddle or tabletop coaster right now. Write your name, taste profiles, and press notes to display live on this wall screen.
                            </p>
                          </div>
                        </motion.div>
                      );
                    }
                  })()}
                </AnimatePresence>
              </div>

              {/* RIGHT SIDE: INTERACTIVE QR CONNECT PORTAL BOARD (4 COLS) */}
              <div className="lg:col-span-4 self-center h-full flex flex-col justify-center border-l border-stone-900/40 pl-6 md:pl-10 space-y-8 max-w-sm mx-auto">
                
                {/* Physical-to-Digital Connection Box */}
                <div className="bg-stone-950/80 p-6 rounded-2xl border border-stone-850/60 text-center space-y-6 shadow-2xl relative overflow-hidden group">
                  <div className="absolute right-0 top-0 w-12 h-12 bg-amber-500/10 rounded-bl-3xl border-l border-b border-amber-500/10 pointer-events-none" />
                  
                  <div className="space-y-1">
                    <span className="text-[8.5px] text-amber-500 font-sans uppercase tracking-[0.2em] font-black block">Join The Taproom Scroll</span>
                    <h4 className="font-serif text-sm text-stone-100 uppercase tracking-widest font-black">
                      Pin Your Taste Live!
                    </h4>
                  </div>

                  {/* Gigantic high-impact graphic QR Code block for the projector depth */}
                  <div className="bg-white p-4.5 rounded-2xl inline-block shadow-[0_0_30px_rgba(217,119,6,0.15)] ring-4 ring-amber-500/10">
                    <div className="w-40 h-40 bg-zinc-900 rounded-lg p-2 flex items-center justify-center">
                      <svg className="w-full h-full text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <rect x="2" y="2" width="6" height="6" rx="0.5" />
                        <rect x="16" y="2" width="6" height="6" rx="0.5" />
                        <rect x="2" y="16" width="6" height="6" rx="0.5" />
                        <rect x="9" y="9" width="6" height="6" rx="0.5" />
                        <path d="M16 16h2v2h-2zm2 2h2v2h-2zm-2 2h2v2h-2zM9 16h2v2H9zm2-4h2v2h-2zm4-3hdv2h-2z" />
                        <circle cx="5" cy="5" r="1.5" fill="currentColor" />
                        <circle cx="19" cy="5" r="1.5" fill="currentColor" />
                        <circle cx="5" cy="19" r="1.5" fill="currentColor" />
                        <circle cx="12" cy="12" r="1" fill="currentColor" />
                      </svg>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] font-sans font-extrabold uppercase text-stone-200 block tracking-wider">
                      SCAN WITH PHONE CAMERA
                    </span>
                    <p className="text-[10px] text-stone-400 font-sans leading-relaxed">
                      Zero sign-up barrier. Simply scan flight coasters at your table, rate sweetness, acid, and oak funk — then hit share to see it on the screen!
                    </p>
                  </div>
                </div>

                {/* Live Real-time totals tickers */}
                <div className="bg-stone-900/10 p-5 rounded-2xl border border-stone-900 text-left space-y-2.5">
                  <span className="text-[8px] text-stone-500 font-sans tracking-widest uppercase block font-bold">Harvester Room Statistics</span>
                  <div className="flex justify-between items-end">
                    <span className="text-stone-400 text-[10px] font-sans">Active Live Sips</span>
                    <span className="text-3xl font-serif text-amber-500 font-black tracking-tight">
                      {scrapbookRecords.filter(r => r.isTastingLog === true).length}
                    </span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-stone-400 text-[10px] font-sans">Current Est. Temperature</span>
                    <span className="text-xs font-semibold text-stone-300 font-sans">
                      68.2°F (Cellar Vault)
                    </span>
                  </div>
                </div>

              </div>

            </div>

            {/* LOWER STATUS RUNNING FOOTER BAR */}
            <div className="relative z-10 flex justify-between items-center border-t border-stone-900 pt-6 text-[10px] font-sans text-stone-500 uppercase">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                <span>Godley Ciders Live Session: Active</span>
              </span>
              
              <span className="font-serif italic text-stone-400 text-xs text-center hidden md:inline">
                "Preserving pre-prohibition heritage cultivars, one glass at a time"
              </span>

              <span className="font-semibold tracking-wide text-right">
                Slide {scrapbookRecords.filter(r => r.isTastingLog === true).length > 0 ? projectorIndex + 1 : 0} of {scrapbookRecords.filter(r => r.isTastingLog === true).length}
              </span>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
