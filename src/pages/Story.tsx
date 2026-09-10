import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Play, Pause, Maximize2, Compass, Sparkles, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAdminStore } from '../store/adminStore';
import InteractiveStory from '../components/InteractiveStory';

export default function Story() {
  const navigate = useNavigate();
  const { storySettings } = useAdminStore();
  const [isPlaying, setIsPlaying] = useState(true);
  const [showFullTour, setShowFullTour] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const toggleVideo = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const defaultVideo = storySettings.scenes?.[0]?.videoUrl || 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

  return (
    <div className="relative min-h-[calc(100vh-6rem)] w-full text-stone-100 font-sans">
      {/* Technical Grid Background */}
      <div className="bg-grid pointer-events-none" />

      {/* Main Archival Layout Grid */}
      <main className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-12 py-8 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start relative z-10">
        
        {/* Left Column: Story Narrative */}
        <div className="lg:col-span-7 xl:col-span-8 border-l border-stone-800/60 pl-6 sm:pl-10 md:pl-12 space-y-12">
          
          {/* Header & Tagline */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-4"
          >
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-amber-500 font-bold block">
              Historical Archives / 001
            </span>
            
            <h1 className="font-serif text-6xl sm:text-7xl md:text-8xl lg:text-[8rem] font-light leading-[0.85] uppercase tracking-[-0.04em] text-stone-100 drop-shadow-lg">
              Our<br />Story
            </h1>

            <div className="pt-2">
              <p className="font-serif italic text-xl sm:text-2xl text-amber-400/95 tracking-wide">
                Creation. Corruption. Redemption. Told Through Cider.
              </p>
            </div>
          </motion.div>

          {/* Section 1: Faith & The Miracle of Cana */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="font-serif text-lg sm:text-xl md:text-[1.4rem] font-light leading-[1.6] text-stone-200/90 space-y-6"
          >
            <p className="text-justify md:text-left">
              With a dream and much prayer, God led us on an incredible journey to highlight His creation and redemptive love through fine ciders, perry, and wine. Building this haven hasn't always been easy. On the days we ask ourselves, <span className="italic text-stone-100">"What are we doing here?"</span> God provides the strength to keep walking the path.
            </p>
            <p className="text-justify md:text-left text-stone-300">
              Our work relies on the same patient faith illustrated in Jesus’s first miracle at Cana. Before the water became wine, the servants had to labor—drawing heavy water from the well to fill massive vats. It was hard, quiet work, but the result was extraordinary: a wine celebrated as <span className="italic text-amber-200">"the best,"</span> served in abundance as a life-changing gift to the bride and groom. We bring that same dedication to every batch we press.
            </p>
          </motion.div>

          {/* Section 2: The Living Parable */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="space-y-6 pt-4"
          >
            <div className="border-t border-b border-amber-500/20 py-4">
              <h3 className="font-serif text-2xl sm:text-3xl text-stone-100 uppercase tracking-widest">
                A Living Parable Told Through the Senses
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-6 pt-2">
              {/* Creation */}
              <div className="bg-stone-950/70 border border-amber-500/30 rounded-xl p-6 relative overflow-hidden backdrop-blur-sm shadow-[0_0_30px_rgba(245,158,11,0.08)]">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-mono text-xs text-amber-500 font-bold uppercase tracking-widest">01 / STAGE</span>
                  <h4 className="font-serif text-2xl text-amber-400 uppercase tracking-wide">Creation</h4>
                </div>
                <p className="font-serif text-stone-200 text-base sm:text-lg leading-relaxed">
                  It begins quietly in the dirt with a single seed, growing over years into a mature tree that bears pristine, whole fruit.
                </p>
              </div>

              {/* Corruption */}
              <div className="bg-stone-950/70 border border-amber-500/30 rounded-xl p-6 relative overflow-hidden backdrop-blur-sm shadow-[0_0_30px_rgba(245,158,11,0.08)]">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-mono text-xs text-amber-500 font-bold uppercase tracking-widest">02 / STAGE</span>
                  <h4 className="font-serif text-2xl text-amber-400 uppercase tracking-wide">Corruption</h4>
                </div>
                <p className="font-serif text-stone-200 text-base sm:text-lg leading-relaxed">
                  The apples are harvested, crushed, and surrendered to wild fermentation. As yeast breaks down the fruit, it passes through a state of raw, unpalatable turmoil.
                </p>
              </div>

              {/* Redemption */}
              <div className="bg-stone-950/70 border border-amber-500/30 rounded-xl p-6 relative overflow-hidden backdrop-blur-sm shadow-[0_0_30px_rgba(245,158,11,0.08)]">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-mono text-xs text-amber-500 font-bold uppercase tracking-widest">03 / STAGE</span>
                  <h4 className="font-serif text-2xl text-amber-400 uppercase tracking-wide">Redemption</h4>
                </div>
                <p className="font-serif text-stone-200 text-base sm:text-lg leading-relaxed">
                  Guided by careful hands and patient aging, the liquid is transformed into a vibrant, renewed creation—a fine cider meant to be celebrated and shared.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Section 3: Lincoln, CA Heritage & Signoff */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="font-serif text-lg sm:text-xl md:text-[1.35rem] font-light leading-[1.6] text-stone-200/90 space-y-6 pt-4"
          >
            <p className="text-justify md:text-left">
              Nestled right here in Lincoln, California, along the Sierra Nevada foothills, our land carries a deep legacy—from the Gold Rush era to the historic pear orchard boom of the Auburn-Loomis Basin. We are bringing back lost Old World and Pre-Prohibition American cider styles, honoring our local soil while blending the sophistication of winemaking with the adventurous spirit of the craft beer movement.
            </p>

            <div className="bg-gradient-to-r from-stone-950 via-stone-900 to-stone-950 border-l-2 border-amber-500/60 p-6 rounded-r-xl my-6">
              <p className="italic text-stone-200 font-serif text-lg leading-relaxed">
                Take our signature <span className="font-semibold text-amber-400">Serpent’s Sting</span>: a dry-aged cider engineered to highlight clean acidity, fermented with yeast strains chosen to preserve the pure apple core, and dry-hopped to evoke the crisp aromas of the Garden itself.
              </p>
            </div>

            {/* Join the Journey & Sign-off */}
            <div className="border-t border-stone-800/60 pt-8 space-y-6">
              <h3 className="font-serif text-2xl sm:text-3xl text-stone-100 uppercase tracking-widest">
                Join the Journey
              </h3>
              <p className="text-stone-300">
                At Godley Ciders LLC, we don’t just craft beverages—we invite you to take part in the journey, taste the redemption, and experience the story through your senses.
              </p>

              <div className="pt-4 space-y-2 font-serif">
                <p className="text-amber-400 font-serif italic text-xl">God Bless You,</p>
                <p className="text-stone-100 text-2xl font-normal pt-2">Travis Partlow</p>
                <p className="font-mono text-xs uppercase tracking-widest text-stone-400">
                  Founder & Cider Maker, Godley Ciders LLC
                </p>
              </div>

              <div className="pt-4 flex flex-wrap gap-4">
                <button
                  id="btn-story-shop"
                  onClick={() => navigate('/shop')}
                  className="px-8 py-4 border border-amber-500/40 text-amber-500 uppercase tracking-widest text-xs hover:bg-amber-500 hover:text-stone-950 hover:border-amber-400 transition-all rounded-lg font-sans font-black cursor-pointer shadow-lg hover:shadow-amber-500/20 flex items-center gap-2"
                >
                  <span>Explore Our Ciders</span>
                  <ArrowRight size={14} />
                </button>
                <button
                  id="btn-story-club"
                  onClick={() => navigate('/club')}
                  className="px-8 py-4 border border-stone-800 hover:border-amber-500/40 text-stone-300 hover:text-amber-400 uppercase tracking-widest text-xs transition-all rounded-lg font-sans font-bold cursor-pointer"
                >
                  Join the Fellowship
                </button>
              </div>
            </div>
          </motion.div>

          {/* Archival Highlights */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="pt-8 border-t border-stone-800/40 grid grid-cols-2 sm:grid-cols-3 gap-6 font-mono text-[10px] uppercase tracking-widest text-stone-500"
          >
            <div>
              <span className="text-amber-500/80 block mb-1">TERROIR</span>
              <p className="text-stone-300 font-bold">LINCOLN, CA / SIERRA FOOTHILLS</p>
            </div>
            <div>
              <span className="text-amber-500/80 block mb-1">FERMENTATION</span>
              <p className="text-stone-300 font-bold">WILD & INDIGENOUS</p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-amber-500/80 block mb-1">FOUNDER & CIDER MAKER</span>
              <p className="text-stone-300 font-bold">TRAVIS PARTLOW</p>
            </div>
          </motion.div>
        </div>

        {/* Right Column: Media / Orchard Tour Specimen */}
        <div className="lg:col-span-5 xl:col-span-4 sticky top-28">
          <motion.section
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="border border-stone-800/80 bg-stone-950/75 backdrop-blur-md p-6 sm:p-7 rounded-2xl flex flex-col justify-between shadow-[0_15px_50px_rgba(0,0,0,0.8)] relative overflow-hidden group"
          >
            {/* Ambient amber corner glow */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl -mr-12 -mt-12 pointer-events-none" />

            {/* Header */}
            <div>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-500 font-bold block mb-1">
                Memory Reconstruction
              </span>
              <h2 className="font-serif font-light text-2xl uppercase tracking-wider text-stone-100">
                Interactive Orchard Tour
              </h2>
              <p className="font-mono text-[11px] text-stone-400 mt-1 opacity-70">
                Scroll down to explore the memories of our orchard.
              </p>
            </div>

            {/* Video Container with Scan-line */}
            <div className="w-full aspect-[9/16] max-h-[500px] bg-black relative overflow-hidden my-6 rounded-xl border border-stone-800/80 shadow-2xl group/video">
              {/* Scanline Effect */}
              <div className="absolute top-0 left-0 w-full h-[2px] bg-amber-500/40 z-20 pointer-events-none animate-pulse" />

              <video
                ref={videoRef}
                autoPlay
                muted
                loop
                playsInline
                src={defaultVideo}
                className="w-full h-full object-cover"
              />

              {/* Video Overlay Controls */}
              <div className="absolute bottom-4 right-4 z-30 flex items-center gap-2">
                <button
                  onClick={toggleVideo}
                  aria-label={isPlaying ? "Pause video" : "Play video"}
                  className="w-8 h-8 rounded-full bg-stone-950/80 backdrop-blur-sm border border-stone-700 hover:border-amber-500 text-stone-300 hover:text-amber-500 flex items-center justify-center transition-colors shadow-lg cursor-pointer"
                >
                  {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <button
                  onClick={() => setShowFullTour(!showFullTour)}
                  aria-label="Expand interactive tour"
                  className="px-3 py-1.5 rounded-full bg-amber-500/10 backdrop-blur-sm border border-amber-500/40 hover:bg-amber-500 hover:text-stone-950 text-amber-500 text-[10px] font-mono uppercase tracking-widest flex items-center gap-1.5 transition-all shadow-lg cursor-pointer font-bold"
                >
                  <Maximize2 size={12} />
                  <span>{showFullTour ? 'Close' : 'Explore'}</span>
                </button>
              </div>

              {/* Overlay Vignette */}
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-transparent to-stone-950/30 pointer-events-none" />
            </div>

            {/* Telemetry Footer */}
            <div className="font-mono text-[10px] leading-relaxed text-stone-500 tracking-wider pt-2 border-t border-stone-800/50 flex items-end justify-between">
              <div>
                LAT: 38.8916° N<br />
                LONG: 121.2933° W<br />
                TERROIR: <span className="text-amber-500 font-bold">LINCOLN_FOOTHILLS</span>
              </div>
              <button
                onClick={() => {
                  const element = document.getElementById('full-interactive-tour');
                  element?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-amber-500 hover:text-amber-400 text-[9px] uppercase tracking-widest font-mono flex items-center gap-1 cursor-pointer transition-colors pb-0.5"
              >
                <Compass size={12} />
                <span>Full Tour ↓</span>
              </button>
            </div>
          </motion.section>
        </div>
      </main>

      {/* Expanded / Full Interactive Orchard Tour Section */}
      <section id="full-interactive-tour" className="w-full mt-16 pt-16 border-t border-stone-800/40 relative z-10">
        <div className="max-w-4xl mx-auto px-6 mb-8 text-center">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-500 font-bold block mb-2">
            Archival Chronology
          </span>
          <h2 className="text-3xl md:text-4xl font-serif text-stone-100 uppercase tracking-widest py-2">
            Interactive Orchard Tour
          </h2>
          <div className="w-16 h-[1px] bg-amber-500/50 mx-auto my-3" />
          <p className="text-stone-400 font-serif italic text-sm md:text-base">
            Scroll down to navigate through memories, examine heirloom varietals, and explore historic harvest sites.
          </p>
        </div>
        <InteractiveStory />
      </section>
    </div>
  );
}
