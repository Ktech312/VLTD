// One look for "edit right where it is" across the item page: the text turns
// into a field with no box, no padding and the same size and font, with only
// a thin line under it. Nothing around it moves or resizes. (`field-sizing`
// makes the field only as wide as what is typed, so the line stays short.)
export const INLINE_EDIT_LINE =
  "m-0 min-w-[3rem] max-w-full rounded-none border-0 border-b border-[color:var(--theme-gold,#C8CDD2)] bg-transparent p-0 outline-none ring-0 focus:outline-none focus:ring-0 [font:inherit] [letter-spacing:inherit] [field-sizing:content]";
