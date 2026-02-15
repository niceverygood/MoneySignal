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
import { Loader2 } from "lucide-react";
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
    const { error } = await supabase.auth.signUp({
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
      toast.error(error.message);
      setLoading(false);
      return;
    }

    // If referred_by, update profile after creation
    if (referredBy) {
      // This will be handled after email confirmation
      localStorage.setItem("moneysignal_referred_by", referredBy);
    }

    toast.success("가입 완료! 이메일을 확인해주세요.");
    router.push(redirectTo);
  };

  const handleKakaoSignup = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
      },
    });

    if (error) toast.error(error.message);
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
              회원가입
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3">
            <Separator className="flex-1 bg-[#2A2D36]" />
            <span className="text-xs text-[#8B95A5]">또는</span>
            <Separator className="flex-1 bg-[#2A2D36]" />
          </div>

          <Button
            onClick={handleKakaoSignup}
            className="w-full bg-[#FEE500] text-[#191919] hover:bg-[#FEE500]/90 font-semibold"
          >
            카카오로 시작하기
          </Button>
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
