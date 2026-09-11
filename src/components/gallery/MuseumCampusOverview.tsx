"use client";

import { DoorOpen, Map as MapIcon, Sparkles } from "lucide-react";

import { CAMPUS_DOORS, CAMPUS_ROOMS, type CampusRoom, type CampusRoomId } from "@/lib/campusLayout";

// 2026-09-11 Gallery Map / Room-Editing overnight pass
// (docs/GALLERY-MAP-ROOM-EDITING-OVERNIGHT-PASS-2026-09-11.md): this map used
// to group the signed-in user's own vault items by `universe` into synthetic
// "rooms" and show vault-item counts/value for them — that's an item COUNT,
// never a real slot template, so it could never honestly answer "how many of
// this room's real positions are filled." Replaced with real Halls: each
// shape below is either the room currently open in the builder (HUB —
// unchanged, still always enterable) or one of the user's own saved Halls
// (`virtual_rooms` rows), assigned to a shape by `VirtualGalleryRoom.tsx`.
// occupied/capacity here are exactly what's passed in — this component never
// invents a count, it only renders what its caller already computed from
// that Hall's own `selectedIds` and `buildPositions()` (the same slot table
// the 3D room itself uses). A shape with no assigned Hall yet shows a plain,
// truthful "Not set up" state instead of a made-up number.
export type CampusRoomAssignment = {
  hallId: string;
  title: string;
  occupied: number;
  capacity: number;
};

const ROOM_LABELS: Record<CampusRoomId, string> = {
  HUB: "VLTD Museum",
  POP_CULTURE: "Pop Culture",
  TCG: "TCG",
  MISC: "Misc",
  BUILT_BOTANY: "Botany",
  GAMES: "Games",
  AUTOMOTIVE: "Automobile",
  COLLECTION: "Collection",
  SPORTS: "Sports",
  CARDS: "Cards",
  SPOTLIGHT: "Spotlight",
  STORE: "Store",
  PLAZA: "Entrance Plaza",
};

const MAP_BOUNDS = CAMPUS_ROOMS.reduce(
  (bounds, room) => ({
    x0: Math.min(bounds.x0, room.x),
    x1: Math.max(bounds.x1, room.x + room.w),
    z0: Math.min(bounds.z0, room.z),
    z1: Math.max(bounds.z1, room.z + room.d),
  }),
  { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity }
);

// The campus is authored in world X/Z coordinates with the entrance along its
// north edge. The builder's map panel is landscape, so present the same plan a
// quarter-turn clockwise: north/entrance moves to the left and the Grand Hall
// runs across the panel.
const MAP_HORIZONTAL_SCALE = 2;

function mapRect(x: number, z: number, width: number, depth: number) {
  return {
    x: (z - MAP_BOUNDS.z0) * MAP_HORIZONTAL_SCALE,
    y: x - MAP_BOUNDS.x0,
    width: depth * MAP_HORIZONTAL_SCALE,
    height: width,
  };
}

