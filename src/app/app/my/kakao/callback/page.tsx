"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function KakaoCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      setErrorMsg("카카오 로그인이 취소되었습니다.");
      setStatus("error");
      return;
    }

    if (!code) {
      setErrorMsg("인증 코드를 받지 못했습니다.");
      setStatus("error");
      return;
    }

    // Call our connect API (redirect_uri must match exactly what was used in OAuth request)
    const redirectUri = `${window.location.origin}/app/my/kakao/callback`;
    fetch("/api/kakao/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, redirectUri }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.success) {
          setStatus("success");
          // Auto-redirect after 2 seconds
          setTimeout(() => router.push("/app/my"), 2000);
        } else {
          setErrorMsg(data.error || "연동에 실패했습니다.");
          setStatus("error");
        }
      })
      .catch(() => {
        setErrorMsg("서버 오류가 발생했습니다. 다시 시도해주세요.");
        setStatus("error");
      });
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-[#0D0F14] flex items-center justify-center p-4">
      <div className="max-w-sm w-full text-center space-y-6">
        {status === "loading" && (
          <>
            <div className="w-16 h-16 rounded-full bg-[#FEE500]/10 flex items-center justify-center mx-auto">
              <Loader2 className="w-8 h-8 text-[#FEE500] animate-spin" />
            </div>
            <div>
              <p className="text-white font-semibold text-lg">카카오 연동 중</p>
              <p className="text-[#8B95A5] text-sm mt-1">잠시만 기다려주세요...</p>
            </div>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-16 h-16 rounded-full bg-[#00E676]/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-[#00E676]" />
            </div>
            <div>
              <p className="text-white font-semibold text-lg">카카오 연동 완료!</p>
              <p className="text-[#8B95A5] text-sm mt-1">
                이제 AI 시그널을 카카오톡으로 받을 수 있습니다.
              </p>
            </div>
            <p className="text-xs text-[#8B95A5]">잠시 후 내 정보 페이지로 이동합니다...</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-16 h-16 rounded-full bg-[#FF5252]/10 flex items-center justify-center mx-auto">
              <XCircle className="w-8 h-8 text-[#FF5252]" />
            </div>
            <div>
              <p className="text-white font-semibold text-lg">연동 실패</p>
              <p className="text-[#8B95A5] text-sm mt-1">{errorMsg}</p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => router.push("/app/my/kakao")}
                className="bg-[#FEE500] hover:bg-[#FFD700] text-[#3C1E1E] font-semibold"
              >
                다시 시도
              </Button>
              <Button
                variant="ghost"
                onClick={() => router.push("/app/my")}
                className="text-[#8B95A5] hover:text-white"
              >
                내 정보로
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
