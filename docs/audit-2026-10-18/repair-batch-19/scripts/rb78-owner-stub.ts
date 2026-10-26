// Used ONLY by rb78 (see rb78-tsconfig.json): treats the QA account as "the owner" so the full-mode route behaviour can be exercised. Never imported by the app.
export function isOwnerEmail(email?: string | null) {
  return Boolean(process.env.RB78_QA_EMAIL) && String(email ?? "").trim().toLowerCase() === String(process.env.RB78_QA_EMAIL).toLowerCase();
}
