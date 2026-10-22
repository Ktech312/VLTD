import { after } from "next/server";

/**
 * Runs the task once the response has been sent (the platform keeps the function alive for it, within the same time limit), so slow, non-essential work
 * cannot make the run itself time out and be marked failed. Outside a request (tests, scripts) there is nothing to wait for, so it simply runs now.
 * Returns true when it was left to run after the response.
 */
export async function runAfterResponse(task: () => Promise<void>): Promise<boolean> {
  try {
    after(task);
    return true;
  } catch {
    await task();
    return false;
  }
}
