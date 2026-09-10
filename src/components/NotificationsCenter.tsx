import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { 
  Bell, Mail, Send, CheckCircle2, AlertCircle, Clock, 
  CreditCard, UserCheck, ShoppingBag, RefreshCw, Eye, Trash2, ShieldCheck, CheckCheck
} from 'lucide-react';

interface NotificationItem {
  id: string;
  type?: string;
  title?: string;
  recipient?: string;
  customerName?: string;
  email?: string;
  phone?: string;
  tier?: string;
  billingFrequency?: string;
  cardLast4?: string;
  ticketNumber?: string | number;
  totalAmount?: number;
  message?: string;
  read?: boolean;
  createdAt?: any;
}

interface EmailLogItem {
  id: string;
  to: string;
  from?: string;
  subject: string;
  textPreview?: string;
  fullText?: string;
  status: 'delivered' | 'simulated' | 'failed';
  provider: string;
  errorMessage?: string;
  category?: string;
  createdAt?: any;
}

export default function NotificationsCenter() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLogItem[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'alerts' | 'emails' | 'test'>('alerts');
  const [loading, setLoading] = useState(true);
  
  // Test email state
  const [testEmail, setTestEmail] = useState('billing@godleyciders.com');
  const [testingStatus, setTestingStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [testResult, setTestResult] = useState<any>(null);

  // Email Server Status
  const [emailServerStatus, setEmailServerStatus] = useState<any>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // Selected email view modal
  const [selectedEmail, setSelectedEmail] = useState<EmailLogItem | null>(null);

  const fetchEmailStatus = async () => {
    setStatusLoading(true);
    try {
      const res = await fetch('/api/email/status');
      if (res.ok) {
        const data = await res.json();
        setEmailServerStatus(data);
      }
    } catch (e) {
      console.warn("Failed to fetch email status:", e);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    fetchEmailStatus();

    // 1. Real-time Notifications Listener
    const qNotifs = query(collection(db, 'admin_notifications'), orderBy('createdAt', 'desc'));
    const unsubNotifs = onSnapshot(qNotifs, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NotificationItem)));
      setLoading(false);
    }, (err) => {
      console.warn("Notifications subscription error:", err);
      setLoading(false);
    });

    // 2. Real-time Email Logs Listener
    const qEmails = query(collection(db, 'email_logs'), orderBy('createdAt', 'desc'));
    const unsubEmails = onSnapshot(qEmails, (snapshot) => {
      setEmailLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmailLogItem)));
    }, (err) => {
      console.warn("Email logs subscription error:", err);
    });

    return () => {
      unsubNotifs();
      unsubEmails();
    };
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'admin_notifications', id), { read: true });
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const batch = writeBatch(db);
      notifications.filter(n => !n.read).forEach(n => {
        batch.update(doc(db, 'admin_notifications', n.id), { read: true });
      });
      await batch.commit();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteNotif = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'admin_notifications', id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestingStatus('sending');
    setTestResult(null);
    try {
      const res = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetEmail: testEmail })
      });
      const data = await res.json();
      setTestResult(data);
      if (res.ok && data.success) {
        setTestingStatus('success');
      } else {
        setTestingStatus('error');
      }
      fetchEmailStatus();
    } catch (err: any) {
      setTestingStatus('error');
      setTestResult({ error: err.message });
    }
  };

  const handleResendLog = async (log: EmailLogItem) => {
    if (!window.confirm(`Re-send this email message to ${log.to}?`)) return;
    try {
      const res = await fetch('/api/email/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: log.to,
          subject: log.subject,
          text: log.fullText || log.textPreview || '',
          category: 'manual_resend'
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`Email successfully re-dispatched to ${log.to}!`);
      } else {
        alert(`Dispatch notice: ${data.status || data.error || 'Check server settings'}`);
      }
    } catch (e: any) {
      alert(`Failed to resend: ${e.message}`);
    }
  };

  return (
    <div className="space-y-6 font-sans text-left">
      
      {/* Top Overview & Sub-tab Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-serif font-bold text-stone-100 uppercase tracking-widest flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-500" /> Notifications & Email Dispatch Hub
            </h2>
            {unreadCount > 0 && (
              <span className="bg-red-500/20 text-red-400 border border-red-500/40 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full animate-pulse">
                {unreadCount} UNREAD ALERT{unreadCount > 1 ? 'S' : ''}
              </span>
            )}
          </div>
          <p className="text-xs text-stone-400 mt-1">
            Real-time activity monitor for cider release spot holds, club waitlist memberships, and dispatched customer confirmation emails.
          </p>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-1.5 bg-stone-900/80 border border-stone-800 p-1 rounded-lg">
          <button
            onClick={() => setActiveSubTab('alerts')}
            className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === 'alerts'
                ? 'bg-amber-500 text-stone-950 shadow-sm'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Bell size={13} />
            Alerts
            {unreadCount > 0 && (
              <span className="bg-stone-950 text-amber-400 text-[9px] font-mono px-1.5 py-0.2 rounded-full font-black">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('emails')}
            className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === 'emails'
                ? 'bg-amber-500 text-stone-950 shadow-sm'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Mail size={13} />
            Email Logs ({emailLogs.length})
          </button>

          <button
            onClick={() => setActiveSubTab('test')}
            className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === 'test'
                ? 'bg-amber-500 text-stone-950 shadow-sm'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Send size={13} />
            Email Diagnostics & Test
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: LIVE ALERTS */}
      {activeSubTab === 'alerts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-stone-400 uppercase tracking-wider font-bold">
              Real-time Inbound Activity Queue ({notifications.length} total)
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-amber-500 hover:text-amber-400 flex items-center gap-1 font-semibold cursor-pointer"
              >
                <CheckCheck size={14} /> Mark all as read
              </button>
            )}
          </div>

          {loading ? (
            <div className="text-xs text-stone-500 p-8 text-center">Listening for real-time alerts...</div>
          ) : notifications.length === 0 ? (
            <div className="bg-stone-900/30 border border-stone-850 p-8 rounded-xl text-center space-y-2">
              <ShieldCheck className="w-8 h-8 text-emerald-500/60 mx-auto" />
              <p className="text-sm font-semibold text-stone-300">All caught up! No recent alerts.</p>
              <p className="text-xs text-stone-500 max-w-md mx-auto">
                When prospective members hold their spot for a cider release or join the club waitlist, an instant alert will display right here.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
              {notifications.map((n) => {
                const isClub = n.type?.includes('club');
                const isShop = n.type?.includes('shop') || n.type?.includes('reservation');
                
                return (
                  <div 
                    key={n.id}
                    className={`border rounded-xl p-4 transition-all space-y-3 ${
                      !n.read 
                        ? 'bg-amber-950/15 border-amber-500/40 shadow-sm' 
                        : 'bg-stone-900/30 border-stone-850 opacity-90'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg shrink-0 ${
                          isClub 
                            ? 'bg-purple-950/60 text-purple-400 border border-purple-800/40' 
                            : isShop 
                            ? 'bg-amber-950/60 text-amber-400 border border-amber-800/40'
                            : 'bg-stone-800 text-stone-300'
                        }`}>
                          {isClub ? <UserCheck size={18} /> : isShop ? <ShoppingBag size={18} /> : <CreditCard size={18} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-stone-100">{n.title || 'Inbound Reservation Notification'}</span>
                            {!n.read && (
                              <span className="bg-amber-500 text-stone-950 text-[8px] uppercase font-mono font-black px-1.5 py-0.2 rounded">
                                NEW
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-stone-400 font-mono mt-0.5">
                            {n.customerName && <strong className="text-stone-200">{n.customerName} • </strong>}
                            {n.email && <span>{n.email} </span>}
                            {n.phone && <span>• {n.phone}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {n.createdAt && (
                          <span className="text-[10px] text-stone-500 font-mono flex items-center gap-1">
                            <Clock size={11} />
                            {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString() : new Date(n.createdAt).toLocaleString()}
                          </span>
                        )}
                        {!n.read && (
                          <button
                            onClick={() => handleMarkAsRead(n.id)}
                            className="text-[10px] bg-stone-800 hover:bg-stone-700 text-stone-300 px-2 py-1 rounded cursor-pointer transition-colors"
                            title="Mark read"
                          >
                            <CheckCircle2 size={12} className="inline mr-1 text-emerald-400" /> Read
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteNotif(n.id)}
                          className="text-stone-600 hover:text-red-400 p-1 rounded transition-colors cursor-pointer"
                          title="Delete notification"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Key Details Pill Box */}
                    <div className="bg-stone-950/70 border border-stone-850 p-3 rounded-lg flex flex-wrap gap-4 text-xs font-mono">
                      {n.cardLast4 && (
                        <div>
                          <span className="text-[9px] text-stone-500 block uppercase font-bold">Vaulted Card:</span>
                          <span className="text-amber-400 font-bold">💳 *{n.cardLast4} (Hold $0.00)</span>
                        </div>
                      )}
                      {n.tier && (
                        <div>
                          <span className="text-[9px] text-stone-500 block uppercase font-bold">Membership Tier:</span>
                          <span className="text-purple-300 font-bold">{n.tier}</span>
                        </div>
                      )}
                      {n.billingFrequency && (
                        <div>
                          <span className="text-[9px] text-stone-500 block uppercase font-bold">Frequency:</span>
                          <span className="text-stone-300 uppercase">{n.billingFrequency}</span>
                        </div>
                      )}
                      {n.ticketNumber && (
                        <div>
                          <span className="text-[9px] text-stone-500 block uppercase font-bold">Standby Ticket:</span>
                          <span className="text-amber-500 font-bold">#GOD-{n.ticketNumber}</span>
                        </div>
                      )}
                      {n.totalAmount !== undefined && (
                        <div>
                          <span className="text-[9px] text-stone-500 block uppercase font-bold">Allocation Total:</span>
                          <span className="text-emerald-400 font-bold">${Number(n.totalAmount).toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    {n.message && (
                      <p className="text-[11px] text-stone-400 bg-stone-950/40 p-2 rounded border border-stone-850/60 leading-relaxed whitespace-pre-line">
                        {n.message}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: EMAIL LOGS */}
      {activeSubTab === 'emails' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-stone-400 uppercase tracking-wider font-bold">
              Dispatched Customer & Admin Emails Audit Log ({emailLogs.length} records)
            </span>
            <button
              onClick={fetchEmailStatus}
              className="text-xs text-stone-400 hover:text-amber-500 flex items-center gap-1 font-mono cursor-pointer"
            >
              <RefreshCw size={12} className={statusLoading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          {emailLogs.length === 0 ? (
            <div className="bg-stone-900/30 border border-stone-850 p-8 rounded-xl text-center space-y-2">
              <Mail className="w-8 h-8 text-stone-600 mx-auto" />
              <p className="text-sm font-semibold text-stone-300">No email records logged yet.</p>
              <p className="text-xs text-stone-500 max-w-md mx-auto">
                Every customer confirmation and admin dispatch is permanently logged here with timestamp and delivery status.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
              {emailLogs.map((log) => (
                <div 
                  key={log.id}
                  className="bg-stone-950/60 border border-stone-850 p-3 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${
                        log.status === 'delivered'
                          ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30'
                          : log.status === 'failed'
                          ? 'bg-red-950/60 text-red-400 border-red-500/30'
                          : 'bg-amber-950/40 text-amber-400 border-amber-500/20'
                      }`}>
                        {log.status === 'delivered' ? '✓ Delivered' : log.status === 'failed' ? '✗ Failed' : '● Logged (Simulated)'}
                      </span>
                      <span className="font-mono text-[10px] text-stone-500 uppercase">Provider: {log.provider}</span>
                      <span className="font-bold text-stone-200 truncate">{log.subject}</span>
                    </div>

                    <div className="text-[10px] text-stone-400 font-mono">
                      <span>To: <strong className="text-stone-300">{log.to}</strong></span>
                      {log.createdAt && (
                        <span className="text-stone-500 ml-3">
                          • {log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString() : new Date(log.createdAt).toLocaleString()}
                        </span>
                      )}
                    </div>

                    {log.errorMessage && (
                      <p className="text-[10px] text-red-400 font-mono">Error: {log.errorMessage}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setSelectedEmail(log)}
                      className="bg-stone-850 hover:bg-stone-750 text-stone-300 px-2.5 py-1 rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Eye size={12} /> View Message
                    </button>
                    <button
                      onClick={() => handleResendLog(log)}
                      className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Send size={11} /> Re-send
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: DIAGNOSTICS & TEST DISPATCH */}
      {activeSubTab === 'test' && (
        <div className="space-y-6">
          {/* Active Configuration Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-stone-900/40 border border-stone-850 p-4 rounded-xl space-y-1">
              <span className="text-[9px] text-stone-500 uppercase font-mono font-bold block">Resend API Delivery</span>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${emailServerStatus?.resendConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-stone-600'}`} />
                <span className="text-xs font-bold text-stone-200">
                  {emailServerStatus?.resendConfigured ? 'Active & Configured' : 'Not Set (Optional)'}
                </span>
              </div>
              <p className="text-[10px] text-stone-500 font-sans">
                {emailServerStatus?.resendConfigured ? 'Direct API mail delivery enabled.' : 'Set RESEND_API_KEY in Settings > Secrets for instant global deliverability.'}
              </p>
            </div>

            <div className="bg-stone-900/40 border border-stone-850 p-4 rounded-xl space-y-1">
              <span className="text-[9px] text-stone-500 uppercase font-mono font-bold block">SMTP Mail Server</span>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${emailServerStatus?.smtpConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-stone-600'}`} />
                <span className="text-xs font-bold text-stone-200">
                  {emailServerStatus?.smtpConfigured ? `Active (${emailServerStatus.smtpHost})` : 'Not Set (Optional)'}
                </span>
              </div>
              <p className="text-[10px] text-stone-500 font-sans">
                {emailServerStatus?.smtpConfigured ? 'Using custom domain SMTP server.' : 'Use SMTP_HOST, SMTP_USER, SMTP_PASS for GoDaddy/cPanel or corporate email.'}
              </p>
            </div>

            <div className="bg-stone-900/40 border border-stone-850 p-4 rounded-xl space-y-1">
              <span className="text-[9px] text-stone-500 uppercase font-mono font-bold block">Admin Alert Recipient</span>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-xs font-bold text-amber-400 truncate">
                  {emailServerStatus?.adminEmail || 'billing@godleyciders.com'}
                </span>
              </div>
              <p className="text-[10px] text-stone-500 font-sans">
                All signup notices & payments forward to this address.
              </p>
            </div>
          </div>

          {/* Test Sender Form */}
          <div className="bg-stone-950 border border-stone-850 p-6 rounded-xl space-y-4">
            <h3 className="text-xs font-mono font-black text-amber-500 uppercase tracking-wider">
              Send Live Test Email
            </h3>
            <p className="text-xs text-stone-400">
              Verify your notification delivery system. Clicking send will trigger an immediate message and report the live transport response.
            </p>

            <form onSubmit={handleSendTestEmail} className="space-y-4 max-w-lg">
              <div>
                <label className="text-[10px] text-stone-400 uppercase font-bold tracking-wider block mb-1">
                  Destination Email Address
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    required
                    value={testEmail}
                    onChange={e => setTestEmail(e.target.value)}
                    placeholder="billing@godleyciders.com"
                    className="flex-1 bg-stone-900 border border-stone-800 rounded px-3 py-2 text-xs text-stone-200 focus:border-amber-500 outline-none font-mono"
                  />
                  <button
                    type="submit"
                    disabled={testingStatus === 'sending'}
                    className="bg-amber-500 hover:bg-amber-400 disabled:bg-stone-800 text-stone-950 font-bold uppercase text-xs px-4 py-2 rounded transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {testingStatus === 'sending' ? (
                      <RefreshCw size={13} className="animate-spin" />
                    ) : (
                      <Send size={13} />
                    )}
                    {testingStatus === 'sending' ? 'Sending...' : 'Send Test Dispatch'}
                  </button>
                </div>
              </div>
            </form>

            {/* Test Result Callout */}
            {testResult && (
              <div className={`p-4 rounded-lg border text-xs font-mono space-y-1.5 ${
                testingStatus === 'success' 
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' 
                  : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
              }`}>
                <div className="flex items-center gap-2 font-bold">
                  {testingStatus === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{testingStatus === 'success' ? 'DISPATCH SUCCESSFUL' : 'TEST DISPATCH LOGGED'}</span>
                </div>
                <p className="text-[11px]">Recipient: {testResult.recipient}</p>
                <p className="text-[11px]">Provider: {testResult.provider}</p>
                <p className="text-[11px]">Status: {testResult.status}</p>
                {testResult.error && <p className="text-red-400">Notice: {testResult.error}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW EMAIL MESSAGE MODAL */}
      {selectedEmail && (
        <div className="fixed inset-0 z-[10000] bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-xl max-w-2xl w-full p-6 space-y-4 text-left font-sans">
            <div className="flex justify-between items-start border-b border-stone-800 pb-3">
              <div>
                <span className="text-[10px] text-stone-500 font-mono uppercase block font-bold">Dispatched Email Preview</span>
                <h4 className="text-sm font-bold text-stone-200">{selectedEmail.subject}</h4>
              </div>
              <button
                onClick={() => setSelectedEmail(null)}
                className="text-stone-400 hover:text-stone-100 text-xs font-bold cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            <div className="bg-stone-950 p-3 rounded border border-stone-850 font-mono text-[10px] text-stone-400 space-y-1">
              <div><strong>To:</strong> {selectedEmail.to}</div>
              <div><strong>From:</strong> {selectedEmail.from || 'Godley Ciders <hello@godleyciders.com>'}</div>
              <div><strong>Provider:</strong> {selectedEmail.provider} ({selectedEmail.status})</div>
              <div><strong>Timestamp:</strong> {selectedEmail.createdAt?.toDate ? selectedEmail.createdAt.toDate().toLocaleString() : 'Recent'}</div>
            </div>

            <div className="bg-stone-950 p-4 rounded border border-stone-850 max-h-72 overflow-y-auto whitespace-pre-wrap font-mono text-xs text-stone-300 leading-relaxed">
              {selectedEmail.fullText || selectedEmail.textPreview}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => handleResendLog(selectedEmail)}
                className="bg-amber-500 hover:bg-amber-400 text-stone-950 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
              >
                <Send size={12} /> Resend Now
              </button>
              <button
                onClick={() => setSelectedEmail(null)}
                className="bg-stone-800 hover:bg-stone-700 text-stone-300 px-4 py-2 rounded text-xs font-semibold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
