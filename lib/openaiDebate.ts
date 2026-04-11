import type {
  ConsensusResult,
  DebatePayload,
  DebatePhase,
  DebateTurn,
  ExpertProfile,
  ExpertVenuePick,
  FinalVenuePick,
  KakaoPlaceCandidate,
} from "./debateTypes";
import {
  buildLocalDebate,
  defaultFollowUpQuestionsForTopic,
  enrichConsensusResult,
} from "./dynamicDebate";
import {
  attachKakaoUrlsToFoodConsensus,
  formatKakaoPlacesForPrompt,
} from "./kakaoLocalSearch";
import {
  sanitizeDebatePayload,
  stripMatjipMetaLectureOpening,
  withKakaoPlaces,
} from "./stripDebateMarkdown";
import { normalizeExpertColor } from "./expertTheme";
import { LUCIDE_ICON_PROMPT_BLOCK } from "./lucidePromptCatalog";
import { isTravelBudgetTopic } from "./topicDetect";
import {
  clampOpinionSummaryForDisplay,
  MC_SUMMARY_DISPLAY_MAX,
  OPINION_SUMMARY_DISPLAY_MAX,
} from "./opinionSummaryDisplay";

function normalizePhase(v: unknown): DebatePhase {
  const s = String(v ?? "").trim();
  const m: Record<string, DebatePhase> = {
    deep1: "opening",
    rebuttal2: "rebuttal",
    critique3: "synthesis",
    free: "synthesis",
    conclusion: "final_summary",
    opening: "opening",
    rebuttal: "rebuttal",
    synthesis: "synthesis",
    final_summary: "final_summary",
  };
  return m[s] ?? "opening";
}

function normalizeDebateTurns(turns: DebateTurn[]): DebateTurn[] {
  if (turns.length <= 4) {
    return turns.map((t) => ({ ...t, phase: normalizePhase(t.phase) }));
  }
  if (turns.length >= 7) {
    const a = turns[0]!;
    const b = turns[1]!;
    const c = turns[2]!;
    const d = turns[3]!;
    const e = turns[4]!;
    const f = turns[5]!;
    const g = turns[6]!;
    const synthBody = [c.body, d.body, e.body, f.body].join("\n\n");
    return [
      { ...a, phase: "opening" },
      { ...b, phase: "rebuttal" },
      {
        ...c,
        phase: "synthesis",
        body: `두 분 다 진정하시고요—제 생각은 이래요.\n\n${synthBody}`,
      },
      { ...g, phase: "final_summary" },
    ];
  }
  return turns.map((t) => ({ ...t, phase: normalizePhase(t.phase) }));
}

function parseExpertsFromAssigned(raw: unknown): ExpertProfile[] | null {
  if (!Array.isArray(raw) || raw.length !== 3) return null;
  const out: ExpertProfile[] = [];
  for (let i = 0; i < 3; i += 1) {
    const e = raw[i] as Record<string, unknown>;
    const idNum = Number(e.id ?? i + 1);
    const id = idNum >= 1 && idNum <= 3 ? idNum : i + 1;
    out.push({
      id,
      name: String(e.name ?? `전문가 ${i + 1}`),
      description: String(e.description ?? ""),
      bio: typeof e.bio === "string" ? e.bio : undefined,
      iconName: String(e.iconName ?? "HelpCircle"),
      color: normalizeExpertColor(String(e.color), i),
    });
  }
  return out;
}

function parseExpertsLegacy(raw: unknown): ExpertProfile[] | null {
  if (!Array.isArray(raw) || raw.length !== 3) return null;
  const out: ExpertProfile[] = [];
  for (let i = 0; i < 3; i += 1) {
    const e = raw[i] as Record<string, unknown>;
    out.push({
      id: i + 1,
      name: String(e.name ?? `전문가 ${i + 1}`),
      description: String(e.description ?? e.role ?? ""),
      bio: typeof e.bio === "string" ? e.bio : undefined,
      iconName: String(e.iconName ?? "HelpCircle"),
      color: normalizeExpertColor(String(e.color), i),
    });
  }
  return out;
}

function expertIndexFromLog(
  t: Record<string, unknown>,
  phase: DebatePhase,
): number {
  if (t.expertId !== undefined && t.expertId !== null) {
    const eid = Number(t.expertId);
    if (eid === -1) return -1;
    if (eid >= 1 && eid <= 3) return eid - 1;
    if (eid >= 0 && eid <= 2) return eid;
  }
  if (t.expertIndex !== undefined && t.expertIndex !== null) {
    const idx = Number(t.expertIndex);
    if (idx === -1) return -1;
    if (idx >= 0 && idx <= 2) return idx;
  }
  if (phase === "conclusion" || phase === "final_summary") return -1;
  return 0;
}

function parseMoodChip(t: Record<string, unknown>): string | undefined {
  const raw = t.mood_chip ?? t.moodChip;
  if (typeof raw !== "string") return undefined;
  const s = raw.trim();
  return s.length > 0 ? s : undefined;
}

function parseDebateLogs(raw: unknown): DebateTurn[] | null {
  if (!Array.isArray(raw)) return null;
  const turns: DebateTurn[] = [];
  let i = 0;
  for (const item of raw) {
    const t = item as Record<string, unknown>;
    const phase = normalizePhase(t.phase);
    const expertIndex = expertIndexFromLog(t, phase);
    const rawHeadline = String(t.headline ?? `발언 ${i + 1}`);
    const headlineMax =
      expertIndex === -1 ? MC_SUMMARY_DISPLAY_MAX : OPINION_SUMMARY_DISPLAY_MAX;
    turns.push({
      expertIndex,
      phase,
      headline: clampOpinionSummaryForDisplay(rawHeadline, headlineMax),
      body: String(t.body ?? ""),
      moodChip: parseMoodChip(t),
      delayMs: typeof t.delayMs === "number" ? t.delayMs : 900,
    });
    i += 1;
  }
  return turns.length > 0 ? turns : null;
}

