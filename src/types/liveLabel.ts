export interface LiveLabel {
  id: string;
  code: string; // URL / QR Slug (e.g., 'the-knowledge', 'jonahs-juice', 'serpents-sting')
  name: string;
  vintage: string;
  targetImageUrl: string; // The front bottle label image
  augmentedMediaType: 'video' | 'canvas_effect' | 'artwork_layer';
  augmentedMediaUrl?: string; // Video animation file (e.g. mp4, webm) or custom overlay
  canvasEffectType: 'harvest_mist' | 'golden_amber_rings' | 'fermentation_spark' | 'orchard_breeze';
  audioNarrationUrl?: string; // Voiceover / orchard soundscape
  audioTitle?: string;
  narratorName?: string;
  terroirNotes: {
    elevation: string;
    varietals: string;
    abv: string;
    sweetness: string;
    pairing: string;
    storyQuote: string;
  };
  ctaType: 'shop' | 'club' | 'custom';
  ctaLabel: string;
  ctaUrl: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export const DEFAULT_LIVE_LABELS: LiveLabel[] = [
  {
    id: 'label-the-knowledge',
    code: 'the-knowledge',
    name: 'The Knowledge Heritage Cider',
    vintage: '2024 Estate Reserve',
    targetImageUrl: '/assets/ciders/(store)The_knowedge.webp',
    augmentedMediaType: 'video',
    augmentedMediaUrl: '/assets/Enter Eden Splash/EnterEden copy.mp4',
    canvasEffectType: 'golden_amber_rings',
    audioNarrationUrl: 'https://assets.mixkit.co/active_storage/sfx/2464/2464-preview.mp3',
    audioTitle: 'Cellar Terroir & Slow Oak Fermentation',
    narratorName: 'Travis Godley (Founder & Cidermaker)',
    terroirNotes: {
      elevation: '1,450 ft Sierra Foothills',
      varietals: 'Roxbury Russet, Gravenstein & Sierra Wildings',
      abv: '7.8% ABV',
      sweetness: 'Bone Dry (0.0% RS)',
      pairing: 'Aged Sierra Cheddar, Smoked Duck & Roasted Walnuts',
      storyQuote: 'Hand-picked from untamed pre-prohibition homestead orchards, cold-fermented in French oak for 9 months.'
    },
    ctaType: 'shop',
    ctaLabel: 'Order 2024 Allocation',
    ctaUrl: '/shop',
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'label-jonahs-juice',
    code: 'jonahs-juice',
    name: "Jonah's Juice High Elevation Cider",
    vintage: '2024 Foothill Crisp',
    targetImageUrl: "/assets/ciders/(store)Jonah's Juice.webp",
    augmentedMediaType: 'canvas_effect',
    canvasEffectType: 'harvest_mist',
    audioNarrationUrl: 'https://assets.mixkit.co/active_storage/sfx/2464/2464-preview.mp3',
    audioTitle: 'High Elevation Tart Acidity & Granite Soils',
    narratorName: 'Travis Godley',
    terroirNotes: {
      elevation: '2,100 ft Placer Ridge',
      varietals: 'Arkansas Black, Winesap & Kingston Black',
      abv: '7.2% ABV',
      sweetness: 'Brut Nature (Ultra Dry)',
      pairing: 'Charred Pork Belly, Point Reyes Blue & Tart Green Apple',
      storyQuote: 'Crisp mountain nights yield razor-sharp acid structures and unmistakable alpine minerality.'
    },
    ctaType: 'club',
    ctaLabel: 'Reserve via Charter Club',
    ctaUrl: '/club',
    active: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'label-serpents-sting',
    code: 'serpents-sting',
    name: "Serpent's Sting Tannic Harvest",
    vintage: '2023 Wildwood Release',
    targetImageUrl: '/assets/ciders/(store)Serpents_Sting.webp',
    augmentedMediaType: 'canvas_effect',
    canvasEffectType: 'fermentation_spark',
    audioNarrationUrl: 'https://assets.mixkit.co/active_storage/sfx/2464/2464-preview.mp3',
    audioTitle: 'Wild Tannins & Old-World Bittersweet Apples',
    narratorName: 'Cellar Master Notes',
    terroirNotes: {
      elevation: '1,200 ft Deep Gulch',
      varietals: 'Bittersweet Sierra Crabapples & Dabinett',
      abv: '8.4% ABV',
      sweetness: 'Dry & Grippy',
      pairing: 'Wild Boar Sausage, Aged Gouda & Charcuterie',
      storyQuote: 'Deeply astringent and structured, delivering velvet tannins reminiscent of a Northern Rhône Syrah.'
    },
    ctaType: 'shop',
    ctaLabel: 'View Limited Bottles',
    ctaUrl: '/shop',
    active: true,
    createdAt: new Date().toISOString()
  }
];
