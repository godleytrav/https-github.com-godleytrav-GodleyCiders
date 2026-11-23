import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  QrCode, 
  Plus, 
  Trash2, 
  Edit3, 
  Download, 
  Printer, 
  ExternalLink, 
  Camera, 
  Volume2, 
  Save, 
  Check, 
  X, 
  Eye, 
  Upload, 
  Image as ImageIcon,
  Video,
  FileText,
  Mountain,
  Wine
} from 'lucide-react';
import { LiveLabel, DEFAULT_LIVE_LABELS } from '../../types/liveLabel';
import { generateLiveLabelQRDataUrl } from '../../utils/qrGenerator';

interface LiveLabelAdminProps {
  passcode: string;
}

export const LiveLabelAdmin: React.FC<LiveLabelAdminProps> = ({ passcode }) => {
  const [labels, setLabels] = useState<LiveLabel[]>(DEFAULT_LIVE_LABELS);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Modal / Form states
  const [editingLabel, setEditingLabel] = useState<LiveLabel | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [qrModalLabel, setQrModalLabel] = useState<LiveLabel | null>(null);
  const [generatedQrUrl, setGeneratedQrUrl] = useState<string>('');

  // Fetch labels from server
  const loadLabels = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/live-labels');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.labels) && data.labels.length > 0) {
          setLabels(data.labels);
        }
      }
    } catch (err) {
      console.warn("Failed to load live labels from server:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLabels();
  }, []);

  // Open QR badge generator
  const handleOpenQR = async (label: LiveLabel) => {
    setQrModalLabel(label);
    try {
      const qrData = await generateLiveLabelQRDataUrl(label.code, window.location.origin);
      setGeneratedQrUrl(qrData);
    } catch (e) {
      console.error("QR Generation failed:", e);
    }
  };

  // Start new label
  const handleStartNew = () => {
    const newLbl: LiveLabel = {
      id: `label-${Date.now()}`,
      code: `vintage-${labels.length + 1}`,
      name: 'New Heritage Vintage',
      vintage: '2025 Reserve',
      targetImageUrl: '/assets/ciders/(store)The_knowedge.webp',
      augmentedMediaType: 'canvas_effect',
      canvasEffectType: 'golden_amber_rings',
      audioNarrationUrl: 'https://assets.mixkit.co/active_storage/sfx/2464/2464-preview.mp3',
      audioTitle: 'Cellar Notes & Wild Ferment',
      narratorName: 'Travis Godley',
      terroirNotes: {
        elevation: '1,600 ft Placer Foothills',
        varietals: 'Roxbury Russet & Gravenstein',
        abv: '7.5% ABV',
        sweetness: 'Dry (0.0% RS)',
        pairing: 'Aged Cheddar & Charcuterie',
        storyQuote: 'Hand-pressed on vintage hydraulic presses in the Sierra foothills.'
      },
      ctaType: 'shop',
      ctaLabel: 'Order Bottles',
      ctaUrl: '/shop',
      active: true,
      createdAt: new Date().toISOString()
    };
    setEditingLabel(newLbl);
    setIsCreatingNew(true);
  };

  // Save label to Firestore via Admin API
  const handleSaveLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLabel) return;

    try {
      setSaveStatus('Saving...');
      const res = await fetch('/api/admin/live-labels/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passcode: passcode || '1234',
          label: editingLabel
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save label');
      }

      setSaveStatus('Saved successfully!');
      setTimeout(() => setSaveStatus(null), 3000);
      setEditingLabel(null);
      setIsCreatingNew(false);
      loadLabels();
    } catch (err: any) {
      console.error(err);
      setSaveStatus(`Error: ${err.message}`);
    }
  };

  // Delete label
  const handleDeleteLabel = async (labelId: string) => {
    if (!window.confirm("Are you sure you want to delete this Live Label configuration?")) return;

    try {
      const res = await fetch('/api/admin/live-labels/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passcode: passcode || '1234',
          labelId
        })
      });

      if (res.ok) {
        loadLabels();
      } else {
        alert("Failed to delete label.");
      }
    } catch (e) {
      console.error(e);
      alert("Error deleting label.");
    }
  };

  // Image Upload helper (converts to base64 data url)
  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result && editingLabel) {
        setEditingLabel({
          ...editingLabel,
          targetImageUrl: e.target.result as string
        });
      }
    };
    reader.readAsDataURL(file);
  };

  // Media / Video Upload helper
  const handleVideoUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result && editingLabel) {
        setEditingLabel({
          ...editingLabel,
          augmentedMediaUrl: e.target.result as string,
          augmentedMediaType: 'video'
        });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* SECTION HEADER */}
      <div className="bg-stone-900/40 border border-stone-800 p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="text-amber-500" size={18} />
            <h2 className="text-xl font-serif font-bold text-stone-100 tracking-wide">
              AR Live Label Studio & QR Dispatcher
            </h2>
          </div>
          <p className="text-stone-400 text-xs mt-1 max-w-2xl leading-relaxed">
            Manage interactive Augmented Reality bottle experiences. Link your front bottle artwork or discrete QR codes (printed on neck tags or table tents) to living video loops, Sierra foothill mist, and cellar tasting audio.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/live"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-stone-800 hover:bg-stone-750 text-stone-200 border border-stone-700 flex items-center gap-1.5 transition-colors"
          >
            <Camera size={14} className="text-amber-500" />
            <span>Open AR Scanner</span>
            <ExternalLink size={12} className="text-stone-400" />
          </a>

          <button
            onClick={handleStartNew}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={15} />
            <span>New Live Label</span>
          </button>
        </div>
      </div>

      {saveStatus && (
        <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
          saveStatus.includes('Error') 
            ? 'bg-red-950/60 border border-red-800/80 text-red-200' 
            : 'bg-emerald-950/60 border border-emerald-800/80 text-emerald-200'
        }`}>
          {saveStatus.includes('Error') ? <X size={14} /> : <Check size={14} />}
          <span>{saveStatus}</span>
        </div>
      )}

      {/* LABELS CARD GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {labels.map((lbl) => (
          <div
            key={lbl.id}
            className="bg-stone-900/30 border border-stone-800 rounded-2xl overflow-hidden hover:border-stone-750 transition-all flex flex-col justify-between"
          >
            {/* Top Preview Banner */}
            <div className="relative bg-stone-950/80 p-4 border-b border-stone-850 flex items-center gap-4">
              <div className="w-16 h-24 bg-stone-900 rounded-lg p-1 border border-stone-800 flex items-center justify-center shrink-0 overflow-hidden">
                <img
                  src={lbl.targetImageUrl}
                  alt={lbl.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain filter drop-shadow-md"
                />
              </div>

              <div className="overflow-hidden flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${lbl.active ? 'bg-emerald-500' : 'bg-stone-600'}`} />
                  <span className="text-[10px] font-mono tracking-widest text-amber-500 uppercase">
                    {lbl.vintage || 'Vintage'}
                  </span>
                </div>
                <h3 className="font-serif font-bold text-sm text-stone-100 truncate mt-0.5">
                  {lbl.name}
                </h3>
                <p className="text-[10px] font-mono text-stone-400 mt-1 truncate">
                  QR Code: <span className="text-stone-300 font-semibold">{lbl.code}</span>
                </p>

                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-stone-800/80 text-stone-300 border border-stone-700">
                    {lbl.augmentedMediaType === 'video' ? 'Video Animation' : 'Particle Canvas'}
                  </span>
                  {lbl.audioNarrationUrl && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-950/40 text-amber-400 border border-amber-800/40 flex items-center gap-1">
                      <Volume2 size={10} /> Audio
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Terroir & Pairing Summary */}
            <div className="p-4 space-y-2 text-xs flex-1">
              <div className="flex items-start gap-1.5 text-stone-400">
                <Mountain size={13} className="text-amber-500 shrink-0 mt-0.5" />
                <span className="text-stone-300 text-[11px] truncate">
                  {lbl.terroirNotes.elevation || 'Foothill Terroir'}
                </span>
              </div>
              <div className="flex items-start gap-1.5 text-stone-400">
                <Wine size={13} className="text-amber-500 shrink-0 mt-0.5" />
                <span className="text-stone-300 text-[11px] truncate">
                  {lbl.terroirNotes.varietals || 'Heritage Apples'}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-3 bg-stone-950/60 border-t border-stone-850 flex items-center justify-between gap-2">
              <button
                onClick={() => handleOpenQR(lbl)}
                className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-750 text-stone-200 text-xs font-semibold flex items-center gap-1 border border-stone-700 cursor-pointer"
                title="Generate and Print QR Code"
              >
                <QrCode size={13} className="text-amber-500" />
                <span>QR Badge</span>
              </button>

              <div className="flex items-center gap-1.5">
                <a
                  href={`/live?code=${lbl.code}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-white border border-stone-800"
                  title="Test Live in AR View"
                >
                  <Eye size={14} />
                </a>

                <button
                  onClick={() => {
                    setEditingLabel(lbl);
                    setIsCreatingNew(false);
                  }}
                  className="p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-white border border-stone-800 cursor-pointer"
                  title="Edit Configuration"
                >
                  <Edit3 size={14} />
                </button>

                <button
                  onClick={() => handleDeleteLabel(lbl.id)}
                  className="p-1.5 rounded-lg bg-stone-900 hover:bg-red-950 text-stone-400 hover:text-red-400 border border-stone-800 cursor-pointer"
                  title="Delete Live Label"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ======================================================== */}
      {/* 2. CREATE / EDIT MODAL                                   */}
      {/* ======================================================== */}
      {editingLabel && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-stone-950 border border-stone-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-stone-850 pb-4">
              <div>
                <h3 className="text-lg font-serif font-bold text-stone-100 flex items-center gap-2">
                  <Sparkles size={16} className="text-amber-500" />
                  {isCreatingNew ? 'Create New Live Label' : `Edit: ${editingLabel.name}`}
                </h3>
                <p className="text-xs text-stone-400">
                  Configure the visual targets, animated media overlays, and QR code identifiers
                </p>
              </div>
              <button
                onClick={() => setEditingLabel(null)}
                className="p-2 rounded-lg text-stone-400 hover:text-white bg-stone-900 border border-stone-800 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveLabel} className="space-y-5 text-xs">
              {/* Row 1: Name, Vintage, QR Code Slug */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-stone-400 tracking-wider block mb-1">
                    Label / Cider Name *
                  </label>
                  <input
                    type="text"
                    value={editingLabel.name}
                    onChange={(e) => setEditingLabel({ ...editingLabel, name: e.target.value })}
                    required
                    placeholder="e.g. The Knowledge Heritage"
                    className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-200 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-stone-400 tracking-wider block mb-1">
                    Vintage / Batch
                  </label>
                  <input
                    type="text"
                    value={editingLabel.vintage}
                    onChange={(e) => setEditingLabel({ ...editingLabel, vintage: e.target.value })}
                    placeholder="e.g. 2024 Estate Reserve"
                    className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-200 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-stone-400 tracking-wider block mb-1">
                    QR Slug (URL identifier) *
                  </label>
                  <input
                    type="text"
                    value={editingLabel.code}
                    onChange={(e) => setEditingLabel({ ...editingLabel, code: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-') })}
                    required
                    placeholder="e.g. the-knowledge"
                    className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-amber-400 font-mono focus:border-amber-500 focus:outline-none"
                  />
                  <span className="text-[9px] text-stone-500 mt-0.5 block">
                    URL: /live?code={editingLabel.code}
                  </span>
                </div>
              </div>

              {/* Row 2: Target Bottle Artwork */}
              <div className="bg-stone-900/40 border border-stone-850 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase font-bold text-stone-300 tracking-wider flex items-center gap-1.5">
                    <ImageIcon size={14} className="text-amber-500" />
                    Target Front Bottle Label Image *
                  </label>
                  <span className="text-[10px] text-stone-400">Used for camera vision matching</span>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-20 h-28 bg-stone-950 rounded-xl border border-stone-800 flex items-center justify-center p-1 overflow-hidden shrink-0">
                    <img
                      src={editingLabel.targetImageUrl}
                      alt="Label Target"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={editingLabel.targetImageUrl}
                      onChange={(e) => setEditingLabel({ ...editingLabel, targetImageUrl: e.target.value })}
                      placeholder="Image URL or Asset Path (e.g. /assets/ciders/(store)The_knowedge.webp)"
                      className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-300 focus:border-amber-500 focus:outline-none"
                    />

                    <div className="flex items-center gap-2">
                      <label className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-750 text-stone-300 border border-stone-700 cursor-pointer flex items-center gap-1.5">
                        <Upload size={12} />
                        <span>Upload New Label Image</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) handleImageUpload(e.target.files[0]);
                          }}
                        />
                      </label>
                      <span className="text-[10px] text-stone-500">Supports PNG, WEBP, JPEG</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 3: Augmented Reality Layer & Effects */}
              <div className="bg-stone-900/40 border border-stone-850 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase font-bold text-stone-300 tracking-wider flex items-center gap-1.5">
                    <Video size={14} className="text-amber-500" />
                    Augmented Layer & Animation
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-stone-400 block mb-1">Layer Type</label>
                    <select
                      value={editingLabel.augmentedMediaType}
                      onChange={(e) => setEditingLabel({ ...editingLabel, augmentedMediaType: e.target.value as any })}
                      className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-200 focus:border-amber-500 focus:outline-none"
                    >
                      <option value="canvas_effect">Living Canvas Terroir Particles & Mist</option>
                      <option value="video">Animated Video Overlay Loop</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-stone-400 block mb-1">Atmospheric Canvas Shader</label>
                    <select
                      value={editingLabel.canvasEffectType}
                      onChange={(e) => setEditingLabel({ ...editingLabel, canvasEffectType: e.target.value as any })}
                      className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-200 focus:border-amber-500 focus:outline-none"
                    >
                      <option value="golden_amber_rings">Golden Amber Terroir Rings</option>
                      <option value="harvest_mist">Sierra Foothill Morning Mist</option>
                      <option value="fermentation_spark">Fine Cider Fermentation Bubbles</option>
                    </select>
                  </div>
                </div>

                {editingLabel.augmentedMediaType === 'video' && (
                  <div className="space-y-2 pt-2 border-t border-stone-800">
                    <label className="text-[10px] text-stone-400 block">Video Overlay Asset (MP4/WebM)</label>
                    <input
                      type="text"
                      value={editingLabel.augmentedMediaUrl || ''}
                      onChange={(e) => setEditingLabel({ ...editingLabel, augmentedMediaUrl: e.target.value })}
                      placeholder="e.g. /assets/Enter Eden Splash/EnterEden copy.mp4"
                      className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-300 focus:border-amber-500 focus:outline-none"
                    />
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-750 text-stone-300 border border-stone-700 cursor-pointer">
                      <Upload size={12} />
                      <span>Upload Video Loop</span>
                      <input
                        type="file"
                        accept="video/mp4,video/webm"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) handleVideoUpload(e.target.files[0]);
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Row 4: Audio Voiceover Narration */}
              <div className="bg-stone-900/40 border border-stone-850 p-4 rounded-2xl space-y-3">
                <label className="text-[10px] uppercase font-bold text-stone-300 tracking-wider flex items-center gap-1.5">
                  <Volume2 size={14} className="text-amber-500" />
                  Cidermaker Spoken Narration or Soundscape
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-stone-400 block mb-1">Audio Audio URL or MP3</label>
                    <input
                      type="text"
                      value={editingLabel.audioNarrationUrl || ''}
                      onChange={(e) => setEditingLabel({ ...editingLabel, audioNarrationUrl: e.target.value })}
                      placeholder="https://... or /assets/...mp3"
                      className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-300 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-stone-400 block mb-1">Narration Title / Speaker</label>
                    <input
                      type="text"
                      value={editingLabel.narratorName || ''}
                      onChange={(e) => setEditingLabel({ ...editingLabel, narratorName: e.target.value })}
                      placeholder="Travis Godley (Founder & Cidermaker)"
                      className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-300 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Row 5: Terroir Notes & Food Pairing */}
              <div className="bg-stone-900/40 border border-stone-850 p-4 rounded-2xl space-y-3">
                <label className="text-[10px] uppercase font-bold text-stone-300 tracking-wider flex items-center gap-1.5">
                  <FileText size={14} className="text-amber-500" />
                  Terroir Data & Sommelier Notes
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-stone-400 block mb-1">Orchard Elevation</label>
                    <input
                      type="text"
                      value={editingLabel.terroirNotes.elevation}
                      onChange={(e) => setEditingLabel({
                        ...editingLabel,
                        terroirNotes: { ...editingLabel.terroirNotes, elevation: e.target.value }
                      })}
                      placeholder="e.g. 1,450 ft Sierra Foothills"
                      className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-300"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-stone-400 block mb-1">Varietal Blend</label>
                    <input
                      type="text"
                      value={editingLabel.terroirNotes.varietals}
                      onChange={(e) => setEditingLabel({
                        ...editingLabel,
                        terroirNotes: { ...editingLabel.terroirNotes, varietals: e.target.value }
                      })}
                      placeholder="e.g. Roxbury Russet, Gravenstein"
                      className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-300"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-stone-400 block mb-1">ABV & Dryness</label>
                    <input
                      type="text"
                      value={editingLabel.terroirNotes.abv}
                      onChange={(e) => setEditingLabel({
                        ...editingLabel,
                        terroirNotes: { ...editingLabel.terroirNotes, abv: e.target.value }
                      })}
                      placeholder="e.g. 7.8% ABV • Bone Dry"
                      className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-300"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-stone-400 block mb-1">Recommended Pairing</label>
                    <input
                      type="text"
                      value={editingLabel.terroirNotes.pairing}
                      onChange={(e) => setEditingLabel({
                        ...editingLabel,
                        terroirNotes: { ...editingLabel.terroirNotes, pairing: e.target.value }
                      })}
                      placeholder="e.g. Aged Sierra Cheddar & Smoked Duck"
                      className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-stone-400 block mb-1">Cellar Story / Quote</label>
                  <textarea
                    rows={2}
                    value={editingLabel.terroirNotes.storyQuote}
                    onChange={(e) => setEditingLabel({
                      ...editingLabel,
                      terroirNotes: { ...editingLabel.terroirNotes, storyQuote: e.target.value }
                    })}
                    placeholder="Wild-fermented in French oak for 9 months..."
                    className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-300 resize-none"
                  />
                </div>
              </div>

              {/* Row 6: CTA Link & Active Checkbox */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                <div>
                  <label className="text-[10px] uppercase font-bold text-stone-400 tracking-wider block mb-1">
                    Button Label
                  </label>
                  <input
                    type="text"
                    value={editingLabel.ctaLabel}
                    onChange={(e) => setEditingLabel({ ...editingLabel, ctaLabel: e.target.value })}
                    placeholder="Order Vintage"
                    className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-300"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-stone-400 tracking-wider block mb-1">
                    Button Destination
                  </label>
                  <input
                    type="text"
                    value={editingLabel.ctaUrl}
                    onChange={(e) => setEditingLabel({ ...editingLabel, ctaUrl: e.target.value })}
                    placeholder="/shop or /club"
                    className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-stone-300"
                  />
                </div>

                <div className="pt-4 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="lbl-active"
                    checked={editingLabel.active}
                    onChange={(e) => setEditingLabel({ ...editingLabel, active: e.target.checked })}
                    className="w-4 h-4 text-amber-500 rounded border-stone-700 bg-stone-900"
                  />
                  <label htmlFor="lbl-active" className="text-xs text-stone-300 font-semibold cursor-pointer">
                    Active in Live Scanner
                  </label>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-850">
                <button
                  type="button"
                  onClick={() => setEditingLabel(null)}
                  className="px-4 py-2 rounded-xl text-stone-400 hover:text-white bg-stone-900 border border-stone-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold uppercase tracking-wider shadow-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Save size={15} />
                  <span>Save Live Label</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. PRINTABLE QR BOTTLE COLLAR / TABLE TENT MODAL         */}
      {/* ======================================================== */}
      {qrModalLabel && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-stone-950 border border-stone-800 rounded-3xl max-w-md w-full p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-stone-850 pb-3">
              <div>
                <h3 className="font-serif text-lg text-stone-100 font-bold">
                  Printable Live Label QR Badge
                </h3>
                <p className="text-xs text-stone-400">
                  Ready for bottle neck tags, back labels, or taproom coasters
                </p>
              </div>
              <button
                onClick={() => setQrModalLabel(null)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-white bg-stone-900 border border-stone-800 cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Printable Badge Card Preview */}
            <div id="printable-qr-badge" className="bg-[#fcfbf9] text-stone-900 p-6 rounded-2xl border border-stone-300 text-center shadow-xl space-y-4">
              <div className="border-b border-stone-300 pb-3">
                <span className="text-[10px] font-mono tracking-widest uppercase font-bold text-amber-800 block">
                  Godley Ciders • Sierra Foothills
                </span>
                <h4 className="font-serif text-base font-bold tracking-wide mt-0.5">
                  {qrModalLabel.name}
                </h4>
                <p className="text-xs text-stone-600 font-serif italic">
                  {qrModalLabel.vintage}
                </p>
              </div>

              {/* QR Image */}
              <div className="flex justify-center my-2">
                {generatedQrUrl ? (
                  <img
                    src={generatedQrUrl}
                    alt="QR Code"
                    className="w-44 h-44 rounded-xl border border-stone-300 p-1 bg-white shadow-sm"
                  />
                ) : (
                  <div className="w-44 h-44 bg-stone-200 animate-pulse rounded-xl flex items-center justify-center">
                    <span className="text-xs text-stone-500">Generating...</span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-xs font-sans font-bold tracking-wide text-stone-800">
                  Aim camera to bring this label to life
                </p>
                <p className="text-[10px] text-stone-500 font-mono">
                  {window.location.origin}/live?code={qrModalLabel.code}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <a
                href={generatedQrUrl}
                download={`godley-qr-${qrModalLabel.code}.png`}
                className="flex-1 py-2 px-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-200 border border-stone-800 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Download size={14} className="text-amber-500" />
                <span>Download PNG</span>
              </a>

              <button
                onClick={() => window.print()}
                className="flex-1 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs uppercase tracking-wider shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer size={14} />
                <span>Print Badge</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
