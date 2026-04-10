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

/** 구 로컬 템플릿·면책 강의체를 OpenAI가 복붙한 opening 본문 */
function isMatjipMetaLectureOpeningBody(body: string): boolean {
  const head = body.slice(0, 500);
  if (/비교·검증의\s*출발점/.test(head)) return true;
  if (/먼저\s*거론하는\s*건/.test(head) && /카카오에\s*찍힌/.test(head))
    return true;
  if (/말할게요/.test(head) && /이번\s*검색\s*목록에서/.test(head)) return true;
  return false;
}

/**
 * 맛집 모드에서 모델이 예전 고정 대사(메타·면책 설명)를 그대로보낸 경우 opening만 교체.
 * (로컬 폴백 문구를 학습·재현하는 경우 대비)
 */
export function stripMatjipMetaLectureOpening(
  p: DebatePayload,
  places: KakaoPlaceCandidate[],
): DebatePayload {
  if (!places.length) return p;
  const idx = p.turns.findIndex((t) => t.phase === "opening");
  if (idx < 0) return p;
  const turn = p.turns[idx]!;
  if (!isMatjipMetaLectureOpeningBody(turn.body)) return p;
  const name = places[0]?.placeName?.trim() || "첫 후보";
  const replacement = `저는 일단 ${name}부터 짚을게요. 오늘 검색에 같이 뜬 집들끼리 비교할 때 여기서부터 까는 게 편하거든요. 주소만 보고 무조건 여기는 아니에요. 맛·자리·영업은 카카오맵 후기랑 오늘 영업만 꼭 확인하세요.`;
  const turns = p.turns.slice();
  turns[idx] = { ...turn, body: replacement };
  return { ...p, turns };
}
