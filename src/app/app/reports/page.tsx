"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  FileText,
  Calendar,
  Lock,
  ChevronDown,
  ChevronUp,
  Loader2,
  TrendingUp,
  TrendingDown,
  Crown,
} from "lucide-react";
import type { TierKey } from "@/lib/tier-access";

interface Report {
  id: string;
  type: string;
  title: string;
  summary: string | null;
  content: string | null;
  performance_data: Record<string, unknown> | null;
  min_tier_required: string;
  week_start: string | null;
  created_at: string;
  isLocked: boolean;
}

type TabKey = "weekly" | "daily_briefing" | "monthly";

const tabs: { key: TabKey; label: string; locked?: boolean }[] = [
  { key: "weekly", label: "주간 리포트" },
  { key: "daily_briefing", label: "일일 브리핑" },
  { key: "monthly", label: "월간 종합 🔒", locked: true },
];

const tierLabels: Record<string, string> = {
  free: "무료",
  basic: "Basic",
  pro: "Pro",
  premium: "Premium",
  bundle: "Bundle",
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours().toString().padStart(2, "0");
  const mins = date.getMinutes().toString().padStart(2, "0");
  return `${month}/${day} ${hours}:${mins}`;
}

function formatRelativeDate(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}일 전`;
  if (hours > 0) return `${hours}시간 전`;
  return "방금 전";
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("weekly");
  const [reports, setReports] = useState<Report[]>([]);
  const [userTier, setUserTier] = useState<TierKey>("free");
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports?type=${activeTab}&limit=20`);
      const data = await res.json();
      if (data.error) {
        console.error(data.error);
        setReports([]);
        return;
      }
      setReports(data.reports || []);
      setUserTier(data.userTier || "free");
    } catch (error) {
      console.error("Failed to fetch reports:", error);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="py-4 space-y-4">
      {/* Page header */}
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-[#F5B800]" />
        <h1 className="text-lg font-bold text-white">AI 마켓 리포트</h1>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              if (!tab.locked) {
                setActiveTab(tab.key);
                setExpandedId(null);
              }
            }}
            disabled={tab.locked}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
              activeTab === tab.key
                ? "bg-[#F5B800] text-[#0D0F14]"
                : tab.locked
                  ? "bg-[#1A1D26] text-[#8B95A5]/30 cursor-not-allowed"
                  : "bg-[#1A1D26] text-[#8B95A5] hover:text-white"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Reports list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-[#F5B800] animate-spin" />
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="w-10 h-10 text-[#8B95A5]/30 mx-auto mb-3" />
          <p className="text-[#8B95A5]">아직 리포트가 없습니다</p>
          <p className="text-sm text-[#8B95A5]/60 mt-1">
            {activeTab === "weekly"
              ? "매주 월요일 오전에 주간 리포트가 발행됩니다"
              : "매일 밤 22시에 일일 브리핑이 발행됩니다"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              userTier={userTier}
              isExpanded={expandedId === report.id}
              onToggle={() => toggleExpand(report.id)}
            />
          ))}
        </div>
      )}

      {/* Tier info */}
      <div className="mt-6 p-3 rounded-lg bg-[#1A1D26] border border-[#2A2D36]">
        <p className="text-[10px] text-[#8B95A5] leading-relaxed">
          주간 리포트는 Pro 이상, 일일 브리핑은 Premium 이상 구독자가 열람할 수 있습니다.
          현재 등급: <span className="text-[#F5B800] font-medium">{tierLabels[userTier] || userTier}</span>
        </p>
      </div>
    </div>
  );
}

