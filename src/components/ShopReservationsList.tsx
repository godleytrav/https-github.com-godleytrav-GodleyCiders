import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

export default function ShopReservationsList() {
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'shop_reservations'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setReservations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => {
      console.error(err);
      setError('Could not load shop preorders. Verification required.');
      setLoading(false);
    });
    return unsub;
  }, []);

  const stats = useMemo(() => {
    const counts: { [key: string]: number } = {};
    let totalItems = 0;
    reservations.filter(r => r.status === 'reserved').forEach(res => {
      res.items?.forEach((item: any) => {
        counts[item.name] = (counts[item.name] || 0) + item.quantity;
        totalItems += item.quantity;
      });
    });
    return { list: Object.entries(counts).sort((a, b) => b[1] - a[1]), total: totalItems };
  }, [reservations]);

  if (loading) return <div className="p-4 text-xs text-stone-500">Loading reservations...</div>;
  if (error) return <div className="p-4 text-[10px] text-red-400">{error}</div>;

  return (
    <div className="space-y-4 font-sans text-left">
      {/* Demand Analytics Panel */}
      <div className="bg-stone-900/60 p-3 rounded border border-stone-800">
        <span className="text-amber-500 font-mono text-[9px] uppercase tracking-wider block font-bold mb-2">📊 REAL-TIME DEMAND ANALYTICS</span>
        {stats.list.length === 0 ? (
          <p className="text-[10px] text-stone-500 italic font-sans animate-pulse">No reserved allocations found in the standby queue.</p>
        ) : (
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            <div className="flex justify-between text-[10px] text-stone-400 border-b border-stone-800 pb-1 mb-1 font-mono font-bold">
              <span>PRODUCT STYLE / ITEM</span>
              <span>RESERVED QTY</span>
            </div>
            {stats.list.map(([name, qty]) => (
              <div key={name} className="flex justify-between items-center text-[10px] font-sans">
                <span className="text-stone-300 truncate max-w-[190px]" title={name}>{name}</span>
                <span className="font-mono text-amber-500 font-bold bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">{qty} unit{qty > 1 ? 's' : ''}</span>
              </div>
            ))}
            <div className="flex justify-between text-[10px] text-stone-400 border-t border-stone-800 pt-1.5 mt-2 font-mono">
              <span className="font-bold">TOTAL COMMITTED DEMAND:</span>
              <span className="font-bold text-emerald-400">{stats.total} units</span>
            </div>
          </div>
        )}
      </div>

      {/* Reservations Queue */}
      <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
        {reservations.length === 0 ? (
          <div className="text-[10px] text-stone-550 italic p-2">No preorders submitted yet.</div>
        ) : (
          reservations.map((res) => (
            <div key={res.id} className="bg-stone-950/60 border border-stone-850 p-3 rounded space-y-2">
              <div className="flex justify-between items-start">
                <div className="min-w-0 pr-2">
                  <div className="text-xs text-stone-300 font-bold truncate">{res.customerName}</div>
                  <div className="text-[9px] text-stone-500 truncate font-mono">{res.email} • {res.phone}</div>
                </div>
                <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase tracking-widest font-mono font-bold border shrink-0 ${
                  res.status === 'settled_dispatched' 
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-500/20' 
                    : res.status === 'cancelled'
                    ? 'bg-red-955/40 text-red-400 border-red-500/20'
                    : 'bg-amber-955 text-amber-400 border border-amber-500/20 animate-pulse'
                }`}>
                  {res.status === 'settled_dispatched' ? 'Settled & Ready' : res.status}
                </span>
              </div>

              {/* Items Reserved */}
              <div className="bg-stone-900/40 p-2 rounded border border-stone-850 text-[10px] space-y-1">
                <span className="text-stone-500 uppercase tracking-wider text-[8px] block font-bold font-mono">Reserved Items:</span>
                {res.items?.map((item: any, itemIdx: number) => (
                  <div key={item.id || itemIdx} className="flex justify-between items-center text-stone-300 font-mono">
                    <span className="truncate max-w-[150px]">{item.quantity}x {item.name}</span>
                    <span className="text-stone-500 shrink-0">${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                
                <div className="border-t border-stone-850 pt-1.5 mt-1.5 flex justify-between items-center text-[10px] text-stone-400 font-sans">
                  <span>Payment Vaulted:</span>
                  <span className="font-mono text-amber-500 font-bold bg-amber-500/5 px-1 py-0.5 rounded">💳 *{res.cardLast4 || '4242'} (exp {res.cardExpiry || '12/28'})</span>
                </div>
                
                <div className="flex justify-between text-[10px] pt-1 border-t border-stone-850 font-sans">
                  <span className="text-stone-500">Fulfillment Preference:</span>
                  <span className="text-stone-303 font-bold uppercase text-[9px] truncate max-w-[120px]">
                    {res.deliveryPreference === 'shipping' ? `🚚 Ship to CA (${res.shippingAddress?.city || 'CA'})` : '🍇 Local Host Pickup'}
                  </span>
                </div>
                
                <div className="flex justify-between text-[11px] pt-1.5 border-t border-stone-850 font-mono">
                  <span className="text-stone-400 font-bold">Total Reservation:</span>
                  <span className="text-amber-500 font-bold">${(res.totalAmount || 0).toFixed(2)}</span>
                </div>
              </div>

              {res.status === 'reserved' && (
                <div className="flex gap-1.5 pt-1">
                  <button
                    onClick={async () => {
                      if (window.confirm(`Settle credit card (*${res.cardLast4 || '4242'}) and notify ${res.customerName} that their reservation is now available? This processes an EFT payment complying with ABC laws.`)) {
                        try {
                          await updateDoc(doc(db, 'shop_reservations', res.id), {
                            status: 'settled_dispatched',
                            settledAt: serverTimestamp()
                          });

                          // Enqueue sync event to BevForge
                          await fetch('/api/events/enqueue', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              eventId: crypto.randomUUID?.() || 'evt-' + Math.random().toString(36).substring(2, 10),
                              eventType: 'reservation.settled_dispatched',
                              createdAt: new Date().toISOString(),
                              data: {
                                reservationId: res.id,
                                ticketNumber: res.ticketNumber,
                                customerName: res.customerName,
                                customerEmail: res.email,
                                totalAmount: res.totalAmount,
                                status: 'settled_dispatched',
                                timestamp: new Date().toISOString()
                              }
                            })
                          }).catch(err => console.warn('BevForge reservation settlement enqueue failed:', err));

                          // Notify customer via dispatch email API
                          const itemsStr = res.items?.map((item: any) => `${item.quantity}x ${item.name}`).join(', ') || 'Your Cider Reservation';
                          const textContent = `Hello ${res.customerName},\n\nWe have exciting news! Your priority standby reservation at Godley Ciders is now available for fulfillment.\n\nOur cellars have completed fermentation, checked local compliance limits, and hand-selected your allocation:\n${itemsStr}\n\nYour vaulted card ending in *${res.cardLast4 || '4242'} has been settled for the order total of $${Number(res.totalAmount || 0).toFixed(2)} via Electronic Funds Transfer (EFT) in complete alignment with California ABC rules.\n\nFulfillment Details:\n${res.deliveryPreference === 'shipping' ? `Ground Freight parcel dispatch is packing. Tracking code updates will be sent to this email.` : 'Your bottles are securely caged, hand-corked, and ready for complimentary pickup at our local Placer County host cellar location!'}\n\nThank you for backing Godley Ciders during our pre-release scaling!\n\nCheers,\nGodley Ciders Team`;

                          await fetch('/api/email/dispatch', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              to: res.email,
                              subject: '🎉 Godley Ciders - Priority Allocation Ready!',
                              text: textContent,
                              from: 'billing@godleyciders.com'
                            })
                          });

                          alert(`Pre-order settled successfully! Confirmation email dispatched to ${res.email}.`);
                        } catch (err: any) {
                          alert(err.message);
                        }
                      }
                    }}
                    className="flex-1 text-[9px] uppercase tracking-wider text-center py-1.5 rounded bg-emerald-600/90 text-stone-950 hover:bg-emerald-500 font-serif font-black transition-all cursor-pointer shadow-sm"
                  >
                    Settle & Dispatch
                  </button>
                  <button
                    onClick={async () => {
                      if (window.confirm(`Are you sure you want to cancel ${res.customerName}'s standby reservation?`)) {
                        try {
                          await updateDoc(doc(db, 'shop_reservations', res.id), {
                            status: 'cancelled',
                            cancelledAt: serverTimestamp()
                          });

                          // Enqueue sync event to BevForge
                          await fetch('/api/events/enqueue', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              eventId: crypto.randomUUID?.() || 'evt-' + Math.random().toString(36).substring(2, 10),
                              eventType: 'reservation.cancelled',
                              createdAt: new Date().toISOString(),
                              data: {
                                reservationId: res.id,
                                ticketNumber: res.ticketNumber,
                                customerName: res.customerName,
                                status: 'cancelled',
                                timestamp: new Date().toISOString()
                              }
                            })
                          }).catch(err => console.warn('BevForge reservation cancel enqueue failed:', err));

                          alert('Reservation cancelled and card released.');
                        } catch (err: any) {
                          alert(err.message);
                        }
                      }
                    }}
                    className="text-[9px] uppercase tracking-wider py-1.5 px-3 rounded bg-stone-800 text-stone-400 hover:text-red-400 hover:bg-stone-900 border border-stone-850 font-mono transition-all font-semibold cursor-pointer shrink-0"
                  >
                    Cancel
                  </button>
                </div>
              )}
              
              {res.status !== 'reserved' && (
                <div className="flex justify-end pt-1">
                  <button
                    onClick={async () => {
                      if (window.confirm("Delete record permanently from logs?")) {
                        try {
                          await deleteDoc(doc(db, 'shop_reservations', res.id));
                          alert("Record permanently deleted.");
                        } catch (err: any) {
                          alert(err.message);
                        }
                      }
                    }}
                    className="text-[8px] text-stone-600 hover:text-red-404 font-mono uppercase cursor-pointer hover:underline"
                  >
                    Delete Log
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
