"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { PillButton } from "@/components/ui/PillButton";
import { getStoredActiveProfileId } from "@/lib/auth";
import {
  getClub,
  getMyMembership,
  joinClub,
  leaveClub,
  listClubMembers,
  removeClubMember,
  setClubModerator,
  listClubPosts,
  addClubPost,
  hideClubPost,
  reportClubPost,
  listClubReports,
  resolveClubReport,
  getClubIntegrations,
  saveClubIntegrations,
  type Club,
  type ClubMember,
  type ClubPost,
  type ClubReport,
  type ClubRole,
} from "@/lib/clubs";

function timeAgo(ts: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function ClubDetailPage() {
  const params = useParams();
  const clubId = String(params?.clubId ?? "");

  const [profileId, setProfileId] = useState("");
  const [club, setClub] = useState<Club | null>(null);
  const [myRole, setMyRole] = useState<ClubRole | null>(null);
  const [posts, setPosts] = useState<ClubPost[] | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [reports, setReports] = useState<ClubReport[]>([]);
  const [tab, setTab] = useState<"discussion" | "members" | "moderation" | "settings">("discussion");

  const [composerBody, setComposerBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [joining, setJoining] = useState(false);
  const [message, setMessage] = useState("");

  const [discordWebhookUrl, setDiscordWebhookUrl] = useState("");
  const [redditSubreddit, setRedditSubreddit] = useState("");
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");
  const [savingIntegrations, setSavingIntegrations] = useState(false);

  const isStaff = myRole === "owner" || myRole === "moderator";
  const isOwner = myRole === "owner";

  const refresh = useCallback(async () => {
    if (!clubId) return;
    const [c, p] = await Promise.all([getClub(clubId), listClubPosts(clubId)]);
    setClub(c);
    setPosts(p);
    const pid = getStoredActiveProfileId();
    setProfileId(pid);
    if (pid) setMyRole(await getMyMembership(clubId, pid));
  }, [clubId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (tab === "members" && clubId) void listClubMembers(clubId).then(setMembers);
    if (tab === "moderation" && clubId && isStaff) void listClubReports(clubId).then(setReports);
    if (tab === "settings" && clubId && isOwner) void getClubIntegrations(clubId).then((i) => {
      setDiscordWebhookUrl(i.discordWebhookUrl);
      setRedditSubreddit(i.redditSubreddit);
      setTelegramBotToken(i.telegramBotToken);
      setTelegramChatId(i.telegramChatId);
      setSlackWebhookUrl(i.slackWebhookUrl);
    });
  }, [tab, clubId, isStaff, isOwner]);

  async function handleJoinToggle() {
    if (!clubId) return;
    setJoining(true);
    try {
      if (myRole) {
        const ok = await leaveClub(clubId);
        if (ok) setMyRole(null);
        else setMessage("Couldn't leave — the owner has to delete the club instead of leaving it.");
      } else {
        const ok = await joinClub(clubId);
        if (ok) setMyRole("member");
        else setMessage("Couldn't join — you may have been removed from this club.");
      }
      await refresh();
    } finally {
      setJoining(false);
    }
  }

  async function handlePost() {
    if (!clubId || !profileId || !composerBody.trim()) return;
    setPosting(true);
    try {
      const created = await addClubPost(clubId, profileId, composerBody);
      if (created) {
        setPosts((prev) => [created, ...(prev ?? [])]);
        setComposerBody("");
      } else {
        setMessage("Couldn't post — you need to join this club first.");
      }
    } finally {
      setPosting(false);
    }
  }

  async function handleHide(postId: string) {
    const ok = await hideClubPost(postId);
    if (ok) setPosts((prev) => (prev ?? []).filter((p) => p.id !== postId));
  }

  async function handleReport(postId: string) {
    const reason = window.prompt("Why are you reporting this post?");
    if (!reason || !reason.trim()) return;
    const ok = await reportClubPost(postId, reason);
    setMessage(ok ? "Reported — the club's moderators will review it." : "Couldn't send the report.");
  }

  async function handleRemoveMember(target: ClubMember) {
    if (!clubId) return;
    if (!window.confirm(`Remove ${target.name} from this club? They won't be able to rejoin.`)) return;
    const ok = await removeClubMember(clubId, target.profileId);
    if (ok) setMembers((prev) => prev.filter((m) => m.profileId !== target.profileId));
  }

  async function handleToggleModerator(target: ClubMember) {
    if (!clubId) return;
    const makeMod = target.role !== "moderator";
    const ok = await setClubModerator(clubId, target.profileId, makeMod);
    if (ok) {
      setMembers((prev) =>
        prev.map((m) => (m.profileId === target.profileId ? { ...m, role: makeMod ? "moderator" : "member" } : m))
      );
    }
  }

  async function handleResolveReport(reportId: string) {
    const ok = await resolveClubReport(reportId);
    if (ok) setReports((prev) => prev.filter((r) => r.id !== reportId));
  }

  async function handleSaveIntegrations() {
    if (!clubId) return;
    setSavingIntegrations(true);
    try {
      const ok = await saveClubIntegrations(clubId, {
        discordWebhookUrl,
        redditSubreddit,
        telegramBotToken,
        telegramChatId,
        slackWebhookUrl,
      });
      setMessage(ok ? "Saved." : "Couldn't save.");
    } finally {
      setSavingIntegrations(false);
    }
  }

  if (club === null) {
    return (
      <>
        <PageHeader title="Club" contentClassName="max-w-[900px]" />
        <main className="mx-auto w-full max-w-[900px] px-4 pb-16 sm:px-6">
          <p className="text-sm text-[color:var(--muted2)]">Loading…</p>
        </main>
      </>
    );
  }

  return (
    <>
      <PageHeader title={club.name} description={club.description || undefined} contentClassName="max-w-[900px]" />
      <main className="mx-auto w-full max-w-[900px] px-4 pb-16 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-[color:var(--muted2)]">
            {club.memberCount} member{club.memberCount === 1 ? "" : "s"}
            {myRole ? ` · you're ${myRole === "owner" ? "the owner" : myRole}` : ""}
          </div>
          {profileId ? (
            <PillButton onClick={() => void handleJoinToggle()} disabled={joining} variant={myRole ? "default" : "active"}>
              {joining ? "…" : myRole ? "Leave" : "Join"}
            </PillButton>
          ) : null}
        </div>

        <div className="mt-4 flex gap-1.5 border-b border-[color:var(--border)] pb-2">
          {(["discussion", "members", ...(isStaff ? ["moderation" as const] : []), ...(isOwner ? ["settings" as const] : [])] as const).map(
            (t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="rounded-full px-3 py-1.5 text-xs font-semibold capitalize ring-1"
                style={
                  tab === t
                    ? { background: "var(--pill-active-bg)", color: "var(--theme-gold, #C8CDD2)", borderColor: "var(--frame-ring)" }
                    : { background: "var(--pill)", color: "var(--muted)", borderColor: "var(--border)" }
                }
              >
                {t}
                {t === "moderation" && reports.length > 0 ? ` (${reports.length})` : ""}
              </button>
            )
          )}
        </div>

        {message ? <p className="mt-3 text-xs text-[color:var(--muted)]">{message}</p> : null}

        {tab === "discussion" ? (
          <div className="mt-4">
            {myRole ? (
              <div className="rounded-[14px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)]">
                <textarea
                  value={composerBody}
                  onChange={(e) => setComposerBody(e.target.value)}
                  maxLength={2000}
                  placeholder="Post something to this club…"
                  className="w-full rounded-xl bg-[color:var(--pill)] px-3 py-2 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
                  style={{ minHeight: 64 }}
                />
                <div className="mt-2 flex justify-end">
                  <PillButton onClick={() => void handlePost()} disabled={posting || !composerBody.trim()} variant="active">
                    {posting ? "Posting…" : "Post"}
                  </PillButton>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[color:var(--muted2)]">Join this club to post — anyone can read.</p>
            )}

            <div className="mt-4 flex flex-col gap-2">
              {posts === null ? (
                <p className="text-sm text-[color:var(--muted2)]">Loading…</p>
              ) : posts.length === 0 ? (
                <p className="text-sm text-[color:var(--muted2)]">No posts yet.</p>
              ) : (
                posts.map((post) => (
                  <div key={post.id} className="rounded-[14px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold">{post.authorName}</span>
                      <span className="text-[10px] text-[color:var(--muted2)]">{timeAgo(post.createdAt)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-[color:var(--fg)]">{post.body}</p>
                    <div className="mt-2 flex gap-2">
                      {post.profileId === profileId || isStaff ? (
                        <button onClick={() => void handleHide(post.id)} className="text-[11px] text-[color:var(--muted2)] hover:text-[color:var(--fg)]">
                          Hide
                        </button>
                      ) : null}
                      {post.profileId !== profileId ? (
                        <button onClick={() => void handleReport(post.id)} className="text-[11px] text-[color:var(--muted2)] hover:text-[color:var(--fg)]">
                          Report
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}

        {tab === "members" ? (
          <div className="mt-4 flex flex-col gap-2">
            {members.map((m) => (
              <div key={m.profileId} className="flex items-center justify-between gap-2 rounded-[10px] bg-[color:var(--pill)] px-3 py-2 ring-1 ring-[color:var(--border)]">
                <div className="min-w-0">
                  <span className="text-sm font-semibold">{m.name}</span>
                  <span className="ml-2 text-[10px] uppercase tracking-wide text-[color:var(--muted2)]">{m.role}</span>
                </div>
                {isOwner && m.role !== "owner" ? (
                  <div className="flex shrink-0 gap-2">
                    <button onClick={() => void handleToggleModerator(m)} className="text-[11px] text-[color:var(--muted2)] hover:text-[color:var(--fg)]">
                      {m.role === "moderator" ? "Remove mod" : "Make mod"}
                    </button>
                    <button onClick={() => void handleRemoveMember(m)} className="text-[11px] text-red-400 hover:text-red-300">
                      Remove
                    </button>
                  </div>
                ) : isStaff && m.role === "member" ? (
                  <button onClick={() => void handleRemoveMember(m)} className="shrink-0 text-[11px] text-red-400 hover:text-red-300">
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {tab === "moderation" && isStaff ? (
          <div className="mt-4 flex flex-col gap-2">
            {reports.length === 0 ? (
              <p className="text-sm text-[color:var(--muted2)]">No open reports.</p>
            ) : (
              reports.map((r) => (
                <div key={r.id} className="rounded-[10px] bg-[color:var(--pill)] p-3 ring-1 ring-[color:var(--border)]">
                  <div className="text-xs text-[color:var(--muted2)]">Reported by {r.reporterName} · {timeAgo(r.createdAt)}</div>
                  <div className="mt-1 text-xs italic text-[color:var(--muted)]">&ldquo;{r.reason}&rdquo;</div>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{r.postBody}</p>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => void handleHide(r.postId)} className="text-[11px] text-red-400 hover:text-red-300">
                      Hide post
                    </button>
                    <button onClick={() => void handleResolveReport(r.id)} className="text-[11px] text-[color:var(--muted2)] hover:text-[color:var(--fg)]">
                      Dismiss report
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}

        {tab === "settings" && isOwner ? (
          <div className="mt-4 rounded-[14px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]">
            <p className="text-xs text-[color:var(--muted)]">
              Optional — automatically post new club discussion to other places. All fields are independent; fill in
              whichever ones apply.
            </p>

            <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--muted2)]">
              Discord webhook URL
            </label>
            <input
              value={discordWebhookUrl}
              onChange={(e) => setDiscordWebhookUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/…"
              className="mt-1 h-11 w-full rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-[color:var(--muted2)]">
              In your Discord server: Server Settings → Integrations → Webhooks → New Webhook → Copy URL.
            </p>

            <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--muted2)]">
              Telegram bot token
            </label>
            <input
              value={telegramBotToken}
              onChange={(e) => setTelegramBotToken(e.target.value)}
              placeholder="123456789:ABCdefGhIJKl…"
              className="mt-1 h-11 w-full rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
            />
            <label className="mt-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--muted2)]">
              Telegram chat/channel ID
            </label>
            <input
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              placeholder="e.g. -1001234567890 or @yourchannel"
              className="mt-1 h-11 w-full rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-[color:var(--muted2)]">
              In Telegram: message @BotFather → /newbot → copy the token. Add that bot to your channel/group as an
              admin, then send any message there and check{" "}
              <span className="font-mono">https://api.telegram.org/bot&lt;token&gt;/getUpdates</span> in a browser to
              find the chat id.
            </p>

            <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--muted2)]">
              Slack webhook URL
            </label>
            <input
              value={slackWebhookUrl}
              onChange={(e) => setSlackWebhookUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/…"
              className="mt-1 h-11 w-full rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-[color:var(--muted2)]">
              In Slack: Settings → Incoming Webhooks → Add New Webhook → pick a channel → Copy URL.
            </p>

            <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--muted2)]">
              Reddit subreddit
            </label>
            <input
              value={redditSubreddit}
              onChange={(e) => setRedditSubreddit(e.target.value)}
              placeholder="e.g. VintageVinylCollectors (no r/)"
              className="mt-1 h-11 w-full rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-[color:var(--muted2)]">
              Cross-posting isn&apos;t live yet — Reddit now requires a manually-approved developer application before
              this can actually post.
            </p>

            <div className="mt-4 flex justify-end">
              <PillButton onClick={() => void handleSaveIntegrations()} disabled={savingIntegrations} variant="active">
                {savingIntegrations ? "Saving…" : "Save"}
              </PillButton>
            </div>
          </div>
        ) : null}
      </main>
    </>
  );
}
