// Shared, style-agnostic slot geometry for the Gallery Builder's single 3D
// room (`/museum/virtual-room`, `VirtualGalleryRoom.tsx`). Extracted 2026-09-11
// so the Map view (`MuseumCampusOverview.tsx`) can compute a real room's real
// occupied/capacity from the exact same slot table the 3D room itself builds
// and saves — not a guess, not an item count by universe. See
// docs/GALLERY-MAP-ROOM-EDITING-OVERNIGHT-PASS-2026-09-11.md, work order §3:
// "Both values come from the same actual room-slot data used by the 3D room
// and saved order... Do not infer capacity from the number of vault items
// assigned to a universe."
//
// This module is intentionally a leaf: it imports nothing from
// VirtualGalleryRoom.tsx or MuseumCampusOverview.tsx, so both of those can
// import from here with no circular-import risk. Every constant/comment below
// is carried over verbatim from VirtualGalleryRoom.tsx's own history — see
// that file's git blame for the full reasoning behind each number if it ever
// needs to change again.

export type RoomLayout = "storefront" | "salon" | "spotlight";

export type RoomItemPosition = {
  x: number;
  y: number;
  z: number;
  ry: number;
  scale: number;
  wall: "back" | "left" | "right" | "front" | "center" | "cabinet";
  /** Lying flat in a display case (rotated onto the horizontal plane) instead of wall-mounted upright. */
  flat?: boolean;
};

// EK: "finish and renumber the wall spaces, there are many not filled" —
// real gap, confirmed against the room generator script
// (scripts/generate-gallery-room-models.py): the shelf boards are single
// continuous planks with no baked physical dividers, so "8 columns x 3
// rows = 24" for the back wall is a placement CONVENTION already coded
// in wallGridPosition, not a hard limit — but the OLD MAX_ROOM_ITEMS=32
// budget (minus 8 for the vault style's front/door wall) only left 24
// "main wall" slots total for back+left+right COMBINED, so the 2:1:1
// WALL_CYCLE ratio gave back only 12 of its own real 24 positions, and
// left/right only 6 each (2 of their own real depth-steps) — the other
// 12 back-wall positions and the deeper side-wall rows never got a
// slot index at all, which is exactly the badge-less gaps EK circled.
// Raised to fit BACK_WALL_CAPACITY (24) + SIDE_WALL_CAPACITY for both
// sides, plus the vault style's existing 8-slot front/door wall.
export const BACK_WALL_CAPACITY = 24;
// EK's ask (2026-08-23, 4th time raised) — side-wall items sat much
// farther apart than back-wall items AND stopped well short of the far
// corner, wasting real shelf length. Root cause: the 12-slot side-wall
// capacity (4 depth-steps x 3 rows) was never sized against the wall's
// own real length — the old "4 depth-steps" comment only checked that
// its deepest point (z=-0.25) stayed clear of an unrelated feature
// (the vault style's own front/door-wall row at z=5.54), not how much
// of the actual side shelf that left unused. Read the real numbers from
// the room generator instead of guessing again:
//   left_shelf_i / right_shelf_i: depth 23.2, centered z=-3.15
//     -> real board spans z in [-14.75, 8.45]
//     (scripts/generate-gallery-room-models.py add_wall_panels(); the
//     procedural whitebox/arcade shelves in VirtualGalleryRoom.tsx's own
//     addSideRowBoard use the identical -14.75..8.45 span, so this
//     applies to every room style, not just the baked vault GLB)
//   back_corner_post_x: (1.3, 9.15, 1.3) centered z=-11.87
//     -> forward face at z=-11.22; the back wall's own face sits at
//     z~=-12.17..-11.99, so nothing should be centered any closer to
//     the back corner than that post's forward face
//   front_wall_left/right (the door wall): depth 0.18, centered z=5.8
//     -> near face at z=5.71
// An item's own footprint along the wall (frame width 1.12*scale plus
// matting on both sides, at MIN_ITEM_SCALE=0.78) is ~0.975 wide, so a
// safe CENTER position needs ~0.49 clearance from either limit:
// SIDE_WALL_SAFE_BACK_Z (-10.5) sits comfortably past the corner post's
// -11.22 forward face; SIDE_WALL_SAFE_FRONT_Z (4.9) sits comfortably
// short of the door wall's 5.71 near face. Real safe usable run: 15.4.
// Back wall gets the same treatment: real back_shelf_i is 19.9 wide
// (half-width 9.95), but the back_corner_post_x pieces (half-width 0.65,
// centered x=+-10.36) put their inner face at x=+-9.71 — BACK_WALL_HALF_WIDTH
// (9.0) leaves the same ~0.49-unit item-footprint clearance from that,
// same math as the side walls above.
//
// With both walls' safe usable lengths now real numbers, side-wall
// capacity is raised from 12 to 21 (7 depth-steps x 3 rows, still
// SHELF_ROW_Y.length rows) so its density can actually MATCH the back
// wall's instead of being forced sparser by too few slots for the same
// real length — see BACK_WALL_COL_STEP / SIDE_WALL_STEP below, both
// independently computed from these same safe bounds and landing within
// 0.01 units of each other, not hand-tuned to match.
// Single source of truth for the front/door wall's depth, every style.
// This group of constants MUST mirror generate-gallery-room-models.py's
// own FRONT_WALL_PUSH_BACK exactly — that Python script bakes the real
// wall/door/panel geometry, and any JS code (like frontWallPosition
// below) that places something ON that wall has to track wherever it
// currently sits. EK's ask (2026-08-29), after the wall moved twice and
// the item hangers were forgotten both times, floating in open air:
// give this its own clearly-named constant instead of a bare literal
// z value, so the NEXT push-back is a one-line change here, not a
// silent, easy-to-forget drift between two files. EK's ask (2026-08-30):
// "it doesn't look like you pushed the wall back on the other ones" —
// this only ever applied to vault. 5.62 is also whitebox/arcade's own
// door assembly base z (add_standard_door's door_left/right/header), so
// the same formula applies to every style now, not just vault's.
export const FRONT_WALL_PUSH_BACK = 1.5; // mirrors generate-gallery-room-models.py's constant of the same name — keep both in sync
export const FRONT_WALL_PANEL_SEAM_BASE_Z = 5.62; // the panel/door assembly's own baked z BEFORE any push-back, shared by every style
export const FRONT_WALL_ITEM_MOUNT_OFFSET = 0.08; // how far in front of the panel seam an item hangs, so its frame doesn't clip through
export const FRONT_WALL_ITEM_Z = FRONT_WALL_PANEL_SEAM_BASE_Z + FRONT_WALL_PUSH_BACK - FRONT_WALL_ITEM_MOUNT_OFFSET;

