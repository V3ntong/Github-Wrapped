import { NextResponse } from "next/server";
import type { Request } from "express";

import GitHubClient from "../../lib/github/client";
import { validateUsername } from "../../lib/validation";
import { checkRateLimit, getClientIp } from "../../lib/rate-limit";
import { computeStats } from "../../lib/stats/index";

const RATE_LIMIT_KEY = "api-wrapped";

export async function GET(
  request: Request,
  { params }: { params: { username: string } }
) {
  const username = params.username;
  const yearParam = new URL(request.url).searchParams.get("year");

  // Validate username
  const validation = validateUsername(username);
  if (!validation.success) {
    return NextJSONError(400, validation.error);
  }

  // IP-based rate limit (simple in-memory)
  const ip = getClientIp(request);
  const { allowed } = checkRateLimit(`${RATE_LIMIT_KEY}:${ip}`);
  if (!allowed) {
    const resetAt = checkRateLimit(`${RATE_LIMIT_KEY}:${ip}`, 30, 60_000).resetAt;
    return NextJSONError(429, "Rate limited. Please try again later.", resetAt);
  }

  // Validate and resolve year
  let year = new Date().getUTCFullYear();
  if (yearParam) {
    const yearResult = validateYearSchema.safeParse(Number(yearParam));
    if (!yearResult.success) {
      return NextJSONError(400, "Invalid year parameter.");
    }
    year = yearResult.data;
  }

  // Fetch from GitHub
  try {
    const githubResult = await GitHubClient.getWrappedData(
      validation.username,
      year
    );
    if (!githubResult.data?.user) {
      return NextJSONError(404, "User not found on GitHub.");
    }

    // Map raw data to StatsInput
    const collection = githubResult.data.user.contributionsCollection;
    const days = collection?.contributionCalendar?.weeks?.flatMap(
      (w) => w.contributionDays ?? []
    ) ?? [];

    const input: Parameters<typeof computeStats>[0] = {
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
        login: githubResult.data.user.login ?? validation.username,
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
    if (err instanceof Error && err.name === "GitHubApiError") {
      const apiErr = err as any; // hacky but we dont import GitHubApiError here explicitly maybe
      switch (apiErr.code) {
        case "USER_NOT_FOUND":
          return NextJSONError(404, apiErr.message);
        case "RATE_LIMITED":
          return NextJSONError(429, apiErr.message, apiErr.retryAfter);
        case "UNAUTHORIZED":
        case "UPSTREAM_ERROR":
          return NextJSONError(502, apiErr.message);
        default:
          return NextJSONError(502, apiErr.message);
      }
    }
    // Generic error
    return NextJSONError(500, "Unexpected error. Please try again later.");
  }
}

function NextJSONError(status: number, message: string, resetAt?: Date) {
  const body = { error: message };
  if (resetAt) {
    body.retryAfter = Math.ceil(resetAt.getTime() / 1000);
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function validateYearSchema(year: number): year is number {
  return Number.isInteger(year) && year >= 2008 && year <= 2026;
}

function buildRepos(
  contributions: any[] | null
): { name: string; nameWithOwner: string; url: string; isFork: boolean; commits: number }[] {
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