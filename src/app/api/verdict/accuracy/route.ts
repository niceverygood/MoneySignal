// ============================================
// AI 적중률 집계 API
// verdict_picks의 채점 결과를 적중률(수익률>0 비율) + 평균 수익률로 집계
// "집계 중" 상태를 위해 표본 수(count)도 함께 반환
// ============================================
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

interface PickRow {
  return_7d: number | null;
  return_30d: number | null;
  is_unanimous: boolean | null;
}

function aggregate(values: number[]) {
  if (values.length === 0) return null;
  const hits = values.filter((v) => v > 0).length;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return {
    count: values.length,
    hitRate: Math.round((hits / values.length) * 100),
    avgReturn: Math.round(avg * 10) / 10,
  };
}

export async function GET() {
  const supabase = await createServiceClient();

  const empty = { d7: null, d30: null, d7Unanimous: null, totalScored: 0 };

  const { data, error } = await supabase
    .from("verdict_picks")
    .select("return_7d, return_30d, is_unanimous")
    .order("verdict_date", { ascending: false })
    .limit(1000);

  // 테이블 미생성(마이그레이션 전)이나 일시 오류 시에도 UI가 안 깨지게 빈 결과 반환
  if (error) {
    return NextResponse.json(empty);
  }

  const picks = (data || []) as PickRow[];
  const r7 = picks.map((p) => p.return_7d).filter((v): v is number => v != null);
  const r30 = picks.map((p) => p.return_30d).filter((v): v is number => v != null);
  // 만장일치 픽만의 7일 성과 (만장일치가 정말 더 잘 맞는가 검증용)
  const r7Unanimous = picks
    .filter((p) => p.is_unanimous)
    .map((p) => p.return_7d)
    .filter((v): v is number => v != null);

  return NextResponse.json({
    d7: aggregate(r7),
    d30: aggregate(r30),
    d7Unanimous: aggregate(r7Unanimous),
    totalScored: r7.length,
  });
}
