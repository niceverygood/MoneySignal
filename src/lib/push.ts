// APNs JWT 토큰 생성 (캐시)
let cachedToken: { jwt: string; expiresAt: number } | null = null;

async function getAPNsJWT(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // 캐시된 토큰이 유효하면 재사용 (50분 유효)
  if (cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.jwt;
  }

  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const privateKey = process.env.APNS_PRIVATE_KEY;

  if (!keyId || !teamId || !privateKey) {
    throw new Error("APNs credentials not configured");
  }

  // PEM to CryptoKey
  const pemContent = privateKey.replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const keyData = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  // JWT 생성
  const header = { alg: "ES256", kid: keyId };
  const payload = { iss: teamId, iat: now };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const signatureInput = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    signatureInput
  );

  // DER signature → raw r,s (64 bytes)
  const sigArray = new Uint8Array(signature);
  let r: Uint8Array, s: Uint8Array;

  if (sigArray[0] === 0x30) {
    // DER format
    const rLen = sigArray[3];
    const rStart = 4;
    const rBytes = sigArray.slice(rStart, rStart + rLen);
    const sLen = sigArray[rStart + rLen + 1];
    const sStart = rStart + rLen + 2;
    const sBytes = sigArray.slice(sStart, sStart + sLen);

    r = rBytes.length > 32 ? rBytes.slice(rBytes.length - 32) : rBytes;
    s = sBytes.length > 32 ? sBytes.slice(sBytes.length - 32) : sBytes;

    // Pad to 32 bytes
    if (r.length < 32) {
      const padded = new Uint8Array(32);
      padded.set(r, 32 - r.length);
      r = padded;
    }
    if (s.length < 32) {
      const padded = new Uint8Array(32);
      padded.set(s, 32 - s.length);
      s = padded;
    }
  } else {
    // Already raw format (64 bytes)
    r = sigArray.slice(0, 32);
    s = sigArray.slice(32, 64);
  }

  const rawSig = new Uint8Array(64);
  rawSig.set(r, 0);
  rawSig.set(s, 32);

  const encodedSig = btoa(String.fromCharCode(...rawSig)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const jwt = `${encodedHeader}.${encodedPayload}.${encodedSig}`;

  cachedToken = { jwt, expiresAt: now + 3000 }; // 50분
  return jwt;
}

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/** APNs로 iOS 푸시 발송 */
export async function sendAPNsPush(
  deviceToken: string,
  payload: PushPayload
): Promise<boolean> {
  try {
    const jwt = await getAPNsJWT();
    const bundleId = "app.moneysignal.kr";
    const isProduction = process.env.NODE_ENV === "production";
    const host = isProduction
      ? "https://api.push.apple.com"
      : "https://api.sandbox.push.apple.com";

    const apnsPayload = {
      aps: {
        alert: { title: payload.title, body: payload.body },
        sound: "default",
        badge: 1,
      },
      ...payload.data,
    };

    const res = await fetch(`${host}/3/device/${deviceToken}`, {
      method: "POST",
      headers: {
        authorization: `bearer ${jwt}`,
        "apns-topic": bundleId,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "content-type": "application/json",
      },
      body: JSON.stringify(apnsPayload),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`[APNs] Push failed (${res.status}):`, errorBody);

      // 410 Gone = 토큰 만료, 삭제 필요
      if (res.status === 410) return false;
    }

    return res.ok;
  } catch (err) {
    console.error("[APNs] Push error:", err);
    return false;
  }
}

/** 여러 유저에게 푸시 발송 (push_tokens 테이블 기반) */
export async function sendPushToUsers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userIds: string[],
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (userIds.length === 0) return { sent: 0, failed: 0 };

  const { data: tokens } = await supabase
    .from("push_tokens")
    .select("id, user_id, token, platform")
    .in("user_id", userIds);

  if (!tokens || tokens.length === 0) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  const expiredTokenIds: string[] = [];

  for (const t of tokens) {
    if (t.platform === "ios") {
      const ok = await sendAPNsPush(t.token, payload);
      if (ok) {
        sent++;
      } else {
        failed++;
        expiredTokenIds.push(t.id);
      }
    }
    // Android FCM은 추후 추가
  }

  // 만료 토큰 정리
  if (expiredTokenIds.length > 0) {
    await supabase
      .from("push_tokens")
      .delete()
      .in("id", expiredTokenIds);
  }

  return { sent, failed };
}
