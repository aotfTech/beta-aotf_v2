# Sentry Coverage Map and Findings

## Purpose

This document records the complete repository scan performed to identify where Sentry is already active, where it can provide the most value, and where errors can currently remain invisible.

The initial scan was read-only. The first implementation pass has since been applied and validated; this document now records both the original findings and the resulting coverage status.

The application is assumed to remain on Sentry's free tier. The recommendations therefore prioritize unexpected failures, business-critical workflows, and data-integrity problems while avoiding expected validation and user-behavior noise.

## Executive summary

- The project already uses `@sentry/nextjs` and has client, server, edge, request-error, router-transition, and error-boundary integration points.
- There are 77 API route files.
- Initial scan: 61 of 77 API routes had an explicit or centralized Sentry path.
- Current implementation: all 77 API routes have an explicit or centralized Sentry path.
- The four final route gaps were `health`, `openapi.json`, `search`, and public username lookup; all are now covered.
- Client-side reporting exists in 31 application/component files, concentrated mainly in admin and onboarding flows.
- The largest blind spot is asynchronous background work: calendar and Google Sheets synchronization errors can be logged after the original request has already succeeded.
- Several service-layer functions catch errors and return failure objects. If their callers do not inspect and report those failures, Sentry will not see them.
- The existing free-tier filters correctly exclude many expected operational errors, but additional care is needed around health checks, authentication denials, validation failures, and high-frequency client fetch failures.

## Existing Sentry setup

### SDK and initialization

Relevant files:

- `package.json` — includes `@sentry/nextjs`.
- `instrumentation-client.ts` — initializes client-side Sentry, replay integration, traces, logs, and router transition capture.
- `sentry.server.config.ts` — initializes server-side Sentry.
- `sentry.edge.config.ts` — initializes edge-runtime Sentry.
- `instrumentation.ts` — exports `Sentry.captureRequestError`, validates environment variables, warms MongoDB, and reports warm-up failures.
- `app/error.tsx` — captures segment-level client errors.
- `app/global-error.tsx` — captures root/global errors.
- `app/admin/(calendar)/error.tsx` — provides an additional admin-calendar error boundary.
- `next.config.js` — wraps the application with `withSentryConfig`, configures source-map upload behavior, enables the `/monitoring` tunnel, and enables automatic Vercel monitor instrumentation.

### Shared reporting helpers

- `lib/sentry-report.ts`
  - `reportError()` captures unexpected server-side exceptions.
  - `shouldReportToSentry()` excludes user cancellation, Zod validation errors, syntax errors, duplicate MongoDB keys, and operational `AppError` instances below HTTP 500.
- `lib/client-report-error.ts`
  - `reportClientError()` captures unexpected client-side exceptions.
  - It excludes expected operational errors and HTTP 4xx responses.
- `lib/api-utils.ts`
  - `handleApiError()` converts errors into safe API responses.
  - Its catch-all path calls `reportError()` for unexpected failures.

### Current sampling and privacy configuration

`lib/sentry-config.ts` currently defines:

- Production traces: 10%.
- Production replay sessions: 10%.
- Replay on error: 100%.
- Development traces and replay sessions: 100%.
- Production `sendDefaultPii`: disabled.
- Development `sendDefaultPii`: enabled.

This is generally reasonable for a free-tier deployment, but replay-on-error at 100% should be watched if error volume becomes large.

## Coverage inventory

### API routes with centralized or explicit reporting

The following route groups currently use `handleApiError`, `reportError`, or direct Sentry capture and therefore have a basic server-side error path:

- Ads:
  - `app/api/v1/ads/route.ts`
  - `app/api/v1/ads/[adId]/route.ts`
  - `app/api/v1/admin/ads/route.ts`
  - `app/api/v1/admin/ads/[adId]/route.ts`
- Admin activity, dashboard, metrics, audit logs, invoices, payments, and provisioning.
- Admin calendar events and spreadsheet resynchronization.
- Admin invitations.
- Jobs and job applications.
- Posts and post applications.
- Enquiries, enquiry status, feedback, and reviews.
- Onboarding and WhatsApp onboarding.
- Profiles.
- Payments, including order creation, verification, and legacy activation.
- Renowned teachers.
- Clerk and Razorpay webhooks.
- Cron processing for unpaid users.
- Global API error handling through `lib/api-utils.ts`.

This coverage is not necessarily complete at every internal operation because nested catches and asynchronous work can still bypass the outer handler. See the remaining gaps below.

