import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — API Routes Inside VS Code`,
    template: `%s — ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [
    "API route explorer",
    "API routes VS Code",
    "VS Code API testing",
    "VS Code REST API client",
    "Express API routes",
    "Next.js API routes",
    "Fastify routes",
    "NestJS routes",
    "API route discovery",
    "OpenAPI VS Code",
    "API documentation VS Code",
    "REST API developer tools",
  ],
  authors: [{ name: siteConfig.author.name, url: siteConfig.author.url }],
  creator: siteConfig.author.name,
  alternates: {
    canonical: siteConfig.url,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: `${siteConfig.name} — Discover & Test API Routes in VS Code`,
    description: siteConfig.description,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `${siteConfig.name} Social Preview`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} — Discover & Test API Routes in VS Code`,
    description: siteConfig.description,
    images: ["/og-image.png"],
    creator: "@hussnain",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteConfig.url}/#website`,
        url: siteConfig.url,
        name: siteConfig.name,
        description: siteConfig.description,
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${siteConfig.url}/#software`,
        name: siteConfig.name,
        operatingSystem: "Windows, macOS, Linux",
        applicationCategory: "DeveloperApplication",
        softwareVersion: siteConfig.version,
        description: siteConfig.longDescription,
        url: siteConfig.url,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        author: {
          "@type": "Person",
          name: siteConfig.author.name,
          url: siteConfig.author.url,
        },
      },
    ],
  };

  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
