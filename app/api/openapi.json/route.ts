import { NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/openapi.json
 *
 * Serves the hand-authored OpenAPI 3.1 specification for all AOTF API routes.
 * Consumed by the Fumadocs OpenAPI explorer at /docs/reference/openapi.
 */
async function get() {
  const spec = {
    openapi: "3.1.0",
    info: {
      title: "AOTF API",
      version: "1.0.0",
      description:
        "REST API for the Academy of Tutors & Freelancers (AOTF) platform. " +
        "All authenticated endpoints require a valid Clerk session token in the " +
        "`Authorization: Bearer <token>` header. Mutation endpoints also require " +
        "the request `Origin` or `Referer` header to match the application host " +
        "(CSRF protection).",
      contact: {
        name: "AOTF Engineering",
        url: "https://aotf.in",
      },
      license: {
        name: "Proprietary",
      },
    },
    servers: [
      { url: "https://aotf.in", description: "Production" },
      { url: "http://localhost:3000", description: "Local development" },
    ],
    tags: [
      { name: "Health", description: "Server and DB liveness check" },
      { name: "Users", description: "User account management" },
      { name: "Profile", description: "Provider profile data" },
      { name: "Onboarding", description: "Provider onboarding flow" },
      { name: "Posts", description: "Tuition post listings" },
      { name: "Jobs", description: "Job / freelance post listings" },
      { name: "Applications", description: "Provider application submissions" },
      { name: "Enquiry", description: "Consumer enquiry CRM" },
      { name: "Payments", description: "Razorpay payment flow" },
      { name: "Admin", description: "Admin-only management endpoints" },
      { name: "Webhooks", description: "Clerk and Razorpay webhook receivers" },
      { name: "Search", description: "Docs full-text search" },
    ],
    components: {
      securitySchemes: {
        ClerkBearer: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description:
            "Clerk session token. Obtain from `useAuth().getToken()` on the client " +
            "or from the `Authorization` header forwarded by the Clerk SDK.",
        },
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          required: ["error"],
          properties: {
            error: { type: "string", description: "Human-readable error message" },
            fieldErrors: {
              type: "object",
              additionalProperties: { type: "array", items: { type: "string" } },
              description: "Per-field validation errors (Zod failures only)",
            },
          },
        },
        ApplicationStatus: {
          type: "string",
          enum: ["applied", "DC", "GC", "approved", "decline", "auto_declined", "withdrawn"],
          description:
            "applied=submitted, DC=demo call scheduled, GC=guardian confirmed, " +
            "approved=selected, decline=rejected by admin, auto_declined=declined because another was approved, withdrawn=provider withdrew",
        },
        EnquiryStatus: {
          type: "string",
          enum: ["new", "in_progress", "contacted", "unreachable", "resolved", "closed"],
        },
      },
      responses: {
        Unauthorized: {
          description: "Authentication required",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { error: "Authentication required" },
            },
          },
        },
        Forbidden: {
          description: "Insufficient permissions or CSRF check failed",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { error: "Admin access required" },
            },
          },
        },
        NotFound: {
          description: "Resource not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { error: "Not found" },
            },
          },
        },
        TooManyRequests: {
          description: "Rate limit exceeded",
          headers: {
            "Retry-After": { schema: { type: "integer" } },
            "X-RateLimit-Remaining": { schema: { type: "integer" } },
            "X-RateLimit-Reset": { schema: { type: "integer" } },
          },
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { error: "Too many requests. Please try again later." },
            },
          },
        },
        InternalError: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { error: "Internal server error" },
            },
          },
        },
      },
    },
    security: [],
    paths: {
      // ─── Health ────────────────────────────────────────────────────────
      "/api/health": {
        get: {
          tags: ["Health"],
          summary: "Server & DB health check",
          description:
            "Returns the current DB connection status, process uptime, and app version. " +
            "Returns HTTP 200 when the DB is connected, HTTP 503 when it is unreachable.",
          operationId: "getHealth",
          responses: {
            "200": {
              description: "Server is healthy",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "string", enum: ["ok", "degraded"] },
                      db: { type: "string", enum: ["connected", "disconnected"] },
                      uptime: { type: "number", description: "Seconds since process start" },
                      version: { type: "string" },
                      timestamp: { type: "string", format: "date-time" },
                    },
                  },
                  example: { status: "ok", db: "connected", uptime: 3600, version: "0.0.1", timestamp: "2026-06-06T12:00:00.000Z" },
                },
              },
            },
            "503": {
              description: "DB unreachable",
              content: {
                "application/json": {
                  example: { status: "degraded", db: "disconnected", uptime: 3600, version: "0.0.1", timestamp: "2026-06-06T12:00:00.000Z" },
                },
              },
            },
          },
        },
      },

      // ─── Users ─────────────────────────────────────────────────────────
      "/api/v1/users": {
        get: {
          tags: ["Users"],
          summary: "List users (admin only)",
          security: [{ ClerkBearer: [] }],
          operationId: "listUsers",
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
            { name: "status", in: "query", schema: { type: "string", enum: ["active", "blocked", "deleted"] } },
            { name: "search", in: "query", schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "Paginated user list" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { $ref: "#/components/responses/Forbidden" },
          },
        },
      },
      "/api/v1/users/{clerkId}": {
        get: {
          tags: ["Users"],
          summary: "Get user by Clerk ID (admin only)",
          security: [{ ClerkBearer: [] }],
          operationId: "getUserByClerkId",
          parameters: [{ name: "clerkId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "User document" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { $ref: "#/components/responses/Forbidden" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
        patch: {
          tags: ["Users"],
          summary: "Update user status (admin only)",
          security: [{ ClerkBearer: [] }],
          operationId: "updateUserStatus",
          parameters: [{ name: "clerkId", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", enum: ["active", "blocked", "deleted"] },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Updated user" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { $ref: "#/components/responses/Forbidden" },
          },
        },
      },

      // ─── Me ────────────────────────────────────────────────────────────
      "/api/v1/me": {
        get: {
          tags: ["Users"],
          summary: "Get current authenticated user",
          security: [{ ClerkBearer: [] }],
          operationId: "getMe",
          responses: {
            "200": { description: "Current user + profile" },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },

      // ─── Profile ───────────────────────────────────────────────────────
      "/api/v1/profile": {
        get: {
          tags: ["Profile"],
          summary: "Get own profile",
          security: [{ ClerkBearer: [] }],
          operationId: "getOwnProfile",
          responses: {
            "200": { description: "Profile document" },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
        patch: {
          tags: ["Profile"],
          summary: "Update own profile",
          security: [{ ClerkBearer: [] }],
          operationId: "updateOwnProfile",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    displayName: { type: "string" },
                    bio: { type: "string", maxLength: 300 },
                    location: { type: "string" },
                    websiteUrl: { type: "string" },
                    subjects: { type: "array", items: { type: "string" } },
                    experience: { type: "number" },
                    gender: { type: "string", enum: ["male", "female", "other"] },
                    qualification: { type: "string" },
                    board: { type: "string", enum: ["CBSE", "ICSE", "WB"] },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Updated profile" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "415": { description: "Expected application/json" },
          },
        },
      },
      "/api/v1/profile/{username}": {
        get: {
          tags: ["Profile"],
          summary: "Get public profile by username",
          operationId: "getPublicProfile",
          parameters: [{ name: "username", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "Public profile" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },

      // ─── Onboarding ────────────────────────────────────────────────────
      "/api/v1/onboarding": {
        post: {
          tags: ["Onboarding"],
          summary: "Complete provider onboarding",
          description: "Called after successful Razorpay payment. Sets onboardingCompleted=true on User and syncs Clerk publicMetadata.",
          security: [{ ClerkBearer: [] }],
          operationId: "completeOnboarding",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["plan"],
                  properties: {
                    plan: { type: "string", enum: ["teacher", "teacher_candidate"] },
                    phone: { type: "string" },
                    whatsapp: { type: "string" },
                    address: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Onboarding completed" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "400": { description: "Validation error" },
          },
        },
      },

      // ─── Posts ─────────────────────────────────────────────────────────
      "/api/v1/posts": {
        get: {
          tags: ["Posts"],
          summary: "List tuition posts (public)",
          operationId: "listPosts",
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
            { name: "status", in: "query", schema: { type: "string", enum: ["open", "matched", "closed", "cancelled", "hold"] } },
            { name: "classType", in: "query", schema: { type: "string", enum: ["online", "offline", "both"] } },
          ],
          responses: {
            "200": { description: "Paginated posts" },
          },
        },
        post: {
          tags: ["Posts"],
          summary: "Create tuition post (admin only)",
          security: [{ ClerkBearer: [] }],
          operationId: "createPost",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["guardianName", "guardianPhone", "source", "students", "classType", "frequencyPerWeek", "location", "monthlyBudget"],
                  properties: {
                    guardianName: { type: "string" },
                    guardianPhone: { type: "string" },
                    enquiryId: { type: "string", description: "Optional ObjectId of linked enquiry" },
                    source: { type: "string" },
                    students: { type: "array", items: { type: "object" } },
                    classType: { type: "string", enum: ["online", "offline", "both"] },
                    frequencyPerWeek: { type: "number" },
                    preferredDays: { type: "array", items: { type: "string" } },
                    preferredTime: { type: "string" },
                    location: { type: "string" },
                    monthlyBudget: { type: "number" },
                    notes: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Created post" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { $ref: "#/components/responses/Forbidden" },
          },
        },
      },
      "/api/v1/posts/{postId}": {
        get: {
          tags: ["Posts"],
          summary: "Get single post by postId (public)",
          operationId: "getPost",
          parameters: [{ name: "postId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "Post document" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
        patch: {
          tags: ["Posts"],
          summary: "Update post (admin only)",
          security: [{ ClerkBearer: [] }],
          operationId: "updatePost",
          parameters: [{ name: "postId", in: "path", required: true, schema: { type: "string" } }],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
          responses: {
            "200": { description: "Updated post" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { $ref: "#/components/responses/Forbidden" },
          },
        },
        delete: {
          tags: ["Posts"],
          summary: "Delete post (admin only)",
          security: [{ ClerkBearer: [] }],
          operationId: "deletePost",
          parameters: [{ name: "postId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "Deleted" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { $ref: "#/components/responses/Forbidden" },
          },
        },
      },

      // ─── Jobs ──────────────────────────────────────────────────────────
      "/api/v1/jobs": {
        get: {
          tags: ["Jobs"],
          summary: "List job/freelance posts (public)",
          operationId: "listJobs",
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
            { name: "status", in: "query", schema: { type: "string", enum: ["open", "closed", "hold", "cancelled"] } },
            { name: "workType", in: "query", schema: { type: "string", enum: ["job", "project"] } },
          ],
          responses: { "200": { description: "Paginated jobs" } },
        },
        post: {
          tags: ["Jobs"],
          summary: "Create job post (admin only)",
          security: [{ ClerkBearer: [] }],
          operationId: "createJob",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["workType", "title", "clientName", "phoneNumber", "source", "companyType", "locationType", "location", "timing", "gender", "commissionBasis", "academyCommissionPercentage"],
                  properties: {
                    workType: { type: "string", enum: ["job", "project"] },
                    title: { type: "string" },
                    clientName: { type: "string" },
                    phoneNumber: { type: "string" },
                    enquiryId: { type: "string" },
                    source: { type: "string" },
                    companyType: { type: "string", enum: ["individual", "company"] },
                    locationType: { type: "string", enum: ["remote", "onsite", "hybrid"] },
                    location: { type: "string" },
                    timing: { type: "string" },
                    gender: { type: "string", enum: ["male", "female", "both", "all"] },
                    commissionBasis: { type: "string", enum: ["first_month", "project_value"] },
                    academyCommissionPercentage: { type: "number" },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Created job" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { $ref: "#/components/responses/Forbidden" },
          },
        },
      },
      "/api/v1/jobs/{jobId}": {
        get: { tags: ["Jobs"], summary: "Get single job (public)", operationId: "getJob", parameters: [{ name: "jobId", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Job document" }, "404": { $ref: "#/components/responses/NotFound" } } },
        patch: { tags: ["Jobs"], summary: "Update job (admin only)", security: [{ ClerkBearer: [] }], operationId: "updateJob", parameters: [{ name: "jobId", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { "200": { description: "Updated" }, "401": { $ref: "#/components/responses/Unauthorized" }, "403": { $ref: "#/components/responses/Forbidden" } } },
        delete: { tags: ["Jobs"], summary: "Delete job (admin only)", security: [{ ClerkBearer: [] }], operationId: "deleteJob", parameters: [{ name: "jobId", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Deleted" }, "401": { $ref: "#/components/responses/Unauthorized" }, "403": { $ref: "#/components/responses/Forbidden" } } },
      },

      // ─── Applications ──────────────────────────────────────────────────
      "/api/v1/applications": {
        get: {
          tags: ["Applications"],
          summary: "List applications",
          security: [{ ClerkBearer: [] }],
          operationId: "listApplications",
          parameters: [
            { name: "jobId", in: "query", schema: { type: "string" } },
            { name: "postId", in: "query", schema: { type: "string" } },
            { name: "status", in: "query", schema: { $ref: "#/components/schemas/ApplicationStatus" } },
          ],
          responses: { "200": { description: "Application list" }, "401": { $ref: "#/components/responses/Unauthorized" } },
        },
        post: {
          tags: ["Applications"],
          summary: "Submit application",
          security: [{ ClerkBearer: [] }],
          operationId: "createApplication",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    jobId: { type: "string" },
                    postId: { type: "string" },
                    coverLetter: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Application submitted" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "409": { description: "Already applied" },
          },
        },
      },
      "/api/v1/applications/{applicationId}": {
        get: { tags: ["Applications"], summary: "Get application", security: [{ ClerkBearer: [] }], operationId: "getApplication", parameters: [{ name: "applicationId", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Application" }, "401": { $ref: "#/components/responses/Unauthorized" }, "404": { $ref: "#/components/responses/NotFound" } } },
        patch: { tags: ["Applications"], summary: "Update application status (admin)", security: [{ ClerkBearer: [] }], operationId: "updateApplication", parameters: [{ name: "applicationId", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { status: { $ref: "#/components/schemas/ApplicationStatus" }, dcDate: { type: "string", format: "date-time" } } } } } }, responses: { "200": { description: "Updated" }, "401": { $ref: "#/components/responses/Unauthorized" }, "403": { $ref: "#/components/responses/Forbidden" } } },
      },

      // ─── Enquiry ───────────────────────────────────────────────────────
      "/api/v1/enquiry": {
        post: {
          tags: ["Enquiry"],
          summary: "Submit enquiry (public)",
          description: "The only public POST mutation in the API. No auth required. Rate-limited by IP.",
          operationId: "createEnquiry",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "phoneNumber", "query"],
                  properties: {
                    name: { type: "string" },
                    phoneNumber: { type: "string" },
                    query: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Enquiry created" },
            "429": { $ref: "#/components/responses/TooManyRequests" },
          },
        },
        get: {
          tags: ["Enquiry"],
          summary: "List enquiries (admin only)",
          security: [{ ClerkBearer: [] }],
          operationId: "listEnquiries",
          parameters: [
            { name: "status", in: "query", schema: { $ref: "#/components/schemas/EnquiryStatus" } },
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          ],
          responses: { "200": { description: "Enquiry list" }, "401": { $ref: "#/components/responses/Unauthorized" }, "403": { $ref: "#/components/responses/Forbidden" } },
        },
      },
      "/api/v1/enquiry/{enquiryId}": {
        get: { tags: ["Enquiry"], summary: "Get enquiry (admin)", security: [{ ClerkBearer: [] }], operationId: "getEnquiry", parameters: [{ name: "enquiryId", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Enquiry" }, "401": { $ref: "#/components/responses/Unauthorized" }, "404": { $ref: "#/components/responses/NotFound" } } },
        patch: { tags: ["Enquiry"], summary: "Update enquiry status (admin)", security: [{ ClerkBearer: [] }], operationId: "updateEnquiry", parameters: [{ name: "enquiryId", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { currentStatus: { $ref: "#/components/schemas/EnquiryStatus" }, lastActionNote: { type: "string" } } } } } }, responses: { "200": { description: "Updated" }, "401": { $ref: "#/components/responses/Unauthorized" }, "403": { $ref: "#/components/responses/Forbidden" } } },
      },

      // ─── Payments ──────────────────────────────────────────────────────
      "/api/v1/payments/create-order": {
        post: {
          tags: ["Payments"],
          summary: "Create Razorpay order (onboarding)",
          description: "Creates a Razorpay order for provider registration fee. Only callable during onboarding.",
          security: [{ ClerkBearer: [] }],
          operationId: "createPaymentOrder",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["plan"],
                  properties: { plan: { type: "string", enum: ["teacher", "teacher_candidate"] } },
                },
              },
            },
          },
          responses: {
            "200": { description: "Razorpay order object", content: { "application/json": { schema: { type: "object", properties: { orderId: { type: "string" }, amount: { type: "number" }, currency: { type: "string" } } } } } },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/api/v1/payments/verify": {
        post: {
          tags: ["Payments"],
          summary: "Verify Razorpay payment",
          description: "Verifies the Razorpay signature and marks onboarding as paid. Triggers Clerk metadata sync.",
          security: [{ ClerkBearer: [] }],
          operationId: "verifyPayment",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["razorpay_order_id", "razorpay_payment_id", "razorpay_signature"],
                  properties: {
                    razorpay_order_id: { type: "string" },
                    razorpay_payment_id: { type: "string" },
                    razorpay_signature: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Payment verified" },
            "400": { description: "Invalid signature" },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },

      // ─── Admin ─────────────────────────────────────────────────────────
      "/api/v1/admin/admins": {
        get: {
          tags: ["Admin"],
          summary: "List admins (canManageAdmins)",
          security: [{ ClerkBearer: [] }],
          operationId: "listAdmins",
          responses: { "200": { description: "Admin list" }, "401": { $ref: "#/components/responses/Unauthorized" }, "403": { $ref: "#/components/responses/Forbidden" } },
        },
      },
      "/api/v1/admin/applications": {
        get: {
          tags: ["Admin"],
          summary: "List all applications across posts/jobs",
          security: [{ ClerkBearer: [] }],
          operationId: "adminListApplications",
          responses: { "200": { description: "Applications" }, "401": { $ref: "#/components/responses/Unauthorized" }, "403": { $ref: "#/components/responses/Forbidden" } },
        },
      },
      "/api/v1/admin/calendar": {
        get: {
          tags: ["Admin"],
          summary: "Get calendar events",
          security: [{ ClerkBearer: [] }],
          operationId: "getCalendarEvents",
          parameters: [
            { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
            { name: "to", in: "query", schema: { type: "string", format: "date-time" } },
            { name: "category", in: "query", schema: { type: "string", enum: ["tuition", "job", "enquiry", "feedback", "reminder"] } },
          ],
          responses: { "200": { description: "Calendar events" }, "401": { $ref: "#/components/responses/Unauthorized" }, "403": { $ref: "#/components/responses/Forbidden" } },
        },
      },
      "/api/admin/join": {
        post: {
          tags: ["Admin"],
          summary: "Admin account join / registration (public with token)",
          description: "Used with an invite token to create an admin Clerk account. Public endpoint — does NOT require Clerk session.",
          operationId: "adminJoin",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["token", "password"],
                  properties: {
                    token: { type: "string", description: "Invite token from AdminInvite model" },
                    password: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Admin account created" },
            "400": { description: "Invalid or expired token" },
          },
        },
      },

      // ─── Webhooks ──────────────────────────────────────────────────────
      "/api/v1/webhooks/clerk": {
        post: {
          tags: ["Webhooks"],
          summary: "Clerk webhook receiver",
          description:
            "Receives Clerk user lifecycle events (user.created, user.updated, user.deleted). " +
            "Authenticated by Svix signature headers (svix-id, svix-timestamp, svix-signature). " +
            "Bypasses ClerkMiddleware (handled in proxy.ts) so Svix headers reach the handler intact. " +
            "Uses WebhookEvent as an idempotency guard.",
          operationId: "clerkWebhook",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    type: { type: "string", enum: ["user.created", "user.updated", "user.deleted"] },
                    data: { type: "object" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Event received and processed" },
            "400": { description: "Signature verification failed" },
            "500": { description: "Processing error — Clerk will retry" },
          },
        },
      },
      "/api/v1/webhooks/razorpay": {
        post: {
          tags: ["Webhooks"],
          summary: "Razorpay webhook receiver",
          description: "Receives Razorpay payment events (payment.captured, payment.failed). Verified with RAZORPAY_WEBHOOK_SECRET.",
          operationId: "razorpayWebhook",
          responses: {
            "200": { description: "Event processed" },
            "400": { description: "Signature verification failed" },
          },
        },
      },

      // ─── Search ────────────────────────────────────────────────────────
      "/api/search": {
        get: {
          tags: ["Search"],
          summary: "Fumadocs full-text docs search (public)",
          operationId: "searchDocs",
          parameters: [{ name: "q", in: "query", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Search results" } },
        },
      },
    },
  };

  return NextResponse.json(spec, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

export const GET = withApiErrorHandling(get, "GET /api/openapi.json");
