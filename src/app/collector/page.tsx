import { redirect } from "next/navigation";

// The former "Collection Identity" page has been folded into Curator Home
// (/dashboard), which now carries the Curator Strength glance + top pieces.
// Kept as a redirect so old links and bookmarks resolve cleanly.
export default function CollectorRedirectPage() {
  redirect("/dashboard");
}
