import { describe, expect, it } from "vitest";
import {
  addDays,
  diffInDays,
  isWeekend,
  parseUTCDate,
} from "./dates";
import {
  busiestDay,
  busiestMonth,
  normalizeDays,
  totalContributions,
  weekdayDistribution,
  weekendShare,
} from "./contributions";
import { computeStats } from "./index";
import { languageShares, topRepositories } from "./languages";
import { computePersona } from "./persona";
import { currentStreak, longestStreak } from "./streaks";
import type { RepoContribution, StatsInput } from "./types";

function day(date: string, count: number) {
  return { date, count };
}

function repo(overrides: Partial<RepoContribution> = {}): RepoContribution {
  return {
    name: "project",
    nameWithOwner: "V3ntong/project",
    url: "https://github.com/V3ntong/project",
    isFork: false,
    commits: 10,
    primaryLanguage: { name: "TypeScript", color: "#3178c6", size: 100 },
    languages: [
      { name: "TypeScript", color: "#3178c6", size: 75 },
      { name: "JavaScript", color: "#f1e05a", size: 25 },
    ],
    ...overrides,
  };
}

function emptyInput(overrides: Partial<StatsInput> = {}): StatsInput {
  return {
    year: 2026,
    days: [],
    commits: 0,
    pullRequests: 0,
    issues: 0,
    reviews: 0,
    repos: [],
    ...overrides,
  };
}

describe("date helpers", () => {
  it("handles leap day and year boundaries in UTC", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2024-12-31", 1)).toBe("2025-01-01");
    expect(addDays("2025-01-01", -1)).toBe("2024-12-31");
    expect(diffInDays("2025-01-01", "2024-12-31")).toBe(1);
    expect(parseUTCDate("2024-02-29").getUTCDate()).toBe(29);
  });

  it("marks Saturday and Sunday as weekend", () => {
    expect(isWeekend("2026-03-07")).toBe(true);
    expect(isWeekend("2026-03-08")).toBe(true);
    expect(isWeekend("2026-03-09")).toBe(false);
  });
});

describe("streaks", () => {
  it("finds a longest streak across a month boundary", () => {
    const days = [
      day("2026-01-29", 1),
      day("2026-01-30", 2),
      day("2026-01-31", 1),
      day("2026-02-01", 3),
      day("2026-02-03", 1),
    ];

    expect(longestStreak(days)).toEqual({
      length: 4,
      start: "2026-01-29",
      end: "2026-02-01",
    });
  });

  it("returns an empty longest streak for a year with no contributions", () => {
    expect(longestStreak([])).toEqual({ length: 0, start: null, end: null });
    expect(longestStreak([day("2026-01-01", 0)])).toEqual({
      length: 0,
      start: null,
      end: null,
    });
  });

  it("counts the current streak ending at the reference date", () => {
    const days = [
      day("2026-01-01", 1),
      day("2026-01-02", 1),
      day("2026-01-04", 1),
      day("2026-01-05", 1),
      day("2026-01-06", 1),
    ];

    expect(currentStreak(days, "2026-01-06")).toEqual({
      length: 3,
      start: "2026-01-04",
      end: "2026-01-06",
    });
  });

  it("allows a single quiet day at the start of the current streak", () => {
    const days = [day("2025-12-30", 1), day("2025-12-31", 1)];

    expect(currentStreak(days, "2026-01-01")).toEqual({
      length: 2,
      start: "2025-12-30",
      end: "2025-12-31",
    });
  });

  it("returns zero when the last contribution is older than one day", () => {
    const days = [day("2026-01-01", 1), day("2026-01-02", 1)];

    expect(currentStreak(days, "2026-01-05")).toEqual({
      length: 0,
      start: null,
      end: null,
    });
  });
});

