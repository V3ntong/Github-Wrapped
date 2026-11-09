export interface DayContribution {
  date: string;
  count: number;
}

export interface RepoLanguage {
  name: string;
  color: string | null;
  size: number;
}

export interface RepoContribution {
  name: string;
  nameWithOwner: string;
  url: string;
  isFork: boolean;
  commits: number;
  primaryLanguage: RepoLanguage | null;
  languages: RepoLanguage[];
}

export interface StatsInput {
  year: number;
  days: DayContribution[];
  commits: number;
  pullRequests: number;
  issues: number;
  reviews: number;
  repos: RepoContribution[];
}

export interface Streak {
  length: number;
  start: string | null;
  end: string | null;
}

export interface DayCount {
  date: string;
  count: number;
}

export interface MonthCount {
  month: string;
  label: string;
  count: number;
}

export interface WeekdayCount {
  weekday: number;
  label: string;
  count: number;
}

export interface LanguageShare {
  name: string;
  color: string;
  percent: number;
  weight: number;
}

export interface TopRepo {
  name: string;
  nameWithOwner: string;
  url: string;
  commits: number;
  isFork: boolean;
  primaryLanguage: RepoLanguage | null;
}

export type PersonaKey =
  | "streak-machine"
  | "weekend-warrior"
  | "polyglot"
  | "reviewer"
  | "builder";

export interface Persona {
  key: PersonaKey;
  label: string;
  description: string;
}

export interface WrappedStats {
  totalContributions: number;
  activeDays: number;
  averagePerActiveDay: number;
  longestStreak: Streak;
  currentStreak: Streak;
  busiestDay: DayCount | null;
  busiestMonth: MonthCount | null;
  weekdayDistribution: WeekdayCount[];
  weekendShare: number;
  topRepos: TopRepo[];
  topLanguages: LanguageShare[];
  languageCount: number;
  commits: number;
  pullRequests: number;
  issues: number;
  reviews: number;
  persona: Persona;
}
