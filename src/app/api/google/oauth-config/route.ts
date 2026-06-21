import { NextResponse } from "next/server";

export async function GET() {
  const origin = process.env.NEXT_PUBLIC_APP_ORIGIN ?? "http://localhost:3000";
  return NextResponse.json({
    clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
    redirectUri: `${origin}/api/google/oauth-callback`,
    configured: Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  });
}
