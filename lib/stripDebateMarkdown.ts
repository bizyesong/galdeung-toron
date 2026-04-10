import type { DebatePayload, KakaoPlaceCandidate } from "./debateTypes";

/**
 * LLM이 자주 쓰는 **볼드** 마커를 제거해 자연스러운 문장만 남깁니다.
 */
export function stripDebateMarkdown(text: string): string {
  let s = text;
  for (let i = 0; i < 24; i += 1) {
    const next = s.replace(/\*\*([^*]+)\*\*/g, "$1");
    if (next === s) break;
    s = next;
  }
  return s.replace(/\*\*/g, "");
}

export function sanitizeDebatePayload(p: DebatePayload): DebatePayload {
  const strip = stripDebateMarkdown;
  return {
    ...p,
    followUpQuestions: p.followUpQuestions?.map(strip),
    kakaoPlaces: p.kakaoPlaces?.map((x) => ({
      ...x,
      id: strip(x.id),
      placeName: strip(x.placeName),
      address: strip(x.address),
      categoryName: strip(x.categoryName),
      phone: strip(x.phone),
      placeUrl: strip(x.placeUrl),
    })),
    topic: strip(p.topic),
    experts: p.experts.map((e) => ({
      ...e,
      name: strip(e.name),
      description: strip(e.description),
      claimOneLine:
        e.claimOneLine != null && String(e.claimOneLine).trim().length > 0
          ? strip(String(e.claimOneLine).trim())
          : undefined,
      bio: e.bio != null ? strip(e.bio) : undefined,
    })),
    turns: p.turns.map((t) => ({
      ...t,
      headline: strip(t.headline),
      body: strip(t.body),
      moodChip:
        t.moodChip != null && String(t.moodChip).trim().length > 0
          ? strip(String(t.moodChip).trim())
          : undefined,
    })),
    consensus: {
      ...p.consensus,
      summary: strip(p.consensus.summary),
      actions: p.consensus.actions.map(strip),
      closingLine:
        p.consensus.closingLine != null
          ? strip(p.consensus.closingLine)
          : undefined,
      whyThreeLines: p.consensus.whyThreeLines?.map(strip),
      options: p.consensus.options?.map(strip),
      keyFactors: p.consensus.keyFactors?.map(strip),
      risks: p.consensus.risks?.map(strip),
      expertVenuePicks: p.consensus.expertVenuePicks?.map((pick) => ({
        ...pick,
        venueName: strip(pick.venueName),
        placeUrl: pick.placeUrl?.trim(),
        menuPick: strip(pick.menuPick),
        reason: strip(pick.reason),
        locationAdvantage: strip(pick.locationAdvantage),
      })),
      finalPick: p.consensus.finalPick
        ? {
            ...p.consensus.finalPick,
            venueName: strip(p.consensus.finalPick.venueName),
            placeUrl: p.consensus.finalPick.placeUrl?.trim(),
            menuPick: strip(p.consensus.finalPick.menuPick),
            detailedReason: strip(p.consensus.finalPick.detailedReason),
            locationNote: strip(p.consensus.finalPick.locationNote),
          }
        : undefined,
    },
  };
}

/** 카카오 검색 결과를 페이로드에 붙이고 한 번 더 정규화 */
export function withKakaoPlaces(
  p: DebatePayload,
  places: KakaoPlaceCandidate[],
): DebatePayload {
  if (!places.length) return p;
  return sanitizeDebatePayload({ ...p, kakaoPlaces: places });
}
