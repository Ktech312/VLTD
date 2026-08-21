"use client";

import { useEffect } from "react";

import { getCurrentUser, getStoredActiveProfileId, initAuthListener, onAuthStateChange } from "@/lib/auth";
import { syncPublicProfile } from "@/lib/publicProfile";

// Invisible: syncs the active profile into public_profiles once per sign-in,
// on every page -- not just the home dashboard and /account (where
// syncPublicProfile was previously only called from). An account that only
// ever visited a deep-linked page (e.g. straight to /vault/add) used to stay
// permanently invisible to collector search since it never got indexed.
export default function PublicProfileSync() {
  useEffect(() => {
    initAuthListener();

    async function sync() {
      const { data } = await getCurrentUser();
      if (!data.user) return;
      const profileId = getStoredActiveProfileId();
      if (profileId) void syncPublicProfile(profileId);
    }

    void sync();
    const { data: sub } = onAuthStateChange(() => void sync());
    // Switching between a multi-profile account's own profiles (personal/
    // business) doesn't fire an auth event -- it's a local storage write,
    // see setStoredActiveProfileId in src/lib/auth.ts -- so the newly
    // active profile needs its own sync too.
    function onProfileSwitch() {
      void sync();
    }
    window.addEventListener("vltd:active-profile", onProfileSwitch);
    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener("vltd:active-profile", onProfileSwitch);
    };
  }, []);

  return null;
}