export const BACK_WALL_HALF_WIDTH = 9.0;
export const BACK_WALL_COL_STEP = (BACK_WALL_HALF_WIDTH * 2) / 7; // 8 columns, 7 gaps
export const SIDE_WALL_SAFE_BACK_Z = -10.5;
export const SIDE_WALL_SAFE_FRONT_Z = 4.9;
export const SIDE_WALL_DEPTH_COUNT = 7;
export const SIDE_WALL_STEP =
  (SIDE_WALL_SAFE_FRONT_Z - SIDE_WALL_SAFE_BACK_Z) / (SIDE_WALL_DEPTH_COUNT - 1); // full safe range, 6 gaps
export const SIDE_WALL_CAPACITY = SIDE_WALL_DEPTH_COUNT * 3; // 3 = SHELF_ROW_Y.length, fixed below
export const MAX_ROOM_ITEMS = BACK_WALL_CAPACITY + SIDE_WALL_CAPACITY * 2 + 8;

// The 5 center display cases (built in VirtualGalleryRoom.tsx as decorative
// glass cabinets) are also real, numbered, assignable slots — appended after
// the wall slots.
export const CABINET_SPOTS: Array<[number, number]> = [
  [-3.4, -3.5],
  [0, -4.55],
  [3.4, -3.5],
  [-2.1, 0.45],
  [2.1, 0.45],
];
export const CABINET_SLOT_COUNT = CABINET_SPOTS.length;
// +7 for vault+Hero's extra real slots appended past the end of the table
// (see heroSupportingOverflowSlot and heroCornerFillSlots below): 1 slot
// Hero's row reservation left unused within the shared main-wall budget,
// plus 3 new slots per side wall (6) on real, already-baked shelf/wall
// space past the grid's old last depth that the code never used. Growing
// the main-wall request itself to reach these shifts every front-wall/
// cabinet index after it (confirmed live: it moved a real front-wall
// item — EK: "you just moved one over"). Appending them past the end of
// the WHOLE table instead needs their own selectedIds slots to be real,
// not decorative — hence +7 here, harmless for every other layout/style
// (their own table stays exactly MAX_ROOM_ITEMS + CABINET_SLOT_COUNT
// long; these last slots simply never render for them, same as Hero's
// own dedicated slots already don't).
export const TOTAL_SLOT_COUNT = MAX_ROOM_ITEMS + CABINET_SLOT_COUNT + 7;

