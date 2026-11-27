// The preview's choices: whether a frame can be expected to work, what to call each route, and
// the widths the frame can take.

/**
 * Whether address is on another site than the page: on a networked core the page is
 * nearhost.<domain> and a project's names under that domain are its own; an alias outside it is
 * another site, where the browser keeps the project's cookies from the frame. Off a networked
 * name no domain is known, so nothing is taken to be cross-site.
 */
export function isCrossSite(address: string, pageHost: string): boolean {
  const domain = pageHost.toLowerCase().startsWith('nearhost.')
    ? pageHost.slice('nearhost.'.length).toLowerCase()
    : undefined;
  let host: string;
  try {
    host = new URL(address).hostname.toLowerCase();
  } catch {
    return true;
  }
  if (!domain) return false;
  return host !== domain && !host.endsWith(`.${domain}`);
}

/** A route's name without the primary route's domain: storefront, mail.storefront. */
export function routeLabel(host: string, primaryHost: string): string {
  const dot = primaryHost.indexOf('.');
  if (dot < 0) return host;
  const domain = primaryHost.slice(dot);
  return host.endsWith(domain) && host.length > domain.length
    ? host.slice(0, -domain.length)
    : host;
}

export type FrameWidth = 'fill' | 'tablet' | 'phone';

/** The frame's widths: the whole area, an iPad in portrait, a phone (the canvas's sizes). */
export const frameWidths: { id: FrameWidth; width: number | undefined; label: string }[] = [
  { id: 'fill', width: undefined, label: 'Fill' },
  { id: 'tablet', width: 834, label: 'Tablet width' },
  { id: 'phone', width: 390, label: 'Phone width' },
];

/** How long the frame has to fire load before the preview says it didn't load. */
export const loadTimeout = 8_000;