### Client-side reporting already present

Client reporting is present in the following types of flows:

- Admin dashboard.
- Admin activity and logs.
- Admin ads.
- Admin settings.
- Admin teachers.
- Admin users.
- Admin jobs and job candidates.
- Admin tuition and tuition candidates.
- Admin invoices.
- Admin feedback.
- Admin enquiries.
- Admin payment dashboard.
- Admin post forms.
- Public onboarding.
- Public application and enquiry controls.
- Shared client-report helper.

Client reporting is therefore strongest in admin workflows. Public feeds, profile pages, verification, calendar interactions, and several fire-and-forget UI actions remain less consistently instrumented.

## Priority map

Priority meanings:

- **P0** — failure can affect money, authentication, external-system consistency, scheduled cleanup, or account access.
- **P1** — failure blocks a core user or admin workflow but normally does not directly create financial or security risk.
- **P2** — useful observability with lower operational impact or higher noise risk.

## P0: critical coverage

### Payments

Locations:

- `app/api/v1/payments/create-order/route.ts`
- `app/api/v1/payments/verify/route.ts`
- `app/api/v1/payments/activate-legacy/route.ts`
- `app/api/v1/webhooks/razorpay/route.ts`
- `app/api/v1/admin/payments/route.ts`
- `app/api/v1/admin/payments/generate-payout/route.ts`
- `app/api/v1/admin/payments/payout-percentage/route.ts`
- `app/api/admin/invoices/route.ts`
- `app/api/admin/invoices/[invoiceId]/route.ts`
- `components/admin/payments/payment-dashboard.tsx`
- `app/onboarding/page.tsx`

Sentry value:

- Razorpay order creation failures.
- Payment signature and verification failures that are unexpected rather than user errors.
- Payment records left in an inconsistent state.
- Payout generation failures.
- Invoice generation, update, and deletion failures.
- Client failures where a payment is completed externally but the application cannot finalize onboarding.

Noise controls:

- Do not report invalid user input or expected invalid signatures as exceptions unless they indicate suspicious volume or a system defect.
- Include safe identifiers such as payment purpose, provider order ID, and route, but never payment secrets, signatures, or full request bodies.

### Authentication, Clerk synchronization, and account management

Locations:

- `app/api/v1/webhooks/clerk/route.ts`
- `app/api/admin/sync-clerk-users/route.ts`
- `lib/services/clerk.service.ts`
- `lib/services/clerk-sync.service.ts`
- `lib/admin/requirePermission.ts`
- `proxy.ts`
- `app/api/v1/admin/admins/**`
- `app/api/admin/users/**`
- `app/api/admin/app-users/**`

Sentry value:

- Failed Clerk webhook processing.
- Clerk and MongoDB records diverging.
- User provisioning and metadata synchronization failures.
- Account lock, unlock, termination, reset, and role-management failures.
- Authentication middleware or permission-check failures caused by dependencies rather than ordinary unauthorized requests.

Noise controls:

- Do not report normal 401/403 responses.
- Report Clerk API exceptions, database failures, malformed webhook processing, and failed synchronization results.
- Avoid capturing secrets, session tokens, private metadata, or complete Clerk payloads.

### Google Sheets and external data synchronization

Locations:

- `lib/googleSheets.ts`
- `lib/services/postLedger.service.ts`
- `lib/services/enquiryLedger.service.ts`
- `app/api/admin/resync-sheet/route.ts`
- `app/api/admin/resync-sheet/enquiries/route.ts`
- `scripts/seed-sheets.ts`
- `scripts/force-headers.ts`

Sentry value:

- Authentication and configuration failures.
- Google API quota, permission, timeout, and malformed-range failures.
- Database-to-sheet synchronization failures.
- Partial or failed bulk resynchronization.
- Sheet write-through failures that happen after a successful database write.

Special concern:

The ledger services use fire-and-forget synchronization. The API can return success even when the subsequent Sheets write fails. These errors need their own reporting path and tags such as `layer: "background-sync"` and `integration: "google-sheets"`.

### Database connectivity and startup

Locations:

- `lib/db.ts`
- `instrumentation.ts`
- `app/api/health/route.ts`

Sentry value:

- MongoDB Atlas free-tier cold starts.
- Connection retry exhaustion.
- Connection drops and failed reconnections.
- Startup configuration failures.

Noise controls:

- Do not report every individual health probe failure.
- Prefer a throttled event, state-transition event, or Sentry check-in for recurring health failures.

