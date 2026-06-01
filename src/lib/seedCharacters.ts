// ─────────────────────────────────────────────────────────────
// VLTD Seed Characters — 22 fictional/historical collector profiles
// Each character has a fixed UUID, profile, gallery, and 40 items.
// Run scripts/generateCharacterSeed.ts to produce the SQL file.
// ─────────────────────────────────────────────────────────────

export type SeedItem = {
  id: string;
  title: string;
  subtitle?: string;
  number?: string;
  grade?: string;
  universe?: string;
  category?: string;
  categoryLabel?: string;
  subcategoryLabel?: string;
  notes?: string;
  currentValue?: number;
  purchasePrice?: number;
  edition?: string;
  variant?: string;
  isFirstEdition?: boolean;
  isPublic: boolean;
  status: "COLLECTION";
};

export type SeedGallery = {
  id: string;
  title: string;
  description: string;
  themePack: "classic" | "walnut" | "midnight" | "marble" | "cold-blue";
  visibility: "PUBLIC";
  itemIds: string[]; // references item ids above
};

export type SeedCharacter = {
  profileId: string;
  displayName: string;
  handle: string;
  avatarEmoji: string;
  bio: string;
  primaryFocus: string;
  items: SeedItem[];
  galleries: SeedGallery[];
};

// ─── Helper: generate deterministic item IDs ───
function iid(characterSlug: string, n: number) {
  return `seed_${characterSlug}_item_${String(n).padStart(3, "0")}`;
}
function gid(characterSlug: string, n: number) {
  return `seed_${characterSlug}_gallery_${n}`;
}

// ═══════════════════════════════════════════════════════════════
// 01 — J.P. MORGAN
// ═══════════════════════════════════════════════════════════════
const jpMorganItems: SeedItem[] = [
  { id: iid("morgan", 1), title: "Gutenberg Bible", subtitle: "Latin Vulgate, 1455", universe: "Books & Manuscripts", category: "Rare Books", notes: "One of 49 known surviving copies. Vellum edition.", currentValue: 3200000, purchasePrice: 850000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 2), title: "The Book of Hours of Catherine of Cleves", subtitle: "Illuminated manuscript, c. 1440", universe: "Books & Manuscripts", category: "Manuscripts", notes: "157 miniature paintings. Acquired from Dutch estate.", currentValue: 1800000, purchasePrice: 600000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 3), title: "Raphael — Portrait of a Young Man", subtitle: "Oil on panel, c. 1513–1514", universe: "Fine Art", category: "Old Masters", notes: "Provenance traced to the Czartoryski Collection.", currentValue: 4500000, purchasePrice: 1200000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 4), title: "Egyptian Scarab of Amenhotep III", subtitle: "Steatite, 18th Dynasty", universe: "Antiquities", category: "Egyptian", notes: "Royal commemorative scarab. Inscribed with throne name.", currentValue: 285000, purchasePrice: 95000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 5), title: "Shakespeare First Folio", subtitle: "Comedies, Histories & Tragedies, 1623", universe: "Books & Manuscripts", category: "Rare Books", notes: "Mr. and Mrs. Folger copy provenance.", currentValue: 2200000, purchasePrice: 750000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 6), title: "Byzantine Gold Solidus — Justinian I", subtitle: "Constantinople mint, 527–565 AD", universe: "Coins & Currency", category: "Ancient Coins", notes: "MS-63. Exceptional strike for the period.", currentValue: 42000, purchasePrice: 18000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 7), title: "Rembrandt — Self-Portrait with Two Circles", subtitle: "Oil on canvas, c. 1665–1669", universe: "Fine Art", category: "Old Masters", notes: "Acquired from the Iveagh Bequest auction.", currentValue: 5800000, purchasePrice: 2100000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 8), title: "Medieval Ivory Diptych — Annunciation", subtitle: "French Gothic, c. 1350", universe: "Antiquities", category: "Medieval", notes: "Carved from elephant ivory. Two hinged panels.", currentValue: 380000, purchasePrice: 140000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 9), title: "Mozart Autograph Letter", subtitle: "Vienna, December 1787", universe: "Books & Manuscripts", category: "Autographs", notes: "Letter to his father Leopold discussing Don Giovanni.", currentValue: 520000, purchasePrice: 190000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 10), title: "Roman Marble Bust — Emperor Augustus", subtitle: "1st century BC–AD", universe: "Antiquities", category: "Roman", notes: "Polished Carrara marble. Eyes retain original inlay.", currentValue: 870000, purchasePrice: 320000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 11), title: "Albrecht Dürer — Rhinoceros Woodcut", subtitle: "1515, first state impression", universe: "Fine Art", category: "Prints & Works on Paper", notes: "Extremely rare first-state pull.", currentValue: 680000, purchasePrice: 240000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 12), title: "Venetian Glass Beaker — 16th Century", subtitle: "Murano lattimo glass with enamel", universe: "Decorative Arts", category: "Glass", notes: "Armorial enamel with papal insignia.", currentValue: 145000, purchasePrice: 58000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 13), title: "Charles Dickens — A Christmas Carol Manuscript", subtitle: "Working draft, 1843", universe: "Books & Manuscripts", category: "Manuscripts", notes: "98 pages in Dickens's hand with corrections.", currentValue: 3400000, purchasePrice: 1100000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 14), title: "Greek Gold Wreath — 4th Century BC", subtitle: "Macedonia, oak leaf and acorn design", universe: "Antiquities", category: "Greek", notes: "Burial crown. 215 individual gold leaves.", currentValue: 940000, purchasePrice: 380000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 15), title: "Flemish Tapestry — The Hunt of the Unicorn", subtitle: "Southern Netherlands, c. 1495–1505", universe: "Decorative Arts", category: "Textiles", notes: "One panel from the famous Unicorn Tapestries series.", currentValue: 2600000, purchasePrice: 900000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 16), title: "Fabergé Imperial Easter Egg — Lilies of the Valley", subtitle: "Workmaster Michael Perchin, 1898", universe: "Decorative Arts", category: "Fabergé", notes: "Presented by Tsar Nicholas II to Tsarina Alexandra.", currentValue: 9200000, purchasePrice: 3400000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 17), title: "Lincoln Letter to Ulysses S. Grant", subtitle: "Washington, April 1865", universe: "Books & Manuscripts", category: "Historical Documents", notes: "One of the last letters signed before assassination.", currentValue: 1800000, purchasePrice: 620000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 18), title: "Persian Carpet — Ardabil Medallion", subtitle: "Safavid, 16th Century", universe: "Decorative Arts", category: "Rugs & Carpets", notes: "Paired with the V&A's famous Ardabil. Silk foundation.", currentValue: 1400000, purchasePrice: 500000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 19), title: "Cellini Gold Salt Cellar", subtitle: "Mannerist goldsmithing, c. 1540–1543", universe: "Decorative Arts", category: "Gold & Silver", notes: "Attributed to Benvenuto Cellini workshop.", currentValue: 3800000, purchasePrice: 1300000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 20), title: "Cuneiform Tablet — Code of Hammurabi Fragment", subtitle: "Babylonian, c. 1754 BC", universe: "Antiquities", category: "Near Eastern", notes: "Clay tablet. Law 196 visible.", currentValue: 720000, purchasePrice: 280000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 21), title: "Turner — The Fighting Temeraire Study", subtitle: "Oil sketch on board, 1838", universe: "Fine Art", category: "19th Century", notes: "Preparatory study for the National Gallery masterpiece.", currentValue: 1200000, purchasePrice: 420000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 22), title: "Napoleon's Personal Seal", subtitle: "Gold with bloodstone, 1804", universe: "Historical Artifacts", category: "Napoleonic", notes: "Engraved with imperial eagle. Used on state documents.", currentValue: 640000, purchasePrice: 220000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 23), title: "Incunabula — Nuremberg Chronicle", subtitle: "Schedel, 1493 Latin edition", universe: "Books & Manuscripts", category: "Rare Books", notes: "1,809 woodcut illustrations. Hand-colored.", currentValue: 185000, purchasePrice: 72000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 24), title: "Japanese Lacquer Cabinet — Edo Period", subtitle: "Gold maki-e on black lacquer, c. 1680", universe: "Decorative Arts", category: "Asian Decorative Arts", notes: "Dutch East India Company export piece.", currentValue: 340000, purchasePrice: 130000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 25), title: "Copernicus — De Revolutionibus Orbium Coelestium", subtitle: "First edition, 1543 Nuremberg", universe: "Books & Manuscripts", category: "Rare Books", notes: "One of approximately 400 surviving first editions.", currentValue: 2100000, purchasePrice: 780000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 26), title: "Viking Hoard — Silver Arm Ring", subtitle: "Scandinavian, 9th–10th Century", universe: "Antiquities", category: "Viking", notes: "Twisted silver ingot ring. Part of a buried hoard.", currentValue: 68000, purchasePrice: 28000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 27), title: "Velázquez — Portrait of a Gentleman", subtitle: "Oil on canvas, c. 1630", universe: "Fine Art", category: "Old Masters", notes: "Spanish school attribution. Collar ruff intact.", currentValue: 2800000, purchasePrice: 980000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 28), title: "Chinese Bronze Ritual Vessel — Shang Dynasty", subtitle: "Fangding form, c. 1300–1100 BC", universe: "Antiquities", category: "Chinese", notes: "Taotie mask decoration. Legs cast with dragon motif.", currentValue: 1600000, purchasePrice: 560000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 29), title: "Michelangelo — Study for the Sistine Chapel", subtitle: "Red chalk on paper, c. 1508", universe: "Fine Art", category: "Drawings", notes: "Figure study for the Ignudi. Verso: architectural sketch.", currentValue: 4200000, purchasePrice: 1500000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 30), title: "Aztec Turquoise Mosaic Serpent", subtitle: "Mexico, 15th–16th Century", universe: "Antiquities", category: "Pre-Columbian", notes: "Turquoise and shell on cedar base. Ritual object.", currentValue: 760000, purchasePrice: 290000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 31), title: "English Silver Nef — Ship Salt", subtitle: "London hallmarks, 1630", universe: "Decorative Arts", category: "Gold & Silver", notes: "Table centerpiece in the form of a galleon.", currentValue: 280000, purchasePrice: 108000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 32), title: "Ptolemy — Geographia", subtitle: "Ulm edition with maps, 1482", universe: "Books & Manuscripts", category: "Rare Books", notes: "32 hand-colored maps. First printed edition with maps.", currentValue: 920000, purchasePrice: 340000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 33), title: "Meissen Porcelain Swan Service Tureen", subtitle: "Modeled by J.J. Kaendler, 1737–1742", universe: "Decorative Arts", category: "Porcelain", notes: "From the famous service made for Count Brühl.", currentValue: 480000, purchasePrice: 180000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 34), title: "Darwin — On the Origin of Species", subtitle: "First edition, first issue, 1859", universe: "Books & Manuscripts", category: "Rare Books", notes: "Original cloth binding. 1,250 copies printed.", currentValue: 420000, purchasePrice: 160000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 35), title: "Byzantine Mosaic Icon — Christ Pantocrator", subtitle: "Constantinople, 12th Century", universe: "Fine Art", category: "Religious Art", notes: "Gold tesserae background. 14×18 inch panel.", currentValue: 1100000, purchasePrice: 400000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 36), title: "Ming Dynasty Blue and White Vase", subtitle: "Yongle period, 1403–1424", universe: "Decorative Arts", category: "Porcelain", notes: "Underglaze cobalt. Dragon and cloud motif.", currentValue: 2400000, purchasePrice: 860000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 37), title: "Beethoven Ninth Symphony Manuscript Page", subtitle: "Autograph score fragment, 1823", universe: "Books & Manuscripts", category: "Music Manuscripts", notes: "One page from the first movement. With corrections.", currentValue: 1300000, purchasePrice: 480000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 38), title: "Indian Mughal Jade Cup", subtitle: "Carved white nephrite, c. 1700", universe: "Decorative Arts", category: "Asian Decorative Arts", notes: "Floral lotus form. Possibly from Shah Jahan's court.", currentValue: 680000, purchasePrice: 250000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 39), title: "Goya — The Disasters of War", subtitle: "Complete set of 80 aquatints, 1863", universe: "Fine Art", category: "Prints & Works on Paper", notes: "First edition. Published posthumously. Full set.", currentValue: 860000, purchasePrice: 320000, isPublic: true, status: "COLLECTION" },
  { id: iid("morgan", 40), title: "Roman Cameo — Gemma Augustea Style", subtitle: "Sardonyx, 1st Century AD", universe: "Antiquities", category: "Roman", notes: "Emperor enthroned with Victory. Gold mounting added 1780.", currentValue: 540000, purchasePrice: 200000, isPublic: true, status: "COLLECTION" },
];

