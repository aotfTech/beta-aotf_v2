import * as Sentry from "@sentry/nextjs";

import { AppError } from "@/lib/errors";

export interface ReportErrorContext {
  route?: string;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

export interface BackgroundErrorContext {
  operation: string;
  integration?: string;
  extra?: Record<string, unknown>;
}

/** Type guard for Zod errors (works across Zod v3 and v4) */
function isZodError(
  err: unknown,
): err is { issues: { path: (string | number)[]; message: string }[] } {
  return (
    typeof err === "object" &&
    err !== null &&
    "issues" in err &&
    Array.isArray((err as { issues: unknown }).issues)
  );
}

function isMongooseDuplicateKey(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: number }).code === 11000
  );
}

function isUserCancellation(error: unknown): boolean {
  if (error instanceof Error) {
    if (error.message === "Payment cancelled") return true;
    if (error.name === "AbortError") return true;
  }
  return false;
}

function isNextControlFlowError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    (error as { digest?: unknown }).digest === "DYNAMIC_SERVER_USAGE"
  );
}

/**
 * Returns false for expected operational errors (validation, 4xx, user cancel).
 */
export function shouldReportToSentry(error: unknown): boolean {
  if (isNextControlFlowError(error)) return false;
  if (isUserCancellation(error)) return false;
  if (isZodError(error)) return false;
  if (error instanceof SyntaxError) return false;
  if (isMongooseDuplicateKey(error)) return false;

  if (error instanceof AppError) {
    return !error.isOperational || error.statusCode >= 500;
  }

  return true;
}

export function reportError(
  error: unknown,
  context?: ReportErrorContext,
): void {
  if (!shouldReportToSentry(error)) return;

  Sentry.captureException(error, {
    tags: context?.tags,
    extra: {
      ...context?.extra,
      ...(context?.route ? { route: context.route } : {}),
    },
  });
}

/** Report failures from work that continues after the request has returned. */
export function reportBackgroundError(
  error: unknown,
  context: BackgroundErrorContext,
): void {
  reportError(error, {
    tags: {
      layer: "background",
      operation: context.operation,
      ...(context.integration ? { integration: context.integration } : {}),
    },
    extra: context.extra,
  });
}
