import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: env.appUrl,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
