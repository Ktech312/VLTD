// Path: src/lib/taxonomy.ts
// Full taxonomy — Universe -> Category -> Subcategory + Type/Checkbox form data

export type UniverseKey =
  | "POP_CULTURE"
  | "SPORTS"
  | "TCG"
  | "MUSIC"
  | "JEWELRY_APPAREL"
  | "GAMES"
  | "BUILT_BOTANY"
  | "MISC"
  | "AUTOMOTIVE"
  | "ART";

// Backward-compatible: TAXONOMY[universe][category] = string[] of subcategories
export type Taxonomy = Record<UniverseKey, Record<string, string[]>>;

export const TAXONOMY: Taxonomy = {
  POP_CULTURE: {
    "Comics": ["Book", "Squarebound", "Sketch Cards", "Limited Prints", "Original Art", "Omnibuses", "Ashcans", "Fanzines", "Original Comic Art"],
    "Toys & Figures": ["Action Figures", "Funko Pops", "Designer Toys", "Anime Collectibles", "Model Kits", "Statues & Busts", "Nendoroids", "Hot Toys", "Bobbleheads", "Plush", "Legos"],
    "Movies / TV / Film": ["VHS", "DVD", "Laser Disc", "Film Reels", "Film Cells", "Memorabilia", "Props", "Posters", "Pictures"],
    "Die-Cast & Vehicles": ["Hot Wheels", "Matchbox", "Model Kits", "Slot Cars", "Redlines", "Error Cars", "1:18 Scale", "1:64 Scale", "Model Trains", "Model Aircraft"],
    "Lego & Brick Systems": ["System Sets", "Ultimate Collector Series (UCS)", "Minifigures", "Technic & Robotics", "Microscale & Architecture", "Loose Bricks & Bulk", "BIONICLE & Figures"],
    "Disney & Cartoon Collectibles": ["Pins", "Animation Cels", "Snowglobes", "Ears / Headwear", "Ornaments", "Lithographs", "Theme Park Exclusives", "Vinylmation"],
    "Collectible Art Plates": ["Limited Edition Plates", "Hand-Painted Porcelain", "Commemorative Plates", "Vintage Ceramic Plates"],
    "Art Cards": ["Sketch Cards", "Limited Prints", "Original Autographed Cards", "Acetate Cards", "Printing Plates", "Metal Cards"],
  },

  SPORTS: {
    "Sports Cards": ["Basketball", "Football", "Baseball", "Soccer", "Hockey", "Racing", "UFC / MMA", "Golf", "Rookie Cards", "Patch / Relic Cards", "Case Hits", "Autographed Cards"],
    "Apparel": ["Vintage Sideline", "Championship Merch", "Player Exclusives", "Throwback Jerseys", "Caps & Hats"],
    "Memorabilia": ["Autographs", "Game-Worn Jerseys", "Game-Used Equipment", "Game Tickets", "Rings / Medals", "Programs & Ticket Stubs", "Signed Photos", "Trading Pins", "Skateboards"],
  },

  TCG: {
    "TCG / CCG": ["Pokemon", "Magic: The Gathering", "Yu-Gi-Oh", "Lorcana", "One Piece", "Star Wars", "Weiss Schwarz", "Flesh and Blood", "Vintage / Dead TCGs", "Dragon Ball Z", "Bo Jackson Arena", "Other"],
    "Non-Sport Collectible": ["Star Wars", "Marvel", "DC", "History", "Pokemon", "One Piece", "HiroQuest Genesis", "Movie", "TV", "Keepsake Edition"],
    "Sealed Product": ["Booster Packs", "Booster Boxes", "Starter Decks", "Elite Trainer Boxes", "Blister Packs", "Gift Sets"],
    "Accessories": ["Deck Boxes", "Card Sleeves", "Playmats", "Binders", "Toploaders", "Dice & Counters"],
  },

  MUSIC: {
    "Audio Formats": ["Vinyl Records", "CDs", "Cassette Tapes", "Reel-to-Reel", "8-Track", "Minidisc", "Shellac 78s", "Acetate Discs", "Flexi Discs", "Digital Media"],
    "Audio Players": ["Walkman", "Record Player", "Amps"],
    "Print & Ephemera": ["Sheet Music", "Concert Programs", "Tour Books", "Backstage Passes", "Gig Posters", "Ticket Stubs", "Music Magazines", "Fan Club Memorabilia"],
    "Instruments & Gear": ["Guitars", "Bass", "Drums", "Keys / Synths", "Brass / Woodwind", "Pedals & Effects", "Vintage Amps", "Microphones", "DJ Gear", "Stage-Used Gear"],
  },

  JEWELRY_APPAREL: {
    "Jewelry": ["Rings", "Necklaces", "Bracelets", "Earrings", "Brooches", "Pins"],
    "Watches": ["Mechanical", "Automatic", "Quartz", "Manual Wind", "Pocket Watches"],
    "Bags & Luggage": ["Handbags", "Backpacks", "Totes", "Suitcases", "Briefcases"],
    "Apparel": ["Tops", "Tees", "Outerwear", "Jackets", "Bottoms", "Pants", "Hats"],
    "Footwear": ["Sneakers", "Boots", "Dress Shoes", "Sandals", "Athletic", "Cleats"],
    "Eyewear": ["Sunglasses", "Prescription Frames", "Archive Pieces"],
  },

  GAMES: {
    "Video Games": ["Retro Software", "Modern Software", "Loose", "CIB", "Limited / Collectors Editions", "Big Box PC", "Demos & Promos", "Steelbooks", "Homebrew", "Prototype / Alpha"],
    "Hardware": ["Home Consoles", "Handhelds", "Dedicated / Plug-and-Play", "Dev & Test Kits", "Store Kiosks", "Region Imports", "System Revisions", "Virtual Reality"],
    "Accessories": ["Controllers", "Arcade Sticks", "Memory Cards", "Cheat Devices", "Link Cables", "Storage & Cases", "Power Supplies", "AV Cables", "Mod Chips / Hardware"],
    "Arcade & Coin-Op": ["Arcade Cabinets", "Pinball Machines", "Slot Machines", "Pachinko", "Arcade Boards (PCBs)", "Marquees & Toppers", "Bezels & Art", "Tokens", "Service Manuals"],
    "Tabletop & Board": ["Board Games", "Card Games", "Dice Games", "Wargames", "Role-Playing Books", "Miniatures", "Strategy Guides", "Mats & Terrain"],
    "Gaming Swag": ["Press Kits", "Pre-order Bonuses", "Standees", "Soundtracks", "Apparel", "Art Books", "Pins & Badges"],
  },

  BUILT_BOTANY: {
    "Handmade": ["Ceramics", "Woodwork", "Metalwork", "Textiles", "Leatherwork", "Jewelry", "Resin", "Glass", "Paper & Origami", "Other"],
    "Bar": ["Whisky", "Scotch", "Bourbon", "Tequila", "Rum", "Gin", "Wine", "Other Spirits"],
    "Plants": ["Succulents", "Tropicals", "Cacti", "Rare & Exotic", "Air Plants", "Bonsai", "Seeds & Bulbs", "Terrariums", "Other"],
    "Garden & Tools": ["Tools", "Pots & Planters", "Soil & Amendments", "Other"],
    "Smoke / Tobacciana": ["Cigars", "Lighters", "Ashtrays", "Humidors", "Cigar Cutters", "Pipes", "Vintage Cases", "Tobacco Tins", "Matchbooks"],
  },

  MISC: {
    "Collectors Choice": ["Replicas", "Historical Documents", "Antiquities", "Military Surplus"],
    "Books": ["Historical Documents", "Antiquities", "Autographs", "First Editions", "Rare Printings"],
    "Coins & Currency": ["Coins", "Bills", "Errors", "Graded", "Bullion", "Ancient Coins", "Proof Sets", "Misprints", "Silver Certificates"],
    "Stamps": ["Vintage", "Sheets", "Covers", "First Day Covers", "Blocks", "Errors", "Postcards", "Revenue Stamps"],
    "Armory & Blades": ["Pistols", "Rifles", "Shotguns", "Muskets", "Swords", "Katanas", "Daggers", "Pocket Knives", "Custom Bowies", "Axes", "Bayonets"],
  },

  AUTOMOTIVE: {
    "Classic Cars": ["Coupes", "Sedans", "Convertibles", "Muscle Cars", "Trucks", "Project Cars", "Restoration Shells"],
    "Car Parts": ["Engines", "Transmissions", "Body Panels", "Grilles", "Badges / Emblems", "Carburetors", "Steering Wheels", "Gauges", "Hubcaps"],
    "Motorcycles": ["Choppers", "Cruisers", "Cafe Racers", "Dirt Bikes", "Vintage Scooters", "Sidecars"],
    "Motorcycle Parts": ["Fuel Tanks", "Exhaust / Pipes", "Fenders", "Frames", "Engines", "Carbs", "Seats", "Hand Controls"],
    "Classic Bicycles": ["Beach Cruisers", "BMX (Vintage 80s)", "Road Bikes", "Lowriders", "Tricycles", "Tandem"],
    "Bicycle Parts": ["Frames", "Forks", "Handlebars", "Banana Seats", "Pedals", "Chains", "Sissy Bars", "Badges", "Grips"],
  },

  ART: {
    "Painting": ["Original Art", "Limited Prints", "Posters", "Sketches"],
    "Sculpture": ["Free-Standing", "Wall Relief", "Bust", "Statue", "Figurine", "Kinetic / Mobile", "Installation"],
    "Art Cards": ["Sketch Cards", "Limited Prints", "Original Autographed Cards", "Acetate Cards", "Printing Plates", "Metal Cards"],
  },
};

