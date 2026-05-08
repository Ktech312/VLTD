"use client";

import Image from "next/image";
import { useState } from "react";

type Props = {
  className?: string;
};

const INTAKE_ITEMS = [
  { className: "comic", src: "/collectibles/comic-slab.png", alt: "Graded comic slab", width: 260, height: 431 },
  { className: "sports", src: "/collectibles/sports-slab.png", alt: "Slabbed sports card", width: 208, height: 383 },
  { className: "figure", src: "/collectibles/vinyl-figure.png", alt: "Collectible figure", width: 229, height: 309 },
  { className: "vinyl", src: "/collectibles/vinyl-record.png", alt: "Vinyl record album", width: 394, height: 283 },
  { className: "guitar", src: "/collectibles/guitar.png", alt: "Electric guitar", width: 213, height: 601 },
  { className: "poster", src: "/collectibles/movie-poster.png", alt: "Movie poster tube", width: 131, height: 584 },
];

export default function VltdVaultLogoAnimation({ className = "" }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <button
      type="button"
      className={[
        "vltd-vault-card-animation",
        isOpen ? "vltd-vault-card-animation--open" : "",
        className,
      ].join(" ")}
      aria-label={isOpen ? "Close VLTD vault animation" : "Open VLTD vault animation"}
      aria-pressed={isOpen}
      onClick={() => setIsOpen((current) => !current)}
    >
      <Image
        className="vltd-vault-card-animation__art"
        src="/brand/vltd-business-card-black.png"
        alt="VLTD, Your Digital Vault and Museum"
        width={1600}
        height={900}
        priority
        draggable={false}
      />
      <div className="vltd-vault-card-animation__shine" />
      <div className="vltd-vault-card-animation__intake" aria-hidden="true">
        {INTAKE_ITEMS.map((item) => (
          <div
            key={item.className}
            className={`vltd-vault-card-animation__item vltd-vault-card-animation__item--${item.className}`}
          >
            <Image
              src={item.src}
              alt=""
              width={item.width}
              height={item.height}
              draggable={false}
            />
          </div>
        ))}
        <div className="vltd-vault-card-animation__shelf" />
      </div>
      <div className="vltd-vault-card-animation__vault">
        <div className="vltd-vault-card-animation__white-glow" />
        <div className="vltd-vault-card-animation__mouth" />
        <div className="vltd-vault-card-animation__door" />
      </div>
    </button>
  );
}
