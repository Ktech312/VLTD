import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export type ReportContentType = "gallery" | "item";

export type PublicContentReportInput = {
  contentType: ReportContentType;
  contentId: string;
  reason: string;
  details?: string;
};

export type PublicContentReportResult = {
  ok: boolean;
  error?: string;
};

const ADULT_CONFIRM_KEY = "vltd_adult_content_confirmed_v1";
const PUBLIC_REPORTS_TABLE = "public_content_reports";

function safeString(value: unknown) {
  return String(value ?? "").trim();
}

function cleanDetails(value: unknown) {
  const next = safeString(value);
  return next.length > 0 ? next.slice(0, 2000) : null;
}

function currentPageUrl() {
  if (typeof window === "undefined") return null;
  return window.location.href;
}

function currentUserAgent() {
  if (typeof navigator === "undefined") return null;
  return navigator.userAgent || null;
}

export function hasConfirmedAdultContent() {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(ADULT_CONFIRM_KEY) === "1";
}

export function confirmAdultContent() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(ADULT_CONFIRM_KEY, "1");
}

export async function createPublicContentReport(
  input: PublicContentReportInput
): Promise<PublicContentReportResult> {
  const contentType = input.contentType;
  const contentId = safeString(input.contentId);
  const reason = safeString(input.reason);

  if (contentType !== "gallery" && contentType !== "item") {
    return { ok: false, error: "Invalid report target." };
  }

  if (!contentId) {
    return { ok: false, error: "Missing report target." };
  }

  if (!reason) {
    return { ok: false, error: "Choose a report reason." };
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return {
      ok: false,
      error: "Reporting is unavailable because the database connection is not configured.",
    };
  }

  let reporterUserId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    reporterUserId = data.user?.id ?? null;
  } catch {
    reporterUserId = null;
  }

  const { error } = await supabase.from(PUBLIC_REPORTS_TABLE).insert({
    content_type: contentType,
    content_id: contentId,
    reason,
    details: cleanDetails(input.details),
    page_url: currentPageUrl(),
    reporter_user_id: reporterUserId,
    user_agent: currentUserAgent(),
    status: "open",
  });

  if (error) {
    return {
      ok: false,
      error: error.message || "Report could not be saved.",
    };
  }

  return { ok: true };
}
