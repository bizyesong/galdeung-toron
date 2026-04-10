"use client";

import { stripDebateMarkdown } from "@/lib/stripDebateMarkdown";

/** 토론 본문 표시(남은 ** 마커는 제거해 평문으로) */
export function FormattedDebateBody({ text }: { text: string }) {
  return (
    <span className="whitespace-pre-wrap leading-[1.85]">
      {stripDebateMarkdown(text)}
    </span>
  );
}
