
"use client";

import VirtualizedVaultGrid from "@/components/vault/VirtualizedVaultGrid"

export default function VaultVirtualizedContainer({ items }: { items:any[] }){

  if(items.length < 200){
    return <VirtualizedVaultGrid items={items} />
  }

  return (
    <div>
      <div className="mb-3 text-sm text-white/60">
        Virtualized mode enabled
      </div>

      <VirtualizedVaultGrid items={items} />
    </div>
  )
}
