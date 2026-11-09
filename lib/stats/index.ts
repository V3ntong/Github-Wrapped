import {
  activeDays,
  averagePerActiveDay,
  busiestDay,
  busiestMonth,
  normalizeDays,
  totalContributions,
  weekdayDistribution,
  weekendShare,
} from "./contributions";
import { languageShares, topRepositories } from "./languages";
import { computePersona } from "./persona";
import { currentStreak, longestStreak } from "./streaks";
import type { StatsInput, WrappedStats } from "./types";

export * from "./types";

export function computeStats(input: StatsInput): WrappedStats {
  const days = normalizeDays(input.days);
  const total = totalContributions(days);
  const longest = longestStreak(days);
  const languages = languageShares(input.repos);
  const weekend = weekendShare(days);

  return {
    totalContributions: total,
    activeDays: activeDays(days),
    averagePerActiveDay: averagePerActiveDay(days),
    longestStreak: longest,
    currentStreak: currentStreak(days),
    busiestDay: busiestDay(days),
    busiestMonth: busiestMonth(days),
    weekdayDistribution: weekdayDistribution(days),
    weekendShare: weekend,
    topRepos: topRepositories(input.repos),
    topLanguages: languages.slice(0, 5),
    languageCount: languages.length,
    commits: input.commits,
    pullRequests: input.pullRequests,
    issues: input.issues,
    reviews: input.reviews,
    persona: computePersona({
      longestStreak: longest,
      weekendShare: weekend,
      languageCount: languages.length,
      reviews: input.reviews,
      commits: input.commits,
    }),
  };
}
