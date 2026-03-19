export const metadata = {
  title: '이용약관 | MoneySignal',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-ms-bg text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-ms-gold mb-8">이용약관</h1>
        <p className="text-sm text-ms-secondary mb-8">최종 수정일: 2026년 3월 19일</p>

        <div className="space-y-8 text-ms-secondary leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제1조 (목적)</h2>
            <p>이 약관은 MoneySignal(이하 &quot;서비스&quot;)의 이용 조건 및 절차, 이용자와 서비스 제공자의 권리·의무·책임 사항을 규정함을 목적으로 합니다.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제2조 (정의)</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>&quot;서비스&quot;</strong>란 AI 기반 매수 시그널, 시장 분석, 리포트 등 MoneySignal이 제공하는 모든 서비스를 의미합니다.</li>
              <li><strong>&quot;이용자&quot;</strong>란 서비스에 가입하여 이용하는 자를 의미합니다.</li>
              <li><strong>&quot;파트너&quot;</strong>란 서비스를 통해 자체 브랜드로 시그널 상품을 판매하는 자를 의미합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제3조 (약관의 효력)</h2>
            <p>본 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력이 발생합니다. 약관을 변경할 경우 적용일 7일 전부터 공지합니다.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제4조 (회원 가입)</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>이용자는 이메일과 비밀번호로 회원 가입할 수 있습니다.</li>
              <li>허위 정보로 가입한 경우 서비스 이용이 제한될 수 있습니다.</li>
              <li>만 18세 미만은 서비스를 이용할 수 없습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제5조 (서비스 내용)</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>AI 기반 코인/주식/선물 매수 시그널 제공</li>
              <li>시장 센티먼트 분석 및 일일/주간 리포트</li>
              <li>멀티모델 AI 합의 종목 추천</li>
              <li>AI 종목 질문 (Ask AI)</li>
              <li>백테스트 실적 제공</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제6조 (유료 서비스 및 결제)</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>유료 구독은 월간/분기/연간 단위로 제공됩니다.</li>
              <li>결제는 신용카드 등 PG사를 통해 처리됩니다.</li>
              <li>자동 갱신 구독은 만료일에 자동으로 결제됩니다.</li>
              <li>환불은 관련 법령 및 서비스 환불 정책에 따릅니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제7조 (이용자의 의무)</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>계정 정보를 안전하게 관리할 의무가 있습니다.</li>
              <li>서비스 내 정보를 무단으로 복제·배포할 수 없습니다.</li>
              <li>타인의 권리를 침해하거나 법령을 위반하는 행위를 할 수 없습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제8조 (서비스 중단)</h2>
            <p>서비스는 시스템 점검, 장애, 천재지변 등 불가피한 사유로 일시 중단될 수 있으며, 사전 공지를 원칙으로 합니다.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제9조 (면책)</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>서비스가 제공하는 시그널 및 분석은 <strong>투자 자문이 아닙니다.</strong></li>
              <li>투자 판단의 책임은 전적으로 이용자에게 있습니다.</li>
              <li>서비스는 시그널의 정확성이나 수익을 보장하지 않습니다.</li>
              <li>이용자의 투자 손실에 대해 서비스는 책임을 지지 않습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제10조 (회원 탈퇴 및 자격 상실)</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>이용자는 언제든지 탈퇴를 요청할 수 있습니다.</li>
              <li>약관을 위반한 경우 서비스 이용이 제한되거나 회원 자격이 상실될 수 있습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제11조 (분쟁 해결)</h2>
            <p>서비스 이용과 관련한 분쟁은 대한민국 법률에 따르며, 관할 법원은 서비스 제공자의 소재지 법원으로 합니다.</p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-ms-border">
          <a href="/" className="text-ms-gold hover:underline">← 홈으로 돌아가기</a>
        </div>
      </div>
    </div>
  );
}
