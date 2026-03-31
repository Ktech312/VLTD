
"use client";

export default function VirtualizedVaultGrid({ items }: { items: any[] }) {

  return (
    <div className="grid md:grid-cols-3 xl:grid-cols-5 gap-4">
      {items.map((item) => (
        <div key={item.id} className="p-3 bg-black/20 rounded-xl ring-1 ring-white/10">
          {item.title}
        </div>
      ))}
    </div>
  );
}
