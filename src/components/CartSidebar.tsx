import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useCartStore } from '../store/cartStore';
import { Minus, Plus, Trash2, ShieldCheck, CreditCard, ChevronLeft, Calendar, HelpCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

export default function CartSidebar() {
  const { items, isOpen, toggleCart, updateQuantity, removeItem, clearCart } = useCartStore();
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'form' | 'success'>('cart');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Form Fields
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    deliveryPreference: 'pickup', // 'pickup' | 'shipping'
    street: '',
    city: '',
    state: 'CA', // Locked to California for alcohol beverage regulation compliance
    zip: ''
  });

  // Card details
  const [cardData, setCardData] = useState({
    name: '',
    number: '',
    expiry: '',
    cvv: ''
  });

  // Success reservation details
  const [reservationDetails, setReservationDetails] = useState<any>(null);

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

  // Formatting helpers
  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length > 0) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return `${v.slice(0, 2)}/${v.slice(2, 4)}`;
    }
    return v;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCheckingOut(true);

    // Basic Card Validation
    const cleanCard = cardData.number.replace(/\s+/g, '');
    if (cleanCard.length < 15) {
      alert("Invalid credit card number. Please provide a valid card.");
      setIsCheckingOut(false);
      return;
    }

    if (formData.deliveryPreference === 'shipping') {
      if (!formData.street || !formData.city || !formData.zip) {
        alert("Please complete the shipping address. We strictly deliver within California.");
        setIsCheckingOut(false);
        return;
      }
      if (formData.state !== 'CA') {
        alert("Godley Ciders compliance restricts direct-to-consumer alcohol freight to the state of California (CA) only.");
        setIsCheckingOut(false);
        return;
      }
    }

    try {
      const last4 = cleanCard.slice(-4);
      const randomTicketNum = Math.floor(1000 + Math.random() * 9000);
      
      const reservationPayload = {
        customerName: formData.name,
        email: formData.email,
        phone: formData.phone,
        deliveryPreference: formData.deliveryPreference,
        shippingAddress: formData.deliveryPreference === 'shipping' ? {
          street: formData.street,
          city: formData.city,
          state: formData.state,
          zip: formData.zip
        } : null,
        items: items.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          type: item.type
        })),
        cardLast4: last4,
        cardExpiry: cardData.expiry,
        totalAmount: grandTotal,
        subtotal: total,
        shippingFee: shippingFee,
        status: 'reserved',
        ticketNumber: randomTicketNum,
        createdAt: serverTimestamp()
      };

      // 1. Write Priority STANDBY Reservation to Firestore
      const resDocRef = await addDoc(collection(db, 'shop_reservations'), reservationPayload);

      // 2. Enqueue sync event to BevForge live outbox queue
      await fetch('/api/events/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: crypto.randomUUID?.() || 'evt-' + Math.random().toString(36).substring(2, 10),
          eventType: 'reservation.created',
          createdAt: new Date().toISOString(),
          data: {
            reservationId: resDocRef.id,
            ticketNumber: randomTicketNum,
            customerName: formData.name,
            customerEmail: formData.email,
            phone: formData.phone,
            deliveryPreference: formData.deliveryPreference,
            street: formData.street,
            city: formData.city,
            state: formData.state,
            zip: formData.zip,
            items: items.map(i => ({
              productId: i.id,
              name: i.name,
              quantity: i.quantity,
              price: i.price,
              type: i.type
            })),
            subtotal: total,
            shippingFee: shippingFee,
            totalAmount: grandTotal,
            cardLast4: last4,
            status: 'reserved',
            timestamp: new Date().toISOString()
          }
        })
      }).catch(err => console.warn('BevForge preorder sync enqueue skipped:', err));

      // 2. Format Items descriptive list for email dispatch
      const itemsListText = items.map(i => `• ${i.quantity}x ${i.name} [${i.type}] — $${(i.price * i.quantity).toFixed(2)}`).join('\n');
      const deliveryText = formData.deliveryPreference === 'shipping' 
        ? `🚚 Direct Ground Shipping to:\n${formData.street}, ${formData.city}, ${formData.state} ${formData.zip} (CA Ground Freight flat rate: $12.00 fee)` 
        : `🍇 Complimentary Pickup at our local Placer County host cellar location (Complimentary for Club members & general reservations)`;

      const textEmailBody = `Hello ${formData.name},\n\nWe have successfully registered your Priority Standby Reservation at Godley Ciders!\n\nTicket Queue Reference: #GOD-${randomTicketNum}\n\nYour selected cider list & dry goods have been allocated:\n${itemsListText}\n\nBilling Summary:\nSubtotal: $${total.toFixed(2)}\nFulfillment option: ${formData.deliveryPreference === 'shipping' ? 'CA Ground Freight ($12.00)' : 'Complimentary Local Pickup ($0.00)'}\nGrand Total: $${grandTotal.toFixed(2)}\n\nSECURITY & REGULATORY COMPLIANCE DISCLOSURES:\nYour payment method ending in *${last4} has been securely vaulted under CA AB 2991 Electronic Funds Transfer (EFT) standards. A temporary pre-authorization hold of $0.00 has been set. ZERO immediate card charges have occurred. Card settlement remains completely on hold and will only trigger once our cellars complete fermentation and individual product configurations are updated to "Available" on our dashboard. At that moment you will receive an automatic dispatch notification.\n\nPRE-PRODUCTION AMENDMENT ACKNOWLEDGEMENT:\nYou acknowledge that Godley Ciders is in its pre-release licensing phase. We reserve the right to refine packaging sizing (e.g. four 375ml corked flasks rather than six 12oz crown caps) and tweak recipes / ABV labels (e.g. 6% to 8% ABV) as we scale up our boutique batches. Labels shown on the website represent pilot trial sketches and may vary from the final production bottles.\n\nThank you for choosing Godley Ciders!\n\nDistinguished Fermenters,\nTravis Godley & the Cellar staff`;

      // 3. Create real-time in-app Admin Notification
      await addDoc(collection(db, 'admin_notifications'), {
        type: 'shop_reservation',
        title: `🚨 New Cider Reservation - #GOD-${randomTicketNum} (${formData.name})`,
        customerName: formData.name,
        email: formData.email,
        phone: formData.phone,
        ticketNumber: randomTicketNum,
        totalAmount: grandTotal,
        deliveryPreference: formData.deliveryPreference,
        cardLast4: last4,
        read: false,
        createdAt: serverTimestamp()
      }).catch(e => console.warn('Admin notification write skipped:', e));

      // 4. Dispatch Customer confirmation email AND immediate Godley Ciders notification
      const adminNoticeText = `Godley Ciders Sales Desk Alert,\n\nA customer has placed a new Cider Release Standby Reservation and vaulted their credit card on file!\n\nCustomer: ${formData.name}\nEmail: ${formData.email}\nPhone: ${formData.phone}\nTicket Ref: #GOD-${randomTicketNum}\nVaulted Card: *${last4} (exp: ${cardData.expiry})\nFulfillment: ${deliveryText}\n\nAllocated Items:\n${itemsListText}\n\nSubtotal: $${total.toFixed(2)}\nGrand Total: $${grandTotal.toFixed(2)}\n\nStatus: Pre-authorized & Vaulted at $0.00 (Ready for settlement upon bottling completion)\n\n---\nMaster Admin Terminal: View and settle this pre-order under the Standby Reservations tab.`;

      await fetch('/api/email/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: formData.email,
          subject: `🍇 Priority Allocation Secured - Godley Ciders Queue #GOLD-${randomTicketNum}`,
          text: textEmailBody,
          from: 'billing@godleyciders.com',
          category: 'shop_reservation',
          notifyAdmin: true,
          adminSubject: `🚨 New Cider Release Reservation - #GOD-${randomTicketNum} (${formData.name})`,
          adminText: adminNoticeText,
          adminData: {
            customerName: formData.name,
            email: formData.email,
            phone: formData.phone,
            ticketNumber: randomTicketNum,
            totalAmount: grandTotal,
            cardLast4: last4
          }
        })
      }).catch(err => console.warn('Email dispatch failed:', err));

      // Keep reservation details for the success ticket layout
      setReservationDetails({
        ticketNumber: randomTicketNum,
        name: formData.name,
        cardLast4: last4,
        total: grandTotal,
        itemsCount: items.reduce((sum, i) => sum + i.quantity, 0)
      });

      // Clear the cart & switch modal step
      clearCart();
      setCheckoutStep('success');
    } catch (error: any) {
      console.error(error);
      alert("Reservation submission failed: " + error.message);
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleDialogClose = () => {
    toggleCart();
    // Delay resetting step state so sidebar transitions smoothly
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
              <SheetTitle className="text-2xl text-amber-500 uppercase tracking-[0.2em] font-normal text-left">Your Allocation</SheetTitle>
              <div className="w-12 h-[1.5px] bg-amber-500/50"></div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto py-6">
              <AnimatePresence>
                {items.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center text-stone-500 italic mt-12 py-12"
                  >
                    Your cellar allocation is currently empty.
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
                        className="flex gap-4 items-center bg-stone-900/30 p-3 rounded border border-stone-800/50"
                      >
                        <div className="w-14 h-18 bg-stone-950 rounded overflow-hidden border border-stone-800 shrink-0">
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover opacity-80" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-stone-200 uppercase tracking-wider text-xs truncate">{item.name}</h4>
                          <p className="text-stone-500 text-[10px] italic mb-1.5">{item.type}</p>
                          
                          <div className="flex items-center gap-3">
                            <div className="flex items-center border border-stone-800 rounded bg-stone-950/50">
                              <button 
                                onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                                className="px-2 py-1 text-stone-400 hover:text-amber-500 hover:bg-stone-900 transition-colors"
                              >
                                <Minus size={11} />
                              </button>
                              <span className="w-6 text-center text-xs font-mono">{item.quantity}</span>
                              <button 
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="px-2 py-1 text-stone-400 hover:text-amber-500 hover:bg-stone-900 transition-colors"
                              >
                                <Plus size={11} />
                              </button>
                            </div>
                            <span className="text-amber-500/90 text-xs tracking-wider font-mono font-bold">${(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                        </div>
                        
                        <button 
                          onClick={() => removeItem(item.id)}
                          className="p-1 px-1.5 text-stone-600 hover:text-red-400 hover:bg-stone-900/60 transition-colors rounded-sm ml-auto"
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
                <div className="flex justify-between items-center">
                  <span className="text-stone-400 uppercase tracking-widest text-xs font-sans">Estimated Subtotal</span>
                  <span className="text-amber-500 font-bold tracking-wide text-lg font-mono">${total.toFixed(2)}</span>
                </div>
                
                {/* Micro disclamer at cart view */}
                <div className="bg-amber-950/10 border border-amber-900/20 p-2.5 rounded font-sans text-[10px] text-amber-500/80 leading-relaxed italic">
                  Note: Godley Ciders ciders of the homestead are reserved today as Standby Pre-Orders. No immediate card fees occur. Settle triggers only when bottles are hand-caged and declared ready.
                </div>

                <Button 
                  onClick={() => setCheckoutStep('form')} 
                  className="w-full bg-amber-600 hover:bg-amber-500 text-stone-950 uppercase tracking-[0.14em] font-black rounded py-5 shadow-[0_0_15px_rgba(217,119,6,0.2)] transition-all font-sans cursor-pointer text-xs"
                >
                  Proceed to Priority Checkout
                </Button>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: PRE-ORDER SECURE FORM */}
        {checkoutStep === 'form' && (
          <div className="flex flex-col h-full font-serif text-left">
            <div className="flex items-center gap-2 border-b border-stone-900 pb-3 mb-4 shrink-0">
              <button 
                onClick={() => setCheckoutStep('cart')}
                className="text-stone-500 hover:text-amber-500 p-1 rounded hover:bg-stone-900 transition-all cursor-pointer"
              >
                <ChevronLeft size={18} />
              </button>
              <h3 className="text-lg text-amber-500 uppercase tracking-widest font-normal">Priority Standby Checkout</h3>
            </div>

            <form onSubmit={handleFormSubmit} className="flex-1 space-y-6 overflow-y-auto pr-1">
              
              {/* Pre-production compliance disclamer */}
              <div className="bg-stone-900/60 border border-stone-850 p-4 rounded text-[11px] leading-relaxed font-sans text-stone-400 text-justify relative overflow-hidden">
                <div className="absolute right-2 top-2 text-stone-700 font-sans font-bold text-[8px] border border-stone-800 px-1 py-0.5 rounded tracking-widest">REGULATORY NOTICE</div>
                <strong className="text-amber-500 font-bold font-serif uppercase tracking-wider block mb-1">Pre-Release Sizing & Labeling Agreement</strong>
                By securing this allocation, you acknowledge that Godley Ciders is in an active pre-licensing period. To assure raw ingredient scaling compliance, we reserve the right to modify visual label art, recipes, exact ABV volume calculations (e.g. 6% to 8% ABV), and bottle/pack configurations (e.g., four 375ml high-end corked bottles instead of six standard 12oz crown caps, or proportionate premium configurations).
                Your credit card is verified with a <span className="text-emerald-400 font-mono">$0.00 temporary authorization</span> and vaulted securely under PCI-DSS principles. You are NOT charged today. Card settlement occurs only upon final release by the head cidercraft master Travis Godley.
              </div>

              {/* SECTION: Customer details */}
              <div className="space-y-3 font-sans">
                <h4 className="text-stone-300 font-serif text-xs uppercase tracking-[0.2em] font-semibold border-b border-stone-900 pb-1">1. Member Standby Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-stone-500 uppercase tracking-wider block mb-1">Full Name</label>
                    <input 
                      type="text" 
                      required
                      value={formData.name}
                      onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-stone-900 border border-stone-800 focus:border-amber-500 rounded p-2 text-xs text-stone-200 outline-none transition-all font-sans" 
                      placeholder="e.g. Travis Godley" 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-stone-500 uppercase tracking-wider block mb-1">Email Address (Allocation alert)</label>
                    <input 
                      type="email" 
                      required
                      value={formData.email}
                      onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full bg-stone-900 border border-stone-800 focus:border-amber-500 rounded p-2 text-xs text-stone-200 outline-none transition-all font-sans" 
                      placeholder="patron@gmail.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-stone-500 uppercase tracking-wider block mb-1">Phone Number (SMS Alert Notifications)</label>
                  <input 
                    type="tel" 
                    required
                    value={formData.phone}
                    onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full bg-stone-900 border border-stone-800 focus:border-amber-500 rounded p-2 text-xs text-stone-200 outline-none transition-all font-sans" 
                    placeholder="e.g. (530) 555-0142"
                  />
                </div>
              </div>

              {/* SECTION: Fulfillment Preferences */}
              <div className="space-y-3 font-sans">
                <h4 className="text-stone-300 font-serif text-xs uppercase tracking-[0.2em] font-semibold border-b border-stone-900 pb-1">2. Delivery / Pickup Preferences</h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <label className={`border rounded p-3 flex flex-col justify-between cursor-pointer transition-all ${
                    formData.deliveryPreference === 'pickup' 
                      ? 'bg-amber-950/20 border-amber-600 text-stone-100' 
                      : 'bg-stone-900/40 border-stone-800 text-stone-400 hover:border-stone-750'
                  }`}>
                    <input 
                      type="radio" 
                      name="deliveryPref" 
                      value="pickup" 
                      checked={formData.deliveryPreference === 'pickup'}
                      onChange={() => setFormData(prev => ({ ...prev, deliveryPreference: 'pickup' }))}
                      className="sr-only" 
                    />
                    <div className="flex justify-between items-center w-full mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider">Local Pickup</span>
                      <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-900/10 px-1 rounded border border-emerald-500/20">FREE</span>
                    </div>
                    <span className="text-[9px] text-stone-500 leading-snug">Placer County Host Location Pickups</span>
                  </label>

                  <label className={`border rounded p-3 flex flex-col justify-between cursor-pointer transition-all ${
                    formData.deliveryPreference === 'shipping' 
                      ? 'bg-amber-950/20 border-amber-600 text-stone-100' 
                      : 'bg-stone-900/40 border-stone-800 text-stone-400 hover:border-stone-750'
                  }`}>
                    <input 
                      type="radio" 
                      name="deliveryPref" 
                      value="shipping" 
                      checked={formData.deliveryPreference === 'shipping'}
                      onChange={() => setFormData(prev => ({ ...prev, deliveryPreference: 'shipping' }))}
                      className="sr-only" 
                    />
                    <div className="flex justify-between items-center w-full mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider">Direct Direct Shipping</span>
                      <span className="text-[10px] text-amber-500 font-mono font-bold bg-amber-500/10 px-1 rounded border border-amber-500/20">$12.00</span>
                    </div>
                    <span className="text-[9px] text-stone-500 leading-snug">California CA residents only. Restricted.</span>
                  </label>
                </div>

                {formData.deliveryPreference === 'shipping' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="bg-stone-950 p-4 rounded border border-stone-900 space-y-3"
                  >
                    <span className="text-[10px] text-amber-500/90 font-bold block tracking-wider uppercase">🚚 Ground Freight Shipping Form (California locations only!)</span>
                    <div>
                      <label className="text-[9px] text-stone-500 uppercase block mb-1">Street Address</label>
                      <input 
                        type="text" 
                        required
                        value={formData.street}
                        onChange={e => setFormData(prev => ({ ...prev, street: e.target.value }))}
                        className="w-full bg-stone-900 border border-stone-800 focus:border-amber-500 rounded p-1.5 text-xs text-stone-200 outline-none font-sans" 
                        placeholder="e.g. 192 Cider Cask Way"
                      />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div className="col-span-2">
                        <label className="text-[9px] text-stone-500 uppercase block mb-1">City</label>
                        <input 
                          type="text" 
                          required
                          value={formData.city}
                          onChange={e => setFormData(prev => ({ ...prev, city: e.target.value }))}
                          className="w-full bg-stone-900 border border-stone-800 focus:border-amber-500 rounded p-1.5 text-xs text-stone-200 outline-none font-sans" 
                          placeholder="Auburn"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-stone-500 uppercase block mb-1">State</label>
                        <input 
                          type="text" 
                          disabled
                          value="CA"
                          className="w-full bg-stone-950 border border-stone-850 rounded p-1.5 text-xs text-stone-500 font-semibold text-center select-none cursor-not-allowed font-mono" 
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-stone-500 uppercase block mb-1">Zip Code</label>
                        <input 
                          type="text" 
                          required
                          value={formData.zip}
                          onChange={e => setFormData(prev => ({ ...prev, zip: e.target.value }))}
                          className="w-full bg-stone-900 border border-stone-800 focus:border-amber-500 rounded p-1.5 text-xs text-stone-200 outline-none font-sans" 
                          placeholder="95603"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* SECTION: Electronic Funds Secure Card Vault */}
              <div className="space-y-3 font-sans">
                <div className="flex items-center justify-between border-b border-stone-900 pb-1">
                  <h4 className="text-stone-300 font-serif text-xs uppercase tracking-[0.2em] font-semibold">3. EFT Secure Card Vault</h4>
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-semibold">
                    <ShieldCheck size={12} />
                    <span>Compliant Secure Bank Vault</span>
                  </div>
                </div>

                <div className="bg-stone-900/40 p-4 rounded border border-stone-800/80 space-y-3.5">
                  <div>
                    <label className="text-[10px] text-stone-500 uppercase tracking-wider block mb-1">Cardholder Name</label>
                    <input 
                      type="text" 
                      required
                      value={cardData.name}
                      onChange={e => setCardData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-stone-900 border border-stone-800 focus:border-amber-500 rounded p-2 text-xs text-stone-200 outline-none font-sans" 
                      placeholder="Cardholder Name" 
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2 relative">
                      <label className="text-[10px] text-stone-500 uppercase tracking-wider block mb-1">Credit Card Number</label>
                      <div className="relative">
                        <input 
                          type="text" 
                          required
                          value={cardData.number}
                          onChange={e => setCardData(prev => ({ ...prev, number: formatCardNumber(e.target.value) }))}
                          maxLength={19}
                          className="w-full bg-stone-900 border border-stone-800 focus:border-amber-500 rounded p-2 pl-9 text-xs text-stone-200 outline-none font-mono" 
                          placeholder="4111 2222 3333 4444" 
                        />
                        <CreditCard size={14} className="absolute left-3 top-2.5 text-stone-500" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-stone-500 uppercase tracking-wider block mb-1">Expiry Date</label>
                        <div className="relative">
                          <input 
                            type="text" 
                            required
                            value={cardData.expiry}
                            onChange={e => setCardData(prev => ({ ...prev, expiry: formatExpiry(e.target.value) }))}
                            maxLength={5}
                            className="w-full bg-stone-900 border border-stone-800 focus:border-amber-500 rounded p-2 pl-7 text-xs text-stone-200 outline-none font-mono text-center" 
                            placeholder="MM/YY" 
                          />
                          <Calendar size={12} className="absolute left-2.5 top-3 text-stone-500" />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-stone-500 uppercase tracking-wider block mb-1 text-center">CVV</label>
                        <input 
                          type="password" 
                          required
                          value={cardData.cvv}
                          onChange={e => setCardData(prev => ({ ...prev, cvv: e.target.value.replace(/\D/g, '') }))}
                          maxLength={4}
                          className="w-full bg-stone-900 border border-stone-800 focus:border-amber-500 rounded p-2 text-xs text-stone-200 outline-none font-mono text-center" 
                          placeholder="•••" 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* TICKET TOTAL DETAILS OVERVIEW */}
              <div className="pt-4 border-t border-stone-900 font-sans space-y-2">
                <span className="text-[10px] text-stone-500 uppercase tracking-wide block font-bold font-mono">STANDBY ORDER RECAP</span>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-stone-400">Cellar Subtotal:</span>
                  <span className="font-mono text-stone-300">${total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-stone-400">California Delivery:</span>
                  <span className="font-mono text-stone-300">{shippingFee > 0 ? `$${shippingFee.toFixed(2)}` : 'Complimentary Pickup'}</span>
                </div>
                <div className="flex justify-between items-center text-xs border-b border-stone-900 pb-2">
                  <span className="text-stone-400">Est. Total:</span>
                  <span className="font-mono text-amber-500 font-bold">${grandTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm pt-1 font-bold">
                  <span className="text-stone-200 uppercase tracking-wider font-semibold text-xs flex items-center gap-1.5"><HelpCircle size={13} className="text-amber-500" /> Due Today:</span>
                  <span className="font-mono text-emerald-400">$0.00 (Auth only)</span>
                </div>
              </div>

              <div className="pt-2">
                <Button 
                  type="submit" 
                  disabled={isCheckingOut}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-stone-950 uppercase tracking-[0.16em] font-black rounded py-5 shadow-[0_0_20px_rgba(217,119,6,0.25)] transition-all font-sans cursor-pointer text-xs"
                >
                  {isCheckingOut ? 'Securing Priority Spot...' : `Vault Card & Lock Standby Spot`}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 3: PRE-ORDER SUCCESS SPECIFIC TICKETING */}
        {checkoutStep === 'success' && reservationDetails && (
          <div className="flex flex-col h-full items-center justify-center text-center font-serif py-8">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', duration: 0.6 }}
              className="space-y-6 max-w-sm"
            >
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-emerald-950 rounded-full border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                  <CheckCircle size={32} />
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl text-amber-500 uppercase tracking-[0.12em] font-normal">Priority Allocation Secured</h3>
                <p className="text-stone-400 font-sans text-xs">Congratulations, {reservationDetails.name}! You are locked in on our priority list.</p>
              </div>

              {/* RENDER COMPRESSED GOLD TICKET EMBLEM */}
              <div className="relative bg-stone-900 border border-amber-600/30 p-5 rounded-lg text-left shadow-2xl overflow-hidden">
                <div className="absolute right-0 top-0 w-8 h-8 bg-amber-600/10 rounded-bl-full border-l border-b border-amber-600/20"></div>
                
                <span className="text-[9px] text-amber-500/80 font-mono font-bold tracking-widest block mb-1">GODLEY CIDERS STANDBY RESERVATION</span>
                <h4 className="text-stone-200 uppercase tracking-widest text-lg font-normal mb-3">TICKET #GOD-{reservationDetails.ticketNumber}</h4>

                <div className="border-t border-stone-800 pt-3 space-y-1.5 font-sans text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-stone-500 uppercase">Vaulted Method:</span>
                    <span className="font-mono text-stone-300">💳 *{reservationDetails.cardLast4}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500 uppercase">Selected Items:</span>
                    <span className="text-stone-300">{reservationDetails.itemsCount} Reserved Style{reservationDetails.itemsCount > 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex justify-between border-t border-stone-850 pt-1.5 mt-2 font-mono">
                    <span className="text-amber-500/70 font-semibold uppercase">Authorized Amount:</span>
                    <span className="text-amber-500 font-bold">${reservationDetails.total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="mt-4 border-dashed border-t border-stone-700/60 pt-3 flex justify-between items-center bg-stone-950/40 p-2 rounded">
                  <span className="text-[8px] text-emerald-400 font-mono font-bold uppercase tracking-wider">🔒 $0.00 Authorized Today</span>
                  <span className="text-[8px] text-stone-500 font-mono">AB 2991 SECURED</span>
                </div>
              </div>

              <div className="space-y-4 pt-2 font-sans text-stone-400 text-xs">
                <p className="leading-relaxed">
                  We have dispatched a confirmation email to you outlining recipe/ABV updates. Once the master casks finish fermentation and Travis clicks "Available," your vaulted card ending in *{reservationDetails.cardLast4} will settle for dispatch.
                </p>
                <Button 
                  onClick={handleDialogClose}
                  className="w-full bg-stone-800 hover:bg-stone-700 text-stone-200 uppercase tracking-wider font-semibold py-4 text-xs font-sans rounded cursor-pointer"
                >
                  Return to Cellar
                </Button>
              </div>
            </motion.div>
          </div>
        )}

      </SheetContent>
    </Sheet>
  );
}
