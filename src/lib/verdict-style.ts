// ============================================
// AI 평결 시각 스타일 — 전 화면 통일 (온보딩·내종목·홈 히어로 공용)
//   · VERDICT_STYLE: 내 종목 진단 평결(개인화 — 평단가 대입). hold|buy_more|reduce|cut
//   · STOCK_VERDICT_STYLE: 종목 단위 합의(평단가 무관, symbol_consensus_daily). buy|hold|sell
//   '참고용 AI 분석' 프레이밍 — 라벨은 단정 지시가 아닌 참고 의견.
// ============================================

export type DiagnosisVerdict = "hold" | "buy_more" | "reduce" | "cut";

export const VERDICT_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  buy_more: { label: "추가매수 고려", color: "#00E676", bg: "rgba(0,230,118,0.1)" },
  hold: { label: "보유 유지", color: "#448AFF", bg: "rgba(68,138,255,0.1)" },
  reduce: { label: "비중 축소", color: "#F5B800", bg: "rgba(245,184,0,0.1)" },
  cut: { label: "손절 검토", color: "#FF5252", bg: "rgba(255,82,82,0.1)" },
};

export type StockVerdict = "buy" | "hold" | "sell";

export const STOCK_VERDICT_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  buy: { label: "매수 우위", color: "#00E676", bg: "rgba(0,230,118,0.1)" },
  hold: { label: "중립", color: "#448AFF", bg: "rgba(68,138,255,0.1)" },
  sell: { label: "매도 우위", color: "#FF5252", bg: "rgba(255,82,82,0.1)" },
};