// ═══════════════════════════════════════════════════════════════
// 02 — WILLIAM RANDOLPH HEARST
// ═══════════════════════════════════════════════════════════════
const hearstItems: SeedItem[] = [
  { id: iid("hearst", 1), title: "Action Comics #1", subtitle: "First appearance of Superman, June 1938", universe: "Comics", category: "Golden Age", grade: "CGC 4.0", notes: "Centerpiece of the Hearst pop culture wing.", currentValue: 2800000, purchasePrice: 900000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 2), title: "Spanish Renaissance Ceiling — Monastery of Santa María de Óvila", subtitle: "Carved stone, 12th–16th Century", universe: "Architectural Antiques", category: "Stone Carvings", notes: "Entire monastery purchased and shipped to California.", currentValue: 4200000, purchasePrice: 1800000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 3), title: "Egyptian Sarcophagus — 21st Dynasty", subtitle: "Painted wood, c. 1070–945 BC", universe: "Antiquities", category: "Egyptian", notes: "Acquired at auction from Lord Carnarvon estate.", currentValue: 1600000, purchasePrice: 540000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 4), title: "Citizen Kane Original Script", subtitle: "Orson Welles & Herman Mankiewicz, 1941", universe: "Film & Entertainment", category: "Scripts & Screenplays", notes: "Working draft. Hearst tried to have the film destroyed.", currentValue: 980000, purchasePrice: 320000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 5), title: "Greek Marble Torso — Aphrodite", subtitle: "Hellenistic, 2nd Century BC", universe: "Antiquities", category: "Greek", notes: "From the Neptune Pool at San Simeon.", currentValue: 1400000, purchasePrice: 480000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 6), title: "The Wizard of Oz — Original Movie Poster", subtitle: "MGM, 1939 — Style B One-Sheet", universe: "Film & Entertainment", category: "Posters", notes: "Linen-backed. Near Mint condition.", currentValue: 340000, purchasePrice: 120000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 7), title: "Flemish Armorial Tapestry", subtitle: "Brussels workshop, c. 1520", universe: "Decorative Arts", category: "Textiles", notes: "Coat of arms of the House of Habsburg.", currentValue: 880000, purchasePrice: 300000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 8), title: "Detective Comics #27", subtitle: "First appearance of Batman, May 1939", universe: "Comics", category: "Golden Age", grade: "CGC 3.5", notes: "Kept in climate-controlled vault at the castle.", currentValue: 1900000, purchasePrice: 640000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 9), title: "Italian Renaissance Marble Fireplace", subtitle: "Florence, c. 1480", universe: "Architectural Antiques", category: "Fireplaces", notes: "Carved putto and acanthus leaf decoration.", currentValue: 760000, purchasePrice: 260000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 10), title: "Charlie Chaplin — The Kid Lobby Card Set", subtitle: "First National Pictures, 1921", universe: "Film & Entertainment", category: "Lobby Cards", notes: "Complete 8-card set. Original pressings.", currentValue: 85000, purchasePrice: 32000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 11), title: "Velázquez — The Water-Seller of Seville", subtitle: "Oil on canvas, c. 1618–1622", universe: "Fine Art", category: "Old Masters", notes: "Acquired from the Duke of Wellington auction.", currentValue: 3600000, purchasePrice: 1200000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 12), title: "Babylonian Cylinder Seal Collection", subtitle: "Set of 12, 3rd–1st millennium BC", universe: "Antiquities", category: "Near Eastern", notes: "Lapis lazuli, hematite, and carnelian examples.", currentValue: 240000, purchasePrice: 88000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 13), title: "Greta Garbo Production Still — Grand Hotel", subtitle: "MGM, 1932 — Clarence Bull photograph", universe: "Film & Entertainment", category: "Photographs", notes: "Signed by Garbo. One of only 3 known signed stills.", currentValue: 64000, purchasePrice: 22000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 14), title: "Spanish Cathedral Choir Stalls", subtitle: "Carved walnut, 16th Century", universe: "Architectural Antiques", category: "Woodwork", notes: "28 stall panels. Purchased from Andalusian church.", currentValue: 1200000, purchasePrice: 420000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 15), title: "French Impressionist Poster — Toulouse-Lautrec", subtitle: "Moulin Rouge: La Goulue, 1891", universe: "Fine Art", category: "Posters", notes: "Original stone lithograph. First state.", currentValue: 420000, purchasePrice: 150000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 16), title: "Roman Mosaic Floor Panel — Hunting Scene", subtitle: "North Africa, 3rd Century AD", universe: "Antiquities", category: "Roman", notes: "Tesserae of marble and glass. 6×8 feet.", currentValue: 920000, purchasePrice: 320000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 17), title: "Buster Keaton — The General Lobby Card", subtitle: "United Artists, 1926", universe: "Film & Entertainment", category: "Lobby Cards", notes: "Half-sheet. Stone lithograph. Excellent condition.", currentValue: 48000, purchasePrice: 18000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 18), title: "Elizabethan Oak Refectory Table", subtitle: "English, c. 1590", universe: "Decorative Arts", category: "Furniture", notes: "Twenty-foot plank table from a dissolved monastery.", currentValue: 180000, purchasePrice: 65000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 19), title: "Persian Miniature — Shahnameh Page", subtitle: "Safavid, Tabriz school, c. 1530", universe: "Fine Art", category: "Asian Art", notes: "Battle of Rostam and Sohrab. Gold illumination.", currentValue: 320000, purchasePrice: 115000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 20), title: "Frankenstein — 1931 Lobby Card", subtitle: "Universal Pictures, 1931", universe: "Film & Entertainment", category: "Lobby Cards", notes: "Scene card. Boris Karloff as the Monster.", currentValue: 72000, purchasePrice: 26000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 21), title: "Greek Red-Figure Krater", subtitle: "Attic, attributed to the Berlin Painter, c. 490 BC", universe: "Antiquities", category: "Greek", notes: "Dionysus and satyr scene. Museum deaccession.", currentValue: 680000, purchasePrice: 240000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 22), title: "San Francisco Examiner — Hearst's First Edition", subtitle: "March 4, 1887 — Vol. 1 No. 1", universe: "Books & Manuscripts", category: "Newspapers", notes: "The paper his father gifted him. Framed original.", currentValue: 85000, purchasePrice: 30000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 23), title: "Phryne Fischer Bronze Statuette", subtitle: "Greek Revival, 19th Century after antique", universe: "Fine Art", category: "Sculpture", notes: "Parcel gilt bronze. Garden display at San Simeon.", currentValue: 140000, purchasePrice: 52000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 24), title: "William Randolph Hearst Jr. Birth Announcement", subtitle: "Handwritten, April 1908", universe: "Books & Manuscripts", category: "Personal Papers", notes: "Framed with silver border. Hearst family archive.", currentValue: 28000, purchasePrice: 8000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 25), title: "Italian Maiolica Pharmacy Jar", subtitle: "Urbino workshop, c. 1560", universe: "Decorative Arts", category: "Ceramics", notes: "Istoriato decoration. Battle scene after Raphael.", currentValue: 92000, purchasePrice: 34000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 26), title: "Dracula — 1931 Window Card", subtitle: "Universal Pictures, 1931", universe: "Film & Entertainment", category: "Posters", notes: "Bela Lugosi. 14×22 inch. Original fold lines.", currentValue: 95000, purchasePrice: 35000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 27), title: "French Carved Oak Door — 16th Century", subtitle: "Loire Valley origin", universe: "Architectural Antiques", category: "Doors & Gates", notes: "Medallion portrait panels. Full surround intact.", currentValue: 220000, purchasePrice: 80000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 28), title: "Hearst Castle Blueprint — Julia Morgan", subtitle: "Architect's working drawings, 1919", universe: "Books & Manuscripts", category: "Architectural Plans", notes: "Set of 42 drawings. Signed by Morgan.", currentValue: 180000, purchasePrice: 60000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 29), title: "Ming Blue and White Dragon Ewer", subtitle: "Xuande period mark, 15th Century", universe: "Decorative Arts", category: "Porcelain", notes: "Flared neck. Five-clawed imperial dragon.", currentValue: 1100000, purchasePrice: 390000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 30), title: "Gone with the Wind Screenplay", subtitle: "Sidney Howard adaptation, 1939", universe: "Film & Entertainment", category: "Scripts & Screenplays", notes: "Production copy with director's notes.", currentValue: 240000, purchasePrice: 85000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 31), title: "Roman Granite Column Capital", subtitle: "Imperial period, 1st–2nd Century AD", universe: "Antiquities", category: "Roman", notes: "Corinthian order. From a documented Italian excavation.", currentValue: 380000, purchasePrice: 135000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 32), title: "Maxfield Parrish — Daybreak", subtitle: "Original color print, 1922", universe: "Fine Art", category: "American Art", notes: "Most reproduced art print of the 20th century.", currentValue: 48000, purchasePrice: 18000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 33), title: "All Star Comics #8", subtitle: "First appearance of Wonder Woman, 1941", universe: "Comics", category: "Golden Age", grade: "CGC 3.0", notes: "Housed with the Morgan and Batman issues.", currentValue: 480000, purchasePrice: 160000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 34), title: "Gothic Stone Window Tracery", subtitle: "French, 13th Century", universe: "Architectural Antiques", category: "Stone Carvings", notes: "Three-light window with trefoil tops.", currentValue: 280000, purchasePrice: 100000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 35), title: "Audubon — Birds of America, Plate CLXXXI", subtitle: "Roseate Spoonbill, hand-colored aquatint, 1836", universe: "Fine Art", category: "Natural History Art", notes: "Double elephant folio. London edition.", currentValue: 620000, purchasePrice: 220000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 36), title: "Viking Runic Stone Fragment", subtitle: "Scandinavian, 10th Century", universe: "Antiquities", category: "Viking", notes: "Partial inscription. Serpent motif border.", currentValue: 145000, purchasePrice: 52000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 37), title: "Mummy Wrappings — Ptolemaic Period", subtitle: "Egypt, 332–30 BC", universe: "Antiquities", category: "Egyptian", notes: "Cartonnage mask included. Linen strips intact.", currentValue: 320000, purchasePrice: 115000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 38), title: "Cecil B. DeMille — The Ten Commandments Prop Tablet", subtitle: "Film prop, Paramount Pictures, 1956", universe: "Film & Entertainment", category: "Props", notes: "One of four stone tablets used in the film.", currentValue: 185000, purchasePrice: 65000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 39), title: "Italian Renaissance Bronze Bell", subtitle: "Florentine foundry, c. 1500", universe: "Decorative Arts", category: "Metalwork", notes: "Inscribed: 'MCCCCC.' Hung in the castle tower.", currentValue: 95000, purchasePrice: 34000, isPublic: true, status: "COLLECTION" },
  { id: iid("hearst", 40), title: "Enchanted Cottage — Mary Pickford Signed Still", subtitle: "RKO, 1945", universe: "Film & Entertainment", category: "Photographs", notes: "Gelatin silver print. Signed in silver ink.", currentValue: 22000, purchasePrice: 8000, isPublic: true, status: "COLLECTION" },
];

