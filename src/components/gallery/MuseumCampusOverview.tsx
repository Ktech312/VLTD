"use client";

import { BadgeDollarSign, Boxes, DoorOpen, ExternalLink, Map as MapIcon } from "lucide-react";
import type { ReactNode } from "react";

import {
  assignSwingRoomUniverses,
  CAMPUS_DOORS,
  CAMPUS_ROOMS,
  type CampusRoom,
  type CampusRoomId,
} from "@/lib/campusLayout";
import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";
import type { VaultItem } from "@/lib/vaultModel";

export type MuseumMapRoom = {
  id: string;
  title: string;
  items: VaultItem[];
  value: number;
  tier: "Starter" | "Gallery" | "Hall";
  wing: "North" | "South" | "Main" | "Garden";
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
// runs across the panel. A modest horizontal presentation scale uses the map's
// available width without stretching its text or doorway symbols.
const MAP_HORIZONTAL_SCALE = 1.65;

function mapRect(x: number, z: number, width: number, depth: number) {
  return {
    x: (z - MAP_BOUNDS.z0) * MAP_HORIZONTAL_SCALE,
    y: x - MAP_BOUNDS.x0,
    width: depth * MAP_HORIZONTAL_SCALE,
    height: width,
  };
}

function itemUniverse(item: VaultItem): UniverseKey {
  const raw = String(item.universe || item.category || "MISC").trim().toUpperCase();
  return raw && UNIVERSE_LABEL[raw as UniverseKey] ? raw as UniverseKey : "MISC";
}

function compactNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return Math.round(value).toLocaleString();
}

function Metric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-[7px] bg-white/[0.045] p-2.5 ring-1 ring-white/8">
      <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.13em] text-white/34">
        {icon}{label}
      </div>
      <div className="mt-1 text-sm font-black text-white">{value}</div>
    </div>
  );
}

