// Turns what a failed request throws into a sentence a person can act on.
//
// Found 2026-10-14: with the connection down, the sign-up form showed the browser's own words, "Failed to fetch". People
// need to know what happened ("couldn't reach VLTD"), that what they typed is still there, and what to do next.

const NETWORK = /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_internet|err_network|the internet connection appears to be offline/i;
const TIMEOUT = /timed out|timeout|aborterror|aborted/i;

/** True when the message is the browser's own wording for "the request never got an answer". */
export function looksLikeConnectionProblem(message: string) {
  return NETWORK.test(message) || TIMEOUT.test(message);
}

/**
 * @param error     whatever was thrown
 * @param fallback  what to say when it is not a connection problem and has no message of its own
 */
export function friendlyErrorMessage(error: unknown, fallback: string) {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (offline) {
    return "You appear to be offline. Nothing was lost: what you typed is still here. Reconnect and try again.";
  }
  if (raw && TIMEOUT.test(raw)) {
    return "That took too long and may not have gone through. What you typed is still here; check your connection and try again.";
  }
  if (raw && NETWORK.test(raw)) {
    return "We couldn't reach VLTD. What you typed is still here; check your connection and try again.";
  }
  return raw || fallback;
}
