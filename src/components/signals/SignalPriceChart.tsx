"use client";

// ============================================
// 시그널 캔들차트 (lightweight-charts)
// 진입가·TP1~3·SL 가격 라인을 차트 위에 표시
// 카테고리별 데이터: /api/signals/chart?id=
// ============================================
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Loader2, CandlestickChart } from "lucide-react";

interface Props {
  signalId: string;
  entryPrice: number | null;
  takeProfit1: number | null;
  takeProfit2: number | null;
  takeProfit3: number | null;
  stopLoss: number | null;
}

interface Candle {
  time: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export default function SignalPriceChart({
  signalId,
  entryPrice,
  takeProfit1,
  takeProfit2,
  takeProfit3,
  stopLoss,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "unsupported" | "error">("loading");
  const [intervalLabel, setIntervalLabel] = useState("");

  useEffect(() => {
    let disposed = false;
    // lightweight-charts는 canvas 기반 — SSR 회피 위해 동적 import
    let cleanup: (() => void) | undefined;

    async function init() {
      try {
        const res = await fetch(`/api/signals/chart?id=${signalId}`);
        if (!res.ok) {
          if (!disposed) setState("error");
          return;
        }
        const data: { supported: boolean; candles: Candle[]; interval: string } = await res.json();
        if (disposed) return;
        if (!data.supported || data.candles.length === 0) {
          setState("unsupported");
          return;
        }
        setIntervalLabel(data.interval);

        const { createChart, CandlestickSeries, LineStyle } = await import("lightweight-charts");
        if (disposed || !containerRef.current) return;

        const chart = createChart(containerRef.current, {
          height: 260,
          layout: {
            background: { color: "transparent" },
            textColor: "#8B95A5",
            fontSize: 10,
            attributionLogo: false,
          },
          grid: {
            vertLines: { color: "rgba(42,45,54,0.5)" },
            horzLines: { color: "rgba(42,45,54,0.5)" },
          },
          rightPriceScale: { borderColor: "#2A2D36" },
          timeScale: { borderColor: "#2A2D36", timeVisible: true, secondsVisible: false },
          crosshair: {
            horzLine: { color: "#F5B800", labelBackgroundColor: "#F5B800" },
            vertLine: { color: "#8B95A5", labelBackgroundColor: "#22262F" },
          },
          handleScroll: { pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
        });

        const series = chart.addSeries(CandlestickSeries, {
          upColor: "#00E676",
          downColor: "#FF5252",
          wickUpColor: "#00E676",
          wickDownColor: "#FF5252",
          borderVisible: false,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        series.setData(data.candles as any);

        // 가격 라인: 진입(골드, 실선) / TP(초록, 점선) / SL(빨강, 점선)
        const lines: Array<{ price: number | null; color: string; title: string; style: number }> = [
          { price: entryPrice, color: "#F5B800", title: "진입", style: LineStyle.Solid },
          { price: takeProfit1, color: "#00E676", title: "TP1", style: LineStyle.Dashed },
          { price: takeProfit2, color: "#00E676", title: "TP2", style: LineStyle.Dashed },
          { price: takeProfit3, color: "#00E676", title: "TP3", style: LineStyle.Dashed },
          { price: stopLoss, color: "#FF5252", title: "SL", style: LineStyle.Dashed },
        ];
        for (const l of lines) {
          if (l.price === null || !Number.isFinite(l.price)) continue;
          series.createPriceLine({
            price: l.price,
            color: l.color,
            lineWidth: 1,
            lineStyle: l.style,
            axisLabelVisible: true,
            title: l.title,
          });
        }

        chart.timeScale().fitContent();
        setState("ready");

        // 컨테이너 폭 변화 대응
        const resize = () => {
          if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
        };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(containerRef.current);

        cleanup = () => {
          ro.disconnect();
          chart.remove();
        };
      } catch (e) {
        console.error("[SignalPriceChart]", e);
        if (!disposed) setState("error");
      }
    }

    init();
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [signalId, entryPrice, takeProfit1, takeProfit2, takeProfit3, stopLoss]);

  if (state === "unsupported") return null; // 해외주식 등 — 차트 없이 기존 화면 유지

  return (
    <Card className="bg-[#1A1D26] border-[#2A2D36] p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-[#8B95A5] uppercase tracking-wider flex items-center gap-1.5">
          <CandlestickChart className="w-3.5 h-3.5" />
          가격 차트
        </h3>
        {intervalLabel && <span className="text-[10px] text-[#8B95A5]">{intervalLabel}</span>}
      </div>

      {state === "loading" && (
        <div className="h-[260px] flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-[#F5B800]" />
        </div>
      )}
      {state === "error" && (
        <div className="h-[120px] flex items-center justify-center">
          <p className="text-xs text-[#8B95A5]">차트를 불러오지 못했습니다</p>
        </div>
      )}
      <div ref={containerRef} className={state === "ready" ? "" : "h-0 overflow-hidden"} />

      {state === "ready" && (
        <div className="flex items-center gap-3 mt-2 text-[9px] text-[#8B95A5]">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 bg-[#F5B800]" /> 진입가
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 border-t border-dashed border-[#00E676]" /> 목표가
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 border-t border-dashed border-[#FF5252]" /> 손절가
          </span>
        </div>
      )}
    </Card>
  );
}
