import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export default function WholesaleInquiriesList() {
  const [firestoreInquiries, setFirestoreInquiries] = useState<any[]>([]);
  const [serverPartners, setServerPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFeedback, setStatusFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchServerPartners = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/accounting-data');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.wholesalePartners)) {
          setServerPartners(data.wholesalePartners);
        }
      }
    } catch {
      // Server list optional fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServerPartners();
    const q = query(collection(db, 'wholesale_inquiries'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        setFirestoreInquiries(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );
    return unsub;
  }, [fetchServerPartners]);

  // Merge Firestore inquiries and server-captured wholesale accounts without duplicates
  const mergedInquiries = React.useMemo(() => {
    const byKey = new Map<string, any>();
    for (const item of firestoreInquiries) {
      const key = (item.email || item.id).toLowerCase();
      byKey.set(key, item);
    }
    for (const srv of serverPartners) {
      const key = (srv.email || srv.id).toLowerCase();
      const existing = byKey.get(key);
      byKey.set(key, existing ? { ...existing, ...srv } : srv);
    }
    return Array.from(byKey.values()).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }, [firestoreInquiries, serverPartners]);

  const updatePartnerStatus = async (inquiry: any, status?: 'approved' | 'pending' | 'hold', net30Status?: 'approved' | 'denied') => {
    setUpdatingId(inquiry.id);
    setStatusFeedback(null);
    try {
      const res = await fetch('/api/admin/wholesale/update-partner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerDocId: inquiry.id,
          ...(status ? { status } : {}),
          ...(net30Status ? { net30Status } : {})
        })
      });

      if (!res.ok) {
        // Fallback to direct Firestore update if record lives solely in client Firestore
        await updateDoc(doc(db, 'wholesale_inquiries', inquiry.id), {
          ...(status ? { status } : {}),
          ...(status === 'approved' ? { approvedAt: serverTimestamp() } : {}),
          ...(net30Status ? { net30Status } : {})
        });
      }

      await fetchServerPartners();
      const actionLabel = status ? `Status updated to ${status.toUpperCase()}` : `Net-30 ${net30Status?.toUpperCase()}`;
      setStatusFeedback({ type: 'success', text: `${inquiry.businessName}: ${actionLabel}` });
    } catch (err: any) {
      setStatusFeedback({ type: 'error', text: err.message || 'Failed to update distributor record.' });
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading && mergedInquiries.length === 0) return <div className="p-4 text-xs text-stone-500">Loading...</div>;
  if (mergedInquiries.length === 0) return <div className="p-4 text-xs text-stone-500">No wholesale accounts or inquiries yet.</div>;

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto pr-2 font-sans text-left">
      {statusFeedback && (
        <div
          className={`px-3 py-2 rounded text-[10px] font-mono border ${
            statusFeedback.type === 'success'
              ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400'
              : 'bg-red-950/30 border-red-500/30 text-red-400'
          }`}
        >
          {statusFeedback.text}
        </div>
      )}

      {mergedInquiries.map((inquiry) => {
        const hasDocs = inquiry.docsSubmitted ?? Boolean(inquiry.abcLicenseNumber || inquiry.resaleLicenseNumber || inquiry.licenseNumber);
        const status = inquiry.status || 'pending';
        const statusClass =
          status === 'approved'
            ? 'text-emerald-400 bg-emerald-950/30 border-emerald-500/30'
            : status === 'hold'
            ? 'text-red-400 bg-red-950/30 border-red-500/30'
            : status === 'lead'
            ? 'text-blue-300 bg-blue-950/30 border-blue-500/30'
            : 'text-amber-400 bg-amber-950/30 border-amber-500/30';

        return (
          <div key={inquiry.id} className="bg-stone-900 border border-stone-800 p-3 rounded space-y-2">
            <div className="flex justify-between items-start gap-2">
              <div>
                <div className="text-xs text-stone-200 font-bold">{inquiry.businessName}</div>
                <div className="text-[10px] text-stone-500">{inquiry.contactName}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-mono font-bold border ${statusClass}`}>
                  {status === 'lead' ? 'LEAD - NO DOCS' : status}
                </span>
                <span className="text-[9px] text-stone-500 font-mono">
                  {hasDocs ? 'Docs Submitted' : 'No Docs Yet'}
                </span>
              </div>
            </div>

            <div className="text-[10px] text-stone-400 space-y-1 font-mono">
              <div>
                <span className="text-stone-500 w-16 inline-block">Email:</span>{' '}
                <a href={`mailto:${inquiry.email}`} className="text-amber-500 hover:underline">{inquiry.email}</a>
              </div>
              {inquiry.phone && (
                <div><span className="text-stone-500 w-16 inline-block">Phone:</span> {inquiry.phone}</div>
              )}
              {(inquiry.abcLicenseNumber || inquiry.licenseNumber) && (
                <div>
                  <span className="text-stone-500 w-16 inline-block">ABC #:</span>{' '}
                  {inquiry.abcLicenseNumber || inquiry.licenseNumber}
                </div>
              )}
              {inquiry.resaleLicenseNumber && (
                <div>
                  <span className="text-stone-500 w-16 inline-block">Resale:</span> {inquiry.resaleLicenseNumber}
                </div>
              )}
              {inquiry.taxId && (
                <div><span className="text-stone-500 w-16 inline-block">Tax ID:</span> {inquiry.taxId}</div>
              )}
              {inquiry.address && (
                <div><span className="text-stone-500 w-16 inline-block">Address:</span> {inquiry.address}</div>
              )}
            </div>

            {inquiry.message && (
              <div className="pt-2 border-t border-stone-800 font-sans">
                <div className="text-[10px] text-stone-300 whitespace-pre-wrap">{inquiry.message}</div>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2 border-t border-stone-850">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={updatingId === inquiry.id || status === 'approved'}
                  onClick={() => updatePartnerStatus(inquiry, 'approved')}
                  className={`flex-1 text-[9px] uppercase tracking-wider font-semibold py-1 rounded border transition-all cursor-pointer ${
                    status === 'approved'
                      ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-500 cursor-default'
                      : 'bg-emerald-600/15 hover:bg-emerald-600 hover:text-stone-950 border-emerald-500/30 text-emerald-400'
                  }`}
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={updatingId === inquiry.id || status === 'pending'}
                  onClick={() => updatePartnerStatus(inquiry, 'pending')}
                  className={`flex-1 text-[9px] uppercase tracking-wider font-semibold py-1 rounded border transition-all cursor-pointer ${
                    status === 'pending'
                      ? 'bg-amber-950/30 border-amber-500/30 text-amber-400 cursor-default'
                      : 'bg-amber-600/15 hover:bg-amber-600 hover:text-stone-950 border-amber-500/30 text-amber-400'
                  }`}
                >
                  Pending
                </button>
                <button
                  type="button"
                  disabled={updatingId === inquiry.id || status === 'hold'}
                  onClick={() => updatePartnerStatus(inquiry, 'hold')}
                  className={`flex-1 text-[9px] uppercase tracking-wider font-semibold py-1 rounded border transition-all cursor-pointer ${
                    status === 'hold'
                      ? 'bg-red-950/30 border-red-500/30 text-red-400 cursor-default'
                      : 'bg-red-600/15 hover:bg-red-600 hover:text-stone-950 border-red-500/30 text-red-400'
                  }`}
                >
                  Hold
                </button>
              </div>

              <div className="flex justify-between items-center text-[8px] text-stone-600 font-mono">
                <span>Type: {inquiry.businessType || inquiry.type || 'Wholesale'}</span>
                <span>{inquiry.createdAt ? new Date(inquiry.createdAt).toLocaleDateString() : ''}</span>
              </div>

              {status === 'approved' && (
                <div className="bg-stone-950/40 border border-stone-805 p-2 rounded space-y-1.5 text-[10px] font-sans">
                  <div className="flex justify-between items-center">
                    <span className="text-stone-500 uppercase tracking-wider text-[8px] font-bold">NET-30 Terms Credit line:</span>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase tracking-widest font-mono font-bold ${
                      inquiry.net30Status === 'approved'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20'
                        : inquiry.net30Status === 'requested'
                        ? 'bg-amber-950 text-amber-400 border border-amber-500/20'
                        : inquiry.net30Status === 'denied'
                        ? 'bg-red-950 text-red-400 border border-red-500/20'
                        : 'bg-stone-900 text-stone-500 border border-stone-800'
                    }`}>
                      {inquiry.net30Status || 'None'}
                    </span>
                  </div>

                  <div className="flex gap-1.5 font-sans">
                    <button
                      type="button"
                      disabled={updatingId === inquiry.id}
                      onClick={() => updatePartnerStatus(inquiry, undefined, 'approved')}
                      className="flex-1 text-[8.5px] uppercase tracking-wider text-center py-1 rounded bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600 hover:text-stone-950 transition-all font-semibold border border-emerald-600/25 cursor-pointer"
                    >
                      Allow Net-30
                    </button>
                    <button
                      type="button"
                      disabled={updatingId === inquiry.id}
                      onClick={() => updatePartnerStatus(inquiry, undefined, 'denied')}
                      className="flex-1 text-[8.5px] uppercase tracking-wider text-center py-1 rounded bg-red-600/10 text-red-400 hover:bg-red-600 hover:text-stone-950 transition-all font-semibold border border-red-600/25 cursor-pointer"
                    >
                      Deny Net-30
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
