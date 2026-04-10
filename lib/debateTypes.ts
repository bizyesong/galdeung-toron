import type { ExpertThemeColor } from "./expertTheme";

export interface ExpertProfile {
  /** 1, 2, 3 */
  id: number;
  name: string;
  /** 한 줄 역할·성격 (예: 애플 생태계 예찬론자) */
  description: string;
  /** LLM summary.experts[].one_line — 패널에 표시할 핵심 주장 한 줄 */
  claimOneLine?: string;
  /** 선택: 긴 소개 */
  bio?: string;
  /** lucide-react 컴포넌트 export 이름 (PascalCase) */
  iconName: string;
  /** 카드·말풍선 테마 */
  color: ExpertThemeColor;
}

export type DebatePhase =
  | "opening"
  | "rebuttal"
  | "synthesis"
  | "final_summary"
  /** 구 API·구 LLM 호환 */
  | "deep1"
  | "rebuttal2"
  | "critique3"
  | "free"
  | "conclusion";

export interface DebateTurn {
  /** 0,1,2 = 전문가 / -1 = 진행자 */
  expertIndex: number;
  phase: DebatePhase;
  /** 본문 핵심 주장 한 줄 요약(절차 멘트 아님) */
  headline: string;
  body: string;
  /** UI 배지: 전문가 톤·무드 한마디(LLM mood_chip). 없으면 단계별 중립 라벨 */
  moodChip?: string;
  delayMs?: number;
}

/** 맛집·장소 토론: 전문가별 구체 제안 */
export interface ExpertVenuePick {
  expertId: number;
  venueName: string;
  /** 카카오맵 장소 페이지 (검색 결과 place_url과 동일 권장) */
  placeUrl?: string;
  menuPick: string;
  reason: string;
  locationAdvantage: string;
}

/** 맛집·장소 토론: 최종 한 곳 */
export interface FinalVenuePick {
  venueName: string;
  /** 카카오맵 장소 페이지 */
  placeUrl?: string;
  menuPick: string;
  detailedReason: string;
  locationNote: string;
}

export interface ConsensusResult {
  summary: string;
  actions: string[];
  /** 한 줄 훅: "싸우다 보니 결론 났어요! …" */
  closingLine?: string;
  /** 핵심 판단 요인 3줄 (구 스키마 key_points·신규 key_factors) */
  whyThreeLines?: string[];
  /** 빠른 결정용 선택지(보통 3개) */
  options?: string[];
  /** 핵심 요인(whyThreeLines와 동시 쓰기 가능·UI는 병합 표시) */
  keyFactors?: string[];
  /** 주의할 리스크 */
  risks?: string[];
  expertVenuePicks?: ExpertVenuePick[];
  finalPick?: FinalVenuePick;
}

/** 카카오 로컬 키워드 검색으로 가져온 실제 장소 (맛집·장소 토론용) */
export interface KakaoPlaceCandidate {
  id: string;
  placeName: string;
  address: string;
  categoryName: string;
  phone: string;
  placeUrl: string;
}

/** 앱 내부·API 응답(정규화 후) */
export interface DebatePayload {
  topic: string;
  experts: ExpertProfile[];
  turns: DebateTurn[];
  consensus: ConsensusResult;
  /** 맛집 주제일 때 카카오맵 검색 후보 (없으면 미포함) */
  kakaoPlaces?: KakaoPlaceCandidate[];
  /** 역제안 후속 선택지 (최대 3, LLM follow_up_questions) */
  followUpQuestions?: string[];
}
