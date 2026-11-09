import { NextResponse } from "next/server";
import type { Request } from "next";

import { validateUsername, yearSchema } from "@/lib/validation";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { GitHubClient } from "@/lib/github/client";
import { GitHubApiError } from "@/lib/github/errors";

const RATE_LIMIT_KEY = "api-wrapped";

interface RepoContributionShort {
  name: string;
  nameWithOwner: string;
  url: string;
  isFork: boolean;
  commits: number;
}

interface CommitContribution {
  contributions: { totalCount: number };
  repository: {
    name: string;
    nameWithOwner: string;
    url: string;
    isFork: boolean;
  };
}

function buildRepos(contributions: CommitContribution[] | null): RepoContributionShort[] {
  if (!contributions) return [];
  return contributions
    .map((c) => ({
      name: c.repository?.name ?? "",
      nameWithOwner: c.repository?.nameWithOwner ?? "",
      url: c.repository?.url ?? "",
      isFork: c.repository?.isFork ?? false,
      commits: c.contributions?.totalCount ?? 0,
    }))
    .filter((r) => r.commits > 0);
}

function errorJson(status: number, message: string, resetAt?: Date): NextResponse {
  const body: Record<string, unknown> = { error: message };
  if (resetAt) {
    body.retryAfter = Math.ceil(resetAt.getTime() / 1000);
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  // Validate username
  const usernameValidation = validateUsername(username);
  if (!usernameValidation.success) {
    return errorJson(400, usernameValidation.error);
  }

  // Check GitHub token
  if (!process.env.GITHUB_TOKEN) {
    return errorJson(
      500,
      "MISSING_TOKEN. Set GITHUB_TOKEN in .env.local.",
    );
  }

  // Read and validate year
  const yearParam = new URL(request.url).searchParams.get("year");
  let year = new Date().getUTCFullYear();
  if (yearParam) {
    const yearResult = yearSchema.safeParse(Number(yearParam));
    if (!yearResult.success) {
      return errorJson(400, "Invalid year parameter.");
    }
    year = yearResult.data;
  }

  // IP-based rate limit (simple in-memory)
  const ip = getClientIp(request);
  const { allowed } = checkRateLimit(`${RATE_LIMIT_KEY}:${ip}`);
  if (!allowed) {
    const resetResult = checkRateLimit(`${RATE_LIMIT_KEY}:${ip}`, 30, 60_000);
    return errorJson(
      429,
      "Rate limited. Please try again later.",
      resetResult.resetAt,
    );
  }

  // Fetch from GitHub
  try {
    const githubResult = await GitHubClient.getWrappedData(username, year);

    // Map raw data to StatsInput
    const collection = githubResult.data?.user?.contributionsCollection;
    const days = collection?.contributionCalendar?.weeks?.flatMap(
      (w) => w.contributionDays ?? []
    ) ?? [];

    const input = {
      year: githubResult.year,
      days,
      commits: collection?.totalCommitContributions ?? 0,
      pullRequests: collection?.totalPullRequestContributions ?? 0,
      issues: collection?.totalIssueContributions ?? 0,
      reviews: collection?.totalPullRequestReviewContributions ?? 0,
      repos: buildRepos(collection?.commitContributionsByRepository ?? []),
    };

    const stats = computeStats(input);

    const payload = {
      stats,
      profile: {
        login: githubResult.data.user.login ?? username,
        name: githubResult.data.user.name ?? null,
        avatarUrl: githubResult.data.user.avatarUrl ?? null,
        followers: githubResult.data.user.followers?.totalCount ?? 0,
      },
      year: githubResult.year,
      isPartialYear: githubResult.isPartialYear,
      availableYears: githubResult.availableYears,
    };

    const response = NextResponse.json(payload, {
      status: 200,
    });
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=86400"
    );
    return response;
  } catch (err) {
    if (err instanceof GitHubApiError) {
      switch (err.code) {
        case "USER_NOT_FOUND":
          return errorJson(404, err.message);
        case "RATE_LIMITED":
          return errorJson(
            429,
            err.message,
            err.retryAfter,
          );
        case "UNAUTHORIZED":
        case "UPSTREAM_ERROR":
          return errorJson(502, err.message);
        default:
          return errorJson(502, err.message);
      }
    }
    // Generic error
    return errorJson(500, "Unexpected error. Please try again later.");
  }
}