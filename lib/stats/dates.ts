const DAY_MS = 24 * 60 * 60 * 1000;

export function parseUTCDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatUTCDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: string, amount: number): string {
  return formatUTCDate(new Date(parseUTCDate(date).getTime() + amount * DAY_MS));
}

export function diffInDays(later: string, earlier: string): number {
  return Math.round(
    (parseUTCDate(later).getTime() - parseUTCDate(earlier).getTime()) / DAY_MS,
  );
}

export function isWeekend(date: string): boolean {
  const weekday = parseUTCDate(date).getUTCDay();
  return weekday === 0 || weekday === 6;
}

export function weekdayOf(date: string): number {
  return parseUTCDate(date).getUTCDay();
}

export function monthKeyOf(date: string): string {
  return date.slice(0, 7);
}
