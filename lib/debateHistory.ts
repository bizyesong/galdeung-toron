import type { DebatePayload } from "./debateTypes";

export const DEBATE_HISTORY_KEY = "nanjang-debate-history-v1";
export const MAX_DEBATE_HISTORY = 30;

export type HistoryRoundEntry = { id: string; payload: DebatePayload };

export type DebateHistorySession = {
  id: string;
  savedAt: string;
  rootTopic: string;
  rounds: HistoryRoundEntry[];
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function isDebatePayload(x: unknown): x is DebatePayload {
  if (!isRecord(x)) return false;
  return (
    typeof x.topic === "string" &&
    Array.isArray(x.turns) &&
    Array.isArray(x.experts) &&
    isRecord(x.consensus) &&
    typeof (x.consensus as { summary?: unknown }).summary === "string"
  );
}

function isHistoryRoundEntry(x: unknown): x is HistoryRoundEntry {
  if (!isRecord(x)) return false;
  return typeof x.id === "string" && isDebatePayload(x.payload);
}

function isHistorySession(x: unknown): x is DebateHistorySession {
  if (!isRecord(x)) return false;
  return (
    typeof x.id === "string" &&
    typeof x.savedAt === "string" &&
    typeof x.rootTopic === "string" &&
    Array.isArray(x.rounds) &&
    x.rounds.every(isHistoryRoundEntry)
  );
}

export function loadDebateHistory(): DebateHistorySession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DEBATE_HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isHistorySession);
  } catch {
    return [];
  }
}

export function saveDebateHistory(sessions: DebateHistorySession[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DEBATE_HISTORY_KEY, JSON.stringify(sessions));
  } catch {
    /* quota or private mode */
  }
}

/** 같은 sessionId면 최신 rounds로 덮어쓰고, 목록 맨 앞으로 올림 */
export function upsertSession(
  sessions: DebateHistorySession[],
  session: DebateHistorySession,
): DebateHistorySession[] {
  const rest = sessions.filter((s) => s.id !== session.id);
  return [session, ...rest].slice(0, MAX_DEBATE_HISTORY);
}

export function persistSession(
  sessionId: string,
  rootTopic: string,
  rounds: HistoryRoundEntry[],
): DebateHistorySession[] {
  const entry: DebateHistorySession = {
    id: sessionId,
    savedAt: new Date().toISOString(),
    rootTopic,
    rounds,
  };
  const next = upsertSession(loadDebateHistory(), entry);
  saveDebateHistory(next);
  return next;
}
