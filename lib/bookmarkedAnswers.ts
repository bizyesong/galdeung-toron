import type { ConsensusResult, DebateTurn } from "./debateTypes";

export const BOOKMARKED_ANSWERS_KEY = "nanjang-bookmarked-answers-v1";
export const MAX_BOOKMARKED_ANSWERS = 200;

export type BookmarkKind = "turn" | "consensus";

export type BookmarkedAnswerRecord = {
  id: string;
  stableKey: string;
  createdAt: string;
  topic: string;
  roundTitle: string;
  roundEntryId: string;
  kind: BookmarkKind;
  turnIndex?: number;
  speakerLabel?: string;
  turn?: DebateTurn;
  consensusSnapshot?: ConsensusResult;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function isDebateTurn(x: unknown): x is DebateTurn {
  if (!isRecord(x)) return false;
  return (
    typeof x.expertIndex === "number" &&
    typeof x.phase === "string" &&
    typeof x.headline === "string" &&
    typeof x.body === "string"
  );
}

function isConsensusSnapshot(x: unknown): x is ConsensusResult {
  if (!isRecord(x)) return false;
  return (
    typeof x.summary === "string" &&
    Array.isArray(x.actions) &&
    x.actions.every((a) => typeof a === "string")
  );
}

function isBookmarkedAnswerRecord(x: unknown): x is BookmarkedAnswerRecord {
  if (!isRecord(x)) return false;
  if (typeof x.id !== "string" || typeof x.stableKey !== "string") return false;
  if (typeof x.createdAt !== "string") return false;
  if (typeof x.topic !== "string" || typeof x.roundTitle !== "string")
    return false;
  if (typeof x.roundEntryId !== "string") return false;
  if (x.kind !== "turn" && x.kind !== "consensus") return false;
  if (x.kind === "turn") {
    if (typeof x.turnIndex !== "number") return false;
    if (!isDebateTurn(x.turn)) return false;
  } else {
    if (!isConsensusSnapshot(x.consensusSnapshot)) return false;
  }
  return true;
}

export function makeBookmarkStableKey(
  roundEntryId: string,
  kind: BookmarkKind,
  turnIndex?: number,
): string {
  if (kind === "consensus") return `${roundEntryId}:consensus`;
  return `${roundEntryId}:turn:${turnIndex}`;
}

export function loadBookmarkedAnswers(): BookmarkedAnswerRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BOOKMARKED_ANSWERS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isBookmarkedAnswerRecord);
  } catch {
    return [];
  }
}

export function saveBookmarkedAnswers(items: BookmarkedAnswerRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BOOKMARKED_ANSWERS_KEY, JSON.stringify(items));
  } catch {
    /* quota */
  }
}

export function isStableKeyBookmarked(stableKey: string): boolean {
  return loadBookmarkedAnswers().some((b) => b.stableKey === stableKey);
}

export function toggleTurnAnswerBookmark(params: {
  roundEntryId: string;
  rootTopic: string;
  roundTitle: string;
  turnIndex: number;
  turn: DebateTurn;
  speakerLabel: string;
}): boolean {
  const stableKey = makeBookmarkStableKey(
    params.roundEntryId,
    "turn",
    params.turnIndex,
  );
  const all = loadBookmarkedAnswers();
  const idx = all.findIndex((b) => b.stableKey === stableKey);
  if (idx >= 0) {
    all.splice(idx, 1);
    saveBookmarkedAnswers(all);
    return false;
  }
  const record: BookmarkedAnswerRecord = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    stableKey,
    createdAt: new Date().toISOString(),
    topic: params.rootTopic,
    roundTitle: params.roundTitle,
    roundEntryId: params.roundEntryId,
    kind: "turn",
    turnIndex: params.turnIndex,
    speakerLabel: params.speakerLabel,
    turn: { ...params.turn },
  };
  const next = [record, ...all].slice(0, MAX_BOOKMARKED_ANSWERS);
  saveBookmarkedAnswers(next);
  return true;
}

export function toggleConsensusAnswerBookmark(params: {
  roundEntryId: string;
  rootTopic: string;
  roundTitle: string;
  consensus: ConsensusResult;
}): boolean {
  const stableKey = makeBookmarkStableKey(params.roundEntryId, "consensus");
  const all = loadBookmarkedAnswers();
  const idx = all.findIndex((b) => b.stableKey === stableKey);
  if (idx >= 0) {
    all.splice(idx, 1);
    saveBookmarkedAnswers(all);
    return false;
  }
  const record: BookmarkedAnswerRecord = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    stableKey,
    createdAt: new Date().toISOString(),
    topic: params.rootTopic,
    roundTitle: params.roundTitle,
    roundEntryId: params.roundEntryId,
    kind: "consensus",
    consensusSnapshot: {
      ...params.consensus,
      actions: [...params.consensus.actions],
      options: params.consensus.options
        ? [...params.consensus.options]
        : undefined,
      keyFactors: params.consensus.keyFactors
        ? [...params.consensus.keyFactors]
        : undefined,
      risks: params.consensus.risks
        ? [...params.consensus.risks]
        : undefined,
      whyThreeLines: params.consensus.whyThreeLines
        ? [...params.consensus.whyThreeLines]
        : undefined,
      expertVenuePicks: params.consensus.expertVenuePicks
        ? params.consensus.expertVenuePicks.map((p) => ({ ...p }))
        : undefined,
      finalPick: params.consensus.finalPick
        ? { ...params.consensus.finalPick }
        : undefined,
    },
  };
  const next = [record, ...all].slice(0, MAX_BOOKMARKED_ANSWERS);
  saveBookmarkedAnswers(next);
  return true;
}

export function removeBookmarkById(id: string): void {
  const all = loadBookmarkedAnswers().filter((b) => b.id !== id);
  saveBookmarkedAnswers(all);
}
