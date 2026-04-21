import type { VaultItem } from "@/lib/vaultModel";

export type DuplicateCandidate = {
  item: VaultItem;
  score: number;
  reasons: string[];
};

function normalizeText(value?: string | null) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value?: string | null) {
  return new Set(
    normalizeText(value)
      .split(" ")
      .filter(Boolean)
  );
}

function overlapScore(a: Set<string>, b: Set<string>) {
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) overlap += 1;
  }

  return overlap / Math.max(a.size, b.size);
}

export function findDuplicateCandidates(
  candidate: Partial<VaultItem>,
  existingItems: VaultItem[],
  options?: { limit?: number; minimumScore?: number }
) {
  const limit = options?.limit ?? 5;
  const minimumScore = options?.minimumScore ?? 0.55;

  const targetTitle = normalizeText(candidate.title);
  const targetTokens = tokenSet(candidate.title);
  const targetNumber = normalizeText(candidate.number);
  const targetCert = normalizeText(candidate.certNumber);

  return existingItems
    .map<DuplicateCandidate | null>((item) => {
      const reasons: string[] = [];
      let score = 0;

      const itemTitle = normalizeText(item.title);
      if (targetTitle && itemTitle === targetTitle) {
        score += 0.65;
        reasons.push("Exact title match");
      } else {
        const titleOverlap = overlapScore(targetTokens, tokenSet(item.title));
        if (titleOverlap > 0) {
          score += titleOverlap * 0.45;
          if (titleOverlap >= 0.6) reasons.push("Strong title overlap");
        }
      }

      if (targetNumber && normalizeText(item.number) === targetNumber) {
        score += 0.2;
        reasons.push("Same item number");
      }

      if (targetCert && normalizeText(item.certNumber) === targetCert) {
        score += 0.35;
        reasons.push("Same cert number");
      }

      if (!reasons.length || score < minimumScore) return null;

      return {
        item,
        score: Math.min(1, score),
        reasons,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0))
    .slice(0, limit) as DuplicateCandidate[];
}

export function buildDuplicateWarning(
  candidate: Partial<VaultItem>,
  existingItems: VaultItem[]
) {
  const matches = findDuplicateCandidates(candidate, existingItems, {
    limit: 3,
    minimumScore: 0.6,
  });

  if (matches.length === 0) return "";

  const top = matches[0];
  return `Possible duplicate: ${top.item.title} (${top.reasons.join(", ")})`;
}
