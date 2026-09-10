import { create } from 'zustand';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

interface StoryText {
  text: string;
  start: number;
  end: number;
}

interface AnatomyHotspot {
  id: string;
  title: string;
  description: string;
  x: number;
  y: number;
}

interface ProductHotspot {
  id: string;
  title: string;
  description: string;
  x: number;
  y: number;
}

interface Product {
  id: string;
  name: string;
  vintage: string;
  imageUrl: string;
  description: string;
  hotspots: ProductHotspot[];
}

interface HomeSettings {
  heroTitle: string;
  heroSubtitle: string;
  anatomySectionTitle: string;
  anatomySectionSubtitle: string;
  storyTitle: string;
  storyBody: string;
  storyButtonText: string;
  heroTitleColor: string;
  heroTitleFont: string;
  heroTitleSize: string;
}

interface ClubSettings {
  title: string;
  subtitle: string;
  corePrice: string;
  branchPrice: string;
  heritagePrice: string;
  maxMembers?: string;
  isWaitlistMode?: boolean;
  activeSpotsAvailable?: string;
  portalPasscode?: string;
  coreActiveSpotsAvailable?: string;
  branchActiveSpotsAvailable?: string;
  heritageActiveSpotsAvailable?: string;
  coreMaxMembers?: string;
  branchMaxMembers?: string;
  heritageMaxMembers?: string;
}

interface WholesaleSettings {
  title: string;
  subtitle: string;
  email: string;
  phone: string;
  body: string;
}

interface StorySettings {
  title: string;
  subtitle: string;
  body1: string;
  body2: string;
  imageUrl: string;
  scenes: Scene[];
}

export interface Hitbox {
  id: string;
  timeStart: number;
  timeEnd: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  targetSceneId: string;
  dialogue?: string;
}

export interface Scene {
  id: string;
  videoUrl: string;
  hitboxes: Hitbox[];
}


interface ShopSettings {
  title: string;
  subtitle: string;
}

interface SocialSettings {
  instagramUrl: string;
  facebookUrl: string;
  tiktokUrl: string;
  youtubeUrl: string;
}

interface ShopProduct {
  id: string;
  name: string;
  type: string;
  description: string;
  price: number;
  image: string;
  available: boolean;
  category?: 'cider' | 'merch';
  inventoryCount?: number;
}

interface AdminState {
  // Global / Generic
  showAdminPanel: boolean;
  toggleAdminPanel: () => void;

  // Social Settings
  socialSettings: SocialSettings;
  setSocialSettings: (settings: Partial<SocialSettings>) => void;

  // Splash
  splashVideoUrl: string;
  setSplashVideoUrl: (url: string) => void;
  splashStoryTexts: StoryText[];
  setSplashStoryText: (index: number, text: string) => void;

  // Anatomy
  anatomyImageUrl: string;
  setAnatomyImageUrl: (url: string) => void;
  anatomyHotspots: AnatomyHotspot[];
  setAnatomyHotspot: (index: number, hotspot: AnatomyHotspot) => void;

  // Home Settings
  homeSettings: HomeSettings;
  setHomeSettings: (settings: Partial<HomeSettings>) => void;

  // Club Settings
  clubSettings: ClubSettings;
  setClubSettings: (settings: Partial<ClubSettings>) => void;

  // Wholesale Settings
  wholesaleSettings: WholesaleSettings;
  setWholesaleSettings: (settings: Partial<WholesaleSettings>) => void;

  // Story Settings
  storySettings: StorySettings;
  setStorySettings: (settings: Partial<StorySettings>) => void;
  setStoryScene: (sceneIndex: number, scene: Partial<Scene>) => void;
  setStorySceneHitbox: (sceneIndex: number, hitboxIndex: number, hitbox: Partial<Hitbox>) => void;

  // Shop Settings & Products
  shopSettings: ShopSettings;
  setShopSettings: (settings: Partial<ShopSettings>) => void;
  shopProducts: ShopProduct[];
  setShopProduct: (index: number, product: Partial<ShopProduct>) => void;
  addShopProduct: (product: Omit<ShopProduct, 'id'> & { id?: string }) => void;
  deleteShopProduct: (index: number) => void;

