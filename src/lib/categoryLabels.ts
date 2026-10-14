// The Add Item form keeps two values for a category: a stored code ("COLLECTORS_CHOICE") and the name people see
// ("Collectors Choice"). With the default locks the code is kept for the next item and the name is cleared, and the form then
// used the code as the name, so every item after the first showed "COLLECTORS_CHOICE" in the Vault and on its page.
// This turns whatever the form holds into a name people should see.

function codeOf(text: string) {
  return text
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * @param options the category names this universe offers
 * @param label   the name the form holds, if any
 * @param code    the stored code the form holds, if any
 * @returns the name to use, or "" when nothing sensible is known (the caller then falls back to its default)
 */
export function resolveCategoryLabel(options: string[], label?: string | null, code?: string | null): string {
  const name = String(label ?? "").trim();
  if (name) return name;
  const raw = String(code ?? "").trim();
  if (!raw) return "";
  const wanted = codeOf(raw);
  const match = options.find((option) => codeOf(option) === wanted);
  if (match) return match;
  // A stored code is not something to show people; a name someone typed is.
  return /^[A-Z0-9_]+$/.test(raw) ? "" : raw;
}
