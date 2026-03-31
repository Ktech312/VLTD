import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { imageUrl } = await req.json();

    if (!imageUrl) {
      return NextResponse.json({ error: "Missing imageUrl" }, { status: 400 });
    }

    const apiKey = process.env.REMOVE_BG_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing API key" }, { status: 500 });
    }

    // fetch original image
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) {
      return NextResponse.json({ error: "Failed to fetch image" }, { status: 400 });
    }

    const blob = await imageRes.blob();

    const formData = new FormData();
    formData.append("image_file", blob);
    formData.append("size", "auto");

    const removeRes = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
      },
      body: formData,
    });

    if (!removeRes.ok) {
      const text = await removeRes.text();
      return NextResponse.json(
        { error: "Remove.bg failed", details: text },
        { status: 500 }
      );
    }

    const arrayBuffer = await removeRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const dataUrl = `data:image/png;base64,${base64}`;

    return NextResponse.json({ image: dataUrl });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}