// `selectedIds` is always exactly TOTAL_SLOT_COUNT long, one entry per physical
// slot (wall shelf or display case) — "" means that slot is empty. This is what
// makes an item's position independently assignable (drag it onto any slot,
// occupied or not) instead of just reorderable relative to its neighbors.
export function makeEmptySlots(): string[] {
  return Array.from({ length: TOTAL_SLOT_COUNT }, () => "");
}

export function fillSlots(ids: string[]): string[] {
  const slots = makeEmptySlots();
  ids.slice(0, TOTAL_SLOT_COUNT).forEach((id, index) => {
    slots[index] = id;
  });
  return slots;
}

export function parseRoomLayout(value: string | null | undefined): RoomLayout {
  return value === "salon" || value === "spotlight" ? value : "storefront";
}

// Back wall gets 2 of every 4 items, left/right get 1 each — the back wall stays the
// visual anchor, but both side walls start filling from item #1 instead of only once
// the back wall's own full grid is already used up (which left a small collection's
// side walls bare while the back wall did all the work).
const WALL_CYCLE: Array<"back" | "left" | "right"> = ["back", "left", "back", "right"];

// The physical shelf boards (built in VirtualGalleryRoom.tsx, same 4 heights)
// and every item's vertical position both read from this one table — they
// used to be two separately hand-tuned numbers (4.72 for the boards, 5.42/
// 4.75 for items) that drifted out of sync, so items floated well above
// their shelf instead of resting on it.
//
// EK's ask (2026-08-21), corrected TWICE same day:
// 1st pass shifted all 4 rows down to sit near a "fixed" eyeHeight of 1.7
// — wrong on two counts: the eyeHeight change itself was based on a bad
// unit assumption and got reverted (see eyeHeight's own comment), and
// shifting the whole band down put a row right near the floor, which EK
// had explicitly said not to do ("I don't want a row on the floor like
// [bingebrowse.net] do[es]").
// 2nd pass cut to 3 rows and re-centered around the (still-wrong) 1.7 —
// same mistake, different shape.
// Corrected: back to the ORIGINAL 4-row heights — [4.72, 3.47, 2.22,
// 0.97] — with the genuinely-too-low bottom row (0.97) simply dropped,
// not the whole band reshuffled. The top 3 rows were never the problem;
// only the bottom one was. With eyeHeight reverted to 3.6, these 3 rows
// land close to evenly split around eye level (top row ~1.8 above eye,
// bottom row ~0.7 below) — no new number invented, just the one bad row
// removed.
//
// EK's ask (2026-08-21), a 4th correction: the 1.25 spacing above was
// exactly the item card's own height at MIN_ITEM_SCALE=0.78 (1.2 units)
// plus the board's half-thickness (0.05) — zero headroom, so an item's
// own top edge sat flush against the shelf board mounted above it,
// visibly clipping into it. EK: "do not change the size of the items"
// — so the fix is spacing, not scale. Top row (4.72) is untouched — it
// only needs clearance to the wall rail well above it. Middle and bottom
// rows moved down to open a real ~0.25-unit gap above every item:
// 1.5 spacing instead of 1.25 (3.47 -> 3.22, 2.22 -> 1.72).
//
// ⚠ These values are duplicated in scripts/generate-gallery-room-models.py
// (`shelf_y`, in add_wall_panels()) for the baked GLB's own shelf-board
// mesh positions — vault/whitebox/arcade need that regenerated to match, or
// items float off the physical shelf again (same bug as the display-case
// fix earlier this session). Kept in sync as part of this change — see
// HANDOFF for the exact regen command if it needs re-running.
export const SHELF_ROW_Y = [4.72, 3.22, 1.72];

