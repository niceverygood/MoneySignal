"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Crown, MessagesSquare, ChevronDown, ChevronUp } from "lucide-react";
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
  debate_rounds?: { round: number; label: string; comments: { characterId: string; comment: string }[] }[];
}

interface AccuracyStat {
  count: number;
  hitRate: number;
  avgReturn: number;
}

export default function DailyVerdictCard() {
  const [verdict, setVerdict] = useState<VerdictData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [showDebate, setShowDebate] = useState(false);
  const [accuracy, setAccuracy] = useState<{ d7: AccuracyStat | null; d30: AccuracyStat | null } | null>(null);

  useEffect(() => {
    fetch("/api/verdict")
      .then((res) => res.json())
      .then((d) => { if (d.verdict) setVerdict(d.verdict); })
      .catch(console.error)
      .finally(() => setLoading(false));
    // AI 적중률 (별도 — 실패해도 카드는 정상)
    fetch("/api/verdict/accuracy")
      .then((res) => res.json())
      .then((d) => setAccuracy({ d7: d.d7 ?? null, d30: d.d30 ?? null }))
      .catch(() => {});
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

      {/* AI 적중률 — 신뢰의 핵심. 리딩방과 다르게 "검증되는" AI임을 증명 */}
      {(() => {
        const best = accuracy?.d30?.count ? accuracy.d30 : accuracy?.d7?.count ? accuracy.d7 : null;
        const horizon = accuracy?.d30?.count ? "30일" : "7일";
        if (!best) {
          return (
            <div className="flex items-center gap-1.5 rounded-lg bg-[#0D0F14] px-2.5 py-1.5">
              <span className="text-[10px] text-[#8B95A5]">
                📊 AI 적중률 집계 중 — 모든 추천은 발행가와 함께 서버에 기록되어 곧 공개됩니다
              </span>
            </div>
          );
        }
        const positive = best.avgReturn >= 0;
        return (
          <div className="flex items-center justify-between rounded-lg bg-[#0D0F14] px-2.5 py-1.5">
            <span className="text-[10px] text-[#8B95A5]">
              최근 {horizon} 매수의견 적중률
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[#F5B800]">{best.hitRate}%</span>
              <span
                className={cn(
                  "text-[10px] font-bold font-mono",
                  positive ? "text-[#00E676]" : "text-[#FF5252]"
                )}
              >
                평균 {positive ? "+" : ""}{best.avgReturn}%
              </span>
              <span className="text-[9px] text-[#8B95A5]/60">({best.count}종목)</span>
            </span>
          </div>
        );
      })()}

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
                    {/* 합의 강도 — 만장일치/2:1/1:2를 항상 명시 (어디서 갈렸는지 투명) */}
                    <Badge
                      className="text-[8px] border-0 px-1 py-0 gap-0.5"
                      style={{
                        backgroundColor: votedCount >= 3 ? "rgba(245,184,0,0.1)" : "rgba(139,149,165,0.12)",
                        color: votedCount >= 3 ? "#F5B800" : "#8B95A5",
                      }}
                    >
                      {votedCount >= 3 && <Crown className="w-2.5 h-2.5" />}
                      {consensusLabel}
                    </Badge>
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

                {/* Row 3: AI 합의 지수 (0~100) — 한 눈에 보이는 합의 강도 */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[9px] text-[#8B95A5] shrink-0">AI 합의 지수</span>
                  <div className="flex-1 h-1.5 bg-[#22262F] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${consensusIndex}%`, backgroundColor: strengthColor }}
                    />
                  </div>
                  <span
                    className="text-[10px] font-bold font-mono shrink-0"
                    style={{ color: strengthColor }}
                  >
                    {consensusIndex}
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
