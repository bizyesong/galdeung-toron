"use client";

import { HelpCircle, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

/** kebab/snake/camel → Lucide PascalCase export (예: dollar-sign → DollarSign) */
export function toLucideExportName(raw: string): string {
  const s = raw.trim();
  if (!s) return "HelpCircle";
  if (/^[A-Z][a-zA-Z0-9]*$/.test(s)) return s;
  return s
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join("");
}

/**
 * lucide-react를 동적 import하여 이름 기준으로 아이콘을 렌더합니다.
 * 첫 페인트는 HelpCircle이며, 청크 로드 후 교체됩니다.
 */
export function ExpertLucideIcon({
  name,
  className,
  strokeWidth = 2,
}: {
  name: string;
  className?: string;
  strokeWidth?: number;
}) {
  const [Icon, setIcon] = useState<LucideIcon>(() => HelpCircle);

  useEffect(() => {
    let cancelled = false;
    const key = toLucideExportName(name);
    void import("lucide-react").then((mod) => {
      if (cancelled) return;
      const icons = mod as unknown as Record<string, LucideIcon | undefined>;
      const Cmp = icons[key] ?? mod.HelpCircle;
      setIcon(() => Cmp);
    });
    return () => {
      cancelled = true;
    };
  }, [name]);

  return (
    <Icon className={className} strokeWidth={strokeWidth} aria-hidden focusable="false" />
  );
}
