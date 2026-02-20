# MoneySignal — CLAUDE.md

## 프로젝트 개요
AI가 코인/선물/주식 매수 시그널 포착 → 파트너(리딩방 운영자)가 자기 브랜드로 구독 상품 판매 → 수익 8:2 쉐어

## 기술 스택
- **Frontend**: Next.js 16 App Router + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Auth + Realtime + Edge Functions)
- **AI**: Claude Opus 4.6 (Anthropic API) + KIS API (국내주식)
- **결제**: PortOne (이니시스 V2)
- **배포**: Vercel + Supabase

## 레포지토리
- **주 레포**: https://github.com/niceverygood/MoneySignal (niceverygood 계정)
- **복사 레포**: https://github.com/bottledev-kr/MoneySignal (bottledev 계정)
- **Git 원격**: `origin` = bottledev SSH, `niceverygood` = niceverygood SSH
- **로컬 경로**: `/Users/bottle/MoneySignal/`

## 배포
- **Vercel URL**: https://money-signal.vercel.app
- **Supabase 프로젝트**: https://efgjkkywysbxebfwmlbj.supabase.co

## 관리자 계정
- **이메일**: hss@bottlecorp.kr
- **비밀번호**: Bottle123!
- **role**: admin

## 환경변수 위치
- 로컬: `/Users/bottle/MoneySignal/.env.local`
- Vercel: Dashboard → Settings → Environment Variables

## 주요 환경변수
```
NEXT_PUBLIC_SUPABASE_URL=https://efgjkkywysbxebfwmlbj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_H9Cgg7oeuztlluNo9HwERw_TS3f5lrB
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
ANTHROPIC_API_KEY=sk-ant-api03-...
KIS_APP_KEY=PSitGLatghQ1aGCunpqgYI99LIfxZGrhW7v0
KIS_BASE_URL=https://openapi.koreainvestment.com:9443
KAKAO_REST_API_KEY=1f41a558c424355b918c6269acbdfc6f
TELEGRAM_BOT_TOKEN=(발급 후 추가)
PORTONE_STORE_ID=(PortOne 대시보드에서)
PORTONE_API_SECRET=(PortOne 대시보드에서)
```

## 폴더 구조
```
src/
├── app/
│   ├── page.tsx                    # 랜딩 페이지
│   ├── auth/login, signup, callback
│   ├── (app)/                      → /app/* (구독자용, 인증 필수)
│   │   ├── page.tsx                # 시그널 피드
│   │   ├── ask/                    # AI 종목 질문
│   │   ├── backtest/               # 백테스트 실적
│   │   ├── community/              # 커뮤니티 게시판
│   │   ├── my/                     # 내정보 + performance + telegram
│   │   ├── notifications/          # 알림
│   │   ├── reports/                # AI 리포트
│   │   ├── signals/[id]/           # 시그널 상세
│   │   └── subscribe/              # 구독 결제
│   ├── admin/                      → /admin/* (관리자 전용)
│   │   ├── page.tsx                # 관리자 대시보드 (매출/유저/파트너)
│   │   ├── partners/               # 파트너 승인/관리
│   │   ├── users/                  # 유저 관리
│   │   ├── signals/                # 시그널 관리
│   │   ├── revenue/                # 전체 매출
│   │   ├── withdrawals/            # 출금 승인
│   │   └── backtest/               # 백테스트 관리
│   ├── partner/                    → /partner/* (파트너 전용)
│   │   ├── dashboard/
│   │   ├── products/
│   │   ├── subscribers/
│   │   ├── revenue/                # 파트너 수익/정산
│   │   ├── withdraw/               # 출금 신청
│   │   └── settings/
│   ├── p/[slug]/                   # 파트너 공개 페이지
│   └── api/
│       ├── cron/generate-signals   # 4h 시그널 생성 (Claude Opus)
│       ├── cron/track-signals      # 30m TP/SL 추적
│       ├── cron/calculate-backtest # 매일 백테스트 재계산
│       ├── cron/weekly-report      # 주간 리포트
│       ├── cron/daily-briefing     # 일일 브리핑
│       ├── subscribe/              # 구독 처리 + 수익 분배
│       ├── payment/verify/         # PortOne 결제 검증
│       ├── ai-ask/                 # AI 종목 질문
│       ├── telegram/webhook/       # 텔레그램 봇 webhook
│       └── signals/export/         # CSV 내보내기
├── lib/
│   ├── supabase/                   # client.ts, server.ts
│   ├── claude.ts                   # Claude Opus 호출
│   ├── binance.ts                  # Binance API
│   ├── kis.ts                      # 한국투자증권 API
│   ├── telegram.ts                 # 텔레그램 메시지 포맷/발송
│   ├── portone.ts                  # PortOne 결제
│   ├── tier-access.ts              # 등급별 접근 제어
│   └── symbol-detector.ts         # 종목명→심볼 매핑
└── types/index.ts
```

## DB 테이블 (10개)
1. **profiles** — 유저 (role: user/partner/admin, subscription_tier)
2. **partners** — 파트너 (brand_slug, referral_code, revenue_share_rate, available_balance)
3. **products** — 파트너 상품
4. **subscriptions** — 구독 기록
5. **signals** — AI 시그널
6. **signal_tracking** — 가격 추적 로그
7. **backtest_results** — 백테스트 결과
8. **transactions** — 결제/정산 내역
9. **withdrawal_requests** — 출금 요청
10. **notifications** — 알림

## 구독 등급 (tier-access.ts)
| 등급 | 딜레이 | 카테고리 | 일일시그널 | TP | 레버리지 | AI분석 |
|------|--------|---------|-----------|-----|---------|--------|
| free | ∞ | 없음 | 0 | 0 | ❌ | ❌ |
| basic | 30분 | 현물 | 3 | TP1 | ❌ | 요약 |
| pro | 10분 | 현물+선물 | 10 | TP1~2 | 보수적 | 상세 |
| premium | 실시간 | 전체 | 무제한 | TP1~3 | 전체 | 전체 |
| bundle | 선공개1h | 전체 | 무제한 | TP1~3 | 전체 | 전체 |

## Cron 스케줄 (vercel.json)
- generate-signals: 매 4시간 (KST 0/4/8/12/16/20시)
- track-signals: 매 30분
- calculate-backtest: 매일 자정
- weekly-report: 매주 월요일
- daily-briefing: 매일 22시

## 수익 분배 구조
- 파트너 등급별 수수료율:
  - Starter (0~50명): 80%
  - Pro (51~200명): 83%
  - Elite (201~500명): 85%
  - Legend (501명+): 88%
- 플랫폼(바틀) 몫: 20%~12%

## Notion
- 페이지 ID: `30cb8bbd7c9c81cb805ec8d10d835c7b`
- URL: https://www.notion.so/MoneySignal-30cb8bbd7c9c81cb805ec8d10d835c7b
- API 토큰: 환경변수 NOTION_API_TOKEN 참조 (로컬 메모장 또는 .env.local에 보관)

## 남은 작업 (TODO)
- [ ] 텔레그램 봇 토큰 발급 + 연동
- [ ] 카카오 알림톡 시그널 푸시 (카카오 비즈니스 채널)
- [x] PortOne STORE_ID + API_SECRET 설정 (02-19 완료)
- [x] Supabase schema.sql 추가 테이블 실행 (02-20 완료 — signal_views, user_signal_follows, telegram_connections 등)
- [x] 구독 만료 자동 갱신/해지 Cron (02-20 완료 — auto-billing + subscription-check)
- [x] 정산 주기 자동화 (02-19 완료 — monthly-settlement Cron)
