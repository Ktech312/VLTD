"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { getCurrentUser, getStoredActiveProfileId } from "@/lib/auth";
import {
  listConversations,
  listMessages,
  sendMessage,
  markConversationRead,
  getOrCreateConversation,
  setConversationStarred,
  hideConversation,
  searchCollectors,
  type Conversation,
  type DirectMessage,
  type CollectorResult,
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

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? CYAN : "none"} stroke={filled ? CYAN : "currentColor"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.5l2.9 6.6 7.1.7-5.4 4.8 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.8l7.1-.7z" />
    </svg>
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
  const [composing, setComposing] = useState(false);
  const [composeQuery, setComposeQuery] = useState("");
  const [composeResults, setComposeResults] = useState<CollectorResult[]>([]);
  const [composeSearching, setComposeSearching] = useState(false);
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

  // Debounced collector search inside the compose panel.
  useEffect(() => {
    if (!composing) return;
    const query = composeQuery.trim();
    if (query.length < 2) {
      setComposeResults([]);
      return;
    }
    setComposeSearching(true);
    const timer = setTimeout(async () => {
      const results = await searchCollectors(query, viewerProfileId);
      setComposeResults(results);
      setComposeSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [composeQuery, composing, viewerProfileId]);

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

  async function handleStartConversation(otherProfileId: string) {
    const conversationId = await getOrCreateConversation(otherProfileId);
    setComposing(false);
    setComposeQuery("");
    setComposeResults([]);
    if (conversationId) {
      if (viewerProfileId) await refreshConversations(viewerProfileId);
      await openConversation(conversationId);
    }
  }

  async function handleToggleStar(e: MouseEvent, c: Conversation) {
    e.stopPropagation();
    if (!viewerProfileId) return;
    setConversations((prev) => prev.map((x) => (x.id === c.id ? { ...x, starred: !x.starred } : x)).sort((a, b) => Number(b.starred) - Number(a.starred)));
    await setConversationStarred(viewerProfileId, c.id, !c.starred);
  }

  async function handleHide(e: MouseEvent, c: Conversation) {
    e.stopPropagation();
    if (!viewerProfileId) return;
    setConversations((prev) => prev.filter((x) => x.id !== c.id));
    if (activeId === c.id) setActiveId(null);
    await hideConversation(viewerProfileId, c.id);
  }

  const active = conversations.find((c) => c.id === activeId) ?? null;

  return (
    <>
      <PageHeader
        title="Messages"
        description="Direct messages with other collectors."
        contentClassName="max-w-[1100px]"
        actions={
          signedIn ? (
            <button
              type="button"
              onClick={() => setComposing(true)}
              className="vltd-primary-button inline-flex items-center gap-2 rounded-[6px] px-4 py-2.5 text-sm font-black"
            >
              + New Message
            </button>
          ) : undefined
        }
      />
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
                      Tap "New Message" above, or message another collector from their profile.
                    </p>
                  </div>
                ) : (
                  conversations.map((c) => (
                    <div
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => void openConversation(c.id)}
                      onKeyDown={(e) => e.key === "Enter" && void openConversation(c.id)}
                      className="group flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition hover:bg-[color:var(--table-row-hover)]"
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
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => void handleToggleStar(e, c)}
                          aria-label={c.starred ? "Unstar" : "Star"}
                          className="grid h-7 w-7 place-items-center rounded-full opacity-0 transition group-hover:opacity-100"
                          style={{ opacity: c.starred ? 1 : undefined, color: "var(--muted)" }}
                        >
                          <StarIcon filled={c.starred} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => void handleHide(e, c)}
                          aria-label="Remove from inbox"
                          className="grid h-7 w-7 place-items-center rounded-full opacity-0 transition hover:bg-[color:var(--pill)] group-hover:opacity-100"
                          style={{ color: "var(--muted)" }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </div>
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

      {/* Compose / start-a-new-conversation panel */}
      {composing ? (
        <div
          className="fixed inset-0 z-[1000] flex items-start justify-center bg-black/60 px-4 pt-24 backdrop-blur-sm"
          onClick={() => setComposing(false)}
        >
          <div
            className="w-full max-w-[440px] rounded-[10px] p-5"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-black">New Message</h2>
              <button type="button" onClick={() => setComposing(false)} aria-label="Close" className="grid h-7 w-7 place-items-center rounded-full" style={{ background: "var(--pill)", color: "var(--muted)" }}>✕</button>
            </div>
            <input
              autoFocus
              value={composeQuery}
              onChange={(e) => setComposeQuery(e.target.value)}
              placeholder="Search collectors by name…"
              className="mt-3 h-10 w-full rounded-[7px] bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
              style={{ color: "var(--fg)" }}
            />
            <div className="mt-3 max-h-[280px] overflow-y-auto">
              {composeSearching ? (
                <div className="py-6 text-center text-xs" style={{ color: "var(--muted)" }}>Searching…</div>
              ) : composeQuery.trim().length < 2 ? (
                <div className="py-6 text-center text-xs" style={{ color: "var(--muted)" }}>Type at least 2 characters.</div>
              ) : composeResults.length === 0 ? (
                <div className="py-6 text-center text-xs" style={{ color: "var(--muted)" }}>No collectors found.</div>
              ) : (
                composeResults.map((r) => (
                  <button
                    key={r.profileId}
                    type="button"
                    onClick={() => void handleStartConversation(r.profileId)}
                    className="flex w-full items-center gap-3 rounded-[7px] px-2 py-2 text-left transition hover:bg-[color:var(--pill)]"
                  >
                    <Avatar src={r.avatarSrc} name={r.name} size={32} />
                    <span className="text-sm font-bold">{r.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
