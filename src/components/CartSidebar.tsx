import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useCartStore } from '../store/cartStore';
import { Minus, Plus, Trash2, ShieldCheck, ChevronLeft, MapPin, Truck, Smartphone, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { auth } from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

export default function CartSidebar() {
  const { items, isOpen, toggleCart, updateQuantity, removeItem } = useCartStore();
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'details'>('cart');
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Form Fields for delivery and contact
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    deliveryPreference: 'pickup' as 'pickup' | 'shipping',
    street: '',
    city: '',
    state: 'CA', // California Direct-to-Consumer Alcohol Compliance
    zip: ''
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        setFormData(prev => ({
          ...prev,
          name: user.displayName || prev.name,
          email: user.email || prev.email
        }));
      }
    });
    return unsub;
  }, []);

  const total = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const shippingFee = formData.deliveryPreference === 'shipping' ? 12.00 : 0.00;
  const grandTotal = total + shippingFee;

  const handleProceedToStripe = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert("Please provide your name for order receipt and fulfillment.");
      return;
    }

    if (!formData.email.trim() || !formData.email.includes('@')) {
      alert("Please provide a valid email address to receive your order receipt and tracking.");
      return;
    }

    if (formData.deliveryPreference === 'shipping') {
      if (!formData.street.trim() || !formData.city.trim() || !formData.zip.trim()) {
        alert("Please complete your delivery address. We deliver direct-to-consumer anywhere within California.");
        return;
      }
      if (formData.state !== 'CA') {
        alert("California ABC regulations permit direct alcohol shipments exclusively within California (CA).");
        return;
      }
    }

    setIsRedirecting(true);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            type: item.type
          })),
          shippingFee,
          customerEmail: formData.email.trim(),
          customerName: formData.name.trim(),
          metadata: {
            type: 'shop_cart_order',
            customerName: formData.name.trim(),
            customerEmail: formData.email.trim(),
            phone: formData.phone.trim(),
            deliveryPreference: formData.deliveryPreference,
            shippingAddress: formData.deliveryPreference === 'shipping' ? JSON.stringify({
              street: formData.street.trim(),
              city: formData.city.trim(),
              state: formData.state,
              zip: formData.zip.trim()
            }) : null,
            itemsJson: JSON.stringify(items.map(item => ({
              id: item.id,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              type: item.type
            })))
          }
        })
      });

      const data = await response.json();

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Failed to initialize secure Stripe checkout session.");
      }

      // Redirect user to Stripe's hosted checkout (Apple Pay / Google Pay / Card)
      window.location.href = data.url;
    } catch (error: any) {
      console.error("Stripe Checkout Error:", error);
      alert(error.message || "Failed to initiate payment. Please try again or verify Stripe settings.");
      setIsRedirecting(false);
    }
  };

  const handleDialogClose = () => {
    toggleCart();
    setTimeout(() => {
      setCheckoutStep('cart');
    }, 300);
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleDialogClose}>
      <SheetContent className="bg-stone-950/98 backdrop-blur-2xl border-l border-amber-950/40 text-stone-200 w-full sm:max-w-xl font-serif flex flex-col p-6 overflow-y-auto">
        
        {/* STEP 1: CART OVERVIEW */}
        {checkoutStep === 'cart' && (
          <div className="flex flex-col h-full">
            <SheetHeader className="pb-4 border-b border-stone-900">
              <SheetTitle className="text-2xl text-amber-500 uppercase tracking-[0.2em] font-normal text-left">
                Your Cellar Cart
              </SheetTitle>
              <div className="w-12 h-[1.5px] bg-amber-500/50" />
            </SheetHeader>

            <div className="flex-1 overflow-y-auto py-6">
              <AnimatePresence>
                {items.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center text-stone-500 italic mt-12 py-12"
                  >
                    Your cellar cart is currently empty.
                  </motion.div>
                ) : (
                  <div className="space-y-4">
                    {items.map((item) => (
                      <motion.div
                        layout
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -15 }}
                        key={item.id}
                        className="flex gap-4 items-center bg-stone-900/40 p-3 rounded-xl border border-stone-800/60 shadow-sm"
                      >
                        <div className="w-14 h-18 bg-stone-950 rounded-lg overflow-hidden border border-stone-800 shrink-0">
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover opacity-90" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-stone-200 uppercase tracking-wider text-xs truncate font-bold font-serif">{item.name}</h4>
                          <p className="text-stone-400 text-[10px] font-sans mb-1.5">{item.type || 'Cellar Stock'}</p>
                          
                          <div className="flex items-center gap-3">
                            <div className="flex items-center border border-amber-500/30 rounded bg-stone-950/80">
                              <button 
                                onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                                className="px-2 py-1 text-stone-300 hover:text-amber-400 hover:bg-stone-900 transition-colors cursor-pointer"
                                aria-label="Decrease quantity"
                              >
                                <Minus size={11} />
                              </button>
                              <span className="w-6 text-center text-xs font-mono font-bold text-stone-100">{item.quantity}</span>
                              <button 
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="px-2 py-1 text-stone-300 hover:text-amber-400 hover:bg-stone-900 transition-colors cursor-pointer"
                                aria-label="Increase quantity"
                              >
                                <Plus size={11} />
                              </button>
                            </div>
                            <span className="text-amber-400 text-xs tracking-wider font-mono font-bold">
                              ${(item.price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        </div>
                        
                        <button 
                          onClick={() => removeItem(item.id)}
                          className="p-1 px-1.5 text-stone-500 hover:text-red-400 hover:bg-stone-900/60 transition-colors rounded-sm ml-auto cursor-pointer"
                          aria-label="Remove item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </AnimatePresence>
            </div>

            {items.length > 0 && (
              <div className="pt-6 border-t border-stone-900 space-y-4 shrink-0">
                <div className="flex justify-between items-center font-sans">
                  <span className="text-stone-400 uppercase tracking-widest text-xs font-semibold">Subtotal</span>
                  <span className="text-amber-400 font-bold tracking-wide text-lg font-mono">${total.toFixed(2)}</span>
                </div>
                
                {/* Fast Payment Badges */}
                <div className="flex items-center justify-center gap-4 py-2 border-y border-stone-900/80 text-[11px] text-stone-400 font-sans">
                  <span className="flex items-center gap-1.5 text-amber-500/90 font-medium">
                    <Smartphone size={13} /> Apple Pay & Google Pay
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <ShieldCheck size={13} /> Stripe Secure
                  </span>
                </div>

                <Button 
                  onClick={() => setCheckoutStep('details')} 
                  className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 uppercase tracking-[0.14em] font-black rounded-lg py-5 shadow-[0_0_20px_rgba(245,158,11,0.25)] transition-all font-sans cursor-pointer text-xs"
                >
                  Proceed to Delivery & Payment &rarr;
                </Button>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: FULFILLMENT & STRIPE DIRECT CHECKOUT */}
        {checkoutStep === 'details' && (
          <div className="flex flex-col h-full font-serif text-left">
            <div className="flex items-center gap-2 border-b border-stone-900 pb-3 mb-4 shrink-0">
              <button 
                onClick={() => setCheckoutStep('cart')}
                className="text-stone-400 hover:text-amber-400 p-1 rounded hover:bg-stone-900 transition-all cursor-pointer"
                aria-label="Back to Cart"
              >
                <ChevronLeft size={18} />
              </button>
              <h3 className="text-lg text-amber-500 uppercase tracking-widest font-normal">
                Delivery & Payment
              </h3>
            </div>

            <form onSubmit={handleProceedToStripe} className="flex-1 space-y-6 overflow-y-auto pr-1">
              
              {/* SECTION 1: Contact Information */}
              <div className="space-y-3 font-sans">
                <h4 className="text-stone-300 font-serif text-xs uppercase tracking-[0.2em] font-semibold border-b border-stone-900 pb-1">
                  1. Contact Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-stone-400 uppercase tracking-wider block mb-1">
                      Full Name *
                    </label>
                    <input 
                      type="text" 
                      required
                      value={formData.name}
                      onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-stone-900/80 border border-stone-800 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-200 outline-none font-sans" 
                      placeholder="e.g. Jane Doe" 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-stone-400 uppercase tracking-wider block mb-1">
                      Email Address (Receipt & Tracking) *
                    </label>
                    <input 
                      type="email" 
                      required
                      value={formData.email}
                      onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full bg-stone-900/80 border border-stone-800 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-200 outline-none font-sans" 
                      placeholder="jane@example.com" 
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-stone-400 uppercase tracking-wider block mb-1">
                    Phone Number (Fulfillment / Dispatch updates)
                  </label>
                  <input 
                    type="tel" 
                    value={formData.phone}
                    onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full bg-stone-900/80 border border-stone-800 focus:border-amber-500 rounded-lg p-2.5 text-xs text-stone-200 outline-none font-sans" 
                    placeholder="(530) 555-0199" 
                  />
                </div>
              </div>

              {/* SECTION 2: Fulfillment Preference */}
              <div className="space-y-3 font-sans">
                <h4 className="text-stone-300 font-serif text-xs uppercase tracking-[0.2em] font-semibold border-b border-stone-900 pb-1">
                  2. Fulfillment Preference
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label 
                    onClick={() => setFormData(prev => ({ ...prev, deliveryPreference: 'pickup' }))}
                    className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${
                      formData.deliveryPreference === 'pickup' 
                        ? 'border-amber-500/80 bg-amber-950/20 text-stone-100 shadow-[0_0_15px_rgba(245,158,11,0.1)]' 
                        : 'border-stone-850 bg-stone-900/30 text-stone-400 hover:border-stone-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-serif font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <MapPin size={13} className="text-amber-500" /> Cellar Pickup
                      </span>
                      <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase">Complimentary</span>
                    </div>
                    <span className="text-[11px] text-stone-400 leading-snug">
                      Pick up directly at our Lincoln orchard cellar in Placer County, CA.
                    </span>
                  </label>

                  <label 
                    onClick={() => setFormData(prev => ({ ...prev, deliveryPreference: 'shipping' }))}
                    className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${
                      formData.deliveryPreference === 'shipping' 
                        ? 'border-amber-500/80 bg-amber-950/20 text-stone-100 shadow-[0_0_15px_rgba(245,158,11,0.1)]' 
                        : 'border-stone-850 bg-stone-900/30 text-stone-400 hover:border-stone-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-serif font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Truck size={13} className="text-amber-500" /> California Delivery
                      </span>
                      <span className="text-[10px] font-mono font-bold text-amber-400">$12.00 Flat Rate</span>
                    </div>
                    <span className="text-[11px] text-stone-400 leading-snug">
                      Fast temperature-safe ground freight anywhere within California.
                    </span>
                  </label>
                </div>

                {formData.deliveryPreference === 'shipping' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-4 bg-stone-900/60 border border-amber-500/30 rounded-xl space-y-3 mt-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold">
                        California Delivery Address
                      </span>
                      <span className="text-[9px] text-emerald-400 font-mono font-semibold">CA ABC Compliant</span>
                    </div>

                    <div>
                      <label className="text-[9px] text-stone-400 uppercase block mb-1">Street Address *</label>
                      <input 
                        type="text" 
                        required={formData.deliveryPreference === 'shipping'}
                        value={formData.street}
                        onChange={e => setFormData(prev => ({ ...prev, street: e.target.value }))}
                        className="w-full bg-stone-900 border border-stone-800 focus:border-amber-500 rounded-lg p-2 text-xs text-stone-200 outline-none font-sans" 
                        placeholder="123 Cider Hill Way"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[9px] text-stone-400 uppercase block mb-1">City *</label>
                        <input 
                          type="text" 
                          required={formData.deliveryPreference === 'shipping'}
                          value={formData.city}
                          onChange={e => setFormData(prev => ({ ...prev, city: e.target.value }))}
                          className="w-full bg-stone-900 border border-stone-800 focus:border-amber-500 rounded-lg p-2 text-xs text-stone-200 outline-none font-sans" 
                          placeholder="Lincoln"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-stone-400 uppercase block mb-1">State</label>
                        <input 
                          type="text" 
                          readOnly 
                          value="CA"
                          className="w-full bg-stone-950 border border-stone-800/80 rounded-lg p-2 text-xs text-amber-400 outline-none font-mono text-center cursor-not-allowed font-bold" 
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-stone-400 uppercase block mb-1">Zip Code *</label>
                        <input 
                          type="text" 
                          required={formData.deliveryPreference === 'shipping'}
                          value={formData.zip}
                          onChange={e => setFormData(prev => ({ ...prev, zip: e.target.value }))}
                          className="w-full bg-stone-900 border border-stone-800 focus:border-amber-500 rounded-lg p-2 text-xs text-stone-200 outline-none font-sans" 
                          placeholder="95648"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* SECTION 3: Order Pricing Breakdown */}
              <div className="pt-4 border-t border-stone-900 font-sans space-y-2">
                <span className="text-[10px] text-stone-400 uppercase tracking-wider block font-bold font-mono">
                  Order Summary
                </span>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-stone-400">Products Subtotal:</span>
                  <span className="font-mono text-stone-200">${total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-stone-400">Fulfillment:</span>
                  <span className="font-mono text-stone-200">
                    {shippingFee > 0 ? `$${shippingFee.toFixed(2)} (CA Ground Freight)` : 'Complimentary Cellar Pickup'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm pt-2 border-t border-stone-800/80 font-bold">
                  <span className="text-stone-100 uppercase tracking-wider text-xs">Total Due Today:</span>
                  <span className="font-mono text-amber-400 text-base">${grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Method Notice (No card fields stored!) */}
              <div className="bg-stone-900/50 p-3.5 rounded-xl border border-stone-800/80 space-y-2 font-sans text-xs">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                  <ShieldCheck size={16} />
                  <span>Encrypted Device Payment via Stripe</span>
                </div>
                <p className="text-[11px] text-stone-400 leading-relaxed">
                  You will complete payment directly using <strong>Apple Pay</strong>, <strong>Google Pay</strong>, or credit card on Stripe’s encrypted checkout. Zero card numbers or sensitive credentials are ever held on our servers.
                </p>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <Button 
                  type="submit" 
                  disabled={isRedirecting}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 uppercase tracking-[0.16em] font-black rounded-lg py-5 shadow-[0_0_25px_rgba(245,158,11,0.25)] transition-all font-sans cursor-pointer text-xs flex items-center justify-center gap-2"
                >
                  {isRedirecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Connecting to Stripe Checkout...
                    </>
                  ) : (
                    `Pay with Apple Pay, Google Pay, or Card &rarr;`
                  )}
                </Button>
              </div>
            </form>
          </div>
        )}

      </SheetContent>
    </Sheet>
  );
}
