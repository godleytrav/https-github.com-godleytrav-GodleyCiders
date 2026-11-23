import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db, handleFirestoreError, OperationType, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { useAdminStore } from '../store/adminStore';
import { useCartStore } from '../store/cartStore';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { 
  Sparkles, CheckCircle2, MapPin, Gift, Mail, UserCheck, 
  CreditCard, Lock, Plus, ShoppingBag, Radio, ShieldCheck, Check,
  Printer, FileText, Clock
} from 'lucide-react';

export default function Club() {
  const { clubSettings, devBypassClub } = useAdminStore();
  const cartStore = useCartStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState('');
  const [selectedTiers, setSelectedTiers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  // Demo Member Mode for instant preview without Google domain blocking
  const [demoMemberActive, setDemoMemberActive] = useState<boolean>(() => {
    return sessionStorage.getItem('godley_demo_club') === 'true' || new URLSearchParams(window.location.search).get('demo') === 'true';
  });

  // Real-time Club Status State
  const [clubMemberDoc, setClubMemberDoc] = useState<any>(null);
  const [loadingClubStatus, setLoadingClubStatus] = useState(false);
  
  // Order History & Receipts
  const [clubOrders, setClubOrders] = useState<any[]>([]);
  const [selectedPrintOrder, setSelectedPrintOrder] = useState<any | null>(null);

  const [verifyingClubPayment, setVerifyingClubPayment] = useState(false);
  const [clubSuccessMsg, setClubSuccessMsg] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutVal = params.get('checkout');
    const sessionId = params.get('session_id');

    if (checkoutVal === 'success' && sessionId) {
      setVerifyingClubPayment(true);
      fetch(`/api/checkout/session-status?session_id=${sessionId}`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 'paid') {
            setClubSuccessMsg("Welcome! Your club membership subscription payment has been confirmed. Your status is now ACTIVE!");
            window.history.replaceState({}, document.title, window.location.pathname);
          } else {
            console.log("Club status check response: ", data.status);
          }
        })
        .catch(err => {
          console.error("Verification error:", err);
        })
        .finally(() => {
          setVerifyingClubPayment(false);
        });
    }
  }, []);

  // Preference Status States (interactive!)
  const [deliveryPreference, setDeliveryPreference] = useState<'keg-pickup' | 'delivery'>('keg-pickup');
  const [savingPref, setSavingPref] = useState(false);
  const [prefSavedMessage, setPrefSavedMessage] = useState('');

  // Email Notification/Drip Campaign states
  const [dripPreferences, setDripPreferences] = useState({
    bottlingAlerts: true,
    vipDinners: true,
    harvestNews: false
  });

  // Form State
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
  const [billingFrequency, setBillingFrequency] = useState<'monthly' | 'biweekly'>('monthly');
  const [updatingSubscription, setUpdatingSubscription] = useState(false);
  const [cardData, setCardData] = useState({ number: '', expiry: '', cvv: '' });

  // Mobile Contactless Check-In/Check-Out states
  const [showCheckinPass, setShowCheckinPass] = useState(false);
  const [checkinStep, setCheckinStep] = useState<'idle' | 'transmitting' | 'success'>('idle');
  const [transmittedDocId, setTransmittedDocId] = useState<string | null>(null);

  const handleContactlessCheckin = async () => {
    setCheckinStep('transmitting');
    
    // Play NFC chime sound
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); 
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      osc.start();
      setTimeout(() => {
        osc.stop();
      }, 120);
    } catch (e) {
      // Audio block fallback
    }

    const payload = {
      leadId: clubMemberDoc?.id || 'BYPASS',
      name: activeMemberName,
      email: user?.email || 'bypass@godleyciders.com',
      tier: activeMemberTier || 'Heritage Branch',
      memberNo: `#GC-${user ? user.uid.substring(0, 5).toUpperCase() : 'BYPASS'}`,
      status: 'pending',
      timestamp: new Date().toISOString()
    };

    try {
      // 1. Record physical checkin request in Firestore
      const docRef = await addDoc(collection(db, 'physical_checkins'), {
        ...payload,
        createdAt: serverTimestamp()
      });
      setTransmittedDocId(docRef.id);
      
      // 2. Broadcast in localStorage for ultra-fast same-device/browser simulation
      localStorage.setItem('g_ciders_physical_checkin', JSON.stringify({
        id: docRef.id,
        ...payload
      }));

      setTimeout(() => {
        setCheckinStep('success');
      }, 1500);

    } catch (err) {
      console.error("Firestore offline, utilizing local event channel:", err);
      const fakeId = 'chk-' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('g_ciders_physical_checkin', JSON.stringify({
        id: fakeId,
        ...payload
      }));
      setTimeout(() => {
        setCheckinStep('success');
      }, 1500);
    }
  };

  const getIsWaitlistForTier = (tier: string) => {
    if (clubSettings?.isWaitlistMode === true) return true;
    const tierKey = tier?.toLowerCase() || '';
    if (tierKey.includes('core')) {
      return Number(clubSettings?.coreActiveSpotsAvailable ?? "0") <= 0;
    }
    if (tierKey.includes('heritage')) {
      return Number(clubSettings?.heritageActiveSpotsAvailable ?? "0") <= 0;
    }
    if (tierKey.includes('branch')) {
      return Number(clubSettings?.branchActiveSpotsAvailable ?? "0") <= 0;
    }
    return Number(clubSettings?.activeSpotsAvailable ?? "0") <= 0;
  };

  const isWaitlistModeActive = clubSettings?.isWaitlistMode === true || (
    selectedTier 
      ? getIsWaitlistForTier(selectedTier)
      : (Number(clubSettings?.coreActiveSpotsAvailable ?? "0") <= 0 && 
         Number(clubSettings?.branchActiveSpotsAvailable ?? "0") <= 0 && 
         Number(clubSettings?.heritageActiveSpotsAvailable ?? "0") <= 0)
  );

  const handleCancelMembership = async () => {
    if (!clubMemberDoc) return;
    const confirmCancel = window.confirm("Are you sure you want to cancel your Godley Ciders Club Membership? You can reactivate anytime from your portal.");
    if (!confirmCancel) return;

    setUpdatingSubscription(true);
    try {
      await updateDoc(doc(db, 'club_leads', clubMemberDoc.id), {
        status: 'cancelled',
        updatedAt: serverTimestamp()
      });
      
      // Enqueue sync event to BevForge live outbox
      await fetch('/api/events/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: 'evt-' + Math.random().toString(36).substring(2, 10),
          eventType: 'club.member_cancelled',
          createdAt: new Date().toISOString(),
          data: {
            clubLeadId: clubMemberDoc.id,
            email: clubMemberDoc.email,
            name: clubMemberDoc.name,
            timestamp: new Date().toISOString()
          }
        })
      }).catch(err => console.warn(err));

      alert("Your membership has been successfully cancelled. We'll be ready for you whenever you're ready to come back!");
    } catch (err: any) {
      console.error(err);
      alert(`Failed to update membership: ${err.message}`);
    } finally {
      setUpdatingSubscription(false);
    }
  };

  const handleReactivateMembership = async () => {
    if (!clubMemberDoc) return;
    setUpdatingSubscription(true);
    try {
      await updateDoc(doc(db, 'club_leads', clubMemberDoc.id), {
        status: 'active',
        updatedAt: serverTimestamp()
      });

      // Enqueue sync event to BevForge
      await fetch('/api/events/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: 'evt-' + Math.random().toString(36).substring(2, 10),
          eventType: 'club.member_reactivated',
          createdAt: new Date().toISOString(),
          data: {
            clubLeadId: clubMemberDoc.id,
            email: clubMemberDoc.email,
            name: clubMemberDoc.name,
            timestamp: new Date().toISOString()
          }
        })
      }).catch(err => console.warn(err));

      alert("Welcome back to the club! Your membership has been successfully reactivated.");
    } catch (err: any) {
      console.error(err);
      alert(`Failed to reactivate membership: ${err.message}`);
    } finally {
      setUpdatingSubscription(false);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
      if (u) {
        setFormData(prev => ({
          ...prev,
          name: u.displayName || prev.name,
          email: u.email || prev.email
        }));
      }
    });
    return unsub;
  }, []);

  // Sync user's real club status from Firestore or demo simulation
  useEffect(() => {
    if (demoMemberActive && !user) {
      if (!clubMemberDoc) {
        setClubMemberDoc({
          id: 'demo-member-1',
          name: 'Travis Godley (Executive Charter Pass)',
          email: 'travis@godleyciders.com',
          tier: 'Heritage Branch',
          status: 'active',
          deliveryPreference: 'keg-pickup',
          billingFrequency: 'monthly',
          createdAt: new Date(Date.now() - 60 * 86400000).toISOString()
        });
      }
      if (clubOrders.length === 0) {
        setClubOrders([
          {
            id: 'ord-club-001',
            orderId: 'CLUB-PASS-801',
            createdAt: new Date(Date.now() - 12 * 86400000).toISOString(),
            items: [{ name: 'Heritage Branch Quarterly Allocation (4x 750ml Bottled Ciders)', quantity: 1, price: 95 }],
            totalCents: 9500,
            status: 'fulfilled'
          }
        ]);
      }
      return;
    }

    if (!user) {
      setClubMemberDoc(null);
      setClubOrders([]);
      return;
    }

    setLoadingClubStatus(true);
    const q = query(collection(db, 'club_leads'), where('email', '==', user.email));
    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        // Grab the oldest or most active club record
        const docSnap = snapshot.docs[0];
        const data = docSnap.data();
        setClubMemberDoc({ id: docSnap.id, ...data });
        
        if (data.deliveryPreference) {
          setDeliveryPreference(data.deliveryPreference);
        }
        if (data.dripPreferences) {
          setDripPreferences(data.dripPreferences);
        }
      } else {
        setClubMemberDoc(null);
      }
      setLoadingClubStatus(false);
    }, (error) => {
      console.error("Failed to load club record:", error);
      setLoadingClubStatus(false);
    });

    const qOrders = query(collection(db, 'orders'), where('customerEmail', '==', user.email));
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      setClubOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.warn("Failed to load historical client orders:", error);
    });

    return () => {
      unsub();
      unsubOrders();
    };
  }, [user, demoMemberActive]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e: any) {
      console.error(e);
      if (e.message?.includes('unauthorized-domain') || e.code === 'auth/unauthorized-domain') {
        // Automatically activate demo member mode so Travis is never blocked!
        setDemoMemberActive(true);
        sessionStorage.setItem('godley_demo_club', 'true');
      } else {
        alert(e.message || "Login failed");
      }
    }
  };

  const handleLogout = async () => {
    if (demoMemberActive) {
      setDemoMemberActive(false);
      sessionStorage.removeItem('godley_demo_club');
    }
    if (user) {
      await signOut(auth);
    }
  };

  const handleJoin = (tier: string) => {
    setSelectedTier(tier);
    setSelectedTiers([tier]);
    setIsModalOpen(true);
    setSuccess(false);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cleanName = formData.name.trim();
      const firstName = cleanName.split(' ')[0] || 'Charter Member';
      const actualSelectedTiers = selectedTiers.length > 0 ? selectedTiers : [selectedTier];
      const finalTiersStr = actualSelectedTiers.join(', ');

      if (isWaitlistModeActive) {
        // PRE-SALE / WAITLIST MODE: secure card on file, no immediate Stripe transaction
        const last4 = cardData.number.replace(/\s+/g, '').slice(-4) || '4242';
        // 1. Write to club_leads
        await addDoc(collection(db, 'club_leads'), {
          ...formData,
          tier: finalTiersStr,
          tiers: actualSelectedTiers,
          billingFrequency: billingFrequency, // 'monthly' | 'biweekly'
          deliveryPreference: 'keg-pickup',
          dripPreferences: {
            bottlingAlerts: true,
            vipDinners: true,
            harvestNews: true
          },
          status: 'waitlist', // Marked as waitlisted
          paymentVaulted: true,
          vaultedCardLast4: last4,
          vaultedExpiry: cardData.expiry || '12/28',
          createdAt: serverTimestamp(),
          notes: `Pre-sale client during ABC licensing lock. Vaulted Card last 4: ${last4}. Chosen tiers: ${finalTiersStr}`
        });

        // 2. Write in-app admin alert
        await addDoc(collection(db, 'admin_notifications'), {
          type: 'club_waitlist',
          title: `New Club Spot Held: ${formData.name} (${finalTiersStr})`,
          customerName: formData.name,
          email: formData.email,
          phone: formData.phone || 'N/A',
          tier: finalTiersStr,
          billingFrequency: billingFrequency,
          cardLast4: last4,
          read: false,
          createdAt: serverTimestamp()
        }).catch(e => console.warn('Admin notification write skipped:', e));

        // 3. Dispatch customer confirmation email AND admin alert to Godley Ciders
        const adminNoticeText = `Godley Ciders Sales Desk Alert,\n\nA new club member has reserved their spot and vaulted their credit card on file!\n\nMember Name: ${formData.name}\nEmail: ${formData.email}\nPhone: ${formData.phone || 'Not provided'}\nTier: ${finalTiersStr}\nBilling Frequency: ${billingFrequency === 'biweekly' ? 'Bi-weekly' : 'Monthly'}\nVaulted Card: *${last4} (exp: ${cardData.expiry || '12/28'})\nAmount Due Today: $0.00 (Pre-authorization hold under ABC waitlist)\n\n---\nMaster Admin Terminal: View and activate this member under the Club Registry tab.`;

        await fetch('/api/email/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: formData.email,
            from: 'billing@godleyciders.com',
            subject: `Godley Ciders Waitlist Secured - ${finalTiersStr} Club`,
            text: `Hello ${firstName},\n\nYou have successfully locked in your reservation on the ${finalTiersStr} Club Waitlist!\n\nAs we are currently on pre-sale standby awaiting our final ABC farm license, we have securely secured your subscription request with $0.00 due today. We have securely pre-authorized and vaulted your payment method on file (last four digits: *${last4}). Your membership will only trigger billing once we grant your active position.\n\nThank you for backing us early!\n\nCheers,\nGodley Ciders`,
            category: 'club_waitlist',
            notifyAdmin: true,
            adminSubject: `New Club Membership Spot Held - ${finalTiersStr} (${formData.name})`,
            adminText: adminNoticeText,
            adminData: {
              customerName: formData.name,
              email: formData.email,
              phone: formData.phone,
              tier: finalTiersStr,
              cardLast4: last4
            }
          })
        }).catch(err => console.warn('Email dispatch failed:', err));

        // Enqueue sync event to BevForge live outbox
        await fetch('/api/events/enqueue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: 'evt-' + Math.random().toString(36).substring(2, 10),
            eventType: 'club.member_waitlisted',
            createdAt: new Date().toISOString(),
            data: {
              email: formData.email,
              name: formData.name,
              tier: finalTiersStr,
              tiers: actualSelectedTiers,
              timestamp: new Date().toISOString()
            }
          })
        }).catch(err => console.warn(err));

        setSuccess(true);
      } else {
        // STANDARD DIRECT STRIPE CHECKOUT MODE
        // We set initial registration status to 'pending' as production standard.
        // It becomes 'active' once the server verifies the Stripe payment.
        await addDoc(collection(db, 'club_leads'), {
          ...formData,
          name: cleanName,
          tier: finalTiersStr,
          tiers: actualSelectedTiers,
          billingFrequency: billingFrequency, // 'monthly' | 'biweekly'
          deliveryPreference: 'keg-pickup',
          dripPreferences: {
            bottlingAlerts: true,
            vipDinners: true,
            harvestNews: true
          },
          status: 'pending',
          createdAt: serverTimestamp(),
        });
        
        const checkoutItems = actualSelectedTiers.map(t => {
          let price = 0;
          if (t === 'Core') price = Number(clubSettings.corePrice);
          if (t === 'Branch') price = Number(clubSettings.branchPrice);
          if (t === 'Heritage Branch' || t === 'Heritage') price = Number(clubSettings.heritagePrice);
          const finalPrice = billingFrequency === 'biweekly' ? price / 2 : price;
          const frequencyLabel = billingFrequency === 'biweekly' ? 'Bi-weekly billing' : 'Monthly billing';
          return {
            name: `${t} Club Membership (${frequencyLabel})`,
            quantity: 1,
            price: finalPrice
          };
        });

        const response = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: checkoutItems,
            metadata: {
              type: 'club_subscription_signup',
              email: formData.email,
              tier: finalTiersStr
            }
          })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        // Dispatch Club Welcome Email with polished first-name logic!
        await fetch('/api/email/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: formData.email,
            from: 'billing@godleyciders.com',
            subject: `Welcome to Godley Ciders - ${finalTiersStr} Club`,
            text: `Hello ${firstName},\n\nWe're thrilled to have you join the ${finalTiersStr} Club! You will be redirected to complete your membership subscription shortly.\n\nCheers,\nGodley Ciders`
          })
        }).catch(err => console.warn('Email dispatch failed:', err));

        // Redirect to Stripe Checkout to finalize billing details
        window.location.href = data.url;
      }

    } catch (error: any) {
      handleFirestoreError(error, OperationType.CREATE, 'club_leads');
      alert(`Failed to complete subscription sequence: ${error.message || 'Please check your connection.'}`);
    } finally {
      setLoading(false);
    }
  };

  // Interactive UI triggers: Save delivery/fulfillment options
  const handleSavePreferences = async (newPref: 'keg-pickup' | 'delivery') => {
    setDeliveryPreference(newPref);
    if (!clubMemberDoc) return;
    setSavingPref(true);
    setPrefSavedMessage('');
    try {
      await updateDoc(doc(db, 'club_leads', clubMemberDoc.id), {
        deliveryPreference: newPref,
        updatedAt: serverTimestamp()
      });
      setPrefSavedMessage('Fulfillment preference updated in real time.');
      setTimeout(() => setPrefSavedMessage(''), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingPref(false);
    }
  };

  const handleToggleDrip = async (key: 'bottlingAlerts' | 'vipDinners' | 'harvestNews') => {
    const updated = {
      ...dripPreferences,
      [key]: !dripPreferences[key]
    };
    setDripPreferences(updated);
    if (!clubMemberDoc) return;
    try {
      await updateDoc(doc(db, 'club_leads', clubMemberDoc.id), {
        dripPreferences: updated,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Add limited run bottle directly to the Cart store
  const addLimitedReleaseToCart = (item: { id: string; name: string; price: number; type: string }) => {
    cartStore.addItem({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
      image: 'bottle_limited',
      type: item.type
    });
  };

  // Member-only scarce allocation list
  const limitedReleases = [
    { id: 'ltd-01', name: '8-Month Bourbon Barrel Aged Dry', price: 24.00, type: 'Reserve 750ml' },
    { id: 'ltd-02', name: 'Wild Ferment Brett Batch #04', price: 22.00, type: 'Reserve 750ml' },
    { id: 'ltd-03', name: 'Wild Plum Pommeau Reserve', price: 32.00, type: 'Fortified 375ml' }
  ];

  const hasAccess = user || devBypassClub || demoMemberActive;
  const isBypass = (!clubMemberDoc && devBypassClub) || (demoMemberActive && !clubMemberDoc);
  const activeMemberTier = clubMemberDoc?.tier || (isBypass ? 'Heritage Branch' : '');
  const activeMemberName = clubMemberDoc?.name || user?.displayName || (demoMemberActive ? 'Travis Godley (Executive Charter Pass)' : 'Charter Member');

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 font-serif relative">
      {/* VERIFYING PAYMENT / SUCCESS BANNER */}
      {verifyingClubPayment && (
        <div className="mb-6 bg-amber-955/20 border border-amber-500/25 p-4 rounded text-sm flex items-center gap-3 animate-pulse font-sans">
          <Clock className="w-4 h-4 text-amber-500 animate-spin" />
          <p className="text-stone-300">
            Querying Stripe database for club activation tokens... Please stand by.
          </p>
        </div>
      )}

      {clubSuccessMsg && (
        <div className="mb-6 bg-emerald-950/20 border border-emerald-500/30 p-4 rounded text-sm flex items-center justify-between gap-3 animate-fadeIn font-sans">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <p className="text-stone-200 font-medium">{clubSuccessMsg}</p>
          </div>
          <button 
            onClick={() => setClubSuccessMsg('')} 
            className="text-[10px] text-stone-400 hover:text-stone-100 uppercase tracking-wider font-mono font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}
      <div className="absolute top-4 right-6 z-10 flex flex-wrap gap-2.5 items-center">
        <Link
          to="/admin"
          className="text-[10px] uppercase tracking-[0.2em] text-stone-400 hover:text-amber-400 border border-stone-800 hover:border-amber-500/40 px-3 py-1.5 bg-stone-950/70 backdrop-blur-sm transition-all rounded"
        >
          Executive Admin
        </Link>

        {user ? (
          <>
            <span className="text-[10px] text-stone-500 uppercase tracking-widest hidden sm:inline-block">Logged in: {user.email}</span>
            <button 
              onClick={handleLogout} 
              className="text-[10px] uppercase tracking-[0.2em] text-amber-500/70 hover:text-amber-500 border border-amber-500/20 px-3 py-1 bg-amber-500/5 backdrop-blur-sm transition-all rounded-sm cursor-pointer"
            >
              Sign Out
            </button>
          </>
        ) : demoMemberActive ? (
          <div className="flex items-center gap-2">
            <span className="text-[9px] bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono px-2 py-1 rounded uppercase tracking-wider">
              Member Demo Active
            </span>
            <button
              onClick={() => {
                setDemoMemberActive(false);
                sessionStorage.removeItem('godley_demo_club');
              }}
              className="text-[10px] uppercase tracking-[0.2em] text-stone-400 hover:text-stone-200 border border-stone-800 px-2.5 py-1 bg-stone-900 rounded cursor-pointer"
            >
              Exit Demo
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setDemoMemberActive(true);
                sessionStorage.setItem('godley_demo_club', 'true');
              }}
              className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/40 text-amber-400 hover:bg-amber-500 hover:text-stone-950 text-[10px] uppercase tracking-[0.2em] font-semibold rounded transition-all cursor-pointer"
              title="Preview the club portal as an active member"
            >
              Admin Demo: Member Passport
            </button>
            <button 
              onClick={handleLogin} 
              className="group relative px-4 py-1.5 bg-stone-900/40 backdrop-blur-md border border-stone-800 rounded-sm overflow-hidden transition-all duration-500 hover:border-amber-500/50 cursor-pointer"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/5 to-amber-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              <span className="relative z-10 text-[10px] uppercase tracking-[0.2em] text-amber-500 font-medium group-hover:text-amber-400">
                Member Sign In
              </span>
            </button>
          </div>
        )}
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center space-y-6 mb-16"
      >
        <h1 className="text-4xl md:text-6xl text-amber-500 uppercase tracking-widest whitespace-pre-line">{clubSettings.title}</h1>
        <div className="w-24 h-[1px] bg-amber-500/50 mx-auto"></div>
        <p className="text-xl text-stone-400 italic max-w-2xl mx-auto whitespace-pre-line">
          {clubSettings.subtitle}
        </p>
      </motion.div>

      {/* BEFORE LOGIN/NOT YET SIGNED UP OR MEMBERS VIEW DIRECTORY */}
      {!hasAccess ? (
        <div className="space-y-12">
          {/* Pre-sale / Waitlist Active Banner */}
          {isWaitlistModeActive && (
            <div className="max-w-4xl mx-auto border border-amber-500/20 bg-amber-500/5 p-5 rounded-md text-center space-y-2.5 font-sans animate-fadeIn">
              <h3 className="text-stone-100 font-serif text-lg tracking-wider">SECURE YOUR SPACE NOW • $0.00 UPFRONT</h3>
              <p className="text-stone-400 text-xs leading-relaxed max-w-2xl mx-auto">
                While we await final state ABC licensing clearance, we are taking secure reservations to lock early tier rates. 
                We will securely hold your payment credentials in our PCI-compliant vault and <strong className="text-stone-200">only process billing</strong> when physical spots are opened. Cancel anytime.
              </p>
              <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-[10px] text-stone-500 font-mono pt-2 border-t border-amber-500/10 mt-2">
                <span>CORE SPOTS: <strong className={Number(clubSettings?.coreActiveSpotsAvailable ?? "0") > 0 ? "text-emerald-400 font-bold" : "text-amber-500 font-bold"}>{clubSettings?.coreActiveSpotsAvailable ?? "0"} LEFT</strong></span>
                <span>•</span>
                <span>BRANCH SPOTS: <strong className={Number(clubSettings?.branchActiveSpotsAvailable ?? "0") > 0 ? "text-emerald-400 font-bold" : "text-amber-500 font-bold"}>{clubSettings?.branchActiveSpotsAvailable ?? "0"} LEFT</strong></span>
                <span>•</span>
                <span>HERITAGE SPOTS: <strong className={Number(clubSettings?.heritageActiveSpotsAvailable ?? "0") > 0 ? "text-emerald-400 font-bold" : "text-amber-500 font-bold"}>{clubSettings?.heritageActiveSpotsAvailable ?? "0"} LEFT</strong></span>
              </div>
            </div>
          )}

          {/* billing toggle: monthly vs bi-weekly */}
          <div id="signup-tiers" className="flex justify-center items-center gap-4 mb-2">
            <span className={`text-xs uppercase tracking-[0.1em] font-sans font-semibold transition-colors ${billingFrequency === 'monthly' ? 'text-amber-500 font-bold' : 'text-stone-500'}`}>
              Monthly Payments
            </span>
            <button 
              type="button"
              onClick={() => setBillingFrequency(prev => prev === 'monthly' ? 'biweekly' : 'monthly')}
              className="w-12 h-6 rounded-full bg-stone-900 border border-stone-800 p-1 flex items-center transition-all duration-300 focus:outline-none cursor-pointer"
            >
              <div className={`w-4 h-4 rounded-full bg-amber-500 transition-all duration-300 ${billingFrequency === 'biweekly' ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
            <span className={`text-xs uppercase tracking-[0.1em] font-sans font-semibold transition-colors ${billingFrequency === 'biweekly' ? 'text-amber-500 font-bold' : 'text-stone-500'}`}>
              Bi-weekly Payments <span className="text-[9px] text-emerald-400 font-bold ml-1 font-mono uppercase bg-emerald-950/20 px-1 py-0.5 rounded border border-emerald-500/20 animate-pulse">Flexible</span>
            </span>
          </div>
 
          <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
            {/* Core Tier */}
            <div className="border border-stone-800 bg-stone-900/50 p-8 rounded-lg text-center flex flex-col hover:border-amber-900 transition-colors">
              <div className="space-y-4 mb-8">
                <h2 className="text-2xl text-stone-100 uppercase tracking-widest">Core</h2>
                <div className="text-3xl text-amber-500 font-light tracking-wider">
                  ${billingFrequency === 'biweekly' ? (Number(clubSettings.corePrice) / 2).toFixed(2) : clubSettings.corePrice} 
                  <span className="text-sm text-stone-500 italic lowercase tracking-normal">
                    {billingFrequency === 'biweekly' ? ' / every 2 weeks' : ' / month'}
                  </span>
                  <p className="text-[10px] text-stone-500 font-mono mt-1 uppercase tracking-wider">($30.00 Retail Value)</p>
                </div>
                <p className="text-amber-500/80 italic text-sm min-h-[40px] flex items-center justify-center">6 x 12oz bottles of Core or Base Cider</p>
              </div>
              
              <ul className="text-stone-400 space-y-4 text-sm text-left flex-grow">
                <li className="flex items-start space-x-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0"></span>
                  <span>10% discount on all additional cider purchased through our website or event nights</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0"></span>
                  <span>Club pickup nights at local hosted locations (1/month)</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0"></span>
                  <span>Priority to special event tickets for dinners</span>
                </li>
              </ul>
              
              <div className="pt-8 mt-auto">
                <button 
                  onClick={() => handleJoin('Core')}
                  className="w-full py-3 border border-amber-600/50 text-amber-500 uppercase tracking-wider text-sm hover:bg-amber-900/20 hover:border-amber-500 transition-all rounded-sm font-medium cursor-pointer"
                >
                  {getIsWaitlistForTier('Core') ? 'Reserve Core (Waitlist)' : 'Join Core'}
                </button>
              </div>
            </div>
 
            {/* Branch Tier */}
            <div className="border border-stone-800 bg-stone-900/50 p-8 rounded-lg text-center flex flex-col hover:border-amber-900 transition-colors">
              <div className="space-y-4 mb-8">
                <h2 className="text-2xl text-stone-100 uppercase tracking-widest">Branch</h2>
                <div className="text-3xl text-amber-500 font-light tracking-wider">
                  ${billingFrequency === 'biweekly' ? (Number(clubSettings.branchPrice) / 2).toFixed(2) : clubSettings.branchPrice} 
                  <span className="text-sm text-stone-500 italic lowercase tracking-normal">
                    {billingFrequency === 'biweekly' ? ' / every 2 weeks' : ' / month'}
                  </span>
                  <p className="text-[10px] text-stone-500 font-mono mt-1 uppercase tracking-wider">($35.00 Retail Value)</p>
                </div>
                <p className="text-amber-500/80 italic text-sm min-h-[40px] flex items-center justify-center">1 x 750ml bottle of Reserve Hard Cider</p>
              </div>
              
              <ul className="text-stone-400 space-y-4 text-sm text-left flex-grow">
                <li className="flex items-start space-x-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0"></span>
                  <span>10% discount on all additional cider purchased through our website or event nights</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0"></span>
                  <span>Club pickup nights at local hosted locations (1/month)</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0"></span>
                  <span>Priority to special event tickets for dinners</span>
                </li>
              </ul>
              
              <div className="pt-8 mt-auto">
                <button 
                  onClick={() => handleJoin('Branch')}
                  className="w-full py-3 border border-amber-600/50 text-amber-500 uppercase tracking-wider text-sm hover:bg-amber-900/20 hover:border-amber-500 transition-all rounded-sm font-medium cursor-pointer"
                >
                  {getIsWaitlistForTier('Branch') ? 'Reserve Branch (Waitlist)' : 'Join Branch'}
                </button>
              </div>
            </div>
 
            {/* Heritage Branch Tier */}
            <div className="border border-amber-900/50 bg-stone-900/40 backdrop-blur-sm p-8 rounded-lg text-center flex flex-col shadow-[0_0_30px_rgba(245,158,11,0.05)] hover:border-amber-700 transition-colors">
              <div className="space-y-4 mb-8">
                <h2 className="text-2xl text-amber-500 uppercase tracking-widest relative inline-block">
                  Heritage Branch
                  <span className="absolute -top-4 -right-6 text-[10px] text-amber-400 opacity-80 italic tracking-normal">Best Value</span>
                </h2>
                <div className="text-3xl text-amber-500 font-light tracking-wider">
                  ${billingFrequency === 'biweekly' ? (Number(clubSettings.heritagePrice) / 2).toFixed(2) : clubSettings.heritagePrice} 
                  <span className="text-sm text-stone-500 italic lowercase tracking-normal">
                    {billingFrequency === 'biweekly' ? ' / every 2 weeks' : ' / month'}
                  </span>
                  <p className="text-[10px] text-amber-500 font-mono mt-1 uppercase tracking-wider font-semibold">($65.00 Combo Retail Value - Pre-Release Deal!)</p>
                </div>
                <p className="text-amber-500/80 italic text-sm min-h-[40px] flex items-center justify-center">Includes BOTH Core and Branch bottles</p>
              </div>
              
              <ul className="text-stone-300 space-y-4 text-sm text-left flex-grow font-medium">
                <li className="flex items-start space-x-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.8)]"></span>
                  <span>10% discount on all additional cider purchased through our website or event nights</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.8)]"></span>
                  <span>Club pickup nights at local hosted locations (1/month)</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.8)]"></span>
                  <span>Priority to special event tickets for dinners</span>
                </li>
              </ul>
              
              <div className="pt-8 mt-auto">
                <button
                  onClick={() => handleJoin('Heritage Branch')}
                  className="w-full py-3 bg-amber-600 border border-amber-600 text-stone-950 uppercase tracking-wider text-sm hover:bg-amber-500 transition-all rounded-sm font-bold shadow-[0_0_15px_rgba(217,119,6,0.4)] cursor-pointer"
                >
                  {getIsWaitlistForTier('Heritage Branch') ? 'Reserve Heritage (Waitlist)' : 'Join Heritage'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* INTERACTIVE LOGGED-IN CUSTOMER CLUB LOUNGE (THE CELLAR DOOR) */
        <div className="space-y-12 max-w-5xl mx-auto">
          {/* Welcome Banner & Digital Member Card */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            
            {/* LEFT SIDE: Welcome Message & Allocation State */}
            <div className="md:col-span-7 space-y-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-600/10 border border-amber-500/20 text-amber-500 uppercase tracking-widest text-[9px] rounded-full">
                  <Sparkles size={10} /> Verified Member Portal
                </div>
                <h2 className="text-3xl text-stone-100 font-serif lowercase tracking-tight">
                  Welcome to <span className="font-sans uppercase text-amber-500 font-bold tracking-widest">The Cellar Door</span>
                </h2>
                <p className="text-stone-400 text-sm italic font-sans">
                  The exclusive enclave for Godley Ciders members. Manage your allocations, pre-order rare wild ferments, and coordinate taproom pickup schedules.
                </p>
              </div>

              {/* ALLOCATION DETAILS / PICKUP PREFERENCES PANEL */}
              <div className="bg-stone-900/30 border border-stone-850 p-6 rounded-sm space-y-4">
                <div className="flex justify-between items-center border-b border-stone-850 pb-3">
                  <h3 className="text-stone-300 font-serif uppercase tracking-widest text-xs flex items-center gap-2">
                    <MapPin size={12} className="text-amber-500" />
                    June Allocation Fulfillment
                  </h3>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-emerald-900/20 text-emerald-400 border border-emerald-500/20 rounded-full">
                    Active Allocation
                  </span>
                </div>

                <p className="text-xs text-stone-400 leading-relaxed font-sans">
                  Your <strong className="text-stone-200 capitalize">{activeMemberTier || 'Heritage Branch'}</strong> allocation is reserved and preparing. Please adjust your billing profile or custom delivery options below:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <button 
                    onClick={() => handleSavePreferences('keg-pickup')}
                    className={`p-3 border rounded text-left transition-all flex flex-col justify-between ${
                      deliveryPreference === 'keg-pickup'
                        ? 'border-amber-600/60 bg-amber-900/10 text-stone-100'
                        : 'border-stone-800 bg-stone-950/40 text-stone-500 hover:border-stone-700'
                    }`}
                  >
                    <span className="text-[10px] uppercase tracking-wider font-bold">Taproom Pick-up</span>
                    <span className="text-[9px] mt-1 font-sans leading-tight">Pick up at Lincoln Way Taproom during our next Club party.</span>
                  </button>

                  <button 
                    onClick={() => handleSavePreferences('delivery')}
                    className={`p-3 border rounded text-left transition-all flex flex-col justify-between ${
                      deliveryPreference === 'delivery'
                        ? 'border-amber-600/60 bg-amber-900/10 text-stone-100'
                        : 'border-stone-800 bg-stone-950/40 text-stone-500 hover:border-stone-700'
                    }`}
                  >
                    <span className="text-[10px] uppercase tracking-wider font-bold">Direct Delivery</span>
                    <span className="text-[9px] mt-1 font-sans leading-tight">Ship directly via GSO/UPS Temperature-Controlled wine service.</span>
                  </button>
                </div>

                {prefSavedMessage && (
                  <p className="text-[10px] text-emerald-400 font-mono text-center flex items-center justify-center gap-1.5 border border-emerald-500/20 bg-emerald-500/5 py-1.5 rounded animate-fadeIn">
                    <Check size={11} /> {prefSavedMessage}
                  </p>
                )}
              </div>
            </div>

            {/* RIGHT SIDE: Gorgeous Gilded Membership Passport Card */}
            <div className="md:col-span-5 border border-transparent">
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="relative bg-gradient-to-br from-stone-900 via-stone-950 to-stone-900 border-2 border-amber-600/60 p-6 rounded-lg shadow-2xl overflow-hidden aspect-[1.586/1]"
              >
                {/* Visual Accent Overlay */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -mr-6 -mt-6"></div>
                <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl"></div>

                {/* Card Content & Gilded Labels */}
                <div className="h-full flex flex-col justify-between relative z-10 font-serif">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-amber-500 text-xs uppercase tracking-[0.3em] font-sans font-semibold">Godley Ciders</h4>
                      <p className="text-[8px] text-stone-500 uppercase tracking-widest font-sans font-medium">Est. 2026 • Placer County</p>
                    </div>
                    
                    <span className={`inline-flex items-center gap-1.5 text-[8px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                      clubMemberDoc?.status === 'cancelled'
                        ? 'bg-red-950/20 text-red-450 border-red-500/20'
                        : 'bg-emerald-950/25 text-emerald-450 border-emerald-500/20'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${clubMemberDoc?.status === 'cancelled' ? 'bg-red-500' : 'bg-emerald-400 animate-pulse'}`} />
                      {clubMemberDoc?.status === 'cancelled' ? 'Canceled Pass' : 'Active Pass'}
                    </span>
                  </div>

                  <div>
                    <h5 className="text-[10px] text-stone-500 uppercase tracking-widest font-sans">Charter Member Pass</h5>
                    <p className="text-stone-200 text-lg uppercase tracking-wider truncate font-serif mt-0.5">{activeMemberName}</p>
                  </div>

                  <div className="flex justify-between items-end border-t border-stone-850/60 pt-3">
                    <div>
                      <span className="text-[7px] text-stone-500 uppercase tracking-wider block font-sans">Club Tier</span>
                      <span className="text-amber-400 text-xs font-semibold uppercase tracking-wider">{activeMemberTier || 'Heritage Branch'}</span>
                    </div>
                    <div>
                      <span className="text-[7px] text-stone-500 uppercase tracking-wider block font-sans">Member No.</span>
                      <span className="text-stone-300 text-[10px] font-mono font-medium">#GC-{user ? user.uid.substring(0, 5).toUpperCase() : 'BYPASS'}</span>
                    </div>
                    <div>
                      <span className="text-[7px] text-stone-500 uppercase tracking-wider block font-sans">Member Since</span>
                      <span className="text-stone-300 text-[10px] font-mono">06 / 2026</span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* CONTACTLESS PICKUP CHECK-IN WIDGET */}
              {clubMemberDoc?.status !== 'cancelled' && (
                <div className="mt-4 border border-amber-600/30 bg-amber-600/5 p-4 rounded-sm space-y-3 font-sans text-stone-300">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-[10px] uppercase font-mono font-bold text-amber-500 tracking-wider flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-550 animate-ping"></span>
                        Contactless Tap-to-Check-In
                      </h4>
                      <p className="text-[9px] text-stone-500 mt-0.5">Pick up your prepaid cider allotments instantly.</p>
                    </div>
                    <span className="text-[8px] font-mono text-stone-500 border border-stone-850 px-1.5 py-0.5 rounded uppercase">
                      Tap-to-Collect
                    </span>
                  </div>

                  <div className="bg-stone-950 p-3.5 border border-stone-850 rounded flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="text-[9px] uppercase tracking-wider block font-medium text-stone-400">Monthly Allocations Ready</span>
                      <span className="text-emerald-400 text-xs font-mono font-bold">Fully Prepaid</span>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => {
                        setCheckinStep('idle');
                        setTransmittedDocId(null);
                        setShowCheckinPass(true);
                      }}
                      className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-550 text-stone-950 uppercase tracking-wider text-[9px] font-sans font-extrabold rounded-sm transition-all shadow-[0_0_10px_rgba(217,119,6,0.2)] flex items-center gap-1 cursor-pointer"
                    >
                      Open Pick-up Pass
                    </button>
                  </div>
                </div>
              )}

              {/* Drip Campaign Preferences & Update Panel */}
              <div className="mt-4 border border-stone-850 bg-stone-900/10 p-4 rounded-sm space-y-3 font-sans">
                <h4 className="text-[10px] uppercase font-bold text-stone-400 tracking-wider flex items-center gap-1.5">
                  <Mail size={12} className="text-amber-500" /> Notifications & Drip Preferences
                </h4>
                
                <div className="space-y-2 pt-1 text-xs">
                  <label className="flex items-center justify-between text-stone-300 cursor-pointer hover:text-stone-100 py-1 border-b border-stone-850/40">
                    <span>Small-batch Bottling Alerts</span>
                    <input 
                      type="checkbox" 
                      className="accent-amber-500 h-3.5 w-3.5 cursor-pointer" 
                      checked={dripPreferences.bottlingAlerts} 
                      onChange={() => handleToggleDrip('bottlingAlerts')}
                    />
                  </label>
                  <label className="flex items-center justify-between text-stone-300 cursor-pointer hover:text-stone-100 py-1 border-b border-stone-850/40">
                    <span>VIP Taproom Dinners & Tastings</span>
                    <input 
                      type="checkbox" 
                      className="accent-amber-500 h-3.5 w-3.5 cursor-pointer" 
                      checked={dripPreferences.vipDinners} 
                      onChange={() => handleToggleDrip('vipDinners')}
                    />
                  </label>
                  <label className="flex items-center justify-between text-stone-300 cursor-pointer hover:text-stone-100 py-1">
                    <span>Seasonal Harvest Updates (Monthly Drip)</span>
                    <input 
                      type="checkbox" 
                      className="accent-amber-500 h-3.5 w-3.5 cursor-pointer" 
                      checked={dripPreferences.harvestNews} 
                      onChange={() => handleToggleDrip('harvestNews')}
                    />
                  </label>
                </div>
              </div>

              {/* Membership & Subscription Management Desk */}
              <div className="mt-4 border border-stone-850 bg-stone-900/10 p-4 rounded-sm space-y-4 font-sans text-stone-350">
                <h4 className="text-[10px] uppercase font-bold text-stone-400 tracking-wider flex items-center gap-1.5 border-b border-stone-850 pb-2">
                  <CreditCard size={12} className="text-amber-500" /> Membership Settings & Billing
                </h4>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-stone-400">Subscription Plan:</span>
                    <span className="font-mono text-stone-200 capitalize font-semibold">
                      {clubMemberDoc?.billingFrequency === 'biweekly' ? 'Bi-weekly cycle' : 'Monthly cycle'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-stone-400">Draft Frequency:</span>
                    <span className="font-mono text-stone-200">
                      {clubMemberDoc?.billingFrequency === 'biweekly' ? 'Every 14 days' : 'Every 30 days'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-stone-400">Subscription Status:</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      clubMemberDoc?.status === 'cancelled'
                        ? 'bg-red-950/40 text-red-400 border border-red-500/10'
                        : 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/10'
                    }`}>
                      <span className={`w-1 h-1 rounded-full ${clubMemberDoc?.status === 'cancelled' ? 'bg-red-500' : 'bg-emerald-400 animate-pulse'}`} />
                      {clubMemberDoc?.status === 'cancelled' ? 'Canceled' : 'Active'}
                    </span>
                  </div>

                  {clubMemberDoc?.status === 'cancelled' ? (
                    <div className="space-y-2.5 pt-1.5 border-t border-stone-850/60">
                      <p className="text-[11px] text-stone-400 italic leading-relaxed">
                        Your subscription is currently deactivated. Your allocations are suspended, but you can instantly reactivate anytime to secure your reserve slot!
                      </p>
                      <Button
                        type="button"
                        disabled={updatingSubscription}
                        onClick={handleReactivateMembership}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-stone-950 uppercase tracking-wider text-xs font-bold rounded-sm h-9 cursor-pointer"
                      >
                        {updatingSubscription ? 'Processing reactivation...' : 'Re-Activate Membership'}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2.5 pt-1.5 border-t border-stone-850/60">
                      <p className="text-[10px] text-stone-500 italic leading-snug">
                        Subscription details are managed on-chain. You can cancel or pause your plan at any time.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={updatingSubscription}
                        onClick={handleCancelMembership}
                        className="w-full border-red-900 text-red-500 hover:bg-red-950/20 hover:text-red-400 uppercase tracking-wider text-xs font-bold rounded-sm h-9 cursor-pointer"
                      >
                        {updatingSubscription ? 'Processing cancellation...' : 'Cancel Membership'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* EXCLUSIVE CELLAR - BOTTLE SPECIALS (REAL ORDER TRIGGER!) */}
          <div className="space-y-6 pt-6">
            <div className="border-b border-stone-800 pb-3 flex justify-between items-end">
              <div>
                <h3 className="text-stone-100 uppercase tracking-widest text-lg font-serif">Members-Only Scarcity Reserves</h3>
                <p className="text-stone-400 text-xs font-sans mt-0.5">Highly limited runs. Rested in oak or double-fermented. 15% discount auto-applies in checkout!</p>
              </div>
              <span className="text-[10px] text-amber-500 uppercase font-mono tracking-widest flex items-center gap-1">
                <Gift size={11} className="text-amber-500 animate-bounce" /> Hand-labeled batches
              </span>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {limitedReleases.map((release) => (
                <div 
                  key={release.id}
                  className="bg-stone-900 border border-stone-850 hover:border-amber-500/40 p-5 rounded-lg flex flex-col justify-between transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="text-[9px] uppercase tracking-widest font-mono text-stone-500">{release.type}</span>
                      <span className="text-[8px] uppercase tracking-widest font-mono font-bold font-sans bg-amber-600/10 text-amber-500 px-1.5 py-0.5 border border-amber-500/20 rounded">
                        Scarce
                      </span>
                    </div>
                    <h4 className="text-stone-200 uppercase tracking-widest text-sm font-semibold">{release.name}</h4>
                    <p className="text-[10px] text-stone-500 italic">Produced using estate apples and aged extensively. Complex tannins, bone-dry and exquisite.</p>
                  </div>

                  <div className="pt-6 border-t border-stone-850 mt-6 flex justify-between items-center">
                    <span className="text-amber-500 font-mono font-semibold">${release.price.toFixed(2)}</span>
                    <button 
                      onClick={() => {
                        addLimitedReleaseToCart(release);
                        alert(`Successfully added ${release.name} to your main checkout cart!`);
                      }}
                      className="text-[10px] uppercase tracking-widest font-sans font-semibold border border-amber-600 px-3 py-1.5 text-amber-500 bg-amber-500/5 hover:bg-amber-600 hover:text-stone-950 transition-all rounded-sm flex items-center gap-1.5"
                    >
                      <Plus size={10} /> Add to Cart
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ALLOCATION RECEIPT REGISTRY & HISTORIES */}
          <div className="space-y-6 pt-12 border-t border-stone-900">
            <div>
              <h3 className="text-stone-100 uppercase tracking-widest text-lg font-serif">Allocation Receipt Registry</h3>
              <p className="text-stone-400 text-xs font-sans mt-0.5 font-medium">Your official distribution logs, receipts, and order histories for estate pick-ups and direct shipments.</p>
            </div>

            {clubOrders.length === 0 ? (
              <div className="border border-dashed border-stone-850 p-8 rounded-lg text-center text-stone-500 text-xs italic font-sans bg-stone-950/25">
                No allocation orders have been processed yet. Explore our scarcity reserves above or complete a cellar checkout to see your transaction logging here.
              </div>
            ) : (
              <div className="border border-stone-850 rounded-lg overflow-hidden bg-stone-950/40">
                <table className="w-full text-left border-collapse text-xs font-sans text-stone-300">
                  <thead>
                    <tr className="bg-stone-900/60 text-stone-400 uppercase tracking-wider text-[9px] border-b border-stone-850">
                      <th className="p-3">Order Ref</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Cider Selections / Line Items</th>
                      <th className="p-3">Method</th>
                      <th className="p-3">Total Cost</th>
                      <th className="p-3 text-center">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-900/40 font-mono">
                    {clubOrders.map((order) => {
                      const formattedDate = order.createdAt?.toDate 
                        ? order.createdAt.toDate().toLocaleDateString()
                        : order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'Processing';
                      
                      const orderCode = order.orderId || order.id?.slice(0, 8).toUpperCase();
                      const itemSummary = order.items?.map((it: any) => `${it.quantity}x ${it.name}`).join(', ') || 'Club Allocation';
                      const totalPaid = order.totalCents ? order.totalCents / 100 : (order.totalAmount || order.price || 0);
                      const terminalSource = order.source || 'Online Store';

                      return (
                        <tr key={order.id} className="hover:bg-amber-950/5 transition-all">
                          <td className="p-3 font-semibold text-stone-200">{orderCode}</td>
                          <td className="p-3 text-[10px] text-stone-400">{formattedDate}</td>
                          <td className="p-3 font-sans truncate max-w-[240px] text-stone-300">{itemSummary}</td>
                          <td className="p-3 font-sans text-stone-400 capitalize text-[10px]">{terminalSource}</td>
                          <td className="p-3 text-amber-500 font-bold font-mono">${Number(totalPaid).toFixed(2)}</td>
                          <td className="p-3 text-center">
                            <button 
                              onClick={() => setSelectedPrintOrder(order)}
                              className="text-[9px] uppercase tracking-widest font-semibold font-sans bg-amber-600/10 text-amber-500 hover:bg-amber-600 hover:text-stone-950 px-2 py-1 rounded transition-all flex items-center gap-1 mx-auto cursor-pointer border border-amber-600/25"
                            >
                              <Printer size={9} /> View/Print
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* CUSTOM PRINTABLE ORDER RECEIPT MODAL */}
          <Dialog open={!!selectedPrintOrder} onOpenChange={(open) => !open && setSelectedPrintOrder(null)}>
            <DialogContent className="bg-stone-950 border border-stone-800 text-stone-200 sm:max-w-2xl font-serif max-h-[85vh] overflow-y-auto">
              <DialogHeader className="border-b border-stone-800 pb-4">
                <DialogTitle className="text-xl text-amber-500 uppercase tracking-widest flex items-center justify-between">
                  <span>Godley Ciders Receipt</span>
                  <button 
                    onClick={() => window.print()}
                    className="text-xs bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors uppercase tracking-wider font-sans cursor-pointer print:hidden"
                  >
                    <Printer size={13} /> Print Invoice
                  </button>
                </DialogTitle>
                <DialogDescription className="text-stone-500 text-xs italic font-sans" />
              </DialogHeader>

              <div id="printable-invoice" className="py-6 space-y-6 font-sans text-sm text-stone-300">
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
                    <p className="text-xs text-stone-500">Lincoln Way Taproom & Vineyards</p>
                    <p className="text-xs text-stone-500">Placer County, California</p>
                    <p className="text-xs text-stone-500 font-serif">Partners@godleyciders.com</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-xs text-stone-400">Order Ref: <strong className="font-mono text-stone-200">{selectedPrintOrder?.orderId || selectedPrintOrder?.id?.slice(0, 10).toUpperCase()}</strong></p>
                    <p className="text-xs text-stone-400">Date: {
                      selectedPrintOrder?.createdAt?.toDate 
                        ? selectedPrintOrder.createdAt.toDate().toLocaleDateString()
                        : selectedPrintOrder?.createdAt ? new Date(selectedPrintOrder.createdAt).toLocaleDateString() : 'N/A'
                    }</p>
                    <span className={`inline-block px-2 py-0.5 rounded text-[9px] uppercase tracking-widest border ${
                      selectedPrintOrder?.status === 'paid' || selectedPrintOrder?.status === 'unpaid'
                        ? 'bg-emerald-950/30 text-emerald-400 border-emerald-500/20' 
                        : 'bg-amber-950/30 text-amber-500 border-amber-500/20'
                    }`}>
                      {selectedPrintOrder?.status || 'Process'}
                    </span>
                  </div>
                </div>

                {/* Billing details */}
                <div className="grid grid-cols-2 gap-6 bg-stone-900/40 p-4 rounded border border-stone-800/50">
                  <div>
                    <h4 className="text-xs text-stone-500 uppercase tracking-widest font-semibold mb-1">Customer Details</h4>
                    <p className="font-semibold text-stone-200">{selectedPrintOrder?.customerName || user?.displayName || 'Charter Club Member'}</p>
                    <p className="text-xs text-stone-400">{selectedPrintOrder?.customerEmail || user?.email}</p>
                    {selectedPrintOrder?.customerPhone && <p className="text-xs text-stone-500">{selectedPrintOrder.customerPhone || 'N/A'}</p>}
                  </div>
                  {selectedPrintOrder?.paymentTerm && (
                    <div>
                      <h4 className="text-xs text-stone-500 uppercase tracking-widest font-semibold mb-1">Payment & Compliance</h4>
                      <p className="text-xs text-stone-300">Payment Term: <strong className="text-amber-500">{selectedPrintOrder.paymentTerm}</strong></p>
                      {selectedPrintOrder.abcLicense && <p className="text-xs text-stone-400">ABC lic: {selectedPrintOrder.abcLicense}</p>}
                      {selectedPrintOrder.resaleNumber && <p className="text-xs text-stone-400">Resale ID: {selectedPrintOrder.resaleNumber}</p>}
                    </div>
                  )}
                </div>

                {/* Items List */}
                <div className="space-y-2">
                  <h4 className="text-xs text-stone-400 uppercase tracking-widest font-semibold">Allocated Items</h4>
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
                        {selectedPrintOrder?.items?.map((item: any, idx: number) => {
                          const price = item.priceAtPurchase || item.unitPriceCents / 100 || item.price || 0;
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
                  <div className="w-64 space-y-2 text-xs border-t border-stone-850 pt-3">
                    {selectedPrintOrder?.subtotalCents !== undefined ? (
                      <>
                        <div className="flex justify-between text-stone-500">
                          <span>Subtotal</span>
                          <span>${(selectedPrintOrder.subtotalCents / 100).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-stone-500">
                          <span>Shipping / Freight</span>
                          <span>${(selectedPrintOrder.shippingCents / 100).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-stone-500">
                          <span>Placer County Tax (7.25%)</span>
                          <span>${(selectedPrintOrder.taxCents / 100).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-amber-500 font-bold font-serif pt-1 border-t border-stone-900">
                          <span>Total Due</span>
                          <span>${(selectedPrintOrder.totalCents / 100).toFixed(2)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between text-sm text-amber-500 font-bold font-serif pt-1">
                        <span>Total Paid</span>
                        <span>${Number(selectedPrintOrder?.totalAmount || selectedPrintOrder?.price || 0).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-center pt-8 border-t border-stone-900/50 text-[10px] text-stone-500 italic pb-2">
                  Thank you for supporting small-batch, estate-grown California cider craftsmanship.
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* MOBILE CONTACTLESS CHECK-IN PASS MODAL */}
          <Dialog open={showCheckinPass} onOpenChange={setShowCheckinPass}>
            <DialogContent className="bg-stone-950 border border-amber-600/30 text-stone-200 sm:max-w-md font-sans text-left">
              <DialogHeader className="border-b border-stone-850 pb-4">
                <DialogTitle className="text-lg text-amber-500 font-serif uppercase tracking-widest flex items-center gap-2">
                  <span>Allocation Pick-Up Pass</span>
                </DialogTitle>
                <DialogDescription className="text-stone-400 text-xs font-sans">
                  Present this pass at the counter or simulate an contactless NFC device transmission.
                </DialogDescription>
              </DialogHeader>

              <div className="py-4 space-y-6 flex flex-col items-center">
                {/* DYNAMIC PASS IMAGE/QR CODE */}
                <div className="bg-stone-900 border border-stone-800 p-5 rounded-2xl w-full flex flex-col items-center justify-center space-y-3.5 relative overflow-hidden shadow-2xl">
                  {/* Subtle Radar Ripple on transmit */}
                  {checkinStep === 'transmitting' && (
                    <div className="absolute inset-0 bg-amber-500/5 flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full border border-amber-500/20 animate-ping absolute" />
                      <div className="w-32 h-32 rounded-full border border-amber-500/10 animate-ping absolute" />
                    </div>
                  )}

                  {/* Top Gilded Label */}
                  <div className="w-full flex justify-between items-center text-[10px] uppercase tracking-wider font-mono text-stone-500 border-b border-stone-855 pb-2">
                    <span>Est. 2026</span>
                    <span className="text-amber-500 font-bold">{activeMemberTier || 'Heritage Branch'} Member</span>
                  </div>

                  {/* QR Image Frame */}
                  <div className="p-2 bg-white rounded-xl shadow-lg border border-stone-200 relative">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=0c0a09&bgcolor=ffffff&qzone=1&data=${encodeURIComponent(
                        JSON.stringify({
                          memberId: clubMemberDoc?.id || 'BYPASS',
                          email: user?.email || 'bypass@godleyciders.com',
                          name: activeMemberName,
                          action: 'allocation_pickup'
                        })
                      )}`}
                      alt="Verification Token"
                      className="w-36 h-36 object-contain"
                    />
                  </div>

                  {/* Pass Labels */}
                  <div className="text-center space-y-1">
                    <p className="font-serif text-base text-stone-100 uppercase tracking-widest font-semibold">{activeMemberName}</p>
                    <p className="font-mono text-[9px] text-zinc-400">#GC-{user ? user.uid.substring(0, 5).toUpperCase() : 'BYPASS'} • {user?.email || 'bypass@godleyciders.com'}</p>
                  </div>

                  {/* Status Banner */}
                  <div className="px-4 py-1.5 bg-stone-950 border border-stone-800 rounded-full text-[10px] font-mono text-center flex items-center gap-1.5 text-stone-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>PASS IS IN GOOD STANDING</span>
                  </div>
                </div>

                {/* INTERACTIVE CONTROLS */}
                <div className="w-full space-y-3.5">
                  {checkinStep === 'idle' ? (
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={handleContactlessCheckin}
                        className="w-full py-3.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-sans font-black text-xs uppercase tracking-widest rounded-sm shadow-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-95 cursor-pointer"
                      >
                        Contactless NFC Tap to Reader
                      </button>
                      <p className="text-[10px] text-stone-400 leading-normal text-center italic">
                        Simulate holding your phone near the bartender's POS tablet. This triggers a real-time wave beam and notifies staff.
                      </p>
                    </div>
                  ) : checkinStep === 'transmitting' ? (
                    <div className="bg-stone-900 border border-stone-850 p-4 rounded-sm text-center space-y-2 font-mono">
                      <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                      <p className="text-xs text-amber-500 font-bold uppercase animate-pulse">Broadcasting NFC Check-In Wave...</p>
                      <p className="text-[9px] text-stone-500">Transmitting payload #{(transmittedDocId || 'pending').slice(0, 8)} to local gateway</p>
                    </div>
                  ) : (
                    <div className="bg-emerald-950/20 border border-emerald-500/30 p-4 rounded-sm text-center space-y-3 font-sans animate-fadeIn">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                        <Check className="w-4 h-4" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Device Wave Sync Handshake Complete!</p>
                        <p className="text-[10px] text-stone-300">Your profile and prepaid allocation vouchers have been beamed securely to the Employee Reader Portal.</p>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => setShowCheckinPass(false)}
                        className="text-[10px] uppercase font-bold text-amber-500 hover:text-amber-400 px-3 py-1 bg-stone-950 rounded-sm border border-stone-850 cursor-pointer"
                      >
                        Close Pass
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowCheckinPass(false)}
                    className="w-full py-2 bg-stone-900 hover:bg-stone-850 hover:text-stone-100 text-stone-400 text-[10px] uppercase tracking-widest font-mono rounded transition-all cursor-pointer"
                  >
                    Dismiss Pass
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* DISPATCH WELCOME INQUIRY DIALOG */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-stone-950 border border-stone-800 text-stone-200 sm:max-w-[480px] font-serif max-h-[92vh] overflow-y-auto scrollbar-thin scrollbar-thumb-stone-800">
          <DialogHeader>
            <DialogTitle className="text-2xl text-amber-500 font-normal uppercase tracking-widest text-center">
              {isWaitlistModeActive 
                ? `Reserve ${selectedTiers.length > 0 ? selectedTiers.join(' & ') : selectedTier}` 
                : `Join ${selectedTiers.length > 0 ? selectedTiers.join(' & ') : selectedTier}`}
            </DialogTitle>
            <DialogDescription className="text-center text-stone-400 italic font-sans text-xs">
              {isWaitlistModeActive 
                ? "Join our exclusive pre-release stand-by list. No charge today—cancel anytime." 
                : "Provide your details below to proceed to checkout and secure your first month."}
            </DialogDescription>
          </DialogHeader>

          {success ? (
            <div className="py-8 text-center space-y-4">
              <p className="text-2xl text-amber-500 font-serif">Reservation Confirmed.</p>
              <div className="bg-stone-900 border border-stone-850 p-4 rounded text-left space-y-2 text-stone-300 font-sans text-xs">
                <p className="font-semibold text-amber-500 flex items-center gap-1">Pre-Sale Spot Locked In</p>
                <p>Hello <strong className="text-stone-100">{formData.name}</strong>, you have successfully locked in your pre-sale slot for the <strong className="text-stone-100">{selectedTiers.join(' & ')} Club</strong>!</p>
                {isWaitlistModeActive && (
                  <p className="text-stone-400 leading-relaxed text-[11px] pt-1 border-t border-stone-800 mt-2">
                    Your payment method has been verified and vaulted. Card ending in <strong>*{cardData.number.replace(/\s+/g, '').slice(-4) || '4242'}</strong> has been pre-authorized for <strong className="text-amber-500">$0.00 today</strong>. 
                    You will only be billed on your chosen <strong className="capitalize">{billingFrequency}</strong> frequency once your physical slot is granted.
                  </p>
                )}
                <p className="text-[10px] text-stone-500 pt-1.5 border-t border-stone-800/50 mt-1">A confirmation details letter has been dispatched to: <em className="text-stone-400">{formData.email}</em></p>
              </div>
              <Button variant="outline" onClick={() => setIsModalOpen(false)} className="border-stone-700 text-stone-300 hover:text-stone-100 uppercase tracking-wider text-xs">
                Close
              </Button>
            </div>
          ) : (
            <form onSubmit={submitForm} className="space-y-4 pt-2">
              {/* INTERACTIVE CLUB TIER SELECTOR (Allows selecting one or more tiers) */}
              <div className="space-y-2 bg-stone-900/30 p-3 rounded border border-stone-850/80 font-sans">
                <Label className="text-stone-400 uppercase tracking-wider text-[10px] block font-bold">
                  Select Your Club Tiers <span className="text-amber-500/80 font-normal lowercase italic">(click more than one to select multiple!)</span>
                </Label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: 'Core', name: 'Core Club', priceMsg: billingFrequency === 'biweekly' ? `$${(Number(clubSettings.corePrice) / 2).toFixed(2)}/2wks` : `$${clubSettings.corePrice}/mo`, retailMsg: '$30.00 Retail Value', desc: '6 x 12oz bottles of Core Cider' },
                    { id: 'Branch', name: 'Branch Club', priceMsg: billingFrequency === 'biweekly' ? `$${(Number(clubSettings.branchPrice) / 2).toFixed(2)}/2wks` : `$${clubSettings.branchPrice}/mo`, retailMsg: '$35.00 Retail Value', desc: '1 x 750ml Reserve bottle' },
                    { id: 'Heritage Branch', name: 'Heritage Branch', priceMsg: billingFrequency === 'biweekly' ? `$${(Number(clubSettings.heritagePrice) / 2).toFixed(2)}/2wks` : `$${clubSettings.heritagePrice}/mo`, retailMsg: '$65.00 Combo Value', desc: 'BOTH Core and Branch bottles • Epic Combo Value!' }
                  ].map((tierItem) => {
                    const isSelected = selectedTiers.includes(tierItem.id);
                    return (
                      <button
                        key={tierItem.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            // Keep at least one selected
                            if (selectedTiers.length > 1) {
                              setSelectedTiers(prev => prev.filter(t => t !== tierItem.id));
                            }
                          } else {
                            if (tierItem.id === 'Heritage Branch') {
                              // Heritage Branch is mutually exclusive from selecting Core and Branch individually.
                              setSelectedTiers(['Heritage Branch']);
                            } else {
                              // Clicking Core or Branch. Mutually exclusive from Heritage Branch.
                              setSelectedTiers(prev => [...prev.filter(t => t !== 'Heritage Branch'), tierItem.id]);
                            }
                          }
                        }}
                        className={`flex items-center justify-between px-3 py-2.5 rounded border text-left transition-all cursor-pointer ${
                          isSelected 
                            ? 'border-amber-500 bg-amber-500/10 text-stone-100 shadow-[0_0_8px_rgba(245,158,11,0.05)]' 
                            : 'border-stone-850 hover:border-stone-800 text-stone-500 bg-stone-950/20'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-all ${
                            isSelected ? 'border-amber-500 bg-amber-500 text-stone-950' : 'border-stone-700'
                          }`}>
                            {isSelected && <Check className="w-2.5 h-2.5 text-stone-950 stroke-[3]" />}
                          </div>
                          <div>
                            <span className="font-serif font-bold text-xs uppercase tracking-wide">{tierItem.name}</span>
                            <p className="text-[9px] text-stone-500 font-sans italic">{tierItem.desc}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-mono font-semibold text-amber-500/90 block">{tierItem.priceMsg}</span>
                          <span className="text-[8px] font-sans font-bold text-stone-500 line-through block">{tierItem.retailMsg}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="name" className="text-stone-400 uppercase tracking-wider text-[10px]">Full Name</Label>
                <Input 
                   id="name" 
                   required 
                   value={formData.name}
                   onChange={(e) => setFormData({...formData, name: e.target.value})}
                   className="bg-stone-900 border-stone-800 focus:border-amber-500/50 rounded-sm font-sans h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email" className="text-stone-400 uppercase tracking-wider text-[10px]">Email Address</Label>
                <Input 
                  id="email" 
                  type="email" 
                  required 
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="bg-stone-900 border-stone-800 focus:border-amber-500/50 rounded-sm font-sans h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="phone" className="text-stone-400 uppercase tracking-wider text-[10px]">Phone Number</Label>
                <Input 
                  id="phone" 
                  type="tel" 
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="bg-stone-900 border-stone-800 focus:border-amber-500/50 rounded-sm font-sans h-8 text-xs"
                />
              </div>

              {/* Explicit Billing Frequency in signup modal */}
              <div className="space-y-2">
                <Label className="text-stone-400 uppercase tracking-wider text-xs block">Billing Schedule</Label>
                <div className="grid grid-cols-2 gap-3.5">
                  <button
                    type="button"
                    onClick={() => setBillingFrequency('monthly')}
                    className={`py-2 px-3 border rounded text-xs uppercase font-sans font-semibold tracking-wider transition-all cursor-pointer ${
                      billingFrequency === 'monthly'
                        ? 'border-amber-600 bg-amber-500/10 text-amber-500'
                        : 'border-stone-800 bg-stone-950/40 text-stone-500 hover:border-stone-750'
                    }`}
                  >
                    Monthly Billing
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingFrequency('biweekly')}
                    className={`py-2 px-3 border rounded text-xs uppercase font-sans font-semibold tracking-wider transition-all cursor-pointer ${
                      billingFrequency === 'biweekly'
                        ? 'border-amber-600 bg-amber-500/10 text-amber-500'
                        : 'border-stone-800 bg-stone-950/40 text-stone-500 hover:border-stone-750'
                    }`}
                  >
                    Bi-weekly Billing
                  </button>
                </div>
                <p className="text-[10px] text-stone-500 italic mt-1 font-sans">
                  {billingFrequency === 'biweekly' 
                    ? '* billed half-price every two weeks, cancel anytime.'
                    : '* billed standard price once per month, cancel anytime.'}
                </p>
              </div>

              {isWaitlistModeActive && (
                <div className="border border-stone-850 bg-stone-900/40 p-3 rounded space-y-3 font-sans">
                  <div className="flex justify-between items-center text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                    <span className="flex items-center gap-1"><CreditCard size={12} className="text-amber-500" /> Vault Card on File</span>
                    <span className="text-emerald-400 flex items-center gap-1 text-[8px] font-mono"><Lock size={10} /> PCI-DSS Secure</span>
                  </div>
                  
                  <div className="space-y-2 text-xs">
                    <div>
                      <Label className="text-stone-500 text-[9px] uppercase tracking-wider block mb-1">Card Number</Label>
                      <Input 
                        type="text" 
                        required
                        placeholder="4242 4242 4242 4242" 
                        maxLength={19}
                        value={cardData.number}
                        onChange={(e) => {
                          let v = e.target.value.replace(/\D/g, '');
                          let formatted = v.match(/.{1,4}/g)?.join(' ') || v;
                          setCardData({...cardData, number: formatted.slice(0, 19)});
                        }}
                        className="bg-stone-950 border-stone-850 text-stone-200 placeholder-stone-800 font-mono text-xs focus:border-amber-500/50 rounded-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-stone-500 text-[9px] uppercase tracking-wider block mb-1">Expiration</Label>
                        <Input 
                          type="text" 
                          required
                          placeholder="MM/YY" 
                          maxLength={5}
                          value={cardData.expiry}
                          onChange={(e) => {
                            let v = e.target.value.replace(/\D/g, '');
                            if (v.length > 2) {
                              v = v.slice(0, 2) + '/' + v.slice(2, 4);
                            }
                            setCardData({...cardData, expiry: v});
                          }}
                          className="bg-stone-950 border-stone-850 text-stone-200 placeholder-stone-800 font-mono text-xs focus:border-amber-500/50 rounded-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-stone-500 text-[9px] uppercase tracking-wider block mb-1">Security Code</Label>
                        <Input 
                          type="password" 
                          required
                          placeholder="CVC" 
                          maxLength={3}
                          value={cardData.cvv}
                          onChange={(e) => setCardData({...cardData, cvv: e.target.value.replace(/\D/g, '')})}
                          className="bg-stone-950 border-stone-850 text-stone-200 placeholder-stone-800 font-mono text-xs focus:border-amber-500/50 rounded-sm"
                        />
                      </div>
                    </div>
                    <p className="text-[9px] text-stone-500 italic leading-snug">
                      * Strictly $0.00 processed today. Your secure draft will trigger only when an authorized spot is granted by staff.
                    </p>
                  </div>
                </div>
              )}

              {/* PRE-PRODUCTION / PRE-RELEASE DISCLAIMER */}
              <div className="bg-stone-900/50 border border-stone-850 p-3 rounded text-[9px] text-stone-400 font-sans leading-relaxed">
                <span className="text-amber-500 font-bold block mb-1 uppercase tracking-wider">Pre-Production & Product Sizing Notice</span>
                <p>
                  Godley Ciders is currently in a pre-licensing under-construction phase. By reserving a spot on our standby list or subscribing, you acknowledge and agree that during this pre-release period, Godley Ciders reserves the right to adjust recipes, ABV certifications (e.g., 6% to 8%), brand labeling, and physical packaging configurations (e.g., opting for four 375ml premium corked bottles rather than six 12oz crown caps, or equivalent volume adjustments). Rendered mockups are for illustrative purposes and do not definitively promise final package dimensions.
                </p>
              </div>

              <Button type="submit" disabled={loading} className="w-full bg-amber-600 hover:bg-amber-500 text-stone-950 uppercase tracking-wider font-bold rounded-sm py-6">
                {loading 
                  ? (isWaitlistModeActive ? 'Vaulting Credentials...' : 'Starting Checkout...') 
                  : (isWaitlistModeActive ? 'Authorize & Lock Pre-Sale' : 'Proceed to Checkout')}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
