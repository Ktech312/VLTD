"use client";

// VLTD Museum campus admin — EK's ask (2026-09-02): "create a section in
// Admin Tools for this, so that I can control what those options are
// since they will change and i will probably add more as time goes on."
// Controls the Spotlight room's rotating programs, the Store room's
// items, and how many items show per category room. Same shape as
// /admin/spotlights/page.tsx.
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { getMyAdminRole } from "@/lib/adminAuth";
import { DEFAULT_ITEMS_PER_ROOM } from "@/lib/museumCampusConfig";

type SpotlightProgram = {
  id: string;
  title: string;
  description: string;
  is_active: boolean;
  sort_order: number;
};

type StoreItem = {
  id: string;
  name: string;
  description: string;
  image_url: string;
  price_label: string;
  link_url: string;
  enabled: boolean;
  sort_order: number;
};

const EMPTY_PROGRAM: Omit<SpotlightProgram, "id"> = {
  title: "",
  description: "",
  is_active: false,
  sort_order: 0,
};

const EMPTY_STORE_ITEM: Omit<StoreItem, "id"> = {
  name: "",
  description: "",
  image_url: "",
  price_label: "",
  link_url: "",
  enabled: true,
  sort_order: 0,
};

function inputCls() {
  return "w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--fg)] outline-none focus:border-[rgba(203,208,213,0.5)] focus:ring-2 focus:ring-[rgba(203,208,213,0.12)]";
}

