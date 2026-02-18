// ============================================
// 구독 등급별 접근 제어 시스템
// ============================================

import type { Signal } from "@/types";

// ============================================
// PDF 기준 — moneysignal_tier_comparison.pdf
// ============================================
export const TIER_PRICES = {
  free: 0,
  basic: 29900,
  pro: 59900,
  premium: 99900,
  bundle: 149900,
} as const;

export const TIER_CONFIG = {
  free: {
    // 시그널 접근
    delayMinutes: Infinity,         // 시그널 딜레이 없음 (접근 불가)
    categories: [] as string[],     // 카테고리 블러 처리
    dailyLimit: 0,                  // 0개/일
    tpLevels: 0,                    // TP 없음
    showLeverage: false as const,   // 레버리지 없음
    showAiReasoning: false,
    aiReasoningDetail: "none" as const, // AI 분석 없음
    showCompletedResults: true,     // 완료 시그널 결과 공개 ✓
    // 분석 & 리포트
    backtestPeriodDays: 7,          // 최근 7일
    dashboardLevel: "none" as const,
    weeklyReport: false,
    dailyBriefing: false,
    monthlyReport: false,
    csvExport: false,
    // AI 종목 질문
    aiAskLimit: 3,                  // 무료 체험 3회 (맛보기)
    aiAskHistory: false,
    // 알림
    pushNotification: false,
    telegramEnabled: false,
    kakaoNotification: false,
    tpAlertLevels: 0,
    slAlert: false,
    cancelExpireAlert: false,
    // VIP
    vipChannel: false,
    premiumChat: false,
    partnerConsulting: 0,           // 1:1 상담 횟수
  },
  basic: {
    delayMinutes: 30,               // 30분 지연
    categories: ["coin_spot"],      // 코인 현물
    dailyLimit: 3,                  // 3개/일
    tpLevels: 1,                    // TP1만
    showLeverage: false as const,
    showAiReasoning: true,
    aiReasoningDetail: "summary" as const, // 요약 (100자)
    showCompletedResults: true,
    backtestPeriodDays: 30,         // 최근 30일
    dashboardLevel: "basic" as const, // 기본 (숫자)
    weeklyReport: false,
    dailyBriefing: false,
    monthlyReport: false,
    csvExport: false,
    aiAskLimit: 0,
    aiAskHistory: false,
    pushNotification: true,         // 앱 푸시 ✓
    telegramEnabled: false,
    kakaoNotification: false,
    tpAlertLevels: 1,              // TP1만 알림
    slAlert: false,
    cancelExpireAlert: false,
    vipChannel: false,
    premiumChat: false,
    partnerConsulting: 0,
  },
  pro: {
    delayMinutes: 10,               // 10분 지연
    categories: ["coin_spot", "coin_futures"], // 현물+선물
    dailyLimit: 10,                 // 10개/일
    tpLevels: 2,                    // TP1~TP2
    showLeverage: "conservative" as const, // 보수적만
    showAiReasoning: true,
    aiReasoningDetail: "detailed" as const, // 상세 분석
    showCompletedResults: true,
    backtestPeriodDays: 180,        // 최근 180일
    dashboardLevel: "detailed" as const, // 상세 (차트)
    weeklyReport: true,             // 주간 리포트 ✓
    dailyBriefing: false,
    monthlyReport: false,
    csvExport: false,
    aiAskLimit: 3,                  // 3회/일
    aiAskHistory: true,             // 이력 저장 ✓
    pushNotification: true,
    telegramEnabled: true,          // 텔레그램 ✓
    kakaoNotification: false,
    tpAlertLevels: 2,              // TP1~TP2 알림
    slAlert: true,                  // SL 알림 ✓
    cancelExpireAlert: false,
    vipChannel: false,
    premiumChat: false,
    partnerConsulting: 0,
  },
  premium: {
    delayMinutes: 0,                // 실시간
    categories: ["coin_spot", "coin_futures", "overseas_futures", "kr_stock"], // 전체
    dailyLimit: Infinity,           // 무제한
    tpLevels: 3,                    // TP1~TP3
    showLeverage: "all" as const,   // 보수적+공격적
    showAiReasoning: true,
    aiReasoningDetail: "full" as const, // 전체+모델정보
    showCompletedResults: true,
    backtestPeriodDays: Infinity,   // 전체 이력
    dashboardLevel: "advanced" as const, // 고급 (히트맵)
    weeklyReport: true,
    dailyBriefing: true,            // 일일 브리핑 ✓
    monthlyReport: false,
    csvExport: true,                // CSV ✓
    aiAskLimit: 10,                 // 10회/일
    aiAskHistory: true,
    pushNotification: true,
    telegramEnabled: true,
    kakaoNotification: false,       // coming soon
    tpAlertLevels: 3,              // TP1~TP3 알림
    slAlert: true,
    cancelExpireAlert: true,        // 취소/만료 알림 ✓
    vipChannel: false,
    premiumChat: false,
    partnerConsulting: 0,
  },
  bundle: {
    delayMinutes: -60,              // 1시간 선공개
    categories: ["coin_spot", "coin_futures", "overseas_futures", "kr_stock"],
    dailyLimit: Infinity,
    tpLevels: 3,
    showLeverage: "all" as const,
    showAiReasoning: true,
    aiReasoningDetail: "full" as const,
    showCompletedResults: true,
    backtestPeriodDays: Infinity,
    dashboardLevel: "advanced" as const,
    weeklyReport: true,
    dailyBriefing: true,
    monthlyReport: true,            // 월간 종합 리포트 ✓
    csvExport: true,
    aiAskLimit: Infinity,           // 무제한
    aiAskHistory: true,
    pushNotification: true,
    telegramEnabled: true,
    kakaoNotification: false,       // coming soon
    tpAlertLevels: 3,
    slAlert: true,
    cancelExpireAlert: true,
    vipChannel: true,               // VIP 텔레그램 채널 ✓
    premiumChat: true,              // 프리미엄 채팅방 ✓
    partnerConsulting: 2,           // 1:1 상담 월 2회 (30분)
  },
} as const;

