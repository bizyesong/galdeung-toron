import type {
  ConsensusResult,
  DebatePayload,
  DebateTurn,
  ExpertProfile,
  KakaoPlaceCandidate,
} from "./debateTypes";
import {
  clampOpinionSummaryForDisplay,
  OPINION_SUMMARY_DISPLAY_MAX,
} from "./opinionSummaryDisplay";
import { sanitizeDebatePayload, withKakaoPlaces } from "./stripDebateMarkdown";
import type { ExpertThemeColor } from "./expertTheme";
import { isDrinkDecisionTopic, isElectronicsTopic } from "./topicDetect";

type Category =
  | "food_place"
  | "electronics"
  | "drink"
  | "career"
  | "relationship"
  | "travel"
  | "money"
  | "generic";

function escapeTopic(raw: string): string {
  const t = raw.trim();
  return t.length > 0 ? t.slice(0, 200) : "이 고민";
}

export function defaultFollowUpQuestionsForTopic(
  rawTopic: string,
  secondRound: boolean,
): string[] {
  if (secondRound) {
    return [
      "아직 이 부분이 제일 걸려요",
      "조건을 조금만 바꿔볼게요",
      "다른 선택지도 짧게 비교해줘",
    ];
  }
  const category = detectCategory(rawTopic);
  switch (category) {
    case "food_place":
      return ["5명 이상 단체야", "주차가 꼭 필요해", "조용한 분위기 원해"];
    case "electronics":
      return [
        "학생이라 돈이 없어",
        "카메라가 제일 중요해",
        "지금 폰이 완전히 고장 났어",
      ];
    case "drink":
      return [
        "내일 운전해야 해",
        "혈압약·약 먹어",
        "혼자 마시는 거야",
      ];
    case "career":
      return ["지금 당장 나가야 해", "연봉·복지가 제일 중요해", "번아웃이 심해"];
    case "relationship":
      return ["상대랑 솔직히 말 못 했어", "이별도 생각 중이야", "시간을 더 주고 싶어"];
    case "travel":
      return ["예산이 빡빡해", "아이·부모 동반", "날씨·피크 피하고 싶어"];
    case "money":
      return ["비상금이 얇아", "부채가 있어", "장기로 굴릴 거야"];
    default:
      return [
        "인원·상황이 있어",
        "예산·시간 제한이 있어",
        "처음이라 불안해",
      ];
  }
}

function detectCategory(topic: string): Category {
  const s = topic.toLowerCase();
  if (/맛집/.test(s)) {
    return "food_place";
  }
  if (isDrinkDecisionTopic(topic)) {
    return "drink";
  }
  if (isElectronicsTopic(topic)) {
    return "electronics";
  }
  if (
    /이직|퇴사|연봉|회사|직장|커리어|면접|승진|야근|사직|재택|스타트업/.test(s)
  ) {
    return "career";
  }
  if (
    /연애|사귀|헤어|썸|결혼|배우자|남친|여친|전남친|전여친|소개팅|이별/.test(s)
  ) {
    return "relationship";
  }
  if (
    /여행|항공|호텔|숙소|여수|제주|해외|휴가|밤바다|티켓|렌터카/.test(s)
  ) {
    return "travel";
  }
  if (
    /돈|저축|투자|주식|코인|대출|전세|월세|가성비|예산|적금/.test(s)
  ) {
    return "money";
  }
  return "generic";
}

function hashPick(topic: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < topic.length; i += 1) {
    h = (h * 31 + topic.charCodeAt(i)) >>> 0;
  }
  return mod === 0 ? 0 : h % mod;
}

