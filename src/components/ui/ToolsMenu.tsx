"use client";

import { ActionMenu, type ActionMenuItem } from "@/components/ui/ActionMenu";
import { AppIcon } from "@/components/ui/AppIcon";
import { pillClassName } from "@/components/ui/PillButton";

/** The named Tools menu that holds a page's low-frequency actions, so the header stays one primary action plus Tools. */
export function ToolsMenu({ items, label = "Tools" }: { items: ActionMenuItem[]; label?: string }) {
  return (
    <ActionMenu
      items={items}
      ariaLabel={label}
      triggerClassName={pillClassName("default")}
      triggerChildren={
        <>
          {label}
          <AppIcon name="chevronDown" strokeWidth={2.2} />
        </>
      }
    />
  );
}