export default function MuseumCampusOverview({
  assignments,
  hubOccupied,
  hubCapacity,
  onOpenHall,
  onOpenMainHall,
  onBackToRoom,
}: {
  /** The up-to-9 non-HUB shapes that have a real saved Hall behind them. */
  assignments: Partial<Record<CampusRoomId, CampusRoomAssignment>>;
  /** HUB always represents whatever room is currently open in the builder — real, live counts, not a separate Hall lookup. */
  hubOccupied: number;
  hubCapacity: number;
  onOpenHall: (hallId: string) => void;
  onOpenMainHall: () => void;
  onBackToRoom: () => void;
}) {
  const mapRooms = CAMPUS_ROOMS.map((layout) => ({ layout, assignment: assignments[layout.id] ?? null }));
  const mapWidth = (MAP_BOUNDS.z1 - MAP_BOUNDS.z0) * MAP_HORIZONTAL_SCALE;
  const mapHeight = MAP_BOUNDS.x1 - MAP_BOUNDS.x0;

  function open(layout: CampusRoom, assignment: CampusRoomAssignment | null) {
    if (layout.id === "HUB") onOpenMainHall();
    else if (assignment) onOpenHall(assignment.hallId);
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_58%_0%,rgba(79,211,238,0.09),transparent_34%),linear-gradient(180deg,#12151a,#07090d)] p-3 text-white sm:p-4">
      <div className="mx-auto grid h-full min-h-0 max-w-[1680px] grid-rows-[auto_minmax(0,1fr)] gap-2 sm:grid-cols-[168px_minmax(0,1fr)] sm:grid-rows-1 sm:gap-3">
        <aside className="z-10 flex items-center gap-2 sm:flex-col sm:items-stretch sm:pt-2">
          <div className="flex min-h-10 items-center gap-2 px-2 text-xs font-black uppercase tracking-[0.14em] text-white/82">
            <MapIcon size={14} />
            Universe Map
          </div>
          <button
            type="button"
            onClick={onBackToRoom}
            className="flex min-h-10 items-center gap-2 rounded-[6px] bg-black/28 px-3 text-xs font-black uppercase tracking-[0.12em] text-white ring-1 ring-white/14 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#79e7fb]"
          >
            <Sparkles size={14} />
            Back to Room
          </button>

          <div className="mt-auto hidden gap-3 px-2 pb-4 text-[10px] font-black uppercase tracking-[0.12em] text-white/48 sm:grid">
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-[2px] bg-[#d9dde0]" /> Active room</span>
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-[2px] border border-[#79e7fb] bg-[#153c50] shadow-[0_0_8px_rgba(121,231,251,0.5)]" /> Doorway</span>
            <span className="inline-flex items-center gap-2"><DoorOpen size={13} /> Entrance at left</span>
          </div>
        </aside>

        <section className="relative min-h-0 overflow-hidden">
            <svg
              viewBox={`-3 -3 ${mapWidth + 6} ${mapHeight + 6}`}
              preserveAspectRatio="xMidYMid meet"
              className="block h-full w-full"
              role="group"
              aria-label="Interactive floor plan of the VLTD Museum campus"
            >
              <defs>
                <linearGradient id="museum-map-room" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f3f5f6" /><stop offset="0.55" stopColor="#d9dde0" /><stop offset="1" stopColor="#b8bec3" /></linearGradient>
                <linearGradient id="museum-map-empty" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#20252b" /><stop offset="1" stopColor="#0f1318" /></linearGradient>
                <linearGradient id="museum-map-hub" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#282116" /><stop offset="0.55" stopColor="#15191d" /><stop offset="1" stopColor="#0b1014" /></linearGradient>
                <filter id="museum-map-glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="0.8" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              </defs>

              {mapRooms.map(({ layout, assignment }) => {
                const isHub = layout.id === "HUB";
                const isPlaza = layout.id === "PLAZA";
                const isComingSoon = layout.id === "SPOTLIGHT" || layout.id === "STORE";
                const enabled = isHub || Boolean(assignment);
                const label = ROOM_LABELS[layout.id];
                const subtitle = isHub
                  ? "Grand Hall"
                  : isPlaza
                    ? "Main Entrance"
                    : isComingSoon
                      ? "Coming soon"
                      : assignment
                        ? "Saved Hall"
                        : "Not set up yet";
                const mapped = mapRect(layout.x, layout.z, layout.w, layout.d);
                const centerX = mapped.x + mapped.width / 2;
                const titleY = mapped.y + Math.min(9, mapped.height * 0.38);
                const compact = mapped.height <= 21;
                const titleSize = isHub ? 5 : Math.min(compact ? 2.55 : 3.2, (mapped.width - 3) / Math.max(1, label.length * 0.62));
                const occupancyText = isHub
                  ? `${hubOccupied} / ${hubCapacity} ITEMS`
                  : assignment
                    ? `${assignment.occupied} / ${assignment.capacity} ITEMS`
                    : null;
                const accessibleLabel = isHub
                  ? `${label}, the room currently open, ${hubOccupied} of ${hubCapacity} items`
                  : assignment
                    ? `${assignment.title}, ${assignment.occupied} of ${assignment.capacity} items`
                    : `${label}, ${subtitle}`;
                return (
                  <g
                    key={layout.id}
                    role={enabled ? "button" : undefined}
                    tabIndex={enabled ? 0 : -1}
                    aria-label={accessibleLabel}
                    onClick={() => enabled && open(layout, assignment)}
                    onKeyDown={(event) => enabled && (event.key === "Enter" || event.key === " ") && open(layout, assignment)}
                    className={enabled ? "cursor-pointer outline-none" : "cursor-default"}
                  >
                    <rect x={mapped.x + 0.55} y={mapped.y + 0.55} width={mapped.width - 1.1} height={mapped.height - 1.1} rx={1.5} fill={isHub ? "url(#museum-map-hub)" : enabled ? "url(#museum-map-room)" : "url(#museum-map-empty)"} stroke={isHub ? "#9a7a3a" : enabled ? "#dce3e7" : "#303840"} strokeWidth={0.45} className="transition hover:brightness-110" />
                    {isHub && <><circle cx={centerX} cy={mapped.y + mapped.height / 2 - 3.2} r={5.2} fill="#090c0f" stroke="#92743a" strokeWidth={0.45} /><circle cx={centerX} cy={mapped.y + mapped.height / 2 - 3.2} r={3.8} fill="none" stroke="#5f4e2d" strokeWidth={0.3} /><text x={centerX} y={mapped.y + mapped.height / 2 - 2.2} textAnchor="middle" fill="#d7bd77" fontSize={3.1} fontWeight={900}>VLTD</text></>}
                    <text x={centerX} y={titleY} textAnchor="middle" fill={isHub ? "#f4e4b3" : enabled ? "#111820" : "#d8dde2"} fontSize={titleSize} fontWeight={900} letterSpacing={compact ? 0.05 : 0.12}>{(assignment?.title ?? label).toUpperCase()}</text>
                    <text x={centerX} y={titleY + (isHub ? 4.3 : 3.4)} textAnchor="middle" fill={isHub ? "#9ba6ae" : enabled ? "#59636b" : "#737d85"} fontSize={compact ? 1.85 : 2.25} fontWeight={700}>{subtitle.toUpperCase()}</text>
                    {occupancyText ? <text x={centerX} y={mapped.y + mapped.height - 3.5} textAnchor="middle" fill={isHub ? "#9fddeb" : "#26323a"} fontSize={compact ? 1.85 : 2.15} fontWeight={800}>{occupancyText}</text> : null}
                  </g>
                );
              })}

              {CAMPUS_DOORS.map((door, index) => {
                const width = door.width ?? 3;
                const horizontal = door.wall === "x";
                const mapped = horizontal
                  ? mapRect(door.gapCenter - width / 2, door.at - 0.72, width, 1.44)
                  : mapRect(door.at - 0.72, door.gapCenter - width / 2, 1.44, width);
                return <rect key={`${door.rooms[0]}-${door.rooms[1] ?? "entry"}-${index}`} x={mapped.x} y={mapped.y} width={mapped.width} height={mapped.height} rx={0.42} fill="#153c50" stroke="#79e7fb" strokeWidth={0.42} filter="url(#museum-map-glow)" pointerEvents="none" />;
              })}
            </svg>
        </section>
      </div>
    </div>
  );
}
