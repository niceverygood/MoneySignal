// ============================================
// Claude Opus 4.6 - Direct Anthropic API Client
// ============================================

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-opus-4-20250918";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AnthropicResponse {
  id: string;
  content: Array<{ type: string; text: string }>;
  model: string;
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
}

// ============================================
// Core API Call
// ============================================
export async function callClaude(
  systemPrompt: string,
  messages: Message[],
  options?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: options?.maxTokens || 8000,
      temperature: options?.temperature ?? 0.7,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
  }

  const data: AnthropicResponse = await response.json();
  const textContent = data.content.find((c) => c.type === "text");
  return textContent?.text || "";
}

// ============================================
// AI 분석가 페르소나
// ============================================
const ANALYST_PERSONAS = {
  fundamental: `당신은 "클로드 펀더멘털"입니다. 보수적 펀더멘털 분석가입니다.
- PER, PBR, EPS, ROE 등 가치 지표를 최우선으로 분석합니다
- 재무 건전성, 실적 성장률, 배당 수익률을 중시합니다
- 리스크 관리를 최우선으로 하며, 확실한 기회만 추천합니다
- 무리한 레버리지를 경고하고 안전 마진을 중시합니다`,

  technical: `당신은 "클로드 테크니컬"입니다. 기술적 분석 전문가입니다.
- 이동평균선(5/20/60/120일), RSI, MACD, 볼린저밴드를 분석합니다
- 거래량 패턴, 캔들스틱 패턴, 지지/저항선을 파악합니다
- 추세 전환 시그널과 모멘텀을 포착합니다
- 진입/퇴출 타이밍을 정밀하게 제시합니다`,

  macro: `당신은 "클로드 매크로"입니다. 거시경제 전략가입니다.
- 금리, 환율, 원자재, 지정학적 리스크를 분석합니다
- 섹터 로테이션, 글로벌 자금 흐름을 추적합니다
- 정책 변화, 실적 시즌, 이벤트 리스크를 평가합니다
- 큰 그림에서 투자 전략을 수립합니다`,
};

// ============================================
// 3관점 종합 분석 (단일 모델, 3가지 관점)
// ============================================
export async function analyzeWithThreePerspectives(
  topic: string,
  marketData: string
): Promise<{ analysis: string; models_used: string[] }> {
  const basePrompt = `
## 분석 대상
${topic}

## 시장 데이터
${marketData}

## 응답 형식
반드시 다음 JSON 형식으로 응답하세요:
{
  "signals": [
    {
      "symbol": "종목코드",
      "symbol_name": "종목명",
      "direction": "long|short|buy|sell",
      "entry_price": 가격(숫자),
      "stop_loss": 손절가(숫자),
      "take_profit_1": 1차익절가(숫자),
      "take_profit_2": 2차익절가(숫자),
      "take_profit_3": 3차익절가(숫자),
      "leverage_conservative": 보수적레버리지(정수 또는 null),
      "leverage_aggressive": 공격적레버리지(정수 또는 null),
      "confidence": 1-5(정수),
      "timeframe": "4h|1d|1w",
      "reasoning": "분석 근거 (상세하게)"
    }
  ],
  "market_summary": "전체 시장 요약"
}`;

  // Phase 1: 펀더멘털 분석
  console.log("[Claude Opus] Phase 1: Fundamental analysis...");
  const fundamentalAnalysis = await callClaude(
    ANALYST_PERSONAS.fundamental,
    [{ role: "user", content: `[펀더멘털 분석]\n${basePrompt}` }],
    { maxTokens: 4000 }
  );

  // Phase 2: 기술적 분석
  console.log("[Claude Opus] Phase 2: Technical analysis...");
  const technicalAnalysis = await callClaude(
    ANALYST_PERSONAS.technical,
    [{ role: "user", content: `[기술적 분석]\n${basePrompt}` }],
    { maxTokens: 4000 }
  );

  // Phase 3: 매크로 분석
  console.log("[Claude Opus] Phase 3: Macro analysis...");
  const macroAnalysis = await callClaude(
    ANALYST_PERSONAS.macro,
    [{ role: "user", content: `[매크로 분석]\n${basePrompt}` }],
    { maxTokens: 4000 }
  );

  // Phase 4: 최종 종합 판단
  console.log("[Claude Opus] Phase 4: Final consensus...");
  const finalAnalysis = await callClaude(
    `당신은 최고 수준의 AI 투자 분석가입니다. 세 가지 관점의 분석을 종합하여 최종 매매 시그널을 도출합니다.
- 3가지 관점 중 2가지 이상이 동의하는 시그널만 채택합니다
- 각 시그널의 신뢰도(confidence)를 1-5로 냉정하게 평가합니다
- 손절가는 반드시 설정하며, 리스크 대비 보상 비율이 최소 2:1 이상인 경우만 추천합니다
- 한국어로 상세한 분석 근거를 작성합니다`,
    [
      {
        role: "user",
        content: `세 가지 관점의 분석 결과를 종합하여 최종 시그널을 도출해주세요.

## 1. 펀더멘털 분석 결과
${fundamentalAnalysis}

## 2. 기술적 분석 결과
${technicalAnalysis}

## 3. 매크로 분석 결과
${macroAnalysis}

## 요청사항
- 3가지 관점 중 2가지 이상 동의하는 종목만 최종 추천에 포함
- 각 시그널에 "어떤 관점들이 동의했는지" 명시
- 반드시 위의 JSON 형식으로 응답
- confidence 4 이상인 시그널만 포함`,
      },
    ],
    { maxTokens: 6000, temperature: 0.5 }
  );

  return {
    analysis: finalAnalysis,
    models_used: ["claude-opus-4.6"],
  };
}

// ============================================
// 빠른 단일 분석 (간단한 요청용)
// ============================================
export async function quickAnalysis(
  topic: string,
  data: string
): Promise<string> {
  return callClaude(
    `당신은 전문 투자 분석가입니다. 주어진 데이터를 기반으로 정확하고 간결한 분석을 제공합니다. 한국어로 응답합니다.`,
    [{ role: "user", content: `${topic}\n\n데이터:\n${data}` }],
    { maxTokens: 4000 }
  );
}

// ============================================
// JSON 파싱 헬퍼
// ============================================
export function parseSignalsFromClaude(
  response: string
): Array<Record<string, unknown>> {
  try {
    // Extract JSON from response (might be wrapped in markdown code blocks)
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/) ||
      response.match(/(\{[\s\S]*\})/);

    if (!jsonMatch) {
      console.error("[Claude] No JSON found in response");
      return [];
    }

    const jsonStr = jsonMatch[1] || jsonMatch[0];
    const parsed = JSON.parse(jsonStr);
    return parsed.signals || [];
  } catch (error) {
    console.error("[Claude] Failed to parse response:", error);
    // Try to extract individual signal objects
    try {
      const signalsMatch = response.match(/"signals"\s*:\s*\[([\s\S]*?)\]/);
      if (signalsMatch) {
        return JSON.parse(`[${signalsMatch[1]}]`);
      }
    } catch {
      // Final fallback
    }
    return [];
  }
}
