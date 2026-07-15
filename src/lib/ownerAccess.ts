const OWNER_EMAILS = new Set(["eck1679@gmail.com"]);

export function isOwnerEmail(email?: string | null) {
  return OWNER_EMAILS.has(String(email ?? "").trim().toLowerCase());
}
