import React, { useState, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag, X, Wine, Compass, Shirt, CheckCircle, PackageCheck, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAdminStore } from '../store/adminStore';
import { useCartStore } from '../store/cartStore';

export default function Shop() {
  const { shopSettings, shopProducts, loadFromFirebase } = useAdminStore();
  const { addItem, clearCart } = useCartStore();

  const [activeTab, setActiveTab] = useState<'cider' | 'merch'>('cider');
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [orderConfirmation, setOrderConfirmation] = useState<{
    orderId: string;
    customerEmail?: string;
    totalAmount?: number;
    deliveryPreference?: string;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Homestead Base Cider state selections
  const [baseDryQty, setBaseDryQty] = useState(0);
  const [baseOffDryQty, setBaseOffDryQty] = useState(0);
  const [baseSemiSweetQty, setBaseSemiSweetQty] = useState(0);

  const totalBaseQty = baseDryQty + baseOffDryQty + baseSemiSweetQty;
  const baseCiderPrice = totalBaseQty >= 6 ? 5.00 : 6.50;
  const baseCiderSubtotal = totalBaseQty * baseCiderPrice;

  const handleAddBaseCidersToCart = () => {
    if (totalBaseQty === 0) return;

    if (baseDryQty > 0) {
      addItem({
        id: 'base_dry',
        name: 'Base Cider - Dry',
        price: baseCiderPrice,
        quantity: baseDryQty,
        image: '/assets/ciders/base_ciders.png',
        type: 'Homestead Tap'
      });
    }
    if (baseOffDryQty > 0) {
      addItem({
        id: 'base_off_dry',
        name: 'Base Cider - Off-Dry',
        price: baseCiderPrice,
        quantity: baseOffDryQty,
        image: '/assets/ciders/base_ciders.png',
        type: 'Homestead Tap'
      });
    }
    if (baseSemiSweetQty > 0) {
      addItem({
        id: 'base_semi_sweet',
        name: 'Base Cider - Semi-Sweet',
        price: baseCiderPrice,
        quantity: baseSemiSweetQty,
        image: '/assets/ciders/base_ciders.png',
        type: 'Homestead Tap'
      });
    }

    setBaseDryQty(0);
    setBaseOffDryQty(0);
    setBaseSemiSweetQty(0);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutStatus = params.get('checkout');
    const sessionId = params.get('session_id');

    if (checkoutStatus === 'success') {
      if (clearCart) clearCart();

      if (sessionId) {
        // Query backend session-status endpoint to verify Stripe payment, register order & decrement inventory
        fetch(`/api/checkout/session-status?session_id=${sessionId}`)
          .then(res => res.json())
          .then(data => {
            const meta = data.metadata || {};
            setOrderConfirmation({
              orderId: meta.orderId || `ORD-${sessionId.slice(-6).toUpperCase()}`,
              customerEmail: meta.customerEmail,
              totalAmount: meta.totalAmount ? Number(meta.totalAmount) : undefined,
              deliveryPreference: meta.deliveryPreference
            });
            // Refresh local store to show updated live stock
            loadFromFirebase();
          })
          .catch(err => {
            console.warn("Session verification check error:", err);
            setOrderConfirmation({
              orderId: `ORD-${sessionId.slice(-6).toUpperCase()}`
            });
          });
      } else {
        setOrderConfirmation({
          orderId: 'CONFIRMED'
        });
      }

      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [clearCart, loadFromFirebase]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    setMousePosition({ x, y });
  };

  // Separate ciders and merchandise items
  const ciders = useMemo(() => {
    return shopProducts.filter(p => !p.category || p.category === 'cider');
  }, [shopProducts]);

  const merch = useMemo(() => {
    return shopProducts.filter(p => p.category === 'merch');
  }, [shopProducts]);

  return (
    <div className="relative min-h-screen bg-[#0a0a09] overflow-hidden pt-24 pb-20">
      
      {/* BACKGROUND DEPTH GLOW & GRID */}
      <div className="bg-grid pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] bg-yellow-950/10 rounded-full blur-[140px] pointer-events-none" />

      {/* HEADER SECTION */}
      <div className="relative z-10 max-w-4xl mx-auto text-center px-4 mb-4">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-block py-1 px-4 mb-4 border border-amber-500/30 bg-stone-950/80 backdrop-blur-md rounded-full shadow-[0_0_20px_rgba(245,158,11,0.1)]"
        >
          <span className="text-amber-500 font-mono text-[10px] uppercase tracking-[0.3em] font-bold">
            THE GODLEY APOTHECARY & CELLAR
          </span>
        </motion.div>

        <motion.h1 
          className="text-4xl md:text-6xl text-amber-500 uppercase tracking-[0.15em] font-serif font-light mb-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {shopSettings.title}
        </motion.h1>

        <div className="w-20 h-[1px] bg-amber-500/30 mx-auto mb-4" />

        <motion.p 
          className="text-stone-300 italic font-serif text-base md:text-lg max-w-2xl mx-auto leading-relaxed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {shopSettings.subtitle}
        </motion.p>
      </div>

      {/* TAB SELECTOR */}
      <div className="relative z-10 flex justify-center mt-8 mb-10 px-4">
        <div className="bg-stone-950/85 p-1.5 rounded-xl border border-amber-500/30 backdrop-blur-md flex gap-2 shadow-[0_0_25px_rgba(245,158,11,0.08)]">
          <button
            onClick={() => setActiveTab('cider')}
            className={`px-6 py-2.5 rounded-lg font-serif text-xs uppercase tracking-widest transition-all duration-300 flex items-center gap-2 cursor-pointer ${
              activeTab === 'cider'
                ? 'bg-amber-500 text-stone-950 font-bold shadow-lg shadow-amber-500/20'
                : 'text-stone-400 hover:text-amber-400'
            }`}
          >
            <Wine className="w-3.5 h-3.5" />
            The Ciders
          </button>
          <button
            onClick={() => setActiveTab('merch')}
            className={`px-6 py-2.5 rounded-lg font-serif text-xs uppercase tracking-widest transition-all duration-300 flex items-center gap-2 cursor-pointer ${
              activeTab === 'merch'
                ? 'bg-amber-500 text-stone-950 font-bold shadow-lg shadow-amber-500/20'
                : 'text-stone-400 hover:text-amber-400'
            }`}
          >
            <Shirt className="w-3.5 h-3.5" />
            Dry Goods & Merch
          </button>
        </div>
      </div>

      {/* RENDER ACTIVE VIEW WITH ANIMATIONS */}
      <AnimatePresence mode="wait">
        {activeTab === 'cider' ? (
          <motion.div
            key="ciders-shelf"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative"
          >
            {/* Desktop View: Interactive 3D Holographic Shelf (hidden on mobile to prevent floating wrap issues) */}
            <div className="hidden md:block">
              {/* Shelf Environment */}
              <div 
                ref={containerRef}
                onMouseMove={handleMouseMove}
                className="relative w-full h-[65vh] min-h-[400px] flex items-center justify-center -mt-6"
              >
                {/* Background Shelf */}
                <div 
                  className="absolute inset-0 bg-[url('/assets/app/Store_shelf.png')] bg-cover bg-center bg-no-repeat opacity-95"
                  style={{ zIndex: 0 }}
                />

                {/* Products on Shelf */}
                <div className="relative z-10 flex flex-wrap items-end justify-center w-full max-w-6xl gap-10 md:gap-20 lg:gap-24 px-4 h-full pb-[10vh] md:pb-[14vh]">
                  {ciders.length > 0 ? (
                    ciders.map((product) => (
                      <motion.div 
                        key={product.id}
                        className="relative cursor-pointer group flex flex-col justify-end"
                        whileHover={{ y: -16 }}
                        onClick={() => setSelectedProduct(product)}
                      >
                        {/* Dynamic light shadow */}
                        <motion.div 
                          className="absolute -inset-4 bg-black/75 blur-xl rounded-[100%] transition-transform duration-100 ease-out z-[-1]"
                          animate={{
                            x: -mousePosition.x * 35,
                            y: -mousePosition.y * 15 + 25,
                            scale: 0.85,
                            opacity: 0.85
                          }}
                        />
                        {/* Bottle Image */}
                        <img 
                          src={product.image} 
                          alt={product.name} 
                          className="w-24 sm:w-36 md:w-44 lg:w-48 h-auto drop-shadow-[0_15px_15px_rgba(0,0,0,0.8)] object-contain origin-bottom transition-all duration-500 group-hover:scale-105 filter group-hover:brightness-110"
                        />
                        <span className="text-center font-serif text-[11px] font-light text-stone-500 group-hover:text-amber-500/70 uppercase tracking-widest mt-2 block transition-colors">
                          View Specs
                        </span>
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-stone-500 text-center uppercase tracking-widest font-mono text-xs mb-20">
                      No ciders currently listed.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile View: Exquisite Grid formatted for perfect screen scaling (hidden on desktop) */}
            <div className="block md:hidden max-w-sm mx-auto px-4 space-y-6">
              {ciders.length > 0 ? (
                ciders.map((product) => (
                  <motion.div
                    key={product.id}
                    className="relative bg-gradient-to-br from-stone-950/80 via-stone-900/75 to-stone-950/80 border border-amber-500/30 hover:border-amber-500/60 p-6 flex flex-col items-center text-center space-y-4 rounded-2xl shadow-[0_15px_50px_rgba(0,0,0,0.8)] backdrop-blur-md group cursor-pointer transition-all duration-500"
                    onClick={() => setSelectedProduct(product)}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="absolute top-3 right-3 flex items-center gap-1.5">
                      {product.vintage && (
                        <span className="bg-amber-900/20 text-amber-500 border border-amber-500/30 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider rounded-md font-bold">
                          {product.vintage}
                        </span>
                      )}
                      {product.available === false || (typeof product.inventoryCount === 'number' && product.inventoryCount <= 0) ? (
                        <span className="bg-red-950/80 text-red-400 border border-red-500/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider rounded-md font-bold">
                          Sold Out
                        </span>
                      ) : typeof product.inventoryCount === 'number' && product.inventoryCount < 10 ? (
                        <span className="bg-amber-950/80 text-amber-400 border border-amber-500/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider rounded-md font-bold">
                          {product.inventoryCount} Left
                        </span>
                      ) : null}
                    </div>
                    <div className="w-28 h-44 flex items-center justify-center p-2 relative">
                      <div className="absolute inset-2 bg-amber-500/10 blur-xl rounded-full pointer-events-none" />
                      <img 
                        src={product.image} 
                        alt={product.name} 
                        className="max-h-full max-w-full object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <h3 className="text-stone-100 font-serif text-lg uppercase tracking-wider font-light group-hover:text-amber-400 transition-colors">
                        {product.name}
                      </h3>
                      <p className="text-amber-500 font-sans text-sm font-bold">${product.price}</p>
                    </div>

                    <p className="text-stone-300 font-serif italic text-xs leading-relaxed max-w-xs line-clamp-2">
                      {product.description}
                    </p>

                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProduct(product);
                      }}
                      className="w-full py-3 border border-amber-500/40 text-amber-500 text-xs font-sans font-bold uppercase tracking-widest hover:bg-amber-500 hover:text-stone-950 hover:border-amber-400 rounded-lg shadow-lg hover:shadow-amber-500/20 transition-all cursor-pointer"
                    >
                      {product.available === false || (typeof product.inventoryCount === 'number' && product.inventoryCount <= 0) ? 'Sold Out' : 'View Specs & Add to Cart'}
                    </button>
                  </motion.div>
                ))
              ) : (
                <div className="text-stone-500 text-center uppercase tracking-widest font-mono text-xs py-12">
                  No ciders currently listed.
                </div>
              )}
            </div>

            {/* HOMESTEAD BASE CIDERS EXPERIMENTAL WIDGET */}
            <div className="max-w-5xl mx-auto mt-20 px-4">
              <div className="border-t border-stone-800/60 pt-16 mb-12">
                <div className="text-center space-y-2">
                  <span className="text-amber-500 font-mono text-[10px] uppercase tracking-[0.3em] font-bold block">
                    MIX-&-MATCH DAILY CELLAR STOCK
                  </span>
                  <h2 className="text-3xl md:text-4xl text-stone-100 font-serif font-light uppercase tracking-widest">
                    Homestead Base Ciders
                  </h2>
                  <div className="w-16 h-[1px] bg-amber-500/30 mx-auto my-3" />
                  <p className="text-stone-300 font-serif italic text-sm md:text-base max-w-lg mx-auto leading-relaxed">
                    Fermented using 100% wild yeasts from our heirloom Placer County crop. Clean, refreshing, and crafted for standard everyday table pairing.
                  </p>
                </div>
              </div>

              <div className="bg-gradient-to-br from-stone-950/80 via-stone-900/75 to-stone-950/80 border border-amber-500/30 p-6 md:p-10 rounded-2xl backdrop-blur-md shadow-[0_15px_50px_rgba(0,0,0,0.8)] relative overflow-hidden">
                {/* Ambient glow */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-10 items-center relative z-10">
                  {/* Image Showcase */}
                  <div className="md:col-span-4 flex flex-col items-center justify-center relative">
                    <div className="relative group overflow-hidden rounded-xl bg-stone-950 border border-amber-500/30 p-3 max-w-[240px] shadow-2xl hover:border-amber-500/60 transition-all duration-500">
                      <div className="absolute inset-0 bg-gradient-to-t from-amber-500/10 to-transparent pointer-events-none" />
                      <img 
                        src="/assets/ciders/base_ciders.png" 
                        alt="Godley Base Ciders Case" 
                        className="w-full h-auto object-contain filter drop-shadow-[0_8px_20px_rgba(0,0,0,0.7)] group-hover:scale-105 transition-transform duration-500"
                      />
                      
                      {/* Floating badge */}
                      <div className="absolute -top-1 -right-1 bg-amber-500 text-stone-950 font-mono font-bold text-[9px] px-2.5 py-1 rounded-md shadow-lg uppercase tracking-wider">
                        Mix & Match
                      </div>
                    </div>
                    <p className="text-stone-400 font-mono text-[10px] uppercase tracking-widest mt-4">Heirloom Standard Stock</p>
                  </div>

                  {/* Configuration Options */}
                  <div className="md:col-span-8 space-y-6">
                    <div className="space-y-4">
                      {/* Item 1: Dry */}
                      <div className="flex items-center justify-between p-4 bg-stone-950/70 border border-amber-500/25 hover:border-amber-500/40 rounded-xl backdrop-blur-sm shadow-[0_0_20px_rgba(245,158,11,0.05)] transition-all">
                        <div className="text-left min-w-0 pr-4">
                          <span className="font-mono text-[9px] text-amber-500 uppercase tracking-widest font-bold">Style No. 01</span>
                          <h4 className="font-serif font-bold text-stone-100 text-sm md:text-base">Base Cider - Dry (Green Label)</h4>
                          <p className="text-stone-300 font-serif text-xs leading-snug mt-1">Bone-dry, crisp, and clean expression of fresh heirloom apples. Absolutely zero residual sugar.</p>
                        </div>
                        <div className="flex items-center gap-2 border border-amber-500/30 bg-stone-950 p-1.5 rounded-lg shrink-0">
                          <button 
                            onClick={() => setBaseDryQty(q => Math.max(0, q - 1))}
                            className="w-7 h-7 rounded flex items-center justify-center font-mono text-stone-300 hover:text-amber-500 hover:bg-stone-900 transition-colors cursor-pointer"
                          >
                            -
                          </button>
                          <span className="w-7 text-center text-xs font-mono text-stone-100 font-bold">{baseDryQty}</span>
                          <button 
                            onClick={() => setBaseDryQty(q => q + 1)}
                            className="w-7 h-7 rounded flex items-center justify-center font-mono text-stone-300 hover:text-amber-500 hover:bg-stone-900 transition-colors cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Item 2: Off-Dry */}
                      <div className="flex items-center justify-between p-4 bg-stone-950/70 border border-amber-500/25 hover:border-amber-500/40 rounded-xl backdrop-blur-sm shadow-[0_0_20px_rgba(245,158,11,0.05)] transition-all">
                        <div className="text-left min-w-0 pr-4">
                          <span className="font-mono text-[9px] text-amber-500 uppercase tracking-widest font-bold">Style No. 02</span>
                          <h4 className="font-serif font-bold text-stone-100 text-sm md:text-base">Base Cider - Off-Dry (Yellow Label)</h4>
                          <p className="text-stone-300 font-serif text-xs leading-snug mt-1">Wonderfully balanced with a whisper of apple sweetness that mitigates the bright malic acidity.</p>
                        </div>
                        <div className="flex items-center gap-2 border border-amber-500/30 bg-stone-950 p-1.5 rounded-lg shrink-0">
                          <button 
                            onClick={() => setBaseOffDryQty(q => Math.max(0, q - 1))}
                            className="w-7 h-7 rounded flex items-center justify-center font-mono text-stone-300 hover:text-amber-500 hover:bg-stone-900 transition-colors cursor-pointer"
                          >
                            -
                          </button>
                          <span className="w-7 text-center text-xs font-mono text-stone-100 font-bold">{baseOffDryQty}</span>
                          <button 
                            onClick={() => setBaseOffDryQty(q => q + 1)}
                            className="w-7 h-7 rounded flex items-center justify-center font-mono text-stone-300 hover:text-amber-500 hover:bg-stone-900 transition-colors cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Item 3: Semi-Sweet */}
                      <div className="flex items-center justify-between p-4 bg-stone-950/70 border border-amber-500/25 hover:border-amber-500/40 rounded-xl backdrop-blur-sm shadow-[0_0_20px_rgba(245,158,11,0.05)] transition-all">
                        <div className="text-left min-w-0 pr-4">
                          <span className="font-mono text-[9px] text-amber-500 uppercase tracking-widest font-bold">Style No. 03</span>
                          <h4 className="font-serif font-bold text-stone-100 text-sm md:text-base">Base Cider - Semi-Sweet (Red Label)</h4>
                          <p className="text-stone-300 font-serif text-xs leading-snug mt-1">Juicy and aromatic, emphasizing ripe table orchard flavors with a highly refreshing, clean finish.</p>
                        </div>
                        <div className="flex items-center gap-2 border border-amber-500/30 bg-stone-950 p-1.5 rounded-lg shrink-0">
                          <button 
                            onClick={() => setBaseSemiSweetQty(q => Math.max(0, q - 1))}
                            className="w-7 h-7 rounded flex items-center justify-center font-mono text-stone-300 hover:text-amber-500 hover:bg-stone-900 transition-colors cursor-pointer"
                          >
                            -
                          </button>
                          <span className="w-7 text-center text-xs font-mono text-stone-100 font-bold">{baseSemiSweetQty}</span>
                          <button 
                            onClick={() => setBaseSemiSweetQty(q => q + 1)}
                            className="w-7 h-7 rounded flex items-center justify-center font-mono text-stone-300 hover:text-amber-500 hover:bg-stone-900 transition-colors cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Pricing dynamic calculation box */}
                    <div className="border border-amber-500/30 bg-stone-950/80 p-5 rounded-xl space-y-3 font-sans text-xs shadow-[0_0_30px_rgba(245,158,11,0.06)]">
                      <div className="flex justify-between items-center">
                        <span className="text-stone-400 uppercase tracking-wider text-[10px] font-bold">Pricing Model</span>
                        <span className="font-mono text-amber-500 text-[10px] font-semibold">$6.50 Single | $30 / 6-pack ($5.00/ea after)</span>
                      </div>

                      <div className="flex justify-between items-center text-stone-300 font-mono text-xs pt-2 border-t border-stone-800/80">
                        <span>Total Bottles:</span>
                        <span className="font-bold text-stone-100">{totalBaseQty}</span>
                      </div>

                      <div className="flex justify-between items-center text-stone-300 font-mono text-xs">
                        <span>Unit Bottle Price:</span>
                        <span className={`font-bold ${totalBaseQty >= 6 ? 'text-emerald-400' : 'text-stone-100'}`}>
                          ${baseCiderPrice.toFixed(2)}
                        </span>
                      </div>

                      {totalBaseQty > 0 && totalBaseQty < 6 && (
                        <p className="bg-amber-500/10 text-amber-400 text-[11px] leading-snug p-3 rounded-lg border border-amber-500/20 italic text-left font-serif">
                          <strong>Half-Case Rate</strong>: Add <strong>{6 - totalBaseQty} more bottle{6 - totalBaseQty > 1 ? 's' : ''}</strong> from any styles to unlock the volume pricing of <strong>$5.00 per bottle</strong> ($30 total for 6).
                        </p>
                      )}

                      {totalBaseQty >= 6 && (
                        <p className="bg-emerald-500/10 text-emerald-300 text-[11px] leading-snug p-3 rounded-lg border border-emerald-500/20 italic text-left font-serif">
                          <strong>Half-Case Volume Pricing Applied</strong>: You have unlocked the rate of <strong>$5.00 per bottle</strong> on your entire base cider order.
                        </p>
                      )}

                      <div className="flex justify-between items-center text-sm pt-2 border-t border-stone-800/80">
                        <span className="text-stone-300 uppercase font-serif tracking-wider text-xs">Estimated Price</span>
                        <span className="text-amber-400 font-bold font-mono text-lg">${baseCiderSubtotal.toFixed(2)}</span>
                      </div>

                      <button 
                        onClick={handleAddBaseCidersToCart}
                        disabled={totalBaseQty === 0}
                        className="w-full py-4 border border-amber-500/40 text-amber-500 uppercase tracking-widest text-xs hover:bg-amber-500 hover:text-stone-950 hover:border-amber-400 transition-all rounded-lg font-sans font-black shadow-lg hover:shadow-amber-500/20 mt-2 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-amber-500 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Add Selected to Cart
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="merch-grid"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="max-w-7xl mx-auto px-6 md:px-12 py-6 relative"
          >
            {/* Merch Section Intro Text */}
            <div className="max-w-xl mx-auto text-center mb-12">
              <span className="font-mono text-[10px] text-amber-500 font-bold uppercase tracking-[0.25em] block mb-2">
                COLLECTOR'S WARES
              </span>
              <p className="text-stone-300 font-serif italic text-sm md:text-base border-b border-amber-500/20 pb-3">
                Curated Garments, Custom Blown Glass, and Organic Canvas Accents
              </p>
            </div>

            {/* Premium Archival Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {merch.map((product) => (
                <motion.div
                  key={product.id}
                  className="group flex flex-col h-full bg-gradient-to-br from-stone-950/80 via-stone-900/70 to-stone-950/80 border border-amber-500/30 hover:border-amber-500/60 backdrop-blur-md rounded-2xl overflow-hidden shadow-[0_15px_50px_rgba(0,0,0,0.8)] hover:shadow-[0_0_35px_rgba(245,158,11,0.15)] transition-all duration-500 cursor-pointer"
                  onClick={() => setSelectedProduct(product)}
                  whileHover={{ y: -6 }}
                >
                  {/* Photo Frame with subtle amber radial backdrop */}
                  <div className="relative overflow-hidden aspect-square bg-stone-950 flex items-center justify-center p-4 border-b border-amber-500/20">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.08)_0%,transparent_75%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                    
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover rounded-lg transition-transform duration-700 ease-out group-hover:scale-105"
                    />

                    {/* Quick View Tag Overlay */}
                    <div className="absolute bottom-3 left-3 right-3 py-2 px-3 bg-stone-950/90 backdrop-blur-md border border-amber-500/30 text-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 rounded-lg shadow-lg">
                      <span className="text-[10px] uppercase font-mono tracking-[0.2em] text-amber-400 font-bold">
                        View Specimen
                      </span>
                    </div>
                  </div>

                  {/* Card Info Details */}
                  <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-1.5">
                      <span className="text-amber-500 font-mono tracking-widest text-[10px] uppercase font-bold block">
                        {product.type}
                      </span>
                      <h3 className="text-stone-100 font-serif text-lg tracking-wide group-hover:text-amber-400 transition-colors">
                        {product.name}
                      </h3>
                    </div>

                    <div className="flex items-center justify-between border-t border-stone-800/80 pt-4">
                      <span className="text-stone-200 font-sans text-base font-bold">
                        ${product.price}
                      </span>
                      <span className="text-amber-500/80 text-[10px] uppercase font-mono tracking-widest group-hover:text-amber-400 transition-colors font-semibold">
                        In Stock &rarr;
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WHOLESALE NOTICE AND OFF-LICENCE FOOTER */}
      <div className="mt-20 text-center max-w-md mx-auto px-4 border-t border-stone-800/60 pt-10">
        <p className="text-stone-400 font-serif italic text-sm mb-3">Are you an established venue or boutique bottle shop?</p>
        <a 
          href="/wholesale" 
          className="inline-block px-6 py-2.5 border border-amber-500/40 text-amber-500 uppercase tracking-widest text-xs hover:bg-amber-500 hover:text-stone-950 rounded-lg font-sans font-bold transition-all shadow-md hover:shadow-amber-500/20"
        >
          Request Wholesale Alliance &rarr;
        </a>
      </div>

      {/* PRODUCT DIALOG (Exquisite design panel with glass effects) */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 font-serif">
            {/* Backdrop */}
            <motion.div 
              className="absolute inset-0 bg-black/85 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
            />
            
            {/* Modal Content */}
            <motion.div 
              className="relative z-10 flex flex-col md:flex-row bg-gradient-to-br from-stone-950/95 via-stone-900/90 to-stone-950/95 backdrop-blur-xl border border-amber-500/30 rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.9)] overflow-hidden max-w-4xl w-full"
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
            >
              <button 
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 right-4 z-20 text-stone-400 hover:text-amber-400 transition-colors p-1.5 rounded-full bg-stone-950/60 border border-stone-800 hover:border-amber-500/40 cursor-pointer"
              >
                <X size={20} />
              </button>

              {/* Product Media Presenter */}
              <div className="w-full md:w-1/2 p-6 md:p-10 flex items-center justify-center bg-stone-950/70 border-b md:border-b-0 md:border-r border-amber-500/20 relative">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.06)_0%,transparent_70%)] pointer-events-none" />
                <motion.img 
                  src={selectedProduct.image} 
                  alt={selectedProduct.name}
                  className={`max-h-[300px] md:max-h-[400px] object-contain relative z-10 ${
                    selectedProduct.category === 'merch' 
                      ? 'rounded-xl border border-amber-500/20 drop-shadow-[0_10px_25px_rgba(0,0,0,0.6)]' 
                      : 'drop-shadow-[0_20px_40px_rgba(0,0,0,0.95)]'
                  }`}
                  initial={{ scale: 0.9, rotate: -2 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.1, type: "spring" }}
                />
              </div>

              {/* Product Information specs */}
              <div className="w-full md:w-1/2 p-8 md:p-10 flex flex-col justify-center space-y-6 bg-stone-950/80">
                <div className="space-y-2">
                  <span className="text-amber-500 font-mono tracking-[0.25em] text-[10px] uppercase font-bold block">
                    {selectedProduct.type}
                  </span>
                  <h2 className="text-2xl md:text-3xl text-stone-100 uppercase tracking-widest font-serif font-light">
                    {selectedProduct.name}
                  </h2>
                </div>
                
                <p className="text-stone-300 text-sm md:text-base leading-relaxed border-t border-b border-amber-500/20 py-4 font-serif text-left">
                  {selectedProduct.description}
                </p>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between pt-2 gap-4">
                  <span className="text-3xl text-stone-100 font-bold tracking-wide font-sans">${selectedProduct.price}</span>
                  
                  {selectedProduct.available !== false && (selectedProduct.inventoryCount === undefined || selectedProduct.inventoryCount > 0) ? (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      {typeof selectedProduct.inventoryCount === 'number' && (
                        <span className="text-[11px] font-mono text-stone-400 self-center">
                          {selectedProduct.inventoryCount} in stock
                        </span>
                      )}
                      <button 
                        onClick={() => {
                          addItem({ ...selectedProduct, quantity: 1, price: Number(selectedProduct.price) });
                          setSelectedProduct(null);
                        }}
                        className="px-8 py-4 bg-amber-500 hover:bg-amber-400 text-stone-950 uppercase tracking-widest text-xs font-sans font-black transition-all rounded-lg shadow-lg hover:shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <ShoppingBag className="w-4 h-4 mr-1" /> Add to Cart
                      </button>
                    </div>
                  ) : (
                    <button disabled className="px-8 py-4 border border-stone-800 text-stone-500 uppercase tracking-widest font-sans text-xs rounded-lg cursor-not-allowed bg-stone-900/50">
                      SOLD OUT (Out of Stock)
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ORDER CONFIRMATION MODAL (Returns from Stripe Checkout) */}
      <AnimatePresence>
        {orderConfirmation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 font-serif">
            <motion.div 
              className="absolute inset-0 bg-black/85 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOrderConfirmation(null)}
            />

            <motion.div 
              className="relative z-10 bg-gradient-to-br from-stone-950 via-stone-900 to-stone-950 border border-emerald-500/40 rounded-2xl shadow-[0_25px_80px_rgba(0,0,0,0.95)] max-w-md w-full p-8 text-center space-y-6"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
            >
              <div className="w-16 h-16 bg-emerald-950/80 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto text-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.25)]">
                <CheckCircle size={36} />
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-[0.25em] block">
                  Payment Verified via Stripe
                </span>
                <h3 className="text-2xl text-stone-100 font-serif font-light uppercase tracking-wider">
                  Order Confirmed
                </h3>
                <p className="text-stone-300 font-sans text-xs leading-relaxed">
                  Thank you for your purchase! We have received your payment via Stripe device self-pay. Your order is registered and our Lincoln cellar team is packing your cider.
                </p>
              </div>

              <div className="bg-stone-950/70 border border-stone-800 rounded-xl p-4 text-left font-sans text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-stone-400">Order Reference:</span>
                  <span className="font-mono text-amber-400 font-bold">#{orderConfirmation.orderId}</span>
                </div>
                {orderConfirmation.customerEmail && (
                  <div className="flex justify-between">
                    <span className="text-stone-400">Receipt Sent to:</span>
                    <span className="text-stone-200 truncate max-w-[200px]">{orderConfirmation.customerEmail}</span>
                  </div>
                )}
                {orderConfirmation.totalAmount && (
                  <div className="flex justify-between border-t border-stone-800/80 pt-2">
                    <span className="text-stone-400 font-semibold">Total Paid:</span>
                    <span className="font-mono text-emerald-400 font-bold">${orderConfirmation.totalAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[11px] text-stone-400 pt-1">
                  <span>Status:</span>
                  <span className="text-emerald-400 font-mono font-bold uppercase">Paid & Active</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setOrderConfirmation(null)}
                  className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-sans font-bold uppercase tracking-widest text-xs rounded-lg transition-all shadow-lg hover:shadow-amber-500/20 cursor-pointer"
                >
                  Return to Cellar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
