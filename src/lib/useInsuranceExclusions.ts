"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  EXCLUSIONS_CHANGED_EVENT,
  excludedByYouWhere,
  exclusionsMode,
  legacyAdoptionPending,
  exclusionsNoteFor,
  pendingExclusionCount,
  readInsuranceExcludedIds,
  setInsuranceExcludedIds,
  syncInsuranceExclusions,
  type ExclusionsMode,
} from "@/lib/insuranceExclusions";

/**
 * The active profile's insurance exclusions for a page: this device's copy at once, then the account's list. `note` says where they live ("" when they follow the
 * account); `where` is the wording for "excluded by you ..." in the not-counted line. `setExcluded` changes the list and waits for the account's answer.
 */
export function useInsuranceExclusions(): {
  excluded: Set<string>;
  mode: ExclusionsMode;
  ready: boolean;
  note: string;
  where: "device" | "account";
  setExcluded: (next: Set<string>) => Promise<void>;
} {
  const [excluded, setExcludedState] = useState<Set<string>>(() => new Set());
  const [mode, setMode] = useState<ExclusionsMode>("unknown");
  const [pending, setPending] = useState(0);
  const [ready, setReady] = useState(false);
  const alive = useRef(true);

  const refreshFromDevice = useCallback(() => {
    if (!alive.current) return;
    setExcludedState(readInsuranceExcludedIds());
    setMode(exclusionsMode());
    setPending(pendingExclusionCount());
  }, []);

  useEffect(() => {
    alive.current = true;
    refreshFromDevice();
    // A stalled connection must not leave a page waiting: after 8 seconds the device's copy stands (and the note says so).
    const giveUp = window.setTimeout(() => { if (alive.current) setReady(true); }, 8000);
    void syncInsuranceExclusions()
      .then((result) => {
        if (!alive.current) return;
        setExcludedState(result.ids);
        setMode(result.mode);
        setPending(result.pending);
      })
      .catch(() => undefined)
      .finally(() => { window.clearTimeout(giveUp); if (alive.current) setReady(true); });
    const onChanged = () => refreshFromDevice();
    // When the profile's items arrive from the account, an older on-device list can finally be matched to them and copied up.
    const onItems = () => {
      if (!legacyAdoptionPending()) return;
      void syncInsuranceExclusions().then((result) => {
        if (!alive.current) return;
        setExcludedState(result.ids);
        setMode(result.mode);
        setPending(result.pending);
      }).catch(() => undefined);
    };
    window.addEventListener("vltd:vault-updated", onItems);
    window.addEventListener(EXCLUSIONS_CHANGED_EVENT, onChanged);
    window.addEventListener("vltd:active-profile", onChanged);
    return () => {
      alive.current = false;
      window.clearTimeout(giveUp);
      window.removeEventListener("vltd:vault-updated", onItems);
      window.removeEventListener(EXCLUSIONS_CHANGED_EVENT, onChanged);
      window.removeEventListener("vltd:active-profile", onChanged);
    };
  }, [refreshFromDevice]);

  const setExcluded = useCallback(async (next: Set<string>) => {
    setExcludedState(new Set(next));
    const result = await setInsuranceExcludedIds(next);
    if (!alive.current) return;
    setMode(result.mode);
    setPending(result.pending);
  }, []);

  return { excluded, mode, ready, note: ready ? exclusionsNoteFor(mode, pending) : "", where: excludedByYouWhere(mode), setExcluded };
}
