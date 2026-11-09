import type {
  LanguageShare,
  RepoContribution,
  TopRepo,
} from "./types";

const FALLBACK_COLORS = ["#FF6B5B", "#F4EDE0", "#9DB2D9", "#F2A65A"];

function round(value: number, precision = 1): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function topRepositories(
  repos: RepoContribution[],
  limit = 5,
): TopRepo[] {
  return repos
    .filter((repo) => repo.commits > 0)
    .slice()
    .sort(
      (a, b) =>
        b.commits - a.commits || a.nameWithOwner.localeCompare(b.nameWithOwner),
    )
    .slice(0, limit)
    .map((repo) => ({
      name: repo.name,
      nameWithOwner: repo.nameWithOwner,
      url: repo.url,
      commits: repo.commits,
      isFork: repo.isFork,
      primaryLanguage: repo.primaryLanguage,
    }));
}

export function languageShares(repos: RepoContribution[]): LanguageShare[] {
  const weights = new Map<
    string,
    { name: string; color: string | null; weight: number }
  >();

  for (const repo of repos) {
    if (repo.commits <= 0) continue;

    const totalSize = repo.languages.reduce(
      (sum, language) => sum + Math.max(0, language.size),
      0,
    );

    if (totalSize > 0) {
      for (const language of repo.languages) {
        if (language.size <= 0) continue;
        const current = weights.get(language.name);
        const weight = repo.commits * (language.size / totalSize);
        weights.set(language.name, {
          name: language.name,
          color: current?.color ?? language.color,
          weight: (current?.weight ?? 0) + weight,
        });
      }
    } else if (repo.primaryLanguage) {
      const current = weights.get(repo.primaryLanguage.name);
      weights.set(repo.primaryLanguage.name, {
        name: repo.primaryLanguage.name,
        color: current?.color ?? repo.primaryLanguage.color,
        weight: (current?.weight ?? 0) + repo.commits,
      });
    }
  }

  const totalWeight = [...weights.values()].reduce(
    (sum, entry) => sum + entry.weight,
    0,
  );

  if (totalWeight === 0) return [];

  return [...weights.values()]
    .map((entry, index) => ({
      name: entry.name,
      color: entry.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
      percent: round((entry.weight / totalWeight) * 100),
      weight: round(entry.weight, 2),
    }))
    .sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name));
}