  // Products
  products: Product[];
  setProduct: (index: number, product: Partial<Product>) => void;
  setProductHotspot: (productIndex: number, hotspotIndex: number, hotspot: ProductHotspot) => void;
  loadFromFirebase: () => void;
  saveToFirebase: () => Promise<void>;
  decrementInventory: (items: Array<{id: string, quantity: number}>) => Promise<void>;
  
  // Dev Bypasses
  devBypassWholesale: boolean;
  toggleDevBypassWholesale: () => void;
  devBypassClub: boolean;
  toggleDevBypassClub: () => void;
}

export const useAdminStore = create<AdminState>((set) => ({
  showAdminPanel: false,
  toggleAdminPanel: () => set((state) => ({ showAdminPanel: !state.showAdminPanel })),

  socialSettings: {
    instagramUrl: "https://instagram.com/godleyciders",
    facebookUrl: "https://facebook.com/godleyciders",
    tiktokUrl: "https://tiktok.com/@godleyciders",
    youtubeUrl: "https://youtube.com/@godleyciders",
  },
  setSocialSettings: (settings) => set((state) => ({ socialSettings: { ...state.socialSettings, ...settings } })),

  devBypassWholesale: false,
  toggleDevBypassWholesale: () => set((state) => ({ devBypassWholesale: !state.devBypassWholesale })),
  devBypassClub: false,
  toggleDevBypassClub: () => set((state) => ({ devBypassClub: !state.devBypassClub })),

  splashVideoUrl: "https://drive.google.com/file/d/1StgdM-3nnejnvn4tsYpZwvbH75rNNET7/view?usp=drive_link",
  setSplashVideoUrl: (url) => set({ splashVideoUrl: url }),

  splashStoryTexts: [
    { text: "Godley Ciders", start: 0, end: 0.10 },
    { text: "In the Beginning", start: 0.15, end: 0.25 },
    { text: "There Were Two Trees", start: 0.35, end: 0.50 },
    { text: "The Tree of Life", start: 0.55, end: 0.75 },
    { text: "The Tree Of Knowledge", start: 0.80, end: 0.95 }
  ],
  setSplashStoryText: (index, text) => set((state) => {
    const newTexts = [...state.splashStoryTexts];
    newTexts[index].text = text;
    return { splashStoryTexts: newTexts };
  }),

  anatomyImageUrl: "/assets/app/anatomy of an apple.png",
  setAnatomyImageUrl: (url) => set({ anatomyImageUrl: url }),
  
  anatomyHotspots: [
    { id: "1", title: "The Bouquet", description: "Lift the glass to find notes of ripened peel, forest floor, and the faint, vinous ghost of wild fermentation.", x: 44, y: 15 },
    { id: "2", title: "The Crown", description: "A delicate 'mousse' or foam at the rim is the mark of traditional conditioning. It carries the aroma to your senses.", x: 50, y: 25 },
    { id: "3", title: "The Effervescence", description: "Observe the 'bead'—the tiny bubbles are natural, lifting the heavier tannins of the bittersweet fruit.", x: 50, y: 50 },
    { id: "4", title: "The Visual Hue", description: "The deep amber-gold is an honest reflection of the fruit's skin and the oxidation during the press.", x: 55, y: 70 },
    { id: "5", title: "The Palate", description: "The structure of the liquid should wash over the tongue with a drying, astringent finish.", x: 40, y: 60 }
  ],
  setAnatomyHotspot: (index, hotspot) => set((state) => {
    const newHotspots = [...state.anatomyHotspots];
    newHotspots[index] = hotspot;
    return { anatomyHotspots: newHotspots };
  }),

  homeSettings: {
    heroTitle: "Fruits of the Earth",
    heroSubtitle: "Fermented with patience. Crafted for the reverent. Welcome to Godley Ciders.",
    anatomySectionTitle: "Anatomy\nof the Press",
    anatomySectionSubtitle: "Click the illustration below to interact and uncover the layers of our traditional crafting process.",
    storyTitle: "Rooted in Tradition",
    storyBody: "Our ciders are born in the orchards, where the bittersweet and bittersharp apples draw their complexity from the soil. Every bottle we produce is a testament to the old ways—slow fermentations, natural conditioning, and a profound respect for the fruit.",
    storyButtonText: "Read Our Story",
    heroTitleColor: "text-amber-50",
    heroTitleFont: "font-serif",
    heroTitleSize: "text-5xl md:text-7xl lg:text-8xl",
  },
  setHomeSettings: (settings) => set((state) => ({ homeSettings: { ...state.homeSettings, ...settings } })),

  clubSettings: {
    title: "The Fellowship",
    subtitle: "Join the inner circle of Godley Ciders. Receive allocated releases, exclusive invitations, and the stories behind the juice.",
    corePrice: "25",
    branchPrice: "30",
    heritagePrice: "45",
    maxMembers: "150",
    isWaitlistMode: true,
    activeSpotsAvailable: "0",
    portalPasscode: "1234",
    coreActiveSpotsAvailable: "0",
    branchActiveSpotsAvailable: "0",
    heritageActiveSpotsAvailable: "0",
    coreMaxMembers: "200",
    branchMaxMembers: "100",
    heritageMaxMembers: "50",
  },
  setClubSettings: (settings) => set((state) => ({ clubSettings: { ...state.clubSettings, ...settings } })),

  wholesaleSettings: {
    title: "Trade & Wholesale",
    subtitle: "Pour Godley Ciders at your establishment.",
    email: "wholesale@godleyciders.com",
    phone: "(555) 123-4567",
    body: `We partner with restaurants, bars, and bottle shops that share our commitment to quality, provenance, and the craft of traditional cider making.\n\nDue to the small-batch nature of our production, wholesale allocations are limited. Please fill out the inquiry form, and our accounts team will be in touch to arrange a tasting and discuss availability.`,
  },
  setWholesaleSettings: (settings) => set((state) => ({ wholesaleSettings: { ...state.wholesaleSettings, ...settings } })),

  storySettings: {
    title: "Our Story",
    subtitle: "Creation. Corruption. Redemption. Told Through Cider.",
    body1: "With a dream and much prayer, God led us on an incredible journey to highlight His creation and redemptive love through fine ciders, perry, and wine. Building this haven hasn't always been easy. On the days we ask ourselves, \"What are we doing here?\" God provides the strength to keep walking the path.\n\nOur work relies on the same patient faith illustrated in Jesus’s first miracle at Cana. Before the water became wine, the servants had to labor—drawing heavy water from the well to fill massive vats. It was hard, quiet work, but the result was extraordinary: a wine celebrated as \"the best,\" served in abundance as a life-changing gift to the bride and groom. We bring that same dedication to every batch we press.",
    body2: "We believe hard cider is a living parable told through the senses:\n\nCreation: It begins quietly in the dirt with a single seed, growing over years into a mature tree that bears pristine, whole fruit.\n\nCorruption: The apples are harvested, crushed, and surrendered to wild fermentation. As yeast breaks down the fruit, it passes through a state of raw, unpalatable turmoil.\n\nRedemption: Guided by careful hands and patient aging, the liquid is transformed into a vibrant, renewed creation—a fine cider meant to be celebrated and shared.",
    imageUrl: "https://images.unsplash.com/photo-1506544777-64cfbea77cce?q=80&w=2070&auto=format&fit=crop",
    scenes: [
      {
        id: 'intro',
        videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        hitboxes: [
          {
            id: 'h1',
            timeStart: 2,
            timeEnd: 5,
            x: 20,
            y: 40,
            width: 20,
            height: 20,
            label: 'Examine Apples',
            targetSceneId: 'apples_close',
            dialogue: 'These heirloom apples have a distinct tartness. Perfect for our dry cider.'
          },
          {
            id: 'h2',
            timeStart: 6,
            timeEnd: 9,
            x: 60,
            y: 50,
            width: 15,
            height: 30,
            label: 'Check the Press',
            targetSceneId: 'press',
          }
        ]
      },
      {
        id: 'apples_close',
        videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
        hitboxes: [
          {
            id: 'h3',
            timeStart: 1,
            timeEnd: 4,
            x: 40,
            y: 40,
            width: 20,
            height: 20,
            label: 'Return',
            targetSceneId: 'intro',
          }
        ]
      },
      {
        id: 'press',
        videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
        hitboxes: [
          {
            id: 'h4',
            timeStart: 3,
            timeEnd: 8,
            x: 10,
            y: 10,
            width: 20,
            height: 20,
            label: 'Return',
            targetSceneId: 'intro',
          }
        ]
      }
    ]
  },
  setStorySettings: (settings) => set((state) => ({ storySettings: { ...state.storySettings, ...settings } })),
  setStoryScene: (sceneIndex, sceneData) => set((state) => {
    const newScenes = [...state.storySettings.scenes];
    newScenes[sceneIndex] = { ...newScenes[sceneIndex], ...sceneData };
    return { storySettings: { ...state.storySettings, scenes: newScenes } };
  }),
  setStorySceneHitbox: (sceneIndex, hitboxIndex, hitboxData) => set((state) => {
    const newScenes = [...state.storySettings.scenes];
    const newHitboxes = [...newScenes[sceneIndex].hitboxes];
    newHitboxes[hitboxIndex] = { ...newHitboxes[hitboxIndex], ...hitboxData };
    newScenes[sceneIndex] = { ...newScenes[sceneIndex], hitboxes: newHitboxes };
    return { storySettings: { ...state.storySettings, scenes: newScenes } };
  }),

  shopSettings: {
    title: "The Cellar",
    subtitle: "Direct from our presses to your table.",
  },
  setShopSettings: (settings) => set((state) => ({ shopSettings: { ...state.shopSettings, ...settings } })),

  shopProducts: [
    { id: "1", name: "The Knowledge", type: "Simi-Dry Cider", description: "Our flagship. Simi-dry, a timeless cider, showcasing the terroir from the Origen of its roots. Notes of apple, blossom, and earth.", price: 24, image: "/assets/ciders/(store)The_knowedge.webp", available: true, category: "cider", inventoryCount: 120 },
    { id: "2", name: "Serpents Sting", type: "Oak Aged", description: "Aged 12 months in French oak. Notes of vanilla, leather, and fallen leaves.", price: 32, image: "/assets/ciders/(store)Serpents_Sting.webp", available: true, category: "cider", inventoryCount: 45 },
    { id: "3", name: "Jonah's Juice", type: "Semi-Dry", description: "A balanced Aged Cider on Lees and French Oak, Slightly sweet, deeply complex. Notes of vanilla, almond and clove", price: 34, image: "/assets/ciders/(store)Jonah's Juice.webp", available: true, category: "cider", inventoryCount: 60 },
    { id: "merch_1", name: "Heritage Tree Embroidered Hoodie", type: "Premium Apparel", description: "Premium heavyweight black cotton pullover with an ultra-plush cream lined hood. Features highly detailed embroidery of our coiling 'G' heritage tree, deep roots, and ripe crimson apples. EST. 2024.", price: 95, image: "/assets/Merchandise /Hoody.jpg", available: true, category: "merch", inventoryCount: 12 },
    { id: "merch_2", name: "Gilded Rim Pint Glass", type: "Glassware & Bar", description: "A heavy-bottomed, collector-grade shaker glass finished with a hand-painted 24k gold rim. Adorned with a detailed screen-printed coiling tree 'G' signature seal. Perfect for capturing the effervescence of a cold Godley Cider.", price: 22, image: "/assets/Merchandise /Godley Glass.jpg", available: true, category: "merch", inventoryCount: 100 },
    { id: "merch_3", name: "Sierra Foothills Reading Bear Tote", type: "Dry Goods & Bags", description: "Natural organic cotton heavy-grade canvas tote, screen-printed with custom artwork celebrating our roots in Lincoln, CA. Depicts the reading boy beneath our heritage oak branch housing a curious little bear cub.", price: 30, image: "/assets/Merchandise /Godley Hand Bag.jpg", available: true, category: "merch", inventoryCount: 25 },
    { id: "merch_4", name: "Jonah's Juice Vintage Woodcut Tee", type: "Premium Apparel", description: "An exquisite vintage-washed organic cotton t-shirt displaying the original woodcut engraving of Jonah floating towards his whale companion. Custom commissioned for Godley Ciders.", price: 38, image: "/assets/Merchandise /Jonahs Juice T.jpg", available: true, category: "merch", inventoryCount: 30 },
    { id: "merch_5", name: "Serpent's Sting Trucker Hat", type: "Heritage Headwear", description: "A premium classic trucker hat with high-density embroidered 'Serpents Sting' orchard motif design on the front. Breathable mesh back with adjustable snapback closure.", price: 28, image: "/assets/Merchandise /Serpents Sting Trucker hat.jpg", available: true, category: "merch", inventoryCount: 40 }
  ],
  setShopProduct: (index, productData) => set((state) => {
    const newProducts = [...state.shopProducts];
    const imageCleaned = productData.image ? cleanImagePath(productData.image) : undefined;
    newProducts[index] = { 
      ...newProducts[index], 
      ...productData,
      ...(imageCleaned ? { image: imageCleaned } : {})
    };
    return { shopProducts: newProducts };
  }),

  addShopProduct: (productData) => set((state) => {
    const imageCleaned = productData.image ? cleanImagePath(productData.image) : '';
    const id = productData.id || `product_${Date.now()}`;
    const newProduct: ShopProduct = {
      id,
      name: productData.name,
      type: productData.type,
      description: productData.description,
      price: productData.price,
      image: imageCleaned || '/assets/ciders/(store)The_knowedge.webp',
      available: productData.inventoryCount ? productData.inventoryCount > 0 : true,
      category: productData.category || 'cider',
      inventoryCount: productData.inventoryCount ?? 10
    };
    return { shopProducts: [...state.shopProducts, newProduct] };
  }),

  deleteShopProduct: (index) => set((state) => {
    const newProducts = state.shopProducts.filter((_, i) => i !== index);
    return { shopProducts: newProducts };
  }),

  products: [
    {
      id: 'eden-reserve',
      name: "Eden Reserve",
      vintage: "2024",
      imageUrl: "/assets/ciders/The_knowedge.png",
      description: "A slow-fermented vintage cider made from late-harvest bittersweet apples.",
      hotspots: [
        { id: '1', title: "The Fruit", description: "Harvested from 50-year-old Dabinett trees in late November.", x: 50, y: 30 },
        { id: '2', title: "The Finish", description: "Notes of aged oak and dried apricot with a clean, tannic finish.", x: 45, y: 70 },
        { id: '3', title: "The Body", description: "Deep amber hue with a rich, semi-dry profile and subtle fizz.", x: 55, y: 50 }
      ]
    },
    {
      id: 'wild-wild-west',
      name: "Wild West",
      vintage: "Wild Ferment",
      imageUrl: "https://images.unsplash.com/photo-1543158022-de92929e5772?q=80&w=1000&auto=format&fit=crop",
      description: "Unfiltered, untamed, and fermented with indigenous yeasts from the orchard.",
      hotspots: [
        { id: '1', title: "The Ferment", description: "100% natural wild yeast fermentation lasting over 6 months.", x: 50, y: 40 },
        { id: '2', title: "Aroma", description: "Farmhouse funk meets bright green apple and hay.", x: 40, y: 60 },
        { id: '3', title: "The Cloud", description: "Intentionally hazy to preserve the full complexity of the fruit.", x: 60, y: 55 }
      ]
    }
  ],
  setProduct: (index, productData) => set((state) => {
    const newProducts = [...state.products];
    const imageCleaned = productData.imageUrl ? cleanImagePath(productData.imageUrl) : undefined;
    newProducts[index] = { 
      ...newProducts[index], 
      ...productData, 
      ...(imageCleaned ? { imageUrl: imageCleaned } : {}) 
    };
    return { products: newProducts };
  }),
  setProductHotspot: (productIndex, hotspotIndex, hotspot) => set((state) => {
    const newProducts = [...state.products];
    const newHotspots = [...newProducts[productIndex].hotspots];
    newHotspots[hotspotIndex] = hotspot;
    newProducts[productIndex] = { ...newProducts[productIndex], hotspots: newHotspots };
    return { products: newProducts };
  }),

  loadFromFirebase: () => {
    const docRef = doc(db, 'admin_settings', 'global');
    try {
      onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();

          let shopProducts = data.shopProducts ?? [];
          if (Array.isArray(shopProducts)) {
            shopProducts = shopProducts.map((p: any) => {
              let img = p.image;
              if (img) img = cleanImagePath(img);
              
              // Handle migrations of old mock paths to correct verified system paths
              if (p.id === "merch_1" && (!img || img.includes("merch_hoodie.png") || img === "/assets/merch_hoodie.png" || img.includes("Hoody.png"))) {
                img = "/assets/Merchandise /Hoody.jpg";
              } else if (p.id === "merch_2" && (!img || img.includes("gold_rim_glass.png") || img.includes("Godley Glass.png"))) {
                img = "/assets/Merchandise /Godley Glass.jpg";
              } else if (p.id === "merch_3" && (!img || img.includes("reading_bear_tote.png") || img.includes("Godley Hand Bag.png"))) {
                img = "/assets/Merchandise /Godley Hand Bag.jpg";
              } else if (p.id === "merch_4" && (!img || img.includes("jonahs_juice_tee.png") || img.includes("Jonahs Juice T.png"))) {
                img = "/assets/Merchandise /Jonahs Juice T.jpg";
              } else if (p.id === "merch_5" && (!img || img.includes("serpents_sting_hat.png") || img.includes("Serpents Sting Trucker hat.png"))) {
                img = "/assets/Merchandise /Serpents Sting Trucker hat.jpg";
              }
              return { ...p, image: img };
            });
          }

          let products = data.products ?? [];
          if (Array.isArray(products)) {
            products = products.map((p: any) => {
              let imgUrl = p.imageUrl;
              if (imgUrl) imgUrl = cleanImagePath(imgUrl);
              
              if (p.id === "eden-reserve" && (!imgUrl || imgUrl === "/assets/The_knowedge.png")) {
                imgUrl = "/assets/ciders/The_knowedge.png";
              }
              return { ...p, imageUrl: imgUrl };
            });
          }

          set((state) => ({
            splashVideoUrl: data.splashVideoUrl ?? state.splashVideoUrl,
            splashStoryTexts: data.splashStoryTexts ?? state.splashStoryTexts,
            anatomyImageUrl: data.anatomyImageUrl ?? state.anatomyImageUrl,
            anatomyHotspots: data.anatomyHotspots ?? state.anatomyHotspots,
            homeSettings: data.homeSettings ?? state.homeSettings,
            clubSettings: data.clubSettings ?? state.clubSettings,
            wholesaleSettings: data.wholesaleSettings ?? state.wholesaleSettings,
            storySettings: data.storySettings ?? state.storySettings,
            shopSettings: data.shopSettings ?? state.shopSettings,
            socialSettings: data.socialSettings ?? state.socialSettings,
            shopProducts: data.shopProducts ? shopProducts : state.shopProducts,
            products: data.products ? products : state.products,
          }));
        }
      }, (error) => {
        console.error("Firebase store load error:", error);
      });
    } catch (e) {
      console.error("Firebase sync error:", e);
    }
  },

  saveToFirebase: async () => {
    const state = useAdminStore.getState();
    const docRef = doc(db, 'admin_settings', 'global');
    
    // Clean all paths before saving to Firebase
    const cleanShopProducts = state.shopProducts.map(p => ({
      ...p,
      image: p.image ? cleanImagePath(p.image) : p.image
    }));

    const cleanProducts = state.products.map(p => ({
      ...p,
      imageUrl: p.imageUrl ? cleanImagePath(p.imageUrl) : p.imageUrl
    }));

    try {
      await setDoc(docRef, {
        splashVideoUrl: state.splashVideoUrl,
        splashStoryTexts: state.splashStoryTexts,
        anatomyImageUrl: state.anatomyImageUrl,
        anatomyHotspots: state.anatomyHotspots,
        homeSettings: state.homeSettings,
        clubSettings: state.clubSettings,
        wholesaleSettings: state.wholesaleSettings,
        storySettings: state.storySettings,
        shopSettings: state.shopSettings,
        socialSettings: state.socialSettings,
        shopProducts: cleanShopProducts,
        products: cleanProducts,
      }, { merge: true });
    } catch (error) {
      console.error("Failed to save to Firebase:", error);
      throw error;
    }
  },

  decrementInventory: async (items) => {
    const state = useAdminStore.getState();
    const newProducts = state.shopProducts.map(p => {
      const match = items.find(i => i.id === p.id);
      if (match && typeof p.inventoryCount === 'number') {
        const newCount = Math.max(0, p.inventoryCount - match.quantity);
        return { ...p, inventoryCount: newCount, available: newCount > 0 };
      }
      return p;
    });

    set({ shopProducts: newProducts });
    await useAdminStore.getState().saveToFirebase();
  }
}));

// Path helper utility to sanely cleanse Windows and redundant "/public" prefixes
function cleanImagePath(pathStr: string): string {
  if (!pathStr) return pathStr;
  let cleaned = pathStr.replace(/\\+/g, '/');
  cleaned = cleaned.replace(/^\/+/, '');
  if (cleaned.startsWith('public/')) {
    cleaned = cleaned.substring(7);
  }
  if (!cleaned.startsWith('/')) {
    cleaned = '/' + cleaned;
  }
  return cleaned;
}