// ═══════════════════════════════════════════════════════════════
// 03 — CORNELIUS VANDERBILT
// ═══════════════════════════════════════════════════════════════
const vanderbiltItems: SeedItem[] = [
  { id: iid("vanderbilt", 1), title: "SS Vanderbilt Christening Medal", subtitle: "Silver, engraved, 1857", universe: "Historical Artifacts", category: "Maritime", notes: "Given at the launch of his personal steamship.", currentValue: 48000, purchasePrice: 18000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 2), title: "New York Central Railroad Bond — 1869", subtitle: "Ornate engraved certificate", universe: "Coins & Currency", category: "Bonds & Certificates", notes: "Signed by Vanderbilt as president. One of the originals.", currentValue: 85000, purchasePrice: 30000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 3), title: "Boucher — The Triumph of Venus", subtitle: "Oil on canvas, 1740", universe: "Fine Art", category: "Old Masters", notes: "Rococo masterpiece. Purchased from the Wallace estate.", currentValue: 2200000, purchasePrice: 760000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 4), title: "US Morgan Silver Dollar — 1879-S Reverse of 1878", subtitle: "MS-67 PCGS", universe: "Coins & Currency", category: "US Coins", notes: "Pop 1 at PCGS. Finest known.", currentValue: 185000, purchasePrice: 62000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 5), title: "Newport Mansion Architectural Model", subtitle: "The Breakers, scale 1:24, 1895", universe: "Historical Artifacts", category: "Models", notes: "Architect's presentation model. Cornelius II commission.", currentValue: 320000, purchasePrice: 110000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 6), title: "Gustave Courbet — The Stone Breakers", subtitle: "Oil on canvas, c. 1849", universe: "Fine Art", category: "19th Century", notes: "Realist period. Before the Dresden loss.", currentValue: 1800000, purchasePrice: 620000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 7), title: "American Express Company Stock Certificate", subtitle: "1850 — Founding era", universe: "Coins & Currency", category: "Bonds & Certificates", notes: "Vanderbilt was a founding investor.", currentValue: 42000, purchasePrice: 15000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 8), title: "Louis XV Ormolu-Mounted Lacquer Commode", subtitle: "Paris, c. 1745–1749", universe: "Decorative Arts", category: "Furniture", notes: "Japanese lacquer panels with French mounts.", currentValue: 680000, purchasePrice: 240000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 9), title: "Steam Engine Technical Patent Drawing", subtitle: "Original, Watt & Boulton, 1769", universe: "Books & Manuscripts", category: "Technical Documents", notes: "Working drawing of the separate condenser.", currentValue: 140000, purchasePrice: 50000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 10), title: "Sèvres Porcelain Dinner Service — 1780", subtitle: "135-piece set with gilded borders", universe: "Decorative Arts", category: "Porcelain", notes: "Royal manufactory marks. Marie Antoinette provenance.", currentValue: 940000, purchasePrice: 330000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 11), title: "Commodore's Navigation Sextant", subtitle: "Heath & Company, London, 1851", universe: "Historical Artifacts", category: "Scientific Instruments", notes: "Used aboard the North Star yacht. Silver fitted case.", currentValue: 68000, purchasePrice: 24000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 12), title: "Hudson River School — Asher Durand Landscape", subtitle: "Oil on canvas, 1855", universe: "Fine Art", category: "American Art", notes: "View of the Catskills. Pastoral with cattle and stream.", currentValue: 420000, purchasePrice: 145000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 13), title: "Civil War Era $1000 Greenback", subtitle: "Series 1862 Legal Tender Note", universe: "Coins & Currency", category: "Paper Currency", notes: "PMG 30. Extremely rare denomination.", currentValue: 92000, purchasePrice: 32000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 14), title: "Tiffany & Co. Presentation Sword", subtitle: "Gold and silver, 1864", universe: "Historical Artifacts", category: "Arms & Militaria", notes: "Presented to a Civil War general. Vanderbilt patriot gift.", currentValue: 280000, purchasePrice: 98000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 15), title: "Cornelius Vanderbilt Portrait — Jervis McEntee", subtitle: "Oil on canvas, 1873", universe: "Fine Art", category: "Portraiture", notes: "Commissioned portrait. Hudson River School artist.", currentValue: 380000, purchasePrice: 130000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 16), title: "Marble Fireplace Mantel — The Breakers", subtitle: "Italian Statuary marble, 1895", universe: "Architectural Antiques", category: "Fireplaces", notes: "Removed during restoration. Replaced with replica.", currentValue: 240000, purchasePrice: 85000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 17), title: "Staten Island Ferry Token — 1830", subtitle: "Brass, minted for Vanderbilt's ferry line", universe: "Coins & Currency", category: "Tokens & Medals", notes: "One of fewer than 20 known survivors.", currentValue: 28000, purchasePrice: 10000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 18), title: "Audubon — American Flamingo", subtitle: "Hand-colored aquatint, Plate CCCXXXI, 1838", universe: "Fine Art", category: "Natural History Art", notes: "Double elephant folio. First edition London.", currentValue: 580000, purchasePrice: 200000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 19), title: "Cornelius Vanderbilt Signature on Bill of Sale", subtitle: "1853 — sale of the North Star", universe: "Books & Manuscripts", category: "Autographs", notes: "Document selling his private yacht.", currentValue: 32000, purchasePrice: 12000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 20), title: "Meissen Porcelain Centerpiece — River Gods", subtitle: "Modeled by J.J. Kaendler, c. 1745", universe: "Decorative Arts", category: "Porcelain", notes: "Neptune and Triton as river allegories.", currentValue: 320000, purchasePrice: 112000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 21), title: "George Washington Signed Letter", subtitle: "Mount Vernon, 1795", universe: "Books & Manuscripts", category: "Historical Documents", notes: "Discussing agricultural matters on the estate.", currentValue: 680000, purchasePrice: 240000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 22), title: "Gilded Age Calling Card Case — Tiffany", subtitle: "Sterling silver and enamel, 1880", universe: "Decorative Arts", category: "Silver", notes: "Engraved 'C. Vanderbilt' with floral surround.", currentValue: 18000, purchasePrice: 7000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 23), title: "Chart of New York Harbor — 1850s", subtitle: "US Coast Survey, hand-colored", universe: "Books & Manuscripts", category: "Maps", notes: "Annotated by Vanderbilt with ferry routes.", currentValue: 24000, purchasePrice: 9000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 24), title: "Vanderbilt Gold Watch Chain", subtitle: "18k gold, Patek Philippe, 1868", universe: "Jewelry & Accessories", category: "Watches", notes: "Patek hallmarks. Monogram VC on the fob.", currentValue: 85000, purchasePrice: 30000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 25), title: "Frédéric Church — Niagara Falls", subtitle: "Oil on canvas, 1857", universe: "Fine Art", category: "American Art", notes: "Hudson River School. Major exhibition piece.", currentValue: 1400000, purchasePrice: 480000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 26), title: "Vanderbilt Cup Racing Trophy", subtitle: "Silver, 1904", universe: "Sports Memorabilia", category: "Trophies", notes: "First major American auto race. Vanderbilt family trophy.", currentValue: 120000, purchasePrice: 42000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 27), title: "French Ormolu Clock — Allegory of Commerce", subtitle: "Paris, Empire period, c. 1810", universe: "Decorative Arts", category: "Clocks", notes: "Mercury as a merchant. Eight-day movement.", currentValue: 68000, purchasePrice: 24000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 28), title: "New York Times First Edition", subtitle: "September 18, 1851 — Vol. 1 No. 1", universe: "Books & Manuscripts", category: "Newspapers", notes: "First printing. Vanderbilt advertised on page 2.", currentValue: 180000, purchasePrice: 62000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 29), title: "Sevres Rose Pompadour Tea Service", subtitle: "c. 1756–1758, King's mark", universe: "Decorative Arts", category: "Porcelain", notes: "18 pieces. Pink ground with painted reserves.", currentValue: 560000, purchasePrice: 195000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 30), title: "Cornelius Vanderbilt II — Personal Diary", subtitle: "Leather-bound, 1885–1889", universe: "Books & Manuscripts", category: "Personal Papers", notes: "Daily entries covering the construction of The Breakers.", currentValue: 92000, purchasePrice: 32000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 31), title: "Thomas Cole — The Course of Empire", subtitle: "Engraving after the series, 1840", universe: "Fine Art", category: "Prints & Works on Paper", notes: "Complete set of 5 prints. Cole-authorized impressions.", currentValue: 48000, purchasePrice: 17000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 32), title: "Winslow Homer — Sailing the Bay", subtitle: "Watercolor on paper, 1892", universe: "Fine Art", category: "American Art", notes: "Newport harbor scene. Signed lower right.", currentValue: 380000, purchasePrice: 132000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 33), title: "US $20 Double Eagle — 1876-CC", subtitle: "MS-63 PCGS", universe: "Coins & Currency", category: "US Coins", notes: "Carson City mint. Low mintage.", currentValue: 42000, purchasePrice: 15000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 34), title: "Silver Trophy Cup — New York Yacht Club 1871", subtitle: "Gorham silver, engraved", universe: "Sports Memorabilia", category: "Trophies", notes: "Vanderbilt won the regatta aboard Dauntless.", currentValue: 65000, purchasePrice: 23000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 35), title: "Marble Bust — Roman Style", subtitle: "19th Century after antique", universe: "Fine Art", category: "Sculpture", notes: "Displayed in the entrance hall of 640 Fifth Avenue.", currentValue: 85000, purchasePrice: 30000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 36), title: "Locomotive Model — NYC 4-4-0 American", subtitle: "Scale model, brass, 1869", universe: "Historical Artifacts", category: "Transportation", notes: "Model of his flagship Hudson River engine.", currentValue: 38000, purchasePrice: 14000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 37), title: "Gobelin Tapestry — Four Seasons", subtitle: "French Royal Manufactory, 1720", universe: "Decorative Arts", category: "Textiles", notes: "Set of four panels. Floral borders.", currentValue: 920000, purchasePrice: 320000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 38), title: "Erastus Dow Palmer — Morning Star", subtitle: "Marble, 1862", universe: "Fine Art", category: "American Sculpture", notes: "Albany studio. Ideal figure. Pure white Carrara.", currentValue: 240000, purchasePrice: 85000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 39), title: "Grand Central Terminal Original Blueprint", subtitle: "Signed by Reed & Stem, 1904", universe: "Books & Manuscripts", category: "Architectural Plans", notes: "Façade elevation. Vanderbilt family commission.", currentValue: 120000, purchasePrice: 42000, isPublic: true, status: "COLLECTION" },
  { id: iid("vanderbilt", 40), title: "Vanderbilt Family Crest Stained Glass Panel", subtitle: "American, 1878", universe: "Decorative Arts", category: "Glass", notes: "From the Vanderbilt mansion on Fifth Avenue.", currentValue: 72000, purchasePrice: 25000, isPublic: true, status: "COLLECTION" },
];

