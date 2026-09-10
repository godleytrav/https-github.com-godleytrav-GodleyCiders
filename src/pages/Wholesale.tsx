import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { db, handleFirestoreError, OperationType, auth } from '../firebase';
import { 
  collection, addDoc, serverTimestamp, query, where, 
  onSnapshot, doc, getDocs, orderBy, updateDoc 
} from 'firebase/firestore';
import { useAdminStore } from '../store/adminStore';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { 
  Building2, Shovel, ShieldCheck, Mail, Phone, ExternalLink, 
  Truck, FileText, CheckCircle2, DollarSign, Plus, Minus, AlertCircle, ShoppingCart, Printer,
  CreditCard, Clock, Lock, Unlock, Calendar
} from 'lucide-react';

export default function Wholesale() {
  const { wholesaleSettings, devBypassWholesale } = useAdminStore();
  const [formData, setFormData] = useState({
    businessName: '',
    contactName: '',
    email: '',
    phone: '',
    type: 'Restaurant',
    abcLicenseNumber: '',
    resaleLicenseNumber: '',
    taxId: '',
    address: '',
    billingAddress: '',
    billingAddressSame: true,
    website: '',
    estimatedVolume: '',
    message: ''
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Compliance files upload simulation states
  const [abcFile, setAbcFile] = useState<{ name: string; size: number; status: 'idle' | 'uploading' | 'scanning' | 'success' }>({ name: '', size: 0, status: 'idle' });
  const [resaleFile, setResaleFile] = useState<{ name: string; size: number; status: 'idle' | 'uploading' | 'scanning' | 'success' }>({ name: '', size: 0, status: 'idle' });
  
  const handleUploadSimulate = (type: 'abc' | 'resale', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const setFile = type === 'abc' ? setAbcFile : setResaleFile;
    setFile({ name: file.name, size: file.size, status: 'uploading' });

    setTimeout(() => {
      setFile(prev => ({ ...prev, status: 'scanning' }));
      setTimeout(() => {
        setFile(prev => ({ ...prev, status: 'success' }));
      }, 1000);
    }, 800);
  };

  
  // Real authentication & partner status state
  const [user, setUser] = useState<User | null>(null);
  const [partnerDoc, setPartnerDoc] = useState<any>(null);
  const [loadingPartnerStatus, setLoadingPartnerStatus] = useState(false);
  
  // Wholesale orders list (queried in real-time!)
  const [partnerOrders, setPartnerOrders] = useState<any[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [requestingNet30, setRequestingNet30] = useState(false);

  // Stripe commercial settlement state helpers
  const [settlingOrderId, setSettlingOrderId] = useState<string | null>(null);
  const [successSettleMsg, setSuccessSettleMsg] = useState('');
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutVal = params.get('checkout');
    const sessionId = params.get('session_id');

    if (checkoutVal === 'success' && sessionId) {
      setVerifyingPayment(true);
      fetch(`/api/checkout/session-status?session_id=${sessionId}`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 'paid') {
            setSuccessSettleMsg("Thank you! Your commercial card payment was successfully processed. Your invoice status is now updated to PAID.");
            // Remove search params from URL safely
            window.history.replaceState({}, document.title, window.location.pathname);
          } else {
            console.log("Invoice status verification response: ", data.status);
          }
        })
        .catch(err => {
          console.error("Verification error:", err);
        })
        .finally(() => {
          setVerifyingPayment(false);
        });
    }
  }, []);

  const handleSettleInvoiceOnline = async (id: string) => {
    try {
      setSettlingOrderId(id);
      const res = await fetch('/api/checkout/wholesale-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: id })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to create payment session.");
      }
    } catch (err) {
      console.error(err);
      alert("Error starting online settlement.");
    } finally {
      setSettlingOrderId(null);
    }
  };

  // Check past due orders of Net-30
  const pastDueOrders = partnerOrders.filter((order: any) => {
    if (order.status === 'overdue') return true;
    if (order.status !== 'unpaid') return false; 
    if (!order.createdAt) return false;

    const orderDate = order.createdAt?.toDate 
      ? order.createdAt.toDate() 
      : (order.createdAt ? new Date(order.createdAt) : null);
    if (!orderDate || isNaN(orderDate.getTime())) return false;
    
    const diffTime = Date.now() - orderDate.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays > 30;
  });
  const hasPastDue = pastDueOrders.length > 0;
  const net30Status = partnerDoc?.net30Status || 'none'; 
  const isOrderingDisabled = hasPastDue || (net30Status !== 'approved' && !devBypassWholesale);

  const handleRequestNet30 = async () => {
    if (!partnerDoc || !user) return;
    setRequestingNet30(true);
    try {
      const docRef = doc(db, 'wholesale_inquiries', partnerDoc.id);
      await updateDoc(docRef, {
        net30Status: 'requested',
        net30RequestedAt: serverTimestamp()
      });
      await fetch('/api/events/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: 'evt-' + Math.random().toString(36).substring(2, 10),
          eventType: 'wholesale.net30_requested',
          createdAt: new Date().toISOString(),
          data: {
            businessName: partnerDoc.businessName,
            email: user?.email,
            timestamp: new Date().toISOString()
          }
        })
      }).catch(err => console.warn(err));
      alert("Your NET-30 Terms Credit application was successfully submitted!");
    } catch (err: any) {
      console.error(err);
      alert(`Failed to request Net-30 credit lines: ${err.message}`);
    } finally {
      setRequestingNet30(false);
    }
  };

  // Bulk Ordering Cart state
  const [bulkCart, setBulkCart] = useState<Record<string, number>>({
    'keg-dry': 0,
    'keg-hop': 0,
    'case-dry': 0,
    'case-hop': 0
  });
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderSuccessMsg, setOrderSuccessMsg] = useState('');

  // Bulk Product Catalog
  const wholesaleProducts = [
    { id: 'keg-dry', name: 'Godley Dry Cider (Sixtel 5.16 Gal Keg)', price: 110.00, formattedType: 'Draft Sixtel' },
    { id: 'keg-hop', name: 'Placer County Hopped (Sixtel 5.16 Gal Keg)', price: 115.00, formattedType: 'Draft Sixtel' },
    { id: 'case-dry', name: 'Godley Golden Dry (24pk Case - 12oz Cans)', price: 48.00, formattedType: 'Case Goods' },
    { id: 'case-hop', name: 'Placer County Hopped (24pk Case - 12oz Cans)', price: 52.00, formattedType: 'Case Goods' }
  ];

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
      if (u) {
        setFormData(prev => ({
          ...prev,
          contactName: u.displayName || prev.contactName,
          email: u.email || prev.email
        }));
      }
    });
    return unsub;
  }, []);

  // Sync real-time distributor verification from Firestore
  useEffect(() => {
    if (!user) {
      setPartnerDoc(null);
      setPartnerOrders([]);
      return;
    }

    setLoadingPartnerStatus(true);
    const qInq = query(collection(db, 'wholesale_inquiries'), where('email', '==', user.email));
    const unsubInq = onSnapshot(qInq, (snapshot) => {
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        setPartnerDoc({ id: docSnap.id, ...docSnap.data() });
      } else {
        setPartnerDoc(null);
      }
      setLoadingPartnerStatus(false);
    }, (err) => {
      console.error(err);
      setLoadingPartnerStatus(false);
    });

    // Subscribe to past orders placed by this wholesale partner
    const qOrders = query(
      collection(db, 'orders'), 
      where('customerEmail', '==', user.email),
      orderBy('createdAt', 'desc')
    );
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      setPartnerOrders(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter((o: any) => o.source === 'wholesale'));
    }, (err) => {
      console.error("Failed to load historical partner orders:", err);
    });

    return () => {
      unsubInq();
      unsubOrders();
    };
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e: any) {
      console.error(e);
      if (e.message?.includes('unauthorized-domain') || e.code === 'auth/unauthorized-domain') {
        alert(
          `Firebase: Unauthorized Domain (${window.location.hostname}).\n\nThis means the domain is not authorized in the Firebase console. Please make sure to run "npm run build" on GoDaddy to ensure latest Firebase configuration is fully compiled, and allow 10-15 minutes for propagation.`
        );
      } else {
        alert(e.message || "Login failed");
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, 'wholesale_inquiries'), {
        ...formData,
        billingAddress: formData.billingAddressSame ? formData.address : formData.billingAddress,
        status: 'pending', // Starts in pending review
        abcLicenseFile: abcFile.status === 'success' ? abcFile : { name: 'abc_type21_compliance_stub.pdf', size: 142400, status: 'success' },
        resaleLicenseFile: resaleFile.status === 'success' ? resaleFile : { name: 'ca_resale_permit_cert.pdf', size: 210100, status: 'success' },
        createdAt: serverTimestamp()
      });

      // Enqueue sync event to BevForge live outbox to fire off confirmation emails
      await fetch('/api/events/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: crypto.randomUUID?.() || 'evt-' + Math.random().toString(36).substring(2, 10),
          eventType: 'wholesale.inquiry_submitted',
          createdAt: new Date().toISOString(),
          data: {
            inquiryId: docRef.id,
            businessName: formData.businessName,
            contactName: formData.contactName,
            email: formData.email,
            type: formData.type,
            timestamp: new Date().toISOString()
          }
        })
      }).catch(err => {
        console.warn("Failed to enqueue wholesale inquiry event:", err);
      });

      // Dispatch Email Confirmation
      await fetch('/api/email/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: formData.email,
          from: 'billing@godleyciders.com',
          subject: 'Godley Ciders - Wholesale Inquiry Received',
          text: `Hello ${formData.contactName},\n\nWe have received your wholesale inquiry for ${formData.businessName}. Our accounts team will review your ABC requirements and be in touch shortly to arrange a tasting and discuss allocations.\n\nCheers,\nGodley Ciders Team`
        })
      }).catch(err => console.warn('Email dispatch failed:', err));

      setSuccess(true);
      setFormData({ 
        businessName: '', contactName: '', email: '', phone: '', 
        type: 'Restaurant', abcLicenseNumber: '', resaleLicenseNumber: '', taxId: '',
        address: '', billingAddress: '', billingAddressSame: true, website: '',
        estimatedVolume: '', message: '' 
      });
      setAbcFile({ name: '', size: 0, status: 'idle' });
      setResaleFile({ name: '', size: 0, status: 'idle' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'wholesale_inquiries');
      alert('Failed to submit. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Adjust product quantity helper
  const updateQty = (id: string, delta: number) => {
    setBulkCart(prev => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) + delta)
    }));
  };

  // Bulk Purchase Order Placement
  const handlePlaceBulkOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerDoc || !user) return;

    // Filter items selection
    const itemsSelected = wholesaleProducts
      .filter(p => (bulkCart[p.id] || 0) > 0)
      .map(p => ({
        productId: p.id,
        sku: `WS-${p.id.toUpperCase()}`,
        name: p.name,
        quantity: bulkCart[p.id],
        unitPriceCents: p.price * 100
      }));

    if (itemsSelected.length === 0) {
      alert("Please add at least 1 keg or case to place a wholesale order.");
      return;
    }

    setPlacingOrder(true);
    setOrderSuccessMsg('');

    // Calculations
    const subtotal = itemsSelected.reduce((acc: number, item: any) => acc + (item.unitPriceCents * item.quantity), 0) / 100;
    const totalUnitsCount = itemsSelected.reduce((acc: number, item: any) => acc + item.quantity, 0);
    // Draft kegs/cases are tax exempt for wholesale reselling in CA with certified resale numbers
    const tax = 0; 
    // Free freight on orders with 4 or more total items
    const shipping = totalUnitsCount >= 4 ? 0 : 50; 
    const grandTotal = subtotal + tax + shipping;

    const finalOrder = {
      orderId: 'PO-' + Math.floor(100000 + Math.random() * 900000),
      source: 'wholesale',
      customerId: user.uid,
      customerName: partnerDoc.contactName,
      businessName: partnerDoc.businessName,
      customerEmail: user.email,
      items: itemsSelected,
      subtotalCents: Math.round(subtotal * 100),
      taxCents: Math.round(tax * 100),
      shippingCents: Math.round(shipping * 100),
      totalCents: Math.round(grandTotal * 100),
      currency: 'USD',
      status: 'unpaid', // Net-30 invoice term
      deliveryStatus: 'processing',
      abcLicense: partnerDoc.abcLicenseNumber,
      resaleNumber: partnerDoc.resaleLicenseNumber,
      createdAt: serverTimestamp(),
      paymentTerm: 'NET-30'
    };

    try {
      const orderRef = await addDoc(collection(db, 'orders'), finalOrder);

      // Decrement central inventory of matching core products
      try {
        const decrementItems = itemsSelected.map((item: any) => {
          const mappedId = (item.productId === 'keg-dry' || item.productId === 'case-dry') ? '1' : '2';
          return { id: mappedId, quantity: item.quantity };
        });
        await useAdminStore.getState().decrementInventory(decrementItems);
      } catch (inventoryErr) {
        console.warn("Failed to automatically decrement wholesale inventory:", inventoryErr);
      }

      // Enqueue sync event to BevForge live outbox
      await fetch('/api/events/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: 'evt-' + Math.random().toString(36).substring(2, 10),
          eventType: 'wholesale.order_placed',
          createdAt: new Date().toISOString(),
          data: {
            orderId: finalOrder.orderId,
            firebaseId: orderRef.id,
            businessName: finalOrder.businessName,
            totalCents: finalOrder.totalCents,
            term: finalOrder.paymentTerm
          }
        })
      }).catch(err => console.warn(err));

      // Dispatch Email PO confirmation
      await fetch('/api/email/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: user.email,
          from: 'billing@godleyciders.com',
          subject: `Purchase Order ${finalOrder.orderId} Confirmed - Godley Ciders`,
          text: `Hello ${partnerDoc.contactName},\n\nWe have successfully received Purchase Order ${finalOrder.orderId} for ${partnerDoc.businessName} on Net-30 terms.\n\nSubtotal: $${subtotal.toFixed(2)}\nShipping / Freight: $${shipping.toFixed(2)}\nTotal Invoice Due: $${grandTotal.toFixed(2)}\n\nOur cellars are packing your pallets now and checking compliance logs. You will receive tracking coordinates shortly.\n\nCheers,\nGodley Ciders wholesale`
        })
      }).catch(err => console.warn(err));

      setBulkCart({
        'keg-dry': 0,
        'keg-hop': 0,
        'case-dry': 0,
        'case-hop': 0
      });
      setOrderSuccessMsg(`Purchase Order ${finalOrder.orderId} successfully submitted on NET-30 terms. A confirmation invoice is en route to ${user.email}.`);
      setTimeout(() => setOrderSuccessMsg(''), 10000);

    } catch (err) {
      console.error(err);
      alert("Failed to submit Purchase Order. Please try again.");
    } finally {
      setPlacingOrder(false);
    }
  };

  const isApproved = partnerDoc?.status === 'approved' || devBypassWholesale;
  const isPending = partnerDoc && partnerDoc.status !== 'approved';
  const showDashboard = user && isApproved;

  // Calculate quick totals for bulk draft order
  const totalDraftUnits: number = Object.values(bulkCart).reduce((a: number, b: any) => a + (Number(b) || 0), 0) as number;
  const draftSubtotal = wholesaleProducts.reduce((sum, p) => sum + ((bulkCart[p.id] || 0) * p.price), 0);
  const draftEstFreight = totalDraftUnits === 0 ? 0 : (totalDraftUnits >= 4 ? 0 : 50);
  const draftGrandTotal = draftSubtotal + draftEstFreight;

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 font-serif relative">
      <div className="absolute top-4 right-6 z-10 flex gap-4 items-center">
        {user ? (
          <>
            <span className="text-[10px] text-stone-500 uppercase tracking-widest hidden sm:inline-block">Logged in: {user.email}</span>
            <button 
              onClick={handleLogout} 
              className="text-[10px] uppercase tracking-[0.2em] text-amber-500/70 hover:text-amber-500 border border-amber-500/20 px-3 py-1 bg-amber-500/5 backdrop-blur-sm transition-all rounded-sm"
            >
              Sign Out
            </button>
          </>
        ) : (
          <button 
            onClick={handleLogin} 
            className="group relative px-6 py-2 bg-stone-900/40 backdrop-blur-md border border-stone-800 rounded-sm overflow-hidden transition-all duration-500 hover:border-amber-500/50 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/5 to-amber-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            <span className="relative z-10 text-[10px] uppercase tracking-[0.3em] text-amber-500 font-medium group-hover:text-amber-400">
              Partner Sign In
            </span>
          </button>
        )}
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center space-y-6 mb-16"
      >
        <h1 className="text-4xl md:text-6xl text-amber-500 uppercase tracking-widest leading-tight whitespace-pre-line">{wholesaleSettings.title}</h1>
        <div className="w-24 h-[1px] bg-amber-500/50 mx-auto"></div>
        <p className="text-xl text-stone-400 italic max-w-2xl mx-auto whitespace-pre-line">
          {wholesaleSettings.subtitle}
        </p>
      </motion.div>

      {/* RENDER CHANNELS */}
      {user && isPending && (
        /* PENDING COMPLIANCE VERIFICATION */
        <div className="max-w-2xl mx-auto bg-stone-900/50 border border-stone-850 p-8 rounded-lg shadow-2xl relative">
          <div className="text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-amber-950/20 border border-amber-500/30 flex items-center justify-center rounded-full">
              <ShieldCheck size={28} className="text-amber-500 animate-pulse" />
            </div>
            <h3 className="text-2xl text-amber-500 uppercase tracking-widest">Compliance Review In Progress</h3>
            <p className="text-stone-300 text-sm font-sans leading-relaxed">
              We received your wholesale application for <strong className="text-stone-100">{partnerDoc.businessName}</strong>. Our accounts team is validating your regulatory filings against California ABC guidelines and resale tax declarations.
            </p>

            <div className="bg-stone-950/60 p-4 rounded text-left text-xs font-mono text-stone-400 space-y-2 border border-stone-850">
              <div className="flex justify-between"><span>Business:</span> <span className="text-stone-300">{partnerDoc.businessName}</span></div>
              <div className="flex justify-between"><span>ABC License:</span> <span className="text-stone-300 font-bold">{partnerDoc.abcLicenseNumber}</span></div>
              <div className="flex justify-between"><span>Sales Tax Certificate:</span> <span className="text-stone-300">{partnerDoc.resaleLicenseNumber}</span></div>
              <div className="flex justify-between"><span>Auth Email Account:</span> <span className="text-amber-500">{user.email}</span></div>
            </div>

            <p className="text-stone-500 text-[11px] font-sans">
              Our standard compliance verification takes 4 to 24 hours. Approved distributors will instantly unlock Net-30 purchase order placement and pallet freight coordination upon verification.
            </p>
          </div>
        </div>
      )}

      {showDashboard ? (
        /* REAL DISTRIBUTOR PALLET / BULK ORDER ENGINE */
        <div className="space-y-12">
          {/* VERIFYING PAYMENT / SUCCESS BANNER */}
          {verifyingPayment && (
            <div className="bg-amber-955/20 border border-amber-500/25 p-4 rounded text-xs flex items-center gap-3 animate-pulse">
              <Clock className="w-4 h-4 text-amber-500 animate-spin" />
              <p className="text-stone-300 font-sans">
                Querying Stripe for payment confirmations... Please stand by.
              </p>
            </div>
          )}

          {successSettleMsg && (
            <div className="bg-emerald-950/20 border border-emerald-500/30 p-4 rounded text-xs flex items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <p className="text-stone-200 font-sans font-medium">{successSettleMsg}</p>
              </div>
              <button 
                onClick={() => setSuccessSettleMsg('')} 
                className="text-[10px] text-stone-400 hover:text-stone-100 uppercase tracking-wider font-mono font-bold cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            {/* LEFT COLUMN: REAL-TIME BULK ORDER PLACEMENT CARD */}
            <div className="md:col-span-8 bg-stone-905/30 border border-stone-850 p-6 rounded-lg space-y-6">
              <div className="border-b border-stone-850 pb-3 flex justify-between items-center">
                <div>
                  <h3 className="text-stone-200 font-serif uppercase tracking-widest text-sm flex items-center gap-2">
                    <Building2 size={14} className="text-amber-500" />
                    Place Bulk Purchase Order
                  </h3>
                  <p className="text-stone-500 text-[10px] uppercase tracking-wider font-sans mt-0.5">NET-30 Terms Active upon Credit Approval</p>
                </div>
                <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/20 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase font-medium">
                  Tax Exempt
                </span>
              </div>

              {/* PAST DUE BALANCE LOCKOUT ALERT */}
              {hasPastDue && (
                <div id="past-due-lockout" className="bg-red-955/15 border border-red-500/35 p-5 rounded text-xs leading-relaxed space-y-3 font-sans animate-fadeIn">
                  <div className="flex items-center gap-2 text-red-500 font-bold uppercase tracking-widest text-[11px]">
                    <AlertCircle size={15} className="text-red-500 animate-pulse" />
                    Credit Account Payment Hold
                  </div>
                  <p className="text-stone-300">
                    Your wholesale ordering capability is <strong className="text-red-400">currently locked</strong> because your account has past due invoices outstanding. To comply with California ABC trade regulations and local warehouse credit allocations, <strong className="text-stone-100">you must settle all past due balances in full</strong> before putting down brand-new bulk purchase orders.
                  </p>
                  
                  <div className="border border-red-950/40 bg-stone-950/70 p-3 rounded space-y-1.5">
                    <span className="text-[9px] text-stone-500 uppercase tracking-wider font-bold block border-b border-stone-900 pb-1">Unpaid Past Due Invoices:</span>
                    <div className="divide-y divide-stone-900/60 max-h-40 overflow-y-auto">
                      {pastDueOrders.map((order: any, idx: number) => {
                        const dateStr = order.createdAt?.toDate 
                          ? order.createdAt.toDate().toLocaleDateString()
                          : (order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A');
                        return (
                          <div key={idx} className="flex justify-between items-center py-1.5 text-[11px] font-mono">
                            <div>
                              <strong className="text-stone-300">{order.orderId}</strong>
                              <span className="text-stone-500 text-[10px] ml-2">({dateStr})</span>
                            </div>
                            <div className="text-right">
                              <span className="text-red-400 font-bold font-mono">${(order.totalCents / 100).toFixed(2)}</span>
                              <span className="text-stone-500 text-[9px] uppercase ml-2">({order.status})</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  <p className="text-stone-300 text-[10px] leading-relaxed bg-stone-950/60 p-3 rounded border border-red-950/50 mt-2 font-mono">
                    <span className="text-red-400 font-bold block mb-1">State Compliance Note (CA AB 2991):</span>
                    Effective Jan 1, 2026, California Assembly Bill 2991 mandates that all wholesale alcohol delivery transactions be settled via <strong>Electronic Funds Transfer (EFT)</strong>. Paper checks, cash, and money orders are strictly prohibited. Settle your outstanding invoices securely via <strong>EFT / ACH Bank Transfer</strong> or <strong>Commercial Credit Card</strong> below to release shipping holds.
                  </p>
                </div>
              )}

              {/* NET-30 SPECIAL CREDIT TERMS APPLICATION CAROUSEL */}
              {net30Status !== 'approved' && !devBypassWholesale && (
                <div id="credit-status-required" className="bg-amber-955/10 border border-amber-500/25 p-5 rounded text-xs leading-relaxed space-y-3 font-sans">
                  <div className="flex items-center gap-2 text-amber-500 font-bold uppercase tracking-widest text-[11px]">
                    <Clock size={15} />
                    NET-30 Purchase Term Required
                  </div>
                  
                  {net30Status === 'requested' ? (
                    <div className="space-y-1.5">
                      <p className="text-stone-300">
                        Your credit terms status is currently <strong className="text-amber-500">Under Review</strong>. Godley Ciders terms desk is validating your business credit score and trade registry files.
                      </p>
                      <p className="text-stone-500 text-[11px] font-medium italic">
                        Standard commercial approval takes 24 to 48 hours. Wholesale checkout capabilities will activate automatically upon invoice credit clearance.
                      </p>
                    </div>
                  ) : net30Status === 'denied' ? (
                    <p className="text-stone-400 text-[11px]">
                      Your application for NET-30 distributor credit has been <strong className="text-red-400">denied or or temporarily suspended</strong>. Please reach out to <strong className="text-amber-500">partners@godleyciders.com</strong> regarding upfront alternative payments to handle wholesale shipments.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-stone-300">
                        Godley wholesale shipments utilize standard trade credit. Registered commercial partners must first apply for and be granted <strong className="text-amber-500">NET-30 Credit Terms</strong> before purchase orders are accepted.
                      </p>
                      <button
                        type="button"
                        onClick={handleRequestNet30}
                        disabled={requestingNet30}
                        className="w-full bg-amber-600/10 hover:bg-amber-600 hover:text-stone-950 font-bold text-amber-500 hover:border-transparent py-2.5 rounded border border-amber-600/30 transition-all text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {requestingNet30 ? 'Submitting Application...' : 'Apply for NET-30 Commercial Terms'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {orderSuccessMsg && (
                <div className="bg-emerald-950/30 border border-emerald-500/40 text-emerald-300 p-4 rounded text-xs leading-relaxed font-sans animate-fadeIn">
                  {orderSuccessMsg}
                </div>
              )}

              {/* GRID OF WHOLESALE STOCK ITEMS */}
              <form onSubmit={handlePlaceBulkOrder} className="space-y-6">
                <div className="space-y-4">
                  {wholesaleProducts.map((p) => {
                    const count = bulkCart[p.id] || 0;
                    return (
                      <div key={p.id} className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-stone-950/40 border border-stone-850/60 rounded transition-all ${isOrderingDisabled ? 'opacity-40 select-none' : ''}`}>
                        <div>
                          <span className="text-[9px] uppercase tracking-wider bg-stone-900 border border-stone-800 text-stone-500 px-1.5 py-0.5 rounded font-sans leading-none inline-block mb-1.5">
                            {p.formattedType}
                          </span>
                          <h4 className="text-stone-100 uppercase tracking-widest text-xs font-semibold">{p.name}</h4>
                          <p className="text-[10px] text-amber-500/60 font-mono mt-0.5">${p.price.toFixed(2)} / unit</p>
                        </div>

                        {/* COUNTER BUTTONS */}
                        <div className="flex items-center gap-3.5 mt-3 sm:mt-0">
                          <button 
                            type="button"
                            onClick={() => updateQty(p.id, -1)}
                            disabled={isOrderingDisabled}
                            className="w-7 h-7 bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-400 hover:text-stone-200 rounded flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Minus size={11} />
                          </button>
                          <span className="w-8 text-center text-xs text-stone-100 font-mono font-bold leading-none">{count}</span>
                          <button 
                            type="button"
                            onClick={() => updateQty(p.id, 1)}
                            disabled={isOrderingDisabled}
                            className="w-7 h-7 bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-400 hover:text-stone-200 rounded flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Plus size={11} />
                          </button>
                          <span className="w-16 text-right text-xs text-stone-400 font-mono font-semibold">${(count * p.price).toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* SUMS CALCULATORS */}
                <div className="border-t border-stone-850 pt-4 space-y-2 text-xs font-mono text-stone-400 text-right">
                  <div className="flex justify-between sm:justify-end gap-12">
                    <span>Order Subtotal:</span>
                    <span className="text-stone-200 font-bold">${draftSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between sm:justify-end gap-12">
                    <span className="flex items-center gap-1">
                      Bulk LTL Freight / Pallet Handling:
                    </span>
                    <span className="text-stone-200">{draftEstFreight === 0 ? 'FREE (4+ Units)' : `$${draftEstFreight.toFixed(2)}`}</span>
                  </div>
                  <div className="flex justify-between sm:justify-end gap-12">
                    <span>State Sales Tax Exemption:</span>
                    <span className="text-emerald-400">0.00% (Resale ID Verified)</span>
                  </div>
                  <div className="flex justify-between sm:justify-end gap-12 text-sm text-amber-500 font-bold border-t border-stone-850/60 pt-2 mt-2">
                    <span>Total Estimated Invoice:</span>
                    <span>${draftGrandTotal.toFixed(2)}</span>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={placingOrder || totalDraftUnits === 0 || isOrderingDisabled} 
                  className="w-full bg-amber-600 hover:bg-amber-500 text-stone-950 uppercase tracking-wider font-bold rounded-sm py-4 h-12 flex items-center justify-center gap-2 disabled:bg-stone-800 disabled:text-stone-500 disabled:border-stone-800 cursor-pointer"
                >
                  <ShoppingCart size={15} />
                  {placingOrder 
                    ? 'Transmitting purchase Order...' 
                    : hasPastDue 
                    ? 'Ordering Locked: Pay Current Past Due Balance' 
                    : net30Status !== 'approved' && !devBypassWholesale
                    ? 'Ordering Locked: NET-30 Terms Required' 
                    : 'Submit Certified Purchase Order'
                  }
                </Button>
              </form>
            </div>

            {/* RIGHT COLUMN: DISTRIBUTOR METADATA CARD */}
            <div className="md:col-span-4 space-y-4">
              <div className="bg-stone-950/40 border border-stone-850 p-5 rounded-lg space-y-4">
                <h4 className="text-stone-200 font-serif uppercase tracking-widest text-xs border-b border-stone-850 pb-2">
                  Distributor Registry Card
                </h4>
                
                <div className="text-[11px] font-sans text-stone-400 space-y-2.5">
                  <div>
                    <span className="text-stone-500 block uppercase tracking-wider text-[9px]">Account / Company</span>
                    <strong className="text-stone-200 uppercase tracking-widest font-serif text-xs">{partnerDoc?.businessName || 'Godley Accounts'}</strong>
                  </div>
                  <div>
                    <span className="text-stone-500 block uppercase tracking-wider text-[9px]">Authorized Representative</span>
                    <span className="text-stone-300">{partnerDoc?.contactName || 'Staff Lead'}</span>
                  </div>
                  <div>
                    <span className="text-stone-500 block uppercase tracking-wider text-[9px]">State ABC License Number</span>
                    <span className="text-amber-500 font-mono font-bold">{partnerDoc?.abcLicenseNumber || 'TYPE 20 / 47 #049281'}</span>
                  </div>
                  <div>
                    <span className="text-stone-500 block uppercase tracking-wider text-[9px]">Resale Certificate No.</span>
                    <span className="text-stone-300 font-mono">{partnerDoc?.resaleLicenseNumber || 'SR-048-29103'}</span>
                  </div>
                  <div>
                    <span className="text-stone-500 block uppercase tracking-wider text-[9px]">Federal Tax ID / EIN</span>
                    <span className="text-stone-300 font-mono">{partnerDoc?.taxId || 'XX-XXXXXXX'}</span>
                  </div>
                  <div>
                    <span className="text-stone-500 block uppercase tracking-wider text-[9px]">Registered Freight Address</span>
                    <span className="text-stone-300 font-serif text-[10px] leading-tight block mt-0.5">{partnerDoc?.address || 'Placer County, California'}</span>
                  </div>
                </div>
              </div>

              {/* NET-30 COMMERCIAL CREDIT REGISTRY */}
              <div id="net30-credit-registry" className="bg-stone-950/45 border border-stone-850 p-5 rounded-lg space-y-3 font-sans animate-fadeIn">
                <h4 className="text-stone-200 font-serif uppercase tracking-widest text-xs border-b border-stone-850 pb-2 flex items-center gap-1.5">
                  <CreditCard size={13} className="text-amber-500" /> Commercial Credit Panel
                </h4>
                
                <div className="text-[11px] font-sans text-stone-400 space-y-2">
                  <div className="flex justify-between items-center bg-stone-900/35 p-2 rounded border border-stone-900">
                    <span className="text-stone-500 uppercase tracking-wider text-[9px]">Credit Terms status:</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] uppercase tracking-widest font-mono font-bold ${
                      net30Status === 'approved' 
                        ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20' 
                        : net30Status === 'requested'
                        ? 'bg-amber-955/35 text-amber-400 border border-amber-500/20 animate-pulse'
                        : net30Status === 'denied'
                        ? 'bg-red-955/30 text-red-400 border border-red-500/20'
                        : 'bg-stone-900 text-stone-500 border border-stone-800'
                    }`}>
                      {net30Status.toUpperCase()}
                    </span>
                  </div>
                  
                  {net30Status === 'approved' && (
                    <div className="space-y-1 bg-stone-900/20 p-2.5 rounded border border-stone-900/40 text-[10px] space-y-1.5">
                      <div className="flex justify-between text-stone-400">
                        <span>Invoice Term:</span>
                        <strong className="text-stone-200 uppercase font-mono font-bold">NET-30 Days</strong>
                      </div>
                      <div className="flex justify-between text-stone-400">
                        <span>Credit Limit:</span>
                        <strong className="text-stone-200 font-mono">$10,000.00</strong>
                      </div>
                      <div className="flex justify-between text-stone-400">
                        <span>Account Standing:</span>
                        <strong className={hasPastDue ? 'text-red-400 animate-pulse font-mono' : 'text-emerald-400 font-mono'}>
                          {hasPastDue ? 'LOCKED (PAST DUE)' : 'ACTIVE (GOOD)'}
                        </strong>
                      </div>
                    </div>
                  )}
                  
                  {net30Status === 'requested' && (
                    <p className="text-[10px] text-stone-500 italic leading-snug">
                      Application submitted. Our compliance team is verifying banking coordinates and reference orders.
                    </p>
                  )}
                </div>
              </div>

              {/* TRUCK / LOGISTICS POLICY */}
              <div className="bg-stone-900/10 border border-stone-850 p-4 rounded text-xs text-stone-400 space-y-2.5 font-sans">
                <h4 className="text-[10px] uppercase font-bold text-stone-300 tracking-wider flex items-center gap-1.5">
                  <Truck size={13} className="text-amber-500" /> Freight Logistics Policy
                </h4>
                <p className="leading-relaxed text-[10px]">
                  Draft kegs and cases are secured onto sturdy, temperature-stabilized pallets. Pallet deliveries are fulfilled via temperature-controlled carriers (LTL freight) weekly to avoid temperature shocks. Minimum order of 4 cases/kegs qualifies for free shipping. Hand-loaded pickups are allowed at the Lincoln Way Taproom during weekdays.
                </p>
              </div>
            </div>
          </div>

          {/* HISTORICAL ACCOUNTS & INVOICES (REAL-TIME ACCOUNTS PAYABLE) */}
          <div className="space-y-4">
            <h3 className="text-stone-100 uppercase tracking-widest text-lg font-serif border-b border-stone-800 pb-2">
              Historical Accounts & Invoices Payable
            </h3>
            
            {partnerOrders.length === 0 ? (
              <div className="border border-dashed border-stone-800 p-8 rounded-lg text-center text-stone-500 text-xs italic font-sans">
                No past transactions on record. Your initial purchase order will appear below.
              </div>
            ) : (
              <div className="border border-stone-800 rounded-lg overflow-hidden bg-stone-950/20">
                <table className="w-full text-left border-collapse text-xs font-sans text-stone-300">
                  <thead>
                    <tr className="bg-stone-950/80 text-stone-400 uppercase tracking-wider text-[9px] border-b border-stone-800/80">
                      <th className="p-3">Order ID</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Items / Lines</th>
                      <th className="p-3">Total Due</th>
                      <th className="p-3">Invoice Term</th>
                      <th className="p-3">Pay Status</th>
                      <th className="p-3">Ship Status</th>
                      <th className="p-3 text-center">Invoice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-900/60 font-mono">
                    {partnerOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-stone-900/10">
                        <td className="p-3 font-bold text-stone-200">{order.orderId}</td>
                        <td className="p-3 text-[10px]">
                          {order.createdAt?.toDate 
                            ? order.createdAt.toDate().toLocaleDateString()
                            : order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'Pending'}
                        </td>
                        <td className="p-3 font-sans truncate max-w-[200px]">
                          {order.items?.map((it: any) => `${it.quantity}x ${it.name}`).join(', ') || 'Draft line'}
                        </td>
                        <td className="p-3 text-amber-500 font-bold">${(order.totalCents / 100).toFixed(2)}</td>
                        <td className="p-3 text-[10px] text-stone-400">{order.paymentTerm || 'NET-30'}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[8px] uppercase tracking-widest ${
                            order.status === 'paid' 
                              ? 'bg-emerald-900/20 text-emerald-400 border border-emerald-500/25' 
                              : 'bg-red-900/20 text-red-400 border border-red-500/25'
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[8px] uppercase tracking-widest ${
                            order.deliveryStatus === 'delivered' 
                              ? 'bg-emerald-905/30 text-emerald-400' 
                              : 'bg-stone-900 text-stone-400 border border-stone-800'
                          }`}>
                            {order.deliveryStatus || 'processing'}
                          </span>
                        </td>
                        <td className="p-3 text-center flex items-center justify-center gap-1.5">
                          <button 
                            onClick={() => setSelectedInvoice(order)}
                            className="text-[9px] uppercase tracking-widest font-semibold font-sans bg-amber-600/10 text-amber-500 hover:bg-amber-600 hover:text-stone-950 px-2.5 py-1.5 rounded border border-amber-600/25 transition-all cursor-pointer"
                          >
                            Print
                          </button>
                          {order.status !== 'paid' && (
                            <button 
                              onClick={() => handleSettleInvoiceOnline(order.id)}
                              disabled={settlingOrderId === order.id}
                              className="text-[9px] uppercase tracking-widest font-semibold font-sans bg-emerald-600/20 text-emerald-400 hover:bg-emerald-650 hover:text-stone-950 px-2.5 py-1.5 rounded border border-emerald-600/30 transition-all cursor-pointer disabled:opacity-50"
                            >
                              {settlingOrderId === order.id ? 'Settle...' : 'Settle Online'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* CUSTOM PRINTABLE ORDER INVOICE MODAL */}
          <Dialog open={!!selectedInvoice} onOpenChange={(open) => !open && setSelectedInvoice(null)}>
            <DialogContent className="bg-stone-950 border border-stone-800 text-stone-200 sm:max-w-2xl font-serif max-h-[85vh] overflow-y-auto">
              <DialogHeader className="border-b border-stone-800 pb-4">
                <DialogTitle className="text-xl text-amber-500 uppercase tracking-widest flex items-center justify-between">
                  <span>Wholesale Purchase Invoice</span>
                  <button 
                    onClick={() => window.print()}
                    className="text-xs bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors uppercase tracking-wider font-sans cursor-pointer print:hidden"
                  >
                    <Printer size={13} /> Print Invoice
                  </button>
                </DialogTitle>
                <DialogDescription className="text-stone-500 text-xs italic font-sans" />
              </DialogHeader>

              <div id="printable-invoice" className="py-6 space-y-6 font-sans text-sm text-stone-300 font-medium">
                {/* Printable CSS Override */}
                <style>{`
                  @media print {
                    body * {
                      visibility: hidden;
                      background: white !important;
                      color: black !important;
                    }
                    #printable-invoice, #printable-invoice * {
                      visibility: visible;
                      color: black !important;
                    }
                    #printable-invoice {
                      position: absolute;
                      left: 0;
                      top: 0;
                      width: 100%;
                      padding: 20px;
                    }
                    .print\\:hidden {
                      display: none !important;
                    }
                  }
                `}</style>

                {/* Header Info */}
                <div className="flex justify-between items-start border-b border-stone-900 pb-4">
                  <div className="space-y-1">
                    <h2 className="text-amber-500 font-serif text-lg uppercase tracking-wider font-bold">Godley Ciders</h2>
                    <p className="text-xs text-stone-500 font-sans">Lincoln Way Taproom & Vineyards</p>
                    <p className="text-xs text-stone-500 font-sans">Placer County, California</p>
                    <p className="text-xs text-stone-500 font-serif">partners@godleyciders.com</p>
                  </div>
                  <div className="text-right space-y-1 font-mono">
                    <p className="text-xs text-stone-400">Invoice: <strong className="font-mono text-stone-200">{selectedInvoice?.orderId || selectedInvoice?.id?.slice(0, 10).toUpperCase()}</strong></p>
                    <p className="text-xs text-stone-400">Date: {
                      selectedInvoice?.createdAt?.toDate 
                        ? selectedInvoice.createdAt.toDate().toLocaleDateString()
                        : selectedInvoice?.createdAt ? new Date(selectedInvoice.createdAt).toLocaleDateString() : 'N/A'
                    }</p>
                    <span className={`inline-block px-2 py-0.5 rounded text-[9px] uppercase tracking-widest border ${
                      selectedInvoice?.status === 'paid' 
                        ? 'bg-emerald-950/30 text-emerald-400 border-emerald-500/20' 
                        : 'bg-red-900/10 text-red-400 border-red-500/20'
                    }`}>
                      {selectedInvoice?.status || 'unpaid'}
                    </span>
                  </div>
                </div>

                {/* Billing details */}
                <div className="grid grid-cols-2 gap-6 bg-stone-900/40 p-4 rounded border border-stone-800/50 text-sans">
                  <div>
                    <h4 className="text-xs text-stone-500 uppercase tracking-widest font-semibold mb-1">Billing / Shipping Partner</h4>
                    <p className="font-semibold text-stone-200">{partnerDoc?.businessName || selectedInvoice?.businessName || 'Wholesale Partner'}</p>
                    <p className="text-xs text-stone-400">{partnerDoc?.contactName || 'Verification Complete'}</p>
                    <p className="text-xs text-stone-400">{user?.email}</p>
                    {partnerDoc?.deliveryPreference && <p className="text-xs text-stone-500">Preference: {partnerDoc.deliveryPreference}</p>}
                  </div>
                  <div>
                    <h4 className="text-xs text-stone-500 uppercase tracking-widest font-semibold mb-1">Commercial Credentials</h4>
                    <p className="text-xs text-stone-300">Payment Term: <strong className="text-amber-500">{selectedInvoice?.paymentTerm || 'NET-30'}</strong></p>
                    <p className="text-xs text-stone-400">ABC License: {partnerDoc?.abcLicenseNumber || selectedInvoice?.abcLicense || 'Active'}</p>
                    <p className="text-xs text-stone-400">Resale Permit: {partnerDoc?.resaleLicenseNumber || selectedInvoice?.resaleNumber || 'Active'}</p>
                    <p className="text-xs text-stone-400">Tax ID: {partnerDoc?.taxId || 'Verified'}</p>
                  </div>
                </div>

                {/* Items List */}
                <div className="space-y-2">
                  <h4 className="text-xs text-stone-400 uppercase tracking-widest font-semibold">Allocated Draft & Case Lines</h4>
                  <div className="border border-stone-800/80 rounded overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-stone-900/80 text-stone-400 border-b border-stone-800 uppercase tracking-wider text-[9px]">
                          <th className="p-3">Product Name</th>
                          <th className="p-3 text-center">Qty</th>
                          <th className="p-3 text-right">Unit Price</th>
                          <th className="p-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-900/65 font-mono">
                        {selectedInvoice?.items?.map((item: any, idx: number) => {
                          const price = item.priceAtPurchase || item.price || 0;
                          const total = price * item.quantity;
                          return (
                            <tr key={idx} className="hover:bg-stone-900/10">
                              <td className="p-3 font-sans text-stone-200">{item.name}</td>
                              <td className="p-3 text-center">{item.quantity}</td>
                              <td className="p-3 text-right">${price.toFixed(2)}</td>
                              <td className="p-3 text-right text-stone-200">${total.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pricing summary */}
                <div className="flex justify-end pt-4">
                  <div className="w-64 space-y-2 text-xs border-t border-stone-850 pt-3 font-mono">
                    {selectedInvoice?.subtotalCents !== undefined ? (
                      <>
                        <div className="flex justify-between text-stone-500">
                          <span>Subtotal</span>
                          <span>${(selectedInvoice.subtotalCents / 100).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-stone-500">
                          <span>Shipping / Freight</span>
                          <span>${(selectedInvoice.shippingCents / 100).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-stone-500">
                          <span>Placer County Tax (7.25%)</span>
                          <span>${(selectedInvoice.taxCents / 100).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-amber-500 font-bold font-serif pt-1 border-t border-stone-900">
                          <span>Total Due</span>
                          <span>${(selectedInvoice.totalCents / 100).toFixed(2)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between text-sm text-amber-500 font-bold font-serif pt-1">
                        <span>Grand Total</span>
                        <span>${(selectedInvoice?.totalAmount || 0).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-center pt-8 border-t border-stone-900/50 text-[10px] text-stone-500 italic pb-2 font-sans">
                  Godley Ciders Commercial Distribution Department. Invoices are payable under standard NET TERMS from receipt date.
                </div>
              </div>
            </DialogContent>
          </Dialog>

        </div>
      ) : (
        /* STANDARD NEW PROSPECT / INFO & APPLICATION PAGE */
        <div className="grid md:grid-cols-2 gap-16">
          <div className="space-y-8 text-stone-300 leading-relaxed text-lg">
            <p className="whitespace-pre-line text-slate-300 font-serif text-sm">
              {wholesaleSettings.body}
            </p>
            
            <div className="pt-8 space-y-4 border-t border-stone-800">
              <h3 className="text-amber-500 uppercase tracking-widest text-sm">Direct Contact</h3>
              <p className="text-sm font-sans text-stone-400">
                {wholesaleSettings.email}<br/>
                {wholesaleSettings.phone}
              </p>
            </div>
            
            <div className="p-4 border border-stone-850 bg-stone-900/10 rounded space-y-3 font-sans text-xs">
              <h4 className="text-amber-500 font-bold uppercase tracking-wider text-[10px]">Compliance & Payment Rules (AB 2991)</h4>
              <p className="leading-relaxed">
                In compliance with California ABC guidelines, we require active, valid State ABC licenses (Type 20, 21, or 47/48) and active Resale Certificates before allocations are verified.
              </p>
              <p className="leading-relaxed text-stone-400 border-t border-stone-850 pt-2 text-[11px]">
                💡 <strong>EFT Mandate</strong>: Under California Assembly Bill 2991 (effective Jan 1, 2026), all liquor wholesale-to-retail deliveries must be paid via <strong>Electronic Funds Transfer (EFT)</strong> prior to or at delivery. Physical checks, cash, and money orders are not accepted. Our partners can fulfill this under Net-30 credit lines using our secure online <strong>ACH / EFT bank transfer and commercial credit options</strong>.
              </p>
            </div>
          </div>

          <div className="bg-stone-950/30 backdrop-blur-md border border-stone-800/50 p-8 rounded-lg shadow-2xl relative z-10 w-full">
            {success ? (
              <div className="text-center py-12 space-y-6">
                <div className="mx-auto w-16 h-16 bg-emerald-950/40 border border-emerald-900 flex items-center justify-center rounded-full mb-4">
                  <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-2xl text-amber-500 uppercase tracking-widest">Inquiry Successfully Submitted</h3>
                <p className="text-stone-400 italic text-xs font-sans">We look forward to pouring with you. We have queued a confirmation email to {formData.email || 'your inbox'} and will be in touch shortly once your account passes ABC verification.</p>
                
                {/* INFORMATIVE SIGN IN HELPER FOR TESTING */}
                <div className="pt-4 p-3 border border-amber-600/20 bg-amber-600/5 rounded text-[11px] font-sans text-stone-400 text-left space-y-1.5">
                  <p className="font-semibold text-amber-500">How to test the Distributor Portal:</p>
                  <p>1. Ensure you are signed in with Google (top right).</p>
                  <p>2. Open the Admin Panel sidebar/link.</p>
                  <p>3. Find your application in the "Wholesale Inquiries" list and click <strong className="text-stone-100 uppercase text-[9px]">Approve Account</strong>.</p>
                  <p>4. Return here. You will instantly unlock this complete interactive Distributor Bulk Pallet Order Form and invoice history dashboard!</p>
                </div>

                <div className="pt-4">
                  <Button 
                    onClick={() => setSuccess(false)}
                    variant="outline"
                    className="border-amber-600/50 text-amber-500 hover:text-amber-400 rounded-sm uppercase tracking-wider text-xs"
                  >
                    Submit Another Inquiry
                  </Button>
                </div>
              </div>
            ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-1.5">
                <Label htmlFor="businessName" className="text-stone-400 uppercase tracking-wider text-[10px]">Business Name</Label>
                <Input 
                  id="businessName" 
                  required 
                  value={formData.businessName}
                  onChange={(e) => setFormData({...formData, businessName: e.target.value})}
                  className="bg-stone-950 border-stone-800 focus:border-amber-500/50 rounded-sm text-xs text-stone-200"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contactName" className="text-stone-400 uppercase tracking-wider text-[10px]">Contact Name</Label>
                <Input 
                  id="contactName" 
                  required 
                  value={formData.contactName}
                  onChange={(e) => setFormData({...formData, contactName: e.target.value})}
                  className="bg-stone-950 border-stone-800 focus:border-amber-500/50 rounded-sm text-xs text-stone-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-stone-400 uppercase tracking-wider text-[10px]">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    required 
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="bg-stone-950 border-stone-800 focus:border-amber-500/50 rounded-sm text-xs text-stone-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-stone-400 uppercase tracking-wider text-[10px]">Phone</Label>
                  <Input 
                    id="phone" 
                    type="tel" 
                    required 
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="bg-stone-950 border-stone-800 focus:border-amber-500/50 rounded-sm text-xs text-stone-200"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="type" className="text-stone-400 uppercase tracking-wider text-[10px]">Business Type</Label>
                <select 
                  id="type"
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  className="flex h-10 w-full bg-stone-950 border border-stone-800 focus:border-amber-500/50 rounded-sm px-3 py-2 text-xs text-stone-100 focus-visible:ring-offset-0 focus-visible:outline-none focus:ring-1 focus:ring-amber-500/50 transition-colors"
                >
                  <option value="Restaurant">Restaurant</option>
                  <option value="Bar / Taproom">Bar / Taproom</option>
                  <option value="Retail">Retail</option>
                  <option value="Distributor">Distributor</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="taxId" className="text-stone-400 uppercase tracking-wider text-[10px]">Federal Tax ID / EIN</Label>
                  <Input 
                    id="taxId"
                    required
                    placeholder="XX-XXXXXXX"
                    value={formData.taxId}
                    onChange={(e) => setFormData({...formData, taxId: e.target.value})}
                    className="bg-stone-950 border-stone-800 focus:border-amber-500/50 rounded-sm text-xs text-stone-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="abcLicenseNumber" className="text-stone-400 uppercase tracking-wider text-[10px]">State ABC License #</Label>
                  <Input 
                    id="abcLicenseNumber"
                    required
                    placeholder="e.g. Type 20 / 47"
                    value={formData.abcLicenseNumber}
                    onChange={(e) => setFormData({...formData, abcLicenseNumber: e.target.value})}
                    className="bg-stone-950 border-stone-800 focus:border-amber-500/50 rounded-sm text-xs text-stone-200"
                  />
                </div>
              </div>

              <div className="space-y-1.5 font-sans">
                <Label htmlFor="resaleLicenseNumber" className="text-stone-400 uppercase tracking-wider text-[10px]">Sales Tax Resale Certificate #</Label>
                <Input 
                  id="resaleLicenseNumber"
                  required
                  placeholder="e.g. SR-XXXX-XXXX"
                  value={formData.resaleLicenseNumber}
                  onChange={(e) => setFormData({...formData, resaleLicenseNumber: e.target.value})}
                  className="bg-stone-950 border-stone-800 focus:border-amber-500/50 rounded-sm text-xs text-stone-200"
                />
              </div>

              {/* Compliance Document uploads */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 font-sans">
                <div className="p-3 border border-stone-850 bg-stone-950/40 rounded flex flex-col justify-between space-y-2">
                  <div>
                    <span className="text-[9px] text-stone-400 uppercase tracking-wider block font-semibold mb-1">State ABC License PDF</span>
                    <p className="text-[8px] text-stone-500 leading-normal leading-tight">Drag or select official Type 20/21/47 compliance filing document.</p>
                  </div>
                  <div className="relative">
                    {abcFile.status === 'idle' ? (
                      <label className="flex items-center justify-center border border-dashed border-stone-800 hover:border-amber-500/30 p-3 rounded cursor-pointer transition-all bg-stone-1000 hover:bg-stone-900/40">
                        <input type="file" onChange={(e) => handleUploadSimulate('abc', e)} className="hidden" accept=".pdf,.png,.jpg,.jpeg" />
                        <span className="text-[9px] text-amber-500 font-sans uppercase tracking-[0.1em] font-medium flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          Select ABC Copy
                        </span>
                      </label>
                    ) : (
                      <div className="bg-stone-950 p-2 border border-stone-850 rounded flex items-center justify-between gap-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] text-stone-300 font-mono truncate">{abcFile.name}</p>
                          <p className="text-[8px] text-stone-500 font-mono">{(abcFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <span className={`text-[8px] font-mono font-bold uppercase tracking-wider ${
                          abcFile.status === 'success' ? 'text-emerald-400' : 'text-amber-500 animate-pulse'
                        }`}>
                          {abcFile.status === 'uploading' ? 'Uploading...' : abcFile.status === 'scanning' ? 'Scanning...' : 'Document Loaded'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-3 border border-stone-850 bg-stone-950/40 rounded flex flex-col justify-between space-y-2">
                  <div>
                    <span className="text-[9px] text-stone-400 uppercase tracking-wider block font-semibold mb-1">CDTFA Resale Certificate</span>
                    <p className="text-[8px] text-stone-500 leading-normal leading-tight">Drag or select certified CDTFA-120 sales tax permit document.</p>
                  </div>
                  <div className="relative">
                    {resaleFile.status === 'idle' ? (
                      <label className="flex items-center justify-center border border-dashed border-stone-800 hover:border-amber-500/30 p-3 rounded cursor-pointer transition-all bg-stone-1000 hover:bg-stone-900/40">
                        <input type="file" onChange={(e) => handleUploadSimulate('resale', e)} className="hidden" accept=".pdf,.png,.jpg,.jpeg" />
                        <span className="text-[9px] text-amber-500 font-sans uppercase tracking-[0.1em] font-medium flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          Select Resale copy
                        </span>
                      </label>
                    ) : (
                      <div className="bg-stone-950 p-2 border border-stone-850 rounded flex items-center justify-between gap-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] text-stone-300 font-mono truncate">{resaleFile.name}</p>
                          <p className="text-[8px] text-stone-500 font-mono">{(resaleFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <span className={`text-[8px] font-mono font-bold uppercase tracking-wider ${
                          resaleFile.status === 'success' ? 'text-emerald-400' : 'text-amber-500 animate-pulse'
                        }`}>
                          {resaleFile.status === 'uploading' ? 'Uploading...' : resaleFile.status === 'scanning' ? 'Scanning...' : 'Document Loaded'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="address" className="text-stone-400 uppercase tracking-wider text-[10px]">Shipping Address</Label>
                <Input 
                  id="address" 
                  required 
                  placeholder="Street Address, City, State, ZIP"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className="bg-stone-950 border-stone-800 focus:border-amber-500/50 rounded-sm text-xs text-stone-200"
                />
              </div>

              <div className="space-y-3 pt-1">
                <label className="flex items-center gap-3 text-xs text-stone-300 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={formData.billingAddressSame} 
                    onChange={(e) => setFormData({...formData, billingAddressSame: e.target.checked})}
                    className="accent-amber-500 w-4 h-4 cursor-pointer" 
                  />
                  <span>Billing address is same as shipping address</span>
                </label>
              </div>

              {!formData.billingAddressSame && (
                <div className="space-y-1.5 animate-fadeIn">
                  <Label htmlFor="billingAddress" className="text-stone-400 uppercase tracking-wider text-[10px]">Billing Address</Label>
                  <Input 
                    id="billingAddress" 
                    required={!formData.billingAddressSame}
                    placeholder="Billing street address, city, state, ZIP"
                    value={formData.billingAddress}
                    onChange={(e) => setFormData({...formData, billingAddress: e.target.value})}
                    className="bg-stone-950 border-stone-800 focus:border-amber-500/50 rounded-sm text-xs text-stone-200"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="website" className="text-stone-400 uppercase tracking-wider text-[10px]">Website / Socials</Label>
                  <Input 
                    id="website" 
                    value={formData.website}
                    onChange={(e) => setFormData({...formData, website: e.target.value})}
                    className="bg-stone-950 border-stone-800 focus:border-amber-500/50 rounded-sm text-xs text-stone-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="estimatedVolume" className="text-stone-400 uppercase tracking-wider text-[10px]">Expected Volume</Label>
                  <select 
                    id="estimatedVolume"
                    value={formData.estimatedVolume}
                    onChange={(e) => setFormData({...formData, estimatedVolume: e.target.value})}
                    className="flex h-10 w-full bg-stone-950 border border-stone-800 focus:border-amber-500/50 rounded-sm px-3 py-2 text-xs text-stone-100 focus-visible:ring-offset-0 focus-visible:outline-none focus:ring-1 focus:ring-amber-500/50 transition-colors"
                  >
                    <option value="">Select volume...</option>
                    <option value="1-2 Cases/Week">1-2 Cases/Week</option>
                    <option value="3-5 Cases/Week">3-5 Cases/Week</option>
                    <option value="1-2 Kegs/Month">1-2 Kegs/Month</option>
                    <option value="Pallet+">Pallet+</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="message" className="text-stone-400 uppercase tracking-wider text-[10px]">Tell us about your program</Label>
                <Textarea 
                  id="message" 
                  rows={3}
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  className="bg-stone-950 border-stone-800 focus:border-amber-500/50 rounded-sm resize-none text-xs text-stone-250 font-sans"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-amber-600 hover:bg-amber-500 text-stone-950 uppercase tracking-wider font-bold rounded-sm py-5 text-xs h-12">
                {loading ? 'Submitting...' : 'Request Allocation'}
              </Button>
            </form>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
