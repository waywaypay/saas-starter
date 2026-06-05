import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * Uniform JSON error envelope returned by every route handler. Keeping one
 * shape (and one helper to build it) means clients can rely on `error.code`
 * and we never accidentally leak a stack trace to the wire.
 */
export interface ApiError {
  error: {
    code: ApiErrorCode;
    message: string;
    /** Field-level validation issues, when applicable. */
    details?: Record<string, string[] | undefined>;
  };
}

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL: 500,
};

/** Typed success response. */
export function respondOk<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, init);
}

/** Typed error response with the correct status for the code. */
export function respondError(
  code: ApiErrorCode,
  message: string,
  details?: Record<string, string[] | undefined>,
): NextResponse<ApiError> {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status: STATUS_BY_CODE[code] },
  );
}

/**
 * Thrown by services to signal an HTTP-meaningful failure. Route handlers
 * translate these into the matching status; anything else becomes a 500 with a
 * generic message (real error logged server-side).
 */
export class HttpError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: Record<string, string[] | undefined>,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * Single catch-block translator for route handlers. Logs the real error
 * server-side and returns a safe, typed envelope.
 */
export function handleRouteError(
  err: unknown,
  context: string,
): NextResponse<ApiError> {
  if (err instanceof HttpError) {
    return respondError(err.code, err.message, err.details);
  }
  if (err instanceof ZodError) {
    return respondError("BAD_REQUEST", "Invalid request", err.flatten().fieldErrors);
  }
  // Unknown/unexpected: log the truth, return a generic message.
  console.error(`[${context}]`, err);
  return respondError("INTERNAL", "An unexpected error occurred");
}
