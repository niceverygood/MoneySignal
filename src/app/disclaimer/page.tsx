export const metadata = {
  title: '투자 주의사항 | MoneySignal',
};

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen bg-ms-bg text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-ms-gold mb-8">투자 주의사항</h1>
        <p className="text-sm text-ms-secondary mb-8">최종 수정일: 2026년 3월 19일</p>

        <div className="space-y-8 text-ms-secondary leading-relaxed">
          <section className="bg-ms-card border border-ms-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-[#FF5252] mb-3">중요 안내</h2>
            <p className="text-white">MoneySignal이 제공하는 모든 정보(AI 시그널, 분석, 리포트 등)는 <strong>투자 참고 자료</strong>이며, <strong>투자 자문이나 권유가 아닙니다.</strong></p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. 투자 위험 고지</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>암호화폐, 주식, 선물 등 금융 상품의 거래는 <strong>원금 손실의 위험</strong>이 있습니다.</li>
              <li>레버리지 거래(선물)는 투자 원금을 초과하는 손실이 발생할 수 있습니다.</li>
              <li>과거의 수익률이 미래의 수익을 보장하지 않습니다.</li>
              <li>시장 상황에 따라 급격한 가격 변동이 발생할 수 있습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. AI 시그널의 한계</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>AI 시그널은 알고리즘에 의해 생성되며, <strong>정확성을 100% 보장하지 않습니다.</strong></li>
              <li>시장의 급변, 돌발 뉴스, 블랙스완 이벤트 등은 AI가 예측하기 어렵습니다.</li>
              <li>시그널의 TP(목표가)와 SL(손절가)은 참고 수준이며, 실제 체결가와 차이가 있을 수 있습니다.</li>
              <li>백테스트 결과는 과거 데이터 기반이며, 실제 거래 결과와 다를 수 있습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. 이용자 책임</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>모든 투자 판단과 결과에 대한 책임은 <strong>전적으로 이용자 본인</strong>에게 있습니다.</li>
              <li>MoneySignal은 이용자의 투자 손실에 대해 어떠한 법적 책임도 지지 않습니다.</li>
              <li>반드시 <strong>여유 자금</strong>으로 투자하시기 바랍니다.</li>
              <li>투자 결정 전 반드시 본인의 판단을 거치시기 바랍니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. 권장 사항</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>분산 투자를 통해 리스크를 관리하세요.</li>
              <li>손절 라인(SL)을 반드시 설정하고 준수하세요.</li>
              <li>전체 자산의 일정 비율 이상을 한 종목에 투자하지 마세요.</li>
              <li>필요시 공인 투자자문사의 상담을 받으세요.</li>
            </ul>
          </section>

          <section className="bg-ms-card border border-ms-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-3">관련 법률 안내</h2>
            <p>본 서비스는 「자본시장과 금융투자업에 관한 법률」에 따른 투자자문업 또는 투자일임업에 해당하지 않습니다. 서비스가 제공하는 정보는 불특정 다수를 대상으로 한 일반적인 정보 제공에 해당합니다.</p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-ms-border">
          <a href="/" className="text-ms-gold hover:underline">← 홈으로 돌아가기</a>
        </div>
      </div>
    </div>
  );
}
