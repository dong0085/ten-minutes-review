import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: env.appUrl,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${env.appUrl}/about`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${env.appUrl}/privacy`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
