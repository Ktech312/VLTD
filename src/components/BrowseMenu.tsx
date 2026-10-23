"use client";

import { ActionMenu } from "@/components/ui/ActionMenu";
import { AppIcon } from "@/components/ui/AppIcon";
import { pillClassName } from "@/components/ui/PillButton";
import { BROWSE_ITEMS, type BrowseKey } from "@/lib/primaryNav";

/**
 * "Browse": the compact menu beside the title of the four public Discover pages (Discover, Marketplace, Upcoming Comics, Events).
 * It replaces the old row of six buttons. The page the person is on is marked. Built on the shared ActionMenu, so it has the
 * same keyboard handling, dismissal and one-menu-at-a-time behaviour as every other menu in the app.
 */
export function BrowseMenu({ current }: { current: BrowseKey }) {
  return (
    <ActionMenu
      ariaLabel="Browse"
      align="left"
      width={292}
      items={BROWSE_ITEMS.map((item) => ({ key: item.key, label: item.label, description: item.description, href: item.href, current: item.key === current }))}
      triggerClassName={pillClassName("default", false, "gap-1.5", "compact")}
      triggerChildren={
        <>
          <span>Browse</span>
          <AppIcon name="chevronDown" size={14} strokeWidth={2} />
        </>
      }
    />
  );
}