function parseLegacyTurns(raw: unknown): DebateTurn[] | null {
  if (!Array.isArray(raw)) return null;
  const turns: DebateTurn[] = [];
  let i = 0;
  for (const item of raw) {
    const t = item as Record<string, unknown>;
    const phase = normalizePhase(t.phase);
    const expertIndex = Number.isFinite(Number(t.expertIndex))
      ? Number(t.expertIndex)
      : 0;
    const rawHeadline = String(t.headline ?? `발언 ${i + 1}`);
    const headlineMax =
      expertIndex === -1 ? MC_SUMMARY_DISPLAY_MAX : OPINION_SUMMARY_DISPLAY_MAX;
    turns.push({
      expertIndex,
      phase,
      headline: clampOpinionSummaryForDisplay(rawHeadline, headlineMax),
      body: String(t.body ?? ""),
      moodChip: parseMoodChip(t),
      delayMs: typeof t.delayMs === "number" ? t.delayMs : 900,
    });
    i += 1;
  }
  return turns.length > 0 ? turns : null;
}

function parseExpertVenuePicks(raw: unknown): ExpertVenuePick[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: ExpertVenuePick[] = [];
  for (const x of raw) {
    const o = x as Record<string, unknown>;
    const placeUrlRaw = String(o.placeUrl ?? o.place_url ?? "").trim();
    out.push({
      expertId: Number(o.expertId ?? o.id ?? 0),
      venueName: String(o.venueName ?? ""),
      placeUrl: placeUrlRaw.length > 0 ? placeUrlRaw : undefined,
      menuPick: String(o.menuPick ?? ""),
      reason: String(o.reason ?? ""),
      locationAdvantage: String(o.locationAdvantage ?? ""),
    });
  }
  return out.length > 0 ? out : undefined;
}

function parseFollowUpQuestions(
  o: Record<string, unknown>,
  fallbackTopic: string,
  secondRound: boolean,
): string[] {
  const raw = o.follow_up_questions ?? o.followUpQuestions;
  if (!Array.isArray(raw)) {
    return defaultFollowUpQuestionsForTopic(fallbackTopic, secondRound);
  }
  const out = raw
    .slice(0, 3)
    .map((x) => String(x ?? "").trim())
    .filter((s) => s.length > 0);
  if (out.length === 0) {
    return defaultFollowUpQuestionsForTopic(fallbackTopic, secondRound);
  }
  return out;
}

function parseOptionalStringList(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = raw.map((x) => String(x ?? "").trim()).filter((s) => s.length > 0);
  return out.length > 0 ? out : undefined;
}

function parseFinalPick(raw: unknown): FinalVenuePick | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const venueName = String(o.venueName ?? "");
  if (!venueName.trim()) return undefined;
  const placeUrlRaw = String(o.placeUrl ?? o.place_url ?? "").trim();
  return {
    venueName,
    placeUrl: placeUrlRaw.length > 0 ? placeUrlRaw : undefined,
    menuPick: String(o.menuPick ?? ""),
    detailedReason: String(o.detailedReason ?? ""),
    locationNote: String(o.locationNote ?? ""),
  };
}

function parseConsensus(
  o: Record<string, unknown>,
  foodPlace: boolean,
): ConsensusResult | null {
  const consensus = o.consensus as Record<string, unknown> | undefined;
  if (!consensus) return null;
  const summary = String(consensus.summary ?? "");
  const actions = Array.isArray(consensus.actions)
    ? (consensus.actions as unknown[]).map((a) => String(a))
    : [];

  const expertVenuePicks =
    parseExpertVenuePicks(consensus.expert_venue_picks) ??
    parseExpertVenuePicks(consensus.expertVenuePicks);

  const finalPick =
    parseFinalPick(consensus.final_pick) ??
    parseFinalPick(consensus.finalPick);

  const closingLineRaw = String(
    consensus.closing_line ?? consensus.closingLine ?? "",
  ).trim();
  const wtlRaw = consensus.why_three_lines ?? consensus.whyThreeLines;
  const whyParsed = Array.isArray(wtlRaw)
    ? (wtlRaw as unknown[]).map((x) => String(x))
    : undefined;

  if (!summary.trim()) return null;

  const defaultGeneralActions = [
    "오늘 안에 한 줄로 결론만 적어두기",
    "막히면 친구한테 카톡 한 통내보기",
    "내일 아침에 다시 읽어보고 감으로도 체크하기",
  ];

  if (foodPlace) {
    if (!finalPick || !expertVenuePicks || expertVenuePicks.length < 3) {
      return null;
    }
    const closingLine =
      closingLineRaw ||
      `싸우다 보니 결론 났어요! ${finalPick.venueName} 가보는 거 어때요?`;
    const whyThreeLines =
      whyParsed && whyParsed.length >= 3
        ? whyParsed.slice(0, 3)
        : [
            `${finalPick.venueName}에서 ${finalPick.menuPick} 먹는 게 제일 무난해요.`,
            finalPick.detailedReason.slice(0, 140).trim() + (finalPick.detailedReason.length > 140 ? "…" : ""),
            finalPick.locationNote.slice(0, 120).trim() + (finalPick.locationNote.length > 120 ? "…" : ""),
          ];
    return {
      summary,
      actions:
        actions.length > 0
          ? actions
          : ["방문 전 영업·예약·주차를 지도 앱에서 재확인"],
      closingLine,
      whyThreeLines,
      options: parseOptionalStringList(consensus.options),
      keyFactors:
        parseOptionalStringList(consensus.key_factors) ??
        parseOptionalStringList(consensus.keyFactors),
      risks: parseOptionalStringList(consensus.risks),
      expertVenuePicks,
      finalPick,
    };
  }

  const actionsResolved =
    actions.length > 0 ? actions : defaultGeneralActions;

  const whyThreeLines =
    whyParsed && whyParsed.length >= 3
      ? whyParsed.slice(0, 3)
      : whyParsed && whyParsed.length > 0
        ? [...whyParsed, ...actionsResolved].slice(0, 3)
        : actionsResolved.slice(0, 3);

  return {
    summary,
    actions: actionsResolved,
    closingLine: closingLineRaw || undefined,
    whyThreeLines,
    options: parseOptionalStringList(consensus.options),
    keyFactors:
      parseOptionalStringList(consensus.key_factors) ??
      parseOptionalStringList(consensus.keyFactors),
    risks: parseOptionalStringList(consensus.risks),
    expertVenuePicks,
    finalPick,
  };
}

/** LLM summary.experts[] / debate[] (결론 중심 스키마) */
type SummaryExpertLine = { name: string; oneLine: string };
type DebateRow = { expert: string; opinion: string; rebuttal: string };

function ensureThreeStrings(arr: string[], pad: string): string[] {
  const out = [...arr];
  while (out.length < 3) out.push(pad);
  return out.slice(0, 3);
}

function parseTrimmedStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x ?? "").trim()).filter((s) => s.length > 0);
}

function parseSummaryExpertLines(raw: unknown): SummaryExpertLine[] {
  if (!Array.isArray(raw)) return [];
  const out: SummaryExpertLine[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const name = String(o.name ?? "").trim();
    const oneLineRaw = String(o.one_line ?? o.oneLine ?? "").trim();
    const oneLine = oneLineRaw
      ? clampOpinionSummaryForDisplay(
          oneLineRaw,
          OPINION_SUMMARY_DISPLAY_MAX,
        )
      : "";
    if (name && oneLine) out.push({ name, oneLine });
  }
  return out;
}

function nameMatchesExpert(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const na = a.replace(/\s/g, "");
  const nb = b.replace(/\s/g, "");
  return na.includes(nb) || nb.includes(na);
}

function orderDebateRows(rows: DebateRow[], experts: ExpertProfile[]): DebateRow[] {
  if (rows.length !== 3 || experts.length !== 3) return rows;
  const used = new Set<number>();
  const ordered: DebateRow[] = [];
  for (const ex of experts) {
    const idx = rows.findIndex(
      (r, i) => !used.has(i) && nameMatchesExpert(r.expert, ex.name),
    );
    if (idx >= 0) {
      used.add(idx);
      ordered.push(rows[idx]!);
    }
  }
  if (ordered.length === 3) return ordered;
  return rows;
}

function clipDescForMoodChip(desc: string, maxLen: number): string | undefined {
  const d = desc.replace(/\s+/g, " ").trim();
  if (d.length < 3) return undefined;
  if (d.length <= maxLen) return d;
  return `${d.slice(0, maxLen - 1)}…`;
}

function buildMcBodyFromDecision(
  finalAnswer: string,
  keyFactors: string[],
  options: string[],
  risks: string[],
  actionGuide: string[],
): string {
  return [
    finalAnswer,
    "",
    "선택지:",
    ...options.map((o, i) => `${i + 1}. ${o}`),
    "",
    "핵심 요인:",
    ...keyFactors.map((k, i) => `${i + 1}. ${k}`),
    "",
    "리스크:",
    ...risks.map((r, i) => `${i + 1}. ${r}`),
    "",
    "바로 할 일:",
    ...actionGuide.map((a, i) => `${i + 1}. ${a}`),
  ].join("\n");
}

function mergeExpertClaimLines(
  experts: ExpertProfile[],
  lines: SummaryExpertLine[],
): ExpertProfile[] {
  if (lines.length === 0) return experts;
  return experts.map((e) => {
    const hit = lines.find((l) => nameMatchesExpert(l.name, e.name));
    return hit ? { ...e, claimOneLine: hit.oneLine } : e;
  });
}

function consensusNarrativeFromSummaryExperts(
  lines: SummaryExpertLine[],
  keyPoints: string[],
): string {
  if (lines.length === 3) {
    return lines.map((l) => `${l.name}: ${l.oneLine}`).join("\n\n");
  }
  return keyPoints.join("\n\n");
}

/**
 * 루트 `summary`가 객체이고 `final_answer` + `debate` 3건이 있으면
 * 기존 DebatePayload로 변환 (맛집/카카오 모드는 사용 안 함).
 */
function tryParseDecisionCentricPayload(
  o: Record<string, unknown>,
  fallbackTopic: string,
  secondRound: boolean,
): DebatePayload | null {
  const rootSummary = o.summary;
  if (!rootSummary || typeof rootSummary !== "object") return null;
  const s = rootSummary as Record<string, unknown>;

  const finalAnswer = String(s.final_answer ?? s.finalAnswer ?? "").trim();
  if (!finalAnswer) return null;

  const keyFactorsRaw = parseTrimmedStringArray(
    s.key_factors ?? s.keyFactors ?? s.key_points ?? s.keyPoints,
  );
  const optionsRaw = parseTrimmedStringArray(s.options);
  const risksRaw = parseTrimmedStringArray(s.risks);
  const actionRaw = parseTrimmedStringArray(s.action_guide ?? s.actionGuide);
  const keyFactors = ensureThreeStrings(
    keyFactorsRaw,
    "판단에 참고할 조건을 한 가지 더 확인할 것",
  );
  const options = ensureThreeStrings(
    optionsRaw,
    "상황에 맞는 선택지를 스스로 한 가지 더 적어볼 것",
  );
  const risks = ensureThreeStrings(
    risksRaw,
    "실행 전 변수를 한 가지 더 점검할 것",
  );
  const actionGuide = ensureThreeStrings(
    actionRaw,
    "결론을 메모·캘린더에 한 줄로 적어두기",
  );

  const debateRaw = o.debate;
  if (!Array.isArray(debateRaw) || debateRaw.length !== 3) return null;

  const rows: DebateRow[] = [];
  for (const x of debateRaw) {
    if (!x || typeof x !== "object") return null;
    const b = x as Record<string, unknown>;
    const expert = String(b.expert ?? "").trim();
    const opinion = String(b.opinion ?? "").trim();
    const rebuttal = String(b.rebuttal ?? "").trim();
    if (!expert || !opinion) return null;
    rows.push({
      expert,
      opinion,
      rebuttal: rebuttal.length > 0 ? rebuttal : "—",
    });
  }

  const summaryExpertLines = parseSummaryExpertLines(s.experts);

  let experts =
    parseExpertsFromAssigned(o.assigned_experts) ??
    parseExpertsLegacy(o.experts);

  if (!experts && summaryExpertLines.length === 3) {
    experts = summaryExpertLines.map((l, i) => ({
      id: i + 1,
      name: l.name,
      description: l.oneLine,
      claimOneLine: l.oneLine,
      iconName: "HelpCircle",
      color: normalizeExpertColor("sky", i),
    }));
  }

  if (!experts || experts.length !== 3) return null;

  experts = mergeExpertClaimLines(experts, summaryExpertLines);

  const orderedRows = orderDebateRows(rows, experts);

  const phases: DebatePhase[] = ["opening", "rebuttal", "synthesis"];
  const turns: DebateTurn[] = [];

  for (let i = 0; i < 3; i += 1) {
    const row = orderedRows[i]!;
    const ex = experts[i]!;
    const fromSummaryList = summaryExpertLines.find((l) =>
      nameMatchesExpert(l.name, ex.name),
    )?.oneLine?.trim();
    const headlineRaw = (
      ex.claimOneLine?.trim() ||
      fromSummaryList ||
      ""
    ).trim();
    const headline = headlineRaw
      ? clampOpinionSummaryForDisplay(
          headlineRaw,
          OPINION_SUMMARY_DISPLAY_MAX,
        )
      : "";
    turns.push({
      expertIndex: i,
      phase: phases[i]!,
      headline,
      body: `${row.opinion}\n\n${row.rebuttal}`,
      moodChip: clipDescForMoodChip(ex.description, 22),
      delayMs: 0,
    });
  }

  turns.push({
    expertIndex: -1,
    phase: "final_summary",
    headline: clampOpinionSummaryForDisplay(
      finalAnswer,
      MC_SUMMARY_DISPLAY_MAX,
    ),
    body: buildMcBodyFromDecision(
      finalAnswer,
      keyFactors,
      options,
      risks,
      actionGuide,
    ),
    moodChip: "MC · 결론",
    delayMs: 0,
  });

  const consensus: ConsensusResult = {
    summary: consensusNarrativeFromSummaryExperts(
      summaryExpertLines,
      keyFactors,
    ),
    actions: actionGuide,
    closingLine: finalAnswer,
    whyThreeLines: keyFactors,
    options,
    keyFactors,
    risks,
  };

  return {
    topic: String(o.topic ?? fallbackTopic),
    experts,
    turns,
    consensus,
    followUpQuestions: parseFollowUpQuestions(o, fallbackTopic, secondRound),
  };
}

