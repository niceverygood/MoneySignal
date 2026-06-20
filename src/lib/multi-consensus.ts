// ============================================
// 멀티모델 합의 시스템
// 3개 AI가 독립적으로 Top 5 분석 → 점수 합산
// ============================================

import { callModel } from "./openrouter";
import {
  AI_CHARACTERS,
  type AITop5Item,
  type AIAnalysisResult,
  type ConsensusItem,
} from "./ai-characters";
import { calculateMarketSentiment, getInvestmentVerdict } from "./market-sentiment";

// ============================================
// 각 AI에게 Top 5 분석 요청
// ============================================
async function analyzeWithCharacter(
  characterId: string,
  marketData: string,
  theme: string
): Promise<AIAnalysisResult> {
  const char = AI_CHARACTERS[characterId];
  if (!char) throw new Error(`Unknown character: ${characterId}`);

  const systemPrompt = `${char.fallbackPersona}

## 응답 규칙
- 반드시 아래 JSON 형식으로만 응답하세요
- 다른 텍스트 없이 JSON만 출력하세요
- score는 1.0~5.0 (소수점 1자리)
- reason은 한국어 2-3문장`;

  const userMessage = `## 오늘의 테마: ${theme}

## 시장 데이터
${marketData}

## 요청
위 데이터를 분석하여 매수 추천 Top 5 종목을 선정해주세요.
각 종목에 1.0~5.0 점수와 추천 이유를 제시하세요.

반드시 다음 JSON 형식으로 응답:
\`\`\`json
{
  "top5": [
    { "rank": 1, "symbol": "종목코드", "name": "종목명", "score": 4.8, "reason": "추천 이유 2-3문장" },
    { "rank": 2, "symbol": "종목코드", "name": "종목명", "score": 4.5, "reason": "추천 이유" },
    { "rank": 3, "symbol": "종목코드", "name": "종목명", "score": 4.2, "reason": "추천 이유" },
    { "rank": 4, "symbol": "종목코드", "name": "종목명", "score": 4.0, "reason": "추천 이유" },
    { "rank": 5, "symbol": "종목코드", "name": "종목명", "score": 3.8, "reason": "추천 이유" }
  ],
  "market_comment": "전체 시장 한줄 코멘트"
}
\`\`\``;

  const response = await callModel(
    char.model,
    systemPrompt,
    userMessage,
    { maxTokens: 3000, temperature: 0.7 }
  );

  // Parse JSON
  const parsed = parseTop5Response(response);

  return {
    characterId,
    top5: parsed.top5,
    marketComment: parsed.marketComment,
  };
}

function normalizeItem(
  item: { rank?: number; symbol?: string; name?: string; score?: number; reason?: string },
  idx: number
): AITop5Item {
  return {
    rank: item.rank || idx + 1,
    symbol: String(item.symbol ?? ""),
    name: String(item.name ?? ""),
    score: Math.max(1, Math.min(5, Number(item.score) || 3)),
    reason: String(item.reason || ""),
  };
}

function parseTop5Response(response: string): { top5: AITop5Item[]; marketComment: string } {
  const jsonMatch =
    response.match(/```(?:json)?\s*([\s\S]*?)```/) || response.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) {
    console.error("[Consensus] No JSON found in response");
    return { top5: [], marketComment: "" };
  }
  const raw = jsonMatch[1] || jsonMatch[0];

  // 1) 정상 파싱
  try {
    const parsed = JSON.parse(raw);
    return {
      top5: (parsed.top5 || []).map((item: AITop5Item, idx: number) => normalizeItem(item, idx)),
      marketComment: parsed.market_comment || "",
    };
  } catch {
    // 2) 잘린/깨진 JSON 복구 — top5 배열에서 완전한 {…} 객체만 개별 파싱
    //    (모델이 maxTokens로 잘려도 "한 AI 통째로 드롭"을 막는다)
    const items: AITop5Item[] = [];
    const objRe = /\{[^{}]*\}/g;
    let m: RegExpExecArray | null;
    while ((m = objRe.exec(raw)) !== null) {
      try {
        const o = JSON.parse(m[0]);
        if (o && (o.symbol || o.name)) items.push(normalizeItem(o, items.length));
      } catch {
        /* skip malformed object */
      }
    }
    const cmt = (raw.match(/"market_comment"\s*:\s*"([^"]*)"/) || [])[1] || "";
    if (items.length === 0) console.error("[Consensus] Parse salvage failed");
    return { top5: items.slice(0, 5), marketComment: cmt };
  }
}

