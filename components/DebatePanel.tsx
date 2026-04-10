"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Bookmark, History, Loader2, MapPin, Zap } from "lucide-react";
import { BookmarkedAnswersModal } from "@/components/BookmarkedAnswersModal";
import { DebateHistoryModal } from "@/components/DebateHistoryModal";
import { DebateRoundContent, roundTitle } from "@/components/DebateRoundContent";
import type { DebatePayload } from "@/lib/debateTypes";
import { loadBookmarkedAnswers } from "@/lib/bookmarkedAnswers";
import {
  loadDebateHistory,
  persistSession,
  type DebateHistorySession,
} from "@/lib/debateHistory";
import { isMatjipKakaoTopic } from "@/lib/topicDetect";

type Flow = "idle" | "loading" | "done";

type RoundEntry = { id: string; payload: DebatePayload };

function newRoundId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function DebatePanel() {
  const [topic, setTopic] = useState("");
  const [rootTopic, setRootTopic] = useState("");
  const rootTopicRef = useRef("");
  const sessionIdRef = useRef<string | null>(null);
  const [flow, setFlow] = useState<Flow>("idle");
  const [error, setError] = useState<string | null>(null);
  const [rounds, setRounds] = useState<RoundEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [historySessions, setHistorySessions] = useState<DebateHistorySession[]>(
    [],
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const roundsRef = useRef<RoundEntry[]>([]);

  useEffect(() => {
    setHistorySessions(loadDebateHistory());
    setBookmarkCount(loadBookmarkedAnswers().length);
  }, []);

  const bumpBookmarkCount = useCallback(() => {
    setBookmarkCount(loadBookmarkedAnswers().length);
  }, []);

  useEffect(() => {
    roundsRef.current = rounds;
  }, [rounds]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || rounds.length === 0) return;
    el.scrollTo({ top: 0, behavior: "smooth" });
  }, [rounds]);

  const busy = flow === "loading";
  const canRun = topic.trim().length > 0 && !busy;
  const showFoodLoading = busy && isMatjipKakaoTopic(rootTopic || topic);
  const latestFollowUps =
    rounds[0]?.payload.followUpQuestions?.slice(0, 3) ?? [];
  const isReDebateLoading = busy && rounds.length > 0;

  const runDebate = async () => {
    const trimmed = topic.trim();
    if (!trimmed || flow === "loading") return;

    setError(null);
    setRounds([]);
    sessionIdRef.current = null;
    setFlow("loading");
    setRootTopic(trimmed);
    rootTopicRef.current = trimmed;

    try {
      const res = await fetch("/api/debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: trimmed }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `요청 실패 (${res.status})`);
      }
      const data = (await res.json()) as DebatePayload;
      const sid = newRoundId();
      sessionIdRef.current = sid;
      const entry: RoundEntry = { id: newRoundId(), payload: data };
      const nextRounds = [entry];
      setRounds(nextRounds);
      setHistorySessions(persistSession(sid, trimmed, nextRounds));
      setFlow("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "뭔가 꼬였어요. 다시 해볼까요?");
      setFlow("idle");
      setRootTopic("");
      rootTopicRef.current = "";
    }
  };

  const runFollowUp = async (label: string) => {
    if (busy || rounds.length === 0) return;
    const root = rootTopicRef.current.trim();
    if (!root) return;

    setError(null);
    setFlow("loading");

    const priorSummary = rounds[0]!.payload.consensus.summary ?? "";

    try {
      const res = await fetch("/api/debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: root,
          followUpChoice: label,
          priorSummary,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `요청 실패 (${res.status})`);
      }
      const data = (await res.json()) as DebatePayload;
      const newEntry: RoundEntry = { id: newRoundId(), payload: data };
      const next = [newEntry, ...roundsRef.current];
      setRounds(next);
      const sid = sessionIdRef.current;
      if (sid) {
        setHistorySessions(persistSession(sid, root, next));
      }
      setFlow("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "재토론에 실패했어요.");
      setFlow("done");
    }
  };

  const resetAll = useCallback(() => {
    setTopic("");
    setRounds([]);
    setError(null);
    setFlow("idle");
    setRootTopic("");
    rootTopicRef.current = "";
    sessionIdRef.current = null;
  }, []);

  const openHistory = useCallback(() => {
    setHistorySessions(loadDebateHistory());
    setHistoryOpen(true);
  }, []);

  const restoreFromHistory = useCallback((session: DebateHistorySession) => {
    sessionIdRef.current = session.id;
    setRootTopic(session.rootTopic);
    rootTopicRef.current = session.rootTopic;
    setTopic(session.rootTopic);
    setRounds(
      session.rounds.map((r) => ({ id: r.id, payload: r.payload })),
    );
    setError(null);
    setFlow("done");
    setHistoryOpen(false);
  }, []);

  const handleTopicKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    if (e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (topic.trim().length > 0 && !busy) {
      void runDebate();
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 pb-10 pt-6 sm:pb-12 sm:pt-8">
      <header className="space-y-4 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-gradient-to-r from-cyan-500/10 to-violet-600/10 px-3 py-1">
          <Zap className="h-3.5 w-3.5 text-cyan-400" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200/90">
            NANJANG
          </span>
        </div>
        <h1 className="bg-gradient-to-r from-cyan-200 via-white to-violet-200 bg-clip-text text-2xl font-bold leading-snug tracking-tight text-transparent sm:text-3xl sm:leading-tight">
          당신의 고민을 난장판에 맡겨보세요
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
          실시간 전문가 섭외부터 데이터 기반 끝장 토론까지. 버튼 한 번에 결정 장애
          탈출! 아래 칩으로 조건을 더하면 한 판 더 난장판이 열려요.
        </p>
        <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
          <button
            type="button"
            onClick={openHistory}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/60 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-cyan-500/40 hover:bg-cyan-500/5 hover:text-cyan-100"
          >
            <History className="h-4 w-4 text-cyan-400/90" aria-hidden />
            지난 토론 보기
            {historySessions.length > 0 && (
              <span className="rounded-full bg-violet-500/25 px-2 py-0.5 text-[11px] font-semibold text-violet-200">
                {historySessions.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setBookmarksOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/60 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-amber-500/40 hover:bg-amber-500/5 hover:text-amber-100"
          >
            <Bookmark className="h-4 w-4 text-amber-400/90" aria-hidden />
            저장한 답변
            {bookmarkCount > 0 && (
              <span className="rounded-full bg-amber-500/25 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                {bookmarkCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <section className="space-y-3 rounded-2xl border border-cyan-500/15 bg-zinc-900/50 p-4 shadow-[0_0_40px_-12px_rgba(34,211,238,0.15)] backdrop-blur-sm sm:p-5">
        <label htmlFor="worry" className="text-sm font-medium text-zinc-200">
          오늘 난장판에 올릴 고민
        </label>
        <textarea
          id="worry"
          rows={3}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={handleTopicKeyDown}
          disabled={busy}
          placeholder='예: "강남에서 부모님이랑 저녁 어디가 좋을까?", "이직할까 말까"'
          className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/25 disabled:opacity-60"
        />
        <p className="text-xs text-zinc-500">
          Enter로 난장판 열기 · Shift+Enter로 줄바꿈
        </p>
        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runDebate}
            disabled={!canRun}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:!bg-zinc-700 disabled:shadow-none disabled:hover:brightness-100"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {isReDebateLoading
                  ? "재토론·의견 수정 중…"
                  : isMatjipKakaoTopic(rootTopic || topic)
                    ? "카카오맵 검색·토론 준비 중…"
                    : "난장판 열 준비 중…"}
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" aria-hidden />
                난장판 열기
              </>
            )}
          </button>
          <button
            type="button"
            onClick={resetAll}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-xl border border-violet-500/30 bg-transparent px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-cyan-500/40 hover:bg-cyan-500/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            다시 쓰기
          </button>
        </div>
      </section>

      {busy && (
        <>
          <section
            className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-cyan-500/20 bg-gradient-to-b from-cyan-950/20 to-violet-950/15 px-6 py-10 sm:py-12"
            aria-busy="true"
            aria-live="polite"
          >
            <Loader2
              className="h-12 w-12 animate-spin text-cyan-400"
              aria-hidden
            />
            <p className="text-center text-base font-medium text-cyan-100">
              {isReDebateLoading
                ? "전문가들이 의견 수정·재섭외 중…"
                : showFoodLoading
                  ? "카카오맵으로 실제 식당을 찾고 있어요…"
                  : "전문가 세 명, 난장판 짜는 중…"}
            </p>
            <p className="max-w-sm text-center text-sm text-zinc-400">
              {isReDebateLoading
                ? "새 조건 반영해서 토론 다시 짜는 중이에요. 잠시만요!"
                : showFoodLoading
                  ? "검색 결과를 토론에 넣고 패널 세 명이 바로 논쟁을 붙여요."
                  : "곧바로 토론 전체가 펼쳐져요."}
            </p>
          </section>

          {showFoodLoading && (
            <section
              className="space-y-3 rounded-3xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5"
              aria-hidden
            >
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 shrink-0 text-amber-400/90" />
                <h2 className="text-sm font-semibold text-zinc-200">
                  오늘의 추천 후보
                </h2>
              </div>
              <p className="text-xs text-zinc-500">
                Kakao Local Keyword Search — 식당 정보를 불러오는 중입니다.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="animate-pulse rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4"
                  >
                    <div className="h-5 w-2/3 rounded-md bg-zinc-700/80" />
                    <div className="mt-2 h-3 w-1/3 rounded bg-zinc-800" />
                    <div className="mt-3 h-4 w-full rounded bg-zinc-800/90" />
                    <div className="mt-2 h-4 w-5/6 rounded bg-zinc-800/80" />
                    <div className="mt-4 h-9 w-36 rounded-lg bg-zinc-700/70" />
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {isReDebateLoading && rounds.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-cyan-500/35 bg-gradient-to-r from-cyan-950/40 to-violet-950/30 px-4 py-3">
          <Loader2
            className="h-8 w-8 shrink-0 animate-spin text-cyan-400"
            aria-hidden
          />
          <div>
            <p className="text-sm font-semibold text-cyan-100">
              2차전 — 패널이 새 조건으로 입장 수정 중
            </p>
            <p className="text-xs text-zinc-500">
              아래 1차 기록은 그대로 두고, 위에 최신 토론이 붙을 거예요.
            </p>
          </div>
        </div>
      )}

      {!busy &&
        rounds.map((entry, idx) => (
          <div key={entry.id} className="space-y-6">
            <DebateRoundContent
              title={roundTitle(idx, rounds.length)}
              payload={entry.payload}
              scrollRef={idx === 0 ? scrollRef : undefined}
              bookmarkContext={{
                roundEntryId: entry.id,
                rootTopic,
                roundTitle: roundTitle(idx, rounds.length),
              }}
              onBookmarksChanged={bumpBookmarkCount}
            />
            {idx === 0 && latestFollowUps.length > 0 && (
              <section className="rounded-3xl border border-cyan-500/25 bg-gradient-to-b from-cyan-950/25 via-zinc-900/50 to-violet-950/20 p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-zinc-100">
                  아직 결정이 어렵다면? 전문가들이 궁금한 점:
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  한 가지만 골라 주시면, 그 조건으로 바로 한 판 더 붙어요.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {latestFollowUps.map((q) => (
                    <button
                      key={q}
                      type="button"
                      disabled={busy}
                      onClick={() => runFollowUp(q)}
                      className="rounded-full border border-cyan-400/45 bg-cyan-500/10 px-4 py-2.5 text-left text-sm font-medium text-cyan-100 shadow-sm shadow-cyan-500/10 transition hover:border-violet-400/50 hover:bg-violet-500/15 hover:text-violet-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        ))}

      <DebateHistoryModal
        key={historyOpen ? "debate-history-open" : "debate-history-closed"}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        sessions={historySessions}
        onRestore={restoreFromHistory}
        onBookmarksChanged={bumpBookmarkCount}
      />
      <BookmarkedAnswersModal
        key={bookmarksOpen ? "bookmarks-open" : "bookmarks-closed"}
        open={bookmarksOpen}
        onClose={() => setBookmarksOpen(false)}
        onListChange={bumpBookmarkCount}
      />
    </div>
  );
}
