"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Loader2, Crown, MessagesSquare, ChevronDown, ChevronUp } from "lucide-react";
import { AI_CHARACTERS } from "@/lib/ai-characters";
import { getInvestmentVerdict } from "@/lib/market-sentiment";
import DebateChat from "./DebateChat";
import AccuracyBadge from "./AccuracyBadge";
import type { ConsensusItem } from "@/lib/ai-characters";

interface VerdictData {
  id: string;
  date: string;
  top5: ConsensusItem[];
  claude_top5: Array<{ rank: number; name: string; score: number; reason: string }>;
  gemini_top5: Array<{ rank: number; name: string; score: number; reason: string }>;
  gpt_top5: Array<{ rank: number; name: string; score: number; reason: string }>;
  theme_name: string;
  theme_emoji: string;
  sentiment_score: number;
  sentiment_label: string;
  buy_weight: number;
  consensus_summary: string;
  debate_rounds?: { round: number; label: string; comments: { characterId: string; comment: string }[] }[];
}

export default function DailyVerdictCard() {
  const [verdict, setVerdict] = useState<VerdictData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [showDebate, setShowDebate] = useState(false);

  useEffect(() => {
    fetch("/api/verdict")
      .then((res) => res.json())
      .then((d) => { if (d.verdict) setVerdict(d.verdict); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-[#2A2D36] bg-[#1A1D26] p-4 flex items-center justify-center h-[200px]">
        <Loader2 className="w-5 h-5 text-[#F5B800] animate-spin" />
      </div>
    );
  }

  if (!verdict) return null;

  return (
    <div className="rounded-xl border border-[#2A2D36] bg-[#1A1D26] p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-white">AI 합의 Top 5</h3>
          <Badge variant="outline" className="text-[9px] border-[#F5B800]/30 text-[#F5B800] px-1.5 py-0">
            {verdict.theme_emoji} {verdict.theme_name}
          </Badge>
        </div>
        <span className="text-[10px] text-[#8B95A5]">{verdict.date}</span>
      </div>

      {/* AI 적중률 — 신뢰의 핵심. 리딩방과 다르게 "검증되는" AI임을 증명 */}
      <AccuracyBadge />

      {/* Summary */}
      {verdict.consensus_summary && (
        <p className="text-[11px] text-[#8B95A5] leading-relaxed bg-[#0D0F14] rounded-lg px-3 py-2">
          {verdict.consensus_summary}
        </p>
      )}

      {/* AI 토론 과정 (라운드1 독립 → 라운드2 토론 → 라운드3 합의) */}
      {verdict.debate_rounds && verdict.debate_rounds.length > 0 && (
        <div className="rounded-lg border border-[#2A2D36] bg-[#0D0F14] overflow-hidden">
          <button
            onClick={() => setShowDebate(!showDebate)}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-[#15171F] transition-colors"
          >
            <span className="text-[11px] font-bold text-[#F5B800] flex items-center gap-1.5">
              <MessagesSquare className="w-3.5 h-3.5" />
              AI 3대장 토론 과정
            </span>
            {showDebate ? (
              <ChevronUp className="w-4 h-4 text-[#8B95A5]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#8B95A5]" />
            )}
          </button>
          {showDebate && (
            <div className="px-3 pb-3 pt-1 space-y-3">
              {verdict.debate_rounds.map((rd) => (
                <div key={rd.round}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#F5B800]/10 text-[#F5B800]">
                      R{rd.round}
                    </span>
                    <span className="text-[10px] font-bold text-white">{rd.label}</span>
                  </div>
                  <div className="space-y-1.5 pl-1">
                    {rd.comments.map((c) => {
                      const char = AI_CHARACTERS[c.characterId];
                      if (!char || !c.comment) return null;
                      return (
                        <div key={c.characterId} className="flex gap-2">
                          <span className="text-sm flex-shrink-0">{char.avatar}</span>
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold" style={{ color: char.color }}>
                              {char.name}
                            </p>
                            <p className="text-[11px] text-[#8B95A5] leading-relaxed">{c.comment}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Top 5 List */}
      <div className="space-y-2">
        {verdict.top5.map((item, idx) => {
          const weightedScore = item.avgScore * verdict.buy_weight;
          const investVerdict = getInvestmentVerdict(weightedScore);
          const isExpanded = expandedIdx === idx;

          // AI 합의 지수(0~100): 몇 명이 추천했나(60%) + 평균 점수 강도(40%) — 투명한 규칙
          const votedCount =
            item.votedBy?.length ??
            (["claude", "gemini", "gpt"] as const).filter((a) => item.scores?.[a]).length;
          const consensusIndex = Math.min(
            100,
            Math.round((votedCount / 3) * 60 + (item.avgScore / 5) * 40)
          );
          const strengthColor =
            consensusIndex >= 80 ? "#F5B800" : consensusIndex >= 55 ? "#448AFF" : "#8B95A5";
          const consensusLabel = votedCount >= 3 ? "만장일치" : `${votedCount}/3 합의`;

          return (
            <div key={idx}>
              <button
                onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                className={cn(
                  "w-full rounded-lg border px-3 py-2.5 text-left transition-all",
                  item.isUnanimous
                    ? "border-[#F5B800]/30 bg-[#F5B800]/5"
                    : "border-[#2A2D36] bg-[#0D0F14] hover:border-[#3A3D46]"
                )}
              >
                {/* Row 1: Rank + Name + Verdict */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn(
                      "text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0",
                      idx === 0 ? "bg-[#F5B800] text-[#0D0F14]" :
                      idx === 1 ? "bg-[#C0C0C0] text-[#0D0F14]" :
                      idx === 2 ? "bg-[#CD7F32] text-white" :
                      "bg-[#2A2D36] text-[#8B95A5]"
                    )}>
                      {item.rank}
                    </span>
                    <span className="text-sm font-bold text-white truncate">{item.name}</span>
                    {votedCount >= 3 && <Crown className="w-3 h-3 text-[#F5B800] shrink-0" />}
                  </div>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                    style={{ color: investVerdict.color, backgroundColor: investVerdict.bgColor }}
                  >
                    {investVerdict.emoji} {investVerdict.label}
                  </span>
                </div>

                {/* Row 2: 합의 바 */}
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-1 bg-[#22262F] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${consensusIndex}%`, backgroundColor: strengthColor }}
                    />
                  </div>
                  <span className="text-[9px] shrink-0" style={{ color: strengthColor }}>
                    {consensusLabel} {consensusIndex}
                  </span>
                </div>
              </button>

              {/* Expanded: AI reasons + Debate */}
              {isExpanded && (
                <div className="mt-1 space-y-2 pl-2">
                  {(["claude", "gemini", "gpt"] as const).map((aiId) => {
                    const char = AI_CHARACTERS[aiId];
                    const reason = item.reasons?.[aiId];
                    if (!reason) return null;
                    return (
                      <div key={aiId} className="flex gap-2 rounded-lg bg-[#0D0F14] px-3 py-2">
                        <span className="text-sm flex-shrink-0">{char.avatar}</span>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold" style={{ color: char.color }}>
                            {char.name}
                          </p>
                          <p className="text-[11px] text-[#8B95A5] leading-relaxed">{reason}</p>
                        </div>
                      </div>
                    );
                  })}
                  {/* AI Debate Chat */}
                  <DebateChat
                    symbol={item.symbol}
                    name={item.name}
                    avgScore={item.avgScore}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
