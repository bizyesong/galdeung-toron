/** 패널 발언 핵심 요약 표시 상한(공백 포함). LLM에도 동일 기준으로 요청 */
export const OPINION_SUMMARY_DISPLAY_MAX = 40;

/** MC 최종 한 줄은 조금만 더 길게 허용 */
export const MC_SUMMARY_DISPLAY_MAX = 52;

/**
 * 모델이 길게 준 headline을 카드 폭에 맞게만 자름(표시용).
 * 의미는 프롬프트로 고치고, 여기선 남는 꼬리만 정리.
 */
export function clampOpinionSummaryForDisplay(
  raw: string,
  max = OPINION_SUMMARY_DISPLAY_MAX,
): string {
  const s = raw.replace(/\s+/g, " ").trim();
  if (!s) return s;
  if (s.length <= max) return s;

  const slice = s.slice(0, max + 1);
  const minCut = Math.floor(max * 0.32);
  let best = -1;
  for (const sep of ["。", ".", "!", "?", ",", "·", "—", "–", " "]) {
    const i = slice.lastIndexOf(sep);
    if (i >= minCut) best = Math.max(best, i);
  }

  let out =
    best >= 8 ? s.slice(0, best).trim() : s.slice(0, max).trim();
  out = out.replace(/[,.!?·。…\s—–]+$/u, "");
  if (out.length < 6) out = s.slice(0, max).trim();
  return out.length < s.length ? `${out}…` : out;
}