function localDebateFallback(
  fallbackTopic: string,
  foodPlace: boolean,
  kakao?: KakaoPlaceCandidate[],
): DebatePayload {
  return buildLocalDebate(
    fallbackTopic,
    foodPlace && (kakao?.length ?? 0) > 0 ? { kakaoPlaces: kakao } : undefined,
  );
}

export function parseDebatePayloadJson(
  raw: string,
  fallbackTopic: string,
  foodPlace = false,
  secondRound = false,
  fallbackKakaoPlaces?: KakaoPlaceCandidate[],
): DebatePayload {
  const fb = () =>
    localDebateFallback(fallbackTopic, foodPlace, fallbackKakaoPlaces);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return fb();
  }
  if (!parsed || typeof parsed !== "object") {
    return fb();
  }
  const o = parsed as Record<string, unknown>;

  if (!foodPlace) {
    const decisionPayload = tryParseDecisionCentricPayload(
      o,
      fallbackTopic,
      secondRound,
    );
    if (decisionPayload) {
      const normalizedTurns = normalizeDebateTurns(decisionPayload.turns);
      if (normalizedTurns.length >= 4) {
        return sanitizeDebatePayload({
          ...decisionPayload,
          turns: normalizedTurns,
          consensus: enrichConsensusResult(decisionPayload.consensus),
        });
      }
    }
  }

  const assigned = parseExpertsFromAssigned(o.assigned_experts);
  const legacyExperts = assigned ?? parseExpertsLegacy(o.experts);
  const logs = parseDebateLogs(o.debate_logs);
  const legacyTurns = logs ?? parseLegacyTurns(o.turns);
  const consensus = parseConsensus(o, foodPlace);

  if (!legacyExperts || !legacyTurns || !consensus) {
    return fb();
  }

  const normalizedTurns = normalizeDebateTurns(legacyTurns);
  if (normalizedTurns.length < 4) {
    return fb();
  }

  const followUpQuestions = parseFollowUpQuestions(
    o,
    fallbackTopic,
    secondRound,
  );

  return sanitizeDebatePayload({
    topic: String(o.topic ?? fallbackTopic),
    experts: legacyExperts,
    turns: normalizedTurns,
    consensus: enrichConsensusResult(consensus),
    followUpQuestions,
  });
}

function buildSecondRoundUserPrefix(
  originalTopic: string,
  followUpChoice: string,
  priorSummary: string,
): string {
  const sum = priorSummary.trim().slice(0, 1500);
  const travel2 =
    isTravelBudgetTopic(originalTopic) &&
    `여행·예산 모드: assigned_experts 1=가성비·항목별(원·만원), 2=경험·지금 쓰기(설법·불교·스님 말투 금지), 3=뉴스·커뮤·물가 체감·검증 루틴(가짜 %·가짜 기사 제목 금지).\n`;

  return `[2차 토론 모드 — 반드시 반영]
처음 질문: ${originalTopic}
사용자가 방금 버튼으로 고른 추가 정보: 「${followUpChoice}」
이전 토론 요약(참고·그대로 복붙하지 말고 반영해 주장을 수정할 것): ${sum || "(요약 없음)"}
${travel2 || ""}
지시: 새 조건 때문에 이전 결론이 바뀌면 과감히 수정한다. opening은 짧게 리액션해도 되되 곧바로 질문에 대한 입장으로 들어간다.
전문가 대사에 사용자 문장 통째 인용 금지. 추가 조건은 짧게 재표현만(예: 5명 이상 단체 기준).
가짜 통계·논문 말투 금지. 철학·감성 위로 금지.
맛집(카카오 검색 모드)이면 검색 결과 목록 식당만. 목록에 없는 상호 금지. expertId 3번은 카카오맵 후기·리뷰 축 유지. debate_logs는 주장·반박·절충이 분명해야 하며 결과 필드 나열만 하지 말 것.
맛집 모드 2차: debate_logs 첫 칸(opening) body는 **반드시** 사용자가 고른 추가 정보를 논점으로 삼고, 주소·카테고리만 읽는 소개 금지. 그 조건에 맞을 때 왜 검색 목록의 자기 편 가게가 유리한지(좌석·웨이팅·메뉴 분산·동선 등) **추론·트레이드오프**로 말할 것. 확인이 필요하면 "카카오맵 후기에서 ○○ 키워드를 보라"고 쓸 것(가짜 별점·가짜 후기 인용 금지).
최종은 실행 가능한 한 줄 결론·투표(주제에 맞는 동사)로 끝낸다.
follow_up_questions 3개 새로 제시.
일반·전자·음주·여행·예산 모드는 루트 summary·debate 스키마로 다시 출력하고, final_answer·options·key_factors·risks·action_guide·experts·debate 3건을 반드시 갱신한다. 맛집 모드는 기존처럼 debate_logs·consensus를 쓴다.

`;
}

