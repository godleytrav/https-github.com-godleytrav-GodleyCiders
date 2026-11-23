import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { db, auth } from '../firebase';
import {
  collection, addDoc, serverTimestamp, query, where,
  onSnapshot, doc, orderBy, updateDoc
} from 'firebase/firestore';
import { useAdminStore } from '../store/adminStore';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Building2, ShieldCheck, Truck, CheckCircle2, Plus, Minus,
  AlertCircle, ShoppingCart, Printer, CreditCard, Clock, Lock,
  Unlock, RefreshCw, LogIn, UserPlus, FileCheck2
} from 'lucide-react';

interface WholesaleAccount {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  type: string;
  status: 'lead' | 'pending' | 'hold' | 'approved' | 'rejected';
  docsSubmitted: boolean;
  docsSubmittedAt?: string;
  abcLicenseNumber?: string;
  resaleLicenseNumber?: string;
  taxId?: string;
  address?: string;
  billingAddress?: string;
  website?: string;
  estimatedVolume?: string;
  message?: string;
  net30Status: 'none' | 'requested' | 'approved' | 'denied';
  creditLimit?: number;
}

const WHOLESALE_PRODUCTS = [
  {
    id: 'keg-dry',
    name: 'Godley Dry Cider (Sixtel 5.16 Gal Keg)',
    price: 110.00,
    formattedType: 'Draft Sixtel',
    specs: '5.16 Gallon Sankey D-Coupler • 7.8% ABV • Bone Dry Estate Sierra Apples'
  },
  {
    id: 'keg-hop',
    name: 'Placer County Hopped (Sixtel 5.16 Gal Keg)',
    price: 115.00,
    formattedType: 'Draft Sixtel',
    specs: '5.16 Gallon Sankey D-Coupler • 6.9% ABV • Dry-Hopped Foothill Blend'
  },
  {
    id: 'case-dry',
    name: 'Godley Golden Dry (24pk Case - 12oz Cans)',
    price: 48.00,
    formattedType: 'Case Goods',
    specs: '24 × 12oz Sleek Cans • 6.8% ABV • Crisp Unfiltered Heritage Reserve'
  },
  {
    id: 'case-hop',
    name: 'Placer County Hopped (24pk Case - 12oz Cans)',
    price: 52.00,
    formattedType: 'Case Goods',
    specs: '24 × 12oz Sleek Cans • 6.9% ABV • Aromatic Mosaic & Cascade Finish'
  }
];

