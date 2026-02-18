"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Send, Bot, User, Lock, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  symbols?: Array<{ symbol: string; type: string; name: string }>;
  timestamp: Date;
}

interface AskResponse {
  answer: string;
  symbolsDetected: Array<{ symbol: string; type: string; name: string }>;
  remainingQuestions: number | null;
}

const QUICK_CHIPS = [
  { label: "BTC 분석", query: "BTC 현재 시장 분석해줘" },
  { label: "ETH 전망", query: "이더리움 향후 전망 분석해줘" },
  { label: "삼성전자", query: "삼성전자 매수 타이밍 분석해줘" },
  { label: "나스닥 방향", query: "나스닥 지수 방향성 분석해줘" },
];

export default function AskPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [tierBlocked, setTierBlocked] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Check tier access on mount
  useEffect(() => {
    async function checkAccess() {
      try {
        const res = await fetch("/api/ai-ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: "__check__" }),
        });

        if (res.status === 403) {
          setTierBlocked(true);
        } else if (res.status === 429) {
          const data = await res.json();
          setRemaining(data.remainingQuestions ?? 0);
          setLimitReached(true);
        } else if (res.status === 400) {
          // Expected: empty/check question returns 400 but access is granted
          setTierBlocked(false);
        }
      } catch {
        // Network error — allow access attempt
      } finally {
        setInitialLoading(false);
      }
    }
    checkAccess();
  }, []);

  const handleSend = useCallback(
    async (questionOverride?: string) => {
      const question = questionOverride || input.trim();
      if (!question || isLoading || limitReached) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: question,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);

      try {
        const res = await fetch("/api/ai-ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
        });

        if (res.status === 429) {
          const data = await res.json();
          setRemaining(data.remainingQuestions ?? 0);
          setLimitReached(true);
          const errorMsg: ChatMessage = {
            id: `ai-${Date.now()}`,
            role: "assistant",
            content: "오늘 질문 횟수를 모두 사용했습니다. 내일 다시 이용해주세요.",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMsg]);
          return;
        }

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "요청 실패");
        }

        const data: AskResponse = await res.json();

        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: data.answer,
          symbols: data.symbolsDetected,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, aiMsg]);
        setRemaining(data.remainingQuestions);

        if (data.remainingQuestions === 0) {
          setLimitReached(true);
        }
      } catch (err) {
        const errorMsg: ChatMessage = {
          id: `error-${Date.now()}`,
          role: "assistant",
          content:
            err instanceof Error
              ? err.message
              : "분석 중 오류가 발생했습니다. 다시 시도해주세요.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, limitReached]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Loading state
  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#F5B800]" />
      </div>
    );
  }

  // Tier blocked: show teaser with sample then lock
  if (tierBlocked) {
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <Bot className="w-6 h-6 text-[#F5B800]" />
            <h1 className="text-lg font-bold text-white">AI 종목 분석</h1>
          </div>
          <div className="px-3 py-1 rounded-full text-xs font-medium bg-[#FF5252]/10 text-[#FF5252] border border-[#FF5252]/20">
            무료 체험 소진
          </div>
        </div>

        {/* Sample conversation to show what they're missing */}
        <div className="flex-1 overflow-y-auto space-y-4 pb-4">
          <div className="flex justify-end">
            <div className="bg-[#F5B800] text-[#0D0F14] rounded-2xl rounded-br-sm px-3 py-2 max-w-[75%]">
              <p className="text-sm font-medium">BTC 지금 롱 잡아도 될까?</p>
            </div>
          </div>

          <div className="flex gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#F5B800]/20 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-[#F5B800]" />
            </div>
            <div className="bg-[#1A1D26] border border-[#2A2D36] rounded-2xl rounded-bl-sm px-3 py-2 max-w-[75%]">
              <p className="text-sm text-white font-bold mb-1">BTC/USDT 분석</p>
              <p className="text-sm text-[#8B95A5]">현재가: $97,450</p>
              <p className="text-sm text-[#00E676] font-bold mt-1">방향: 매수(롱) 추천 ⭐4/5</p>
              <div className="mt-2 space-y-1">
                <p className="text-xs text-[#8B95A5]">• RSI 55 상승 전환 중</p>
                <p className="text-xs text-[#8B95A5]">• 97K 지지선 강하게 지지</p>
                <p className="text-xs text-[#8B95A5] signal-blur">• MACD 골든크로스 임박...</p>
                <p className="text-xs text-[#8B95A5] signal-blur">• 진입: $97,400~97,600</p>
                <p className="text-xs text-[#8B95A5] signal-blur">• 손절: $95,200 (-2.3%)</p>
                <p className="text-xs text-[#8B95A5] signal-blur">• 목표: $100,500 (+3.1%)</p>
              </div>
            </div>
          </div>

          {/* Lock overlay */}
          <div className="flex flex-col items-center gap-4 p-6 mt-4 rounded-xl bg-[#1A1D26] border border-[#F5B800]/20">
            <Lock className="w-8 h-8 text-[#F5B800]" />
            <div className="text-center">
              <p className="text-white font-bold">무료 체험이 끝났습니다</p>
              <p className="text-xs text-[#8B95A5] mt-1">
                Pro 구독 시 하루 3회, Premium은 10회, Bundle은 무제한!
              </p>
            </div>
            <div className="flex gap-2 w-full">
              <a
                href="/app/subscribe"
                className="flex-1 text-center px-4 py-2.5 bg-[#F5B800] text-[#0D0F14] font-bold rounded-lg hover:bg-[#FFD54F] transition-colors text-sm"
              >
                Pro 시작 — 월 5.9만원
              </a>
            </div>
            <p className="text-[10px] text-[#8B95A5]">
              AI가 실시간 데이터로 분석 · 구체적 진입가/손절/목표가 제시
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-2">
          <Bot className="w-6 h-6 text-[#F5B800]" />
          <h1 className="text-lg font-bold text-white">AI 종목 분석</h1>
        </div>
        {remaining !== null && (
          <div
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium",
              remaining > 0
                ? "bg-[#F5B800]/10 text-[#F5B800] border border-[#F5B800]/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            )}
          >
            오늘 {remaining}회 남음
          </div>
        )}
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4 scrollbar-thin">
        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 py-12">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#F5B800]/20 to-[#F5B800]/5 flex items-center justify-center border border-[#F5B800]/20">
              <Sparkles className="w-8 h-8 text-[#F5B800]" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-white font-semibold text-lg">
                무엇이든 물어보세요
              </h2>
              <p className="text-[#8B95A5] text-sm max-w-xs">
                종목명을 포함하면 실시간 데이터 기반으로 분석합니다
              </p>
            </div>

            {/* Quick chips */}
            <div className="flex flex-wrap justify-center gap-2 max-w-sm">
              {QUICK_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => handleSend(chip.query)}
                  disabled={isLoading}
                  className="px-4 py-2 rounded-full bg-[#1A1D26] border border-[#2A2D36] text-sm text-[#8B95A5] hover:text-white hover:border-[#F5B800]/40 transition-all disabled:opacity-50"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-3",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {msg.role === "assistant" && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-[#F5B800]/20 to-[#F5B800]/5 flex items-center justify-center border border-[#F5B800]/20 mt-1">
                <Bot className="w-4 h-4 text-[#F5B800]" />
              </div>
            )}

            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3",
                msg.role === "user"
                  ? "bg-[#F5B800] text-black"
                  : "bg-[#1A1D26] border border-[#2A2D36] text-[#E0E0E0]"
              )}
            >
              {msg.role === "user" ? (
                <p className="text-sm font-medium">{msg.content}</p>
              ) : (
                <div className="text-sm leading-relaxed ai-markdown">
                  <MarkdownContent content={msg.content} />
                </div>
              )}

              {/* Detected symbols badges */}
              {msg.symbols && msg.symbols.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-[#2A2D36]">
                  {msg.symbols.map((s) => (
                    <span
                      key={s.symbol}
                      className="px-2 py-0.5 rounded-full bg-[#F5B800]/10 text-[#F5B800] text-[10px] font-medium"
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {msg.role === "user" && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#2A2D36] flex items-center justify-center mt-1">
                <User className="w-4 h-4 text-[#8B95A5]" />
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-[#F5B800]/20 to-[#F5B800]/5 flex items-center justify-center border border-[#F5B800]/20 mt-1">
              <Bot className="w-4 h-4 text-[#F5B800]" />
            </div>
            <div className="bg-[#1A1D26] border border-[#2A2D36] rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 text-[#8B95A5] text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="typing-animation">AI가 분석 중...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick chips (shown when there are messages) */}
      {messages.length > 0 && !isLoading && !limitReached && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {QUICK_CHIPS.map((chip) => (
            <button
              key={chip.label}
              onClick={() => handleSend(chip.query)}
              disabled={isLoading}
              className="flex-shrink-0 px-3 py-1.5 rounded-full bg-[#1A1D26] border border-[#2A2D36] text-xs text-[#8B95A5] hover:text-white hover:border-[#F5B800]/40 transition-all"
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="pt-2 pb-1">
        {limitReached ? (
          <div className="flex items-center justify-center py-3 px-4 rounded-2xl bg-[#1A1D26] border border-[#2A2D36]">
            <p className="text-[#8B95A5] text-sm">
              오늘 질문 횟수를 모두 사용했습니다
            </p>
          </div>
        ) : (
          <div className="flex items-end gap-2 bg-[#1A1D26] border border-[#2A2D36] rounded-2xl px-4 py-2 focus-within:border-[#F5B800]/40 transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="종목이나 시장에 대해 물어보세요..."
              rows={1}
              className="flex-1 bg-transparent text-white text-sm placeholder:text-[#555] resize-none outline-none max-h-24"
              disabled={isLoading}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className={cn(
                "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all",
                input.trim() && !isLoading
                  ? "bg-[#F5B800] text-black hover:bg-[#FFD000]"
                  : "bg-[#2A2D36] text-[#555]"
              )}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Simple markdown renderer for AI responses
function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeContent = "";
  let key = 0;

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={key++}
            className="bg-[#0D0F14] rounded-lg p-3 my-2 overflow-x-auto text-xs text-[#8B95A5]"
          >
            <code>{codeContent}</code>
          </pre>
        );
        codeContent = "";
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent += (codeContent ? "\n" : "") + line;
      continue;
    }

    // Headers
    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={key++} className="font-semibold text-white mt-3 mb-1 text-sm">
          {formatInlineMarkdown(line.slice(4))}
        </h4>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h3
          key={key++}
          className="font-bold text-white mt-3 mb-1 text-[15px]"
        >
          {formatInlineMarkdown(line.slice(3))}
        </h3>
      );
    } else if (line.startsWith("# ")) {
      elements.push(
        <h2 key={key++} className="font-bold text-white mt-3 mb-2 text-base">
          {formatInlineMarkdown(line.slice(2))}
        </h2>
      );
    }
    // Bullet points
    else if (line.match(/^[-*] /)) {
      elements.push(
        <div key={key++} className="flex gap-2 ml-1 my-0.5">
          <span className="text-[#F5B800] mt-0.5">•</span>
          <span>{formatInlineMarkdown(line.slice(2))}</span>
        </div>
      );
    }
    // Numbered list
    else if (line.match(/^\d+\.\s/)) {
      const match = line.match(/^(\d+)\.\s(.*)$/);
      if (match) {
        elements.push(
          <div key={key++} className="flex gap-2 ml-1 my-0.5">
            <span className="text-[#F5B800] font-medium min-w-[1.2em]">
              {match[1]}.
            </span>
            <span>{formatInlineMarkdown(match[2])}</span>
          </div>
        );
      }
    }
    // Horizontal rule
    else if (line.match(/^---+$/)) {
      elements.push(
        <hr key={key++} className="border-[#2A2D36] my-3" />
      );
    }
    // Empty line
    else if (line.trim() === "") {
      elements.push(<div key={key++} className="h-2" />);
    }
    // Regular paragraph
    else {
      elements.push(
        <p key={key++} className="my-0.5">
          {formatInlineMarkdown(line)}
        </p>
      );
    }
  }

  return <>{elements}</>;
}

function formatInlineMarkdown(text: string): React.ReactNode {
  // Bold
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="text-white font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 rounded bg-[#0D0F14] text-[#F5B800] text-xs"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}
