/**
 * 맛집·장소 주제에 넣을 외부 검색 스니펫.
 * TAVILY_API_KEY 또는 SERPAPI_KEY 가 있으면 호출하고, 없으면 빈 문자열.
 */

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

async function searchTavily(query: string): Promise<string> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return "";

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query,
      search_depth: "basic",
      max_results: 10,
      include_answer: false,
    }),
  });

  if (!res.ok) return "";
  const data = (await res.json()) as {
    results?: { title?: string; content?: string; url?: string }[];
  };
  const lines: string[] = [];
  for (const r of data.results ?? []) {
    const title = r.title ?? "";
    const content = clip(r.content ?? "", 320);
    const url = r.url ?? "";
    if (title || content) {
      lines.push(`- ${title}${url ? ` (${url})` : ""}\n  ${content}`);
    }
  }
  return lines.join("\n");
}

async function searchSerpApi(query: string): Promise<string> {
  const key = process.env.SERPAPI_KEY;
  if (!key) return "";

  const u = new URL("https://serpapi.com/search.json");
  u.searchParams.set("engine", "google");
  u.searchParams.set("q", query);
  u.searchParams.set("hl", "ko");
  u.searchParams.set("gl", "kr");
  u.searchParams.set("api_key", key);

  const res = await fetch(u.toString());
  if (!res.ok) return "";
  const data = (await res.json()) as {
    organic_results?: { title?: string; snippet?: string; link?: string }[];
  };
  const lines: string[] = [];
  for (const r of data.organic_results ?? []) {
    const title = r.title ?? "";
    const snip = clip(r.snippet ?? "", 280);
    const link = r.link ?? "";
    if (title || snip) {
      lines.push(`- ${title}${link ? ` (${link})` : ""}\n  ${snip}`);
    }
  }
  return lines.join("\n");
}

export async function fetchWebSearchContext(topic: string): Promise<string> {
  const q = `${topic} 식당 리뷰 영업시간 주차`.trim();
  const tavily = await searchTavily(q);
  if (tavily) return clip(tavily, 8000);
  const serp = await searchSerpApi(q);
  return clip(serp, 8000);
}
