"use client";

import type { ReactNode } from "react";
import { ExternalLink, MapPin } from "lucide-react";
import type { KakaoPlaceCandidate } from "@/lib/debateTypes";
import { stripDebateMarkdown } from "@/lib/stripDebateMarkdown";

/**
 * 본문에 등장하는 카카오 검색 상호와 동일한 문자열을 카카오맵 링크로 연결합니다.
 */
export function LinkedPlacesText({
  text,
  places,
}: {
  text: string;
  places: KakaoPlaceCandidate[];
}) {
  const clean = stripDebateMarkdown(text);
  const sorted = [...places]
    .filter((p) => p.placeName.length > 0 && p.placeUrl.length > 0)
    .sort((a, b) => b.placeName.length - a.placeName.length);

  const nodes: ReactNode[] = [];
  let remaining = clean;
  let key = 0;

  while (remaining.length > 0) {
    let best: {
      index: number;
      len: number;
      url: string;
      name: string;
    } | null = null;

    for (const p of sorted) {
      const idx = remaining.indexOf(p.placeName);
      if (idx < 0) continue;
      if (
        !best ||
        idx < best.index ||
        (idx === best.index && p.placeName.length > best.len)
      ) {
        best = {
          index: idx,
          len: p.placeName.length,
          url: p.placeUrl,
          name: p.placeName,
        };
      }
    }

    if (!best) {
      nodes.push(<span key={key++}>{remaining}</span>);
      break;
    }

    if (best.index > 0) {
      nodes.push(<span key={key++}>{remaining.slice(0, best.index)}</span>);
    }

    nodes.push(
      <a
        key={key++}
        href={best.url.startsWith("http://") ? `https://${best.url.slice(7)}` : best.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-medium text-cyan-300 underline decoration-violet-500/50 underline-offset-2 hover:text-cyan-200"
      >
        <MapPin className="h-3.5 w-3.5 shrink-0 text-amber-400/90" aria-hidden />
        {best.name}
        <ExternalLink className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
      </a>,
    );
    remaining = remaining.slice(best.index + best.len);
  }

  return <span className="whitespace-pre-wrap leading-[1.85]">{nodes}</span>;
}
