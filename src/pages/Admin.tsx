import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Lock, KeyRound, ShieldAlert, CheckCircle2, DollarSign, 
  FileText, Download, RefreshCw, Building2, Users, Package, 
  Settings, ExternalLink, ChevronRight, Search, Filter, 
  AlertTriangle, Truck, Clock, ArrowUpRight, Check, X,
  Printer, CreditCard, ChevronDown, Plus, Trash2, Eye, Sparkles, Mail, PauseCircle, Send
} from 'lucide-react';
import { useAdminStore } from '../store/adminStore';
import { LiveLabelAdmin } from '../components/Admin/LiveLabelAdmin';

interface AccountingOrder {
  id: string;
  orderId: string;
  source: 'shop_cart_order' | 'wholesale' | 'pos' | 'club';
  status: 'paid' | 'unpaid' | 'pending' | 'fulfilled' | 'cancelled' | 'refunded';
  paymentMethod: string;
  customerName: string;
  customerEmail: string;
  items: Array<{ name: string; quantity: number; price: number; formattedType?: string }>;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  createdAt: string;
  shippingAddress?: any;
  poNumber?: string;
  notes?: string;
  paymentNote?: string;
}

interface WholesalePartner {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  businessType: string;
  type?: string;
  abcLicenseNumber: string;
  resaleLicenseNumber: string;
  taxId?: string;
  docsSubmitted?: boolean;
  status: 'lead' | 'pending' | 'hold' | 'approved' | 'rejected';
  net30Status: 'none' | 'requested' | 'approved' | 'denied';
  creditLimit: number;
  createdAt: string;
}

interface ClubMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  tier: string;
  deliveryPreference: string;
  status: string;
  billingFrequency: string;
  createdAt: string;
}

interface AccountingSummary {
  totalGrossRevenue: number;
  totalStripeRevenue: number;
  totalWholesaleRevenue: number;
  totalWholesaleReceivables: number;
  totalPosRevenue: number;
  totalOrdersCount: number;
  totalWholesalePartners: number;
  totalClubMembers: number;
}

