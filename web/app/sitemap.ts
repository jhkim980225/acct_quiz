import type { MetadataRoute } from "next";
import { listSubjectTags } from "@/models/question";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://acct-quiz.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const tags = await listSubjectTags();
  return [
    { url: BASE, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/quiz`, changeFrequency: "weekly", priority: 0.6 },
    ...tags.map((t) => ({
      url: `${BASE}/${encodeURIComponent(t.subject)}/${encodeURIComponent(t.type_tag)}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
