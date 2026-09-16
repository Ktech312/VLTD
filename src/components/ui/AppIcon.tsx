import type { CSSProperties, ReactNode } from "react";

// The single icon system for VLTD's interface. One semantic name per
// concept, rendered through one component, so a future icon change (or the
// upcoming soft 3D/glass "feature" pack) only has to happen in one place —
// including top and bottom navigation, which used to hand-roll their own
// per-surface <svg> functions.
//
// House style for the "compact" variant: thin stroke, currentColor, round
// caps — matches the original bottom-nav icons. No emoji / generic icons.
//
// This file was formerly `Glyph.tsx`. That file now just re-exports
// everything here under its original names (`Glyph`, `GlyphName`,
// `emojiGlyphName`, `universeGlyphName`) so none of its ~50 existing
// importers needed to change.

export type IconVariant = "compact" | "feature" | "navTop" | "navBottom";

export type AppIconName =
  // ── Semantic action/nav icons (the reason this file exists) ──────────
  | "addItem"
  | "organize"
  | "editRoom"
  | "save"
  | "viewGallery"
  | "vault"
  | "exhibitions"
  | "discover"
  | "events"
  | "notifications"
  | "search"
  | "account"
  | "settings"
  | "close"
  | "back"
  | "next"
  | "upload"
  | "camera"
  | "share"
  | "favorite"
  | "delete"
  // ── Natural extensions found while centralizing real usages ──────────
  | "door"
  | "chevronDown"
  | "chevronUp"
  | "externalLink"
  | "layers"
  | "map"
  | "mapPin"
  | "price"
  | "paintbrush"
  | "edit"
  | "rotate"
  | "loader"
  | "ticket"
  | "eyeOff"
  | "more"
  // ── Added centralizing TopNav / BottomNav / the wider app sweep ──────
  | "communityBoard"
  | "insights"
  | "learn"
  | "activity"
  | "dashboard"
  | "guide"
  | "checkmark"
  | "sparkleAI"
  | "download"
  | "ruler"
  | "flipVertical"
  | "unlocked"
  | "expand"
  | "eraser"
  | "document"
  | "copy"
  | "sms"
  | "email"
  | "flash"
  | "play"
  | "dragHandle"
  | "gift"
  | "arrowLeft"
  // ── Legacy GlyphName values — kept so every existing Glyph consumer
  //    keeps rendering exactly what it did before. Some names below are
  //    conceptual duplicates of a semantic name above (e.g. "heart" /
  //    "favorite", "bell" / "notifications") — both are kept because
  //    existing call sites reference the old name directly. ──────────────
  | "bell"
  | "message"
  | "exhibition"
  | "bug"
  | "chart"
  | "target"
  | "trophy"
  | "tag"
  | "heart"
  | "bag"
  | "gavel"
  | "box"
  | "sofa"
  | "sparkle"
  | "flame"
  | "key"
  | "cart"
  | "shield"
  | "cards"
  | "music"
  | "gem"
  | "game"
  | "leaf"
  | "star"
  | "car"
  | "palette"
  | "burst"
  | "users"
  | "check"
  | "clock"
  | "eye"
  | "building"
  | "warning"
  | "lock"
  | "megaphone"
  | "moon"
  | "sun"
  | "frame"
  | "rocket"
  | "globe"
  | "book"
  | "wrench"
  | "scan"
  | "info"
  | "link"
  | "selectItems"
  | "card"
  | "cloud"
  | "dollar"
  | "inbox";

