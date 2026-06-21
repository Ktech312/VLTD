import { NextRequest, NextResponse } from "next/server";

/**
 * Completes the OAuth code exchange server-side (needs GOOGLE_CLIENT_SECRET,
 * which must never reach the browser), then hands the resulting access
 * token to the client via a URL fragment - fragments aren't sent to any
 * server, which keeps the token out of logs while still letting the
 * existing local-storage-based client code (lib/googleSheets.ts) pick it up
 * the same way it already expects to.
 */
export async function GET(req: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_APP_ORIGIN ?? new URL(req.url).origin;
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${origin}/account/workspace?google_error=${encodeURIComponent(error)}`);
  }

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!code || !clientId || !clientSecret) {
    return NextResponse.redirect(`${origin}/account/workspace?google_error=not_configured`);
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${origin}/api/google/oauth-callback`,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      return NextResponse.redirect(`${origin}/account/workspace?google_error=token_exchange_failed`);
    }

    const expiresIn = typeof tokenData.expires_in === "number" ? tokenData.expires_in : 3600;
    return NextResponse.redirect(
      `${origin}/account/workspace#google_token=${encodeURIComponent(tokenData.access_token)}&expires_in=${expiresIn}`
    );
  } catch {
    return NextResponse.redirect(`${origin}/account/workspace?google_error=token_exchange_failed`);
  }
}
