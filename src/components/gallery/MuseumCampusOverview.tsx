"use client";

import Link from "next/link";
import { DoorOpen, Map as MapIcon, Sparkles } from "lucide-react";

import { CAMPUS_DOORS, CAMPUS_ROOMS, type CampusRoomId } from "@/lib/campusLayout";

// 2026-09-11, corrected same day: this map represents the ONE real, shared
// VLTD Museum at /museum/vltd — not a personal campus. An earlier pass the
// same day (commit fe56c33) let each account "place" its own saved Halls
// onto these room shapes, which meant every user effectively got their own
// private 13-room museum — that direction was wrong and has been removed
// (see HANDOFF.md). This component is now a pure, read-only floor plan
// rendered straight from CAMPUS_ROOMS/CAMPUS_DOORS — the same shared layout
// data the real museum itself is built from — plus links into that real
// museum. It never reads or writes any per-user Hall data.
//
// 2026-09-11, second correction same day: the first version of this
// rewrite over-corrected the layout along with the data — it collapsed the
// left control column into a full-width header, shrank the map, and left
// every room non-interactive. Restored (same left-column/aside structure
// fe56c33 also had, minus its per-Hall content): Universe Map label, Back
// to Room, and Enter VLTD Museum all live in the left column now, with the
// legend beneath them; the SVG section gets back the space that column
// leaves it.
//
// 2026-09-12, EK's review of a real production screenshot: every real
// gallery room (including SPOTLIGHT/STORE, previously shown muted/dark as
// if disabled — "not sure why you made it different," fair, that read as
// broken rather than intentional) is now the same light fill and is
// clickable, opening the shared museum — there's no per-room deep link
// into the museum scene itself (that file stays untouched), so every
// room's click destination is the museum's one entry point for now. PLAZA
// (the open-air entrance forecourt, not a gallery) is the one shape kept
// visually and functionally distinct — dark fill, not clickable. Each real
// gallery room also gets a small separate edit-icon badge (top-right,
// matching EK's marked screenshot) — deliberately NOT wired to a
// destination yet: "the edit page" she described (per-room item
// organize + title/description) is a real, separate feature that doesn't
// exist yet (the future room editor, explicitly out of scope for the
// recovery pass this map came out of). The badge is visible and its
// tooltip says so plainly rather than silently linking somewhere wrong.
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
// north edge. This panel is landscape, so present the same plan a quarter-turn
// clockwise: north/entrance moves to the left and the Grand Hall runs across
// the panel. Scale kept from the 2026-09-11 "use full workspace" pass — do
// not revert to a smaller/more-stretched value.
const MAP_HORIZONTAL_SCALE = 1.42;

function mapRect(x: number, z: number, width: number, depth: number) {
  return {
    x: (z - MAP_BOUNDS.z0) * MAP_HORIZONTAL_SCALE,
    y: x - MAP_BOUNDS.x0,
    width: depth * MAP_HORIZONTAL_SCALE,
    height: width,
  };
}

