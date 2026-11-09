import { z } from "zod";

const minYear = 2008;
export const usernameSchema = z
  .string()
  .trim()
  .min(1, "Username is required")
  .max(39, "Username must be at most 39 characters")
  .regex(
    /^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$/,
    "Username must contain only alphanumeric characters or single hyphens, not starting or ending with a hyphen"
  );

export function validateUsername(raw: string): { success: true; username: string } | { success: false; error: string } {
  const result = usernameSchema.safeParse(raw);
  if (result.success) {
    return { success: true, username: result.data };
  }
  return { success: false, error: result.error.errors[0].message };
}

export function currentYear(): number {
  return new Date().getUTCFullYear();
}

export const yearSchema = z.coerce
  .number()
  .int("Year must be an integer")
  .min(minYear, `Year must be at least ${minYear}`)
  .max(currentYear(), `Year must be at most the current year (${currentYear()})`);