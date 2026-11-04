"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getCurrentSession } from "@/lib/auth";
import { LEARN_VIDEOS, type LearnVideo } from "@/lib/learnVideos";
import { learnVideoPreview } from "@/lib/learnVideoSelection";
import { pillClassName } from "@/components/ui/PillButton";

type VideoAvailability = { id: string; available: boolean };
const COLLECTIONS = ["All videos", "Walkthroughs", "Quick tips", "About VLTD"] as const;

async function playback(video: LearnVideo) {
  const headers: HeadersInit = {};
  if (video.access === "account") {
    const { data } = await getCurrentSession();
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  const response = await fetch(`/api/learn/videos?id=${encodeURIComponent(video.id)}`, { headers, cache: "no-store" });
  const body = await response.json() as { youtubeId?: string; error?: string };
  if (!response.ok || !body.youtubeId || !/^[a-zA-Z0-9_-]{11}$/.test(body.youtubeId)) {
    return { signIn: response.status === 401, error: body.error || "This video couldn't be opened. Please try again.", id: null };
  }
  return { signIn: false, error: "", id: body.youtubeId };
}

export default function LearnVideoLibrary() {
  const [collection, setCollection] = useState<string>("All videos");
  const [expanded, setExpanded] = useState(false);
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<LearnVideo | null>(null);
  const [youtubeId, setYoutubeId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [signIn, setSignIn] = useState(false);
  const [opening, setOpening] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void fetch("/api/learn/videos", { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Unavailable");
        const body = await response.json() as { videos: VideoAvailability[] };
        if (active) setAvailability(Object.fromEntries(body.videos.map(video => [video.id, video.available])));
      }).catch(() => { if (active) setListError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [retry]);

  function closePlayer() {
    request.current += 1;
    setYoutubeId(null);
    setSelected(null);
    dialog.current?.close();
  }

  async function openPlayer(video: LearnVideo) {
    const current = ++request.current;
    setSelected(video);
    setYoutubeId(null);
    setError("");
    setSignIn(false);
    setOpening(true);
    dialog.current?.showModal();
    const result = await playback(video).catch(() => ({ signIn: false, error: "This video couldn't be opened. Please try again.", id: null }));
    if (current !== request.current) return;
    setSignIn(result.signIn);
    setError(result.error);
    setYoutubeId(result.id);
    setOpening(false);
  }

  const filtered = LEARN_VIDEOS.filter(video => collection === "All videos" || video.collection === collection);
  const videos = collection === "All videos" && !expanded
    ? learnVideoPreview(filtered, availability)
    : filtered;

  return (
    <section id="video-guides" aria-labelledby="video-guides-heading" className="mb-7 rounded-[14px] border border-[color:var(--border)] bg-vault-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--accent)]">Watch and learn</p>
          <h2 id="video-guides-heading" className="mt-1 text-xl font-black text-text-primary">Video guides</h2>
          <p className="mt-1 max-w-2xl text-sm text-[color:var(--muted)]">Step-by-step help for your collection, on desktop and phone.</p>
        </div>
        <a href="#written-guides" className={pillClassName()}>Written guides ↓</a>
      </div>
      <div role="group" aria-label="Video collections" className="my-4 flex flex-wrap gap-x-2 gap-y-3">
        {COLLECTIONS.map(label => <button key={label} type="button" aria-pressed={collection === label} className={pillClassName(collection === label ? "active" : "default")} onClick={() => { setCollection(label); setExpanded(false); }}>{label}</button>)}
      </div>
      {listError ? <div role="status" className="flex flex-wrap items-center gap-3 py-3 text-sm"><p>Video availability couldn’t be loaded. Your written guides are still available below.</p><button type="button" className={pillClassName()} onClick={() => { setLoading(true); setListError(false); setRetry(value => value + 1); }}>Retry</button></div> : <>
        {!loading && !Object.values(availability).some(Boolean) && <p className="mb-3 text-sm text-[color:var(--muted)]">Video guides are coming soon. You can use the written guides below today.</p>}
        <div className={`grid gap-2 sm:grid-cols-2 ${videos.length > 2 ? "xl:grid-cols-3" : ""}`} aria-busy={loading}>
          {videos.map(video => <article key={video.id} className="flex min-w-0 items-start gap-3 rounded-[6px] border border-[color:var(--border)] p-3">
            <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-[6px] bg-white/5 text-lg text-[color:var(--accent)]">▶</span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-[color:var(--muted)]">{video.duration} · {video.device}</p>
              <h3 className="mt-0.5 text-sm font-bold text-text-primary">{video.title}</h3>
              <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">{video.description}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {availability[video.id] ? <button type="button" className={pillClassName()} aria-label={`Watch ${video.title}`} onClick={() => void openPlayer(video)}>Watch</button> : <span className="text-xs text-[color:var(--muted)]">{loading ? "Checking availability…" : "Coming soon"}</span>}
                {video.access === "account" && <span className="text-[11px] text-[color:var(--muted)]">For VLTD accounts</span>}
              </div>
            </div>
          </article>)}
        </div>
        {collection === "All videos" && <button type="button" aria-expanded={expanded} className={`${pillClassName()} mt-3`} onClick={() => setExpanded(value => !value)}>{expanded ? "Show fewer videos" : `Browse all ${LEARN_VIDEOS.length} videos`}</button>}
      </>}
      <dialog ref={dialog} onCancel={closePlayer} onClick={event => { if (event.target === event.currentTarget) closePlayer(); }} onClose={() => { request.current += 1; setYoutubeId(null); setSelected(null); }} aria-labelledby="learn-video-title" className="m-auto max-h-[90dvh] w-[calc(100%-24px)] max-w-4xl overflow-y-auto rounded-[14px] border border-[color:var(--border)] bg-[color:var(--bg-card,#15191e)] p-4 text-[color:var(--fg)] backdrop:bg-black/75">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id="learn-video-title" className="text-lg font-bold">{selected?.title}</h2>
          <button type="button" className={pillClassName()} onClick={closePlayer} aria-label="Close video">Close</button>
        </div>
        {opening && <p role="status" className="py-8 text-sm">Opening video…</p>}
        {error && <div role="alert" className="space-y-3 py-5"><p>{error}</p>{signIn ? <Link className={pillClassName()} href="/login?next=%2Flearn%23video-guides">Sign in</Link> : selected && <button type="button" className={pillClassName()} onClick={() => void openPlayer(selected)}>Retry</button>}</div>}
        {youtubeId && selected && <>
          <div className={`mx-auto w-full ${selected.portrait ? "aspect-[9/16] max-w-[min(100%,34vh)]" : "aspect-video"}`}>
            <iframe key={youtubeId} src={`https://www.youtube-nocookie.com/embed/${youtubeId}?playsinline=1&rel=0`} title={selected.title} className="h-full w-full rounded-[6px] border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
          </div>
          <p className="mt-3 text-xs leading-5 text-[color:var(--muted)]">Plays through YouTube. <a className="underline" href={`https://www.youtube.com/watch?v=${youtubeId}`} target="_blank" rel="noopener noreferrer">Open on YouTube</a></p>
        </>}
      </dialog>
    </section>
  );
}
