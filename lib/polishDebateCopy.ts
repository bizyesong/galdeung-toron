import type {
  ConsensusResult,
  DebatePayload,
  DebateTurn,
  KakaoPlaceCandidate,
} from "./debateTypes";

const POLISH_MODEL = "gpt-4o-mini";

type PolishBundle = {
  turnBodies: string[];
  closingLine: string;
  summary: string;
  whyThreeLines: string[];
  pickLines: { menuPick: string; reason: string; locationAdvantage: string }[];
  finalPick?: {
    menuPick: string;
    detailedReason: string;
    locationNote: string;
  };
};

/**
 * 로컬 폴백 문장 다듬기 — OpenAI를 **추가 1회** 호출함(할당량·비용).
 * 기본은 끔. 켜려면 `DEBATE_COPY_POLISH=1` (또는 true/on).
 */
export function isDebateCopyPolishLocalEnabled(): boolean {
  const v = process.env.DEBATE_COPY_POLISH?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

/** OpenAI가 이미 생성한 맛집 토론도 다듬으려면 `DEBATE_POLISH_AFTER_OPENAI=1` */
export function isDebateCopyPolishAfterOpenAiEnabled(): boolean {
  return process.env.DEBATE_POLISH_AFTER_OPENAI?.trim() === "1";
}

function collectPreserveStrings(
  payload: DebatePayload,
  places: KakaoPlaceCandidate[],
): string[] {
  const seen = new Set<string>();
  const add = (s: string) => {
    const t = s.trim();
    if (t.length >= 2) seen.add(t);
  };
  for (const p of places) add(p.placeName);
  const c = payload.consensus;
  for (const pick of c.expertVenuePicks ?? []) add(pick.venueName);
  if (c.finalPick?.venueName) add(c.finalPick.venueName);
  for (const e of payload.experts) add(e.name);
  return [...seen];
}

function originalsContaining(text: string, needles: string[]): string[] {
  return needles.filter((n) => text.includes(n));
}

function safePolish(
  original: string,
  polished: string,
  mustInclude: string[],
): string {
  if (!original.trim()) return original;
  const t = polished.trim();
  if (!t) return original;
  for (const m of mustInclude) {
    if (!t.includes(m)) return original;
  }
  return t;
}

function buildBundle(payload: DebatePayload): PolishBundle {
  const c = payload.consensus;
  const picks = c.expertVenuePicks ?? [];
  return {
    turnBodies: payload.turns.map((t) => t.body),
    closingLine: c.closingLine ?? "",
    summary: c.summary ?? "",
    whyThreeLines: c.whyThreeLines?.length ? [...c.whyThreeLines] : [],
    pickLines: picks.map((p) => ({
      menuPick: p.menuPick,
      reason: p.reason,
      locationAdvantage: p.locationAdvantage,
    })),
    finalPick: c.finalPick
      ? {
          menuPick: c.finalPick.menuPick,
          detailedReason: c.finalPick.detailedReason,
          locationNote: c.finalPick.locationNote,
        }
      : undefined,
  };
}

/**
 * 맛집(카카오) 토론 카피를 구어체로 매끈하게. 상호·패널 이름이 빠지면 해당 필드는 원문 유지.
 */
export async function polishFoodDebateCopy(
  payload: DebatePayload,
  apiKey: string,
  places: KakaoPlaceCandidate[],
): Promise<DebatePayload> {
  if (places.length === 0) return payload;

  const preserve = collectPreserveStrings(payload, places);
  const bundle = buildBundle(payload);

  const userPayload = {
    preserveExactly: preserve,
    input: bundle,
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: POLISH_MODEL,
      temperature: 0.42,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `당신은 한국어 토론 앱의 카피 에디터다.
사용자 메시지는 JSON이며 preserveExactly(반드시 그대로 남길 문자열)와 input(다듬을 텍스트 묶음)이 있다.
반드시 같은 키 구조의 JSON 한 개만 출력한다: { "output": { ...input과 동일한 키 } }.

규칙:
- preserveExactly의 각 문자열은 output 전체 어디에든 **글자 단위로 동일하게** 포함되어야 한다(삭제·맞춤법·띄어쓰기 변경 금지). 해당 문자열이 들어간 문장은 그 부분만 원문과 동일하게 유지한다.
- 식당 상호를 바꾸거나 새 업장을 만들지 않는다.
- 새 사실·가짜 후기·가짜 별점·통계를 추가하지 않는다.
- 어색한 접속(예: 무리하게 "말할게요"로 시작), 설명체 나열, 번역투를 줄이고 자연스러운 구어체로 말한다.
- 의미와 권장 행동(맵에서 확인 등)은 유지한다.`,
        },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.warn(
      "[debate] copy polish skipped (optional): HTTP",
      res.status,
      errText.slice(0, 220),
    );
    return payload;
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content?.trim()) {
    console.warn("[debate] copy polish skipped: empty model response");
    return payload;
  }

  let parsed: { output?: PolishBundle };
  try {
    parsed = JSON.parse(content) as { output?: PolishBundle };
  } catch {
    console.warn("[debate] copy polish skipped: JSON parse failed");
    return payload;
  }

  const o = parsed.output;
  if (!o?.turnBodies || o.turnBodies.length !== bundle.turnBodies.length) {
    return payload;
  }

  const mergedTurns: DebateTurn[] = payload.turns.map((turn, i) => {
    const origB = bundle.turnBodies[i] ?? "";
    const polB = o.turnBodies[i] ?? origB;
    const mustB = originalsContaining(origB, preserve);
    return { ...turn, body: safePolish(origB, polB, mustB) };
  });

  const c = payload.consensus;
  const newClosing = safePolish(
    bundle.closingLine,
    o.closingLine ?? bundle.closingLine,
    originalsContaining(bundle.closingLine, preserve),
  );
  const newSummary = safePolish(
    bundle.summary,
    o.summary ?? bundle.summary,
    originalsContaining(bundle.summary, preserve),
  );

  let whyThreeLines: string[] | undefined = c.whyThreeLines;
  if (
    bundle.whyThreeLines.length > 0 &&
    o.whyThreeLines &&
    o.whyThreeLines.length === bundle.whyThreeLines.length
  ) {
    whyThreeLines = bundle.whyThreeLines.map((line, i) =>
      safePolish(
        line,
        o.whyThreeLines![i] ?? line,
        originalsContaining(line, preserve),
      ),
    );
  }

  let expertVenuePicks = c.expertVenuePicks;
  const pickLen = c.expertVenuePicks?.length ?? 0;
  if (
    pickLen > 0 &&
    o.pickLines &&
    o.pickLines.length === pickLen &&
    c.expertVenuePicks
  ) {
    expertVenuePicks = c.expertVenuePicks.map((pick, i) => {
      const pl = o.pickLines![i]!;
      const orig = bundle.pickLines[i]!;
      return {
        ...pick,
        menuPick: safePolish(
          orig.menuPick,
          pl.menuPick,
          originalsContaining(orig.menuPick, preserve),
        ),
        reason: safePolish(
          orig.reason,
          pl.reason,
          originalsContaining(orig.reason, preserve),
        ),
        locationAdvantage: safePolish(
          orig.locationAdvantage,
          pl.locationAdvantage,
          originalsContaining(orig.locationAdvantage, preserve),
        ),
      };
    });
  }

  let finalPick = c.finalPick;
  if (c.finalPick && bundle.finalPick && o.finalPick) {
    const fp = bundle.finalPick;
    const ofp = o.finalPick;
    finalPick = {
      ...c.finalPick,
      menuPick: safePolish(
        fp.menuPick,
        ofp.menuPick,
        originalsContaining(fp.menuPick, preserve),
      ),
      detailedReason: safePolish(
        fp.detailedReason,
        ofp.detailedReason,
        originalsContaining(fp.detailedReason, preserve),
      ),
      locationNote: safePolish(
        fp.locationNote,
        ofp.locationNote,
        originalsContaining(fp.locationNote, preserve),
      ),
    };
  }

  const nextConsensus: ConsensusResult = {
    ...c,
    closingLine: newClosing,
    summary: newSummary,
    whyThreeLines,
    expertVenuePicks,
    finalPick,
  };

  return {
    ...payload,
    turns: mergedTurns,
    consensus: nextConsensus,
  };
}
