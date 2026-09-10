import React from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import ProductSpecimen from '../components/ProductSpecimen';
import { useAdminStore } from '../store/adminStore';

export default function Home() {
  const navigate = useNavigate();
  const { homeSettings } = useAdminStore();

  return (
    <div className="space-y-32">
      
      {/* Hero Section */}
      <section className="relative h-[80vh] flex items-center justify-center text-center px-4">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="relative z-10 max-w-4xl mx-auto space-y-6"
        >
          <h1 className={`${homeSettings.heroTitleSize} ${homeSettings.heroTitleFont} ${homeSettings.heroTitleColor} drop-shadow-lg`}>
            {homeSettings.heroTitle}
          </h1>
          <p className="text-lg md:text-xl text-stone-300 font-serif italic max-w-2xl mx-auto drop-shadow-md">
            {homeSettings.heroSubtitle}
          </p>
        </motion.div>
      </section>

      {/* Club Membership Block (Just under the Hero) */}
      <section className="max-w-5xl mx-auto px-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="bg-gradient-to-br from-stone-950/75 via-stone-900/75 to-stone-950/75 backdrop-blur-md border border-amber-500/20 rounded-2xl p-8 md:p-12 relative overflow-hidden shadow-[0_15px_50px_rgba(0,0,0,0.8)]"
        >
          {/* Subtle amber ambient glow in corner */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            <div className="lg:col-span-7 space-y-4">
              <span className="text-amber-500 font-mono text-[10px] uppercase tracking-[0.35em] font-bold block">
                Exclusive Cider Allocations
              </span>
              <h2 className="text-3xl md:text-4xl font-serif text-stone-100 uppercase tracking-wider leading-tight">
                Join the League of the Apple
              </h2>
              <p className="text-sm md:text-base text-stone-200 font-serif italic leading-relaxed">
                Unlock exclusive small-batch allocations, private barrel tastings, and premium dry goods delivered directly to your doorstep. Member spots are strictly limited.
              </p>
            </div>
            
            <div className="lg:col-span-5 flex flex-col sm:flex-row lg:flex-col gap-4 justify-end lg:items-end w-full">
              <div className="text-left lg:text-right">
                <span className="text-[10px] text-stone-500 uppercase tracking-widest font-mono">allocations starting at</span>
                <div className="text-3xl font-serif text-amber-500 mt-1 font-extrabold">$25 <span className="text-xs text-stone-400">/ release</span></div>
              </div>
              <button 
                id="btn-join-club"
                onClick={() => navigate('/club')}
                className="px-8 py-4 border border-amber-500/40 text-amber-500 uppercase tracking-widest text-xs hover:bg-amber-500 hover:text-stone-950 hover:border-amber-400 transition-all rounded-lg font-sans font-black cursor-pointer shadow-lg hover:shadow-amber-500/20 text-center leading-none"
              >
                Claim Member Pass
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Product Showcase Section (The Ciders) */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center space-y-4 mb-16 animate-fade-in">
          <span className="text-amber-500 font-mono text-xs uppercase tracking-[0.4em] mb-2 block font-extrabold">Vintage Highlights</span>
          <h2 className="text-3xl md:text-5xl font-serif text-stone-100 uppercase tracking-widest">
            The Ciders
          </h2>
          <div className="w-16 h-[1px] bg-amber-500 mx-auto"></div>
          <p className="text-stone-200 font-serif italic max-w-lg mx-auto">
            Each vintage tells a different story of the soil, wild fermentation, and the season.
          </p>
        </div>
        
        <ProductSpecimen />
      </section>

      {/* Core Harvest Blends (The Base Ciders) */}
      <section className="max-w-5xl mx-auto px-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="bg-gradient-to-br from-stone-950/75 via-stone-900/75 to-stone-950/75 backdrop-blur-md border border-amber-500/20 rounded-2xl p-8 md:p-12 relative overflow-hidden shadow-[0_15px_50px_rgba(0,0,0,0.8)]"
        >
          {/* Subtle ambient glow */}
          <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center relative z-10">
            <div className="lg:col-span-6 space-y-6 order-2 lg:order-1">
              <div className="space-y-2">
                <span className="text-amber-500 font-mono text-[10px] uppercase tracking-[0.3em] font-bold block">
                  The Foundation
                </span>
                <h2 className="text-3xl md:text-4xl font-serif text-stone-100 uppercase tracking-widest leading-tight">
                  Core Blends
                </h2>
              </div>
              <div className="w-12 h-[1px] bg-amber-500/50"></div>
              <p className="text-stone-200 font-serif leading-relaxed text-sm md:text-base">
                Crafted from high-density mountain orchards, our core lineup represents the absolute purity of the apple. Every bottle is fermented slowly with indigenous microbes to highlight the clean, crisp qualities of cold-pressed, unfiltered fruit.
              </p>
              
              <div className="space-y-4 pt-2">
                <div className="flex items-start gap-4 border-l border-amber-500/30 pl-4 py-1">
                  <div className="space-y-0.5">
                    <h4 className="text-xs text-stone-200 uppercase tracking-widest font-bold font-sans">Dry Cider (Green Label)</h4>
                    <p className="text-xs text-stone-300 font-serif italic">Crisp, highly bone-dry, with a pristine, champagne-like finish.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 border-l border-amber-500/30 pl-4 py-1">
                  <div className="space-y-0.5">
                    <h4 className="text-xs text-stone-200 uppercase tracking-widest font-bold font-sans">Off-Dry Cider (Yellow Label)</h4>
                    <p className="text-xs text-stone-300 font-serif italic">Subtle lingering orchard sweetness with elegant acid/tannic balance.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 border-l border-amber-500/30 pl-4 py-1">
                  <div className="space-y-0.5">
                    <h4 className="text-xs text-stone-200 uppercase tracking-widest font-bold font-sans">Semi-Sweet Cider (Red Label)</h4>
                    <p className="text-xs text-stone-300 font-serif italic">Delectably rich, full-bodied cider, slow-aged for complex wood notes.</p>
                  </div>
                </div>
              </div>

              <button 
                id="btn-shop-core"
                onClick={() => navigate('/shop')}
                className="mt-4 px-8 py-4 border border-amber-500/40 text-amber-500 uppercase tracking-widest text-xs hover:bg-amber-500 hover:text-stone-950 hover:border-amber-400 transition-all rounded-lg font-sans font-black cursor-pointer shadow-lg hover:shadow-amber-500/20"
              >
                Shop Core Blends
              </button>
            </div>

            <div className="lg:col-span-6 order-1 lg:order-2">
              <div 
                onClick={() => navigate('/shop')}
                className="group relative overflow-hidden rounded-xl border border-amber-500/30 bg-stone-950/90 shadow-2xl cursor-pointer hover:border-amber-500/60 hover:shadow-[0_0_40px_rgba(245,158,11,0.25)] transition-all duration-500"
              >
                {/* Back glow layer for 3D pop effect */}
                <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/20 via-transparent to-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-10" />
                <img 
                  src="/assets/ciders/base_ciders.png" 
                  alt="Godley Ciders Base Blends: Dry Cider, Off-Dry Cider, Semi-Sweet Cider" 
                  className="w-full h-full object-cover opacity-100 transform scale-100 group-hover:scale-105 transition-transform duration-700 ease-out"
                  onError={(e) => {
                    e.currentTarget.src = "https://images.unsplash.com/photo-1571612457850-d477fcbcaa5c?q=80&w=2000&auto=format&fit=crop";
                  }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      </section>
      
      {/* Short Story snippet */}
      <section className="max-w-5xl mx-auto px-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="bg-gradient-to-br from-stone-950/75 via-stone-900/75 to-stone-950/75 backdrop-blur-md border border-amber-500/20 rounded-2xl p-8 md:p-12 relative overflow-hidden shadow-[0_15px_50px_rgba(0,0,0,0.8)] text-center space-y-8"
        >
          <div className="max-w-3xl mx-auto space-y-8 relative z-10">
            <h2 className="text-3xl md:text-4xl font-serif text-stone-100 uppercase tracking-wider">{homeSettings.storyTitle}</h2>
            <p className="text-stone-200 leading-relaxed font-serif whitespace-pre-line text-sm md:text-base">
              {homeSettings.storyBody}
            </p>
            <button 
              id="btn-read-full-story"
              onClick={() => navigate('/story')}
              className="px-8 py-4 border border-amber-500/40 text-amber-500 uppercase tracking-widest text-xs hover:bg-amber-500 hover:text-stone-950 hover:border-amber-400 transition-all rounded-lg font-sans font-black cursor-pointer shadow-lg hover:shadow-amber-500/20"
            >
              {homeSettings.storyButtonText}
            </button>
          </div>
        </motion.div>
      </section>

    </div>
  );
}
