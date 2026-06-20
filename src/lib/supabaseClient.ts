import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type BrowserClientGlobal = {
  __vltdSupabaseClient?: SupabaseClient | null;
};

declare global {
  interface Window extends BrowserClientGlobal {}
}

let browserClient: SupabaseClient | null = null;

function createResilientAuthLock() {
  return async <T>(name: string, arg2: unknown, arg3?: unknown): Promise<T> => {
    const fn =
      typeof arg2 === "function"
        ? (arg2 as () => Promise<T>)
        : typeof arg3 === "function"
        ? (arg3 as () => Promise<T>)
        : null;

    if (!fn) {
      throw new Error(`Invalid auth lock callback for ${name}`);
    }

    try {
      return await fn();
    } catch (error: any) {
      const message = String(error?.message ?? "");

      if (
        message.includes("was released because another request stole it") ||
        message.includes("Lock broken by another request with the 'steal' option")
      ) {
        return await fn();
      }

      throw error;
    }
  };
}

function createBrowserClient(): SupabaseClient | null {
  if (typeof window === "undefined") return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      storageKey: "vltd-auth",
      lock: createResilientAuthLock(),
    },
  });
}

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (typeof window === "undefined") return null;

  if (browserClient) return browserClient;

  if (window.__vltdSupabaseClient !== undefined) {
    browserClient = window.__vltdSupabaseClient ?? null;
    return browserClient;
  }

  browserClient = createBrowserClient();
  window.__vltdSupabaseClient = browserClient;

  return browserClient;
}

/**
 * Backward-compatible lazy proxy for older imports:
 * import { supabase } from "@/lib/supabaseClient"
 */
export const supabase = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getSupabaseBrowserClient();
      if (!client) return undefined;

      const value = (client as any)[prop];
      return typeof value === "function" ? value.bind(client) : value;
    },
  }
) as SupabaseClient;