"use client";

import type { RefObject } from "react";
import { useState } from "react";
import { AnswerBookmarkButton } from "@/components/AnswerBookmarkButton";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MapPin,
  MessageCircle,
  PartyPopper,
  Scale,
  Zap,
  Swords,
  UsersRound,
} from "lucide-react";
import { ExpertLucideIcon } from "@/components/ExpertLucideIcon";
import { FormattedDebateBody } from "@/components/FormattedDebateBody";
import { LinkedPlacesText } from "@/components/LinkedPlacesText";
import type {
  ConsensusResult,
  DebatePayload,
  DebatePhase,
  DebateTurn,
  ExpertProfile,
  KakaoPlaceCandidate,
} from "@/lib/debateTypes";
import {
  clampOpinionSummaryForDisplay,
  MC_SUMMARY_DISPLAY_MAX,
  OPINION_SUMMARY_DISPLAY_MAX,
} from "@/lib/opinionSummaryDisplay";
import { pickSummaryEmoji } from "@/lib/summaryEmoji";
import { getExpertVisual } from "@/lib/expertTheme";

export type BookmarkContext = {
  roundEntryId: string;
  rootTopic: string;
  roundTitle: string;
};

const MODERATOR_STYLE = {
  card: "border-violet-500/35 bg-gradient-to-br from-violet-950/55 via-cyan-950/20 to-zinc-900/80",
  bubble: "border-cyan-500/25 bg-cyan-950/25 text-cyan-50",
  avatar: "bg-gradient-to-br from-cyan-500 to-violet-600 text-white ring-2 ring-cyan-400/35",
};

/** mood_chip 없을 때만: 단계 이름만(고정 멘트 대신) */
function phaseChipFallback(phase: DebatePhase): string {
  switch (phase) {
    case "opening":
    case "deep1":
      return "1차 · 주장";
    case "rebuttal":
    case "rebuttal2":
      return "2차 · 반박";
    case "synthesis":
    case "critique3":
    case "free":
      return "3차 · 절충";
    case "final_summary":
    case "conclusion":
      return "MC · 최종";
    default:
      return "발언";
  }
}

function phaseMeta(phase: DebatePhase): {
  Icon: typeof MessageCircle;
} {
  switch (phase) {
    case "opening":
    case "deep1":
      return { Icon: MessageCircle };
    case "rebuttal":
    case "rebuttal2":
      return { Icon: Swords };
    case "synthesis":
    case "critique3":
    case "free":
      return { Icon: Scale };
    case "final_summary":
    case "conclusion":
      return { Icon: PartyPopper };
    default:
      return { Icon: Zap };
  }
}

function chipForTurn(turn: DebateTurn): string {
  const m = turn.moodChip?.trim();
  if (m) return m;
  return phaseChipFallback(turn.phase);
}

function DebateRichText({
  text,
  places,
}: {
  text: string;
  places: KakaoPlaceCandidate[] | undefined;
}) {
  const list = places?.filter((p) => p.placeName.length > 0) ?? [];
  if (list.length > 0) {
    return <LinkedPlacesText text={text} places={list} />;
  }
  return <FormattedDebateBody text={text} />;
}

/** UI '핵심 요약': 본문 미리보기 금지. headline = 질문에 대한 이 화자의 결론 한 구 */
function isPlaceholderHeadline(raw: string): boolean {
  const h = raw.trim();
  if (!h) return true;
  return /^발언\s*\d+$/.test(h);
}

function expertOpinionSummaryLine(turn: DebateTurn): string | null {
  const h = turn.headline?.trim() ?? "";
  if (isPlaceholderHeadline(h)) return null;
  return h;
}

const COLLAPSE_BODY_OVER = 220;

