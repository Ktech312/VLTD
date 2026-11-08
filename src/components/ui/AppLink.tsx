import NextLink from "next/link";
import type { ComponentProps } from "react";

/**
 * The app's link: next/link with automatic prefetching OFF.
 *
 * next/link prefetches every link that scrolls into view. Here that was about half of all requests the site made (measured 2026-11-08:
 * 33-63 prefetch requests on a single page load, each destination fetched about four times) and it helped exhaust the host's monthly
 * request allowance. Navigation, Back, scroll restoration and keyboard/screen-reader behaviour are unchanged; the page's data is
 * simply requested when the link is followed. A call site that really wants a prefetch can pass `prefetch` explicitly.
 */
export default function Link({ prefetch = false, ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={prefetch} {...props} />;
}