const BANNED_JARGON = `절대 금지: 가짜 통계·가짜 설문(n=40, 표본, 샘플 수, %p, 분위수), TCO·ROI·KPI·효용 곡선·기대값·베이지안·메타분석·교차검증 등 논문·보고서·교과서 말투. "~에 따르면 연구에서" 같은 허구 근거.

허용되는 말: 요즘 시장·중고나라·당근에서 도는 체감, 애플 정책·제품 스펙으로 알려진 사실(C타입은 아이폰 15부터), 배터리 교체 대략 비용대 같은 상식. 숫자는 거칠게 "십만 원 넘게 깨진다" 수준만, 정밀한 가짜 % 금지.`;

/** 패널 one_line·debate headline·맛집 debate_logs headline — UI와 동일 상한 */
const ONE_LINE_SUMMARY_UI_RULE = `[핵심 한 줄 — 앱 카드용]
그 화자의 **결론·입장만**(근거 나열·세부 통계 문장·본문·opinion 첫 문장 복붙 금지). **한 구**(쉼표로 두 절 붙이기·두 문장 금지). 공백 포함 **최대 40자**, 목표 28~36자.
MC·summary.final_answer 한 줄은 **최대 52자**, 같은 원칙(결론만·복붙 금지).`;

const DECISION_PRODUCT_RULES = `
[서비스 정체성]
AI 전문가 토론 기반 의사결정 도구. 반드시 "결론 중심 + 실행 가능한 답변".
사고 순서: (1) 가능/불가·추천 방향을 먼저 확정 (2) 이유는 숫자·조건 중심 (3) 전문가별 한 줄 (4) 당장 할 행동.

[금지 문장·태도]
"상황에 따라 다릅니다" "사람마다 다릅니다" 근거 없는 "경험이 중요합니다" 질문과 무관한 설명·불필요한 감성·철학·추상 조언.
애매한 답 금지 — 항상 "그래서 어떻게 해야 하는지"를 말할 것.
선택·비교 질문이면 추천 방향을 명확히. 예산·비용이 핵심이면 원·만원·개월 등 숫자를 넣을 것.
`;

const PRAGMATIC_EXPERT_FRAMEWORK = `
${DECISION_PRODUCT_RULES}

[1) 전문가 3인 — 현실적 역할]
질문을 분석해 assigned_experts 3명을 만든다. 가성비 소비자·리스크 분석가·경험 중시 사용자처럼 **현실적인 역할**이어야 하고, 질문과 **직접 관련**된 사람만 쓴다.
서로 관점이 겹치면 안 된다(비용 / 경험 / 리스크 / 효율 등 축을 다르게).
description·bio에 각자의 관점 축을 한눈에 드러낼 것.

[2) 직접 답변]
debate 각 칸의 opinion·rebuttal은 사용자 질문에 직접 답한다. 일반론만 늘어놓지 말 것.

[3) 예산·비용형 질문]
질문에 예산·가격·얼마·돈·가성비·할부 등 비용이 핵심이면, 최소 한 곳(비용 축·본문)에 원·만원·개월·퍼센트 등 구체 숫자를 넣는다. 사용자가 금액을 안 적었으면 "○○만 원 전제로 치면"처럼 가정을 한 문장으로 밝힌 뒤 그 전제 위에서 숫자 시나리오를 쓴다. ${BANNED_JARGON}

[4) 토론 구조]
debate 3명 순서는 expertId 1·2·3과 동일한 사람이어야 한다. 각자 opinion(2~3줄) + rebuttal(1~2줄, 다른 쪽 논점에 대한 반박).
${ONE_LINE_SUMMARY_UI_RULE}
summary.experts[].one_line은 위 규칙대로 그 전문가 입장만.

[5) 금지]
인생론·철학·감성 위로("마음이 중요해" "인생은 길다" 등) 금지. 실행 판단과 조건에 집중한다.

[6) 말투]
구어체·간결하게. 비속어·과한 감정 과장은 피한다.

[7) summary 블록 — 좋은 답변 스타일(반드시)]
루트 "summary"가 사용자가 가장 먼저 볼 카드다. **항상 결론을 먼저** 쓴다. 감성·추상 표현 금지. 사용자가 바로 고를 수 있게 쓴다.
- final_answer: 한 줄로 **명확한 결론**(애매·회피·본문 복붙 금지). 공백 포함 최대 52자.
- options: 정확히 3개, **서로 다른 선택지** 이름(예: 지금 구매 / 다음 모델 대기 / 중고).
- key_factors: 정확히 3개, 숫자·조건 넣을 수 있으면 포함한 **판단 근거**.
- experts: 정확히 3명, name + one_line(위 핵심 한 줄 규칙·최대 40자).
- risks: 정확히 3개, **구체적 리스크**(뭉뚱그린 말 금지).
- action_guide: 정확히 3개, **오늘 바로 실행** 가능한 행동.
debate는 상세용이며 summary와 모순 없이 맞출 것.

[8) 투표형 마무리]
가능하면 final_answer 또는 debate 맥락에 패널 투표 뉘앙스 한 줄을 녹인다(예: 정리: 2대1로 ○○). 주제에 맞는 동사(사기/마시기/가기 등).
`;

const SYSTEM_GENERAL = `당신은 한국어 "AI 전문가 토론 기반 의사결정 도구"의 작가다. 결론을 먼저·명확히 내고, 실행 가능한 답을 준다.

${PRAGMATIC_EXPERT_FRAMEWORK}

${LUCIDE_ICON_PROMPT_BLOCK}

color: sky, emerald, amber, rose, violet, orange, cyan, lime, fuchsia, slate, zinc, red, teal 중 하나.

JSON 루트에는 반드시 summary(객체)와 debate(배열 3개)를 넣는다. debate_logs·루트 consensus 키는 쓰지 않는다. 별표 ** 금지.

루트 follow_up_questions: 정확히 3개 — 아직 안 밝힌 변수를 짧은 한 줄로.

반드시 JSON만.`;

