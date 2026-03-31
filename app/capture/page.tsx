
"use client";

import CaptureCamera from "@/components/CaptureCamera";

export default function CapturePage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Capture Item</h1>
      <CaptureCamera />
    </main>
  );
}
