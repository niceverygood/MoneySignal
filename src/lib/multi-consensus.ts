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

function parseTop5Response(response: string): { top5: AITop5Item[]; marketComment: string } {
  try {
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/) ||
      response.match(/(\{[\s\S]*\})/);

    if (!jsonMatch) {
      console.error("[Consensus] No JSON found in response");
      return { top5: [], marketComment: "" };
    }

    const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
    return {
      top5: (parsed.top5 || []).map((item: AITop5Item, idx: number) => ({
        rank: item.rank || idx + 1,
        symbol: String(item.symbol),
        name: String(item.name),
        score: Math.max(1, Math.min(5, Number(item.score) || 3)),
        reason: String(item.reason || ""),
      })),
      marketComment: parsed.market_comment || "",
    };
  } catch (e) {
    console.error("[Consensus] Parse error:", e);
    return { top5: [], marketComment: "" };
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
// 메인: 일일 합의 생성
// ============================================
export async function generateDailyVerdict(marketData: string): Promise<{
  top5: ConsensusItem[];
  claudeTop5: AITop5Item[];
  geminiTop5: AITop5Item[];
  gptTop5: AITop5Item[];
  theme: { name: string; emoji: string };
  sentiment: { compositeScore: number; buyWeight: number; label: string };
  consensusSummary: string;
}> {
  const theme = getTodayTheme();

  // 3개 AI 병렬 분석
  console.log("[Consensus] Starting 3-AI parallel analysis...");
  const [claudeResult, geminiResult, gptResult, sentimentResult] = await Promise.all([
    analyzeWithCharacter("claude", marketData, `${theme.emoji} ${theme.name}`),
    analyzeWithCharacter("gemini", marketData, `${theme.emoji} ${theme.name}`),
    analyzeWithCharacter("gpt", marketData, `${theme.emoji} ${theme.name}`),
    calculateMarketSentiment(),
  ]);

  console.log("[Consensus] Claude:", claudeResult.top5.map(t => t.name).join(", "));
  console.log("[Consensus] Gemini:", geminiResult.top5.map(t => t.name).join(", "));
  console.log("[Consensus] GPT:", gptResult.top5.map(t => t.name).join(", "));

  // 합의 계산
  const top5 = calculateConsensus([claudeResult, geminiResult, gptResult]);

  // 합의 요약 생성
  const unanimousCount = top5.filter(t => t.isUnanimous).length;
  const summaryParts: string[] = [];

  if (unanimousCount > 0) {
    const names = top5.filter(t => t.isUnanimous).map(t => t.name);
    summaryParts.push(`만장일치 ${unanimousCount}종목: ${names.join(", ")}`);
  }
  summaryParts.push(`시장 센티먼트: ${sentimentResult.label} (${sentimentResult.compositeScore}점)`);

  // 투자 판정
  if (top5.length > 0) {
    const topVerdict = getInvestmentVerdict(top5[0].avgScore * sentimentResult.buyWeight);
    summaryParts.push(`1위 ${top5[0].name} → ${topVerdict.emoji} ${topVerdict.label}`);
  }

  return {
    top5,
    claudeTop5: claudeResult.top5,
    geminiTop5: geminiResult.top5,
    gptTop5: gptResult.top5,
    theme,
    sentiment: {
      compositeScore: sentimentResult.compositeScore,
      buyWeight: sentimentResult.buyWeight,
      label: sentimentResult.label,
    },
    consensusSummary: summaryParts.join(" | "),
  };
}
