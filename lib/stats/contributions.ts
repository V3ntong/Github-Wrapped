import { isWeekend, monthKeyOf, weekdayOf } from "./dates";
import type {
  DayContribution,
  DayCount,
  MonthCount,
  WeekdayCount,
} from "./types";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function normalizeDays(days: DayContribution[]): DayContribution[] {
  return days
    .filter(
      (day) =>
        typeof day.date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(day.date) &&
        Number.isFinite(day.count) &&
        day.count >= 0,
    )
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function totalContributions(days: DayContribution[]): number {
  return normalizeDays(days).reduce((total, day) => total + day.count, 0);
}

export function activeDays(days: DayContribution[]): number {
  return normalizeDays(days).filter((day) => day.count > 0).length;
}

export function averagePerActiveDay(days: DayContribution[]): number {
  const total = totalContributions(days);
  const active = activeDays(days);
  return active === 0 ? 0 : Math.round((total / active) * 10) / 10;
}

export function busiestDay(days: DayContribution[]): DayCount | null {
  const normalized = normalizeDays(days);
  let best: DayCount | null = null;

  for (const day of normalized) {
    if (day.count <= 0) continue;
    if (!best || day.count > best.count) {
      best = { date: day.date, count: day.count };
    }
  }

  return best;
}

export function busiestMonth(days: DayContribution[]): MonthCount | null {
  const totals = new Map<string, number>();

  for (const day of normalizeDays(days)) {
    if (day.count <= 0) continue;
    const key = monthKeyOf(day.date);
    totals.set(key, (totals.get(key) ?? 0) + day.count);
  }

  let best: MonthCount | null = null;
  for (const [month, count] of totals) {
    if (!best || count > best.count) {
      const monthIndex = Number(month.slice(5, 7)) - 1;
      best = {
        month,
        label: `${MONTHS[monthIndex] ?? month} ${month.slice(0, 4)}`,
        count,
      };
    }
  }

  return best;
}

export function weekdayDistribution(days: DayContribution[]): WeekdayCount[] {
  const counts = new Array<number>(7).fill(0);

  for (const day of normalizeDays(days)) {
    counts[weekdayOf(day.date)] += day.count;
  }

  return counts.map((count, weekday) => ({
    weekday,
    label: WEEKDAYS[weekday],
    count,
  }));
}

export function weekendShare(days: DayContribution[]): number {
  const normalized = normalizeDays(days);
  const total = normalized.reduce((sum, day) => sum + day.count, 0);

  if (total === 0) return 0;

  const weekend = normalized
    .filter((day) => isWeekend(day.date))
    .reduce((sum, day) => sum + day.count, 0);

  return Math.round((weekend / total) * 1000) / 10;
}