describe("contribution aggregates", () => {
  it("handles an empty year without NaN values", () => {
    const stats = computeStats(emptyInput());

    expect(stats.totalContributions).toBe(0);
    expect(stats.activeDays).toBe(0);
    expect(stats.averagePerActiveDay).toBe(0);
    expect(stats.weekendShare).toBe(0);
    expect(stats.busiestDay).toBeNull();
    expect(stats.busiestMonth).toBeNull();
    expect(stats.topLanguages).toEqual([]);
    expect(stats.topRepos).toEqual([]);
    expect(stats.persona.key).toBe("builder");
    expect(stats.weekdayDistribution).toHaveLength(7);
    expect(stats.weekdayDistribution.every((entry) => entry.count === 0)).toBe(
      true,
    );
  });

  it("total, average, and active days ignore invalid and zero-count days", () => {
    const days = [
      day("2026-01-01", 2),
      day("2026-01-02", 0),
      day("2026-01-03", 4),
      day("not-a-date", 10),
    ];

    expect(totalContributions(days)).toBe(6);
    expect(normalizeDays(days)).toHaveLength(3);

    const stats = computeStats(emptyInput({ days }));
    expect(stats.activeDays).toBe(2);
    expect(stats.averagePerActiveDay).toBe(3);
  });

  it("picks the earliest day and month on a tie", () => {
    const days = [
      day("2026-02-03", 4),
      day("2026-01-10", 4),
      day("2026-03-01", 1),
    ];

    expect(busiestDay(days)).toEqual({ date: "2026-01-10", count: 4 });
    expect(busiestMonth(days)?.month).toBe("2026-01");
  });

  it("computes weekday distribution and weekend share", () => {
    const days = [
      day("2026-03-07", 3),
      day("2026-03-08", 1),
      day("2026-03-09", 6),
    ];

    const distribution = weekdayDistribution(days);
    expect(distribution.find((entry) => entry.weekday === 6)?.count).toBe(3);
    expect(distribution.find((entry) => entry.weekday === 0)?.count).toBe(1);
    expect(distribution.find((entry) => entry.weekday === 1)?.count).toBe(6);
    expect(weekendShare(days)).toBe(40);
  });

  it("aggregates a busiest month across a year boundary", () => {
    const days = [day("2025-12-31", 2), day("2026-01-01", 3)];
    expect(busiestMonth(days)?.month).toBe("2026-01");
    expect(busiestMonth(days)?.count).toBe(3);
  });
});

describe("languages", () => {
  it("weights repository languages by commit contributions", () => {
    const shares = languageShares([
      repo({ commits: 10 }),
      repo({
        commits: 30,
        languages: [{ name: "JavaScript", color: "#f1e05a", size: 100 }],
        primaryLanguage: { name: "JavaScript", color: "#f1e05a", size: 100 },
      }),
    ]);

    const byName = new Map(shares.map((share) => [share.name, share.percent]));
    expect(byName.get("JavaScript")).toBe(81.3);
    expect(byName.get("TypeScript")).toBe(18.8);
    expect(shares[0].name).toBe("JavaScript");
  });

  it("falls back to the primary language when size data is missing", () => {
    const shares = languageShares([
      repo({
        languages: [],
        primaryLanguage: { name: "Rust", color: "#dea584", size: 0 },
      }),
    ]);

    expect(shares).toEqual([
      { name: "Rust", color: "#dea584", percent: 100, weight: 10 },
    ]);
  });

  it("ignores repositories with no commits or languages", () => {
    expect(languageShares([repo({ commits: 0 })])).toEqual([]);
    expect(
      languageShares([repo({ languages: [], primaryLanguage: null })]),
    ).toEqual([]);
  });

  it("sorts top repositories by commits and excludes zero-commit repos", () => {
    const repos = [
      repo({ nameWithOwner: "a/one", name: "one", commits: 2 }),
      repo({ nameWithOwner: "b/two", name: "two", commits: 9 }),
      repo({ nameWithOwner: "c/three", name: "three", commits: 0 }),
    ];

    expect(topRepositories(repos).map((entry) => entry.nameWithOwner)).toEqual([
      "b/two",
      "a/one",
    ]);
  });
});

describe("persona", () => {
  it("uses the documented rule order", () => {
    expect(
      computePersona({
        longestStreak: { length: 30, start: "2026-01-01", end: "2026-01-30" },
        weekendShare: 90,
        languageCount: 10,
        reviews: 100,
        commits: 1,
      }).key,
    ).toBe("streak-machine");

    expect(
      computePersona({
        longestStreak: { length: 5, start: "2026-01-01", end: "2026-01-05" },
        weekendShare: 41,
        languageCount: 10,
        reviews: 100,
        commits: 1,
      }).key,
    ).toBe("weekend-warrior");

    expect(
      computePersona({
        longestStreak: { length: 5, start: "2026-01-01", end: "2026-01-05" },
        weekendShare: 10,
        languageCount: 6,
        reviews: 100,
        commits: 1,
      }).key,
    ).toBe("polyglot");

    expect(
      computePersona({
        longestStreak: { length: 5, start: "2026-01-01", end: "2026-01-05" },
        weekendShare: 10,
        languageCount: 3,
        reviews: 26,
        commits: 100,
      }).key,
    ).toBe("reviewer");

    expect(
      computePersona({
        longestStreak: { length: 5, start: "2026-01-01", end: "2026-01-05" },
        weekendShare: 10,
        languageCount: 3,
        reviews: 10,
        commits: 100,
      }).key,
    ).toBe("builder");
  });
});