export function shelfItemY(row: number, scale: number) {
  const shelfY = SHELF_ROW_Y[row] ?? SHELF_ROW_Y[SHELF_ROW_Y.length - 1];
  // Real, measured shelf-board half-thickness (0.12 units thick baked mesh).
  const shelfHalfThickness = 0.06;
  // EK's ask (2026-08-30): sitting exactly flush with zero gap still read
  // as "cut off" against the shelf — a real physical item resting on a
  // shelf ledge shows a sliver of visible clearance, not perfect contact.
  const restClearance = 0.03;
  const cardHalfHeight = (1.54 * scale) / 2;
  // EK's ask (2026-08-30): every item gets the same 0.065*scale matting on
  // all 4 sides, which lifts it by that same amount to keep the newly-
  // symmetric bottom border from sinking back into the shelf.
  const matchingFrameBottomMatting = 0.065 * scale;
  return shelfY + shelfHalfThickness + restClearance + cardHalfHeight + matchingFrameBottomMatting;
}

function wallGridPosition(
  wall: "back" | "left" | "right",
  slot: number,
  config: { backZ: number; backScale: number; sideBaseZ: number; sideZStep: number; sideScale: number }
): RoomItemPosition {
  if (wall === "back") {
    const col = slot % 8;
    const row = Math.floor(slot / 8) % SHELF_ROW_Y.length;
    return {
      x: -BACK_WALL_HALF_WIDTH + col * BACK_WALL_COL_STEP,
      y: shelfItemY(row, config.backScale),
      z: config.backZ,
      ry: 0,
      scale: config.backScale,
      wall: "back",
    };
  }

  const row = slot % SHELF_ROW_Y.length;
  const depth = Math.floor(slot / SHELF_ROW_Y.length);
  return {
    x: wall === "left" ? -10.22 : 10.22,
    y: shelfItemY(row, config.sideScale),
    z: config.sideBaseZ + depth * config.sideZStep,
    ry: wall === "left" ? Math.PI / 2 : -Math.PI / 2,
    scale: config.sideScale,
    wall,
  };
}

function distributeAcrossWalls(
  count: number,
  config: { backZ: number; backScale: number; sideBaseZ: number; sideZStep: number; sideScale: number },
  // Hero (spotlight layout) sits at a fixed depth on whichever side wall it
  // occupies — only the ONE regular grid slot landing at that same depth
  // and shelf row can visually overlap Hero's much larger frame. Excluding a
  // whole row to dodge it removed 7 slots per wall instead of 1 — skip only
  // the exact colliding slot.
  excludeSlot: Partial<Record<"back" | "left" | "right", number>> = {}
): RoomItemPosition[] {
  const caps: Record<"back" | "left" | "right", number> = {
    back: BACK_WALL_CAPACITY,
    left: SIDE_WALL_CAPACITY,
    right: SIDE_WALL_CAPACITY,
  };
  const wallSlot: Record<"back" | "left" | "right", number> = { back: 0, left: 0, right: 0 };
  function nextValidSlot(wall: "back" | "left" | "right"): number {
    let slot = wallSlot[wall];
    if (slot < caps[wall] && slot === excludeSlot[wall]) slot++;
    return slot;
  }
  function hasRoom(wall: "back" | "left" | "right"): boolean {
    return nextValidSlot(wall) < caps[wall];
  }
  const positions: RoomItemPosition[] = [];
  let cycleIndex = 0;
  while (positions.length < count) {
    let wall = WALL_CYCLE[cycleIndex % WALL_CYCLE.length];
    let skipped = 0;
    const allAtCap = (["back", "left", "right"] as const).every((w) => !hasRoom(w));
    if (!allAtCap) {
      while (!hasRoom(wall) && skipped < WALL_CYCLE.length) {
        cycleIndex++;
        wall = WALL_CYCLE[cycleIndex % WALL_CYCLE.length];
        skipped++;
      }
    }
    const slot = nextValidSlot(wall);
    wallSlot[wall] = slot + 1;
    positions.push(wallGridPosition(wall, slot, config));
    cycleIndex++;
  }
  return positions;
}

