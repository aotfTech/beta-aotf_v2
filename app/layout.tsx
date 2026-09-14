import "@/styles/globals.css";
import { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import clsx from "clsx";
import { RootProvider } from "fumadocs-ui/provider/next";
import { headers } from "next/headers";
import Script from "next/script";

import { Providers } from "./providers";

import { siteConfig } from "@/config/site";
import { fontSans } from "@/config/fonts";
import { SiteShell } from "@/components/site-shell";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};
export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: siteConfig.seo.titleTemplate,
  },
  description: siteConfig.description,
  keywords: siteConfig.seo.keywords,
  authors: [
    {
      name: siteConfig.seo.author,
      url: siteConfig.url,
    },
  ],
  creator: siteConfig.seo.author,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [
      {
        url: siteConfig.seo.ogImage,
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: [siteConfig.seo.ogImage],
    creator: siteConfig.seo.twitterHandle,
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: `${siteConfig.url}/site.webmanifest`,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-aotf-pathname") ?? "/";
  const showChrome = !pathname.startsWith("/docs");

  return (
    <html suppressHydrationWarning lang="en">
      <head>
        <Script
          src="https://cloud.umami.is/script.js"
          data-website-id="bbf2495e-d085-44a8-a36f-bfcf0f11421d"
          strategy="afterInteractive"
        />
      </head>
      <body
        className={clsx(
          "text-foreground bg-background font-sans antialiased min-h-screen flex flex-col",
          fontSans.variable
        )}
      >
        <ClerkProvider
          localization={{
            unstable__errors: {
              form_identifier_exists__email_address:
                "This email already belongs to an account. Sign in to continue with the same account, then add password login in the next step.",
              form_identifier_exists__username:
                "This username is already taken by an existing account. Sign in instead to link your login methods.",
              form_identifier_exists:
                "An account already exists with these details. Sign in to continue and link login options.",
            },
          }}
        >
          <RootProvider>
            <Providers
              themeProps={{ attribute: "class", defaultTheme: "light" }}
            >
              <SiteShell showChrome={showChrome}>{children}</SiteShell>
            </Providers>
          </RootProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