function ReportCard({
  report,
  userTier,
  isExpanded,
  onToggle,
}: {
  report: Report;
  userTier: TierKey;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isLocked = report.isLocked;

  // Performance badges
  const perfData = report.performance_data as Record<string, { winRate?: number; avgPnl?: number }> | null;
  const overallWinRate = perfData
    ? Object.values(perfData).reduce((sum, v) => sum + (v?.winRate || 0), 0) /
      Math.max(Object.values(perfData).filter((v) => v?.winRate != null).length, 1)
    : null;

  return (
    <div
      className={cn(
        "rounded-xl border transition-all",
        isLocked
          ? "bg-[#1A1D26]/60 border-[#2A2D36]/50"
          : "bg-[#1A1D26] border-[#2A2D36] hover:border-[#F5B800]/30"
      )}
    >
      {/* Card header */}
      <button
        onClick={isLocked ? undefined : onToggle}
        disabled={isLocked}
        className={cn(
          "w-full text-left p-4 transition-colors",
          !isLocked && "hover:bg-[#2A2D36]/30"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={cn(
                  "text-[10px] font-medium px-2 py-0.5 rounded-full",
                  report.type === "weekly"
                    ? "bg-[#F5B800]/10 text-[#F5B800]"
                    : report.type === "daily_briefing"
                      ? "bg-[#00D1FF]/10 text-[#00D1FF]"
                      : "bg-[#A855F7]/10 text-[#A855F7]"
                )}
              >
                {report.type === "weekly"
                  ? "WEEKLY"
                  : report.type === "daily_briefing"
                    ? "DAILY"
                    : "MONTHLY"}
              </span>
              {overallWinRate != null && !isLocked && (
                <span
                  className={cn(
                    "text-[10px] font-medium flex items-center gap-0.5",
                    overallWinRate >= 60 ? "text-[#00E676]" : overallWinRate >= 40 ? "text-[#F5B800]" : "text-[#FF5252]"
                  )}
                >
                  {overallWinRate >= 50 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  승률 {Math.round(overallWinRate)}%
                </span>
              )}
            </div>
            <h3
              className={cn(
                "text-sm font-semibold truncate",
                isLocked ? "text-[#8B95A5]/50" : "text-white"
              )}
            >
              {report.title}
            </h3>
            {report.summary && (
              <p
                className={cn(
                  "text-xs mt-1 line-clamp-2",
                  isLocked ? "text-[#8B95A5]/30" : "text-[#8B95A5]"
                )}
              >
                {report.summary}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Calendar className="w-3 h-3 text-[#8B95A5]/50" />
              <span className="text-[10px] text-[#8B95A5]/50">
                {formatDate(report.created_at)} · {formatRelativeDate(report.created_at)}
              </span>
            </div>
          </div>

          <div className="flex-shrink-0 mt-1">
            {isLocked ? (
              <div className="w-8 h-8 rounded-full bg-[#2A2D36] flex items-center justify-center">
                <Lock className="w-4 h-4 text-[#8B95A5]/40" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#2A2D36] flex items-center justify-center">
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-[#8B95A5]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#8B95A5]" />
                )}
              </div>
            )}
          </div>
        </div>
      </button>

      {/* Locked overlay */}
      {isLocked && (
        <div className="px-4 pb-4">
          <div className="rounded-lg bg-[#0D0F14]/80 border border-[#2A2D36] p-4 text-center">
            <Crown className="w-6 h-6 text-[#F5B800]/60 mx-auto mb-2" />
            <p className="text-xs text-[#8B95A5]">
              이 리포트는{" "}
              <span className="text-[#F5B800] font-medium">
                {tierLabels[report.min_tier_required] || report.min_tier_required}
              </span>{" "}
              이상 구독자만 열람할 수 있습니다
            </p>
            <button className="mt-3 px-4 py-2 bg-[#F5B800] text-[#0D0F14] rounded-lg text-xs font-bold hover:bg-[#F5B800]/90 transition-colors">
              업그레이드하기
            </button>
          </div>
        </div>
      )}

      {/* Expanded content */}
      {isExpanded && !isLocked && report.content && (
        <div className="px-4 pb-4 border-t border-[#2A2D36]">
          <div
            className="mt-4 prose prose-invert prose-sm max-w-none
              prose-headings:text-white prose-headings:font-bold
              prose-h2:text-base prose-h2:mt-4 prose-h2:mb-2
              prose-h3:text-sm prose-h3:mt-3 prose-h3:mb-1
              prose-p:text-[#C8CDD6] prose-p:text-xs prose-p:leading-relaxed
              prose-strong:text-[#F5B800]
              prose-li:text-[#C8CDD6] prose-li:text-xs
              prose-ul:my-1 prose-ol:my-1
              prose-code:text-[#00D1FF] prose-code:text-xs prose-code:bg-[#2A2D36] prose-code:px-1 prose-code:py-0.5 prose-code:rounded
              [&_hr]:border-[#2A2D36]"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(report.content) }}
          />

          {/* Performance data summary */}
          {report.performance_data && report.type === "weekly" && (
            <PerformanceSummary data={report.performance_data} />
          )}
        </div>
      )}
    </div>
  );
}

function PerformanceSummary({ data }: { data: Record<string, unknown> }) {
  const categoryLabels: Record<string, string> = {
    coin_spot: "코인 현물",
    coin_futures: "코인 선물",
    overseas_futures: "해외선물",
    kr_stock: "국내주식",
  };

  const entries = Object.entries(data).filter(
    ([key]) => key in categoryLabels
  ) as [string, { total: number; wins: number; winRate: number; avgPnl: number }][];

  if (entries.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-[#2A2D36]">
      <h4 className="text-xs font-semibold text-[#8B95A5] mb-3">카테고리별 성과</h4>
      <div className="grid grid-cols-2 gap-2">
        {entries.map(([cat, stats]) => (
          <div
            key={cat}
            className="rounded-lg bg-[#0D0F14] border border-[#2A2D36] p-3"
          >
            <p className="text-[10px] text-[#8B95A5] mb-1">{categoryLabels[cat]}</p>
            <div className="flex items-baseline gap-1">
              <span
                className={cn(
                  "text-lg font-bold",
                  stats.winRate >= 60
                    ? "text-[#00E676]"
                    : stats.winRate >= 40
                      ? "text-[#F5B800]"
                      : "text-[#FF5252]"
                )}
              >
                {stats.winRate}%
              </span>
              <span className="text-[10px] text-[#8B95A5]">승률</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-[#8B95A5]">
                {stats.wins}/{stats.total}건
              </span>
              <span
                className={cn(
                  "text-[10px] font-medium",
                  stats.avgPnl >= 0 ? "text-[#00E676]" : "text-[#FF5252]"
                )}
              >
                평균 {stats.avgPnl > 0 ? "+" : ""}
                {stats.avgPnl}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Simple markdown to HTML converter for report content
function markdownToHtml(markdown: string): string {
  let html = markdown
    // Escape HTML
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Headers
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Inline code
    .replace(/`(.+?)`/g, "<code>$1</code>")
    // Horizontal rule
    .replace(/^---$/gm, "<hr/>")
    // Unordered list items
    .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
    // Ordered list items
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    // Line breaks
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br/>");

  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li>.*?<\/li>(?:<br\/>)?)+/g, (match) => {
    const cleaned = match.replace(/<br\/>/g, "");
    return `<ul>${cleaned}</ul>`;
  });

  return `<p>${html}</p>`;
}