// ═══════════════════════════════════════════════════════════════
// 04 — KING HENRY VIII
// ═══════════════════════════════════════════════════════════════
const henryItems: SeedItem[] = [
  { id: iid("henry8", 1), title: "Holbein — Portrait of Henry VIII", subtitle: "Oil on panel, after Hans Holbein, c. 1540", universe: "Fine Art", category: "Old Masters", notes: "Period copy of the Whitehall mural. Royal provenance.", currentValue: 3400000, purchasePrice: 1200000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 2), title: "Field of Cloth of Gold Tournament Lance", subtitle: "English, 1520", universe: "Historical Artifacts", category: "Arms & Militaria", notes: "Used in the famous meeting with Francis I of France.", currentValue: 480000, purchasePrice: 170000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 3), title: "Royal Suit of Armor — Greenwich Style", subtitle: "English, c. 1540", universe: "Historical Artifacts", category: "Arms & Militaria", notes: "Full plate. Etched with Tudor rose and pomegranate.", currentValue: 2800000, purchasePrice: 980000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 4), title: "Anne Boleyn's Prayer Book", subtitle: "Hours of the Virgin, c. 1500, with Boleyn annotations", universe: "Books & Manuscripts", category: "Manuscripts", notes: "Marginalia in Anne's own hand. Tower of London provenance.", currentValue: 1600000, purchasePrice: 560000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 5), title: "Tudor Gold Noble Coin", subtitle: "Tower mint, 1509–1526", universe: "Coins & Currency", category: "Medieval Coins", notes: "Henry VIII issue. Extremely fine. Ship design obverse.", currentValue: 42000, purchasePrice: 15000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 6), title: "Illuminated Act of Supremacy — 1534", subtitle: "Vellum with royal seal", universe: "Books & Manuscripts", category: "Historical Documents", notes: "Establishing Henry as head of the Church of England.", currentValue: 2200000, purchasePrice: 780000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 7), title: "Thomas Cromwell's Seal Ring", subtitle: "Gold intaglio, c. 1530s", universe: "Jewelry & Accessories", category: "Rings", notes: "Cromwell's personal device. Removed at his execution.", currentValue: 380000, purchasePrice: 135000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 8), title: "Royal Tennis Racquet", subtitle: "English, c. 1530 — Real Tennis", universe: "Sports Memorabilia", category: "Game Equipment", notes: "Henry was an avid real tennis player. Hampton Court.", currentValue: 240000, purchasePrice: 85000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 9), title: "Tudor Rose Needlework Panel", subtitle: "English, early 16th Century", universe: "Decorative Arts", category: "Textiles", notes: "Silk and gold thread. Catherine of Aragon attributed.", currentValue: 180000, purchasePrice: 64000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 10), title: "Lute — Rosewood with Ivory Inlay", subtitle: "German, c. 1510", universe: "Music & Instruments", category: "Lutes", notes: "Henry was a skilled lutenist and composer.", currentValue: 320000, purchasePrice: 115000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 11), title: "Greensleeves Original Manuscript", subtitle: "Attributed to Henry VIII, c. 1525", universe: "Books & Manuscripts", category: "Music Manuscripts", notes: "Attribution debated. Found in Henry's personal papers.", currentValue: 1800000, purchasePrice: 640000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 12), title: "Hampton Court Palace Tile — Tudor", subtitle: "Encaustic tile, c. 1538", universe: "Historical Artifacts", category: "Architectural", notes: "From the original floor of the Great Hall.", currentValue: 12000, purchasePrice: 4500, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 13), title: "Cardinal Wolsey's Red Hat", subtitle: "Papal bestowed hat, wool and silk, c. 1515", universe: "Historical Artifacts", category: "Costume & Dress", notes: "Wolsey's ecclesiastical red cardinal's hat.", currentValue: 680000, purchasePrice: 240000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 14), title: "Six Wives Medallion Set", subtitle: "Cast bronze, commemorative series", universe: "Coins & Currency", category: "Medals", notes: "19th century series. Each wife with date of marriage.", currentValue: 28000, purchasePrice: 10000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 15), title: "Henry VIII Hunting Horn", subtitle: "Ivory and silver, c. 1520", universe: "Historical Artifacts", category: "Hunting", notes: "Royal hunt standard. Tower of London record.", currentValue: 420000, purchasePrice: 148000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 16), title: "Sir Thomas More — Utopia, First Edition", subtitle: "Louvain, 1516", universe: "Books & Manuscripts", category: "Rare Books", notes: "More was Henry's Lord Chancellor before execution.", currentValue: 1100000, purchasePrice: 390000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 17), title: "Dissolved Monastery Bell", subtitle: "English, pre-1540", universe: "Historical Artifacts", category: "Religious", notes: "From Glastonbury Abbey. Seized during Dissolution.", currentValue: 85000, purchasePrice: 30000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 18), title: "Royal Warrant — Signed Henricus Rex", subtitle: "Vellum, 1523", universe: "Books & Manuscripts", category: "Historical Documents", notes: "Grant of land to a loyal courtier. Full red wax seal.", currentValue: 320000, purchasePrice: 115000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 19), title: "German Crossbow — c. 1530", subtitle: "Steel and walnut, iron bolts", universe: "Historical Artifacts", category: "Arms & Militaria", notes: "Inlaid with antler. From the Tower of London armory.", currentValue: 180000, purchasePrice: 65000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 20), title: "Tudor Portrait Miniature — Unknown Lady", subtitle: "Hans Holbein the Younger, c. 1535–1540", universe: "Fine Art", category: "Miniatures", notes: "Possibly Jane Seymour's lady-in-waiting.", currentValue: 580000, purchasePrice: 205000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 21), title: "Mary I Birth Announcement", subtitle: "Royal proclamation, 1516", universe: "Books & Manuscripts", category: "Historical Documents", notes: "Announcing the birth of Henry and Catherine's daughter.", currentValue: 240000, purchasePrice: 85000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 22), title: "Turkish Scimitar — Gift from Suleiman", subtitle: "Ottoman, c. 1530", universe: "Historical Artifacts", category: "Arms & Militaria", notes: "Diplomatic gift. Gold inlaid blade with Arabic inscription.", currentValue: 620000, purchasePrice: 220000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 23), title: "Book of Hours — Henry VIII Personal Copy", subtitle: "Flemish, c. 1500, with royal annotations", universe: "Books & Manuscripts", category: "Manuscripts", notes: "Marginalia throughout. Henry's italic hand visible.", currentValue: 980000, purchasePrice: 345000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 24), title: "Allegory of Love — Flemish Tapestry", subtitle: "Brussels, c. 1510", universe: "Decorative Arts", category: "Textiles", notes: "Wool and silk. Purchased for Greenwich Palace.", currentValue: 840000, purchasePrice: 295000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 25), title: "Henry VIII Gold Sovereign — First Issue", subtitle: "Tower mint, 1509", universe: "Coins & Currency", category: "Medieval Coins", notes: "Henry in full regalia on throne. EF grade.", currentValue: 85000, purchasePrice: 30000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 26), title: "Tower of London Constable's Keys", subtitle: "Iron and brass, 16th Century", universe: "Historical Artifacts", category: "Prison Artifacts", notes: "Used to lock the cells of Anne Boleyn and Catherine Howard.", currentValue: 280000, purchasePrice: 98000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 27), title: "Jane Seymour Portrait Miniature", subtitle: "Workshop of Hans Holbein, c. 1536", universe: "Fine Art", category: "Miniatures", notes: "Watercolor on vellum. Gold case with diamond border.", currentValue: 720000, purchasePrice: 255000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 28), title: "Royal Heraldic Panel — Tudor Arms", subtitle: "Carved and gilded oak, c. 1530", universe: "Historical Artifacts", category: "Heraldry", notes: "Quarterly lions and fleurs-de-lis. Crown above.", currentValue: 145000, purchasePrice: 52000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 29), title: "English Longbow — English Yew", subtitle: "c. 1510–1530", universe: "Historical Artifacts", category: "Arms & Militaria", notes: "War bow, 180lb draw. Henry competed in archery.", currentValue: 95000, purchasePrice: 34000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 30), title: "Erasmus — In Praise of Folly", subtitle: "First edition, Paris, 1511", universe: "Books & Manuscripts", category: "Rare Books", notes: "Dedicated to Thomas More. Henry's copy with annotations.", currentValue: 480000, purchasePrice: 170000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 31), title: "Hans Holbein — Design for a Jewel", subtitle: "Pen and ink, c. 1535", universe: "Fine Art", category: "Drawings", notes: "Holbein was royal jeweler designer under Henry.", currentValue: 320000, purchasePrice: 115000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 32), title: "Silver-Gilt Ewer and Basin", subtitle: "English, c. 1530", universe: "Decorative Arts", category: "Gold & Silver", notes: "For ceremonial hand-washing at court banquets.", currentValue: 380000, purchasePrice: 135000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 33), title: "Dissolution of the Monasteries Survey Book", subtitle: "Vellum ledger, 1535–1540", universe: "Books & Manuscripts", category: "Historical Documents", notes: "Records property seized from religious houses.", currentValue: 540000, purchasePrice: 190000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 34), title: "Jousting Helmet — Royal Armory", subtitle: "English, 1510–1520", universe: "Historical Artifacts", category: "Arms & Militaria", notes: "Visored frog-mouth helm. Etched Tudor rose on cheek.", currentValue: 980000, purchasePrice: 345000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 35), title: "Catherine of Aragon — Spanish Fan", subtitle: "Peacock feather and ivory, c. 1510", universe: "Historical Artifacts", category: "Costume & Dress", notes: "Brought from Spain. Carved handle with pomegranate motif.", currentValue: 180000, purchasePrice: 64000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 36), title: "Windsor Castle Kitchen Inventory — 1542", subtitle: "Handwritten ledger", universe: "Books & Manuscripts", category: "Historical Documents", notes: "Lists provisions for 800 daily royal household staff.", currentValue: 65000, purchasePrice: 23000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 37), title: "Papal Bull — Leo X to Henry, 1521", subtitle: "Vellum with lead seal", universe: "Books & Manuscripts", category: "Historical Documents", notes: "Awarding Henry the title 'Defender of the Faith'.", currentValue: 820000, purchasePrice: 290000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 38), title: "Royal Proclamation Banning Lutheranism", subtitle: "Printed broadside, 1521", universe: "Books & Manuscripts", category: "Historical Documents", notes: "Before Henry's own break with Rome.", currentValue: 145000, purchasePrice: 52000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 39), title: "Double Portrait — Henry VII and Henry VIII", subtitle: "After Holbein Whitehall mural, c. 1590", universe: "Fine Art", category: "Portraiture", notes: "Dynastic image. Both figures frontal.", currentValue: 680000, purchasePrice: 240000, isPublic: true, status: "COLLECTION" },
  { id: iid("henry8", 40), title: "Catherine Howard's Locket", subtitle: "Gold with ruby, c. 1540", universe: "Jewelry & Accessories", category: "Lockets", notes: "Fifth wife. Contains miniature portrait inside.", currentValue: 280000, purchasePrice: 98000, isPublic: true, status: "COLLECTION" },
];

