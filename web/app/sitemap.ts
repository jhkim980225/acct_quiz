import type { MetadataRoute } from "next";
import { listSubjectTags } from "@/models/question";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://acct-quiz.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const tags = await listSubjectTags();
  const subjects = [...new Set(tags.map((t) => t.subject))];
  return [
    { url: BASE, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/quiz`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/about`, changeFrequency: "monthly" as const, priority: 0.3 },
    { url: `${BASE}/privacy`, changeFrequency: "monthly" as const, priority: 0.1 },
    ...subjects.flatMap((s) =>
      ["분개", "결산"].map((p) => ({
        url: `${BASE}/${encodeURIComponent(s)}/${encodeURIComponent(p)}`,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ),
    ...tags.filter((t) => t.type_tag !== "미분류").map((t) => ({
      url: `${BASE}/${encodeURIComponent(t.subject)}/${encodeURIComponent(t.type_tag)}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
