"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getOrCreateConversation } from "@/lib/directMessages";

/** Opens (or starts) a real 1:1 conversation with this profile and jumps
 *  to /messages. Renders nothing on your own profile, same rule as
 *  FollowButton. */
export function MessageButton({
  viewerProfileId,
  targetProfileId,
}: {
  viewerProfileId: string;
  targetProfileId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!targetProfileId || viewerProfileId === targetProfileId) return null;

  async function handleClick() {
    if (!viewerProfileId || busy) return;
    setBusy(true);
    const conversationId = await getOrCreateConversation(viewerProfileId, targetProfileId);
    setBusy(false);
    if (conversationId) router.push("/messages");
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={!viewerProfileId || busy}
      className="vltd-selectable bg-[color:var(--pill)] text-[color:var(--fg)] ring-1 ring-[color:var(--border)] transition"
      style={{
        borderRadius: 999,
        padding: "7px 16px",
        fontSize: 12,
        fontWeight: 700,
        border: "none",
        cursor: viewerProfileId ? "pointer" : "default",
        minHeight: 44,
        opacity: viewerProfileId ? 1 : 0.5,
      }}
    >
      Message
    </button>
  );
}
