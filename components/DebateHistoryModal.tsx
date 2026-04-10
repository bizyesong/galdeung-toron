"use client";

import { useState } from "react";
import { ChevronLeft, History, X } from "lucide-react";
import { DebateRoundContent, roundTitle } from "@/components/DebateRoundContent";
import type { DebateHistorySession } from "@/lib/debateHistory";

type Props = {
  open: boolean;
  onClose: () => void;
  sessions: DebateHistorySession[];
  onRestore: (session: DebateHistorySession) => void;
  onBookmarksChanged?: () => void;
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

export function DebateHistoryModal({
  open,
  onClose,
  sessions,
  onRestore,
  onBookmarksChanged,
}: Props) {
  const [detail, setDetail] = useState<DebateHistorySession | null>(null);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="debate-history-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="닫기"
        onClick={onClose}
      />
      <div className="relative flex max-h-[min(92vh,840px)] w-full max-w-2xl flex-col rounded-t-3xl border border-cyan-500/20 bg-zinc-950 shadow-2xl shadow-cyan-950/40 sm:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3 sm:px-5">
          {detail ? (
            <button
              type="button"
              onClick={() => setDetail(null)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-cyan-200/90 transition hover:bg-cyan-500/10"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              목록
            </button>
          ) : (
            <h2
              id="debate-history-title"
              className="flex items-center gap-2 text-base font-semibold text-zinc-100"
            >
              <History className="h-5 w-5 text-cyan-400" aria-hidden />
              지난 토론
            </h2>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="모달 닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
          {!detail ? (
            <>
              {sessions.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-500">
                  아직 저장된 토론이 없어요. 난장판을 한 번 열고 나면 이 기기에
                  자동으로 쌓여요.
                </p>
              ) : (
                <ul className="space-y-2">
                  {sessions.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setDetail(s)}
                        className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-left transition hover:border-cyan-500/35 hover:bg-cyan-500/5"
                      >
                        <p className="line-clamp-2 text-sm font-medium text-zinc-100">
                          {s.rootTopic}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {formatSavedAt(s.savedAt)} · {s.rounds.length}회차
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <div className="space-y-6">
              <div className="rounded-2xl border border-violet-500/20 bg-violet-950/20 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-violet-300/80">
                  처음 올린 고민
                </p>
                <p className="mt-1 text-sm text-zinc-200">{detail.rootTopic}</p>
                <p className="mt-2 text-xs text-zinc-500">
                  {formatSavedAt(detail.savedAt)}
                </p>
              </div>
              {detail.rounds.map((entry, idx) => (
                <DebateRoundContent
                  key={entry.id}
                  title={roundTitle(idx, detail.rounds.length)}
                  payload={entry.payload}
                  bookmarkContext={{
                    roundEntryId: entry.id,
                    rootTopic: detail.rootTopic,
                    roundTitle: roundTitle(idx, detail.rounds.length),
                  }}
                  onBookmarksChanged={onBookmarksChanged}
                />
              ))}
              <div className="flex flex-col gap-2 pb-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => onRestore(detail)}
                  className="rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/15 transition hover:brightness-110"
                >
                  이 토론을 메인에 불러오기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