// ═══════════════════════════════════════════════════════════════
// 05 — HOWARD HUGHES
// ═══════════════════════════════════════════════════════════════
const hughesItems: SeedItem[] = [
  { id: iid("hughes", 1), title: "Spruce Goose Design Blueprint", subtitle: "HK-1 Flying Boat, 1942", universe: "Historical Artifacts", category: "Aviation", notes: "Original engineering drawing. Signed by Hughes.", currentValue: 380000, purchasePrice: 135000, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 2), title: "Hughes H-1 Racer Model", subtitle: "Precision scale model, 1:12, c. 1935", universe: "Historical Artifacts", category: "Aviation", notes: "Wind tunnel test model. Set world speed record 1935.", currentValue: 220000, purchasePrice: 78000, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 3), title: "Jean Harlow Signed Portrait", subtitle: "Photograph, 1930 — from Hell's Angels", universe: "Film & Entertainment", category: "Photographs", notes: "Inscribed to Hughes. Platinum blonde era.", currentValue: 85000, purchasePrice: 30000, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 4), title: "TWA Pilot Wings — 1940s", subtitle: "Sterling silver, Hughes-era airline", universe: "Historical Artifacts", category: "Aviation", notes: "Hughes acquired TWA in 1939. Rare pre-war wings.", currentValue: 8500, purchasePrice: 3200, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 5), title: "Lockheed Constellation Technical Manual", subtitle: "Hughes's personal annotated copy, 1948", universe: "Books & Manuscripts", category: "Technical Documents", notes: "Hughes flew the Connie in record-breaking flights.", currentValue: 42000, purchasePrice: 15000, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 6), title: "Las Vegas Desert Inn Hotel Deed", subtitle: "1950 — Hughes's Nevada real estate", universe: "Books & Manuscripts", category: "Historical Documents", notes: "Hughes purchased the hotel to stay in indefinitely.", currentValue: 185000, purchasePrice: 65000, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 7), title: "Scarface (1932) — Original One-Sheet Poster", subtitle: "United Artists — Hughes production", universe: "Film & Entertainment", category: "Posters", notes: "Linen-backed. Paul Muni as Tony Camonte.", currentValue: 68000, purchasePrice: 24000, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 8), title: "Boeing 307 Stratoliner Cockpit Instrument Panel", subtitle: "Salvaged, 1940s", universe: "Historical Artifacts", category: "Aviation", notes: "Actual instruments from a Hughes-era aircraft.", currentValue: 95000, purchasePrice: 34000, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 9), title: "Hughes Tool Company Drill Bit — Patent Model", subtitle: "Rotary cone bit, 1909 patent", universe: "Historical Artifacts", category: "Industrial", notes: "The invention that created the Hughes fortune.", currentValue: 142000, purchasePrice: 50000, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 10), title: "Katharine Hepburn Personal Letter to Hughes", subtitle: "1937 — during their relationship", universe: "Books & Manuscripts", category: "Autographs", notes: "Mentions his world speed record. Signed 'Kate'.", currentValue: 95000, purchasePrice: 34000, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 11), title: "XF-11 Reconnaissance Aircraft Wreckage Fragment", subtitle: "1946 crash site artifact", universe: "Historical Artifacts", category: "Aviation", notes: "From the crash that nearly killed Hughes.", currentValue: 28000, purchasePrice: 10000, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 12), title: "The Outlaw (1943) — Jane Russell Signed Poster", subtitle: "RKO — One-sheet", universe: "Film & Entertainment", category: "Posters", notes: "Signed by Russell. Hughes produced and directed.", currentValue: 48000, purchasePrice: 17000, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 13), title: "Hughes Aircraft Radar System Blueprint", subtitle: "Fire control system, 1950s", universe: "Historical Artifacts", category: "Aviation", notes: "Cold War–era defense contract. Top secret declassified.", currentValue: 72000, purchasePrice: 26000, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 14), title: "Aviator Goggles — Willson Brand, 1930s", subtitle: "Leather and celluloid", universe: "Historical Artifacts", category: "Aviation", notes: "Hughes's type from trans-continental record flights.", currentValue: 22000, purchasePrice: 8000, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 15), title: "Nevada Gaming License — Hughes Hotels, 1967", subtitle: "State of Nevada original", universe: "Books & Manuscripts", category: "Historical Documents", notes: "Acquired Sands, Frontier, Castaways, Landmark.", currentValue: 38000, purchasePrice: 14000, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 16), title: "Lockheed P-38 Lightning Model", subtitle: "Mahogany, 1:24 scale, WWII era", universe: "Historical Artifacts", category: "Aviation", notes: "Hughes tested variants for military contracts.", currentValue: 18000, purchasePrice: 6500, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 17), title: "Transcontinental Flight Log — 1937", subtitle: "Hughes's personal logbook", universe: "Books & Manuscripts", category: "Personal Papers", notes: "New York to LA in 7 hours 28 minutes. Record.", currentValue: 180000, purchasePrice: 64000, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 18), title: "Astrograph Navigation Computer — WWII", subtitle: "Hughes Aircraft development tool", universe: "Historical Artifacts", category: "Scientific Instruments", notes: "Used in training bombers for celestial navigation.", currentValue: 12000, purchasePrice: 4500, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 19), title: "Hollywood Reporter — Hell's Angels Review", subtitle: "May 28, 1930 — premiere issue", universe: "Books & Manuscripts", category: "Newspapers", notes: "Hughes's first major film. Most expensive to date.", currentValue: 14000, purchasePrice: 5200, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 20), title: "Germophobe Glove Collection", subtitle: "White cotton, 1950s–1960s", universe: "Historical Artifacts", category: "Personal Effects", notes: "Hughes wore gloves to avoid contamination. 40 pairs.", currentValue: 28000, purchasePrice: 10000, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 21), title: "Hughes Airwest Timetable — 1968", subtitle: "First season of operations", universe: "Historical Artifacts", category: "Aviation", notes: "Ephemera from his final airline acquisition.", currentValue: 4500, purchasePrice: 1600, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 22), title: "North Star Private Aircraft Interior Panel", subtitle: "Salvaged, Lockheed Constellation, 1950s", universe: "Historical Artifacts", category: "Aviation", notes: "Custom walnut veneer from Hughes's personal aircraft.", currentValue: 35000, purchasePrice: 12500, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 23), title: "Around the World Flight Certificate", subtitle: "Official FAI, July 1938", universe: "Books & Manuscripts", category: "Historical Documents", notes: "3 days 19 hours 17 minutes. World record.", currentValue: 95000, purchasePrice: 34000, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 24), title: "RKO Pictures Acquisition Documents", subtitle: "1948 — Hughes buys RKO for $9M", universe: "Books & Manuscripts", category: "Historical Documents", notes: "Signed by Hughes. The start of his film studio control.", currentValue: 62000, purchasePrice: 22000, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 25), title: "Ava Gardner — Personal Note to Hughes", subtitle: "Handwritten, undated", universe: "Books & Manuscripts", category: "Autographs", notes: "Declining a dinner invitation. Signed 'Ava'.", currentValue: 22000, purchasePrice: 8000, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 26), title: "Hughes Trisomy Test Bacteria Dish", subtitle: "Sealed medical laboratory piece, 1950s", universe: "Historical Artifacts", category: "Medical", notes: "Hughes's extreme OCD generated hundreds of these.", currentValue: 8500, purchasePrice: 3000, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 27), title: "Summa Corporation Private Memo", subtitle: "Hughes dictated memo, 1972", universe: "Books & Manuscripts", category: "Personal Papers", notes: "Re: sale of Nevada properties. In Hughes's handwriting.", currentValue: 45000, purchasePrice: 16000, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 28), title: "USAF Medal of Honor Nomination — Hughes", subtitle: "Congressional record, 1939", universe: "Books & Manuscripts", category: "Historical Documents", notes: "For the around-the-world flight achievement.", currentValue: 32000, purchasePrice: 11500, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 29), title: "Sikorsky S-42 Flying Boat Model", subtitle: "Pan American era, 1:48 scale", universe: "Historical Artifacts", category: "Aviation", notes: "Hughes studied clipper aircraft for Spruce Goose design.", currentValue: 12000, purchasePrice: 4500, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 30), title: "Eccentric's Bible Collection", subtitle: "12 different editions, annotated", universe: "Books & Manuscripts", category: "Religious Books", notes: "Hughes became deeply religious in later years.", currentValue: 18000, purchasePrice: 6500, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 31), title: "Flight Jacket — A-2 Military Style", subtitle: "Horsehide leather, 1940s", universe: "Historical Artifacts", category: "Clothing", notes: "Hughes wore similar on record-breaking flights.", currentValue: 14000, purchasePrice: 5000, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 32), title: "Hughes Communications Satellite Blueprint", subtitle: "SYNCOM, 1963", universe: "Historical Artifacts", category: "Space & Technology", notes: "Hughes Aircraft built the world's first geostationary sat.", currentValue: 85000, purchasePrice: 30000, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 33), title: "Celebrity Address Book — Hughes's Personal", subtitle: "Leather, 1940s", universe: "Books & Manuscripts", category: "Personal Papers", notes: "Listed: Cary Grant, Errol Flynn, Gene Tierney, Gardner.", currentValue: 42000, purchasePrice: 15000, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 34), title: "Hughes Medical Institute Charter", subtitle: "Delaware charter, 1953", universe: "Books & Manuscripts", category: "Historical Documents", notes: "Created as tax shelter. Now major medical research org.", currentValue: 120000, purchasePrice: 42000, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 35), title: "Fedora Hat — Hughes Signature Style", subtitle: "Stetson, 1930s", universe: "Historical Artifacts", category: "Clothing", notes: "Hughes rarely removed his fedora in public.", currentValue: 12000, purchasePrice: 4500, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 36), title: "Constellation Cockpit Clock", subtitle: "Hamilton aircraft chronometer, 1950s", universe: "Historical Artifacts", category: "Aviation", notes: "8-day military aircraft chronometer. TWA markings.", currentValue: 28000, purchasePrice: 10000, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 37), title: "Congressional Testimony Transcript — 1947", subtitle: "Senate War Investigating Committee", universe: "Books & Manuscripts", category: "Historical Documents", notes: "Hughes defends his wartime aircraft contracts.", currentValue: 24000, purchasePrice: 8500, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 38), title: "Hughes Airport Control Tower Model", subtitle: "Las Vegas, 1968", universe: "Historical Artifacts", category: "Models", notes: "Architect's model from his Nevada expansion plans.", currentValue: 22000, purchasePrice: 8000, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 39), title: "TWA Trans-Atlantic Menu — 1946", subtitle: "First class service card", universe: "Historical Artifacts", category: "Aviation", notes: "New York to London inaugural service.", currentValue: 4200, purchasePrice: 1500, isPublic: true, status: "COLLECTION" },
  { id: iid("hughes", 40), title: "Untitled Hughes Will — Contested, 1976", subtitle: "Photostat of handwritten document", universe: "Books & Manuscripts", category: "Historical Documents", notes: "The Mormon Will controversy. All four copies fake.", currentValue: 65000, purchasePrice: 23000, isPublic: true, status: "COLLECTION" },
];

