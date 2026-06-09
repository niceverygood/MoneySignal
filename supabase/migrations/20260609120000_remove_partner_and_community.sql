-- ============================================================
-- 리딩방(파트너) + 커뮤니티 기능 제거
-- 일반 사용자 구독 전용 서비스로 전환
-- ============================================================
-- 주의: 되돌릴 수 없습니다. 실행 전 DB 백업을 권장합니다.

-- ------------------------------------------------------------
-- 1. 파트너/정산/상품/출금 테이블 삭제
-- ------------------------------------------------------------
DROP TABLE IF EXISTS settlement_records CASCADE;
DROP TABLE IF EXISTS withdrawal_requests CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS partners CASCADE;

-- ------------------------------------------------------------
-- 2. 커뮤니티 테이블 삭제
-- ------------------------------------------------------------
DROP TABLE IF EXISTS community_reports CASCADE;
DROP TABLE IF EXISTS community_blocks CASCADE;
DROP TABLE IF EXISTS community_comments CASCADE;
DROP TABLE IF EXISTS community_messages CASCADE;

-- ------------------------------------------------------------
-- 3. 파트너 관련 컬럼 제거
-- ------------------------------------------------------------
ALTER TABLE subscriptions DROP COLUMN IF EXISTS partner_id;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS product_id;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS partner_share;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS platform_share;

ALTER TABLE transactions DROP COLUMN IF EXISTS partner_id;

ALTER TABLE profiles DROP COLUMN IF EXISTS referred_by;

-- ------------------------------------------------------------
-- 4. partner 역할로 남아있는 계정을 일반 user로 정규화
--    (admin 은 유지)
-- ------------------------------------------------------------
UPDATE profiles SET role = 'user' WHERE role = 'partner';
