"use client";

import Link from "next/link";

import { ActionMenu, type ActionMenuItem } from "@/components/ui/ActionMenu";
import { AppIcon } from "@/components/ui/AppIcon";
import { PillButton, pillClassName } from "@/components/ui/PillButton";

// The original entry structure (restored): two ways to add, side by side, plus the upload choice made up front.
//   Quick Add  -> /vault/quick  (snap now, fill in later)
//   Add Item   -> /capture      (the camera screen; typing it in is the "Add manually" link there and on empty states)
//   Upload     -> Single item (all photos on one item) or Batch (each photo its own item)
// Nothing here starts identification: AI runs only from an "Identify with AI" action on the screens these open.
const UPLOAD_OPTIONS: ActionMenuItem[] = [
  { key: "single", label: "Single item", description: "All images go on 1 item", href: "/capture?openUpload=1" },
  { key: "batch", label: "Batch", description: "Each image creates a new item", href: "/vault/bulk" },
];

export default function AddItemActions({ placement = "below" }: { placement?: "below" | "above" }) {
  return (
    <div className="inline-flex shrink-0 items-center gap-2" data-add-item-actions>
      <PillButton href="/vault/quick" variant="active">
        Quick Add
      </PillButton>
      <Link href="/capture" className="vltd-action-module vltd-action-module--shared shrink-0">
        <span className="vltd-action-module__plate">Add Item</span>
        <span className="vltd-action-module__block">
          <AppIcon name="addItem" size={16} strokeWidth={2.6} />
        </span>
      </Link>
      <ActionMenu
        placement={placement}
        items={UPLOAD_OPTIONS}
        ariaLabel="Upload from device"
        width={230}
        triggerClassName={pillClassName("default", false, "w-11 md:w-9 px-0 shrink-0")}
        triggerChildren={<AppIcon name="share" size={16} strokeWidth={2} />}
      />
    </div>
  );
}
