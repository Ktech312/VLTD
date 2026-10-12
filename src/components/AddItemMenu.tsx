"use client";

import { ActionMenu, type ActionMenuItem } from "@/components/ui/ActionMenu";
import { AppIcon } from "@/components/ui/AppIcon";

// Every way of adding an item, named plainly. Single and batch photo upload are separate, explicit choices.
const ADD_ITEM_OPTIONS: ActionMenuItem[] = [
  { key: "scan", label: "Scan", description: "Use the camera to scan an item", href: "/capture" },
  { key: "quick", label: "Quick Add", description: "Add items fast with a few details", href: "/vault/quick" },
  { key: "manual", label: "Manual entry", description: "Type the details yourself", href: "/vault/add" },
  { key: "upload-one", label: "Upload photos for one item", description: "All the photos go to one item", href: "/capture?openUpload=1" },
  { key: "upload-batch", label: "Batch upload", description: "Each photo becomes its own item", href: "/vault/bulk" },
];

/** The branded Add Item control. It opens the list of ways to add an item. */
export default function AddItemMenu() {
  return (
    <ActionMenu
      items={ADD_ITEM_OPTIONS}
      ariaLabel="Add Item"
      triggerClassName="vltd-action-module vltd-action-module--shared shrink-0"
      triggerChildren={
        <>
          <span className="vltd-action-module__plate">Add Item</span>
          <span className="vltd-action-module__block">
            <AppIcon name="addItem" size={16} strokeWidth={2.6} />
          </span>
        </>
      }
    />
  );
}