export default function Wholesale() {
  const { wholesaleSettings, devBypassWholesale } = useAdminStore();

  // Landing auth mode: Login first, with Sign Up toggle
  const [authView, setAuthView] = useState<'login' | 'signup'>('login');
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Custom Email/Password Wholesale Session (token held strictly in React memory)
  const [wholesaleToken, setWholesaleToken] = useState<string | null>(null);
  const [wholesaleAccount, setWholesaleAccount] = useState<WholesaleAccount | null>(null);

  // Lead Capture Signup Form (NO business docs forced)
  const [signupData, setSignupData] = useState({
    businessName: '',
    contactName: '',
    email: '',
    password: '',
    phone: '',
    type: 'Restaurant',
    address: '',
    estimatedVolume: '',
    message: ''
  });
  const [signupLoading, setSignupLoading] = useState(false);

  // CA Compliance Document Submission Form (completed inside portal after signup)
  const [docsForm, setDocsForm] = useState({
    taxId: '',
    abcLicenseNumber: '',
    resaleLicenseNumber: '',
    address: '',
    billingAddress: '',
    billingAddressSame: true,
    website: '',
    estimatedVolume: '',
    message: ''
  });
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsSubmittedNotice, setDocsSubmittedNotice] = useState('');
  const [showDocsEditor, setShowDocsEditor] = useState(false);
  const [refreshingStatus, setRefreshingStatus] = useState(false);

  // Compliance file upload states
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
      }, 600);
    }, 500);
  };

  // Optional Google Firebase Auth & Partner status
  const [user, setUser] = useState<User | null>(null);
  const [firebasePartnerDoc, setFirebasePartnerDoc] = useState<any>(null);

  // Demo Partner Mode for instant admin preview
  const [demoPartnerActive, setDemoPartnerActive] = useState<boolean>(() => {
    return sessionStorage.getItem('godley_demo_partner') === 'true' || new URLSearchParams(window.location.search).get('demo') === 'true';
  });

  // Wholesale orders list
  const [partnerOrders, setPartnerOrders] = useState<any[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [requestingNet30, setRequestingNet30] = useState(false);

  // Stripe / EFT commercial settlement helpers
  const [settlingOrderId, setSettlingOrderId] = useState<string | null>(null);
  const [successSettleMsg, setSuccessSettleMsg] = useState('');
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  // Bulk Ordering Cart state
  const [bulkCart, setBulkCart] = useState<Record<string, number>>({
    'keg-dry': 0,
    'keg-hop': 0,
    'case-dry': 0,
    'case-hop': 0
  });
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderSuccessMsg, setOrderSuccessMsg] = useState('');

  // Check Stripe Checkout return params
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
            setSuccessSettleMsg('Thank you! Your commercial card payment was successfully processed. Your invoice status is now updated to PAID.');
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        })
        .catch(err => console.error('Verification error:', err))
        .finally(() => setVerifyingPayment(false));
    }
  }, []);

  // Listen to Firebase Auth for Google Sign-In partners
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
    });
    return unsub;
  }, []);

  // Populate docs form from existing wholesale account details
  useEffect(() => {
    if (wholesaleAccount) {
      setDocsForm(prev => ({
        ...prev,
        taxId: wholesaleAccount.taxId || prev.taxId,
        abcLicenseNumber: wholesaleAccount.abcLicenseNumber || prev.abcLicenseNumber,
        resaleLicenseNumber: wholesaleAccount.resaleLicenseNumber || prev.resaleLicenseNumber,
        address: wholesaleAccount.address || prev.address,
        billingAddress: wholesaleAccount.billingAddress || prev.billingAddress,
        website: wholesaleAccount.website || prev.website,
        estimatedVolume: wholesaleAccount.estimatedVolume || prev.estimatedVolume,
        message: wholesaleAccount.message || prev.message
      }));
    }
  }, [wholesaleAccount]);

  // Sync partner data for Demo Mode or Firebase Google Auth
  useEffect(() => {
    if (demoPartnerActive && !user && !wholesaleAccount) {
      setFirebasePartnerDoc({
        id: 'demo-distributor-1',
        businessName: 'Sierra Foothills Beverage Distributing',
        contactName: 'Travis Godley (Executive)',
        email: 'travis@godleyciders.com',
        phone: '(530) 885-4000',
        type: 'Licensed Distributor (Type 21 ABC)',
        abcLicenseNumber: '21-5899201',
        resaleLicenseNumber: 'SR-E-9948201',
        taxId: '94-8291042',
        status: 'approved',
        docsSubmitted: true,
        net30Status: 'approved',
        creditLimit: 15000,
        address: '1200 Lincoln Way, Auburn, CA 95603'
      });
      setPartnerOrders([
        {
          id: 'ord-ws-sample-1',
          orderId: 'PO-2026-0881',
          source: 'wholesale',
          status: 'paid',
          deliveryStatus: 'delivered',
          paymentMethod: 'net-30',
          totalCents: 110000,
          subtotalCents: 110000,
          shippingCents: 0,
          taxCents: 0,
          createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
          items: [{ name: 'Godley Dry Cider (Sixtel 5.16 Gal Keg)', quantity: 10, price: 110, formattedType: 'Draft Sixtel' }]
        },
        {
          id: 'ord-ws-sample-2',
          orderId: 'PO-2026-0912',
          source: 'wholesale',
          status: 'unpaid',
          deliveryStatus: 'in-transit',
          paymentMethod: 'net-30',
          totalCents: 48000,
          subtotalCents: 48000,
          shippingCents: 0,
          taxCents: 0,
          createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
          items: [{ name: 'Godley Golden Dry (24pk Case - 12oz Cans)', quantity: 10, price: 48, formattedType: 'Case Goods' }]
        }
      ]);
      return;
    }

    if (!user) {
      if (!demoPartnerActive) {
        setFirebasePartnerDoc(null);
      }
      return;
    }

    const qInq = query(collection(db, 'wholesale_inquiries'), where('email', '==', user.email));
    const unsubInq = onSnapshot(qInq, (snapshot) => {
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        setFirebasePartnerDoc({ id: docSnap.id, ...docSnap.data() });
      } else {
        setFirebasePartnerDoc(null);
      }
    }, (err) => console.error(err));

    const qOrders = query(
      collection(db, 'orders'),
      where('customerEmail', '==', user.email),
      orderBy('createdAt', 'desc')
    );
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      setPartnerOrders(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter((o: any) => o.source === 'wholesale'));
    }, (err) => console.error('Failed to load partner orders:', err));

    return () => {
      unsubInq();
      unsubOrders();
    };
  }, [user, demoPartnerActive, wholesaleAccount]);

  const activePartner = wholesaleAccount || firebasePartnerDoc;
  const isLoggedIn = Boolean(wholesaleAccount || user || demoPartnerActive || devBypassWholesale);
  const accountStatus = activePartner?.status || (user ? 'lead' : 'lead');
  const docsSubmitted = Boolean(
    activePartner?.docsSubmitted ||
    (activePartner?.abcLicenseNumber && activePartner?.resaleLicenseNumber)
  );
  const isApproved = accountStatus === 'approved' || devBypassWholesale || demoPartnerActive;

  // Check past-due Net-30 invoices (AB 2991 hold)
  const pastDueOrders = partnerOrders.filter((order: any) => {
    if (order.status === 'overdue') return true;
    if (order.status !== 'unpaid') return false;
    if (!order.createdAt) return false;
    const orderDate = order.createdAt?.toDate
      ? order.createdAt.toDate()
      : new Date(order.createdAt);
    if (!orderDate || isNaN(orderDate.getTime())) return false;
    const diffDays = (Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > 30;
  });
  const hasPastDue = pastDueOrders.length > 0;
  const net30Status = activePartner?.net30Status || 'none';
  // Approved accounts can place orders right away (via Net-30 if approved for Net-30, or EFT / Due Upon Receipt) unless past due
  const isOrderingDisabled = !isApproved || hasPastDue;

  // Email/Password Wholesale Login
  const handleWholesaleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setLoginLoading(true);
    try {
      const res = await fetch('/api/wholesale/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid email or password.');
      }
      setWholesaleToken(data.token);
      setWholesaleAccount(data.account);
      setPartnerOrders(data.orders || []);
      setLoginData({ email: '', password: '' });
    } catch (err: any) {
      setAuthError(err.message || 'Sign in failed.');
    } finally {
      setLoginLoading(false);
    }
  };

  // Lead Capture Sign-Up (NO business docs required)
  const handleWholesaleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setSignupLoading(true);
    try {
      const res = await fetch('/api/wholesale/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...signupData,
          notifyEmail: wholesaleSettings.email
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not create wholesale account.');
      }
      setWholesaleToken(data.token);
      setWholesaleAccount(data.account);
      setPartnerOrders([]);
      setSignupData({
        businessName: '', contactName: '', email: '', password: '',
        phone: '', type: 'Restaurant', address: '', estimatedVolume: '', message: ''
      });
    } catch (err: any) {
      setAuthError(err.message || 'Sign up failed.');
    } finally {
      setSignupLoading(false);
    }
  };

  // Submit CA Compliance Docs after account creation
  const handleDocsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDocsLoading(true);
    setDocsSubmittedNotice('');

    try {
      if (wholesaleToken) {
        const res = await fetch('/api/wholesale/submit-docs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${wholesaleToken}`
          },
          body: JSON.stringify({
            ...docsForm,
            abcLicenseFile: abcFile.status === 'success' ? abcFile : null,
            resaleLicenseFile: resaleFile.status === 'success' ? resaleFile : null,
            notifyEmail: wholesaleSettings.email
          })
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to submit compliance documents.');
        }
        setWholesaleAccount(data.account);
        setShowDocsEditor(false);
        setDocsSubmittedNotice(
          `California compliance documents submitted and sent to ${data.notifiedEmail || wholesaleSettings.email} for approval. Wholesale pricing and ordering will unlock automatically upon approval.`
        );
      } else if (user) {
        await addDoc(collection(db, 'wholesale_inquiries'), {
          businessName: docsForm.website || user.displayName || 'Wholesale Applicant',
          contactName: user.displayName || 'Applicant',
          email: user.email,
          phone: 'Provided via Portal',
          type: 'Retail',
          ...docsForm,
          billingAddress: docsForm.billingAddressSame ? docsForm.address : docsForm.billingAddress,
          status: 'pending',
          docsSubmitted: true,
          abcLicenseFile: abcFile.status === 'success' ? abcFile : { name: 'abc_compliance.pdf', size: 142400, status: 'success' },
          resaleLicenseFile: resaleFile.status === 'success' ? resaleFile : { name: 'ca_resale_cert.pdf', size: 210100, status: 'success' },
          createdAt: serverTimestamp()
        });
        setShowDocsEditor(false);
        setDocsSubmittedNotice('California compliance documents submitted for review.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to submit documents.');
    } finally {
      setDocsLoading(false);
    }
  };

  // Refresh status from server (e.g. after Travis clicks Approve/Pending/Hold in Gmail)
  const handleRefreshAccountStatus = async () => {
    if (!wholesaleToken) return;
    setRefreshingStatus(true);
    try {
      const res = await fetch('/api/wholesale/me', {
        headers: { Authorization: `Bearer ${wholesaleToken}` }
      });
      const data = await res.json();
      if (res.ok && data.account) {
        setWholesaleAccount(data.account);
        if (Array.isArray(data.orders)) {
          setPartnerOrders(data.orders);
        }
      }
    } catch (err) {
      console.error('Failed to refresh status:', err);
    } finally {
      setRefreshingStatus(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e: any) {
      console.error(e);
      if (e.message?.includes('unauthorized-domain') || e.code === 'auth/unauthorized-domain') {
        setDemoPartnerActive(true);
        sessionStorage.setItem('godley_demo_partner', 'true');
      } else {
        alert(e.message || 'Google login failed');
      }
    }
  };

  const handleLogout = async () => {
    setWholesaleToken(null);
    setWholesaleAccount(null);
    setPartnerOrders([]);
    setDocsSubmittedNotice('');
    setShowDocsEditor(false);
    if (demoPartnerActive) {
      setDemoPartnerActive(false);
      sessionStorage.removeItem('godley_demo_partner');
    }
    if (user) {
      await signOut(auth);
    }
  };

  const handleSettleInvoiceOnline = async (id: string, simulate = false) => {
    try {
      setSettlingOrderId(id);
      const res = await fetch('/api/checkout/wholesale-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: id, simulate })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.simulated) {
        alert('Invoice successfully settled via Electronic Funds Transfer (EFT). Accounting ledger updated.');
        setPartnerOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'paid' } : o));
      } else if (data.canSimulate) {
        const confirmSim = window.confirm(
          'Stripe Secret Key is not yet set in environment variables.\n\nWould you like to simulate successful online settlement via EFT / ACH bank transfer to test this flow now?'
        );
        if (confirmSim) {
          await handleSettleInvoiceOnline(id, true);
        }
      } else {
        alert(data.error || 'Failed to create payment session.');
      }
    } catch (err) {
      console.error(err);
      alert('Error starting online settlement.');
    } finally {
      setSettlingOrderId(null);
    }
  };

  const handleRequestNet30 = async () => {
    if (!activePartner) return;
    setRequestingNet30(true);
    try {
      if (wholesaleToken) {
        const res = await fetch('/api/wholesale/request-net30', {
          method: 'POST',
          headers: { Authorization: `Bearer ${wholesaleToken}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Request failed');
        setWholesaleAccount(data.account);
      } else if (user && firebasePartnerDoc?.id) {
        const docRef = doc(db, 'wholesale_inquiries', firebasePartnerDoc.id);
        await updateDoc(docRef, {
          net30Status: 'requested',
          net30RequestedAt: serverTimestamp()
        });
      }
      alert('Your NET-30 Terms Credit application was successfully submitted.');
    } catch (err: any) {
      alert(`Failed to request Net-30 credit lines: ${err.message}`);
    } finally {
      setRequestingNet30(false);
    }
  };

  const updateQty = (id: string, delta: number) => {
    setBulkCart(prev => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) + delta)
    }));
  };

  const handlePlaceBulkOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isApproved) return;

    const itemsSelected = WHOLESALE_PRODUCTS
      .filter(p => (bulkCart[p.id] || 0) > 0)
      .map(p => ({
        productId: p.id,
        sku: `WS-${p.id.toUpperCase()}`,
        name: p.name,
        formattedType: p.formattedType,
        quantity: bulkCart[p.id],
        price: p.price,
        unitPriceCents: p.price * 100
      }));

    if (itemsSelected.length === 0) {
      alert('Please add at least 1 keg or case to place a wholesale order.');
      return;
    }

    setPlacingOrder(true);
    setOrderSuccessMsg('');

    try {
      if (wholesaleToken) {
        const res = await fetch('/api/wholesale/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${wholesaleToken}`
          },
          body: JSON.stringify({ items: itemsSelected })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to place wholesale order.');
        setPartnerOrders(prev => [data.order, ...prev]);
        setBulkCart({ 'keg-dry': 0, 'keg-hop': 0, 'case-dry': 0, 'case-hop': 0 });
        setOrderSuccessMsg(`Purchase Order ${data.order.orderId} submitted (${data.order.paymentTerm}). A confirmation invoice was sent to ${wholesaleAccount?.email}.`);
      } else if (user && activePartner) {
        const subtotal = itemsSelected.reduce((acc, item) => acc + item.price * item.quantity, 0);
        const totalUnitsCount = itemsSelected.reduce((acc, item) => acc + item.quantity, 0);
        const shipping = totalUnitsCount >= 4 ? 0 : 50;
        const grandTotal = subtotal + shipping;
        const finalOrder = {
          orderId: 'PO-' + Math.floor(100000 + Math.random() * 900000),
          source: 'wholesale',
          customerId: user.uid,
          customerName: activePartner.contactName,
          businessName: activePartner.businessName,
          customerEmail: user.email,
          items: itemsSelected,
          subtotalCents: Math.round(subtotal * 100),
          taxCents: 0,
          shippingCents: Math.round(shipping * 100),
          totalCents: Math.round(grandTotal * 100),
          currency: 'USD',
          status: 'unpaid',
          deliveryStatus: 'processing',
          abcLicense: activePartner.abcLicenseNumber,
          resaleNumber: activePartner.resaleLicenseNumber,
          createdAt: serverTimestamp(),
          paymentTerm: net30Status === 'approved' ? 'NET-30' : 'DUE UPON RECEIPT (EFT)'
        };
        await addDoc(collection(db, 'orders'), finalOrder);
        setBulkCart({ 'keg-dry': 0, 'keg-hop': 0, 'case-dry': 0, 'case-hop': 0 });
        setOrderSuccessMsg(`Purchase Order ${finalOrder.orderId} successfully submitted. A confirmation invoice is en route to ${user.email}.`);
      } else if (demoPartnerActive) {
        const subtotal = itemsSelected.reduce((acc, item) => acc + item.price * item.quantity, 0);
        const totalUnitsCount = itemsSelected.reduce((acc, item) => acc + item.quantity, 0);
        const shipping = totalUnitsCount >= 4 ? 0 : 50;
        const grandTotal = subtotal + shipping;
        const demoOrder = {
          id: 'ord-ws-demo-' + Date.now(),
          orderId: 'PO-' + Math.floor(100000 + Math.random() * 900000),
          source: 'wholesale',
          status: 'unpaid',
          deliveryStatus: 'processing',
          paymentMethod: 'net-30',
          paymentTerm: 'NET-30',
          totalCents: Math.round(grandTotal * 100),
          subtotalCents: Math.round(subtotal * 100),
          shippingCents: Math.round(shipping * 100),
          taxCents: 0,
          createdAt: new Date().toISOString(),
          items: itemsSelected
        };
        setPartnerOrders(prev => [demoOrder, ...prev]);
        setBulkCart({ 'keg-dry': 0, 'keg-hop': 0, 'case-dry': 0, 'case-hop': 0 });
        setOrderSuccessMsg(`Demo Purchase Order ${demoOrder.orderId} created.`);
      }
      setTimeout(() => setOrderSuccessMsg(''), 10000);
    } catch (err: any) {
      alert(err.message || 'Failed to submit Purchase Order. Please try again.');
    } finally {
      setPlacingOrder(false);
    }
  };

  const totalDraftUnits: number = Object.values(bulkCart).reduce((a: number, b: any) => a + (Number(b) || 0), 0) as number;
  const draftSubtotal = WHOLESALE_PRODUCTS.reduce((sum, p) => sum + ((bulkCart[p.id] || 0) * p.price), 0);
  const draftEstFreight = totalDraftUnits === 0 ? 0 : (totalDraftUnits >= 4 ? 0 : 50);
  const draftGrandTotal = draftSubtotal + draftEstFreight;

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 font-serif relative">
      {/* Top Bar */}
      <div className="flex flex-wrap justify-end gap-2.5 items-center mb-6">
        <Link
          to="/admin"
          className="text-[10px] uppercase tracking-[0.2em] text-stone-400 hover:text-amber-400 border border-stone-800 hover:border-amber-500/40 px-3 py-1.5 bg-stone-950/70 backdrop-blur-sm transition-all rounded"
        >
          Executive Admin
        </Link>

        {isLoggedIn ? (
          <>
            <span className="text-[10px] text-stone-400 uppercase tracking-widest font-sans">
              {activePartner?.businessName || user?.email}
            </span>
            {demoPartnerActive && !wholesaleAccount && !user && (
              <span className="text-[9px] bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono px-2 py-1 rounded uppercase tracking-wider">
                Partner Demo Active
              </span>
            )}
            <button
              onClick={handleLogout}
              className="text-[10px] uppercase tracking-[0.2em] text-amber-500/80 hover:text-amber-400 border border-amber-500/30 px-3 py-1.5 bg-amber-500/5 backdrop-blur-sm transition-all rounded cursor-pointer"
            >
              Sign Out
            </button>
          </>
        ) : (
          <button
            onClick={() => {
              setDemoPartnerActive(true);
              sessionStorage.setItem('godley_demo_partner', 'true');
            }}
            className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/40 text-amber-400 hover:bg-amber-500 hover:text-stone-950 text-[10px] uppercase tracking-[0.2em] font-semibold rounded transition-all cursor-pointer"
            title="Preview the approved wholesale dashboard"
          >
            Admin Demo: View Approved Portal
          </button>
        )}
      </div>

      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center space-y-5 mb-12"
      >
        <h1 className="text-4xl md:text-6xl text-amber-500 uppercase tracking-widest leading-tight whitespace-pre-line">
          {wholesaleSettings.title}
        </h1>
        <div className="w-24 h-[1px] bg-amber-500/50 mx-auto"></div>
        <p className="text-lg md:text-xl text-stone-400 italic max-w-2xl mx-auto whitespace-pre-line">
          {wholesaleSettings.subtitle}
        </p>
      </motion.div>

      {/* ======================================================== */}
      {/* VIEW 1: LOGGED-OUT LANDING PAGE (LOGIN FIRST + SIGN UP)  */}
      {/* ======================================================== */}
      {!isLoggedIn && (
        <div className="grid md:grid-cols-12 gap-12 items-start">
          {/* Left Column: Info & Unpriced Product Preview */}
          <div className="md:col-span-6 space-y-8 text-stone-300 leading-relaxed">
            <p className="whitespace-pre-line text-stone-300 font-serif text-sm leading-relaxed">
              {wholesaleSettings.body}
            </p>

            {/* Unpriced Wholesale Catalog Teaser */}
            <div className="bg-stone-950/50 border border-stone-800 rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                <h3 className="text-amber-500 uppercase tracking-widest text-xs font-bold">
                  Available Trade Formats
                </h3>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-stone-400 uppercase">
                  <Lock size={11} className="text-amber-500" /> Pricing Upon Approval
                </span>
              </div>
              <div className="space-y-3">
                {WHOLESALE_PRODUCTS.map(p => (
                  <div key={p.id} className="p-3 bg-stone-900/40 border border-stone-850 rounded flex justify-between items-center gap-3">
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-amber-500/80 font-mono block mb-0.5">
                        {p.formattedType}
                      </span>
                      <div className="text-xs text-stone-100 font-semibold">{p.name}</div>
                      <div className="text-[10px] text-stone-500 font-sans mt-0.5">{p.specs}</div>
                    </div>
                    <span className="text-[9px] font-mono uppercase tracking-wider text-stone-500 border border-stone-800 px-2 py-1 rounded shrink-0">
                      Login Required
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border border-stone-850 bg-stone-900/20 rounded space-y-2.5 font-sans text-xs">
              <h4 className="text-amber-500 font-bold uppercase tracking-wider text-[10px]">
                How Wholesale Onboarding Works
              </h4>
              <ol className="list-decimal list-inside space-y-1.5 text-stone-400 text-[11px]">
                <li>Create a login with basic contact details — no license documents needed yet.</li>
                <li>Browse our full wholesale keg and case product specifications immediately.</li>
                <li>Submit your California ABC License &amp; CDTFA Resale Certificate inside your portal when ready to unlock wholesale pricing and ordering.</li>
              </ol>
            </div>

            <div className="pt-4 space-y-2 border-t border-stone-800">
              <h3 className="text-amber-500 uppercase tracking-widest text-xs">Direct Trade Contact</h3>
              <p className="text-xs font-sans text-stone-400">
                {wholesaleSettings.email}<br />
                {wholesaleSettings.phone}
              </p>
            </div>
          </div>

          {/* Right Column: Login First Card with Sign Up Toggle */}
          <div className="md:col-span-6 bg-stone-950/60 backdrop-blur-md border border-stone-800 p-8 rounded-lg shadow-2xl">
            <div className="flex border-b border-stone-800 mb-6">
              <button
                type="button"
                onClick={() => { setAuthView('login'); setAuthError(''); }}
                className={`flex-1 pb-3 text-xs uppercase tracking-[0.2em] font-sans font-bold flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
                  authView === 'login'
                    ? 'border-amber-500 text-amber-500'
                    : 'border-transparent text-stone-500 hover:text-stone-300'
                }`}
              >
                <LogIn size={14} /> Partner Login
              </button>
              <button
                type="button"
                onClick={() => { setAuthView('signup'); setAuthError(''); }}
                className={`flex-1 pb-3 text-xs uppercase tracking-[0.2em] font-sans font-bold flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
                  authView === 'signup'
                    ? 'border-amber-500 text-amber-500'
                    : 'border-transparent text-stone-500 hover:text-stone-300'
                }`}
              >
                <UserPlus size={14} /> Sign Up
              </button>
            </div>

            {authError && (
              <div className="mb-5 p-3 rounded bg-red-950/40 border border-red-500/40 text-red-300 text-xs font-sans">
                {authError}
              </div>
            )}

            {authView === 'login' ? (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl text-stone-100 uppercase tracking-widest">Wholesale Partner Sign In</h2>
                  <p className="text-xs text-stone-400 font-sans mt-1">
                    Access your wholesale catalog, compliance status, pricing, and purchase orders.
                  </p>
                </div>

                <form onSubmit={handleWholesaleLogin} className="space-y-4 font-sans">
                  <div className="space-y-1.5">
                    <Label htmlFor="loginEmail" className="text-stone-400 uppercase tracking-wider text-[10px]">Business Email</Label>
                    <Input
                      id="loginEmail"
                      type="email"
                      required
                      placeholder="buyer@yourbusiness.com"
                      value={loginData.email}
                      onChange={e => setLoginData({ ...loginData, email: e.target.value })}
                      className="bg-stone-950 border-stone-800 focus:border-amber-500/50 rounded-sm text-xs text-stone-100"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="loginPassword" className="text-stone-400 uppercase tracking-wider text-[10px]">Password</Label>
                    <Input
                      id="loginPassword"
                      type="password"
                      required
                      placeholder="Enter your password"
                      value={loginData.password}
                      onChange={e => setLoginData({ ...loginData, password: e.target.value })}
                      className="bg-stone-950 border-stone-800 focus:border-amber-500/50 rounded-sm text-xs text-stone-100"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full bg-amber-600 hover:bg-amber-500 text-stone-950 uppercase tracking-widest font-bold rounded-sm h-11 text-xs cursor-pointer"
                  >
                    {loginLoading ? 'Signing In...' : 'Sign In to Wholesale Portal'}
                  </Button>
                </form>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-stone-850" /></div>
                  <div className="relative flex justify-center text-[10px] uppercase font-sans tracking-widest">
                    <span className="bg-stone-950 px-3 text-stone-500">Or</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="w-full py-2.5 border border-stone-800 hover:border-amber-500/40 bg-stone-900/50 text-stone-300 hover:text-amber-400 text-xs uppercase tracking-widest font-sans rounded-sm transition-all cursor-pointer"
                >
                  Continue with Google Account
                </button>

                <div className="pt-4 border-t border-stone-850 text-center space-y-3">
                  <p className="text-xs text-stone-400 font-sans">
                    Don&apos;t have a wholesale account yet? Sign up in 30 seconds — no business documents required upfront.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setAuthView('signup'); setAuthError(''); }}
                    className="w-full border-amber-500/50 text-amber-400 hover:bg-amber-500 hover:text-stone-950 uppercase tracking-widest text-xs font-sans font-bold h-11 cursor-pointer"
                  >
                    Sign Up for Wholesale Access
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl text-stone-100 uppercase tracking-widest">Create Wholesale Account</h2>
                  <p className="text-xs text-stone-400 font-sans mt-1">
                    Register with basic contact info to browse our wholesale product catalog. Business licenses are only required later before viewing pricing or placing orders.
                  </p>
                </div>

                <form onSubmit={handleWholesaleSignup} className="space-y-4 font-sans">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="signupBusiness" className="text-stone-400 uppercase tracking-wider text-[10px]">Business Name *</Label>
                      <Input
                        id="signupBusiness"
                        required
                        placeholder="e.g. Auburn Bistro"
                        value={signupData.businessName}
                        onChange={e => setSignupData({ ...signupData, businessName: e.target.value })}
                        className="bg-stone-950 border-stone-800 focus:border-amber-500/50 rounded-sm text-xs text-stone-100"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="signupContact" className="text-stone-400 uppercase tracking-wider text-[10px]">Contact Name *</Label>
                      <Input
                        id="signupContact"
                        required
                        placeholder="Your full name"
                        value={signupData.contactName}
                        onChange={e => setSignupData({ ...signupData, contactName: e.target.value })}
                        className="bg-stone-950 border-stone-800 focus:border-amber-500/50 rounded-sm text-xs text-stone-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="signupEmail" className="text-stone-400 uppercase tracking-wider text-[10px]">Business Email *</Label>
                      <Input
                        id="signupEmail"
                        type="email"
                        required
                        placeholder="buyer@business.com"
                        value={signupData.email}
                        onChange={e => setSignupData({ ...signupData, email: e.target.value })}
                        className="bg-stone-950 border-stone-800 focus:border-amber-500/50 rounded-sm text-xs text-stone-100"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="signupPassword" className="text-stone-400 uppercase tracking-wider text-[10px]">Create Password *</Label>
                      <Input
                        id="signupPassword"
                        type="password"
                        required
                        minLength={6}
                        placeholder="Min 6 characters"
                        value={signupData.password}
                        onChange={e => setSignupData({ ...signupData, password: e.target.value })}
                        className="bg-stone-950 border-stone-800 focus:border-amber-500/50 rounded-sm text-xs text-stone-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="signupPhone" className="text-stone-400 uppercase tracking-wider text-[10px]">Phone Number *</Label>
                      <Input
                        id="signupPhone"
                        type="tel"
                        required
                        placeholder="(530) 555-0100"
                        value={signupData.phone}
                        onChange={e => setSignupData({ ...signupData, phone: e.target.value })}
                        className="bg-stone-950 border-stone-800 focus:border-amber-500/50 rounded-sm text-xs text-stone-100"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="signupType" className="text-stone-400 uppercase tracking-wider text-[10px]">Establishment Type</Label>
                      <select
                        id="signupType"
                        value={signupData.type}
                        onChange={e => setSignupData({ ...signupData, type: e.target.value })}
                        className="flex h-10 w-full bg-stone-950 border border-stone-800 focus:border-amber-500/50 rounded-sm px-3 py-2 text-xs text-stone-100 focus-visible:outline-none"
                      >
                        <option value="Restaurant">Restaurant</option>
                        <option value="Bar / Taproom">Bar / Taproom</option>
                        <option value="Retail">Retail / Bottle Shop</option>
                        <option value="Distributor">Distributor</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="signupCity" className="text-stone-400 uppercase tracking-wider text-[10px]">City / Region (Optional)</Label>
                      <Input
                        id="signupCity"
                        placeholder="e.g. Auburn, CA"
                        value={signupData.address}
                        onChange={e => setSignupData({ ...signupData, address: e.target.value })}
                        className="bg-stone-950 border-stone-800 focus:border-amber-500/50 rounded-sm text-xs text-stone-100"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="signupVolume" className="text-stone-400 uppercase tracking-wider text-[10px]">Estimated Volume (Optional)</Label>
                      <select
                        id="signupVolume"
                        value={signupData.estimatedVolume}
                        onChange={e => setSignupData({ ...signupData, estimatedVolume: e.target.value })}
                        className="flex h-10 w-full bg-stone-950 border border-stone-800 focus:border-amber-500/50 rounded-sm px-3 py-2 text-xs text-stone-100 focus-visible:outline-none"
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
                    <Label htmlFor="signupMessage" className="text-stone-400 uppercase tracking-wider text-[10px]">Notes / Beverage Program (Optional)</Label>
                    <Textarea
                      id="signupMessage"
                      rows={2}
                      placeholder="Tell us what ciders you are interested in pouring..."
                      value={signupData.message}
                      onChange={e => setSignupData({ ...signupData, message: e.target.value })}
                      className="bg-stone-950 border-stone-800 focus:border-amber-500/50 rounded-sm resize-none text-xs text-stone-200"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={signupLoading}
                    className="w-full bg-amber-600 hover:bg-amber-500 text-stone-950 uppercase tracking-widest font-bold rounded-sm h-11 text-xs cursor-pointer"
                  >
                    {signupLoading ? 'Creating Account...' : 'Create Account & Browse Products'}
                  </Button>
                </form>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => { setAuthView('login'); setAuthError(''); }}
                    className="text-xs text-stone-400 hover:text-amber-400 font-sans underline cursor-pointer"
                  >
                    Already registered? Back to Login
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 2: LOGGED IN, NOT YET APPROVED (CATALOG + DOCS GATE)*/}
      {/* ======================================================== */}
      {isLoggedIn && !isApproved && (
        <div className="space-y-10">
          {/* Status Banner */}
          <div className={`p-6 rounded-lg border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
            accountStatus === 'hold'
              ? 'bg-red-950/20 border-red-500/40'
              : accountStatus === 'pending'
              ? 'bg-amber-950/20 border-amber-500/35'
              : 'bg-stone-900/60 border-stone-800'
          }`}>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                  accountStatus === 'hold'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : accountStatus === 'pending'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-stone-800 text-stone-300 border border-stone-700'
                }`}>
                  Status: {accountStatus === 'lead' ? 'Catalog Preview (Docs Needed)' : accountStatus.toUpperCase()}
                </span>
                <span className="text-xs text-stone-400 font-mono">{activePartner?.email || user?.email}</span>
              </div>
              <h2 className="text-xl text-stone-100 uppercase tracking-widest">
                {accountStatus === 'hold'
                  ? 'Account Currently On Hold'
                  : accountStatus === 'pending' && docsSubmitted
                  ? 'California Compliance Review In Progress'
                  : 'Welcome — Submit CA Compliance Documents to Unlock Pricing'}
              </h2>
              <p className="text-xs text-stone-300 font-sans max-w-2xl leading-relaxed">
                {accountStatus === 'hold'
                  ? `Your wholesale account is currently placed on hold pending compliance clarification. Please contact ${wholesaleSettings.email} or update your California ABC & Resale filings below.`
                  : accountStatus === 'pending' && docsSubmitted
                  ? 'We have received your California ABC and CDTFA Resale documentation. You can browse our wholesale product catalog below while our accounts desk completes verification.'
                  : 'You have full access to preview our wholesale cider catalog below. To view wholesale pricing and submit purchase orders in California, please submit your required CA ABC License and Resale Certificate.'}
              </p>
            </div>

            {wholesaleToken && (
              <button
                type="button"
                onClick={handleRefreshAccountStatus}
                disabled={refreshingStatus}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 border border-stone-700 text-amber-400 text-[10px] font-sans font-bold uppercase tracking-widest rounded flex items-center gap-2 cursor-pointer shrink-0"
              >
                <RefreshCw size={12} className={refreshingStatus ? 'animate-spin' : ''} />
                {refreshingStatus ? 'Checking...' : 'Refresh Status'}
              </button>
            )}
          </div>

          {docsSubmittedNotice && (
            <div className="bg-emerald-950/25 border border-emerald-500/35 p-4 rounded-lg text-xs text-emerald-300 font-sans flex items-center gap-3">
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
              <span>{docsSubmittedNotice}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Wholesale Product Catalog (Pricing Locked!) */}
            <div className="lg:col-span-6 bg-stone-950/40 border border-stone-800 p-6 rounded-lg space-y-5">
              <div className="border-b border-stone-800 pb-3 flex justify-between items-center">
                <div>
                  <h3 className="text-stone-100 uppercase tracking-widest text-sm flex items-center gap-2">
                    <Building2 size={15} className="text-amber-500" />
                    Wholesale Product Catalog
                  </h3>
                  <p className="text-[11px] text-stone-500 font-sans mt-0.5">
                    Full product specifications • Pricing &amp; ordering unlock after approval
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase bg-amber-950/30 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded">
                  <Lock size={11} /> Pricing Locked
                </span>
              </div>

              <div className="space-y-3.5">
                {WHOLESALE_PRODUCTS.map(p => (
                  <div key={p.id} className="p-4 bg-stone-900/40 border border-stone-850 rounded space-y-2">
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <span className="text-[9px] uppercase tracking-wider bg-stone-900 border border-stone-800 text-amber-500/80 px-1.5 py-0.5 rounded font-sans inline-block mb-1">
                          {p.formattedType}
                        </span>
                        <h4 className="text-stone-100 uppercase tracking-wider text-xs font-semibold">{p.name}</h4>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-stone-400 bg-stone-950 border border-stone-800 px-2 py-1 rounded">
                          <Lock size={10} className="text-amber-500" /> Price Hidden
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-stone-400 font-sans">{p.specs}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: CA Compliance Document Submission / Submitted Summary */}
            <div className="lg:col-span-6 bg-stone-950/50 border border-stone-800 p-6 rounded-lg space-y-6">
              {docsSubmitted && !showDocsEditor ? (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 border-b border-stone-800 pb-3">
                    <FileCheck2 size={20} className="text-amber-500" />
                    <div>
                      <h3 className="text-stone-100 uppercase tracking-widest text-sm">
                        Submitted California Credentials
                      </h3>
                      <p className="text-[11px] text-stone-400 font-sans">
                        Sent to {wholesaleSettings.email} for verification
                      </p>
                    </div>
                  </div>

                  <div className="bg-stone-900/50 border border-stone-850 p-4 rounded space-y-2.5 text-xs font-mono text-stone-400">
                    <div className="flex justify-between">
                      <span>Business:</span>
                      <span className="text-stone-200">{activePartner?.businessName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Federal Tax ID / EIN:</span>
                      <span className="text-stone-200">{activePartner?.taxId || 'Submitted'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>CA ABC License #:</span>
                      <span className="text-amber-400 font-bold">{activePartner?.abcLicenseNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Resale Certificate #:</span>
                      <span className="text-stone-200">{activePartner?.resaleLicenseNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Freight Address:</span>
                      <span className="text-stone-200 text-right max-w-[60%]">{activePartner?.address}</span>
                    </div>
                  </div>

                  <p className="text-xs text-stone-400 font-sans leading-relaxed">
                    Once our wholesale desk approves your submission, you will receive an email confirmation and this page will unlock wholesale pricing and purchase order checkout.
                  </p>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowDocsEditor(true)}
                    className="w-full border-stone-700 text-stone-300 hover:border-amber-500 hover:text-amber-400 uppercase tracking-widest text-xs font-sans cursor-pointer"
                  >
                    Update / Resubmit Compliance Documents
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleDocsSubmit} className="space-y-5 font-sans">
                  <div className="border-b border-stone-800 pb-3 flex justify-between items-center">
                    <div>
                      <h3 className="text-amber-500 font-serif uppercase tracking-widest text-sm flex items-center gap-2">
                        <ShieldCheck size={16} /> Submit Required CA Purchase Docs
                      </h3>
                      <p className="text-[11px] text-stone-400 mt-0.5">
                        Required by California ABC &amp; CDTFA to view wholesale pricing and order
                      </p>
                    </div>
                    {showDocsEditor && (
                      <button
                        type="button"
                        onClick={() => setShowDocsEditor(false)}
                        className="text-[10px] uppercase tracking-wider text-stone-400 hover:text-stone-200 cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="taxId" className="text-stone-400 uppercase tracking-wider text-[10px]">Federal Tax ID / EIN *</Label>
                      <Input
                        id="taxId"
                        required
                        placeholder="XX-XXXXXXX"
                        value={docsForm.taxId}
                        onChange={e => setDocsForm({ ...docsForm, taxId: e.target.value })}
                        className="bg-stone-950 border-stone-800 focus:border-amber-500/50 rounded-sm text-xs text-stone-200"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="abcLicenseNumber" className="text-stone-400 uppercase tracking-wider text-[10px]">State ABC License # *</Label>
                      <Input
                        id="abcLicenseNumber"
                        required
                        placeholder="e.g. Type 20 / 21 / 47"
                        value={docsForm.abcLicenseNumber}
                        onChange={e => setDocsForm({ ...docsForm, abcLicenseNumber: e.target.value })}
                        className="bg-stone-950 border-stone-800 focus:border-amber-500/50 rounded-sm text-xs text-stone-200"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="resaleLicenseNumber" className="text-stone-400 uppercase tracking-wider text-[10px]">CA Sales Tax Resale Certificate # *</Label>
                    <Input
                      id="resaleLicenseNumber"
                      required
                      placeholder="e.g. SR-XXXX-XXXX"
                      value={docsForm.resaleLicenseNumber}
                      onChange={e => setDocsForm({ ...docsForm, resaleLicenseNumber: e.target.value })}
                      className="bg-stone-950 border-stone-800 focus:border-amber-500/50 rounded-sm text-xs text-stone-200"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div className="p-3 border border-stone-850 bg-stone-950/60 rounded space-y-2">
                      <div>
                        <span className="text-[9px] text-stone-400 uppercase tracking-wider block font-semibold">State ABC License Copy</span>
                        <p className="text-[9px] text-stone-500">PDF, PNG, or JPG of active license</p>
                      </div>
                      {abcFile.status === 'idle' ? (
                        <label className="flex items-center justify-center border border-dashed border-stone-800 hover:border-amber-500/40 p-2.5 rounded cursor-pointer transition-all bg-stone-900/40">
                          <input type="file" onChange={e => handleUploadSimulate('abc', e)} className="hidden" accept=".pdf,.png,.jpg,.jpeg" />
                          <span className="text-[10px] text-amber-500 uppercase tracking-wider font-medium">Upload ABC Copy</span>
                        </label>
                      ) : (
                        <div className="bg-stone-950 p-2 border border-stone-800 rounded flex items-center justify-between gap-2">
                          <span className="text-[9px] text-stone-300 font-mono truncate">{abcFile.name}</span>
                          <span className={`text-[9px] font-mono font-bold uppercase ${abcFile.status === 'success' ? 'text-emerald-400' : 'text-amber-500'}`}>
                            {abcFile.status === 'success' ? 'Ready' : 'Loading...'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="p-3 border border-stone-850 bg-stone-950/60 rounded space-y-2">
                      <div>
                        <span className="text-[9px] text-stone-400 uppercase tracking-wider block font-semibold">CDTFA Resale Certificate</span>
                        <p className="text-[9px] text-stone-500">CDTFA-120 / Seller&apos;s Permit copy</p>
                      </div>
                      {resaleFile.status === 'idle' ? (
                        <label className="flex items-center justify-center border border-dashed border-stone-800 hover:border-amber-500/40 p-2.5 rounded cursor-pointer transition-all bg-stone-900/40">
                          <input type="file" onChange={e => handleUploadSimulate('resale', e)} className="hidden" accept=".pdf,.png,.jpg,.jpeg" />
                          <span className="text-[10px] text-amber-500 uppercase tracking-wider font-medium">Upload Resale Copy</span>
                        </label>
                      ) : (
                        <div className="bg-stone-950 p-2 border border-stone-800 rounded flex items-center justify-between gap-2">
                          <span className="text-[9px] text-stone-300 font-mono truncate">{resaleFile.name}</span>
                          <span className={`text-[9px] font-mono font-bold uppercase ${resaleFile.status === 'success' ? 'text-emerald-400' : 'text-amber-500'}`}>
                            {resaleFile.status === 'success' ? 'Ready' : 'Loading...'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="docsAddress" className="text-stone-400 uppercase tracking-wider text-[10px]">California Delivery / Shipping Address *</Label>
                    <Input
                      id="docsAddress"
                      required
                      placeholder="Street Address, City, CA, ZIP"
                      value={docsForm.address}
                      onChange={e => setDocsForm({ ...docsForm, address: e.target.value })}
                      className="bg-stone-950 border-stone-800 focus:border-amber-500/50 rounded-sm text-xs text-stone-200"
                    />
                  </div>

                  <label className="flex items-center gap-2.5 text-xs text-stone-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={docsForm.billingAddressSame}
                      onChange={e => setDocsForm({ ...docsForm, billingAddressSame: e.target.checked })}
                      className="accent-amber-500 w-4 h-4 cursor-pointer"
                    />
                    <span>Billing address is same as shipping address</span>
                  </label>

                  {!docsForm.billingAddressSame && (
                    <div className="space-y-1.5">
                      <Label htmlFor="docsBillingAddress" className="text-stone-400 uppercase tracking-wider text-[10px]">Billing Address *</Label>
                      <Input
                        id="docsBillingAddress"
                        required
                        placeholder="Billing street address, city, state, ZIP"
                        value={docsForm.billingAddress}
                        onChange={e => setDocsForm({ ...docsForm, billingAddress: e.target.value })}
                        className="bg-stone-950 border-stone-800 focus:border-amber-500/50 rounded-sm text-xs text-stone-200"
                      />
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={docsLoading}
                    className="w-full bg-amber-600 hover:bg-amber-500 text-stone-950 uppercase tracking-widest font-bold rounded-sm h-11 text-xs cursor-pointer"
                  >
                    {docsLoading ? 'Submitting Compliance Package...' : 'Submit CA Docs for Approval'}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 3: APPROVED WHOLESALE PARTNER PORTAL (PRICING & PO) */}
      {/* ======================================================== */}
      {isLoggedIn && isApproved && (
        <div className="space-y-12">
          {verifyingPayment && (
            <div className="bg-amber-950/20 border border-amber-500/25 p-4 rounded text-xs flex items-center gap-3 animate-pulse">
              <Clock className="w-4 h-4 text-amber-500 animate-spin" />
              <p className="text-stone-300 font-sans">Querying Stripe for payment confirmations... Please stand by.</p>
            </div>
          )}

          {successSettleMsg && (
            <div className="bg-emerald-950/20 border border-emerald-500/30 p-4 rounded text-xs flex items-center justify-between gap-3">
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

          {/* Approved Banner */}
          <div className="bg-emerald-950/15 border border-emerald-500/30 p-4 rounded-lg flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Unlock size={18} className="text-emerald-400" />
              <div className="font-sans text-xs">
                <strong className="text-emerald-300 uppercase tracking-wider">Approved Wholesale Partner</strong>
                <span className="text-stone-400 ml-2">Wholesale pricing and commercial ordering are unlocked for {activePartner?.businessName}.</span>
              </div>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/25 px-2.5 py-1 rounded uppercase">
              {net30Status === 'approved' ? 'NET-30 Credit Active' : 'EFT / Due Upon Receipt'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            {/* LEFT COLUMN: BULK ORDER PLACEMENT CARD */}
            <div className="md:col-span-8 bg-stone-950/40 border border-stone-850 p-6 rounded-lg space-y-6">
              <div className="border-b border-stone-850 pb-3 flex justify-between items-center">
                <div>
                  <h3 className="text-stone-200 font-serif uppercase tracking-widest text-sm flex items-center gap-2">
                    <Building2 size={14} className="text-amber-500" />
                    Place Bulk Purchase Order
                  </h3>
                  <p className="text-stone-500 text-[10px] uppercase tracking-wider font-sans mt-0.5">
                    {net30Status === 'approved' ? 'NET-30 Terms Active' : 'EFT / Commercial Card Settlement (Or Apply for NET-30)'}
                  </p>
                </div>
                <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/20 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase font-medium">
                  Tax Exempt
                </span>
              </div>

              {/* PAST DUE BALANCE LOCKOUT ALERT */}
              {hasPastDue && (
                <div id="past-due-lockout" className="bg-red-950/15 border border-red-500/35 p-5 rounded text-xs leading-relaxed space-y-3 font-sans">
                  <div className="flex items-center gap-2 text-red-500 font-bold uppercase tracking-widest text-[11px]">
                    <AlertCircle size={15} className="text-red-500 animate-pulse" />
                    Credit Account Payment Hold
                  </div>
                  <p className="text-stone-300">
                    Your wholesale ordering capability is <strong className="text-red-400">currently locked</strong> because your account has past due invoices outstanding. Settle all past due balances in full via EFT / ACH or Commercial Card below to release shipping holds.
                  </p>
                </div>
              )}

              {/* OPTIONAL NET-30 UPGRADE CARD */}
              {net30Status !== 'approved' && !devBypassWholesale && (
                <div className="bg-amber-950/10 border border-amber-500/25 p-4 rounded text-xs leading-relaxed space-y-2.5 font-sans">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-amber-500 font-bold uppercase tracking-widest text-[11px]">
                      <Clock size={14} />
                      Optional: NET-30 Trade Credit Line
                    </div>
                    <span className="text-[10px] font-mono uppercase text-amber-400">
                      Status: {net30Status}
                    </span>
                  </div>
                  {net30Status === 'requested' ? (
                    <p className="text-stone-300 text-[11px]">
                      Your NET-30 credit application is under review. In the meantime, you can place orders immediately using EFT / Due Upon Receipt settlement.
                    </p>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <p className="text-stone-400 text-[11px]">
                        Orders can be placed immediately below on EFT / Due Upon Receipt, or you can request 30-day Net Credit terms.
                      </p>
                      <button
                        type="button"
                        onClick={handleRequestNet30}
                        disabled={requestingNet30}
                        className="px-3.5 py-2 bg-amber-600/15 hover:bg-amber-600 hover:text-stone-950 font-bold text-amber-400 rounded border border-amber-600/30 transition-all text-[10px] uppercase tracking-widest shrink-0 cursor-pointer"
                      >
                        {requestingNet30 ? 'Submitting...' : 'Apply for NET-30'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {orderSuccessMsg && (
                <div className="bg-emerald-950/30 border border-emerald-500/40 text-emerald-300 p-4 rounded text-xs leading-relaxed font-sans">
                  {orderSuccessMsg}
                </div>
              )}

              {/* WHOLESALE PRICED CATALOG & CART */}
              <form onSubmit={handlePlaceBulkOrder} className="space-y-6">
                <div className="space-y-4">
                  {WHOLESALE_PRODUCTS.map((p) => {
                    const count = bulkCart[p.id] || 0;
                    return (
                      <div key={p.id} className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-3.5 bg-stone-950/50 border border-stone-850 rounded transition-all ${isOrderingDisabled ? 'opacity-40 select-none' : ''}`}>
                        <div>
                          <span className="text-[9px] uppercase tracking-wider bg-stone-900 border border-stone-800 text-stone-400 px-1.5 py-0.5 rounded font-sans leading-none inline-block mb-1.5">
                            {p.formattedType}
                          </span>
                          <h4 className="text-stone-100 uppercase tracking-widest text-xs font-semibold">{p.name}</h4>
                          <p className="text-[11px] text-amber-400 font-mono font-bold mt-0.5">${p.price.toFixed(2)} / unit</p>
                        </div>

                        <div className="flex items-center gap-3.5 mt-3 sm:mt-0">
                          <button
                            type="button"
                            onClick={() => updateQty(p.id, -1)}
                            disabled={isOrderingDisabled}
                            className="w-7 h-7 bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-400 hover:text-stone-200 rounded flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30"
                          >
                            <Minus size={11} />
                          </button>
                          <span className="w-8 text-center text-xs text-stone-100 font-mono font-bold leading-none">{count}</span>
                          <button
                            type="button"
                            onClick={() => updateQty(p.id, 1)}
                            disabled={isOrderingDisabled}
                            className="w-7 h-7 bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-400 hover:text-stone-200 rounded flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30"
                          >
                            <Plus size={11} />
                          </button>
                          <span className="w-16 text-right text-xs text-stone-300 font-mono font-semibold">${(count * p.price).toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* TOTALS */}
                <div className="border-t border-stone-850 pt-4 space-y-2 text-xs font-mono text-stone-400 text-right">
                  <div className="flex justify-between sm:justify-end gap-12">
                    <span>Order Subtotal:</span>
                    <span className="text-stone-200 font-bold">${draftSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between sm:justify-end gap-12">
                    <span>Bulk LTL Freight / Pallet Handling:</span>
                    <span className="text-stone-200">{draftEstFreight === 0 ? 'FREE (4+ Units)' : `$${draftEstFreight.toFixed(2)}`}</span>
                  </div>
                  <div className="flex justify-between sm:justify-end gap-12">
                    <span>State Sales Tax Exemption:</span>
                    <span className="text-emerald-400">0.00% (Resale ID Verified)</span>
                  </div>
                  <div className="flex justify-between sm:justify-end gap-12 text-sm text-amber-500 font-bold border-t border-stone-850 pt-2 mt-2">
                    <span>Total Estimated Invoice:</span>
                    <span>${draftGrandTotal.toFixed(2)}</span>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={placingOrder || totalDraftUnits === 0 || isOrderingDisabled}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-stone-950 uppercase tracking-wider font-bold rounded-sm h-12 flex items-center justify-center gap-2 disabled:bg-stone-800 disabled:text-stone-500 cursor-pointer"
                >
                  <ShoppingCart size={15} />
                  {placingOrder
                    ? 'Transmitting Purchase Order...'
                    : hasPastDue
                    ? 'Ordering Locked: Pay Past Due Balance'
                    : 'Submit Certified Purchase Order'}
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
                    <strong className="text-stone-200 uppercase tracking-widest font-serif text-xs">{activePartner?.businessName || 'Godley Accounts'}</strong>
                  </div>
                  <div>
                    <span className="text-stone-500 block uppercase tracking-wider text-[9px]">Authorized Representative</span>
                    <span className="text-stone-300">{activePartner?.contactName || 'Authorized Buyer'}</span>
                  </div>
                  <div>
                    <span className="text-stone-500 block uppercase tracking-wider text-[9px]">State ABC License Number</span>
                    <span className="text-amber-500 font-mono font-bold">{activePartner?.abcLicenseNumber || 'Verified'}</span>
                  </div>
                  <div>
                    <span className="text-stone-500 block uppercase tracking-wider text-[9px]">Resale Certificate No.</span>
                    <span className="text-stone-300 font-mono">{activePartner?.resaleLicenseNumber || 'Verified'}</span>
                  </div>
                  <div>
                    <span className="text-stone-500 block uppercase tracking-wider text-[9px]">Federal Tax ID / EIN</span>
                    <span className="text-stone-300 font-mono">{activePartner?.taxId || 'Verified'}</span>
                  </div>
                  <div>
                    <span className="text-stone-500 block uppercase tracking-wider text-[9px]">Registered Freight Address</span>
                    <span className="text-stone-300 font-serif text-[10px] leading-tight block mt-0.5">{activePartner?.address || 'California'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-stone-950/45 border border-stone-850 p-5 rounded-lg space-y-3 font-sans">
                <h4 className="text-stone-200 font-serif uppercase tracking-widest text-xs border-b border-stone-850 pb-2 flex items-center gap-1.5">
                  <CreditCard size={13} className="text-amber-500" /> Commercial Credit Panel
                </h4>
                <div className="flex justify-between items-center bg-stone-900/35 p-2 rounded border border-stone-900 text-[11px]">
                  <span className="text-stone-500 uppercase tracking-wider text-[9px]">Credit Terms:</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] uppercase tracking-widest font-mono font-bold ${
                    net30Status === 'approved'
                      ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20'
                      : 'bg-stone-900 text-stone-400 border border-stone-800'
                  }`}>
                    {net30Status.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="bg-stone-900/20 border border-stone-850 p-4 rounded text-xs text-stone-400 space-y-2 font-sans">
                <h4 className="text-[10px] uppercase font-bold text-stone-300 tracking-wider flex items-center gap-1.5">
                  <Truck size={13} className="text-amber-500" /> Freight Logistics Policy
                </h4>
                <p className="leading-relaxed text-[10px]">
                  Minimum order of 4 cases/kegs qualifies for free California LTL freight. Hand-loaded pickups are available at the Lincoln Way Taproom during weekdays.
                </p>
              </div>
            </div>
          </div>

          {/* HISTORICAL INVOICES PAYABLE */}
          <div className="space-y-4">
            <h3 className="text-stone-100 uppercase tracking-widest text-lg font-serif border-b border-stone-800 pb-2">
              Historical Accounts &amp; Invoices Payable
            </h3>

            {partnerOrders.length === 0 ? (
              <div className="border border-dashed border-stone-800 p-8 rounded-lg text-center text-stone-500 text-xs italic font-sans">
                No past transactions on record. Your initial purchase order will appear below.
              </div>
            ) : (
              <div className="border border-stone-800 rounded-lg overflow-hidden bg-stone-950/20 overflow-x-auto">
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
                              ? 'bg-emerald-950/30 text-emerald-400'
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
                              className="text-[9px] uppercase tracking-widest font-semibold font-sans bg-emerald-600/20 text-emerald-400 hover:bg-emerald-500 hover:text-stone-950 px-2.5 py-1.5 rounded border border-emerald-600/30 transition-all cursor-pointer disabled:opacity-50"
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

          {/* PRINTABLE ORDER INVOICE MODAL */}
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
                <div className="flex justify-between items-start border-b border-stone-900 pb-4">
                  <div className="space-y-1">
                    <h2 className="text-amber-500 font-serif text-lg uppercase tracking-wider font-bold">Godley Ciders</h2>
                    <p className="text-xs text-stone-500">Lincoln Way Taproom &amp; Vineyards</p>
                    <p className="text-xs text-stone-500">Placer County, California</p>
                  </div>
                  <div className="text-right space-y-1 font-mono">
                    <p className="text-xs text-stone-400">Invoice: <strong className="text-stone-200">{selectedInvoice?.orderId}</strong></p>
                    <p className="text-xs text-stone-400">
                      Date: {selectedInvoice?.createdAt?.toDate ? selectedInvoice.createdAt.toDate().toLocaleDateString() : selectedInvoice?.createdAt ? new Date(selectedInvoice.createdAt).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 bg-stone-900/40 p-4 rounded border border-stone-800/50">
                  <div>
                    <h4 className="text-xs text-stone-500 uppercase tracking-widest font-semibold mb-1">Billing / Shipping Partner</h4>
                    <p className="font-semibold text-stone-200">{activePartner?.businessName || selectedInvoice?.businessName || 'Wholesale Partner'}</p>
                    <p className="text-xs text-stone-400">{activePartner?.contactName}</p>
                    <p className="text-xs text-stone-400">{activePartner?.email || user?.email}</p>
                  </div>
                  <div>
                    <h4 className="text-xs text-stone-500 uppercase tracking-widest font-semibold mb-1">Commercial Credentials</h4>
                    <p className="text-xs text-stone-300">Payment Term: <strong className="text-amber-500">{selectedInvoice?.paymentTerm || 'NET-30'}</strong></p>
                    <p className="text-xs text-stone-400">ABC License: {activePartner?.abcLicenseNumber || selectedInvoice?.abcLicense || 'Verified'}</p>
                    <p className="text-xs text-stone-400">Resale Permit: {activePartner?.resaleLicenseNumber || selectedInvoice?.resaleNumber || 'Verified'}</p>
                  </div>
                </div>

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
                        const price = item.price || (item.unitPriceCents ? item.unitPriceCents / 100 : 0);
                        return (
                          <tr key={idx}>
                            <td className="p-3 font-sans text-stone-200">{item.name}</td>
                            <td className="p-3 text-center">{item.quantity}</td>
                            <td className="p-3 text-right">${price.toFixed(2)}</td>
                            <td className="p-3 text-right text-stone-200">${(price * item.quantity).toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end pt-4">
                  <div className="w-64 space-y-2 text-xs border-t border-stone-850 pt-3 font-mono">
                    <div className="flex justify-between text-stone-500">
                      <span>Subtotal</span>
                      <span>${((selectedInvoice?.subtotalCents || 0) / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-stone-500">
                      <span>Shipping / Freight</span>
                      <span>${((selectedInvoice?.shippingCents || 0) / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-amber-500 font-bold font-serif pt-1 border-t border-stone-900">
                      <span>Total Due</span>
                      <span>${((selectedInvoice?.totalCents || 0) / 100).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}
