/** Narrow JSON error bodies from `/api/*` routes (`{ error: string }`). */

export interface ErrorResponseBody {
  error: string;
}

export function isErrorResponseBody(
  value: unknown,
): value is ErrorResponseBody {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as ErrorResponseBody).error === "string"
  );
}
