import { NextResponse } from "next/server";

// The scheduled event refreshes spend money (SerpApi searches and Anthropic AI calls). They are OFF.
//
// Two layers, so a missed step cannot start a paid run:
//  1. vercel.json has no schedule for them, so nothing calls them on its own.
//  2. Even a direct call (for example the dashboard's "Run" button, or someone with the cron secret) does nothing and spends nothing unless
//     EVENTS_REFRESH_ENABLED is exactly "true" in the environment. It is not set, so it is off. The check happens before any outside request.
// Turning the old daily / weekly jobs back on is a deliberate act of the owner (set the variable AND restore the schedule), not a side effect of anything.
export function eventsRefreshEnabled(): boolean {
  return process.env.EVENTS_REFRESH_ENABLED === "true";
}

export function refreshDisabledResponse(job: string): NextResponse {
  console.log(`[${job}] disabled: no outside request was made`);
  return NextResponse.json(
    {
      ok: true,
      disabled: true,
      job,
      message: "This refresh is switched off. It made no search, no AI call and no database change.",
    },
    { status: 200 },
  );
}