export type TierKey = keyof typeof TIER_CONFIG;
export type TierConfig = (typeof TIER_CONFIG)[TierKey];

// ============================================
// 시그널 가시성 체크
// ============================================
export function isSignalVisibleForTier(
  signal: { created_at: string; category: string; status: string },
  tier: TierKey
): { visible: boolean; reason?: string; availableAt?: Date } {
  const config = TIER_CONFIG[tier];

  // 완료된 시그널의 결과는 모든 등급에 공개
  if (
    signal.status !== "active" &&
    config.showCompletedResults
  ) {
    return { visible: true };
  }

  // free: 카테고리/딜레이 체크 후 통과하면 맛보기 허용 (dailyLimit=1로 제한)

  // 카테고리 체크
  if (!(config.categories as readonly string[]).includes(signal.category)) {
    const neededTier = getMinTierForCategory(signal.category);
    return {
      visible: false,
      reason: `${getCategoryLabel(signal.category)}은(는) ${getTierLabel(neededTier)} 이상에서 이용 가능`,
    };
  }

  // 딜레이 체크
  if (config.delayMinutes === Infinity) {
    return { visible: false, reason: "구독이 필요합니다" };
  }

  const signalTime = new Date(signal.created_at).getTime();
  const now = Date.now();
  const availableTime = signalTime + config.delayMinutes * 60 * 1000;

  if (config.delayMinutes > 0 && now < availableTime) {
    const remainingMin = Math.ceil((availableTime - now) / 60000);
    return {
      visible: false,
      reason: `${remainingMin}분 후 공개`,
      availableAt: new Date(availableTime),
    };
  }

  return { visible: true };
}

// ============================================
// 시그널 데이터 필터링 (등급에 따라 블러)
// ============================================
export interface FilteredSignal {
  // 항상 공개
  id: string;
  category: string;
  symbol: string;
  symbol_name: string;
  direction: string;
  confidence: number;
  timeframe: string;
  status: string;
  created_at: string;
  valid_until: string;
  min_tier_required: string;
  // 완료 시그널 결과 (모든 등급 공개)
  result_pnl_percent: number | null;
  closed_at: string | null;
  // 등급별 공개
  entry_price: number | null;
  stop_loss: number | null;
  take_profit_1: number | null;
  take_profit_2: number | null;
  take_profit_3: number | null;
  leverage_conservative: number | null;
  leverage_aggressive: number | null;
  ai_reasoning: string | null;
  ai_models_used: string[];
  // 메타
  _tier_info: {
    tier: TierKey;
    isBlurred: boolean;
    delayLabel: string;
    lockedFields: string[];
    upgradeMessage?: string;
  };
}