function CollapsibleTurnSpeech({
  turn,
  places,
  bubbleClassName,
}: {
  turn: DebateTurn;
  places: KakaoPlaceCandidate[];
  bubbleClassName: string;
}) {
  const [open, setOpen] = useState(true);
  const body = turn.body ?? "";
  const compact = body.replace(/\s+/g, " ");
  const needToggle = compact.length > COLLAPSE_BODY_OVER;
  const rawOpinionLine = expertOpinionSummaryLine(turn);
  const summaryMax =
    turn.phase === "final_summary" || turn.phase === "conclusion"
      ? MC_SUMMARY_DISPLAY_MAX
      : OPINION_SUMMARY_DISPLAY_MAX;
  const displayOpinionLine =
    rawOpinionLine != null
      ? clampOpinionSummaryForDisplay(rawOpinionLine, summaryMax)
      : null;
  const hasOpinionSummary = displayOpinionLine != null;
  const summaryEmoji =
    displayOpinionLine != null
      ? pickSummaryEmoji(displayOpinionLine)
      : "💬";

  const opinionSummaryBlock =
    hasOpinionSummary && displayOpinionLine ? (
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          핵심 요약
        </p>
        <p className="flex items-start gap-2.5 text-sm font-semibold leading-snug text-zinc-100">
          <span
            className="shrink-0 text-[1.15rem] leading-none sm:text-xl"
            aria-hidden
          >
            {summaryEmoji}
          </span>
          <span className="min-w-0 pt-0.5">{displayOpinionLine}</span>
        </p>
      </div>
    ) : null;

  if (!needToggle) {
    if (hasOpinionSummary) {
      return (
        <div className="space-y-2">
          {opinionSummaryBlock}
          <div
            className={`rounded-2xl rounded-tl-md border px-4 py-3.5 text-sm leading-[1.8] ${bubbleClassName}`}
          >
            <DebateRichText text={body} places={places} />
          </div>
        </div>
      );
    }
    return (
      <div
        className={`rounded-2xl rounded-tl-md border px-4 py-3.5 text-sm leading-[1.8] ${bubbleClassName}`}
      >
        <DebateRichText text={body} places={places} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {hasOpinionSummary ? opinionSummaryBlock : null}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
          aria-expanded={false}
        >
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          자세히 보기
        </button>
      ) : (
        <>
          <div
            className={`rounded-2xl rounded-tl-md border px-4 py-3.5 text-sm leading-[1.8] ${bubbleClassName}`}
          >
            <DebateRichText text={body} places={places} />
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800"
            aria-expanded
          >
            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
            접기
          </button>
        </>
      )}
    </div>
  );
}