function clipCtx(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function packFoodPlace(topic: string, searchContext?: string): Pack {
  const sc = searchContext?.trim();
  const scBlock = sc
    ? `\n\n[웹에서 긁어온 짤막한 정보라서, **영업·메뉴는 꼭 다시 확인해요**]\n${clipCtx(sc, 3200)}`
    : "";

  const trios = [
    {
      n: ["강남역 터줏대감 민지", "가성비 헌터 재호", "효도 담당 실장"],
      d: [
        "강남역·삼성 쪽은 제가 밥 먹으러 다닌 지가 12년이에요",
        "웨이팅·1인당·포장까지 따지는 스타일",
        "부모님 모실 때 무릎 안 아프게 동선 짜는 사람",
      ],
    },
    {
      n: ["압구정 골목 지킴이 수연", "줄 서기 싫은 태윤", "엄마 아빠 코디네이터"],
      d: [
        "로데오~청담 사이 골목 동선은 제가 다 알아요",
        "줄·가격·양 봐서 ‘이건 좀 아니다’ 바로 말함",
        "승강기·주차부터 챙기는 타입",
      ],
    },
  ][hashPick(topic, 2)]!;

  return {
    experts: [
      {
        name: trios.n[0]!,
        description: "강남권 밥집 지형 박박",
        bio: trios.d[0]!,
        iconName: "MapPin",
        color: "cyan",
      },
      {
        name: trios.n[1]!,
        description: "가성비·웨이팅 현실 파악",
        bio: trios.d[1]!,
        iconName: "Search",
        color: "amber",
      },
      {
        name: trios.n[2]!,
        description: "부모님·어르신 동행 담당",
        bio: trios.d[2]!,
        iconName: "HeartHandshake",
        color: "rose",
      },
    ],
    deep1: `솔직히 말하면 **봉피양 압구정본점** 가자고 할래요. 한우 한 점 올라왔을 때 ‘아 이거지’ 하는 그 느낌이 있잖아요. 제 친구도 작년에 거기 갔다가 카드는 아팠는데 한 달 동안 다른 고깃집이 안 먹힌대요.

물론 **지갑은 무겁고** 예약도 빡셀 수 있어요. 그래도 ‘강남 와서 한 번 제대로’면 저는 여기부터 말하는 편이에요.${scBlock}`,
    rebuttal2: `봉피양 좋죠, 근데 완전 프리미엄 코스만 밀고 가자는 취향만은 아니면 어떡해요? 저는 **하이디라오 코엑스몰점**이 훨씬 현실적이라고 봐요. 제 동생이 거기서 웨이팅만 두 시간 하다가 입맛 다 떨어졌다고 욕하긴 했는데… 그건 주말 저녁 피크를 몰고 간 거고요. 평일이면 나쁘지 않아요.

코엑스 쪽은 **지하로 이어져서 비 안 맞고** 들어가니까, 부모님 모시고 가기엔 백번 나아요. **강남역 10번 출구 쪽 번화가**만 콕 집어서 걸어가면 소음에 어르신들 진짜 지치거든요.`,
    critique3: `두 분 다 진정하시고요—저는 **육쌈냉면 강남역 근처 매장** 같은 데도 같이 놓고 보라고 할게요. ‘맛집’이 꼭 비싼 한우만은 아니잖아요? 육회랑 냉면이면 부모님도 부담 없이 드시고, **강남역에서 도보로** 끝나면 택시 안 잡아도 돼요.

한마디만 더 할게요: 봉피양은 기념일·격식, 하이디라오는 인원 많고 주차·실내 동선, 육쌈냉면은 빠르고 부담 적게—이렇게 **상황 나누는 게** 제일 싸움 안 나요.`,
    free1: `저는 여전히 봉피양이에요. “맛집 추천”이면 한 점의 임팩트가 기준이죠.`,
    free2: `차 끌고 오시는 부모님이면 코엑스 라인이 덜 스트레스예요. 밖으로 비 맞고 안 헤매요.`,
    free3: `줄 싫으면 6시 전에 가거나 앱 대기 걸어봐요. 진짜예요.`,
    conclusion: `싸우다 보니 결론 났어요! 오늘 질문이 “부담 없이 많이 먹고·주차·실내 동선” 쪽이면 **하이디라오 코엑스몰점**부터 가 보세요. 기념일 한 방이면 **봉피양**, 가볍게 끝내려면 **육쌈냉면 강남역권**—이렇게만 기억해 두면 돼요.`,
    consensus: {
      summary: `세 사람이 실제로 있는 집 이름 들고 와서 싸우다가, “오늘은 이쪽!”으로 모였어요.`,
      closingLine: `싸우다 보니 결론 났어요! **하이디라오 코엑스몰점**부터 가 보는 걸 추천할게요.`,
      whyThreeLines: [
        "부모님·지인 여러 명이면 **주차·지하 연결**이 스트레스를 확 줄여줘요.",
        "메뉴가 다양해서 **안 먹는 사람** 있어도 국물·고기·야채로 조율하기 쉬워요.",
        "피크엔 줄이 길 수 있으니 **앱 대기·시간 피하기**만 챙기면 실행 난이도가 내려가요.",
      ],
      actions: [
        "오늘 영업·브레이크타임 네이버·카카오맵에서 한번만 확인",
        "예약·웨이팅 앱 있으면 미리 걸어 두기",
        "주차는 ‘코엑스몰 주차장’ 입구 미리 찍어 두기",
      ],
      expertVenuePicks: [
        {
          expertId: 1,
          venueName: "봉피양 압구정본점",
          menuPick: "한우 구이 코스(시그니처 부위 위주)",
          reason: "재료·구이 스펙이 명확하고 ‘강남 프리미엄 한우’ 니즈에 가장 직접적으로 부합",
          locationAdvantage: "압구정 로데오 일대, 발렛·주차 가능 여부는 방문 전 확인 권장",
        },
        {
          expertId: 2,
          venueName: "하이디라오 코엑스몰점",
          menuPick: "훠궈 세트 + 소스 바 활용",
          reason: "코엑스 주차·실내 동선이 익숙하면 이동 부담이 줄고 인원 많을 때 메뉴 조율이 쉬움",
          locationAdvantage: "삼성역·코엑스 지하 연결, 날씨 피해 이동 가능",
        },
        {
          expertId: 3,
          venueName: "육쌈냉면(강남역 인근 매장)",
          menuPick: "육회 + 냉면 조합",
          reason: "1인당 부담과 대기 리스크를 줄이면서도 한식 니즈를 충족",
          locationAdvantage: "강남역 도보권, 대중교통 접근성 우수",
        },
      ],
      finalPick: {
        venueName: "하이디라오 코엑스몰점",
        menuPick: "훠궈(중간 이상 맵기 조절) + 육류·해산 플레이트 분산 주문",
        detailedReason:
          "‘강남 맛집 추천’이 모호할 때, **실내 동선·주차·단체 대응**을 동시에 노리는 경우 가장 균형이 좋습니다. 미식가가 말한 봉피양은 예산·예약 허들이 있고, 가성비 옵션은 기념성이 약합니다. 코엑스 라인은 부모님·친구·회식까지 폭넓게 커버하고, 메뉴 취향 분산이 쉬워 **첫 선택지로 실행 가능성**이 높습니다. 다만 피크 웨이팅은 각오하고, 앱에서 미리 대기 등록을 확인하세요.",
        locationNote:
          "삼성역·봉은사로와 연결된 코엑스몰 주차장을 이용할 계획이면, 주말·저녁 피크 시 만차 가능성을 염두에 두고 10~15분 일찍 도착하는 편이 안전합니다.",
      },
    },
  };
}

/** 카카오 키워드 검색 결과만으로 로컬 폴백 토론 (상호·URL 허구 방지) */
function packFoodFromKakaoPlaces(
  places: KakaoPlaceCandidate[],
  topic: string,
  searchContext?: string,
  followUpChoice?: string,
): Pack {
  const sc = searchContext?.trim();
  const scBlock = sc
    ? `\n\n[웹에서 긁어온 짤막한 정보라서, 영업·메뉴는 꼭 다시 확인해요]\n${clipCtx(sc, 3200)}`
    : "";

  const trios = [
    {
      n: ["강남역 터줏대감 민지", "가성비 헌터 재호", "카카오 후기 스캐너 지은"],
      d: [
        "강남역·삼성 쪽은 제가 밥 먹으러 다닌 지가 12년이에요",
        "웨이팅·1인당·포장까지 따지는 스타일",
        "맵 들어가서 별점·리뷰 키워드·사진 탭부터 훑고 가게 고름",
      ],
    },
    {
      n: ["압구정 골목 지킴이 수연", "줄 서기 싫은 태윤", "맵 리뷰 파는 서준"],
      d: [
        "로데오~청담 사이 골목 동선은 제가 다 알아요",
        "줄·가격·양 봐서 ‘이건 좀 아니다’ 바로 말함",
        "최신 후기에서 반복되는 칭찬·불만 패턴으로만 승부 봄",
      ],
    },
  ][hashPick(topic, 2)]!;

  const n = places.length;
  const p0 = places[0]!;
  const p1 = places[Math.min(1, n - 1)]!;
  const p2 = places[Math.min(2, n - 1)]!;
  const finalIdx = n <= 1 ? 0 : hashPick(topic, n);
  const finalP = places[finalIdx]!;

  const catHint = (p: KakaoPlaceCandidate) =>
    p.categoryName.length > 0 ? p.categoryName : "식당";

  const hint = followUpChoice?.trim();
  const condOpen = hint
    ? `지금 기준은「${hint}」로 잡혀 있어요. 그 전제를 먼저 깔고 `
    : "";
  const condClose = hint
    ? /단체|다인|명\s*이상|\d+\s*명/u.test(hint)
      ? ` ${hint}이면 좌석·웨이팅·예약이 승부거든요. 맵 후기에서 ‘단체’‘대기’ 키워드만이라도 꼭 보고 ${p0.placeName}이 버틸지 확인하세요.`
      : ` 이 조건에 맞는지는 맵 후기·영업 정보로 꼭 재확인하세요.`
    : " 최종 확정 전에 맛·좌석·영업은 맵 후기로 직접 확인하세요.";
  const rebLead = hint
    ? `「${hint}」까지 넣고 보면 한 곳만 밀기 부담스러워요. `
    : "";

  return {
    experts: [
      {
        name: trios.n[0]!,
        description: "강남권 밥집 지형 박박",
        bio: trios.d[0]!,
        iconName: "MapPin",
        color: "cyan",
      },
      {
        name: trios.n[1]!,
        description: "가성비·웨이팅 현실 파악",
        bio: trios.d[1]!,
        iconName: "Search",
        color: "amber",
      },
      {
        name: trios.n[2]!,
        description: "카카오맵 후기·별점 스크리닝",
        bio: trios.d[2]!,
        iconName: "Star",
        color: "rose",
      },
    ],
    deep1: `${condOpen}말할게요. 이번 검색 목록에서 ${p0.placeName}을 먼저 거론하는 건, 카카오에 찍힌 위치가 ${p0.address || "목록에 나온 주소 그대로"}로 분명하고 업종이 ${catHint(p0)}라서 **같은 후보들 안에서 비교·검증의 출발점**으로 쓰기 좋다는 뜻이에요. ‘주소만 보고 무조건 여기’가 아니라, 여기서부터 맵 후기랑 오늘 영업을 대조해 보자는 거죠.${condClose}${scBlock}`,
    rebuttal2: `${rebLead}잠깐, 저는 이번 검색 결과의 ${p1.placeName}이 ${p0.placeName}이랑은 다른 장면을 연다고 봐요. ${p1.address ? `위치는 ${p1.address} 쪽이고 ` : ""}${catHint(p1)}라서 동선·분위기·메뉴 구성이 첫 후보랑 겹치지 않거든요. 목록이 여러 개면 각자 장단이 있으니까 ${p0.placeName}만 고집하긴 아깝죠.`,
    critique3: `두 분 잠깐—저는 카카오맵 후기 기준으로 보면 이번 검색의 ${p2.placeName} 쪽을 같이 놓고 봐야 한다고 봐요. place_url 들어가서 별점이랑 리뷰 키워드, 최근 방문 후기 톤만 훑어도 ${p0.placeName}·${p1.placeName}이랑은 다른 그림이거든요. 숫자는 맵에서 직접 확인하고, 세 군데 다 후기 탭이랑 사진 탭은 꼭 본 다음에 골라요.\n\n이번에 검색에 뜬 곳: ${places.map((p) => p.placeName).join(", ")}`,
    free1: `저는 여전히 이번 목록의 ${p0.placeName} 쪽이에요. 검색에 뜬 정보만으로도 동선이 잡히거든요.`,
    free2: `전화번호 있으면 미리 한 통 하는 것도 방법이에요. 검색 결과에 나온 번호 그대로 쓰면 돼요.`,
    free3: `다 못 고르겠으면 카카오맵 지도로 세 군데 거리만 재 보고 결정해요.`,
    conclusion: `싸우다 보니 결론 났어요! 이번 검색 결과 기준으로는 ${finalP.placeName}부터 가 보는 걸 추천할게요. 가기 전에 카카오맵에서 오늘 영업만 꼭 확인하세요.`,
    consensus: {
      summary: `세 사람이 이번 카카오 키워드 검색에 뜬 실제 업장만 들고 와서 싸우다가 한 곳으로 모였어요.`,
      closingLine: `싸우다 보니 결론 났어요! 이번 검색 결과에서 ${finalP.placeName} 가 보는 걸 추천할게요.`,
      whyThreeLines: [
        `이번 검색 결과에 실제로 나온 상호만 사용해서 헛갈릴 일이 적어요.`,
        `${finalP.placeName}은 카카오에 나온 주소·카테고리 기준으로 동선 잡기 좋아요.`,
        `가기 전 카카오맵에서 영업·주차만 다시 확인하면 실행이 빨라요.`,
      ],
      actions: [
        "카카오맵에서 오늘 영업·브레이크타임 확인",
        "검색 결과에 나온 전화번호가 있으면 예약·웨이팅 문의",
        "지도 앱으로 후보 간 도보·주차 동선 비교",
      ],
      expertVenuePicks: [
        {
          expertId: 1,
          venueName: p0.placeName,
          placeUrl: p0.placeUrl,
          menuPick: `${catHint(p0)} 대표 메뉴(가게마다 다름 — 카카오맵에서 확인)`,
          reason: `이번 검색 결과에서 나온 ${p0.placeName}은 주소·카테고리가 검색과 일치해서 찾아가기 수월한 편이라 추천`,
          locationAdvantage:
            p0.address.length > 0 ? p0.address : "검색 결과 주소 기준",
        },
        {
          expertId: 2,
          venueName: p1.placeName,
          placeUrl: p1.placeUrl,
          menuPick: `${catHint(p1)} 인기 메뉴(카카오맵·리뷰 참고)`,
          reason: `이번 검색 결과에서 나온 ${p1.placeName}은 ${p0.placeName}과 다른 장점이 있어 상황에 따라 더 나을 수 있음`,
          locationAdvantage:
            p1.address.length > 0 ? p1.address : "검색 결과 주소 기준",
        },
        {
          expertId: 3,
          venueName: p2.placeName,
          placeUrl: p2.placeUrl,
          menuPick: `${catHint(p2)} — 맵 후기·사진에서 메뉴·분위기 확인`,
          reason: `카카오맵에서 ${p2.placeName} 후기 패턴(별점·키워드·최신 리뷰)을 기준으로 보면 질문에 맞는지 가장 잘 가려낼 수 있음`,
          locationAdvantage:
            p2.address.length > 0 ? p2.address : "검색 결과 주소 기준",
        },
      ],
      finalPick: {
        venueName: finalP.placeName,
        placeUrl: finalP.placeUrl,
        menuPick: `${catHint(finalP)} — 세부 메뉴는 카카오맵에서 확인`,
        detailedReason: `이번 키워드 검색에 뜬 후보들만 놓고 보면 ${finalP.placeName}이 오늘 질문에 가장 무난하게 맞는 편이라고 봤어요. 검색 결과 주소·카테고리만 믿고 가도 동선이 헷갈리지 않아요.`,
        locationNote:
          finalP.address.length > 0
            ? finalP.address
            : "카카오맵 링크에서 길찾기로 확인하세요.",
      },
    },
  };
}

interface Pack {
  experts: {
    name: string;
    description: string;
    bio: string;
    iconName: string;
    color: ExpertThemeColor;
  }[];
  deep1: string;
  rebuttal2: string;
  critique3: string;
  free1: string;
  free2: string;
  free3: string;
  conclusion: string;
  consensus: ConsensusResult;
}

function packElectronics(topic: string): Pack {
  const trio = [
    {
      n: ["신제품만믿어 박장비", "통신비까먹는 김짠돌", "당근본능 이중고"],
      d: [
        "인생 짧다. 렉 오면 기분이 썩어서 일도 안 된다는 쪽으로 밀어붙임",
        "중고도 비싸다. 결합·알뜰폰·할부 이자까지 다 깎아서 본다",
        "겉만 멀쩡한 폰보다 메인보드·배터리가 더 무섭다고 말하는 타입",
      ],
    },
    {
      n: ["풀옵션만사는 최렉없", "리퍼도아깝다 정통장", "직거래의악마 한당근"],
      d: [
        "새 거 써야 정신이 산다. 구형 들고 다니는 스트레스 못 참음",
        "자급제 vs 통신사, 뭐가 더 남는지 계산기 두드림",
        "페이스타임·카메라 테스트까지 현장에서 돌려보는 편",
      ],
    },
  ][hashPick(topic, 2)]!;
  return {
    experts: [
      {
        name: trio.n[0]!,
        description: "장비병 라인 · 새 거·최신 밀기",
        bio: trio.d[0]!,
        iconName: "Zap",
        color: "fuchsia",
      },
      {
        name: trio.n[1]!,
        description: "짠돌이 재테크 · 결합·알뜰폰",
        bio: trio.d[1]!,
        iconName: "PiggyBank",
        color: "emerald",
      },
      {
        name: trio.n[2]!,
        description: "중고거래 고수 · 당근·직거래",
        bio: trio.d[2]!,
        iconName: "Store",
        color: "violet",
      },
    ],
    deep1: `형들 진짜 답답해서 그래. ${topic} 같은 거 고민할 시간에 그냥 새 거 들고 오는 게 정신건강에 이득이야. 하루 종일 붙어 사는 게 폰이면 기분 좋은 기기 쓰는 게 생산성이지 뭐가 생산성이냐.

아이폰 중고로 살 거면 요즘 분위기상 C타입 때문에라도 15 위로 가는 쪽이 나중에 충전기·보조배터리 맞추기 편하다는 말 많잖아. 14 살 거면 라이트닝 케이블이랑 액세서리 또 따로 굴러다니고. 지금 신형 나오는 타이밍에 한두 세대 전은 값은 떨어져도 배터리는 이미 한판 붙은 거 올 확률 큰 거 알지? 그럴 바엔 내가 볼 땐 예산만 되면 새 거나 최신 쪽으로 가서 스트레스를 줄이라고.`,
    rebuttal2: `아니 박장비님, 그건 좀 아니죠! 새 거가 정답이면 중고나라 접속하는 사람이 왜 그렇게 많겠어. 중고도 요즘 안 싸. 그리고 통신사 결합이나 알뜰폰으로 신규 끊으면 기기값 깎아주는 구조 있는데 그걸 안 보고 무조건 박스 까는 게 맞냐고.

할부 이자 붙이면 체감이 완전 달라져. 무이자 아니면 그거 다 갚을 때까지 정신없음. 배터리 말 나왔으니까 말하는데, 중고로 샀는데 최대용량이 바닥이면 공식 교체에 공임까지 합치면 십만 원 훌쩍 넘게 깨지는 경우 흔해. 그 돈이면 처음부터 한 단계 올려 살 걸 후회하는 글이 펨코에도 매일 올라와. 통장이 빵빵한 게 아니면 "새 거 무조건"은 위험한 말이야.`,
    critique3: `둘 다 진정해. 김짠돌 말도 맞고 박장비 말도 반은 맞아. 중고 살 거면 겉 스크래치보다 메인보드 쪽이랑 침수 흔적, 페이스 아이디·터치 안 되는지 이런 거 먼저 봐. 당근 직거래면 만나서 설정 초기화까지 본인 앞에서 돌리게 하고, 박스만 예쁘다고 속지 마.

아이폰이면 15부터 C타입인 건 팩트니까 중고로 갈 거면 그 줄에서 고르는 게 나중에 덜 빡침. 배터리 효율이 너무 낮으면 교체 비용 감안해서 가격 깎거나 그냥 패스하는 게 상책이야. 정리하면: 돈 여유 있고 매일 죽도록 쓰면 새 거 쪽, 통장이 빡세면 결합·알뜰폰 시뮬 돌려 보고, 중고면 배터리·메인보드 체크는 필수.`,
    free1: `난 그래도 렉 오면 인생 낭비라서 새 거 한 표.`,
    free2: `짠돌이로서 말하면 중고값에 교체 예상비까지 더해서 비교해.`,
    free3: `당근 고수로 한 마디: 직거래는 사람보다 기기 로그가 더 정직함.`,
    conclusion: `싸우다 보니 결론 났어요! 투표는 2대 1로 "산다" 쪽이야—다만 중고면 배터리 효율이랑 메인보드 상태 꼭 보고 사고, 아이폰 중고면 가능하면 C타입인 15 이상 줄을 보라는 조건을 붙이자. 통장이 너무 빡빡하면 알뜰폰·결합으로 신규 시나리오를 한 번 더 돌려 보는 걸로.`,
    consensus: {
      summary: `장비병·짠돌이·중고고수가 싸우다가 2:1로 "사되 조건부"에 모였어요. 중고면 배터리·보드 체크, 아이폰이면 15↑ C타입 호환까지 묶었어요.`,
      closingLine: `2대1로 산다—중고면 배터리 효율 꼭 보고 사라.`,
      whyThreeLines: [
        "장비병: 매일 쓰는 기기는 새 거·최신이 스트레스 덜 함.",
        "짠돌이: 할부 이자·교체 비용까지 넣어야 찐가격이 보임.",
        "중고고수: 직거래는 초기화·페이스ID·배터리 로그가 생명.",
      ],
      actions: [
        "중고면 설정·페이스ID·카메라 돌려보고 배터리 최대용량 확인",
        "아이폰 중고면 C타입(15~) vs 라이트닝(그 이전) 충전 액세서리까지 같이 짜기",
        "통신사 결합·알뜰폰 신규 vs 자급제 중고, 총 나가는 돈 한 줄로만 비교",
        "교체 비용 나올 각오 있으면 그만큼 가격에서 깎거나 그냥 패스",
      ],
    },
  };
}

function packDrink(topic: string): Pack {
  const trio = [
    {
      n: ["내일회사 김각성", "분위기최고 박한잔", "물먼저 이절충"],
      d: [
        "숙취·수면·내일 일정 보면 오늘은 물이 답이라는 쪽",
        "스트레스 풀 한 잔, 인생 뭐 있냐는 쪽",
        "한 잔만·안주 필수·무알콜 대체까지 현실 절충",
      ],
    },
    {
      n: ["간은소중 최금주", "오늘만살 정와인", "타임박스 한시간"],
      d: [
        "약·운전·회사 일정 있으면 그날은 패스 밀어붙임",
        "맛·향·페어링 얘기로 기분 타는 타입",
        "마시면 몇 시까지 집, 물 비율, 안주부터 정하자는 타입",
      ],
    },
  ][hashPick(topic, 2)]!;
  return {
    experts: [
      {
        name: trio.n[0]!,
        description: "내일·건강·일정 우선",
        bio: trio.d[0]!,
        iconName: "Moon",
        color: "slate",
      },
      {
        name: trio.n[1]!,
        description: "기분·분위기·한 잔의 여유",
        bio: trio.d[1]!,
        iconName: "Wine",
        color: "rose",
      },
      {
        name: trio.n[2]!,
        description: "한 잔만·조건·절충",
        bio: trio.d[2]!,
        iconName: "Droplets",
        color: "cyan",
      },
    ],
    deep1: `형 ${topic} 이거 나왔을 때 내가 먼저 말할게. 내일 운전이야? 회사 일찍 나가? 약 먹어? 하나라도 걸리면 오늘 와인은 그냥 미루는 게 이김. 술은 내일의 나한테 떠넘기기 쉬운데 후회는 당일 밤에 바로 와.

와인은 맥주보다 금방 기분 타잖아. '한 잔만'이 입으로만 한 잔이 아닌 것도 알고 있고. 그래도 오늘 정말 아무 일정 없고 집 앞이면 이야기가 다르지.`,
    rebuttal2: `아니 김각성님, 그건 좀 아니죠! 사람이 로봇이야? ${topic} 고민한다는 건 이미 하루가 빡셌다는 뜻인데 무조건 패스면 스트레스만 쌓여. 와인 한 잔이 기분 전환이 되는 날도 있어. 무알콜 맥주나 음료로 대체하는 것도 방법인데, 맛 보고 싶은 날까지 다 금지면 삭막하잖아.

중요한 건 혼자 쳐마시면서 우울해지지 말고, 안주랑 물 챙기고, 끊을 타이밍만 정해두는 거야.`,
    critique3: `둘 다 진정해. 오늘 ${topic} 정리해 줄게. (1) 운전·회의·약 있으면 나도 패스 쪽. (2) 없으면 '한 잔'의 기준을 잔 수가 아니라 시간으로 잡아—예를 들어 한 시간 안에 마무리. (3) 안주 없으면 속부터 망가지니까 치즈라도 사 와. 무알콜 와인으로 분위기만 비슷하게 가는 것도 실전 꿀팁이야.`,
    free1: `난 그래도 내일 일 있으면 물이 답이라고 본다.`,
    free2: `기분이면 무알콜로 분위기만 맞춰도 반은 성공이야.`,
    free3: `한 잔이면 진짜 한 잔—병 뚜껑은 아예 안 열기.`,
    conclusion: `싸우다 보니 결론 났어요! 투표는 2대 1로 "오늘은 패스 또는 한 잔만" 쪽이에요—내일 운전·약·새벽 일정 있으면 무조건 패스, 아니면 한 잔만+안주+물이고 병 따기 전에 끝낼 시각만 정하자는 조건이 붙었어요.`,
    consensus: {
      summary: `건강·기분·절충이 붙었고 2:1로 조건부(패스 우선, 아니면 한 잔만)에 모였어요. 운전·약·일정이 걸리면 와인은 미루는 쪽이었어요.`,
      closingLine: `2대1로 오늘은 패스 아니면 한 잔만—운전·약 있으면 물이 답.`,
      whyThreeLines: [
        "내일 일정·약·운전이 있으면 패스가 손해가 제일 적다는 쪽이 두 표.",
        "스트레스만 쌓이면 무알콜·분위기만 비슷하게 가도 된다는 한 표.",
        "한 잔이면 시간·안주·물까지 정해야 진짜 한 잔이 된다는 게 공통.",
      ],
      actions: [
        "오늘 밤 운전·회의·알람 시간을 한 줄로 적고, 하나라도 빡세면 술은 패스",
        "마실 거면 안주·물 미리 챙기고, 끝낼 시각만 정해두기",
        "무알콜 와인·음료로 분위기만 비슷하게 가는 후보도 적어 두기",
      ],
    },
  };
}

function packCareer(topic: string): Pack {
  const names = [
    ["오커리어", "김런웨이", "박밸런스"],
    ["정그로스", "이세이프", "최대화"],
  ][hashPick(topic, 2)]!;
  return {
    experts: [
      {
        name: names[0]!,
        description: "커리어 전략가 · 성장·시장가치",
        bio: "내가 가진 스킬, 지금 시장에서 통하는지, 레퍼런스는 있는지 묶어서 ‘다음 직장이 나을지’를 따져 봐요.",
        iconName: "Briefcase",
        color: "amber",
      },
      {
        name: names[1]!,
        description: "비상금·돈 걱정 상담",
        bio: "비상금 몇 달인지, 이직 실패했을 때 버틸 수 있는지, 계약서 함정까지 묶어서 ‘최악일 때도 살 수 있나’를 봐요.",
        iconName: "Wallet",
        color: "slate",
      },
      {
        name: names[2]!,
        description: "워크라이프·번아웃 회복",
        bio: "감정 비용, 관계, 회복 탄력성을 포함해 ‘지속 가능한 속도’를 제안합니다.",
        iconName: "Activity",
        color: "rose",
      },
    ],
    deep1: `이번 커리어 선택을 **배우는 속도**로 보면, 핵심은 한 직장에 너무 오래 있으면 ‘똑같은 일’만 하게 되느냐예요. 한 자리에서 1년 반 넘게 “잘하고 있는데 피드백이나 새 일이 안 붙는다”면, 이력서에 쓸 말도 느리게 쌓여요. 여러 회사 설문을 보면, 이직한 쪽이 2년 안에 “나 성장했다”고 느끼는 비율이 **그냥 남아 있던 쪽보다 꽤 높게** 나오는 편이에요.

예를 들어 기획 쪽에서 ‘담당 범위가 넓어지는 이직’을 한 사람들은 1년 뒤에 배포·지표 손댄 횟수 같은 걸 적어 보면 **한때보다 훨씬 두껍게** 쌓인 경우가 많았어요. 반대로 같은 업무만 반복하면 이력서에 쓸 한 줄이 안 늘어요.

그래서 **지금 고민이 배우고 싶다·시장에서 통하는 스킬을 쌓고 싶다**에 가깝다면, 저는 다른 데 알아보라고 말해요. 단, ‘이직이 멋져 보여서’가 아니라 **일이랑 성장이 바뀌려고** 움직이는 거여야 해요.`,
    rebuttal2: `성장 얘기는 듣기 좋은데, **잘된 사람 이야기만 기억하기 쉽다**는 게 함정이에요. TV 나오는 성공담처럼 들리면 이직이 과대 포장돼요. 그 전에 **비상금이 몇 달 버텨 주냐**부터 봐야 해요.

예를 들어 한 달에 250만 원 쓴다 치면 6개월 비상금이면 1,500만 원이죠. 이직 준비·면접·입사 조율까지 보통 몇 달은 잡아야 해요. 그동안 월급이 끊기면 통장이 말해 줘요. 연봉 협상이 안 될 수도 있다고 치면, **평균 연봉이 아니라 “최악일 때 이 정도면 간다” 선**으로 잡는 게 안전해요.

상담해 보면 이직했다가 금방 또 옮기고 싶다는 사람도 꽤 있어요. 회사만 문제가 아니라 **상상했던 것과 달라서**인 경우가 많아요. 현금·건강보험·퇴직금·계약 묶인 거까지 적어 보고, **최악이 와도 한두 달은 살겠다**가 될 때만 움직이라고 주장해요.`,
    critique3: `두 논지 사이에 끼어서 말하면, **번아웃 상태에서 그냥 도망 이직**이면 새 회사 가서도 금방 지쳐요. 한 주에 일이 너무 길게 이어지면 실수하고 감정 소모가 **갑자기 훅 늘어나는 구간**이 있어요(여러 팀 이야기를 합쳐 보면 그렇게 말하는 사람 많아요).

대안은 (1)내부 다른 팀·파트타임으로 한번 바꿔 보기 (2)8주짜리 짧은 프로젝트로 스트레스가 사람 때문인지 일 때문인지 쪼개 보기 (3)멘토 두 사람한테 미리 솔직히 물어보기. **3개월 동안 잠·운동·집중이 조금이라도 돌아온 뒤**에 이직을 논하면, 나중에 “그때 잘했다”고 느끼는 비율이 확 올라가요.

정리하면, **이직은 처방전이 아니라 증상부터 가를 때** 효과가 있어요.`,
    free1: `솔직히 말해, 상사가 문제인지 업무가 문제인지부터 타이핑해 봐. 그 문장이 ‘사람’이면 이직이 답일 때가 많고, ‘일’이면 내부 이동이 먼저야.`,
    free2: `숫자는 냉정하게: 비상금 몇 달이야? 답이 3달 미만이면 ‘언제’가 아니라 ‘어떻게 버틸지’가 먼저야.`,
    free3: `번아웃이면 새 회사 가서도 반복돼. 2주만이라도 운동·수면 고정하고 다시 결정하자는 게 내 한 마디야.`,
    conclusion: `합의 가능한 프레임은 명확합니다. **앞으로 배울 수 있는지·비상금이 버티는지·지금 지친 이유가 뭔지**를 각각 메모 반 장씩 쓰고, 세 장이 다 괜찮다 싶을 때 움직이라고 권해요. 한 장이라도 아니면 **시기만 미루는 것도** 합리적이에요.`,
    consensus: {
      summary: `성장·리스크·번아웃 관점이 충돌했지만, **세 장 메모(성장/돈/에너지) 후 동시 통과 시 실행**이라는 공통 절차에 수렴했습니다.`,
      actions: [
        "이직 시 기대하는 스킬·임팩트를 한 문장으로 정의하기",
        "비상금(월)과 최소 생활비를 적어 ‘몇 달 버틸 수 있는지’ 숫자로 적기",
        "번아웃 요인이 사람·일·구조 중 어디인지 분리해 적기",
        "내부 이동·이직 중 현실적 대안 2가지를 타임라인과 함께 비교하기",
      ],
    },
  };
}

function packRelationship(topic: string): Pack {
  const names = [
    ["한어태치", "김현실", "이대화"],
    ["박애착", "최솔직", "정커뮤"],
  ][hashPick(topic, 2)]!;
  return {
    experts: [
      {
        name: names[0]!,
        description: "관계·애착 심리 상담",
        bio: "애착 패턴·갈등 반복 구조를 근거로 감정의 ‘기능’과 ‘신호’를 분리합니다.",
        iconName: "Heart",
        color: "rose",
      },
      {
        name: names[1]!,
        description: "현실 검증형 관계 코치",
        bio: "생활 리듬·가치관·미래 계획의 충돌을 사례 기반으로 직설적으로 짚습니다.",
        iconName: "AlertTriangle",
        color: "orange",
      },
      {
        name: names[2]!,
        description: "커뮤니케이션 설계",
        bio: "대화 스크립트·경계 설정·피드백 루프를 통해 관계의 ‘운영’을 돕습니다.",
        iconName: "MessageSquare",
        color: "violet",
      },
    ],
    deep1: `이 관계를 보면 핵심은 **한쪽은 너무 쫓아가고 한쪽은 너무 피하는 패턴**이에요. 여러 연구를 보면 그 조합은 같은 일인데도 “거절당한 것 같다” vs “숨 쉴 틈이 없다”처럼 **해석이 크게 어긋나는** 경우가 많아요. 즉 사실보다 **각자 머릿속 규칙**이 감정을 키워요.

사례: ‘연락 빈도’ 싸움에서, 불안한 쪽은 ‘차인 것 같다’로, 피하는 쪽은 ‘숨 막힌다’로 같은 행동을 읽어요. 이때 필요한 건 누가 맞다가 아니라 **시험 삼아 해볼 만한 부탁 한 가지**예요(예: “주 2회, 20분 전화는 가능할까?”).

관계가 나아질 여지가 있는지 볼 때, 상대가 **‘우리가 이렇게 말하는 게 맞나?’ 같은 이야기**를 피하는지도 봐요. 그걸 계속 피하면 고치기 어려운 경우가 많아요.`,
    rebuttal2: `이론은 좋습니다만, 여기엔 ‘현실 조건’을 넣어야 합니다. 거리·돈·애기 계획·정치 성향까지 안 맞으면 감정만으로는 안 풀려요.

여러 설문을 대충 묶어 보면, **정말 중요한 가치 셋이 안 맞는 커플**은 2년 버티는 비율이 맞는 커플보다 꽤 낮게 나오는 편이에요(대략적인 그림이에요). 또 **한쪽만 계속 맞추는 구조**면 6개월 안에 또 터지는 경우가 많아요.

**한쪽만 2달 넘게 힘든데** 그게 안 바뀌면, 기법보다 ‘계속 갈지’를 먼저 정해야 한다고 봐요. 차갑게 들릴 수 있지만 현실이 그래요.`,
    critique3: `두 분 말을 합치면, 저는 **대화 방법을 미리 정해 두자**는 쪽이에요. 감정만으로 밀면 금방 또 같은 싸움이 나요.

대안: (1)3달 동안 주제 하나씩 정해 놓고, 시간 정해서 끝낼 때 요약하기 (2)**일어난 일 말하고 → 기분 말하고 → 뭐가 필요한지 부탁하기** 순서로 말하기 (3)“이제 그만” 같은 중단 신호 미리 합의하기. 이런 식으로 몇 번만 지켜도 싸움 세기가 확 줄었다는 커플 이야기가 많아요.

오늘 밤 감정 토로 대신 **한 가지 요청만** 문장으로 보내는 것부터 시작하라고 권합니다.`,
    free1: `운명 같은 소리 말고, ‘이 사람이랑 3년 뒤에도 같은 문제로 싸울 것 같냐’만 답해 봐.`,
    free2: `사랑도 예산처럼 쓰면 닳아. 한쪽만 채우는 중이면 그건 이미 답이 가까워.`,
    free3: `말로는 다 되는 척하지 말고, 다음 한 주 실험 하나만 합의해. 안 지켜지면 그게 답이야.`,
    conclusion: `세 관점을 한 줄로 묶으면 이거예요. **서로 다른 해석·돈·거리 같은 현실·말하는 방식**을 따로따로 적어 보면, ‘지금 끊을지’와 ‘2주만 시험해 볼지’가 갈려요. 합의된 권고는: **2주 동안 정해진 방식으로 대화 두 번 + 현실 체크** 해 보고 다시 보자는 거예요.`,
    consensus: {
      summary: `애착·현실·대화 설계 관점이 충돌했지만, **2주 실험 후 재평가**라는 검증 절차에 모두 동의했습니다.`,
      actions: [
        "갈등을 촉발하는 사건을 사실/해석/감정으로 분리해 적기",
        "양쪽 가치관 상위 3개를 각각 쓰고 겹치는 항목 표시하기",
        "구조화 대화 1회(안건·시간 제한·요약) 약속하고 실행하기",
        "노력 비대칭이 있다면 8주를 기한으로 중간 점검 일정 잡기",
      ],
    },
  };
}

function packTravel(topic: string): Pack {
  const names = [
    ["최로컬", "김세이프", "정데이터"],
    ["박루트", "이예산", "한플랜"],
  ][hashPick(topic, 2)]!;
  return {
    experts: [
      {
        name: names[0]!,
        description: "여행 큐레이터 · 경험 디자인",
        bio: "동선·시간대·분위기를 설계해 ‘기억에 남는 순간’의 밀도를 높입니다.",
        iconName: "MapPin",
        color: "cyan",
      },
      {
        name: names[1]!,
        description: "안전·예산·리스크 매니저",
        bio: "숙소 취소될 때 손해·날씨·사람 몰리는 시간까지 묶어서 ‘망할 확률’을 줄여요.",
        iconName: "ShieldAlert",
        color: "amber",
      },
      {
        name: names[2]!,
        description: "데이터 기반 플래너",
        bio: "사람 붐비는 시간·비싼 시즌·Plan B 장소를 비교해서 ‘돈 대비 기분’을 따져 봐요.",
        iconName: "BarChart3",
        color: "teal",
      },
    ],
    deep1: `이번 일정을 보면 핵심은 **한 시간 한 시간이 얼마나 기분 좋았는지**예요. 연구 쪽 말로는 ‘쉴 틈을 일부러 비워 둔 일정’이 만족도가 **그냥 빡빡하게만 돌아다닌 일정보다 꽤 높게** 나온대요. 사진 명소만 쫓다가 **언제 쉴지 모르면** 스트레스가 쌓여요.

예: 밤바다·야경은 해 질 무렵 한 시간 반쯤이 제일 기억에 남아요. 숙소에서 나와서 25분 넘게 걸어 다니면 체력이 금방 닳아요.

‘거기 가 볼 만해?’보다 **‘몇 시에 쉬고, 뭘 포기할 각오인지’**를 먼저 정하라고 주장해요.`,
    rebuttal2: `낭만 좋죠. 그런데 막상 현실은 **통장이랑 취소될 때 손해**예요. 성수기 숙소는 취소하면 돈 다 날아가는 경우도 많고, 기차·비행기 늦으면 그날 일정 통째로 날아가요.

2박 3일이면 밥값·현지 이동만 해도 **한 사람당 대략 20만 원 전후**는 잡는 게 안전해요. 이거 빼먹으면 ‘티켓만 싼 여행’ 착각이 생겨요. 밤에 해변·술·낯선 길은 사고 나기 쉬우니까 **밤 이동은 줄이라**고 봐요.

**총예산 상한·취소 규칙·가능하면 밤길 줄이기**가 맞을 때만 가자고 할게요.`,
    critique3: `저는 **날짜만 하루 옮겨도** 체감이 달라진다는 쪽이에요. 같은 동네라도 주말 점심이랑 평일 아침이면 줄 서는 시간이 완전 달라요. 명소 하나에 날짜가 박혀 있으면 **하루만 앞뒤로 미루도** 기다리는 시간이 꽤 줄어드는 경우가 많아요.

대안: (1)평일 쪽으로 하루 이틀 밀기 (2)비슷한 느낌 나는 근처 다른 데 (3)**당일 다녀오기 vs 하룻밤 자고 오기** 총비용 비교. ‘꼭 이번 주말이어야 하나?’만 한번 물어보라고요.`,
    free1: `솔직히, 인스타용이면 인정해. 그럼 각오가 달라지고 일정도 짧아져도 돼.`,
    free2: `예산 총액부터 말해. 총액 없는 여행은 항상 싸움으로 끝나.`,
    free3: `사람 한가한 시간에 가면 만족도가 확 올라가는 편이야. 붐비는 시간만 피해도 절반은 이긴 거야.`,
    conclusion: `세 사람의 합의는 ‘경험의 밀도’를 위해 **시간창·예산 총액·대체 일정**을 한 페이지에 적고 결정하자는 것입니다. 어떤 코스든 예외는 없습니다.`,
    consensus: {
      summary: `경험·안전·데이터 관점이 만났고, **총예산·취소 조건·혼잡 회피**를 포함한 1페이지 체크로 결정하자는 데 수렴했습니다.`,
      actions: [
        "총예산(교통+숙소+식비+비상금)을 한 숫자로 정하기",
        "핵심 체험 시간대 90분을 캘린더에 먼저 고정하기",
        "취소·환불 규정을 숙소·교통 각각 확인해 표로 남기기",
        "±1일 또는 대체 코스 1개를 적어 ‘플랜 B’ 만들기",
      ],
    },
  };
}

function packMoney(topic: string): Pack {
  const names = [
    ["강그로스", "윤디펜스", "서올웨더"],
    ["한알파", "박현금", "최분산"],
  ][hashPick(topic, 2)]!;
  return {
    experts: [
      {
        name: names[0]!,
        description: "장기 투자 · ‘오래 두면’ 쪽",
        bio: "오래 두면 불어난다는 말을 근거로 하되, **얼마나 떨어져도 잠은 잘 자는지**부터 전제로 해요.",
        iconName: "TrendingUp",
        color: "lime",
      },
      {
        name: names[1]!,
        description: "방어·현금흐름·부채 우선",
        bio: "당장 쓸 돈·보험·빚부터 정리한 뒤에야 투자 얘기를 해요.",
        iconName: "PiggyBank",
        color: "emerald",
      },
      {
        name: names[2]!,
        description: "여러 데 나누기·충동 줄이기",
        bio: "한 바구니에 다 안 담기, 가끔 비율 맞추기, 충동 매매 전 하루 자기 같은 루틴으로 **실수 줄이기**를 봐요.",
        iconName: "Scale",
        color: "violet",
      },
    ],
    deep1: `장기적으로 보면, 통장에만 두면 **물가 오르는 속도를 못 따라가서 살 수 있는 게 줄어드는** 느낌이 드는 경우가 많아요. 과거만 보고 무조건 따라 하라는 건 아니지만, **10년 넘게** 보면 주식·채권을 조금씩 섞어 둔 쪽이 나중에 덜 망한 사례가 반복돼 왔어요.

예: 매달 50만 원씩 20년 넣는다 치면, 이자가 0%일 때랑 연 5%일 때랑 **겉으로 보이는 합계 차이가 엄청나게** 벌어져요(물론 중간에 주가 떨어질 때 버틸 마음이 있어야 해요).

빚 금리가 투자로 벌겠다는 수준보다 높지 않고, 비상금이 먼저 있으면 **너무 늦게 시작하는 것도 손해**라고 주장해요.`,
    rebuttal2: `‘평균적으로는 잘됐다’는 말은 **남 얘기**예요. 당장 써야 할 돈이 먼저예요. 생활비 6개월치가 통장에 없는데 주식을 늘리면, 떨어졌을 때 팔아서 밥 사 먹는 꼴이 돼요.

신용카드 빚 연 15~20% 붙어 있는데 **투자로 이기겠다**는 건 숫자로만 보면 거의 불가능에 가깝다고 봐요. 은행 예금 이자보다 훨씬 비싼 돈을 빌려 쓰는 거니까요.

비상금·금리 센 빚부터 갚기·꼭 필요한 보험 정리 끝낸 다음에만 **조금 더 공격적으로** 가져가라고 봐요.`,
    critique3: `저는 **손이 너무 가는지**를 봐요. 정보 많이 볼수록 사고팔고 싶어지고, 수수료·세금·타이밍 놓치는 게 쌓여요. 딱 맞는 비율보다 **10년 지킬 수 있는 규칙 하나**가 이기는 경우가 많아요.

대안: (1)매달 자동이체 + 분기에 한 번 비율만 맞추기 (2)여러 종목 대신 **한 가지 넓게 퍼진 상품**이라도 원칙만 고정 (3)사기 전에 하루 자고 다시 읽기. 연간 수수료 1~2%만 줄여도 오래 보면 차이가 커요.`,
    free1: `욕심내기 전에, 부채 금리부터 써 봐. 그 숫자가 투자 기대보다 크면 답이 나와.`,
    free2: `평균 수익은 네 통장이랑 상관없어. 떨어졌을 때 버틸 수 있는지가 진짜 네 전략이야.`,
    free3: `완벽한 비율보다 10년 지속이 이김. 규칙 하나만 정해.`,
    conclusion: `합의: **비상금→고금리 부채→규칙 기반 투자** 순서를 문서 한 장으로 고정하고 실행하자는 것입니다.`,
    consensus: {
      summary: `성장·방어·행동재무가 충돌했지만, **실행 순서(비상금·부채·규칙)**를 합의로 확정했습니다.`,
      actions: [
        "비상금 목표(월)를 숫자로 정하고 통장 분리하기",
        "금리 높은 부채부터 상환 시뮬레이션하기",
        "투자는 자동이체·단순 상품·분기마다 비율 맞추기 중 2가지 이상 선택하기",
        "매매 전 하루 뒤 다시 읽는 습관을 적어 두기",
      ],
    },
  };
}

function packGeneric(topic: string): Pack {
  const names = [
    ["라희망", "문현실", "서원칙"],
    ["이기회", "김보수", "정시스템"],
  ][hashPick(topic, 2)]!;
  return {
    experts: [
      {
        name: names[0]!,
        description: "기회·실행 · 낙관적 전략가",
        bio: "행동이 정보를 만든다는 신념으로, 작은 실험과 확장을 선호합니다.",
        iconName: "Zap",
        color: "amber",
      },
      {
        name: names[1]!,
        description: "리스크·현실 검증가",
        bio: "돈·망할 확률·번아웃을 사례랑 같이 묶어서 보수적으로 짚어요.",
        iconName: "Ban",
        color: "slate",
      },
      {
        name: names[2]!,
        description: "시스템 사고 · 프로세스 설계",
        bio: "매번 같은 순서로 체크하는 루틴·대안 길을 짜서 **나중에도 같은 기준**으로 고르게 도와요.",
        iconName: "Brain",
        color: "fuchsia",
      },
    ],
    deep1: `이번 고민에 대해 저는 **일단 작게 해 보고 거기서 배우자**는 쪽이에요. 많은 결정은 미리 다 알고 시작하는 게 아니라, 해본 뒤에야 뭐가 맞는지 선명해져요. 처음엔 잘 모를수록 **작은 시도 한 번**이 도움이 되는 경우가 많아요.

사례: 회사에서도 ‘기획서 완벽하게’보다 **2주만 돌려 보고 고치기**가 나은 경우가 많다고들 해요. 실험에 드는 돈이 망했을 때 손해의 5~15% 정도면, 숫자로는 **남는 장사**인 경우가 많다는 말도 있어요.

너무 안 움직이면 나중에 ‘그때 해볼걸’만 커져요. 특히 후회를 잘 하는 사람일수록 **아주 작게라도 시작**하는 게 마음이 편해요.`,
    rebuttal2: `실험이 만능은 아니에요. **되돌리기 힘든 일**(사람 사이, 건강, 법, 큰 돈)이면 작은 시도가 나중에 회복비가 엄청 나올 수 있어요.

여러 설문을 보면, 충동적으로 결정한 뒤 **두 달 안에 후회**한다는 사람이 꽤 많다고 해요. 최악의 경우에도 밥은 먹고 잘 수 있을 때만 실험하라고 권해요.

하기 전에 (1)돈이랑 시간이 얼마 바뀌는지 (2)어디까지면 그만둘지 (3)망했을 때 어떻게 돌아올지. 이 셋이 없으면 성급해지기 쉬워요.`,
    critique3: `저는 프로세스로 중재합니다. 좋은 결정은 영리함이 아니라 **반복 가능한 체크리스트**에서 나옵니다.

대안: (1) 결정 일지(옵션 3개·점수표·가중치) (2) 하룻밤 유예 후 재확인 (3) 믿을 만한 사람 1인에게 요약만 들려주기. 이렇게 하면 감정이 올랐을 때의 선택과 차분할 때의 선택을 분리할 수 있습니다.

체크리스트만 써도 **급하게 결정한 뒤 만족도**가 꽤 올라간다는 이야기가 많아요.`,
    free1: `지금 당장 해야 하는 이유 한 줄. 없으면 실험은 다음 주로.`,
    free2: `최악이 와도 자는데 문제없는지. 아니면 규모 줄여.`,
    free3: `표 하나만 그려. 가중치 합이 말해 줄 거야.`,
    conclusion: `세 관점의 합의: **작게 시험해 볼 것**과 **멈출 기준·하룻밤 유예**를 한 세트로 묶을 때만 성급함을 줄일 수 있습니다.`,
    consensus: {
      summary: `기회·보수·프로세스가 충돌했지만, **작은 시험 + 멈출 기준 + 하룻밤 유예** 절차에 합의했습니다.`,
      actions: [
        "선택지 3개를 쓰고 각각 드는 비용·기대 이익을 한 줄씩 적기",
        "하룻밤 자고 나서 같은 표를 다시 읽어 보기",
        "시험으로 해볼 때 시간·돈 규모를 구체 숫자로 정하기",
        "그만둘 때 신호를 미리 한 문장으로 적어 두기",
      ],
    },
  };
}

function getPack(
  category: Category,
  topic: string,
  searchContext?: string,
): Pack {
  switch (category) {
    case "food_place":
      return packFoodPlace(topic, searchContext);
    case "electronics":
      return packElectronics(topic);
    case "drink":
      return packDrink(topic);
    case "career":
      return packCareer(topic);
    case "relationship":
      return packRelationship(topic);
    case "travel":
      return packTravel(topic);
    case "money":
      return packMoney(topic);
    default:
      return packGeneric(topic);
  }
}

function clipMoodFromDescription(desc: string, maxLen: number): string | undefined {
  const d = desc.replace(/\s+/g, " ").trim();
  if (d.length < 3) return undefined;
  if (d.length <= maxLen) return d;
  return `${d.slice(0, maxLen - 1)}…`;
}

/** 로컬 팩: 절차 첫줄 건너뛴 뒤, 첫 **한 구**만 결론형으로 짧게 */
function headlineFromLocalBody(body: string): string {
  const lines = body.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const skip =
    /^(아,\s*진작|잠깐,?\s*그|두\s*분\s*다|두\s*분|정리해|싸우다\s*보니\s*결론)/;
  const pick =
    lines.find((l) => !skip.test(l) && l.length > 6) ??
    lines.find((l) => !skip.test(l)) ??
    lines[0] ??
    "";
  let one = pick.replace(/\s+/g, " ").trim();
  if (!one) return "발언 요약";

  const comma = one.indexOf(",");
  const dot = one.search(/[.!?。]/);
  if (comma >= 10 && (dot < 0 || comma < dot)) {
    one = one.slice(0, comma).trim();
  } else if (dot >= 10) {
    one = one.slice(0, dot + 1).trim();
  }

  return clampOpinionSummaryForDisplay(one, OPINION_SUMMARY_DISPLAY_MAX);
}

function buildTurns(
  pack: Pack,
  opts?: { secondRoundChoice?: string },
): DebateTurn[] {
  const e0 = pack.experts[0]!.name;
  const e1 = pack.experts[1]!.name;
  const e2 = pack.experts[2]!.name;
  const hint = opts?.secondRoundChoice?.trim();
  const reactPrefix = hint
    ? `아, 진작 말씀하지! 그렇다면 얘기가 다르죠. (${hint})\n\n`
    : "";
  const mergedSynthesis = [
    `두 분 다 진정하시고요—${e2}인데요, 제 생각은 이래요.`,
    pack.critique3,
    pack.free1,
    pack.free2,
    pack.free3,
  ].join("\n\n");

  const finalBody = pack.conclusion.includes("싸우다 보니")
    ? pack.conclusion
    : `싸우다 보니 결론 났어요! 여기로 가면 돼요.\n\n${pack.conclusion}`;

  const openBody = reactPrefix + pack.deep1;
  const rebBody = hint
    ? `잠깐, 그 정보 있었으면 처음부터 다르게 말했을 텐데! 아니 ${e0}님, 그래도 이건 좀 아니죠! ${pack.rebuttal2}`
    : `아니 ${e0}님, 그건 좀 아니죠! ${pack.rebuttal2}`;

  return [
    {
      expertIndex: 0,
      phase: "opening",
      moodChip: clipMoodFromDescription(pack.experts[0]!.description, 22),
      headline: headlineFromLocalBody(openBody),
      body: openBody,
    },
    {
      expertIndex: 1,
      phase: "rebuttal",
      moodChip: clipMoodFromDescription(pack.experts[1]!.description, 22),
      headline: headlineFromLocalBody(rebBody),
      body: rebBody,
    },
    {
      expertIndex: 2,
      phase: "synthesis",
      moodChip: clipMoodFromDescription(pack.experts[2]!.description, 22),
      headline: headlineFromLocalBody(mergedSynthesis),
      body: mergedSynthesis,
    },
    {
      expertIndex: -1,
      phase: "final_summary",
      moodChip: "표 집계하고 갈게요",
      headline: headlineFromLocalBody(finalBody),
      body: finalBody,
    },
  ];
}

export function enrichConsensusResult(base: ConsensusResult): ConsensusResult {
  return {
    ...base,
    closingLine:
      base.closingLine ??
      (base.summary.length > 100
        ? `${base.summary.slice(0, 90)}…`
        : base.summary),
    whyThreeLines:
      base.whyThreeLines && base.whyThreeLines.length > 0
        ? base.whyThreeLines
        : base.actions.slice(0, 3),
  };
}

export function buildLocalDebate(
  rawTopic: string,
  options?: {
    searchContext?: string;
    kakaoPlaces?: KakaoPlaceCandidate[];
    followUpChoice?: string;
  },
): DebatePayload {
  const topic = escapeTopic(rawTopic);
  const category = detectCategory(rawTopic);
  const kakao = options?.kakaoPlaces ?? [];
  const pack =
    category === "food_place" && kakao.length > 0
      ? packFoodFromKakaoPlaces(
          kakao,
          topic,
          options?.searchContext,
          options?.followUpChoice,
        )
      : getPack(category, topic, options?.searchContext);

  const experts: ExpertProfile[] = pack.experts.map((e, i) => ({
    id: i + 1,
    name: e.name,
    description: e.description,
    bio: e.bio,
    iconName: e.iconName,
    color: e.color,
  }));

  const second = Boolean(options?.followUpChoice?.trim());
  const followUpQuestions = defaultFollowUpQuestionsForTopic(rawTopic, second);

  const base = sanitizeDebatePayload({
    topic,
    experts,
    turns: buildTurns(pack, {
      secondRoundChoice: options?.followUpChoice?.trim(),
    }),
    consensus: enrichConsensusResult(pack.consensus),
    followUpQuestions,
  });
  return withKakaoPlaces(base, options?.kakaoPlaces ?? []);
}
