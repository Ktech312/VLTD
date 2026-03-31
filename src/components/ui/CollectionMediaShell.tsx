"use client";

import type { UniverseKey } from "@/lib/taxonomy";

function toneForUniverse(universe?: UniverseKey | string) {
  switch (universe) {
    case "SPORTS":
      return {
        shell: "bg-[linear-gradient(180deg,rgba(64,82,110,0.34),rgba(15,18,24,0.96))]",
        panel: "bg-[linear-gradient(180deg,rgba(24,31,42,0.88),rgba(9,11,15,0.98))]",
      };
    case "TCG":
      return {
        shell: "bg-[linear-gradient(180deg,rgba(63,58,98,0.34),rgba(15,15,24,0.96))]",
        panel: "bg-[linear-gradient(180deg,rgba(24,21,40,0.88),rgba(10,9,15,0.98))]",
      };
    case "POP_CULTURE":
      return {
        shell: "bg-[linear-gradient(180deg,rgba(92,71,52,0.28),rgba(21,18,16,0.96))]",
        panel: "bg-[linear-gradient(180deg,rgba(34,28,24,0.88),rgba(13,11,10,0.98))]",
      };
    case "MUSIC":
      return {
        shell: "bg-[linear-gradient(180deg,rgba(74,58,78,0.30),rgba(18,15,20,0.96))]",
        panel: "bg-[linear-gradient(180deg,rgba(29,24,31,0.88),rgba(10,9,11,0.98))]",
      };
    default:
      return {
        shell: "bg-[linear-gradient(180deg,rgba(72,72,72,0.28),rgba(16,16,18,0.96))]",
        panel: "bg-[linear-gradient(180deg,rgba(26,26,28,0.88),rgba(10,10,11,0.98))]",
      };
  }
}

export default function CollectionMediaShell({
  src,
  alt,
  universe,
  aspectClass = "aspect-[4/3]",
  fit = "cover",
  large = false,
  onClick,
}: {
  src?: string;
  alt: string;
  universe?: UniverseKey | string;
  aspectClass?: string;
  fit?: "cover" | "contain";
  large?: boolean;
  onClick?: () => void;
}) {
  const tone = toneForUniverse(universe);
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={[
        "group relative block w-full overflow-hidden rounded-[18px] p-2 ring-1 ring-white/8 shadow-[0_10px_28px_rgba(0,0,0,0.28)]",
        tone.shell,
        onClick ? "text-left transition hover:ring-white/12" : "",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-x-[12%] top-0 h-16 rounded-full bg-white/8 blur-3xl" />
      <div className={["relative overflow-hidden rounded-[12px] ring-1 ring-white/6", tone.panel, aspectClass].join(" ")}>
        {src ? (
          <div className="flex h-full w-full items-center justify-center p-3">
            <img
              src={src}
              alt={alt}
              className={[
                "max-h-full max-w-full transition duration-200",
                fit === "contain" ? "object-contain" : "h-full w-full object-cover",
                large ? "group-hover:scale-[1.01]" : "group-hover:scale-[1.02]",
              ].join(" ")}
              draggable={false}
            />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-center text-xs text-white/45">
            <div>
              <div className="text-sm font-medium text-white/60">No image</div>
              <div className="mt-1">Add a photo</div>
            </div>
          </div>
        )}
      </div>
    </Wrapper>
  );
}