// ─── Universe display metadata ─────────────────────────────────────────────────

export const UNIVERSE_LABEL: Record<UniverseKey, string> = {
  POP_CULTURE:      "Pop Culture",
  SPORTS:           "Sports",
  TCG:              "TCG & Non Sport Card",
  MUSIC:            "Music",
  JEWELRY_APPAREL:  "Jewelry & Apparel",
  GAMES:            "Games",
  BUILT_BOTANY:     "Built, Botany & Bar",
  MISC:             "Misc",
  AUTOMOTIVE:       "Gears & Gasoline",
  ART:              "Art",
};

export const UNIVERSE_ICON: Record<UniverseKey, string> = {
  POP_CULTURE:      "\u{1F9B8}",
  SPORTS:           "\u{1F3DF}\uFE0F",
  TCG:              "\u{1F0CF}",
  MUSIC:            "\u{1F3B5}",
  JEWELRY_APPAREL:  "\u231A",
  GAMES:            "\u{1F3AE}",
  BUILT_BOTANY:     "\u{1F33F}",
  MISC:             "\u{1F9E9}",
  AUTOMOTIVE:       "\u{1F697}",
  ART:              "\u{1F3A8}",
};

export const UNIVERSE_KEYS = getUniverses();

// ─── Safe helper utilities ─────────────────────────────────────────────────────

