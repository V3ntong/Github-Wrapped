import type { Persona, Streak } from "./types";

export interface PersonaInput {
  longestStreak: Streak;
  weekendShare: number;
  languageCount: number;
  reviews: number;
  commits: number;
}

export function computePersona(input: PersonaInput): Persona {
  if (input.longestStreak.length >= 30) {
    return {
      key: "streak-machine",
      label: "Streak Machine",
      description:
        "Thirty days or more without breaking the chain. Consistency is your superpower.",
    };
  }

  if (input.weekendShare > 40) {
    return {
      key: "weekend-warrior",
      label: "Weekend Warrior",
      description:
        "Most of your contributions landed on Saturdays and Sundays. Weekends are for shipping.",
    };
  }

  if (input.languageCount >= 6) {
    return {
      key: "polyglot",
      label: "Polyglot",
      description:
        "Six or more languages in one year. You collect syntaxes like souvenirs.",
    };
  }

  if (input.reviews > input.commits / 4) {
    return {
      key: "reviewer",
      label: "Reviewer",
      description:
        "You spent as much time improving other people's code as writing your own.",
    };
  }

  return {
    key: "builder",
    label: "Builder",
    description:
      "Steady commits, useful pull requests, and a year of getting things done.",
  };
}
