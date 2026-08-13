# Requirements Document

## Introduction

This feature enhances the Super Admin dashboard's statistics cards to show richer, per-month data. The current dashboard shows global all-time counts (Registered Users, Active Posts, Enquiries, Total Revenue, Total Admins, Feedbacks). The enhanced dashboard replaces several of these with month-scoped cards that show a primary metric plus meaningful breakdowns, giving the admin team a quick operational pulse on the current month. Cards that don't need changes (Feedbacks, Total Admins) are preserved as-is.

## Glossary

- **Dashboard**: The Super Admin dashboard page at `/admin`, rendered by `SuperAdminDashboard` and driven by `GET /api/v1/admin/dashboard`.
- **Stat_Card**: A single summary tile on the dashboard grid showing a primary metric and optional sub-metrics.
- **Current_Month**: The calendar month matching the server's current local date (e.g., July 2025), used as the default time window for all per-month stats.
- **Post**: A tuition/job posting stored in the `posts` collection. Relevant fields: `status` (`open`, `matched`, `closed`, `cancelled`, `hold`), `paymentstatus` (`done`, `pending`), `monthlyBudget`, `createdAt`.
- **Application**: A teacher/candidate application on a Post, stored in the `applications` collection. Relevant fields: `postId`, `status` (`applied`, `DC`, `GC`, `approved`, `decline`, `auto_declined`, `withdrawn`), `createdAt`.
- **Approved_Post**: A Post whose linked Application has `status = "approved"`.
- **Ongoing_Post**: A Post (not itself cancelled) that has at least one Application with `status` of `DC` or `GC` or further in the pipeline — but none yet at `approved`. These represent active in-progress matches.
- **Cancelled_Post**: A Post whose `status = "cancelled"`.
- **Paid_Post**: A Post where `paymentstatus = "done"`.
- **Unpaid_Post**: A Post where `paymentstatus` is `"pending"` or absent.
- **Revenue**: The sum of `monthlyBudget` across all Paid_Posts created in the Current_Month.
- **User**: A record in the `users` collection. Relevant fields: `status` (`active`, `blocked`, `deleted`), `createdAt`.
- **Blocked_User**: A User with `status = "blocked"`.
- **Previous_Month**: The calendar month immediately before the Current_Month.
- **User_Growth_Percentage**: `((currentMonthNewUsers − previousMonthNewUsers) / max(previousMonthNewUsers, 1)) × 100`, rounded to one decimal place.
- **Admin**: A record in the `admins` collection with `isActive: true`.
- **Feedback**: A record in the `feedbacks` collection.
- **API**: The Next.js route handler at `GET /api/v1/admin/dashboard`.
- **SuperAdminDashboard**: The React component at `components/admin/dashboard/SuperAdminDashboard.tsx`.
- **SuperAdminPayload**: The TypeScript interface describing the JSON shape returned by the API for the `super_admin` role.

---

## Requirements

### Requirement 1: Posts Stat Card — Total with Paid/Unpaid Breakdown

**User Story:** As a super admin, I want to see how many posts were created this month along with a paid vs unpaid breakdown, so that I can monitor post volume and payment collection at a glance.

#### Acceptance Criteria

1. WHEN the Dashboard loads, THE Stat_Card SHALL display the total count of Posts whose `createdAt` falls within the Current_Month (00:00:00 on the 1st day through 23:59:59 on the last day, server local time) as its primary value.
2. WHEN the Dashboard loads and at least one Post exists for the Current_Month, THE Stat_Card SHALL display a secondary line in the format `X paid · Y unpaid` where X is the count of Paid_Posts and Y is the count of Unpaid_Posts created in the Current_Month.
3. THE API SHALL ensure that the sum of Paid_Posts count and Unpaid_Posts count always equals the total Posts count, treating any Post without a `paymentstatus` field as an Unpaid_Post.
4. WHEN no Posts exist for the Current_Month, THE Stat_Card SHALL display `0` as the primary value and `0 paid · 0 unpaid` as the secondary line.
5. IF the API call to retrieve Posts data fails, THE Stat_Card SHALL display an error state indicating that the data is unavailable, without displaying a stale or incorrect value.

