# Implementation Plan: Admin Dashboard Stats

## Overview

Extend the Super Admin dashboard with per-month statistics. The work splits cleanly into two layers: the API route (`app/api/v1/admin/dashboard/route.ts`) gets two new pure helper functions and new MongoDB aggregation queries added to `getSuperAdminData`; the UI component (`components/admin/dashboard/SuperAdminDashboard.tsx`) gets the extended `SuperAdminPayload` interface and updated stat card grid.

No new files, no schema changes, and no existing keys are removed — all changes are strictly additive.

## Tasks

- [x] 1. Add pure helper functions to the API route
  - [x] 1.1 Implement `computeMonthBounds(now: Date)` in `app/api/v1/admin/dashboard/route.ts`
    - Add the function in the `// ─── Helpers ───` section, before the role-specific aggregators
    - Return `{ monthStart, monthEnd, prevMonthStart, prevMonthEnd }` using `new Date(year, month, 1, 0, 0, 0, 0)` etc. — rely on JavaScript's native month-underflow/overflow behaviour for January and December edge cases
    - _Requirements: 8.1, 8.2_

  - [x] 1.2 Write property test for `computeMonthBounds` (Property 2)
    - **Property 2: Month bounds are non-overlapping and cover the full month**
    - Use `fc.date()` to generate arbitrary `Date` values; assert `monthStart` is midnight on the 1st, `monthEnd` is 23:59:59.999 on the last day, and `prevMonthEnd` is exactly 1 ms before `monthStart`
    - Tag: `// Feature: admin-dashboard-stats, Property 2: month bounds non-overlapping`
    - **Validates: Requirements 8.1, 8.2**

  - [x] 1.3 Implement `computeGrowthPct(current: number, previous: number): number` in `app/api/v1/admin/dashboard/route.ts`
    - Add the function in the `// ─── Helpers ───` section, right after `computeMonthBounds`
    - Use `Math.max(previous, 1)` as the denominator; return `Math.round(pct * 10) / 10`
    - _Requirements: 3.2, 3.4, 3.5_

  - [x] 1.4 Write property test for `computeGrowthPct` — zero-denominator safety (Property 3)
    - **Property 3: Growth percentage handles zero-denominator safely**
    - Use `fc.nat()` pairs; assert result is always `Number.isFinite` and `computeGrowthPct(0, 0) === 0.0`
    - Tag: `// Feature: admin-dashboard-stats, Property 3: growth pct never throws`
    - **Validates: Requirements 3.4, 3.5**

  - [x] 1.5 Write property test for `computeGrowthPct` — formula round-trip (Property 6)
    - **Property 6: Growth percentage formula round-trip**
    - Use `fc.nat({ min: 1 })` for both args; assert result equals `Math.round(((current - previous) / previous) * 100 * 10) / 10`
    - Tag: `// Feature: admin-dashboard-stats, Property 6: growth formula round-trip`
    - **Validates: Requirements 3.2**

- [x] 2. Add per-month MongoDB aggregation queries to `getSuperAdminData`
  - [x] 2.1 Add Posts facet aggregation (total / paid / revenue) inside `getSuperAdminData`
    - Call `computeMonthBounds(new Date())` at the top of the function to get `monthStart`, `monthEnd`, `prevMonthStart`, `prevMonthEnd`
    - Add a `Post.aggregate([{ $match: { createdAt: … } }, { $facet: { totalAndPayment: […] } }])` call to the existing `Promise.all` array
    - Normalise empty results to `{ total: 0, paid: 0, revenue: 0 }`; derive `unpaid = total - paid` in application code
    - _Requirements: 1.1, 1.3, 1.4, 5.2, 8.1, 8.3_

  - [x] 2.2 Write property test for paid/unpaid partition (Property 1)
    - **Property 1: Paid/Unpaid partition is exhaustive and exclusive**
    - Generate an array of post-like objects with `paymentstatus` ∈ `["done", "pending", undefined]` using `fc.array(fc.record(…))`; run the grouping logic; assert `paid + unpaid === total`
    - Tag: `// Feature: admin-dashboard-stats, Property 1: paid+unpaid exhaustive`
    - **Validates: Requirements 1.3**

  - [x] 2.3 Add `$lookup` pipeline for approved/ongoing/cancelled post classification inside `getSuperAdminData`
    - Add a second `Post.aggregate(…)` call (with `$lookup` from `posts` → `applications`) to the `Promise.all` array
    - Implement the `isApproved` / `hasInProgress` `$addFields` + `$group` stage exactly as specified in the design's "Approved / Ongoing / Cancelled Posts" section
    - Normalise empty results to `{ approved: 0, ongoing: 0, cancelled: 0 }`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 8.4_

  - [x] 2.4 Write property test for classification mutual exclusivity (Property 4)
    - **Property 4: Approved/Ongoing/Cancelled classification is mutually exclusive**
    - Generate random post+application combos with `fc.array`; run the classification logic; assert each post lands in exactly one bucket and approved takes priority
    - Tag: `// Feature: admin-dashboard-stats, Property 4: classification mutual exclusivity`
    - **Validates: Requirements 2.3, 2.4, 2.5**

  - [x] 2.5 Add three parallel `User.countDocuments` calls for user stats inside `getSuperAdminData`
    - Add to the `Promise.all` array: `User.countDocuments({ createdAt: { $gte: monthStart, $lte: monthEnd } })`, `User.countDocuments({ createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd } })`, and `User.countDocuments({ status: "blocked" })`
    - Compute `growthPct` via `computeGrowthPct(currentMonthUsers, prevMonthUsers)` after the `Promise.all` resolves
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 8.5, 8.6_

  - [x] 2.6 Assemble and return the four new stats fields from `getSuperAdminData`
    - Add `postsThisMonth`, `approvedPostsThisMonth`, `usersThisMonth`, and `revenueThisMonth` to the `stats` object returned by `getSuperAdminData`
    - Ensure all existing keys (`totalUsers`, `activePosts`, `enquiries`, `revenue`, `admins`, `feedbacks`) are preserved unchanged — no renames or deletions
    - _Requirements: 8.7_