// ═══════════════════════════════════════════════════════════════
// 06 — NIKOLA TESLA
// ═══════════════════════════════════════════════════════════════
const teslaItems: SeedItem[] = [
  { id: iid("tesla", 1), title: "Tesla Coil — Wardenclyffe Original Component", subtitle: "Copper winding, c. 1901", universe: "Science & Technology", category: "Scientific Instruments", notes: "From the Wardenclyffe Tower site. Tested transatlantic wireless.", currentValue: 480000, purchasePrice: 170000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 2), title: "AC Motor Patent Drawing", subtitle: "US Patent 381,968, May 1888", universe: "Books & Manuscripts", category: "Technical Documents", notes: "Original patent filing for polyphase AC induction motor.", currentValue: 320000, purchasePrice: 115000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 3), title: "Marconi vs. Tesla — Supreme Court Brief", subtitle: "1943 — posthumous vindication", universe: "Books & Manuscripts", category: "Legal Documents", notes: "US Supreme Court ruled Tesla invented radio, not Marconi.", currentValue: 85000, purchasePrice: 30000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 4), title: "Westinghouse Contract — 1888", subtitle: "Original signed agreement", universe: "Books & Manuscripts", category: "Historical Documents", notes: "Tesla sold his AC patents for $60,000 and royalties.", currentValue: 280000, purchasePrice: 98000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 5), title: "Pigeon Feather Collection — Hotel New Yorker", subtitle: "Preserved, Room 3327", universe: "Historical Artifacts", category: "Personal Effects", notes: "Tesla loved pigeons. Kept one white female in particular.", currentValue: 22000, purchasePrice: 8000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 6), title: "Tesla's Personal Notebook — Vol. XIV", subtitle: "Handwritten in Serbian and English, 1899", universe: "Books & Manuscripts", category: "Notebooks", notes: "Colorado Springs experiments. Ball lightning observations.", currentValue: 680000, purchasePrice: 240000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 7), title: "Neon Light Tube — Signed Tesla", subtitle: "Luminescent gas tube, 1890s", universe: "Science & Technology", category: "Scientific Instruments", notes: "Tesla pioneered fluorescent lighting. Personal demonstration tube.", currentValue: 48000, purchasePrice: 17000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 8), title: "X-Ray Photography Set — Tesla's Own", subtitle: "Glass plates and Crookes tube, 1896", universe: "Science & Technology", category: "Scientific Instruments", notes: "Tesla independently investigated X-rays same year as Röntgen.", currentValue: 95000, purchasePrice: 34000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 9), title: "Mark Twain Portrait Photograph — Tesla's Lab", subtitle: "Tesla's own photograph, 1894", universe: "Books & Manuscripts", category: "Photographs", notes: "Twain and Tesla were close friends. Taken at 5th Ave lab.", currentValue: 38000, purchasePrice: 14000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 10), title: "Death Ray Patent Application", subtitle: "Filed 1934 — Teleforce weapon system", universe: "Books & Manuscripts", category: "Technical Documents", notes: "Tesla's particle beam weapon concept. Never built.", currentValue: 180000, purchasePrice: 64000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 11), title: "Oscillating Generator — Miniature", subtitle: "Mechanical resonance device, c. 1898", universe: "Science & Technology", category: "Scientific Instruments", notes: "Based on his earthquake machine experiments.", currentValue: 145000, purchasePrice: 52000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 12), title: "Personal Library Volume — Goethe's Faust", subtitle: "German edition, 1808", universe: "Books & Manuscripts", category: "Rare Books", notes: "Tesla memorized Faust. Reading it inspired AC motor concept.", currentValue: 28000, purchasePrice: 10000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 13), title: "Niagara Falls Power Station Blueprint", subtitle: "Original drawings, 1893", universe: "Books & Manuscripts", category: "Technical Documents", notes: "World's first major AC hydroelectric project.", currentValue: 240000, purchasePrice: 85000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 14), title: "Rotating Magnetic Field Demonstration Device", subtitle: "Reconstruction from 1882 specifications", universe: "Science & Technology", category: "Scientific Instruments", notes: "Tesla conceived this while walking in Budapest park.", currentValue: 85000, purchasePrice: 30000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 15), title: "Tesla's Personal Chess Set", subtitle: "Ivory and ebony, c. 1900", universe: "Toys & Games", category: "Chess Sets", notes: "Tesla was an enthusiastic chess player.", currentValue: 18000, purchasePrice: 6500, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 16), title: "Columbia Phonograph Cylinder — Tesla Interview", subtitle: "Wax recording, 1905", universe: "Music & Instruments", category: "Historical Recordings", notes: "Tesla discussing alternating current with a journalist.", currentValue: 95000, purchasePrice: 34000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 17), title: "Radio Remote Control Boat — Original Patent", subtitle: "US Patent 613,809, 1898", universe: "Books & Manuscripts", category: "Technical Documents", notes: "World's first radio-controlled vehicle. Demonstrated in NYC.", currentValue: 220000, purchasePrice: 78000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 18), title: "Hotel New Yorker Room Key — 3327", subtitle: "Brass key, 1930s", universe: "Historical Artifacts", category: "Personal Effects", notes: "Tesla lived in Room 3327 until his death in 1943.", currentValue: 12000, purchasePrice: 4500, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 19), title: "Rumford Medal Citation — Royal Society", subtitle: "1915 — presented with Edison", universe: "Books & Manuscripts", category: "Historical Documents", notes: "Nobel Prize was rumored but neither man won it.", currentValue: 85000, purchasePrice: 30000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 20), title: "Fluorescent Bulb — Tesla's Phosphorescent Lamp", subtitle: "Evacuated glass tube, 1891", universe: "Science & Technology", category: "Scientific Instruments", notes: "Tesla lit this wirelessly using high-frequency current.", currentValue: 32000, purchasePrice: 11500, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 21), title: "Wardenclyffe Tower Architectural Drawing", subtitle: "Stanford White design, 1901", universe: "Books & Manuscripts", category: "Architectural Plans", notes: "White was the famous architect. Tesla's global wireless tower.", currentValue: 180000, purchasePrice: 64000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 22), title: "Tesla's Gold Watch", subtitle: "Swiss pocket watch, Patek Philippe, c. 1900", universe: "Jewelry & Accessories", category: "Watches", notes: "Engraved: 'N.T.' Pawned during financial hardship.", currentValue: 42000, purchasePrice: 15000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 23), title: "Thomas Edison — Letter to Tesla, 1886", subtitle: "Before their feud", universe: "Books & Manuscripts", category: "Autographs", notes: "Edison offering Tesla $50,000 to improve DC dynamos.", currentValue: 180000, purchasePrice: 64000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 24), title: "Photographic Portrait — Napoleon Sarony", subtitle: "Tesla at age 34, 1890", universe: "Books & Manuscripts", category: "Photographs", notes: "Famous studio photograph. Tesla in formal attire.", currentValue: 28000, purchasePrice: 10000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 25), title: "Electrical Experimenter Magazine — Tesla Cover", subtitle: "July 1919 issue", universe: "Books & Manuscripts", category: "Periodicals", notes: "Tesla's autobiography serial. Signed by Tesla.", currentValue: 22000, purchasePrice: 8000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 26), title: "Alternating Current Generator — Scale Model", subtitle: "Built to 1882 Budapest specifications", universe: "Science & Technology", category: "Scientific Instruments", notes: "Demonstrates the rotating magnetic field principle.", currentValue: 65000, purchasePrice: 23000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 27), title: "Colorado Springs Experimental Notes", subtitle: "Bound report, December 1899", universe: "Books & Manuscripts", category: "Notebooks", notes: "Million-volt tests. Photos of sparks 100 feet long.", currentValue: 320000, purchasePrice: 115000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 28), title: "Tesla's Letter to J.P. Morgan — 1903", subtitle: "Requesting additional Wardenclyffe funding", universe: "Books & Manuscripts", category: "Autographs", notes: "Morgan cut funding. Tower never completed.", currentValue: 145000, purchasePrice: 52000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 29), title: "Spark Gap Transmitter — Early Wireless", subtitle: "Brass and mahogany, c. 1897", universe: "Science & Technology", category: "Scientific Instruments", notes: "High-frequency oscillator for wireless power experiments.", currentValue: 85000, purchasePrice: 30000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 30), title: "Serbian Orthodox Icon — Gift to Tesla", subtitle: "Tempera on gold ground, 19th Century", universe: "Fine Art", category: "Religious Art", notes: "Tesla was Serbian Orthodox. Kept on his desk.", currentValue: 22000, purchasePrice: 8000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 31), title: "Vacuum Tube Collection — Early Electronic", subtitle: "Set of 24 tubes, 1890s–1910s", universe: "Science & Technology", category: "Electronic Components", notes: "Tesla's prototypes for various experiments.", currentValue: 38000, purchasePrice: 14000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 32), title: "Tesla's Business Card — 5th Avenue Lab", subtitle: "Engraved, c. 1892", universe: "Books & Manuscripts", category: "Personal Papers", notes: "Address: 33–35 South Fifth Avenue, New York.", currentValue: 8500, purchasePrice: 3000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 33), title: "Magnifying Transmitter Blueprint", subtitle: "Colorado Springs, 1899", universe: "Books & Manuscripts", category: "Technical Documents", notes: "World's most powerful electrical oscillator at the time.", currentValue: 180000, purchasePrice: 64000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 34), title: "Statue — Young Tesla at Budapest Park", subtitle: "Bronze maquette, 21st Century artist", universe: "Fine Art", category: "Sculpture", notes: "Depicting the moment Tesla conceived the AC motor, 1882.", currentValue: 8500, purchasePrice: 3000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 35), title: "Telephone Exchange Drawing — Central Switching", subtitle: "Tesla patent sketch, 1887", universe: "Books & Manuscripts", category: "Technical Documents", notes: "Applied principles to telephone switching systems.", currentValue: 48000, purchasePrice: 17000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 36), title: "OCD Ritual Personal Log", subtitle: "Diary, 1920s", universe: "Books & Manuscripts", category: "Personal Papers", notes: "Documents Tesla's obsessive behaviors: 18 napkins, 3 plates.", currentValue: 145000, purchasePrice: 52000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 37), title: "Liberty Bell — Tesla-Era Generator Coupling", subtitle: "Industrial artifact, 1893 World's Fair", universe: "Historical Artifacts", category: "Industrial", notes: "From the AC generator that lit the Columbian Exposition.", currentValue: 95000, purchasePrice: 34000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 38), title: "Philosophical Magazine — Tesla Article", subtitle: "1891 — On the Dissipation of the Electrical Energy", universe: "Books & Manuscripts", category: "Periodicals", notes: "Signed by Tesla. Foundational paper on wireless energy.", currentValue: 42000, purchasePrice: 15000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 39), title: "Tesla's Walking Cane — Ebony and Silver", subtitle: "Personal possession, late career", universe: "Historical Artifacts", category: "Personal Effects", notes: "Tesla was 6'2\" and slender. Used a cane in his 70s.", currentValue: 38000, purchasePrice: 14000, isPublic: true, status: "COLLECTION" },
  { id: iid("tesla", 40), title: "US Patent 645,576 — System of Transmission of Electrical Energy", subtitle: "March 20, 1900", universe: "Books & Manuscripts", category: "Technical Documents", notes: "Core wireless power transmission patent.", currentValue: 220000, purchasePrice: 78000, isPublic: true, status: "COLLECTION" },
];

