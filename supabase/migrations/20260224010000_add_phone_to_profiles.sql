-- profiles 테이블에 전화번호 + 알림톡 설정 컬럼 추가
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kakao_alimtalk_enabled BOOLEAN DEFAULT false;
