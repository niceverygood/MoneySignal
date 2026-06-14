-- ============================================
-- profiles: 푸시 알림 타입별 선호 + 온보딩 완료 플래그
--   · push_new_signal/tp_hit/sl_hit: 내정보 알림 토글이 실제로 저장·존중되도록
--     (기존엔 로컬 상태뿐이라 새로고침 시 복귀 + 발송 크론이 무시하던 버그)
--   · onboarded: 신규 OAuth 유저를 온보딩으로 유도하기 위한 게이트
-- 모두 추가형. 기존 유저는 백필로 영향 없음(푸시 유지·온보딩 완료 처리).
-- ============================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_new_signal boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_tp_hit boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_sl_hit boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false;

-- 기존 유저는 이미 앱 사용 중 → 온보딩 완료로 백필. 신규(트리거 생성 row)만 false 유지.
UPDATE public.profiles SET onboarded = true WHERE onboarded = false;