const SYSTEM_DRINK = `당신은 한국어로 음주 여부(와인·술·한 잔)를 세 관점에서 판단하게 돕는 토론 작가다.

${BANNED_JARGON}
${PRAGMATIC_EXPERT_FRAMEWORK}

[관점 고정 — 이름만 바꿔도 됨]
1번: **리스크·일정·건강** — 운전·회의·약·수면·숙취를 숫자·시간으로 짚어 직접 답할 것.
2번: **비용·대체** — 술값·무알콜 대체·내일 비용(시간 손실 등)을 가능하면 숫자로.
3번: **절충·실행 규칙** — 한 잔 기준(시간·잔 수·안주·물)을 구체적으로.

final_summary 투표는 마신다/안 마신다/조건부 한 잔 등으로. "산다/안 산다" 쇼핑 멘트 금지.
철학·감성 위로 금지.

${LUCIDE_ICON_PROMPT_BLOCK}

출력 JSON 구조·summary·debate·follow_up_questions 규칙은 SYSTEM_GENERAL과 동일(debate_logs·루트 consensus 없음). 별표 ** 금지.

반드시 JSON만.`;

const SYSTEM_ELECTRONICS = `당신은 한국어로 기기 구매·중고 여부를 세 관점에서 판단하게 돕는 토론 작가다.

${BANNED_JARGON}
${PRAGMATIC_EXPERT_FRAMEWORK}

[관점 고정 — 이름만 바꿔도 됨]
1번: **경험·성능·생산성** — 질문에 직접 답. 새 기기·스펙이 주는 체감.
2번: **비용·현금흐름** — 가격·할부·이자·통신 결합·잔존가치. 예산형 질문이면 반드시 원·만원·개월 단위 숫자 포함.
3번: **리스크·중고·거래** — 배터리·수리비·직거래 체크리스트. 대략 비용대는 상식 범위로(가짜 통계 금지).

[시장 상식 예시]
아이폰 15부터 C타입. 배터리 상태 나쁘면 교체+공임으로 십만 원대 넘을 수 있음 등 — 논문체·허구 설문 없이.

${LUCIDE_ICON_PROMPT_BLOCK}

출력 JSON 구조는 SYSTEM_GENERAL과 동일(summary+debate, debate_logs·루트 consensus 없음). 투표 결론 포함. 별표 ** 금지.

반드시 JSON만.`;

const SYSTEM_TRAVEL = `당신은 한국어로 여행(국내·해외)·숙박 일정에서 **예산·경비가 충분한지** 같은 질문을 세 관점에서 판단하게 돕는 토론 작가다.

${BANNED_JARGON}
${PRAGMATIC_EXPERT_FRAMEWORK}

[관점 고정 — 이름만 바꿔도 됨, 순서 엄수]
1번: **가성비·항목별 절약** — 왕복 교통·숙소·식비·현지 이동(버스 vs 렌터카+유류)·비상금으로 쪼개기. 사용자가 금액을 적었으면 그 전제로 **원·만원** 시나리오. 숙소만 보고 식비를 빼먹는 실수를 짚을 것.
2번: **경험·지금 쓰기** — 핵심 체험(한 끼·한 밤·한 코스)에 돈·시간을 쓰는 쪽 주장. **불교·스님·설법·격언·인생은 길다** 류 말투·철학 멘트 금지. 친구 말투로 구체 조건만.
3번: **뉴스·커뮤니티·물가 리터러시** — 기사·커뮤에 도는 **체감**을 언급하되 가짜 기사 제목·가짜 통계·가짜 % 금지. "출발 며칠 전 검색으로 교차 확인" 같은 실행 루틴. 성수기·지역은 상식 범위만.

[이 모드 예외]
PRAGMATIC의 "인생론·철학 금지"는 2번에게 **설교형 철학**만 해당한다. 2번은 여전히 실행 판단(무엇에 얼마 쓸지)으로 말한다.

${LUCIDE_ICON_PROMPT_BLOCK}

출력 JSON 구조는 SYSTEM_GENERAL과 동일(summary+debate, debate_logs·루트 consensus 없음). 투표 결론 포함(가기/조건부 가기/코스 줄이기 등). 별표 ** 금지.

반드시 JSON만.`;

const PRAGMATIC_FOOD_FRAMEWORK = `
[전문가·답변 — 맛집 모드]
assigned_experts 3명은 질문에 맞게 정하되, 축은 반드시 아래처럼 **겹치지 않게** 쓴다.
- expertId 1: 지역·동선·입지 또는 1인당 비용·웨이팅·가성비 중 질문에 맞는 쪽(둘 중 하나 축으로 고정).
- expertId 2: 1번과 다른 축(비용이면 동선·분위기, 동선이면 비용·대기 등).
- expertId 3: **카카오맵 장소 페이지 후기** 기준 — 별점·리뷰 키워드·최신 방문 후기·사진 탭을 본다는 설정으로 판단한다. 이름·description·bio에 이 역할이 드러나게(예: 후기 스크리너, 맵 리뷰 크리틱).
가짜 통계 금지: 이 프롬프트에 실시간 별점·특정 리뷰 문장이 없으므로 **구체 점수나 인용문을 지어내지 말고**, "카카오맵 place_url 들어가서 별점·키워드·부정 후기 비율을 직접 확인하라"는 식과 **어떤 지표를 보면 자기 편 가게가 유리한지** 논리로 말한다. ${BANNED_JARGON}
debate_logs 본문은 질문에 직접 답하되 **주장형 토론**이어야 한다. 정보 나열·FAQ·검색 결과 필드만 읽는 톤 금지.
opening은 4~8문장 수준 구어체로 **왜 내 편이 유리한지** 트레이드오프까지; rebuttal은 1번 논리의 약점을 **명시적으로** 공격; synthesis는 절충·실무 조건. 감성 위로·철학 금지.
각 debate_logs: headline=위 **핵심 한 줄** 규칙(결론·입장만·최대 40자·복붙 금지), mood_chip=그 화자 톤(상투 고정 문구 금지).
`;

