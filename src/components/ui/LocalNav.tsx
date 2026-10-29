"use client";

import Link from "next/link";

import { PHONE_COMPACT_CLASS, pillClassName } from "@/components/ui/PillButton";

export type LocalNavItem = { key: string; label: string; href: string };

/**
 * Local navigation shown under a page header (for example Items, For Sale, Sold on the Vault).
 * Same pill recipe as every other control; the current page is marked with the selected style
 * and aria-current. Wraps on narrow screens instead of scrolling or clipping.
 */
export function LocalNav({
  items,
  activeKey,
  trailing,
  ariaLabel = "Local navigation",
  phoneCompact = false,
}: {
  /** Phone-only compact pills (32px visual, 44px touch area); unchanged from 768px up. */
  phoneCompact?: boolean;
  items: LocalNavItem[];
  activeKey: string;
  /** Related links shown after a gap, for example Insights and Goals. */
  trailing?: LocalNavItem[];
  ariaLabel?: string;
}) {
  const extra = phoneCompact ? PHONE_COMPACT_CLASS : "";
  return (
    // On a phone with compact pills the row gap is 12px, so the 44px touch areas of two wrapped rows meet instead of overlapping.
    <nav aria-label={ariaLabel} data-local-nav="true" className={"flex flex-wrap items-center gap-x-4 gap-y-2" + (phoneCompact ? " max-md:gap-y-3" : "")}>
      <div className={"flex flex-wrap items-center gap-2" + (phoneCompact ? " max-md:gap-y-3" : "")}>
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            data-local-tab="true"
            aria-current={item.key === activeKey ? "page" : undefined}
            className={pillClassName(item.key === activeKey ? "active" : "default", false, extra)}
          >
            {item.label}
          </Link>
        ))}
      </div>
      {trailing && trailing.length > 0 ? (
        <div className={"flex flex-wrap items-center gap-2" + (phoneCompact ? " max-md:gap-y-3" : "")}>
          {trailing.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              data-local-tab="true"
              aria-current={item.key === activeKey ? "page" : undefined}
              className={pillClassName(item.key === activeKey ? "active" : "default", false, extra)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </nav>
  );
}
