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
import { Loader2, MessageCircle, Check, X } from "lucide-react";
import { toast } from "sonner";

function generateKoreanNickname(): string {
  const adjectives = [
    "빛나는", "용감한", "현명한", "행운의", "날렵한", "든든한",
    "재빠른", "슬기로운", "당당한", "활기찬", "꾸준한", "씩씩한",
    "영리한", "담대한", "부지런한", "신중한", "멋진", "빠른",
    "똒똑한", "차분한", "대담한", "지혜로운", "열정의", "냉철한",
  ];
  const animals = [
    "호랑이", "독수리", "돌고래", "사자", "늑대", "매",
    "용", "표범", "불사조", "고래", "곰", "여우",
    "판다", "코끼리", "올빼미", "치타", "수달", "펭귄",
    "해달", "기린", "코브라", "상어", "까마귀", "학",
  ];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}${animal}${num}`;
}

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

  // 닉네임 중복검사
  const [nicknameStatus, setNicknameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [nicknameChecked, setNicknameChecked] = useState(false);

  // 이메일 중복검사
  const [emailStatus, setEmailStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [emailChecked, setEmailChecked] = useState(false);

  const handleCheckNickname = async () => {
    const name = displayName.trim();
    if (!name || name.length < 2) {
      toast.error("닉네임은 2자 이상 입력해주세요");
      return;
    }
    if (name.length > 20) {
      toast.error("닉네임은 20자 이하로 입력해주세요");
      return;
    }

    setNicknameStatus("checking");
    try {
      const res = await fetch(`/api/auth/check-nickname?nickname=${encodeURIComponent(name)}`);
      const data = await res.json();

      if (data.available) {
        setNicknameStatus("available");
        setNicknameChecked(true);
        toast.success("사용 가능한 닉네임입니다");
      } else {
        setNicknameStatus("taken");
        setNicknameChecked(false);
        toast.error(data.message || "이미 사용 중인 닉네임입니다");
      }
    } catch {
      setNicknameStatus("idle");
      toast.error("닉네임 확인 중 오류가 발생했습니다");
    }
  };

  const handleCheckEmail = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error("올바른 이메일 형식을 입력해주세요");
      return;
    }

    setEmailStatus("checking");
    try {
      // Supabase signUp으로 이미 가입된 이메일인지 확인하지 않고,
      // 직접 profiles 테이블에서 확인 (공개 조회 불가이므로 API 사용)
      const res = await fetch(`/api/auth/check-email?email=${encodeURIComponent(trimmedEmail)}`);
      const data = await res.json();

      if (data.available) {
        setEmailStatus("available");
        setEmailChecked(true);
        toast.success("사용 가능한 이메일입니다");
      } else {
        setEmailStatus("taken");
        setEmailChecked(false);
        toast.error(data.message || "이미 가입된 이메일입니다");
      }
    } catch {
      setEmailStatus("idle");
      toast.error("이메일 확인 중 오류가 발생했습니다");
    }
  };

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

    const finalName = displayName.trim() || generateKoreanNickname();

    // 닉네임 입력했는데 중복검사 안 한 경우
    if (displayName.trim() && !nicknameChecked) {
      toast.error("닉네임 중복검사를 먼저 해주세요");
      return;
    }

    // 이메일 중복검사 안 한 경우
    if (!emailChecked) {
      toast.error("이메일 중복검사를 먼저 해주세요");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: finalName,
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

      if (referredBy) {
        localStorage.setItem("moneysignal_referred_by", referredBy);
      }

      if (data.session) {
        toast.success("가입 완료! 환영합니다 🎉");
        router.push(redirectTo);
      } else if (data.user && !data.session) {
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
    } catch {
      toast.error("카카오 로그인 연결에 실패했습니다.");
      setKakaoLoading(false);
    }
  };

  // 닉네임/이메일 변경 시 검사 상태 초기화
  const handleNicknameChange = (value: string) => {
    setDisplayName(value);
    setNicknameStatus("idle");
    setNicknameChecked(false);
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setEmailStatus("idle");
    setEmailChecked(false);
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
            {/* 닉네임 + 중복검사 */}
            <div>
              <Label className="text-[#8B95A5]">닉네임</Label>
              <div className="flex gap-2 mt-1.5">
                <div className="relative flex-1">
                  <Input
                    value={displayName}
                    onChange={(e) => handleNicknameChange(e.target.value)}
                    placeholder="2~20자 (미입력시 자동생성)"
                    className="bg-[#22262F] border-[#2A2D36] text-white pr-8"
                    maxLength={20}
                  />
                  {nicknameStatus === "available" && (
                    <Check className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                  )}
                  {nicknameStatus === "taken" && (
                    <X className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCheckNickname}
                  disabled={nicknameStatus === "checking" || !displayName.trim() || displayName.trim().length < 2}
                  className="shrink-0 border-[#2A2D36] text-[#8B95A5] hover:text-white hover:bg-[#22262F] text-xs px-3"
                >
                  {nicknameStatus === "checking" ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    "중복검사"
                  )}
                </Button>
              </div>
              {nicknameStatus === "available" && (
                <p className="text-xs text-green-500 mt-1">사용 가능한 닉네임입니다</p>
              )}
              {nicknameStatus === "taken" && (
                <p className="text-xs text-red-500 mt-1">이미 사용 중인 닉네임입니다</p>
              )}
            </div>

            {/* 이메일 + 중복검사 */}
            <div>
              <Label className="text-[#8B95A5]">이메일 *</Label>
              <div className="flex gap-2 mt-1.5">
                <div className="relative flex-1">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    placeholder="your@email.com"
                    className="bg-[#22262F] border-[#2A2D36] text-white pr-8"
                    required
                  />
                  {emailStatus === "available" && (
                    <Check className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                  )}
                  {emailStatus === "taken" && (
                    <X className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCheckEmail}
                  disabled={emailStatus === "checking" || !email.trim()}
                  className="shrink-0 border-[#2A2D36] text-[#8B95A5] hover:text-white hover:bg-[#22262F] text-xs px-3"
                >
                  {emailStatus === "checking" ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    "중복검사"
                  )}
                </Button>
              </div>
              {emailStatus === "available" && (
                <p className="text-xs text-green-500 mt-1">사용 가능한 이메일입니다</p>
              )}
              {emailStatus === "taken" && (
                <p className="text-xs text-red-500 mt-1">이미 가입된 이메일입니다</p>
              )}
            </div>

            {/* 비밀번호 */}
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
              disabled={loading || !email || !password || password.length < 6 || !emailChecked}
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
