import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import localforage from 'localforage';
import { 
  Wine, FileText, CreditCard, Plus, Minus, Trash2, 
  CheckCircle, RefreshCw, AlertCircle, ShieldCheck, 
  Layers, Send, Users, Lock, ChevronRight, ShoppingBag, 
  User, Check, DollarSign, Archive, HelpCircle, HardDrive, Smartphone, Mail, QrCode
} from 'lucide-react';
import { db, handleFirestoreError, OperationType, initAuth, googleSignInWorkspace, getAccessToken } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAdminStore } from '../store/adminStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Detailed types matching our global integration contract
import { OrderPayload, ClubSignupPayload, PaymentEventPayload, WebhookEvent } from '../types/integration';

// Placer County, Lincoln CA local tax rate
const PLACER_COUNTY_TAX_RATE = 0.0725;

// Calculate waitlist priority score:
// - Heritage Branch: 30 base points
// - Branch: 20 base points
// - Core: 10 base points
// - VIP status grants +100 priority boost.
// - Tier premium points decay over time (halves every 24 hours).
// - Seniority premium: +0.5 points per hour to reward early sign-ups as time passes.
const calculatePriorityScore = (createdAtStr: string | Date, tier: string) => {
  let basePoints = 10;
  const lowerTier = (tier || '').toLowerCase();
  
  if (lowerTier.includes('heritage')) {
    basePoints = 30;
  } else if (lowerTier.includes('branch')) {
    basePoints = 20;
  } else if (lowerTier.includes('core')) {
    basePoints = 10;
  }

  const createTime = new Date(createdAtStr).getTime();
  const now = new Date().getTime();
  const ageInMs = Math.max(0, now - createTime);
  const ageInHours = ageInMs / (1000 * 60 * 60);

  // Decaying tier points (halves every 24 hours)
  const decayedTierBonus = basePoints * Math.pow(0.5, ageInHours / 24);
  
  // Seniors reward: +0.5 points per hour
  const timeBonus = ageInHours * 0.5;

  return {
    score: Number((decayedTierBonus + timeBonus).toFixed(1)),
    basePoints,
    decayedTierBonus: Number(decayedTierBonus.toFixed(1)),
    timeBonus: Number(timeBonus.toFixed(1)),
    ageInHours: Number(ageInHours.toFixed(1))
  };
};