// EK's ask (2026-08-21): checked bingebrowse.net's own source against ours
// and found our items were legible in the *focused* click-in view but not at
// normal walking-past distance. This is the floor: no wall item (Store or
// Salon) renders smaller than this scale, ever. Hero's dedicated feature
// slots are explicitly allowed to exceed it.
export const MIN_ITEM_SCALE = 0.78;

function buildWallPositions(layout: RoomLayout, count: number): RoomItemPosition[] {
  if (layout === "spotlight") {
    const HERO_Y = shelfItemY(1, 1.2); // the middle shelf row's own height, at hero scale
    const allHeroSlots: RoomItemPosition[] = [
      { x: 0, y: HERO_Y, z: -11.78, ry: 0, scale: 1.2, wall: "back" },
      { x: -10.22, y: HERO_Y, z: -3.2, ry: Math.PI / 2, scale: 1.2, wall: "left" },
      { x: 10.22, y: HERO_Y, z: -3.2, ry: -Math.PI / 2, scale: 1.2, wall: "right" },
    ];
    const heroSlots = allHeroSlots.slice(0, count);
    const spotlightClusterSpan = 2.1 * (SIDE_WALL_DEPTH_COUNT - 1);
    const spotlightBaseZ =
      SIDE_WALL_SAFE_BACK_Z + (SIDE_WALL_SAFE_FRONT_Z - SIDE_WALL_SAFE_BACK_Z - spotlightClusterSpan) / 2;
    const heroWalls = new Set(heroSlots.map((slot) => slot.wall));
    const supportingExcludeSlot: Partial<Record<"back" | "left" | "right", number>> = {};
    if (heroWalls.has("left")) supportingExcludeSlot.left = 10;
    if (heroWalls.has("right")) supportingExcludeSlot.right = 10;
    const trueCapacity = (["back", "left", "right"] as const).reduce((sum, w) => {
      const caps = { back: BACK_WALL_CAPACITY, left: SIDE_WALL_CAPACITY, right: SIDE_WALL_CAPACITY };
      return sum + caps[w] - (supportingExcludeSlot[w] !== undefined ? 1 : 0);
    }, 0);
    const remaining = Math.min(Math.max(0, count - heroSlots.length), trueCapacity);
    const supporting = distributeAcrossWalls(
      remaining,
      {
        backZ: -11.78,
        backScale: MIN_ITEM_SCALE,
        sideBaseZ: spotlightBaseZ,
        sideZStep: 2.1,
        sideScale: MIN_ITEM_SCALE,
      },
      supportingExcludeSlot
    );
    return [...heroSlots, ...supporting];
  }

  if (layout === "salon") {
    return distributeAcrossWalls(count, {
      backZ: -11.82,
      backScale: MIN_ITEM_SCALE,
      sideBaseZ: SIDE_WALL_SAFE_BACK_Z,
      sideZStep: 2.0,
      sideScale: MIN_ITEM_SCALE,
    });
  }

  // Store
  return distributeAcrossWalls(count, {
    backZ: -11.78,
    backScale: MIN_ITEM_SCALE,
    sideBaseZ: SIDE_WALL_SAFE_BACK_Z,
    sideZStep: SIDE_WALL_STEP,
    sideScale: MIN_ITEM_SCALE,
  });
}

