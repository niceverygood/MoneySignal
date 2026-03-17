// ============================================
// OpenRouter API — 멀티모델 호출 래퍼
// Claude / Gemini / GPT를 한 곳에서 호출
// OpenRouter 키가 없으면 Anthropic API 폴백
// ============================================

import { callClaude } from "./claude";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

type AIModel = "claude" | "gemini" | "gpt";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
  usage?: { prompt_tokens: number; completion_tokens: number };
}

const MODEL_MAP: Record<AIModel, string> = {
  claude: "anthropic/claude-opus-4-20250514",
  gemini: "google/gemini-2.5-pro-preview",
  gpt: "openai/gpt-4.1",
};

const AI_PERSONAS: Record<AIModel, string> = {
  claude: `당신은 "클로드 리"입니다. 보수적 펀더멘털 분석가로, 리스크 관리를 최우선으로 합니다.
가치 투자, 펀더멘털 분석, 안전 마진에 중점을 둡니다. 무리한 레버리지를 경고하고
확실한 기회만 추천합니다. 한국어로 분석합니다.`,

  gemini: `당신은 "제미 나인"입니다. 공격적 성장주/모멘텀 전문가로, 기회를 적극적으로 포착합니다.
기술적 분석, 모멘텀, 거래량 분석에 능숙합니다. 트렌드를 빠르게 파악하고
과감한 진입을 추천하지만, 반드시 손절가를 설정합니다. 한국어로 분석합니다.`,

  gpt: `당신은 "G.P. 테일러"입니다. 매크로 전략가로, 거시경제와 시장 전체 흐름을 봅니다.
금리, 환율, 지정학적 리스크, 섹터 로테이션 등 큰 그림을 그립니다.
두 분석가의 의견을 종합하여 균형 잡힌 결론을 내립니다. 한국어로 분석합니다.`,
};

// ============================================
// 범용 호출 함수: OpenRouter 키 있으면 사용, 없으면 Claude 폴백
// ============================================
export async function callModel(
  modelId: string,
  systemPrompt: string,
  userMessage: string,
  options?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  // OpenRouter 키가 없으면 Claude 폴백
  if (!apiKey) {
    return callClaude(
      systemPrompt,
      [{ role: "user", content: userMessage }],
      { maxTokens: options?.maxTokens || 4000, temperature: options?.temperature ?? 0.7 }
    );
  }

  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://money-signal.vercel.app",
        "X-Title": "MoneySignal",
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        max_tokens: options?.maxTokens || 4000,
        temperature: options?.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenRouter error (${modelId}): ${response.status} - ${errorText}`);
      // 폴백: Claude로 재시도
      return callClaude(
        systemPrompt,
        [{ role: "user", content: userMessage }],
        { maxTokens: options?.maxTokens || 4000, temperature: options?.temperature ?? 0.7 }
      );
    }

    const data: OpenRouterResponse = await response.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (e) {
    console.error(`OpenRouter fetch error (${modelId}):`, e);
    return callClaude(
      systemPrompt,
      [{ role: "user", content: userMessage }],
      { maxTokens: options?.maxTokens || 4000, temperature: options?.temperature ?? 0.7 }
    );
  }
}

export function isOpenRouterAvailable(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}

// ============================================
// 레거시 호환: conductAIDebate (기존 시그널 생성 코드에서 사용)
// ============================================
export async function callOpenRouter(
  model: AIModel,
  messages: Message[]
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    // 폴백: Claude 직접 호출
    const userMsg = messages.filter(m => m.role === "user").map(m => m.content).join("\n");
    return callClaude(
      AI_PERSONAS[model],
      [{ role: "user", content: userMsg }],
      { maxTokens: 4000 }
    );
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://money-signal.vercel.app",
      "X-Title": "MoneySignal",
    },
    body: JSON.stringify({
      model: MODEL_MAP[model],
      messages: [
        { role: "system", content: AI_PERSONAS[model] },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data: OpenRouterResponse = await response.json();
  return data.choices[0]?.message?.content || "";
}

export async function conductAIDebate(
  topic: string,
  marketData: string,
  rounds: number = 3
): Promise<{ consensus: string; models_used: AIModel[] }> {
  const models: AIModel[] = ["claude", "gemini", "gpt"];
  const conversation: Record<AIModel, Message[]> = {
    claude: [],
    gemini: [],
    gpt: [],
  };

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
      "entry_price": 가격,
      "stop_loss": 손절가,
      "take_profit_1": 1차익절가,
      "take_profit_2": 2차익절가,
      "take_profit_3": 3차익절가,
      "leverage_conservative": 보수적레버리지(정수),
      "leverage_aggressive": 공격적레버리지(정수),
      "confidence": 1-5,
      "timeframe": "4h|1d|1w",
      "reasoning": "분석 근거"
    }
  ],
  "summary": "전체 시장 요약"
}`;

  // Round 1: Independent analysis
  const round1Promises = models.map(async (model) => {
    const response = await callOpenRouter(model, [
      {
        role: "user",
        content: `[라운드 1] 독립적으로 분석해주세요.\n${basePrompt}`,
      },
    ]);
    conversation[model].push(
      { role: "user", content: `[라운드 1] 독립적으로 분석해주세요.\n${basePrompt}` },
      { role: "assistant", content: response }
    );
    return { model, response };
  });

  const round1Results = await Promise.all(round1Promises);

  // Round 2+: Cross-review
  for (let round = 2; round <= rounds; round++) {
    const otherAnalyses = round1Results
      .map((r) => `[${r.model}의 분석]:\n${r.response}`)
      .join("\n\n---\n\n");

    const roundPromises = models.map(async (model) => {
      const prompt =
        round === rounds
          ? `[최종 라운드] 다른 분석가들의 의견을 참고하여 최종 합의안을 도출해주세요.
동의하는 시그널과 동의하지 않는 시그널을 명확히 구분하고,
3명 중 2명 이상이 동의하는 시그널만 포함해주세요.

다른 분석가들의 의견:
${otherAnalyses}

반드시 위의 JSON 형식으로 응답하세요.`
          : `[라운드 ${round}] 다른 분석가들의 의견을 참고하여 수정된 분석을 제시해주세요.

다른 분석가들의 의견:
${otherAnalyses}

반드시 위의 JSON 형식으로 응답하세요.`;

      const response = await callOpenRouter(model, [
        ...conversation[model],
        { role: "user", content: prompt },
      ]);
      conversation[model].push(
        { role: "user", content: prompt },
        { role: "assistant", content: response }
      );
      return { model, response };
    });

    await Promise.all(roundPromises);
  }

  const finalResponses = models.map(
    (model) => conversation[model][conversation[model].length - 1].content
  );

  return {
    consensus: finalResponses[2],
    models_used: models,
  };
}

export function parseSignalsFromAI(
  aiResponse: string
): Array<Record<string, unknown>> {
  try {
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.signals || [];
  } catch {
    console.error("Failed to parse AI response:", aiResponse.substring(0, 200));
    return [];
  }
}