### Scheduled cleanup

Location:

- `app/api/v1/cron/manage-unpaid-users/route.ts`

Current state:

- This route already uses `captureCheckIn()` and reports aggregate failures.

Remaining work:

- Verify that the monitor is configured in Sentry.
- Confirm that failed-record details do not contain unnecessary personal data.
- Keep one aggregate event per run rather than one event per expected failed record.

## P1: core workflow coverage

### Onboarding

Locations:

- `app/api/v1/onboarding/route.ts`
- `app/api/v1/onboarding/whatsapp/route.ts`
- `app/onboarding/page.tsx`
- `lib/utils/ensure-user.ts`

Important failure modes:

- User/profile self-healing fails.
- Onboarding details cannot be saved.
- Payment is recorded but onboarding remains incomplete.
- WhatsApp completion cannot be persisted.
- Clerk metadata synchronization fails after local data succeeds.

### Applications and state transitions

Locations:

- `app/api/v1/jobs/[jobId]/applications/route.ts`
- `app/api/v1/jobs/[jobId]/applications/[applicationId]/route.ts`
- `app/api/v1/posts/[postId]/applications/route.ts`
- `app/api/v1/posts/[postId]/applications/[applicationId]/route.ts`
- `app/api/v1/me/applications/[applicationId]/route.ts`
- `lib/services/application.service.ts`
- `lib/models/Application.ts`

Important failure modes:

- Application status transitions fail.
- Application and post/job state become inconsistent.
- Calendar or ledger side effects fail after the main application write.
- Concurrent writes or index migration problems occur.

### Posts and jobs

Locations:

- `app/api/v1/posts/**`
- `app/api/v1/jobs/**`
- `lib/services/post.service.ts`
- `lib/services/job.service.ts`
- Admin post and job forms.

Important failure modes:

- Creation, update, deletion, or publication failures.
- Data retrieval failures affecting feeds.
- Admin mutation failures.
- Unexpected database or validation behavior outside normal user input errors.

### Profiles and public user pages

Locations:

- `app/api/v1/profile/route.ts`
- `app/api/v1/users/[username]/route.ts`
- `app/u/[username]/page.tsx`
- `app/u/[username]/dashboard/page.tsx`

Important failure modes:

- Profile reads or updates fail.
- Public profile rendering fails due to missing related data.
- Dashboard aggregation fails.

### Admin authorization and operations

Locations:

- `lib/admin/requirePermission.ts`
- `lib/admin/hierarchyCheck.ts`
- `lib/admin/logActivity.ts`
- `app/api/v1/admin/**`
- `app/api/admin/**`

Important failure modes:

- Permission lookup or role retrieval fails.
- Audit logging fails for sensitive mutations.
- Admin dashboards, referrals, ads, roles, subjects, sources, or user operations fail.
- A nested catch hides a dependency failure and the route returns an incomplete result.

## P2: secondary coverage

These areas should be covered after P0/P1 or through shared helpers where the incremental noise is low:

- `app/api/v1/enquiry/**`
- `app/api/v1/feedback/**`
- `app/api/v1/reviews/**`
- `app/api/v1/renowned-teachers/**`
- `app/api/v1/admin/ads/**`
- `app/api/v1/admin/subjects/**`
- `app/api/v1/admin/sources/**`
- `app/api/v1/admin/referrals/route.ts`
- `app/api/v1/admin/roles/route.ts`
- Calendar requests and calendar views.
- Admin WhatsApp group management.
- Admin activity and feedback interactions.
- Documentation and MDX rendering paths.

## Previously uncovered API routes — now covered

The following routes were uncovered during the initial scan and now use the shared wrapper or throttled reporting:

- `app/api/admin/app-users/route.ts`
- `app/api/admin/app-users/[userId]/recover-payment/route.ts`
- `app/api/admin/app-users/[userId]/status/route.ts`
- `app/api/admin/sync-clerk-users/route.ts`
- `app/api/admin/todos/route.ts`
- `app/api/admin/users/[adminUserId]/role/route.ts`
- `app/api/admin/users/[adminUserId]/terminate/route.ts`
- `app/api/admin/whatsapp-groups/route.ts`
- `app/api/admin/whatsapp-groups/[id]/route.ts`
- `app/api/health/route.ts` — throttled MongoDB outage reporting to avoid probe noise.
- `app/api/openapi.json/route.ts`
- `app/api/search/route.ts`
- `app/api/v1/admin/referrals/route.ts`
- `app/api/v1/admin/roles/route.ts`
- `app/api/v1/users/[username]/route.ts`
- `app/api/v1/verify/[id]/route.ts`