const SYSTEM_FOOD = `당신은 한국어 맛집·장소 의사결정 토론 작가입니다.

${DECISION_PRODUCT_RULES}

[최우선 — 카카오 검색 결과만]
오직 제공된 검색 결과 식당만 언급. 목록에 없는 상호·가상 업장 금지.

${PRAGMATIC_FOOD_FRAMEWORK}

[3인 — 검색 결과 번호]
3곳 이상이면 expertId 1·2·3은 각각 목록 1·2·3번 가게를 편으로 들고, **서로 값이 충돌하도록** 반박한다. 3번은 반드시 **카카오맵 후기·리뷰 관점**에서 1·2번과 싸운다(별점·키워드·후기 패턴을 어떻게 보면 자기 편이 나은지). 2곳·1곳이면 역할 축은 유지하고 맡은 가게만 조정.

[주장 필수]
상호는 목록과 글자 하나까지 동일하게 쓰되, 대사는 **리스트 읽기가 아니라 토론**이다. 2·3번은 1번과 다른 기준으로 **깨지는 이유**를 말한다. 가끔 "검색에 뜬 ○○○"처럼 출처를 밝히면 되고, 매 문장 패턴을 반복하지 마.
opening **절대 금지**(한 글자라도 포함하면 안 됨): "말할게요"로 시작, "이번 검색 목록에서", "먼저 거론하는 건", "비교·검증의 출발점", "카카오에 찍힌 위치가".
대신 친구 말투로 **왜 내가 든 가게가 유리한지**부터 말한다. 맵에서 확인하라는 말은 끝에 한두 문장.

[대사 금지] 사용자 입력 통째 인용 금지.

${LUCIDE_ICON_PROMPT_BLOCK}

debate_logs 4개: opening / rebuttal / synthesis / final_summary (반박·절충·투표형 최종).

consensus: expert_venue_picks, final_pick(상호·place_url 목록과 일치), summary, actions, closing_line, why_three_lines

follow_up_questions 정확히 3개.

마크다운 별표 ** 금지.

반드시 JSON만.`;

function userPayloadSchemaGeneral(topic: string): string {
  return `아래는 사용자 맥락(대사에 통째 인용 금지).

주제: ${topic}

assigned_experts 3명: 질문 분석 후 서로 다른 관점(비용·경험·리스크 등)으로 정의.
summary는 모바일 카드용으로 짧게, debate는 상세(의견·반박). debate[0~2].expert 이름은 각각 1·2·3번 전문가와 동일하게.
${ONE_LINE_SUMMARY_UI_RULE}
summary.experts[].one_line·summary.final_answer는 위 글자 수·복붙 금지를 지킬 것.

JSON 한 개만 (키 이름 고정, debate_logs·루트 consensus 없음):

{
  "topic": string,
  "follow_up_questions": [ string, string, string ],
  "assigned_experts": [ { "id": 1, "name", "description", "iconName", "color", "bio"? }, ×3 ],
  "summary": {
    "final_answer": string,
    "options": [ string, string, string ],
    "key_factors": [ string, string, string ],
    "experts": [
      { "name": string, "one_line": string },
      { "name": string, "one_line": string },
      { "name": string, "one_line": string }
    ],
    "risks": [ string, string, string ],
    "action_guide": [ string, string, string ]
  },
  "debate": [
    { "expert": string, "opinion": string, "rebuttal": string },
    { "expert": string, "opinion": string, "rebuttal": string },
    { "expert": string, "opinion": string, "rebuttal": string }
  ]
}`;
}

function userPayloadSchemaElectronics(topic: string): string {
  return `아래는 사용자 맥락(본문 통째 인용 금지).

주제: ${topic}

assigned_experts: 1 경험·성능, 2 비용·현금흐름(예산 질문 시 원·만원·개월 숫자 필수), 3 리스크·중고·거래.
debate는 질문에 직접 답. 상식 비용대만, 가짜 통계 금지. final_answer에 투표·결론 한 줄 녹이기(최대 52자·복붙 금지).
${ONE_LINE_SUMMARY_UI_RULE}
summary.experts[].one_line은 위 규칙대로.
follow_up_questions 3개.

JSON 한 개만 (general과 동일 키, debate_logs·루트 consensus 없음):

{
  "topic": string,
  "follow_up_questions": [ string, string, string ],
  "assigned_experts": [ { "id": 1, "name", "description", "iconName", "color", "bio"? }, ×3 ],
  "summary": {
    "final_answer": string,
    "options": [ string, string, string ],
    "key_factors": [ string, string, string ],
    "experts": [
      { "name": string, "one_line": string },
      { "name": string, "one_line": string },
      { "name": string, "one_line": string }
    ],
    "risks": [ string, string, string ],
    "action_guide": [ string, string, string ]
  },
  "debate": [
    { "expert": string, "opinion": string, "rebuttal": string },
    { "expert": string, "opinion": string, "rebuttal": string },
    { "expert": string, "opinion": string, "rebuttal": string }
  ]
}`;
}

function userPayloadSchemaTravel(topic: string): string {
  return `아래는 사용자 맥락(본문 통째 인용 금지).

주제: ${topic}

assigned_experts: 1 가성비·항목별 예산(원·만원·1인당·1일당), 2 경험·지금 쓰기·핵심 체험 우선(설법·불교·스님 말투 금지), 3 뉴스·커뮤니티·물가 체감·검증 방법(가짜 통계·가짜 기사 제목 금지).
debate는 질문에 직접 답. final_answer에 투표·결론 한 줄 녹이기(최대 52자·복붙 금지).
${ONE_LINE_SUMMARY_UI_RULE}
summary.experts[].one_line은 위 규칙대로.
follow_up_questions 3개.

JSON 한 개만 (general과 동일 키, debate_logs·루트 consensus 없음):

{
  "topic": string,
  "follow_up_questions": [ string, string, string ],
  "assigned_experts": [ { "id": 1, "name", "description", "iconName", "color", "bio"? }, ×3 ],
  "summary": {
    "final_answer": string,
    "options": [ string, string, string ],
    "key_factors": [ string, string, string ],
    "experts": [
      { "name": string, "one_line": string },
      { "name": string, "one_line": string },
      { "name": string, "one_line": string }
    ],
    "risks": [ string, string, string ],
    "action_guide": [ string, string, string ]
  },
  "debate": [
    { "expert": string, "opinion": string, "rebuttal": string },
    { "expert": string, "opinion": string, "rebuttal": string },
    { "expert": string, "opinion": string, "rebuttal": string }
  ]
}`;
}

function userPayloadSchemaDrink(topic: string): string {
  return `아래는 사용자 맥락(본문 통째 인용 금지).

주제: ${topic}

assigned_experts: 리스크·일정 / 비용·대체(가능하면 숫자) / 절충·실행 규칙. 직접 답·철학·감성 위로 금지.
투표는 마시기/안 마시기/조건부. "산다" 금지. final_answer에 그 결론을 한 줄로(최대 52자·복붙 금지).
${ONE_LINE_SUMMARY_UI_RULE}
summary.experts[].one_line은 위 규칙대로.
follow_up_questions 3개.

JSON 한 개만 (general과 동일 키):

{
  "topic": string,
  "follow_up_questions": [ string, string, string ],
  "assigned_experts": [ { "id": 1, "name", "description", "iconName", "color", "bio"? }, ×3 ],
  "summary": {
    "final_answer": string,
    "options": [ string, string, string ],
    "key_factors": [ string, string, string ],
    "experts": [
      { "name": string, "one_line": string },
      { "name": string, "one_line": string },
      { "name": string, "one_line": string }
    ],
    "risks": [ string, string, string ],
    "action_guide": [ string, string, string ]
  },
  "debate": [
    { "expert": string, "opinion": string, "rebuttal": string },
    { "expert": string, "opinion": string, "rebuttal": string },
    { "expert": string, "opinion": string, "rebuttal": string }
  ]
}`;
}

