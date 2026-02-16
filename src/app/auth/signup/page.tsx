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
import { Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0D0F14]" />}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/app";
  const referredBy = searchParams.get("ref");
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [kakaoLoading, setKakaoLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("이메일과 비밀번호를 입력해주세요");
      return;
    }
    if (password.length < 6) {
      toast.error("비밀번호는 6자 이상이어야 합니다");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName || email.split("@")[0],
          },
          emailRedirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast.error("이미 가입된 이메일입니다. 로그인해주세요.");
        } else {
          toast.error(error.message);
        }
        setLoading(false);
        return;
      }

      // If referred_by, store for later
      if (referredBy) {
        localStorage.setItem("moneysignal_referred_by", referredBy);
      }

      // Check if email confirmation is required
      if (data.session) {
        // Auto-confirmed (email confirmation disabled in Supabase)
        toast.success("가입 완료! 환영합니다 🎉");
        router.push(redirectTo);
      } else if (data.user && !data.session) {
        // Email confirmation required
        toast.success("가입 완료! 이메일에서 확인 링크를 클릭해주세요.", {
          duration: 8000,
        });
        router.push(`/auth/login?message=confirm_email&email=${encodeURIComponent(email)}`);
      }
    } catch (err) {
      console.error("Signup error:", err);
      toast.error("회원가입 중 오류가 발생했습니다. 다시 시도해주세요.");
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
          toast.error("카카오 로그인 준비 중입니다. 이메일로 가입해주세요.");
        } else {
          toast.error(error.message);
        }
        setKakaoLoading(false);
      }
      // If no error, browser will redirect to Kakao
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
            무료 회원가입으로 시작하세요
          </p>
        </div>

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
            카카오로 3초만에 시작하기
          </Button>

          <div className="my-5 flex items-center gap-3">
            <Separator className="flex-1 bg-[#2A2D36]" />
            <span className="text-xs text-[#8B95A5]">또는 이메일로 가입</span>
            <Separator className="flex-1 bg-[#2A2D36]" />
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <Label className="text-[#8B95A5]">닉네임</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="표시될 이름"
                className="bg-[#22262F] border-[#2A2D36] text-white mt-1.5"
              />
            </div>
            <div>
              <Label className="text-[#8B95A5]">이메일 *</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="bg-[#22262F] border-[#2A2D36] text-white mt-1.5"
                required
              />
            </div>
            <div>
              <Label className="text-[#8B95A5]">비밀번호 *</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6자 이상"
                className="bg-[#22262F] border-[#2A2D36] text-white mt-1.5"
                required
                minLength={6}
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#F5B800] text-[#0D0F14] hover:bg-[#FFD54F] font-semibold"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              이메일로 회원가입
            </Button>
          </form>
        </Card>

        <p className="text-center text-sm text-[#8B95A5] mt-4">
          이미 계정이 있으신가요?{" "}
          <Link href="/auth/login" className="text-[#F5B800] hover:underline">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
