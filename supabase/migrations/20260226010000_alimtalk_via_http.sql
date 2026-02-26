-- ============================================
-- 알리고 알림톡 발송을 Supabase DB http extension으로 이전
-- Vercel IP 불일치 문제 해결: DB 고정 IP(65.0.147.111)에서 직접 호출
-- ============================================

-- 1. http extension 활성화
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- 2. send_alimtalk RPC 함수
CREATE OR REPLACE FUNCTION public.send_alimtalk(
  p_api_key text,
  p_user_id text,
  p_sender_key text,
  p_sender text,
  p_tpl_code text,
  p_receivers jsonb
) RETURNS jsonb AS $$
DECLARE
  batch_start int := 0;
  batch_size int := 500;
  total int;
  rec jsonb;
  body_parts text[];
  body_str text;
  idx int;
  resp extensions.http_response;
  results jsonb := '[]'::jsonb;
BEGIN
  total := jsonb_array_length(p_receivers);

  IF total = 0 THEN
    RETURN jsonb_build_object('total', 0, 'batches', '[]'::jsonb);
  END IF;

  WHILE batch_start < total LOOP
    -- URL-encoded body 파트 배열 초기화
    body_parts := ARRAY[
      'apikey=' || extensions.urlencode(p_api_key),
      'userid=' || extensions.urlencode(p_user_id),
      'senderkey=' || extensions.urlencode(p_sender_key),
      'tpl_code=' || extensions.urlencode(p_tpl_code),
      'sender=' || extensions.urlencode(p_sender)
    ];

    idx := 1;
    FOR i IN batch_start .. LEAST(batch_start + batch_size - 1, total - 1) LOOP
      rec := p_receivers->i;

      body_parts := body_parts || ARRAY[
        'receiver_' || idx || '=' || extensions.urlencode(replace(rec->>'phone', '-', '')),
        'subject_' || idx || '=' || extensions.urlencode(rec->>'subject'),
        'message_' || idx || '=' || extensions.urlencode(rec->>'message')
      ];

      IF rec->>'buttonUrl' IS NOT NULL THEN
        body_parts := body_parts || ARRAY[
          'button_' || idx || '=' || extensions.urlencode(
            json_build_object(
              'button', json_build_array(
                json_build_object(
                  'name', '앱에서 확인',
                  'linkType', 'WL',
                  'linkTypeName', '웹링크',
                  'linkMo', rec->>'buttonUrl',
                  'linkPc', rec->>'buttonUrl'
                )
              )
            )::text
          )
        ];
      END IF;

      idx := idx + 1;
    END LOOP;

    -- body 조합
    body_str := array_to_string(body_parts, '&');

    -- HTTP POST (form-urlencoded)
    SELECT * INTO resp FROM extensions.http((
      'POST',
      'https://kakaoapi.aligo.in/akv10/alimtalk/send/',
      ARRAY[extensions.http_header('Content-Type', 'application/x-www-form-urlencoded')],
      'application/x-www-form-urlencoded',
      body_str
    )::extensions.http_request);

    results := results || jsonb_build_object(
      'batch', (batch_start / batch_size) + 1,
      'status', resp.status,
      'body', resp.content
    );

    batch_start := batch_start + batch_size;
  END LOOP;

  RETURN jsonb_build_object('total', total, 'batches', results);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
