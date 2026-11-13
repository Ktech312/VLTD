"use client";

import { useEffect, useState } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { getStoredActiveProfileId } from "@/lib/auth";
import { readOwnOnlineStatusSetting, saveOwnOnlineStatusSetting } from "@/lib/onlineStatus";

// Account > Preferences > Privacy. Default OFF. The switch is for the profile you are using right now.
export default function OnlineStatusSetting() {
  const [profileId, setProfileId] = useState("");
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const id = getStoredActiveProfileId();
    setProfileId(id);
    if (!id) { setOn(null); return; }
    void readOwnOnlineStatusSetting(id).then((value) => { if (active) setOn(value); });
    return () => { active = false; };
  }, []);

  async function change() {
    if (on === null || busy || !profileId) return;
    const next = !on;
    setBusy(true);
    setMessage("");
    const saved = await saveOwnOnlineStatusSetting(profileId, next);
    setBusy(false);
    if (saved) {
      setOn(next);
      setMessage(next ? "On. Visitors to your public profile can see when you are online." : "Off. Visitors to your public profile see no online or last-active information.");
    } else {
      setMessage("That change could not be saved. It stays as it was. Please try again.");
    }
  }

  const unavailable = on === null;
  return (
    <section className="mt-6 rounded-[6px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.24)]" aria-labelledby="online-status-heading">
      <div id="online-status-heading" className="mb-4 px-1 text-[12px] font-semibold uppercase tracking-[0.34em] text-[color:var(--muted2)]">Privacy</div>
      <div className="flex items-start justify-between gap-4 rounded-[14px] border border-[color:var(--border)] p-4" style={{ background: "var(--theme-card)" }}>
        <div className="flex-1">
          <div className="text-sm font-black text-text-primary">Show when I am online</div>
          <div className="mt-1 text-xs leading-5 text-[color:var(--muted)]">
            {unavailable
              ? "This setting isn't available right now. Your online status stays hidden."
              : "Off by default. When it is on, visitors to your public profile can see whether you are online and when you were last active. When it is off they see nothing."}
          </div>
        </div>
        <Toggle on={Boolean(on)} onChange={() => void change()} disabled={busy || unavailable} ariaLabel="Show when I am online on my public profile" className="mt-0.5" />
      </div>
      <p role="status" aria-live="polite" className="mt-3 min-h-[1.25rem] px-1 text-xs text-[color:var(--muted)]" data-testid="online-status-message">{message}</p>
    </section>
  );
}
