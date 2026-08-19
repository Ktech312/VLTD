"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { getCurrentUser, getStoredActiveProfileId } from "@/lib/auth";
import {
  listConversations,
  listMessages,
  sendMessage,
  markConversationRead,
  type Conversation,
  type DirectMessage,
} from "@/lib/directMessages";

const CYAN = "#4FD3EE";

function timeAgo(ts: number) {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Avatar({ src, name, size = 40 }: { src: string | null; name: string; size?: number }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-black"
      style={{ width: size, height: size, background: "var(--pill)", color: "var(--muted)", fontSize: size * 0.4 }}
    >
      {(name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function MessagesPage() {
  const [viewerProfileId, setViewerProfileId] = useState<string>("");
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);

  async function refreshConversations(profileId: string) {
    const list = await listConversations(profileId);
    setConversations(list);
    setLoadingList(false);
  }

  useEffect(() => {
    (async () => {
      const { data } = await getCurrentUser();
      if (!data.user) {
        setSignedIn(false);
        setLoadingList(false);
        return;
      }
      setSignedIn(true);
      const profileId = getStoredActiveProfileId() ?? "";
      setViewerProfileId(profileId);
      if (profileId) await refreshConversations(profileId);
      else setLoadingList(false);
    })();
  }, []);

  async function openConversation(id: string) {
    setActiveId(id);
    setLoadingThread(true);
    const thread = await listMessages(id);
    setMessages(thread);
    setLoadingThread(false);
    await markConversationRead(id);
    if (viewerProfileId) void refreshConversations(viewerProfileId);
    setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  async function handleSend() {
    const body = draft.trim();
    if (!body || !activeId || !viewerProfileId || sending) return;
    setSending(true);
    setDraft("");
    const sent = await sendMessage(activeId, viewerProfileId, body);
    if (sent) {
      setMessages((prev) => [...prev, sent]);
      void refreshConversations(viewerProfileId);
      setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
    setSending(false);
  }

  const active = conversations.find((c) => c.id === activeId) ?? null;

  return (
    <>
      <PageHeader title="Messages" description="Direct messages with other collectors." contentClassName="max-w-[1100px]" />
      <main className="mx-auto w-full max-w-[1100px] px-4 pb-16 sm:px-6">
        {signedIn === false ? (
          <div className="rounded-[8px] px-6 py-20 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p className="text-sm" style={{ color: "var(--muted)" }}>Sign in to see your messages.</p>
          </div>
        ) : (
          <div
            className="grid overflow-hidden rounded-[8px] md:grid-cols-[300px_1fr]"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", minHeight: 520 }}
          >
            {/* Conversation list */}
            <div className={`flex flex-col ${activeId ? "hidden md:flex" : "flex"}`} style={{ borderRight: "1px solid var(--border)" }}>
              <div className="overflow-y-auto">
                {loadingList ? (
                  <div className="p-6 text-center text-sm" style={{ color: "var(--muted)" }}>Loading…</div>
                ) : conversations.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 p-8 text-center">
                    <span
                      className="grid h-12 w-12 place-items-center rounded-[10px]"
                      style={{ border: "1px solid rgba(79,211,238,0.4)", color: CYAN, background: "rgba(79,211,238,0.08)" }}
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H8l-4 3V6a1 1 0 0 1 1-1z" />
                      </svg>
                    </span>
                    <p className="text-sm font-bold">No conversations yet</p>
                    <p className="max-w-[220px] text-xs" style={{ color: "var(--muted)" }}>
                      Message another collector from their profile to start one.
                    </p>
                  </div>
                ) : (
                  conversations.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => void openConversation(c.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[color:var(--table-row-hover)]"
                      style={{
                        borderBottom: "1px solid var(--border)",
                        background: c.id === activeId ? "var(--pill)" : "transparent",
                      }}
                    >
                      <Avatar src={c.otherAvatarSrc} name={c.otherName} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-bold">{c.otherName}</span>
                          <span className="shrink-0 text-[10px]" style={{ color: "var(--muted2)" }}>{timeAgo(c.lastMessageAt)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs" style={{ color: "var(--muted)" }}>{c.lastMessagePreview || "No messages yet"}</span>
                          {c.unreadCount > 0 ? (
                            <span
                              className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full px-1 text-[10px] font-black"
                              style={{ background: CYAN, color: "#06171d" }}
                            >
                              {c.unreadCount}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Thread */}
            <div className={`flex flex-col ${activeId ? "flex" : "hidden md:flex"}`}>
              {!active ? (
                <div className="flex flex-1 items-center justify-center p-8 text-center text-sm" style={{ color: "var(--muted)" }}>
                  Select a conversation to start reading.
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                    <button
                      type="button"
                      onClick={() => setActiveId(null)}
                      className="grid h-7 w-7 place-items-center rounded-full md:hidden"
                      style={{ background: "var(--pill)", color: "var(--muted)" }}
                      aria-label="Back"
                    >
                      ←
                    </button>
                    <Avatar src={active.otherAvatarSrc} name={active.otherName} size={28} />
                    <span className="text-sm font-bold">{active.otherName}</span>
                  </div>

                  <div className="flex-1 space-y-3 overflow-y-auto p-4">
                    {loadingThread ? (
                      <div className="text-center text-sm" style={{ color: "var(--muted)" }}>Loading…</div>
                    ) : messages.length === 0 ? (
                      <div className="text-center text-sm" style={{ color: "var(--muted)" }}>
                        No messages yet — say hello.
                      </div>
                    ) : (
                      messages.map((m) => {
                        const mine = m.senderProfileId === viewerProfileId;
                        return (
                          <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                            <div
                              className="max-w-[75%] rounded-[10px] px-3 py-2 text-sm"
                              style={
                                mine
                                  ? { background: CYAN, color: "#06171d" }
                                  : { background: "var(--pill)", color: "var(--fg)" }
                              }
                            >
                              {m.body}
                              <div className="mt-0.5 text-right text-[10px] opacity-60">{timeAgo(m.createdAt)}</div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={threadEndRef} />
                  </div>

                  <div className="flex items-center gap-2 p-3" style={{ borderTop: "1px solid var(--border)" }}>
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value.slice(0, 4000))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void handleSend();
                        }
                      }}
                      placeholder="Write a message…"
                      className="h-10 flex-1 rounded-[7px] bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
                      style={{ color: "var(--fg)" }}
                    />
                    <button
                      type="button"
                      onClick={() => void handleSend()}
                      disabled={!draft.trim() || sending}
                      className="vltd-primary-button inline-flex h-10 items-center rounded-[6px] px-4 text-sm font-black disabled:opacity-50"
                    >
                      Send
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