---

### Requirement 2: Approved Posts Stat Card — Approved Count with Ongoing/Cancelled Breakdown

**User Story:** As a super admin, I want to see how many posts have been approved this month and how many are still in-progress or cancelled, so that I can track matching outcomes.

#### Acceptance Criteria

1. WHEN the Dashboard loads, THE Stat_Card SHALL display the count of Approved_Posts created in the Current_Month as its primary value.
2. THE Stat_Card SHALL display a secondary line in the format `X ongoing · Y cancelled` where X is the count of Ongoing_Posts and Y is the count of Cancelled_Posts created in the Current_Month.
3. THE API SHALL count a Post as an Approved_Post if and only if the Post was created in the Current_Month and at least one Application with a matching `postId` has `status = "approved"`. Approved classification takes priority over all other classifications.
4. THE API SHALL count a Post as an Ongoing_Post if the Post was created in the Current_Month, has `status` not equal to `"cancelled"`, has at least one Application with `status` in `["DC", "GC"]`, and has no Application with `status = "approved"` (ensuring mutual exclusivity with Approved_Posts).
5. THE API SHALL count a Post as a Cancelled_Post if the Post was created in the Current_Month, has `status = "cancelled"`, and is not already counted as an Approved_Post (i.e., has no Application with `status = "approved"`).
6. WHEN no Posts were created in the Current_Month, THE Stat_Card SHALL display `0` as the primary value and `0 ongoing · 0 cancelled` as the secondary line.

---

### Requirement 3: Registered Users Stat Card — Total with Growth and Blocked Breakdown

**User Story:** As a super admin, I want to see how many users registered this month, their growth rate versus last month, and how many are currently blocked, so that I can monitor user acquisition and platform health.

#### Acceptance Criteria

1. WHEN the Dashboard loads, THE Stat_Card SHALL display the count of Users whose `createdAt` falls within the Current_Month as its primary value.
2. THE Stat_Card SHALL display a secondary line showing the User_Growth_Percentage in the format `{sign}{value}% vs last month` where `{sign}` is `+` for positive growth or `-` for negative growth (omitted for zero), and `{value}` is rounded to 1 decimal place (e.g., `+12.5% vs last month`, `-3.0% vs last month`, or `0.0% vs last month`).
3. THE Stat_Card SHALL display the count of all Blocked_Users on the same secondary line, separated by ` · `, in the format `X blocked` where X is the count of Users with `status = "blocked"` and `status ≠ "deleted"`, regardless of when they were created.
4. WHEN both the Current_Month and Previous_Month have zero new Users, THE API SHALL return a User_Growth_Percentage of `0.0`.
5. WHEN the Previous_Month had zero new Users and the Current_Month had one or more new Users, THE API SHALL treat the denominator as `1` to avoid division by zero, resulting in the full current count as the growth percentage.
6. WHEN no Users were created in the Current_Month, THE Stat_Card SHALL display `0` as the primary value.
7. WHEN no Users were created in the Current_Month, THE Stat_Card SHALL display `+0.0% vs last month · X blocked` as the secondary line, where X is the count of Blocked_Users.

---

### Requirement 4: Feedbacks Card — Preserve Existing Behaviour

**User Story:** As a super admin, I want the Feedbacks stat card to remain unchanged, so that I can continue viewing total and open feedbacks as before.

#### Acceptance Criteria

1. THE Stat_Card for Feedbacks SHALL display the total Feedback count as its primary value.
2. THE Stat_Card for Feedbacks SHALL display the count of open/unresolved Feedbacks as its secondary line when the value is available, and omit the secondary line when the count is unavailable.
3. THE SuperAdminDashboard SHALL place the Feedbacks card beside the Registered Users card in the grid layout, maintaining the card order defined in Requirement 7 AC1 across all screen sizes.
4. WHEN Feedbacks data is fetched, THE API SHALL continue returning `feedbacks.total` and `feedbacks.open` in the SuperAdminPayload without modification.

---

### Requirement 5: Total Revenue Card — Sum of Monthly Budgets for Paid Posts

