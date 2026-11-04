import type { LearnVideo } from "./learnVideos";

/** Keep the compact preview useful when a preferred guide has not been uploaded. */
export function learnVideoPreview(videos: readonly LearnVideo[], availability: Record<string, boolean>): LearnVideo[] {
  const ready = videos.filter(video => availability[video.id]);
  if (!ready.length) return videos.slice(0, 2);
  const preferred = ["quick-add-combined", "add-item-combined"]
    .flatMap(id => ready.filter(video => video.id === id));
  return [...preferred, ...ready.filter(video => !preferred.includes(video))].slice(0, 2);
}