// ============================================
// 합의 점수 계산 (3 AI 점수 합산)
// ============================================
function calculateConsensus(results: AIAnalysisResult[]): ConsensusItem[] {
  // 종목별 점수 집계
  const scoreMap = new Map<string, {
    symbol: string;
    name: string;
    scores: Record<string, number>;
    reasons: Record<string, string>;
    votedBy: string[];
  }>();

  for (const result of results) {
    for (const item of result.top5) {
      const key = item.symbol;
      if (!scoreMap.has(key)) {
        scoreMap.set(key, {
          symbol: item.symbol,
          name: item.name,
          scores: {},
          reasons: {},
          votedBy: [],
        });
      }
      const entry = scoreMap.get(key)!;
      entry.scores[result.characterId] = item.score;
      entry.reasons[result.characterId] = item.reason;
      entry.votedBy.push(result.characterId);
    }
  }

  // 총점 계산 + 정렬
  const items: ConsensusItem[] = [];
  for (const [, entry] of scoreMap) {
    const totalScore = Object.values(entry.scores).reduce((sum, s) => sum + s, 0);
    const avgScore = totalScore / Object.keys(entry.scores).length;
    items.push({
      rank: 0,
      symbol: entry.symbol,
      name: entry.name,
      totalScore,
      avgScore,
      votedBy: entry.votedBy,
      isUnanimous: entry.votedBy.length === 3,
      scores: entry.scores,
      reasons: entry.reasons,
    });
  }

  // 총점 내림차순 정렬 → Top 5
  items.sort((a, b) => b.totalScore - a.totalScore);
  return items.slice(0, 5).map((item, idx) => ({ ...item, rank: idx + 1 }));
}

// ============================================
// 요일별 테마
// ============================================
const DAY_THEMES: Record<number, { name: string; emoji: string }> = {
  0: { name: "종합 밸런스", emoji: "⚖️" },
  1: { name: "성장주 포커스", emoji: "🚀" },
  2: { name: "배당·가치 투자", emoji: "💰" },
  3: { name: "테크·AI 트렌드", emoji: "🔥" },
  4: { name: "섹터 로테이션", emoji: "🔄" },
  5: { name: "블루칩 안전투자", emoji: "🏆" },
  6: { name: "하이 그로스", emoji: "📈" },
};

export function getTodayTheme(): { name: string; emoji: string } {
  const day = new Date().getDay();
  return DAY_THEMES[day] || DAY_THEMES[0];
}

// ============================================
// 멀티턴 토론 타입
// ============================================
export interface DebateRoundComment {
  characterId: string; // claude | gemini | gpt
  comment: string;
}

export interface DebateRound {
  round: number; // 1 | 2 | 3
  label: string; // "독립 분석" | "상호 토론" | "최종 합의"
  comments: DebateRoundComment[];
}

const CHARACTER_IDS = ["claude", "gemini", "gpt"] as const;

// 각 AI의 Top5를 짧게 요약 (라운드 2/3 입력용 — 원본 marketData 대신 토큰 절감)
function summarizeTop5(result: AIAnalysisResult): string {
  const char = AI_CHARACTERS[result.characterId];
  const picks = result.top5
    .map((t) => `${t.rank}. ${t.name}(${t.symbol}) ${t.score.toFixed(1)}점 — ${t.reason}`)
    .join("\n");
  return `[${char?.name || result.characterId}]\n${picks}\n한줄평: ${result.marketComment}`;
}

// 라운드 2/3 공통: 토론 컨텍스트를 받아 재평가된 Top5 + 토론 코멘트 반환
async function debateRound(
  characterId: string,
  round: 2 | 3,
  theme: string,
  debateContext: string
): Promise<AIAnalysisResult> {
  const char = AI_CHARACTERS[characterId];
  if (!char) throw new Error(`Unknown character: ${characterId}`);

  const roundInstruction =
    round === 2
      ? `[라운드 2 — 상호 토론] 다른 두 분석가의 Top5와 근거를 읽고 당신의 입장을 재검토하세요.
- 동의하는 종목과 반박하는 종목을 상대 분석가 이름을 불러가며 구체적으로 언급
- 토론을 반영해 당신의 Top5를 (필요하면) 수정하고 점수를 다시 매기세요`
      : `[라운드 3 — 최종 합의] 지금까지의 토론을 종합하여 최종 Top5를 확정하세요.
- 토론에서 설득된 부분을 반영
- 가장 확신하는 5개 종목만 최종 점수와 함께 제시`;

  const systemPrompt = `${char.fallbackPersona}

## 응답 규칙
- 반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이 JSON만)
- score는 1.0~5.0 (소수점 1자리)
- reason은 한국어 1-2문장
- market_comment에는 이번 라운드의 토론 코멘트(상대 의견에 대한 반응/최종 결론)를 한국어 2-3문장으로`;

  const userMessage = `## 오늘의 테마: ${theme}

## 지금까지의 토론
${debateContext}

## 요청
${roundInstruction}

반드시 다음 JSON 형식으로 응답:
\`\`\`json
{
  "top5": [
    { "rank": 1, "symbol": "종목코드", "name": "종목명", "score": 4.8, "reason": "이유" }
  ],
  "market_comment": "이번 라운드 토론 코멘트"
}
\`\`\``;

  const response = await callModel(char.model, systemPrompt, userMessage, {
    maxTokens: round === 2 ? 1500 : 1200,
    temperature: round === 2 ? 0.8 : 0.6,
  });

  const parsed = parseTop5Response(response);
  return { characterId, top5: parsed.top5, marketComment: parsed.marketComment };
}

