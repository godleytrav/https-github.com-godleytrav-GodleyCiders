import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useCartStore } from '../store/cartStore';

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { toggleCart, items } = useCartStore();

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { name: 'Home', path: '/home' },
    { name: 'Story', path: '/story' },
    { name: 'Shop', path: '/shop' },
    { name: 'Live Label', path: '/live' },
    { name: 'Events', path: '/events' },
    { name: 'Club Members', path: '/club' },
    { name: 'Wholesale', path: '/wholesale' },
  ];

  return (
    <nav 
      className={cn(
        "fixed top-0 left-0 w-full z-50 transition-all duration-500 font-serif",
        scrolled ? "bg-stone-950/30 backdrop-blur-md py-3" : "bg-stone-950/95 backdrop-blur-xl border-b border-stone-800/40 py-5"
      )}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8 flex items-center justify-between">
        {/* Logo */}
        <Link to="/home" className="group relative">
          <span className="text-2xl tracking-[0.3em] text-amber-500 uppercase font-bold transition-all duration-500 group-hover:text-amber-400 group-hover:drop-shadow-[0_0_12px_rgba(245,158,11,0.5)]">
            Godley Ciders
          </span>
          <div className="absolute -inset-x-4 -inset-y-2 bg-amber-500/0 group-hover:bg-amber-500/5 rounded-lg blur-lg transition-all duration-700" />
        </Link>
        
        {/* Desktop Nav */}
        <div className="hidden md:flex items-center space-x-10">
          {navLinks.map((link) => (
            <Link 
              key={link.name} 
              to={link.path}
              className={cn(
                "relative text-stone-400 hover:text-stone-100 tracking-[0.15em] text-xs uppercase transition-all duration-500 py-2 group",
                location.pathname === link.path && "text-amber-500"
              )}
            >
              <span className="relative z-10">{link.name}</span>
              
              {/* LIQUID GLOW EFFECT */}
              <span className="absolute inset-x-0 -bottom-1 h-[1px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-700 ease-out" />
              <span className="absolute inset-0 bg-amber-500/5 filter blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-full scale-125" />
              
              {/* ACTIVE INDICATOR */}
              {location.pathname === link.path && (
                <motion.span 
                  layoutId="activeNav"
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-amber-500 rounded-full shadow-[0_0_12px_#f59e0b]"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </Link>
          ))}
          <button onClick={toggleCart} className="relative text-amber-500 hover:text-amber-400 transition-all duration-500 hover:scale-110 hover:rotate-3 cursor-pointer">
            <ShoppingBag size={20} />
            {totalItems > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-red-600 text-[9px] font-sans text-white w-4 h-4 rounded-full flex items-center justify-center shadow-lg">
                {totalItems}
              </span>
            )}
          </button>
        </div>

        {/* Mobile Toggle */}
        <div className="md:hidden flex items-center space-x-4">
          <button onClick={toggleCart} className="relative text-amber-500 active:scale-95 transition-transform cursor-pointer">
            <ShoppingBag size={20} />
            {totalItems > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-red-600 text-[9px] font-sans text-white w-4 h-4 rounded-full flex items-center justify-center shadow-lg">
                {totalItems}
              </span>
            )}
          </button>
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="text-stone-100 hover:text-amber-500 transition-colors"
          >
            {isOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className={cn(
        "fixed inset-0 bg-stone-950/85 backdrop-blur-xl z-40 transform transition-all duration-500 ease-in-out flex items-center justify-center p-4",
        isOpen ? "opacity-100 translate-x-0" : "opacity-0 translate-x-full pointer-events-none"
      )}>
        <button 
          onClick={() => setIsOpen(false)}
          className="absolute top-6 right-6 text-stone-400 hover:text-amber-500 transition-colors p-2 rounded-full hover:bg-stone-900"
        >
          <X size={28} />
        </button>

        {/* 50% Opacity Box for Elegant Legibility */}
        <div className="bg-stone-950/70 border border-amber-500/20 rounded-xl p-8 w-full max-w-sm flex flex-col items-center space-y-6 shadow-[0_15px_50px_rgba(0,0,0,0.8)] backdrop-blur-lg">
          <div className="text-center pb-4 border-b border-stone-900 w-full mb-2">
            <span className="text-[10px] text-amber-500 uppercase tracking-[0.3em] font-mono font-bold">Godley Ciders Menu</span>
          </div>
          {navLinks.map((link) => (
            <Link 
              key={link.name} 
              to={link.path}
              className={cn(
                "text-2xl text-stone-200 uppercase tracking-widest hover:text-amber-500 font-serif transition-colors duration-300 w-full text-center py-2.5 rounded-lg hover:bg-amber-500/5",
                location.pathname === link.path && "text-amber-500 bg-amber-500/5 font-semibold"
              )}
            >
              {link.name}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
