import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-nanjang-display",
});

export const metadata: Metadata = {
  title: "NANJANG (난장) — AI 난장판 토론",
  description:
    "AI 전문가들이 제약 없이 떠들썩하게 토론하며 당신의 고민과 결정 장애를 함께 해결합니다.",
  openGraph: {
    title: "NANJANG (난장)",
    description:
      "당신의 고민을 난장판에 맡겨보세요",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={spaceGrotesk.variable}>
      <body
        className={`min-h-screen bg-zinc-950 text-zinc-100 antialiased ${spaceGrotesk.className}`}
      >
        {children}
      </body>
    </html>
  );
}