function frontWallPosition(slot: number): RoomItemPosition {
  const positions = [
    { x: -6.6, y: 4.65 },
    { x: -4.65, y: 4.65 },
    { x: 4.65, y: 4.65 },
    { x: 6.6, y: 4.65 },
    { x: -6.6, y: 2.35 },
    { x: -4.65, y: 2.35 },
    { x: 4.65, y: 2.35 },
    { x: 6.6, y: 2.35 },
  ];
  const pos = positions[slot % positions.length];
  return {
    x: pos.x,
    y: pos.y,
    z: FRONT_WALL_ITEM_Z,
    ry: Math.PI,
    scale: MIN_ITEM_SCALE,
    wall: "front",
  };
}

function heroSupportingOverflowSlot(): RoomItemPosition {
  const spotlightClusterSpan = 2.1 * (SIDE_WALL_DEPTH_COUNT - 1);
  const spotlightBaseZ =
    SIDE_WALL_SAFE_BACK_Z + (SIDE_WALL_SAFE_FRONT_Z - SIDE_WALL_SAFE_BACK_Z - spotlightClusterSpan) / 2;
  const full = distributeAcrossWalls(
    BACK_WALL_CAPACITY + (SIDE_WALL_CAPACITY - 1) * 2,
    { backZ: -11.78, backScale: MIN_ITEM_SCALE, sideBaseZ: spotlightBaseZ, sideZStep: 2.1, sideScale: MIN_ITEM_SCALE },
    { left: 10, right: 10 }
  );
  return full[full.length - 1];
}

function heroCornerFillSlots(): RoomItemPosition[] {
  const extraZ = 3.5 + 2.1; // one more step past the grid's last depth, same 2.1 spacing
  const walls: Array<"left" | "right"> = ["left", "right"];
  return walls.flatMap((wall) =>
    SHELF_ROW_Y.map((_, row) => ({
      x: wall === "left" ? -10.22 : 10.22,
      y: shelfItemY(row, MIN_ITEM_SCALE),
      z: extraZ,
      ry: wall === "left" ? Math.PI / 2 : -Math.PI / 2,
      scale: MIN_ITEM_SCALE,
      wall,
    }))
  );
}

function buildVaultWallPositions(layout: RoomLayout, count: number): RoomItemPosition[] {
  const frontSlotCount = Math.min(8, count);
  const mainWallCount = Math.max(0, count - frontSlotCount);
  return [
    ...buildWallPositions(layout, mainWallCount),
    ...Array.from({ length: frontSlotCount }, (_, index) => frontWallPosition(index)),
  ];
}

// Full fixed-capacity slot table for a layout: MAX_ROOM_ITEMS wall slots plus
// the CABINET_SLOT_COUNT display-case slots, always in this order — slot index
// is a stable identity regardless of layout or how many items are placed.
// Style-agnostic (every style shares this same baked geometry) — this is
// also the single canonical "real capacity" for a room of a given layout,
// reused by the Map view (MuseumCampusOverview.tsx) for occupied/capacity.
export function buildPositions(layout: RoomLayout): RoomItemPosition[] {
  const wallPositions = buildVaultWallPositions(layout, MAX_ROOM_ITEMS);
  const cabinetPositions: RoomItemPosition[] = CABINET_SPOTS.map(([x, z]) => ({
    x,
    y: 0.85,
    z,
    ry: -Math.PI / 2,
    scale: 0.58,
    wall: "cabinet",
    flat: true,
  }));
  const mainWallCountForHero = MAX_ROOM_ITEMS - Math.min(8, MAX_ROOM_ITEMS);
  const heroHasSingleSlotShortfall = mainWallCountForHero - 3 < BACK_WALL_CAPACITY + (SIDE_WALL_CAPACITY - 1) * 2;
  const heroOverflow =
    layout === "spotlight"
      ? [...(heroHasSingleSlotShortfall ? [heroSupportingOverflowSlot()] : []), ...heroCornerFillSlots()]
      : [];
  return [...wallPositions, ...cabinetPositions, ...heroOverflow];
}

/** Real capacity for a saved Hall's own layout — same table the 3D room and
 * this Hall's own `selectedIds` (always fillSlots()'d to TOTAL_SLOT_COUNT)
 * both use. Never invented, never a vault-item count. */
export function roomCapacity(layout: RoomLayout): number {
  return buildPositions(layout).length;
}
