const isProd = process.env.NODE_ENV === "production";

export const sentryDsn =
  process.env.NEXT_PUBLIC_SENTRY_DSN ??
  "https://ed17023bd8af32e17e762b09940a3c7b@o4511274687135744.ingest.us.sentry.io/4511610699317248";

export const sentryTracesSampleRate = isProd ? 0.1 : 1;

export const sentryReplaysSessionSampleRate = isProd ? 0.1 : 1;

export const sentrySendDefaultPii = !isProd;