export default function AdminMuseumCampusPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const [configId, setConfigId] = useState<string | null>(null);
  const [itemsPerRoom, setItemsPerRoom] = useState(DEFAULT_ITEMS_PER_ROOM);
  const [savingConfig, setSavingConfig] = useState(false);

  const [programs, setPrograms] = useState<SpotlightProgram[]>([]);
  const [programForm, setProgramForm] = useState<Omit<SpotlightProgram, "id">>(EMPTY_PROGRAM);
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [showProgramForm, setShowProgramForm] = useState(false);

  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  const [storeForm, setStoreForm] = useState<Omit<StoreItem, "id">>(EMPTY_STORE_ITEM);
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [showStoreForm, setShowStoreForm] = useState(false);

  useEffect(() => {
    getMyAdminRole().then((role) => setAuthorized(role !== null));
  }, []);

  async function fetchAll() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const [configRes, programsRes, storeRes] = await Promise.all([
      supabase.from("museum_campus_config").select("id, items_per_room").limit(1).maybeSingle(),
      supabase.from("museum_spotlight_programs").select("*").order("sort_order", { ascending: true }),
      supabase.from("museum_store_items").select("*").order("sort_order", { ascending: true }),
    ]);

    if (configRes.error || programsRes.error || storeRes.error) {
      setTableMissing(true);
      return;
    }
    setTableMissing(false);
    if (configRes.data) {
      setConfigId(configRes.data.id);
      setItemsPerRoom(configRes.data.items_per_room ?? DEFAULT_ITEMS_PER_ROOM);
    }
    setPrograms((programsRes.data ?? []) as SpotlightProgram[]);
    setStoreItems((storeRes.data ?? []) as StoreItem[]);
  }

  useEffect(() => {
    if (authorized) void fetchAll();
  }, [authorized]);

  async function saveItemsPerRoom() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !configId) return;
    setSavingConfig(true);
    const { error } = await supabase
      .from("museum_campus_config")
      .update({ items_per_room: itemsPerRoom, updated_at: new Date().toISOString() })
      .eq("id", configId);
    setSavingConfig(false);
    setStatusMsg(error ? "Error: " + error.message : "Saved.");
    setTimeout(() => setStatusMsg(""), 2500);
  }

  function startEditProgram(p: SpotlightProgram) {
    setEditingProgramId(p.id);
    setProgramForm({ title: p.title, description: p.description ?? "", is_active: p.is_active, sort_order: p.sort_order });
    setShowProgramForm(true);
  }
  function startNewProgram() {
    setEditingProgramId(null);
    setProgramForm(EMPTY_PROGRAM);
    setShowProgramForm(true);
  }
  async function saveProgram() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !programForm.title.trim()) return;
    const payload = { ...programForm, updated_at: new Date().toISOString() };
    const { error } = editingProgramId
      ? await supabase.from("museum_spotlight_programs").update(payload).eq("id", editingProgramId)
      : await supabase.from("museum_spotlight_programs").insert(payload);
    if (error) { setStatusMsg("Error: " + error.message); return; }
    setShowProgramForm(false);
    setEditingProgramId(null);
    setProgramForm(EMPTY_PROGRAM);
    void fetchAll();
  }
  async function deleteProgram(id: string) {
    if (!confirm("Delete this spotlight program?")) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.from("museum_spotlight_programs").delete().eq("id", id);
    void fetchAll();
  }

  function startEditStoreItem(s: StoreItem) {
    setEditingStoreId(s.id);
    setStoreForm({
      name: s.name,
      description: s.description ?? "",
      image_url: s.image_url ?? "",
      price_label: s.price_label ?? "",
      link_url: s.link_url ?? "",
      enabled: s.enabled,
      sort_order: s.sort_order,
    });
    setShowStoreForm(true);
  }
  function startNewStoreItem() {
    setEditingStoreId(null);
    setStoreForm(EMPTY_STORE_ITEM);
    setShowStoreForm(true);
  }
  async function saveStoreItem() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !storeForm.name.trim()) return;
    const payload = { ...storeForm, updated_at: new Date().toISOString() };
    const { error } = editingStoreId
      ? await supabase.from("museum_store_items").update(payload).eq("id", editingStoreId)
      : await supabase.from("museum_store_items").insert(payload);
    if (error) { setStatusMsg("Error: " + error.message); return; }
    setShowStoreForm(false);
    setEditingStoreId(null);
    setStoreForm(EMPTY_STORE_ITEM);
    void fetchAll();
  }
  async function deleteStoreItem(id: string) {
    if (!confirm("Delete this store item?")) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.from("museum_store_items").delete().eq("id", id);
    void fetchAll();
  }

  if (authorized === null) {
    return <div className="p-8 text-sm text-[color:var(--muted)]">Checking access…</div>;
  }
  if (!authorized) {
    return <div className="p-8 text-sm text-red-400">Not authorized. Admin access required.</div>;
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6" style={{ background: "var(--bg)" }}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <div className="text-[11px] font-bold uppercase tracking-[0.28em]" style={{ color: "var(--muted2)" }}>Admin</div>
          <h1 className="mt-1 text-2xl font-black" style={{ color: "var(--fg)" }}>VLTD Museum Campus</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Controls for the public museum campus (separate from personal exhibitions): the Spotlight room&apos;s rotating
            programs, the Store room&apos;s items, and how many items show per category room.
          </p>
        </div>

        {tableMissing ? (
          <div className="rounded-[24px] p-5 text-sm" style={{ background: "var(--theme-elevated)", border: "1px solid rgba(224,82,82,0.3)", color: "var(--fg)" }}>
            The backing tables don&apos;t exist yet — run <code>20260902_museum_campus_config.sql</code> in Supabase,
            then reload this page.
          </div>
        ) : (
          <>
            {statusMsg && (
              <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
                {statusMsg}
              </div>
            )}

            {/* Campus settings */}
            <section className="mb-8 rounded-[24px] p-5" style={{ background: "var(--theme-card)", border: "1px solid var(--border)" }}>
              <h2 className="mb-3 text-base font-black" style={{ color: "var(--fg)" }}>Campus settings</h2>
              <label className="block max-w-xs">
                <span className="mb-1 block text-xs font-semibold" style={{ color: "var(--muted)" }}>Items shown per room</span>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    max={40}
                    value={itemsPerRoom}
                    onChange={(e) => setItemsPerRoom(Math.max(1, Number(e.target.value) || 1))}
                    className={inputCls()}
                  />
                  <button
                    type="button"
                    onClick={() => void saveItemsPerRoom()}
                    disabled={savingConfig}
                    className="shrink-0 rounded-xl px-4 text-sm font-black text-[#0B0B0B] transition hover:brightness-110 disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #8C9298, #C8CDD2)" }}
                  >
                    {savingConfig ? "Saving…" : "Save"}
                  </button>
                </div>
              </label>
            </section>

            {/* Spotlight programs */}
            <section className="mb-8 rounded-[24px] p-5" style={{ background: "var(--theme-card)", border: "1px solid var(--border)" }}>
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-black" style={{ color: "var(--fg)" }}>Spotlight programs</h2>
                  <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                    e.g. Artist of the Month, Curator of the Month, Top Liked, Top Sold. Active programs show in the
                    campus Spotlight room.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={startNewProgram}
                  className="shrink-0 rounded-full px-4 py-2 text-xs font-black text-[#0B0B0B] transition hover:brightness-110"
                  style={{ background: "linear-gradient(135deg, #8C9298, #C8CDD2)" }}
                >
                  + Add program
                </button>
              </div>

              {showProgramForm && (
                <div className="mb-4 rounded-[18px] p-4" style={{ background: "var(--theme-elevated)", border: "1px solid rgba(203,208,213,0.25)" }}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block sm:col-span-2">
                      <span className="mb-1 block text-xs font-semibold" style={{ color: "var(--muted)" }}>Title *</span>
                      <input
                        value={programForm.title}
                        onChange={(e) => setProgramForm((f) => ({ ...f, title: e.target.value }))}
                        placeholder="Artist of the Month"
                        className={inputCls()}
                      />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="mb-1 block text-xs font-semibold" style={{ color: "var(--muted)" }}>Description</span>
                      <textarea
                        value={programForm.description}
                        onChange={(e) => setProgramForm((f) => ({ ...f, description: e.target.value }))}
                        rows={2}
                        className={inputCls() + " resize-none"}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold" style={{ color: "var(--muted)" }}>Sort order</span>
                      <input
                        type="number"
                        value={programForm.sort_order}
                        onChange={(e) => setProgramForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
                        className={inputCls()}
                      />
                    </label>
                    <label className="flex items-center gap-2 pt-6">
                      <input
                        type="checkbox"
                        checked={programForm.is_active}
                        onChange={(e) => setProgramForm((f) => ({ ...f, is_active: e.target.checked }))}
                        className="h-4 w-4 accent-amber-500"
                      />
                      <span className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Active</span>
                    </label>
                  </div>
                  <div className="mt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => void saveProgram()}
                      disabled={!programForm.title.trim()}
                      className="rounded-full px-5 py-2 text-sm font-black text-[#0B0B0B] transition hover:brightness-110 disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg, #8C9298, #C8CDD2)" }}
                    >
                      {editingProgramId ? "Update" : "Create"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowProgramForm(false); setEditingProgramId(null); setProgramForm(EMPTY_PROGRAM); }}
                      className="rounded-full border px-5 py-2 text-sm font-semibold transition hover:brightness-110"
                      style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {programs.length === 0 ? (
                <div className="rounded-[16px] py-8 text-center text-sm" style={{ background: "var(--theme-elevated)", color: "var(--muted)" }}>
                  No spotlight programs yet.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {programs.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 rounded-[14px] px-4 py-2.5" style={{ background: "var(--theme-elevated)", border: p.is_active ? "1px solid rgba(203,208,213,0.35)" : "1px solid var(--border)" }}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold truncate" style={{ color: "var(--fg)" }}>{p.title}</span>
                          {p.is_active && <span className="text-[10px] font-bold text-amber-400">● Active</span>}
                        </div>
                        {p.description && <div className="text-xs truncate" style={{ color: "var(--muted)" }}>{p.description}</div>}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button type="button" onClick={() => startEditProgram(p)} className="rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:brightness-110" style={{ background: "var(--theme-card)", color: "var(--fg)", border: "1px solid var(--border)" }}>Edit</button>
                        <button type="button" onClick={() => void deleteProgram(p.id)} className="rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:bg-red-500/15" style={{ color: "#E05252", border: "1px solid rgba(224,82,82,0.25)" }}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Store items */}
            <section className="rounded-[24px] p-5" style={{ background: "var(--theme-card)", border: "1px solid var(--border)" }}>
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-black" style={{ color: "var(--fg)" }}>Store items</h2>
                  <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                    Physical collector products shown in the campus Store room — display cases, storage boxes, etc.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={startNewStoreItem}
                  className="shrink-0 rounded-full px-4 py-2 text-xs font-black text-[#0B0B0B] transition hover:brightness-110"
                  style={{ background: "linear-gradient(135deg, #8C9298, #C8CDD2)" }}
                >
                  + Add item
                </button>
              </div>

              {showStoreForm && (
                <div className="mb-4 rounded-[18px] p-4" style={{ background: "var(--theme-elevated)", border: "1px solid rgba(203,208,213,0.25)" }}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold" style={{ color: "var(--muted)" }}>Name *</span>
                      <input value={storeForm.name} onChange={(e) => setStoreForm((f) => ({ ...f, name: e.target.value }))} className={inputCls()} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold" style={{ color: "var(--muted)" }}>Price label</span>
                      <input value={storeForm.price_label} onChange={(e) => setStoreForm((f) => ({ ...f, price_label: e.target.value }))} placeholder="$49" className={inputCls()} />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="mb-1 block text-xs font-semibold" style={{ color: "var(--muted)" }}>Description</span>
                      <textarea value={storeForm.description} onChange={(e) => setStoreForm((f) => ({ ...f, description: e.target.value }))} rows={2} className={inputCls() + " resize-none"} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold" style={{ color: "var(--muted)" }}>Image URL</span>
                      <input value={storeForm.image_url} onChange={(e) => setStoreForm((f) => ({ ...f, image_url: e.target.value }))} className={inputCls()} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold" style={{ color: "var(--muted)" }}>Link URL</span>
                      <input value={storeForm.link_url} onChange={(e) => setStoreForm((f) => ({ ...f, link_url: e.target.value }))} className={inputCls()} />
                    </label>
                    <label className="flex items-center gap-2 pt-6">
                      <input type="checkbox" checked={storeForm.enabled} onChange={(e) => setStoreForm((f) => ({ ...f, enabled: e.target.checked }))} className="h-4 w-4 accent-amber-500" />
                      <span className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Enabled</span>
                    </label>
                  </div>
                  <div className="mt-4 flex gap-3">
                    <button type="button" onClick={() => void saveStoreItem()} disabled={!storeForm.name.trim()} className="rounded-full px-5 py-2 text-sm font-black text-[#0B0B0B] transition hover:brightness-110 disabled:opacity-50" style={{ background: "linear-gradient(135deg, #8C9298, #C8CDD2)" }}>
                      {editingStoreId ? "Update" : "Create"}
                    </button>
                    <button type="button" onClick={() => { setShowStoreForm(false); setEditingStoreId(null); setStoreForm(EMPTY_STORE_ITEM); }} className="rounded-full border px-5 py-2 text-sm font-semibold transition hover:brightness-110" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {storeItems.length === 0 ? (
                <div className="rounded-[16px] py-8 text-center text-sm" style={{ background: "var(--theme-elevated)", color: "var(--muted)" }}>
                  No store items yet.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {storeItems.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 rounded-[14px] px-4 py-2.5" style={{ background: "var(--theme-elevated)", border: "1px solid var(--border)" }}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold truncate" style={{ color: "var(--fg)" }}>{s.name}</span>
                          {s.price_label && <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>{s.price_label}</span>}
                          {!s.enabled && <span className="text-[10px] text-red-400">disabled</span>}
                        </div>
                        {s.description && <div className="text-xs truncate" style={{ color: "var(--muted)" }}>{s.description}</div>}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button type="button" onClick={() => startEditStoreItem(s)} className="rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:brightness-110" style={{ background: "var(--theme-card)", color: "var(--fg)", border: "1px solid var(--border)" }}>Edit</button>
                        <button type="button" onClick={() => void deleteStoreItem(s.id)} className="rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:bg-red-500/15" style={{ color: "#E05252", border: "1px solid rgba(224,82,82,0.25)" }}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
