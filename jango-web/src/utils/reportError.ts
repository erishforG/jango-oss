import * as Sentry from '@sentry/react';

/**
 * Unified error reporter: logs to console (always) and captures to Sentry (when DSN is configured).
 *
 * Use this instead of bare `console.error` in catch blocks so that
 * production errors are visible in the Sentry dashboard.
 *
 * @param err   The caught value (usually an Error, but `unknown` is safe)
 * @param ctx   Optional key/value context attached to the Sentry event
 */
export function reportError(err: unknown, ctx?: Record<string, unknown>): void {
  console.error(err);
  Sentry.captureException(err, ctx ? { extra: ctx } : undefined);
}