const PATHS: Record<AppIconName, ReactNode> = {
  /* ── Semantic action/nav icons ─────────────────────────────────────── */
  addItem: (<><path d="M12 5v14M5 12h14" /></>),
  organize: (<><rect x="4" y="4" width="7" height="7" rx="1.2" /><rect x="13" y="4" width="7" height="7" rx="1.2" /><rect x="4" y="13" width="7" height="7" rx="1.2" /><rect x="13" y="13" width="7" height="7" rx="1.2" /></>),
  editRoom: (<><rect x="4" y="5" width="12" height="12" rx="1.3" /><path d="M14 15.5 20 9.5a1.5 1.5 0 0 0-2-2L12 14v2h2Z" /></>),
  save: (<><path d="M5 4h11l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" /><path d="M8 4v5h7V4" /><path d="M8 14h8v6H8z" /></>),
  viewGallery: (<><rect x="3" y="4.5" width="18" height="12" rx="1.5" /><path d="M8 20h8M12 16.5V20" /></>),
  // Generic fallback picture — the real destination-tab look lives in
  // NAV_TOP_CONTENT / NAV_BOTTOM_CONTENT below (each surface has its own,
  // deliberately different, art for this destination).
  vault: (<><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="12" cy="12" r="4.2" /><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" /><path d="M12 6.2v1.6M12 16.2v1.6M6.2 12h1.6M16.2 12h1.6" /></>),
  // Same art as the legacy singular "exhibition" — one shared picture.
  // (Nav-specific art for this destination lives in the nav content maps.)
  exhibitions: (<><path d="M4 9 12 4l8 5H4z" /><path d="M6.5 9v8M10 9v8M14 9v8M17.5 9v8" /><path d="M4 18.5h16" /></>),
  discover: (<><circle cx="12" cy="12" r="8.5" /><polygon points="12,6 14,12 12,11 10,12" fill="currentColor" stroke="none" /><polygon points="12,18 14,12 12,13 10,12" fill="currentColor" stroke="none" opacity="0.4" /></>),
  events: (<><rect x="3" y="5.5" width="18" height="15" rx="2" /><path d="M3 10h18" /><path d="M8 3.5v4M16 3.5v4" /></>),
  // Same art as the legacy "bell" — one shared picture. (TopNav's own
  // AlertsBell art lives in NAV_TOP_CONTENT.)
  notifications: (<><path d="M6 16v-5a6 6 0 0 1 12 0v5" /><path d="M4.5 16h15" /><path d="M10.4 19a1.7 1.7 0 0 0 3.2 0" /></>),
  search: (<><circle cx="11" cy="11" r="6.2" /><path d="M20 20l-4.4-4.4" /></>),
  account: (<><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>),
  // Equalizer/sliders — matches the meaning of BottomNav's "Command Center"
  // entry (account, tools, data, sharing) better than a plain gear.
  settings: (<><path d="M4 8h8M16 8h4M4 16h4M12 16h8" /><circle cx="14" cy="8" r="2" /><circle cx="8" cy="16" r="2" /></>),
  close: (<><path d="M6 6l12 12M18 6 6 18" /></>),
  back: (<><path d="M15 6l-6 6 6 6" /></>),
  next: (<><path d="M9 6l6 6-6 6" /></>),
  upload: (<><path d="M12 15.5V5M8 9l4-4 4 4" /><path d="M5 16v1.5A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5V16" /></>),
  camera: (<><path d="M4 8h2.5l1.3-2h8.4l1.3 2H20a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.2" /></>),
  share: (<><path d="M4 12.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6.5" /><path d="M12 15V4M8 8l4-4 4 4" /></>),
  // Same art as the legacy "heart" — one shared picture.
  favorite: (<><path d="M12 20s-7-4.4-7-9.4A3.6 3.6 0 0 1 12 8a3.6 3.6 0 0 1 7 2.6C19 15.6 12 20 12 20z" /></>),
  delete: (<><path d="M5 7h14" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /><path d="M7 7l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13" /><path d="M10 11v6M14 11v6" /></>),

  /* ── Extensions ─────────────────────────────────────────────────────── */
  door: (<><path d="M5 21V4a1 1 0 0 1 1-1h7v18" /><path d="M13 3l6 2v16l-6-2" /><circle cx="10.5" cy="12" r="0.9" fill="currentColor" stroke="none" /></>),
  chevronDown: (<><path d="M6 9l6 6 6-6" /></>),
  chevronUp: (<><path d="M6 15l6-6 6 6" /></>),
  externalLink: (<><path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></>),
  layers: (<><path d="M12 3 3 8l9 5 9-5-9-5Z" /><path d="M3 13l9 5 9-5" /></>),
  map: (<><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" /><path d="M9 4v14M15 6v14" /></>),
  mapPin: (<><path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" /><circle cx="12" cy="9" r="2.4" /></>),
  price: (<><circle cx="12" cy="12" r="9" /><path d="M9 15.5c.5 1 1.5 1.5 3 1.5 2 0 3-1 3-2.3 0-3-6-1.4-6-4.2C9 9 10.3 8 12 8c1.5 0 2.5.5 3 1.5M12 6.5v11" /></>),
  paintbrush: (<><path d="M15 4c2 0 4 2 4 4l-7.5 7.5a2 2 0 0 1-2.8 0L8 14.8a2 2 0 0 1 0-2.8L15 4Z" /><path d="M8 15l-3 3c-1 1-1 3 1 3s3-2 3-2" /></>),
  edit: (<><path d="M4 20l1-4.5L16 4.5a2 2 0 0 1 2.8 0l.7.7a2 2 0 0 1 0 2.8L8.5 19 4 20Z" /><path d="M14 6.5 17.5 10" /></>),
  rotate: (<><path d="M4 12a8 8 0 1 1 2.6 5.9" /><path d="M4 17v-5h5" /></>),
  loader: (<><circle cx="12" cy="12" r="8.5" opacity="0.25" /><path d="M20.5 12a8.5 8.5 0 0 0-8.5-8.5" /></>),
  ticket: (<><path d="M4 9V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 6v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-6Z" /><path d="M14 5.5v13" /></>),
  eyeOff: (<><path d="M2 12s4-7 10-7c1.7 0 3.2.4 4.5 1.1M22 12s-1.6 2.8-4.4 4.9M9.9 9.9a3 3 0 0 0 4.2 4.2" /><path d="M3 3l18 18" /></>),
  more: (<><circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" /></>),

  /* ── Added centralizing TopNav / BottomNav / the wider sweep ─────────── */
  // Podium/leaderboard — generic fallback; TopNav's own active-aware
  // version (with fill highlights) lives in NAV_TOP_CONTENT.
  communityBoard: (<><rect x="2" y="13" width="5" height="8" rx="1" /><rect x="9.5" y="9" width="5" height="12" rx="1" /><rect x="17" y="11" width="5" height="10" rx="1" /><path d="M12 6.5l1 2h2l-1.5 1.2.5 2L12 10.7 10 11.7l.5-2L9 8.5h2l1-2Z" /></>),
  // Zigzag trend line — generic fallback for the same reason as above.
  insights: (<><path d="M3 17l4.5-5.5 4 3.5 4.5-6 4.5 3.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M3 20h18" strokeLinecap="round" opacity="0.4" /></>),
  // Open book — the neutral/static look; TopNav's active-fill version
  // lives in NAV_TOP_CONTENT.
  learn: (<><path d="M12 6.5C10 5 6.5 4.8 3.5 5.5v12.5c3-.7 6.5-.5 8.5 1 2-1.5 5.5-1.7 8.5-1V5.5C17.5 4.8 14 5 12 6.5Z" fill="none" /><path d="M12 6.5V19" opacity="0.6" /></>),
  activity: (<><path d="M3 12h3.5l2.5-6 4 12 2.5-6H21" strokeLinecap="round" strokeLinejoin="round" /></>),
  dashboard: (<><path d="M4 11.5 12 4l8 7.5" /><path d="M6 10.5V20h12v-9.5" /><path d="M9.7 20v-5h4.6v5" /></>),
  // Two-page book with a "?" — TopNav's Guide toggle. Only ever rendered
  // via navTop (see NAV_TOP_CONTENT); this entry exists to satisfy the
  // type — it's the same art at its "closed" resting state.
  guide: (<><path d="M4 4h7a1 1 0 0 1 1 1v14a1 1 0 0 0-1-1H4V4Z" fill="rgba(203,208,213,0.06)" /><path d="M20 4h-7a1 1 0 0 0-1 1v14a1 1 0 0 1 1-1h7V4Z" fill="rgba(203,208,213,0.06)" /><path d="M12 5v14" opacity="0.5" /><text x="15.5" y="15" textAnchor="middle" fontSize="7" fontWeight="bold" fill="currentColor" stroke="none">?</text></>),
  checkmark: (<path d="M20 6 9 17l-5-5" />),
  sparkleAI: (<><path d="M12 2l1.2 5.2L18 9l-4.8 1.8L12 16l-1.2-5.2L6 9l4.8-1.8L12 2Z" strokeWidth={1.8} strokeLinejoin="round" /><path d="M19 14l.7 3L22 18l-2.3 1-.7 3-.7-3L16 18l2.3-1 .7-3Z" strokeWidth={1.6} /></>),
  download: (<><path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 19h14" /></>),
  ruler: (<><rect x="3" y="7" width="18" height="10" rx="1.5" /><path d="M7 7v3M11 7v4M15 7v3M19 7v4" /></>),
  flipVertical: (<><path d="M12 3v6M9 6l3-3 3 3" /><path d="M12 21v-6M9 18l3 3 3-3" /><path d="M3 12h18" /></>),
  unlocked: (<><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></>),
  expand: (<><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></>),
  eraser: (<><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" /><path d="M22 21H7" /><path d="m5 11 9 9" /></>),
  document: (<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></>),
  copy: (<><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>),
  sms: (<><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><line x1="9" y1="10" x2="9" y2="10" strokeWidth={3} /><line x1="12" y1="10" x2="12" y2="10" strokeWidth={3} /><line x1="15" y1="10" x2="15" y2="10" strokeWidth={3} /></>),
  email: (<><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></>),
  flash: (<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />),
  play: (<polygon points="6,4 20,12 6,20" fill="currentColor" stroke="none" />),
  dragHandle: (<><circle cx="7" cy="7" r="1.4" fill="currentColor" stroke="none" /><circle cx="17" cy="7" r="1.4" fill="currentColor" stroke="none" /><circle cx="7" cy="17" r="1.4" fill="currentColor" stroke="none" /><circle cx="17" cy="17" r="1.4" fill="currentColor" stroke="none" /></>),
  gift: (<><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></>),
  arrowLeft: (<><path d="M19 12H5M12 5l-7 7 7 7" /></>),

  /* ── Legacy GlyphName art, unchanged ──────────────────────────────────── */
  bell: (<><path d="M6 16v-5a6 6 0 0 1 12 0v5" /><path d="M4.5 16h15" /><path d="M10.4 19a1.7 1.7 0 0 0 3.2 0" /></>),
  message: (<><path d="M5 5h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H10l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" /><path d="M8.5 9.5h7M8.5 12h4" /></>),
  exhibition: (<><path d="M4 9 12 4l8 5H4z" /><path d="M6.5 9v8M10 9v8M14 9v8M17.5 9v8" /><path d="M4 18.5h16" /></>),
  bug: (<><path d="M9 4.3 8 2.8M15 4.3 16 2.8" /><circle cx="12" cy="6" r="1.5" /><ellipse cx="12" cy="13.5" rx="4.6" ry="6" /><path d="M12 8v11" /><path d="M7.4 10.5 4.3 9M7.4 13.5 4 13.5M7.4 16.5 4.3 18M16.6 10.5 19.7 9M16.6 13.5 20 13.5M16.6 16.5 19.7 18" /></>),
  chart: (<><path d="M4 20h16" /><path d="M7.5 20v-5M12 20V8.5M16.5 20v-8" /></>),
  target: (<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.7" fill="currentColor" stroke="none" /></>),
  trophy: (<><path d="M8 4h8v4a4 4 0 0 1-8 0z" /><path d="M8 6H5.5v1a3 3 0 0 0 3 3M16 6h2.5v1a3 3 0 0 1-3 3" /><path d="M12 12v4" /><path d="M9 20h6M9.8 20l.7-4M14.2 20l-.7-4" /></>),
  tag: (<><path d="M4 4.5h7l9 9-6.5 6.5-9-9z" /><circle cx="8" cy="8.5" r="1.4" /></>),
  heart: (<><path d="M12 20s-7-4.4-7-9.4A3.6 3.6 0 0 1 12 8a3.6 3.6 0 0 1 7 2.6C19 15.6 12 20 12 20z" /></>),
  bag: (<><path d="M6.5 8h11l-1 11.5h-9z" /><path d="M9 8a3 3 0 0 1 6 0" /></>),
  gavel: (<><path d="M13.5 4.5l6 6-3 3-6-6z" /><path d="M10.5 7.5 4.5 13.5" /><path d="M4 20h9" /><path d="M6.5 16l3 3" /></>),
  box: (<><path d="M4 8 12 4l8 4-8 4z" /><path d="M4 8v8l8 4 8-4V8" /><path d="M12 12v8" /></>),
  sofa: (<><path d="M4 14v-2.5A2.5 2.5 0 0 1 6.5 9h11A2.5 2.5 0 0 1 20 11.5V14" /><rect x="3.5" y="13.5" width="17" height="4.5" rx="1.3" /><path d="M6.5 18v1.6M17.5 18v1.6" /></>),
  sparkle: (<><path d="M12 4l1.7 4.6L18 10l-4.3 1.4L12 16l-1.7-4.6L6 10l4.3-1.4z" /></>),
  flame: (<><path d="M12 4c1 3 4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 2-4 .4 1 1 1.6 2 2 0-2-1-4 0-6z" /></>),
  key: (<><circle cx="8" cy="8" r="3.4" /><path d="M10.4 10.4 20 20" /><path d="M16 16l2-2M18.5 18.5l1.5-1.5" /></>),
  cart: (<><path d="M4 5h2l2 10h9l2-7H7" /><circle cx="9" cy="19" r="1.3" /><circle cx="17" cy="19" r="1.3" /></>),
  shield: (<><path d="M12 3 5 6v5c0 4.4 3 7.4 7 8.9 4-1.5 7-4.5 7-8.9V6z" /><path d="M9.2 12l1.9 1.9 3.7-3.8" /></>),
  cards: (<><rect x="5" y="7" width="9" height="12.5" rx="1.6" /><path d="M8.6 7 15 5l3 11" /><path d="M7.5 11h4M7.5 14h2.5" /></>),
  music: (<><path d="M9 17V6l10-2v9" /><circle cx="6.5" cy="17" r="2.5" /><circle cx="16.5" cy="15" r="2.5" /></>),
  gem: (<><path d="M6 4h12l4 5-10 11L2 9z" /><path d="M2 9h20" /><path d="M9 4 12 20 15 4" /></>),
  game: (<><rect x="3" y="8.5" width="18" height="8" rx="4" /><path d="M7 11.5v3M5.5 13h3" /><circle cx="15.5" cy="12" r="0.9" fill="currentColor" stroke="none" /><circle cx="18" cy="14" r="0.9" fill="currentColor" stroke="none" /></>),
  leaf: (<><path d="M5 19C5 11 10 6 19 5c1 9-4 15-14 14z" /><path d="M6 18c3-4 6-7 9-8" /></>),
  star: (<><path d="M12 4l2.3 5.2 5.7.5-4.3 3.8 1.3 5.5L12 16.9 7 19l1.3-5.5L4 9.7l5.7-.5z" /></>),
  car: (<><path d="M4 15l1.6-5h12.8L20 15" /><path d="M3.5 15h17v3h-2.5v-1.2H6V18H3.5z" /><circle cx="8" cy="16.5" r="1.4" /><circle cx="16" cy="16.5" r="1.4" /></>),
  palette: (<><path d="M12 4a8 8 0 1 0 0 16c.9 0 1.4-.7 1.4-1.6 0-1.4 1-1.9 2.3-1.9A4 4 0 0 0 20 12a8 8 0 0 0-8-8z" /><circle cx="8.5" cy="10.5" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="8.5" r="1" fill="currentColor" stroke="none" /><circle cx="15.5" cy="10.5" r="1" fill="currentColor" stroke="none" /></>),
  burst: (<><path d="M12 3l1.7 3.3 3.5-1.1-.8 3.6 3.6.6-2.5 2.8 2.5 2.8-3.6.6.8 3.6-3.5-1.1L12 21l-1.7-3.3-3.5 1.1.8-3.6-3.6-.6 2.5-2.8-2.5-2.8 3.6-.6-.8-3.6 3.5 1.1z" /></>),
  users: (<><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3 3 0 0 1 0 5.6M15.5 13.2a5.5 5.5 0 0 1 5 5.8" /></>),
  check: (<><circle cx="12" cy="12" r="8.5" /><path d="M8 12l2.6 2.6L16 9.2" /></>),
  clock: (<><circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3 2" /></>),
  eye: (<><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="2.6" /></>),
  building: (<><path d="M5 20V7l7-3 7 3v13" /><path d="M3 20h18" /><path d="M9 10h1M14 10h1M9 13.5h1M14 13.5h1" /><path d="M10.5 20v-3.5h3V20" /></>),
  warning: (<><path d="M12 3.5 21 19H3z" /><path d="M12 9.5v4.5M12 16.8h.01" /></>),
  lock: (<><rect x="4.5" y="11" width="15" height="9.5" rx="1.8" /><path d="M7.5 11V7.5a4.5 4.5 0 0 1 9 0V11" /></>),
  megaphone: (<><path d="M3 10v4a1 1 0 0 0 1 1h2l9 4.5V4.5L6 9H4a1 1 0 0 0-1 1z" /><path d="M17 9.5a3.5 3.5 0 0 1 0 5" /></>),
  moon: (<><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" /></>),
  sun: (<><circle cx="12" cy="12" r="4.2" /><path d="M12 3v2.2M12 18.8V21M4.2 12H3M21 12h-1.2M5.9 5.9l1.5 1.5M16.6 16.6l1.5 1.5M5.9 18.1l1.5-1.5M16.6 7.4l1.5-1.5" /></>),
  frame: (<><rect x="4" y="4" width="16" height="16" rx="1.5" /><path d="m7.5 15.5 3-3.5 2.5 2.5 3.5-4.5 2.5 3.5" /></>),
  rocket: (<><path d="M12 2.5c2.6 2.1 4.2 5.8 4.2 9.8 0 2.1-.5 4.1-1.2 5.7l-3 3-3-3c-.7-1.6-1.2-3.6-1.2-5.7 0-4 1.6-7.7 4.2-9.8z" /><circle cx="12" cy="10.5" r="1.6" /><path d="M9 15.5l-3.2 1 1-3.2M15 15.5l3.2 1-1-3.2" /></>),
  globe: (<><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.2 2.2 3.4 5.4 3.4 8.5s-1.2 6.3-3.4 8.5c-2.2-2.2-3.4-5.4-3.4-8.5S9.8 5.7 12 3.5z" /></>),
  book: (<><path d="M4 5.5c2.2-1 4.8-1 7.5 0v13c-2.7-1-5.3-1-7.5 0z" /><path d="M19.5 5.5c-2.2-1-4.8-1-7.5 0v13c2.7-1 5.3-1 7.5 0z" /></>),
  wrench: (<><path d="M14.5 3.5a4.5 4.5 0 0 0-5.6 5.6L4 14l3 3 4.9-4.9a4.5 4.5 0 0 0 5.6-5.6l-2.4 2.4-2-2z" /></>),
  // Viewfinder corner-brackets — the universal "scan" symbol (matches the
  // camera panels' own frame-corner guide styling, not a generic barcode icon).
  scan: (<><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" /><path d="M4 12h16" /></>),
  info: (<><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></>),
  link: (<><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></>),
  selectItems: (<><rect x="2" y="2" width="8" height="8" rx="1.6" /><path d="M4.3 6l1.9 1.9 3-3" /><rect x="14" y="2" width="8" height="8" rx="1.6" /><rect x="2" y="14" width="8" height="8" rx="1.6" /><rect x="14" y="14" width="8" height="8" rx="1.6" /></>),
  card: (<><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18M7 15h4" /></>),
  cloud: (<><path d="M7.3 18.5h10.1a4 4 0 0 0 .6-8 6 6 0 0 0-11.3-1.9A4.9 4.9 0 0 0 7.3 18.5Z" /><path d="M12 12v6M9.5 15.4 12 18l2.5-2.6" /></>),
  dollar: (<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />),
  inbox: (<path d="M4 4h16v16H4zM4 9h16M9 4v5" />),
};

/* ── Nav-surface-specific art ───────────────────────────────────────────
   TopNav and BottomNav each have their own deliberately different picture
   for the same destination (built at different times, different design
   passes) — preserved exactly rather than forced onto one shared image,
   which would silently redesign whichever surface "loses." Both are still
   reached through this ONE component under the SAME semantic name — only
   the variant ("navTop" vs "navBottom") picks which surface's art renders,
   same mechanism as "compact" vs "feature". A name with no entry here
   falls through to the generic PATHS picture above. */
type NavIconRenderer = (active: boolean) => ReactNode;

const NAV_TOP_CONTENT: Partial<Record<AppIconName, NavIconRenderer>> = {
  vault: (active) => (<>
    <rect x="3" y="5" width="18" height="14" rx="2" strokeWidth={1.75} fill={active ? "rgba(203,208,213,0.10)" : "none"} />
    <circle cx="12" cy="12" r="3" strokeWidth={1.75} />
    <path d="M12 9v-2M12 17v-2M15 12h2M7 12h2" strokeWidth={1.5} strokeLinecap="round" />
  </>),
  exhibitions: (active) => (<>
    <path d="M3 21h18" strokeWidth={1.75} strokeLinecap="round" />
    <path d="M5 21V11M19 21V11" strokeWidth={1.75} strokeLinecap="round" />
    <path d="M2 11h20" strokeWidth={1.75} strokeLinecap="round" />
    <path d="M12 4 2 11h20L12 4Z" strokeWidth={1.75} strokeLinejoin="round" fill={active ? "rgba(203,208,213,0.12)" : "none"} />
    <path d="M9 21v-5h6v5" strokeWidth={1.75} strokeLinecap="round" />
  </>),
  discover: (active) => (<>
    <circle cx="11" cy="11" r="7.5" strokeWidth={1.75} fill={active ? "rgba(203,208,213,0.10)" : "none"} />
    <path d="M16.5 16.5 21 21" strokeWidth={1.75} strokeLinecap="round" />
    <circle cx="11" cy="11" r="2.5" strokeWidth={1.4} />
  </>),
  communityBoard: (active) => (<>
    <rect x="2" y="13" width="5" height="8" rx="1" strokeWidth={1.75} fill={active ? "rgba(203,208,213,0.16)" : "none"} />
    <rect x="9.5" y="9" width="5" height="12" rx="1" strokeWidth={1.75} fill={active ? "rgba(203,208,213,0.24)" : "none"} />
    <rect x="17" y="11" width="5" height="10" rx="1" strokeWidth={1.75} fill={active ? "rgba(203,208,213,0.16)" : "none"} />
    <path d="M12 6.5l1 2h2l-1.5 1.2.5 2L12 10.7 10 11.7l.5-2L9 8.5h2l1-2Z" strokeWidth={1.3} strokeLinejoin="round" fill={active ? "rgba(203,208,213,0.30)" : "none"} />
  </>),
  insights: () => (<>
    <path d="M3 17l4.5-5.5 4 3.5 4.5-6 4.5 3.5" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 20h18" strokeWidth={1.5} strokeLinecap="round" opacity={0.4} />
  </>),
  events: (active) => (<>
    <rect x="3" y="5" width="18" height="16" rx="2" strokeWidth={1.75} fill={active ? "rgba(203,208,213,0.10)" : "none"} />
    <path d="M3 10h18" strokeWidth={1.5} strokeLinecap="round" opacity={0.5} />
    <path d="M8 3v4M16 3v4" strokeWidth={1.75} strokeLinecap="round" />
    <circle cx="8" cy="15" r="1.2" fill="currentColor" stroke="none" opacity={active ? 1 : 0.6} />
    <circle cx="12" cy="15" r="1.2" fill="currentColor" stroke="none" opacity={active ? 1 : 0.6} />
    <circle cx="16" cy="15" r="1.2" fill="currentColor" stroke="none" opacity={active ? 0.5 : 0.3} />
  </>),
  learn: (active) => (<>
    <path d="M12 6.5C10 5 6.5 4.8 3.5 5.5v12.5c3-.7 6.5-.5 8.5 1 2-1.5 5.5-1.7 8.5-1V5.5C17.5 4.8 14 5 12 6.5Z" strokeWidth={1.75} strokeLinejoin="round" fill={active ? "rgba(203,208,213,0.12)" : "none"} />
    <path d="M12 6.5V19" strokeWidth={1.5} strokeLinecap="round" opacity={0.6} />
  </>),
  message: () => (<path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H8l-4 3V6a1 1 0 0 1 1-1z" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />),
  search: () => (<>
    <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" strokeWidth={2} />
    <path d="M16.4 16.4 21 21" strokeWidth={2} strokeLinecap="round" />
  </>),
  notifications: () => (<>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
  </>),
  guide: (active) => (<>
    <path d="M4 4h7a1 1 0 0 1 1 1v14a1 1 0 0 0-1-1H4V4Z" strokeWidth={1.75} strokeLinejoin="round" fill={active ? "rgba(203,208,213,0.16)" : "rgba(203,208,213,0.06)"} />
    <path d="M20 4h-7a1 1 0 0 0-1 1v14a1 1 0 0 1 1-1h7V4Z" strokeWidth={1.75} strokeLinejoin="round" fill={active ? "rgba(203,208,213,0.16)" : "rgba(203,208,213,0.06)"} />
    <path d="M12 5v14" strokeWidth={1.5} strokeLinecap="round" opacity={0.5} />
    <text x="15.5" y="15" textAnchor="middle" fontSize={7} fontWeight="bold" fill="currentColor" stroke="none">?</text>
  </>),
  // TopNav's "more" dots are a hair smaller (r=1.5) than the shared compact
  // "more" glyph (r=1.6) — kept exact rather than forced to match.
  more: () => (<>
    <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
  </>),
};

const NAV_BOTTOM_CONTENT: Partial<Record<AppIconName, NavIconRenderer>> = {
  exhibitions: (active) => {
    const sw = active ? 2.2 : 1.75;
    return (<>
      <circle cx="6" cy="6.2" r="1.5" strokeWidth={sw * 0.8} />
      <circle cx="18" cy="6.2" r="1.5" strokeWidth={sw * 0.8} />
      <line x1="6" y1="7.9" x2="6" y2="19" strokeWidth={sw} strokeLinecap="round" />
      <line x1="18" y1="7.9" x2="18" y2="19" strokeWidth={sw} strokeLinecap="round" />
      <line x1="3.4" y1="19" x2="8.6" y2="19" strokeWidth={sw} strokeLinecap="round" />
      <line x1="15.4" y1="19" x2="20.6" y2="19" strokeWidth={sw} strokeLinecap="round" />
      <path d="M6.9 8.6 Q12 13.6 17.1 8.6" strokeWidth={sw * 0.85} strokeLinecap="round" fill="none" />
    </>);
  },
  vault: (active) => {
    const sw = active ? 2.2 : 1.75;
    return (<>
      <rect x="3" y="3" width="18" height="18" rx="3" strokeWidth={sw} />
      <line x1="12" y1="6.2" x2="12" y2="17.8" strokeWidth={sw * 0.8} strokeLinecap="round" />
      <line x1="6.2" y1="12" x2="17.8" y2="12" strokeWidth={sw * 0.8} strokeLinecap="round" />
      <line x1="7.9" y1="7.9" x2="16.1" y2="16.1" strokeWidth={sw * 0.8} strokeLinecap="round" />
      <line x1="16.1" y1="7.9" x2="7.9" y2="16.1" strokeWidth={sw * 0.8} strokeLinecap="round" />
      <circle cx="12" cy="12" r="4.2" strokeWidth={sw * 0.9} fill="rgba(10,10,10,0.001)" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </>);
  },
  discover: (active) => (<>
    <circle cx="12" cy="12" r="9" strokeWidth={active ? 2.2 : 1.75} />
    <polygon points="12,5.5 14,11.5 12,10.5 10,11.5" fill="currentColor" stroke="none" />
    <polygon points="12,18.5 14,12.5 12,13.5 10,12.5" fill="currentColor" stroke="none" opacity={0.4} />
  </>),
  more: () => (<>
    <circle cx="5" cy="12" r="1.9" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.9" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.9" fill="currentColor" stroke="none" />
  </>),
};

// Map a common emoji to the closest themed icon (for legacy emoji lookups).
export function emojiGlyphName(emoji: string): AppIconName {
  const map: Record<string, AppIconName> = {
    "👥": "users", "📊": "chart", "📈": "chart", "✅": "check", "🎯": "target",
    "🏷️": "tag", "🏷": "tag", "🔍": "search", "📤": "share", "🕐": "clock",
    "🗝️": "key", "🗝": "key", "🛒": "cart", "🃏": "cards", "🏆": "trophy",
    "🎵": "music", "💎": "gem", "🎮": "game", "🎭": "burst", "🎨": "palette",
    "🌿": "leaf", "🚗": "car", "🔨": "gavel", "🔔": "bell", "🐛": "bug",
    "⚠": "warning", "⚠️": "warning", "🔒": "lock", "🔐": "lock", "📣": "megaphone",
    "📷": "camera", "📸": "camera", "🎬": "camera", "🌙": "moon", "☀️": "sun",
    "🖼": "frame", "🖼️": "frame", "⭐": "star", "🔥": "flame", "👁": "eye",
    "👁️": "eye", "⏱": "clock", "⏱️": "clock", "⏰": "clock", "📲": "share",
  };
  return map[emoji] ?? "star";
}

// Map a universe/category key to a themed icon (replaces the old emoji map).
export function universeGlyphName(universe: string): AppIconName {
  const u = (universe || "").toUpperCase();
  if (u.includes("POP") || u.includes("COMIC")) return "burst";
  if (u.includes("SPORT")) return "trophy";
  if (u === "TCG" || u.includes("CARD")) return "cards";
  if (u.includes("MUSIC") || u.includes("VINYL")) return "music";
  if (u.includes("JEWEL") || u.includes("APPAREL")) return "gem";
  if (u.includes("GAME")) return "game";
  if (u.includes("BOTANY") || u.includes("BUILT")) return "leaf";
  if (u.includes("AUTO")) return "car";
  if (u.includes("ART")) return "palette";
  return "star";
}

// Runtime location of the Friendly Glass 3D icon pack — one 256x256 RGBA
// PNG per AppIconName, filename matching the name exactly. See
// design-assets/icon-themes/friendly-glass-v1/CODER-HANDOFF.md.
const FRIENDLY_GLASS_BASE = "/ui/icon-themes/friendly-glass-v1";

// The pack's own manifest/README call out 40px+ as the strongest
// presentation size, but the real app renders most icons well below that
// (TopNav at 20px, BottomNav at 22px, most inline buttons/badges 9-16px).
// Verified with a public/_icon-size-test harness comparing native-size
// rendering against a pixel-accurate 4x magnification of the same
// downscaled bitmap at every size from 8-32px: the detailed/photographic
// art holds up as a recognizable silhouette down to ~18px (TopNav and
// BottomNav both clear this), but below that the app's many small
// functional badges/checkmarks/toggles (9-16px) shrink past the point a
// real eye can resolve raster detail — vector line art tolerates this
// because it's drawn simply enough to read at that size; this pack isn't.
// Below this size, an AppIcon instance renders Classic only, regardless
// of the active global icon style — the Friendly Glass <img> layer isn't
// rendered at all, so there's nothing for the CSS toggle to reveal.
const FRIENDLY_GLASS_MIN_SIZE = 18;

// Matches FavoriteButton.tsx's existing `text-amber-300` / amber-400 glow
// convention for a favorited star, so the new Friendly Glass "selected"
// treatment reads as the same visual language, not a competing one.
const FRIENDLY_SELECTED_COLOR = "#FBBF24";

// The Friendly Glass pack has one asset per name — no separate "filled"
// art — so a selected/saved/favorited state (the `filled` prop) is shown
// as a gold ring around the tile plus a small checkmark badge, applied
// only while Friendly Glass is the active style (gated by the same
// `.vltd-icon-friendly-badge` + [data-vltd-icon-style] CSS pattern as the
// classic/friendly layer toggle itself, in globals.css).
function FriendlySelectedBadge({ size }: { size: number }) {
  const badgeSize = Math.max(9, Math.round(size * 0.44));
  return (
    <span
      className="vltd-icon-friendly-badge"
      aria-hidden="true"
      style={{
        position: "absolute",
        right: -2,
        bottom: -2,
        width: badgeSize,
        height: badgeSize,
        borderRadius: "50%",
        background: FRIENDLY_SELECTED_COLOR,
        border: "1.5px solid #1A0F00",
        boxShadow: `0 0 4px rgba(251,191,36,0.7)`,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg viewBox="0 0 24 24" width="65%" height="65%" fill="none" stroke="#1A0F00" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  );
}

export function AppIcon({
  name,
  variant = "compact",
  size = 24,
  className,
  style,
  strokeWidth = 1.6,
  filled = false,
  active = false,
}: {
  name: AppIconName;
  variant?: IconVariant;
  size?: number;
  className?: string;
  style?: CSSProperties;
  strokeWidth?: number;
  /** Toggle-state fill (e.g. a saved bookmark or a liked heart). Classic:
   * fills the shape with currentColor instead of just outlining it.
   * Friendly Glass: the pack is one fixed asset per name with no separate
   * filled art, so `filled` instead adds a small gold ring + checkmark
   * badge on the icon tile — the same treatment everywhere this prop is
   * used, so a favorited star and a saved bookmark read identically. */
  filled?: boolean;
  /** Nav active/inactive state — only meaningful with variant="navTop" or
   * "navBottom" (selects that surface's highlighted vs. dim rendering for
   * Classic, and dims the Friendly Glass layer when inactive since that
   * pack has one asset per name rather than separate active art). */
  active?: boolean;
}) {
  const friendlySrc = `${FRIENDLY_GLASS_BASE}/${name}.png`;
  const showFriendly = size >= FRIENDLY_GLASS_MIN_SIZE;

  if (variant === "navTop" || variant === "navBottom") {
    const renderer = (variant === "navTop" ? NAV_TOP_CONTENT : NAV_BOTTOM_CONTENT)[name];
    return (
      <span
        className={className}
        style={{ display: "inline-block", position: "relative", width: size, height: size, lineHeight: 0, ...style }}
      >
        <svg
          className={showFriendly ? "vltd-icon-classic" : undefined}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ position: "absolute", inset: 0 }}
        >
          {renderer ? renderer(active) : PATHS[name]}
        </svg>
        {showFriendly && (
          <img
            className="vltd-icon-friendly"
            src={friendlySrc}
            alt=""
            aria-hidden="true"
            width={size}
            height={size}
            loading="lazy"
            decoding="async"
            style={{ position: "absolute", inset: 0, width: size, height: size, objectFit: "contain", opacity: active ? 1 : 0.5 }}
          />
        )}
      </span>
    );
  }

  // "feature": large buttons, cards, onboarding, empty states. Classic
  // keeps its soft rounded-backing placeholder look; Friendly Glass swaps
  // in the real 3D asset (designed for 40px+) filling the same box so
  // switching styles never moves surrounding layout.
  if (variant === "feature") {
    const pad = Math.round(size * 0.62);
    const box = size + pad;
    return (
      <span
        className={className}
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: box, height: box, position: "relative", ...style }}
      >
        <span
          className={showFriendly ? "vltd-icon-classic" : undefined}
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "28%",
            background: "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.16), rgba(255,255,255,0.03) 60%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -6px 12px rgba(0,0,0,0.25)",
          }}
        >
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill={filled ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {PATHS[name]}
          </svg>
        </span>
        {showFriendly && (
          <img
            className="vltd-icon-friendly"
            src={friendlySrc}
            alt=""
            aria-hidden="true"
            width={box}
            height={box}
            loading="lazy"
            decoding="async"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              borderRadius: filled ? "28%" : undefined,
              boxShadow: filled ? `0 0 0 2px ${FRIENDLY_SELECTED_COLOR}, 0 0 10px rgba(251,191,36,0.55)` : undefined,
            }}
          />
        )}
        {showFriendly && filled && <FriendlySelectedBadge size={box} />}
      </span>
    );
  }

  // "compact" (default).
  return (
    <span
      className={className}
      style={{ display: "inline-block", position: "relative", width: size, height: size, lineHeight: 0, ...style }}
    >
      <svg
        className={showFriendly ? "vltd-icon-classic" : undefined}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ position: "absolute", inset: 0 }}
      >
        {PATHS[name]}
      </svg>
      {showFriendly && (
        <img
          className="vltd-icon-friendly"
          src={friendlySrc}
          alt=""
          aria-hidden="true"
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          style={{
            position: "absolute",
            inset: 0,
            width: size,
            height: size,
            objectFit: "contain",
            borderRadius: filled ? "28%" : undefined,
            boxShadow: filled ? `0 0 0 2px ${FRIENDLY_SELECTED_COLOR}, 0 0 8px rgba(251,191,36,0.55)` : undefined,
          }}
        />
      )}
      {showFriendly && filled && <FriendlySelectedBadge size={size} />}
    </span>
  );
}
