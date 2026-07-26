"use client";

import { useEffect, useRef } from "react";
import ItemVisibilityToggle from "@/components/ItemVisibilityToggle";
import NotableBadge from "@/components/NotableBadge";
import { isNotable, notableReason } from "@/lib/itemIntelligence";
import { type VaultItem as ModelItem } from "@/lib/vaultModel";

type VaultCardFrame = {
  card: string;
  frame: string;
  imgWrap: string;
};

function useTilt() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;

    if (prefersReduced || isTouch) return;

    const maxTilt = 10;
    const scale = 1.02;

    function onMove(e: MouseEvent) {
      const node = ref.current;
      if (!node) return;

      const rect = node.getBoundingClientRect();

      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;

      const rx = (0.5 - py) * (maxTilt * 2);
      const ry = (px - 0.5) * (maxTilt * 2);

      node.style.transform =
        `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${scale})`;

      node.style.boxShadow = "0 18px 44px rgba(0,0,0,0.25)";
    }

    function reset() {
      const node = ref.current;
      if (!node) return;

      node.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)";
      node.style.boxShadow = "0 1px 0 rgba(0,0,0,0.04)";
    }

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", reset);

    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", reset);
    };
  }, []);

  return ref;
}

export default function VaultCard({
  item,
  imgSrc,
  frame,
  label,
}: {
  item: ModelItem;
  imgSrc: string;
  frame: VaultCardFrame;
  label: string;
}) {
  const tiltRef = useTilt();
  const notable = isNotable(item);
  const isBulkPending = Boolean((item as ModelItem & { bulkPending?: boolean }).bulkPending);

  return (
    <div>
      <div
        ref={tiltRef}
        className={`relative rounded-2xl vltd-panel-soft p-2.5 sm:p-3 ${frame.card} transition-transform duration-200`}
        style={isBulkPending ? {
          boxShadow: "0 0 0 2px rgba(203,208,213,0.60), 0 0 22px rgba(203,208,213,0.35), 0 0 48px rgba(203,208,213,0.15)",
          animation: "bulk-glow-pulse 2s ease-in-out infinite",
        } : undefined}
      >
        {isBulkPending && (
          <div className="absolute -top-1.5 left-3 z-20 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em]"
            style={{ background: "rgba(203,208,213,0.95)", color: "#1A0F00" }}>
            Tap to complete
          </div>
        )}
        <div className={frame.frame}>
          <div className={frame.imgWrap}>
            <div className="relative aspect-[3/4] w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgSrc}
                alt={item.title}
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <div className="absolute left-2 top-2 z-10">
                <ItemVisibilityToggle item={item} />
              </div>
            </div>
          </div>
        </div>

        <a href={`/vault/item/${item.id}`} className="mt-2.5 block">
          <div className="text-xs text-[color:var(--muted2)]">{label}</div>
          <div className="mt-1 flex items-start justify-between gap-2">
            <div className="min-w-0 text-[14px] font-medium text-[color:var(--fg)] sm:text-[15px]">
              {item.title}
            </div>
            {notable ? <NotableBadge reason={notableReason(item)} /> : null}
          </div>
          <div className="text-sm text-[color:var(--muted)]">
            {item.subtitle} {item.number} {item.grade ? `• ${item.grade}` : ""}
          </div>
          {typeof item.currentValue === "number" && item.currentValue > 0 ? (
            <div className="mt-2 text-sm text-[color:var(--fg)]">
              Value: <span className="font-medium">${item.currentValue}</span>
            </div>
          ) : null}
        </a>
      </div>
    </div>
  );
}