export default function AdminPage() {
  const navigate = useNavigate();
  const { 
    shopProducts, 
    setShopProduct, 
    addShopProduct, 
    deleteShopProduct,
    wholesaleSettings,
    setWholesaleSettings,
    clubSettings,
    setClubSettings,
    homeSettings,
    setHomeSettings,
    shopSettings,
    setShopSettings,
    saveToFirebase
  } = useAdminStore();

  // Authentication states
  const [passcode, setPasscode] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');

  // Active tab in Admin Suite
  const [activeTab, setActiveTab] = useState<'accounting' | 'wholesale' | 'club' | 'inventory' | 'cms' | 'livelabels'>('accounting');

  // Accounting data from API
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<AccountingSummary>({
    totalGrossRevenue: 0,
    totalStripeRevenue: 0,
    totalWholesaleRevenue: 0,
    totalWholesaleReceivables: 0,
    totalPosRevenue: 0,
    totalOrdersCount: 0,
    totalWholesalePartners: 0,
    totalClubMembers: 0
  });
  const [orders, setOrders] = useState<AccountingOrder[]>([]);
  const [wholesalePartners, setWholesalePartners] = useState<WholesalePartner[]>([]);
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([]);

  // Filtering & Search
  const [channelFilter, setChannelFilter] = useState<'all' | 'shop_cart_order' | 'wholesale' | 'pos' | 'club'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid' | 'pending' | 'fulfilled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<AccountingOrder | null>(null);

  // Status update states
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');
  const [cmsSaveLoading, setCmsSaveLoading] = useState(false);
  const [testEmailLoading, setTestEmailLoading] = useState(false);

  // Check saved session auth on mount
  useEffect(() => {
    const savedPin = sessionStorage.getItem('godley_admin_pin');
    const validPin = clubSettings.portalPasscode || '1234';
    if (savedPin === '1234' || (savedPin && savedPin === validPin)) {
      setIsAuthenticated(true);
      fetchAccountingData();
    }
  }, [clubSettings.portalPasscode]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const validPin = clubSettings.portalPasscode || '1234';
    if (passcode.trim() === '1234' || passcode.trim() === validPin) {
      sessionStorage.setItem('godley_admin_pin', passcode.trim());
      setIsAuthenticated(true);
      fetchAccountingData();
    } else {
      setAuthError('Invalid Security Passcode. Default owner access is 1234.');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('godley_admin_pin');
    setIsAuthenticated(false);
    setPasscode('');
  };

  const fetchAccountingData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/accounting-data');
      if (!res.ok) throw new Error('Failed to fetch data');
      const data = await res.json();
      if (data.success) {
        setSummary(data.summary);
        setOrders(data.orders || []);
        setWholesalePartners(data.wholesalePartners || []);
        setClubMembers(data.clubMembers || []);
      }
    } catch (err: any) {
      console.warn('Accounting API failed, using client sample state:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOrderStatus = async (orderDocId: string, newStatus: string, paymentNote?: string) => {
    setUpdatingOrderId(orderDocId);
    try {
      const res = await fetch('/api/admin/accounting/update-order-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderDocId, newStatus, paymentNote })
      });
      if (!res.ok) throw new Error('Status update failed');
      
      // Update local state immediately
      setOrders(prev => prev.map(o => o.id === orderDocId ? { ...o, status: newStatus as any, paymentNote } : o));
      if (selectedOrder && selectedOrder.id === orderDocId) {
        setSelectedOrder(prev => prev ? { ...prev, status: newStatus as any, paymentNote } : null);
      }
      
      setActionSuccessMsg(`Order ${orderDocId} marked as ${newStatus.toUpperCase()}`);
      setTimeout(() => setActionSuccessMsg(''), 4000);
      fetchAccountingData();
    } catch (err: any) {
      alert(`Error updating order: ${err.message}`);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleUpdatePartner = async (partnerDocId: string, status?: string, net30Status?: string, creditLimit?: number) => {
    try {
      const res = await fetch('/api/admin/wholesale/update-partner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerDocId, status, net30Status, creditLimit })
      });
      if (!res.ok) throw new Error('Partner update failed');
      
      setWholesalePartners(prev => prev.map(p => {
        if (p.id === partnerDocId) {
          return {
            ...p,
            ...(status ? { status: status as any } : {}),
            ...(net30Status ? { net30Status: net30Status as any } : {}),
            ...(typeof creditLimit === 'number' ? { creditLimit } : {})
          };
        }
        return p;
      }));
      setActionSuccessMsg('Wholesale distributor records updated successfully.');
      setTimeout(() => setActionSuccessMsg(''), 4000);
    } catch (err: any) {
      alert(`Failed to update partner: ${err.message}`);
    }
  };

  const handleSaveCMS = async () => {
    setCmsSaveLoading(true);
    try {
      await saveToFirebase();
      setActionSuccessMsg('Storefront CMS & Inventory published to cloud successfully!');
      setTimeout(() => setActionSuccessMsg(''), 4000);
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
    } finally {
      setCmsSaveLoading(false);
    }
  };

  const handleSendTestWholesaleEmail = async () => {
    setTestEmailLoading(true);
    try {
      const res = await fetch('/api/admin/wholesale/test-action-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientEmail: wholesaleSettings.email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send test email');
      setActionSuccessMsg(
        data.simulated
          ? `Test approval email logged in simulation mode for ${data.recipient} (configure RESEND_API_KEY or SMTP to deliver live to Gmail).`
          : `Test approval email with Approve/Pending/Hold buttons sent to ${data.recipient}.`
      );
      setTimeout(() => setActionSuccessMsg(''), 6000);
    } catch (err: any) {
      alert(`Test email error: ${err.message}`);
    } finally {
      setTestEmailLoading(false);
    }
  };

  // Export Accounting Ledger to CSV
  const handleExportCSV = () => {
    if (orders.length === 0) {
      alert('No orders available to export.');
      return;
    }

    const headers = [
      'Order ID',
      'Date',
      'Channel',
      'Customer / Entity',
      'Email',
      'Payment Method',
      'Subtotal ($)',
      'Freight ($)',
      'Tax ($)',
      'Total ($)',
      'Status',
      'Notes'
    ];

    const rows = orders.map(o => [
      `"${o.orderId}"`,
      `"${new Date(o.createdAt).toLocaleString()}"`,
      `"${o.source}"`,
      `"${o.customerName.replace(/"/g, '""')}"`,
      `"${o.customerEmail}"`,
      `"${o.paymentMethod}"`,
      (o.subtotalCents / 100).toFixed(2),
      (o.shippingCents / 100).toFixed(2),
      (o.taxCents / 100).toFixed(2),
      (o.totalCents / 100).toFixed(2),
      `"${o.status}"`,
      `"${(o.notes || o.paymentNote || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Godley_Ciders_Accounting_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered orders list
  const filteredOrders = orders.filter(o => {
    if (channelFilter !== 'all' && o.source !== channelFilter) return false;
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = o.orderId.toLowerCase().includes(q);
      const matchName = o.customerName.toLowerCase().includes(q);
      const matchEmail = o.customerEmail.toLowerCase().includes(q);
      if (!matchId && !matchName && !matchEmail) return false;
    }
    return true;
  });

  // Print invoice modal handler
  const handlePrintInvoice = (order: AccountingOrder) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Godley Ciders Commercial Invoice - ${order.orderId}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #1c1917; max-width: 800px; margin: auto; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e7e5e4; padding-bottom: 20px; margin-bottom: 30px; }
            .brand { font-size: 24px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; color: #b45309; }
            .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase; background: #f5f5f4; }
            table { width: 100%; border-collapse: collapse; margin: 25px 0; }
            th { text-align: left; padding: 10px; border-bottom: 1px solid #e7e5e4; font-size: 11px; text-transform: uppercase; color: #78716c; }
            td { padding: 12px 10px; border-bottom: 1px solid #f5f5f4; font-size: 13px; }
            .total-table { width: 300px; margin-left: auto; margin-top: 20px; }
            .total-table td { padding: 6px 10px; }
            .grand-total { font-size: 16px; font-weight: bold; border-top: 2px solid #1c1917; color: #b45309; }
            .footer { margin-top: 50px; font-size: 11px; color: #a8a29e; text-align: center; border-top: 1px solid #e7e5e4; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="brand">Godley Ciders</div>
              <div style="font-size: 12px; color: #78716c; margin-top: 4px;">Placer County Heirloom Cidery • CA ABC Type 02 / 21</div>
              <div style="font-size: 12px; color: #78716c;">Auburn, California • billing@godleyciders.com</div>
            </div>
            <div style="text-align: right;">
              <h2 style="margin: 0; font-size: 20px;">INVOICE</h2>
              <div style="font-family: monospace; margin-top: 4px;">#${order.orderId}</div>
              <div style="font-size: 12px; color: #78716c; margin-top: 4px;">Date: ${new Date(order.createdAt).toLocaleDateString()}</div>
              <div style="margin-top: 6px;"><span class="badge">${order.status.toUpperCase()}</span></div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; margin-bottom: 25px; font-size: 13px;">
            <div>
              <strong>Billed To:</strong><br/>
              ${order.customerName}<br/>
              ${order.customerEmail}<br/>
              ${order.shippingAddress?.address ? `${order.shippingAddress.address}<br/>${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zip}` : ''}
            </div>
            <div style="text-align: right;">
              <strong>Terms:</strong> ${order.source === 'wholesale' ? 'NET-30 Trade Credit (EFT Mandate)' : 'Paid Online (Direct)'}<br/>
              <strong>Payment Method:</strong> ${order.paymentMethod.toUpperCase()}<br/>
              ${order.poNumber ? `<strong>PO Number:</strong> ${order.poNumber}<br/>` : ''}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item Description</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Unit Price</th>
                <th style="text-align: right;">Line Total</th>
              </tr>
            </thead>
            <tbody>
              ${(order.items || []).map(i => `
                <tr>
                  <td><strong>${i.name}</strong> ${i.formattedType ? `<span style="color:#78716c; font-size:11px;">(${i.formattedType})</span>` : ''}</td>
                  <td style="text-align: center;">${i.quantity}</td>
                  <td style="text-align: right;">$${Number(i.price).toFixed(2)}</td>
                  <td style="text-align: right;">$${(Number(i.quantity) * Number(i.price)).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <table class="total-table">
            <tr>
              <td>Subtotal:</td>
              <td style="text-align: right;">$${(order.subtotalCents / 100).toFixed(2)}</td>
            </tr>
            <tr>
              <td>Freight / Logistics:</td>
              <td style="text-align: right;">$${(order.shippingCents / 100).toFixed(2)}</td>
            </tr>
            <tr>
              <td>Sales Tax (Excise Exempt B2B):</td>
              <td style="text-align: right;">$${(order.taxCents / 100).toFixed(2)}</td>
            </tr>
            <tr class="grand-total">
              <td>Total Due:</td>
              <td style="text-align: right;">$${(order.totalCents / 100).toFixed(2)}</td>
            </tr>
          </table>

          <div class="footer">
            Per California AB 2991 compliance: Wholesale alcohol balances must be settled via Electronic Funds Transfer (EFT).<br/>
            Thank you for carrying and serving Godley Ciders!
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // If locked, render PIN Gate
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center p-6 font-serif">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-stone-900/80 border border-stone-800 p-8 rounded-xl shadow-2xl backdrop-blur-md relative overflow-hidden"
        >
          <div className="text-center space-y-4 mb-8">
            <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8 text-amber-500" />
            </div>
            <div>
              <h1 className="text-2xl uppercase tracking-[0.2em] text-amber-500 font-bold">Godley Executive Admin</h1>
              <p className="text-stone-400 text-xs font-sans mt-1">Direct Accounting, Order Verification & Wholesale Operations</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-5 font-sans">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-stone-400 font-semibold block mb-1.5">
                Admin Master PIN
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={passcode}
                  onChange={e => setPasscode(e.target.value)}
                  placeholder="Enter 4-digit passcode"
                  className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-lg p-3 text-stone-100 font-mono text-center tracking-[0.5em] text-lg focus:outline-none"
                  autoFocus
                />
                <KeyRound className="w-4 h-4 text-stone-500 absolute right-3 top-4" />
              </div>
              <p className="text-[10px] text-stone-500 mt-1.5 text-center">Owner pass: <code className="text-amber-400">1234</code></p>
            </div>

            {authError && (
              <div className="bg-red-950/40 border border-red-500/30 p-2.5 rounded text-red-400 text-xs text-center flex items-center justify-center gap-1.5">
                <AlertTriangle size={14} />
                {authError}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold uppercase tracking-widest text-xs rounded-lg transition-all shadow cursor-pointer"
            >
              Authorize Terminal Access
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-stone-800 text-center">
            <Link to="/home" className="text-stone-500 hover:text-stone-300 text-xs uppercase tracking-wider flex items-center justify-center gap-1">
              ← Return to Main Website
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 font-sans pb-24">
      {/* Top Bar with Status & Navigation */}
      <header className="sticky top-0 z-40 bg-stone-950/90 backdrop-blur-md border-b border-stone-850 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-serif font-bold text-amber-500 uppercase tracking-widest">
                  Godley Ciders Executive Admin & Accounting Suite
                </h1>
                <span className="text-[9px] bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono px-2 py-0.5 rounded-full uppercase">
                  Active
                </span>
              </div>
              <p className="text-[11px] text-stone-400">Live order verification, commercial invoices, wholesale verification & catalog</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Live Interactive Previews for Travis */}
            <button
              onClick={() => {
                sessionStorage.setItem('godley_demo_partner', 'true');
                navigate('/wholesale');
              }}
              className="px-3 py-1.5 bg-stone-900 hover:bg-amber-950/40 border border-stone-750 hover:border-amber-500/50 text-stone-200 hover:text-amber-400 text-[11px] font-semibold tracking-wider rounded flex items-center gap-1.5 transition-all cursor-pointer"
              title="See wholesale dashboard as an approved partner"
            >
              <Building2 size={13} className="text-amber-500" />
              Preview Wholesale Portal
            </button>

            <button
              onClick={() => {
                sessionStorage.setItem('godley_demo_club', 'true');
                navigate('/club');
              }}
              className="px-3 py-1.5 bg-stone-900 hover:bg-amber-950/40 border border-stone-750 hover:border-amber-500/50 text-stone-200 hover:text-amber-400 text-[11px] font-semibold tracking-wider rounded flex items-center gap-1.5 transition-all cursor-pointer"
              title="See club portal as an active member"
            >
              <Users size={13} className="text-amber-500" />
              Preview Club Portal
            </button>

            <Link
              to="/employee"
              className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 border border-stone-750 text-stone-300 text-[11px] font-semibold tracking-wider rounded flex items-center gap-1.5 transition-all"
            >
              Taproom POS
            </Link>

            <button
              onClick={handleLogout}
              className="px-3 py-1.5 border border-red-500/30 text-red-400 hover:bg-red-500/10 text-[11px] font-semibold tracking-wider rounded flex items-center gap-1.5 transition-all cursor-pointer"
            >
              Lock Terminal
            </button>
          </div>
        </div>

        {/* Action Success Toast */}
        <AnimatePresence>
          {actionSuccessMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-3 bg-emerald-950/40 border border-emerald-500/40 text-emerald-400 text-xs px-4 py-2 rounded-lg flex items-center gap-2 max-w-7xl mx-auto"
            >
              <CheckCircle2 size={14} />
              {actionSuccessMsg}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <div className="max-w-7xl mx-auto px-6 pt-8 space-y-8">
        {/* Navigation Tabs */}
        <div className="flex border-b border-stone-800 gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('accounting')}
            className={`px-5 py-2.5 text-xs font-semibold uppercase tracking-widest rounded-t-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'accounting'
                ? 'bg-stone-900 border-t-2 border-amber-500 text-amber-400 font-bold'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <DollarSign size={15} />
            Accounting & Orders ({orders.length})
          </button>

          <button
            onClick={() => setActiveTab('wholesale')}
            className={`px-5 py-2.5 text-xs font-semibold uppercase tracking-widest rounded-t-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'wholesale'
                ? 'bg-stone-900 border-t-2 border-amber-500 text-amber-400 font-bold'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Building2 size={15} />
            Wholesale Partners ({wholesalePartners.length})
          </button>

          <button
            onClick={() => setActiveTab('club')}
            className={`px-5 py-2.5 text-xs font-semibold uppercase tracking-widest rounded-t-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'club'
                ? 'bg-stone-900 border-t-2 border-amber-500 text-amber-400 font-bold'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Users size={15} />
            Club Registry ({clubMembers.length})
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-5 py-2.5 text-xs font-semibold uppercase tracking-widest rounded-t-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'inventory'
                ? 'bg-stone-900 border-t-2 border-amber-500 text-amber-400 font-bold'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Package size={15} />
            Catalog & Live Stock ({shopProducts.length})
          </button>

          <button
            onClick={() => setActiveTab('cms')}
            className={`px-5 py-2.5 text-xs font-semibold uppercase tracking-widest rounded-t-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'cms'
                ? 'bg-stone-900 border-t-2 border-amber-500 text-amber-400 font-bold'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Settings size={15} />
            Storefront Settings
          </button>

          <button
            onClick={() => setActiveTab('livelabels')}
            className={`px-5 py-2.5 text-xs font-semibold uppercase tracking-widest rounded-t-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'livelabels'
                ? 'bg-stone-900 border-t-2 border-amber-500 text-amber-400 font-bold'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Sparkles size={15} />
            Live Labels (AR)
          </button>
        </div>

        {/* TAB 1: ACCOUNTING & ORDERS */}
        {activeTab === 'accounting' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Financial KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-stone-900/60 border border-stone-800 p-5 rounded-xl">
                <span className="text-[10px] text-stone-500 uppercase tracking-widest font-mono font-bold block mb-1">Total Settled Revenue</span>
                <div className="text-2xl font-serif font-bold text-amber-400 font-mono">
                  ${summary.totalGrossRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-stone-400 mt-2 flex justify-between">
                  <span>Stripe Web: ${summary.totalStripeRevenue.toFixed(2)}</span>
                  <span>POS: ${summary.totalPosRevenue.toFixed(2)}</span>
                </div>
              </div>

              <div className="bg-stone-900/60 border border-stone-800 p-5 rounded-xl">
                <span className="text-[10px] text-stone-500 uppercase tracking-widest font-mono font-bold block mb-1">Wholesale Accounts Receivable</span>
                <div className="text-2xl font-serif font-bold text-stone-100 font-mono">
                  ${summary.totalWholesaleReceivables.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-[10px] text-amber-500/80 mt-2">Open Net-30 commercial trade invoices</p>
              </div>

              <div className="bg-stone-900/60 border border-stone-800 p-5 rounded-xl">
                <span className="text-[10px] text-stone-500 uppercase tracking-widest font-mono font-bold block mb-1">Total Orders Processed</span>
                <div className="text-2xl font-serif font-bold text-emerald-400 font-mono">
                  {summary.totalOrdersCount}
                </div>
                <p className="text-[10px] text-stone-400 mt-2">Across retail, wholesale, & taproom</p>
              </div>

              <div className="bg-stone-900/60 border border-stone-800 p-5 rounded-xl flex flex-col justify-between">
                <div>
                  <span className="text-[10px] text-stone-500 uppercase tracking-widest font-mono font-bold block mb-1">Accounting Export</span>
                  <p className="text-[11px] text-stone-300">Download formatted journal for QuickBooks & CPA</p>
                </div>
                <button
                  onClick={handleExportCSV}
                  className="mt-3 w-full py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold uppercase tracking-wider rounded flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Download size={13} />
                  Export Ledger (CSV)
                </button>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-stone-900/40 border border-stone-850 p-4 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2">
                  <Filter size={14} className="text-stone-500" />
                  <span className="text-[11px] text-stone-400 uppercase font-semibold">Channel:</span>
                  <select
                    value={channelFilter}
                    onChange={e => setChannelFilter(e.target.value as any)}
                    className="bg-stone-950 border border-stone-800 rounded px-2.5 py-1.5 text-xs text-stone-200 focus:outline-none"
                  >
                    <option value="all">All Channels</option>
                    <option value="shop_cart_order">Stripe Web Store</option>
                    <option value="wholesale">Wholesale B2B</option>
                    <option value="pos">Taproom POS</option>
                    <option value="club">Club Subscriptions</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-stone-400 uppercase font-semibold">Status:</span>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as any)}
                    className="bg-stone-950 border border-stone-800 rounded px-2.5 py-1.5 text-xs text-stone-200 focus:outline-none"
                  >
                    <option value="all">All Statuses</option>
                    <option value="paid">Paid</option>
                    <option value="unpaid">Unpaid (Net-30)</option>
                    <option value="fulfilled">Fulfilled</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by order ID, name, email..."
                    className="w-full bg-stone-950 border border-stone-800 rounded px-3 py-1.5 pl-8 text-xs text-stone-200 focus:border-amber-500 focus:outline-none"
                  />
                  <Search size={13} className="text-stone-500 absolute left-2.5 top-2.5" />
                </div>
                <button
                  onClick={fetchAccountingData}
                  disabled={loading}
                  className="p-1.5 bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-100 rounded cursor-pointer"
                  title="Refresh Orders"
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Orders Ledger Table */}
            <div className="border border-stone-850 rounded-xl overflow-hidden bg-stone-900/20">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-900/80 border-b border-stone-800 text-stone-400 uppercase font-mono text-[10px] tracking-wider">
                    <tr>
                      <th className="p-3.5">Order / ID</th>
                      <th className="p-3.5">Date</th>
                      <th className="p-3.5">Channel</th>
                      <th className="p-3.5">Customer / Distributor</th>
                      <th className="p-3.5">Items</th>
                      <th className="p-3.5 text-right">Total ($)</th>
                      <th className="p-3.5 text-center">Status</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-850">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-stone-500">
                          No matching orders found.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map(order => (
                        <tr key={order.id} className="hover:bg-stone-900/50 transition-colors">
                          <td className="p-3.5 font-mono font-semibold text-amber-500">
                            #{order.orderId}
                          </td>
                          <td className="p-3.5 text-stone-400 font-mono text-[11px]">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </td>
                          <td className="p-3.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                              order.source === 'wholesale' 
                                ? 'bg-amber-950/30 text-amber-400 border border-amber-500/20' 
                                : order.source === 'pos'
                                ? 'bg-purple-950/30 text-purple-400 border border-purple-500/20'
                                : 'bg-blue-950/30 text-blue-400 border border-blue-500/20'
                            }`}>
                              {order.source === 'wholesale' ? 'Wholesale B2B' : order.source === 'pos' ? 'Taproom POS' : 'Web Direct'}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <div className="font-semibold text-stone-200">{order.customerName}</div>
                            <div className="text-[10px] text-stone-500 font-mono">{order.customerEmail}</div>
                          </td>
                          <td className="p-3.5 text-stone-300">
                            <div className="max-w-xs truncate">
                              {(order.items || []).map(i => `${i.quantity}x ${i.name}`).join(', ') || 'Custom Cart Items'}
                            </div>
                          </td>
                          <td className="p-3.5 text-right font-mono font-bold text-stone-100">
                            ${(order.totalCents / 100).toFixed(2)}
                          </td>
                          <td className="p-3.5 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                              order.status === 'paid'
                                ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30'
                                : order.status === 'unpaid'
                                ? 'bg-amber-950/40 text-amber-400 border border-amber-500/30'
                                : order.status === 'fulfilled'
                                ? 'bg-blue-950/40 text-blue-400 border border-blue-500/30'
                                : 'bg-stone-800 text-stone-400'
                            }`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="p-3.5 text-right space-x-1.5">
                            <button
                              onClick={() => setSelectedOrder(order)}
                              className="px-2 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded text-[11px] cursor-pointer"
                              title="View Details"
                            >
                              Details
                            </button>
                            <button
                              onClick={() => handlePrintInvoice(order)}
                              className="px-2 py-1 bg-amber-950/30 hover:bg-amber-900/40 text-amber-400 border border-amber-500/30 rounded text-[11px] cursor-pointer"
                              title="Print Invoice"
                            >
                              <Printer size={12} className="inline mr-1" /> Invoice
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: WHOLESALE PARTNERS */}
        {activeTab === 'wholesale' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-wrap justify-between items-center gap-4">
              <div>
                <h3 className="text-lg font-serif font-bold text-amber-500 uppercase tracking-widest">
                  Wholesale Distributor Accounts & Licensing
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">Lead capture, California ABC Type 20/21 compliance review, and Net-30 credit allocations</p>
              </div>
              <button
                onClick={() => {
                  sessionStorage.setItem('godley_demo_partner', 'true');
                  navigate('/wholesale');
                }}
                className="px-4 py-2 bg-amber-500 text-stone-950 text-xs font-bold uppercase tracking-wider rounded flex items-center gap-1.5 cursor-pointer"
              >
                <Eye size={14} /> Open Live Partner Store
              </button>
            </div>

            {/* Wholesale Gmail Notification & Test Dispatch */}
            <div className="bg-stone-900/50 border border-stone-800 rounded-xl p-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="flex-1 space-y-1">
                <label className="text-[10px] text-amber-500 uppercase font-mono font-bold flex items-center gap-1.5">
                  <Mail size={12} /> Wholesale Approval Gmail Inbox
                </label>
                <p className="text-[11px] text-stone-400">
                  Signup leads and CA compliance doc submissions route here with one-click Approve, Pending, and Hold buttons.
                </p>
                <input
                  type="email"
                  value={wholesaleSettings.email}
                  onChange={e => setWholesaleSettings({ email: e.target.value })}
                  placeholder="wholesale@godleyciders.com"
                  className="w-full md:max-w-md bg-stone-950 border border-stone-800 text-stone-200 p-2 rounded text-xs font-mono mt-1.5"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSaveCMS}
                  disabled={cmsSaveLoading}
                  className="px-3.5 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold uppercase tracking-wider rounded cursor-pointer"
                >
                  {cmsSaveLoading ? 'Saving...' : 'Save Inbox'}
                </button>
                <button
                  type="button"
                  onClick={handleSendTestWholesaleEmail}
                  disabled={testEmailLoading}
                  className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500 text-amber-400 hover:text-stone-950 border border-amber-500/30 text-xs font-bold uppercase tracking-wider rounded flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <Send size={13} /> {testEmailLoading ? 'Dispatching...' : 'Send Test Approval Email'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {wholesalePartners.length === 0 ? (
                <div className="col-span-full p-8 text-center bg-stone-900/30 rounded-xl border border-stone-850 text-stone-500">
                  No registered wholesale inquiries yet. Direct wholesale inquiries submitted on /wholesale will populate here.
                </div>
              ) : (
                wholesalePartners.map(partner => {
                  const hasDocs = partner.docsSubmitted ?? Boolean(partner.abcLicenseNumber || partner.resaleLicenseNumber);
                  const statusBadgeStyle =
                    partner.status === 'approved'
                      ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30'
                      : partner.status === 'hold'
                      ? 'bg-red-950/40 text-red-400 border border-red-500/30'
                      : partner.status === 'lead'
                      ? 'bg-blue-950/40 text-blue-300 border border-blue-500/30'
                      : 'bg-amber-950/40 text-amber-400 border border-amber-500/30';
                  const statusLabel =
                    partner.status === 'lead'
                      ? 'LEAD - NO DOCS'
                      : partner.status.toUpperCase();

                  return (
                    <div key={partner.id} className="bg-stone-900/60 border border-stone-850 p-5 rounded-xl space-y-4">
                      <div className="flex justify-between items-start border-b border-stone-800 pb-3 gap-2">
                        <div>
                          <h4 className="font-serif font-bold text-stone-100 text-sm">{partner.businessName}</h4>
                          <span className="text-[10px] text-stone-500 uppercase font-mono">{partner.businessType || partner.type || 'Retail / Hospitality'}</span>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${statusBadgeStyle}`}>
                            {statusLabel}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase ${
                            hasDocs
                              ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-500/20'
                              : 'bg-stone-950 text-stone-400 border border-stone-800'
                          }`}>
                            {hasDocs ? 'Docs Submitted' : 'No Docs Yet'}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs font-mono text-stone-400">
                        <div className="flex justify-between gap-2"><span>Contact:</span> <strong className="text-stone-300 text-right">{partner.contactName}</strong></div>
                        <div className="flex justify-between gap-2"><span>Email:</span> <span className="text-stone-300 text-right break-all">{partner.email}</span></div>
                        <div className="flex justify-between gap-2"><span>Phone:</span> <span className="text-stone-300 text-right">{partner.phone || '—'}</span></div>
                        <div className="flex justify-between gap-2"><span>ABC License #:</span> <strong className={partner.abcLicenseNumber ? 'text-amber-400' : 'text-stone-600'}>{partner.abcLicenseNumber || 'Not submitted yet'}</strong></div>
                        <div className="flex justify-between gap-2"><span>Resale Permit:</span> <span className={partner.resaleLicenseNumber ? 'text-stone-300' : 'text-stone-600'}>{partner.resaleLicenseNumber || 'Not submitted yet'}</span></div>
                        {partner.taxId && (
                          <div className="flex justify-between gap-2"><span>Tax ID / EIN:</span> <span className="text-stone-300">{partner.taxId}</span></div>
                        )}
                        <div className="flex justify-between border-t border-stone-800/80 pt-1.5 mt-1.5">
                          <span>NET-30 Terms:</span> 
                          <strong className={partner.net30Status === 'approved' ? 'text-emerald-400 uppercase' : 'text-amber-500 uppercase'}>
                            {partner.net30Status || 'none'}
                          </strong>
                        </div>
                      </div>

                      <div className="border-t border-stone-800 pt-3 space-y-2">
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleUpdatePartner(partner.id, 'approved')}
                            disabled={partner.status === 'approved'}
                            className={`py-1.5 text-[11px] font-bold uppercase tracking-wider rounded cursor-pointer transition-all ${
                              partner.status === 'approved'
                                ? 'bg-emerald-950/40 text-emerald-500 border border-emerald-500/30 cursor-default'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-stone-950'
                            }`}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdatePartner(partner.id, 'pending')}
                            disabled={partner.status === 'pending'}
                            className={`py-1.5 text-[11px] font-bold uppercase tracking-wider rounded cursor-pointer transition-all border ${
                              partner.status === 'pending'
                                ? 'bg-amber-950/40 text-amber-400 border-amber-500/40 cursor-default'
                                : 'border-amber-500/30 text-amber-400 hover:bg-amber-500 hover:text-stone-950'
                            }`}
                          >
                            Pending
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdatePartner(partner.id, 'hold')}
                            disabled={partner.status === 'hold'}
                            className={`py-1.5 text-[11px] font-bold uppercase tracking-wider rounded cursor-pointer transition-all border flex items-center justify-center gap-1 ${
                              partner.status === 'hold'
                                ? 'bg-red-950/40 text-red-400 border-red-500/40 cursor-default'
                                : 'border-red-500/30 text-red-400 hover:bg-red-600 hover:text-stone-950'
                            }`}
                          >
                            <PauseCircle size={12} /> Hold
                          </button>
                        </div>

                        {partner.net30Status !== 'approved' && (
                          <button
                            type="button"
                            onClick={() => handleUpdatePartner(partner.id, undefined, 'approved')}
                            className="w-full py-1.5 px-3 bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500 hover:text-stone-950 font-bold text-[11px] uppercase tracking-wider rounded cursor-pointer transition-all"
                          >
                            Grant Net-30 Credit Terms
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 3: CLUB REGISTRY */}
        {activeTab === 'club' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-serif font-bold text-amber-500 uppercase tracking-widest">
                  Charter Club Members Registry
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">Pre-sale waitlist holds, vaulted cards, and allocation tiers</p>
              </div>
              <button
                onClick={() => {
                  sessionStorage.setItem('godley_demo_club', 'true');
                  navigate('/club');
                }}
                className="px-4 py-2 bg-amber-500 text-stone-950 text-xs font-bold uppercase tracking-wider rounded flex items-center gap-1.5 cursor-pointer"
              >
                <Eye size={14} /> Open Member Passport View
              </button>
            </div>

            <div className="border border-stone-850 rounded-xl overflow-hidden bg-stone-900/20">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-900/80 border-b border-stone-800 text-stone-400 uppercase font-mono text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3.5">Member Name</th>
                    <th className="p-3.5">Email</th>
                    <th className="p-3.5">Tier</th>
                    <th className="p-3.5">Billing Cadence</th>
                    <th className="p-3.5">Fulfillment</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right">Enrolled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-850">
                  {clubMembers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-stone-500">
                        No club signups registered yet.
                      </td>
                    </tr>
                  ) : (
                    clubMembers.map(member => (
                      <tr key={member.id} className="hover:bg-stone-900/40">
                        <td className="p-3.5 font-semibold text-stone-100">{member.name}</td>
                        <td className="p-3.5 text-stone-400 font-mono">{member.email}</td>
                        <td className="p-3.5 font-serif font-semibold text-amber-400">{member.tier}</td>
                        <td className="p-3.5 uppercase font-mono text-[11px] text-stone-400">{member.billingFrequency}</td>
                        <td className="p-3.5 uppercase font-mono text-[11px] text-stone-400">{member.deliveryPreference}</td>
                        <td className="p-3.5 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950/40 text-emerald-400 border border-emerald-500/30">
                            {member.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-right text-stone-500 font-mono text-[11px]">
                          {new Date(member.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: CATALOG & LIVE STOCK */}
        {activeTab === 'inventory' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center border-b border-stone-850 pb-4">
              <div>
                <h3 className="text-lg font-serif font-bold text-amber-500 uppercase tracking-widest">
                  Active Shop Catalog & Live Inventory Counts
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">Live stock updates immediately sync to the online web store and Taproom POS.</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    addShopProduct({
                      name: "New Vintage Cider",
                      type: "Heritage Cider",
                      description: "Estate harvest cider, fermented cold.",
                      price: 24,
                      image: "/assets/ciders/(store)The_knowedge.webp",
                      available: true,
                      category: "cider",
                      inventoryCount: 48
                    });
                  }}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold uppercase tracking-wider rounded flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus size={13} /> Add Cider
                </button>
                <button
                  type="button"
                  onClick={() => {
                    addShopProduct({
                      name: "Godley Cellar Gear",
                      type: "Merchandise",
                      description: "Handcrafted merchandise for patrons.",
                      price: 32,
                      image: "/assets/Merchandise /T-shirt.png",
                      available: true,
                      category: "merch",
                      inventoryCount: 25
                    });
                  }}
                  className="px-3 py-1.5 border border-stone-700 hover:border-amber-500 text-stone-300 hover:text-amber-400 text-xs font-bold uppercase tracking-wider rounded flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus size={13} /> Add Merch
                </button>
                <button
                  onClick={handleSaveCMS}
                  disabled={cmsSaveLoading}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-stone-950 text-xs font-bold uppercase tracking-wider rounded flex items-center gap-1.5 cursor-pointer"
                >
                  <Check size={13} /> {cmsSaveLoading ? 'Saving...' : 'Save to Cloud'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {shopProducts.map((prod, pIndex) => (
                <div key={prod.id || pIndex} className="bg-stone-900/50 border border-stone-850 p-4 rounded-xl space-y-3">
                  <div className="flex justify-between items-center border-b border-stone-800 pb-2">
                    <div className="flex items-center gap-2.5">
                      {prod.image && (
                        <img 
                          src={prod.image} 
                          alt={prod.name} 
                          className="w-9 h-9 object-contain rounded bg-stone-950 border border-stone-800 p-0.5" 
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                      )}
                      <span className="text-amber-500 text-xs font-serif font-bold uppercase tracking-wider">{prod.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-stone-400 flex items-center gap-1 cursor-pointer">
                        Active:
                        <input
                          type="checkbox"
                          checked={prod.available}
                          onChange={e => setShopProduct(pIndex, { available: e.target.checked })}
                          className="accent-amber-500"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => { if (window.confirm(`Delete product "${prod.name}"?`)) deleteShopProduct(pIndex); }}
                        className="text-stone-500 hover:text-red-400 p-1"
                        title="Delete Product"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-[10px] text-stone-500 uppercase font-mono">Product Name</label>
                      <input
                        type="text"
                        value={prod.name}
                        onChange={e => setShopProduct(pIndex, { name: e.target.value })}
                        className="w-full bg-stone-950 border border-stone-800 text-stone-200 p-1.5 rounded"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-500 uppercase font-mono">Category</label>
                      <select
                        value={prod.category || 'cider'}
                        onChange={e => setShopProduct(pIndex, { category: e.target.value as any })}
                        className="w-full bg-stone-950 border border-stone-800 text-stone-200 p-1.5 rounded"
                      >
                        <option value="cider">Liquid Class (Cider)</option>
                        <option value="merch">Dry Class (Merch)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="text-[10px] text-stone-500 uppercase font-mono">Subtitle / Vintage</label>
                      <input
                        type="text"
                        value={prod.type}
                        onChange={e => setShopProduct(pIndex, { type: e.target.value })}
                        className="w-full bg-stone-950 border border-stone-800 text-stone-200 p-1.5 rounded"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-500 uppercase font-mono">Price ($)</label>
                      <input
                        type="number"
                        value={prod.price}
                        onChange={e => setShopProduct(pIndex, { price: Number(e.target.value) })}
                        className="w-full bg-stone-950 border border-stone-800 text-amber-400 p-1.5 rounded font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-500 uppercase font-mono font-bold text-amber-400">In Stock Count</label>
                      <input
                        type="number"
                        value={prod.inventoryCount ?? 20}
                        onChange={e => setShopProduct(pIndex, { inventoryCount: Number(e.target.value) })}
                        className="w-full bg-stone-950 border border-stone-800 text-amber-400 p-1.5 rounded font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div className="text-xs">
                    <label className="text-[10px] text-stone-500 uppercase font-mono">Image URL or Asset Path</label>
                    <input
                      type="text"
                      value={prod.image}
                      onChange={e => setShopProduct(pIndex, { image: e.target.value })}
                      className="w-full bg-stone-950 border border-stone-800 text-stone-300 p-1.5 rounded font-mono text-[10px]"
                    />
                  </div>

                  <div className="text-xs">
                    <label className="text-[10px] text-stone-500 uppercase font-mono">Product Description</label>
                    <textarea
                      rows={2}
                      value={prod.description || ''}
                      onChange={e => setShopProduct(pIndex, { description: e.target.value })}
                      className="w-full bg-stone-950 border border-stone-800 text-stone-300 p-1.5 rounded text-xs focus:border-amber-500 outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: CMS STOREFRONT SETTINGS */}
        {activeTab === 'cms' && (
          <div className="space-y-6 max-w-4xl animate-fadeIn">
            <div className="flex justify-between items-center border-b border-stone-850 pb-4">
              <div>
                <h3 className="text-lg font-serif font-bold text-amber-500 uppercase tracking-widest">
                  Storefront & Brand CMS Settings
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">Edit store headlines, wholesale terms copy, and club descriptions</p>
              </div>
              <button
                onClick={handleSaveCMS}
                disabled={cmsSaveLoading}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-bold text-xs uppercase tracking-wider rounded cursor-pointer"
              >
                {cmsSaveLoading ? 'Publishing...' : 'Save All Settings'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="bg-stone-900/50 border border-stone-850 p-4 rounded-xl space-y-3">
                <h4 className="font-serif font-bold text-amber-500 uppercase tracking-wider">Online Shop Headlines</h4>
                <div>
                  <label className="text-[10px] text-stone-500 uppercase font-mono">Title</label>
                  <input
                    type="text"
                    value={shopSettings.title}
                    onChange={e => setShopSettings({ title: e.target.value })}
                    className="w-full bg-stone-950 border border-stone-800 text-stone-200 p-2 rounded"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-stone-500 uppercase font-mono">Subtitle</label>
                  <textarea
                    value={shopSettings.subtitle}
                    onChange={e => setShopSettings({ subtitle: e.target.value })}
                    rows={3}
                    className="w-full bg-stone-950 border border-stone-800 text-stone-200 p-2 rounded"
                  />
                </div>
              </div>

              <div className="bg-stone-900/50 border border-stone-850 p-4 rounded-xl space-y-3">
                <h4 className="font-serif font-bold text-amber-500 uppercase tracking-wider">Wholesale Portal Headlines & Inbox</h4>
                <div>
                  <label className="text-[10px] text-stone-500 uppercase font-mono">Title</label>
                  <input
                    type="text"
                    value={wholesaleSettings.title}
                    onChange={e => setWholesaleSettings({ title: e.target.value })}
                    className="w-full bg-stone-950 border border-stone-800 text-stone-200 p-2 rounded"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-stone-500 uppercase font-mono">Wholesale Approval Gmail</label>
                  <input
                    type="email"
                    value={wholesaleSettings.email}
                    onChange={e => setWholesaleSettings({ email: e.target.value })}
                    className="w-full bg-stone-950 border border-stone-800 text-stone-200 p-2 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-stone-500 uppercase font-mono">Subtitle</label>
                  <textarea
                    value={wholesaleSettings.subtitle}
                    onChange={e => setWholesaleSettings({ subtitle: e.target.value })}
                    rows={3}
                    className="w-full bg-stone-950 border border-stone-800 text-stone-200 p-2 rounded"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: AR LIVE LABELS & QR DISPATCHER */}
        {activeTab === 'livelabels' && (
          <LiveLabelAdmin passcode={passcode || sessionStorage.getItem('godley_admin_pin') || '1234'} />
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 w-full max-w-2xl rounded-xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-stone-800 pb-3">
              <div>
                <h3 className="font-serif font-bold text-amber-500 text-lg uppercase tracking-wider">
                  Order #{selectedOrder.orderId}
                </h3>
                <span className="text-[11px] text-stone-400 font-mono">
                  Placed on {new Date(selectedOrder.createdAt).toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-stone-400 hover:text-stone-100 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-mono bg-stone-950 p-4 rounded-lg border border-stone-850">
              <div>
                <span className="text-stone-500 block">Customer / Business:</span>
                <strong className="text-stone-200">{selectedOrder.customerName}</strong>
                <div className="text-stone-400">{selectedOrder.customerEmail}</div>
              </div>
              <div>
                <span className="text-stone-500 block">Payment / Terms:</span>
                <strong className="text-stone-200">{selectedOrder.paymentMethod.toUpperCase()}</strong>
                <div className="text-stone-400">Channel: {selectedOrder.source}</div>
              </div>
            </div>

            {/* Line Items */}
            <div>
              <h4 className="text-xs uppercase tracking-wider font-semibold text-stone-400 mb-2 font-mono">Order Line Items</h4>
              <div className="border border-stone-850 rounded divide-y divide-stone-850 text-xs">
                {(selectedOrder.items || []).map((item, idx) => (
                  <div key={idx} className="p-2.5 flex justify-between items-center">
                    <div>
                      <strong className="text-stone-200">{item.name}</strong>
                      {item.formattedType && <span className="text-stone-500 text-[10px] ml-2">({item.formattedType})</span>}
                    </div>
                    <div className="font-mono">
                      <span className="text-stone-400 mr-4">{item.quantity}x @ ${Number(item.price).toFixed(2)}</span>
                      <strong className="text-stone-100">${(item.quantity * item.price).toFixed(2)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-stone-950 p-3.5 rounded border border-stone-850 space-y-1 text-xs font-mono">
              <div className="flex justify-between text-stone-400"><span>Subtotal:</span> <span>${(selectedOrder.subtotalCents / 100).toFixed(2)}</span></div>
              <div className="flex justify-between text-stone-400"><span>Logistics / Freight:</span> <span>${(selectedOrder.shippingCents / 100).toFixed(2)}</span></div>
              <div className="flex justify-between text-stone-400"><span>Tax (Excise Exempt):</span> <span>${(selectedOrder.taxCents / 100).toFixed(2)}</span></div>
              <div className="flex justify-between text-amber-400 font-bold text-sm pt-2 border-t border-stone-800">
                <span>Grand Total:</span> 
                <span>${(selectedOrder.totalCents / 100).toFixed(2)}</span>
              </div>
            </div>

            {/* Verification Actions */}
            <div className="border-t border-stone-800 pt-4 flex flex-wrap justify-between items-center gap-3">
              <button
                onClick={() => handlePrintInvoice(selectedOrder)}
                className="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer size={13} /> Print Invoice
              </button>

              <div className="flex gap-2">
                {selectedOrder.status !== 'paid' && (
                  <button
                    onClick={() => handleUpdateOrderStatus(selectedOrder.id, 'paid', 'Verified paid via EFT / Direct Wire')}
                    disabled={updatingOrderId === selectedOrder.id}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-bold text-xs uppercase tracking-wider rounded cursor-pointer"
                  >
                    Mark Invoice as Paid
                  </button>
                )}

                {selectedOrder.status !== 'fulfilled' && (
                  <button
                    onClick={() => handleUpdateOrderStatus(selectedOrder.id, 'fulfilled')}
                    disabled={updatingOrderId === selectedOrder.id}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-stone-950 font-bold text-xs uppercase tracking-wider rounded cursor-pointer"
                  >
                    <Truck size={13} className="inline mr-1" /> Mark Dispatched
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
