// The maintained list of major, well-known recurring collector shows (read by api/cron/refresh-major-events). This is a NAME lookup, not a keyword
// search, so there is no "a plumbing convention matched the keyword" risk: nothing is being discovered, only refreshed against a fixed, approved list.
//
// Every show on this list is saved as Featured, which is what puts it ahead of the many small local shows when the Home banner chooses its ten events.
// To take a show off the banner's priority list, remove it here (the Featured toggle in Admin > Events is overwritten by the weekly run for these).
//
// Each is listed once by name; the weekly job just keeps its date/location current.
export type MajorShow = { name: string; universes: string[] };

export const MAJOR_SHOWS: MajorShow[] = [
  { name: "San Diego Comic-Con", universes: ["comics", "toys", "games"] },
  { name: "New York Comic Con", universes: ["comics", "toys"] },
  { name: "LA Comic Con", universes: ["comics", "toys"] },
  { name: "WonderCon", universes: ["comics"] },
  { name: "C2E2 Chicago Comic and Entertainment Expo", universes: ["comics", "toys"] },
  { name: "The National Sports Collectors Convention", universes: ["sports_cards", "tcg"] },
  { name: "Pokemon World Championships", universes: ["tcg"] },
  { name: "MagicCon", universes: ["tcg"] },
  { name: "Gen Con", universes: ["games", "tcg"] },
  { name: "NAMM Show", universes: ["vinyl"] },
  { name: "WFMU Record Fair", universes: ["vinyl"] },
  { name: "Sneaker Con", universes: ["sneakers"] },
  { name: "Windup Watch Fair", universes: ["watches"] },
  { name: "Portland Retro Gaming Expo", universes: ["games"] },
  { name: "WhiskyFest", universes: ["whisky"] },
  { name: "ANA World's Fair of Money", universes: ["coins"] },
  { name: "APS StampShow", universes: ["stamps"] },
  { name: "Barrett-Jackson Auction", universes: ["classic_cars"] },
  { name: "Pebble Beach Concours d'Elegance", universes: ["classic_cars"] },
  { name: "SEMA Show", universes: ["automotive"] },
];
