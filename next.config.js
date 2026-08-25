import { createMDX } from "fumadocs-mdx/next";
import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const DEFAULT_CLERK_ORIGINS = [
  "https://*.clerk.accounts.dev",
  "https://*.clerk.dev",
  "https://clerk.aotf.sayantanbal.in",
  "https://clerk.beta.aotf.in",
  "https://clerk.aotf.in",
];

function toHttpsOrigin(value) {
  if (!value) return null;

  try {
    const hasScheme = /^https?:\/\//i.test(value);
    const url = new URL(hasScheme ? value : `https://${value}`);
    return url.origin;
  } catch {
    return null;
  }
}

function getClerkOrigins() {
  const envDerivedOrigins = [
    process.env.NEXT_PUBLIC_CLERK_FRONTEND_API,
    process.env.NEXT_PUBLIC_CLERK_FRONTEND_API_URL,
    process.env.CLERK_FAPI,
    process.env.CLERK_PROXY_URL,
    process.env.NEXT_PUBLIC_CLERK_PROXY_URL,
  ]
    .map(toHttpsOrigin)
    .filter(Boolean);

  return Array.from(new Set([...DEFAULT_CLERK_ORIGINS, ...envDerivedOrigins]));
}

const nextConfig = {
  allowedDevOrigins: ["unproductive-superuniversally-lizbeth.ngrok-free.dev"],

  // Performance optimizations
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**", // wildcard: allows all domains
      },
    ],
    formats: ["image/webp", "image/avif"],
  },

  // API body size limit (default is 1MB; explicit for clarity)
  serverExternalPackages: [],
  experimental: {
    serverActions: {
      bodySizeLimit: "1mb",
    },
  },

  // Security headers
  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    const clerkOrigins = getClerkOrigins();
    const clerkOriginsStr = clerkOrigins.join(" ");
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
          // HSTS: force HTTPS for 1 year (only in production)
          ...(isProd
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains; preload",
                },
              ]
            : []),
          // Content-Security-Policy: mitigate XSS
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Clerk serves its runtime from subdomains like *.clerk.accounts.dev.
              // Keep dev unsafe-eval for Next HMR while allowing Clerk script origins.
              isProd
                ? `script-src 'self' 'unsafe-inline' ${clerkOriginsStr} https://hcaptcha.com https://*.hcaptcha.com https://challenges.cloudflare.com https://checkout.razorpay.com`
                : `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${clerkOriginsStr} https://hcaptcha.com https://*.hcaptcha.com https://challenges.cloudflare.com https://checkout.razorpay.com`,
              "worker-src 'self' blob:",
              "style-src 'self' 'unsafe-inline'", // HeroUI uses inline styles
              "img-src 'self' data: https: blob:", // allow remote images
              "font-src 'self' data:",
              `connect-src 'self' ${clerkOriginsStr} https://api.clerk.com https://clerk-telemetry.com https://hcaptcha.com https://*.hcaptcha.com https://challenges.cloudflare.com https://lumberjack.razorpay.com https://api.razorpay.com https:`,
              `frame-src 'self' ${clerkOriginsStr} https://hcaptcha.com https://*.hcaptcha.com https://challenges.cloudflare.com https://api.razorpay.com https://checkout.razorpay.com`,
              "frame-ancestors 'none'", // equivalent to X-Frame-Options DENY
              "base-uri 'self'",
              "form-action 'self'",
              "manifest-src 'self' https://docs.aotf.in",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

const withMDX = createMDX({
  // customize the config file path
  // configPath: "source.config.ts"
});

export default withSentryConfig(withMDX(nextConfig), {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "aotf",
  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
