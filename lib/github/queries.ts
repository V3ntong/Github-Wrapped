export const GRAPHQL_QUERY = `query Wrapped($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    login
    name
    avatarUrl
    followers { totalCount }
    contributionsCollection(from: $from, to: $to) {
      contributionYears
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalPullRequestReviewContributions
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            date
            contributionCount
          }
        }
      }
      commitContributionsByRepository(maxRepositories: 100) {
        contributions {
          totalCount
        }
        repository {
          name
          nameWithOwner
          url
          isFork
          owner { login }
          primaryLanguage { name color }
          languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
            edges {
              size
              node {
                name
                color
              }
            }
          }
        }
      }
    }
    rateLimit { cost remaining resetAt }
  }
}`;