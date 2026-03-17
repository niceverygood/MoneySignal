// ============================================
// AI 토론 시스템 — 3라운드 디베이트
// ============================================

import { callModel } from "./openrouter";
import { AI_CHARACTERS } from "./ai-characters";
import { getStockMeta, getStockMetaByName, type StockMeta } from "./stock-db";

export interface DebateMessage {
  characterId: "claude" | "gemini" | "gpt";
  round: number;
  content: string;
}

export interface DebateResult {
  symbol: string;
  name: string;
  messages: DebateMessage[];
  finalVerdict: string;
  meta: StockMeta | null;
}

// ============================================
// 종목 메타데이터로 컨텍스트 생성
// ============================================
function buildMetaContext(meta: StockMeta): string {
  return `## 종목 정보: ${meta.name} (${meta.code})
섹터: ${meta.sector}
핵심 투자논리: ${meta.thesis}
지금 왜 사야 하는가: ${meta.whyNow}
핵심 성장 동력: ${meta.drivers.join(", ")}
주요 리스크: ${meta.risks.join(", ")}
최근 카탈리스트: ${meta.catalysts.join(", ")}
밸류에이션: ${meta.valuation}
경쟁 우위/해자: ${meta.moat}
테마: ${meta.theme.join(", ")}`;
}

// ============================================
// 3라운드 토론 생성
// ============================================
export async function generateDebate(
  symbol: string,
  name: string,
  avgScore?: number
): Promise<DebateResult> {
  const meta = getStockMeta(symbol) || getStockMetaByName(name);
  const metaContext = meta ? buildMetaContext(meta) : `종목: ${name} (${symbol})`;
  const scoreContext = avgScore ? `\nAI 합의 평균 점수: ${avgScore.toFixed(1)}/5.0` : "";

  const messages: DebateMessage[] = [];

  // =====================
  // Round 1: 독립 분석 (병렬)
  // =====================
  const round1Prompts: Record<string, string> = {
    claude: `${metaContext}${scoreContext}

[라운드 1] 밸류에이션/재무 관점에서 이 종목의 투자 매력을 분석해주세요.
- PER/PBR/ROE 관점에서 현재 가격이 적정한지
- 안전마진은 충분한지
- 핵심 투자논리(thesis)에 동의하는지
2-3문장으로 간결하게 답변하세요. 한국어로.`,

    gemini: `${metaContext}${scoreContext}

[라운드 1] 성장 모멘텀 관점에서 이 종목의 투자 매력을 분석해주세요.
- 향후 성장 잠재력은 어떤지
- 최근 카탈리스트가 주가에 미칠 영향
- 지금이 진입 타이밍으로 적절한지
2-3문장으로 간결하게 답변하세요. 한국어로.`,

    gpt: `${metaContext}${scoreContext}

[라운드 1] 거시경제/매크로 관점에서 이 종목의 투자 매력을 분석해주세요.
- 현재 시장 환경에서 이 섹터/종목의 위치
- 글로벌 트렌드와의 연관성
- 리스크-리턴 밸런스
2-3문장으로 간결하게 답변하세요. 한국어로.`,
  };

  const round1Results = await Promise.all(
    (["claude", "gemini", "gpt"] as const).map(async (id) => {
      const char = AI_CHARACTERS[id];
      const response = await callModel(
        char.model,
        char.fallbackPersona,
        round1Prompts[id],
        { maxTokens: 500, temperature: 0.8 }
      );
      return { id, response: response.trim() };
    })
  );

  for (const r of round1Results) {
    messages.push({ characterId: r.id, round: 1, content: r.response });
  }

  // =====================
  // Round 2: 디베이트 (서로의 분석을 인용/반박, 병렬)
  // =====================
  const round1Summary = round1Results
    .map(r => `[${AI_CHARACTERS[r.id].name}]: ${r.response}`)
    .join("\n\n");

  const round2Results = await Promise.all(
    (["claude", "gemini", "gpt"] as const).map(async (id) => {
      const char = AI_CHARACTERS[id];
      const others = round1Results.filter(r => r.id !== id);
      const othersText = others
        .map(r => `${AI_CHARACTERS[r.id].name}: "${r.response}"`)
        .join("\n\n");

      const prompt = `${metaContext}

[라운드 2] 다른 두 분석가의 의견을 읽고 반응해주세요.
- 동의하는 부분과 보완/반박할 부분을 구체적으로 언급
- 상대방 이름을 불러가며 대화하듯 답변
- 당신만의 추가 인사이트를 제시

다른 분석가들의 의견:
${othersText}

2-3문장으로 간결하게, 대화체로 답변하세요. 한국어로.`;

      const response = await callModel(
        char.model,
        char.fallbackPersona,
        prompt,
        { maxTokens: 500, temperature: 0.8 }
      );
      return { id, response: response.trim() };
    })
  );

  for (const r of round2Results) {
    messages.push({ characterId: r.id, round: 2, content: r.response });
  }

  // =====================
  // Round 3: 최종 합의 (순차 — GPT가 마무리)
  // =====================
  const allPrevious = [...round1Results, ...round2Results]
    .map(r => `[R${messages.find(m => m.characterId === r.id && m.content === r.response)?.round}] ${AI_CHARACTERS[r.id].name}: ${r.response}`)
    .join("\n\n");

  const round3Results = await Promise.all(
    (["claude", "gemini", "gpt"] as const).map(async (id) => {
      const char = AI_CHARACTERS[id];
      const prompt = `${metaContext}

[라운드 3 — 최종 합의] 지금까지의 토론을 종합하여 최종 의견을 내주세요.

이전 토론 내용:
${allPrevious}

- 이 종목에 대한 최종 입장 (매수 추천/관망/비추천)
- 핵심 이유 1가지
- 한 줄 결론
1-2문장으로 간결하게 답변하세요. 한국어로.`;

      const response = await callModel(
        char.model,
        char.fallbackPersona,
        prompt,
        { maxTokens: 300, temperature: 0.6 }
      );
      return { id, response: response.trim() };
    })
  );

  for (const r of round3Results) {
    messages.push({ characterId: r.id, round: 3, content: r.response });
  }

  // 최종 판정 요약
  const finalVerdict = round3Results.map(r =>
    `${AI_CHARACTERS[r.id].avatar} ${AI_CHARACTERS[r.id].name}: ${r.response}`
  ).join("\n");

  return { symbol, name, messages, finalVerdict, meta };
}
