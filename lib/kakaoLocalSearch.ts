/**
 * Kakao Local API — Keyword Search
 * https://developers.kakao.com/docs/latest/ko/local/dev-guide#search-by-keyword
 *
 * 환경 변수: KAKAO_CLIENT_ID 또는 KAKAO_REST_API_KEY (REST API 키)
 */

import type { DebatePayload, KakaoPlaceCandidate } from "./debateTypes";

export type { KakaoPlaceCandidate };

/** .env 에 붙은 BOM·따옴표·앞뒤 공백 때문에 401 나는 경우 방지 */
export function normalizeKakaoRestApiKey(
  raw: string | undefined | null,
): string {
  if (raw == null) return "";
  let s = String(raw);
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  s = s.trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s.replace(/\s+/g, "");
}

/** 카카오 키워드 검색 결과가 없을 때 API가 돌려주는 사용자 메시지 */
export const KAKAO_EMPTY_SEARCH_USER_MESSAGE =
  "해당 지역의 검색 결과를 가져오지 못했습니다. 키워드를 바꿔보세요";

function normalizePlaceUrl(url: string, placeId: string): string {
  const u = url.trim();
  if (u.startsWith("http://")) return `https://${u.slice(7)}`;
  if (u.length > 0) return u;
  const id = placeId.trim();
  if (id.length > 0) return `https://place.map.kakao.com/${id}`;
  return "";
}

/** 사용자 질문을 카카오 키워드 검색어로 정리 */
export function buildKakaoKeywordQuery(topic: string): string {
  let q = topic
    .trim()
    .replace(/[?!？!]/g, " ")
    .replace(/\s+/g, " ")
    /* 카카오 키워드 검색은 짧은 명사구에 가깝게 나와야 함 — 대화체가 섞이면 0건이 잦음 */
    .replace(
      /\s*(어디가\s*좋을까|어디\s*갈까|어디가\s*나을까|뭐가\s*좋을까|어디\s*잘\s*갈까|어디\s*좋을까|어디\s*괜찮을까|어떤\s*데가\s*좋을까|어디\s*가볼까)\s*/gi,
      " ",
    )
    .replace(
      /\s*(추천해줘|추천해\s*주세요|추천좀|추천\s*해줘|추천\s*해\s*주세요|알려줘|알려\s*주세요|좀\s*알려|해줘|해\s*주세요|부탁해|부탁해요)\s*$/gi,
      "",
    )
    .replace(/\s+추천\s*$/gi, "")
    .replace(/\s+(좀|plz)\s*$/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!q) return topic.trim().slice(0, 100);
  if (
    !/(맛집|식당|밥|먹|카페|술|고깃|브런치|디저트|레스토랑|술집|밥집|뷔페|한식|중식|일식|양식)/i.test(
      q,
    )
  ) {
    q = `${q} 맛집`;
  }
  return q.slice(0, 100);
}

/** 질의에 맞춰 중심 좌표(경도 x, 위도 y)를 넣으면 키워드 검색이 지역에 더 잘 붙음 */
function applyRegionalCenter(url: URL, query: string): void {
  const s = query.toLowerCase();
  const hints: { test: RegExp; x: string; y: string }[] = [
    {
      test:
        /강남|역삼|논현|신논현|압구정|청담|신사|도산|삼성\s*역|선릉|코엑스|봉은사|강남구/,
      x: "127.027621",
      y: "37.498085",
    },
    { test: /홍대|합정|망원|상수|연남|서교/, x: "126.923783", y: "37.556542" },
    { test: /성수|뚝섬|성동/, x: "127.048986", y: "37.544577" },
    { test: /이태원|한남|용산/, x: "126.994183", y: "37.534518" },
    { test: /건대|광진|자양/, x: "127.068825", y: "37.540372" },
    { test: /신촌|연세|이대|서대문/, x: "126.936773", y: "37.559827" },
    { test: /을지로|종로|명동|광화문|중구/, x: "126.983437", y: "37.565567" },
    { test: /잠실|송파|문정|방이/, x: "127.100652", y: "37.513269" },
    { test: /여의도|영등포|당산/, x: "126.924321", y: "37.521624" },
    { test: /판교|분당|성남/, x: "127.108625", y: "37.394727" },
    { test: /해운대|광안|부산\s*역|서면/, x: "129.160384", y: "35.158698" },
    { test: /제주|연동|노형/, x: "126.531188", y: "33.499621" },
  ];
  for (const { test, x, y } of hints) {
    if (test.test(s)) {
      url.searchParams.set("x", x);
      url.searchParams.set("y", y);
      url.searchParams.set("radius", "20000");
      return;
    }
  }
}

function formatPlaceLine(p: KakaoPlaceCandidate, index: number): string {
  const parts = [
    `${index + 1}. ${p.placeName}`,
    p.categoryName ? `카테고리: ${p.categoryName}` : "",
    p.address ? `주소: ${p.address}` : "",
    p.phone ? `전화: ${p.phone}` : "",
    p.placeUrl ? `place_url(링크 그대로 사용): ${p.placeUrl}` : "",
  ].filter(Boolean);
  return parts.join("\n   ");
}

