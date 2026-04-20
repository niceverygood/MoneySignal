import { Capacitor } from "@capacitor/core";
import { SignInWithApple, type SignInWithAppleResponse } from "@capacitor-community/apple-sign-in";
import { createClient } from "@/lib/supabase/client";

const CLIENT_ID = "app.moneysignal.kr";
const REDIRECT_URI = "https://money-signal.vercel.app/auth/callback";

function generateNonce(length = 32): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function signInWithAppleNative(): Promise<{ ok: boolean; error?: string }> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") {
    return { ok: false, error: "네이티브 iOS에서만 사용 가능합니다" };
  }

  const rawNonce = generateNonce();
  const hashedNonce = await sha256Hex(rawNonce);

  let result: SignInWithAppleResponse;
  try {
    result = await SignInWithApple.authorize({
      clientId: CLIENT_ID,
      redirectURI: REDIRECT_URI,
      scopes: "email name",
      nonce: hashedNonce,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes("canceled") || msg.toLowerCase().includes("cancelled")) {
      return { ok: false, error: "로그인이 취소되었습니다" };
    }
    return { ok: false, error: `Apple 로그인 실패: ${msg}` };
  }

  const identityToken = result.response?.identityToken;
  if (!identityToken) {
    return { ok: false, error: "Apple identity token이 반환되지 않았습니다" };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: identityToken,
    nonce: rawNonce,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (result.response.givenName || result.response.familyName) {
    const fullName = [result.response.givenName, result.response.familyName]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (fullName) {
      await supabase.auth.updateUser({ data: { full_name: fullName } });
    }
  }

  return { ok: true };
}
