"use client";

import { useParams } from "next/navigation";

import VaultListView, { universeFromSlug } from "../VaultListView";

export default function VaultUniversePage() {
  const params = useParams<{ universe: string }>();
  return <VaultListView lockedUniverse={universeFromSlug(params.universe)} />;
}