/** LLM user 메시지에 넣을 블록 */
export function formatKakaoPlacesForPrompt(places: KakaoPlaceCandidate[]): string {
  if (places.length === 0) return "";
  const lines = places.map((p, i) => formatPlaceLine(p, i));
  return `[카카오맵 키워드 검색 결과 — 여기 나온 상호만 실제 업장으로 쓸 수 있음]
규칙: 목록에 없는 상호·가상 업장은 절대 쓰지 마. 상호는 아래 문자열과 글자 하나까지 동일. 웹·기억으로 다른 가게를 만들지 마.

토론 품질(필수): 목록을 번호 매겨 읊거나 주소·카테고리·전화만 한 줄씩 읽지 마. **진짜 토론**처럼 각 패널이 자기 축으로 **뚜렷한 주장**을 한다. expertId 3번 패널은 **카카오맵 장소 페이지(각 항목의 place_url) 후기 탭**을 본다는 입장으로 말한다 — 별점·리뷰 키워드·최신 방문 평·사진을 어떻게 보면 자기 편 가게가 낫다고 말할지. 이 블록에 별점 숫자·실제 리뷰 인용이 없으므로 **구체 점수·가짜 후기 문장 금지**; "맵에서 직접 확인" + 스크리닝 기준 논리만.
- opening: 질문 맥락에서 왜 자기가 든 그 한 곳이 유리한지, 상대 후보보다 나은 점·감수할 트레이드오프를 구체적으로.
- rebuttal: 1번 주장의 논점을 짚어 **비용·시간·불편·리스크** 등으로 반박. 다른 상호만 꺼내는 수준으로 끝내지 말 것.
- synthesis: 양쪽 장단을 정리하고 예산·인원·시간 같은 **실무 조건**으로 절충·조건부 추천.
출처 표시는 가끔 "검색에 뜬 ○○○" 정도면 충분하고, 매 문장마다 같은 꼴로 반복하지 마.

${lines.join("\n\n")}`;
}

/** 상호 문자열로 카카오 후보와 매칭해 placeUrl 보강 */
export function resolvePlaceUrl(
  venueName: string,
  places: KakaoPlaceCandidate[],
): string | undefined {
  const v = venueName.trim();
  if (!v) return undefined;
  for (const p of places) {
    if (!p.placeUrl) continue;
    if (p.placeName === v) return p.placeUrl;
  }
  for (const p of places) {
    if (!p.placeUrl) continue;
    if (v.includes(p.placeName) || p.placeName.includes(v)) return p.placeUrl;
  }
  return undefined;
}

/** 합의의 상호에 검색 결과 URL을 붙임 (LLM이 place_url을 빠뜨려도 UI는 동작) */
export function attachKakaoUrlsToFoodConsensus(
  payload: DebatePayload,
  places: KakaoPlaceCandidate[],
): DebatePayload {
  if (!places.length) return payload;
  const c = payload.consensus;
  const expertVenuePicks = c.expertVenuePicks?.map((pick) => {
    const url = pick.placeUrl?.trim() || resolvePlaceUrl(pick.venueName, places);
    return url ? { ...pick, placeUrl: url } : pick;
  });
  let finalPick = c.finalPick;
  if (finalPick) {
    const url =
      finalPick.placeUrl?.trim() ||
      resolvePlaceUrl(finalPick.venueName, places);
    finalPick = url ? { ...finalPick, placeUrl: url } : { ...finalPick };
  }
  return {
    ...payload,
    consensus: {
      ...c,
      expertVenuePicks,
      finalPick,
    },
  };
}

export class KakaoLocalSearchError extends Error {
  readonly status: number;
  readonly bodySnippet: string;

  constructor(status: number, message: string, bodySnippet = "") {
    super(message);
    this.name = "KakaoLocalSearchError";
    this.status = status;
    this.bodySnippet = bodySnippet;
  }
}

export async function searchKakaoKeywordPlaces(
  keyword: string,
  restApiKey: string,
  opts?: { size?: number },
): Promise<KakaoPlaceCandidate[]> {
  const q = keyword.trim().slice(0, 100);
  const key = normalizeKakaoRestApiKey(restApiKey);
  if (!q || !key) return [];

  const size = Math.min(15, Math.max(1, opts?.size ?? 5));
  const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
  url.searchParams.set("query", q);
  url.searchParams.set("size", String(size));
  applyRegionalCenter(url, q);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `KakaoAK ${key}`,
    },
    cache: "no-store",
  });

  const rawText = await res.text();
  if (!res.ok) {
    throw new KakaoLocalSearchError(
      res.status,
      `Kakao Local API HTTP ${res.status}`,
      rawText.slice(0, 280),
    );
  }

  let data: {
    documents?: Array<{
      id?: string | number;
      place_name?: string;
      road_address_name?: string;
      address_name?: string;
      category_name?: string;
      phone?: string;
      place_url?: string | null;
    }>;
  };
  try {
    data = JSON.parse(rawText) as typeof data;
  } catch {
    throw new KakaoLocalSearchError(
      res.status,
      "Kakao 응답 JSON 파싱 실패",
      rawText.slice(0, 200),
    );
  }

  const docs = data.documents ?? [];
  return docs
    .map((d) => {
      const placeName = String(d.place_name ?? "").trim();
      const idRaw =
        d.id === undefined || d.id === null ? "" : String(d.id).trim();
      const urlRaw =
        d.place_url === undefined || d.place_url === null
          ? ""
          : String(d.place_url).trim();
      const placeUrl = normalizePlaceUrl(urlRaw, idRaw);
      return {
        id: idRaw || placeName,
        placeName,
        address: String(d.road_address_name || d.address_name || "").trim(),
        categoryName: String(d.category_name ?? "").trim(),
        phone: String(d.phone ?? "").trim(),
        placeUrl,
      };
    })
    .filter((p) => p.placeName.length > 0 && p.placeUrl.length > 0);
}
