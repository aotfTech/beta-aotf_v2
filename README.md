# Academy of Tutors Freelancers (AOTF) v2

Welcome to the **AOTF v2** repository. This is a full-stack Next.js web application built to serve the Academy of Tutors and Freelancers. It integrates modern web technologies to provide a fast, secure, and highly interactive user experience.

## 🚀 Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router)
- **Language:** TypeScript
- **Styling & UI:** [Tailwind CSS](https://tailwindcss.com/), [HeroUI](https://heroui.com/), [Radix UI](https://www.radix-ui.com/)
- **Animations:** [Framer Motion](https://www.framer.com/motion/), [GSAP](https://gsap.com/)
- **Authentication:** [Clerk](https://clerk.dev/)
- **Database:** [MongoDB](https://www.mongodb.com/) with [Mongoose](https://mongoosejs.com/)
- **Documentation:** [Fumadocs](https://fumadocs.vercel.app/)
- **Payments:** [Razorpay](https://razorpay.com/)
- **Email:** [Resend](https://resend.com/)
- **Media Storage:** [Cloudinary](https://cloudinary.com/)
- **Monitoring & Analytics:** [Sentry](https://sentry.io/), Vercel Analytics
- **Integrations:** Google Sheets API, Svix (Webhooks)
- **Package Manager:** [pnpm](https://pnpm.io/)

## 📂 Project Structure

- `app/`: Next.js App Router containing all pages, layouts, and API routes.
- `components/`: Reusable React components (UI primitives, forms, layout elements).
- `content/`: Markdown/MDX content for documentation (powered by Fumadocs).
- `lib/` & `utils/`: Utility functions, database connection, and third-party API wrappers.
- `models/` (or within `AOTF_database/`): Mongoose database schemas.
- `proxy.ts`: Custom proxy logic replacing standard Next.js middleware for specific route handling and edge compatibility.
- `scripts/`: Utility scripts for administrative tasks (e.g., `create-admin.ts`, benchmarking).
- `public/`: Static assets.

## 🛠️ Prerequisites

Ensure you have the following installed:
- **Node.js** (v22+ recommended)
- **pnpm** (v11+)
- A MongoDB cluster
- API keys for Clerk, Razorpay, Resend, Cloudinary, and Google Service Accounts.

## ⚙️ Environment Variables

Create a `.env.local` file in the root directory and configure the following variables:

```env
# Application Environment
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

# Database (MongoDB)
MONGODB_URI=

# Media Storage (Cloudinary)
CLOUDINARY_URL=

# Payments (Razorpay)
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
NEXT_PUBLIC_RAZORPAY_KEY_ID=
RAZORPAY_WEBHOOK_SECRET=

# Email (Resend)
RESEND_API_KEY=

# Google Sheets Integration
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
GOOGLE_SHEET_ID=
```

## 🚀 Getting Started

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Run the development server:**
   ```bash
   pnpm dev
   ```
   *The dev server uses Turbopack for optimized startup and HMR.*

3. **Open the app:**
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

## 📜 Available Scripts

- `pnpm dev`: Starts the Next.js development server using Turbopack.
- `pnpm build`: Builds the application for production.
- `pnpm start`: Starts the production server.
- `pnpm lint`: Runs ESLint with auto-fix.
- `pnpm create:admin`: Runs the script to create/assign admin privileges.
- `pnpm test:sheets`: Tests the Google Sheets API integration.
- `pnpm benchmark:api` / `pnpm benchmark:db`: Runs performance benchmarks.
- `pnpm ship:zip`: Packages the source code into a `.zip` archive (excluding `node_modules`, `.git`, etc.).

## 🛡️ License & Copyright

This project is proprietary. Ensure you adhere to the terms specified in the `LICENSE` file.