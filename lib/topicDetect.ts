/**
 * 질문에「맛집」이 있을 때만 카카오 로컬 API + 맛집 전용 토론 파이프라인을 탄다.
 * (지역+추천만 있는 질문은 카카오를 부르지 않아 키 오류·Load failed 를 막음)
 */
export function isMatjipKakaoTopic(raw: string): boolean {
  return /맛집/.test(raw);
}

/** 와인·술 한 잔 할까 말까 같은 음주 의사결정 (쇼핑 톤·가짜 실험 멘트와 분리) */
export function isDrinkDecisionTopic(raw: string): boolean {
  const s = raw.toLowerCase();
  return /와인|맥주|소주|막걸리|양주|칵테일|하이볼|위스키|샴페인|술\s*마실|술\s*먹|한\s*잔|한잔|금주|음주|술\s*끊|취할\s*까|마실\s*까\s*말까|마실까\s*말까|술\s*줄일|금요일\s*술/.test(
    s,
  );
}

/** 스마트폰·PC·태블릿 등 기기 구매·중고 토론용 */
export function isElectronicsTopic(raw: string): boolean {
  const s = raw.toLowerCase();
  return /맥북|맥\s*북|아이패드|아이폰|아이\s*폰|갤럭시|갤\s*럭시|노트북|스마트폰|폰\s*살|폰\s*바꿔|기기\s*살|중고\s*폰|중고폰|애플워치|워치|에어팟|버즈|gpu|ram|ssd|m\d+\s*칩|c타입|usb-c|배터리\s*효율|배터리\s*성능|리퍼|자급제|통신사\s*결합|알뜰폰/.test(
    s,
  );
}

/** 여행·숙박 맥락 + 예산·경비 질문 — 패널을 가성비 / 경험·지금 / 뉴스·물가 축으로 고정 */
export function isTravelBudgetTopic(raw: string): boolean {
  const s = raw.toLowerCase();
  const travel =
    /제주|국내\s*여행|해외|여행|여행지|항공|숙소|호텔|풀빌라|2박\s*3일|몇\s*박|관광|렌터카|렌트카|비행기|기차\s*표|패키지|휴가/.test(
      s,
    );
  const money =
    /예산|경비|얼마|만\s*원|만원|\d+\s*만|충분|부족|빡빡|알차|가성비|비용|총액|돈|들\s*까|괜찮|넉넉|아깝|싸게|비싸/.test(
      s,
    );
  return travel && money;
}
