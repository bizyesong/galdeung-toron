import { NextRequest, NextResponse } from "next/server";
import { buildLocalDebate } from "@/lib/dynamicDebate";
import {
  buildKakaoKeywordQuery,
  KakaoLocalSearchError,
  KAKAO_EMPTY_SEARCH_USER_MESSAGE,
  normalizeKakaoRestApiKey,
  searchKakaoKeywordPlaces,
} from "@/lib/kakaoLocalSearch";
import { generateDebateWithOpenAI } from "@/lib/openaiDebate";
import {
  isDebateCopyPolishAfterOpenAiEnabled,
  isDebateCopyPolishLocalEnabled,
  polishFoodDebateCopy,
} from "@/lib/polishDebateCopy";
import type { KakaoPlaceCandidate } from "@/lib/debateTypes";
import { stripMatjipMetaLectureOpening } from "@/lib/stripDebateMarkdown";
import {
  isDrinkDecisionTopic,
  isElectronicsTopic,
  isMatjipKakaoTopic,
} from "@/lib/topicDetect";

export const maxDuration = 90;

export async function POST(req: NextRequest) {
  let topic = "";
  let followUpChoice = "";
  let priorSummary = "";
  try {
    const body = (await req.json()) as {
      topic?: string;
      followUpChoice?: string;
      priorSummary?: string;
    };
    topic = typeof body.topic === "string" ? body.topic.trim() : "";
    followUpChoice =
      typeof body.followUpChoice === "string" ? body.followUpChoice.trim() : "";
    priorSummary =
      typeof body.priorSummary === "string" ? body.priorSummary.trim() : "";
  } catch {
    return NextResponse.json(
      { error: "잘못된 요청 본문입니다." },
      { status: 400 },
    );
  }

  if (!topic) {
    return NextResponse.json(
      { error: "주제를 입력해 주세요." },
      { status: 400 },
    );
  }

  const foodPlace = isMatjipKakaoTopic(topic);
  const electronicsTopic = isElectronicsTopic(topic);
  const drinkTopic =
    !foodPlace && !electronicsTopic && isDrinkDecisionTopic(topic);
  const kakaoKey = normalizeKakaoRestApiKey(
    process.env.KAKAO_CLIENT_ID ?? process.env.KAKAO_REST_API_KEY,
  );

  let kakaoPlaces: KakaoPlaceCandidate[] = [];
  if (foodPlace) {
    if (!kakaoKey) {
      return NextResponse.json(
        {
          error:
            "맛집 검색에 카카오 REST API 키가 필요합니다. 로컬: package.json 있는 폴더의 .env.local에 KAKAO_CLIENT_ID=키 를 넣고 개발 서버를 재시작하세요. Vercel 등 배포: 프로젝트 → Settings → Environment Variables에 KAKAO_CLIENT_ID(또는 KAKAO_REST_API_KEY)를 추가한 뒤 Redeploy 하세요. .env.example만 수정한 경우에는 적용되지 않습니다.",
        },
        { status: 503 },
      );
    }
    let builtQuery = "";
    try {
      builtQuery = buildKakaoKeywordQuery(topic);
      kakaoPlaces = await searchKakaoKeywordPlaces(builtQuery, kakaoKey, {
        size: 10,
      });
    } catch (e) {
      console.error("[debate] Kakao Local API error:", e);
      if (e instanceof KakaoLocalSearchError) {
        if (e.status === 401 || e.status === 403) {
          const hint = e.bodySnippet.trim()
            ? ` 카카오 응답: ${e.bodySnippet.trim()}`
            : "";
          return NextResponse.json(
            {
              error:
                `카카오 REST API 키가 거부되었습니다(HTTP ${e.status}).` +
                hint +
                " 확인: (1) 개발자 콘솔 → 내 애플리케이션 → 앱 키 → REST API 키만 사용 (JavaScript·네이티브·Admin 키 아님) (2) .env.local 에 따옴표 없이 한 줄로 붙여넣기 (3) 키 재발급 후 다시 저장·서버 재시작",
            },
            { status: 503 },
          );
        }
        return NextResponse.json(
          {
            error: `카카오맵 로컬 API 오류(HTTP ${e.status}). 잠시 후 다시 시도하거나 카카오 개발자 콘솔에서 앱 상태를 확인하세요.`,
          },
          { status: 502 },
        );
      }
      return NextResponse.json(
        {
          error:
            "카카오맵 검색 중 알 수 없는 오류가 났습니다. 터미널 서버 로그를 확인해 주세요.",
        },
        { status: 502 },
      );
    }
    if (kakaoPlaces.length === 0) {
      return NextResponse.json(
        {
          error: `${KAKAO_EMPTY_SEARCH_USER_MESSAGE} 시도한 검색어: 「${builtQuery}」. 지역과 음식을 함께 적어 보세요. (예: 강남 한식 맛집)`,
        },
        { status: 422 },
      );
    }
  }

  const localOpts: {
    kakaoPlaces?: KakaoPlaceCandidate[];
    followUpChoice?: string;
  } = {};
  if (foodPlace) {
    localOpts.kakaoPlaces = kakaoPlaces;
  }
  if (followUpChoice) {
    localOpts.followUpChoice = followUpChoice;
  }

  const openAiOpts = {
    foodPlace,
    electronicsTopic,
    drinkTopic,
    kakaoPlaces,
    ...(followUpChoice ? { followUpChoice, priorSummary } : {}),
  };

  const key = process.env.OPENAI_API_KEY?.trim();
  if (key) {
    try {
      let payload = await generateDebateWithOpenAI(topic, key, openAiOpts);
      if (
        foodPlace &&
        kakaoPlaces.length > 0 &&
        isDebateCopyPolishLocalEnabled() &&
        isDebateCopyPolishAfterOpenAiEnabled()
      ) {
        try {
          payload = await polishFoodDebateCopy(payload, key, kakaoPlaces);
        } catch (e) {
          console.error("[debate] copy polish (after OpenAI) failed:", e);
        }
      }
      if (foodPlace && kakaoPlaces.length > 0) {
        payload = stripMatjipMetaLectureOpening(payload, kakaoPlaces);
      }
      return NextResponse.json(payload);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[debate] OpenAI error:", msg);
      /* fall back to local */
    }
  }

  let localPayload = buildLocalDebate(
    topic,
    Object.keys(localOpts).length > 0 ? localOpts : undefined,
  );
  if (
    foodPlace &&
    kakaoPlaces.length > 0 &&
    key &&
    isDebateCopyPolishLocalEnabled()
  ) {
    try {
      localPayload = await polishFoodDebateCopy(
        localPayload,
        key,
        kakaoPlaces,
      );
    } catch (e) {
      console.error("[debate] copy polish (local fallback) failed:", e);
    }
  }

  if (foodPlace && kakaoPlaces.length > 0) {
    localPayload = stripMatjipMetaLectureOpening(localPayload, kakaoPlaces);
  }

  return NextResponse.json(localPayload);
}
