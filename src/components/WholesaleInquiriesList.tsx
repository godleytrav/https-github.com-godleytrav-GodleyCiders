import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export default function WholesaleInquiriesList() {
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'wholesale_inquiries'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setInquiries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => {
      console.error(err);
      setError('Could not load inquiries (maybe permission denied).');
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) return <div className="p-4 text-xs text-stone-500">Loading...</div>;
  if (error) return <div className="p-4 text-[10px] text-red-400">{error}</div>;
  if (inquiries.length === 0) return <div className="p-4 text-xs text-stone-500">No inquiries yet.</div>;

  return (
    <div className="space-y-4 max-h-96 overflow-y-auto pr-2 font-sans text-left">
      {inquiries.map((inquiry) => (
        <div key={inquiry.id} className="bg-stone-900 border border-stone-800 p-3 rounded space-y-2">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs text-stone-300 font-bold">{inquiry.businessName}</div>
              <div className="text-[10px] text-stone-500">{inquiry.contactName}</div>
            </div>
            <div className="text-[10px] text-amber-500/70 border border-amber-500/30 px-1 py-0.5 rounded uppercase font-mono">{inquiry.type}</div>
          </div>
          <div className="text-[10px] text-stone-400 space-y-1 font-mono">
            <div><span className="text-stone-500 w-16 inline-block">Email:</span> <a href={`mailto:${inquiry.email}`} className="text-amber-500 hover:underline">{inquiry.email}</a></div>
            <div><span className="text-stone-500 w-16 inline-block">Phone:</span> {inquiry.phone}</div>
            {inquiry.licenseNumber && <div><span className="text-stone-500 w-16 inline-block">License:</span> {inquiry.licenseNumber}</div>}
            {inquiry.address && <div><span className="text-stone-500 w-16 inline-block">Address:</span> {inquiry.address}</div>}
            {inquiry.website && <div><span className="text-stone-500 w-16 inline-block">Website:</span> {inquiry.website}</div>}
            {inquiry.estimatedVolume && <div><span className="text-stone-500 w-16 inline-block">Volume:</span> {inquiry.estimatedVolume}</div>}
          </div>
          <div className="pt-2 border-t border-stone-800 font-sans">
            <div className="text-[10px] text-stone-300 whitespace-pre-wrap">{inquiry.message}</div>
          </div>
          <div className="flex flex-col gap-2 pt-2 border-t border-stone-850">
            <div className="flex justify-between items-center">
              {inquiry.status === 'approved' ? (
                <span className="text-[9px] uppercase tracking-wider text-emerald-400 font-bold bg-emerald-950/20 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                  ✓ Verified Distributor Partner
                </span>
              ) : (
                <button
                  onClick={async () => {
                    try {
                      await updateDoc(doc(db, 'wholesale_inquiries', inquiry.id), {
                        status: 'approved',
                        approvedAt: serverTimestamp()
                      });
                      alert(`Approved ${inquiry.businessName} as a verified wholesale distributor!`);
                    } catch (err: any) {
                      alert(`Failed to approve distributor: ${err.message}`);
                    }
                  }}
                  className="text-[9px] uppercase tracking-wider font-semibold text-amber-500 bg-amber-600/10 hover:bg-amber-600 hover:text-stone-950 border border-amber-500/30 px-2 py-0.5 rounded transition-all cursor-pointer font-sans"
                >
                  Approve Distributor Account
                </button>
              )}
              <div className="text-[8px] text-stone-600 pt-1 text-right font-mono">
                {new Date(inquiry.createdAt).toLocaleDateString()}
              </div>
            </div>

            {/* NET-30 CREDIT TERMS MANAGEMENT */}
            {inquiry.status === 'approved' && (
              <div className="bg-stone-950/40 border border-stone-805 p-2.5 rounded space-y-2 text-[10px] font-sans">
                <div className="flex justify-between items-center">
                  <span className="text-stone-505 uppercase tracking-wider text-[8px] font-bold">NET-30 Terms Credit line:</span>
                  <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase tracking-widest font-mono font-bold ${
                    inquiry.net30Status === 'approved' 
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20' 
                      : inquiry.net30Status === 'requested'
                      ? 'bg-amber-955 text-amber-400 border border-amber-500/20 animate-pulse'
                      : inquiry.net30Status === 'denied'
                      ? 'bg-red-955 text-red-400 border border-red-500/20'
                      : 'bg-stone-900 text-stone-500 border border-stone-800'
                  }`}>
                    {inquiry.net30Status || 'None'}
                  </span>
                </div>

                <div className="flex gap-1.5 pt-0.5 font-sans">
                  <button
                    onClick={async () => {
                      try {
                        await updateDoc(doc(db, 'wholesale_inquiries', inquiry.id), { net30Status: 'approved' });
                        alert(`NET-30 credit terms APPROVED for ${inquiry.businessName}`);
                      } catch (err: any) {
                        alert(err.message);
                      }
                    }}
                    className="flex-1 text-[8.5px] uppercase tracking-wider text-center py-1 rounded bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600 hover:text-stone-950 transition-all font-semibold border border-emerald-600/25 cursor-pointer"
                  >
                    Allow Net-30
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await updateDoc(doc(db, 'wholesale_inquiries', inquiry.id), { net30Status: 'denied' });
                        alert(`NET-30 credit terms DENIED/REVOKED for ${inquiry.businessName}`);
                      } catch (err: any) {
                        alert(err.message);
                      }
                    }}
                    className="flex-1 text-[8.5px] uppercase tracking-wider text-center py-1 rounded bg-red-650/10 text-red-400 hover:bg-red-650 hover:text-stone-950 transition-all font-semibold border border-red-650/25 cursor-pointer"
                  >
                    Deny Net-30
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
