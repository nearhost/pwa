// The core's page host on this machine. It answers loopback clients only and lets them in with
// the page cookie, so a 401 there means the cookie is missing: pairing (and its /pair form, which
// only a networked core serves) is not the way in. The page address `nearhost status` prints is.
export const pageHost = 'nearhost.localhost';

/** Whether the app is open at the core's page host on this machine. */
export function onThisMachine(hostname: string): boolean {
  return hostname.toLowerCase().replace(/\.$/, '') === pageHost;
}
