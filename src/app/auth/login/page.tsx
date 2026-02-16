"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2, MessageCircle, Mail } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0D0F14]" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/app";
  const message = searchParams.get("message");
  const supabase = createClient();

  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [kakaoLoading, setKakaoLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("이메일과 비밀번호를 입력해주세요");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login")) {
          toast.error("이메일 또는 비밀번호가 올바르지 않습니다");
        } else if (error.message.includes("Email not confirmed")) {
          toast.error("이메일 인증이 필요합니다. 메일함을 확인해주세요.");
        } else {
          toast.error(error.message);
        }
        setLoading(false);
        return;
      }

      toast.success("로그인 성공!");
      router.push(redirectTo);
    } catch {
      toast.error("로그인 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleKakaoLogin = async () => {
    setKakaoLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "kakao",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
        },
      });

      if (error) {
        if (error.message.includes("not enabled") || error.message.includes("unsupported")) {
          toast.error("카카오 로그인 준비 중입니다. 이메일로 로그인해주세요.");
        } else {
          toast.error(error.message);
        }
        setKakaoLoading(false);
      }
    } catch {
      toast.error("카카오 로그인 연결에 실패했습니다.");
      setKakaoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0F14] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-gold-gradient">
            MONEY SIGNAL
          </Link>
          <p className="text-sm text-[#8B95A5] mt-2">
            AI 매수 시그널 서비스에 로그인
          </p>
        </div>

        {/* Email confirmation message */}
        {message === "confirm_email" && (
          <div className="mb-4 p-3 rounded-lg bg-[#F5B800]/10 border border-[#F5B800]/20">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#F5B800]" />
              <p className="text-xs text-[#F5B800]">
                확인 이메일을 보냈습니다. 메일함에서 링크를 클릭한 후 로그인해주세요.
              </p>
            </div>
          </div>
        )}

        <Card className="bg-[#1A1D26] border-[#2A2D36] p-6">
          {/* Kakao Login First (primary) */}
          <Button
            onClick={handleKakaoLogin}
            disabled={kakaoLoading}
            className="w-full bg-[#FEE500] text-[#191919] hover:bg-[#FEE500]/90 font-semibold h-11"
          >
            {kakaoLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <MessageCircle className="w-5 h-5 mr-2" />
            )}
            카카오로 로그인
          </Button>

          <div className="my-5 flex items-center gap-3">
            <Separator className="flex-1 bg-[#2A2D36]" />
            <span className="text-xs text-[#8B95A5]">또는</span>
            <Separator className="flex-1 bg-[#2A2D36]" />
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <Label className="text-[#8B95A5]">이메일</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="bg-[#22262F] border-[#2A2D36] text-white mt-1.5"
              />
            </div>
            <div>
              <Label className="text-[#8B95A5]">비밀번호</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-[#22262F] border-[#2A2D36] text-white mt-1.5"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F] font-semibold"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              이메일로 로그인
            </Button>
          </form>
        </Card>

        <p className="text-center text-sm text-[#8B95A5] mt-4">
          계정이 없으신가요?{" "}
          <Link
            href={`/auth/signup?redirectTo=${encodeURIComponent(redirectTo)}`}
            className="text-[#F5B800] hover:underline"
          >
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
