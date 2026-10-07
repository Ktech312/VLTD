"use client";

// The brass plaque at the top of a shelf room: this exhibit's title and a short description, styled like
// the gold-framed items below it. Sized in container-width units so it scales with the room.
// Put it inside a positioned element that has `container-type: inline-size`.
export default function ExhibitPlaque({ title, text }: { title: string; text?: string }) {
  const cleanTitle = title.trim();
  if (!cleanTitle) return null;
  const cleanText = (text ?? "").trim();

  return (
    <div
      className="vltd-dark-surface pointer-events-none absolute z-20"
      style={{ left: "27%", width: "46%", top: "2.4%", height: "5.2%" }}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[8px] bg-[#0b1018] p-[2px] shadow-[0_6px_14px_rgba(0,0,0,0.5)] before:pointer-events-none before:absolute before:inset-0 before:rounded-[8px] before:bg-[linear-gradient(135deg,#fff0a8_0%,#d99a2b_18%,#6f4514_37%,#f7cf72_54%,#3a250d_72%,#ffe7a0_100%)]">
        <div className="relative z-10 flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-[6px] bg-[linear-gradient(180deg,rgba(22,20,27,0.99),rgba(8,8,12,0.99))] px-[4%] text-center">
          <div
            className="w-full truncate font-serif font-semibold leading-tight text-[#f5d16d]"
            style={{ fontSize: "2.5cqw" }}
          >
            {cleanTitle}
          </div>
          {cleanText ? (
            <div
              className="mt-[1px] w-full overflow-hidden leading-tight text-white/65"
              style={{
                fontSize: "1.4cqw",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {cleanText}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
