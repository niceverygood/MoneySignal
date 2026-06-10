# 머니시그널 1.0.1 릴리즈 노트

## App Store / Google Play 공용 (한국어)

```
이번 업데이트

• 내 종목 AI 진단 — 보유종목과 평단가를 등록하면 AI 3대장이 보유·추가매수·손절 의견을 제시해드려요
• 시그널 상세 캔들차트 — 진입가·목표가·손절가 라인을 차트에서 한눈에 확인
• 홈 화면 내 종목 손익 요약 — 앱을 열자마자 내 포트폴리오 상태가 보입니다
• 가입 온보딩 개선 — 종목 등록부터 첫 AI 진단까지 3단계로 간편하게
• 화면 표시 안정화 — 노치·안전영역 대응, 가로 넘침 수정
• 결제 안정성 개선 및 일부 오류 수정
```

## 심사 메모 (App Store 심사용, 영어)

```
What's new in this build:
- New "My Portfolio AI Diagnosis" feature: users register their holdings
  and receive AI-generated analysis (hold/buy more/reduce/cut) for reference.
- Candlestick chart on signal detail with entry/TP/SL price lines.
- Onboarding flow after signup.
- Safe-area (notch) layout fixes; native contentInset changed accordingly.
- All analysis content includes a disclaimer that it is for reference only
  and not investment advice.

Demo account: (심사 메모에 데모 계정 입력 필요 — App Store Connect 앱 심사 정보 섹션)
```

## 체크리스트
- [ ] iOS: Xcode Archive (build 13) → App Store Connect 업로드
- [ ] ASC: 버전 레코드 1.0 → 1.0.1 수정(또는 확인) + 빌드 13 선택
- [ ] ASC: 릴리즈 노트 입력 → 심사 제출
- [ ] Android: Android Studio signed .aab (versionCode 3) 생성
- [ ] Play Console: 프로덕션 새 버전 → .aab 업로드 → 출시 노트 → 검토 제출
- [ ] Supabase: portfolio 마이그레이션 실행 (제출 전 필수 — 심사자가 기능 테스트함)
