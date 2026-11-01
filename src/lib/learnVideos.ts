export type LearnVideo = {
  id: string;
  title: string;
  description: string;
  duration: string;
  device: "Desktop" | "Phone" | "Desktop + phone";
  collection: "Walkthroughs" | "Quick tips" | "About VLTD";
  access: "public" | "account";
  portrait?: boolean;
};

// Metadata only. Unlisted YouTube links belong in server-only LEARN_VIDEO_LINKS_JSON,
// never in this public client module or a NEXT_PUBLIC environment variable.
export const LEARN_VIDEOS: readonly LearnVideo[] = [
  { id: "quick-add-combined", title: "Quick Add: start here", description: "From Home to your saved items, with desktop and phone steps.", duration: "2:26", device: "Desktop + phone", collection: "Walkthroughs", access: "account" },
  { id: "quick-add-desktop", title: "Quick Add on desktop", description: "Set up the camera, take photos, review the details and save to your Vault.", duration: "1:58", device: "Desktop", collection: "Walkthroughs", access: "account" },
  { id: "quick-add-phone", title: "Quick Add on your phone", description: "Follow the phone version of the Quick Add walkthrough.", duration: "1:26", device: "Phone", collection: "Walkthroughs", access: "account", portrait: true },
  { id: "add-item-combined", title: "Add Item: the complete guide", description: "Photos, identity, category, location, cost, value and saving, on desktop and phone.", duration: "8:44", device: "Desktop + phone", collection: "Walkthroughs", access: "account" },
  { id: "add-item-desktop", title: "Add Item on desktop", description: "Explore the Add Item form, its buttons and its five detail sections.", duration: "8:02", device: "Desktop", collection: "Walkthroughs", access: "account" },
  { id: "add-item-phone", title: "Add Item on your phone", description: "A detailed phone walkthrough from Home through photos, details and Save to Vault.", duration: "7:07", device: "Phone", collection: "Walkthroughs", access: "account", portrait: true },
  { id: "add-item-short-1", title: "Add your first item", description: "Open Add Item, attach a photo, enter a name and save.", duration: "0:54", device: "Phone", collection: "Quick tips", access: "account", portrait: true },
  { id: "add-item-short-2", title: "Add the details that matter", description: "Brand, set, certification, grade, condition and notes.", duration: "0:53", device: "Phone", collection: "Quick tips", access: "account", portrait: true },
  { id: "add-item-short-3", title: "Choose a universe and category", description: "File a collectible by universe, category, subcategory and rarity.", duration: "0:47", device: "Phone", collection: "Quick tips", access: "account", portrait: true },
  { id: "add-item-short-4", title: "Remember where it is", description: "Record a storage location and use the location lock.", duration: "0:44", device: "Phone", collection: "Quick tips", access: "account", portrait: true },
  { id: "add-item-short-5", title: "Purchase cost and current value", description: "Keep what you paid separate from a valuation, including blank and zero amounts.", duration: "0:39", device: "Phone", collection: "Quick tips", access: "account", portrait: true },
  { id: "add-item-short-6", title: "Add and arrange your photos", description: "Add several photos, choose a cover, reorder and remove pictures.", duration: "0:38", device: "Phone", collection: "Quick tips", access: "account", portrait: true },
  { id: "add-item-promo-1", title: "A home for your collection", description: "A quick introduction to photographing and recording your collectibles in VLTD.", duration: "0:23", device: "Phone", collection: "About VLTD", access: "public", portrait: true },
  { id: "add-item-promo-2", title: "Every detail in one place", description: "Organize details, record storage locations and compare cost with value.", duration: "0:23", device: "Phone", collection: "About VLTD", access: "public", portrait: true },
  { id: "quick-add-promo", title: "Meet Quick Add", description: "A captioned preview of adding collectibles with your camera.", duration: "0:23", device: "Phone", collection: "About VLTD", access: "public", portrait: true },
];
