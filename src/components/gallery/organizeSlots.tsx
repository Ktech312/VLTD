"use client";

// Shared Museum Room Editor consolidation pass (2026-09-12): EK's direct
// correction on the prior two Room Editor passes — "we spent 2 weeks
// creating a baseline in the 3D gallery, now you are trying to reinvent
// what we already have done... The ADD/Edit room should create a pop of
// that room, that has all the functionality of the 'Organize' button in
// the 3D gallery." This file is the literal extraction of that Organize
// system out of VirtualGalleryRoom.tsx (the personal room builder) — NOT a
// rewrite. Every function and JSX block below was MOVED here verbatim
// (only generalized to take an abstract slot list + callbacks instead of
// hardcoding the personal Gallery's own `selectedIds` string array), so
// VirtualGalleryRoom.tsx and the new museum room popup
// (MuseumRoomPopup.tsx) now render the exact same overlay, Move menu, and
// Replace-confirm dialog from one shared place instead of each carrying
// its own copy.
//
// What moved here, and where it used to live in VirtualGalleryRoom.tsx:
//   - organizeSelectedSlot / moveMenuFor / replaceConfirm state
//   - organizeSlotRefs, organizeTouchRef
//   - moveItemToSlot, focusSlot, confirmReplace, cancelReplace, removeFromSlot
//   - startOrganizeTouchHold, handleOrganizeTouchMove, handleOrganizeTouchEnd
//   - the numbered +/- overlay JSX (data-organize-idx buttons + Remove/Move)
//   - the "Move to position…" bottom-sheet JSX
//   - the Replace/Cancel confirmation dialog JSX
//
// Deliberately NOT moved (stays host-specific, since it differs per
// caller): `announce` itself (each host owns its own live region/state —
// this file just calls whatever `announce` function it's given),
// `handleOrganizeToggle` (ties into each host's own save/exit flow), and
// building the actual slot list / 3D projection (each host's own rAF loop
// still projects real 3D positions onto whatever DOM nodes register
// themselves in `slotRefs` below — this file has no idea it's looking at
// a personal Gallery shelf vs. a museum wall span).
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";

export type SlotItemLike = { title?: string | null };

export type OrganizeSlotGroup = { label: string; indices: number[] };

export type ReplaceConfirmState = {
  fromIdx: number;
  toIdx: number;
  itemTitle: string;
  destTitle: string;
};

export type UseSlotOrganizerOptions = {
  /** One entry per slot, same fixed order/length as the host's own slot
   * position table — null for an empty slot. */
  slotItems: Array<SlotItemLike | null>;
  /** Display number shown on a slot's badge and in Move-menu labels —
   * defaults to the plain 1-based array position when omitted. */
  slotDisplayNumber?: Map<number, number>;
  /** Move an item into an EMPTY destination slot — mutate the host's own
   * data model (selectedIds for the personal Gallery, museum_room_items
   * for a museum room). */
  onMove: (fromIdx: number, toIdx: number) => void;
  /** Move an item onto an OCCUPIED destination slot, after the user
   * confirms Replace — the destination's previous item is dropped from
   * this room (never deleted from the underlying vault). */
  onReplace: (fromIdx: number, toIdx: number) => void;
  /** Clear one slot. */
  onRemove: (idx: number) => void;
  /** Screen-reader / toast announcement — each host owns its own live
   * region; this just calls whatever function it's given. */
  announce: (message: string) => void;
};

// Touch press-and-hold-to-drag tuning — copied verbatim from
// VirtualGalleryRoom.tsx's own ORGANIZE_HOLD_MS/ORGANIZE_MOVE_TOLERANCE: "a
// short, intentional press-and-hold starts item dragging... a normal tap
// does not become a drag."
const ORGANIZE_HOLD_MS = 260;
const ORGANIZE_MOVE_TOLERANCE = 10;

type TouchDragState = {
  idx: number;
  x: number;
  y: number;
  armed: boolean;
  overIdx: number | null;
  timer: number | null;
};

