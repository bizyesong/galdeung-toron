"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bookmark } from "lucide-react";
import type { ConsensusResult, DebateTurn } from "@/lib/debateTypes";
import {
  isStableKeyBookmarked,
  makeBookmarkStableKey,
  toggleConsensusAnswerBookmark,
  toggleTurnAnswerBookmark,
} from "@/lib/bookmarkedAnswers";

type TurnProps = {
  kind: "turn";
  roundEntryId: string;
  rootTopic: string;
  roundTitle: string;
  turnIndex: number;
  turn: DebateTurn;
  speakerLabel: string;
  onChange?: () => void;
};

type ConsensusProps = {
  kind: "consensus";
  roundEntryId: string;
  rootTopic: string;
  roundTitle: string;
  consensus: ConsensusResult;
  onChange?: () => void;
};

type Props = TurnProps | ConsensusProps;

export function AnswerBookmarkButton(props: Props) {
  const stableKey = useMemo(() => {
    if (props.kind === "turn") {
      return makeBookmarkStableKey(
        props.roundEntryId,
        "turn",
        props.turnIndex,
      );
    }
    return makeBookmarkStableKey(props.roundEntryId, "consensus");
  }, [props]);

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(isStableKeyBookmarked(stableKey));
  }, [stableKey]);

  const handleClick = useCallback(() => {
    let next: boolean;
    if (props.kind === "turn") {
      next = toggleTurnAnswerBookmark({
        roundEntryId: props.roundEntryId,
        rootTopic: props.rootTopic,
        roundTitle: props.roundTitle,
        turnIndex: props.turnIndex,
        turn: props.turn,
        speakerLabel: props.speakerLabel,
      });
    } else {
      next = toggleConsensusAnswerBookmark({
        roundEntryId: props.roundEntryId,
        rootTopic: props.rootTopic,
        roundTitle: props.roundTitle,
        consensus: props.consensus,
      });
    }
    setSaved(next);
    props.onChange?.();
  }, [props]);

  const label = saved
    ? "저장된 답변에서 제거"
    : "저장한 답변에 넣기";

  return (
    <button
      type="button"
      onClick={handleClick}
      title={label}
      aria-label={label}
      aria-pressed={saved}
      className={`rounded-lg p-1.5 transition ${
        saved
          ? "text-amber-300 hover:bg-amber-500/15"
          : "text-zinc-500 hover:bg-white/10 hover:text-zinc-200"
      }`}
    >
      <Bookmark
        className="h-4 w-4 sm:h-[18px] sm:w-[18px]"
        aria-hidden
        fill={saved ? "currentColor" : "none"}
      />
    </button>
  );
}
