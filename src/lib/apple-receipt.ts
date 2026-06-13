// ============================================
// Apple StoreKit2 JWS(JWSTransaction) 서버 검증 — 검토 완료 / 미연결(NOT WIRED)
//
// ⚠️ 이 모듈은 아직 iap/verify 결제 경로에 연결되어 있지 않습니다.
//    적대적 코드리뷰에서 다음이 확인되어, 안전 연결 전 선행 조건이 있습니다:
//    1) 루트 인증서 지문(APPLE_ROOT_CA_G3_SHA256)을 Apple 공식 PKI 문서에서
//       직접 확인해 환경변수로 설정할 것. (하드코딩 금지 — 틀리면 전 결제 거부)
//    2) JWSTransaction payload의 expiresDate/purchaseDate 단위(밀리초 epoch) 확인.
//    3) 연결 시: jwsRepresentation을 '항상 필수'로 요구하고, payload의
//       transactionId/bundleId/productId가 '존재하고 일치'할 때만 통과시킬 것.
//       (없거나 불일치 = 위조로 간주해 거부)
//    4) TestFlight 실기기 결제로 정상 통과 확인 후 운영 적용.
//
// 본 모듈은 fail-closed: 지문 env 미설정 시 무조건 invalid를 반환한다.
// ============================================
import { X509Certificate } from "node:crypto";
import { compactVerify, importX509 } from "jose";

export interface AppleTransactionPayload {
  transactionId?: string;
  originalTransactionId?: string;
  bundleId?: string;
  productId?: string;
  purchaseDate?: number;  // epoch ms (확인 필요)
  expiresDate?: number;   // epoch ms (확인 필요)
  type?: string;
  [k: string]: unknown;
}

export interface JWSVerifyResult {
  valid: boolean;
  reason?: string;
  payload?: AppleTransactionPayload;
}

function normalizeFp(fp: string): string {
  return fp.replace(/:/g, "").toLowerCase();
}

export async function verifyAppleJWS(jws: string): Promise<JWSVerifyResult> {
  try {
    // fail-closed: 검증된 루트 지문이 명시적으로 설정되지 않으면 통과시키지 않는다.
    const expectedRootFp = process.env.APPLE_ROOT_CA_G3_SHA256;
    if (!expectedRootFp) {
      return { valid: false, reason: "root_fingerprint_not_configured" };
    }

    const parts = jws.split(".");
    if (parts.length !== 3) return { valid: false, reason: "malformed_jws" };

    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (header.alg !== "ES256") return { valid: false, reason: "bad_alg" };
    if (!Array.isArray(header.x5c) || header.x5c.length < 2) {
      return { valid: false, reason: "no_cert_chain" };
    }

    // 1) x5c → X509 인증서 체인
    const certs: X509Certificate[] = header.x5c.map(
      (b64: string) => new X509Certificate(Buffer.from(b64, "base64"))
    );
    const leaf = certs[0];
    const root = certs[certs.length - 1];

    // 2) 체인 연결: cert[i]가 cert[i+1]로 서명됨
    for (let i = 0; i < certs.length - 1; i++) {
      if (!certs[i].verify(certs[i + 1].publicKey)) {
        return { valid: false, reason: "broken_chain" };
      }
    }

    // 3) 모든 인증서 유효기간 (leaf·intermediate·root 전부)
    const now = Date.now();
    for (const c of certs) {
      if (now < Date.parse(c.validFrom) || now > Date.parse(c.validTo)) {
        return { valid: false, reason: "cert_expired" };
      }
    }

    // 4) root: self-signed + Apple Root CA - G3 지문(유일한 신뢰 앵커)
    if (!root.verify(root.publicKey)) {
      return { valid: false, reason: "root_not_selfsigned" };
    }
    if (normalizeFp(root.fingerprint256) !== normalizeFp(expectedRootFp)) {
      return { valid: false, reason: "untrusted_root_fingerprint" };
    }

    // 5) leaf 공개키로 JWS 서명 검증
    const leafKey = await importX509(leaf.toString(), "ES256");
    const { payload: payloadBytes } = await compactVerify(jws, leafKey);
    const payload = JSON.parse(
      new TextDecoder().decode(payloadBytes)
    ) as AppleTransactionPayload;

    return { valid: true, payload };
  } catch (e) {
    return { valid: false, reason: e instanceof Error ? e.message : "verify_error" };
  }
}
