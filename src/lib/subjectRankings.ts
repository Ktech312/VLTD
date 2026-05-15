import type { VaultItem } from "@/lib/vaultModel";

export type SubjectRank = {
  subject: string;
  count: number;
  totalValue: number;
};

function isActiveItem(item: VaultItem) {
  return item.status !== "SOLD" && item.status !== "WISHLIST";
}

export function computeSubjectRankings(items: VaultItem[]): SubjectRank[] {
  const map = new Map<string, SubjectRank>();

  for (const item of items) {
    if (!isActiveItem(item)) continue;
    const subject = item.subject?.trim();
    if (!subject) continue;

    const key = subject.toLowerCase();
    const existing = map.get(key);
    const value = Number(item.currentValue ?? 0) || 0;

    if (existing) {
      existing.count += 1;
      existing.totalValue += value;
    } else {
      map.set(key, {
        subject,
        count: 1,
        totalValue: value,
      });
    }
  }

  return [...map.values()].sort((a, b) =>
    b.count !== a.count ? b.count - a.count : b.totalValue - a.totalValue
  );
}

export function subjectCoverage(items: VaultItem[]): { tagged: number; total: number } {
  const active = items.filter(isActiveItem);

  return {
    tagged: active.filter((item) => !!item.subject?.trim()).length,
    total: active.length,
  };
}