export function DebateRoundContent({
  title,
  payload,
  scrollRef,
  bookmarkContext,
  onBookmarksChanged,
}: {
  title: string;
  payload: DebatePayload;
  scrollRef?: RefObject<HTMLDivElement | null>;
  bookmarkContext?: BookmarkContext;
  onBookmarksChanged?: () => void;
}) {
  const turns: DebateTurn[] = payload.turns ?? [];
  const experts: ExpertProfile[] = payload.experts ?? [];
  const consensus: ConsensusResult | null = payload.consensus ?? null;
  const kakaoPlaces: KakaoPlaceCandidate[] = payload.kakaoPlaces ?? [];

  const consensusFactorLines =
    consensus && consensus.keyFactors && consensus.keyFactors.length > 0
      ? consensus.keyFactors
      : consensus?.whyThreeLines ?? [];

  const usesStructuredSummary =
    consensus != null &&
    ((consensus.options?.length ?? 0) > 0 ||
      (consensus.risks?.length ?? 0) > 0 ||
      (consensus.keyFactors?.length ?? 0) > 0);

  const actionsBlockTitle = usesStructuredSummary
    ? "바로 할 일"
    : "가기 전에 이것만";

  const styleForTurn = (turn: DebateTurn) => {
    if (
      turn.expertIndex < 0 ||
      turn.phase === "conclusion" ||
      turn.phase === "final_summary"
    ) {
      return MODERATOR_STYLE;
    }
    const ex = experts[turn.expertIndex];
    return getExpertVisual(ex?.color, turn.expertIndex);
  };

  const nameForTurn = (turn: DebateTurn) => {
    if (
      turn.expertIndex < 0 ||
      turn.phase === "conclusion" ||
      turn.phase === "final_summary"
    ) {
      return "정리 담당 MC";
    }
    return experts[turn.expertIndex]?.name ?? `전문가 ${turn.expertIndex + 1}`;
  };

  const iconNameForTurn = (turn: DebateTurn) => {
    if (
      turn.expertIndex < 0 ||
      turn.phase === "conclusion" ||
      turn.phase === "final_summary"
    ) {
      return "Mic2";
    }
    return experts[turn.expertIndex]?.iconName ?? "HelpCircle";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
        <span className="rounded-full border border-cyan-500/35 bg-gradient-to-r from-cyan-500/15 to-violet-600/15 px-3 py-1 text-xs font-semibold text-cyan-100">
          {title}
        </span>
      </div>

      {kakaoPlaces.length > 0 && (
        <section className="space-y-3 rounded-3xl border border-amber-500/20 bg-amber-950/10 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 shrink-0 text-amber-400" />
            <h2 className="text-base font-semibold text-zinc-100">
              오늘의 추천 후보
            </h2>
          </div>
          <p className="text-xs text-zinc-500">
            카카오맵 키워드 검색으로 가져온 실제 장소예요.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {kakaoPlaces.map((place) => (
              <article
                key={`${place.id}-${place.placeUrl}`}
                className="flex flex-col rounded-2xl border border-zinc-700/80 bg-zinc-900/60 p-4"
              >
                <h3 className="font-semibold text-white">{place.placeName}</h3>
                {place.categoryName ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    {place.categoryName}
                  </p>
                ) : null}
                {place.address ? (
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                    {place.address}
                  </p>
                ) : null}
                {place.phone ? (
                  <p className="mt-1 text-sm text-zinc-500">{place.phone}</p>
                ) : null}
                <a
                  href={place.placeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  카카오맵에서 보기
                </a>
              </article>
            ))}
          </div>
        </section>
      )}

      {experts.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-zinc-400">
            <UsersRound className="h-4 w-4 shrink-0 text-cyan-400/90" />
            <h2 className="text-xs font-semibold uppercase tracking-wider">
              오늘의 패널
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-800/90 bg-zinc-900/50 px-3 py-3 sm:gap-4 sm:px-4">
            {experts.map((ex, i) => {
              const vis = getExpertVisual(ex.color, i);
              return (
                <div
                  key={ex.id}
                  className="flex items-center gap-2 rounded-full border border-zinc-700/60 bg-zinc-950/60 py-1 pl-1 pr-3"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${vis.avatar}`}
                  >
                    <ExpertLucideIcon
                      name={ex.iconName}
                      className="h-4 w-4 text-zinc-900"
                      strokeWidth={2.25}
                    />
                  </span>
                  <div className="min-w-0 max-w-[11rem]">
                    <span className="block truncate text-sm font-medium text-zinc-100">
                      {ex.name}
                    </span>
                    {ex.claimOneLine ? (
                      <span className="mt-0.5 block truncate text-[10px] leading-tight text-zinc-500">
                        {ex.claimOneLine}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="flex flex-1 flex-col rounded-3xl border border-zinc-800/90 bg-zinc-900/30 shadow-[inset_0_1px_0_0_rgba(34,211,238,0.06)]">
        <div className="border-b border-zinc-800/80 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold text-zinc-100">단톡방 로그</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            ① 주장 → ② 반박 → ③ 중재 → ④ MC 정리
          </p>
        </div>
        <div
          ref={scrollRef}
          className="max-h-[min(70vh,720px)] space-y-5 overflow-y-auto p-4 sm:p-5"
        >
          {turns.map((turn, i) => {
            const st = styleForTurn(turn);
            const { Icon } = phaseMeta(turn.phase);
            const chip = chipForTurn(turn);
            const isMod =
              turn.expertIndex < 0 ||
              turn.phase === "conclusion" ||
              turn.phase === "final_summary";
            return (
              <article
                key={`${title}-${turn.phase}-${i}-${turn.headline}`}
                className={`animate-bubble-in rounded-3xl border-2 p-4 shadow-lg sm:p-5 ${st.card}`}
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-medium text-zinc-300">
                    <Icon className="h-3.5 w-3.5 text-cyan-300" />
                    {chip}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${st.avatar}`}
                      aria-hidden
                    >
                      <ExpertLucideIcon
                        name={iconNameForTurn(turn)}
                        className={
                          isMod
                            ? "h-6 w-6 text-zinc-100"
                            : "h-6 w-6 text-zinc-900"
                        }
                        strokeWidth={2.25}
                      />
                    </div>
                    <p className="min-w-0 flex-1 text-sm font-bold leading-snug text-white">
                      {nameForTurn(turn)}
                    </p>
                    {bookmarkContext ? (
                      <div className="flex h-12 shrink-0 items-center">
                        <AnswerBookmarkButton
                          kind="turn"
                          roundEntryId={bookmarkContext.roundEntryId}
                          rootTopic={bookmarkContext.rootTopic}
                          roundTitle={bookmarkContext.roundTitle}
                          turnIndex={i}
                          turn={turn}
                          speakerLabel={nameForTurn(turn)}
                          onChange={onBookmarksChanged}
                        />
                      </div>
                    ) : null}
                  </div>
                  <CollapsibleTurnSpeech
                    turn={turn}
                    places={kakaoPlaces}
                    bubbleClassName={st.bubble}
                  />
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {consensus && (
        <section className="rounded-3xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/35 to-zinc-900/60 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <PartyPopper
                className="h-5 w-5 shrink-0 text-amber-300"
                aria-hidden
              />
              <h2 className="text-base font-bold text-white">
                싸우다 보니 결론
              </h2>
            </div>
            {bookmarkContext ? (
              <div className="shrink-0">
                <AnswerBookmarkButton
                  kind="consensus"
                  roundEntryId={bookmarkContext.roundEntryId}
                  rootTopic={bookmarkContext.rootTopic}
                  roundTitle={bookmarkContext.roundTitle}
                  consensus={consensus}
                  onChange={onBookmarksChanged}
                />
              </div>
            ) : null}
          </div>

          {consensus.closingLine ? (
            <p className="text-lg font-semibold leading-snug text-zinc-50">
              <DebateRichText
                text={consensus.closingLine}
                places={kakaoPlaces}
              />
            </p>
          ) : null}

          {consensus.options && consensus.options.length > 0 ? (
            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="mb-2 text-xs font-semibold text-cyan-200/90">
                선택지
              </p>
              <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {consensus.options.map((opt) => (
                  <li
                    key={opt}
                    className="rounded-xl border border-cyan-500/35 bg-cyan-950/25 px-3 py-2 text-sm text-cyan-50"
                  >
                    <DebateRichText text={opt} places={kakaoPlaces} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {consensusFactorLines.length > 0 ? (
            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="mb-2 text-xs font-semibold text-indigo-200/85">
                핵심 요인
              </p>
              <ul className="space-y-2">
                {consensusFactorLines.map((line, idx) => (
                  <li
                    key={`${idx}-${line.slice(0, 24)}`}
                    className="flex gap-3 text-sm leading-relaxed text-zinc-200"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/30 text-xs font-bold text-indigo-100">
                      {idx + 1}
                    </span>
                    <span className="min-w-0 pt-0.5">
                      <DebateRichText text={line} places={kakaoPlaces} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {consensus.summary.trim().length > 0 ? (
            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="mb-2 text-xs font-semibold text-zinc-500">
                패널 한 줄
              </p>
              <p className="text-sm leading-relaxed text-zinc-400">
                <DebateRichText text={consensus.summary} places={kakaoPlaces} />
              </p>
            </div>
          ) : null}

          {consensus.risks && consensus.risks.length > 0 ? (
            <div className="mt-4 border-t border-amber-500/25 pt-4">
              <p className="mb-2 text-xs font-semibold text-amber-200/90">
                리스크
              </p>
              <ul className="space-y-2 text-sm leading-relaxed text-amber-100/90">
                {consensus.risks.map((r, idx) => (
                  <li key={`${idx}-${r.slice(0, 20)}`} className="flex gap-2">
                    <span className="font-bold text-amber-400/90">{idx + 1}.</span>
                    <span className="min-w-0">
                      <DebateRichText text={r} places={kakaoPlaces} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {consensus.expertVenuePicks &&
            consensus.expertVenuePicks.length > 0 && (
              <div className="mt-6">
                <p className="mb-3 text-xs font-semibold text-amber-200/90">
                  패널들이 각자 찍은 곳
                </p>
                <div className="space-y-3">
                  {consensus.expertVenuePicks.map((p) => {
                    const exName =
                      experts.find((e) => e.id === p.expertId)?.name ??
                      `전문가 ${p.expertId}`;
                    return (
                      <div
                        key={`${p.expertId}-${p.venueName}`}
                        className="rounded-2xl border border-zinc-700/80 bg-zinc-900/50 p-3 text-sm"
                      >
                        <p className="font-semibold text-white">
                          <span>{exName} → </span>
                          <DebateRichText
                            text={p.venueName}
                            places={kakaoPlaces}
                          />
                        </p>
                        <p className="mt-1 text-zinc-400">
                          메뉴:{" "}
                          <span className="font-semibold text-emerald-200/90">
                            <DebateRichText
                              text={p.menuPick}
                              places={kakaoPlaces}
                            />
                          </span>
                        </p>
                        <p className="mt-1 leading-relaxed text-zinc-300">
                          <DebateRichText text={p.reason} places={kakaoPlaces} />
                        </p>
                        <p className="mt-1 text-zinc-400">
                          <DebateRichText
                            text={p.locationAdvantage}
                            places={kakaoPlaces}
                          />
                        </p>
                        {p.placeUrl ? (
                          <a
                            href={
                              p.placeUrl.startsWith("http://")
                                ? `https://${p.placeUrl.slice(7)}`
                                : p.placeUrl
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
                          >
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                            카카오맵에서 열기
                          </a>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          {consensus.finalPick && (
            <div className="mt-5 rounded-2xl border border-emerald-500/40 bg-emerald-950/25 p-4">
              <p className="text-xs font-semibold text-emerald-300/90">
                우리가 한 곳으로 못 박으면
              </p>
              <p className="mt-2 text-lg font-bold text-white">
                <DebateRichText
                  text={consensus.finalPick.venueName}
                  places={kakaoPlaces}
                />
              </p>
              <p className="mt-2 text-sm text-emerald-100/90">
                메뉴:{" "}
                <span className="font-semibold text-emerald-200">
                  <DebateRichText
                    text={consensus.finalPick.menuPick}
                    places={kakaoPlaces}
                  />
                </span>
              </p>
              <p className="mt-3 text-sm leading-relaxed text-zinc-200">
                <DebateRichText
                  text={consensus.finalPick.detailedReason}
                  places={kakaoPlaces}
                />
              </p>
              <p className="mt-3 text-sm text-zinc-400">
                <DebateRichText
                  text={consensus.finalPick.locationNote}
                  places={kakaoPlaces}
                />
              </p>
              {consensus.finalPick.placeUrl ? (
                <a
                  href={
                    consensus.finalPick.placeUrl.startsWith("http://")
                      ? `https://${consensus.finalPick.placeUrl.slice(7)}`
                      : consensus.finalPick.placeUrl
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/45 bg-emerald-500/15 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/25 sm:w-auto sm:px-6"
                >
                  <MapPin className="h-4 w-4" aria-hidden />
                  카카오맵에서 이 식당 열기
                  <ExternalLink className="h-4 w-4 opacity-80" aria-hidden />
                </a>
              ) : null}
            </div>
          )}

          <div className="mt-6 border-t border-white/10 pt-4">
            <p className="mb-2 text-xs font-semibold text-indigo-200/80">
              {actionsBlockTitle}
            </p>
            <ul className="list-inside list-decimal space-y-2 text-sm text-zinc-300">
              {consensus.actions.map((item) => (
                <li key={item} className="leading-relaxed">
                  <DebateRichText text={item} places={kakaoPlaces} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}

function roundTitle(index: number, total: number): string {
  if (total === 1) return "1차 토론";
  const n = total - index;
  return index === 0 ? `${n}차 토론 · 최신` : `${n}차 토론 기록`;
}

export { roundTitle };
