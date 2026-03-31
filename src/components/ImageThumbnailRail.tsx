"use client";

export default function ImageThumbnailRail({ images, active, onSelect }) {
  return (
    <div className="flex flex-col gap-2">
      {images.map((img, i) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          className={"aspect-square w-[70px] overflow-hidden rounded " + (i === active ? "ring-2 ring-white" : "opacity-60")}
        >
          <img src={img} className="w-full h-full object-cover" />
        </button>
      ))}
    </div>
  );
}
