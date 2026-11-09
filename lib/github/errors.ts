export class GitHubApiError extends Error {
  readonly code: "USER_NOT_FOUND" | "RATE_LIMITED" | "UNAUTHORIZED" | "UPSTREAM_ERROR";
  readonly status: number;
  readonly retryAfter?: number;
  constructor(
    code: "USER_NOT_FOUND" | "RATE_LIMITED" | "UNAUTHORIZED" | "UPSTREAM_ERROR",
    message: string,
    status = 502,
    retryAfter?: number,
  ) {
    super(message);
    this.code = code;
    this.message = message;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export function isGitHubApiError(error: unknown): error is GitHubApiError {
  return error instanceof GitHubApiError;
}

export function mapGitHubError(
  status: number,
  responseBody?: unknown,
): GitHubApiError {
  const parsedBody =
    typeof responseBody === "object" && responseBody !== null
      ? (responseBody as { message?: string; type?: string })
      : {};

  if (status === 401) {
    return new GitHubApiError(
      "UNAUTHORIZED",
      "Authentication failed. Check your GITHUB_TOKEN.",
      502,
    );
  }

  if (status === 403 || status === 429) {
    const resetAt = parsedBody.resetAt
      ? new Date(parsedBody.resetAt).getTime() / 1000
      : undefined;
    const remaining = parsedBody.remaining ?? 0;
    const cost = parsedBody.cost ?? 1;
    const used = cost - remaining;
    const wait = Math.max(0, resetAt - Math.floor(Date.now() / 1000));
    return new GitHubApiError(
      "RATE_LIMITED",
      "Rate limit exceeded. Please try again later.",
      429,
      wait > 0 ? wait * 1000 : undefined,
    );
  }

  const type = (parsedBody.type ?? "").toUpperCase();
  if (type === "NOT_FOUND" || (parsedBody.message ?? "").includes("Could not resolve")) {
    return new GitHubApiError("USER_NOT_FOUND", "User not found.", 404);
  }

  return new GitHubApiError(
    "UPSTREAM_ERROR",
    "Upstream GitHub error. Please try again later.",
    502,
  );
}