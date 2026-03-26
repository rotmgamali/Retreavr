/**
 * Sentry error tracking for the frontend.
 * Initialised once on app load via the root layout.
 *
 * Set NEXT_PUBLIC_SENTRY_DSN in your environment to enable.
 */

let initialized = false;

export async function initSentry() {
  if (initialized) return;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  const Sentry = await import("@sentry/nextjs");

  Sentry.init({
    dsn,
    tracesSampleRate: 0.2,
    environment: process.env.NODE_ENV,
    // Avoid sending PII (emails, IPs) unless explicitly needed
    sendDefaultPii: false,
  });

  initialized = true;
}
