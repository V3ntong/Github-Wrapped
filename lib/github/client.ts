import "server-only";
import type { FetchCreateContextFn, HMR } from "next";
import type { GitHubApiError, GitHubApiError as GitHubError } from "./errors";
import type { DayContribution } from "../stats/types";
import { GRAPHQL_QUERY } from "./queries";
import { mapGitHubError } from "./errors";

const GITHUB_GRAPHQL_ENDPOINT = "https://api.github.com/graphql";
const REVALIDATE_SECONDS = 3600;

const GITHUB_GRAPHQL_ERROR_KEYS = [
  "NOT_FOUND",
  "RATE_LIMITED",
  "UNAUTHORIZED",
  "UPSTREAM_ERROR",
];

export interface RawGitHubResponse {
  user: {
    login: string | null;
    name: string | null;
    avatarUrl: string | null;
    followers: { totalCount: number } | null;
    contributionsCollection: {
      contributionYears: number[];
      totalCommitContributions: number;
      totalPullRequestContributions: number;
      totalIssueContributions: number;
      totalPullRequestReviewContributions: number;
      restrictedContributionsCount: number | null;
      contributionCalendar: {
        totalContributions: number;
        weeks: { contributionDays: { date: string; contributionCount: number }[] }[];
      };
      commitContributionsByRepository: {
        contributions: { totalCount: number };
        repository: {
          name: string;
          nameWithOwner: string;
          url: string;
          isFork: boolean;
          owner: { login: string };
          primaryLanguage: { name: string; color: string | null } | null;
          languages: {
            edges: { size: number; node: { name: string; color: string | null } }[];
          };
        }[];
      } | null;
    };
    rateLimit: { cost: number; remaining: number; resetAt: string } | null;
  } | null;
}

interface CacheEntry {
  data: RawGitHubResponse;
  expires: number;
}

class GitHubClient {
  private static readonly memoryCache = new Map<string, CacheEntry>();
  private static inflight = new Map<string, Promise<RawGitHubResponse>>();

  private static getToken(): string {
    const token = (global as any).process?.env?.GITHUB_TOKEN;
    if (!token) {
      throw new GitHubError(
        "UNAUTHORIZED",
        "GitHub token is not configured. Set GITHUB_TOKEN in .env.local.",
        502,
      );
    }
    return token;
  }

  private static getCacheKey(username: string, year: number): string {
    return `${username.toLowerCase()}:${year}`;
  }

  private static async fetchWithCache(
    username: string,
    year: number,
  ): Promise<RawGitHubResponse> {
    const key = this.getCacheKey(username, year);
    const now = Date.now();

    // Check in-memory cache
    const cached = this.memoryCache.get(key);
    if (cached && cached.expires > now) {
      return cached.data;
    }

    // Inflight dedup
    if (this.inflight.has(key)) {
      return this.inflight[key];
    }

    const token = this.getToken();
    const nowDate = new Date();
    const isCurrentYear = year === nowDate.getUTCFullYear();
    const from = `${year}-01-01T00:00:00Z`;
    const to = isCurrentYear
      ? nowDate.toISOString()
      : `${year}-12-31T23:59:59Z`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const promise = fetch(GITHUB_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `bearer ${token}`,
        "User-Agent": "github-wrapped",
      },
      body: JSON.stringify({
        query: GRAPHQL_QUERY,
        variables: { login: username, from, to },
      }),
      next: { revalidate: REVALIDATE_SECONDS, tags: [`wrapped:${key}`] },
      signal: controller.signal,
    })
      .then(async (res) => {
        clearTimeout(timeoutId);
        if (!res.ok) {
          const errBody = await res.text();
          throw mapGitHubError(res.status, errBody);
        }
        const json = (await res.json()) as {
          data?: RawGitHubResponse;
          errors?: { message?: string; type?: string }[];
        };

        if (json.errors?.length) {
          const errMsg = json.errors
            .map((e) => e.message ?? "GraphQL error")
            .join(", ");
          if (errMsg.includes("NOT_FOUND")) {
            throw new GitHubError("USER_NOT_FOUND", errMsg, 404);
          }
          if (errMsg.includes("rate limit") || errMsg.includes("RATE_LIMITED")) {
            throw new GitHubError("RATE_LIMITED", errMsg, 429);
          }
          if (errMsg.includes("UNAUTHORIZED") || errMsg.includes("bad credentials")) {
            throw new GitHubError("UNAUTHORIZED", errMsg, 401);
          }
          throw new GitHubError("UPSTREAM_ERROR", errMsg, 502);
        }

        if (!json.data?.user) {
          throw new GitHubError("USER_NOT_FOUND", "User data not found.", 404);
        }

        const rateLimit = json.data.rateLimit
          ? { cost: json.data.rateLimit.cost, remaining: json.data.rateLimit.remaining, resetAt: json.data.rateLimit.resetAt }
          : { cost: 1, remaining: 0, resetAt: "" };

        return {
          user: {
            login: json.data.user.login ?? null,
            name: json.data.user.name ?? null,
            avatarUrl: json.data.user.avatarUrl ?? null,
            followers: json.data.user.followers ?? null,
            contributionsCollection: {
              contributionYears:
                json.data.user.contributionsCollection?.contributionYears ??
                [],
              totalCommitContributions:
                json.data.user.contributionsCollection?.totalCommitContributions ??
                0,
              totalPullRequestContributions:
                json.data.user.contributionsCollection?.totalPullRequestContributions ??
                0,
              totalIssueContributions:
                json.data.user.contributionsCollection?.totalIssueContributions ??
                0,
              totalPullRequestReviewContributions:
                json.data.user.contributionsCollection?.totalPullRequestReviewContributions ??
                0,
              restrictedContributionsCount:
                json.data.user.contributionsCollection?.restrictedContributionsCount ??
                null,
              contributionCalendar: {
                totalContributions:
                  json.data.user.contributionsCollection?.contributionCalendar?.totalContributions ??
                  0,
                weeks: json.data.user.contributionsCollection?.contributionCalendar
                  ?.weeks?.map((w) => ({
                    contributionDays: w.contributionDays?.map(
                      (d) => ({
                        date: d.date ?? "",
                        contributionCount: d.contributionCount ?? 0,
                      }) ?? [],
                  })) ?? [],
              },
              commitContributionsByRepository:
                json.data.user.contributionsCollection?.commitContributionsByRepository ??
                null,
            },
          },
          rateLimit,
        } as RawGitHubResponse;
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        if (err instanceof GitHubError) throw err;
        throw new GitHubError(
          "UPSTREAM_ERROR",
          `Unexpected fetch error: ${err instanceof Error ? err.message : err}`,
          502,
        );
      })
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, promise);

    try {
      const result = await promise;
      // Store in memory cache with TTL
      this.memoryCache.set(key, {
        data: result,
        expires: now + REVALIDATE_SECONDS * 1000,
      });
      return result;
    } finally {
      this.inflight.delete(key);
    }
  }

  static async getWrappedData(
    username: string,
    year?: number,
  ): Promise<{
    data: RawGitHubResponse;
    username: string;
    year: number;
    isPartialYear: boolean;
    availableYears: number[];
    now: Date;
  }> {
    const yearToUse = year ?? new Date().getUTCFullYear();
    const now = new Date();
    const isPartialYear = yearToUse === now.getUTCFullYear();
    const { data } = await this.fetchWithCache(username, yearToUse);
    const availableYears =
      data?.user?.contributionsCollection?.contributionYears ?? [];

    return {
      data,
      username,
      year: yearToUse,
      isPartialYear,
      availableYears,
      now,
    };
  }
}

export default GitHubClient;