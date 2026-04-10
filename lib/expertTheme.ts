/** LLM·로컬 생성기가 쓸 수 있는 테마 키 (Tailwind 유틸과 매핑) */
export type ExpertThemeColor =
  | "sky"
  | "emerald"
  | "amber"
  | "rose"
  | "violet"
  | "orange"
  | "cyan"
  | "lime"
  | "fuchsia"
  | "slate"
  | "zinc"
  | "red"
  | "teal";

export const ALLOWED_EXPERT_COLORS: readonly ExpertThemeColor[] = [
  "sky",
  "emerald",
  "amber",
  "rose",
  "violet",
  "orange",
  "cyan",
  "lime",
  "fuchsia",
  "slate",
  "zinc",
  "red",
  "teal",
] as const;

const FALLBACK_ROTATION: ExpertThemeColor[] = ["amber", "slate", "violet"];

export interface ExpertVisualStyle {
  card: string;
  bubble: string;
  avatar: string;
  iconClass: string;
}

export const EXPERT_THEME_STYLES: Record<
  ExpertThemeColor,
  ExpertVisualStyle
> = {
  sky: {
    card: "border-sky-500/35 bg-gradient-to-br from-sky-500/12 to-cyan-500/8",
    bubble:
      "border-sky-500/30 bg-gradient-to-br from-sky-500/10 to-cyan-500/5 text-sky-50",
    avatar:
      "bg-gradient-to-br from-sky-400 to-cyan-500 text-zinc-950 ring-2 ring-sky-300/45",
    iconClass: "text-sky-200",
  },
  emerald: {
    card: "border-emerald-500/35 bg-gradient-to-br from-emerald-500/12 to-teal-500/8",
    bubble:
      "border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 text-emerald-50",
    avatar:
      "bg-gradient-to-br from-emerald-400 to-teal-500 text-zinc-950 ring-2 ring-emerald-300/45",
    iconClass: "text-emerald-200",
  },
  amber: {
    card: "border-amber-400/35 bg-gradient-to-br from-amber-500/12 to-rose-500/8",
    bubble:
      "border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-rose-500/5 text-amber-50",
    avatar:
      "bg-gradient-to-br from-amber-400 to-rose-500 text-zinc-950 ring-2 ring-amber-300/45",
    iconClass: "text-amber-200",
  },
  rose: {
    card: "border-rose-500/35 bg-gradient-to-br from-rose-500/12 to-pink-500/8",
    bubble:
      "border-rose-500/30 bg-gradient-to-br from-rose-500/10 to-pink-500/5 text-rose-50",
    avatar:
      "bg-gradient-to-br from-rose-400 to-pink-500 text-zinc-950 ring-2 ring-rose-300/45",
    iconClass: "text-rose-200",
  },
  violet: {
    card: "border-violet-500/35 bg-gradient-to-br from-violet-500/12 to-purple-500/8",
    bubble:
      "border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-purple-500/5 text-violet-50",
    avatar:
      "bg-gradient-to-br from-violet-400 to-purple-500 text-zinc-950 ring-2 ring-violet-300/45",
    iconClass: "text-violet-200",
  },
  orange: {
    card: "border-orange-500/35 bg-gradient-to-br from-orange-500/12 to-amber-500/8",
    bubble:
      "border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-amber-500/5 text-orange-50",
    avatar:
      "bg-gradient-to-br from-orange-400 to-amber-500 text-zinc-950 ring-2 ring-orange-300/45",
    iconClass: "text-orange-200",
  },
  cyan: {
    card: "border-cyan-500/35 bg-gradient-to-br from-cyan-500/12 to-sky-500/8",
    bubble:
      "border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-sky-500/5 text-cyan-50",
    avatar:
      "bg-gradient-to-br from-cyan-400 to-sky-500 text-zinc-950 ring-2 ring-cyan-300/45",
    iconClass: "text-cyan-200",
  },
  lime: {
    card: "border-lime-500/35 bg-gradient-to-br from-lime-500/12 to-green-500/8",
    bubble:
      "border-lime-500/30 bg-gradient-to-br from-lime-500/10 to-green-500/5 text-lime-50",
    avatar:
      "bg-gradient-to-br from-lime-400 to-green-600 text-zinc-950 ring-2 ring-lime-300/45",
    iconClass: "text-lime-200",
  },
  fuchsia: {
    card: "border-fuchsia-500/35 bg-gradient-to-br from-fuchsia-500/12 to-pink-600/8",
    bubble:
      "border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 to-pink-600/5 text-fuchsia-50",
    avatar:
      "bg-gradient-to-br from-fuchsia-400 to-pink-600 text-zinc-950 ring-2 ring-fuchsia-300/45",
    iconClass: "text-fuchsia-200",
  },
  slate: {
    card: "border-slate-500/35 bg-gradient-to-br from-slate-600/25 to-zinc-900/50",
    bubble:
      "border-slate-500/35 bg-gradient-to-br from-slate-600/15 to-zinc-900/40 text-slate-100",
    avatar:
      "bg-gradient-to-br from-slate-400 to-slate-600 text-zinc-950 ring-2 ring-slate-500/40",
    iconClass: "text-slate-200",
  },
  zinc: {
    card: "border-zinc-600/40 bg-gradient-to-br from-zinc-700/30 to-zinc-900/50",
    bubble:
      "border-zinc-600/35 bg-gradient-to-br from-zinc-700/20 to-zinc-900/45 text-zinc-100",
    avatar:
      "bg-gradient-to-br from-zinc-500 to-zinc-700 text-white ring-2 ring-zinc-500/45",
    iconClass: "text-zinc-200",
  },
  red: {
    card: "border-red-500/35 bg-gradient-to-br from-red-500/12 to-orange-600/8",
    bubble:
      "border-red-500/30 bg-gradient-to-br from-red-500/10 to-orange-600/5 text-red-50",
    avatar:
      "bg-gradient-to-br from-red-400 to-orange-600 text-zinc-950 ring-2 ring-red-300/45",
    iconClass: "text-red-200",
  },
  teal: {
    card: "border-teal-500/35 bg-gradient-to-br from-teal-500/12 to-emerald-600/8",
    bubble:
      "border-teal-500/30 bg-gradient-to-br from-teal-500/10 to-emerald-600/5 text-teal-50",
    avatar:
      "bg-gradient-to-br from-teal-400 to-emerald-600 text-zinc-950 ring-2 ring-teal-300/45",
    iconClass: "text-teal-200",
  },
};

export function normalizeExpertColor(
  raw: string | undefined,
  fallbackIndex: number,
): ExpertThemeColor {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (ALLOWED_EXPERT_COLORS.includes(s as ExpertThemeColor)) {
    return s as ExpertThemeColor;
  }
  return FALLBACK_ROTATION[fallbackIndex % FALLBACK_ROTATION.length]!;
}

export function getExpertVisual(
  color: string | undefined,
  fallbackIndex: number,
): ExpertVisualStyle {
  const key = normalizeExpertColor(color, fallbackIndex);
  return EXPERT_THEME_STYLES[key];
}