// ═══════════════════════════════════════════════════════════════
// 07 — EMPEROR NERO
// ═══════════════════════════════════════════════════════════════
const neroItems: SeedItem[] = [
  { id: iid("nero", 1), title: "Roman Aureus — Nero Portrait", subtitle: "Rome mint, 64–68 AD", universe: "Coins & Currency", category: "Ancient Coins", notes: "Laureate head right. NERO CAESAR obverse. EF.", currentValue: 85000, purchasePrice: 30000, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 2), title: "Domus Aurea Fresco Fragment", subtitle: "Painted plaster, 64–68 AD", universe: "Antiquities", category: "Roman", notes: "From Nero's Golden House. Grotesque decoration style.", currentValue: 280000, purchasePrice: 98000, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 3), title: "Bronze Colossus Model — Nero as Sun God", subtitle: "Modern reconstruction after Pliny, 1:24 scale", universe: "Fine Art", category: "Sculpture", notes: "Original statue stood 100 feet at the Domus Aurea entrance.", currentValue: 18000, purchasePrice: 6500, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 4), title: "Roman Lyre — Reconstructed", subtitle: "Seven-string kithara style", universe: "Music & Instruments", category: "Ancient Instruments", notes: "Nero reportedly played while Rome burned. Historical irony.", currentValue: 85000, purchasePrice: 30000, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 5), title: "Emerald Monocle — Roman Style", subtitle: "Polished emerald disk, replica of Pliny's account", universe: "Jewelry & Accessories", category: "Eyewear", notes: "Pliny claimed Nero watched gladiator fights through an emerald.", currentValue: 48000, purchasePrice: 17000, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 6), title: "Roman Bronze Gladiator Helmet", subtitle: "Pompeii type, 1st Century AD", universe: "Antiquities", category: "Roman", notes: "Griffin crest. Visor intact. Pompeii excavation.", currentValue: 480000, purchasePrice: 170000, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 7), title: "Suetonius — The Twelve Caesars, First Printing", subtitle: "Venice, 1471", universe: "Books & Manuscripts", category: "Rare Books", notes: "Primary source for Nero's biography. Incunabula.", currentValue: 145000, purchasePrice: 52000, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 8), title: "Roman Mosaic — Gladiatorial Combat", subtitle: "Villa Borghese, 4th Century AD", universe: "Antiquities", category: "Roman", notes: "Eight fighters named in inscriptions. Tesserae.", currentValue: 620000, purchasePrice: 220000, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 9), title: "Nero's Stage Mask — Theater Comedy", subtitle: "Terracotta, 1st Century AD", universe: "Antiquities", category: "Roman", notes: "Nero performed publicly as an actor. Scandalous for emperor.", currentValue: 95000, purchasePrice: 34000, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 10), title: "Rome Fire Commemoration Medal", subtitle: "Bronze, modern, after 64 AD event", universe: "Coins & Currency", category: "Medals", notes: "Great Fire burned 10 of 14 Roman districts.", currentValue: 8500, purchasePrice: 3000, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 11), title: "Roman Glass Amphora — 1st Century AD", subtitle: "Blown glass, blue-green, Italian", universe: "Antiquities", category: "Roman", notes: "Mold-blown. Grape and vine decoration.", currentValue: 48000, purchasePrice: 17000, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 12), title: "Agrippina the Younger Bust", subtitle: "Marble, 1st Century AD", universe: "Antiquities", category: "Roman", notes: "Nero's mother. He had her murdered. Damnatio memoriae.", currentValue: 380000, purchasePrice: 135000, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 13), title: "Roman Chariot Wheel Fragment", subtitle: "Iron and wood, 1st Century AD", universe: "Antiquities", category: "Roman", notes: "From circus maximus archaeological excavation.", currentValue: 42000, purchasePrice: 15000, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 14), title: "Poppaea Sabina Portrait Coin", subtitle: "Sestertius, Rome mint, 65 AD", universe: "Coins & Currency", category: "Ancient Coins", notes: "Nero's second wife. Diademed bust right.", currentValue: 22000, purchasePrice: 8000, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 15), title: "Roman Ivory Dice Set", subtitle: "14 dice, 1st Century AD", universe: "Toys & Games", category: "Game Pieces", notes: "Excavated from Pompeii thermopolium.", currentValue: 28000, purchasePrice: 10000, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 16), title: "Domus Aurea Floor Tile — Opus Sectile", subtitle: "Marble inlay, 64 AD", universe: "Antiquities", category: "Roman", notes: "Geometric pattern. Multi-colored marble.", currentValue: 32000, purchasePrice: 11500, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 17), title: "Roman Silver Plate — Hunting Scene", subtitle: "Argentum, 1st Century AD", universe: "Antiquities", category: "Roman", notes: "Repoussé boar hunt. Palatine Hill excavation.", currentValue: 185000, purchasePrice: 65000, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 18), title: "Tacitus — Annals Manuscript Fragment", subtitle: "Medieval copy of Roman original", universe: "Books & Manuscripts", category: "Manuscripts", notes: "Tacitus was Nero's harshest critic. Key historical source.", currentValue: 120000, purchasePrice: 42000, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 19), title: "Orichalcum Sestertius — Nero Large Bronze", subtitle: "Rome mint, 64 AD, after the fire", universe: "Coins & Currency", category: "Ancient Coins", notes: "New coinage after fire. Nero's finest portrait coin.", currentValue: 18000, purchasePrice: 6500, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 20), title: "Roman Oil Lamp — Gladiator Design", subtitle: "Terracotta, 1st Century AD", universe: "Antiquities", category: "Roman", notes: "Fighter with trident. 'FELIX' inscription.", currentValue: 4500, purchasePrice: 1600, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 21), title: "Gold Fibula — Roman Imperial", subtitle: "1st Century AD", universe: "Jewelry & Accessories", category: "Ancient Jewelry", notes: "Wheel brooch with garnet insets. Imperial quality.", currentValue: 48000, purchasePrice: 17000, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 22), title: "Roman Bronze Lion Head Finial", subtitle: "1st–2nd Century AD", universe: "Antiquities", category: "Roman", notes: "From a throne or ceremonial couch.", currentValue: 22000, purchasePrice: 8000, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 23), title: "Nero's Charioteer Signet Ring", subtitle: "Gold intaglio, 1st Century AD", universe: "Jewelry & Accessories", category: "Ancient Jewelry", notes: "Nero raced chariots at Olympia. Won despite falling off.", currentValue: 95000, purchasePrice: 34000, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 24), title: "Roman Fresco — Apollo as Musician", subtitle: "Pompeii, 1st Century AD", universe: "Fine Art", category: "Ancient Art", notes: "Nero identified with Apollo. Propaganda imagery.", currentValue: 180000, purchasePrice: 64000, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 25), title: "Roman Wax Tablet — Imperial Decree", subtitle: "Wooden and beeswax, 1st Century AD", universe: "Antiquities", category: "Roman", notes: "Administrative order. Faint stylus marks visible.", currentValue: 85000, purchasePrice: 30000, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 26), title: "Acta Diurna Fragment — Nero's Games", subtitle: "Stone inscription, 1st Century AD", universe: "Antiquities", category: "Roman", notes: "Rome's daily gazette. Records a Neronian festival.", currentValue: 42000, purchasePrice: 15000, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 27), title: "Roman Glass Beaker — Blue Ribbed", subtitle: "1st Century AD, Rhineland or Syro-Palestinian", universe: "Antiquities", category: "Roman", notes: "Mold-blown ribbed decoration. Turquoise glass.", currentValue: 32000, purchasePrice: 11500, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 28), title: "Praetorian Guard Spearhead", subtitle: "Iron, 1st Century AD", universe: "Antiquities", category: "Roman", notes: "The Praetorian Guard ultimately abandoned Nero.", currentValue: 14000, purchasePrice: 5000, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 29), title: "Roman Marble Relief — Apotheosis Scene", subtitle: "2nd Century AD", universe: "Antiquities", category: "Roman", notes: "Emperor ascending on eagle. Deification imagery.", currentValue: 280000, purchasePrice: 98000, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 30), title: "Gaming Board — Roman Calculi", subtitle: "Marble, 1st Century AD", universe: "Toys & Games", category: "Game Pieces", notes: "Roman board game. White and black glass counters included.", currentValue: 22000, purchasePrice: 8000, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 31), title: "Colosseum Foundation Stone", subtitle: "Travertine block, 72 AD", universe: "Antiquities", category: "Roman", notes: "Colosseum built on Nero's Domus Aurea lake site.", currentValue: 95000, purchasePrice: 34000, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 32), title: "Roman Pearl Earring Pair", subtitle: "Gold wire with drop pearls, 1st Century AD", universe: "Jewelry & Accessories", category: "Ancient Jewelry", notes: "Poppaea was famous for pearls. Type from Pompeii finds.", currentValue: 48000, purchasePrice: 17000, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 33), title: "Nero — Historia Augusta Text Panel", subtitle: "Medieval illuminated manuscript page", universe: "Books & Manuscripts", category: "Manuscripts", notes: "Illuminated initial with Nero figure. Latin text.", currentValue: 32000, purchasePrice: 11500, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 34), title: "Roman Bronze Horse Statuette", subtitle: "1st–2nd Century AD", universe: "Antiquities", category: "Roman", notes: "Chariot horse type. Hollow cast. Legs intact.", currentValue: 65000, purchasePrice: 23000, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 35), title: "Roman Terracotta Antefix — Theatrical Mask", subtitle: "1st Century BC–AD", universe: "Antiquities", category: "Roman", notes: "Architectural element. Comic mask. Vivid painting.", currentValue: 12000, purchasePrice: 4500, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 36), title: "Triumph Procession Relief Fragment", subtitle: "Marble, 1st–2nd Century AD", universe: "Antiquities", category: "Roman", notes: "Soldiers with eagle standards. Spoils of war depicted.", currentValue: 120000, purchasePrice: 42000, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 37), title: "Roman Cameo — Emperor Triumphant", subtitle: "Sardonyx, 1st Century AD", universe: "Antiquities", category: "Roman", notes: "Laureate emperor on horseback. Two-layer stone.", currentValue: 180000, purchasePrice: 64000, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 38), title: "Seneca's Letters to Nero", subtitle: "De Clementia, manuscript copy, 9th Century", universe: "Books & Manuscripts", category: "Manuscripts", notes: "Seneca tutored Nero. Later forced to commit suicide.", currentValue: 85000, purchasePrice: 30000, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 39), title: "Pompeii Red Wall Fresco Panel", subtitle: "Fourth Style, c. 62–79 AD", universe: "Antiquities", category: "Roman", notes: "Garden scene with birds. Nero-period decoration.", currentValue: 240000, purchasePrice: 85000, isPublic: true, status: "COLLECTION" },
  { id: iid("nero", 40), title: "Last Denarius of Nero — 68 AD", subtitle: "Final emission, struck before suicide", universe: "Coins & Currency", category: "Ancient Coins", notes: "Gallic mint. Nero type. Rare final issue.", currentValue: 48000, purchasePrice: 17000, isPublic: true, status: "COLLECTION" },
];

