import { NextResponse } from "next/server";

export async function GET() {
  // Expose only what the client needs.
  return NextResponse.json({
    clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
    redirectUri: `${process.env.NEXT_PUBLIC_APP_ORIGIN ?? "http://localhost:3000"}/user`,
  });
}