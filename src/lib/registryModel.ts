import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { getVaultImagePublicUrl } from "@/lib/vaultCloud";

export type RegistrySubject = {
  subject: string;
  collectorCount: number;
  itemCount: number;
  topProfileId: string | null;
  topDisplayName: string;
  topAvatarEmoji: string;
  topItemCount: number;
};

export type LeaderboardEntry = {
  rank: number;
  profileId: string;
  displayName: string;
  avatarEmoji: string;
  bio?: string;
  itemCount: number;
  totalValue: number;
  sampleItems: SampleItem[];
};

export type SampleItem = {
  id: string;
  title: string;
  imageUrl: string;
  currentValue?: number;
  grade?: string;
};

function toSampleItem(raw: Record<string, unknown>): SampleItem {
  const storageKey = String(raw.image_front_storage_path ?? "");
  const directUrl = String(raw.image_front_url ?? "");
  const imageUrl = directUrl || (storageKey ? getVaultImagePublicUrl(storageKey) : "");
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? ""),
    imageUrl,
    currentValue: raw.current_value ? Number(raw.current_value) : undefined,
    grade: raw.grade ? String(raw.grade) : undefined,
  };
}

export async function fetchRegistrySubjects(): Promise<RegistrySubject[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_registry_subjects");
  if (error) { console.error("registry subjects:", error); return []; }
  return (data ?? []).map((row: Record<string, unknown>) => ({
    subject: String(row.subject ?? ""),
    collectorCount: Number(row.collector_count ?? 0),
    itemCount: Number(row.item_count ?? 0),
    topProfileId: row.top_profile_id ? String(row.top_profile_id) : null,
    topDisplayName: String(row.top_display_name ?? "Collector"),
    topAvatarEmoji: String(row.top_avatar_emoji ?? "🗝️"),
    topItemCount: Number(row.top_item_count ?? 0),
  }));
}

export async function fetchSubjectLeaderboard(subject: string): Promise<LeaderboardEntry[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_subject_leaderboard", { subject_name: subject });
  if (error) { console.error("subject leaderboard:", error); return []; }
  return (data ?? []).map((row: Record<string, unknown>, i: number) => {
    const rawItems = Array.isArray(row.sample_items) ? row.sample_items : [];
    return {
      rank: i + 1,
      profileId: String(row.profile_id ?? ""),
      displayName: String(row.display_name ?? "Collector"),
      avatarEmoji: String(row.avatar_emoji ?? "🗝️"),
      bio: row.bio ? String(row.bio) : undefined,
      itemCount: Number(row.item_count ?? 0),
      totalValue: Number(row.total_value ?? 0),
      sampleItems: rawItems.slice(0, 5).map(toSampleItem),
    };
  });
}
