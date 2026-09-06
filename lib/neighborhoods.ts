// Omaha neighborhood/district names aren't points of interest in OSM, so they
// never show up as rows in `places` — "near: downtown" has nothing to resolve
// against otherwise. These coordinates are the average location of businesses
// in the dataset whose name references each district (e.g. every "Downtown ..."
// hotel), not surveyed boundaries — approximate, but grounded in real data
// rather than guessed.
export const NEIGHBORHOODS: Record<string, { lat: number; lon: number }> = {
  downtown: { lat: 41.2621, lon: -95.9337 },
  "old market": { lat: 41.2569, lon: -95.9312 },
  dundee: { lat: 41.2636, lon: -95.9904 },
  benson: { lat: 41.2875, lon: -96.011 },
  blackstone: { lat: 41.258, lon: -95.9727 },
  midtown: { lat: 41.2525, lon: -95.9581 },
  aksarben: { lat: 41.2404, lon: -96.0158 },
  florence: { lat: 41.3361, lon: -95.9587 },
  "south omaha": { lat: 41.2037, lon: -95.9482 },
  elmwood: { lat: 41.2534, lon: -96.0091 },
  rockbrook: { lat: 41.2282, lon: -96.0597 },
  ralston: { lat: 41.2058, lon: -96.0364 },
  "bemis park": { lat: 41.2687, lon: -95.9643 },
};

export function resolveNeighborhood(near: string): { lat: number; lon: number } | null {
  const normalized = near.toLowerCase();
  for (const [key, coords] of Object.entries(NEIGHBORHOODS)) {
    if (normalized.includes(key)) return coords;
  }
  return null;
}
