// Path: src/lib/vaultDocuments.ts
// Documents (certificates, receipts, IDs) -- private by design, in a
// dedicated PRIVATE Supabase Storage bucket (vault-documents), unlike every
// other file bucket in this app (vault-images, avatars, vault-videos), which
// are public. Nothing here ever gets a permanent public URL: viewing your
// own document uses a short-lived signed link, and sharing one with someone
// else (an insurer, a buyer) is a deliberate action that creates its own
// longer-lived signed link -- never on by default.
//
// Needs a real signed-in profile; there's no local/offline fallback the way
// some other features have one, since "private" is the entire point.
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { getStoredActiveProfileId } from "@/lib/auth";

export type VaultDocument = {
  id: string;
  name: string;
  storagePath: string;
  contentType: string;
  addedAt: number;
};

const BUCKET = "vault-documents";
// Just long enough to open a signed link in a new tab / image viewer.
const VIEW_URL_TTL_SECONDS = 60 * 10;
// A real "hand this to someone else" link -- long enough to be useful (an
// email, a buyer's inbox) without being permanent like every other file URL
// in this app.
const SHARE_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

export async function listDocuments(itemId: string): Promise<VaultDocument[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("vault_documents")
    .select("id, name, storage_path, content_type, added_at")
    .eq("item_id", itemId)
    .order("added_at", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    storagePath: row.storage_path as string,
    contentType: (row.content_type as string) || "application/octet-stream",
    addedAt: new Date(row.added_at as string).getTime(),
  }));
}

export async function addDocument(itemId: string, file: File): Promise<VaultDocument> {
  const supabase = getSupabaseBrowserClient();
  const profileId = getStoredActiveProfileId();
  if (!supabase) throw new Error("Not signed in — documents need a real account to store privately.");
  if (!profileId) throw new Error("No active profile.");

  const { data: userData } = await supabase.auth.getUser();
  const authUid = userData.user?.id;
  if (!authUid) throw new Error("Not signed in.");

  const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const storagePath = `${authUid}/${itemId}/${id}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, { upsert: false });
  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase.from("vault_documents").insert({
    id,
    profile_id: profileId,
    item_id: itemId,
    storage_path: storagePath,
    name: file.name || "Document",
    content_type: file.type || "application/octet-stream",
  });
  if (insertError) {
    // Metadata row failed -- don't leave an orphaned file with nothing
    // pointing at it.
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
    throw insertError;
  }

  return {
    id,
    name: file.name || "Document",
    storagePath,
    contentType: file.type || "application/octet-stream",
    addedAt: Date.now(),
  };
}

export async function removeDocument(doc: VaultDocument) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  await supabase.storage.from(BUCKET).remove([doc.storagePath]).catch(() => {});
  await supabase.from("vault_documents").delete().eq("id", doc.id);
}

/** Short-lived link for viewing your own document inside the app. */
export async function getDocumentViewUrl(doc: VaultDocument): Promise<string | undefined> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return undefined;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.storagePath, VIEW_URL_TTL_SECONDS);
  if (error || !data) return undefined;
  return data.signedUrl;
}

/** A real, deliberate "share this one document" action -- generates a
 *  longer-lived signed link the owner can copy and hand to someone else.
 *  Never happens automatically; the owner has to tap Share. */
export async function shareDocument(doc: VaultDocument): Promise<string | undefined> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return undefined;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.storagePath, SHARE_URL_TTL_SECONDS);
  if (error || !data) return undefined;
  return data.signedUrl;
}