export default function MuseumCampusOverview({ onBackToRoom }: { onBackToRoom: () => void }) {
  const mapWidth = (MAP_BOUNDS.z1 - MAP_BOUNDS.z0) * MAP_HORIZONTAL_SCALE;
  const mapHeight = MAP_BOUNDS.x1 - MAP_BOUNDS.x0;

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
          <Link
            href="/museum/vltd"
            className="flex min-h-10 items-center gap-2 rounded-[6px] bg-[#4FD3EE] px-3 text-xs font-black uppercase tracking-[0.12em] text-[#06171d] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <DoorOpen size={14} />
            Enter VLTD Museum
          </Link>

          <div className="mt-auto hidden gap-3 px-2 pb-4 text-[10px] font-black uppercase tracking-[0.12em] text-white/48 sm:grid">
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-[2px] bg-[#d9dde0]" /> Room</span>
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-[2px] border border-[#79e7fb] bg-[#153c50] shadow-[0_0_8px_rgba(121,231,251,0.5)]" /> Doorway</span>
            <span className="inline-flex items-center gap-2"><DoorOpen size={13} /> Entrance at left</span>
          </div>
        </aside>

        <section className="relative min-h-0 overflow-hidden">
          <svg
            viewBox={`-3 -3 ${mapWidth + 6} ${mapHeight + 6}`}
            preserveAspectRatio="xMidYMid meet"
            className="block h-full w-full"
            role="img"
            aria-label="Floor plan of the real VLTD Museum"
          >
            <defs>
              <linearGradient id="museum-map-room" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f3f5f6" /><stop offset="0.55" stopColor="#d9dde0" /><stop offset="1" stopColor="#b8bec3" /></linearGradient>
              <linearGradient id="museum-map-empty" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#20252b" /><stop offset="1" stopColor="#0f1318" /></linearGradient>
              <linearGradient id="museum-map-hub" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#282116" /><stop offset="0.55" stopColor="#15191d" /><stop offset="1" stopColor="#0b1014" /></linearGradient>
              <filter id="museum-map-glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="0.8" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>

            {CAMPUS_ROOMS.map((layout) => {
              const isHub = layout.id === "HUB";
              const isPlaza = layout.id === "PLAZA";
              const isComingSoon = layout.id === "SPOTLIGHT" || layout.id === "STORE";
              // EK's review, 2026-09-12: every real gallery room reads the
              // same regardless of content status — SPOTLIGHT/STORE are no
              // longer visually muted, and are clickable like every other
              // room. PLAZA (the open-air entrance, not a gallery) is the
              // only shape kept dark and non-interactive.
              const interactive = isHub || !isPlaza;
              const isEditableRoom = interactive && !isHub;
              const label = ROOM_LABELS[layout.id];
              const subtitle = isHub
                ? "Grand Hall"
                : isPlaza
                  ? "Main Entrance"
                  : isComingSoon
                    ? "Coming soon"
                    : layout.tierLabel.replace(" · baseline", "");
              const mapped = mapRect(layout.x, layout.z, layout.w, layout.d);
              const centerX = mapped.x + mapped.width / 2;
              const titleY = mapped.y + Math.min(9, mapped.height * 0.38);
              const compact = mapped.height <= 21;
              const titleSize = isHub ? 5 : Math.min(compact ? 2.55 : 3.2, (mapped.width - 3) / Math.max(1, label.length * 0.62));
              const content = (
                <>
                  <rect
                    x={mapped.x + 0.55}
                    y={mapped.y + 0.55}
                    width={mapped.width - 1.1}
                    height={mapped.height - 1.1}
                    rx={1.5}
                    fill={isHub ? "url(#museum-map-hub)" : isPlaza ? "url(#museum-map-empty)" : "url(#museum-map-room)"}
                    stroke={isHub ? "#9a7a3a" : isPlaza ? "#303840" : "#dce3e7"}
                    strokeWidth={0.45}
                    className={interactive ? "transition hover:brightness-110" : undefined}
                  />
                  {isHub ? (
                    <>
                      <circle cx={centerX} cy={mapped.y + mapped.height / 2 - 3.2} r={5.2} fill="#090c0f" stroke="#92743a" strokeWidth={0.45} />
                      <circle cx={centerX} cy={mapped.y + mapped.height / 2 - 3.2} r={3.8} fill="none" stroke="#5f4e2d" strokeWidth={0.3} />
                      <text x={centerX} y={mapped.y + mapped.height / 2 - 2.2} textAnchor="middle" fill="#d7bd77" fontSize={3.1} fontWeight={900}>VLTD</text>
                    </>
                  ) : null}
                  <text x={centerX} y={titleY} textAnchor="middle" fill={isHub ? "#f4e4b3" : isPlaza ? "#d8dde2" : "#111820"} fontSize={titleSize} fontWeight={900} letterSpacing={compact ? 0.05 : 0.12}>{label.toUpperCase()}</text>
                  <text x={centerX} y={titleY + (isHub ? 4.3 : 3.4)} textAnchor="middle" fill={isHub ? "#9ba6ae" : isPlaza ? "#737d85" : "#59636b"} fontSize={compact ? 1.85 : 2.25} fontWeight={700}>{subtitle.toUpperCase()}</text>
                </>
              );
              // Edit badge — a separate clickable target from the room body
              // (never nested inside the room's own Link — two interactive
              // elements, one for "view," one for "edit," matching EK's
              // marked screenshot). Deliberately NOT wired to a destination
              // yet: the per-room editor it should open doesn't exist yet.
              const editBadge = isEditableRoom ? (
                <g
                  key={`${layout.id}-edit`}
                  aria-label={`Edit ${label} — room editor coming soon`}
                  className="cursor-not-allowed"
                >
                  <circle cx={mapped.x + mapped.width - 2.6} cy={mapped.y + 2.6} r={1.6} fill="rgba(20,23,28,0.55)" stroke="rgba(255,255,255,0.4)" strokeWidth={0.15} />
                  <g transform={`translate(${mapped.x + mapped.width - 2.6} ${mapped.y + 2.6}) rotate(45)`}>
                    <rect x={-0.17} y={-0.95} width={0.34} height={1.5} rx={0.1} fill="#eef1f3" />
                    <polygon points="-0.17,0.55 0.17,0.55 0,1.05" fill="#eef1f3" />
                  </g>
                  <title>{`Edit ${label} — room editor coming soon`}</title>
                </g>
              ) : null;
              return (
                <g key={layout.id}>
                  {interactive ? (
                    <Link href="/museum/vltd" aria-label={`${label} — opens the VLTD Museum`} className="cursor-pointer outline-none">
                      {content}
                    </Link>
                  ) : (
                    <g aria-label={label} className="cursor-default">
                      {content}
                    </g>
                  )}
                  {editBadge}
                </g>
              );
            })}

            {CAMPUS_DOORS.map((door, index) => {
              const width = door.width ?? 3;
              const horizontal = door.wall === "x";
              const mapped = horizontal
                ? mapRect(door.gapCenter - width / 2, door.at - 0.72, width, 1.44)
                : mapRect(door.at - 0.72, door.gapCenter - width / 2, 1.44, width);
              return (
                <rect
                  key={`${door.rooms[0]}-${door.rooms[1] ?? "entry"}-${index}`}
                  x={mapped.x}
                  y={mapped.y}
                  width={mapped.width}
                  height={mapped.height}
                  rx={0.42}
                  fill="#153c50"
                  stroke="#79e7fb"
                  strokeWidth={0.42}
                  filter="url(#museum-map-glow)"
                  pointerEvents="none"
                />
              );
            })}
          </svg>
        </section>
      </div>
    </div>
  );
}