export function isUniverseKey(v: unknown): v is UniverseKey {
  return (
    v === "POP_CULTURE" ||
    v === "SPORTS" ||
    v === "TCG" ||
    v === "MUSIC" ||
    v === "JEWELRY_APPAREL" ||
    v === "GAMES" ||
    v === "BUILT_BOTANY" ||
    v === "MISC" ||
    v === "AUTOMOTIVE" ||
    v === "ART"
  );
}

export function getUniverses(): UniverseKey[] {
  return ["POP_CULTURE", "SPORTS", "TCG", "MUSIC", "JEWELRY_APPAREL", "GAMES", "BUILT_BOTANY", "MISC", "AUTOMOTIVE", "ART"];
}

export function normalizeLabel(s: unknown): string {
  return String(s ?? "")
    .trim()
    .replace(/\u2019|\u2018/g, "'")
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ");
}

export function getCategories(universe: UniverseKey): string[] {
  return Object.keys(TAXONOMY[universe] ?? {});
}

export function getSubcategories(universe: UniverseKey, category: string): string[] {
  const c = normalizeLabel(category);
  return TAXONOMY[universe]?.[c] ?? [];
}

export function getDefaultCategory(universe: UniverseKey): string {
  return getCategories(universe)[0] ?? "Collectors Choice";
}

export function getDefaultSubcategory(universe: UniverseKey, category: string): string {
  return getSubcategories(universe, category)[0] ?? "";
}

export function coerceUniverseAndCategory(input: {
  universe?: unknown;
  categoryLabel?: unknown;
}): { universe: UniverseKey; categoryLabel: string } {
  const u = isUniverseKey(String(input.universe ?? "").toUpperCase())
    ? (String(input.universe).toUpperCase() as UniverseKey)
    : "MISC";
  const requested = normalizeLabel(input.categoryLabel);
  const cats = getCategories(u);
  const categoryLabel =
    requested && cats.includes(requested) ? requested : getDefaultCategory(u);
  return { universe: u, categoryLabel };
}

// ─── Form Data: Type dropdown + Checkbox options per category ──────────────────

type FormDef = {
  typeOptions: string[];
  checkboxOptions: string[];
};

type CategoryFormDef = FormDef & {
  // Override typeOptions/checkboxOptions when a specific subcat is selected
  conditionalBySubcat?: Record<string, FormDef>;
};

type FormDataShape = Partial<Record<UniverseKey, Record<string, CategoryFormDef>>>;

