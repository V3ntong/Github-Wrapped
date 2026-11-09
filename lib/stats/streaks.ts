import { addDays, diffInDays } from "./dates";
import type { DayContribution, Streak } from "./types";

const EMPTY_STREAK: Streak = { length: 0, start: null, end: null };

function sortActiveDays(days: DayContribution[]): DayContribution[] {
  return days
    .filter((day) => day.count > 0)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function longestStreak(days: DayContribution[]): Streak {
  const active = sortActiveDays(days);
  if (active.length === 0) return { ...EMPTY_STREAK };

  let best: Streak = {
    length: 1,
    start: active[0].date,
    end: active[0].date,
  };
  let runStart = active[0].date;
  let runLength = 1;

  for (let i = 1; i < active.length; i += 1) {
    const previous = active[i - 1].date;
    const current = active[i].date;

    if (diffInDays(current, previous) === 1) {
      runLength += 1;
    } else if (current !== previous) {
      runStart = current;
      runLength = 1;
    }

    if (runLength > best.length) {
      best = { length: runLength, start: runStart, end: current };
    }
  }

  return best;
}

export function currentStreak(
  days: DayContribution[],
  referenceDate?: string,
): Streak {
  const active = sortActiveDays(days);
  if (active.length === 0) return { ...EMPTY_STREAK };

  const mostRecent = referenceDate ?? active[active.length - 1].date;
  const activeByDate = new Map(active.map((day) => [day.date, day.count]));

  let cursor = mostRecent;
  if (!activeByDate.has(cursor)) {
    cursor = addDays(cursor, -1);
    if (!activeByDate.has(cursor)) return { ...EMPTY_STREAK };
  }

  const end = cursor;
  let length = 0;
  while (activeByDate.has(cursor)) {
    length += 1;
    cursor = addDays(cursor, -1);
  }

  return { length, start: addDays(end, -(length - 1)), end };
}
