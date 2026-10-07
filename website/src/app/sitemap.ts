import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    { url: "", priority: 1.0, changeFrequency: "weekly" as const },
    { url: "/features", priority: 0.9, changeFrequency: "monthly" as const },
    { url: "/frameworks", priority: 0.9, changeFrequency: "monthly" as const },
    { url: "/install", priority: 0.9, changeFrequency: "monthly" as const },
    { url: "/security", priority: 0.8, changeFrequency: "monthly" as const },
    { url: "/changelog", priority: 0.8, changeFrequency: "weekly" as const },
    { url: "/docs", priority: 0.9, changeFrequency: "weekly" as const },
    { url: "/docs/getting-started", priority: 0.8, changeFrequency: "monthly" as const },
    { url: "/docs/route-discovery", priority: 0.8, changeFrequency: "monthly" as const },
    { url: "/docs/route-analysis", priority: 0.8, changeFrequency: "monthly" as const },
    { url: "/docs/http-client", priority: 0.8, changeFrequency: "monthly" as const },
    { url: "/docs/openapi", priority: 0.8, changeFrequency: "monthly" as const },
    { url: "/docs/troubleshooting", priority: 0.7, changeFrequency: "monthly" as const },
  ];

  const lastModified = new Date("2026-10-07T00:00:00.000Z");

  return routes.map((route) => ({
    url: `${siteConfig.url}${route.url}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