function userPayloadSchemaFood(topic: string, kakaoBlock: string): string {
  const kakaoSection =
    kakaoBlock.trim().length > 0
      ? `\n\n${kakaoBlock.slice(0, 14000)}`
      : "\n\n(검색 결과 없음 — 이 상태에서는 JSON을 생성하지 말 것.)";

  const webBlock = "";

  return `아래 사용자 문장은 참고만 하고, 토론 본문에 통째 인용 금지.

주제: ${topic}
${kakaoSection}${webBlock}

검색 결과 식당만 사용. assigned_experts: 1·2번은 비용·동선·분위기 등 서로 다른 축, **3번은 카카오맵 후기·별점·리뷰 키워드를 본다는 역할**로 이름·description·bio를 쓸 것. 예산 중심이면 1인당·총액을 원·만원으로.
debate_logs body: opening·rebuttal·synthesis 각각 **주장·반박·절충**이 드러나야 함. 검색 항목의 주소·카테고리·전화만 줄줄 읽는 출력 금지.
opening body에 다음을 **쓰지 마세요**(시스템 설명·면책문): "말할게요", "이번 검색 목록에서", "먼저 거론", "비교·검증의 출발점", "카카오에 찍힌".
각자 질문에 직접 답, rebuttal에서 1번 논점을 공격, 철학·감성 위로 금지. final_summary는 투표+실행 가능한 결론.
${ONE_LINE_SUMMARY_UI_RULE}
debate_logs headline은 위 규칙(패널 40자). MC final_summary headline은 최대 52자.

JSON 한 개만:

{
  "topic": string,
  "follow_up_questions": [ string, string, string ],
  "assigned_experts": [ ×3 ],
  "debate_logs": [
    { "expertId": 1, "phase": "opening", "headline", "mood_chip", "body", "delayMs": 0 },
    { "expertId": 2, "phase": "rebuttal", "headline", "mood_chip", "body", "delayMs": 0 },
    { "expertId": 3, "phase": "synthesis", "headline", "mood_chip", "body", "delayMs": 0 },
    { "expertId": -1, "phase": "final_summary", "headline", "mood_chip", "body", "delayMs": 0 }
  ],
  "consensus": {
    "summary": string,
    "actions": string[],
    "closing_line": string,
    "why_three_lines": [ string, string, string ],
    "expert_venue_picks": [
      { "expertId": 1, "venueName": "목록 상호와 동일", "place_url": "https://place.map.kakao.com/... (목록과 동일)", "menuPick", "reason", "locationAdvantage" },
      { "expertId": 2, "venueName", "place_url", "menuPick", "reason", "locationAdvantage" },
      { "expertId": 3, "venueName", "place_url", "menuPick", "reason", "locationAdvantage" }
    ],
    "final_pick": { "venueName", "place_url": "https://place.map.kakao.com/...", "menuPick", "detailedReason", "locationNote" }
  }
}`;
}

export async function generateDebateWithOpenAI(
  topic: string,
  apiKey: string,
  options?: {
    searchContext?: string;
    foodPlace?: boolean;
    electronicsTopic?: boolean;
    drinkTopic?: boolean;
    travelBudgetTopic?: boolean;
    kakaoPlaces?: KakaoPlaceCandidate[];
    followUpChoice?: string;
    priorSummary?: string;
  },
): Promise<DebatePayload> {
  const foodPlace = Boolean(options?.foodPlace);
  const electronicsTopic = Boolean(options?.electronicsTopic);
  const drinkTopic = Boolean(options?.drinkTopic);
  const travelBudgetTopic = Boolean(options?.travelBudgetTopic);
  const kakaoBlock = foodPlace
    ? formatKakaoPlacesForPrompt(options?.kakaoPlaces ?? [])
    : "";
  const followTrim = options?.followUpChoice?.trim() ?? "";
  const secondRound = followTrim.length > 0;

  const system = foodPlace
    ? SYSTEM_FOOD
    : electronicsTopic
      ? SYSTEM_ELECTRONICS
      : drinkTopic
        ? SYSTEM_DRINK
        : travelBudgetTopic
          ? SYSTEM_TRAVEL
          : SYSTEM_GENERAL;
  const userBase = foodPlace
    ? userPayloadSchemaFood(topic, kakaoBlock)
    : electronicsTopic
      ? userPayloadSchemaElectronics(topic)
      : drinkTopic
        ? userPayloadSchemaDrink(topic)
        : travelBudgetTopic
          ? userPayloadSchemaTravel(topic)
          : userPayloadSchemaGeneral(topic);
  const user = secondRound
    ? `${buildSecondRoundUserPrefix(topic, followTrim, options?.priorSummary ?? "")}${userBase}`
    : userBase;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: secondRound
        ? foodPlace
          ? 0.78
          : 0.92
        : foodPlace
          ? 0.65
          : electronicsTopic
            ? 0.9
            : travelBudgetTopic
              ? 0.9
              : drinkTopic
                ? 0.88
                : 0.85,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.text()).trim().slice(0, 900);
    } catch {
      /* ignore */
    }
    throw new Error(
      `OpenAI HTTP ${res.status}${detail ? ` — ${detail}` : ""}`,
    );
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Empty OpenAI response");
  }
  const parsed = parseDebatePayloadJson(
    content,
    topic,
    foodPlace,
    secondRound,
    options?.kakaoPlaces,
  );
  const withPlaces = withKakaoPlaces(parsed, options?.kakaoPlaces ?? []);
  const k = options?.kakaoPlaces ?? [];
  if (foodPlace && k.length > 0) {
    const attached = attachKakaoUrlsToFoodConsensus(withPlaces, k);
    return stripMatjipMetaLectureOpening(attached, k);
  }
  return withPlaces;
}
