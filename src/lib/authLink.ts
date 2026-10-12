"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

// Emailed account links come in two kinds. Links created by the browser's own login client carry a "?code=" (PKCE) and are
// handled by the Supabase client automatically. Links created on the server — password resets, confirmations and invitations
// sent by the app, or created from the dashboard — carry the session in the address after "#" instead. This site's client is set
// to PKCE and rejects those ("Not a valid PKCE flow url"), so the person never got signed in and the page waited forever.
// This reads such a link itself and starts the session with the tokens in it.

export type AuthLinkResult = {
  /** A session was started from the link. */
  signedIn: boolean;
  /** "recovery", "signup", "invite", "magiclink", … as set by Supabase; null when the address held no link. */
  type: string | null;
  /** The link itself was refused (expired, already used). */
  failed: boolean;
};

export async function consumeAuthLinkFromHash(): Promise<AuthLinkResult> {
  if (typeof window === "undefined") return { signedIn: false, type: null, failed: false };

  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const type = hash.get("type");
  if (hash.get("error") || hash.get("error_description")) {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    return { signedIn: false, type, failed: true };
  }

  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (!accessToken || !refreshToken) return { signedIn: false, type: null, failed: false };

  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { signedIn: false, type, failed: true };

  const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  // Tokens must not stay in the address bar or browser history.
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  return { signedIn: !error, type, failed: Boolean(error) };
}
