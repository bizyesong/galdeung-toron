"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NanjangLogo } from "@/components/NanjangLogo";

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-cyan-500/15 bg-zinc-950/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-5">
        <Link
          href="/"
          className="group flex items-center outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          aria-label="첫 화면으로"
          onClick={(e) => {
            if (pathname === "/") {
              e.preventDefault();
              window.location.assign("/");
            }
          }}
        >
          <NanjangLogo
            height={34}
            className="shrink-0 transition group-hover:drop-shadow-[0_0_14px_rgba(168,85,247,0.35)]"
          />
        </Link>
      </div>
    </header>
  );
}
