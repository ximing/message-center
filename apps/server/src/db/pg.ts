/** Walk DrizzleQueryError.cause (and nested) — pg `code` is not on the wrapper. */
export function pgErrorCode(err: unknown): string | undefined {
  const seen = new Set<unknown>();
  let current: unknown = err;
  while (
    typeof current === "object" &&
    current !== null &&
    !seen.has(current)
  ) {
    seen.add(current);
    if ("code" in current && typeof current.code === "string")
      return current.code;
    if (!("cause" in current)) break;
    current = current.cause;
  }
  return undefined;
}

export function isUniqueViolation(err: unknown): boolean {
  return pgErrorCode(err) === "23505";
}

export function isForeignKeyViolation(err: unknown): boolean {
  // RESTRICT deletes can surface as restrict_violation rather than foreign_key_violation.
  const code = pgErrorCode(err);
  return code === "23503" || code === "23001";
}
