export type ReportContentType = "gallery" | "item";

export type PublicContentReport = {
  id: string;
  contentType: ReportContentType;
  contentId: string;
  reason: string;
  details?: string;
  pageUrl?: string;
  createdAt: number;
};

const REPORTS_KEY = "vltd_public_content_reports_v1";
const ADULT_CONFIRM_KEY = "vltd_adult_content_confirmed_v1";

function makeId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `report_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function hasConfirmedAdultContent() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(ADULT_CONFIRM_KEY) === "1";
}

export function confirmAdultContent() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ADULT_CONFIRM_KEY, "1");
}

export function readPublicContentReports(): PublicContentReport[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(REPORTS_KEY) || "[]");
    return Array.isArray(parsed) ? (parsed as PublicContentReport[]) : [];
  } catch {
    return [];
  }
}

export function createPublicContentReport(input: Omit<PublicContentReport, "id" | "createdAt" | "pageUrl">) {
  if (typeof window === "undefined") return null;

  const report: PublicContentReport = {
    ...input,
    id: makeId(),
    pageUrl: window.location.href,
    createdAt: Date.now(),
  };

  const next = [report, ...readPublicContentReports()].slice(0, 250);
  window.localStorage.setItem(REPORTS_KEY, JSON.stringify(next));
  return report;
}