- [x] 3. Checkpoint — ensure API layer compiles and all tests pass
  - Ensure all tests pass; ask the user if any questions arise before proceeding to UI changes.

- [x] 4. Extend `SuperAdminPayload` and update stat card grid in `SuperAdminDashboard.tsx`
  - [x] 4.1 Extend the `SuperAdminPayload` interface in `components/admin/dashboard/SuperAdminDashboard.tsx`
    - Add four new keys to `stats`: `postsThisMonth: { total: number; paid: number; unpaid: number }`, `approvedPostsThisMonth: { approved: number; ongoing: number; cancelled: number }`, `usersThisMonth: { total: number; growthPct: number; blocked: number }`, and `revenueThisMonth: number`
    - Keep all existing keys in the interface — this is a purely additive change
    - _Requirements: 8.7_

  - [x] 4.2 Write property test for revenue calculation (Property 5)
    - **Property 5: Revenue equals sum of monthlyBudget on paid posts**
    - Generate arrays of `{ paymentstatus, monthlyBudget }` objects with `fc.array`; compute expected sum manually; assert equality with the aggregation result
    - Tag: `// Feature: admin-dashboard-stats, Property 5: revenue sum of paid budgets`
    - **Validates: Requirements 5.2**

  - [x] 4.3 Update the stat card grid order and grid class in `SuperAdminDashboard.tsx`
    - Change the grid `className` from `grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` to `grid-cols-2 lg:grid-cols-3` (remove `xl:grid-cols-4`)
    - Reorder the six `<StatCard>` calls to: Posts → Approved Posts → Registered Users → Feedbacks → Total Revenue → Total Admins
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 4.4 Implement the four updated stat cards with per-month data
    - **Posts card**: primary value = `stats.postsThisMonth.total`; sub = `` `${stats.postsThisMonth.paid} paid · ${stats.postsThisMonth.unpaid} unpaid` ``; use `BookOpen` icon and `bg-indigo-500` accent; link to `/admin/tuitions`
    - **Approved Posts card**: primary value = `stats.approvedPostsThisMonth.approved`; sub = `` `${stats.approvedPostsThisMonth.ongoing} ongoing · ${stats.approvedPostsThisMonth.cancelled} cancelled` ``; use `TrendingUp` icon and `bg-green-500` accent; link to `/admin/tuitions`
    - **Registered Users card**: primary value = `stats.usersThisMonth.total`; sub combines growth sign+value and blocked count (e.g. `+12.5% vs last month · 3 blocked`); use `Users` icon and `bg-blue-500` accent; link to `/admin/users`
    - **Total Revenue card**: primary value = `fmtCurrency(stats.revenueThisMonth)`; use `IndianRupee` icon and `bg-emerald-500` accent; link to `/admin/payments`
    - _Requirements: 1.1, 1.2, 1.4, 2.1, 2.2, 2.6, 3.1, 3.2, 3.3, 3.6, 3.7, 5.1, 5.3_

- [x] 5. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- All property-based tests use **fast-check** (already available in Next.js/TypeScript projects); run with `vitest --run` for single-pass execution
- Each task references specific requirements for traceability
- The two helper functions (`computeMonthBounds`, `computeGrowthPct`) are pure and have no MongoDB dependencies — test them in isolation first
- `unpaid` is derived in application code as `total − paid`; it is never stored or queried separately
- The `revenueThisMonth` field uses `monthlyBudget` from the `posts` collection, not `Payment.amount`
- Growth percentage sign in the UI: use `+` prefix for positive values, `-` is provided by `toFixed`, and omit sign for `0.0`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3"] },
    { "id": 1, "tasks": ["1.2", "1.4", "1.5", "2.1", "2.3"] },
    { "id": 2, "tasks": ["2.2", "2.4", "2.5"] },
    { "id": 3, "tasks": ["2.6"] },
    { "id": 4, "tasks": ["4.1"] },
    { "id": 5, "tasks": ["4.2", "4.3"] },
    { "id": 6, "tasks": ["4.4"] }
  ]
}
```