// ═══════════════════════════════════════════════════════════════
// All characters array — will be expanded in Part 2
// ═══════════════════════════════════════════════════════════════
export const SEED_CHARACTERS: SeedCharacter[] = [
  {
    profileId: "00000000-0000-0000-0000-000000000001",
    displayName: "J.P. Morgan",
    handle: "jpmorgan",
    avatarEmoji: "🏦",
    bio: "Financier. Industrialist. The man who owned half of America and most of its art. Morgan collected with the same ruthless precision he applied to business — acquiring only the finest, rarest, and most historically significant objects the world had to offer.",
    primaryFocus: "Fine Art",
    items: jpMorganItems,
    galleries: [
      {
        id: gid("morgan", 1),
        title: "The Morgan Treasury",
        description: "The crown jewels of the Morgan Collection — rare manuscripts, Old Masters, and the finest antiquities money could acquire.",
        themePack: "walnut",
        visibility: "PUBLIC",
        itemIds: jpMorganItems.slice(0, 16).map(i => i.id),
      },
      {
        id: gid("morgan", 2),
        title: "Manuscripts & Rare Books",
        description: "Morgan's legendary library — Gutenberg Bibles, Shakespeare folios, and autograph letters from the greatest minds in history.",
        themePack: "classic",
        visibility: "PUBLIC",
        itemIds: jpMorganItems.filter(i => i.universe === "Books & Manuscripts").slice(0, 16).map(i => i.id),
      },
    ],
  },
  {
    profileId: "00000000-0000-0000-0000-000000000002",
    displayName: "William Randolph Hearst",
    handle: "wrhearst",
    avatarEmoji: "🏰",
    bio: "Publisher. Builder of castles. Hearst filled San Simeon with enough art, antiquities, and film memorabilia to stock three museums — and kept buying when the rooms ran out. A man who literally purchased an entire Spanish monastery because he liked the architecture.",
    primaryFocus: "Film & Entertainment",
    items: hearstItems,
    galleries: [
      {
        id: gid("hearst", 1),
        title: "The Castle Collection",
        description: "Art, antiquities, and architectural salvage from San Simeon — the greatest private collection in American history.",
        themePack: "marble",
        visibility: "PUBLIC",
        itemIds: hearstItems.slice(0, 16).map(i => i.id),
      },
      {
        id: gid("hearst", 2),
        title: "Golden Age of Hollywood",
        description: "Hearst's film empire in artifacts — posters, lobby cards, scripts, and signed photographs from cinema's greatest era.",
        themePack: "midnight",
        visibility: "PUBLIC",
        itemIds: hearstItems.filter(i => i.universe === "Film & Entertainment").slice(0, 16).map(i => i.id),
      },
    ],
  },
  {
    profileId: "00000000-0000-0000-0000-000000000003",
    displayName: "Cornelius Vanderbilt",
    handle: "thecommodore",
    avatarEmoji: "🚂",
    bio: "Commodore. Railroad baron. Vanderbilt built America's transportation backbone and spent his fortune furnishing mansions that made European royalty envious. Coins, paintings, silver, and the finest French furniture this side of Versailles.",
    primaryFocus: "Coins & Currency",
    items: vanderbiltItems,
    galleries: [
      {
        id: gid("vanderbilt", 1),
        title: "The Commodore's Vault",
        description: "Fine art, silver, and rare coins from the man who connected a continent by rail and sea.",
        themePack: "classic",
        visibility: "PUBLIC",
        itemIds: vanderbiltItems.slice(0, 16).map(i => i.id),
      },
    ],
  },
  {
    profileId: "00000000-0000-0000-0000-000000000004",
    displayName: "King Henry VIII",
    handle: "kinghenry8",
    avatarEmoji: "👑",
    bio: "Six wives. One Reformation. Henry ruled with absolute power and collected with equal intensity — manuscripts, armor, musical instruments, and the spoils of dissolved monasteries. Every piece tells a story of power, obsession, and consequence.",
    primaryFocus: "Historical Artifacts",
    items: henryItems,
    galleries: [
      {
        id: gid("henry8", 1),
        title: "The Royal Armory",
        description: "Arms, armor, and martial artifacts from the most formidable king in English history.",
        themePack: "walnut",
        visibility: "PUBLIC",
        itemIds: henryItems.filter(i => i.category === "Arms & Militaria").map(i => i.id),
      },
      {
        id: gid("henry8", 2),
        title: "Tudor Court",
        description: "Manuscripts, portraits, jewelry, and court artifacts from the reign of Henry VIII.",
        themePack: "classic",
        visibility: "PUBLIC",
        itemIds: henryItems.slice(0, 16).map(i => i.id),
      },
    ],
  },
  {
    profileId: "00000000-0000-0000-0000-000000000005",
    displayName: "Howard Hughes",
    handle: "howardhughes",
    avatarEmoji: "✈️",
    bio: "Aviator. Filmmaker. Recluse. Hughes chased speed records, built Hollywood dreams, and eventually retreated into a world of his own making. His collection spans the golden age of aviation, the silver screen, and the obsessive paperwork of a brilliant, troubled mind.",
    primaryFocus: "Historical Artifacts",
    items: hughesItems,
    galleries: [
      {
        id: gid("hughes", 1),
        title: "The Hughes Aviation Collection",
        description: "Blueprints, instruments, and artifacts from aviation's most daring pioneer.",
        themePack: "cold-blue",
        visibility: "PUBLIC",
        itemIds: hughesItems.filter(i => i.category === "Aviation").slice(0, 16).map(i => i.id),
      },
      {
        id: gid("hughes", 2),
        title: "Hollywood & Obsession",
        description: "Film posters, signed photographs, and personal effects from Hughes's Hollywood years.",
        themePack: "midnight",
        visibility: "PUBLIC",
        itemIds: hughesItems.slice(0, 16).map(i => i.id),
      },
    ],
  },
  {
    profileId: "00000000-0000-0000-0000-000000000006",
    displayName: "Nikola Tesla",
    handle: "nikolatesla",
    avatarEmoji: "⚡",
    bio: "Inventor. Visionary. The man who electrified the world and died broke in a hotel room. Tesla's collection spans the instruments of his genius, the patents that were stolen from him, and the notebooks that still hold secrets science hasn't fully decoded.",
    primaryFocus: "Science & Technology",
    items: teslaItems,
    galleries: [
      {
        id: gid("tesla", 1),
        title: "The Inventor's Workshop",
        description: "Scientific instruments, patents, and personal artifacts from the man who invented the modern world.",
        themePack: "cold-blue",
        visibility: "PUBLIC",
        itemIds: teslaItems.slice(0, 16).map(i => i.id),
      },
      {
        id: gid("tesla", 2),
        title: "Notebooks & Patents",
        description: "Tesla's handwritten notebooks, patent drawings, and the documents of his genius — and his disputes.",
        themePack: "classic",
        visibility: "PUBLIC",
        itemIds: teslaItems.filter(i => i.universe === "Books & Manuscripts").slice(0, 16).map(i => i.id),
      },
    ],
  },
  {
    profileId: "00000000-0000-0000-0000-000000000007",
    displayName: "Emperor Nero",
    handle: "emperornero",
    avatarEmoji: "🔥",
    bio: "Emperor of Rome. Performer. Tyrant. Whether or not he fiddled while Rome burned, Nero spent lavishly on art, theater, and spectacle. His Golden House alone consumed the heart of the city. The collection you see here was recovered from its ruins.",
    primaryFocus: "Antiquities",
    items: neroItems,
    galleries: [
      {
        id: gid("nero", 1),
        title: "The Golden House",
        description: "Antiquities, coins, and artifacts from the most opulent private residence in Roman history.",
        themePack: "walnut",
        visibility: "PUBLIC",
        itemIds: neroItems.slice(0, 16).map(i => i.id),
      },
    ],
  },
];

// NOTE: This file continues in Part 2 with characters 08–22.
// Run scripts/generateCharacterSeed.ts after all parts are merged.