export default function MuseumCampusOverview({
  rooms,
  onOpenRoom,
  onOpenMainHall,
}: {
  rooms: MuseumMapRoom[];
  onOpenRoom: (room: MuseumMapRoom) => void;
  onOpenMainHall: () => void;
}) {
  const totalItems = rooms.reduce((sum, room) => sum + room.items.length, 0);
  const totalValue = rooms.reduce((sum, room) => sum + room.value, 0);
  const allItems = rooms.flatMap((room) => room.items);
  const counts: Partial<Record<UniverseKey, number>> = {};
  for (const item of allItems) {
    const universe = itemUniverse(item);
    counts[universe] = (counts[universe] ?? 0) + 1;
  }
  const swing = assignSwingRoomUniverses(counts);
  const roomUniverses: Partial<Record<CampusRoomId, UniverseKey[]>> = {
    COLLECTION: swing.COLLECTION,
    CARDS: swing.CARDS,
    MISC: ["MISC", ...swing.MISC_EXTRA],
  };

  function contentFor(room: CampusRoom): MuseumMapRoom | null {
    const universes = roomUniverses[room.id] ?? room.universes;
    if (!universes.length) return null;
    const items = allItems.filter((item) => universes.includes(itemUniverse(item)));
    const value = items.reduce((sum, item) => sum + Number(item.currentValue ?? 0), 0);
    return {
      id: room.id.toLowerCase().replaceAll("_", "-"),
      title: ROOM_LABELS[room.id],
      items,
      value,
      tier: items.length >= 18 ? "Hall" : items.length >= 8 ? "Gallery" : "Starter",
      wing: room.tierLabel.toLowerCase().includes("north")
        ? "North"
        : room.tierLabel.toLowerCase().includes("south")
          ? "South"
          : room.tierLabel.toLowerCase().includes("garden")
            ? "Garden"
            : "Main",
    };
  }

  const mapRooms = CAMPUS_ROOMS.map((layout) => ({ layout, content: contentFor(layout) }));
  const mapWidth = (MAP_BOUNDS.z1 - MAP_BOUNDS.z0) * MAP_HORIZONTAL_SCALE;
  const mapHeight = MAP_BOUNDS.x1 - MAP_BOUNDS.x0;

  function open(layout: CampusRoom, content: MuseumMapRoom | null) {
    if (layout.id === "HUB") onOpenMainHall();
    else if (content?.items.length) onOpenRoom(content);
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_50%_0%,rgba(79,211,238,0.10),transparent_30%),linear-gradient(180deg,#12151a,#07090d)] p-4 pt-16 text-white">
      <div className="mx-auto grid h-full min-h-0 max-h-[calc(100vh-300px)] max-w-[1180px] gap-4 xl:grid-cols-[minmax(0,1fr)_250px]">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-[8px] border border-white/10 bg-[#0b0e12] p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)] sm:p-4">
          <div className="mb-2 grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2">
            <span className="inline-flex w-fit items-center rounded-[6px] border border-amber-200/20 bg-amber-300/8 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-amber-100/72">Complete campus</span>
            <span className="text-center text-[10px] font-black uppercase tracking-[0.22em] text-white/38">VLTD Museum Floorplan</span>
            <span className="ml-auto inline-flex w-fit items-center rounded-[6px] border border-cyan-200/16 bg-cyan-300/[0.06] px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100/55">13 rooms · 20 doors</span>
          </div>

          <div className="min-h-0 flex-1">
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

              {mapRooms.map(({ layout, content }) => {
                const isHub = layout.id === "HUB";
                const isPlaza = layout.id === "PLAZA";
                const enabled = isHub || Boolean(content?.items.length);
                const label = ROOM_LABELS[layout.id];
                const subtitle = isHub ? "Grand Hall" : isPlaza ? "Main Entrance" : layout.id === "SPOTLIGHT" || layout.id === "STORE" ? "Coming soon" : layout.tierLabel.replace(" · baseline", "");
                const mapped = mapRect(layout.x, layout.z, layout.w, layout.d);
                const centerX = mapped.x + mapped.width / 2;
                const titleY = mapped.y + Math.min(9, mapped.height * 0.38);
                const compact = mapped.height <= 21;
                const titleSize = isHub ? 5 : Math.min(compact ? 2.55 : 3.2, (mapped.width - 3) / Math.max(1, label.length * 0.62));
                return (
                  <g
                    key={layout.id}
                    role={enabled ? "button" : undefined}
                    tabIndex={enabled ? 0 : -1}
                    aria-label={enabled ? `Open ${label}` : `${label}, ${subtitle}`}
                    onClick={() => enabled && open(layout, content)}
                    onKeyDown={(event) => enabled && (event.key === "Enter" || event.key === " ") && open(layout, content)}
                    className={enabled ? "cursor-pointer outline-none" : "cursor-default"}
                  >
                    <rect x={mapped.x + 0.55} y={mapped.y + 0.55} width={mapped.width - 1.1} height={mapped.height - 1.1} rx={1.5} fill={isHub ? "url(#museum-map-hub)" : enabled ? "url(#museum-map-room)" : "url(#museum-map-empty)"} stroke={isHub ? "#9a7a3a" : enabled ? "#dce3e7" : "#303840"} strokeWidth={0.45} className="transition hover:brightness-110" />
                    {isHub && <><circle cx={centerX} cy={mapped.y + mapped.height / 2 - 3.2} r={5.2} fill="#090c0f" stroke="#92743a" strokeWidth={0.45} /><circle cx={centerX} cy={mapped.y + mapped.height / 2 - 3.2} r={3.8} fill="none" stroke="#5f4e2d" strokeWidth={0.3} /><text x={centerX} y={mapped.y + mapped.height / 2 - 2.2} textAnchor="middle" fill="#d7bd77" fontSize={3.1} fontWeight={900}>VLTD</text></>}
                    <text x={centerX} y={titleY} textAnchor="middle" fill={isHub ? "#f4e4b3" : enabled ? "#111820" : "#d8dde2"} fontSize={titleSize} fontWeight={900} letterSpacing={compact ? 0.05 : 0.12}>{label.toUpperCase()}</text>
                    <text x={centerX} y={titleY + (isHub ? 4.3 : 3.4)} textAnchor="middle" fill={isHub ? "#9ba6ae" : enabled ? "#59636b" : "#737d85"} fontSize={compact ? 1.85 : 2.25} fontWeight={700}>{subtitle.toUpperCase()}</text>
                    {content?.items.length ? <text x={centerX} y={mapped.y + mapped.height - 3.5} textAnchor="middle" fill={isHub ? "#9fddeb" : "#26323a"} fontSize={compact ? 1.85 : 2.15} fontWeight={800}>{`${content.items.length} PCS · ${content.tier.toUpperCase()}`}</text> : null}
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
          </div>

          <div className="mt-2 flex shrink-0 items-center justify-center gap-4 rounded-[6px] border border-white/10 bg-black/30 px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/55">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[2px] bg-[#d9dde0]" /> Active room</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[2px] border border-[#79e7fb] bg-[#153c50] shadow-[0_0_8px_rgba(121,231,251,0.5)]" /> Doorway</span>
            <span className="inline-flex items-center gap-1.5"><DoorOpen size={13} /> Entrance at left</span>
          </div>
        </section>

        <aside className="grid min-h-0 content-start gap-3 overflow-hidden">
          <div className="rounded-[8px] border border-white/10 bg-black/24 p-4">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-white/42"><MapIcon size={15} />Floorplan</div>
            <h2 className="mt-2 text-xl font-black tracking-normal">Universe Rooms</h2>
            <div className="mt-3 grid grid-cols-2 gap-2"><Metric icon={<Boxes size={15} />} label="Vault Pieces" value={String(totalItems)} /><Metric icon={<BadgeDollarSign size={15} />} label="Vault Value" value={totalValue > 0 ? `$${compactNumber(totalValue)}` : "$0"} /></div>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-[8px] border border-white/10 bg-black/24 p-2"><button type="button" className="rounded-[6px] bg-cyan-300/14 px-2 py-2 text-xs font-black text-cyan-100 ring-1 ring-cyan-200/22">Overview</button><button type="button" className="rounded-[6px] bg-white/6 px-2 py-2 text-xs font-black text-white/54 ring-1 ring-white/8">Rooms</button><button type="button" className="rounded-[6px] bg-white/6 px-2 py-2 text-xs font-black text-white/54 ring-1 ring-white/8">Public</button></div>
          {rooms.slice(0, 6).map((room) => <button key={room.id} type="button" onClick={() => onOpenRoom(room)} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[8px] border border-white/10 bg-white/5 px-3 py-2.5 text-left transition hover:border-cyan-200/36 hover:bg-cyan-300/10"><span className="min-w-0"><span className="block truncate text-sm font-black">{room.title}</span><span className="mt-0.5 block text-xs font-semibold text-white/48">{room.items.length} items - {room.tier} - {room.wing}</span></span><ExternalLink size={16} className="text-white/46" /></button>)}
        </aside>
      </div>
    </div>
  );
}
