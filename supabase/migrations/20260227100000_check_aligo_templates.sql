CREATE OR REPLACE FUNCTION public.check_aligo_templates(
  p_api_key text,
  p_user_id text,
  p_sender_key text
) RETURNS jsonb AS $$
DECLARE
  resp extensions.http_response;
  body_str text;
BEGIN
  body_str := 'apikey=' || extensions.urlencode(p_api_key) 
    || '&userid=' || extensions.urlencode(p_user_id)
    || '&senderkey=' || extensions.urlencode(p_sender_key);

  SELECT * INTO resp FROM extensions.http((
    'POST',
    'https://kakaoapi.aligo.in/akv10/template/list/',
    ARRAY[extensions.http_header('Content-Type', 'application/x-www-form-urlencoded')],
    'application/x-www-form-urlencoded',
    body_str
  )::extensions.http_request);

  RETURN jsonb_build_object('status', resp.status, 'body', resp.content);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
