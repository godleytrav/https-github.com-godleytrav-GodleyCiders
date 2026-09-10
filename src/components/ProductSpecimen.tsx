import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAdminStore } from '../store/adminStore';
import { useCartStore } from '../store/cartStore';

export default function ProductSpecimen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { products, shopProducts } = useAdminStore();
  const { addItem } = useCartStore();
  const navigate = useNavigate();
  const [activeHp, setActiveHp] = useState<null | typeof products[0]['hotspots'][0]>(null);

  if (!products || products.length === 0) return null;

  const product = products[currentIndex];

  const handleSecureVintage = () => {
    // Attempt to match with shopProduct to pull price and proper description
    const matchedShopProduct = shopProducts.find(
      sp => sp.id === product.id || sp.name.toLowerCase() === product.name.toLowerCase()
    );

    if (matchedShopProduct) {
      addItem({
        id: matchedShopProduct.id,
        name: matchedShopProduct.name,
        price: matchedShopProduct.price,
        quantity: 1,
        image: matchedShopProduct.image,
        type: matchedShopProduct.type
      });
    } else {
      // Fallback add directly with a standard premium vintage price
      addItem({
        id: product.id,
        name: product.name,
        price: 24, // custom default price
        quantity: 1,
        image: product.imageUrl,
        type: "Reserve Vintage"
      });
    }
    // Redirect to the store/shop page instantly while the cart slider shows up
    navigate('/shop');
  };

  const nextProduct = () => {
    setActiveHp(null);
    setCurrentIndex((prev) => (prev + 1) % products.length);
  };

  const prevProduct = () => {
    setActiveHp(null);
    setCurrentIndex((prev) => (prev - 1 + products.length) % products.length);
  };


  return (
    <div className="relative w-full max-w-5xl mx-auto py-12 px-4">
      {/* Product Selector Header */}
      <div className="flex items-center justify-between mb-12">
        <button onClick={prevProduct} className="text-amber-500/50 hover:text-amber-500 transition-colors p-2">
          <ChevronLeft size={32} />
        </button>
        <div className="text-center">
          <motion.div
            key={product.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-xs uppercase tracking-[0.3em] text-amber-600 block mb-2">{product.vintage}</span>
            <h3 className="text-4xl font-serif text-stone-100">{product.name}</h3>
          </motion.div>
        </div>
        <button onClick={nextProduct} className="text-amber-500/50 hover:text-amber-500 transition-colors p-2">
          <ChevronRight size={32} />
        </button>
      </div>

      <div className="relative aspect-[4/5] md:aspect-square bg-gradient-to-br from-stone-950/75 via-stone-900/75 to-stone-950/75 backdrop-blur-md rounded-2xl overflow-hidden border border-amber-500/20 shadow-[0_15px_50px_rgba(0,0,0,0.8)] group">
        <AnimatePresence mode="wait">
          <motion.img
            key={product.id}
            src={product.imageUrl}
            alt={product.name}
            className="absolute inset-0 w-full h-full object-cover opacity-100 filter grayscale-[0.3] scale-100 transition-transform duration-[20s] group-hover:scale-110"
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 1 }}
          />
        </AnimatePresence>

        {/* Hotspots */}
        {product.hotspots.map((hp) => {
          const isActive = activeHp?.id === hp.id;
          return (
            <div
              key={hp.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
              style={{ left: `${hp.x}%`, top: `${hp.y}%` }}
            >
              <button
                className="w-12 h-12 rounded-full cursor-pointer flex items-center justify-center focus:outline-none group sm:w-10 sm:h-10"
                onMouseEnter={() => setActiveHp(hp)}
                onMouseLeave={() => setActiveHp(null)}
                onClick={() => setActiveHp(hp)}
              >
                <div className={`w-3 h-3 rounded-full border-2 border-amber-400 transition-all duration-300 pointer-events-none sm:w-2 sm:h-2
                  ${isActive ? 'bg-amber-400 scale-150 shadow-[0_0_20px_#f59e0b]' : 'bg-amber-500/30 group-hover:bg-amber-400 group-hover:scale-150 group-hover:shadow-[0_0_20px_#f59e0b]'}`} 
                />
                <div className="absolute inset-0 rounded-full border border-amber-500/10 animate-pulse" />
              </button>

              {/* Dynamic Info Tooltip */}
              <AnimatePresence>
                {isActive && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-56 sm:w-48 bg-stone-950/95 border border-amber-500/30 p-4 rounded-lg backdrop-blur-xl z-20 shadow-[0_10px_30px_rgba(0,0,0,0.5)] pointer-events-none"
                  >
                    <h4 className="text-amber-500 uppercase tracking-widest text-[10px] mb-1 font-bold">{hp.title}</h4>
                    <p className="text-stone-300 text-xs font-serif italic leading-relaxed">{hp.description}</p>
                    {/* Tooltip Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-amber-500/30" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>

      <div className="mt-12 text-center">
        <p className="text-stone-200 max-w-xl mx-auto italic font-serif leading-relaxed text-base md:text-lg">
          {product.description}
        </p>
        <button 
          id="btn-secure-vintage"
          onClick={handleSecureVintage}
          className="mt-8 px-8 py-4 border border-amber-500/40 text-amber-500 uppercase tracking-widest text-xs hover:bg-amber-500 hover:text-stone-950 hover:border-amber-400 transition-all rounded-lg font-sans font-black cursor-pointer shadow-lg hover:shadow-amber-500/20"
        >
          Secure This Vintage
        </button>
      </div>
    </div>
  );
}
