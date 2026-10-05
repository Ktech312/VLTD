/* Path: src/components/VltdLogo.tsx
   The approved VLTD keyhole logo. All three files render; CSS (globals.css)
   shows exactly one: Logo A platinum on dark screens, Logo A black on light
   screens, or Logo B color when the member has chosen the Bright look. Pure
   CSS means no flash and no hydration mismatch. */
export default function VltdLogo({
  height = 38,
  className = "",
  glow = false,
  force,
  onDark = false,
}: {
  height?: number;
  className?: string;
  glow?: boolean;
  /** Preview a specific version regardless of the member's current choice. */
  force?: "a" | "b";
  /** Sits on a surface that stays dark even on light screens (e.g. the login card). */
  onDark?: boolean;
}) {
  const style = { height, width: "auto" } as const;
  if (force === "b") {
    return (
      <span className={`vltd-logo ${className}`.trim()} role="img" aria-label="VLTD">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="vltd-logo-color" src="/brand/logo/vltd-logo-color.png" alt="" aria-hidden="true" style={{ ...style, display: "block" }} />
      </span>
    );
  }
  return (
    <span className={`vltd-logo${glow ? " vltd-logo-glow" : ""}${force === "a" ? " vltd-logo-force-a" : ""}${onDark ? " vltd-logo-on-dark" : ""} ${className}`.trim()} role="img" aria-label="VLTD">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="vltd-logo-platinum" src="/brand/logo/vltd-logo-platinum.png" alt="" aria-hidden="true" style={style} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="vltd-logo-black" src="/brand/logo/vltd-logo-black.png" alt="" aria-hidden="true" style={style} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="vltd-logo-color" src="/brand/logo/vltd-logo-color.png" alt="" aria-hidden="true" style={style} />
    </span>
  );
}
