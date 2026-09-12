"use client";

// The real per-room editor, launched from the Gallery Builder Map's edit
// badge (2026-09-12, EK's correction — this used to be a separate "SPORTS
// items" page under Admin Tools, which "should have never been there...
// it should work here"). Lets an admin edit a room's display title/
// description (museum_room_meta, optional override — a room with none
// keeps its normal static label) and curate its real items
// (museum_room_items, the same table SPORTS's museum display already
// reads from). Only ever rendered for an admin — MuseumCampusOverview's
// edit badge only exists on the already admin-gated Map.
import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import {
  getAllRoomItems,
  getItemsPerRoom,
  getRoomMeta,
  setRoomBackground,
  type MuseumRoomItem,
} from "@/lib/museumCampusConfig";
import { EDITABLE_ROOM_IDS } from "@/lib/campusLayout";
import { ROOM_BACKGROUND_OPTIONS } from "@/lib/campusRoomBuilder";

type ItemForm = { title: string; image_url: string; enabled: boolean; sort_order: number };
const EMPTY_ITEM_FORM: ItemForm = { title: "", image_url: "", enabled: true, sort_order: 0 };

function fieldCls() {
  return "h-9 w-full rounded-[6px] bg-black/30 px-2.5 text-sm text-white ring-1 ring-white/15 outline-none focus-visible:ring-2 focus-visible:ring-[#79e7fb]";
}