function collectRound(round: number, label: string, results: AIAnalysisResult[]): DebateRound {
  return {
    round,
    label,
    comments: results.map((r) => ({ characterId: r.characterId, comment: r.marketComment })),
  };
}

// ============================================
// 메인: 일일 합의 생성 (3라운드 멀티턴 토론)
// 라운드1 독립 분석 → 라운드2 상호 반박·조정 → 라운드3 최종 합의 → 점수 합산
// ============================================
export async function generateDailyVerdict(marketData: string): Promise<{
  top5: ConsensusItem[];
  claudeTop5: AITop5Item[];
  geminiTop5: AITop5Item[];
  gptTop5: AITop5Item[];
  theme: { name: string; emoji: string };
  sentiment: { compositeScore: number; buyWeight: number; label: string };
  consensusSummary: string;
  debateRounds: DebateRound[];
}> {
  const theme = getTodayTheme();
  const themeLabel = `${theme.emoji} ${theme.name}`;

  // ── 라운드 1: 각 AI 독립 분석 (실데이터 전체 주입) + 시장 센티먼트 ──
  console.log("[Debate] Round 1: independent analysis...");
  const [round1, sentimentResult] = await Promise.all([
    Promise.all(CHARACTER_IDS.map((id) => analyzeWithCharacter(id, marketData, themeLabel))),
    calculateMarketSentiment(),
  ]);
  console.log("[Debate] R1 picks:", round1.map((r) => `${r.characterId}=${r.top5.map((t) => t.name).join("/")}`).join(" | "));

  // ── 라운드 2: 상호 토론 (다른 2명의 Top5 요약만 주입) ──
  console.log("[Debate] Round 2: cross-rebuttal...");
  const round2 = await Promise.all(
    CHARACTER_IDS.map((id) => {
      const others = round1
        .filter((r) => r.characterId !== id)
        .map(summarizeTop5)
        .join("\n\n");
      return debateRound(id, 2, themeLabel, others);
    })
  );

  // ── 라운드 3: 최종 합의 (전체 토론 요약 주입) ──
  console.log("[Debate] Round 3: final consensus...");
  const fullContext = [
    "### 라운드1 (독립 분석)",
    round1.map(summarizeTop5).join("\n\n"),
    "### 라운드2 (상호 토론)",
    round2.map(summarizeTop5).join("\n\n"),
  ].join("\n\n");
  const round3 = await Promise.all(
    CHARACTER_IDS.map((id) => debateRound(id, 3, themeLabel, fullContext))
  );

  // 최종 라운드(3) 점수로 합의 Top5 계산
  const top5 = calculateConsensus(round3);

  // 합의 요약 생성
  const unanimousCount = top5.filter((t) => t.isUnanimous).length;
  const summaryParts: string[] = [];
  if (unanimousCount > 0) {
    const names = top5.filter((t) => t.isUnanimous).map((t) => t.name);
    summaryParts.push(`만장일치 ${unanimousCount}종목: ${names.join(", ")}`);
  }
  summaryParts.push(`시장 센티먼트: ${sentimentResult.label} (${sentimentResult.compositeScore}점)`);
  if (top5.length > 0) {
    const topVerdict = getInvestmentVerdict(top5[0].avgScore * sentimentResult.buyWeight);
    summaryParts.push(`1위 ${top5[0].name} → ${topVerdict.emoji} ${topVerdict.label}`);
  }

  const debateRounds: DebateRound[] = [
    collectRound(1, "독립 분석", round1),
    collectRound(2, "상호 토론", round2),
    collectRound(3, "최종 합의", round3),
  ];

  // 최종 라운드(3) 기준 각 AI Top5
  const byId = (id: string) => round3.find((r) => r.characterId === id)?.top5 ?? [];

  return {
    top5,
    claudeTop5: byId("claude"),
    geminiTop5: byId("gemini"),
    gptTop5: byId("gpt"),
    theme,
    sentiment: {
      compositeScore: sentimentResult.compositeScore,
      buyWeight: sentimentResult.buyWeight,
      label: sentimentResult.label,
    },
    consensusSummary: summaryParts.join(" | "),
    debateRounds,
  };
}
