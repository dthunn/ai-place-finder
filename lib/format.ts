// OSM's opening_hours syntax (e.g. "Mo-Sa 06:00-21:00; Su 08:00-16:00") is
// always 24-hour — convert just the time tokens to 12-hour, leaving day
// ranges/separators as-is.
export function formatOpeningHours(raw: string): string {
  return raw.replace(/\b([01]?\d|2[0-4]):([0-5]\d)\b/g, (_match, hourStr: string, minute: string) => {
    let hour = parseInt(hourStr, 10);
    if (hour === 24) hour = 0; // OSM uses 24:00 for midnight
    const period = hour < 12 ? "AM" : "PM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${minute} ${period}`;
  });
}
