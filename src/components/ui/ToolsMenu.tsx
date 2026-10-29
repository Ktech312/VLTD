"use client";

import { ActionMenu, type ActionMenuItem } from "@/components/ui/ActionMenu";
import { AppIcon } from "@/components/ui/AppIcon";
import { PHONE_COMPACT_CLASS, pillClassName } from "@/components/ui/PillButton";

/** The named Tools menu that holds a page's low-frequency actions, so the header stays one primary action plus Tools. */
export function ToolsMenu({ items, label = "Tools", phoneCompact = false }: { items: ActionMenuItem[]; label?: string; phoneCompact?: boolean }) {
  return (
    <ActionMenu
      items={items}
      ariaLabel={label}
      triggerClassName={pillClassName("default", false, phoneCompact ? PHONE_COMPACT_CLASS : "")}
      triggerChildren={
        <>
          {label}
          <AppIcon name="chevronDown" strokeWidth={2.2} />
        </>
      }
    />
  );
}
