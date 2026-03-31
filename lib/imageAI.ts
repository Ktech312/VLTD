export async function removeBackgroundStub(imageUrl: string): Promise<Blob> {
  const res = await fetch("/api/remove-bg", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ imageUrl }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || "Background removal failed.");
  }

  const image = String(data?.image || "");
  if (!image.startsWith("data:image/")) {
    throw new Error("Background removal returned an invalid image.");
  }

  const base64 = image.split(",")[1];
  if (!base64) {
    throw new Error("Background removal returned empty image data.");
  }

  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length)
    .fill(0)
    .map((_, i) => byteCharacters.charCodeAt(i));
  const byteArray = new Uint8Array(byteNumbers);

  return new Blob([byteArray], { type: "image/png" });
}
