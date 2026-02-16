// ============================================
// Telegram Bot Notification Utilities
// ============================================

import type { Signal } from "@/types";
import { CATEGORY_LABELS } from "@/types";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  parseMode: "HTML" | "MarkdownV2" = "HTML"
): Promise<boolean> {
  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[Telegram] sendMessage failed:", res.status, err);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[Telegram] sendMessage error:", error);
    return false;
  }
}

export function formatSignalMessage(signal: Signal): string {
  const directionEmoji = signal.direction === "long" || signal.direction === "buy" ? "🟢" : "🔴";
  const directionLabel = signal.direction.toUpperCase();
  const categoryLabel = CATEGORY_LABELS[signal.category] || signal.category;

  const entryPrice = Number(signal.entry_price).toLocaleString("en-US");

  let lines = [
    `${directionEmoji} <b>${signal.symbol} ${directionLabel}</b> ⭐${signal.confidence}/5`,
    `${categoryLabel} | ${signal.timeframe}`,
    ``,
    `📍 진입가: ${entryPrice} USDT`,
  ];

  if (signal.stop_loss) {
    const slPct = (((Number(signal.stop_loss) - Number(signal.entry_price)) / Number(signal.entry_price)) * 100).toFixed(1);
    lines.push(`🛑 손절: ${Number(signal.stop_loss).toLocaleString("en-US")} (${Number(slPct) > 0 ? "+" : ""}${slPct}%)`);
  }

  if (signal.take_profit_1) {
    const tp1Pct = (((Number(signal.take_profit_1) - Number(signal.entry_price)) / Number(signal.entry_price)) * 100).toFixed(1);
    lines.push(`🎯 TP1: ${Number(signal.take_profit_1).toLocaleString("en-US")} (${Number(tp1Pct) > 0 ? "+" : ""}${tp1Pct}%)`);
  }

  if (signal.take_profit_2) {
    const tp2Pct = (((Number(signal.take_profit_2) - Number(signal.entry_price)) / Number(signal.entry_price)) * 100).toFixed(1);
    lines.push(`🎯 TP2: ${Number(signal.take_profit_2).toLocaleString("en-US")} (${Number(tp2Pct) > 0 ? "+" : ""}${tp2Pct}%)`);
  }

  if (signal.take_profit_3) {
    const tp3Pct = (((Number(signal.take_profit_3) - Number(signal.entry_price)) / Number(signal.entry_price)) * 100).toFixed(1);
    lines.push(`🎯 TP3: ${Number(signal.take_profit_3).toLocaleString("en-US")} (${Number(tp3Pct) > 0 ? "+" : ""}${tp3Pct}%)`);
  }

  if (signal.ai_reasoning) {
    const summary = signal.ai_reasoning.length > 80
      ? signal.ai_reasoning.substring(0, 80) + "..."
      : signal.ai_reasoning;
    lines.push(``);
    lines.push(`💡 AI: ${summary}`);
  }

  const validUntil = new Date(signal.valid_until);
  const diffMs = validUntil.getTime() - new Date(signal.created_at).getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  lines.push(``);
  lines.push(`⏰ 유효: ${diffHours}시간`);

  return lines.join("\n");
}

export function formatTPHitMessage(signal: Signal, tpLevel: number, pnl: number): string {
  const pnlStr = pnl >= 0 ? `+${pnl.toFixed(2)}` : pnl.toFixed(2);
  return [
    `🎯 <b>${signal.symbol} TP${tpLevel} 도달!</b>`,
    `수익률: ${pnlStr}% 🎉`,
    ``,
    `시그널 방향: ${signal.direction.toUpperCase()}`,
    `진입가: ${Number(signal.entry_price).toLocaleString("en-US")}`,
  ].join("\n");
}

export function formatSLHitMessage(signal: Signal, pnl: number): string {
  const pnlStr = pnl.toFixed(2);
  return [
    `⚠️ <b>${signal.symbol} 손절 도달</b>`,
    `손실률: ${pnlStr}%`,
    ``,
    `시그널 방향: ${signal.direction.toUpperCase()}`,
    `진입가: ${Number(signal.entry_price).toLocaleString("en-US")}`,
    `손절가: ${signal.stop_loss ? Number(signal.stop_loss).toLocaleString("en-US") : "-"}`,
  ].join("\n");
}

export function formatDailySummary(data: {
  total: number;
  wins: number;
  losses: number;
  avgPnl: number;
}): string {
  const winRate = data.total > 0 ? ((data.wins / data.total) * 100).toFixed(1) : "0";
  const pnlEmoji = data.avgPnl >= 0 ? "📈" : "📉";
  const pnlStr = data.avgPnl >= 0 ? `+${data.avgPnl.toFixed(2)}` : data.avgPnl.toFixed(2);

  return [
    `📊 <b>일일 시그널 요약</b>`,
    ``,
    `총 시그널: ${data.total}개`,
    `✅ 성공: ${data.wins}개`,
    `❌ 실패: ${data.losses}개`,
    `🎯 승률: ${winRate}%`,
    `${pnlEmoji} 평균 수익률: ${pnlStr}%`,
    ``,
    `자세한 내용은 앱에서 확인하세요.`,
  ].join("\n");
}