export function filterSignalByTier(
  signal: Signal,
  tier: TierKey
): FilteredSignal {
  const config = TIER_CONFIG[tier];
  const isCompleted = signal.status !== "active";
  const lockedFields: string[] = [];

  // Base: always visible
  const filtered: FilteredSignal = {
    id: signal.id,
    category: signal.category,
    symbol: signal.symbol,
    symbol_name: signal.symbol_name,
    direction: signal.direction,
    confidence: signal.confidence,
    timeframe: signal.timeframe,
    status: signal.status,
    created_at: signal.created_at,
    valid_until: signal.valid_until,
    min_tier_required: signal.min_tier_required,
    result_pnl_percent: isCompleted ? signal.result_pnl_percent : null,
    closed_at: signal.closed_at,
    entry_price: null,
    stop_loss: null,
    take_profit_1: null,
    take_profit_2: null,
    take_profit_3: null,
    leverage_conservative: null,
    leverage_aggressive: null,
    ai_reasoning: null,
    ai_models_used: signal.ai_models_used,
    _tier_info: {
      tier,
      isBlurred: tier === "free",
      delayLabel: getDelayLabel(tier),
      lockedFields: [],
    },
  };

  // free: 진입가만 보여주고 나머지 블러 (맛보기)
  if (tier === "free") {
    filtered.entry_price = Number(signal.entry_price); // 진입가는 공개!
    filtered.stop_loss = signal.stop_loss ? Number(signal.stop_loss) : null; // 손절가도 공개
    filtered._tier_info.isBlurred = false; // 카드 자체는 보임
    filtered._tier_info.upgradeMessage = "구독하면 목표가·레버리지·AI 분석까지";
    filtered._tier_info.lockedFields = [
      "take_profit_1", "take_profit_2", "take_profit_3",
      "leverage_conservative", "leverage_aggressive", "ai_reasoning",
    ];
    return filtered;
  }

  // basic+: entry_price, stop_loss always visible
  filtered.entry_price = Number(signal.entry_price);
  filtered.stop_loss = signal.stop_loss ? Number(signal.stop_loss) : null;

  // TP levels
  if (config.tpLevels >= 1) {
    filtered.take_profit_1 = signal.take_profit_1 ? Number(signal.take_profit_1) : null;
  } else {
    lockedFields.push("take_profit_1");
  }
  if (config.tpLevels >= 2) {
    filtered.take_profit_2 = signal.take_profit_2 ? Number(signal.take_profit_2) : null;
  } else {
    lockedFields.push("take_profit_2");
  }
  if (config.tpLevels >= 3) {
    filtered.take_profit_3 = signal.take_profit_3 ? Number(signal.take_profit_3) : null;
  } else {
    lockedFields.push("take_profit_3");
  }

  // Leverage
  if (config.showLeverage === "all") {
    filtered.leverage_conservative = signal.leverage_conservative;
    filtered.leverage_aggressive = signal.leverage_aggressive;
  } else if (config.showLeverage === "conservative") {
    filtered.leverage_conservative = signal.leverage_conservative;
    lockedFields.push("leverage_aggressive");
  } else {
    lockedFields.push("leverage_conservative", "leverage_aggressive");
  }

  // AI reasoning
  if (config.aiReasoningDetail === "full") {
    filtered.ai_reasoning = signal.ai_reasoning;
  } else if (config.aiReasoningDetail === "detailed") {
    filtered.ai_reasoning = signal.ai_reasoning;
  } else if (config.aiReasoningDetail === "summary") {
    filtered.ai_reasoning = signal.ai_reasoning
      ? signal.ai_reasoning.substring(0, 100) + "..."
      : null;
  } else {
    lockedFields.push("ai_reasoning");
  }

  filtered._tier_info.lockedFields = lockedFields;
  filtered._tier_info.isBlurred = false;

  return filtered;
}

// ============================================
// 일일 제한 체크
// ============================================
export function checkDailyLimit(viewedCount: number, tier: TierKey): boolean {
  const config = TIER_CONFIG[tier];
  if (config.dailyLimit === Infinity) return true;
  return viewedCount < config.dailyLimit;
}

// ============================================
// 헬퍼 함수들
// ============================================
export function getDelayLabel(tier: TierKey): string {
  const delay = TIER_CONFIG[tier].delayMinutes;
  if (delay === Infinity) return "";
  if (delay < 0) return "⚡ 선공개";
  if (delay === 0) return "⚡ 실시간";
  return `⏱ ${delay}분 딜레이`;
}

export function getMinTierForCategory(category: string): TierKey {
  if (category === "coin_spot") return "basic";
  if (category === "coin_futures") return "pro";
  return "premium";
}

export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    coin_spot: "코인 현물",
    coin_futures: "코인 선물",
    overseas_futures: "해외선물",
    kr_stock: "국내주식",
  };
  return labels[category] || category;
}

export function getTierLabel(tier: TierKey): string {
  const labels: Record<TierKey, string> = {
    free: "무료",
    basic: "Basic",
    pro: "Pro",
    premium: "Premium",
    bundle: "Bundle",
  };
  return labels[tier];
}

export function getNextTier(tier: TierKey): TierKey | null {
  const order: TierKey[] = ["free", "basic", "pro", "premium", "bundle"];
  const idx = order.indexOf(tier);
  return idx < order.length - 1 ? order[idx + 1] : null;
}

export function getUpgradeMessage(tier: TierKey): string | null {
  switch (tier) {
    case "free":
      return "무료 체험 중 — 시그널을 확인하려면 Basic부터 시작하세요";
    case "basic":
      return "Basic 구독 중 — Pro로 업그레이드하면 선물 시그널 + 10분 딜레이";
    case "pro":
      return "Pro 구독 중 — Premium이면 전 카테고리 실시간 + 공격적 레버리지";
    default:
      return null;
  }
}