**User Story:** As a super admin, I want to see the total revenue for the current month calculated from paid posts' monthly budgets, so that I have an accurate revenue figure scoped to this month.

#### Acceptance Criteria

1. WHEN the Dashboard loads, THE Stat_Card SHALL display the sum of `monthlyBudget` across all Posts where `paymentstatus = "done"` and `createdAt` falls within the Current_Month as the primary value, formatted as INR currency using `Intl.NumberFormat` with `style: "currency"`, `currency: "INR"`, and `maximumFractionDigits: 0` (e.g., `₹1,50,000`).
2. THE API SHALL calculate Revenue as the sum of `monthlyBudget` (not `Payment.amount`) for Posts where `paymentstatus = "done"` and `createdAt` falls within the Current_Month defined as 00:00:00 on the 1st day through 23:59:59 on the last day of the current calendar month (server local time), including Posts with a `monthlyBudget` of `0` in the sum.
3. WHEN no Paid_Posts exist for the Current_Month, THE Stat_Card SHALL display `₹0` as the primary value.
4. IF the API call to retrieve Revenue data fails, THE Stat_Card SHALL display an error state indicating that the revenue figure is unavailable, without displaying a stale or incorrect value.

---

### Requirement 6: Total Admins Card — Preserve Existing Behaviour

**User Story:** As a super admin, I want the Total Admins stat card to remain unchanged, so that I can continue monitoring the admin team headcount.

#### Acceptance Criteria

1. THE Stat_Card for Total Admins SHALL display the total count of active Admins as its primary value.
2. THE Stat_Card for Total Admins SHALL display a breakdown by admin role (e.g., `2 admin · 1 support_admin`) as its secondary line.
3. THE SuperAdminDashboard SHALL preserve the Total Admins card's position and styling without modification.

---

### Requirement 7: Dashboard Grid Layout

**User Story:** As a super admin, I want the stat cards arranged in a clear grid so that I can scan all metrics at a glance.

#### Acceptance Criteria

1. THE SuperAdminDashboard SHALL render stat cards in the following order on all screen sizes: Posts (total/paid/unpaid), Approved Posts (ongoing/cancelled), Registered Users (growth/blocked), Feedbacks, Total Revenue, Total Admins.
2. THE SuperAdminDashboard SHALL use a responsive grid that shows 2 columns on small screens and expands to 3 columns on large screens (`lg:grid-cols-3`).
3. WHEN the Dashboard renders on a large screen, THE SuperAdminDashboard SHALL display all 6 stat cards in two rows of three, preserving the order defined in AC1.

---

### Requirement 8: API — Per-Month Scoping

**User Story:** As a super admin, I want all new stat cards to reflect current-month data only, so that the dashboard gives an operational view of the present period rather than all-time totals.

#### Acceptance Criteria

1. THE API SHALL determine `monthStart` as `new Date(year, month, 1, 0, 0, 0, 0)` and `monthEnd` as `new Date(year, month + 1, 0, 23, 59, 59, 999)` using the server's local time, where `month` is zero-indexed.
2. THE API SHALL determine `prevMonthStart` as `new Date(year, month - 1, 1, 0, 0, 0, 0)` and `prevMonthEnd` as `new Date(year, month, 0, 23, 59, 59, 999)` for Previous_Month calculations.
3. WHEN computing Posts stats and Revenue, THE API SHALL apply `{ createdAt: { $gte: monthStart, $lte: monthEnd } }` to the `posts` collection query.
4. WHEN computing Approved_Posts, THE API SHALL join Posts (filtered by `createdAt` in Current_Month) with Applications on `postId` to identify posts that have at least one Application with `status = "approved"`.
5. WHEN computing Registered Users primary count, THE API SHALL apply `{ createdAt: { $gte: monthStart, $lte: monthEnd } }` to the `users` collection.
6. WHEN computing Previous_Month user count, THE API SHALL apply `{ createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd } }` to the `users` collection.
7. THE API SHALL return all per-month stats within the existing `SuperAdminPayload.stats` object, adding new fields without renaming or removing any existing keys, so no breaking changes are introduced to the response envelope.