export const FORM_DATA: FormDataShape = {
  POP_CULTURE: {
    "Art Cards": {
      typeOptions: ["Lithograph", "Serigraph / Silk Screen", "Giclee", "Woodblock", "Etching / Engraving", "Misc / Other"],
      checkboxOptions: ["Autographed", "Graded", "Encapsulated", "Numbered Run", "CoA Included"],
    },
    "Comics": {
      typeOptions: ["Marvel", "DC", "Image", "Misc / Other"],
      checkboxOptions: ["Indie", "Manga", "Golden Age", "Silver Age", "Modern", "Slabs", "Variant Covers"],
    },
    "Toys & Figures": {
      typeOptions: ["Vintage", "Modern", "Misc / Other"],
      checkboxOptions: ["Loose", "Sealed", "Graded", "Prototype", "Custom", "Boxed"],
    },
    "Movies / TV / Film": {
      typeOptions: ["Vintage", "Modern", "Misc / Other"],
      checkboxOptions: ["Autographed", "Graded", "Loose", "Sealed", "Screen-Used", "Replica"],
    },
    "Die-Cast & Vehicles": {
      typeOptions: ["Vintage", "Modern", "Misc / Other"],
      checkboxOptions: ["Loose", "Sealed", "Graded", "Error Car", "Chase Variant"],
    },
    "Lego & Brick Systems": {
      typeOptions: ["Vintage", "Modern", "Misc / Other"],
      checkboxOptions: ["Loose", "Sealed", "Graded", "100% Complete", "Missing Pieces"],
    },
    "Disney & Cartoon Collectibles": {
      typeOptions: ["Disney", "Warner Bros", "Hanna-Barbera", "Nickelodeon", "Cartoon Network", "Misc / Other"],
      checkboxOptions: ["Limited Edition", "Vintage", "Retro", "Park Exclusive", "Graded", "Signed"],
    },
    "Collectible Art Plates": {
      typeOptions: ["Bradford Exchange", "Franklin Mint", "Wedgewood", "Royal Doulton", "Misc / Other"],
      checkboxOptions: ["Numbered Run", "Signed", "Boxed", "COA Included", "Hanger Attached", "Mint"],
    },
  },

  SPORTS: {
    "Sports Cards": {
      typeOptions: ["Basketball", "Football", "Baseball", "Soccer", "Hockey", "Racing", "UFC / MMA", "Golf"],
      checkboxOptions: ["Errors", "Graded", "Rookie Card", "Patch / Relic", "Case Hit", "Autographed", "Base", "Parallel", "Insert", "Serial Numbered"],
    },
    "Apparel": {
      typeOptions: ["Vintage", "Modern", "Misc / Other"],
      checkboxOptions: ["Loose", "Sealed", "Graded", "Player Exclusive", "Game-Worn", "Deadstock"],
    },
    "Memorabilia": {
      typeOptions: ["Vintage", "Modern", "Misc / Other"],
      checkboxOptions: ["Loose", "Sealed", "Graded", "Game-Used", "Signed", "CoA", "Photo-Matched"],
    },
  },

  TCG: {
    "TCG / CCG": {
      typeOptions: ["Vintage / Dead TCG", "Modern", "Misc / Other"],
      checkboxOptions: ["Graded", "Raw", "Sealed Box", "Sealed Pack", "Foil", "Serial Numbered", "Autographed"],
      conditionalBySubcat: {
        "Magic: The Gathering": {
          typeOptions: ["Alpha / Beta / Unlimited", "Revised / Fourth", "Early Expansions", "Modern / Pioneer Core", "Commander / EDH", "Secret Lair Drop", "Horizons / Masters Sets", "Remastered Series", "Box / Gift Sets", "Universes Beyond: Marvel", "Universes Beyond: Spider-Man", "Universes Beyond: The Hobbit", "Universes Beyond: Star Trek", "Universes Beyond: TMNT", "Universes Beyond: Lord of the Rings", "Universes Beyond: Final Fantasy", "Universes Beyond: Fallout", "Universes Beyond: Assassin's Creed", "Universes Beyond: Warhammer 40k", "Universes Beyond: Doctor Who"],
          checkboxOptions: ["English", "Japanese", "Traditional Chinese", "Simplified Chinese", "German", "French", "Italian", "Spanish", "Portuguese", "Russian", "Korean", "Reserved List", "Foil", "Textured Foil", "Galaxy Foil", "Surge Foil", "Double Rainbow Foil", "Borderless", "Extended Art", "Showcase", "Serialized", "Retro Frame", "Misprint / Crimped", "Artist Proof", "Sealed Box", "Sealed Pack", "Raw", "Graded"],
        },
        "Pokemon": {
          typeOptions: ["Base Set / Wizards Era", "Neo Era", "e-Card Era", "EX Series", "Diamond & Pearl", "Platinum", "HeartGold SoulSilver", "Black & White", "XY Series", "Sun & Moon", "Sword & Shield", "Scarlet & Violet", "Classic / Special Boxes", "Promos / Pre-Release"],
          checkboxOptions: ["English", "Japanese (OCG)", "Korean", "German", "French", "Italian", "Spanish", "Traditional Chinese", "Simplified Chinese", "First Edition", "Shadowless", "Holo Rare", "Reverse Holo", "Full Art", "Secret Rare", "Alternate Art", "Gold Star", "Shining", "Crystal", "SAR", "AR", "UR", "HR", "Error / Misprint", "Graded", "Raw", "Sealed Box", "Sealed Pack", "Master Set"],
        },
        "Lorcana": {
          typeOptions: ["The First Chapter", "Rise of the Floodborn", "Into the Inklands", "Ursula's Return", "Shimmering Skies", "Azurite Sea", "Into the Inkdark", "Attack of the Vine!", "Hyperia City", "Wilds Unknown", "Illumineer's Quest", "Organized Play / Promos"],
          checkboxOptions: ["English", "German", "French", "Italian", "Enchanted Rare", "Cold Foil", "Legendary", "Super Rare", "Rare", "Uncommon", "Common", "Promo Stamped", "Error / Misprint", "Illumineer's Trove Exclusive", "Playmat", "Graded", "Raw", "Sealed Booster", "Sealed Booster Box"],
        },
        "One Piece": {
          typeOptions: ["Romance Dawn (OP01)", "Paramount War (OP02)", "Pillars of Strength (OP03)", "Kingdoms of Intrigue (OP04)", "Awakening of the New Era (OP05)", "Wings of the Captain (OP06)", "500 Years in the Future (OP07)", "Two Legends (OP08)", "The New Emperor (OP09)", "Extra Boosters / Heroine's Edition", "Premium Boosters / The Best", "OP10-OP18 Era", "ST-30 Luffy & Ace", "Starter Decks", "Promotional Packs"],
          checkboxOptions: ["English", "Japanese", "Chinese", "Standard Block Legal", "Legacy Block", "Manga Rare", "Serialized Leader", "Alternate Art (AA)", "Secret Rare (SEC)", "Super Rare (SR)", "Rare (R)", "Special Rare (SP)", "Treasure Rare (TR)", "Wanted Poster Variant", "Anniversary Special Edition", "Winner Stamp", "Pre-Release Promo", "Graded", "Raw", "Sealed Box", "Sealed Pack"],
        },
      },
    },
    "Non-Sport Collectible": {
      typeOptions: ["Topps", "Fleer", "Keepsake", "Upper Deck", "Rittenhouse", "Leaf", "Misc / Other"],
      checkboxOptions: ["Graded", "Loose", "Autographed", "Serial Numbered"],
      conditionalBySubcat: {
        "Keepsake Edition": {
          typeOptions: ["Invincible Season 1 Premiere", "Invincible Season 2 Breaker Edition", "Historical Edition", "Jimi Hendrix Premiere Hobby", "Bruce Lee 50th Anniversary", "Bruce Lee Private Collection", "Bruce Lee 85th Anniversary", "Rolling Stone Bob Marley Premiere", "Michael Jackson King of Pop", "Muhammad Ali Spotlight Series", "Elvis Presley Spotlight Series", "Steve McQueen Spotlight", "Bon Jovi Spotlight", "D'Orc Issue #1 Premiere Breaker", "The Walking Dead", "Harlem Globetrotters", "Battle Beast", "Pieces of the Past Historical Collection"],
          checkboxOptions: ["Laser Signagraph (Auto)", "Gem Relic Card", "Cutout Memorabilia", "Worn Robe / Fabric Swatch", "Personal Workout Equipment", "Personally Used Nunchucks", "Original Sketches / Drawings", "Original Film Negatives", "Handwriting Cut Relic", "Dual Relic", "1-of-1 Black Parallel", "Gold Parallel", "Red Parallel", "Blue Parallel", "Chrome Holo Breaker Technology", "Blood Splatter SDCC Variant", "Graded", "Loose"],
        },
      },
    },
    "Sealed Product": {
      typeOptions: ["Vintage", "Modern", "Misc / Other"],
      checkboxOptions: ["Booster Pack", "Booster Box", "Starter Deck", "Elite Trainer Box", "Blister Pack", "Gift Set", "Sealed", "Graded"],
    },
    "Accessories": {
      typeOptions: ["Vintage", "Modern", "Misc / Other"],
      checkboxOptions: ["Deck Box", "Card Sleeves", "Playmat", "Binder", "Toploader", "Dice & Counters"],
    },
  },

  MUSIC: {
    "Audio Formats": {
      typeOptions: ["LP", "EP", "Single", "Album", "Box Set", "Test Pressing", "Japanese Import", "Promo / Demo"],
      checkboxOptions: ["Standard", "Deluxe", "Box Sets", "Sealed", "Loose", "Graded", "OBI Strip", "Color Vinyl", "Picture Disc"],
    },
    "Audio Players": {
      typeOptions: ["Sony", "Pioneer", "Technics", "Marantz", "McIntosh", "Bose", "Kenwood", "Panasonic", "Misc / Other"],
      checkboxOptions: ["Component Deck", "Portable Player", "Stereo Receiver", "Tube Amplifier", "Solid State Amp", "Headphone Amp", "Working", "For Parts", "Serviced / Restored", "Original Box & Manual"],
    },
    "Print & Ephemera": {
      typeOptions: ["Original Print", "Tour Book", "Concert Program", "Pass", "Poster", "Ticket Stub", "Fan Club Item", "Magazine"],
      checkboxOptions: ["Loose", "Framed", "Autographed", "Limited Edition", "Numbered Print", "Full Ticket", "Creased", "Stamped"],
    },
    "Instruments & Gear": {
      typeOptions: ["Fender", "Gibson", "Ibanez", "Marshall", "Pearl", "Zildjian", "Moog", "Roland", "Shure", "Pioneer DJ", "Yamaha", "Misc / Other"],
      checkboxOptions: ["Electric", "Acoustic", "Bass", "Drum Kit", "Synth", "Effects Pedal", "Amplifier", "Microphone", "Turntable / Mix", "Working", "For Parts", "Vintage", "Stage-Used", "Player Signature Model", "Custom Shop", "Modded", "Case Included"],
    },
  },

  JEWELRY_APPAREL: {
    "Jewelry": {
      typeOptions: ["Cartier", "Tiffany & Co.", "Van Cleef & Arpels", "BVLGARI", "David Yurman", "Pandora", "Harry Winston", "Chrome Hearts", "Misc / Other"],
      checkboxOptions: ["Fine Jewelry", "Costume Jewelry", "Art Deco", "Edwardian", "Victorian", "Retro", "Precious Stones", "Certified / Appraised"],
    },
    "Watches": {
      typeOptions: ["Rolex", "Omega", "Patek Philippe", "Audemars Piguet", "Seiko", "Casio", "Tag Heuer", "Breitling", "Tudor", "Cartier", "Misc / Other"],
      checkboxOptions: ["Mechanical", "Automatic", "Quartz", "Manual Wind", "Chronograph", "Diver", "GMT / Dual-Time", "Pocket Watch", "Dress Watch", "Box & Papers", "Serviced", "Graded"],
    },
    "Bags & Luggage": {
      typeOptions: ["Louis Vuitton", "Gucci", "Chanel", "Hermes", "Prada", "Coach", "Samsonite", "Rimowa", "Tumi", "Supreme", "Nike", "Misc / Other"],
      checkboxOptions: ["Handbag", "Backpack", "Tote", "Suitcase", "Briefcase", "Messenger Bag", "Crossbody", "Luxury", "Streetwear", "Limited Edition", "Collab", "Deadstock", "Runway"],
    },
    "Apparel": {
      typeOptions: ["Supreme", "Nike", "Stussy", "Fear of God", "Kith", "Ralph Lauren", "Levi's", "Balenciaga", "Gucci", "Diesel", "Misc / Other"],
      checkboxOptions: ["Tops", "Tees", "Outerwear", "Jackets", "Bottoms", "Pants", "Suits", "Dresses", "Hats", "Streetwear", "Band Tees", "Limited Drop", "Grails", "Vintage"],
    },
    "Footwear": {
      typeOptions: ["Nike", "Jordan Brand", "Adidas", "New Balance", "Asics", "Converse", "Vans", "Timberland", "Red Wing", "Doc Martens", "Yeezy", "Misc / Other"],
      checkboxOptions: ["Sneakers", "Boots", "Dress Shoes", "Sandals", "Cleats", "Hype", "Deadstock", "Samples", "Player Exclusive", "Collabs", "Vintage OG", "Field / Court Worn", "Box Included"],
    },
    "Eyewear": {
      typeOptions: ["Ray-Ban", "Oakley", "Cartier", "Gucci", "Prada", "Tom Ford", "Oliver Peoples", "Chrome Hearts", "Jacques Marie Mage", "Pit Viper", "Misc / Other"],
      checkboxOptions: ["Sunglasses", "Prescription Frames", "Archive Pieces", "Custom Frames", "Goggles", "Acetate Frame", "Titanium", "Horn / Wood", "Luxury", "Designer", "Box Included"],
    },
  },

  GAMES: {
    "Video Games": {
      typeOptions: ["Nintendo", "Sony", "Microsoft", "Sega", "Atari", "PC / Computer", "SNK Neo Geo", "Bandai", "NEC", "Misc / Other"],
      checkboxOptions: ["Cartridge", "Optical Disc", "Digital Code", "Card Format", "Standard Jewel Case", "Longbox Variant", "Greatest Hits", "Sealed", "Graded", "Loose", "CIB", "Limited / Collectors Edition", "Big Box PC", "Demo / Promo", "Steelbook", "Homebrew", "Prototype / Alpha"],
    },
    "Hardware": {
      typeOptions: ["Nintendo", "Sony", "Microsoft", "Sega", "Atari", "SNK Neo Geo", "NEC TurboGrafx", "Panasonic 3DO", "Misc / Other"],
      checkboxOptions: ["Home Console", "Handheld", "Dedicated / Plug-and-Play", "Dev & Test Kit", "Store Kiosk", "Region Import", "System Revision", "Motherboard Variant", "Special Edition Color Shell", "Virtual Reality", "Sealed", "Graded", "Loose", "CIB"],
    },
    "Accessories": {
      typeOptions: ["Nintendo", "Sony", "Microsoft", "Sega", "Logitech", "Razer", "Mad Catz", "Hori", "8BitDo", "Misc / Other"],
      checkboxOptions: ["Controller", "Arcade Stick", "Memory Card", "Cheat Device", "Flash Cart", "Link Cable", "Storage & Cases", "Power Supply", "AV Cables", "Mod Chips", "OEM", "Third-Party", "Sealed", "Graded"],
    },
    "Arcade & Coin-Op": {
      typeOptions: ["Bally", "Williams", "Stern", "Midway", "Sega", "Namco", "Atari", "Capcom", "Konami", "Taito", "SNK", "IGT", "Aristocrat", "Misc / Other"],
      checkboxOptions: ["Arcade Cabinet", "Pinball Machine", "Slot Machine", "Pachinko", "Arcade Board (PCB)", "Universal JAMMA", "Pre-JAMMA", "Multi-Slot Motherboard", "Marquee & Topper", "Bezel & Art", "Tokens", "Service Manuals", "Working", "Project / Non-Working"],
    },
    "Tabletop & Board": {
      typeOptions: ["Hasbro", "Milton Bradley", "Parker Brothers", "Games Workshop", "Wizards of the Coast", "Asmodee", "Ravensburger", "Fantasy Flight", "Misc / Other"],
      checkboxOptions: ["Board Game", "Card Game", "Dice Game", "Wargame", "Role-Playing Book", "Miniatures", "Strategy Guide", "Mats & Terrain", "Sealed", "Punched / Complete", "Painted Miniatures"],
    },
    "Gaming Swag": {
      typeOptions: ["Nintendo", "Sony", "Microsoft", "Sega", "Capcom", "Square Enix", "Bandai Namco", "Bethesda", "Rockstar", "Misc / Other"],
      checkboxOptions: ["Press Kit", "Pre-order Bonus", "Standee", "Soundtrack", "Apparel", "Art Book", "Pins & Badges", "Vinyl / Cassette Soundtrack", "Autographed", "Promo Only"],
    },
  },

  BUILT_BOTANY: {
    "Handmade": {
      typeOptions: ["Functional / Utility", "Decorative / Display", "Fine Art Craft", "Custom Build", "Folk Art", "Misc / Other"],
      checkboxOptions: ["One-of-a-Kind", "Signed by Artist", "Maker's Mark Present", "Custom Commission", "Raw / Unfinished"],
    },
    "Bar": {
      typeOptions: ["Bourbon", "Scotch Whisky", "Irish Whiskey", "Rye", "Tequila", "Rum", "Gin", "Vodka", "Brandy / Cognac", "Wine", "Misc / Other"],
      checkboxOptions: ["Single Malt", "Blended", "Single Barrel", "Small Batch", "Sealed", "Limited Release", "Aged / Vintage", "Discontinued", "Wax Sealed", "Open"],
    },
    "Plants": {
      typeOptions: ["Aoid / Philodendron", "Monstera", "Sansevieria", "Orchid", "Fern", "Carnivorous", "Palm", "Ficus", "Succulent / Cacti", "Misc / Other"],
      checkboxOptions: ["Potted Plant", "Variegated", "Albomarginata", "Aurea", "Sport Mutation", "Clone / Cutting", "Tissue Culture", "Mother Plant"],
    },
    "Garden & Tools": {
      typeOptions: ["Hand Tools", "Power Equipment", "Specialized Substrates", "Irrigation / Hydroponics", "Greenhouse Gear", "Misc / Other"],
      checkboxOptions: ["Commercial Grade", "Brand New", "Pre-Owned / Used", "Ergonomic Design", "Vintage / Antique Collectible"],
    },
    "Smoke / Tobacciana": {
      typeOptions: ["Arturo Fuente", "Davidoff", "Padron", "Cohiba", "Montecristo", "Zippo", "Dunhill", "S.T. Dupont", "Colibri", "Misc / Other"],
      checkboxOptions: ["Pre-Embargo Cuban", "Factory Sealed Box", "Limited Edition", "Small Batch / Anniversary", "Humidor Aged", "Date Code Stamp", "WWII Black Crackle", "Solid Precious Metal", "Advertising Logo", "Working"],
    },
  },

  MISC: {
    "Collectors Choice": {
      typeOptions: ["Replica", "Historical Document", "Antiquity", "Military Surplus", "Misc / Other"],
      checkboxOptions: ["Autographed", "CoA Included", "Historical", "First Edition", "Framed", "Certified / Appraised"],
    },
    "Books": {
      typeOptions: ["Hardcover", "Paperback", "Leatherbound", "Signed Edition", "Limited Print", "Misc / Other"],
      checkboxOptions: ["First Edition", "Signed Copy", "Dust Jacket Present", "Boxed Set", "Ex-Library Copy", "Rare Printing"],
    },
    "Coins & Currency": {
      typeOptions: ["PCGS", "NGC", "PMG", "US Mint", "Royal Mint", "Bullion Mint", "Misc / Other"],
      checkboxOptions: ["Mint Mark Variant", "Raw", "Uncirculated", "Silver Certificate", "Graded", "Error", "Misprint"],
    },
    "Stamps": {
      typeOptions: ["US Postal Service", "Royal Mail", "EuroPost", "Philatelic Registry", "Misc / Other"],
      checkboxOptions: ["Mint / Uncancelled", "Cancelled / Used", "Graded", "Postcard", "Error", "Block"],
    },
    "Armory & Blades": {
      typeOptions: ["Colt", "Winchester", "Remington", "Smith & Wesson", "Glock", "SIG Sauer", "Browning", "Case XX", "Buck", "Benchmade", "Spyderco", "Microtech", "Hanwei", "Albion", "Misc / Other"],
      checkboxOptions: ["Matching Serial Numbers", "Antique (Pre-1898)", "Original Bluing", "Deactivated / Inert", "Engraved Receiver", "C&R Eligible", "Hand-Forged", "Damascus Steel", "Full Tang", "Original Scabbard / Sheath", "Patina", "Factory Edge"],
    },
  },

  AUTOMOTIVE: {
    "Classic Cars": {
      typeOptions: ["Ford", "Chevrolet", "Dodge", "Pontiac", "Plymouth", "Cadillac", "Toyota", "Nissan", "Porsche", "Misc / Other"],
      checkboxOptions: ["Vintage", "Modern", "Original / Matching Numbers", "Restomod", "Custom", "Running", "Non-Running"],
    },
    "Car Parts": {
      typeOptions: ["Mopar", "AC Delco", "Motorcraft", "Edelbrock", "Holley", "GM", "Ford", "Chevy", "Misc / Other"],
      checkboxOptions: ["OEM", "Aftermarket", "New Old Stock (NOS)", "Performance", "Refurbished", "For Parts", "Chrome-Plated", "Rust-Free"],
    },
    "Motorcycles": {
      typeOptions: ["Harley-Davidson", "Honda", "Yamaha", "Kawasaki", "Suzuki", "Triumph", "Indian", "Vespa", "Misc / Other"],
      checkboxOptions: ["Vintage", "Modern", "Matching Numbers", "Custom Paint", "Running", "Project Bike", "Barn Find"],
    },
    "Motorcycle Parts": {
      typeOptions: ["S&S Cycle", "Yoshimura", "Vance & Hines", "Honda", "Harley-Davidson", "Yamaha", "Misc / Other"],
      checkboxOptions: ["OEM", "Aftermarket", "New Old Stock (NOS)", "Custom / Chop", "For Parts", "Working", "Rebuilt", "Patina / Original"],
    },
    "Classic Bicycles": {
      typeOptions: ["Schwinn", "Mongoose", "Raleigh", "GT", "Redline", "Columbia", "Huffy", "Misc / Other"],
      checkboxOptions: ["100% Original", "Restored", "Survivor / Untouched", "Coaster Brake", "Springer Fork", "Banana Seat"],
    },
    "Bicycle Parts": {
      typeOptions: ["Shimano", "Campagnolo", "SR Suntour", "Schwinn", "Skyway", "Dia-Compe", "Misc / Other"],
      checkboxOptions: ["OEM", "Aftermarket", "New Old Stock (NOS)", "Reproduction", "Original Paint", "Re-chromed", "For Parts"],
    },
  },

  ART: {
    "Painting": {
      typeOptions: ["Oil", "Acrylic", "Watercolor", "Gouache", "Tempera", "Pastel", "Mixed Media", "Misc / Other"],
      checkboxOptions: ["Signed by Artist", "Framed", "Matted", "CoA Included", "Gallery Label Attached", "Exhibition History", "Numbered Run"],
    },
    "Sculpture": {
      typeOptions: ["Bronze", "Marble", "Terracotta", "Wood", "Resin", "Glass", "Metal", "Ceramic", "Mixed Media", "Misc / Other"],
      checkboxOptions: ["Original Piece", "Limited Run", "Hand-Carved", "Foundry Cast", "Signed by Artist", "Maker's Mark Present", "Foundry Stamp", "Numbered Edition", "COA Included"],
    },
    "Art Cards": {
      typeOptions: ["Lithograph", "Serigraph / Silk Screen", "Giclee", "Woodblock", "Etching / Engraving", "Misc / Other"],
      checkboxOptions: ["Autographed", "Graded", "Encapsulated", "Numbered Run", "CoA Included"],
    },
  },
};

// ─── Form data helpers ─────────────────────────────────────────────────────────

export function getTypeOptions(
  universe: UniverseKey,
  category: string,
  subcat?: string
): string[] {
  const cat = FORM_DATA[universe]?.[category];
  if (!cat) return [];
  if (subcat && cat.conditionalBySubcat?.[subcat]) {
    return cat.conditionalBySubcat[subcat].typeOptions;
  }
  return cat.typeOptions;
}

export function getCheckboxOptions(
  universe: UniverseKey,
  category: string,
  subcat?: string
): string[] {
  const cat = FORM_DATA[universe]?.[category];
  if (!cat) return [];
  if (subcat && cat.conditionalBySubcat?.[subcat]) {
    return cat.conditionalBySubcat[subcat].checkboxOptions;
  }
  return cat.checkboxOptions;
}
