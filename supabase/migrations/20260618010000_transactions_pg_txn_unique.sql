-- B2: transactions.pg_transaction_id 부분 UNIQUE 인덱스 (이중결제 방지)
-- ============================================================
-- IAP(apple_*) 및 PG 빌링키 결제가 중복 전송/재시도(replay)될 때 동일
-- pg_transaction_id 로 행이 두 번 들어가 이중 결제 기록이 생기는 것을 막는다.
-- 애플리케이션 코드(api/iap/verify, api/billing)는 이미 23505(UNIQUE 위반)를
-- "이미 처리됨"으로 멱등 처리하도록 작성돼 있으며, 이 인덱스가 그 전제를 DB에서 보장한다.
--
-- 부분 인덱스(WHERE pg_transaction_id IS NOT NULL):
--   파트너 정산 등 pg_transaction_id 가 없는(NULL) 행은 유일성 대상에서 제외한다.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uniq_transactions_pg_txn
  ON public.transactions (pg_transaction_id)
  WHERE pg_transaction_id IS NOT NULL;
