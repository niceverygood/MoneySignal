"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Crown } from "lucide-react";
import { AI_CHARACTERS } from "@/lib/ai-characters";
import { getInvestmentVerdict } from "@/lib/market-sentiment";
import DebateChat from "./DebateChat";
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
}

export default function DailyVerdictCard() {
  const [verdict, setVerdict] = useState<VerdictData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

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

  const characters = [
    { ...AI_CHARACTERS.claude, top5: verdict.claude_top5 },
    { ...AI_CHARACTERS.gemini, top5: verdict.gemini_top5 },
    { ...AI_CHARACTERS.gpt, top5: verdict.gpt_top5 },
  ];

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

      {/* AI Characters mini-cards */}
      <div className="flex gap-2">
        {characters.map((char) => (
          <div
            key={char.id}
            className="flex-1 rounded-lg px-2 py-1.5 text-center"
            style={{ backgroundColor: char.bgColor }}
          >
            <p className="text-lg leading-none">{char.avatar}</p>
            <p className="text-[10px] font-bold mt-0.5" style={{ color: char.color }}>
              {char.name}
            </p>
            <p className="text-[8px] text-[#8B95A5] truncate">{char.role}</p>
          </div>
        ))}
      </div>

      {/* Summary */}
      {verdict.consensus_summary && (
        <p className="text-[11px] text-[#8B95A5] leading-relaxed bg-[#0D0F14] rounded-lg px-3 py-2">
          {verdict.consensus_summary}
        </p>
      )}

      {/* Top 5 List */}
      <div className="space-y-2">
        {verdict.top5.map((item, idx) => {
          const weightedScore = item.avgScore * verdict.buy_weight;
          const investVerdict = getInvestmentVerdict(weightedScore);
          const isExpanded = expandedIdx === idx;

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
                {/* Row 1: Rank + Name + Unanimous */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center",
                      idx === 0 ? "bg-[#F5B800] text-[#0D0F14]" :
                      idx === 1 ? "bg-[#C0C0C0] text-[#0D0F14]" :
                      idx === 2 ? "bg-[#CD7F32] text-white" :
                      "bg-[#2A2D36] text-[#8B95A5]"
                    )}>
                      {item.rank}
                    </span>
                    <span className="text-sm font-bold text-white">{item.name}</span>
                    <span className="text-[10px] text-[#8B95A5] font-mono">{item.symbol}</span>
                    {item.isUnanimous && (
                      <Badge className="text-[8px] bg-[#F5B800]/10 text-[#F5B800] border-0 px-1 py-0 gap-0.5">
                        <Crown className="w-2.5 h-2.5" />
                        만장일치
                      </Badge>
                    )}
                  </div>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ color: investVerdict.color, backgroundColor: investVerdict.bgColor }}
                  >
                    {investVerdict.emoji} {investVerdict.label}
                  </span>
                </div>

                {/* Row 2: AI scores + Vote info */}
                <div className="flex items-center gap-3 mt-1.5">
                  {/* Per-AI scores */}
                  {(["claude", "gemini", "gpt"] as const).map((aiId) => {
                    const char = AI_CHARACTERS[aiId];
                    const score = item.scores?.[aiId];
                    return (
                      <div key={aiId} className="flex items-center gap-1">
                        <span className="text-xs">{char.avatar}</span>
                        {score ? (
                          <span className="text-[10px] font-mono font-bold" style={{ color: char.color }}>
                            {score.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#8B95A5]/40">—</span>
                        )}
                      </div>
                    );
                  })}
                  <span className="text-[10px] text-[#8B95A5] ml-auto">
                    평균 <span className="text-white font-mono font-bold">{item.avgScore.toFixed(1)}</span>
                    <span className="mx-1">→</span>
                    가중 <span className="font-mono font-bold" style={{ color: investVerdict.color }}>
                      {weightedScore.toFixed(1)}
                    </span>
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

      {/* Voted by legend */}
      <div className="flex items-center gap-1.5 text-[10px] text-[#8B95A5]">
        <Users className="w-3 h-3" />
        <span>
          {verdict.top5.filter(t => t.isUnanimous).length > 0
            ? `만장일치 ${verdict.top5.filter(t => t.isUnanimous).length}종목`
            : "합의 결과"}
          {" · "}투표 수 = Top 5에 포함시킨 AI 수 · 점수 탭하면 상세 분석
        </span>
      </div>
    </div>
  );
}
