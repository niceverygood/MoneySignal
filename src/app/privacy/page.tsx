export const metadata = {
  title: '개인정보처리방침 | MoneySignal',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-ms-bg text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-ms-gold mb-8">개인정보처리방침</h1>
        <p className="text-sm text-ms-secondary mb-8">최종 수정일: 2026년 3월 19일</p>

        <div className="space-y-8 text-ms-secondary leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. 개인정보의 수집 및 이용 목적</h2>
            <p>MoneySignal(이하 &quot;서비스&quot;)은 다음의 목적을 위해 개인정보를 수집·이용합니다.</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>회원 가입 및 관리: 본인 확인, 서비스 이용 의사 확인</li>
              <li>서비스 제공: AI 매수 시그널, 리포트, 알림 발송</li>
              <li>결제 및 정산: 유료 구독 결제 처리, 환불</li>
              <li>고객 지원: 문의 대응, 공지사항 전달</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. 수집하는 개인정보 항목</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>필수:</strong> 이메일 주소, 비밀번호(암호화 저장)</li>
              <li><strong>자동 수집:</strong> 접속 IP, 접속 일시, 기기 정보, 쿠키</li>
              <li><strong>결제 시:</strong> 결제 수단 정보(카드사, 빌링키 — PG사에서 관리)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. 개인정보의 보유 및 이용 기간</h2>
            <p>회원 탈퇴 시 즉시 파기합니다. 단, 관련 법령에 따라 아래 기간 동안 보존합니다.</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>계약 또는 청약 철회 기록: 5년 (전자상거래법)</li>
              <li>대금 결제 및 재화 공급 기록: 5년 (전자상거래법)</li>
              <li>소비자 불만·분쟁 처리 기록: 3년 (전자상거래법)</li>
              <li>접속 기록: 3개월 (통신비밀보호법)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. 개인정보의 제3자 제공</h2>
            <p>서비스는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만, 다음의 경우 예외로 합니다.</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>이용자가 사전에 동의한 경우</li>
              <li>법령의 규정에 의하거나 수사 목적으로 법령에 정해진 절차에 따라 요청이 있는 경우</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. 개인정보의 위탁</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Supabase Inc.</strong> — 데이터베이스 호스팅, 인증</li>
              <li><strong>PortOne (포트원)</strong> — 결제 처리</li>
              <li><strong>Vercel Inc.</strong> — 웹 서비스 호스팅</li>
              <li><strong>알리고</strong> — 알림톡 발송</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. 이용자의 권리</h2>
            <p>이용자는 언제든지 다음 권리를 행사할 수 있습니다.</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>개인정보 열람, 정정, 삭제, 처리 정지 요구</li>
              <li>회원 탈퇴 (서비스 내 설정 또는 이메일 요청)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. 개인정보 보호책임자</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>담당: MoneySignal 운영팀</li>
              <li>이메일: hss@bottlecorp.kr</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. 개인정보의 안전성 확보 조치</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>비밀번호 암호화 저장 (bcrypt)</li>
              <li>SSL/TLS 암호화 통신</li>
              <li>접근 권한 최소화 및 관리</li>
              <li>개인정보 접속 기록 보관</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. 쿠키의 사용</h2>
            <p>서비스는 로그인 세션 유지를 위해 쿠키를 사용합니다. 브라우저 설정에서 쿠키를 거부할 수 있으나, 서비스 이용이 제한될 수 있습니다.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. 방침 변경</h2>
            <p>본 방침이 변경될 경우 시행 7일 전 공지합니다.</p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-ms-border">
          <a href="/" className="text-ms-gold hover:underline">← 홈으로 돌아가기</a>
        </div>
      </div>
    </div>
  );
}
