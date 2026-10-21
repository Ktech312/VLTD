// Plain-language checks for the profile fields people type on /account. Onboarding and the business form already clean
// the username with the same limits (3 to 24 characters, letters/numbers/underscores, no leading or trailing underscore).

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;

export function displayNameProblem(value: string): string | null {
  return value.trim().length === 0 ? "Enter a display name." : null;
}

export function usernameProblem(value: string): string | null {
  const name = value.trim();
  if (name.length < USERNAME_MIN) return `Usernames need at least ${USERNAME_MIN} characters.`;
  if (name.length > USERNAME_MAX) return `Usernames can be at most ${USERNAME_MAX} characters.`;
  if (!/^[a-z0-9_]+$/.test(name)) return "Usernames can only use lowercase letters, numbers and underscores.";
  if (/^_|_$/.test(name)) return "Usernames can't start or end with an underscore.";
  return null;
}
