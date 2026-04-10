"use client";

import { useId } from "react";

type NanjangLogoProps = {
  className?: string;
  /** 로고 높이(px) */
  height?: number;
};

/**
 * NANJANG 워드마크 — 글자 간격을 두어 N·A가 겹치지 않음, 시안→바이올렛 그라데이션
 */
export function NanjangLogo({ className = "", height = 36 }: NanjangLogoProps) {
  const gid = useId().replace(/:/g, "");
  const w = (height / 36) * 232;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 232 36"
      width={w}
      height={height}
      className={className}
      aria-label="NANJANG"
      role="img"
    >
      <defs>
        <linearGradient
          id={`nj-grad-${gid}`}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="0%"
        >
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="50%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>

      <text
        x="116"
        y="27"
        textAnchor="middle"
        fill={`url(#nj-grad-${gid})`}
        fontSize="23"
        fontWeight="800"
        fontFamily="inherit"
        letterSpacing="0.14em"
        className="drop-shadow-[0_0_10px_rgba(34,211,238,0.35)]"
      >
        NANJANG
      </text>
    </svg>
  );
}
