import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { cancelPayment } from "@/lib/portone";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const serviceClient = await createServiceClient();

  // 1. 관리자 인증
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await serviceClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "관리자만 접근 가능합니다" }, { status: 403 });
  }

  // 2. 입력 검증
  const { transactionId, reason } = await request.json();
  if (!transactionId || !reason) {
    return NextResponse.json({ error: "필수 정보 누락 (transactionId, reason)" }, { status: 400 });
  }

  // 3. 원래 트랜잭션 조회
  const { data: transaction } = await serviceClient
    .from("transactions")
    .select("*")
    .eq("id", transactionId)
    .single();

  if (!transaction) {
    return NextResponse.json({ error: "거래를 찾을 수 없습니다" }, { status: 404 });
  }

  if (transaction.status === "cancelled") {
    return NextResponse.json(
      { error: "이미 환불 처리된 거래입니다" },
      { status: 409 }
    );
  }

  if (transaction.type !== "subscription_payment" || transaction.status !== "completed") {
    return NextResponse.json(
      { error: "환불 가능한 거래가 아닙니다 (completed 상태의 구독 결제만 환불 가능)" },
      { status: 400 }
    );
  }

  console.log(`[AUDIT] Admin ${user.id} initiated refund for transaction ${transactionId}, reason: ${reason}`);

  try {
    // 4. PortOne 결제 취소
    if (transaction.pg_transaction_id) {
      const cancelResult = await cancelPayment({
        paymentId: transaction.pg_transaction_id,
        reason,
      });

      if (!cancelResult.success) {
        return NextResponse.json(
          { error: cancelResult.failureReason || "PG 취소 실패" },
          { status: 400 }
        );
      }
    }

    // 5. 원래 트랜잭션 cancelled 처리
    await serviceClient
      .from("transactions")
      .update({ status: "cancelled" })
      .eq("id", transactionId);

    // 6. 환불 트랜잭션 기록
    await serviceClient.from("transactions").insert({
      type: "refund",
      user_id: transaction.user_id,
      partner_id: transaction.partner_id,
      amount: transaction.amount,
      currency: transaction.currency || "KRW",
      status: "completed",
      payment_method: "refund",
      pg_transaction_id: transaction.pg_transaction_id,
      description: `환불: ${reason}`,
    });

    // 7. 구독 취소
    if (transaction.user_id) {
      await serviceClient
        .from("subscriptions")
        .update({
          status: "cancelled",
          auto_renew: false,
          next_billing_at: null,
        })
        .eq("user_id", transaction.user_id)
        .eq("status", "active");

      // 프로필 free 전환
      await serviceClient
        .from("profiles")
        .update({
          subscription_tier: "free",
          subscription_expires_at: null,
        })
        .eq("id", transaction.user_id);

      // 빌링키 비활성화
      await serviceClient
        .from("billing_keys")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("user_id", transaction.user_id);

      // 사용자 알림
      await serviceClient.from("notifications").insert({
        user_id: transaction.user_id,
        type: "subscription",
        title: "환불 완료",
        body: `${transaction.amount.toLocaleString()}원이 환불 처리되었습니다. 사유: ${reason}`,
      });
    }

    return NextResponse.json({
      success: true,
      refundedAmount: transaction.amount,
    });
  } catch (error) {
    console.error("[billing/refund] Error:", error);
    return NextResponse.json(
      { error: "환불 처리 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
