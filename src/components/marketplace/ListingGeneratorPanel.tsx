
"use client";

export default function ListingGeneratorPanel({ item }: { item: any }) {

  function generate() {
    alert("Future: Generate full marketplace listing");
  }

  return (
    <div className="p-4 rounded-xl bg-black/20 ring-1 ring-white/10">
      <div className="font-semibold mb-2">Generate Marketplace Listing</div>

      <button onClick={generate} className="px-4 py-2 rounded ring-1 ring-white/20">
        Generate Listing
      </button>
    </div>
  );
}
