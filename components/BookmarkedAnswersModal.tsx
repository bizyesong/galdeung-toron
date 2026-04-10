"use client";

import { useMemo, useState } from "react";
import { Bookmark, ChevronLeft, Trash2, X } from "lucide-react";
import { FormattedDebateBody } from "@/components/FormattedDebateBody";
import type { BookmarkedAnswerRecord } from "@/lib/bookmarkedAnswers";
import {
  loadBookmarkedAnswers,
  removeBookmarkById,
  saveBookmarkedAnswers,
} from "@/lib/bookmarkedAnswers";

type Props = {
  open: boolean;
  onClose: () => void;
  onListChange?: () => void;
};

function formatSavedAt(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat("ko-KR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return iso;
  }
}

export function BookmarkedAnswersModal({
  open,
  onClose,
  onListChange,
}: Props) {
  const [items, setItems] = useState<BookmarkedAnswerRecord[]>(() =>
    loadBookmarkedAnswers(),
  );
  const [detail, setDetail] = useState<BookmarkedAnswerRecord | null>(null);

  const loadList = () => setItems(loadBookmarkedAnswers());

  const refreshAndNotify = () => {
    loadList();
    onListChange?.();
  };

  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [items],
  );

  const handleDelete = (id: string) => {
    removeBookmarkById(id);
    refreshAndNotify();
    setDetail((d) => (d?.id === id ? null : d));
  };

  const handleDeleteAll = () => {
    if (sorted.length === 0) return;
    if (!window.confirm("저장한 답변을 모두 지울까요?")) return;
    saveBookmarkedAnswers([]);
    refreshAndNotify();
    setDetail(null);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bookmarked-answers-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="닫기"
        onClick={onClose}
      />
      <div className="relative flex max-h-[min(92vh,840px)] w-full max-w-2xl flex-col rounded-t-3xl border border-amber-500/20 bg-zinc-950 shadow-2xl shadow-amber-950/30 sm:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3 sm:px-5">
          {detail ? (
            <button
              type="button"
              onClick={() => setDetail(null)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-amber-200/90 transition hover:bg-amber-500/10"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              목록
            </button>
          ) : (
            <h2
              id="bookmarked-answers-title"
              className="flex items-center gap-2 text-base font-semibold text-zinc-100"
            >
              <Bookmark className="h-5 w-5 text-amber-400" aria-hidden />
              저장한 답변
            </h2>
          )}
          <div className="flex items-center gap-1">
            {!detail && sorted.length > 0 ? (
              <button
                type="button"
                onClick={handleDeleteAll}
                className="rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-500 transition hover:bg-red-500/10 hover:text-red-300"
              >
                전체 삭제
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
              aria-label="모달 닫기"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
          {!detail ? (
            <>
              {sorted.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-500">
                  아직 북마크한 답변이 없어요. 토론 카드 우측 상단 북마크를 누르면
                  이 기기에 저장돼요.
                </p>
              ) : (
                <ul className="space-y-2">
                  {sorted.map((b) => (
                    <li key={b.id} className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setDetail(b)}
                        className="min-w-0 flex-1 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-left transition hover:border-amber-500/35 hover:bg-amber-500/5"
                      >
                        <p className="text-[11px] font-medium uppercase tracking-wide text-amber-200/70">
                          {b.kind === "turn"
                            ? `발언 · ${b.speakerLabel ?? "패널"}`
                            : "싸우다 보니 결론"}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm font-medium text-zinc-100">
                          {b.kind === "turn"
                            ? b.turn?.headline || b.turn?.body?.slice(0, 120)
                            : b.consensusSnapshot?.closingLine ||
                              b.consensusSnapshot?.summary?.slice(0, 120)}
                        </p>
                        <p className="mt-1 line-clamp-1 text-xs text-zinc-500">
                          {b.topic}
                        </p>
                        <p className="mt-1 text-xs text-zinc-600">
                          {b.roundTitle} · {formatSavedAt(b.createdAt)}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(b.id);
                        }}
                        className="shrink-0 self-center rounded-xl border border-zinc-700 p-2.5 text-zinc-500 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
                        aria-label="이 답변 삭제"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <div className="space-y-4 pb-2">
              <div className="rounded-2xl border border-amber-500/20 bg-amber-950/15 px-4 py-3">
                <p className="text-xs font-medium text-amber-200/80">고민</p>
                <p className="mt-1 text-sm text-zinc-200">{detail.topic}</p>
                <p className="mt-2 text-xs text-zinc-500">
                  {detail.roundTitle} · {formatSavedAt(detail.createdAt)}
                </p>
              </div>

              {detail.kind === "turn" && detail.turn ? (
                <div className="rounded-2xl border border-zinc-700 bg-zinc-900/50 p-4">
                  <p className="text-xs font-semibold text-zinc-400">
                    {detail.speakerLabel}
                  </p>
                  {detail.turn.headline ? (
                    <p className="mt-2 text-sm font-semibold text-zinc-100">
                      {detail.turn.headline}
                    </p>
                  ) : null}
                  <div className="mt-3 text-sm leading-relaxed text-zinc-300">
                    <FormattedDebateBody text={detail.turn.body} />
                  </div>
                </div>
              ) : detail.kind === "consensus" && detail.consensusSnapshot ? (
                (() => {
                  const snap = detail.consensusSnapshot;
                  const factorLines =
                    snap.keyFactors && snap.keyFactors.length > 0
                      ? snap.keyFactors
                      : snap.whyThreeLines ?? [];
                  const structuredSnap =
                    (snap.options?.length ?? 0) > 0 ||
                    (snap.risks?.length ?? 0) > 0 ||
                    (snap.keyFactors?.length ?? 0) > 0;
                  const snapActionsTitle = structuredSnap
                    ? "바로 할 일"
                    : "가기 전에";
                  return (
                    <div className="space-y-4 rounded-2xl border border-indigo-500/25 bg-indigo-950/20 p-4">
                      {snap.closingLine ? (
                        <p className="text-lg font-semibold leading-snug text-zinc-50">
                          <FormattedDebateBody text={snap.closingLine} />
                        </p>
                      ) : null}
                      {snap.options && snap.options.length > 0 ? (
                        <div className="border-t border-white/10 pt-3">
                          <p className="mb-2 text-xs font-semibold text-cyan-200/90">
                            선택지
                          </p>
                          <ul className="space-y-2 text-sm text-cyan-50">
                            {snap.options.map((o) => (
                              <li
                                key={o}
                                className="rounded-lg border border-cyan-500/30 bg-cyan-950/20 px-3 py-2"
                              >
                                <FormattedDebateBody text={o} />
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {factorLines.length > 0 ? (
                        <div className="border-t border-white/10 pt-3">
                          <p className="mb-2 text-xs font-semibold text-indigo-200/85">
                            핵심 요인
                          </p>
                          <ul className="space-y-2 text-sm text-zinc-200">
                            {factorLines.map((line, idx) => (
                              <li
                                key={`${idx}-${line.slice(0, 20)}`}
                                className="flex gap-2"
                              >
                                <span className="font-bold text-indigo-300">
                                  {idx + 1}.
                                </span>
                                <FormattedDebateBody text={line} />
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {snap.summary.trim().length > 0 ? (
                        <div className="border-t border-white/10 pt-3">
                          <p className="mb-2 text-xs font-semibold text-zinc-500">
                            패널 한 줄
                          </p>
                          <div className="text-sm text-zinc-400">
                            <FormattedDebateBody text={snap.summary} />
                          </div>
                        </div>
                      ) : null}
                      {snap.risks && snap.risks.length > 0 ? (
                        <div className="border-t border-amber-500/25 pt-3">
                          <p className="mb-2 text-xs font-semibold text-amber-200/90">
                            리스크
                          </p>
                          <ul className="space-y-2 text-sm text-amber-100/90">
                            {snap.risks.map((r, idx) => (
                              <li key={`${idx}-${r.slice(0, 16)}`}>
                                <span className="font-bold text-amber-400/90">
                                  {idx + 1}.{" "}
                                </span>
                                <FormattedDebateBody text={r} />
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      <div className="border-t border-white/10 pt-3">
                        <p className="text-xs font-semibold text-indigo-200/80">
                          {snapActionsTitle}
                        </p>
                        <ul className="mt-2 list-inside list-decimal space-y-1.5 text-sm text-zinc-300">
                          {snap.actions.map((a) => (
                            <li key={a}>
                              <FormattedDebateBody text={a} />
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })()
              ) : null}

              <button
                type="button"
                onClick={() => handleDelete(detail.id)}
                className="w-full rounded-xl border border-red-500/35 bg-red-500/10 py-2.5 text-sm font-medium text-red-200 transition hover:bg-red-500/20"
              >
                이 답변 삭제
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