export default function RoomEditorModal({
  roomId,
  roomLabel,
  onClose,
  onMetaSaved,
}: {
  roomId: string;
  roomLabel: string;
  onClose: () => void;
  /** Lets the Map refresh its own title override immediately after a save,
   *  without needing its own separate poll. */
  onMetaSaved?: (roomId: string, title: string | null) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [metaSaveState, setMetaSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [items, setItems] = useState<MuseumRoomItem[]>([]);
  const [itemForm, setItemForm] = useState<ItemForm>(EMPTY_ITEM_FORM);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showItemForm, setShowItemForm] = useState(false);
  const [itemError, setItemError] = useState("");

  // Shared Museum Room Editor pass (2026-09-12): capacity (for the "N / cap"
  // display) and the room's saved background choice.
  const [capacity, setCapacity] = useState(8);
  const [backgroundId, setBackgroundId] = useState<string | null>(null);
  const [backgroundSaveState, setBackgroundSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const isEditableRoom = (EDITABLE_ROOM_IDS as string[]).includes(roomId);
  const enabledCount = items.filter((item) => item.enabled).length;

  async function fetchAll() {
    const [meta, roomItems, itemsPerRoom] = await Promise.all([getRoomMeta(roomId), getAllRoomItems(roomId), getItemsPerRoom()]);
    setTitle(meta?.title ?? "");
    setDescription(meta?.description ?? "");
    setBackgroundId(meta?.background_id ?? null);
    setItems(roomItems);
    setCapacity(itemsPerRoom);
    setLoading(false);
  }

  async function saveBackground(nextId: string | null) {
    setBackgroundSaveState("saving");
    const result = await setRoomBackground(roomId, nextId);
    if (result.ok) {
      setBackgroundId(nextId);
      setBackgroundSaveState("saved");
      window.setTimeout(() => setBackgroundSaveState((s) => (s === "saved" ? "idle" : s)), 1800);
    } else {
      setBackgroundSaveState("error");
    }
  }

  useEffect(() => {
    void fetchAll();
    // Deliberately room-id-only — a fresh load each time a different room's
    // editor opens, not on every keystroke below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  async function saveMeta() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setMetaSaveState("saving");
    const trimmedTitle = title.trim() || null;
    const { error } = await supabase.from("museum_room_meta").upsert({
      room_id: roomId,
      title: trimmedTitle,
      description: description.trim() || null,
      updated_at: new Date().toISOString(),
    });
    setMetaSaveState(error ? "error" : "saved");
    if (!error) {
      onMetaSaved?.(roomId, trimmedTitle);
      window.setTimeout(() => setMetaSaveState((current) => (current === "saved" ? "idle" : current)), 1800);
    }
  }

  function startNewItem() {
    setEditingItemId(null);
    setItemForm(EMPTY_ITEM_FORM);
    setShowItemForm(true);
  }
  function startEditItem(item: MuseumRoomItem) {
    setEditingItemId(item.id);
    setItemForm({ title: item.title, image_url: item.image_url, enabled: item.enabled, sort_order: item.sort_order });
    setShowItemForm(true);
  }
  async function saveItem() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !itemForm.title.trim() || !itemForm.image_url.trim()) return;
    const payload = { ...itemForm, room_id: roomId, updated_at: new Date().toISOString() };
    const { error } = editingItemId
      ? await supabase.from("museum_room_items").update(payload).eq("id", editingItemId)
      : await supabase.from("museum_room_items").insert(payload);
    if (error) {
      setItemError(error.message);
      return;
    }
    setItemError("");
    setShowItemForm(false);
    setEditingItemId(null);
    setItemForm(EMPTY_ITEM_FORM);
    void fetchAll();
  }
  async function deleteItem(id: string) {
    if (!confirm("Delete this item? It will no longer show in the museum.")) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.from("museum_room_items").delete().eq("id", id);
    void fetchAll();
  }
  async function toggleEnabled(item: MuseumRoomItem) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.from("museum_room_items").update({ enabled: !item.enabled }).eq("id", item.id);
    void fetchAll();
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Edit ${roomLabel}`}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[16px] bg-[#14171d] p-5 text-white ring-1 ring-white/12"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-black uppercase tracking-[0.08em]">Edit {roomLabel}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.1em] transition hover:bg-white/20"
          >
            Close
          </button>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-white/50">Loading…</div>
        ) : (
          <>
            <section className="mb-5 rounded-[10px] bg-white/[0.04] p-3.5 ring-1 ring-white/10">
              <div className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/50">Room display</div>
              <label className="mb-2 block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-white/45">Title</span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={roomLabel} className={fieldCls()} />
              </label>
              <label className="mb-2 block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-white/45">Description</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-[6px] bg-black/30 px-2.5 py-2 text-sm text-white ring-1 ring-white/15 outline-none focus-visible:ring-2 focus-visible:ring-[#79e7fb]"
                />
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void saveMeta()}
                  className="rounded-[6px] bg-[#4FD3EE] px-3 py-1.5 text-xs font-black uppercase tracking-[0.1em] text-[#06171d] transition hover:brightness-110"
                >
                  {metaSaveState === "saving" ? "Saving…" : "Save"}
                </button>
                {metaSaveState === "saved" ? <span className="text-xs font-semibold text-emerald-300">Saved.</span> : null}
                {metaSaveState === "error" ? <span className="text-xs font-semibold text-red-300">Couldn&apos;t save — try again.</span> : null}
              </div>
            </section>

            {isEditableRoom ? (
              <section className="mb-5 rounded-[10px] bg-white/[0.04] p-3.5 ring-1 ring-white/10">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-white/50">Placement</div>
                  <span className="text-xs font-bold text-white/70">{enabledCount} / {capacity} placed</span>
                </div>
                <div className="mb-3 flex flex-wrap gap-2">
                  <Link
                    href={`/museum/vltd?edit=${roomId}`}
                    target="_blank"
                    className="rounded-[6px] bg-[#4FD3EE] px-3 py-1.5 text-xs font-black uppercase tracking-[0.1em] text-[#06171d] transition hover:brightness-110"
                  >
                    Add Items / Edit Room
                  </Link>
                  <Link
                    href={`/museum/vltd?room=${roomId}`}
                    target="_blank"
                    className="rounded-[6px] bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.1em] text-white transition hover:bg-white/20"
                  >
                    Enter Museum
                  </Link>
                </div>

                <div className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/50">Background</div>
                <div className="mb-2 flex flex-wrap gap-2">
                  {ROOM_BACKGROUND_OPTIONS.map((option) => {
                    const active = (backgroundId ?? "neutral") === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => void saveBackground(option.id === "neutral" ? null : option.id)}
                        aria-pressed={active}
                        className={[
                          "flex items-center gap-1.5 rounded-[6px] px-2.5 py-1.5 text-[10px] font-bold ring-1 transition",
                          active ? "bg-white/15 text-white ring-[#79e7fb]" : "bg-black/25 text-white/70 ring-white/10 hover:bg-white/10",
                        ].join(" ")}
                      >
                        <span className="h-3 w-3 rounded-full ring-1 ring-white/30" style={{ background: option.swatch }} />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                {backgroundSaveState === "saving" ? <span className="text-xs font-semibold text-cyan-200">Saving…</span> : null}
                {backgroundSaveState === "saved" ? <span className="text-xs font-semibold text-emerald-300">Saved.</span> : null}
                {backgroundSaveState === "error" ? <span className="text-xs font-semibold text-red-300">Couldn&apos;t save — try again.</span> : null}
              </section>
            ) : null}

            <section className="rounded-[10px] bg-white/[0.04] p-3.5 ring-1 ring-white/10">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-white/50">Items</div>
                {isEditableRoom ? (
                  <span className="text-[10px] font-semibold text-white/45">Managed from the 3D editor above</span>
                ) : (
                  <button
                    type="button"
                    onClick={startNewItem}
                    className="rounded-[6px] bg-white/10 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] transition hover:bg-white/20"
                  >
                    + Add item
                  </button>
                )}
              </div>

              {itemError ? <div className="mb-2 rounded-[6px] bg-red-500/15 px-2.5 py-1.5 text-xs text-red-300">{itemError}</div> : null}

              {showItemForm ? (
                <div className="mb-3 rounded-[8px] bg-black/25 p-3 ring-1 ring-white/10">
                  <label className="mb-2 block">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-white/45">Title *</span>
                    <input value={itemForm.title} onChange={(event) => setItemForm((f) => ({ ...f, title: event.target.value }))} className={fieldCls()} />
                  </label>
                  <label className="mb-2 block">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-white/45">Image URL *</span>
                    <input value={itemForm.image_url} onChange={(event) => setItemForm((f) => ({ ...f, image_url: event.target.value }))} className={fieldCls()} />
                  </label>
                  <div className="mb-2 flex items-center gap-3">
                    <label className="flex-1">
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-white/45">Sort order</span>
                      <input
                        type="number"
                        value={itemForm.sort_order}
                        onChange={(event) => setItemForm((f) => ({ ...f, sort_order: Number(event.target.value) }))}
                        className={fieldCls()}
                      />
                    </label>
                    <label className="flex items-center gap-2 pt-4">
                      <input
                        type="checkbox"
                        checked={itemForm.enabled}
                        onChange={(event) => setItemForm((f) => ({ ...f, enabled: event.target.checked }))}
                        className="h-4 w-4 accent-[#4FD3EE]"
                      />
                      <span className="text-xs font-semibold">Enabled</span>
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void saveItem()}
                      disabled={!itemForm.title.trim() || !itemForm.image_url.trim()}
                      className="rounded-[6px] bg-[#4FD3EE] px-3 py-1.5 text-xs font-black uppercase tracking-[0.1em] text-[#06171d] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {editingItemId ? "Update" : "Create"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowItemForm(false); setEditingItemId(null); setItemForm(EMPTY_ITEM_FORM); setItemError(""); }}
                      className="rounded-[6px] bg-white/10 px-3 py-1.5 text-xs font-semibold transition hover:bg-white/20"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              {items.length === 0 ? (
                <div className="rounded-[8px] bg-black/20 py-6 text-center text-xs text-white/45">No items yet.</div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 rounded-[8px] bg-black/20 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{item.title}</span>
                        <span className="text-[10px] text-white/40">order {item.sort_order}{!item.enabled ? " · disabled" : ""}</span>
                      </div>
                      <button type="button" onClick={() => void toggleEnabled(item)} className="shrink-0 rounded-[5px] bg-white/10 px-2 py-1 text-[10px] font-bold transition hover:bg-white/20">
                        {item.enabled ? "Disable" : "Enable"}
                      </button>
                      <button type="button" onClick={() => startEditItem(item)} className="shrink-0 rounded-[5px] bg-white/10 px-2 py-1 text-[10px] font-bold transition hover:bg-white/20">
                        Edit
                      </button>
                      <button type="button" onClick={() => void deleteItem(item.id)} className="shrink-0 rounded-[5px] bg-red-500/20 px-2 py-1 text-[10px] font-bold text-red-300 transition hover:bg-red-500/30">
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
