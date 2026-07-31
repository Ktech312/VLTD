"use client";

// Quick Add = the camera scanner. Capture many → review/remove → AI fills them in
// → verify → save to the Vault. The old manual "type it all in by hand" form that
// used to live here was removed; that flow now lives in the scanner (camera) and,
// for uploading existing photo files, in Bulk Upload (/vault/bulk).

import { useRouter } from "next/navigation";

import ScanCapturePanel from "@/components/ScanCapturePanel";

export default function QuickAddClient() {
  const router = useRouter();

  // Cancelling or finishing the scanner returns to the Vault — where it all started.
  return (
    <main className="min-h-[100dvh] bg-[color:var(--bg)]">
      <ScanCapturePanel onClose={() => router.push("/vault")} />
    </main>
  );
}