The other routes in this original list were covered in the first implementation pass through `withApiErrorHandling()` or explicit reporting.

Recommended treatment:

- Add centralized handling to critical mutating/admin routes.
- Add reporting to unexpected failures in user verification and public profile paths.
- Treat the health route separately to avoid event flooding.
- Leave static OpenAPI/search failures at lower priority unless they reveal a production defect.

## Background and fire-and-forget gaps

These operations can fail outside the lifetime of the request that initiated them:

### Mongoose model hooks

- `lib/models/Enquiry.ts`
  - Calendar event upsert/delete.
  - Enquiry ledger and Sheets synchronization.
- `lib/models/Feedback.ts`
  - Calendar event upsert/delete.
- `lib/models/TodoEvent.ts`
  - Calendar event upsert/delete.
- `lib/models/Application.ts`
  - Calendar event upsert/delete.

### Service-level asynchronous writes

- `lib/services/enquiryLedger.service.ts`
  - `syncEnquiryLedgerRowToSheet(...).catch(...)` currently logs only.
- `lib/services/postLedger.service.ts`
  - `syncPostLedgerRowToSheet(...).catch(...)` currently logs only.
- `lib/services/application.service.ts`
  - Uses `Promise.all`, `Promise.allSettled`, and nested side effects that should be reviewed for partial failures.
- `calendar/requests.ts`
  - Contains catches around Clerk/database-related enrichment and calendar requests.

### Client-side asynchronous actions

- `components/ApplyActionButton.tsx`
- `components/PostInfiniteFeed.tsx`
- `components/JobInfiniteFeed.tsx`
- `calendar/contexts/calendar-context.tsx`
- `calendar/components/agenda-view/calendar-agenda-view.tsx`
- `calendar/components/header/refresh-button.tsx`
- `app/onboarding/page.tsx`
- `app/u/[username]/page.tsx`

These should report only unexpected failures. Abortions, navigation races, offline transitions, and expected HTTP 4xx responses should remain filtered.

## Silent or nested catches found

The scan found many catches that are intentional fallback behavior, but the following classes deserve review:

- `lib/admin/requirePermission.ts`
  - Clerk metadata fallback errors are swallowed because the database permission check remains authoritative.
  - This is acceptable for expected fallback behavior, but Clerk API failures may be useful as low-volume diagnostic events.
- `app/api/health/route.ts`
  - Database errors are swallowed to return a degraded health response.
  - Use throttled monitoring rather than one Sentry event per probe.
- Admin app-user routes.
  - Audit-log failures and Clerk synchronization failures are logged but may not be reported.
- Admin WhatsApp group routes.
  - Errors are logged directly rather than passed through shared API error handling.
- Admin roles, payments, referrals, and payout routes.
  - Nested catches may convert dependency failures into fallback values or logs.
- Verification and public profile paths.
  - Some catches intentionally fall back, but unexpected data or rendering failures can be lost.
- Client forms and feeds.
  - Several `.catch(() => {})` or `.catch(() => undefined)` patterns intentionally suppress errors.
  - These should only be changed for user-impacting or business-critical actions.

## Service-layer reporting gaps

The following services catch errors and often return failure objects instead of throwing:

- `lib/services/email.service.ts`
- `lib/services/clerk.service.ts`
- `lib/services/clerk-sync.service.ts`
- `lib/services/admin.service.ts`
- `lib/services/app-user.service.ts`
- `lib/services/calendar-event.service.ts`
- `lib/services/postLedger.service.ts`
- `lib/services/enquiryLedger.service.ts`

The implementation must avoid blindly reporting every returned failure. Recommended rule:

- Report external-provider exceptions, database failures, and unexpected internal errors.
- Do not report expected duplicate, not-found, validation, or user-cancelled outcomes.
- Add a stable operation tag, for example `operation: "send-admin-invite"` or `operation: "sync-post-ledger"`.

## Client-side gaps

Client instrumentation is not uniform across all public experiences. Remaining areas include:

- Public profile page data fetching.
- Public job and post detail fetching.
- Verification page data fetching.
- Infinite feeds.
- Application actions.
- Calendar refresh and event loading.
- Some admin login and join flows.
- Some invoice, settings, teacher, and review interactions that currently only log errors.

Recommended client context fields:

- `feature` — stable feature name, not a user-specific value.
- Route or page category.
- Operation name.
- HTTP status when available.
- Safe resource identifiers only when necessary.

Do not attach passwords, payment signatures, session tokens, full request bodies, private profile data, or raw external-provider payloads.

## Configuration findings

### Runtime DSN

`lib/sentry-config.ts` uses `NEXT_PUBLIC_SENTRY_DSN` when available and otherwise falls back to a hardcoded DSN.

The repository scan found no `NEXT_PUBLIC_SENTRY_DSN` entry in `.env.local`. Production should define the runtime DSN explicitly in the deployment environment rather than relying on a committed fallback.

### Source maps

`next.config.js` supports source-map upload through:

- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

These were not present in the local environment scan. Without them, production stack traces may be less readable if source maps are not uploaded by CI/Vercel.

### Tunnel

The application uses `tunnelRoute: "/monitoring"` to reduce the impact of browser ad blockers. This can increase application traffic and hosting usage, so it should be retained only if it materially improves client event delivery.

### PII

Production has `sendDefaultPii: false`, which is appropriate. Any new custom context must preserve this policy and avoid adding sensitive values manually.

### Sampling

Current production sampling is:

- 10% performance traces.
- 10% replay sessions.
- 100% replay for sessions with errors.

For the free tier, do not increase global traces or replay sessions without checking event volume. Prefer high-value exception events and aggregate background-job events.

## Free-tier reporting rules

The implementation should follow these rules:

1. Capture unexpected 5xx-level failures.
2. Capture failures in payments, webhooks, Clerk synchronization, database connectivity, Sheets synchronization, email delivery, and scheduled jobs.
3. Capture one aggregate event for a batch or cron run instead of one event per failed record.
4. Do not capture normal 401, 403, 404, 409, 415, or 429 responses as exceptions.
5. Do not capture Zod validation failures as exceptions.
6. Do not capture duplicate-key errors unless their frequency indicates a defect.
7. Do not capture user-cancelled payment or browser-aborted requests.
8. Avoid duplicate events from both a service catch and its route-level catch.
9. Use tags and small safe extras instead of complete request or provider payloads.
10. Prefer `captureMessage` or check-ins only for carefully throttled health/degradation signals.

## Recommended implementation order after approval

### Phase 1: P0 — implemented

- Instrumented background calendar and Sheets synchronization failure points.
- Added Clerk synchronization, Clerk service, Resend email, and webhook cleanup reporting.
- Added throttled database failure reporting to the health endpoint.
- Added shared route handling for previously uncovered API routes.
- Cron monitor configuration and event volume still require deployment/Sentry-dashboard verification.

### Phase 2: P1 — implemented

- Standardized the previously uncovered API routes on `handleApiError` or explicit Sentry reporting.
- Added service-layer reporting for Clerk, email, calendar, Sheets, admin audit logging, admin synchronization, and app-user provisioning failures.
- Added client reporting to onboarding payment finalization, application actions, verification, public profile/detail pages, feeds, calendar, reviews, invoices, and admin mutations.
- Added aggregate reporting for Clerk-to-Mongo batch synchronization failures.

### Phase 3: P2 and operational follow-up

- Intentional fallbacks remain unreported where failure is expected or non-actionable: database retry rethrows to the owning route, device-orientation permission denial, clipboard denial, and verification/content fallback rendering.
- Confirm production DSN and source-map environment variables.
- Verify event grouping, tags, and free-tier volume after deployment.
- Review operator-invoked CLI scripts separately if they become unattended production jobs.

## Validation checklist before implementation

- Confirm the Sentry project and environment names.
- Confirm whether the committed fallback DSN should remain or be removed.
- Confirm production environment variables in Vercel/deployment settings.
- Confirm whether source maps are currently uploaded.
- Confirm Sentry free-tier event limits and current usage.
- Confirm whether replay-on-error at 100% is acceptable.
- Confirm which identifiers are safe to attach to events.
- Confirm whether the user wants only error events or also performance tracing/check-ins.

## Scope intentionally excluded from this scan

- No Sentry dashboard or account inspection was performed.
- No production event-volume review was performed.
- Application code was edited in the first implementation pass described above.
- No deployment configuration was changed.
- No external Sentry API calls were made.
- CLI migration/seed scripts were not prioritized for runtime Sentry because they are operator-invoked processes; they currently report failures through console output and process exit behavior. They can be added later if those jobs run unattended in production.