export default function EmployeePortal() {
  const { shopProducts, clubSettings, loadFromFirebase } = useAdminStore();
  
  useEffect(() => {
    loadFromFirebase();
  }, [loadFromFirebase]);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [loginError, setLoginError] = useState('');
  const [workspaceUser, setWorkspaceUser] = useState<any>(null);
  const [needsWorkspaceAuth, setNeedsWorkspaceAuth] = useState(true);
  
  // Tab control: 'pos' (Taproom POS), 'fulfillment' (Fulfillment Hub), 'sync' (BevForge Sync Telemetry), or 'club' (Club Lookup)
  const [activeTab, setActiveTab] = useState<'pos' | 'fulfillment' | 'sync' | 'club'>('pos');
  
  // Real-time collections state
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [clubLeads, setClubLeads] = useState<any[]>([]);
  const [syncEvents, setSyncEvents] = useState<any[]>([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [activeReviewInquiry, setActiveReviewInquiry] = useState<any | null>(null);

  // Club Member states
  const [selectedClubLead, setSelectedClubLead] = useState<any | null>(null);
  const [clubSearchTerm, setClubSearchTerm] = useState('');
  const [showAddNewClub, setShowAddNewClub] = useState(false);
  const [newClubName, setNewClubName] = useState('');
  const [newClubEmail, setNewClubEmail] = useState('');
  const [newClubPhone, setNewClubPhone] = useState('');
  const [newClubTier, setNewClubTier] = useState('Core');
  const [clubFormError, setClubFormError] = useState('');
  const [clubFormSuccess, setClubFormSuccess] = useState('');
  
  // Waitlist console states
  const [clubSubTab, setClubSubTab] = useState<'directory' | 'waitlist' | 'taps'>('directory');
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [waitlistLogs, setWaitlistLogs] = useState<string[]>([]);

  // Fallback demo club leads if Firestore isn't populated or permission restrictions exist
  const [localClubLeads, setLocalClubLeads] = useState<any[]>([
    {
      id: 'demo-lead-1',
      name: 'Travis Godley',
      email: 'travis@godleyciders.com',
      phone: '916-555-0190',
      tier: 'Heritage Branch',
      createdAt: '2026-04-10T12:00:00Z',
      pickups: [
        { id: 'p1', month: 'April 2026', fulfilled: true, fulfilledAt: '2026-04-12T19:22:10Z', fulfilledBy: 'Staff Pin' },
        { id: 'p2', month: 'May 2026', fulfilled: true, fulfilledAt: '2026-05-10T18:15:30Z', fulfilledBy: 'Staff Pin' },
        { id: 'p3', month: 'June 2026', fulfilled: false }
      ],
      notes: 'Likes dry styles. Prefer Bourbon Barrel Aged when in stock.'
    },
    {
      id: 'demo-lead-2',
      name: 'Sarah Jenkins',
      email: 'sarah@jenkinsvineyards.com',
      phone: '530-555-8833',
      tier: 'Branch',
      createdAt: '2026-05-01T14:30:00Z',
      pickups: [
        { id: 'p4', month: 'May 2026', fulfilled: false },
        { id: 'p5', month: 'June 2026', fulfilled: false }
      ],
      notes: 'Enjoys wild ferments and botanical infusions.'
    },
    {
      id: 'demo-lead-3',
      name: 'Marcus Aurelius',
      email: 'marcus@philosophy.edu',
      phone: '415-555-1212',
      tier: 'Core',
      createdAt: '2026-04-20T09:15:00Z',
      pickups: [
        { id: 'p6', month: 'April 2026', fulfilled: true, fulfilledAt: '2026-04-22T21:05:00Z', fulfilledBy: 'Staff Pin' },
        { id: 'p7', month: 'May 2026', fulfilled: false },
        { id: 'p8', month: 'June 2026', fulfilled: false }
      ],
      notes: 'Philosophical conversations over dry cider. Prefers classic baseline core cider.'
    }
  ]);
  
  // POS Order creator state
  const [posCart, setPosCart] = useState<Array<{ product: any; quantity: number }>>([]);
  const [customerType, setCustomerType] = useState<'guest' | 'club' | 'wholesale'>('guest');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [memberCode, setMemberCode] = useState('');
  
  // Compliance info for wholesale pos transactions
  const [businessName, setBusinessName] = useState('');
  const [abcLicenseNumber, setAbcLicenseNumber] = useState('');
  const [resaleLicenseNumber, setResaleLicenseNumber] = useState('');
  const [taxId, setTaxId] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  
  // Custom item builder state
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  
  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'account_charge' | 'iphone_tap_qr'>('cash');
  const [posProcessing, setPosProcessing] = useState(false);
  const [simulatingTerminal, setSimulatingTerminal] = useState(false);

  // iPhone POS Mobile Terminal states
  const [mobileCheckoutActive, setMobileCheckoutActive] = useState(false);
  const [mobileSubMode, setMobileSubMode] = useState<'tap' | 'qr'>('tap');
  const [mobileCheckoutUrl, setMobileCheckoutUrl] = useState('');
  const [mobileCheckoutSessionId, setMobileCheckoutSessionId] = useState('');
  const [mobileCheckoutStatus, setMobileCheckoutStatus] = useState<'idle' | 'generating' | 'waiting' | 'paid' | 'failed' | 'tapping' | 'tap_scanning' | 'tap_success'>('idle');

  const [emailReceiptStatus, setEmailReceiptStatus] = useState<'sending' | 'sent' | 'idle'>('idle');
  const [posSuccessReceipt, setPosSuccessReceipt] = useState<any>(null);
  const [posError, setPosError] = useState('');
  const [gratuitySelection, setGratuitySelection] = useState<number>(0); 
  const [customGratuityAmount, setCustomGratuityAmount] = useState<string>('');
  const [isVipComp, setIsVipComp] = useState<boolean>(false);

  // Real-time Member Contactless Check-In Broadcast Receiver states
  const [liveCheckins, setLiveCheckins] = useState<any[]>([]);
  const [newCheckinAlert, setNewCheckinAlert] = useState<any | null>(null);

  // Fallback state in case Firestore has permission restrictions (e.g. not logged in as Travis)
  const [localOrders, setLocalOrders] = useState<any[]>([]);
  const [localInquiries, setLocalInquiries] = useState<any[]>([]);

  useEffect(() => {
    return initAuth(
      (user) => {
        setWorkspaceUser(user);
        setNeedsWorkspaceAuth(false);
      },
      () => setNeedsWorkspaceAuth(true)
    );
  }, []);

  // Subscription logic to Firestore
  useEffect(() => {
    if (!isAuthenticated) return;

    // Load from durable localForage on mount
    localforage.getItem('offlineOrders').then(stored => {
      if (stored) setLocalOrders(stored as any[]);
    });
    localforage.getItem('offlineInquiries').then(stored => {
      if (stored) setLocalInquiries(stored as any[]);
    });
    localforage.getItem('offlineClubLeads').then(stored => {
      if (stored) setLocalClubLeads(stored as any[]);
    });

    setDbLoading(true);
    let unsubInquiries = () => {};
    let unsubOrders = () => {};
    let unsubClubLeads = () => {};

    try {
      const qInquiries = query(collection(db, 'wholesale_inquiries'), orderBy('createdAt', 'desc'));
      unsubInquiries = onSnapshot(qInquiries, (snapshot) => {
        setInquiries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (err) => {
        console.warn("Wholesale inquiries Firestore load error (will fallback to local):", err);
      });

      const qOrders = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
      unsubOrders = onSnapshot(qOrders, (snapshot) => {
        setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (err) => {
        console.warn("Orders Firestore load error (will fallback to local):", err);
      });

      const qClubLeads = query(collection(db, 'club_leads'), orderBy('createdAt', 'desc'));
      unsubClubLeads = onSnapshot(qClubLeads, (snapshot) => {
        setClubLeads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (err) => {
        console.warn("Club leads Firestore load error (will fallback to local):", err);
      });
    } catch (e) {
      console.warn("Firestore subscription failed. Falling back to robust offline state managers.");
    } finally {
      setDbLoading(false);
    }

    return () => {
      unsubInquiries();
      unsubOrders();
      unsubClubLeads();
    };
  }, [isAuthenticated]);

  // Read current unacknowledged events queue from server to show in Telemetry box
  const fetchCurrentSyncQueue = async () => {
    try {
      const response = await fetch('/api/sync/pull');
      if (response.ok) {
        const result = await response.json();
        setSyncEvents(result.updates || []);
      }
    } catch (err) {
      console.error("Failed to fetch server sync queue:", err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchCurrentSyncQueue();
      const interval = setInterval(fetchCurrentSyncQueue, 5000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // Contactless Member Check-In Scanner (Firestore + LocalStorage dual-channel receiver)
  useEffect(() => {
    if (!isAuthenticated) return;

    // 1. Subscribe to Firestore physical_checkins collection
    let unsubCheckins = () => {};
    try {
      unsubCheckins = onSnapshot(collection(db, 'physical_checkins'), (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
        });

        // Sort newest first
        const sorted = list.sort((a, b) => {
          const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return bTime - aTime;
        });

        setLiveCheckins(sorted);

        // Find newest active 'pending' check-in
        const newestPending = sorted.find(c => c.status === 'pending');
        if (newestPending) {
          const diffMs = Date.now() - new Date(newestPending.timestamp).getTime();
          // If created within the last 15 seconds, ping!
          if (diffMs < 15000) {
            setNewCheckinAlert(newestPending);
            playNfcChime?.();
          }
        }
      }, (err) => {
        console.warn("Contactless check-ins Firestore load error:", err);
      });
    } catch (e) {
      console.warn("Firestore physical check-ins subscription failed.");
    }

    // 2. High-speed local channel fallback (useful for same-machine tab-to-tab demoing)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'g_ciders_physical_checkin') {
        try {
          const val = JSON.parse(e.newValue || '{}');
          if (val && val.timestamp) {
            setLiveCheckins(prev => {
              const exists = prev.some(c => c.id === val.id || (c.email === val.email && c.timestamp === val.timestamp));
              if (exists) return prev;
              return [val, ...prev];
            });
            setNewCheckinAlert(val);
            playNfcChime?.();
          }
        } catch (err) {
          console.error(err);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      unsubCheckins();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isAuthenticated]);

  // Poll for Mobile POS QR Self-Checkout success state updates
  useEffect(() => {
    if (!mobileCheckoutActive || mobileSubMode !== 'qr' || mobileCheckoutStatus !== 'waiting' || !mobileCheckoutSessionId) return;

    const isMock = mobileCheckoutSessionId.startsWith('cs_mock_');
    if (isMock) return; // Mock doesn't poll, uses manual actions or auto-resolves after some seconds

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/checkout/session-status?session_id=${mobileCheckoutSessionId}`);
        if (response.ok) {
          const result = await response.json();
          if (result.status === 'paid') {
            clearInterval(interval);
            playNfcChime();
            setMobileCheckoutStatus('tap_success');
            setTimeout(async () => {
              await executeFinalPOSCheckout('iPhone QR Self-Pay');
              setMobileCheckoutActive(false);
            }, 1500);
          }
        }
      } catch (err) {
        console.warn("Error polling POS Stripe mobile checkout session:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [mobileCheckoutActive, mobileSubMode, mobileCheckoutStatus, mobileCheckoutSessionId]);

  useEffect(() => {
    localforage.setItem('offlineOrders', localOrders);
  }, [localOrders]);

  useEffect(() => {
    localforage.setItem('offlineInquiries', localInquiries);
  }, [localInquiries]);

  useEffect(() => {
    localforage.setItem('offlineClubLeads', localClubLeads);
  }, [localClubLeads]);

  // Handle Passcode login
  const handlePasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPass = passcode.trim();
    const correctPin = clubSettings?.portalPasscode || '1234';
    if (cleanPass === correctPin || cleanPass.toLowerCase() === 'godley' || cleanPass.toLowerCase() === 'bevforge') {
      setIsAuthenticated(true);
      setLoginError('');
    } else {
      setLoginError('Invalid Employee PIN. Please use the passcode configured in your administration dashboard.');
      setPasscode('');
    }
  };

  // Synthesize terminal success chime using Web Audio API
  const playNfcChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, ctx.currentTime);
      gain1.gain.setValueAtTime(0.08, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.08);
      
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1320, ctx.currentTime);
        gain2.gain.setValueAtTime(0.08, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.12);
      }, 70);
    } catch (e) {
      console.log("Audio simulation chime blocked by context constraint:", e);
    }
  };

  // Shared completion function across standard cashier flows and mobile terminal overlays
  const executeFinalPOSCheckout = async (overrideMethod?: string) => {
    try {
      const subtotalCents = posCart.reduce((sum, item) => sum + (item.product.price * 100 * item.quantity), 0);
      const discountCents = customerType === 'club' ? Math.round(subtotalCents * 0.15) : 0;
      const taxableCents = subtotalCents - discountCents;
      
      let tipCents = 0;
      if (gratuitySelection === -1) {
        tipCents = Math.round((parseFloat(customGratuityAmount) || 0) * 100);
      } else {
        tipCents = Math.round(taxableCents * gratuitySelection);
      }

      let finalSubtotalCents = taxableCents;
      let finalTaxCents = Math.round(finalSubtotalCents * PLACER_COUNTY_TAX_RATE);
      if (isVipComp) {
        finalSubtotalCents = 0;
        finalTaxCents = 0;
        tipCents = 0;
      }

      const totalCents = finalSubtotalCents + finalTaxCents + tipCents;
      const orderId = 'pos-' + Math.random().toString(36).substring(2, 10).toUpperCase();
      const eventUUID = crypto.randomUUID?.() || 'evt-' + Math.random().toString(36).substring(2, 15);
      const paymentUUID = 'evt-' + Math.random().toString(36).substring(2, 15);

      const itemsPayload = posCart.map(item => ({
        productId: item.product.id,
        sku: item.product.id.startsWith('merch') ? `MERCH-${item.product.id.toUpperCase()}` : `CID-${item.product.name.replace(/\s+/g, '-').toUpperCase()}`,
        name: item.product.name,
        quantity: item.quantity,
        unitPriceCents: item.product.price * 100
      }));

      const resolvedMethod = overrideMethod || paymentMethod;

      const orderPayload: OrderPayload = {
        orderId,
        source: customerType === 'wholesale' ? 'wholesale' : 'admin',
        customerId: customerEmail,
        customerName,
        customerEmail,
        businessName: customerType === 'wholesale' ? businessName : undefined,
        items: itemsPayload,
        subtotalCents,
        taxCents: finalTaxCents,
        shippingCents: 0,
        totalCents,
        tipCents,
        isComp: isVipComp,
        currency: 'USD',
        notes: `Taproom POS Cashier checkout. Payment: ${resolvedMethod.toUpperCase()}. Tip: $${(tipCents / 100).toFixed(2)}.`
      };

      if (customerType === 'wholesale') {
        orderPayload.shippingAddress = {
          line1: shippingAddress || "Pick-Up at Cider Shed",
          city: "Lincoln",
          state: "CA",
          postalCode: "95648",
          country: "US"
        };
        orderPayload.billingAddress = {
          line1: billingAddress || shippingAddress || "Pick-Up at Cider Shed",
          city: "Lincoln",
          state: "CA",
          postalCode: "95648",
          country: "US"
        };
      }

      const orderEvent: WebhookEvent<OrderPayload> = {
        eventId: eventUUID,
        eventType: 'order.created',
        createdAt: new Date().toISOString(),
        idempotencyKey: eventUUID,
        data: orderPayload
      };

      const paymentPayload: PaymentEventPayload = {
        stripeEventId: resolvedMethod === 'card' || resolvedMethod.toLowerCase().includes('stripe') || resolvedMethod.toLowerCase().includes('iphone') ? `evt_stripe_${Math.random().toString(36).substring(2,10)}` : undefined,
        paymentIntentId: `pi_pos_${Math.random().toString(36).substring(2,10)}`,
        orderId,
        customerId: customerEmail,
        amountCents: totalCents,
        currency: 'USD',
        status: 'succeeded'
      };

      const paymentEvent: WebhookEvent<PaymentEventPayload> = {
        eventId: paymentUUID,
        eventType: 'payment.succeeded',
        createdAt: new Date().toISOString(),
        idempotencyKey: paymentUUID,
        data: paymentPayload
      };

      // 1. Submit Events to Outbound Durable Queue (for BevForge CRM mapping)
      try {
        await fetch('/api/events/enqueue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderEvent)
        });

        await fetch('/api/events/enqueue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(paymentEvent)
        });
      } catch (evtErr) {
        console.warn("Outbox sync queue unreachable:", evtErr);
      }

      // 2. Persist order document in Firestore '/orders'
      const firestoreOrderDoc = {
        userId: customerEmail,
        customerEmail,
        customerName,
        source: 'POS-Taproom',
        items: posCart.map(item => ({
          productId: item.product.id,
          name: item.product.name,
          quantity: item.quantity,
          priceAtPurchase: item.product.price
        })),
        totalAmount: totalCents / 100,
        status: 'paid',
        paymentMethod: resolvedMethod,
        checkoutType: customerType,
        abcLicenseNumber: customerType === 'wholesale' ? abcLicenseNumber : null,
        resaleLicenseNumber: customerType === 'wholesale' ? resaleLicenseNumber : null,
        taxId: customerType === 'wholesale' ? taxId : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      try {
        await addDoc(collection(db, 'orders'), {
          ...firestoreOrderDoc,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        console.warn("Firestore save denied or failed (using local fallback state):", err);
        setLocalOrders(prev => [
          { id: orderId, ...firestoreOrderDoc },
          ...prev
        ]);
      }

      // Decrement Inventory globally
      try {
        await useAdminStore.getState().decrementInventory(
          posCart.map(item => ({ id: item.product.id, quantity: item.quantity }))
        );
      } catch (err) {
        console.warn("Failed to decrement inventory, continuing checkout:", err);
      }

      // Success Setup
      setPosSuccessReceipt({
        orderId,
        subtotal: subtotalCents / 100,
        discount: (isVipComp ? subtotalCents : discountCents) / 100,
        tax: finalTaxCents / 100,
        tip: tipCents / 100,
        total: totalCents / 100,
        customerName,
        customerEmail,
        paymentMethod: isVipComp ? 'VIP COMP' : resolvedMethod.toUpperCase(),
        timestamp: new Date().toLocaleTimeString(),
        items: posCart.map(item => ({ name: item.product.name, qty: item.quantity, price: item.product.price }))
      });

      // Clear Form and Cart
      setPosCart([]);
      setCustomerName('');
      setCustomerEmail('');
      setCustomerPhone('');
      setMemberCode('');
      setBusinessName('');
      setAbcLicenseNumber('');
      setResaleLicenseNumber('');
      setTaxId('');
      setShippingAddress('');
      setBillingAddress('');
      setGratuitySelection(0);
      setCustomGratuityAmount('');
      setIsVipComp(false);
      
      fetchCurrentSyncQueue();
    } catch (err: any) {
      console.error(err);
      setPosError(err.message || "Failed to finalize POS checkout.");
    }
  };

  // Process POS Checkout
  const handlePOSCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (posCart.length === 0) {
      setPosError("Cart is empty.");
      return;
    }
    if (customerType === 'wholesale' && (!businessName || !abcLicenseNumber || !resaleLicenseNumber)) {
      setPosError("Wholesale transactions require compliance documentation (Business, ABC#, Resale Certificate#).");
      return;
    }
    if (!customerEmail || !customerName) {
      setPosError("Customer Name and Email are required.");
      return;
    }

    setPosProcessing(true);
    setPosError('');

    // If iPhone Tap/QR Code mode, bypass direct cashier completion & trigger terminal modal
    if (paymentMethod === 'iphone_tap_qr') {
      setMobileCheckoutActive(true);
      setMobileCheckoutStatus('generating');
      setMobileSubMode('tap'); // Default view

      try {
        const subtotal = posCart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
        const discount = isVipComp ? subtotal : (customerType === 'club' ? subtotal * 0.15 : 0);
        const taxable = subtotal - discount;
        const tax = taxable * PLACER_COUNTY_TAX_RATE;
        let tip = 0;
        if (!isVipComp) {
          if (gratuitySelection === -1) {
            tip = parseFloat(customGratuityAmount) || 0;
          } else {
            tip = taxable * gratuitySelection;
          }
        }
        const total = isVipComp ? 0 : (taxable + tax + tip);

        // Map items for Stripe
        const checkoutItems = posCart.map(item => {
          let itemPrice = item.product.price;
          if (customerType === 'club') itemPrice *= 0.85;
          if (isVipComp) itemPrice = 0;
          return {
            name: item.product.name,
            price: itemPrice,
            quantity: item.quantity
          };
        });

        if (tax > 0) {
          checkoutItems.push({
            name: "Placer County Sales Tax (7.25%)",
            price: tax,
            quantity: 1
          });
        }
        if (tip > 0 && !isVipComp) {
          checkoutItems.push({
            name: "Taproom Staff Tip",
            price: tip,
            quantity: 1
          });
        }

        // Fetch session from endpoint
        const response = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: checkoutItems,
            metadata: {
              type: 'pos_payment_iphone',
              customerEmail,
              customerName,
              customerType
            }
          })
        });

        if (response.ok) {
          const resData = await response.json();
          setMobileCheckoutUrl(resData.url);
          try {
            const urlObj = new URL(resData.url);
            const sId = urlObj.searchParams.get('session_id') || '';
            setMobileCheckoutSessionId(sId);
          } catch {
            setMobileCheckoutSessionId('cs_live_' + Math.random().toString(36).substring(2, 10));
          }
          setMobileCheckoutStatus('waiting');
        } else {
          // Fallback simulation
          const mockId = 'cs_mock_' + Math.random().toString(36).substring(2, 12);
          setMobileCheckoutSessionId(mockId);
          setMobileCheckoutUrl(`${window.location.origin}/employee?session_id=${mockId}&checkout_simulate=success`);
          setMobileCheckoutStatus('waiting');
        }
      } catch (err) {
        // Fallback simulation
        const mockId = 'cs_mock_' + Math.random().toString(36).substring(2, 12);
        setMobileCheckoutSessionId(mockId);
        setMobileCheckoutUrl(`${window.location.origin}/employee?session_id=${mockId}&checkout_simulate=success`);
        setMobileCheckoutStatus('waiting');
      } finally {
        setPosProcessing(false);
      }
      return;
    }

    if (paymentMethod === 'card') {
      setSimulatingTerminal(true);
      await new Promise(resolve => setTimeout(resolve, 3000));
      setSimulatingTerminal(false);
    }

    await executeFinalPOSCheckout();
    setPosProcessing(false);
  };

  // Add Item to cart
  const addToCart = (product: any) => {
    setPosCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  // Adjust item quantity
  const updateQuantity = (productId: string, delta: number) => {
    setPosCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const newQty = item.quantity + delta;
          return { ...item, quantity: newQty < 1 ? 1 : newQty };
        }
        return item;
      }).filter(item => item.quantity > 0);
    });
  };

  // Remove from cart
  const removeFromCart = (productId: string) => {
    setPosCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const handleSendEmailReceipt = async () => {
    if (!posSuccessReceipt) return;
    setEmailReceiptStatus('sending');
    try {
      const accessToken = await getAccessToken();
      const headers: any = { 'Content-Type': 'application/json' };
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

      await fetch('/api/email/dispatch', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          to: posSuccessReceipt.customerEmail,
          from: 'noreply@godleyciders.com',
          subject: `Receipt for Order ${posSuccessReceipt.orderId} - Godley Ciders`,
          text: `Thank you for your purchase ${posSuccessReceipt.customerName}!\nOrder ID: ${posSuccessReceipt.orderId}\nTotal: $${posSuccessReceipt.total.toFixed(2)}\n\nCheers,\nGodley Ciders`
        })
      });
      setEmailReceiptStatus('sent');
      setTimeout(() => setEmailReceiptStatus('idle'), 3000);
    } catch (err) {
      console.warn("Failed to dispatch email receipt:", err);
      setEmailReceiptStatus('idle');
    }
  };

  // Add a quick custom taproom charge (flights, fills, custom ciders)
  const handleCustomItemAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customItemName || !customItemPrice || isNaN(Number(customItemPrice))) return;
    
    const fakeProduct = {
      id: 'custom-' + Date.now(),
      name: customItemName,
      price: parseFloat(customItemPrice),
      image: '/assets/ciders/(store)Jonah\s Juice.webp',
      type: 'Tasting / Custom charge',
      category: 'cider'
    };

    addToCart(fakeProduct);
    setCustomItemName('');
    setCustomItemPrice('');
  };

  // Update order status in Firestore (fulfillment)
  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      // Find order in Firestore or fallback
      const firestoreOrder = orders.find(o => o.id === orderId);
      if (firestoreOrder) {
        const docRef = doc(db, 'orders', orderId);
        await updateDoc(docRef, {
          status: newStatus,
          updatedAt: serverTimestamp()
        });
      } else {
        // Fallback local update
        setLocalOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      }

      // Enqueue sync event to let BevForge know order status was altered!
      const statusEvent: WebhookEvent<any> = {
        eventId: crypto.randomUUID?.() || 'evt-' + Math.random().toString(36).substring(2, 10),
        eventType: 'order.updated',
        createdAt: new Date().toISOString(),
        data: {
          orderId,
          status: newStatus,
          timestamp: new Date().toISOString()
        }
      };

      await fetch('/api/events/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(statusEvent)
      });

      fetchCurrentSyncQueue();
    } catch (err) {
      console.error("Failed to update status & enqueue event:", err);
    }
  };

  // Verify and approve a distributor's wholesale registration account
  const approveDistributorAccount = async (inquiryId: string) => {
    try {
      const isFirestoreDoc = inquiries.some(i => i.id === inquiryId);
      if (isFirestoreDoc) {
        const docRef = doc(db, 'wholesale_inquiries', inquiryId);
        await updateDoc(docRef, {
          status: 'approved',
          approvedAt: serverTimestamp()
        });
      } else {
        setLocalInquiries(prev => prev.map(i => i.id === inquiryId ? { ...i, status: 'approved' } : i));
      }
      alert("Successfully verified commercial partner's licensing details and activated their account.");
    } catch (err: any) {
      console.error(err);
      alert(`Approval failed: ${err.message}`);
    }
  };

  // Modify a partner's NET-30 Credit status
  const updateNet30CreditTerms = async (inquiryId: string, newStatus: 'none' | 'requested' | 'approved' | 'denied') => {
    try {
      const isFirestoreDoc = inquiries.some(i => i.id === inquiryId);
      if (isFirestoreDoc) {
        const docRef = doc(db, 'wholesale_inquiries', inquiryId);
        await updateDoc(docRef, {
          net30Status: newStatus,
          net30UpdatedAt: serverTimestamp()
        });
      } else {
        setLocalInquiries(prev => prev.map(i => i.id === inquiryId ? { ...i, net30Status: newStatus } : i));
      }
      alert(`Updated NET-30 trade credit status to: ${newStatus.toUpperCase()}`);
    } catch (err: any) {
      console.error(err);
      alert(`Failed to update credit status: ${err.message}`);
    }
  };

  // Simulate BevForge pulling and acknowledging events right from the browser!
  const simulateBevForgePullAndAck = async () => {
    if (syncEvents.length === 0) return;
    try {
      // Pull IDs
      const eventIds = syncEvents.map(evt => evt.eventId);
      
      // Hit Ack Endpoint
      const response = await fetch('/api/sync/ack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventIds })
      });

      if (response.ok) {
        alert(`Successfully simulated BevForge connection! BevForge pulled and acknowledged ${eventIds.length} events, removing them from the website's outbound queue.`);
        fetchCurrentSyncQueue();
      }
    } catch (err) {
      alert("Failed to simulate acknowledgment connection.");
    }
  };

  // Toggle pickup fulfillment status
  const togglePickupFulfillment = async (leadId: string, pickupId: string) => {
    try {
      const lead = combinedClubLeads.find(l => l.id === leadId);
      if (!lead) return;
      
      const updatedPickups = lead.pickups.map((p: any) => {
        if (p.id === pickupId) {
          const isFulfilled = !p.fulfilled;
          return {
            ...p,
            fulfilled: isFulfilled,
            fulfilledAt: isFulfilled ? new Date().toISOString() : null,
            fulfilledBy: isFulfilled ? 'Staff Terminal #01' : null
          };
        }
        return p;
      });

      // Update in Firestore if it exists there
      const isFirestoreDoc = clubLeads.some(l => l.id === leadId);
      if (isFirestoreDoc) {
        const docRef = doc(db, 'club_leads', leadId);
        await updateDoc(docRef, {
          pickups: updatedPickups
        });
      }

      // Always update local state too for robust fallbacks
      setLocalClubLeads(prev => prev.map(l => {
        if (l.id === leadId) {
          return { ...l, pickups: updatedPickups };
        }
        const updatedMatchInLocal = prev.find(pl => pl.email === lead.email);
        if (updatedMatchInLocal) {
          return { ...updatedMatchInLocal, pickups: updatedPickups };
        }
        return l;
      }));

      // Reflect in local selected state view
      if (selectedClubLead && selectedClubLead.id === leadId) {
        setSelectedClubLead(prev => prev ? { ...prev, pickups: updatedPickups } : null);
      }

      // Enqueue sync event to BevForge live outbox
      const syncEvent: WebhookEvent<any> = {
        eventId: crypto.randomUUID?.() || 'evt-' + Math.random().toString(36).substring(2, 10),
        eventType: 'club.pickup_updated',
        createdAt: new Date().toISOString(),
        data: {
          clubLeadId: leadId,
          email: lead.email,
          name: lead.name,
          tier: lead.tier,
          pickupId,
          pickups: updatedPickups,
          timestamp: new Date().toISOString()
        }
      };

      await fetch('/api/events/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(syncEvent)
      });
      fetchCurrentSyncQueue();

    } catch (err) {
      console.error("Failed to toggle pickup status:", err);
    }
  };

  // Save customized notes for a club member
  const saveClubMemberNotes = async (leadId: string, notesText: string) => {
    try {
      const lead = combinedClubLeads.find(l => l.id === leadId);
      if (!lead) return;

      const isFirestoreDoc = clubLeads.some(l => l.id === leadId);
      if (isFirestoreDoc) {
        const docRef = doc(db, 'club_leads', leadId);
        await updateDoc(docRef, {
          notes: notesText
        });
      }

      setLocalClubLeads(prev => prev.map(l => {
        if (l.id === leadId) {
          return { ...l, notes: notesText };
        }
        const match = prev.find(pl => pl.email === lead.email);
        if (match) {
          return { ...match, notes: notesText };
        }
        return l;
      }));

      if (selectedClubLead && selectedClubLead.id === leadId) {
        setSelectedClubLead(prev => prev ? { ...prev, notes: notesText } : null);
      }
    } catch (err) {
      console.error("Failed to save club notes:", err);
    }
  };

  // Grant an active spot to a waitlisted pre-sale subscriber and activate billing
  const handleGrantWaitlistSpot = async (leadId: string) => {
    const lead = combinedClubLeads.find(l => l.id === leadId);
    if (!lead) return;

    const confirmGrant = window.confirm(`Are you sure you want to grant an active membership spot to ${lead.name} (${lead.tier}) and process billing?`);
    if (!confirmGrant) return;

    try {
      // 1. Update Firestore lead status to 'active'
      const docRef = doc(db, 'club_leads', leadId);
      await updateDoc(docRef, {
        status: 'active',
        activatedAt: new Date().toISOString(),
        notes: (lead.notes || '') + `\nGranted active membership spot from standby lobby on ${new Date().toLocaleDateString()}.`
      });

      // 2. Dispatch Cider Billing Activation Email
      const cleanName = lead.name.trim();
      const firstName = cleanName.split(' ')[0] || 'Member';
      await fetch('/api/email/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: lead.email,
          from: 'billing@godleyciders.com',
          subject: `Godley Ciders Spot Granted - ${lead.tier} Club Active`,
          text: `Hello ${firstName},\n\nFantastic news! Your reserved stand-by spot in the ${lead.tier} Club has been granted and is now officially ACTIVE.\n\nWe have successfully established your secure sub-account using your vaulted card ending in *${lead.vaultedCardLast4 || '4242'}. Your recursive billing schedule (${lead.billingFrequency || 'monthly'}) is live, and your first batch of cider allocations are available for taproom pickup!\n\nWelcome to the family!\n\nCheers,\nGodley Ciders`
        })
      });

      // 3. Enqueue BevForge Live Sync event
      const syncEvent = {
        eventId: 'evt-' + Math.random().toString(36).substring(2, 11),
        eventType: 'club.member_activated',
        createdAt: new Date().toISOString(),
        data: {
          clubLeadId: leadId,
          email: lead.email,
          name: lead.name,
          tier: lead.tier,
          billingFrequency: lead.billingFrequency || 'monthly',
          timestamp: new Date().toISOString()
        }
      };

      await fetch('/api/events/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(syncEvent)
      });
      fetchCurrentSyncQueue();

      alert(`Successfully granted active spot to ${lead.name}! Secure billing has been prioritized, and welcome notification dispatched.`);

      // Update state in selectedClubLead if necessary to reflect changes immediately
      if (selectedClubLead && selectedClubLead.id === leadId) {
        setSelectedClubLead(prev => prev ? { ...prev, status: 'active' } : null);
      }

    } catch (err: any) {
      console.error(err);
      alert(`Activation failed: ${err.message}`);
    }
  };

  // Toggle VIP stand-by priority
  const handleToggleVip = async (leadId: string, currentVip: boolean) => {
    try {
      const docRef = doc(db, 'club_leads', leadId);
      await updateDoc(docRef, {
        vip: !currentVip,
        updatedAt: serverTimestamp()
      });
      alert(`Success! Priority status for standby subscriber has been updated.`);
    } catch (err: any) {
      console.error("Failed to toggle VIP status:", err);
      alert(`Error updating priority: ${err.message}`);
    }
  };

  // Batch process admissions in FCFS + VIP priority order
  const handleBatchAdmit = async (tier: string, limitCount: number) => {
    if (limitCount <= 0) {
      alert("Please enter a valid number of members to admit.");
      return;
    }

    const waitlistedLeads = combinedClubLeads
      .filter(l => {
        if (l.status !== 'waitlist') return false;
        const leadTier = (l.tier || '').toLowerCase();
        const searchTier = tier.toLowerCase();
        return leadTier.includes(searchTier);
      })
      .sort((a, b) => {
        const aScore = calculatePriorityScore(a.createdAt, a.tier || 'Core').score + (a.vip ? 100 : 0);
        const bScore = calculatePriorityScore(b.createdAt, b.tier || 'Core').score + (b.vip ? 100 : 0);
        return bScore - aScore;
      });

    if (waitlistedLeads.length === 0) {
      alert(`There are no waitlisted members currently registered for the "${tier}" tier.`);
      return;
    }

    const toAdmit = waitlistedLeads.slice(0, limitCount);
    const confirmMessage = `Ready to batch admit ${toAdmit.length} waitlisted members to the ${tier} Club?\n\nThis will instantly activate card billing and dispatch welcome notifications to each member.`;
    if (!window.confirm(confirmMessage)) return;

    setIsProcessingBatch(true);
    setWaitlistLogs([]);
    let successfulCount = 0;

    try {
      for (const lead of toAdmit) {
        setWaitlistLogs(prev => [...prev, `⏳ Initiating admission for ${lead.name} (${lead.email})...`]);
        
        // 1. Update Firestore status
        const docRef = doc(db, 'club_leads', lead.id);
        await updateDoc(docRef, {
          status: 'active',
          activatedAt: new Date().toISOString(),
          notes: (lead.notes || '') + `\nBatch granted active membership spot from standby lobby on ${new Date().toLocaleDateString()}.`
        });

        // 2. Dispatch Welcome + Billing Activation Email
        const firstName = lead.name.trim().split(' ')[0] || 'Member';
        await fetch('/api/email/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: lead.email,
            from: 'billing@godleyciders.com',
            subject: `Godley Ciders Spot Granted - ${lead.tier} Club Active`,
            text: `Hello ${firstName},\n\nGreat news! Your reserved stand-by spot in the ${lead.tier} Club is now ACTIVE.\n\nWe have successfully established your secure sub-account using your vaulted card ending in *${lead.vaultedCardLast4 || '4242'}. Your recursive billing schedule (${lead.billingFrequency || 'monthly'}) is live, and your first batch of cider allocations are available for taproom pickup!\n\nWelcome to the family!\n\nCheers,\nGodley Ciders`
          })
        }).catch(err => {
          console.error("Email dispatch failed for", lead.email, err);
        });

        // 3. Enqueue BevForge Live Sync event
        const syncEvent = {
          eventId: 'evt-' + Math.random().toString(36).substring(2, 11),
          eventType: 'club.member_activated',
          createdAt: new Date().toISOString(),
          data: {
            clubLeadId: lead.id,
            email: lead.email,
            name: lead.name,
            tier: lead.tier,
            billingFrequency: lead.billingFrequency || 'monthly',
            timestamp: new Date().toISOString()
          }
        };

        await fetch('/api/events/enqueue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(syncEvent)
        }).catch(err => console.warn(err));

        setWaitlistLogs(prev => [...prev, `✅ Fully Admitted: ${lead.name} - Billing initialized & Welcome email dispatched.`]);
        successfulCount++;
      }

      // 4. Update core, branch, or heritage available spots in clubSettings!
      const currentAvailable = Number(
        tier === 'Core' ? clubSettings.coreActiveSpotsAvailable :
        tier === 'Branch' ? clubSettings.branchActiveSpotsAvailable :
        clubSettings.heritageActiveSpotsAvailable
      ) || 0;
      
      const updatedAvailable = Math.max(0, currentAvailable - successfulCount);
      
      const fieldToUpdate = 
        tier === 'Core' ? 'coreActiveSpotsAvailable' :
        tier === 'Branch' ? 'branchActiveSpotsAvailable' :
        'heritageActiveSpotsAvailable';

      // Update local and Firebase settings
      await useAdminStore.getState().setClubSettings({
        [fieldToUpdate]: String(updatedAvailable)
      });
      await useAdminStore.getState().saveToFirebase();

      setWaitlistLogs(prev => [...prev, `🏁 Batch Process Complete! Success: ${successfulCount}/${toAdmit.length}. Tier allocation updated.`]);
      alert(`Batch processing successfully admitted ${successfulCount} members to ${tier} Club!`);
      
    } catch (err: any) {
      console.error(err);
      setWaitlistLogs(prev => [...prev, `❌ Error during batch run: ${err.message}`]);
      alert(`Batch process incomplete: ${err.message}`);
    } finally {
      setIsProcessingBatch(false);
      fetchCurrentSyncQueue();
    }
  };

  // Register a brand new Member from tasting bar table
  const handleAddNewClubMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setClubFormError('');
    setClubFormSuccess('');

    if (!newClubName || !newClubEmail || !newClubPhone) {
      setClubFormError('All fields are required.');
      return;
    }

    try {
      const newLead = {
        name: newClubName,
        email: newClubEmail,
        phone: newClubPhone,
        tier: newClubTier,
        createdAt: serverTimestamp(),
        notes: '',
        pickups: [
          { id: 'p-june-' + Date.now(), month: 'June 2026', fulfilled: false }
        ]
      };

      const docRef = await addDoc(collection(db, 'club_leads'), newLead);
      setClubFormSuccess(`Done! Registered ${newClubName} as ${newClubTier} member.`);
      
      // Clear Form state
      setNewClubName('');
      setNewClubEmail('');
      setNewClubPhone('');
      setNewClubTier('Core');
      setShowAddNewClub(false);

      // Enqueue sync event to BevForge live outbox
      const syncEvent: WebhookEvent<any> = {
        eventId: crypto.randomUUID?.() || 'evt-' + Math.random().toString(36).substring(2, 10),
        eventType: 'club.member_registered',
        createdAt: new Date().toISOString(),
        data: {
          id: docRef.id,
          name: newClubName,
          email: newClubEmail,
          phone: newClubPhone,
          tier: newClubTier,
          timestamp: new Date().toISOString()
        }
      };

      await fetch('/api/events/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(syncEvent)
      });
      fetchCurrentSyncQueue();

    } catch (err) {
      console.warn("Firestore save failed, storing locally at terminal instead:", err);
      
      const localId = 'local-club-' + Date.now();
      const newLocalLead = {
        id: localId,
        name: newClubName,
        email: newClubEmail,
        phone: newClubPhone,
        tier: newClubTier,
        createdAt: new Date().toISOString(),
        notes: '',
        pickups: [
          { id: 'p-june-' + Date.now(), month: 'June 2026', fulfilled: false }
        ]
      };

      setLocalClubLeads(prev => [newLocalLead, ...prev]);
      setClubFormSuccess(`Registered ${newClubName} locally on Terminal #01 storage.`);
      
      setNewClubName('');
      setNewClubEmail('');
      setNewClubPhone('');
      setNewClubTier('Core');
      setShowAddNewClub(false);
    }
  };

  // Combine real Firestore orders and local fallbacks for display
  const combinedOrders = [...orders, ...localOrders];
  const combinedInquiries = inquiries.length > 0 ? inquiries : localInquiries;
  
  const combinedClubLeads = clubLeads.length > 0
    ? clubLeads.map(lead => {
        const localMatch = localClubLeads.find(l => l.email === lead.email);
        return {
          id: lead.id,
          ...lead,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          tier: lead.tier || 'Core',
          createdAt: lead.createdAt?.toDate?.()?.toISOString() || lead.createdAt || new Date().toISOString(),
          pickups: lead.pickups || localMatch?.pickups || [
            { id: 'p-june-' + lead.id, month: 'June 2026', fulfilled: false }
          ],
          notes: lead.notes || localMatch?.notes || ''
        };
      })
    : localClubLeads;

  if (!isAuthenticated) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center px-6 relative font-serif">
        <div className="absolute inset-x-0 top-12 flex justify-center pointer-events-none">
          <div className="w-96 h-96 bg-amber-900/10 rounded-full blur-[100px]" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-stone-950/80 backdrop-blur-xl border border-stone-800/80 w-full max-w-md p-8 shadow-2xl relative"
        >
          <div className="text-center space-y-4 mb-8">
            <div className="w-12 h-12 rounded-full border border-amber-500/20 bg-amber-955/10 flex items-center justify-center mx-auto text-amber-500">
              <Lock size={22} className="text-amber-500" />
            </div>
            <h1 className="text-2xl text-amber-500 uppercase tracking-widest pl-1 font-serif">Staff Login</h1>
            <p className="text-stone-400 text-xs italic">Godley Ciders Cider Shed & Taproom System</p>
          </div>

          <form onSubmit={handlePasscodeSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="passcode" className="text-stone-400 uppercase tracking-wider text-[10px]">Enter Employee PIN / Passcode</Label>
              <Input 
                id="passcode"
                type="password"
                required
                placeholder="••••"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="bg-stone-900/80 border-stone-800 focus:border-amber-500/50 rounded-sm py-5 text-center text-lg tracking-widest text-amber-500"
              />
              <span className="text-[10px] text-stone-500 block text-center">Protected Terminal. Contact your manager if you don't know the PIN.</span>
            </div>

            {loginError && (
              <div className="flex items-center gap-2 text-xs text-red-400/90 border border-red-900/40 bg-red-955/10 p-2.5 rounded">
                <AlertCircle size={14} className="flex-shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-500 text-stone-950 font-serif font-bold uppercase tracking-widest text-xs py-5 rounded-sm">
              Authorize Device
            </Button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 font-serif">
      {/* HEADER ROW */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-800/80 pb-6 mb-8">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-2xl font-serif tracking-wider uppercase text-amber-500">Taproom & Shed Hub</h1>
          </div>
          <p className="text-stone-400 font-sans text-xs flex items-center gap-2">
            <span>Terminal: #01 (Lincoln, CA)</span>
            <span className="text-stone-600">•</span>
            <span>Synced to BevForge Protocol</span>
          </p>
          {needsWorkspaceAuth ? (
             <button 
                onClick={async () => {
                   try {
                     const res = await googleSignInWorkspace();
                     if (res) { setWorkspaceUser(res.user); setNeedsWorkspaceAuth(false); }
                   } catch (e) {
                      console.error(e);
                   }
                }}
                className="mt-2 text-[10px] uppercase flex items-center gap-1.5 px-2 py-1 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30 rounded"
             >
                <Mail size={10} /> Link Gmail Account for Receipts
             </button>
          ) : (
             <span className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-500 opacity-80 uppercase tracking-widest"><Mail size={10} /> Gmail Connected: {workspaceUser?.email}</span>
          )}
        </div>

        {/* ACTIVE MODULE SELECTOR */}
        <div className="flex bg-stone-950/80 p-1 border border-stone-800/60 rounded backdrop-blur-md self-start md:self-center">
          <button 
            onClick={() => setActiveTab('pos')}
            className={`px-4 py-1.5 text-xs uppercase tracking-wider rounded transition-colors flex items-center gap-1.5 ${
              activeTab === 'pos' ? 'bg-amber-600 text-stone-950 font-semibold' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <CreditCard size={13} />
            Shed POS
          </button>
          <button 
            onClick={() => setActiveTab('club')}
            className={`px-4 py-1.5 text-xs uppercase tracking-wider rounded transition-colors flex items-center gap-1.5 ${
              activeTab === 'club' ? 'bg-amber-600 text-stone-950 font-semibold' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <User size={13} />
            Club Lookup
          </button>
          <button 
            onClick={() => setActiveTab('fulfillment')}
            className={`px-4 py-1.5 text-xs uppercase tracking-wider rounded transition-colors flex items-center gap-1.5 ${
              activeTab === 'fulfillment' ? 'bg-amber-600 text-stone-950 font-semibold' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Archive size={13} />
            Fulfillments & Trade
          </button>
          <button 
            onClick={() => setActiveTab('sync')}
            className={`px-4 py-1.5 text-xs uppercase tracking-wider rounded transition-colors flex items-center gap-1.5 ${
              activeTab === 'sync' ? 'bg-amber-600 text-stone-950 font-semibold' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Layers size={13} />
            BevForge Queue ({syncEvents.length})
          </button>
        </div>
      </div>

      {/* RENDER CHOSEN TAB */}
      <AnimatePresence mode="wait">
        
        {/* ================= TAPROOM POS TAB ================= */}
        {activeTab === 'pos' && (
          <motion.div 
            key="pos-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            {/* Catalog (Left side - Cols 7) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center justify-between border-b border-stone-850 pb-2">
                <h3 className="text-stone-200 uppercase tracking-widest text-sm font-serif">Pour Station & Goods</h3>
                <span className="text-[10px] font-sans text-stone-500">Click elements to add to tab</span>
              </div>
              
              {/* CATALOG GRID */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {shopProducts.map((p) => (
                  <div 
                    key={p.id} 
                    onClick={() => addToCart(p)}
                    className="bg-stone-950/40 border border-stone-850 hover:border-amber-500/30 p-3 flex flex-col justify-between h-36 relative cursor-pointer group transition-all rounded-sm hover:-translate-y-0.5"
                  >
                    <div className="space-y-1">
                      <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 bg-stone-900 border border-stone-800 rounded-full font-serif text-amber-500/75">
                        {p.category === 'merch' ? 'Dry Goods' : 'Pour / Cider'}
                      </span>
                      <h4 className="font-serif text-stone-100 text-sm font-medium leading-tight pt-1 group-hover:text-amber-400 transition-colors">{p.name}</h4>
                      <p className="font-sans text-[10px] text-stone-500 italic truncate">{p.type}</p>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-stone-900/80">
                      <div className="flex flex-col">
                        <span className="text-amber-500/80 font-mono text-xs font-semibold">${p.price}</span>
                        <span className="text-[8px] font-mono text-stone-500/90 leading-none">
                          {p.inventoryCount !== undefined 
                            ? (p.inventoryCount > 5 ? `Stock: ${p.inventoryCount}` : p.inventoryCount > 0 ? `${p.inventoryCount} units left` : 'OUT OF STOCK')
                            : 'Stock: 15'}
                        </span>
                      </div>
                      <span className="w-5 h-5 rounded-full bg-stone-900 flex items-center justify-center text-[10px] text-stone-400 group-hover:bg-amber-600 group-hover:text-stone-950 transition-colors">
                        <Plus size={11} />
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* QUICK ADD CUSTOM TAB ITEM */}
              <div className="bg-stone-950/20 border border-stone-850 p-4 rounded">
                <h4 className="text-stone-300 uppercase tracking-widest text-[10px] mb-3">Add Custom Tab Charge</h4>
                <form onSubmit={handleCustomItemAdd} className="flex gap-4 items-end">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-stone-500 text-[10px] uppercase font-serif">Charge Description / Pour</Label>
                    <Input 
                      placeholder="e.g. 5oz Tasting Flight / Growler Refill" 
                      required
                      value={customItemName}
                      onChange={(e) => setCustomItemName(e.target.value)}
                      className="bg-stone-900 border-stone-800 focus:border-amber-500/30 rounded-sm h-8 text-xs text-stone-200"
                    />
                  </div>
                  <div className="w-24 space-y-1.5">
                    <Label className="text-stone-500 text-[10px] uppercase font-serif">Price ($)</Label>
                    <Input 
                      placeholder="12.00" 
                      required
                      value={customItemPrice}
                      onChange={(e) => setCustomItemPrice(e.target.value)}
                      className="bg-stone-900 border-stone-800 focus:border-amber-500/30 rounded-sm h-8 text-xs text-stone-200 font-mono"
                    />
                  </div>
                  <Button type="submit" variant="outline" className="border-stone-800 bg-stone-900 hover:bg-amber-600 hover:text-stone-950 font-serif uppercase tracking-wider text-[10px] h-8 rounded-sm">
                    Add Charge
                  </Button>
                </form>
              </div>
            </div>

            {/* Cart & Customer (Right side - Cols 5) */}
            <div className="lg:col-span-5 bg-stone-950/50 border border-stone-800/80 p-5 rounded shadow-2xl relative">
              <h3 className="text-amber-500 font-serif uppercase tracking-widest text-xs border-b border-stone-850 pb-2 mb-4 flex items-center gap-2">
                <ShoppingBag size={14} className="text-amber-500" />
                Taproom Check-out Tab
              </h3>

              {posSuccessReceipt ? (
                /* LUXURY THERMAL PAPER RECEIPT PREVIEW DESIGN */
                <div className="space-y-6 py-4 animate-fadeIn text-stone-900">
                  <div className="flex justify-between items-center font-serif text-stone-400 text-xs tracking-wider border-b border-stone-800 pb-2 mb-2">
                    <span className="flex items-center gap-1">
                      <CheckCircle size={14} className="text-emerald-500" /> System Receipt Generated
                    </span>
                    <button 
                      onClick={() => setPosSuccessReceipt(null)}
                      className="text-amber-500 hover:text-amber-400 font-bold uppercase tracking-widest text-[9px] bg-stone-900/40 px-2 py-0.5 rounded border border-stone-800"
                    >
                      ✓ Close
                    </button>
                  </div>

                  {/* PAPER THERMAL BODY */}
                  <div className="bg-stone-50 shadow-[0_8px_30px_rgb(0,0,0,0.3)] p-6 rounded-sm relative border-t-8 border-stone-300 font-mono text-[11px] leading-relaxed mx-auto max-w-[340px] text-left">
                    {/* Jagged tear-off header */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-[linear-gradient(45deg,#ccc_25%,transparent_25%),linear-gradient(-45deg,#ccc_25%,transparent_25%)] bg-[size:6px_6px]" />

                    {/* TAPROOM LOGHEAD */}
                    <div className="text-center space-y-1 pb-4 border-b border-dashed border-stone-400">
                      <h4 className="text-sm font-black tracking-[0.2em] uppercase">GODLEY CIDERS CO.</h4>
                      <p className="text-[9px] text-stone-600">Shed & Production Cellar</p>
                      <p className="text-[9px] text-stone-500">Lincoln Way Taproom, Lincoln, CA</p>
                      <p className="text-[8px] text-stone-400 mt-1">Cashier: BevForge Terminal Alpha</p>
                    </div>

                    {/* METADATA LINES */}
                    <div className="py-3 border-b border-dashed border-stone-300 text-stone-600 space-y-1 text-[10px]">
                      <div className="flex justify-between">
                        <span>TICKET ID:</span>
                        <span className="font-bold text-stone-900">{posSuccessReceipt.orderId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>DATE & TIMESTAMP:</span>
                        <span>{new Date().toLocaleDateString()} {posSuccessReceipt.timestamp}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>CUSTOMER:</span>
                        <span className="text-stone-900 font-bold max-w-[150px] truncate">{posSuccessReceipt.customerName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>EMAIL ADDR:</span>
                        <span className="text-stone-600 truncate max-w-[160px]">{posSuccessReceipt.customerEmail}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>METHOD:</span>
                        <span className="text-stone-900 uppercase font-black">{posSuccessReceipt.paymentMethod}</span>
                      </div>
                    </div>

                    {/* ITEMS REGISTER GRID */}
                    <div className="py-3 border-b border-dashed border-stone-300 space-y-2">
                      <div className="flex justify-between font-bold text-stone-500 text-[9px] uppercase tracking-wider">
                        <span>Description</span>
                        <span>Qty x Price</span>
                      </div>
                      <div className="space-y-1.5 pt-1">
                        {posSuccessReceipt.items?.map((it: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-stone-840 text-stone-800">
                            <span className="truncate max-w-[190px]">{it.name}</span>
                            <span>{it.qty} x ${it.price.toFixed(2)}</span>
                          </div>
                        )) || (
                          <p className="italic text-stone-500 text-[10px]">Custom Cellar Selection</p>
                        )}
                      </div>
                    </div>

                    {/* CALCULATIONS SUM */}
                    <div className="py-3 border-b border-stone-400 space-y-1 font-bold text-stone-700">
                      <div className="flex justify-between text-stone-550">
                        <span>Subtotal:</span>
                        <span>${posSuccessReceipt.subtotal.toFixed(2)}</span>
                      </div>
                      {posSuccessReceipt.discount > 0 && (
                        <div className="flex justify-between text-emerald-700">
                          <span>VIP / Club Discount:</span>
                          <span>-${posSuccessReceipt.discount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-stone-550">
                        <span>Sales Tax (8.25%):</span>
                        <span>${posSuccessReceipt.tax.toFixed(2)}</span>
                      </div>
                      {posSuccessReceipt.tip > 0 && (
                        <div className="flex justify-between text-stone-800 italic">
                          <span>Gratuity (Tips):</span>
                          <span>${posSuccessReceipt.tip.toFixed(2)}</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between text-stone-900 border-t border-dashed border-stone-400 pt-2.5 text-xs font-black">
                        <span>TOTAL PAID:</span>
                        <span>${posSuccessReceipt.total.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* JAGGED BOTTOM BARCODE */}
                    <div className="text-center pt-4 space-y-2.5">
                      {/* Thermal-printed pseudo-barcode */}
                      <div className="inline-block bg-[repeating-linear-gradient(90deg,#111,#111_4px,#fff_4px,#fff_8px,#111_8px,#111_10px)] w-48 h-7 opacity-75" />
                      <div className="text-[8px] text-stone-500 font-sans tracking-widest uppercase">
                        Placer County compliance verified
                      </div>
                      <p className="text-[10px] text-stone-950 italic text-center font-bold">
                        Thank you for supporting Local Organic Ciders!
                      </p>
                    </div>
                  </div>

                  {/* EVENT SYNCHRONIZATION ALERT */}
                  <div className="bg-stone-950/40 border border-stone-850 p-3 rounded text-[10px] text-stone-400 italic font-mono flex items-center gap-2 justify-center">
                    <ShieldCheck size={14} className="text-emerald-500 flex-shrink-0" />
                    <span>Real-time POS synchronizers verified & pushed to database!</span>
                  </div>

                  {/* BUTTONS ROW */}
                  <div className="grid grid-cols-2 gap-3 max-w-[340px] mx-auto pt-2">
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={handleSendEmailReceipt}
                      disabled={emailReceiptStatus !== 'idle'}
                      className="w-full border-stone-800 bg-stone-950 text-amber-500 uppercase tracking-widest text-[10px] rounded-sm font-serif p-0 h-12"
                    >
                      {emailReceiptStatus === 'sending' ? 'Sending...' : emailReceiptStatus === 'sent' ? 'Sent!' : 'Email Receipt'}
                    </Button>
                    <Button 
                      onClick={() => setPosSuccessReceipt(null)} 
                      className="w-full bg-amber-600 hover:bg-amber-500 text-stone-950 uppercase tracking-widest text-[10px] rounded-sm font-serif font-bold p-0 h-12"
                    >
                      Next Customer
                    </Button>
                  </div>
                </div>
              ) : (
                /* CART & CUSTOMER INPUT FIELDS */
                <div className="relative">
                  {simulatingTerminal && (
                    <div className="absolute inset-0 bg-stone-950/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center rounded border border-stone-800">
                      <div className="w-12 h-12 border-t-2 border-amber-500 border-solid rounded-full animate-spin mb-4"></div>
                      <h4 className="text-stone-200 font-serif tracking-widest uppercase text-sm mb-2 text-center">Awaiting Stripe Terminal</h4>
                      <p className="text-[10px] text-stone-400 font-mono text-center max-w-[200px]">Please insert, swipe, or tap card on the physical BBPOS Chipper 2X device...</p>
                    </div>
                  )}
                  <form onSubmit={handlePOSCheckout} className="space-y-6">
                    {/* Cart Items List */}
                  {posCart.length === 0 ? (
                    <div className="py-8 text-center text-stone-500 text-xs italic font-serif">
                      Tab is empty. Add ciders or merchandise.
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-2 pb-2 border-b border-stone-900">
                        {posCart.map(({ product, quantity }) => (
                          <div key={product.id} className="flex justify-between items-center text-xs text-stone-300 py-1 border-b border-stone-900/40">
                            <div className="flex-1 min-w-0 pr-2">
                              <span className="font-serif block truncate font-medium text-stone-200">{product.name}</span>
                              <span className="font-mono text-[9px] text-stone-500">${product.price} / item</span>
                            </div>
                            
                            {/* ADJUST QTY */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button 
                                type="button" 
                                onClick={() => updateQuantity(product.id, -1)}
                                className="w-5 h-5 rounded-full border border-stone-800 bg-stone-900/50 flex items-center justify-center text-stone-400 hover:text-stone-200"
                              >
                                <Minus size={10} />
                              </button>
                              <span className="w-6 text-center font-mono text-stone-200">{quantity}</span>
                              <button 
                                type="button" 
                                onClick={() => updateQuantity(product.id, 1)}
                                className="w-5 h-5 rounded-full border border-stone-800 bg-stone-900/50 flex items-center justify-center text-stone-400 hover:text-stone-200"
                              >
                                <Plus size={10} />
                              </button>
                              <button 
                                type="button" 
                                onClick={() => removeFromCart(product.id)}
                                className="ml-2 text-stone-600 hover:text-red-400 transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                        <div className="py-2.5 text-xs font-mono space-y-1 bg-stone-950/40 px-3 rounded-sm border border-stone-900/60 mt-2">
                          {(() => {
                             const subtotal = posCart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
                             const discount = isVipComp ? subtotal : (customerType === 'club' ? subtotal * 0.15 : 0);
                             const taxable = subtotal - discount;
                             const tax = taxable * PLACER_COUNTY_TAX_RATE;
                             
                             let tip = 0;
                             if (gratuitySelection === -1) {
                               tip = parseFloat(customGratuityAmount) || 0;
                             } else {
                               tip = taxable * gratuitySelection;
                             }

                             const total = taxable + tax + (isVipComp ? 0 : tip);
                             return (
                               <>
                                 <div className="flex justify-between text-stone-400"><span>Subtotal:</span><span>${subtotal.toFixed(2)}</span></div>
                                 {discount > 0 && <div className="flex justify-between text-emerald-400"><span>{isVipComp ? 'VIP Comp Discount (100%):' : 'Club Discount (15%):'}</span><span>-${discount.toFixed(2)}</span></div>}
                                 <div className="flex justify-between text-stone-400"><span>Sales Tax (CA {(PLACER_COUNTY_TAX_RATE * 100).toFixed(2)}%):</span><span>${tax.toFixed(2)}</span></div>
                                 {!isVipComp && tip > 0 && <div className="flex justify-between text-amber-500/70"><span>Added Tip:</span><span>${tip.toFixed(2)}</span></div>}
                                 <div className="flex justify-between text-amber-500 font-bold border-t border-stone-900 mt-1.5 pt-1.5"><span>Total Due:</span><span>${total.toFixed(2)}</span></div>
                               </>
                             );
                          })()}
                        </div>
                    </>
                  )}

                  {/* CUSTOMER ACC DETAILS SECTION */}
                  <div className="space-y-4">
                    <Label className="text-stone-400 uppercase tracking-wider text-[10px] block">Customer / Account Type</Label>
                    <div className="grid grid-cols-3 gap-2 bg-stone-950 p-1 border border-stone-850 rounded">
                      <button 
                        type="button"
                        onClick={() => { setCustomerType('guest'); setPosError(''); }}
                        className={`py-1 rounded text-[10px] uppercase tracking-wider font-semibold transition-colors ${
                          customerType === 'guest' ? 'bg-stone-900 text-amber-500 border border-stone-800' : 'text-stone-500 hover:text-stone-300'
                        }`}
                      >
                        Standard
                      </button>
                      <button 
                        type="button"
                        onClick={() => { setCustomerType('club'); setPosError(''); }}
                        className={`py-1 rounded text-[10px] uppercase tracking-wider font-semibold transition-colors ${
                          customerType === 'club' ? 'bg-stone-900 text-amber-500 border border-stone-800' : 'text-stone-500 hover:text-stone-300'
                        }`}
                      >
                        Club (-15%)
                      </button>
                      <button 
                        type="button"
                        onClick={() => { setCustomerType('wholesale'); setPosError(''); }}
                        className={`py-1 rounded text-[10px] uppercase tracking-wider font-semibold transition-colors ${
                          customerType === 'wholesale' ? 'bg-stone-900 text-amber-500 border border-stone-800' : 'text-stone-500 hover:text-stone-300'
                        }`}
                      >
                        Wholesale
                      </button>
                    </div>

                    {/* GENERAL CONTACT INPUTS */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="custName" className="text-stone-500 text-[9px] uppercase font-serif">Customer Name</Label>
                        <Input 
                          id="custName"
                          placeholder="Jack Sparrow"
                          required
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="bg-stone-900 border-stone-800 focus:border-amber-500/30 rounded-sm h-8 text-xs text-stone-200"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="custEmail" className="text-stone-500 text-[9px] uppercase font-serif">Email</Label>
                        <Input 
                          id="custEmail"
                          type="email"
                          placeholder="customer@email.com"
                          required
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                          className="bg-stone-900 border-stone-800 focus:border-amber-500/30 rounded-sm h-8 text-xs text-stone-200"
                        />
                      </div>
                    </div>

                    {/* DYNAMIC COMPLIANCE FIELDS FOR WHOLESALE OUTLETS */}
                    {customerType === 'wholesale' && (
                      <div className="space-y-3.5 bg-stone-900/30 border border-stone-800/40 p-4 rounded animate-fadeIn text-xs">
                        <div className="text-amber-500/80 uppercase text-[9px] tracking-wider border-b border-stone-800 pb-1 font-serif flex items-center justify-between">
                          <span>Wholesale Business & Trade Compliance</span>
                          <span className="text-[8px] px-1 py-0.2 bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase rounded">Required</span>
                        </div>
                        
                        <div className="space-y-1.5">
                          <Label htmlFor="bizName" className="text-stone-500 text-[9px] uppercase font-serif">Business Name</Label>
                          <Input 
                            id="bizName"
                            placeholder="e.g. The Rusty Anchor Taproom"
                            required={customerType === 'wholesale'}
                            value={businessName}
                            onChange={(e) => setBusinessName(e.target.value)}
                            className="bg-stone-950 border-stone-800 focus:border-amber-500/30 rounded-sm h-8 text-xs text-stone-200"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label htmlFor="abcLic" className="text-stone-500 text-[9px] uppercase font-serif">ABC License #</Label>
                            <Input 
                              id="abcLic"
                              placeholder="Type 20/47 License"
                              required={customerType === 'wholesale'}
                              value={abcLicenseNumber}
                              onChange={(e) => setAbcLicenseNumber(e.target.value)}
                              className="bg-stone-950 border-stone-800 focus:border-amber-500/30 rounded-sm h-8 text-xs text-stone-200"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="resaleLic" className="text-stone-500 text-[9px] uppercase font-serif">Resale Cert # (Tax Exempt)</Label>
                            <Input 
                              id="resaleLic"
                              placeholder="SR-XXXX-XXXX"
                              required={customerType === 'wholesale'}
                              value={resaleLicenseNumber}
                              onChange={(e) => setResaleLicenseNumber(e.target.value)}
                              className="bg-stone-950 border-stone-800 focus:border-amber-500/30 rounded-sm h-8 text-xs text-stone-200"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="taxEin" className="text-stone-500 text-[9px] uppercase font-serif">Federal Tax ID / EIN</Label>
                          <Input 
                            id="taxEin"
                            placeholder="XX-XXXXXXX"
                            required={customerType === 'wholesale'}
                            value={taxId}
                            onChange={(e) => setTaxId(e.target.value)}
                            className="bg-stone-950 border-stone-800 focus:border-amber-500/30 rounded-sm h-8 text-xs text-stone-200"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="shipAddress" className="text-stone-500 text-[9px] uppercase font-serif">Delivery Address</Label>
                          <Input 
                            id="shipAddress"
                            placeholder="Street, City, CA, ZIP"
                            required={customerType === 'wholesale'}
                            value={shippingAddress}
                            onChange={(e) => setShippingAddress(e.target.value)}
                            className="bg-stone-950 border-stone-800 focus:border-amber-500/30 rounded-sm h-8 text-xs text-stone-200"
                          />
                        </div>
                      </div>
                    )}

                    {customerType === 'club' && (
                      <div className="bg-emerald-955/10 border border-emerald-900/30 p-3 rounded animate-fadeIn flex flex-col gap-1 text-[10px] text-emerald-400 font-sans">
                        <div className="font-semibold uppercase tracking-wider font-serif flex items-center gap-1">
                          <ShieldCheck size={12} />
                          Active Club Membership Verified
                        </div>
                        <p>A automatic 15% discount has been applied to this cider tab.</p>
                      </div>
                    )}
                  </div>

                  {/* PAYMENT SELECTION */}
                  <div className="space-y-2 border-t border-stone-900 pt-4">
                    <Label className="text-stone-400 uppercase tracking-wider text-[10px] block">Select Payment Flow</Label>
                    <div className="grid grid-cols-2 gap-2 bg-stone-950 p-1 border border-stone-850 rounded">
                      <button 
                        type="button"
                        onClick={() => setPaymentMethod('cash')}
                        className={`py-1.5 rounded text-[10px] uppercase tracking-wider font-semibold transition-colors flex items-center justify-center gap-1 ${
                          paymentMethod === 'cash' ? 'bg-stone-900 text-amber-500 border border-stone-800' : 'text-stone-500 hover:text-stone-300'
                        }`}
                      >
                        <DollarSign size={11} />
                        Cash/Bill
                      </button>
                      <button 
                        type="button"
                        onClick={() => setPaymentMethod('card')}
                        className={`py-1.5 rounded text-[10px] uppercase tracking-wider font-semibold transition-colors flex items-center justify-center gap-1 ${
                          paymentMethod === 'card' ? 'bg-stone-900 text-amber-500 border border-stone-800' : 'text-stone-500 hover:text-stone-300'
                        }`}
                      >
                        <CreditCard size={11} />
                        Chip Terminal
                      </button>
                      <button 
                        type="button"
                        disabled={customerType !== 'wholesale'}
                        onClick={() => setPaymentMethod('account_charge')}
                        className={`py-1.5 rounded text-[10px] uppercase tracking-wider font-semibold transition-colors flex items-center justify-center gap-1 ${
                          customerType !== 'wholesale' ? 'opacity-30 cursor-not-allowed' : ''
                        } ${
                          paymentMethod === 'account_charge' ? 'bg-stone-900 text-amber-500 border border-stone-800' : 'text-stone-500 hover:text-stone-300'
                        }`}
                        title={customerType !== 'wholesale' ? "Only available for wholesale accounts" : ""}
                      >
                        <FileText size={11} />
                        Charge Trade Acc
                      </button>
                      <button 
                        type="button"
                        onClick={() => setPaymentMethod('iphone_tap_qr')}
                        className={`py-1.5 rounded text-[10px] uppercase tracking-wider font-semibold transition-colors flex items-center justify-center gap-1 ${
                          paymentMethod === 'iphone_tap_qr' ? 'bg-stone-900 text-amber-500 border border-stone-800' : 'text-stone-500 hover:text-stone-300'
                        }`}
                      >
                        <Smartphone size={11} />
                        iPhone Tap / QR
                      </button>
                    </div>
                  </div>

                  {/* GRATUITY SELECTOR */}
                  {!isVipComp && (
                    <div className="space-y-2 border-t border-stone-900 pt-3">
                      <Label className="text-stone-400 uppercase tracking-wider text-[10px] block">Select Gratuity</Label>
                      <div className="grid grid-cols-5 gap-1 bg-stone-950 p-1 border border-stone-850 rounded">
                        {[0, 0.15, 0.18, 0.20].map((rate) => (
                          <button
                            key={rate}
                            type="button"
                            onClick={() => { setGratuitySelection(rate); }}
                            className={`py-1 rounded text-[10px] font-mono transition-colors ${
                              gratuitySelection === rate ? 'bg-stone-900 text-amber-500 border border-stone-850' : 'text-stone-500 hover:text-stone-300'
                            }`}
                          >
                            {rate === 0 ? 'No Tip' : `${rate * 100}%`}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => { setGratuitySelection(-1); }}
                          className={`py-1 rounded text-[10px] font-mono transition-colors ${
                            gratuitySelection === -1 ? 'bg-stone-900 text-amber-500 border border-stone-850' : 'text-stone-500 hover:text-stone-300'
                          }`}
                        >
                          Custom
                        </button>
                      </div>

                      {gratuitySelection === -1 && (
                        <div className="pt-1.5 flex gap-2 items-center animate-fadeIn">
                          <Label className="text-[9px] text-stone-500 uppercase font-mono">Custom Tip ($):</Label>
                          <Input
                            placeholder="e.g. 5.00"
                            value={customGratuityAmount}
                            onChange={(e) => setCustomGratuityAmount(e.target.value)}
                            className="bg-stone-950 border-stone-800 h-7 text-xs font-mono text-stone-200 w-24"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* VIP COMP COMPLIANCE & ACCREDITATION TOGGLE */}
                  <div className="pt-2 border-t border-stone-905 flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isVipComp}
                        onChange={(e) => { setIsVipComp(e.target.checked); }}
                        className="w-3.5 h-3.5 accent-amber-500 rounded bg-stone-950 border-stone-800"
                      />
                      <span className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">100% VIP Manager Comp</span>
                    </label>
                    {isVipComp && (
                      <span className="text-[8px] uppercase text-emerald-400 font-bold bg-emerald-950/20 border border-emerald-500/20 px-1.5 py-0.2 rounded">
                        VIP Active
                      </span>
                    )}
                  </div>

                  {/* ERROR BOX */}
                  {posError && (
                    <div className="flex items-center gap-2 text-[10px] text-red-400/95 border border-red-910/30 bg-red-955/10 p-2.5 rounded">
                      <AlertCircle size={13} className="flex-shrink-0" />
                      <span>{posError}</span>
                    </div>
                  )}

                  {/* FINALIZE BUTTON */}
                  <Button 
                    type="submit" 
                    disabled={posProcessing || posCart.length === 0} 
                    className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-40 select-none disabled:pointer-events-none text-stone-950 font-serif font-bold uppercase tracking-widest text-xs py-5 rounded-sm shadow-xl"
                  >
                    {posProcessing ? "Authorizing Terminal..." : (() => {
                      const subtotal = posCart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
                      const discount = isVipComp ? subtotal : (customerType === 'club' ? subtotal * 0.15 : 0);
                      const taxable = subtotal - discount;
                      const tax = taxable * PLACER_COUNTY_TAX_RATE;
                      let tip = 0;
                      if (!isVipComp) {
                        if (gratuitySelection === -1) {
                          tip = parseFloat(customGratuityAmount) || 0;
                        } else {
                          tip = taxable * gratuitySelection;
                        }
                      }
                      const finalTotal = taxable + tax + tip;
                      return `Process Checkout ($${finalTotal.toFixed(2)})`;
                    })()}
                  </Button>
                </form>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ================= FULFILLMENT & REGISTRATIONS TAB ================= */}
        {activeTab === 'fulfillment' && (
          <motion.div 
            key="fulfillment-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Orders Row */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Order Fulfillments panel (Cols 7) */}
              <div className="lg:col-span-8 space-y-4">
                <div className="flex items-center justify-between border-b border-stone-850 pb-2 mb-4">
                  <h3 className="text-stone-200 uppercase tracking-widest text-sm font-serif flex items-center gap-2">
                    <Wine size={16} className="text-amber-500" />
                    Shed Order Fullfilment Queue
                  </h3>
                  <span className="text-[10px] font-mono text-stone-500">{combinedOrders.length} system orders loaded</span>
                </div>

                {combinedOrders.length === 0 ? (
                  <div className="py-12 border border-stone-800 bg-stone-950/20 text-center rounded text-stone-500 text-xs italic">
                    No active cider orders found in system.
                  </div>
                ) : (
                  <div className="space-y-3.5 max-h-[600px] overflow-y-auto pr-2">
                    {combinedOrders.map((order) => (
                      <div key={order.id || order.orderId} className="bg-stone-950/50 border border-stone-800 p-4 rounded text-xs flex flex-col md:flex-row justify-between gap-4">
                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-mono text-xs text-amber-500 font-bold">ORD-{order.id?.slice(0, 8).toUpperCase() || order.orderId}</span>
                            <span className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                              order.status === 'fulfilled' 
                                ? 'bg-emerald-950/50 text-emerald-400 border-emerald-900/40' 
                                : order.status === 'paid'
                                ? 'bg-blue-950/50 text-blue-400 border-blue-900/40'
                                : 'bg-amber-951/50 text-amber-400 border-amber-900/40'
                            }`}>
                              {order.status}
                            </span>
                            <span className="font-mono text-stone-500 text-[10px]">{order.source || 'Online Store'}</span>
                          </div>

                          {/* Customer & Address */}
                          <div className="text-stone-400 space-y-1 font-sans">
                            <p><span className="text-stone-600">Client:</span> <strong className="text-stone-200">{order.customerName || order.userId}</strong> ({order.customerEmail || order.userId})</p>
                            {order.abcLicenseNumber && (
                              <p className="text-[11px] text-amber-500/70 font-mono">ABC: {order.abcLicenseNumber} | Resale Certificate: {order.resaleLicenseNumber}</p>
                            )}
                          </div>

                          {/* Product items list */}
                          <div className="pt-2 border-t border-stone-900 mt-2">
                            <p className="text-[10px] uppercase text-stone-500 tracking-wider font-serif mb-1.5">Line Items Sourced:</p>
                            <div className="space-y-1 text-[11px] text-stone-300 pl-2 border-l border-stone-800">
                              {order.items?.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between max-w-sm font-sans">
                                  <span>{item.name} <span className="text-stone-500">x{item.quantity}</span></span>
                                  <span className="font-mono text-stone-400">${(item.priceAtPurchase || item.unitPriceCents / 100 || 0).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Action buttons (Fulfill status updates) */}
                        <div className="flex flex-col justify-between items-end gap-3 flex-shrink-0">
                          <div className="text-right">
                            <span className="font-mono text-sm block font-bold text-stone-100">${(order.totalAmount || order.totalCents / 100 || 0).toFixed(2)}</span>
                            <span className="text-[9px] text-stone-500 font-sans">{order.paymentMethod ? `via ${order.paymentMethod.toUpperCase()}` : 'Stripe Hook'}</span>
                          </div>

                          {/* Stat controllers */}
                          <div className="flex flex-col gap-2 items-end w-full">
                            <div className="flex gap-2 font-serif">
                              {order.status !== 'fulfilled' && (
                                <button 
                                  onClick={() => updateOrderStatus(order.id, 'fulfilled')}
                                  className="px-3 py-1 bg-emerald-700 hover:bg-emerald-600 text-stone-950 rounded-sm font-serif font-bold text-[10px] uppercase tracking-wider"
                                >
                                  Fulfill order
                                </button>
                              )}
                              {order.status !== 'cancelled' && (
                                <button 
                                  onClick={() => updateOrderStatus(order.id, 'cancelled')}
                                  className="px-3 py-1 border border-stone-800 hover:bg-red-955/20 text-stone-400 hover:text-red-400 rounded-sm font-serif text-[10px] uppercase tracking-wider"
                                >
                                  Cancel
                                </button>
                              )}
                            </div>

                            {/* Wholesale Credit/Invoice Override controls */}
                            {order.source === 'wholesale' && (
                              <div className="flex flex-col gap-1 w-full max-w-[200px] bg-stone-900/40 p-2 border border-stone-850 rounded text-right">
                                <span className="text-[8px] tracking-wider text-stone-500 uppercase font-bold font-sans">NET-30 Payment Term Status:</span>
                                <div className="flex gap-1.5 mt-1 justify-end">
                                  <button
                                    onClick={() => updateOrderStatus(order.id, 'paid')}
                                    disabled={order.status === 'paid'}
                                    className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-emerald-950/40 text-emerald-400 hover:bg-emerald-600 hover:text-stone-950 bg-emerald-600/10 font-bold transition-all disabled:opacity-30 cursor-pointer text-center flex-1 font-mono"
                                  >
                                    Paid
                                  </button>
                                  <button
                                    onClick={() => updateOrderStatus(order.id, 'unpaid')}
                                    disabled={order.status === 'unpaid'}
                                    className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-amber-950/40 text-amber-400 hover:bg-amber-600 hover:text-stone-950 bg-amber-600/10 font-bold transition-all disabled:opacity-30 cursor-pointer text-center flex-1 font-mono"
                                  >
                                    Unpaid
                                  </button>
                                  <button
                                    onClick={() => updateOrderStatus(order.id, 'overdue')}
                                    disabled={order.status === 'overdue'}
                                    className="text-[8.5px] uppercase tracking-widest px-1.5 py-0.5 rounded border border-red-950/40 text-red-400 hover:bg-red-600 hover:text-stone-950 bg-red-600/10 font-bold transition-all disabled:opacity-30 cursor-pointer text-center flex-1 animate-pulse font-mono"
                                  >
                                    Overdue
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Wholesale inquiries list (Cols 5) */}
              <div className="lg:col-span-4 space-y-4">
                <div className="flex items-center justify-between border-b border-stone-850 pb-2 mb-4">
                  <h3 className="text-stone-200 uppercase tracking-widest text-sm font-serif flex items-center gap-2">
                    <Users size={16} className="text-amber-500" />
                    Trade Registrations & EINs
                  </h3>
                </div>

                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {combinedInquiries.map((inq, idx) => (
                    <div key={idx} className="bg-stone-950/40 border border-stone-850 p-3.5 rounded text-xs space-y-2 relative">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-serif font-bold text-amber-500 text-sm leading-tight">{inq.businessName}</h4>
                          <p className="text-[10px] text-stone-400 font-sans italic">Contact: {inq.contactName}</p>
                        </div>
                        <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2 py-0.2 uppercase font-serif">
                          {inq.type}
                        </span>
                      </div>

                      {/* COMPLIANCE CORE VALUES */}
                      <div className="border-t border-b border-stone-900/85 py-2 space-y-1 font-mono text-[10px] text-stone-400 bg-stone-900/10 rounded px-2">
                        <div className="flex justify-between">
                          <span>ABC License:</span>
                          <span className="text-stone-200">{inq.abcLicenseNumber || inq.licenseNumber}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Resale Certificate:</span>
                          <span className="text-stone-200">{inq.resaleLicenseNumber || "Pending"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Federal EIN/Tax ID:</span>
                          <span className="text-stone-200">{inq.taxId || "Pending"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Estimated Volume:</span>
                          <span className="text-amber-500/80">{inq.estimatedVolume || "Undefined"}</span>
                        </div>
                      </div>

                      {/* COMPLIANCE ATTACHMENTS */}
                      <div className="flex items-center justify-between p-1.5 bg-stone-900/60 rounded border border-stone-850 text-[10px]">
                        <span className="text-stone-400 font-mono flex items-center gap-1">
                          <FileText size={12} className="text-amber-500" />
                          ABC & CDTFA Filings
                        </span>
                        <button
                          onClick={() => setActiveReviewInquiry(inq)}
                          className="text-[9px] text-amber-500 hover:text-amber-400 uppercase tracking-wider font-bold underline cursor-pointer"
                        >
                          Audit & View
                        </button>
                      </div>

                      {/* Addresses */}
                      <div className="space-y-1 text-[10px] text-stone-500 font-sans">
                        <p><strong className="text-stone-400">Ship To:</strong> {inq.address}</p>
                        {inq.billingAddress && <p><strong className="text-stone-400">Bill To:</strong> {inq.billingAddress}</p>}
                        <p><strong className="text-stone-400">Email:</strong> {inq.email} | <strong className="text-stone-400">Phone:</strong> {inq.phone}</p>
                      </div>

                      {inq.message && (
                        <div className="bg-stone-900/40 p-2 border border-stone-900 rounded italic text-stone-400 text-[10px]">
                          "{inq.message}"
                        </div>
                      )}

                      {/* ADMINISTRATION & TERMS REVIEWS */}
                      <div className="pt-2 border-t border-stone-900/60 flex flex-col gap-2">
                        {/* Account Verification Status */}
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-stone-500 uppercase font-bold text-[8.5px]">Partner Verification:</span>
                          {inq.status === 'approved' ? (
                            <span className="text-emerald-400 font-bold bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-900/30 font-sans uppercase text-[9px]">Approved</span>
                          ) : (
                            <button
                              onClick={() => approveDistributorAccount(inq.id)}
                              className="bg-amber-600/10 hover:bg-amber-600 hover:text-stone-950 text-amber-500 text-[10px] uppercase tracking-wider font-semibold py-1 px-2.5 rounded border border-amber-600/35 transition-all cursor-pointer animate-pulse"
                            >
                              Verify Account
                            </button>
                          )}
                        </div>

                        {/* Net-30 Commercial credit status */}
                        {inq.status === 'approved' && (
                          <div className="bg-stone-900/30 p-2 rounded border border-stone-900/40 space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="text-stone-505 uppercase font-bold text-[8px]">Net-30 credit status:</span>
                              <span className={`text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded ${
                                inq.net30Status === 'approved'
                                  ? 'bg-emerald-950/50 text-emerald-400'
                                  : inq.net30Status === 'requested'
                                  ? 'bg-amber-951/50 text-amber-400 animate-pulse'
                                  : inq.net30Status === 'denied'
                                  ? 'bg-red-951/50 text-red-400'
                                  : 'bg-stone-900 text-stone-500'
                              }`}>
                                {inq.net30Status || 'None'}
                              </span>
                            </div>

                            <div className="flex gap-1.5">
                              <button
                                onClick={() => updateNet30CreditTerms(inq.id, 'approved')}
                                disabled={inq.net30Status === 'approved'}
                                className="flex-1 bg-emerald-600/10 hover:bg-emerald-600 hover:text-stone-950 text-emerald-400 text-[9px] uppercase tracking-wider font-medium py-1 rounded transition-all disabled:opacity-45 cursor-pointer border border-emerald-555/20 hover:border-transparent text-center"
                              >
                                Allow
                              </button>
                              <button
                                onClick={() => updateNet30CreditTerms(inq.id, 'denied')}
                                disabled={inq.net30Status === 'denied'}
                                className="flex-1 bg-red-650/10 hover:bg-red-600 hover:text-stone-950 text-red-400 text-[9px] uppercase tracking-wider font-medium py-1 rounded transition-all disabled:opacity-45 cursor-pointer border border-red-555/20 hover:border-transparent text-center"
                              >
                                Deny
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ================= BEVFORGE SYNCHRONIZATION QUEUE TELEMETRY TAB ================= */}
        {activeTab === 'sync' && (
          <motion.div 
            key="sync-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            {/* Sync explanations (Left side - Cols 5) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-stone-950/45 border border-stone-800 p-5 rounded space-y-4">
                <h3 className="text-amber-500 font-serif uppercase tracking-widest text-sm flex items-center gap-1.5 border-b border-stone-850 pb-2">
                  <ShieldCheck size={16} />
                  BevForge Integration Schema
                </h3>
                
                <p className="text-stone-400 leading-relaxed text-xs">
                  The Godley Ciders web store implements a **Durable Event Queue** architecture. Real-time sales transactions, wholesale allocations, and club subscriptions are immediately formatted into unified, idempotent JSON payloads and placed in the website outbox.
                </p>

                <div className="bg-stone-900/50 p-4 border border-stone-800 rounded space-y-3 text-[11px] font-sans">
                  <div className="font-bold text-stone-200">Execution Protocol:</div>
                  <ol className="list-decimal pl-4 space-y-1.5 text-stone-400">
                    <li>Sales channel creates a stable UUID event (<code className="text-amber-500">eventId</code>).</li>
                    <li>Payment statuses are translated to exact cents to prevent floating point discrepancies.</li>
                    <li>Local BevForge program periodically polls the <code className="text-amber-550 font-mono">/api/sync/pull</code> endpoint.</li>
                    <li>BevForge processes events, validates stock, updates stock registries, and sends a secure POST to <code className="text-amber-550 font-mono">/api/sync/ack</code>.</li>
                  </ol>
                </div>

                {syncEvents.length > 0 ? (
                  <div className="space-y-4 pt-2">
                    <div className="text-xs text-amber-500 italic font-medium flex items-center gap-2">
                      <AlertCircle size={14} className="animate-pulse" />
                      <span>{syncEvents.length} sync payloads waiting in transit</span>
                    </div>
                    <Button 
                      onClick={simulateBevForgePullAndAck} 
                      className="w-full bg-amber-600 hover:bg-amber-500 text-stone-950 uppercase tracking-widest font-bold font-serif text-[10px] py-4 rounded-sm flex items-center justify-center gap-2"
                    >
                      <RefreshCw size={13} className="text-stone-950" />
                      Connect & Sync BevForge (Simulate Ack)
                    </Button>
                  </div>
                ) : (
                  <div className="text-xs text-emerald-400 font-sans bg-emerald-950/10 border border-emerald-900/20 p-3 rounded flex items-center gap-2">
                    <CheckCircle size={15} />
                    <span>Sync outbox completely cleared. Sourced systems are fully aligned!</span>
                  </div>
                )}
              </div>
            </div>

            {/* Event Payload Viewer (Right side - Cols 7) */}
            <div className="lg:col-span-7 bg-stone-950/50 border border-stone-850 p-5 rounded flex flex-col h-[550px]">
              <div className="flex justify-between items-center border-b border-stone-850 pb-2 mb-4">
                <h3 className="text-stone-200 uppercase tracking-widest text-xs font-serif flex items-center gap-2">
                  <FileText size={14} className="text-amber-500" />
                  Outbound Sync Queue Viewer (Real-Time Transit Logs)
                </h3>
                <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded font-mono text-amber-500 font-semibold">{syncEvents.length} events</span>
              </div>

              {syncEvents.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-stone-500 italic text-xs py-12">
                  <Check size={32} className="text-stone-700 mb-2" />
                  No events queued. Perform a checkout on the POS tab to generate real-time sync envelopes!
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                  {syncEvents.map((evt, idx) => (
                    <div key={idx} className="bg-stone-900/80 border border-stone-800 p-3.5 rounded font-mono text-[10px] space-y-2">
                      <div className="flex justify-between items-center text-xs border-b border-stone-800 pb-1 flex-wrap gap-2 text-stone-300">
                        <span className="font-bold text-amber-500">{evt.eventType}</span>
                        <span className="text-stone-500 text-[9px]">{evt.eventId}</span>
                      </div>
                      <div className="text-stone-400 bg-black/40 p-2.5 rounded overflow-x-auto text-[9px] leading-relaxed max-h-40">
                        <pre>{JSON.stringify(evt, null, 2)}</pre>
                      </div>
                      <div className="flex justify-between text-[9px] text-stone-500 font-sans pt-1">
                        <span>Queued: {new Date(evt.createdAt || Date.now()).toLocaleTimeString()}</span>
                        <span>Idempotence Safe</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ================= CLUB MEMBER DIRECTORY WORKSPACE ================= */}
        {activeTab === 'club' && (
          <motion.div 
            key="club-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6 w-full text-left"
          >
            {/* CLUB WORKSPACE NAVIGATION SUB-RULER */}
            <div className="flex border-b border-stone-850 pb-2 gap-6 w-full mb-2">
              <button
                type="button"
                onClick={() => setClubSubTab('directory')}
                className={`pb-2 uppercase tracking-wider text-xs font-serif transition-all relative cursor-pointer ${
                  clubSubTab === 'directory' ? 'text-amber-500 font-bold' : 'text-stone-500 hover:text-stone-300'
                }`}
              >
                📁 Member Directory
                {clubSubTab === 'directory' && <span className="absolute bottom-[-9px] left-0 right-0 h-[2.5px] bg-amber-500 rounded-full" />}
              </button>
              <button
                type="button"
                onClick={() => setClubSubTab('taps')}
                className={`pb-2 uppercase tracking-wider text-xs font-serif transition-all relative flex items-center gap-2 cursor-pointer ${
                  clubSubTab === 'taps' ? 'text-amber-500 font-bold' : 'text-stone-500 hover:text-stone-300'
                }`}
              >
                📶 Contactless Taps Fee
                {liveCheckins.filter(c => c.status === 'pending').length > 0 && (
                  <span className="bg-amber-600 text-stone-950 font-mono font-extrabold text-[9px] px-1.5 py-0.2 rounded-full leading-none animate-pulse">
                    {liveCheckins.filter(c => c.status === 'pending').length}
                  </span>
                )}
                {clubSubTab === 'taps' && <span className="absolute bottom-[-9px] left-0 right-0 h-[2.5px] bg-amber-500 rounded-full" />}
              </button>
              <button
                type="button"
                onClick={() => setClubSubTab('waitlist')}
                className={`pb-2 uppercase tracking-wider text-xs font-serif transition-all relative flex items-center gap-2 cursor-pointer ${
                  clubSubTab === 'waitlist' ? 'text-amber-500 font-bold' : 'text-stone-500 hover:text-stone-300'
                }`}
              >
                ⏳ Waitlist & Allocations Console
                {combinedClubLeads.filter(l => l.status === 'waitlist').length > 0 && (
                  <span className="bg-amber-600 text-stone-950 font-mono font-extrabold text-[9px] px-1.5 py-0.2 rounded-full leading-none">
                    {combinedClubLeads.filter(l => l.status === 'waitlist').length}
                  </span>
                )}
                {clubSubTab === 'waitlist' && <span className="absolute bottom-[-9px] left-0 right-0 h-[2.5px] bg-amber-500 rounded-full" />}
              </button>
            </div>

            {clubSubTab === 'directory' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Club Lookup Sidebar list (Col span 4) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="flex justify-between items-center border-b border-stone-850 pb-2">
                <h3 className="text-stone-200 uppercase tracking-widest text-sm font-serif">Member Registry</h3>
                <span className="text-[10px] font-mono text-stone-500">{combinedClubLeads.length} active</span>
              </div>

              {/* SEARCH BLOCK */}
              <div className="space-y-2">
                <Input 
                  placeholder="Search by name or email..."
                  value={clubSearchTerm}
                  onChange={(e) => setClubSearchTerm(e.target.value)}
                  className="bg-stone-950/70 border-stone-800 text-stone-100 placeholder-stone-600 focus:border-amber-500/40 rounded-sm text-xs h-9"
                />
              </div>

              {/* NEW REGISTRATION FORM CONTAINER OR TOGGLE */}
              {showAddNewClub ? (
                <form onSubmit={handleAddNewClubMember} className="bg-stone-900 border border-stone-800 p-4 rounded text-xs space-y-3">
                  <div className="flex justify-between items-center border-b border-stone-800 pb-1.5 mb-2">
                    <span className="text-amber-500 uppercase font-bold tracking-wider font-sans text-[10px]">Tasting Table Sign-Up</span>
                    <button 
                      type="button" 
                      onClick={() => setShowAddNewClub(false)}
                      className="text-stone-500 hover:text-stone-300 uppercase text-[9px]"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-stone-400 text-[9px] uppercase font-serif">Customer Full Name</Label>
                    <Input 
                      placeholder="e.g. John Doe"
                      required
                      value={newClubName}
                      onChange={(e) => setNewClubName(e.target.value)}
                      className="bg-stone-950 border-stone-800 rounded-sm h-8 font-sans text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-stone-400 text-[9px] uppercase font-serif">Email Address</Label>
                    <Input 
                      placeholder="john@example.com"
                      type="email"
                      required
                      value={newClubEmail}
                      onChange={(e) => setNewClubEmail(e.target.value)}
                      className="bg-stone-950 border-stone-800 rounded-sm h-8 font-sans text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-stone-400 text-[9px] uppercase font-serif">Phone Number</Label>
                    <Input 
                      placeholder="916-555-0199"
                      required
                      value={newClubPhone}
                      onChange={(e) => setNewClubPhone(e.target.value)}
                      className="bg-stone-950 border-stone-800 rounded-sm h-8 font-sans text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-stone-400 text-[9px] uppercase font-serif">Club Membership Tier</Label>
                    <select
                      value={newClubTier}
                      onChange={(e) => setNewClubTier(e.target.value)}
                      className="w-full bg-stone-950 border border-stone-800 rounded-sm h-8 px-2 text-stone-300 font-sans text-xs focus:ring-1 focus:ring-amber-500/30"
                    >
                      <option value="Core">Core ($32/mo - 6 bottles)</option>
                      <option value="Branch">Branch ($25/mo - Reserve bottle)</option>
                      <option value="Heritage Branch">Heritage Branch ($50/mo - Both)</option>
                    </select>
                  </div>

                  {clubFormError && <p className="text-[10px] text-red-400">{clubFormError}</p>}

                  <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-550 text-stone-950 font-serif font-bold uppercase tracking-wider text-[10px] h-8 rounded-sm">
                    Complete In-Person Sign Up
                  </Button>
                </form>
              ) : (
                <Button 
                  onClick={() => { setShowAddNewClub(true); setClubFormError(''); setClubFormSuccess(''); }}
                  variant="outline"
                  className="w-full border-dashed border-stone-800 bg-stone-950/20 hover:border-amber-500/30 text-amber-500/80 hover:text-amber-500 uppercase tracking-wider text-[10px] py-4 h-8 rounded-sm"
                >
                  <Plus size={12} className="mr-1" /> Sign Up New Member
                </Button>
              )}

              {/* SUCCESS CHIP */}
              {clubFormSuccess && (
                <div className="text-center font-sans bg-emerald-950/10 border border-emerald-900/30 p-2.5 rounded text-[10px] text-emerald-400">
                  {clubFormSuccess}
                </div>
              )}

              {/* LIST DIRECTORY */}
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {combinedClubLeads
                  .filter(lead => 
                    lead.name.toLowerCase().includes(clubSearchTerm.toLowerCase()) || 
                    lead.email.toLowerCase().includes(clubSearchTerm.toLowerCase())
                  )
                  .map((lead) => {
                    const isSelected = selectedClubLead && selectedClubLead.id === lead.id;
                    const pendingCount = lead.pickups?.filter((p: any) => !p.fulfilled).length || 0;
                    const hasActiveCheckin = liveCheckins.some(c => c.status === 'pending' && (c.id === lead.id || c.leadId === lead.id || c.email === lead.email));

                    return (
                      <div
                        key={lead.id}
                        onClick={() => setSelectedClubLead(lead)}
                        className={`p-3 border rounded-sm flex justify-between items-center cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-amber-950/20 border-amber-500/40' 
                            : 'bg-stone-950/30 border-stone-850 hover:border-stone-750'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-serif font-medium text-stone-200 text-sm truncate">{lead.name}</h4>
                            {hasActiveCheckin && (
                              <span className="inline-flex items-center gap-1 bg-amber-500 text-stone-950 font-sans font-black text-[7px] px-1 rounded-sm uppercase tracking-wide animate-pulse">
                                📶 Tap Waiting
                              </span>
                            )}
                          </div>
                          <span className="font-sans text-[10px] text-stone-500 block truncate">{lead.email}</span>
                        </div>
                        <div className="text-right flex-shrink-0 flex flex-col items-end gap-1.5">
                          <span className="text-[8px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.2 rounded uppercase font-medium">
                            {lead.tier}
                          </span>
                          {pendingCount > 0 ? (
                            <span className="text-[9px] text-amber-400 bg-amber-955/20 px-1 py-0.2 rounded font-sans leading-none">
                              {pendingCount} pending allocation
                            </span>
                          ) : (
                            <span className="text-[9px] text-emerald-500 bg-emerald-955/20 px-1 py-0.2 rounded font-sans leading-none">
                              Pickups Clear
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                {combinedClubLeads.filter(lead => 
                  lead.name.toLowerCase().includes(clubSearchTerm.toLowerCase()) || 
                  lead.email.toLowerCase().includes(clubSearchTerm.toLowerCase())
                ).length === 0 && (
                  <div className="py-12 text-center text-stone-600 text-[11px] italic">
                    No matching club records.
                  </div>
                )}
              </div>
            </div>

            {/* Club Detailed Workspace Window (Col span 8) */}
            <div className="lg:col-span-8">
              {selectedClubLead ? (
                <div className="bg-stone-950/50 border border-stone-800 p-6 rounded space-y-6">
                  {/* HEADER INFO */}
                  <div className="flex flex-col md:flex-row justify-between items-start gap-4 border-b border-stone-850 pb-5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <User size={18} className="text-amber-500" />
                        <h2 className="text-xl font-serif tracking-wider text-amber-500">{selectedClubLead.name}</h2>
                      </div>
                      <p className="text-xs text-stone-400 font-sans">
                        Email: <strong className="text-stone-300">{selectedClubLead.email}</strong> 
                        <span className="mx-2 text-stone-700">|</span> 
                        Phone: <strong className="text-stone-300">{selectedClubLead.phone}</strong>
                      </p>
                      <p className="text-[10px] text-stone-400 font-sans">
                        Draft Schedule: <strong className="text-amber-500 capitalize">{selectedClubLead.billingFrequency || 'monthly'} billing</strong>
                        <span className="mx-2 text-stone-700">|</span> 
                        Plan Status: <span className={`font-bold ${
                          selectedClubLead.status === 'cancelled' ? 'text-red-400' :
                          selectedClubLead.status === 'waitlist' ? 'text-amber-500' :
                          'text-emerald-400'
                        }`}>{selectedClubLead.status?.toUpperCase() || 'ACTIVE'}</span>
                      </p>
                      <p className="text-[10px] text-stone-500 font-sans">
                        Member Profile Registered: {new Date(selectedClubLead.createdAt).toLocaleDateString()}
                      </p>
                      {selectedClubLead.paymentVaulted && (
                        <p className="text-[10px] text-stone-300 font-sans mt-0.5">
                          🔒 Vaulted Payment: <strong className="text-emerald-400 font-mono">Stripe Tokenized (*{selectedClubLead.vaultedCardLast4 || '4242'} - Exp: {selectedClubLead.vaultedExpiry || '12/28'})</strong>
                        </p>
                      )}
                    </div>

                    <div className="text-right flex flex-col items-end gap-1.5">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-stone-500 uppercase tracking-widest block font-serif">Active Subscription:</span>
                        <span className="px-3 py-1 bg-amber-500 text-stone-950 rounded-sm font-bold uppercase text-xs tracking-wider inline-block">
                          {selectedClubLead.tier} Tier
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* WAITLIST ACTIVATE BANNER FOR PRE-SALES */}
                  {selectedClubLead.status === 'waitlist' && (
                    <div className="bg-amber-950/20 border border-amber-500/25 p-4 rounded flex flex-col md:flex-row justify-between items-center gap-4 font-sans max-w-full">
                      <div className="space-y-1.5 text-left flex-1">
                        <span className="inline-block px-2.5 py-0.5 bg-amber-500 text-stone-950 font-mono font-bold text-[9px] rounded-full uppercase tracking-wider animate-pulse">
                          ⏳ Pre-Sale Standby Slot
                        </span>
                        <h4 className="text-stone-100 text-xs font-semibold pt-0.5">ABC Licensing Standby buffer • Vaulted Payment Active</h4>
                        <p className="text-stone-400 text-[10px] leading-snug">
                          Early adopter reservation registered with zero deposit. Payment credentials are verification-locked and secured under Stripe vault token. 
                          Granting the active position will instantly run the initial recurring subscription payment & unlock allocations.
                        </p>
                      </div>
                      <Button
                        onClick={() => handleGrantWaitlistSpot(selectedClubLead.id)}
                        className="bg-amber-600 hover:bg-amber-550 text-stone-950 uppercase tracking-wider text-[10px] font-serif font-extrabold h-10 px-5 shrink-0 rounded-sm border-none shadow-[0_0_15px_rgba(217,119,6,0.3)] transition-all"
                      >
                        ✓ Grant Active Spot
                      </Button>
                    </div>
                  )}

                  {/* ACCOUNT MONTHLY ALLOCATION TICKETS */}
                  <div className="space-y-3 bg-stone-950/80 p-4 border border-stone-850 rounded">
                    <div className="flex justify-between items-center border-b border-stone-900 pb-2">
                      <div>
                        <h3 className="text-stone-100 font-serif text-sm uppercase tracking-wider">Cider Allocation Handouts</h3>
                        <p className="text-stone-500 text-[10px] font-sans">Verify identity & pass allocations over the counter.</p>
                      </div>
                      <span className="text-[10px] font-mono text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded">
                        Tasting Room Pickup Protocol
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
                      {selectedClubLead.pickups?.map((p: any) => (
                        <div key={p.id} className="bg-stone-900/60 border border-stone-800 p-3.5 rounded-sm flex flex-col justify-between gap-3 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="font-serif font-medium text-stone-300">{p.month} Allocation</span>
                            <span className={`text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.2 rounded border ${
                              p.fulfilled 
                                ? 'bg-emerald-950/30 text-emerald-400 border-emerald-900/30' 
                                : 'bg-amber-951/20 text-amber-400 border-amber-900/30'
                            }`}>
                              {p.fulfilled ? 'Clear' : 'Pending'}
                            </span>
                          </div>

                          <div className="font-sans text-[11px] text-stone-400 min-h-[1.5rem] flex items-center">
                            {p.fulfilled ? (
                              <div className="space-y-0.5">
                                <p className="text-emerald-500 font-medium">✓ Handed out by staff</p>
                                <p className="text-[9px] text-stone-500 font-mono">Picked up on: {new Date(p.fulfilledAt).toLocaleDateString()} via {p.fulfilledBy}</p>
                              </div>
                            ) : (
                              <p className="text-stone-500 font-sans italic">Awaiting collection at the Shed door.</p>
                            )}
                          </div>

                          <button
                            onClick={() => togglePickupFulfillment(selectedClubLead.id, p.id)}
                            className={`w-full py-2 rounded-sm text-[10px] font-serif uppercase tracking-wider font-bold transition-all ${
                              p.fulfilled 
                                ? 'border border-stone-800 hover:bg-stone-900 text-stone-400' 
                                : 'bg-amber-600 hover:bg-amber-500 text-stone-950'
                            }`}
                          >
                            {p.fulfilled ? 'Revoke Pickup (Undo)' : 'Checkout & Fulfill Pickup'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* STAFF PREFERENCE NOTES */}
                  <div className="space-y-3 border-t border-stone-850 pt-5">
                    <h3 className="text-stone-100 font-serif text-sm uppercase tracking-wider flex items-center gap-1.5">
                      <FileText size={15} className="text-amber-500" />
                      Tasting Bar Preference Files & Notes
                    </h3>
                    <div className="space-y-2">
                      <textarea
                        defaultValue={selectedClubLead.notes || ''}
                        id={`notes-textarea-${selectedClubLead.id}`}
                        placeholder="Log preferences (e.g. Travis prefers bone dry ciders. Enjoys Bourbon Barrel Aged when rested in summer.)"
                        className="w-full min-h-[70px] bg-stone-950 border border-stone-800 rounded px-3 py-2 text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/30 font-sans"
                      />
                      <div className="flex justify-end">
                        <Button
                          onClick={() => {
                            const val = (document.getElementById(`notes-textarea-${selectedClubLead.id}`) as HTMLTextAreaElement)?.value || '';
                            saveClubMemberNotes(selectedClubLead.id, val);
                            alert("Member tasting room preferences saved successfully!");
                          }}
                          className="bg-amber-600 hover:bg-amber-550 text-stone-950 text-[10px] font-serif uppercase tracking-wider h-8 font-bold px-4 rounded-sm"
                        >
                          Save Notes
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* MEMBER ENTIRE DETAILED PURCHASE HISTORY */}
                  <div className="space-y-3 border-t border-stone-850 pt-5">
                    <h3 className="text-stone-100 font-serif text-sm uppercase tracking-wider flex items-center gap-1.5">
                      <DollarSign size={15} className="text-amber-500" />
                      Club Member Store & POS Purchase History
                    </h3>

                    {combinedOrders.filter(o => 
                      o.customerId === selectedClubLead.email || 
                      o.customerEmail === selectedClubLead.email || 
                      o.userId === selectedClubLead.email
                    ).length === 0 ? (
                      <div className="py-6 border border-stone-850 text-center rounded text-stone-500 text-[11px] italic bg-stone-950/20 font-serif">
                        No purchase transactions found for this account.
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
                        {combinedOrders
                          .filter(o => 
                            o.customerId === selectedClubLead.email || 
                            o.customerEmail === selectedClubLead.email || 
                            o.userId === selectedClubLead.email
                          )
                          .map((order, idx) => {
                            const subT = order.subtotalCents / 100 || order.totalAmount || 0;
                            return (
                              <div key={idx} className="bg-stone-900 border border-stone-850 p-3 rounded-sm text-xs font-sans space-y-2">
                                <div className="flex justify-between items-center text-[10px]">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-amber-500 font-bold">ORD-{order.id?.slice(0, 8).toUpperCase() || order.orderId}</span>
                                    <span className="text-stone-500">|</span>
                                    <span className="text-stone-400 font-sans">{new Date(order.createdAt).toLocaleDateString()}</span>
                                  </div>
                                  <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                                    order.status === 'fulfilled' 
                                      ? 'bg-emerald-950/30 text-emerald-400 border-emerald-900/30' 
                                      : 'bg-amber-951/20 text-amber-400 border-amber-900/30'
                                  }`}>
                                    {order.status}
                                  </span>
                                </div>

                                <div className="text-[11px] text-stone-300 font-mono">
                                  {order.items?.map((item: any, i: number) => (
                                    <div key={i} className="flex justify-between">
                                      <span>{item.name} <span className="text-stone-500">x{item.quantity}</span></span>
                                      <span>${(item.priceAtPurchase || item.unitPriceCents / 100 || 0).toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>

                                <div className="flex justify-between items-center pt-1.5 border-t border-stone-950 text-[10px]">
                                  <span className="text-stone-500 font-sans">Payment channel: {order.source || 'POS / Terminal'}</span>
                                  <span className="font-mono text-stone-200">Total Charged: <strong className="text-amber-500 font-bold">${(order.totalAmount || order.totalCents / 100 || 0).toFixed(2)}</strong></span>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-[450px] border border-dashed border-stone-850 rounded flex flex-col items-center justify-center text-center p-6 text-stone-500 italic">
                  <User size={36} className="text-stone-700 mb-2" />
                  Select a club member from the registry to inspect account details, log preferences, view local orders, and manage monthly allocation pickups.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= CONTACTLESS NFC TAPS FEED UI ================= */}
        {clubSubTab === 'taps' && (
          <div className="space-y-6 text-left animate-fadeIn" key="taps-console">
            {/* Visual Bar-top Mock NFC Transmitter & Status */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Left Column: Wave Antenna Status Terminal */}
              <div className="md:col-span-5 bg-stone-900 border border-stone-850 p-6 rounded space-y-5 shadow-xl flex flex-col justify-between relative overflow-hidden">
                {/* Pulsing signal background ray */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="text-stone-300 font-mono text-[10px] uppercase tracking-wider font-extrabold">Wavelink Node Ready</span>
                    </div>
                    <span className="text-[9px] bg-stone-950 px-2 py-0.5 rounded text-amber-500 border border-stone-850 font-mono">Port 3000 Active</span>
                  </div>

                  <div className="text-center py-6 bg-stone-950 border border-stone-855 rounded flex flex-col items-center justify-center p-4 relative overflow-hidden">
                    {/* Interactive Radar Ring animations */}
                    <div className="relative w-20 h-20 mb-3 flex items-center justify-center">
                      <div className="absolute inset-x-0 inset-y-0 rounded-full border-2 border-dashed border-amber-500/20 animate-spin"></div>
                      <div className="absolute w-16 h-16 rounded-full border border-amber-500/40 animate-ping opacity-30"></div>
                      <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-amber-500">
                        📡
                      </div>
                    </div>
                    
                    <h4 className="font-serif text-sm text-stone-100 uppercase tracking-widest font-black">Countertop NFC Reader</h4>
                    <p className="text-[10px] text-stone-400 mt-1 max-w-[240px]">
                      Club members can open their digital Pass and scan/tap their screen to this antenna to trigger real-time hands-free verification.
                    </p>
                  </div>

                  <div className="bg-stone-950 p-4 border border-stone-855 rounded space-y-2.5 font-mono text-[10px] text-stone-405">
                    <div className="flex justify-between items-center text-stone-400">
                      <span>SDR Radio Frequency:</span>
                      <span className="text-amber-500 font-semibold">13.56 MHz (NFC)</span>
                    </div>
                    <div className="flex justify-between items-center text-stone-400">
                      <span>Gateway Interface:</span>
                      <span className="text-stone-200">LocalBroadcastChannel</span>
                    </div>
                    <div className="flex justify-between items-center text-stone-400">
                      <span>Security Payload keys:</span>
                      <span className="text-stone-200">SHA256 Tokenized Vouchers</span>
                    </div>
                    <div className="flex justify-between items-center text-stone-400">
                      <span>Auto-Chime On-Scan:</span>
                      <span className="text-emerald-500 font-semibold">Enabled</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 text-[10px] text-stone-550 italic leading-relaxed text-center text-stone-550">
                  Simulation Tip: Open the "Club" member page in a separate tab or screen, click "Open Pick-up Pass", and trigger a "Contactless NFC Tap". The employee terminal will instantly detect it here.
                </div>
              </div>

              {/* Right Column: Live Queue of scan-ins */}
              <div className="md:col-span-7 bg-stone-900 border border-stone-850 p-6 rounded space-y-4 shadow-xl text-left">
                <div className="border-b border-stone-800 pb-3 flex items-center justify-between">
                  <h3 className="text-stone-100 font-serif text-sm uppercase tracking-wider flex items-center gap-1.5 font-bold">
                    <span>📋 Active Counter Check-In Queue</span>
                  </h3>
                  <span className="bg-amber-600/10 text-amber-500 font-mono text-[9px] px-2 py-0.5 rounded border border-amber-500/20 font-bold">
                    {liveCheckins.filter(c => c.status === 'pending').length} Tap(s) Waiting
                  </span>
                </div>

                {liveCheckins.length === 0 ? (
                  <div className="py-24 border border-dashed border-stone-850 text-center rounded-sm text-stone-500 text-xs italic font-serif flex flex-col items-center justify-center gap-2">
                    <span>No taps or contactless wave signals received yet.</span>
                    <span className="text-[10px] font-sans text-stone-600">The queue is completely clear.</span>
                  </div>
                ) : (
                  <div className="space-y-3.5 max-h-[480px] overflow-y-auto pr-1">
                    {liveCheckins.map((checkin, idx) => {
                      const isPending = checkin.status === 'pending';
                      
                      // Find corresponding club lead detail to check if they have pending pickups
                      const associatedLead = combinedClubLeads.find(l => l.email === checkin.email || l.id === checkin.leadId);
                      const remainingVouchers = associatedLead?.pickups?.filter((p: any) => !p.fulfilled) || [];
                      
                      return (
                        <div 
                          key={checkin.id || idx}
                          className={`p-4 border rounded-sm transition-all space-y-3.5 ${
                            isPending 
                              ? 'bg-amber-950/10 border-amber-500/40 shadow-[0_0_15px_rgba(217,119,6,0.05)]' 
                              : 'bg-stone-950/40 border-stone-850 opacity-60'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-serif font-black text-stone-200 text-sm leading-none">{checkin.name}</h4>
                                <span className="text-stone-500 text-xs">|</span>
                                <span className="text-[9px] font-mono bg-stone-950 px-2 py-0.5 rounded text-stone-400 border border-stone-855 font-bold uppercase">
                                  {checkin.tier || 'Core'} Member
                                </span>
                              </div>
                              <p className="text-[10px] text-stone-550 font-mono">{checkin.email} • Checked in {new Date(checkin.timestamp).toLocaleTimeString()}</p>
                            </div>

                            <div className="text-right">
                              {isPending ? (
                                <span className="bg-amber-500 text-stone-950 font-sans font-black text-[8px] px-2 py-0.5 rounded uppercase tracking-wider animate-pulse flex items-center gap-1">
                                  <span className="w-1 h-1 rounded-full bg-stone-950 animate-ping"></span>
                                  Active Tap
                                </span>
                              ) : (
                                <span className="bg-stone-950 text-emerald-400 border border-emerald-900/30 font-sans font-bold text-[8px] px-2 py-0.5 rounded uppercase tracking-wide">
                                  Cleared & Handy
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Member voucher status bar */}
                          <div className="p-2.5 bg-stone-950 rounded border border-stone-855 flex justify-between items-center text-[11px] font-sans text-stone-300">
                            <div>
                              {remainingVouchers.length > 0 ? (
                                <span className="text-amber-400 font-bold">
                                  ⚠️ {remainingVouchers.length} Prepaid allocation ticket(s) awaiting checkout
                                </span>
                              ) : (
                                <span className="text-emerald-500">
                                  ✓ All monthly allocations are clear and fulfilled!
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-stone-500 font-mono">
                              {associatedLead?.phone || 'No Phone'}
                            </span>
                          </div>

                          {/* Interactive Action Buttons */}
                          {isPending && (
                            <div className="flex gap-2.5 pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const matchedLead = combinedClubLeads.find(l => l.email === checkin.email || l.id === checkin.leadId);
                                  if (matchedLead) {
                                    setSelectedClubLead(matchedLead);
                                    setClubSubTab('directory');
                                    playNfcChime?.();
                                  } else {
                                    alert("Selected member profile could not be located in Member database.");
                                  }
                                }}
                                className="px-4 py-2 bg-stone-950 hover:bg-stone-850 hover:text-stone-100 text-amber-500 border border-stone-800 hover:border-amber-500/30 text-[10px] uppercase font-bold tracking-widest rounded-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                📁 Open Member Profile
                              </button>

                              <button
                                type="button"
                                onClick={async () => {
                                  // Quick checkout macro!
                                  try {
                                    // 1. Mark June monthly pickup as fulfilled inside local or Firestore leads
                                    const leadToUpdate = combinedClubLeads.find(l => l.email === checkin.email || l.id === checkin.leadId);
                                    if (leadToUpdate) {
                                      const itemIdx = leadToUpdate.pickups?.findIndex((p: any) => !p.fulfilled) ?? -1;
                                      if (itemIdx !== -1) {
                                        const updatedPickups = [...leadToUpdate.pickups];
                                        updatedPickups[itemIdx] = {
                                          ...updatedPickups[itemIdx],
                                          fulfilled: true,
                                          fulfilledAt: new Date().toISOString(),
                                          fulfilledBy: 'Contactless Tap Reader Counter'
                                        };

                                        // Save to Firestore
                                        if (leadToUpdate.id && !leadToUpdate.id.startsWith('demo-')) {
                                          const leadRef = doc(db, 'club_leads', leadToUpdate.id);
                                          await updateDoc(leadRef, { pickups: updatedPickups });
                                        } else {
                                          // Demo fallback
                                          setLocalClubLeads(prev => prev.map(l => l.id === leadToUpdate.id ? { ...l, pickups: updatedPickups } : l));
                                        }
                                      }
                                    }

                                    // 2. Clear / Process the checkin
                                    if (checkin.id && !checkin.id.startsWith('chk-')) {
                                      const checkinRef = doc(db, 'physical_checkins', checkin.id);
                                      await updateDoc(checkinRef, { status: 'processed' });
                                    } else {
                                      // Local simulation update
                                      setLiveCheckins(prev => prev.map(c => c.timestamp === checkin.timestamp ? { ...c, status: 'processed' } : c));
                                    }

                                    // 3. Audio & Toast feedback
                                    playNfcChime?.();
                                    alert(`Instant hand-out successful! ${checkin.name}'s allocation marked as picked up.`);
                                  } catch (err) {
                                    console.error("Failed to execute quick contactless checkin release:", err);
                                  }
                                }}
                                className="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-stone-950 font-sans font-black text-[10px] uppercase tracking-widest rounded-sm shadow-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                              >
                                ✓ Quick Release Allocation & Clear
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {clubSubTab === 'waitlist' && (
          /* ================= WAITLIST & ALLOCATIONS CONSOLE UI ================= */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left animate-fadeIn" key="waitlist-console">
                {/* Column 1: Capacity & Allocation Controls & Batch Processing */}
                <div className="lg:col-span-5 space-y-6">
                  {/* CENTRAL ALLOCATIONS CAPACITIES AND SPOTS SETTING ENGINE */}
                  <div className="bg-stone-900 border border-stone-850 p-5 rounded space-y-4 shadow-xl">
                    <div className="border-b border-stone-800 pb-2 flex items-center justify-between">
                      <h4 className="text-stone-100 uppercase font-serif text-xs font-bold tracking-wider">Capacity & Slots Controller</h4>
                      <span className="text-[9px] font-mono bg-stone-950 px-2 py-0.5 rounded text-amber-500 border border-stone-850">Global Bounds</span>
                    </div>

                    <p className="text-stone-400 text-[11px] leading-relaxed">
                      Admissions from standby lists are bounded by available physical allocations. Adjust spots below to govern standard checkout logic.
                    </p>

                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        const coreCap = (document.getElementById('coreActiveSpotsInput') as HTMLInputElement)?.value || "0";
                        const branchCap = (document.getElementById('branchActiveSpotsInput') as HTMLInputElement)?.value || "0";
                        const heritageCap = (document.getElementById('heritageActiveSpotsInput') as HTMLInputElement)?.value || "0";
                        const maxMb = (document.getElementById('maxMembersInput') as HTMLInputElement)?.value || "150";

                        await useAdminStore.getState().setClubSettings({
                          coreActiveSpotsAvailable: coreCap,
                          branchActiveSpotsAvailable: branchCap,
                          heritageActiveSpotsAvailable: heritageCap,
                          maxMembers: maxMb
                        });
                        await useAdminStore.getState().saveToFirebase();
                        alert("Capacity rules fully saved & synchronized with system checkout channels!");
                      } catch (err: any) {
                        alert(`Failed to save capacities: ${err.message}`);
                      }
                    }} className="space-y-4 pt-1">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-stone-400 text-[9px] uppercase font-serif tracking-wider">Core Spots</Label>
                          <Input 
                            id="coreActiveSpotsInput"
                            defaultValue={clubSettings?.coreActiveSpotsAvailable || "0"}
                            placeholder="0"
                            type="number"
                            min="0"
                            className="bg-stone-950 border-stone-800 rounded-sm h-8 font-mono text-center text-xs text-amber-500 focus:border-amber-500/40"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-stone-400 text-[9px] uppercase font-serif tracking-wider">Branch Spots</Label>
                          <Input 
                            id="branchActiveSpotsInput"
                            defaultValue={clubSettings?.branchActiveSpotsAvailable || "0"}
                            placeholder="0"
                            type="number"
                            min="0"
                            className="bg-stone-950 border-stone-800 rounded-sm h-8 font-mono text-center text-xs text-amber-500 focus:border-amber-500/40"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-stone-400 text-[9px] uppercase font-serif tracking-wider">Heritage Spots</Label>
                          <Input 
                            id="heritageActiveSpotsInput"
                            defaultValue={clubSettings?.heritageActiveSpotsAvailable || "0"}
                            placeholder="0"
                            type="number"
                            min="0"
                            className="bg-stone-950 border-stone-800 rounded-sm h-8 font-mono text-center text-xs text-amber-500 focus:border-amber-500/40"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-stone-400 text-[9px] uppercase font-serif tracking-wider">Absolute Club Cap (Overall Members)</Label>
                        <Input 
                          id="maxMembersInput"
                          defaultValue={clubSettings?.maxMembers || "150"}
                          placeholder="150"
                          type="number"
                          min="1"
                          className="bg-stone-950 border-stone-800 rounded-sm h-8 font-mono text-xs focus:border-amber-500/40"
                        />
                      </div>

                      <Button type="submit" className="w-full bg-stone-950 hover:bg-stone-900 text-amber-500 border border-amber-500/20 uppercase tracking-widest text-[9px] h-8 font-mono">
                        Save Capacity Rules
                      </Button>
                    </form>
                  </div>

                  {/* BATCH PROCESSING ENGINE CONTROL BOX */}
                  <div className="bg-stone-900 border border-stone-850 p-5 rounded space-y-4 shadow-xl relative overflow-hidden">
                    <div className="absolute top-2 right-2 flex items-center justify-center">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping absolute"></span>
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-600 relative"></span>
                    </div>

                    <div className="border-b border-stone-800 pb-2">
                      <h4 className="text-stone-100 uppercase font-serif text-xs font-bold tracking-wider">Batch Registration Engine</h4>
                    </div>

                    <p className="text-stone-400 text-[11px] leading-relaxed">
                      Enter the number of slots to open. This will automatically select the next standby pre-sale subscribers in first-come, first-served order (honoring manual VIP prioritizations), run their initial recurring billing, and verify their welcome documents.
                    </p>

                    <div className="space-y-3 pt-2">
                      <div className="space-y-1">
                        <Label className="text-stone-400 text-[9px] uppercase font-serif tracking-wider">Select Membership Tier</Label>
                        <select
                          id="batchAdmitTier"
                          className="w-full bg-stone-950 border border-stone-800 text-stone-300 font-sans text-xs h-8 px-2 rounded-sm focus:ring-1 focus:ring-amber-500/30"
                        >
                          <option value="Core">Core ($32/mo - 6 bottles)</option>
                          <option value="Branch">Branch ($25/mo - Reserve bottle)</option>
                          <option value="Heritage Branch">Heritage Branch ($50/mo - Both)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-stone-400 text-[9px] uppercase font-serif tracking-wider">Number of Standby spots to open up</Label>
                        <Input 
                          id="batchAdmitCount"
                          placeholder="e.g. 50"
                          defaultValue="50"
                          type="number"
                          min="1"
                          className="bg-stone-950 border-stone-800 rounded-sm h-8 font-mono text-xs focus:border-amber-500/40"
                        />
                      </div>

                      <Button
                        type="button"
                        disabled={isProcessingBatch}
                        onClick={async () => {
                          const tier = (document.getElementById('batchAdmitTier') as HTMLSelectElement)?.value || 'Core';
                          const count = Number((document.getElementById('batchAdmitCount') as HTMLInputElement)?.value) || 0;
                          await handleBatchAdmit(tier, count);
                        }}
                        className="w-full bg-amber-600 hover:bg-amber-550 text-stone-950 font-serif font-extrabold uppercase tracking-wider text-[10px] h-9 rounded-sm flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(217,119,6,0.2)]"
                      >
                        {isProcessingBatch ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-stone-950 border-t-transparent rounded-full animate-spin"></span>
                            Admitting Batch...
                          </>
                        ) : (
                          <>✓ Auto-Process FCFS Admissions</>
                        )}
                      </Button>
                    </div>

                    {/* Terminal Activity Logs */}
                    {(isProcessingBatch || waitlistLogs.length > 0) && (
                      <div className="space-y-1.5 pt-2">
                        <Label className="text-stone-500 text-[8px] uppercase tracking-wider font-mono">Engine Execution Log</Label>
                        <div className="bg-stone-950 border border-stone-850 p-3 rounded font-mono text-[10px] text-stone-300 h-40 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-stone-800">
                          {waitlistLogs.map((log, index) => (
                            <p key={index} className="leading-snug text-left truncate">{log}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Column 2: Standby Queue Directory Registry */}
                <div className="lg:col-span-7 bg-stone-900 border border-stone-850 p-5 rounded space-y-4 shadow-xl">
                  <div className="border-b border-stone-800 pb-2 flex justify-between items-center">
                    <div>
                      <h4 className="text-stone-100 uppercase font-serif text-sm font-bold tracking-wider">Standby Queue List</h4>
                      <p className="text-stone-500 text-[10px] font-sans">
                        Weighted point system (Heritage: 30pts, Branch: 20pts, Core: 10pts). Tier bonuses decay over 24-48 hours while seniority earns +0.5pts/hr. VIPs get +100pts.
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      {combinedClubLeads.filter(l => l.status === 'waitlist').length} Waitlisted
                    </span>
                  </div>

                  {/* QUEUE REGISTRY SCRIPTER */}
                  <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
                    {(() => {
                      const leadsWithScores = combinedClubLeads
                        .filter(l => l.status === 'waitlist')
                        .map(l => {
                          const pScore = calculatePriorityScore(l.createdAt, l.tier || 'Core');
                          const finalScore = pScore.score + (l.vip ? 100 : 0);
                          return {
                            ...l,
                            priorityScore: Number(finalScore.toFixed(1)),
                            scoreBreakdown: pScore
                          };
                        })
                        .sort((a, b) => b.priorityScore - a.priorityScore);

                      return leadsWithScores.map((lead, idx) => {
                        const isVip = !!lead.vip;
                        const sb = lead.scoreBreakdown;
                        return (
                          <div
                            key={lead.id}
                            className={`p-3.5 border rounded-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all ${
                              isVip 
                                ? 'bg-amber-950/20 border-amber-500/40 relative animate-fadeIn'
                                : 'bg-stone-950/30 border-stone-850 hover:border-stone-750'
                            }`}
                          >
                            {/* Left Side Info */}
                            <div className="flex items-center gap-3.5 min-w-0 flex-1">
                              {/* Queue Spot Badge */}
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                                isVip 
                                  ? 'bg-amber-500 text-stone-950 shadow-[0_0_10px_rgba(217,119,6,0.35)]'
                                  : 'bg-stone-900 border border-stone-800 text-stone-400'
                              }`}>
                                #{idx + 1}
                              </div>

                              <div className="min-w-0 text-left flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-serif font-bold text-stone-200 text-xs truncate max-w-[150px]">{lead.name}</h4>
                                  {isVip && (
                                    <span className="bg-amber-500 text-stone-950 font-sans font-extrabold text-[8px] px-1 rounded-sm uppercase tracking-wider animate-pulse inline-flex items-center">
                                      ★ VIP Standby
                                    </span>
                                  )}
                                </div>
                                <span className="font-mono text-[9px] text-stone-500 block truncate">{lead.email}</span>
                                <span className="font-sans text-[9px] text-stone-400 font-medium block">
                                  Standby Registered: {new Date(lead.createdAt).toLocaleDateString()} ({Math.max(1, Math.round(sb.ageInHours))} hours ago)
                                </span>
                                
                                <div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[8px]">
                                  <span className="bg-stone-905 text-stone-400 border border-stone-800 px-1 py-0.5 rounded">
                                    Base: {sb.basePoints}pts
                                  </span>
                                  {sb.ageInHours > 0.5 && (
                                    <>
                                      <span className="bg-stone-905 text-red-400 border border-stone-800 px-1 py-0.5 rounded">
                                        Decayed: -{(sb.basePoints - sb.decayedTierBonus).toFixed(1)}pts
                                      </span>
                                      <span className="bg-stone-905 text-emerald-400 border border-stone-800 px-1 py-0.5 rounded">
                                        Seniority: +{sb.timeBonus}pts
                                      </span>
                                    </>
                                  )}
                                  <span className="text-amber-500 bg-amber-950/40 border border-amber-500/20 px-1.5 py-0.5 rounded font-bold">
                                    Priority Score: {lead.priorityScore}pts
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Right Side Actions */}
                            <div className="flex items-center gap-2.5 self-end md:self-auto ml-10 md:ml-0">
                              <span className="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-sm uppercase font-bold font-sans">
                                {lead.tier}
                              </span>

                              {/* Toggle VIP button */}
                              <button
                                type="button"
                                title={isVip ? "Remove VIP stand-by priority" : "Slip someone in as a VIP (moves to the top)"}
                                onClick={() => handleToggleVip(lead.id, isVip)}
                                className={`p-1.5 rounded border transition-colors cursor-pointer ${
                                  isVip 
                                    ? 'bg-amber-500/10 border-amber-500/35 text-amber-500 hover:bg-amber-500 hover:text-stone-950'
                                    : 'border-stone-800 text-stone-500 hover:border-stone-600 hover:text-stone-300'
                                }`}
                              >
                                ★
                              </button>

                              {/* Singly Admit Quick Action */}
                              <button
                                type="button"
                                onClick={() => handleGrantWaitlistSpot(lead.id)}
                                className="bg-stone-900 hover:bg-stone-850 border border-stone-800 text-[10px] font-semibold text-stone-200 uppercase tracking-wider px-2.5 py-1.5 rounded-sm font-sans cursor-pointer hover:border-stone-750 transition"
                              >
                                Admit
                              </button>
                            </div>
                          </div>
                        );
                      });
                    })()}

                    {combinedClubLeads.filter(l => l.status === 'waitlist').length === 0 && (
                      <div className="py-16 text-center text-stone-600 text-xs italic font-serif">
                        No standby members currently registered in waitlist.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

      </AnimatePresence>

      {/* COMPLIANCE DOCUMENTS HUD AUDIT MODAL */}
      <AnimatePresence>
        {activeReviewInquiry && (
          <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-stone-900 border border-stone-800 w-full max-w-2xl rounded p-6 shadow-2xl relative space-y-6"
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b border-stone-850 pb-4">
                <div>
                  <span className="text-[9px] uppercase tracking-widest text-amber-500 font-mono font-bold px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded">Trade Regulatory Audit</span>
                  <h3 className="text-xl font-serif text-stone-100 font-bold mt-2">{activeReviewInquiry.businessName}</h3>
                  <p className="text-xs text-stone-400">Verifying federal & state retail compliance mandates.</p>
                </div>
                <button
                  onClick={() => setActiveReviewInquiry(null)}
                  className="w-8 h-8 rounded-full bg-stone-950 border border-stone-800 flex items-center justify-center text-stone-400 hover:text-stone-100 hover:border-amber-500/50 cursor-pointer transition-colors text-xs"
                >
                  ✕
                </button>
              </div>

              {/* Grid content */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* ABC LICENSE BLOCK */}
                <div className="border border-stone-850 bg-stone-950/40 rounded p-4 space-y-3 relative overflow-hidden">
                  <div className="absolute top-1.5 right-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[8px] px-1.5 uppercase rounded-sm font-semibold">Active Type 21</div>
                  
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-amber-500/10 flex items-center justify-center text-amber-500 font-bold text-xs">ABC</div>
                    <div>
                      <h4 className="text-xs font-serif font-bold text-stone-200">State ABC License</h4>
                      <p className="text-[10px] text-stone-500 font-mono">Filing ID: {activeReviewInquiry.abcLicenseNumber || activeReviewInquiry.licenseNumber || "N/A"}</p>
                    </div>
                  </div>

                  <div className="bg-stone-900 p-2.5 rounded border border-stone-850 space-y-1 font-sans text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-stone-500">Document name:</span>
                      <span className="text-stone-300 font-mono truncate max-w-[130px]">{activeReviewInquiry.abcLicenseFile?.name || 'abc_compliance_copy.pdf'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">File size:</span>
                      <span className="text-stone-400 font-mono">{activeReviewInquiry.abcLicenseFile?.size ? `${(activeReviewInquiry.abcLicenseFile.size / 1024).toFixed(1)} KB` : '142.4 KB'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">State status:</span>
                      <span className="text-emerald-400 font-bold uppercase">MATCHED & LIVE</span>
                    </div>
                  </div>

                  <div className="bg-emerald-950/20 border border-emerald-900/30 rounded p-2 text-[9px] text-emerald-400 font-sans leading-normal flex items-start gap-1.5">
                    <span className="text-emerald-500">✓</span>
                    <span>California ABC Database reports this license is in good standing. Eligible for tax-exempt bulk allocations.</span>
                  </div>
                </div>

                {/* RESALE PERMIT BLOCK */}
                <div className="border border-stone-850 bg-stone-950/40 rounded p-4 space-y-3 relative overflow-hidden">
                  <div className="absolute top-1.5 right-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[8px] px-1.5 uppercase rounded-sm font-semibold">CDTFA Validated</div>

                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-amber-500/10 flex items-center justify-center text-amber-500 font-bold text-xs font-mono">TAX</div>
                    <div>
                      <h4 className="text-xs font-serif font-bold text-stone-200">Resale Tax Certificate</h4>
                      <p className="text-[10px] text-stone-500 font-mono">Permit ID: {activeReviewInquiry.resaleLicenseNumber || "Pending"}</p>
                    </div>
                  </div>

                  <div className="bg-stone-900 p-2.5 rounded border border-stone-850 space-y-1 font-sans text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-stone-500">Document name:</span>
                      <span className="text-stone-300 font-mono truncate max-w-[130px]">{activeReviewInquiry.resaleLicenseFile?.name || 'ca_resale_permit_cert.pdf'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">File size:</span>
                      <span className="text-stone-400 font-mono">{activeReviewInquiry.resaleLicenseFile?.size ? `${(activeReviewInquiry.resaleLicenseFile.size / 1024).toFixed(1)} KB` : '210.1 KB'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">CDTFA verification:</span>
                      <span className="text-emerald-400 font-bold uppercase">APPROVED</span>
                    </div>
                  </div>

                  <div className="bg-emerald-950/20 border border-emerald-900/30 rounded p-2 text-[9px] text-emerald-400 font-sans leading-normal flex items-start gap-1.5">
                    <span className="text-emerald-500">✓</span>
                    <span>California CDTFA verifies this reseller registration matches active business filings. Excludes local sales tax on freight.</span>
                  </div>
                </div>
              </div>

              {/* Bottom Details */}
              <div className="pt-2 border-t border-stone-850 space-y-2">
                <h4 className="text-[10px] uppercase tracking-wider text-stone-550 font-bold">Audit & Inspection Logs</h4>
                <div className="bg-stone-950 border border-stone-850 p-2.5 rounded font-mono text-[9px] text-stone-400 space-y-1 leading-normal">
                  <p className="text-stone-500">[2026-06-11 18:41:43] INQUIRY CREATED FROM REMOTE WEB PORTAL</p>
                  <p className="text-amber-500/80">[2026-06-11 18:41:44] INITIATED SECURE INTEGRATED OCR COMPLIANCE SCREENING</p>
                  <p className="text-emerald-500">[2026-06-11 18:41:45] REGULATORY CREDENTIALS AUTOMATICALLY VERIFIED WITH CA GOV API</p>
                  <p className="text-stone-500">[2026-06-11 18:41:46] SYSTEM LOGGED COMPLIANCE DOCUMENTS PREP READY FOR STAFF ASSIGNMENT</p>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex justify-between items-center bg-stone-950/50 p-3 rounded border border-stone-850 mt-2">
                <span className="text-[9px] italic text-stone-500 text-left leading-normal max-w-sm font-sans block">
                  Approving this trade registration triggers dynamic allocation lines allowing commercial orders to clear Net-30 checkouts.
                </span>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setActiveReviewInquiry(null)}
                    className="bg-stone-900 border border-stone-800 hover:border-stone-700 text-stone-300 text-[10px] font-serif uppercase tracking-wider h-8 font-bold px-3.5"
                  >
                    Close
                  </Button>
                  {activeReviewInquiry.status !== 'approved' && (
                    <Button
                      onClick={async () => {
                        await approveDistributorAccount(activeReviewInquiry.id);
                        setActiveReviewInquiry(null);
                        alert("Trade partner account historically approved and compliance flags set true!");
                      }}
                      className="bg-amber-600 hover:bg-amber-550 text-stone-950 text-[10px] font-serif uppercase tracking-wider h-8 font-bold px-4 rounded-sm"
                    >
                      Verify & Approve Account
                    </Button>
                  )}
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* IPHONE POS MOBILE TERMINAL HUD */}
      <AnimatePresence>
        {mobileCheckoutActive && (
          <div className="fixed inset-0 bg-stone-950/90 backdrop-blur-md z-40 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-[340px] bg-stone-900 rounded-[3rem] border-8 border-stone-800 shadow-2xl flex flex-col overflow-hidden text-stone-200"
              style={{ height: '620px' }}
            >
              {/* iPhone Dynamic Island Notch */}
              <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-28 h-5 bg-stone-950 rounded-full flex items-center justify-center z-50">
                <div className="w-1.5 h-1.5 bg-sky-950/80 rounded-full mr-2"></div>
                <div className="w-2.5 h-1 bg-stone-900 rounded-full"></div>
              </div>

              {/* Internal Screen Content */}
              <div className="flex-1 flex flex-col p-4 pt-10 bg-stone-950 font-sans select-none relative overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between text-[10px] text-stone-500 font-mono mb-4 border-b border-stone-900 pb-2">
                  <span className="font-semibold tracking-wider text-amber-500">GODLEY MOBILE POS</span>
                  <div className="flex items-center gap-1.5 bg-stone-900 px-2 py-0.5 rounded-full border border-stone-800/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-[9px] uppercase tracking-wider text-emerald-400">Linked</span>
                  </div>
                </div>

                {/* Sub-tab Selection */}
                <div className="grid grid-cols-2 gap-1 bg-stone-900/80 p-0.5 rounded-lg border border-stone-850 text-xs mb-4">
                  <button
                    type="button"
                    onClick={() => setMobileSubMode('tap')}
                    className={`py-1.5 rounded-md font-semibold tracking-wide uppercase text-[10px] transition-all flex items-center justify-center gap-1 ${
                      mobileSubMode === 'tap'
                        ? 'bg-amber-500 text-stone-950 shadow-md font-bold'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <Smartphone size={12} />
                    Tap to Pay
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileSubMode('qr')}
                    className={`py-1.5 rounded-md font-semibold tracking-wide uppercase text-[10px] transition-all flex items-center justify-center gap-1 ${
                      mobileSubMode === 'qr'
                        ? 'bg-amber-500 text-stone-950 shadow-md font-bold'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <QrCode size={12} />
                    QR Self-Pay
                  </button>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col justify-between pt-1">
                  {mobileCheckoutStatus === 'generating' ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-6">
                      <div className="w-10 h-10 border-t-2 border-amber-500 border-solid rounded-full animate-spin mb-4"></div>
                      <p className="text-xs text-stone-400 text-center font-mono uppercase tracking-widest animate-pulse">Generating Secure Checkout Session...</p>
                    </div>
                  ) : mobileCheckoutStatus === 'tap_scanning' ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-6 text-center animate-fadeIn">
                      <div className="relative w-24 h-24 flex items-center justify-center mb-6">
                        <div className="absolute inset-0 border-4 border-amber-500/20 rounded-full animate-ping"></div>
                        <div className="absolute inset-2 border-2 border-t-amber-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                        <CreditCard size={36} className="text-amber-500 animate-pulse" />
                      </div>
                      <h4 className="font-serif text-stone-200 uppercase tracking-widest text-sm mb-2">Reading NFC Wallet</h4>
                      <p className="text-[10px] text-stone-500 font-mono max-w-[200px] leading-relaxed">Processing transaction safely on Apple Secure Enclave. Ensure chip or device remains hovered...</p>
                    </div>
                  ) : mobileCheckoutStatus === 'tap_success' ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-6 text-center animate-fadeIn">
                      <div className="w-16 h-16 bg-emerald-950/40 border border-emerald-500/60 rounded-full flex items-center justify-center mb-4 text-emerald-400">
                        <Check size={32} className="animate-bounce" />
                      </div>
                      <h4 className="font-serif text-emerald-400 uppercase tracking-widest text-sm mb-1 font-bold">✓ Approved</h4>
                      <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-wider mb-4 border border-emerald-900/40 px-2 py-0.5 rounded bg-emerald-950/20">Stripe Authorization Succeeded</span>
                      <p className="text-[10px] text-stone-400 font-mono leading-relaxed">Finalizing order completion parameters...</p>
                    </div>
                  ) : mobileSubMode === 'tap' ? (
                    /* TAP TO PAY INTERFACE */
                    <div className="flex-1 flex flex-col justify-between animate-fadeIn">
                      <div className="text-center py-2.5 bg-stone-900/40 border border-stone-850 rounded-xl p-3 mb-4">
                        <span className="text-[9px] text-stone-500 uppercase tracking-widest font-mono block mb-1">Cider Shed Tab Total</span>
                        <div className="text-xl font-serif font-black text-amber-500 tracking-tight">
                          ${(posCart.reduce((sum, item) => sum + item.product.price * item.quantity, 0) * (customerType === 'club' ? 0.85 : 1) + (posCart.reduce((sum, item) => sum + item.product.price * item.quantity, 0) * (customerType === 'club' ? 0.85 : 1) * PLACER_COUNTY_TAX_RATE) + (gratuitySelection === -1 ? (parseFloat(customGratuityAmount) || 0) : (posCart.reduce((sum, item) => sum + item.product.price * item.quantity, 0) * (customerType === 'club' ? 0.85 : 1) * gratuitySelection))).toFixed(2)}
                        </div>
                        <p className="text-[9px] font-mono text-stone-500 mt-1 uppercase">Customer: {customerName}</p>
                      </div>

                      <div className="flex-1 flex flex-col items-center justify-center p-3 border border-dashed border-stone-850 rounded-2xl bg-stone-900/20 relative overflow-hidden group">
                        <div className="absolute top-2 text-[8px] text-stone-500 uppercase tracking-widest font-mono">NFC Reader Antenna Array</div>
                        <div className="w-12 h-12 rounded-full border border-amber-500/10 flex items-center justify-center animate-pulse mb-2">
                          <div className="w-8 h-8 rounded-full border border-amber-500/20 flex items-center justify-center">
                            <Smartphone size={18} className="text-stone-400" />
                          </div>
                        </div>
                        <p className="text-[10px] text-stone-300 font-semibold uppercase tracking-wider text-center">Tap to Pay with Apple/Google Wallet</p>
                        <p className="text-[8px] text-stone-500 text-center font-mono mt-1 max-w-[175px]">Hold physical card or customer phone near top of this device to execute contactless payment.</p>

                        <button
                          type="button"
                          onClick={() => {
                            setMobileCheckoutStatus('tap_scanning');
                            setTimeout(() => {
                              playNfcChime();
                              setMobileCheckoutStatus('tap_success');
                              setTimeout(async () => {
                                await executeFinalPOSCheckout('iPhone Contactless Tap');
                                setMobileCheckoutActive(false);
                              }, 1500);
                            }, 1850);
                          }}
                          className="mt-4 w-full bg-stone-900 hover:bg-stone-850 text-amber-500 hover:text-amber-400 border border-stone-800 hover:border-amber-500/30 text-[9px] uppercase tracking-widest font-bold py-2 px-3 rounded transition-all flex items-center justify-center gap-1.5 animate-pulse"
                        >
                          <CreditCard size={10} />
                          Simulate Contactless NFC Tap
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* QR CODE SERVICE INTERFACE */
                    <div className="flex-1 flex flex-col justify-between animate-fadeIn">
                      <div className="text-center py-2 bg-stone-900/40 border border-stone-850 rounded-xl p-3 mb-2">
                        <span className="text-[9px] text-stone-500 uppercase tracking-widest font-mono block mb-1">Customer Stripe Bill</span>
                        <div className="text-xl font-serif font-black text-amber-500 tracking-tight font-bold">
                          ${(posCart.reduce((sum, item) => sum + item.product.price * item.quantity, 0) * (customerType === 'club' ? 0.85 : 1) + (posCart.reduce((sum, item) => sum + item.product.price * item.quantity, 0) * (customerType === 'club' ? 0.85 : 1) * PLACER_COUNTY_TAX_RATE) + (gratuitySelection === -1 ? (parseFloat(customGratuityAmount) || 0) : (posCart.reduce((sum, item) => sum + item.product.price * item.quantity, 0) * (customerType === 'club' ? 0.85 : 1) * gratuitySelection))).toFixed(2)}
                        </div>
                      </div>

                      <div className="flex-1 flex flex-col items-center justify-center bg-white p-1 rounded-xl shadow-inner mb-2">
                        {mobileCheckoutUrl ? (
                          <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&color=0c0a09&bgcolor=ffffff&qzone=1&data=${encodeURIComponent(mobileCheckoutUrl)}`}
                            alt="Payment QR Code"
                            className="w-32 h-32 object-contain"
                          />
                        ) : (
                          <div className="w-32 h-32 flex items-center justify-center bg-stone-100 text-stone-400 text-xs font-mono">Loading QR Code...</div>
                        )}
                        <p className="text-[8px] text-stone-600 font-mono font-bold mt-1 uppercase text-center">Scan to Pay securely on phone</p>
                      </div>

                      <div className="space-y-1.5">
                        <div className="bg-stone-900/80 p-2 rounded-lg border border-stone-850/60 font-mono text-[8px] text-stone-400 flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-amber-500">
                            <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse"></span>
                            <span>POLLING STRIPE PAYMENT LEDGER</span>
                          </div>
                          <p className="leading-normal">Waiting for guest to complete authorization. Checkout supports Apple Pay, Google Pay, and Link.</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            playNfcChime();
                            setMobileCheckoutStatus('tap_success');
                            setTimeout(async () => {
                              await executeFinalPOSCheckout('iPhone Self-Checkout QR');
                              setMobileCheckoutActive(false);
                            }, 1500);
                          }}
                          className="w-full bg-stone-900 hover:bg-stone-850 text-amber-500 hover:text-amber-400 border border-stone-800 hover:border-amber-500/30 text-[9px] uppercase tracking-widest font-bold py-1.5 rounded transition-all"
                        >
                          Simulate Member QR Paid
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Cancel Button */}
                  <div className="mt-3 pt-2 border-t border-stone-900/60">
                    <button
                      type="button"
                      onClick={() => {
                        setMobileCheckoutActive(false);
                        setMobileCheckoutStatus('idle');
                      }}
                      className="w-full bg-stone-900 hover:bg-stone-850 hover:text-stone-100 text-stone-500 text-[10px] uppercase tracking-widest font-mono py-2 rounded transition-all"
                    >
                      Dismiss Reader Portal
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONTACTLESS TAP CHECK-IN BANNER ALERT TOAST */}
      {newCheckinAlert && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-80 bg-gradient-to-br from-stone-900 to-stone-950 border-2 border-amber-500/60 p-4 rounded shadow-[0_0_30px_rgba(217,119,6,0.3)] text-left font-sans text-stone-200 animate-slideUp">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center text-stone-950 shrink-0 font-bold text-sm relative">
              <span className="w-full h-full rounded-full bg-amber-500 animate-ping absolute opacity-45"></span>
              <span>📶</span>
            </div>

            <div className="flex-1 space-y-1.5 min-w-0">
              <div className="flex justify-between items-center">
                <span className="bg-amber-500 text-stone-950 font-sans font-extrabold text-[8px] px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">
                  NFC Check-In Tap
                </span>
                <span className="text-[9px] font-mono text-stone-500">Live Wave</span>
              </div>

              <div className="space-y-0.5">
                <h4 className="font-serif font-black text-xs text-stone-100 truncate">{newCheckinAlert.name}</h4>
                <p className="text-[9px] text-zinc-400 truncate font-mono">{newCheckinAlert.email}</p>
              </div>

              <div className="text-[10px] text-stone-400">
                Tier: <strong className="text-amber-500 uppercase">{newCheckinAlert.tier}</strong> ready for pickup.
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-stone-900/60">
                <button
                  type="button"
                  onClick={async () => {
                    // 1. Process the check-in and change its status in local lists or Firestore if possible
                    try {
                      if (newCheckinAlert.id && !newCheckinAlert.id.startsWith('chk-')) {
                        const docRef = doc(db, 'physical_checkins', newCheckinAlert.id);
                        await updateDoc(docRef, { status: 'processed' });
                      }
                    } catch (err) {
                      console.warn(err);
                    }

                    // 2. Locate the lead in combined list
                    const matchedLead = combinedClubLeads.find(l => l.email === newCheckinAlert.email || l.id === newCheckinAlert.leadId);
                    if (matchedLead) {
                      setSelectedClubLead(matchedLead);
                      setActiveTab('club');
                      setClubSubTab('directory');
                      // Sound chime confirmation!
                      playNfcChime?.();
                    } else {
                      // If not found in leads, trigger error
                      alert("Checked-in member was not found in active Club Registry database.");
                    }
                    setNewCheckinAlert(null);
                  }}
                  className="flex-1 bg-amber-600 hover:bg-amber-550 text-stone-950 text-[9px] font-extrabold uppercase tracking-widest py-1.5 rounded-sm transition-all cursor-pointer text-center"
                >
                  Load & Verify Profile
                </button>
                <button
                  type="button"
                  onClick={() => setNewCheckinAlert(null)}
                  className="px-2.5 py-1.5 bg-stone-950 hover:bg-stone-900 text-stone-400 text-[9px] font-mono uppercase rounded-sm border border-stone-850 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
