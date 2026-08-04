"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// This page's fields (display name, username, avatar, age verification,
// marketing opt-in, email) were merged into the real /account settings page
// on 2026-08-04 -- this used to be a local-only duplicate that diverged from
// /account and caused a real bug (public display name was read from here
// instead of the real profile). Kept as a redirect (not deleted outright) so
// any bookmarked or linked /user/profile URL still lands somewhere real.
export default function UserProfileRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/account");
  }, [router]);
  return null;
}
