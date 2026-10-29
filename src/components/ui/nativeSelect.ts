/**
 * Class string for a native <select> used as a form field (Revision 2). Same geometry and states as the
 * shared pills: 44px on phones and 36px on desktop, 8px corners, 13px text, the shared border and fill,
 * and the shared keyboard focus ring. Form fields may be full width; pass width and spacing alongside it.
 */
export const nativeSelectClass =
  "h-11 md:h-9 rounded-[6px] bg-[color:var(--pill)] pl-3 pr-8 text-[13px] font-medium text-[color:var(--fg)] ring-1 ring-[color:var(--border)] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pill-active-ring)] disabled:cursor-not-allowed disabled:opacity-60";
