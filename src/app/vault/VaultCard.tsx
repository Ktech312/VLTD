"use client";

import { useEffect, useRef } from "react";
import { type VaultItem as ModelItem } from "@/lib/vaultModel";

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
      const rect = el.getBoundingClientRect();

      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;

      const rx = (0.5 - py) * (maxTilt * 2);
      const ry = (px - 0.5) * (maxTilt * 2);

      el.style.transform =
        `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${scale})`;

      el.style.boxShadow = "0 18px 44px rgba(0,0,0,0.25)";
    }

    function reset() {
      el.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)";
      el.style.boxShadow = "0 1px 0 rgba(0,0,0,0.04)";
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
  frame: any;
  label: string;
}) {
  const tiltRef = useTilt();

  return (
    <a href={`/vault/item/${item.id}`} className="block">
      <div
        ref={tiltRef}
        className={`rounded-2xl vltd-panel-soft p-2.5 sm:p-3 ${frame.card} transition-transform duration-200`}
      >
        <div className={frame.frame}>
          <div className={frame.imgWrap}>
            <div className="aspect-[3/4] w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgSrc}
                alt={item.title}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          </div>
        </div>

        <div className="mt-2.5">
          <div className="text-xs text-[color:var(--muted2)]">{label}</div>
          <div className="mt-1 text-[14px] sm:text-[15px] font-medium text-[color:var(--fg)]">
            {item.title}
          </div>
          <div className="text-sm text-[color:var(--muted)]">
            {item.subtitle} {item.number} {item.grade ? `• ${item.grade}` : ""}
          </div>
          <div className="mt-2 text-sm text-[color:var(--fg)]">
            Value: <span className="font-medium">${item.currentValue ?? 0}</span>
          </div>
        </div>
      </div>
    </a>
  );
}