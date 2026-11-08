/**
 * Which calls THIS browser tab owns. An officer may have several console tabs open; only the tab
 * that answered or placed a call runs WebRTC, otherwise two tabs would send competing offers.
 */
const claimed = new Set<number>();
const listeners = new Set<() => void>();

export function claimCall(id: number) {
  claimed.add(id);
  listeners.forEach((l) => l());
}
export function isClaimed(id: number) {
  return claimed.has(id);
}
export function onClaimsChange(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
