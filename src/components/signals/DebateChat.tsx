"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { AI_CHARACTERS } from "@/lib/ai-characters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, MessageCircle, ChevronDown, ChevronRight } from "lucide-react";
import type { DebateMessage } from "@/lib/debate";
import type { StockMeta } from "@/lib/stock-db";

interface DebateChatProps {
  symbol: string;
  name: string;
  avgScore?: number;
}

interface DebateData {
  messages: DebateMessage[];
  finalVerdict: string;
  meta: StockMeta | null;
}

const ROUND_LABELS: Record<number, { label: string; emoji: string }> = {
  1: { label: "핵심 투자논리 제시", emoji: "💡" },
  2: { label: "디베이트", emoji: "⚔️" },
  3: { label: "최종 합의", emoji: "✅" },
};

export default function DebateChat({ symbol, name, avgScore }: DebateChatProps) {
  const [debate, setDebate] = useState<DebateData | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [visibleMessages, setVisibleMessages] = useState<DebateMessage[]>([]);
  const [typingIdx, setTypingIdx] = useState(-1);
  const [typingText, setTypingText] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const startDebate = useCallback(async () => {
    if (debate || loading) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ symbol, name });
      if (avgScore) params.set("score", String(avgScore));
      const res = await fetch(`/api/debate?${params}`);
      const data = await res.json();
      if (data.debate) {
        setDebate(data.debate);
        // Show round 1 messages
        const round1 = data.debate.messages.filter((m: DebateMessage) => m.round === 1);
        showMessagesWithTyping(round1);
      }
    } catch (e) {
      console.error("Debate error:", e);
    } finally {
      setLoading(false);
    }
  }, [symbol, name, avgScore, debate, loading]);

  // Typing animation
  const showMessagesWithTyping = (msgs: DebateMessage[]) => {
    let idx = 0;
    const showNext = () => {
      if (idx >= msgs.length) {
        setTypingIdx(-1);
        return;
      }
      const msg = msgs[idx];
      setTypingIdx(idx);
      setTypingText("");

      let charIdx = 0;
      const text = msg.content;
      const interval = setInterval(() => {
        charIdx += 2; // 2 chars at a time for speed
        if (charIdx >= text.length) {
          clearInterval(interval);
          setVisibleMessages(prev => [...prev, msg]);
          setTypingIdx(-1);
          idx++;
          setTimeout(showNext, 300);
        } else {
          setTypingText(text.slice(0, charIdx));
        }
      }, 12);
    };
    showNext();
  };

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleMessages, typingText]);

  const advanceRound = () => {
    if (!debate) return;
    const nextRound = currentRound + 1;
    if (nextRound > 3) return;
    setCurrentRound(nextRound);
    const roundMsgs = debate.messages.filter(m => m.round === nextRound);
    showMessagesWithTyping(roundMsgs);
  };

  const currentRoundComplete = debate
    ? visibleMessages.filter(m => m.round === currentRound).length ===
      debate.messages.filter(m => m.round === currentRound).length && typingIdx === -1
    : false;

  if (!isOpen) {
    return (
      <button
        onClick={() => { setIsOpen(true); startDebate(); }}
        className="w-full flex items-center gap-2 rounded-lg border border-[#2A2D36] bg-[#0D0F14] px-3 py-2 text-left hover:border-[#3A3D46] transition-all"
      >
        <MessageCircle className="w-4 h-4 text-[#F5B800]" />
        <span className="text-xs text-[#8B95A5]">AI 토론 보기</span>
        <div className="flex gap-1 ml-auto">
          {(["claude", "gemini", "gpt"] as const).map(id => (
            <span key={id} className="text-sm">{AI_CHARACTERS[id].avatar}</span>
          ))}
        </div>
        <ChevronRight className="w-3 h-3 text-[#8B95A5]" />
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-[#2A2D36] bg-[#1A1D26] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsOpen(false)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-[#2A2D36] hover:bg-[#0D0F14]/50 transition-all"
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-[#F5B800]" />
          <span className="text-sm font-bold text-white">AI 토론</span>
          <span className="text-xs text-[#8B95A5]">{name}</span>
        </div>
        <ChevronDown className="w-4 h-4 text-[#8B95A5]" />
      </button>

      {/* Meta info */}
      {debate?.meta && (
        <div className="px-4 py-2 border-b border-[#2A2D36] bg-[#0D0F14]">
          <p className="text-[10px] text-[#F5B800] font-bold mb-0.5">핵심 투자논리</p>
          <p className="text-[11px] text-[#8B95A5] leading-relaxed">{debate.meta.thesis}</p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {debate.meta.theme.map(t => (
              <Badge key={t} variant="outline" className="text-[8px] border-[#2A2D36] text-[#8B95A5] px-1 py-0">
                {t}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Chat messages */}
      <div ref={scrollRef} className="px-4 py-3 space-y-3 max-h-[400px] overflow-y-auto">
        {loading && !debate && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-[#F5B800] animate-spin mr-2" />
            <span className="text-xs text-[#8B95A5]">AI 분석가들이 토론 준비 중...</span>
          </div>
        )}

        {/* Round separators + messages */}
        {[1, 2, 3].map(round => {
          const roundMsgs = visibleMessages.filter(m => m.round === round);
          const typingInThisRound = debate?.messages.find(
            (m, i) => m.round === round && i === visibleMessages.length && typingIdx !== -1
          );
          if (roundMsgs.length === 0 && !typingInThisRound) return null;

          const roundInfo = ROUND_LABELS[round];
          return (
            <div key={round}>
              {/* Round separator */}
              <div className="flex items-center gap-2 my-3">
                <div className="flex-1 h-px bg-[#2A2D36]" />
                <span className="text-[10px] text-[#8B95A5] font-bold whitespace-nowrap">
                  {roundInfo.emoji} 라운드 {round}: {roundInfo.label}
                </span>
                <div className="flex-1 h-px bg-[#2A2D36]" />
              </div>

              {/* Messages */}
              {roundMsgs.map((msg, i) => (
                <ChatBubble key={`${round}-${i}`} message={msg} />
              ))}
            </div>
          );
        })}

        {/* Typing indicator */}
        {typingIdx !== -1 && debate && (
          <TypingBubble
            message={debate.messages[visibleMessages.length]}
            text={typingText}
          />
        )}
      </div>

      {/* Next round button */}
      {currentRoundComplete && currentRound < 3 && (
        <div className="px-4 py-3 border-t border-[#2A2D36]">
          <Button
            onClick={advanceRound}
            className="w-full bg-[#F5B800] text-[#0D0F14] hover:bg-[#F5B800]/90 text-xs font-bold"
            size="sm"
          >
            {ROUND_LABELS[currentRound + 1].emoji} 다음: {ROUND_LABELS[currentRound + 1].label}
          </Button>
        </div>
      )}

      {/* Final verdict */}
      {currentRound === 3 && currentRoundComplete && debate && (
        <div className="px-4 py-3 border-t border-[#2A2D36] bg-[#0D0F14]">
          <p className="text-[10px] text-[#F5B800] font-bold mb-1">최종 합의 결과</p>
          <p className="text-[11px] text-[#8B95A5] leading-relaxed whitespace-pre-line">
            {debate.finalVerdict}
          </p>
        </div>
      )}
    </div>
  );
}

function ChatBubble({ message }: { message: DebateMessage }) {
  const char = AI_CHARACTERS[message.characterId];
  return (
    <div className="flex gap-2 mb-2">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0"
        style={{ backgroundColor: char.bgColor }}
      >
        {char.avatar}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[10px] font-bold" style={{ color: char.color }}>
            {char.name}
          </span>
          {char.badges.slice(0, 2).map(b => (
            <Badge key={b} variant="outline" className="text-[7px] border-[#2A2D36] text-[#8B95A5] px-1 py-0">
              {b}
            </Badge>
          ))}
        </div>
        <p className="text-[11px] text-[#C8CDD5] leading-relaxed">{message.content}</p>
      </div>
    </div>
  );
}

function TypingBubble({ message, text }: { message?: DebateMessage; text: string }) {
  if (!message) return null;
  const char = AI_CHARACTERS[message.characterId];
  return (
    <div className="flex gap-2 mb-2">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0"
        style={{ backgroundColor: char.bgColor }}
      >
        {char.avatar}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[10px] font-bold" style={{ color: char.color }}>
            {char.name}
          </span>
        </div>
        <p className="text-[11px] text-[#C8CDD5] leading-relaxed">
          {text}
          <span className="inline-block w-1.5 h-3 bg-[#F5B800] ml-0.5 animate-pulse" />
        </p>
      </div>
    </div>
  );
}