/** The shared Organize interaction/data layer — click-to-select, desktop
 * drag, touch press-and-hold-drag, and the keyboard Move menu all funnel
 * through the same `moveItemToSlot`/`confirmReplace`/`removeFromSlot`
 * commands, exactly like the personal Gallery's own Organize overlay
 * always has. See the module comment above for exactly what moved here. */
export function useSlotOrganizer(options: UseSlotOrganizerOptions) {
  const { slotItems, slotDisplayNumber, onMove, onReplace, onRemove, announce } = options;
  const [organizeSelectedSlot, setOrganizeSelectedSlot] = useState<number | null>(null);
  const [moveMenuFor, setMoveMenuFor] = useState<number | null>(null);
  const [replaceConfirm, setReplaceConfirm] = useState<ReplaceConfirmState | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const slotRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const touchRef = useRef<TouchDragState | null>(null);

  function displayNumber(idx: number): number {
    return slotDisplayNumber?.get(idx) ?? idx + 1;
  }

  // "Focus returns predictably after picker, confirmation, save, or
  // cancellation" — a `setTimeout(0)` waits for the DOM to actually
  // reflect the state change before focusing (the target slot's control
  // may not exist yet, or may have just been replaced, in the same tick).
  function focusSlot(idx: number) {
    window.setTimeout(() => {
      slotRefs.current.get(idx)?.querySelector("button")?.focus();
    }, 0);
  }

  // Dropping onto an EMPTY valid slot moves the item there outright.
  // Dropping onto an OCCUPIED valid slot never silently swaps or
  // overwrites — it opens the Replace/Cancel prompt instead.
  function moveItemToSlot(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return;
    const fromItem = slotItems[fromIdx];
    if (!fromItem) return;
    const destItem = slotItems[toIdx];
    if (destItem) {
      setReplaceConfirm({
        fromIdx,
        toIdx,
        itemTitle: fromItem.title || "This item",
        destTitle: destItem.title || "this item",
      });
      return;
    }
    onMove(fromIdx, toIdx);
    setOrganizeSelectedSlot(null);
    setMoveMenuFor(null);
    announce(`Moved to position ${displayNumber(toIdx)}.`);
    focusSlot(toIdx);
  }

  // On Replace: the dragged item takes the destination slot; the item
  // that was there returns to the vault/unassigned pool — it is NOT
  // deleted, just no longer placed in any slot of THIS room.
  function confirmReplace() {
    if (!replaceConfirm) return;
    const { fromIdx, toIdx, destTitle } = replaceConfirm;
    onReplace(fromIdx, toIdx);
    announce(`Replaced. ${destTitle} was removed from this room only — it is still in your vault.`);
    setReplaceConfirm(null);
    setOrganizeSelectedSlot(null);
    setMoveMenuFor(null);
    focusSlot(toIdx);
  }

  function cancelReplace() {
    if (replaceConfirm) focusSlot(replaceConfirm.fromIdx);
    setReplaceConfirm(null);
  }

  // Removing from a room clears only this slot's item reference — the
  // real vault item, its media, and its metadata are never touched.
  function removeFromSlot(idx: number) {
    const item = slotItems[idx];
    onRemove(idx);
    setOrganizeSelectedSlot(null);
    announce(`${item?.title || "Item"} removed from this room. It is still in your vault.`);
    focusSlot(idx);
  }

  // Touch press-and-hold-to-drag — a tap that never holds long enough (or
  // that moves too far before the hold timer fires) falls through as a
  // plain select/no-op instead.
  function startTouchHold(event: React.TouchEvent, index: number) {
    const touch = event.touches[0];
    if (!touch) return;
    const timer = window.setTimeout(() => {
      if (touchRef.current?.idx === index) {
        touchRef.current.armed = true;
        setDragIndex(index);
      }
    }, ORGANIZE_HOLD_MS);
    touchRef.current = { idx: index, x: touch.clientX, y: touch.clientY, armed: false, overIdx: null, timer };
  }

  function handleTouchMove(event: React.TouchEvent) {
    const ref = touchRef.current;
    if (!ref) return;
    const touch = event.touches[0];
    if (!touch) return;
    const dx = touch.clientX - ref.x;
    const dy = touch.clientY - ref.y;
    if (!ref.armed) {
      if (Math.abs(dx) > ORGANIZE_MOVE_TOLERANCE || Math.abs(dy) > ORGANIZE_MOVE_TOLERANCE) {
        // Moved before the hold armed — a normal drag-to-look gesture, not
        // an item drag. Cancel and let it go (this handler never called
        // preventDefault, so the camera's own drag-look still tracks this
        // same gesture underneath).
        if (ref.timer) window.clearTimeout(ref.timer);
        touchRef.current = null;
      }
      return;
    }
    let el: Element | null = document.elementFromPoint(touch.clientX, touch.clientY);
    let toIdx: number | null = null;
    while (el && toIdx === null) {
      const attr = el.getAttribute?.("data-organize-idx");
      if (attr !== null && attr !== undefined) toIdx = parseInt(attr, 10);
      el = el.parentElement;
    }
    const resolved = toIdx !== null && toIdx !== ref.idx ? toIdx : null;
    ref.overIdx = resolved;
    setDragOverIndex(resolved);
  }

  function handleTouchEnd() {
    const ref = touchRef.current;
    touchRef.current = null;
    if (!ref) return;
    if (ref.timer) window.clearTimeout(ref.timer);
    if (!ref.armed) {
      // Never armed into a drag — a plain tap selects/deselects this slot.
      setOrganizeSelectedSlot((current) => (current === ref.idx ? null : ref.idx));
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    setDragIndex(null);
    setDragOverIndex(null);
    if (ref.overIdx !== null && ref.overIdx !== ref.idx) moveItemToSlot(ref.idx, ref.overIdx);
  }

  return {
    organizeSelectedSlot,
    setOrganizeSelectedSlot,
    moveMenuFor,
    setMoveMenuFor,
    replaceConfirm,
    dragIndex,
    setDragIndex,
    dragOverIndex,
    setDragOverIndex,
    slotRefs,
    displayNumber,
    focusSlot,
    moveItemToSlot,
    confirmReplace,
    cancelReplace,
    removeFromSlot,
    startTouchHold,
    handleTouchMove,
    handleTouchEnd,
  };
}

export type SlotOrganizer = ReturnType<typeof useSlotOrganizer>;

/** The numbered +/- overlay itself — one real, tabbable HTML control per
 * slot, registered into `organizer.slotRefs` so the host's own rAF
 * projection loop can position it over that slot's real 3D location every
 * frame. Empty slots show a real "+"; occupied slots select on click/tap
 * and reveal Remove/Move; desktop drag and a press-and-hold touch drag
 * both call the same `moveItemToSlot` command as the Move menu below. */
export function OrganizeSlotOverlay({
  slotCount,
  slotItems,
  organizer,
  onOpenPicker,
}: {
  slotCount: number;
  slotItems: Array<SlotItemLike | null>;
  organizer: SlotOrganizer;
  onOpenPicker: (idx: number) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[5]">
      {Array.from({ length: slotCount }, (_, index) => {
        const item = slotItems[index];
        const label = organizer.displayNumber(index);
        const isSelected = organizer.organizeSelectedSlot === index;
        const isDragSource = organizer.dragIndex === index;
        const isDragOver = organizer.dragOverIndex === index && organizer.dragIndex !== null && organizer.dragIndex !== index;
        return (
          <div
            key={index}
            ref={(el) => {
              organizer.slotRefs.current.set(index, el);
            }}
            className="pointer-events-none absolute left-0 top-0"
          >
            {item ? (
              <div className="pointer-events-auto relative">
                <button
                  type="button"
                  data-organize-idx={index}
                  draggable
                  style={{ touchAction: "none" }}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    organizer.setDragIndex(index);
                  }}
                  onDragOver={(event) => {
                    if (organizer.dragIndex === null) return;
                    event.preventDefault();
                    if (organizer.dragIndex !== index) organizer.setDragOverIndex(index);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const fromIdx = organizer.dragIndex;
                    organizer.setDragIndex(null);
                    organizer.setDragOverIndex(null);
                    if (fromIdx !== null && fromIdx !== index) organizer.moveItemToSlot(fromIdx, index);
                  }}
                  onDragEnd={() => {
                    organizer.setDragIndex(null);
                    organizer.setDragOverIndex(null);
                  }}
                  onTouchStart={(event) => organizer.startTouchHold(event, index)}
                  onTouchMove={organizer.handleTouchMove}
                  onTouchEnd={organizer.handleTouchEnd}
                  onTouchCancel={organizer.handleTouchEnd}
                  onClick={() => organizer.setOrganizeSelectedSlot((current) => (current === index ? null : index))}
                  aria-label={`${item.title || "Item"}, position ${label}${isSelected ? ", selected" : ""}`}
                  aria-pressed={isSelected}
                  title={item.title ?? undefined}
                  className={[
                    "grid h-11 w-11 place-items-center rounded-full text-[12px] font-black shadow-[0_2px_12px_rgba(0,0,0,0.55)] ring-2 transition",
                    isSelected ? "bg-[#4FD3EE] text-[#06171d] ring-white" : "bg-black/55 text-white ring-white/70 hover:ring-[#4FD3EE]",
                    isDragOver ? "scale-125 bg-[rgba(79,211,238,0.35)] ring-[#4FD3EE]" : "",
                    isDragSource ? "opacity-40" : "",
                  ].join(" ")}
                >
                  {label}
                </button>
                {isSelected ? (
                  <div className="absolute left-1/2 top-full z-10 mt-1.5 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => organizer.removeFromSlot(index)}
                      aria-label={`Remove ${item.title || "this item"} from this room`}
                      className="grid h-9 w-9 place-items-center rounded-full bg-red-500/90 text-base font-black leading-none text-white ring-1 ring-white/40 transition hover:bg-red-500"
                    >
                      <span aria-hidden>−</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => organizer.setMoveMenuFor(index)}
                      className="rounded-full bg-black/85 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white ring-1 ring-white/25 transition hover:bg-black"
                    >
                      Move
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <button
                type="button"
                data-organize-idx={index}
                onClick={() => onOpenPicker(index)}
                onDragOver={(event) => {
                  if (organizer.dragIndex === null) return;
                  event.preventDefault();
                  organizer.setDragOverIndex(index);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const fromIdx = organizer.dragIndex;
                  organizer.setDragIndex(null);
                  organizer.setDragOverIndex(null);
                  if (fromIdx !== null) organizer.moveItemToSlot(fromIdx, index);
                }}
                aria-label={`Empty position ${label}, add an item`}
                className={[
                  "pointer-events-auto grid h-11 w-11 place-items-center rounded-full border-2 border-dashed text-white/70 transition",
                  isDragOver
                    ? "scale-125 border-[#4FD3EE] bg-[rgba(79,211,238,0.25)] text-[#4FD3EE]"
                    : "border-white/40 bg-black/30 hover:border-[#4FD3EE] hover:text-[#4FD3EE]",
                ].join(" ")}
              >
                <Plus size={16} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Keyboard/phone fallback for moving a selected item — "Move" opens a
 * list of valid destination slot numbers, grouped however the host wants
 * (the personal Gallery groups by physical wall; a museum room can do the
 * same using its own PlacementSlot.wall). Occupied destinations are
 * identified and still go through the same Replace/Cancel confirmation as
 * a drag drop. */
export function OrganizeMoveMenu({
  groups,
  slotItems,
  organizer,
}: {
  groups: OrganizeSlotGroup[];
  slotItems: Array<SlotItemLike | null>;
  organizer: SlotOrganizer;
}) {
  const moveMenuFor = organizer.moveMenuFor;
  if (moveMenuFor === null || typeof document === "undefined") return null;
  return createPortal(
    <div
      className="flex items-end justify-center p-0 sm:items-center sm:p-4"
      style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, zIndex: 97 }}
    >
      <button
        type="button"
        onClick={() => {
          organizer.focusSlot(moveMenuFor);
          organizer.setMoveMenuFor(null);
        }}
        aria-label="Close"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div
        className="relative flex max-h-[80dvh] w-full flex-col overflow-hidden rounded-t-3xl ring-1 sm:max-w-sm sm:rounded-3xl"
        style={{ background: "var(--bg, #060a13)", borderColor: "var(--theme-border)" }}
      >
        <div className="flex justify-center pb-1 pt-3 sm:hidden">
          <div className="h-1 w-12 rounded-full bg-[color:var(--border)]" />
        </div>
        <div className="p-4 pb-2">
          <div className="text-sm font-black">Move to position…</div>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            Positions marked <span className="text-amber-200">•</span> already hold an item — you&apos;ll be
            asked before replacing it.
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {groups.map((group) => (
            <div key={group.label} className="mb-3">
              <div className="mb-1 text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--muted2)]">
                {group.label}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {group.indices.map((idx) => {
                  const destItem = slotItems[idx];
                  const isSelf = idx === moveMenuFor;
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={isSelf}
                      onClick={() => {
                        organizer.setMoveMenuFor(null);
                        organizer.moveItemToSlot(moveMenuFor, idx);
                      }}
                      aria-label={`Move to position ${organizer.displayNumber(idx)}${destItem ? `, currently ${destItem.title}` : ", empty"}`}
                      className={[
                        "min-h-11 rounded-[6px] px-1.5 py-2 text-[11px] font-bold ring-1 transition",
                        isSelf
                          ? "cursor-default bg-white/5 text-white/25 ring-white/10"
                          : destItem
                            ? "bg-amber-300/10 text-amber-100 ring-amber-200/30 hover:bg-amber-300/20"
                            : "bg-white/5 text-white/80 ring-white/15 hover:bg-[rgba(79,211,238,0.14)]",
                      ].join(" ")}
                    >
                      #{organizer.displayNumber(idx)}
                      {destItem ? " •" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Replace/Cancel — required whenever a move/drop targets an occupied
 * slot, from any input path (drag, touch, or the Move menu above). Neither
 * item is ever lost: Cancel leaves both exactly where they were; Replace
 * only clears the destination item's slot reference. */
export function OrganizeReplaceConfirm({ organizer }: { organizer: SlotOrganizer }) {
  const replaceConfirm = organizer.replaceConfirm;
  if (!replaceConfirm || typeof document === "undefined") return null;
  return createPortal(
    <div
      className="flex items-center justify-center p-4"
      style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, zIndex: 98 }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="vltd-replace-confirm-title"
        className="relative w-full max-w-sm rounded-2xl p-5 ring-1"
        style={{ background: "var(--bg, #060a13)", borderColor: "var(--theme-border)" }}
      >
        <div id="vltd-replace-confirm-title" className="text-sm font-black leading-5">
          This position already contains {replaceConfirm.destTitle}. Replace it?
        </div>
        <p className="mt-2 text-xs leading-5 text-[color:var(--muted)]">
          {replaceConfirm.destTitle} will be removed from this room only — it stays in your vault, unchanged.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={organizer.cancelReplace}
            className="flex-1 rounded-[6px] border py-2.5 text-sm font-black"
            style={{ borderColor: "var(--theme-border)", color: "var(--fg)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={organizer.confirmReplace}
            className="flex-1 rounded-[6px] py-2.5 text-sm font-black"
            style={{ background: "linear-gradient(180deg,#79E7FB,#2CB1D1)", color: "#06171d" }}
          >
            Replace
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
