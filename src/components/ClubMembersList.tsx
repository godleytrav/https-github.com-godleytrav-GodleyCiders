import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { Plus, Trash2 } from 'lucide-react';

export default function ClubMembersList() {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTier, setFilterTier] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  
  // Create Member form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newTier, setNewTier] = useState('Core');
  const [newStatus, setNewStatus] = useState('active');

  useEffect(() => {
    const q = query(collection(db, 'club_leads'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => {
      console.error(err);
      setError('Could not load club members (permission denied).');
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newName) {
      alert("Name and Email are required");
      return;
    }
    try {
      await addDoc(collection(db, 'club_leads'), {
        name: newName,
        email: newEmail,
        phone: newPhone,
        tier: newTier,
        status: newStatus,
        createdAt: new Date().toISOString(),
        pickups: 0,
        notes: "Manually registered via Master Admin Terminal.",
        vip: false
      });
      alert(`Successfully added ${newName} to the database.`);
      setNewName('');
      setNewEmail('');
      setNewPhone('');
      setNewTier('Core');
      setNewStatus('active');
      setShowAddForm(false);
    } catch (err: any) {
      alert(`Failed to add member: ${err.message}`);
    }
  };

  const filtered = useMemo(() => {
    return members.filter(m => {
      const matchSearch = 
        (m.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.phone || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchTier = filterTier === 'all' || m.tier === filterTier;
      const matchStatus = filterStatus === 'all' || m.status === filterStatus;
      return matchSearch && matchTier && matchStatus;
    });
  }, [members, searchTerm, filterTier, filterStatus]);

  if (loading) return <div className="p-4 text-xs text-stone-500">Loading club members...</div>;
  if (error) return <div className="p-4 text-[10px] text-red-400">{error}</div>;

  return (
    <div className="space-y-4 font-sans text-left">
      <div className="flex flex-wrap gap-2 justify-between items-center bg-stone-900/60 p-3 rounded border border-stone-800">
        <div className="flex gap-2 flex-grow max-w-md">
          <input 
            type="text" 
            placeholder="Search by name, email, phone..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="flex-grow bg-stone-950 border border-stone-800 rounded px-2.5 py-1.5 text-xs text-stone-300 focus:border-amber-500 outline-none font-sans"
          />
          <select 
            value={filterTier} 
            onChange={e => setFilterTier(e.target.value)}
            className="bg-stone-950 border border-stone-800 rounded px-2 text-xs text-stone-300 focus:border-amber-500 h-[32px] font-sans"
          >
            <option value="all">All Tiers</option>
            <option value="Core">Core</option>
            <option value="Branch">Branch</option>
            <option value="Heritage">Heritage</option>
          </select>
          <select 
            value={filterStatus} 
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-stone-950 border border-stone-800 rounded px-2 text-xs text-stone-300 focus:border-amber-500 h-[32px] font-sans"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="standby">Standby</option>
          </select>
        </div>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="text-stone-955 bg-amber-500 hover:bg-amber-400 font-bold uppercase tracking-wider text-[10px] px-3 py-1.5 rounded transition-all flex items-center gap-1 cursor-pointer font-sans"
        >
          <Plus size={12} /> {showAddForm ? 'Close Form' : 'Register Member'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddMember} className="bg-stone-950/65 border border-amber-500/30 p-4 rounded-lg space-y-3 font-sans">
          <div className="text-amber-500 font-mono text-[9px] uppercase tracking-wider font-bold">Register Custom Club Member</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">Full Name</label>
              <input required type="text" value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-stone-900 border border-stone-800 rounded p-1.5 text-xs text-stone-300 font-sans" placeholder="e.g. Travis Godley" />
            </div>
            <div>
              <label className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">Email Address</label>
              <input required type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="w-full bg-stone-900 border border-stone-800 rounded p-1.5 text-xs text-stone-300 font-sans" placeholder="e.g. apple@godley.com" />
            </div>
            <div>
              <label className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">Phone Number</label>
              <input type="text" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full bg-stone-900 border border-stone-800 rounded p-1.5 text-xs text-stone-300 font-sans" placeholder="530-555-1212" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 max-w-sm">
            <div>
              <label className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">Membership Tier</label>
              <select value={newTier} onChange={e => setNewTier(e.target.value)} className="w-full bg-stone-900 border border-stone-800 rounded p-1.5 text-xs text-stone-300 h-[32px] font-sans">
                <option value="Core">Core Selection</option>
                <option value="Branch">Branch Reserve</option>
                <option value="Heritage">Heritage Library</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">Lobby Status</label>
              <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="w-full bg-stone-900 border border-stone-800 rounded p-1.5 text-xs text-stone-300 h-[32px] font-sans">
                <option value="active">Active Spot (ABC Granted)</option>
                <option value="standby">Standby Waiting Room</option>
              </select>
            </div>
          </div>
          <button type="submit" className="bg-amber-600 hover:bg-amber-500 text-stone-950 px-4 py-2 text-xs uppercase font-serif font-black tracking-wider rounded cursor-pointer">
            Write Member Profile
          </button>
        </form>
      )}

      <div className="space-y-3 overflow-y-auto max-h-[500px]">
        {filtered.length === 0 ? (
          <div className="text-stone-500 font-sans text-xs italic p-4 text-center">No members found matching filters in this database segment.</div>
        ) : (
          filtered.map((member) => (
            <div key={member.id} className="bg-stone-950/40 border border-stone-850 p-3 rounded-lg space-y-3 hover:border-stone-800 transition-all font-sans text-left">
              <div className="flex flex-wrap justify-between items-start gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-200 font-bold">{member.name}</span>
                    {member.vip && (
                      <span className="text-[8px] bg-amber-500/10 text-amber-500 border border-amber-500/30 px-1.5 rounded uppercase font-bold tracking-widest leading-none py-[2px] font-sans">
                        VIP
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-stone-400 font-mono mt-0.5">
                    {member.email} • {member.phone || 'No phone'}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[9px] bg-stone-900 text-amber-500 border border-stone-800 px-2 py-0.5 rounded font-mono font-bold uppercase shrink-0">
                    {member.tier} Tier
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[9px] uppercase tracking-wider font-mono font-bold shrink-0 border ${
                    member.status === 'active' 
                      ? 'bg-emerald-955 text-emerald-400 border-emerald-500/20' 
                      : 'bg-amber-955 text-amber-400 border-amber-500/20 animate-pulse'
                  }`}>
                    {member.status}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 items-center justify-between text-[10px] border-t border-stone-900 pt-2 bg-stone-900/20 p-2 rounded">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-stone-500 font-bold uppercase text-[9px]">Pickups:</span>
                    <span className="text-stone-200 font-mono font-bold">{member.pickups ?? 0}</span>
                    <button 
                      onClick={async () => {
                        try {
                          const current = member.pickups ?? 0;
                          await updateDoc(doc(db, 'club_leads', member.id), { pickups: current + 1 });
                        } catch (err: any) { alert(err.message); }
                      }}
                      className="bg-stone-800 hover:bg-stone-700 text-stone-300 w-5 h-5 flex items-center justify-center rounded cursor-pointer font-bold border border-stone-700 font-sans"
                    >
                      +
                    </button>
                    <button 
                      onClick={async () => {
                        try {
                          const current = member.pickups ?? 0;
                          if (current > 0) {
                            await updateDoc(doc(db, 'club_leads', member.id), { pickups: current - 1 });
                          }
                        } catch (err: any) { alert(err.message); }
                      }}
                      className="bg-stone-800 hover:bg-stone-700 text-stone-300 w-5 h-5 flex items-center justify-center rounded cursor-pointer font-bold border border-stone-700 font-sans"
                    >
                      -
                    </button>
                  </div>

                  <div className="w-px h-4 bg-stone-850" />

                  <button 
                    onClick={async () => {
                      try {
                        await updateDoc(doc(db, 'club_leads', member.id), { vip: !member.vip });
                      } catch (err: any) { alert(err.message); }
                    }}
                    className="text-stone-400 hover:text-amber-500 underline cursor-pointer font-sans"
                  >
                    Toggle VIP Priority
                  </button>

                  <div className="w-px h-4 bg-stone-850" />

                  <button 
                    onClick={async () => {
                      try {
                        const targetStatus = member.status === 'active' ? 'standby' : 'active';
                        await updateDoc(doc(db, 'club_leads', member.id), { 
                           status: targetStatus,
                           activatedAt: targetStatus === 'active' ? new Date().toISOString() : null
                        });
                      } catch (err: any) { alert(err.message); }
                    }}
                    className="text-stone-400 hover:text-amber-500 underline cursor-pointer font-semibold font-sans"
                  >
                    Set to {member.status === 'active' ? 'Standby' : 'Active'}
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[9px] text-stone-600 font-mono">Added: {new Date(member.createdAt || Date.now()).toLocaleDateString()}</span>
                  <button 
                    onClick={async () => {
                      if (window.confirm(`Permanently remove member profile "${member.name}"?`)) {
                        try {
                          await deleteDoc(doc(db, 'club_leads', member.id));
                        } catch (err: any) { alert(err.message); }
                      }
                    }}
                    className="text-stone-600 hover:text-red-500 transition-colors p-1 hover:bg-stone-900 rounded cursor-pointer"
                    title="Delete member"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {member.notes && (
                <div className="text-[10px] text-stone-500 leading-relaxed italic bg-stone-900 p-2 rounded border border-stone-850 font-sans">
                  <span className="font-bold text-[8px] uppercase not-italic text-stone-600 block mb-0.5">ADMIN MEMO / LOG:</span>
                  {member.notes}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
